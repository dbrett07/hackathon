import {analyse_current_page, analyse_url} from "./analysis.js"

document.addEventListener("DOMContentLoaded", () => {var analyse_current_button = document.getElementById("analysepage");
analyse_current_button.addEventListener("click", analyse_current_page);

var analyse_url_button = document.getElementById("analyseurl");
analyse_url_button.addEventListener("click", analyse_url);});