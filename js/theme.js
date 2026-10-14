(function () {
    var saved = localStorage.getItem("attendly-theme");
    var theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
})();

function setTheme(theme) {
    localStorage.setItem("attendly-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    if (window.attSyncBar) setTimeout(window.attSyncBar, 30);
}

// Phone status bar: same colour as whatever is at the very top of the page
// (dark hero in dark mode, navy hero in light mode, page background elsewhere).
(function () {
    if (window.self !== window.top) return;
    function meta() {
        var m = document.querySelector('meta[name="theme-color"]');
        if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
        return m;
    }
    function topColor() {
        if (document.documentElement.classList.contains("att-splash")) return "#000000";
        var el = document.elementFromPoint(Math.round(window.innerWidth / 2), 1);
        while (el && el.nodeType === 1) {
            var c = getComputedStyle(el).backgroundColor;
            if (c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c)) return c;
            el = el.parentElement;
        }
        return getComputedStyle(document.body || document.documentElement).backgroundColor ||
            (document.documentElement.getAttribute("data-theme") === "dark" ? "#000000" : "#ffffff");
    }
    var last = "", queued = false;
    function sync() {
        queued = false;
        var c = topColor();
        if (c && c !== last) { last = c; meta().setAttribute("content", c); }
    }
    window.attSyncBar = sync;
    function later() { if (!queued) { queued = true; requestAnimationFrame(sync); } }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { sync(); setTimeout(sync, 400); });
    else sync();
    window.addEventListener("load", sync);
    window.addEventListener("scroll", later, { passive: true });
    window.addEventListener("pageshow", sync);
    new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
})();

// Splash screen: shown once per browser session, on the first page opened.
(function () {
    if (window.self !== window.top) return;
    // installed app: Android already shows its own launch screen (our icon), so ours is not needed
    try { if (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || navigator.standalone) return; } catch (e) {}
    try { if (sessionStorage.getItem("attendreem-splash")) return; sessionStorage.setItem("attendreem-splash", "1"); } catch (e) { return; }
    var root = document.documentElement;
    var css = document.createElement("style");
    css.id = "attSplashCss";
    css.textContent =
        "html.att-splash,html.att-splash body{overflow:hidden}" +
        "html.att-splash::after{content:'';position:fixed;inset:0;z-index:2147483646;background:#000000 url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%228%205%2046%2055%22%3E%3Cpath%20d%3D%22M37.2%209.2c1.3-1.4%203.6-1.6%205.2-.6c1%20.6%201.6%201.7%201.7%202.9l3.1%2040.8c.2%202.6-2.2%204.6-4.7%204l-12.1-3c-1.3-.3-2.2-1.4-2.3-2.7l-.3-4.2h-7.4l-2.3%202.2c-1%20.9-2.4%201.1-3.6.6l-1.2-.5c-1.6-.7-2.1-2.7-1-4.1L37.2%209.2z%22%20fill%3D%22%23C6F432%22%20stroke%3D%22%23C6F432%22%20stroke-width%3D%225.5%22%20stroke-linejoin%3D%22round%22/%3E%3Cpath%20d%3D%22M27.6%2031.2l-6.1%209.3h6.8l-.7-9.3z%22%20fill%3D%22%23000000%22%20stroke%3D%22%23000000%22%20stroke-width%3D%222.4%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E\") center calc(50% - 18px)/104px auto no-repeat;transition:opacity .38s ease;animation:attSpIn .6s cubic-bezier(.22,.8,.3,1) both}" +
        "html.att-splash::before{content:'Attendreem';position:fixed;left:0;right:0;top:calc(50% + 55px);z-index:2147483647;text-align:center;font:800 19px/1 'Bricolage Grotesque','Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.01em;color:#C6F432;transition:opacity .3s ease;animation:attSpTxt .7s ease .15s both}" +
        "html.att-splash.att-splash-out::after{opacity:0}" +
        "html.att-splash.att-splash-out::before{animation:attSpOut .18s ease forwards}" +
        "@keyframes attSpOut{from{opacity:1}to{opacity:0}}" +
        "@keyframes attSpIn{from{background-size:92px auto}to{background-size:104px auto}}" +
        "@keyframes attSpTxt{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
        "@media (prefers-reduced-motion:reduce){html.att-splash::after,html.att-splash::before{animation:none}}";
    document.head.appendChild(css);
    root.classList.add("att-splash");
    var start = Date.now(), MIN = 800, MAX = 2600, gone = false;
    function hide() {
        if (gone) return; gone = true;
        root.classList.add("att-splash-out");
        setTimeout(function () { root.classList.remove("att-splash", "att-splash-out"); css.remove(); }, 420);
    }
    function ready() { setTimeout(hide, Math.max(0, MIN - (Date.now() - start))); }
    if (document.readyState === "complete") ready(); else window.addEventListener("load", ready);
    setTimeout(hide, MAX);
})();

// Install-as-app + push notifications (loaded on every page)
(function () {
    var p = document.createElement("script");
    p.src = "js/push.js?v=20261014g";
    p.defer = true;
    document.head.appendChild(p);
})();

// Form buttons: dim until the needed fields are filled (loaded on every page)
(function () {
    var f = document.createElement("script");
    f.src = "js/formready.js?v=20261014g";
    f.defer = true;
    document.head.appendChild(f);
})();

// Numbers count up, charts grow (loaded on every page)
(function () {
    var a = document.createElement("script");
    a.src = "js/animate.js?v=20261014g";
    a.defer = true;
    document.head.appendChild(a);
})();

// Instagram-style swiping between bottom-menu pages and in-page tabs (phones)
(function () {
    var w = document.createElement("script");
    w.src = "js/swipe.js?v=20261014g";
    w.defer = true;
    document.head.appendChild(w);
})();

// Desktop sidebar (loaded on every page that includes theme.js)
(function () {
    var s = document.createElement("script");
    s.src = "js/sidebar.js?v=20261014g";
    s.defer = true;
    document.head.appendChild(s);
})();
