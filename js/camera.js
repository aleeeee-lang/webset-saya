let cameraStream = null;
let capturedPhoto = null;


// =====================================
// START CAMERA
// =====================================

async function startCamera() {

    const video = document.getElementById("video");

    if (!video) {
        console.error("Element #video tidak ditemukan.");
        return;
    }

    try {

        // Hentikan kamera sebelumnya
        stopCamera();


        // Buka kamera depan
        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: {
                        ideal: "user"
                    },

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    }
                },

                audio: false

            });


        // Pasang kamera ke video
        video.srcObject = cameraStream;

        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;


        await video.play();


        console.log("KAMERA BERHASIL DIBUKA");

    }

    catch (error) {

        console.error(
            "CAMERA ERROR:",
            error.name,
            error.message
        );

        alert(
            "Kamera tidak dapat dibuka.\n\n" +
            error.name +
            "\n" +
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

    const canvas =
        document.getElementById("canvas");

    const photoPreview =
        document.getElementById("photoPreview");


    // Cek kamera
    if (
        !cameraStream ||
        !video ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
    ) {

        alert("Kamera belum aktif.");

        return;

    }


    // =====================================
    // UKURAN ASLI VIDEO
    // =====================================

    const width =
        video.videoWidth;

    const height =
        video.videoHeight;


    // =====================================
    // SET CANVAS
    // =====================================

    canvas.width = width;
    canvas.height = height;


    const context =
        canvas.getContext("2d");


    // Bersihkan canvas
    context.clearRect(
        0,
        0,
        width,
        height
    );


    // =====================================
    // AMBIL 1 FRAME SAJA
    // =====================================

    context.drawImage(
        video,
        0,
        0,
        width,
        height
    );


    // =====================================
    // BUAT PREVIEW
    // =====================================

    const imageData =
        canvas.toDataURL(
            "image/jpeg",
            0.9
        );


   if (photoPreview) {

    photoPreview.src = imageData;

    photoPreview.style.display = "block";

    // Sembunyikan kamera live
    video.style.display = "none";

}

    // =====================================
    // SIMPAN FOTO
    // =====================================

    canvas.toBlob(

        function(blob) {

            if (blob) {

                capturedPhoto =
                    blob;

                console.log(
                    "PHOTO BERHASIL DIAMBIL"
                );

            }

        },

        "image/jpeg",

        0.9

    );

}


// =====================================
// STOP CAMERA
// =====================================

function stopCamera() {

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(function(track) {

                track.stop();

            });

        cameraStream = null;

    }


    const video =
        document.getElementById("video");


    if (video) {

        video.pause();

        video.srcObject = null;

    }


    console.log(
        "KAMERA DIHENTIKAN"
    );

}
