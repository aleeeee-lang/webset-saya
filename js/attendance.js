/* =========================================================
   ATTENDANCE
   SAVE ATTENDANCE
========================================================= */

// ---------- location helpers (attendance_location.sql) ----------
async function attSchoolLocation() {
    try {
        const r = await supabaseClient.from("school_location").select("enabled,lat,lng,radius_m").eq("id", "default").maybeSingle();
        return r.error ? null : r.data;      // table missing = feature not set up: no location needed
    } catch (e) { return null; }
}
function attReadPosition() {
    return new Promise(function (resolve) {
        if (!navigator.geolocation) { resolve({ ok: false }); return; }
        navigator.geolocation.getCurrentPosition(function (p) {
            resolve({ ok: true, lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy || 9999 });
        }, function (err) {
            resolve({ ok: false, denied: !!(err && err.code === 1) });
        }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });
}
function attDistanceM(lat1, lng1, lat2, lng2) {
    const R = 6371000, r = Math.PI / 180;
    const a = Math.pow(Math.sin((lat2 - lat1) * r / 2), 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.pow(Math.sin((lng2 - lng1) * r / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(a));
}
function attDistanceLabel(m) { return m >= 1000 ? (m / 1000).toFixed(1).replace(".", ",") + " km" : Math.round(m) + " m"; }

async function saveAttendance() {

    // =========================
    // GET LOGIN USER
    // =========================

    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();


    if (userError || !user) {

        showToast("Please login first.", "error");

        return;
    }


      // =========================
    // GET STUDENT NAME & CLASS (from profiles)
    // =========================

    const { data: profile } = await supabaseClient
        .from("profiles")
        .select("name, class")
        .eq("id", user.id)
        .single();

    const studentName =
        (profile && profile.name) ? profile.name : user.email;

    const studentClass =
        (profile && profile.class) ? profile.class : null;

    // =========================
    // CHECK ATTENDANCE SCHEDULE
    // =========================

    // These checks only give a quick answer on the phone. The server checks the
    // same rules again with its own clock (attendance_rules.sql), so changing
    // the phone's date or time doesn't get around them.
    let isLateCheckIn = false;
    const lang = getLang();
    const rules = await attDayRules(studentClass);
    const todayStr = localDateStr();

    const { data: already } = await supabaseClient
        .from("attendance").select("id").eq("user_id", user.id).eq("date", todayStr).limit(1);
    if (already && already.length) {
        showToast(translations.toast_att_already[lang], "error");
        return;
    }

    if (!attDayOpen(todayStr, rules)) {
        const ag = rules.agenda[todayStr];
        showToast(translations.toast_att_day_closed[lang] + (ag && ag.label ? " (" + ag.label + ")" : ""), "error");
        return;
    }

    if (studentClass) {

        const schedule = rules.schedule;

        if (schedule) {

            const nowCheck = new Date();
            const nowTime = nowCheck.toTimeString().slice(0, 5);
            const startTime = (schedule.start_time || "").slice(0, 5);
            const endTime = (schedule.end_time || "").slice(0, 5);

            if (startTime && nowTime < startTime) {
                showToast(translations.toast_schedule_not_open_yet[lang] + " " + startTime, "error");
                return;
            }

            if (endTime && nowTime > endTime) {
                if (schedule.late_mode === "late") {
                    const lateEndTime = (schedule.late_end_time || "").slice(0, 5);
                    // no late limit set = closes right at Closes At (as the admin page says)
                    if (!lateEndTime || nowTime > lateEndTime) {
                        showToast(translations.toast_schedule_late_closed[lang], "error");
                        return;
                    }
                    isLateCheckIn = true;
                    showToast(translations.toast_schedule_late_notice[lang], "error");
                } else {
                    showToast(translations.toast_schedule_closed[lang] + " " + endTime, "error");
                    return;
                }
            }
        }
    }

    // =========================
    // GET STATUS
    // =========================

    const selectedStatus = document.querySelector(
        'input[name="status"]:checked'
    );

    const status = selectedStatus
        ? selectedStatus.value
        : "";


    // =========================
    // GET REASON
    // =========================

    const reason =
        document.getElementById("reason").value.trim();


    // =========================
    // GET DATE & TIME (local time)
    // =========================

    const now = new Date();

    const date =
        now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");

    const time =
        now.toTimeString().slice(0, 5);

    const day =
        now.toLocaleDateString("en-US", {
            weekday: "long"
        });


    // =========================
    // VALIDATION
    // =========================

    if (!status) {

        showToast("Please select your attendance status.", "error");

        return;
    }


    if (status !== "Hadir" && !reason) {

        showToast("Please provide a reason for your absence.", "error");

        return;
    }

    const finalReason = isLateCheckIn ? ("[Telat] " + reason).trim() : reason;


    // =========================
    // LOCATION (only for "Hadir", only when the admin turned it on)
    // =========================
    // The server measures the distance again (attendance_location.sql); this
    // only reads the GPS and gives a quick answer.
    let locFields = {};
    if (status === "Hadir") {
        const loc = await attSchoolLocation();
        if (loc && loc.enabled && loc.lat != null && loc.lng != null) {
            const pos = await attReadPosition();
            if (!pos.ok) {
                showToast(translations[pos.denied ? "toast_att_loc_denied" : "toast_att_loc_failed"][lang], "error");
                return;
            }
            const dist = attDistanceM(loc.lat, loc.lng, pos.lat, pos.lng);
            if (pos.accuracy > 300) {
                showToast(translations.toast_att_loc_weak[lang], "error");
                return;
            }
            if (dist > loc.radius_m + Math.min(pos.accuracy, 50)) {
                showToast(translations.toast_att_too_far[lang].replace("{d}", attDistanceLabel(dist)), "error");
                return;
            }
            locFields = { lat: pos.lat, lng: pos.lng, accuracy_m: Math.round(pos.accuracy) };
        }
    }


    // =========================
    // FINGERPRINT (instead of the photo)
    // =========================
    const useFp = typeof attMethod === "function" && attMethod() === "fp";
    let fpFields = {};
    if (useFp) {
        const ticket = attFpTicket();
        if (!ticket) { showToast(translations.toast_fp_needed[lang], "error"); return; }
        fpFields = { fp_ticket: ticket };
    }

    // =========================
    // UPLOAD PHOTO
    // =========================

    let photoUrl = null;


    if (!useFp && typeof capturedPhoto !== "undefined" && capturedPhoto) {

        // one folder per student, so the student (and admins) can open it later
        const filePath =
            user.id + "/" + Date.now() + ".jpg";


        const {
            error: uploadError
        } = await supabaseClient
            .storage
            .from("attendance-photos")
            .upload(
                filePath,
                capturedPhoto,
                {
                    contentType: "image/jpeg"
                }
            );


        if (uploadError) {

            console.error(
                "PHOTO UPLOAD ERROR:",
                uploadError
            );

            showToast(
                "Photo upload failed: " +
                uploadError.message,
                "error"
            );

            return;
        }


        photoUrl = filePath;
    }


    // =========================
    // INSERT TO SUPABASE
    // =========================

    const {
        error
    } = await supabaseClient
        .from("attendance")
        .insert([
            {
                user_id: user.id,

                day: day,

                name: studentName,

                class: studentClass,

                date: date,

                time: time,

                status: status,

                reason: finalReason,

                photo_url: photoUrl,

                ...locFields,

                ...fpFields
            }
        ]);


    // =========================
    // DATABASE ERROR
    // =========================

    if (error) {

        console.error(
            "DATABASE ERROR:",
            error
        );

        // the server's own checks (attendance_rules.sql) answer with a short code
        const code = ["ATT_ALREADY", "ATT_DAY_CLOSED", "ATT_NOT_OPEN_YET", "ATT_CLOSED", "ATT_NO_LOCATION", "ATT_LOCATION_WEAK", "ATT_TOO_FAR", "ATT_FP_INVALID"].find(function (c) { return (error.message || "").indexOf(c) !== -1; });
        const msgKey = { ATT_ALREADY: "toast_att_already", ATT_DAY_CLOSED: "toast_att_day_closed", ATT_NOT_OPEN_YET: "toast_att_not_open", ATT_CLOSED: "toast_att_closed",
                         ATT_NO_LOCATION: "toast_att_loc_failed", ATT_LOCATION_WEAK: "toast_att_loc_weak", ATT_TOO_FAR: "toast_att_too_far_srv", ATT_FP_INVALID: "toast_att_fp_invalid" }[code];
        if (code === "ATT_FP_INVALID" && typeof attFpUsed === "function") attFpUsed();
        showToast(msgKey ? translations[msgKey][getLang()] : "Attendance failed to save: " + error.message, "error");

        return;
    }


    // =========================
    // SUCCESS
    // =========================

    showToast(
        "Attendance successfully saved!",
        "success"
    );

    if (typeof attFpUsed === "function") attFpUsed();   // a ticket works only once


    // =========================
    // RESET
    // =========================

    document.getElementById(
        "reason"
    ).value = "";


    document.querySelectorAll(
        'input[name="status"]'
    ).forEach(function (radio) {

        radio.checked = false;

    });


    if (typeof window.resetStatusPicker === "function") {
        window.resetStatusPicker();
    }


    const photoPreview =
        document.getElementById(
            "photoPreview"
        );


    if (photoPreview) {

        photoPreview.style.display =
            "none";

    }


    if (typeof capturedPhoto !== "undefined") {

        capturedPhoto = null;

    }

}
