(function () {
    var saved = localStorage.getItem("attendly-theme");
    var theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
})();

// Open the connection to the database while the page is still loading, so the first
// data request doesn't wait for it (saves a few hundred ms on a phone connection)
(function () {
    [["https://vqpxumrodadqqaxuyehy.supabase.co", true], ["https://cdn.jsdelivr.net", false]].forEach(function (h) {
        var l = document.createElement("link"); l.rel = "preconnect"; l.href = h[0];
        if (h[1]) l.crossOrigin = "anonymous";     // the database is fetched with CORS, the library script isn't
        document.head.appendChild(l);
    });
})();

// Requests in flight (for "has this page finished loading its data?")
window.attNet = { inflight: 0, quietAt: 0, ever: false };
(function () {
    var of = window.fetch;
    if (!of) return;
    window.fetch = function () {
        var n = window.attNet;
        n.inflight++; n.ever = true;
        var p = of.apply(this, arguments);
        var d = function () { n.inflight = Math.max(0, n.inflight - 1); if (!n.inflight) n.quietAt = Date.now(); };
        p.then(d, d);
        return p;
    };
})();

// Snapshots of the bottom-menu pages (saved by js/swipe.js) drawn as a still picture:
// used while swiping, and right after a swipe until the new page has its data.
window.attSnapClean = function (root) {
    Array.prototype.forEach.call(root.querySelectorAll("script,iframe,object,embed,video,audio,.bottom-nav,.att-swipe-ghost,.v2-side,.v2-search-panel,#toastContainer,.toast-container,dialog,[role=dialog]"), function (n) { n.remove(); });
    // ids stay: the page styles hang on them (e.g. the camera box on Absensi)
    Array.prototype.forEach.call(root.querySelectorAll("*"), function (n) {
        for (var i = n.attributes.length - 1; i >= 0; i--) {
            var a = n.attributes[i].name;
            if (/^on/i.test(a) || a === "data-count" || a === "data-needs" || a === "autofocus") n.removeAttribute(a);
        }
        if (n.tagName === "A") n.removeAttribute("href");
    });
};
// the app version (style.css?v=...): a picture saved by an older version of the app has the
// old layout, so it is never shown after an update
window.attAppVer = function () {
    var l = document.querySelector('link[rel="stylesheet"][href*="style.css"]');
    var m = l && /[?&]v=([^&]+)/.exec(l.getAttribute("href") || "");
    return m ? m[1] : "";
};
window.attSnapGhost = function (href, label) {
    var g = document.createElement("div");
    g.className = "att-swipe-ghost";
    g.setAttribute("aria-hidden", "true");
    var snap = null;
    try { snap = JSON.parse(localStorage.getItem("att-snap:" + href) || "null"); } catch (e) {}
    // the check-in page: only a picture of today's "checked in" state counts (js/swipe.js)
    if (snap && href === "attendance.html" && !snap.done) snap = null;
    if (snap && (!snap.t || new Date(snap.t).toDateString() !== new Date().toDateString())) snap = null;
    if (snap && (snap.v || "") !== window.attAppVer()) snap = null;
    // saved in the other colour mode (light <-> dark): charts and inline colours would be wrong
    var theme = document.documentElement.getAttribute("data-theme") || "light";
    if (snap && (snap.theme || "light") !== theme) snap = null;
    var inner = document.createElement("div");
    inner.className = "att-swipe-body";
    if (snap && snap.html) {
        var tpl = document.createElement("template");
        tpl.innerHTML = snap.html;
        window.attSnapClean(tpl.content);
        inner.appendChild(tpl.content);
        if (snap.cls) inner.className += " " + snap.cls.replace(/\bhas-side\b/g, "");
        inner.style.padding = snap.pad || "";
    } else {
        // nothing saved yet: just the page colour (no title or boxes that then jump to the real page)
        inner.className += " att-swipe-skel";
    }
    g.appendChild(inner);
    g._hasSnap = !!(snap && snap.html);
    g._age = snap && snap.t ? Date.now() - snap.t : Infinity;
    return g;
};

