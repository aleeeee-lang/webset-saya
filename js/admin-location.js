// Admin: where students may check in "Hadir" from (school_location, attendance_location.sql).
// The server measures the distance; this page only sets the point and the radius.
(function () {
    function L(id, en) { return (typeof getLang === "function" ? getLang() : "id") === "id" ? id : en; }
    function $(id) { return document.getElementById(id); }
    function num(v) { var n = parseFloat(String(v || "").trim().replace(",", ".")); return isFinite(n) ? n : null; }
    function toast(m, t) { if (window.showToast) showToast(m, t); }
    var row = null;

    function syncUI() {
        var on = $("locEnabled").checked;
        $("locBody").classList.toggle("off", !on);
        $("locRadiusVal").textContent = $("locRadius").value + " m";
        var lat = num($("locLat").value), lng = num($("locLng").value);
        var ok = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        var a = $("locMap");
        a.hidden = !ok;
        if (ok) { a.href = "https://www.google.com/maps?q=" + lat + "," + lng; a.textContent = L("Cek titiknya di Google Maps ↗", "Check the point on Google Maps ↗"); }
    }

    // pasting "-6.17, 106.82" (copied from Google Maps) into either box fills both
    function splitPaste(e) {
        var t = (e.clipboardData || window.clipboardData).getData("text") || "";
        var m = t.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (!m) return;
        e.preventDefault();
        $("locLat").value = m[1]; $("locLng").value = m[2];
        syncUI();
    }

    async function load() {
        var r = await supabaseClient.from("school_location").select("*").eq("id", "default").maybeSingle();
        if (r.error) return false;            // attendance_location.sql not run yet: keep the card hidden
        row = r.data || null;
        $("locEnabled").checked = !!(row && row.enabled);
        $("locLat").value = row && row.lat != null ? row.lat : "";
        $("locLng").value = row && row.lng != null ? row.lng : "";
        $("locRadius").value = row && row.radius_m ? Math.min(1000, Math.max(50, row.radius_m)) : 80;
        syncUI();
        return true;
    }

    async function save() {
        var on = $("locEnabled").checked;
        var lat = num($("locLat").value), lng = num($("locLng").value);
        if (on && (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
            toast(L("Isi titik sekolah dulu (latitude & longitude).", "Fill in the school's point first (latitude & longitude)."), "error");
            return;
        }
        var btn = $("locSaveBtn");
        btn.disabled = true;
        var s = await supabaseClient.auth.getSession();
        var uid = s && s.data && s.data.session ? s.data.session.user.id : null;
        var r = await supabaseClient.from("school_location").upsert({
            id: "default", enabled: on, lat: lat, lng: lng,
            radius_m: Number($("locRadius").value), updated_by: uid, updated_at: new Date().toISOString()
        }, { onConflict: "id" });
        btn.disabled = false;
        if (r.error) { toast(L("Gagal menyimpan: ", "Could not save: ") + r.error.message, "error"); return; }
        toast(on ? L("Lokasi absen aktif. Hadir hanya bisa dari area sekolah.", "Location check on. Hadir only works inside the school area.")
                 : L("Lokasi absen dimatikan.", "Location check turned off."), "success");
    }

    function useHere() {
        var btn = $("locHereBtn");
        if (!navigator.geolocation) { toast(L("HP ini tidak bisa membaca lokasi.", "This device can't read its location."), "error"); return; }
        btn.disabled = true;
        btn.textContent = L("Membaca lokasi…", "Reading location…");
        navigator.geolocation.getCurrentPosition(function (p) {
            btn.disabled = false; label();
            $("locLat").value = p.coords.latitude.toFixed(6);
            $("locLng").value = p.coords.longitude.toFixed(6);
            syncUI();
            toast(L("Titik diisi dari lokasimu sekarang (akurasi ±", "Point filled from where you are (accuracy ±") + Math.round(p.coords.accuracy) + " m)", "success");
        }, function (err) {
            btn.disabled = false; label();
            toast(err && err.code === 1 ? L("Izin lokasi ditolak. Nyalakan di pengaturan browser.", "Location permission denied. Allow it in the browser settings.")
                                        : L("Lokasi tidak terbaca. Coba di luar ruangan.", "Couldn't read the location. Try outdoors."), "error");
        }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    }

    function label() {
        $("locHereBtn").innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg><span>' +
            L("Pakai lokasi saya sekarang", "Use my current location") + '</span>';
    }

    window.AttLocAdmin = {
        init: async function () {
            $("locTitle").textContent = L("Lokasi absen", "Check-in location");
            $("locHint").textContent = L("Kalau aktif, absen Hadir hanya bisa dari area sekolah. Izin & Sakit tetap bisa dari mana saja.",
                                         "When on, Hadir can only be sent from the school area. Izin & Sakit still work from anywhere.");
            $("locLatLabel").textContent = "Latitude";
            $("locLngLabel").textContent = "Longitude";
            $("locRadiusLabel").textContent = L("Jarak maksimal dari titik sekolah", "Maximum distance from the school point");
            $("locSaveBtn").textContent = L("Simpan lokasi", "Save location");
            label();
            if (!(await load())) return;
            $("locCard").hidden = false;
            $("locEnabled").addEventListener("change", syncUI);
            $("locRadius").addEventListener("input", syncUI);
            $("locLat").addEventListener("input", syncUI);
            $("locLng").addEventListener("input", syncUI);
            $("locLat").addEventListener("paste", splitPaste);
            $("locLng").addEventListener("paste", splitPaste);
            $("locHereBtn").addEventListener("click", useHere);
            $("locSaveBtn").addEventListener("click", save);
        }
    };
})();
