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
    // CEK ORIENTASI LAYAR
    // =====================================

    const isLandscape =
        window.innerWidth > window.innerHeight;


    // =====================================
    // PORTRAIT
    // =====================================

    if (!isLandscape) {

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
    // LANDSCAPE
    // =====================================

    else {

        /*
         * Saat HP landscape,
         * kita balik 180 derajat terhadap
         * frame kamera yang sekarang.
         *
         * Ini khusus untuk mengatasi kasus
         * kamera kamu yang menghasilkan
         * wajah terbalik saat HP dimiringkan.
         */

        canvas.width =
            videoWidth;

        canvas.height =
            videoHeight;


        context.save();


        context.translate(
            canvas.width,
            canvas.height
        );


        context.rotate(
            Math.PI
        );


        // Mirror kamera depan
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