// Arriving here by a swipe: keep showing the page exactly as it looked during the swipe
// until its data has loaded, then swap to the live page (no empty/jumping moment).
(function () {
    var swiped = null;
    try { swiped = sessionStorage.getItem("att-swiped"); } catch (e) {}
    if (!swiped || window.self !== window.top || document.prerendering) return;
    var page = (location.pathname.split("/").pop() || "index.html");
    var root = document.documentElement;
    root.classList.add("att-swiped-in");
    var ov = null, t0 = Date.now(), dcl = 0, net = window.attNet;
    function mount() {
        if (ov) return true;
        if (!document.body) return false;
        var g = window.attSnapGhost(page, "");
        if (!g._hasSnap || g._age > 20 * 60 * 1000) return true;   // nothing recent saved: just show the page
        g.classList.add("att-arrive");
        g.style.transform = "none";
        // after <body> (not inside it): the page's own elements stay first in the document,
        // so the page's scripts find and fill those, never the picture
        root.appendChild(g);
        ov = g;
        return true;
    }
    if (!mount()) {
        var mo = new MutationObserver(function () { if (mount()) mo.disconnect(); });
        mo.observe(root, { childList: true });
    }
    document.addEventListener("DOMContentLoaded", function () { dcl = Date.now(); });
    window.attArriveDone = function () { done(); };
    // the person starts scrolling or touching: show the live page straight away
    ["touchstart", "wheel", "keydown"].forEach(function (ev) { window.addEventListener(ev, function () { done(); }, { once: true, passive: true, capture: true }); });
    function done() {
        root.classList.remove("att-swiped-in");
        if (!ov) return;
        var g = ov; ov = null;
        requestAnimationFrame(function () { requestAnimationFrame(function () { g.remove(); }); });
    }
    (function check() {
        var now = Date.now();
        var settled = dcl && !net.inflight && (net.ever ? now - net.quietAt > 120 : now - dcl > 450);
        if (settled || now - t0 > 3000) return done();
        setTimeout(check, 40);
    })();
})();


function setTheme(theme) {
    localStorage.setItem("attendly-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    if (window.attSyncBar) setTimeout(window.attSyncBar, 30);
}

// Phone status bar: one steady colour per page - always black in dark mode; in light mode
// the colour at the top of the page when it opens (navy hero / page background).
// It no longer follows scrolling, so it never flashes green or other card colours.
(function () {
    if (window.self !== window.top) return;
    function meta() {
        var m = document.querySelector('meta[name="theme-color"]');
        if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
        return m;
    }
    function topColor() {
        if (document.documentElement.classList.contains("att-splash")) return "#000000";
        if (document.documentElement.getAttribute("data-theme") === "dark") return "#000000";
        if (window.scrollY > 4 && last) return last;          // only judged at the top of the page
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
    p.src = "js/push.js?v=20261023a";
    p.defer = true;
    document.head.appendChild(p);
})();

// Form buttons: dim until the needed fields are filled (loaded on every page)
(function () {
    var f = document.createElement("script");
    f.src = "js/formready.js?v=20261023a";
    f.defer = true;
    document.head.appendChild(f);
})();

// Numbers count up, charts grow (loaded on every page)
(function () {
    var a = document.createElement("script");
    a.src = "js/animate.js?v=20261023a";
    a.defer = true;
    document.head.appendChild(a);
})();

// Instagram-style swiping between bottom-menu pages and in-page tabs (phones)
(function () {
    var w = document.createElement("script");
    w.src = "js/swipe.js?v=20261030n";
    w.defer = true;
    document.head.appendChild(w);
})();

// Desktop sidebar (loaded on every page that includes theme.js)
(function () {
    var s = document.createElement("script");
    s.src = "js/sidebar.js?v=20261030n";
    s.defer = true;
    document.head.appendChild(s);
})();

// A slow connection makes the app open the copy of a page kept on the phone, which may be
// from an older version (old menu, old screens). Ask the internet for the page once it has
// loaded; if it is newer, keep that copy on the phone and reload once.
(function () {
    if (location.protocol === "file:" || window.self !== window.top || !window.fetch) return;
    function check() {
        if (navigator.onLine === false) return;
        var href = location.href.split("#")[0];
        fetch(href, { cache: "no-store", credentials: "same-origin" }).then(function (res) {
            if (!res.ok) return;
            return res.clone().text().then(function (html) {
                var m = html.match(/style\.css\?v=([^"'&]+)/);
                var nv = m ? m[1] : "";
                if (!nv || nv === window.attAppVer()) return;
                var key = "att-upd:" + nv;
                try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) { return; }
                var save = window.caches ? caches.open("attendreem-files-v1").then(function (c) { return c.put(new Request(href), res); }).catch(function () {}) : Promise.resolve();
                save.then(function () { location.reload(); });
            });
        }).catch(function () {});
    }
    if (document.readyState === "complete") setTimeout(check, 400);
    else window.addEventListener("load", function () { setTimeout(check, 400); });
})();

// The check-in page, already done today: hide the camera / fingerprint screen from the very
// first paint instead of flashing it until the check-in is looked up (js/att-checkout.js)
(function () {
    if ((location.pathname.split("/").pop() || "") !== "attendance.html") return;
    try {
        var c = JSON.parse(localStorage.getItem("att-snap:co-state") || "null"), n = new Date();
        var day = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
        if (c && c.day === day) document.documentElement.classList.add("att-co-done");
    } catch (e) {}
})();
