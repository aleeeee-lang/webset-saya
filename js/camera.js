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

const FACE_BOX_DISPLAY_MS = 5000;   // how long the box stays visible after a face is first detected
let faceWasDetected = false;
let faceBoxVisible = false;
let faceBoxTimer = null;

function resetFaceBoxTimer() {
    if (faceBoxTimer) {
        clearTimeout(faceBoxTimer);
        faceBoxTimer = null;
    }
    faceBoxVisible = false;
}

// =====================================
// LIVENESS CHECK (blink detection)
// =====================================
// A printed photo or a photo shown on another screen can't blink in real
// time, so require one real blink before the photo button is enabled. This
// is a basic anti-spoofing measure, not foolproof against a live video of
// someone else, but it blocks the simple "use a photo" trick.

// Fixed EAR thresholds don't work well across different phones/cameras
// (lighting, distance, lens quality all shift the numbers), so instead we
// track a per-person baseline "eyes open" EAR and look for a relative dip,
// which adapts automatically to whoever is in frame.
const EAR_CLOSE_RATIO = 0.85;   // eyes considered closed below 85% of the open baseline
const EAR_OPEN_RATIO = 0.85;    // eyes considered open again above 85% of the open baseline (same as close: any dip-then-rise counts)
const EAR_BASELINE_SMOOTHING = 0.15;
let livenessPassed = false;
let eyesClosedSeen = false;          // becomes true once we've seen the eyes closed since the face appeared
let earBaseline = null;              // running "eyes open" EAR baseline, recalculated per face
let livenessStatusTimer = null;      // hides the "berhasil berkedip" message after a short delay

function resetLiveness() {
    livenessPassed = false;
    eyesClosedSeen = false;
    earBaseline = null;
    if (livenessStatusTimer) {
        clearTimeout(livenessStatusTimer);
        livenessStatusTimer = null;
    }
}

function pointDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function eyeAspectRatio(points, idx) {
    const p1 = points[idx[0]];
    const p2 = points[idx[1]];
    const p3 = points[idx[2]];
    const p4 = points[idx[3]];
    const p5 = points[idx[4]];
    const p6 = points[idx[5]];
    const vertical = pointDistance(p2, p6) + pointDistance(p3, p5);
    const horizontal = pointDistance(p1, p4);
    if (horizontal === 0) return 1;
    return vertical / (2 * horizontal);
}

function updateLiveness(landmarks) {
    if (livenessPassed || !landmarks || !landmarks.positions) return;

    const pts = landmarks.positions;
    const earLeft = eyeAspectRatio(pts, [36, 37, 38, 39, 40, 41]);
    const earRight = eyeAspectRatio(pts, [42, 43, 44, 45, 46, 47]);
    const ear = (earLeft + earRight) / 2;

    if (earBaseline === null) {
        earBaseline = ear;
    }

    const closedThreshold = earBaseline * EAR_CLOSE_RATIO;
    const openThreshold = earBaseline * EAR_OPEN_RATIO;

    if (ear < closedThreshold) {
        eyesClosedSeen = true;
    } else if (ear > openThreshold) {
        // Keep the baseline tracking this person's actual "eyes open" EAR,
        // so it slowly adapts if they move closer/further from the camera.
        earBaseline = earBaseline + (ear - earBaseline) * EAR_BASELINE_SMOOTHING;

        if (eyesClosedSeen) {
            // Eyes went closed, then open again: that's a blink.
            livenessPassed = true;
        }
    }
}

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

        const loadPromise = Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_URL)
        ]);

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

function clearFaceBox() {
    const boxCanvas = document.getElementById("faceBoxCanvas");
    if (!boxCanvas) return;
    const ctx = boxCanvas.getContext("2d");
    ctx.clearRect(0, 0, boxCanvas.width, boxCanvas.height);
}

