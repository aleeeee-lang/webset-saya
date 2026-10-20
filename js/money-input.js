// Money fields: show thousand separators while typing (150000 -> 150.000) so it's
// easy to see the amount. Mark an input with data-money. Page code keeps working
// unchanged: reading .value gives plain digits ("150000"), setting .value formats it.
(function () {
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    function fmt(d) {
        d = String(d || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
    }
    function setup(el) {
        if (el._money) return;
        el._money = true;
        el.type = "text";
        el.setAttribute("inputmode", "numeric");
        el.setAttribute("autocomplete", "off");
        Object.defineProperty(el, "value", {
            configurable: true,
            get: function () { return desc.get.call(el).replace(/\D/g, ""); },
            set: function (v) {
                // numbers like 150000.00 from the database: drop the decimals
                var s = typeof v === "number" ? String(Math.round(v)) : String(v == null ? "" : v).replace(/[.,]\d{1,2}$/, "");
                desc.set.call(el, fmt(s));
            }
        });
        el.addEventListener("input", function () {
            var raw = desc.get.call(el);
            var pos = el.selectionStart == null ? raw.length : el.selectionStart;
            var before = raw.slice(0, pos).replace(/\D/g, "").length;   // digits left of the cursor
            var out = fmt(raw);
            desc.set.call(el, out);
            var i = 0, seen = 0;
            while (i < out.length && seen < before) { if (/\d/.test(out[i])) seen++; i++; }
            try { el.setSelectionRange(i, i); } catch (e) {}
        });
        desc.set.call(el, fmt(desc.get.call(el)));
    }
    function scan() { document.querySelectorAll("input[data-money]").forEach(setup); }
    window.AttMoney = { setup: setup, scan: scan, format: fmt };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
    else scan();
})();
