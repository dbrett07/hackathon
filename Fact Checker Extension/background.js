// background.js

const FACTCHECK_API = "https://factchecktools.googleapis.com/v1alpha1/claims:search";
const MBFC_DATA_URL = "https://raw.githubusercontent.com/BigMcLargeHuge/mbfc-dataset/main/mbfc.json";

// Load the Media Bias/Fact Check dataset
let mbfcData = null;
fetch(MBFC_DATA_URL).then(res => res.json()).then(data => mbfcData = data);

// Listen for messages from sidebar
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.type === "ANALYSE_PAGE") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const { text } = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_TEXT" });

        const domain = new URL(tab.url).hostname.replace("www.", "");

        // Extract top claims to check
        const claims = extractClaims(text);

        // Check those claims via Google Fact Check
        const factCheckResults = await checkClaims(claims);

        // Local bias and tone check (no API)
        const biasScore = getLocalBiasScore(text);

        // Rate source reliability
        const sourceRating = getSourceCredibility(domain);

        // Combine results into a single truth score
        const finalScore = computeTruthScore(factCheckResults, biasScore, sourceRating);

        sendResponse({
            result: {
                domain,
                biasScore,
                sourceRating,
                factCheckResults,
                finalScore,
                summary: interpretScore(finalScore)
            }
        });
    }
    return true;
});


// 🧠 Extract simple factual-sounding sentences
function extractClaims(text) {
    const matches = text.match(/[^.!?]*\b(is|are|was|were|claims?|says?|reports?|states?)\b[^.!?]*[.!?]/gi);
    return matches ? matches.slice(0, 5) : [];
}


// ✅ Query Google Fact Check API
async function checkClaims(claims) {
    const results = [];
    for (const claim of claims) {
        const url = `${FACTCHECK_API}?query=${encodeURIComponent(claim)}`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.claims) {
                results.push(...data.claims.map(c => ({
                    claim: c.text,
                    rating: c.claimReview?.[0]?.textualRating || "Not verified",
                    publisher: c.claimReview?.[0]?.publisher?.name || "Unknown"
                })));
            }
        } catch (err) {
            console.warn("Fact check failed:", err);
        }
    }
    return results;
}


// ⚖️ Local bias and emotional language detection
function getLocalBiasScore(text) {
    const biasWords = [
        "shocking", "disaster", "evil", "corrupt", "fake", "lies", "hoax", "agenda",
        "traitor", "cover-up", "amazing", "outrageous", "disgrace", "terrible", "miracle"
    ];
    const emotionalWords = text.toLowerCase().split(/\W+/);
    const hits = emotionalWords.filter(w => biasWords.includes(w)).length;
    const biasRatio = hits / (emotionalWords.length || 1);

    // Return bias score 0–1 (higher = more biased/emotional)
    return Math.min(biasRatio * 200, 1);
}


// 📰 Rate based on MediaBiasFactCheck dataset
function getSourceCredibility(domain) {
    if (!mbfcData) return 0.5;
    const entry = Object.values(mbfcData).find(site => domain.includes(site.domain || ""));
    if (!entry) return 0.5;
    if (entry.factual_reporting === "HIGH" || entry.factual_reporting === "VERY HIGH") return 1.0;
    if (entry.factual_reporting === "MIXED") return 0.6;
    if (entry.factual_reporting === "LOW" || entry.factual_reporting === "VERY LOW") return 0.3;
    return 0.5;
}


// 🧮 Combine the three scores
