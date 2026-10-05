/* =========================================================
   ATTENDANCE
   SAVE ATTENDANCE
========================================================= */

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

    let isLateCheckIn = false;

    if (studentClass) {

        const { data: schedule } = await supabaseClient
            .from("attendance_schedules")
            .select("*")
            .eq("class", studentClass)
            .maybeSingle();

        if (schedule) {

            const lang = getLang();
            const nowCheck = new Date();
            const isoDay = nowCheck.getDay() === 0 ? 7 : nowCheck.getDay();
            const nowTime = nowCheck.toTimeString().slice(0, 5);
            const activeDays = schedule.active_days || [];
            const startTime = (schedule.start_time || "").slice(0, 5);
            const endTime = (schedule.end_time || "").slice(0, 5);

            if (activeDays.length && activeDays.indexOf(isoDay) === -1) {
                showToast(translations.toast_schedule_day_inactive[lang], "error");
                return;
            }

            if (startTime && nowTime < startTime) {
                showToast(translations.toast_schedule_not_open_yet[lang] + " " + startTime, "error");
                return;
            }

            if (endTime && nowTime > endTime) {
                if (schedule.late_mode === "late") {
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
    // UPLOAD PHOTO
    // =========================

    let photoUrl = null;


    if (typeof capturedPhoto !== "undefined" && capturedPhoto) {

        const filePath =
            Date.now() + ".jpg";


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

                photo_url: photoUrl
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

        showToast(
            "Attendance failed to save: " +
            error.message,
            "error"
        );

        return;
    }


    // =========================
    // SUCCESS
    // =========================

    showToast(
        "Attendance successfully saved!",
        "success"
    );


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


    document.getElementById(
        "selectedStatus"
    ).textContent = "Not selected";


    document.getElementById(
        "selectedStatusLight"
    ).className = "status-light";


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
