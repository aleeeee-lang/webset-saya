// "Pay to" box: the school's bank accounts / e-wallets for SPP (spp_settings.pay_methods),
// each with a copy button. Used on the student's SPP page and the parent page.
(function () {
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function L(id, en) { return (typeof getLang === "function" ? getLang() : "id") === "id" ? id : en; }
    var COPY = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>';
    var BANK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l8-5 8 5"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8M4 20h16"/></svg>';

    function clean(list) {
        return (Array.isArray(list) ? list : []).filter(function (m) { return m && (m.number || m.method); });
    }

    window.AttPay = {
        // fill `box` with the methods; hides it when there are none
        render: function (box, list, opts) {
            if (!box) return;
            var items = clean(list);
            if (!items.length) { box.hidden = true; box.innerHTML = ""; return; }
            opts = opts || {};
            box.hidden = false;
            box.innerHTML = '<div class="pay-head">' + BANK + '<b>' + esc(opts.title || L("Bayar ke", "Pay to")) + '</b></div>' +
                items.map(function (m, i) {
                    return '<div class="pay-row"><div class="pay-txt"><small>' + esc(m.method || "") + '</small><b>' + esc(m.number || "") + '</b>' +
                        (m.name ? '<span>' + esc(L("a.n. ", "name: ") + m.name) + '</span>' : '') + '</div>' +
                        (m.number ? '<button type="button" class="pay-copy" data-i="' + i + '" aria-label="' + esc(L("Salin nomor", "Copy number")) + '">' + COPY + '<span>' + esc(L("Salin", "Copy")) + '</span></button>' : '') + '</div>';
                }).join("") +
                (opts.note ? '<p class="pay-note">' + esc(opts.note) + '</p>' : '');
            box.onclick = function (e) {
                var b = e.target.closest(".pay-copy");
                if (!b) return;
                var m = items[Number(b.getAttribute("data-i"))];
                var num = String(m.number || "").replace(/[\s-]/g, "");
                var done = function () { if (window.showToast) showToast(L("Nomor disalin: ", "Copied: ") + num, "success"); };
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(num).then(done, function () { if (window.showToast) showToast(num, "info"); });
                else if (window.showToast) showToast(num, "info");
            };
        },
        clean: clean
    };
})();
