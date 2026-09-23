let cameraStream = null;
let capturedPhoto = null;


// =========================
// START CAMERA
// =========================

async function startCamera() {

    try {

        const video =
            document.getElementById("video");


        // Kalau kamera sebelumnya masih aktif
        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(function(track) {
                    track.stop();
                });

            cameraStream = null;
        }


        // Buka kamera
        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: "user"
                },

                audio: false

            });


        // Masukkan kamera ke video
        video.srcObject =
            cameraStream;


        // Tunggu kamera siap
        await new Promise(function(resolve) {

            if (video.readyState >= 2) {

                resolve();

            } else {

                video.onloadedmetadata =
                    function() {

                        resolve();

                    };

            }

        });


        // Jalankan video
        await video.play();


        console.log(
            "CAMERA BERHASIL AKTIF"
        );


    } catch (error) {

        console.error(
            "CAMERA ERROR:",
            error
        );


        alert(
            "Kamera tidak bisa dibuka.\n\n" +
            error.name +
            "\n" +
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


    // Pastikan kamera aktif
    if (
        !cameraStream ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
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
     * Gunakan ukuran asli kamera.
     *
     * JANGAN dipaksa 1080 x 1920 dulu.
     * Kita stabilkan kamera terlebih dahulu.
     */

    canvas.width =
        video.videoWidth;

    canvas.height =
        video.videoHeight;


    /*
     * Kamera depan dibuat mirror
     * seperti tampilan selfie.
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
        canvas.width,
        canvas.height
    );


    context.restore();


    // =========================
    // PREVIEW
    // =========================

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


    // =========================
    // SIMPAN FOTO
    // =========================

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
