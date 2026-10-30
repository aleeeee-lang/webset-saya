// Numbers count up and charts grow when they get their value.
// Works on its own: it watches the stat elements below, so pages need no changes.
// Plays once per page each time the app is opened (per browser/app session):
// coming back to a page later in the same session shows the values straight away.
(function () {
    try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) {}
    // a page opened in the background (swipe prerender) waits until it is actually shown
    if (document.prerendering) {
        var me = document.currentScript && document.currentScript.src;
        document.addEventListener("prerenderingchange", function () {
            var s = document.createElement("script"); s.src = me || "js/animate.js"; document.head.appendChild(s);
        }, { once: true });
        return;
    }
    var KEY = "attendreem-anim:" + (location.pathname.split("/").pop() || "index.html");
    var replay = false;
    try { replay = !!sessionStorage.getItem(KEY); sessionStorage.setItem(KEY, "1"); } catch (e) {}
    // arrived by a swipe: the page was already shown complete under the finger, so no count-up
    try { if (sessionStorage.getItem("att-swiped-anim")) { sessionStorage.removeItem("att-swiped-anim"); replay = true; } } catch (e) {}
    if (replay) {
        // already seen in this session: no count-up and no chart growing for the first values
        var root = document.documentElement;
        root.classList.add("att-noanim");
        var off = function () { root.classList.remove("att-noanim"); };
        setTimeout(off, 4000);
        ["pointerdown", "keydown"].forEach(function (ev) { window.addEventListener(ev, off, { once: true, capture: true }); });
    }

    var COUNT = [
        "#homePercent",
        "#attendancePercentage", "#totalHadir", "#totalIzin", "#totalSakit", "#totalAlpa", "#dashboardTotalSavings", "#dashAvgGrade",
        "#scorePercent", "#myHadir", "#myIzin", "#mySakit", "#myAlpa",
        "#pScorePercent", "#pHadir", "#pIzin", "#pSakit", "#pAlpa", "#pSppAmount",
        "#savingsBalance", "#savingsTotalSetor", "#savingsTotalTarik", "#personalBalance", "#personalTotalSetor", "#personalTotalTarik", "#sppAmountLabel",
        "#studentBalance", "#kasBalance", "#kasInMonth", "#kasOutMonth", "#hmSchool", "#hmPersonal", "#hmSub",
        "[data-count]"
    ].join(",");
    var DUR = 900;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }

    // "Rp45.000" -> {pre:"Rp", n:45000, dec:0, sep:true, post:""}; "8,5" -> dec 1; "84%" -> post "%"
    function parse(s) {
        var m = /^(\D*?)([−-]?)(\d[\d.]*)(?:,(\d+))?(\D*)$/.exec(String(s).trim());
        if (!m) return null;
        var whole = m[3].replace(/\./g, "");
        if (!/^\d+$/.test(whole)) return null;
        var dec = m[4] ? m[4].length : 0;
        var n = Number(whole + (dec ? "." + m[4] : ""));
        if (m[2]) n = -n;
        return { pre: m[1], neg: m[2], n: n, dec: dec, sep: m[3].indexOf(".") !== -1 || Math.abs(n) >= 1000, post: m[5] };
    }
    function fmt(p, v) {
        var a = Math.abs(v), s;
        if (p.sep) s = a.toLocaleString("id-ID", { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec });
        else s = p.dec ? a.toFixed(p.dec).replace(".", ",") : String(Math.round(a));
        return p.pre + (v < 0 ? (p.neg || "-") : "") + s + p.post;
    }
    function run(el) {
        var txt = el.textContent, p = parse(txt);
        if (!p || el._attFrame === txt) return;
        var first = typeof el._attVal !== "number";
        var from = first ? 0 : el._attVal;
        el._attVal = p.n;
        if (first && replay) return;          // revisit: show the value as it is
        if (from === p.n) return;
        if (el._attRaf) cancelAnimationFrame(el._attRaf);
        var t0 = performance.now();
        (function step(now) {
            var t = Math.min(1, (now - t0) / DUR);
            var v = from + (p.n - from) * ease(t);
            el._attFrame = t < 1 ? fmt(p, p.dec ? v : Math.round(v)) : txt;
            el.textContent = el._attFrame;
            if (t < 1) el._attRaf = requestAnimationFrame(step);
            else el._attRaf = 0;
        })(t0);
    }

    // bars that are inserted with their final size: start them at zero, then let CSS grow them
    function growBars(root) {
        if (replay) return;
        var bars = (root.querySelectorAll ? root.querySelectorAll(".v2-week-fill") : []);
        Array.prototype.forEach.call(bars, function (b) {
            if (b._attGrown) return;
            b._attGrown = true;
            var h = b.style.height;
            b.style.height = "0";
            requestAnimationFrame(function () { requestAnimationFrame(function () { b.style.height = h; }); });
        });
    }

    function start() {
        new MutationObserver(function (list) {
            var seen = [];
            list.forEach(function (m) {
                var n = m.target.nodeType === 3 ? m.target.parentElement : m.target;
                if (!n || !n.closest) return;
                if (n.closest(".att-swipe-ghost")) return;          // preview of another page while swiping
                var el = n.matches(COUNT) ? n : n.closest(COUNT);
                if (el && seen.indexOf(el) === -1) seen.push(el);
                if (m.addedNodes && m.addedNodes.length) m.addedNodes.forEach(function (a) {
                    if (a.nodeType !== 1 || a.classList.contains("att-swipe-ghost")) return;
                    growBars(a.parentElement || a);
                    // counters that arrive inside freshly inserted HTML (cards, lists)
                    if (a.matches(COUNT) && seen.indexOf(a) === -1) seen.push(a);
                    Array.prototype.forEach.call(a.querySelectorAll(COUNT), function (c) { if (seen.indexOf(c) === -1) seen.push(c); });
                });
            });
            seen.forEach(run);
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
        growBars(document);
        // values that were already filled in before this script loaded
        if (!replay) Array.prototype.forEach.call(document.querySelectorAll(COUNT), function (el) {
            var p = parse(el.textContent);
            if (p && p.n !== 0) run(el);
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
