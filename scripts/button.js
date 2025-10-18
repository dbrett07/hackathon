import {analyse_url} from "./analyse_url.js"

document.addEventListener("DOMContentLoaded", () => {
var analyse_url_button = document.getElementById("analyseurl");
analyse_url_button.addEventListener("click", analyse_url);});

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => { 
    if (msg.type == "RESULTS_RECIEVED") {
        var score_txt = document.getElementById("score");
        score_txt.textContent = msg.score;
        var summary_txt = document.getElementById("summary");
        summary_txt.textContent = msg.summary;

    }
})