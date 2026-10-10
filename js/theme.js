(function () {
    var saved = localStorage.getItem("attendly-theme");
    var theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
})();

function setTheme(theme) {
    localStorage.setItem("attendly-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
}

// Desktop sidebar (loaded on every page that includes theme.js)
(function () {
    var s = document.createElement("script");
    s.src = "js/sidebar.js?v=20261010e";
    s.defer = true;
    document.head.appendChild(s);
})();
