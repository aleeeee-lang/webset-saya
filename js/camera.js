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


    const width =
        video.videoWidth;

    const height =
        video.videoHeight;


    /*
     * Canvas mengikuti ukuran kamera
     */

    canvas.width =
        width;

    canvas.height =
        height;


    /*
     * Bersihkan canvas
     */

    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
     * Mirror kamera depan
     */

    context.save();

    context.translate(
        canvas.width,
        0
    );

    context.scale(
        -1,
        1
    );


    /*
     * Ambil foto TANPA
     * rotasi 90 / 270
     */

    context.drawImage(
        video,
        0,
        0,
        width,
        height
    );


    context.restore();


    /*
     * Tampilkan preview
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
     * Simpan foto
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
