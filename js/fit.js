// Big numbers never spill out of their card.
// Any money value ("Rp1.250.000", "+Rp50.000", "−Rp20.000") and the elements listed in FIT get
// their font made smaller, just enough to fit, when the text is wider than the space it has:
//   * on its own line (a balance): it may use the whole width of its card;
//   * next to other text (a row in a list): it may use at most ~38% of the row, so the label keeps room.
// Works by itself on every page: it watches the page, so nothing else needs to call it.
(function () {
    var FIT = ".v2-dash-counts span, [data-fit]";
    var MONEY = /^[+\-−]?\s?Rp\s?[\d.,]+(\s?(jt|M|B|T|rb))?$/;
    var MIN = 0.55;                       // never smaller than 55% of the normal size

    function isCard(n) {
        var cs = getComputedStyle(n);
        return cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.borderTopWidth !== "0px" || cs.overflow !== "visible" ||
               n.tagName === "TD" || n.tagName === "LI" || n === document.body;
    }
    function textWidth(el) {
        var r = document.createRange();
        r.selectNodeContents(el);
        var b = r.getBoundingClientRect();
        return { w: b.width, left: b.left, top: b.top, bottom: b.bottom };
    }
    // does other text sit on the same line as el inside the card (a list row)?
    function inRow(el, box, t) {
        var n = el;
        while (n && n !== box) {
            var p = n.parentElement;
            if (!p) break;
            for (var i = 0; i < p.children.length; i++) {
                var s = p.children[i];
                if (s === n || !s.offsetParent) continue;
                var r = s.getBoundingClientRect();
                if (!r.width || !r.height) continue;
                if (r.bottom > t.top + 2 && r.top < t.bottom - 2 && (s.textContent || "").trim()) return true;
            }
            n = p;
        }
        return false;
    }
    function fit(el) {
        if (!el.isConnected || !el.offsetParent) return;
        var txt = (el.textContent || "").trim();
        el.style.fontSize = "";
        if (!txt) return;
        var box = el.parentElement;
        while (box && !isCard(box)) box = box.parentElement;
        if (!box) return;
        var t = textWidth(el);
        if (!t.w) return;
        var bs = getComputedStyle(box), br = box.getBoundingClientRect();
        var inner = br.width - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight);
        var right = br.right - parseFloat(bs.paddingRight);
        var room = right - t.left;                                   // up to the card's inner edge
        var es = getComputedStyle(el);
        if (es.overflow !== "visible" && el.clientWidth > 0) room = Math.min(room, el.clientWidth - parseFloat(es.paddingLeft) - parseFloat(es.paddingRight));
        if (MONEY.test(txt) && inRow(el, box, t)) room = Math.min(room, inner * 0.38);
        if (t.w <= room + 0.5) return;
        var fs = parseFloat(es.fontSize);
        el.style.fontSize = Math.max(fs * MIN, Math.floor(fs * room / t.w * 10) / 10) + "px";
    }

    function targets(root) {
        var out = [];
        var base = root.nodeType === 1 ? root : root.parentElement;
        if (!base) return out;
        var scope = base.closest && base.closest(".v2-card, section, li, tr, a, div") || base;
        var all = [scope].concat([].slice.call(scope.querySelectorAll("*")));
        all.forEach(function (el) {
            if (el.matches && el.matches(FIT)) { out.push(el); return; }
            if (el.childElementCount === 0 && MONEY.test((el.textContent || "").trim())) out.push(el);
        });
        return out;
    }

    var queued = [], all = false, raf = 0;
    function schedule(list, everything) {
        if (everything) all = true; else Array.prototype.push.apply(queued, list);
        if (!raf) raf = requestAnimationFrame(run);
    }
    function run() {
        raf = 0;
        var list = all ? targets(document.body) : queued;
        all = false; queued = [];
        var seen = [];
        list.forEach(function (el) { if (seen.indexOf(el) === -1) { seen.push(el); fit(el); } });
    }

    function start() {
        new MutationObserver(function (muts) {
            var list = [];
            muts.forEach(function (m) {
                var n = m.target.nodeType === 3 ? m.target.parentElement : m.target;
                if (n) Array.prototype.push.apply(list, targets(n));
            });
            if (list.length) schedule(list);
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
        schedule(null, true);
        var t;
        window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(function () { schedule(null, true); }, 150); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { schedule(null, true); });
    }
    window.attFit = function () { schedule(null, true); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
