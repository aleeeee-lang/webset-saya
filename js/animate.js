// Numbers count up and charts grow when they get their value.
// Works on its own: it watches the stat elements below, so pages need no changes.
(function () {
    try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) {}

    var COUNT = [
        "#homePercent",
        "#attendancePercentage", "#totalHadir", "#totalIzin", "#totalSakit", "#totalAlpa", "#dashboardTotalSavings", "#dashAvgGrade",
        "#scorePercent", "#myHadir", "#myIzin", "#mySakit", "#myAlpa",
        "#pScorePercent", "#pHadir", "#pIzin", "#pSakit", "#pAlpa", "#pSppAmount",
        "#savingsBalance", "#savingsTotalSetor", "#savingsTotalTarik", "#personalBalance", "#personalTotalSetor", "#personalTotalTarik", "#sppAmountLabel",
        "#studentBalance", "#kasBalance", "#kasInMonth", "#kasOutMonth",
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
        var from = typeof el._attVal === "number" ? el._attVal : 0;
        el._attVal = p.n;
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
                var el = n.matches(COUNT) ? n : n.closest(COUNT);
                if (el && seen.indexOf(el) === -1) seen.push(el);
                if (m.addedNodes && m.addedNodes.length) m.addedNodes.forEach(function (a) { if (a.nodeType === 1) growBars(a.parentElement || a); });
            });
            seen.forEach(run);
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
        growBars(document);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
