import {analyse_url} from "./analyse_url.js"

document.addEventListener("DOMContentLoaded", () => {
var analyse_url_button = document.getElementById("analyseurl");
analyse_url_button.addEventListener("click", analyse_url);});