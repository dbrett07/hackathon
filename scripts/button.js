import {analyse_url} from "./analyse_url.js"

document.addEventListener("DOMContentLoaded", () => {
var analyse_url_button = document.getElementById("analyseurl");
analyse_url_button.addEventListener("click", analyse_url);});

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => { 
    if (msg.type == "RESULTS_RECIEVED") {
        var results_txt = document.getElementById("mypara")
        results_txt.textContent = "AAAAAAAAAAAAAAAAAAA";
    }
})