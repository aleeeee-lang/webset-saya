let cameraStream = null;
let capturedPhoto = null;
let imageCapture = null;


// =========================================================
// START CAMERA
// =========================================================

async function startCamera() {

    const video = document.getElementById("video");

    try {

        // Hentikan kamera lama
        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(function(track) {
                    track.stop();
                });

            cameraStream = null;
        }


        // Kamera depan
        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: "user"
                },

                audio: false

            });


        // Ambil video track
        const videoTrack =
            cameraStream.getVideoTracks()[0];


        // ImageCapture jika tersedia
        if ("ImageCapture" in window) {

            try {

                imageCapture =
                    new ImageCapture(videoTrack);

            } catch (error) {

                imageCapture = null;

                console.log(
                    "ImageCapture tidak tersedia:",
                    error
                );

            }

        }


        // Pasang kamera ke video
        video.srcObject =
            cameraStream;


        // Setting video
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;


        // Jalankan video
        await video.play();


        console.log(
            "CAMERA BERHASIL DIBUKA"
        );


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


// =========================================================
// TAKE PHOTO
// =========================================================

function takePhoto() {

    const video =
        document.getElementById("video");


    // Pastikan kamera aktif
    if (
        !cameraStream ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
    ) {

        alert("Kamera belum aktif.");

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


    console.log(
        "VIDEO SIZE:",
        videoWidth,
        "x",
        videoHeight
    );


    // =====================================================
    // CEK ORIENTASI LAYAR
    // =====================================================

    let isLandscape = false;


    if (
        screen.orientation &&
        typeof screen.orientation.type === "string"
    ) {

        isLandscape =
            screen.orientation.type.includes("landscape");

    }

    else {

        isLandscape =
            window.innerWidth > window.innerHeight;

    }


    console.log(
        "LANDSCAPE:",
        isLandscape
    );


    // =====================================================
    // PORTRAIT
    // =====================================================

    if (!isLandscape) {

        canvas.width =
            videoWidth;

        canvas.height =
            videoHeight;


        context.save();


        // TIDAK MIRROR
        context.setTransform(
            1,
            0,
            0,
            1,
            0,
            0
        );


        context.drawImage(
            video,
            0,
            0,
            videoWidth,
            videoHeight
        );


        context.restore();

    }


    // =====================================================
    // LANDSCAPE
    // =====================================================

    else {

        canvas.width =
            videoWidth;

        canvas.height =
            videoHeight;


        context.save();


        // TIDAK MIRROR
        // TIDAK ROTATE
        // TIDAK GAMMA
        // TIDAK DEVICEORIENTATION

        context.setTransform(
            1,
            0,
            0,
            1,
            0,
            0
        );


        context.drawImage(
            video,
            0,
            0,
            videoWidth,
            videoHeight
        );


        context.restore();

    }


    // =====================================================
    // PREVIEW
    // =====================================================

    const photoPreview =
        document.getElementById(
            "photoPreview"
        );


    if (photoPreview) {

        photoPreview.src =
            canvas.toDataURL(
                "image/jpeg",
                0.9
            );


        photoPreview.style.display =
            "block";

    }


    // =====================================================
    // SIMPAN FOTO
    // =====================================================

    canvas.toBlob(

        function(blob) {

            capturedPhoto =
                blob;

            console.log(
                "PHOTO BERHASIL DIAMBIL"
            );

        },

        "image/jpeg",

        0.8

    );

}


// =========================================================
// STOP CAMERA
// =========================================================

function stopCamera() {

    if (!cameraStream) {

        return;

    }


    cameraStream
        .getTracks()
        .forEach(function(track) {

            track.stop();

        });


    cameraStream =
        null;


    imageCapture =
        null;


    const video =
        document.getElementById(
            "video"
        );


    if (video) {

        video.srcObject =
            null;

    }


    console.log(
        "CAMERA DIHENTIKAN"
    );

}
