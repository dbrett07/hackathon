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

// Send the text to background when sidebar requests it
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_PAGE_TEXT") {
        sendResponse({ text: extractVisibleText() });
    }
});
