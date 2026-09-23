let cameraStream = null;
let capturedPhoto = null;


// =====================================
// START CAMERA
// =====================================

async function startCamera() {

    const video = document.getElementById("video");

    try {

        // Matikan kamera lama
        if (cameraStream) {

            cameraStream.getTracks().forEach(function(track) {
                track.stop();
            });

            cameraStream = null;
        }


        // Minta akses kamera
        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user"
                },
                audio: false
            });


        cameraStream = stream;


        // Pasang kamera
        video.srcObject = stream;


        // Penting untuk mobile
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;


        // Jangan pakai await video.play()
        video.play().catch(function(error) {

            console.log(
                "VIDEO PLAY ERROR:",
                error
            );

        });


        console.log("CAMERA BERHASIL DIBUKA");


    } catch (error) {

        console.error(
            "CAMERA ERROR:",
            error.name,
            error.message
        );


        alert(
            "CAMERA ERROR:\n\n" +
            error.name +
            "\n\n" +
            error.message
        );

    }

}



// =====================================
// TAKE PHOTO
// =====================================

function takePhoto() {

    const video =
        document.getElementById("video");


    // Pastikan kamera aktif
    if (
        !cameraStream ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
    ) {

        alert(
            "Kamera belum aktif."
        );

        return;

    }


    const canvas =
        document.getElementById("canvas");

    const context =
        canvas.getContext("2d");


    // =====================================
    // DETEKSI ORIENTASI HP
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


    // Normalisasi
    angle =
        ((angle % 360) + 360) % 360;


    console.log(
        "DEVICE ORIENTATION:",
        angle
    );


    // =====================================
    // UKURAN VIDEO
    // =====================================

    const videoWidth =
        video.videoWidth;

    const videoHeight =
        video.videoHeight;


    // =====================================
    // UKURAN CANVAS
    // =====================================

    if (
        angle === 90 ||
        angle === 270
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


    // Bersihkan canvas

    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // =====================================
    // ROTASI
    // =====================================

    context.save();


    if (angle === 90) {

        // Putar 90 derajat

        context.translate(
            canvas.width,
            0
        );

        context.rotate(
            Math.PI / 2
        );


    } else if (angle === 180) {

        // Putar 180 derajat

        context.translate(
            canvas.width,
            canvas.height
        );

        context.rotate(
            Math.PI
        );


    } else if (angle === 270) {

        // Putar 270 derajat

        context.translate(
            0,
            canvas.height
        );

        context.rotate(
            -Math.PI / 2
        );

    }


    // =====================================
    // MIRROR KAMERA DEPAN
    // =====================================

    context.translate(
        videoWidth,
        0
    );

    context.scale(
        -1,
        1
    );


    // =====================================
    // GAMBAR FOTO
    // =====================================

    context.drawImage(
        video,
        0,
        0,
        videoWidth,
        videoHeight
    );


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


    console.log(
        "PHOTO TAKEN - ORIENTATION:",
        angle
    );


    alert(
        "Foto berhasil diambil! ✅"
    );

}





// =====================================
// STOP CAMERA
// =====================================

function stopCamera() {

    if (!cameraStream) {
        return;
    }


    cameraStream
        .getTracks()
        .forEach(function(track) {
            track.stop();
        });


    cameraStream = null;


    const video =
        document.getElementById("video");


    video.srcObject = null;

}
