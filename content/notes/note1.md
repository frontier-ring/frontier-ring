+++
title = "Announcing Velarium - blockchain execution at scale"
date = 2026-01-05
description = "Velarium announcement blog post."
draft = false

[taxonomies]
tags = ["announcement"]

[extra]
show_copyright = true
show_comments = true
show_shares = true
keywords = "cloud,infrastructure,security,management,migration"
+++
Introducing Velarium: a modular horizontally scalable transaction execution fabric.

Ethereum today is effectively a **single-threaded machine** at the protocol level. Blocks are ordered, and within a block there is one canonical, non-overlapping execution order. Most L2s inherit this: they may parallelize internally, but what they publish still has to look like clean, serial execution.

As Ethereum and the larger blockchain ecosystem move toward parallelization, we start encountering issues that heavily limit our ability to extract parallelism from transaction execution: a highly contended state, bursts of degenerate workloads, shared hot contracts that everyone hammers, and long dependency chains.

The go-to solution for concurrency control is optimism (OCC) - an approach that assumes low contention rates and speculatively executes all transactions together, as if they will not conflict. If some do, the conflicted transactions are invalidated and rerun. This process continues until all transactions are resolved. 

In theory it should provide a significant throughput increase, but in reality this approach is hit with a ~35% conflict rate on a typical L1 block, which significantly limits the possible performance boost: most teams report gains in the 3–7× range. Other chains and rollups have different numbers, but the shape remains the same. This approach also suffers economically: while the execution head is highly parallel, its tail suffers from heavy under-utilization of the CPU, with most of the cores idling while the conflicting transaction cluster is being processed.

And most importantly, OCC is very hard to horizontally scale both technically and performance-wise. To validate a block you need a global view of all reads and writes of the state for all transactions. In a single-process system that’s painful but manageable. In a cluster it turns into a distributed validation phase: nodes have to ship access metadata around, agree on which transactions to keep, and coordinate retries. As more machines are added, the cost of that coordination and the latency of the validation step grow, and the nice parallel head degenerates into a very expensive global tail.

Even if we generously assume perfect scaling on the conflict-free part, a 35% conflict rate puts a hard constant-factor speedup limit. On modern CPUs with dozens of cores and deep pipelines, this leaves most of the hardware idle. OCC improves the picture, but it doesn’t come close to saturating what a single box could theoretically do, let alone a cluster.

Another way of approaching this performance bottleneck is to leave Ethereum compatibility behind and introduce a new protocol and execution machinery that are friendlier to parallelism.

Velarium aims to extract more parallelism than OCC-style designs can realistically reach by reframing the problem: instead of speculating on whole transactions and validating them in bulk, it focuses on how individual pieces of state are accessed and updated, and builds the execution model around that.

The goal is not just to bump a “gas per second” number, but to keep every piece of hardware saturated with positive work – useful computation that actually moves the system towards a valid state.

### Where Velarium fits

Velarium is designed as a drop-in, modular execution fabric: it slots into an existing Ethereum-style stack between the sequencer and the state/proving layer, without asking you to change your contracts or consensus. It is not a new L1, not a DA layer, and not a prover – it’s the execution plane in between.

### Horizontally scalable

When software hits performance wall on a particular machine, there are fundamentally two choices available:

- scale vertically and buy a bigger and bigger box, or
- scale horizontally and spread the work across a multiple machines without breaking the Ethereum execution model – the illusion that everything ran sequentially.

Velarium is built for the second option.

Instead of being locked into buying expensive “monster” boxes, horizontal scalability allows running a cluster of regular machines and keep adding more. Compute, memory, disk and network can be tuned separately for your use case instead of being welded together into one expensive node. In turn, this reduces the cost of the infrastructure and makes it more predictable.

Today, if you want that kind of horizontal scale and still stay within the Ethereum model, your options are extremely limited. Solana gives you parallelism, but lives in its own ecosystem; most EVM chains and L2s still scale mainly by buying bigger boxes. Velarium is built to be the missing execution fabric in that gap.

The important part is that the fabric doesn’t require a classic **agreement phase over the current state** between those machines. There is still consensus on blocks and inputs, but the execution layer itself does not run distributed two-phase commits or global locks on fine-grained state. Each machine follows the same stream of work and the same rules. Correctness comes from the execution model, not from everybody stopping to negotiate the exact state after every step.

Work is organized into batches. When a particular machine runs out of useful work in a batch – typically near the tail, where a naive system would be stuck draining a small cluster of conflicting transactions – Velarium assigns its free cores to other batches.

Because batches don’t have to be drained strictly one after another on each box, you don’t get the usual long idle tails where most cores sit there waiting for a small hot spot to clear. The cluster stays saturated with **positive work** even when individual batches are messy.

### Execution model and compatibility

Velarium maintains compatibility with the Ethereum execution model. While under the hood transactions are executed in arbitrary order, the result seem as if everything was done sequentially. 

Ensuring the results of a parallel execution are consistent with sequential is the cornerstone of any Ethereum scalability solution. Not only it does need to guarantee correctness, but also be robust and never fail, and be fast. Velarium takes a state slot centric approach and has a single rule it upholds:

**`For each pair of state accesses, invalid reads are disallowed.`**

Instead of attempting to resolve conflicts between transactions directly, Velarium’s goal is to find a valid state update path. Working at the level of individual state accesses gives the system more room to manoeuvre: there are far more ways to interleave reads and writes than there are ways to totally order whole transactions.

Canonical transaction order thus becomes an emergent property of the system. The system doesn’t need to take any global steps to order the execution in a particular way - the execution converges to the required solution naturally. 

