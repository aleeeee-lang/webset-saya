let cameraStream = null;
let capturedPhoto = null;


// =========================
// START CAMERA
// =========================

async function startCamera() {

    try {

        cameraStream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user"
                }
            });


        const video =
            document.getElementById("video");


        video.srcObject =
            cameraStream;

        await video.play();


    } catch (error) {

        console.error(
            "CAMERA ERROR:",
            error
        );

        alert(
            "Kamera tidak bisa dibuka. Pastikan browser memiliki izin kamera."
        );

    }

}


// =========================
// TAKE PHOTO
// =========================

function takePhoto() {

    const video =
        document.getElementById("video");

    // Pastikan kamera sudah aktif
    if (
        !cameraStream ||
        video.videoWidth === 0
    ) {

        alert(
            "Silakan buka kamera terlebih dahulu."
        );

        return;

    }

    const canvas =
        document.getElementById("canvas");

    const context =
        canvas.getContext("2d");

    // Ambil orientasi layar
    const orientation =
        screen.orientation
            ? screen.orientation.angle
            : 0;

    let width =
        video.videoWidth;

    let height =
        video.videoHeight;


    // =========================
    // ROTASI FOTO
    // =========================

    if (
        orientation === 90 ||
        orientation === 270
    ) {

        canvas.width = height;
        canvas.height = width;

    } else {

        canvas.width = width;
        canvas.height = height;

    }


    context.save();


    // =========================
    // ROTATE SESUAI HP
    // =========================

    if (orientation === 90) {

        context.translate(
            canvas.width,
            0
        );

        context.rotate(
            Math.PI / 2
        );

    }

    else if (orientation === 270) {

        context.translate(
            0,
            canvas.height
        );

        context.rotate(
            -Math.PI / 2
        );

    }

    else if (orientation === 180) {

        context.translate(
            canvas.width,
            canvas.height
        );

        context.rotate(
            Math.PI
        );

    }


    // =========================
    // MIRROR UNTUK FRONT CAMERA
    // =========================

    context.translate(
        width,
        0
    );

    context.scale(
        -1,
        1
    );


    context.drawImage(
        video,
        0,
        0,
        width,
        height
    );


    context.restore();


    // =========================
    // PREVIEW
    // =========================

    const photoPreview =
        document.getElementById(
            "photoPreview"
        );

    photoPreview.src =
        canvas.toDataURL(
            "image/jpeg",
            0.9
        );

    photoPreview.style.display =
        "block";


    // =========================
    // SAVE PHOTO
    // =========================

    canvas.toBlob(

        function(blob) {

            capturedPhoto =
                blob;

        },

        "image/jpeg",

        0.8

    );


    alert(
        "Foto berhasil diambil! ✅"
    );

}

// =========================
// STOP CAMERA
// =========================

function stopCamera() {

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(function(track) {

                track.stop();

            });


        cameraStream = null;


        document.getElementById(
            "video"
        ).srcObject = null;

    }

}
