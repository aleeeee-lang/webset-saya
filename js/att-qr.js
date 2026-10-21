// Check-in page: "QR" method (attendance_qr.sql). A teacher sends every student of the class
// their own QR (qr-send.html). It shows here while it still works; "Absen dengan QR ini"
// checks the location (school area only), takes a quick front-camera photo and sends the
// check-in as Hadir. The QR is gone once used or once the teacher's time is over.
//   attQrCode() / attQrPhoto()  -> what saveAttendance() sends
//   attQrUsed()                 -> after sending
(function () {
    function T(k) { return translations[k] ? translations[k][getLang()] : k; }
    function $(id) { return document.getElementById(id); }
    var st = { pass: null, photo: null, sending: false, on: false, timer: 0, loaded: false };

    window.attQrCode = function () { return st.sending && st.pass ? st.pass.code : null; };
    window.attQrPhoto = function () { return st.sending ? st.photo : null; };
    window.attQrUsed = function () { st.pass = null; st.photo = null; st.sending = false; paint(); };

    function hhmm(ms) { var d = new Date(ms); return String(d.getHours()).padStart(2, "0") + "." + String(d.getMinutes()).padStart(2, "0"); }
    function left(ms) {
        var s = Math.max(0, Math.round((ms - Date.now()) / 1000)), m = Math.floor(s / 60);
        return m >= 1 ? m + " " + T("qr_min") + " " + String(s % 60).padStart(2, "0") + " " + T("qr_sec") : s + " " + T("qr_sec");
    }

    async function load() {
        try {
            var r = await supabaseClient.from("qr_passes").select("code, expires_at, sent_by_name, class")
                .gt("expires_at", new Date().toISOString()).is("used_at", null)
                .order("expires_at", { ascending: false }).limit(1);
            st.pass = r.error ? null : (r.data && r.data[0]) || null;
            if (st.pass) st.pass.exp = Date.parse(st.pass.expires_at);
        } catch (e) { st.pass = null; }
        st.loaded = true;
        paint();
        markTab();
    }
    // a small dot on the QR tab when a QR is waiting
    function markTab() {
        var b = document.querySelector('#attMethod button[data-m="qr"]');
        if (b) b.classList.toggle("has-dot", !!st.pass);
    }

    function draw(text) {
        var box = $("qrCodeBox");
        if (typeof qrcode !== "function") { box.innerHTML = ""; return; }
        var qr = qrcode(0, "M"); qr.addData(text); qr.make();
        try { box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true }); }
        catch (e) { box.innerHTML = qr.createImgTag(6, 0); }
    }

    function paint() {
        if (!$("qrArea")) return;
        clearInterval(st.timer);
        var has = !!(st.pass && st.pass.exp > Date.now());
        if (st.pass && !has) { st.pass = null; markTab(); }
        $("qrEmpty").hidden = has || !st.loaded;
        $("qrPass").hidden = !has;
        if (!has) {
            $("qrEmptyTitle").textContent = T("qr_none_t");
            $("qrEmptyText").textContent = T("qr_none");
            return;
        }
        draw("ATTQR:" + st.pass.code);
        $("qrFrom").textContent = T("qr_from").replace("{n}", st.pass.sent_by_name || "-");
        $("qrUntil").textContent = T("qr_until").replace("{t}", hhmm(st.pass.exp));
        $("qrGo").textContent = T("qr_go");
        $("qrGo").disabled = st.sending;
        $("qrHint").textContent = T("qr_hint");
        var tick = function () {
            if (!st.pass || st.pass.exp <= Date.now()) { st.pass = null; markTab(); paint(); return; }
            $("qrLeft").textContent = T("qr_left").replace("{t}", left(st.pass.exp));
        };
        tick();
        st.timer = setInterval(tick, 1000);
    }

    async function go() {
        if (st.sending || !st.pass) return;
        var h = document.querySelector('.v2-status[data-value="Hadir"]');
        if (h && !document.querySelector('input[name="status"][value="Hadir"]').checked) h.click();
        st.sending = true; $("qrGo").disabled = true;
        $("qrPass").classList.add("busy");
        $("qrGo").textContent = T("qr_going");
        var shot = null;
        try { shot = window.attAutoSnap ? await window.attAutoSnap() : null; } catch (e) { shot = null; }
        if (!shot) {
            if (window.showToast) showToast(T("fp_snap_failed"), "error");
        } else {
            st.photo = shot;
            if (typeof saveAttendance === "function") await saveAttendance();
        }
        $("qrPass").classList.remove("busy");
        if (st.pass) { st.sending = false; st.photo = null; paint(); }     // not sent: try again
    }

    window.addEventListener("attmethod", function (e) {
        st.on = e.detail === "qr";
        document.body.classList.toggle("qr-mode", st.on);     // the QR button sends it: no separate send button
        if (st.on) {
            var h = document.querySelector('.v2-status[data-value="Hadir"]');
            if (h && !document.querySelector('input[name="status"][value="Hadir"]').checked) h.click();
            load();
        }
    });
    document.addEventListener("DOMContentLoaded", function () {
        if (!$("qrArea")) return;
        $("qrGo").addEventListener("click", go);
        // look once in the background (dot on the tab); a notification link opens the tab
        setTimeout(function () {
            load().then(function () {
                if (location.hash === "#qr") {
                    var b = document.querySelector('#attMethod button[data-m="qr"]');
                    if (b) b.click();
                }
            });
        }, 300);
    });
    window.addEventListener("tabshow", function () { if (st.on) load(); });
})();
