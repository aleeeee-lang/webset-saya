const FLIP_CAMERA = true;   // true = flip the picture back, false = no flip
let cameraStream = null;
let capturedPhoto = null;


// =====================================
// FACE DETECTION
// =====================================

const FACE_MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";

let faceModelsLoaded = false;
let faceDetectionAvailable = true;   // becomes false if models fail to load
let faceDetected = false;
let faceDetectionRunning = false;

function setFaceStatus(key, color) {
    const el = document.getElementById("faceStatus");
    if (!el) return;

    const lang = typeof getLang === "function" ? getLang() : "en";
    const entry = typeof translations !== "undefined" ? translations[key] : null;

    el.textContent = entry ? entry[lang] : "";
    el.style.color = color;
}

function setTakePhotoEnabled(enabled) {
    const btn = document.getElementById("takePhotoBtn");
    if (btn) btn.disabled = !enabled;
}

async function loadFaceModels() {

    if (faceModelsLoaded || !faceDetectionAvailable) return;

    if (typeof faceapi === "undefined") {
        faceDetectionAvailable = false;
        return;
    }

    try {

        const loadPromise = faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);

        const timeoutPromise = new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error("Face model load timeout")); }, 8000);
        });

        await Promise.race([loadPromise, timeoutPromise]);

        faceModelsLoaded = true;

    } catch (error) {

        console.error("Failed to load face detection models:", error);
        faceDetectionAvailable = false;

    }

}

async function runFaceDetectionLoop() {

    if (!cameraStream) {
        faceDetectionRunning = false;
        return;
    }

    if (!faceDetectionAvailable) {
        setFaceStatus("face_unavailable", "#64748b");
        setTakePhotoEnabled(true);
        faceDetectionRunning = false;
        return;
    }

    const video = document.getElementById("video");

    if (!faceModelsLoaded) {
        setFaceStatus("face_loading", "#64748b");
        requestAnimationFrame(runFaceDetectionLoop);
        return;
    }

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        requestAnimationFrame(runFaceDetectionLoop);
        return;
    }

    try {

        const result = await faceapi.detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
        );

        faceDetected = !!result;

        if (faceDetected) {
            setFaceStatus("face_detected", "#16a34a");
            setTakePhotoEnabled(true);
        } else {
            setFaceStatus("face_not_detected", "#d97706");
            setTakePhotoEnabled(false);
        }

    } catch (error) {
        console.error("Face detection error:", error);
    }

    if (cameraStream) {
        requestAnimationFrame(runFaceDetectionLoop);
    } else {
        faceDetectionRunning = false;
    }

}

function startFaceDetection() {

    faceDetected = false;
    setTakePhotoEnabled(false);

    loadFaceModels();

    if (!faceDetectionRunning) {
        faceDetectionRunning = true;
        runFaceDetectionLoop();
    }

}


// =====================================
// START CAMERA
// =====================================

async function startCamera() {

    const video = document.getElementById("video");

    const photoPreview =
    document.getElementById("photoPreview");

if (photoPreview) {
    photoPreview.style.display = "none";
}

video.style.display = "block";

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
        video.style.transform = FLIP_CAMERA ? "scaleX(-1)" : "none";

        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;


        await video.play();

        startFaceDetection();

        console.log("KAMERA BERHASIL DIBUKA");

    }

    catch (error) {

        console.error(
            "CAMERA ERROR:",
            error.name,
            error.message
        );

        showToast(
            "Kamera tidak dapat dibuka: " +
            error.name,
            "error"
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

        showToast("Kamera belum aktif.", "error");

        return;

    }


    // Cek wajah terdeteksi (kalau pendeteksi wajah tersedia)
    if (faceDetectionAvailable && !faceDetected) {

        showToast("Posisikan wajahmu di dalam bingkai dulu.", "error");

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

   context.save();

if (FLIP_CAMERA) {
    context.translate(width, 0);
    context.scale(-1, 1);
}

context.drawImage(video, 0, 0, width, height);

context.restore();


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

    faceDetected = false;
    faceDetectionRunning = false;
    setTakePhotoEnabled(false);

    const faceStatusEl = document.getElementById("faceStatus");
    if (faceStatusEl) {
        faceStatusEl.textContent = "";
    }


    console.log(
        "KAMERA DIHENTIKAN"
    );

}
