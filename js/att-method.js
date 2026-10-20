// Check-in page: choose "Camera" (face photo + random moves) or "Fingerprint".
// Fingerprint: register this phone once (one phone per student; the admin
// resets it), then scan before sending. The scan gives a one-time ticket
// that saveAttendance() sends with the check-in.
(function () {
    var TICKET_MS = 110000;      // the server accepts a ticket for 2 minutes
    var state = { method: "face", ticket: null, ticketAt: 0, registered: null, supported: null, busy: false, nextChange: null, changing: false };
    function T(k) { return translations[k] ? translations[k][getLang()] : k; }
    function $(id) { return document.getElementById(id); }

    window.attMethod = function () { return state.method; };
    window.attFpTicket = function () { return state.ticket && Date.now() - state.ticketAt < TICKET_MS ? state.ticket : null; };
    window.attFpUsed = function () { state.ticket = null; setSnap(null); render(); };
    window.attFpPhoto = function () { return window.attFpTicket() ? state.photo : null; };

    // take one photo with the front camera, without showing the camera screen
    async function autoSnap() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
        var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } }, audio: false });
        try {
            var v = document.createElement("video");
            v.muted = true; v.playsInline = true; v.setAttribute("playsinline", "");
            v.srcObject = stream;
            await v.play();
            // give the camera a moment to set light and focus
            await new Promise(function (r) { setTimeout(r, 900); });
            if (!v.videoWidth) await new Promise(function (r) { setTimeout(r, 600); });
            var w = v.videoWidth, h = v.videoHeight;
            if (!w || !h) return null;
            var scale = Math.min(1, 960 / Math.max(w, h));
            var c = document.createElement("canvas");
            c.width = Math.round(w * scale); c.height = Math.round(h * scale);
            c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
            return await new Promise(function (r) { c.toBlob(r, "image/jpeg", 0.85); });
        } finally {
            stream.getTracks().forEach(function (t) { t.stop(); });
        }
    }
    function setSnap(blob) {
        if (state.photoUrl) { try { URL.revokeObjectURL(state.photoUrl); } catch (e) {} }
        state.photo = blob || null;
        state.photoUrl = blob ? URL.createObjectURL(blob) : null;
        var img = $("fpSnap");
        if (img) { img.hidden = !blob; if (blob) img.src = state.photoUrl; }
    }
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
        $("fpMore").hidden = true;
        if (state.supported === null) state.supported = await window.AttFP.supported();
        if (!state.supported) { setPanel(T("fp_unsupported_t"), T("fp_unsupported"), null, "warn"); return; }
        if (state.registered === null) {
            setPanel(T("fp_checking"), "", null, "");
            try {
                var st = await window.AttFP.status();
                state.registered = !!st.registered;
                state.nextChange = st.next_change_at ? Date.parse(st.next_change_at) : null;
            }
            catch (e) { setPanel(T("fp_unavailable_t"), T("fp_unavailable"), null, "warn"); state.registered = null; return; }
        }
        $("fpMore").hidden = !state.registered;
        if (state.registered) syncMore();
        if (!state.registered) { setPanel(T("fp_register_t"), T("fp_register"), T("fp_register_btn"), ""); return; }
        if (window.attFpTicket()) { setPanel(T("fp_ok_t"), T("fp_ok"), null, "ok"); return; }
        setPanel(T("fp_scan_t"), T("fp_scan"), T("fp_scan_btn"), "");
    }

    function fmtDay(ms) {
        var d = new Date(ms), id = getLang() === "id";
        var M = id ? ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return d.getDate() + " " + M[d.getMonth()] + " " + String(d.getHours()).padStart(2, "0") + "." + String(d.getMinutes()).padStart(2, "0");
    }
    function canChange() { return !state.nextChange || Date.now() >= state.nextChange; }
    function syncMore() {
        var b = $("fpChangeBtn");
        b.textContent = canChange() ? T("fp_change_link") : T("fp_change_wait").replace("{d}", fmtDay(state.nextChange));
        b.classList.toggle("off", !canChange());
        $("fpTipBtn").textContent = T("fp_tip_link");
    }

    // ---------- changing phones: face check first, then register this phone ----------
    var photoWatch = null;
    function changeBar(on) {
        state.changing = on;
        $("fpChangeBar").hidden = !on;
        document.body.classList.toggle("fp-changing", on);
        if (photoWatch) { clearInterval(photoWatch); photoWatch = null; }
        if (on) {
            $("fpChangeTitle").textContent = T("fp_change_t");
            $("fpChangeCancel").textContent = T("btn_cancel");
            $("fpChangeGo").textContent = T("fp_change_go");
            photoWatch = setInterval(function () {
                var have = typeof capturedPhoto !== "undefined" && !!capturedPhoto;
                $("fpChangeGo").disabled = !have || state.busy;
                $("fpChangeText").textContent = T(have ? "fp_change_ready" : "fp_change_face");
            }, 300);
        }
    }
    async function startChange() {
        if (!canChange()) { if (window.showToast) showToast(T("fp_change_wait").replace("{d}", fmtDay(state.nextChange)), "error"); return; }
        var ok = await attConfirm({ title: T("fp_change_confirm_t"), text: T("fp_change_confirm"), ok: T("fp_change_confirm_ok"), tone: "primary" });
        if (!ok) return;
        if (typeof capturedPhoto !== "undefined") capturedPhoto = null;
        var pv = $("photoPreview"); if (pv) pv.style.display = "none";
        choose("face");
        changeBar(true);
        if (typeof startCamera === "function") startCamera();
        // keep the camera and its buttons above the bar
        setTimeout(function () { var c = document.querySelector(".v2-cam"); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150);
    }
    async function finishChange() {
        if (state.busy || typeof capturedPhoto === "undefined" || !capturedPhoto) return;
        state.busy = true; $("fpChangeGo").disabled = true;
        try {
            var s = await supabaseClient.auth.getSession();
            var uid = s.data.session.user.id;
            var path = uid + "/fpchange-" + Date.now() + ".jpg";
            var up = await supabaseClient.storage.from("attendance-photos").upload(path, capturedPhoto, { contentType: "image/jpeg" });
            if (up.error) throw new Error("UPLOAD:" + up.error.message);
            await window.AttFP.change(path);
            state.registered = true; state.ticket = null;
            state.nextChange = Date.now() + 7 * 24 * 3600 * 1000;
            capturedPhoto = null;
            var pv = $("photoPreview"); if (pv) pv.style.display = "none";
            if (window.showToast) showToast(T("fp_change_done"), "success");
            state.busy = false;
            changeBar(false);
            choose("fp");
            return;
        } catch (e) {
            var code = (e && (e.code || e.name || e.message)) || "";
            var key = code === "CHANGE_TOO_SOON" ? null
                : code === "NotAllowedError" || code === "CANCELLED" ? "fp_err_cancel"
                : code === "InvalidStateError" ? "fp_change_same"
                : code === "PHOTO_MISSING" || code.indexOf("UPLOAD:") === 0 ? "fp_change_photo_err"
                : "fp_err_generic";
            if (code === "CHANGE_TOO_SOON") {
                var n = e.data && e.data.next_change_at ? Date.parse(e.data.next_change_at) : null;
                if (n) state.nextChange = n;
                if (window.showToast) showToast(T("fp_change_wait").replace("{d}", n ? fmtDay(n) : "-"), "error");
            } else if (window.showToast) showToast(T(key), "error");
        }
        state.busy = false;
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
                var ticket = await window.AttFP.verify();
                // proof of who is holding the phone: one front-camera photo, taken right away
                setPanel(T("fp_snap_t"), T("fp_snap"), null, "");
                var shot = null;
                try { shot = await autoSnap(); } catch (se) { shot = null; state.snapErr = (se && se.name) || "x"; }
                if (!shot) {
                    if (window.showToast) showToast(T(state.snapErr === "NotAllowedError" ? "fp_snap_denied" : "fp_snap_failed"), "error");
                } else {
                    state.ticket = ticket;
                    state.ticketAt = Date.now();
                    setSnap(shot);
                    if (window.showToast) showToast(T("fp_ok_t"), "success");
                    // the ticket runs out; ask again after that
                    setTimeout(render, TICKET_MS + 500);
                }
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
            b.addEventListener("click", function () { if (state.changing) changeBar(false); choose(b.getAttribute("data-m")); });
        });
        $("fpBtn").addEventListener("click", onBtn);
        $("fpChangeBtn").addEventListener("click", startChange);
        $("fpTipBtn").addEventListener("click", function () {
            attConfirm({ title: T("fp_tip_t"), text: T("fp_tip"), ok: "OK", tone: "primary", info: true });
        });
        $("fpChangeCancel").addEventListener("click", function () { changeBar(false); choose("fp"); });
        $("fpChangeGo").addEventListener("click", finishChange);
    });
})();
