// Check-in page: choose "Camera" (face photo + random moves) or "Fingerprint".
// Fingerprint: register this phone once (one phone per student; the admin
// resets it), then scan before sending. The scan gives a one-time ticket
// that saveAttendance() sends with the check-in.
(function () {
    var TICKET_MS = 110000;      // the server accepts a ticket for 2 minutes
    var state = { method: "face", ticket: null, ticketAt: 0, registered: null, supported: null, busy: false };
    function T(k) { return translations[k] ? translations[k][getLang()] : k; }
    function $(id) { return document.getElementById(id); }

    window.attMethod = function () { return state.method; };
    window.attFpTicket = function () { return state.ticket && Date.now() - state.ticketAt < TICKET_MS ? state.ticket : null; };
    window.attFpUsed = function () { state.ticket = null; render(); };
    window.addEventListener("resize", function () { if (state.method === "fp") render(); });

    var FP_IC = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 18.5A9 9 0 0 1 4 12a8 8 0 0 1 16 0v1"/><path d="M8 12a4 4 0 0 1 8 0v1.5a10 10 0 0 1-1.2 4.8"/><path d="M12 12v2a12 12 0 0 1-2 6.5"/></svg>';
    var SEND_IC = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    var FP_BIG = FP_IC.replace('width="20" height="20"', 'width="40" height="40"');
    var SEND_BIG = SEND_IC.replace('width="20" height="20"', 'width="38" height="38"');
    // the round button: scan / register, or "send" once matched; hidden when there's nothing to press
    function setButton(label, mode) {
        var b = $("fpBtn");
        b.hidden = !label;
        if (!label) return;
        b.innerHTML = mode === "send" ? SEND_BIG : FP_BIG;
        b.setAttribute("aria-label", label);
        b.dataset.mode = mode;
    }
    // room for the panel: page padding, and toasts sit above it
    function syncSpace() {
        var on = state.method === "fp";
        document.body.classList.toggle("fp-docked", on);
        var nav = document.querySelector(".bottom-nav");
        var navH = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().height : 0;
        var panelH = on ? $("fpPanel").getBoundingClientRect().height : 0;
        document.documentElement.style.setProperty("--fp-nav-h", Math.round(navH) + "px");
        document.documentElement.style.setProperty("--fp-panel-h", Math.round(panelH) + "px");
    }
    function setPanel(title, text, btn, tone) {
        $("fpTitle").textContent = title;
        $("fpText").textContent = text;
        $("fpPanel").dataset.tone = tone || "";
        if (tone === "ok") setButton(T("btn_submit_attendance"), "send");
        else setButton(btn, "scan");
        syncSpace();
    }

    async function render() {
        if (state.method !== "fp") return;
        if (state.supported === null) state.supported = await window.AttFP.supported();
        if (!state.supported) { setPanel(T("fp_unsupported_t"), T("fp_unsupported"), null, "warn"); return; }
        if (state.registered === null) {
            setPanel(T("fp_checking"), "", null, "");
            try { state.registered = !!(await window.AttFP.status()).registered; }
            catch (e) { setPanel(T("fp_unavailable_t"), T("fp_unavailable"), null, "warn"); state.registered = null; return; }
        }
        if (!state.registered) { setPanel(T("fp_register_t"), T("fp_register"), T("fp_register_btn"), ""); return; }
        if (window.attFpTicket()) { setPanel(T("fp_ok_t"), T("fp_ok"), null, "ok"); return; }
        setPanel(T("fp_scan_t"), T("fp_scan"), T("fp_scan_btn"), "");
    }

    async function onBtn() {
        if (state.busy) return;
        if ($("fpBtn").dataset.mode === "send") { if (typeof saveAttendance === "function") saveAttendance(); return; }
        state.busy = true; $("fpBtn").disabled = true;
        try {
            if (!state.registered) {
                await window.AttFP.register();
                state.registered = true;
                if (window.showToast) showToast(T("fp_registered_toast"), "success");
            } else {
                state.ticket = await window.AttFP.verify();
                state.ticketAt = Date.now();
                if (window.showToast) showToast(T("fp_ok_t"), "success");
                // the ticket runs out; ask again after that
                setTimeout(render, TICKET_MS + 500);
            }
        } catch (e) {
            var code = (e && (e.code || e.name || e.message)) || "";
            var key = code === "NotAllowedError" || code === "CANCELLED" ? (state.registered ? "fp_err_cancel_or_other_phone" : "fp_err_cancel")
                : code === "ALREADY_REGISTERED" ? "fp_err_already"
                : code === "InvalidStateError" ? "fp_err_already"
                : code === "WRONG_DEVICE" ? "fp_err_other_phone"
                : "fp_err_generic";
            if (code === "ALREADY_REGISTERED") state.registered = true;
            if (window.showToast) showToast(T(key), "error");
        }
        state.busy = false; $("fpBtn").disabled = false;
        render();
    }

    function choose(m) {
        state.method = m;
        document.querySelectorAll("#attMethod button").forEach(function (b) {
            var on = b.getAttribute("data-m") === m;
            b.classList.toggle("on", on);
            b.setAttribute("aria-selected", on ? "true" : "false");
        });
        $("faceArea").hidden = m !== "face";
        $("fpPanel").hidden = m !== "fp";
        if (m !== "fp") syncSpace();
        if (m === "fp" && typeof stopCamera === "function") { try { stopCamera(); } catch (e) {} }
        render();
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (!$("attMethod")) return;
        document.querySelectorAll("#attMethod button").forEach(function (b) {
            b.addEventListener("click", function () { choose(b.getAttribute("data-m")); });
        });
        $("fpBtn").addEventListener("click", onBtn);
    });
})();
