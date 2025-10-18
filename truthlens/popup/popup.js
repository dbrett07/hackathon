// === TruthLens Popup Script ===
// Uses Google Fact Check Tools API to verify claims.
// Displays multiple fact-check results if available.
// Falls back to local bias-word detection if API fails or finds nothing.

document.addEventListener("DOMContentLoaded", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: "analyzeText" }, async (response) => {
        const status = document.getElementById("status");
        if (!response || !response.text) {
            status.innerText = "No readable text found on this page.";
            return;
        }

        status.innerText = "Contacting fact-check sources...";
        const result = await analyzeWithFactCheck(response.text, tab.url);
        displayResults(result);
    });
});

// --- MAIN FACT-CHECK FUNCTION ---
async function analyzeWithFactCheck(text, pageUrl) {
    const claim = extractClaim(text);
    const apiKey = "AIzaSyAkDRBZx6ESrfrKaG0_qC_It93G1z_0Ed8"; // <-- Replace with your API key
    const endpoint = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(
        claim
    )}&key=${apiKey}`;

    try {
        const response = await fetch(endpoint);
        const data = await response.json();

        if (!data.claims || data.claims.length === 0) {
            console.log("No fact checks found, using fallback bias analysis.");
            return fallbackBiasAnalysis(text, pageUrl);
        }

        // Limit to 3 results for clarity
        const results = data.claims.slice(0, 3).map((claimItem) => {
            const review = claimItem.claimReview?.[0];
            return {
                claim: claimItem.text || claim,
                verdict: review?.textualRating || "Unknown",
                publisher: review?.publisher?.name || "Unknown",
                reviewUrl: review?.url || "",
            };
        });

        // Aggregate score
        let trustMeter = 80;
        let color = "green";

        const verdicts = results.map((r) => r.verdict.toLowerCase()).join(" ");
        if (/false|pants|misleading/i.test(verdicts)) {
            trustMeter = 40;
            color = "red";
        } else if (/mixed|partly/i.test(verdicts)) {
            trustMeter = 60;
            color = "orange";
        }

        return {
            mode: "fact-check",
            results,
            trustMeter,
            color,
        };
    } catch (error) {
        console.error("Fact Check API Error:", error);
        return fallbackBiasAnalysis(text, pageUrl);
    }
}

// --- FALLBACK ANALYSIS ---
function fallbackBiasAnalysis(text, url) {
    const biasWords = [
        "shocking",
        "outrage",
        "disaster",
        "fake",
        "evil",
        "amazing",
        "crisis",
        "hero",
        "attack",
        "destroyed",
    ];

    let biasCount = 0;
    for (let w of biasWords) {
        const regex = new RegExp("\\b" + w + "\\b", "gi");
        const matches = text.match(regex);
        if (matches) biasCount += matches.length;
    }

    const domain = new URL(url).hostname;
    const trustedSources = {
        "bbc.com": "High",
        "theguardian.com": "High",
        "nytimes.com": "High",
        "foxnews.com": "Mixed",
        "infowars.com": "Low",
        "dailywire.com": "Low",
    };

    let domainTrust = "Unknown";
    for (const key in trustedSources) {
        if (domain.includes(key)) domainTrust = trustedSources[key];
    }

    const biasScore = Math.min(biasCount / 10, 1);
    let trustMeter = 100;
    if (biasScore > 0.5) trustMeter -= 30;
    if (domainTrust === "Low") trustMeter -= 40;
    if (domainTrust === "Mixed") trustMeter -= 15;

    let color = trustMeter >= 75 ? "green" : trustMeter >= 50 ? "orange" : "red";

    return {
        mode: "fallback",
        results: [
            {
                claim: "No verified claims found.",
                verdict: `Bias words detected: ${biasCount}`,
                publisher: `Source trust: ${domainTrust}`,
                reviewUrl
