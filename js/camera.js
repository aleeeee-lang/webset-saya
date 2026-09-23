let cameraStream = null;
let capturedPhoto = null;


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


    // =====================================
    // DETEKSI ORIENTASI DEVICE
    // =====================================

    let angle = 0;

    if (
        screen.orientation &&
        typeof screen.orientation.angle === "number"
    ) {

        angle =
            screen.orientation.angle;

    } else if (
        typeof window.orientation === "number"
    ) {

        angle =
            window.orientation;

    }


    // Normalisasi angle
    angle =
        ((angle % 360) + 360) % 360;


    console.log(
        "DEVICE ANGLE:",
        angle
    );


    // =====================================
    // UKURAN VIDEO ASLI
    // =====================================

    const videoWidth =
        video.videoWidth;

    const videoHeight =
        video.videoHeight;


    // =====================================
    // FOTO SELALU PORTRAIT
    // =====================================

    const photoWidth = 1080;

    const photoHeight = 1920;


    canvas.width =
        photoWidth;

    canvas.height =
        photoHeight;


    // =====================================
    // BACKGROUND
    // =====================================

    context.fillStyle =
        "#000000";

    context.fillRect(
        0,
        0,
        photoWidth,
        photoHeight
    );


    // =====================================
    // ROTATE SESUAI ORIENTASI HP
    // =====================================

    context.save();


    // -------------------------------------
    // HP TEGAK
    // -------------------------------------

    if (angle === 0) {

        drawPortrait();

    }


    // -------------------------------------
    // HP LANDSCAPE KANAN
    // -------------------------------------

    else if (angle === 90) {

        context.translate(
            photoWidth,
            0
        );

        context.rotate(
            Math.PI / 2
        );

        drawLandscape();

    }


    // -------------------------------------
    // HP TERBALIK
    // -------------------------------------

    else if (angle === 180) {

        context.translate(
            photoWidth,
            photoHeight
        );

        context.rotate(
            Math.PI
        );

        drawPortrait();

    }


    // -------------------------------------
    // HP LANDSCAPE KIRI
    // -------------------------------------

    else if (angle === 270) {

        context.translate(
            0,
            photoHeight
        );

        context.rotate(
            -Math.PI / 2
        );

        drawLandscape();

    }


    context.restore();


    // =====================================
    // PREVIEW
    // =====================================

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


    // =====================================
    // SIMPAN PHOTO
    // =====================================

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


    // =====================================
    // FUNCTION PORTRAIT
    // =====================================

    function drawPortrait() {

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
         * Mirror kamera depan
         */

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

    }


    // =====================================
    // FUNCTION LANDSCAPE
    // =====================================

    function drawLandscape() {

        /*
         * Setelah rotate 90 derajat,
         * ukuran area gambar menjadi:
         *
         * 1920 x 1080
         */

        const landscapeWidth =
            photoHeight;

        const landscapeHeight =
            photoWidth;


        const scale =
            Math.max(
                landscapeWidth / videoWidth,
                landscapeHeight / videoHeight
            );


        const drawWidth =
            videoWidth * scale;

        const drawHeight =
            videoHeight * scale;


        const offsetX =
            (landscapeWidth - drawWidth) / 2;

        const offsetY =
            (landscapeHeight - drawHeight) / 2;


        /*
         * Mirror kamera depan
         */

        context.translate(
            landscapeWidth,
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


    // =====================================
    // DETEKSI ARAH DEVICE
    // =====================================

    let angle = 0;


    if (
        screen.orientation &&
        typeof screen.orientation.angle === "number"
    ) {

        angle =
            screen.orientation.angle;

    } else if (
        typeof window.orientation === "number"
    ) {

        angle =
            window.orientation;

    }


    angle =
        ((angle % 360) + 360) % 360;


    console.log(
        "DEVICE ANGLE:",
        angle
    );



    // =====================================
    // UKURAN FOTO
    // =====================================

    const photoWidth = 1080;
    const photoHeight = 1920;


    canvas.width =
        photoWidth;

    canvas.height =
        photoHeight;



    // =====================================
    // VIDEO ASLI
    // =====================================

    const videoWidth =
        video.videoWidth;

    const videoHeight =
        video.videoHeight;



    // =====================================
    // TEMPORARY CANVAS
    // =====================================

    const tempCanvas =
        document.createElement("canvas");

    const tempContext =
        tempCanvas.getContext("2d");


    tempCanvas.width =
        videoWidth;

    tempCanvas.height =
        videoHeight;



    // =====================================
    // MIRROR CAMERA DEPAN
    // =====================================

    tempContext.save();

    tempContext.translate(
        videoWidth,
        0
    );

    tempContext.scale(
        -1,
        1
    );


    tempContext.drawImage(
        video,
        0,
        0,
        videoWidth,
        videoHeight
    );


    tempContext.restore();



    // =====================================
    // CANVAS ROTASI
    // =====================================

    const rotatedCanvas =
        document.createElement("canvas");

    const rotatedContext =
        rotatedCanvas.getContext("2d");


    if (
        angle === 90 ||
        angle === 270
    ) {

        rotatedCanvas.width =
            videoHeight;

        rotatedCanvas.height =
            videoWidth;

    } else {

        rotatedCanvas.width =
            videoWidth;

        rotatedCanvas.height =
            videoHeight;

    }



    // =====================================
    // ROTASI
    // =====================================

    rotatedContext.save();


    if (angle === 90) {

        rotatedContext.translate(
            rotatedCanvas.width,
            0
        );

        rotatedContext.rotate(
            Math.PI / 2
        );

    }

    else if (angle === 180) {

        rotatedContext.translate(
            rotatedCanvas.width,
            rotatedCanvas.height
        );

        rotatedContext.rotate(
            Math.PI
        );

    }

    else if (angle === 270) {

        rotatedContext.translate(
            0,
            rotatedCanvas.height
        );

        rotatedContext.rotate(
            -Math.PI / 2
        );

    }


    rotatedContext.drawImage(
        tempCanvas,
        0,
        0
    );


    rotatedContext.restore();



    // =====================================
    // MASUKKAN KE FRAME PORTRAIT
    // =====================================

    const sourceWidth =
        rotatedCanvas.width;

    const sourceHeight =
        rotatedCanvas.height;


    const scale =
        Math.max(
            photoWidth / sourceWidth,
            photoHeight / sourceHeight
        );


    const drawWidth =
        sourceWidth * scale;

    const drawHeight =
        sourceHeight * scale;


    const offsetX =
        (photoWidth - drawWidth) / 2;

    const offsetY =
        (photoHeight - drawHeight) / 2;



    context.fillStyle =
        "#000000";


    context.fillRect(
        0,
        0,
        photoWidth,
        photoHeight
    );


    context.drawImage(

        rotatedCanvas,

        offsetX,
        offsetY,

        drawWidth,
        drawHeight

    );



    // =====================================
    // PREVIEW
    // =====================================

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



    // =====================================
    // SIMPAN FOTO
    // =====================================

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


        const video =
            document.getElementById("video");


        video.srcObject =
            null;

    }

}
