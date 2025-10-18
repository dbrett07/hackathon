// content.js
function extractVisibleText() {
    let text = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        const trimmed = node.textContent.trim();
        if (trimmed.length > 40) text += trimmed + ' ';
    }
    return text;
}

// Sidebar will request text and backgroudn will send it
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.type === "GET_PAGE_TEXT") {
        sendResponse({ text: extractVisibleText() });
    }
});
