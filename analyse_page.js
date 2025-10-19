function extractVisibleText() {
    let text = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null, false);
    let node;
    while (node = walker.nextNode()) {
        if (node.tagName != "P") { console.log("FOUND NONTEXT"); continue; } 
        const trimmed = node.textContent.trim();
        if (trimmed.length > 40) text += trimmed + ' ';
    }
    return text;
}


// Sidebar will request text and backgroudn will send it
chrome.runtime.sendMessage({type : "ANALYSE_PAGE", text: extractVisibleText()});
