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

    console.error("CAMERA ERROR:", error);

    alert(
        "CAMERA ERROR:\n\n" +
        error.name +
        "\n\n" +
        error.message
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
     * Kita selalu membuat foto
     * dalam format portrait.
     */

    const photoWidth = 1080;
    const photoHeight = 1920;


    canvas.width =
        photoWidth;

    canvas.height =
        photoHeight;


    /*
     * Background
     */

    context.fillStyle =
        "#000000";

    context.fillRect(
        0,
        0,
        photoWidth,
        photoHeight
    );


    /*
     * Ukuran video asli
     */

    const videoWidth =
        video.videoWidth;

    const videoHeight =
        video.videoHeight;


    /*
     * Hitung rasio supaya gambar
     * memenuhi frame portrait.
     */

    const scale =
        Math.max(
            photoWidth / videoWidth,
            photoHeight / videoHeight
        );


    const drawWidth =
        videoWidth * scale;

    const drawHeight =
        videoHeight * scale;


    const offsetX =
        (photoWidth - drawWidth) / 2;

    const offsetY =
        (photoHeight - drawHeight) / 2;


    /*
     * Mirror kamera depan.
     */

    context.save();

    context.translate(
        photoWidth,
        0
    );

    context.scale(
        -1,
        1
    );


    context.drawImage(
        video,
        -offsetX,
        offsetY,
        drawWidth,
        drawHeight
    );


    context.restore();


    /*
     * Preview
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


        cameraStream =
            null;


        document.getElementById(
            "video"
        ).srcObject =
            null;

    }

}
