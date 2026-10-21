// Izin / Sakit: a photo of a letter as proof (attendance_proof.sql).
//   attProofBlob()   -> the picked photo (JPEG Blob, made smaller) or null
//   attProofReset()  -> clears it (after sending)
(function () {
    function L(id, en) { return (typeof getLang === "function" ? getLang() : "id") === "id" ? id : en; }
    function $(id) { return document.getElementById(id); }
    var blob = null, url = null;

    // phones make 4000px photos: shrink to at most 1600px so it uploads fast but stays readable
    function shrink(file) {
        return new Promise(function (resolve) {
            var img = new Image(), u = URL.createObjectURL(file);
            img.onload = function () {
                var max = 1280, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
                var c = document.createElement("canvas");
                c.width = Math.round(w * k); c.height = Math.round(h * k);
                c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(u);
                c.toBlob(function (b) { resolve(b); }, "image/jpeg", 0.75);
            };
            img.onerror = function () { URL.revokeObjectURL(u); resolve(null); };
            img.src = u;
        });
    }

    function paint() {
        var has = !!blob;
        $("proofEmpty").hidden = has;
        $("proofFull").hidden = !has;
        if (has) $("proofImg").src = url;
    }

    async function picked(input) {
        var f = input.files && input.files[0];
        input.value = "";
        if (!f) return;
        if (!/^image\//.test(f.type)) { if (window.showToast) showToast(L("Pilih file foto ya (JPG / PNG).", "Pick a photo (JPG / PNG)."), "error"); return; }
        var b = await shrink(f);
        if (!b) { if (window.showToast) showToast(L("Foto tidak bisa dibaca, coba foto lain.", "Couldn't read that photo, try another one."), "error"); return; }
        if (url) URL.revokeObjectURL(url);
        blob = b; url = URL.createObjectURL(b);
        paint();
    }

    window.attProofBlob = function () { return blob; };
    window.attProofReset = function () { if (url) URL.revokeObjectURL(url); blob = null; url = null; if ($("proofBox")) paint(); };
    // shown with the reason box (Izin / Sakit); the hint changes with the status
    window.attProofShow = function (status) {
        var box = $("proofBox");
        if (!box) return;
        box.hidden = !(status === "Izin" || status === "Sakit");
        $("proofHint").textContent = status === "Sakit"
            ? L("Contoh: surat dokter atau resep. Boleh dikosongkan.", "E.g. a doctor's note or prescription. Optional.")
            : L("Contoh: surat izin dari orang tua. Boleh dikosongkan.", "E.g. a letter from your parents. Optional.");
    };

    function init() {
        if (!$("proofBox")) return;
        $("proofTitle").textContent = L("Foto surat / bukti", "Photo of a letter / proof");
        $("proofCamTxt").textContent = L("Ambil foto", "Take photo");
        $("proofGalTxt").textContent = L("Dari galeri", "From gallery");
        $("proofChange").textContent = L("Ganti", "Change");
        $("proofRemove").setAttribute("aria-label", L("Hapus foto", "Remove photo"));
        $("proofCamIn").addEventListener("change", function () { picked(this); });
        $("proofGalIn").addEventListener("change", function () { picked(this); });
        $("proofCam").addEventListener("click", function () { $("proofCamIn").click(); });
        $("proofGal").addEventListener("click", function () { $("proofGalIn").click(); });
        $("proofChange").addEventListener("click", function () { $("proofCamIn").click(); });
        $("proofRemove").addEventListener("click", function () { window.attProofReset(); });
        $("proofImg").addEventListener("click", function () { if (url) window.open(url, "_blank"); });
        paint();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
