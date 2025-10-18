// === TruthLens Popup Script ===
// Uses Google Fact Check Tools API to verify claims.
// Falls back to local bias-word detection if API results are missing.

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

// --- MAIN ANALYSIS FUNCTION ---
async function analyzeWithFactCheck(text, pageUrl) {
    const claim = extractClaim(text);
    const apiKey = "AIzaSyDMxke9wwFfWX9Bqzi080osLLVB0o60484"; // <-- Replace this with your key
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

        // Take the first matching fact check
        const check = data.claims[0];
        const review = check.claimReview?.[0];
        const textRating = review?.textualRating || "Unknown";
        const publisher = review?.publisher?.name || "Unknown";
        const reviewUrl = review?.url || "";
        const claimTitle = check.text || claim;

        // Basic scoring logic
        let trustMeter = 80;
        let color = "green";
        if (/false|pants|misleading/i.test(textRating)) {
            trustMeter = 40;
            color = "red";
        } else if (/mixed|partly/i.test(textRating)) {
            trustMeter = 60;
            color = "orange";
        }

        return {
            mode: "fact-check",
            claim: claimTitle,
            verdict: textRating,
            publisher,
            reviewUrl,
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
        claim: "No verified claims found.",
        verdict: `Bias words: ${biasCount}`,
        publisher: `Source trust: ${domainTrust}`,
        reviewUrl: "",
        trustMeter,
        color,
    };
}

// --- UI UPDATE ---
function displayResults(result) {
    const { mode, claim, verdict, publisher, reviewUrl, trustMeter, color } = result;

    const status = document.getElementById("status");
    const resultDiv = document.getElementById("result");
    const bar = document.getElementById("bar");

    if (mode === "fact-check") {
        status.innerText = "Fact check complete ✅";
        resultDiv.innerHTML = `
        <b>Claim:</b> ${claim}<br/>
        <b>Verdict:</b> ${verdict}<br/>
        <b>Publisher:</b> ${publisher}<br/>
        ${reviewUrl ? `<a href="${reviewUrl}" target="_blank">Read more</a>` : ""}
        `;
    } else {
        status.innerText = "Fallback bias analysis used.";
        resultDiv.innerHTML = `
        <b>${claim}</b><br/>
        <b>${verdict}</b><br/>
        <b>${publisher}</b>
        `;
    }

    bar.style.width = trustMeter + "%";
    bar.style.background = color;
}

// --- HELPERS ---
function extractClaim(text) {
    // Grab the first clear sentence (short and declarative)
    const sentences = text.split(/[.!?]/);
    const claim = sentences.find((s) => s.length > 30) || text.slice(0, 200);
    return claim.trim();
}