An important property of this rule is that it’s local. This has two important consequences:

- It’s cheap to apply - In contrast to optimistic concurrency, that requires to halt all execution and do a costly search to verify a solution, Velarium doesn’t need to stop. It immediately has the require data at hand, and in case of a conflict, the violating execution is immediately invalidated.
- It’s easy to apply, making it bullet proof and significantly reducing overall complexity. This simplifies implementation of advanced optimizations, that would be otherwise hard to prove for correctness.

Because the rule is local and enforced continuously, Velarium can keep its management overhead low. There are no global validation pauses; execution flows without coordinated stalls, corrects itself locally when needed, and eventually reaches the correct state that Ethereum expects.

### Concurrency Control

Velarium doesn’t assume that transactions are highly disjoint and can be executed independently. Instead, it schedules execution deliberately, based on the available information about contract state access profiles, historical data, chain state, risk-cost analysis, and only falls back to optimistic speculation as a last resort option.

Additionally, transactions aren’t scheduled as atomic blobs. Compute and state access segments are scheduled separately, allowing the scheduler to achieve three things:

- **Parallelize disjoint transaction segments.** Transactions don’t conflict as a whole, only on parts that read and modify the same state. All other parts are free to run in parallel.
- **Make informed decisions about state access.** Not all accesses are equal. Smaller transactions are cheaper to invalidate, reading a hot slot is riskier than a cold one. By examining the context around each access, the scheduler can decide whether to allow it now or defer it to a safer time.
- **Schedule special execution phases.** Certain patterns can be handled in dedicated phases that reduce the impact of contention, or even eliminate it entirely for some operations (for example, read–modify–write chains with unobservable monoid updates).

This creates more room for parallelism and lets the scheduler bend the probabilities of encountering a conflict during speculation, steering the overall execution into a low-conflict path. When a conflict is hit, the scheduler records the dependency data for all involved transactions and, after invalidation, uses that information to schedule them deliberately next time.

This makes the scheduling scheme adaptive. As conflicts are encountered, the scheduler gains insight about contract behaviour and can schedule its execution with greater efficiency.

In practice, the scheduler works in layers: it first tries to schedule structurally. If there’s not enough information, it attempts educated speculation. Only if there’s no information available whatsoever it falls back to blind optimistic speculation.

Taken together, Velarium’s parallelization is best described as an **adaptive layered concurrency control.**

### Adversarial and degenerate workloads

Velarium’s execution model takes into account the risk of DoS attacks and natural bursts of usage hammering specific contract or address (liquidations, airdrops, mints).

During periods of natural high contention, the system deepens and narrows the pipeline, attempting to retain the aggregate total throughput. As the contended workload reduces the immediate throughput, the pipeline continues to process other unrelated transactions. Once the contended region passes, the system is now able to commit those transactions in a quick burst.

For long naturally contended workloads, like a meme coin rush, the system employs robust observability tools and can detect contested state or contract domains that cause the workflow to narrow. It can then report back with specific advisories about the incoming traffic that the operator may act on. The system is able to advise how to reorder the incoming traffic to have a strictly better performance envelope both in latency and throughput, without making any participant worse off.

Adversarial workloads are also detected. The system can detect if it was saturated by single or multiple lanes of degenerate traffic and can be tweaked to confine them to specific envelopes, as a matter of policy or at runtime.

### Contract analysis and synthesis

Each contract is JIT re-compiled into two artifacts that facilitate the requirements and provide the services of other parts of the system (* wording?).

The first one is the contract analysis data. Velarium extracts information about state access profile, the data that the scheduler can later use. It analyses what addresses are going to be accessed, when, if there are conditions that affect the accesses, and it provides the tools for the scheduler to compute the access list.

The second artifact is the natively recompiled contract with cooperation machinery, chain semantics (e.g. gas calculation) and execution trace (in case of zk) embedded within it, while simultaneously stripping the source bytecode ISA machinery. This serves several purposes:

- Better per core performance. By recompiling the contract into native code, it can be executed much faster, improving per-core performance.
- Enables scheduler cooperation. This is required to be able to allow transactions to pause, resume, on phase boundaries or to be scheduled in special execution phases. It also reduces the operating system involvement in program’s execution, further reducing overhead.
- Embeds and optimizes chain semantics. This is particularly important for zero-knowledge systems, that generate heavy execution traces for the proof system. By embedding the trace emission within the contract logic, the CPU is able to increase its own pipeline saturation, greatly increasing the performance and shadowing much of the trace generation.
Non zk systems also enjoy increased performance from embedding gas calculations, just to a lesser extent.

Velarium targets EVM as the first bytecode language to support, but it potentially supports any bytecode: RISC-V, Move, WASM, etc. It intentionally separates source bytecode processing from analysis and compilation through an own intermediary representation.

### Highly optimized and hardware aware

Special care was taken in designing Velarium to be both algorithmically efficient and to map well onto real hardware. Data locality, cache efficiency, memory and I/O traffic are all taken into account. 

State is managed integrally with the execution, making sure that hot state is kept in CPU caches most of the time for the fastest access possible. Cold state accesses, when it needs to be fetched from network or disk, and even warm accesses, when it is fetched from memory, are shadowed by compute from other transactions, effectively hiding state access latency.

The cluster and system topology are designed so that network usage scales as close to linearly as possible with cluster and machine size. Velarium actively uses data streaming, reducing the number of packets in flight, ensuring that network bandwidth, rather than message management, stays the limiting factor.
