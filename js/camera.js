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


    /*
     * Ambil ukuran kamera
     */

    const videoWidth =
        video.videoWidth;

    const videoHeight =
        video.videoHeight;


    /*
     * Canvas mengikuti orientasi
     * video kamera.
     */

    canvas.width =
        videoWidth;

    canvas.height =
        videoHeight;


    /*
     * Mirror kamera depan
     * supaya hasil foto tidak terbalik kiri-kanan.
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


    context.drawImage(
        video,
        0,
        0,
        videoWidth,
        videoHeight
    );


    context.restore();


    /*
     * Tampilkan hasil foto
     */

    const photoPreview =
        document.getElementById(
            "photoPreview"
        );


    photoPreview.src =
        canvas.toDataURL(
            "image/jpeg"
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
