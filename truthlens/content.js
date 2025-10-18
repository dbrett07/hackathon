// Extract main visible text from page
function getPageText() {
    const text = document.body.innerText || "";
    return text.slice(0, 8000); // limit for speed
}

// Listen for popup requests
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "analyzeText") {
        const pageText = getPageText();
        sendResponse({ text: pageText });
    }
});
