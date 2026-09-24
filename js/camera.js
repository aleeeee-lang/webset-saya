let cameraStream = null;
let capturedPhoto = null;
let imageCapture = null;


// =====================================
// START CAMERA
// =====================================

async function startCamera() {

    const video =
        document.getElementById("video");

    try {

        // Matikan kamera lama
        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(function(track) {
                    track.stop();
                });

            cameraStream = null;
        }


        // Minta akses kamera depan
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


        // ImageCapture
        if (
            "ImageCapture" in window
        ) {

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


        // Pasang stream ke video
        video.srcObject =
            cameraStream;


        // Setting video mobile
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;


        // Jalankan video
        video.play().catch(function(error) {

            console.log(
                "VIDEO PLAY ERROR:",
                error
            );

        });


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



// =====================================
// TAKE PHOTO
// =====================================

function takePhoto() {

    const video =
        document.getElementById("video");

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


    // =====================================
    // AMBIL GAMMA HP
    // =====================================

    const gamma =
        window.lastGamma || 0;


    console.log(
        "GAMMA:",
        gamma
    );


    // =====================================
    // TENTUKAN ORIENTASI
    // =====================================

    let orientation;


    if (gamma > 45) {

        orientation = "LEFT";

    }

    else if (gamma < -45) {

        orientation = "RIGHT";

    }

    else {

        orientation = "PORTRAIT";

    }


    console.log(
        "ORIENTATION:",
        orientation
    );


    // =====================================
    // PORTRAIT
    // =====================================

    if (orientation === "PORTRAIT") {

        canvas.width =
            videoWidth;

        canvas.height =
            videoHeight;


        context.drawImage(
            video,
            0,
            0,
            videoWidth,
            videoHeight
        );

    }


    // =====================================
    // LANDSCAPE RIGHT
    // =====================================

    else if (orientation === "RIGHT") {

        canvas.width =
            videoHeight;

        canvas.height =
            videoWidth;


        context.save();


        context.translate(
            canvas.width,
            0
        );


        context.rotate(
            Math.PI / 2
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


    // =====================================
    // LANDSCAPE LEFT
    // =====================================

    else if (orientation === "LEFT") {

        canvas.width =
            videoHeight;

        canvas.height =
            videoWidth;


        context.save();


        context.translate(
            0,
            canvas.height
        );


        context.rotate(
            -Math.PI / 2
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


    // =====================================
    // PHOTO PREVIEW
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
        "PHOTO BERHASIL DIAMBIL"
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


    cameraStream =
        null;


    imageCapture =
        null;


    const video =
        document.getElementById(
            "video"
        );


    video.srcObject =
        null;


    console.log(
        "CAMERA DIHENTIKAN"
    );

}
