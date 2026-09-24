let cameraStream = null;
let capturedPhoto = null;
let imageCapture = null;

window.lastGamma = 0;

window.addEventListener(
    "deviceorientation",
    function(event) {

        if (
            typeof event.gamma === "number"
        ) {

            window.lastGamma =
                event.gamma;

        }

    }
);


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



function takePhoto() {

    const video = document.getElementById("video");

    if (
        !cameraStream ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
    ) {
        alert("Kamera belum aktif.");
        return;
    }

    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // =====================================
    // CEK ORIENTASI LAYAR
    // =====================================

    let angle = 0;

    if (
        screen.orientation &&
        typeof screen.orientation.angle === "number"
    ) {
        angle = screen.orientation.angle;
    } else if (
        typeof window.orientation === "number"
    ) {
        angle = window.orientation;
    }

    console.log("SCREEN ANGLE:", angle);


    // =====================================
    // PORTRAIT
    // =====================================

    if (angle === 0 || angle === 180) {

        canvas.width = videoWidth;
        canvas.height = videoHeight;

        context.setTransform(1, 0, 0, 1, 0, 0);

        /*
         * TANPA MIRROR
         */
        context.drawImage(
            video,
            0,
            0,
            videoWidth,
            videoHeight
        );
    }


    // =====================================
    // LANDSCAPE
    // =====================================

    else if (angle === 90) {

        canvas.width = videoHeight;
        canvas.height = videoWidth;

        context.save();

        context.translate(
            canvas.width,
            0
        );

        context.rotate(
            Math.PI / 2
        );

        /*
         * TANPA MIRROR
         */
        context.drawImage(
            video,
            0,
            0,
            videoWidth,
            videoHeight
        );

        context.restore();
    }


    else if (angle === 270) {

        canvas.width = videoHeight;
        canvas.height = videoWidth;

        context.save();

        context.translate(
            0,
            canvas.height
        );

        context.rotate(
            -Math.PI / 2
        );

        /*
         * TANPA MIRROR
         */
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
    // PREVIEW
    // =====================================

    const photoPreview =
        document.getElementById("photoPreview");

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

            capturedPhoto = blob;

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
