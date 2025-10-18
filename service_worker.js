// -----------------------------
// TruthLens Background Script
// -----------------------------

// === Google Fact Check API key and endpoint ===
const FACTCHECK_API_KEY = "AIzaSyAkDRBZx6ESrfrKaG0_qC_It93G1z_0Ed8";
const FACTCHECK_API = "https://factchecktools.googleapis.com/v1alpha1/claims:search";

// === Local MBFC dataset (100 domains) ===
// You must place "mbfc.json" in your extension’s background folder
const MBFC_DATA_URL = chrome.runtime.getURL("mbfc.json");

// === Load MBFC dataset ===
let mbfcData = null;
fetch(MBFC_DATA_URL)
  .then(res => res.json())
  .then(data => {
    mbfcData = data;
    console.log("MBFC dataset loaded:", data.length, "entries");
  })
  .catch(err => console.error("Failed to load MBFC dataset:", err));


// === Side panel activation ===
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));


// === Message handler from sidebar/content ===
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "ANALYSE_PAGE") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const text = msg.text || "";
    const domain = new URL(tab.url).hostname.replace("www.", "");

    console.log(`Analysing: ${domain}`);

    // Extract factual-looking sentences
    const claims = extractClaims(text);
    console.log("Extracted claims:", claims);

    // Attempt Google Fact Check API
    let factCheckResults = await checkClaims(claims);
    if (factCheckResults.length === 0) {
      console.warn("No Google results — using fallback fact-checking");
      factCheckResults = await fallbackFactCheck(claims);
    }

    // Analyse bias and source credibility
    const biasScore = getLocalBiasScore(text);
    const sourceRating = getSourceCredibility(domain);

    // Compute final reliability
    const finalScore = computeTruthScore(factCheckResults, biasScore, sourceRating);
    const summary = interpretScore(finalScore);

    console.log("Final results:", { finalScore, summary, biasScore, sourceRating });
    chrome.runtime.sendMessage({type : "RESULTS_RECIEVED", score: finalScore, summary: interpretScore(finalScore) });
    // Send back to sidebar
   
  }
  return true;
});


// === Extract potential factual claims ===
function extractClaims(text) {
  const matches = text.match(/[^.!?]*\b(is|are|was|were|claims?|says?|reports?|states?)\b[^.!?]*[.!?]/gi);
  return matches ? matches.slice(0, 5) : [];
}


// === Primary: Google Fact Check API ===
async function checkClaims(claims) {
  const results = [];
  for (const claim of claims) {
    const url = `${FACTCHECK_API}?languageCode=en&query=${encodeURIComponent(claim)}&key=${FACTCHECK_API_KEY}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data?.claims?.length > 0) {
        results.push(...data.claims.map(c => ({
          claim: c.text,
          rating: c.claimReview?.[0]?.textualRating || "Not verified",
          publisher: c.claimReview?.[0]?.publisher?.name || "Unknown"
        })));
      }
    } catch (err) {
      console.warn("Google fact check failed:", err);
    }
  }
  return results;
}


// === Fallback fact-check (free) using DuckDuckGo summaries ===
async function fallbackFactCheck(claims) {
  const results = [];
  for (const claim of claims) {
    const query = `fact check ${encodeURIComponent(claim)}`;
    const url = `https://api.duckduckgo.com/?q=${query}&format=json&no_html=1&no_redirect=1`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const abstract = data.AbstractText || "";
      results.push({
        claim,
        rating: abstract.length > 50 ? "Likely Verified" : "Not Verified",
        publisher: data.AbstractSource || "DuckDuckGo Summary"
      });
    } catch (err) {
      console.warn("Fallback fact check failed:", err);
    }
  }
  return results;
}


// === Bias word analysis ===
function getLocalBiasScore(text) {
  const biasWords = [
    "shocking", "disaster", "evil", "corrupt", "fake", "lies", "hoax", "agenda", "left-wing", "far-right", "right-wing", "war", "patriots",
      "traitor", "cover-up", "amazing", "outrageous", "disgrace", "terrible", "miracle", "opinion", "woke", "socialist", "capitalist", 
      "fake news", "clearly", "obviously", "without a doubt", "elites", "immigrants", "our nation", "hidden agenda", "critics", "unnamed sources"
  ];
  const emotionalWords = text.toLowerCase().split(/\W+/);
  const hits = emotionalWords.filter(w => biasWords.includes(w)).length;
  const biasRatio = hits / Math.max(1, emotionalWords.length / 600);
  return Math.min(biasRatio, 1);
}


// === Domain credibility lookup (MBFC dataset) ===
function getSourceCredibility(domain) {
  if (!mbfcData) return 0.5;
  const cleanDomain = domain.toLowerCase().replace(/^www\./, "");
  const entry = mbfcData.find(site => cleanDomain.includes(site.domain.toLowerCase()));
  if (!entry) return 0.5;

  switch ((entry.factual_reporting || "").toUpperCase()) {
    case "VERY HIGH": return 1.0;
    case "HIGH": return 0.9;
    case "MOSTLY FACTUAL": return 0.8;
    case "MIXED": return 0.6;
    case "LOW": return 0.4;
    case "VERY LOW": return 0.2;
    default: return 0.5;
  }
}


// === Combine bias, trust, and fact check ===
function computeTruthScore(factChecks, bias, trust) {
  const verified = factChecks.filter(f => f.rating.match(/true|accurate|verified/i)).length;
  const disputed = factChecks.filter(f => f.rating.match(/false|inaccurate|misleading/i)).length;

  let factScore;
  if (factChecks.length === 0) {
    factScore = trust; // no data — use source trust
  } else {
    factScore = Math.max(0, Math.min(1, (verified - disputed) / factChecks.length + 0.5));
  }

  // Weighted composite
  const score = (factScore * 0.4 + (1 - bias) * 0.3 + trust * 0.3) * 100;
  return Math.round(score);
}


// === Human-readable result ===
function interpretScore(score) {
  if (score > 85) return "Reliable";
  if (score > 70) return "Mostly Reliable";
  if (score > 50) return "Mixed Accuracy — verify key claims";
  if (score > 30) return "Likely Misleading or Biased";
  return "Unreliable Source";
}
