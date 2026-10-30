// Absen pulang (attendance_checkout.sql).
// When today's check-in is "Hadir" and the class has check-out hours, the check-in page turns
// into the check-out page: same fingerprint (or camera) + automatic photo + school area.
// Before the check-out time a reason is needed ("pulang awal"). Once done (or when today was
// Izin / Sakit, or check-out isn't used) the page shows today's summary instead of the form.
(function () {
    function L(id, en) { return (typeof getLang === "function" ? getLang() : "id") === "id" ? id : en; }
    function $(id) { return document.getElementById(id); }
    function hm(t) { return t ? String(t).slice(0, 5) : ""; }
    function dot(t) { return hm(t).replace(":", "."); }
    function nowHM() { return attNow().toTimeString().slice(0, 5); }

    var st = { mode: "", row: null, sched: null, user: null };   // mode: "" (check-in) | "out" | "done"
    var CO = window.attCheckout = {
        get active() { return st.mode === "out"; },
        early: function () { return st.mode === "out" && st.sched && nowHM() < hm(st.sched.checkout_start); },
        // the time card above the form; true = handled
        paintWindow: function (box, text, count) {
            if (st.mode !== "out") return st.mode === "done" ? (box.hidden = true, true) : false;
            var s = st.sched, start = hm(s.checkout_start), end = hm(s.checkout_end), now = nowHM();
            box.hidden = false; box.classList.remove("closed"); count.hidden = false;
            var target;
            if (now < start) { text.textContent = L("Absen pulang mulai ", "Check-out opens at ") + dot(start); target = start; }
            else if (end) { text.textContent = L("Absen pulang sampai ", "Check-out until ") + dot(end); target = end; }
            else { text.textContent = L("Absen pulang dibuka", "Check-out is open"); count.hidden = true; return true; }
            var p = target.split(":"), n = attNow(), t = new Date(n); t.setHours(+p[0], +p[1], 0, 0);
            var sec = Math.max(0, Math.floor((t - n) / 1000)), h = Math.floor(sec / 3600); sec -= h * 3600;
            var m = Math.floor(sec / 60), ss = sec - m * 60;
            count.textContent = (h > 0 ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(ss).padStart(2, "0");
            syncEarly();
            return true;
        },
        save: save,
        reload: function () { return load(); }
    };

    function summary() {
        var r = st.row, box = $("coCard");
        if (!box) return;
        if (!r) { box.hidden = true; return; }
        var statusLabel = { Hadir: L("Hadir", "Present"), Izin: "Izin", Sakit: "Sakit", Alpa: "Alpa" }[r.status] || r.status;
        var late = /^\[Telat\]/.test(r.reason || "");
        var parts = '<div class="co-step done"><i>' + IC.inn + '</i><span><small>' + L("Masuk", "In") + '</small><b>' + (r.status === "Hadir" ? dot(r.time) : esc(statusLabel)) + '</b>' +
            (late ? '<em>' + L("telat", "late") + '</em>' : '') + '</span></div>';
        if (r.status === "Hadir" && st.sched && st.sched.checkout_start) {
            var out = r.checkout_time;
            var closed = !out && st.sched.checkout_end && nowHM() > hm(st.sched.checkout_end);
            parts += '<span class="co-line' + (out ? ' done' : '') + '"></span>' +
                '<div class="co-step' + (out ? ' done' : closed ? ' miss' : '') + '"><i>' + IC.out + '</i><span><small>' + L("Pulang", "Out") + '</small><b>' +
                (out ? dot(out) : closed ? L("Tidak absen", "Missed") : L("Belum", "Not yet")) + '</b>' +
                (out && /^\[Pulang awal\]/.test(r.checkout_reason || "") ? '<em>' + L("awal", "early") + '</em>' : '') + '</span></div>';
        }
        box.innerHTML = '<div class="co-row">' + parts + '</div>' + (st.mode === "done" ? '<p class="co-note">' + esc(doneText()) + '</p>' : '');
        box.hidden = false;
    }
    function doneText() {
        var r = st.row;
        if (r.status !== "Hadir") return L("Hari ini kamu tercatat ", "Today you're marked ") + r.status + ".";
        if (r.checkout_time) return L("Absen hari ini selesai. Hati-hati di jalan!", "You're done for today. Get home safe!");
        if (!st.sched || !st.sched.checkout_start) return L("Kamu sudah absen masuk hari ini.", "You've checked in today.");
        return L("Absen pulang sudah ditutup untuk hari ini.", "Check-out is closed for today.");
    }
    function esc(s) { return typeof escapeHTML === "function" ? escapeHTML(s) : String(s == null ? "" : s); }
    var IC = {
        inn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/></svg>',
        out: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>'
    };

    function syncEarly() {
        if (st.mode !== "out") return;
        var early = CO.early(), rb = $("reasonBox");
        if (!rb) return;
        rb.hidden = !early;
        var lab = rb.querySelector("span");
        if (lab) { lab.removeAttribute("data-i18n"); lab.textContent = L("Alasan pulang lebih awal", "Reason for leaving early"); }
        var ta = $("reason");
        if (ta) { ta.removeAttribute("data-i18n-placeholder"); ta.placeholder = L("Contoh: dijemput orang tua karena acara keluarga", "e.g. picked up early for a family event"); }
    }

    function apply() {
        var root = document.documentElement;
        root.classList.toggle("att-co-out", st.mode === "out");
        root.classList.toggle("att-co-done", st.mode === "done");
        var h1 = document.querySelector(".v2-head h1");
        if (h1) {
            h1.removeAttribute("data-i18n");
            h1.textContent = st.mode === "out" ? L("Absen pulang", "Check out") : st.mode === "done" ? L("Absen hari ini", "Today") : L("Absen", "Check in");
        }
        if (st.mode === "out") {
            // check-out: Hadir is already known; QR is only for checking in
            var qrb = document.querySelector('#attMethod button[data-m="qr"]');
            if (qrb) qrb.hidden = true;
            if (typeof attMethod === "function" && attMethod() === "qr") { var fb = document.querySelector('#attMethod button[data-m="fp"]:not([hidden])') || document.querySelector('#attMethod button[data-m="face"]'); if (fb) fb.click(); }
            var hadir = document.querySelector('input[name="status"][value="Hadir"]');
            if (hadir) hadir.checked = true;
            syncEarly();
            window.dispatchEvent(new Event("resize"));   // repaint the fingerprint panel text
        }
        summary();
        // remember today's finished state so the page opens straight on it next time
        // (no camera / fingerprint screen flashing up while the check-in is looked up)
        try {
            if (st.mode === "done" && st.row) localStorage.setItem(CACHE, JSON.stringify({ day: localDateStr(), uid: st.user && st.user.id, row: st.row, sched: st.sched }));
            else if (st.loaded) localStorage.removeItem(CACHE);
        } catch (e) {}
    }

    var CACHE = "att-snap:co-state";   // "att-snap:" is wiped on log out (js/swipe.js)

    async function load() {
        var user = await requireLogin();
        if (!user) return;
        st.user = user;
        var prof = await attMyProfile(user.id);
        if (!prof || (prof.role !== "murid" && prof.role !== "guru")) return;
        var ckey = attClassKey(prof);
        var day = localDateStr();
        var r = await supabaseClient.from("attendance").select("*").eq("user_id", user.id).eq("date", day).maybeSingle();
        if (r.error) return;
        if (!r.data) { st.mode = ""; st.row = null; st.loaded = true; apply(); return; }
        st.row = r.data;
        var rules = ckey ? await attDayRules(ckey) : null;
        st.sched = rules && rules.schedule ? rules.schedule : null;
        var row = st.row, s = st.sched;
        var coOn = row.status === "Hadir" && s && s.checkout_start && ("checkout_time" in row);
        var closed = coOn && s.checkout_end && nowHM() > hm(s.checkout_end);
        st.mode = coOn && !row.checkout_time && !closed ? "out" : "done";
        st.loaded = true;
        apply();
    }

    var CODES = {
        ATT_CO_NO_CHECKIN: ["Absen masuk dulu sebelum absen pulang.", "Check in first."],
        ATT_CO_NOT_PRESENT: ["Absen pulang hanya untuk yang hadir hari ini.", "Check-out is only after a Hadir check-in."],
        ATT_CO_ALREADY: ["Kamu sudah absen pulang hari ini.", "You already checked out today."],
        ATT_CO_OFF: ["Absen pulang tidak dipakai untuk kelasmu.", "Check-out isn't used for your class."],
        ATT_CO_CLOSED: ["Absen pulang sudah ditutup.", "Check-out is closed."],
        ATT_CO_REASON: ["Isi alasan pulang lebih awal dulu.", "Add a reason for leaving early."],
        ATT_PHOTO_NEEDED: ["Fotonya belum ada atau sudah lama, coba lagi.", "The photo is missing or old, try again."],
        ATT_FP_INVALID: ["Sidik jari kedaluwarsa, tempel lagi.", "Fingerprint expired, scan again."],
        ATT_NO_LOCATION: ["Nyalakan lokasi untuk absen pulang.", "Turn on location to check out."],
        ATT_LOCATION_WEAK: ["Lokasi kurang akurat, coba di tempat terbuka.", "Location isn't accurate enough."],
        ATT_TOO_FAR: ["Kamu di luar area sekolah.", "You're outside the school area."]
    };

    async function save() {
        var lang = getLang();
        if (st.mode !== "out") return;
        var reason = ($("reason") && $("reason").value.trim()) || "";
        if (CO.early() && !reason) { showToast(L(CODES.ATT_CO_REASON[0], CODES.ATT_CO_REASON[1]), "error"); if ($("reason")) $("reason").focus(); return; }
        if (!attIdentityReady()) {
            var m = typeof attMethod === "function" ? attMethod() : "face";
            showToast(translations[m === "fp" ? "toast_fp_needed" : "toast_face_photo_needed"][lang], "error");
            return;
        }
        // location: quick check here, the server checks again
        var pos = null;
        var loc = await attSchoolLocation();
        if (loc && loc.enabled && loc.lat != null && loc.lng != null) {
            pos = await attReadPosition();
            if (!pos.ok) { showToast(translations[pos.denied ? "toast_att_loc_denied" : "toast_att_loc_failed"][lang], "error"); return; }
            if (pos.accuracy > 300) { showToast(translations.toast_att_loc_weak[lang], "error"); return; }
            var dist = attDistanceM(loc.lat, loc.lng, pos.lat, pos.lng);
            if (dist > loc.radius_m + Math.min(pos.accuracy, 50)) { showToast(translations.toast_att_too_far[lang].replace("{d}", attDistanceLabel(dist)), "error"); return; }
        }
        var useFp = typeof attMethod === "function" && attMethod() === "fp";
        var photo = useFp ? attFpPhoto() : (typeof capturedPhoto !== "undefined" ? capturedPhoto : null);
        var path = st.user.id + "/" + Date.now() + ".jpg";
        var up = await supabaseClient.storage.from("attendance-photos").upload(path, photo, { contentType: "image/jpeg" });
        if (up.error) { showToast(L("Foto gagal diunggah: ", "Photo upload failed: ") + up.error.message, "error"); return; }
        var r = await supabaseClient.rpc("att_checkout", {
            p_photo: path, p_fp_ticket: useFp ? attFpTicket() : null,
            p_lat: pos && pos.ok ? pos.lat : null, p_lng: pos && pos.ok ? pos.lng : null,
            p_accuracy: pos && pos.ok ? Math.round(pos.accuracy) : null, p_reason: reason || null
        });
        if (r.error) {
            var msg = r.error.message || "";
            var code = Object.keys(CODES).find(function (c) { return msg.indexOf(c) !== -1; });
            if (code === "ATT_FP_INVALID" && typeof attFpUsed === "function") attFpUsed();
            showToast(code ? L(CODES[code][0], CODES[code][1]) : L("Absen pulang gagal: ", "Check-out failed: ") + msg, "error");
            if (code === "ATT_CO_ALREADY" || code === "ATT_CO_CLOSED") load();
            return;
        }
        if (typeof attFpUsed === "function") attFpUsed();
        if (typeof capturedPhoto !== "undefined") capturedPhoto = null;
        if ($("reason")) $("reason").value = "";
        showToast(L("Absen pulang tercatat · ", "Checked out · ") + ((r.data && r.data.time) || dot(nowHM())), "success");
        await load();
    }

    document.addEventListener("DOMContentLoaded", function () {
        var head = document.querySelector(".v2-head");
        if (head && !$("coCard")) {
            var c = document.createElement("section");
            c.id = "coCard"; c.className = "co-card"; c.hidden = true;
            head.insertAdjacentElement("afterend", c);
        }
        try {
            var c = JSON.parse(localStorage.getItem(CACHE) || "null");
            if (c && c.day === localDateStr() && c.row) { st.row = c.row; st.sched = c.sched || null; st.mode = "done"; apply(); }
        } catch (e) {}
        load();
        setInterval(function () { if (st.mode) { syncEarly(); summary(); } }, 30000);
    });
    window.addEventListener("tabshow", load);
})();
