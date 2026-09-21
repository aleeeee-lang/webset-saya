/* =========================================================
   ATTENDANCE
   SAVE ATTENDANCE
========================================================= */

async function saveAttendance() {

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
    // GET DATE & TIME
    // =========================

    const now = new Date();

    const date =
        now.toISOString().split("T")[0];

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

        const fileName =
            Date.now() + ".jpg";

        const filePath =
            fileName;


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

                name: "Aly",

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
    ).textContent = "Belum dipilih";


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