function drawFaceBox(result) {

    const video = document.getElementById("video");
    const boxCanvas = document.getElementById("faceBoxCanvas");
    if (!boxCanvas || !video) return;

    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;
    if (!displayWidth || !displayHeight) return;

    if (boxCanvas.width !== displayWidth || boxCanvas.height !== displayHeight) {
        boxCanvas.width = displayWidth;
        boxCanvas.height = displayHeight;
    }

    // Keep the box mirrored in sync with the mirrored video preview.
    boxCanvas.style.transform = video.style.transform || "none";

    const ctx = boxCanvas.getContext("2d");
    ctx.clearRect(0, 0, boxCanvas.width, boxCanvas.height);

    if (!result || !video.videoWidth || !video.videoHeight) return;

    // The video uses object-fit:cover, so native detection coordinates
    // need to be mapped through the same cover-crop scale/offset.
    const scale = Math.max(displayWidth / video.videoWidth, displayHeight / video.videoHeight);
    const offsetX = (video.videoWidth * scale - displayWidth) / 2;
    const offsetY = (video.videoHeight * scale - displayHeight) / 2;

    const landmarks = result.landmarks;
    let minX, minY, maxX, maxY;

    if (landmarks && landmarks.positions && landmarks.positions.length) {
        // The 68 landmark points trace the real jawline/eyebrows/chin, so
        // their bounding box already hugs the actual face (not the padded
        // square the raw detector box gives). Only the forehead/hair above
        // the eyebrows is missing, so pad upward a bit for that.
        const pts = landmarks.positions;
        minX = pts[0].x; maxX = pts[0].x;
        minY = pts[0].y; maxY = pts[0].y;
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
    } else {
        const box = result.detection ? result.detection.box : result.box;
        if (!box) return;
        minX = box.x;
        maxX = box.x + box.width;
        minY = box.y;
        maxY = box.y + box.height;
    }

    const faceW = maxX - minX;
    const faceH = maxY - minY;
    const foreheadPad = faceH * 0.22;   // landmarks stop at the eyebrows, so add a little room for the forehead
    const sidePad = faceW * 0.02;       // landmarks already span cheek-to-cheek, keep this snug
    const chinTrim = faceH * 0.05;      // the jawline landmark sits a touch below the visual chin, so pull it up

    const faceMinX = (minX - sidePad) * scale - offsetX;
    const faceMaxX = (maxX + sidePad) * scale - offsetX;
    const faceMinY = (minY - foreheadPad) * scale - offsetY;
    const faceMaxY = (maxY - chinTrim) * scale - offsetY;

    const x = faceMinX;
    const y = faceMinY;
    const w = faceMaxX - faceMinX;
    const h = faceMaxY - faceMinY;
    const r = Math.max(4, Math.min(16, w / 4, h / 4));

    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.stroke();
}

async function runFaceDetectionLoop() {

    if (!cameraStream) {
        faceDetectionRunning = false;
        return;
    }

    if (!faceDetectionAvailable) {
        setFaceStatus("face_unavailable", "#64748b");
        setTakePhotoEnabled(true);
        resetFaceBoxTimer();
        clearFaceBox();
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

        const result = await faceapi
            .detectSingleFace(
                video,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.5 })
            )
            .withFaceLandmarks(true);

        faceDetected = !!result;

        if (faceDetected) {

            if (!faceWasDetected) {
                // A new face just appeared: it must blink again before a
                // photo can be taken, even if a previous face already did.
                resetLiveness();

                // Show the box, then auto-hide it after a few seconds so
                // the camera view stays clean.
                resetFaceBoxTimer();
                faceBoxVisible = true;
                faceBoxTimer = setTimeout(function () {
                    faceBoxVisible = false;
                    clearFaceBox();
                }, FACE_BOX_DISPLAY_MS);
            }

            const wasLivenessPassed = livenessPassed;
            updateLiveness(result.landmarks);

            if (livenessPassed) {
                setTakePhotoEnabled(true);

                if (!wasLivenessPassed) {
                    // Blink just verified: show a short success message,
                    // then hide the status text instead of leaving it on.
                    setFaceStatus("face_liveness_passed", "#16a34a");
                    if (livenessStatusTimer) clearTimeout(livenessStatusTimer);
                    livenessStatusTimer = setTimeout(function () {
                        const statusEl = document.getElementById("faceStatus");
                        if (statusEl) statusEl.textContent = "";
                        livenessStatusTimer = null;
                    }, 2000);
                }
            } else {
                setFaceStatus("face_liveness_wait", "#2563eb");
                setTakePhotoEnabled(false);
            }
        } else {
            setFaceStatus("face_not_detected", "#d97706");
            setTakePhotoEnabled(false);
            resetFaceBoxTimer();
            resetLiveness();
        }

        faceWasDetected = faceDetected;

        drawFaceBox(faceBoxVisible ? result : null);

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
    faceWasDetected = false;
    resetFaceBoxTimer();
    resetLiveness();
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

    // Anti-spoofing: block the capture until a real blink has been seen,
    // so a printed photo or a photo on another screen can't be used.
    if (faceDetectionAvailable && !livenessPassed) {

        const lang = typeof getLang === "function" ? getLang() : "en";
        const msg = typeof translations !== "undefined" && translations.toast_liveness_required
            ? translations.toast_liveness_required[lang]
            : "Please blink first to verify it's really you.";

        showToast(msg, "error");

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

    // Sembunyikan kamera live dan matikan kamera + deteksi wajah
    // sepenuhnya, supaya tidak terus berjalan di belakang layar
    // (itu yang membuat status/tombol kelihatan "bergerak" terus).
    // Kamera baru aktif lagi kalau user menekan "Buka Kamera".
    video.style.display = "none";
    stopCamera();

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
    faceWasDetected = false;
    faceDetectionRunning = false;
    resetFaceBoxTimer();
    resetLiveness();
    setTakePhotoEnabled(false);
    clearFaceBox();

    const faceStatusEl = document.getElementById("faceStatus");
    if (faceStatusEl) {
        faceStatusEl.textContent = "";
    }


    console.log(
        "KAMERA DIHENTIKAN"
    );

}
