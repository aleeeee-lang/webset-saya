// Profile photo menu right where the "+" badge is (home, my attendance, teacher home):
// pick from gallery / take a photo / delete, crop, upload - without going to Settings.
// Same storage + profile update as the settings page.
(function () {
    function L(id, en) { try { return (localStorage.getItem("attendly-lang") || "en") === "id" ? id : en; } catch (e) { return en; } }
    function T(k, id, en) { try { if (window.translations && translations[k]) return translations[k][getLang()]; } catch (e) {} return L(id, en); }
    function cached() { try { return JSON.parse(localStorage.getItem("attendreem-profile") || "{}"); } catch (e) { return {}; } }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

    var ICN = {
        img: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
        cam: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
        del: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'
    };
    var PERSON = '<svg viewBox="0 0 24 24" width="60%" height="60%" fill="#ffffff"><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/></svg>';

    // the cropper + bottom sheet live in avatarcrop.js; load it the first time it's needed
    var cropLoad = null;
    function needCrop() {
        if (window.openAvatarCropper && window.attSheet) return Promise.resolve();
        if (!cropLoad) cropLoad = new Promise(function (ok, bad) {
            var s = document.createElement("script");
            s.src = "js/avatarcrop.js?v=" + (window.attAppVer || Date.now());
            s.onload = ok; s.onerror = bad;
            document.head.appendChild(s);
        });
        return cropLoad;
    }

    function input(capture) {
        var i = document.createElement("input");
        i.type = "file";
        i.accept = capture ? "image/*" : "image/png,image/jpeg,image/webp";
        if (capture) i.setAttribute("capture", "user");
        i.style.display = "none";
        document.body.appendChild(i);
        return i;
    }

    async function uid() {
        var s = await supabaseClient.auth.getSession();
        return s && s.data && s.data.session ? s.data.session.user.id : null;
    }

    // update every "my photo" on this page + the cached profile (nav, sidebar etc. listen)
    function apply(url) {
        try {
            var p = cached(); p.avatar_url = url || null;
            localStorage.setItem("attendreem-profile", JSON.stringify(p));
        } catch (e) {}
        document.querySelectorAll(".v2-av-wrap .v2-avatar").forEach(function (a) {
            if (url) a.innerHTML = '<img src="' + esc(url) + '" alt="">';
            else a.textContent = ((cached().name || "?").trim().charAt(0) || "?").toUpperCase();
        });
        window.dispatchEvent(new Event("attendreem-profile"));
    }

    async function clearOld(id, keep) {
        try {
            var r = await supabaseClient.storage.from("avatars").list(id);
            var old = (r.data || []).map(function (f) { return id + "/" + f.name; }).filter(function (p) { return p !== keep; });
            if (old.length) await supabaseClient.storage.from("avatars").remove(old);
        } catch (e) {}
    }

    function busy(on) {
        document.querySelectorAll(".v2-av-wrap .v2-avatar").forEach(function (a) { a.classList.toggle("av-busy", on); });
    }

    async function upload(file) {
        var id = await uid();
        if (!file || !id) return;
        var blob = await openAvatarCropper(file);
        if (!blob) return;
        var ext = blob.type === "image/png" ? "png" : "jpg";
        var path = id + "/avatar-" + Date.now() + "." + ext;
        busy(true);
        var up = await supabaseClient.storage.from("avatars").upload(path, blob, { upsert: true, cacheControl: "3600", contentType: blob.type });
        if (up.error) { busy(false); showToast(T("toast_photo_upload_failed", "Gagal upload foto: ", "Photo upload failed: ") + up.error.message, "error"); return; }
        var url = supabaseClient.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        var r = await supabaseClient.from("profiles").update({ avatar_url: url }).eq("id", id);
        busy(false);
        if (r.error) { showToast(T("toast_save_failed", "Gagal menyimpan: ", "Save failed: ") + r.error.message, "error"); return; }
        clearOld(id, path);
        apply(url);
        showToast(T("toast_photo_updated", "Foto profil diperbarui", "Profile photo updated"), "success");
    }

    async function remove() {
        var id = await uid();
        if (!id) return;
        var ok = await attConfirm({
            title: T("confirm_delete_photo_title", "Hapus foto profil?", "Delete profile photo?"),
            text: T("confirm_delete_photo_text", "Foto akan diganti dengan inisial namamu.", "Your photo will be replaced by your initial."),
            ok: T("btn_delete", "Hapus", "Delete")
        });
        if (!ok) return;
        var r = await supabaseClient.from("profiles").update({ avatar_url: null }).eq("id", id);
        if (r.error) { showToast(T("toast_save_failed", "Gagal menyimpan: ", "Save failed: ") + r.error.message, "error"); return; }
        clearOld(id, null);
        apply(null);
        showToast(T("toast_photo_removed", "Foto profil dihapus", "Profile photo removed"), "success");
    }

    window.attPhotoMenu = async function () {
        try { await needCrop(); } catch (e) { location.href = "settings.html?photo=1"; return; }
        var url = cached().avatar_url;
        var prev = url
            ? '<img src="' + esc(url) + '" alt="" style="width:100%;height:100%;object-fit:cover">'
            : '<div style="width:100%;height:100%;background:#9aa5b1;display:flex;align-items:center;justify-content:center">' + PERSON + '</div>';
        var pick = await attSheet({
            title: T("photo_menu_title", "Foto profil", "Profile photo"), image: prev,
            items: [
                { label: T("photo_from_gallery", "Pilih dari galeri", "Choose from gallery"), value: "gallery", icon: ICN.img },
                { label: T("photo_take", "Ambil foto", "Take photo"), value: "camera", icon: ICN.cam },
                { label: T("btn_delete_photo", "Hapus foto saat ini", "Delete current photo"), value: "delete", icon: ICN.del, danger: true }
            ]
        });
        if (pick === "gallery" || pick === "camera") {
            var i = input(pick === "camera");
            i.addEventListener("change", function () { var f = i.files && i.files[0]; i.remove(); upload(f); });
            i.click();
        } else if (pick === "delete") {
            if (cached().avatar_url) remove();
            else showToast(L("Belum ada foto profil untuk dihapus.", "There's no profile photo to delete yet."), "error");
        }
    };

    document.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-att-photo]");
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        window.attPhotoMenu();
    }, true);
})();
