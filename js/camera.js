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

async function takePhoto() {

    const video =
        document.getElementById("video");


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


    try {

        let photoBlob = null;


        // =================================
        // COBA AMBIL FOTO NATIF KAMERA
        // =================================

        if (imageCapture) {

            try {

                photoBlob =
                    await imageCapture.takePhoto();

                console.log(
                    "FOTO DIAMBIL MENGGUNAKAN IMAGECAPTURE"
                );

            } catch (error) {

                console.log(
                    "ImageCapture gagal, menggunakan video:",
                    error
                );

                photoBlob = null;

            }

        }


        // =================================
        // FALLBACK
        // =================================

        if (!photoBlob) {

            photoBlob =
                await captureFromVideo(video);

        }


        if (!photoBlob) {

            alert(
                "Foto gagal diambil."
            );

            return;

        }


        // =================================
        // PROSES FOTO
        // =================================

        await processCapturedPhoto(
            photoBlob
        );


    } catch (error) {

        console.error(
            "TAKE PHOTO ERROR:",
            error
        );


        alert(
            "Foto gagal diambil.\n\n" +
            error.message
        );

    }

}



// =====================================
// FALLBACK CAMERA
// =====================================

async function captureFromVideo(video) {

    const canvas =
        document.getElementById("canvas");


    const context =
        canvas.getContext("2d");


    const width =
        video.videoWidth;

    const height =
        video.videoHeight;


    canvas.width =
        width;

    canvas.height =
        height;


    context.clearRect(
        0,
        0,
        width,
        height
    );


    // Mirror kamera depan
    context.save();

    context.translate(
        width,
        0
    );

    context.scale(
        -1,
        1
    );


    /*
     * PENTING:
     *
     * Tidak ada rotate()
     * Tidak ada gamma
     * Tidak ada beta
     *
     * Kita tidak memutar frame
     * secara manual.
     */

    context.drawImage(
        video,
        0,
        0,
        width,
        height
    );


    context.restore();


    return new Promise(function(resolve) {

        canvas.toBlob(

            function(blob) {

                resolve(blob);

            },

            "image/jpeg",

            0.9

        );

    });

}



// =====================================
// PROCESS PHOTO
// =====================================

async function processCapturedPhoto(
    photoBlob
) {

    const canvas =
        document.getElementById("canvas");

    const context =
        canvas.getContext("2d");


    let bitmap;


    // =================================
    // BACA ORIENTASI FOTO
    // =================================

    try {

        bitmap =
            await createImageBitmap(
                photoBlob,
                {
                    imageOrientation: "from-image"
                }
            );

    } catch (error) {

        console.log(
            "createImageBitmap gagal:",
            error
        );


        // Fallback menggunakan Image
        bitmap =
            await loadImage(
                photoBlob
            );

    }


    const width =
        bitmap.width;

    const height =
        bitmap.height;


    canvas.width =
        width;

    canvas.height =
        height;


    context.clearRect(
        0,
        0,
        width,
        height
    );


    // =================================
    // MIRROR KAMERA DEPAN
    // =================================

    context.save();


    context.translate(
        width,
        0
    );


    context.scale(
        -1,
        1
    );


    /*
     * TIDAK ADA ROTATE DI SINI.
     *
     * Orientasi sudah ditangani
     * oleh imageOrientation.
     */

    context.drawImage(
        bitmap,
        0,
        0,
        width,
        height
    );


    context.restore();


    // =================================
    // PREVIEW
    // =================================

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


    // =================================
    // SIMPAN FOTO
    // =================================

    canvas.toBlob(

        function(blob) {

            capturedPhoto =
                blob;

            console.log(
                "FOTO BERHASIL DISIMPAN"
            );

        },

        "image/jpeg",

        0.9

    );


    console.log(
        "PHOTO PROCESSING SELESAI"
    );

}



// =====================================
// LOAD IMAGE FALLBACK
// =====================================

function loadImage(blob) {

    return new Promise(function(
        resolve,
        reject
    ) {

        const image =
            new Image();


        const url =
            URL.createObjectURL(
                blob
            );


        image.onload =
            function() {

                URL.revokeObjectURL(
                    url
                );

                resolve(image);

            };


        image.onerror =
            function(error) {

                URL.revokeObjectURL(
                    url
                );

                reject(error);

            };


        image.src =
            url;

    });

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
