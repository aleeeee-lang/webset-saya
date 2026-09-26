(function () {
    var saved = localStorage.getItem("attendly-theme");
    var theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
})();

function setTheme(theme) {
    localStorage.setItem("attendly-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
}
