function debounce(func, wait) {
  var timeout;

  return function () {
    var context = this;
    var args = arguments;
    clearTimeout(timeout);

    timeout = setTimeout(function () {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}

function makeTeaser(body, terms) {
  var TERM_WEIGHT = 40;
  var NORMAL_WORD_WEIGHT = 2;
  var FIRST_WORD_WEIGHT = 8;
  var TEASER_MAX_WORDS = 20;

  var stemmedTerms = terms.map(function (w) {
    return elasticlunr.stemmer(w.toLowerCase());
  });
  var termFound = false;
  var index = 0;
  var weighted = []; // contains elements of ["word", weight, index_in_document]

  // split in sentences, then words
  var sentences = body.toLowerCase().split(". ");

  for (var i in sentences) {
    var words = sentences[i].split(" ");
    var value = FIRST_WORD_WEIGHT;

    for (var j in words) {
      var word = words[j];

      if (word.length > 0) {
        for (var k in stemmedTerms) {
          if (elasticlunr.stemmer(word).startsWith(stemmedTerms[k])) {
            value = TERM_WEIGHT;
            termFound = true;
          }
        }
        weighted.push([word, value, index]);
        value = NORMAL_WORD_WEIGHT;
      }

      index += word.length;
      index += 1;  // ' ' or '.' if last word in sentence
    }

    index += 1;  // because we split at a two-char boundary '. '
  }

  if (weighted.length === 0) {
    return body;
  }

  var windowWeights = [];
  var windowSize = Math.min(weighted.length, TEASER_MAX_WORDS);
  // We add a window with all the weights first
  var curSum = 0;
  for (var i = 0; i < windowSize; i++) {
    curSum += weighted[i][1];
  }
  windowWeights.push(curSum);

  for (var i = 0; i < weighted.length - windowSize; i++) {
    curSum -= weighted[i][1];
    curSum += weighted[i + windowSize][1];
    windowWeights.push(curSum);
  }

  // If we didn't find the term, just pick the first window
  var maxSumIndex = 0;
  if (termFound) {
    var maxFound = 0;
    // backwards
    for (var i = windowWeights.length - 1; i >= 0; i--) {
      if (windowWeights[i] > maxFound) {
        maxFound = windowWeights[i];
        maxSumIndex = i;
      }
    }
  }

  var teaser = [];
  var startIndex = weighted[maxSumIndex][2];
  for (var i = maxSumIndex; i < maxSumIndex + windowSize; i++) {
    var word = weighted[i];
    if (startIndex < word[2]) {
      // missing text from index to start of `word`
      teaser.push(body.substring(startIndex, word[2]));
      startIndex = word[2];
    }

    // add <em/> around search terms
    if (word[1] === TERM_WEIGHT) {
      teaser.push("<b>");
    }
    startIndex = word[2] + word[0].length;
    teaser.push(body.substring(word[2], startIndex));

    if (word[1] === TERM_WEIGHT) {
      teaser.push("</b>");
    }
  }
  teaser.push("…");
  return teaser.join("");
}

function formatSearchResultItem(item, terms) {
  return '<div class="search-results__item">'
  + `<h4><a href="${item.ref}">${item.doc.title}</a></h4>`
  + `<div class="teaser">${makeTeaser(item.doc.body, terms)}</div>`
  + '</div>';
}

function initSearch() {
  var $searchInput = document.getElementById("searchInput");
  var $searchResults = document.getElementById('sResults');
  var $searchResultsItems = document.getElementById('sResultsUL')
  var MAX_ITEMS = 5;

  var options = {
    bool: "AND",
    fields: {
      title: {boost: 2},
      body: {boost: 1},
    }
  };
  var currentTerm = "";
  var index;
  
  var initIndex = async function () {
    if (index === undefined) {
      let $baseUrl = document.head.dataset['baseUrl']
      index = fetch($baseUrl + "search_index.en.json")
        .then(
          async function(response) {
            return await elasticlunr.Index.load(await response.json());
        }
      );
    }
    let res = await index;
    return res;
    
  }

  $searchInput.addEventListener("keyup", debounce(async function() {
    if ($searchInput.value != '') {
      $searchInput.classList.add("textIn")
    } else {
      $searchInput.classList.remove("textIn")
    }
    var term = $searchInput.value.trim();
    if (term === currentTerm) {
      return;
    }
    $searchResults.style.display = term === "" ? "none" : "block";
    $searchResultsItems.innerHTML = "";
    $searchResults.style.top = `${document.documentElement.scrollTop}px`;
    $searchResultsItems.style.display="block";
    $searchResultsItems.style.transition="opacity 3s";
    
    currentTerm = term;
    if (term === "") {
      return;
    }

    var results = (await initIndex()).search(term, options);
    if (results.length === 0) {
      $searchResults.style.display = "none";
      return;
    }
    var item = document.createElement("li");
    clSearch = `<a class="closeBtn" href='#' onclick="closeSearchResults();"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M64 80c-8.8 0-16 7.2-16 16V416c0 8.8 7.2 16 16 16H448c8.8 0 16-7.2 16-16V96c0-8.8-7.2-16-16-16H64zM0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zm175 79c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z"/></svg></a>`
    item.innerHTML = clSearch;
    $searchResultsItems.appendChild(item);

    for (var i = 0; i < Math.min(results.length, MAX_ITEMS); i++) {
      var item = document.createElement("li");
      item.innerHTML = formatSearchResultItem(results[i], term.split(" "));
      $searchResultsItems.appendChild(item);
    }
  }, 150));

  window.addEventListener('click', function(e) {
    if ($searchResults.style.display == "block" && !$searchResults.contains(e.target)) {
      $searchResults.style.display = "block";
    }
  });
}

function closeSearchResults() {
  document.getElementById("sResults").style.display="none";
  document.getElementById("searchInput").value="";
  document.getElementById("searchInput").classList.remove("textIn");
  initSearch;
}
