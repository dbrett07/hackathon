export function updateIndicator(score) {
    const indicator = document.getElementById('indicator');
    if (score >= 75) {
        indicator.style.background = "green";
    } else if (score >= 50) {

        indicator.style.background = "orange";
    } else {

        indicator.style.background = "red";
    }}