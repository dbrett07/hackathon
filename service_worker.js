function analyse_current_page(tab) { 
  const page_contents = tab.body.innerText;
  console.log(page_contents);
}

// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));


async function getTab() { 
  let queryOptions = { active: true};
  let tabs = await chrome.tabs.query(queryOptions);
  return tabs[0].url;
}

const FACTCHECK_API_KEY = "AIzaSyAkDRBZx6ESrfrKaG0_qC_It93G1z_0Ed8";
const FACTCHECK_API = "https://factchecktools.googleapis.com/v1alpha1/claims:search";
const MBFC_DATA_URL = "https://raw.githubusercontent.com/markokajzer/fact-check-sources/main/sources.json";

// Load datasets
let mbfcData = null;
fetch(MBFC_DATA_URL).then(res => res.json()).then(data => mbfcData = data);

// listen for sidebar's messages
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.type === "ANALYSE_PAGE") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        //const { text } = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_TEXT" });
        const text = msg.text
        const domain = new URL(tab.url).hostname.replace("www.", "");

        // Check top claims
        const claims = extractClaims(text);
        // Google fact check those claims
        const factCheckResults = await checkClaims(claims);
        // bias and tone
        const biasScore = getLocalBiasScore(text);
        // source credibility
        const sourceRating = getSourceCredibility(domain);
        // Overall score
        const finalScore = computeTruthScore(factCheckResults, biasScore, sourceRating);
        console.log(text);
        console.log(finalScore);
        console.log(interpretScore(finalScore));
        chrome.runtime.sendMessage({type : "RESULTS_RECIEVED", score: finalScore, summary: interpretScore(finalScore) });;
    }
    return true;
});


// Extracts sentences from text
function extractClaims(text) {
    const matches = text.match(/[^.!?]*\b(is|are|was|were|claims?|says?|reports?|states?)\b[^.!?]*[.!?]/gi);
    return matches ? matches.slice(0, 5) : [];
}


// Use Google fact check api
async function checkClaims(claims) {
  const results = [];
  for (const claim of claims) {
    const url = `${FACTCHECK_API}?languageCode=en&query=${encodeURIComponent(claim)}&key=${FACTCHECK_API_KEY}`;
    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data?.claims?.length > 0) {
        results.push(
          ...data.claims.map((c) => ({
            claim: c.text,
            rating: c.claimReview?.[0]?.textualRating || "Not verified",
            publisher: c.claimReview?.[0]?.publisher?.name || "Unknown",
          }))
        );
      } else {
        console.log("No fact checks found for:", claim);
      }
    } catch (err) {
      console.warn("Fact check request failed:", err);
    }
  }
  return results;
}


// bias and language detection as a backup
function getLocalBiasScore(text) {
    const biasWords = [
        "shocking", "disaster", "evil", "corrupt", "fake", "lies", "hoax", "agenda", "left-wing", "far-right", "right-wing", "war", "patriots",
        "traitor", "cover-up", "amazing", "outrageous", "disgrace", "terrible", "miracle", "opinion", "woke", "socialist", "capitalist", 
        "fake news", "clearly", "obviously", "without a doubt", "elites", "immigrants", "our nation", "hidden agenda", "critics", "unnamed sources"
    ];
    const emotionalWords = text.toLowerCase().split(/\W+/);
    const hits = emotionalWords.filter(w => biasWords.includes(w)).length;
    const biasRatio = hits / (emotionalWords.length || 1);

    // bias score 0–1 (higher = more biased)
    return Math.min(biasRatio * 200, 1);
}


// Rate based on dataset
function getSourceCredibility(domain) {
  if (!mbfcData) return 0.5;
  const cleanDomain = domain.replace(/^www\./, "").toLowerCase();
  const entry = Object.values(mbfcData).find(
    site => cleanDomain.includes((site.domain || "").toLowerCase())
  );
  if (!entry) return 0.5;
  if (entry.trust) return entry.trust; // already 0–1 range
  // fallback mapping
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



// Combine the three scores
function computeTruthScore(factChecks, bias, trust) {
  const verified = factChecks.filter(f => f.rating.match(/true|correct|accurate/i)).length;
  const disputed = factChecks.filter(f => f.rating.match(/false|inaccurate|misleading/i)).length;

  let factScore;
  if (factChecks.length === 0) {
    // No data → neutral assumption
    factScore = 0.6;
  } else {
    factScore = Math.max(0, Math.min(1, (verified - disputed) / Math.max(factChecks.length, 1) + 0.5));
  }

  const score = (factScore * 0.4 + (1 - bias) * 0.3 + trust * 0.3) * 100;
  return Math.round(score);
}



// Create a summary
function interpretScore(score) {
  if (score > 85) return "Reliable";
  if (score > 70) return "Some What Reliable";
  if (score > 50) return "Mixed Accuracy — verify key claims";
  return "Likely Misleading or Biased";
}
console.log({ factChecks, factScore, bias, trust, finalScore });
