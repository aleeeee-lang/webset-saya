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
    // AMBIL ORIENTASI HP
    // =====================================

    let gamma = 0;

    if (
        typeof window.lastGamma === "number"
    ) {

        gamma =
            window.lastGamma;

    }


    console.log(
        "GAMMA:",
        gamma
    );


    // =====================================
    // TENTUKAN ARAH HP
    // =====================================

    let orientation;


    if (gamma > 45) {

        // HP miring kiri
        orientation = "LEFT";

    }

    else if (gamma < -45) {

        // HP miring kanan
        orientation = "RIGHT";

    }

    else {

        // HP tegak
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


        context.save();


        // Mirror kamera depan
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

    }


    // =====================================
    // LANDSCAPE KANAN
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


        // Mirror kamera depan
        context.translate(
            videoWidth,
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

    }


    // =====================================
    // LANDSCAPE KIRI
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


        // Mirror kamera depan
        context.translate(
            videoWidth,
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

    }


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
        "PHOTO TAKEN:",
        orientation
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

window.addEventListener("deviceorientation", function(event) {

    console.log(
        "BETA:",
        event.beta,
        "GAMMA:",
        event.gamma,
        "ALPHA:",
        event.alpha
    );

});
