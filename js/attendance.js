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

        alert("Please login first.");

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

        alert("Please select your attendance status.");

        return;
    }


    if (status !== "Hadir" && !reason) {

        alert("Please provide a reason for your absence.");

        return;
    }


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

            alert(
                "Photo upload failed: " +
                uploadError.message
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

                date: date,

                time: time,

                status: status,

                reason: reason,

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

        alert(
            "Attendance failed to save: " +
            error.message
        );

        return;
    }


    // =========================
    // SUCCESS
    // =========================

    alert(
        "Attendance successfully saved! ✅"
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
