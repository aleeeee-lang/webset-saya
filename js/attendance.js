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

// true once the face photo was taken (camera) or the fingerprint was scanned and its photo taken
function attIdentityReady() {
    if (typeof attMethod === "function" && attMethod() === "qr") {
        return !!(typeof attQrCode === "function" && attQrCode() && attQrPhoto());
    }
    if (typeof attMethod === "function" && attMethod() === "fp") {
        return !!(typeof attFpTicket === "function" && attFpTicket() && typeof attFpPhoto === "function" && attFpPhoto());
    }
    return typeof capturedPhoto !== "undefined" && !!capturedPhoto;
}

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

            if (typeof attSyncClock === "function") await attSyncClock();
            const nowCheck = attNow();
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

    const now = attNow();

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

        showToast(translations.toast_pick_status_first[lang], "error");

        return;
    }


    if (status !== "Hadir" && !reason) {

        showToast(translations.toast_reason_needed[lang], "error");

        return;
    }

    // a check-in always needs the photo from the camera (or the fingerprint scan with its photo);
    // the server checks this too (attendance_photo_required.sql)
    if (!attIdentityReady()) {
        const m = typeof attMethod === "function" ? attMethod() : "face";
        showToast(translations[m === "fp" ? "toast_fp_needed" : m === "qr" ? "qr_none" : "toast_face_photo_needed"][lang], "error");
        return;
    }

    const finalReason = isLateCheckIn ? ("[Telat] " + reason).trim() : reason;


    // =========================
    // LOCATION (only for "Hadir", only when the admin turned it on)
    // =========================
    // The server measures the distance again (attendance_location.sql); this
    // only reads the GPS and gives a quick answer.
    let locFields = {};
    // the QR always needs the location (attendance_qr.sql), even when the general check is off
    const qrMode = typeof attMethod === "function" && attMethod() === "qr";
    if (status === "Hadir") {
        const loc = await attSchoolLocation();
        if (qrMode && !(loc && loc.lat != null && loc.lng != null)) {
            showToast(translations.qr_no_school[lang], "error");
            return;
        }
        if (loc && (loc.enabled || qrMode) && loc.lat != null && loc.lng != null) {
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
        const fpPhoto = typeof attFpPhoto === "function" ? attFpPhoto() : null;
        if (!ticket || !fpPhoto) { showToast(translations.toast_fp_needed[lang], "error"); return; }
        fpFields = { fp_ticket: ticket };
    }

    // =========================
    // UPLOAD PHOTO
    // =========================

    let photoUrl = null;


    // fingerprint: the photo taken automatically right after the scan
    const useQr = typeof attMethod === "function" && attMethod() === "qr";
    const qrFields = useQr && typeof attQrCode === "function" && attQrCode() ? { qr_code: attQrCode() } : {};
    const photoToSend = useQr ? attQrPhoto() : useFp ? attFpPhoto() : (typeof capturedPhoto !== "undefined" ? capturedPhoto : null);

    if (photoToSend) {

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
                photoToSend,
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
    // PROOF PHOTO (Izin / Sakit, attendance_proof.sql)
    // =========================
    let proofFields = {};
    const proof = (status === "Izin" || status === "Sakit") && typeof attProofBlob === "function" ? attProofBlob() : null;
    if (proof) {
        const proofPath = user.id + "/proof_" + Date.now() + ".jpg";
        const { error: proofErr } = await supabaseClient.storage.from("attendance-photos").upload(proofPath, proof, { contentType: "image/jpeg" });
        if (proofErr) {
            showToast(translations.toast_proof_upload_failed[lang] + proofErr.message, "error");
            return;
        }
        proofFields = { proof_url: proofPath };
    }

    // =========================
    // INSERT TO SUPABASE
    // =========================

    const row =
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

                ...fpFields,

                ...proofFields,

                ...qrFields
            };
    let { error } = await supabaseClient.from("attendance").insert([row]);
    // database without attendance_proof.sql yet: send it without the proof photo
    if (error && proofFields.proof_url && /proof_url/.test(error.message || "")) {
        delete row.proof_url;
        ({ error } = await supabaseClient.from("attendance").insert([row]));
    }


    // =========================
    // DATABASE ERROR
    // =========================

    if (error) {

        console.error(
            "DATABASE ERROR:",
            error
        );

        // the server's own checks (attendance_rules.sql) answer with a short code
        const code = ["ATT_QR_EXPIRED", "ATT_QR_NO_SCHOOL", "ATT_QR_INVALID", "ATT_PHOTO_NEEDED", "ATT_ALREADY", "ATT_DAY_CLOSED", "ATT_NOT_OPEN_YET", "ATT_CLOSED", "ATT_NO_LOCATION", "ATT_LOCATION_WEAK", "ATT_TOO_FAR", "ATT_FP_INVALID", "ATT_FP_PHOTO"].find(function (c) { return (error.message || "").indexOf(c) !== -1; });
        const msgKey = { ATT_QR_EXPIRED: "qr_expired", ATT_QR_NO_SCHOOL: "qr_no_school", ATT_QR_INVALID: "qr_invalid", ATT_PHOTO_NEEDED: "toast_face_photo_needed", ATT_ALREADY: "toast_att_already", ATT_DAY_CLOSED: "toast_att_day_closed", ATT_NOT_OPEN_YET: "toast_att_not_open", ATT_CLOSED: "toast_att_closed",
                         ATT_NO_LOCATION: "toast_att_loc_failed", ATT_LOCATION_WEAK: "toast_att_loc_weak", ATT_TOO_FAR: "toast_att_too_far_srv", ATT_FP_INVALID: "toast_att_fp_invalid", ATT_FP_PHOTO: "fp_snap_failed" }[code];
        if (code === "ATT_FP_INVALID" && typeof attFpUsed === "function") attFpUsed();
        showToast(msgKey ? translations[msgKey][getLang()] : "Attendance failed to save: " + error.message, "error");

        return;
    }


    // =========================
    // SUCCESS
    // =========================

    showToast(translations.toast_attendance_saved[lang], "success");

    if (typeof attFpUsed === "function") attFpUsed();   // a ticket works only once
    if (useQr && typeof attQrUsed === "function") attQrUsed();


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

    if (typeof attProofReset === "function") attProofReset();

}
