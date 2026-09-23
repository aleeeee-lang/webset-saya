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
// GET SCREEN ORIENTATION
// =========================

function getCameraRotation() {

    /*
     * Ambil orientasi layar
     */

    if (
        screen.orientation &&
        typeof screen.orientation.angle === "number"
    ) {

        return screen.orientation.angle;

    }


    /*
     * Fallback untuk browser lama
     */

    if (
        typeof window.orientation === "number"
    ) {

        return window.orientation;

    }


    return 0;

}


// =========================
// TAKE PHOTO
// =========================

function takePhoto() {

    const video =
        document.getElementById("video");


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


    const videoWidth =
        video.videoWidth;

    const videoHeight =
        video.videoHeight;


    /*
     * Ambil orientasi device
     */

    let rotation =
        getCameraRotation();


    /*
     * Normalisasi nilai rotasi
     */

    rotation =
        ((rotation % 360) + 360) % 360;


    /*
     * Ukuran canvas
     */

    if (
        rotation === 90 ||
        rotation === 270
    ) {

        canvas.width =
            videoHeight;

        canvas.height =
            videoWidth;

    } else {

        canvas.width =
            videoWidth;

        canvas.height =
            videoHeight;

    }


    context.save();


    /*
     * =========================
     * ROTASI
     * =========================
     */

    if (rotation === 90) {

        context.translate(
            canvas.width,
            0
        );

        context.rotate(
            Math.PI / 2
        );

    }

    else if (rotation === 180) {

        context.translate(
            canvas.width,
            canvas.height
        );

        context.rotate(
            Math.PI
        );

    }

    else if (rotation === 270) {

        context.translate(
            0,
            canvas.height
        );

        context.rotate(
            -Math.PI / 2
        );

    }


    /*
     * =========================
     * FRONT CAMERA
     * =========================
     *
     * Mirror kiri-kanan supaya
     * hasil selfie terasa natural.
     */

    context.translate(
        videoWidth,
        0
    );

    context.scale(
        -1,
        1
    );


    /*
     * =========================
     * DRAW CAMERA
     * =========================
     */

    context.drawImage(
        video,
        0,
        0,
        videoWidth,
        videoHeight
    );


    context.restore();


    /*
     * =========================
     * PHOTO PREVIEW
     * =========================
     */

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


    /*
     * =========================
     * SAVE PHOTO
     * =========================
     */

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
