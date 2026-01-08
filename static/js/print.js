function createPrintBtn(){
    const btn = document.createElement("button")
    btn.textContent = "Print";
    btn.id = "btnPrint";      
    document.getElementById('printwrapper').appendChild(btn);
    btn.addEventListener('click', function(e) {
        window.print();
        return false;            
    });
    
}
window.addEventListener("load",createPrintBtn);