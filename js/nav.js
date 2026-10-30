// The bottom menu, drawn in one place for every page (2026 redesign).
// Put  <nav class="bottom-nav" id="mainNav"></nav><script src="js/nav.js"></script>
// right where the menu goes: it fills the nav at once, so swipe.js and the rest see the links.
//   students:  Beranda · Jadwal · [Absen] · Uang · Saya
//   teachers:  Beranda · Kelas · [Absen] · Jadwal · Saya (their home is teacher.html)
//   admins:    Beranda · Absensi · [QR] · Keuangan · Kelola
(function () {
  function draw() {
    var nav = document.getElementById("mainNav") || document.querySelector(".bottom-nav:empty");
    if (!nav) return;
    var role = "";
    try { role = (JSON.parse(localStorage.getItem("attendreem-profile") || "{}")).role || ""; } catch (e) {}
    if (role === "orangtua") { nav.remove(); return; }   // parents have one page, no menu
    document.documentElement.classList.add("has-v3nav");
    var id = (typeof getLang === "function" ? getLang() : "id") === "id";
    var page = (location.pathname.split("/").pop() || "index.html").replace(/[?#].*$/, "") || "index.html";

    var I = {
        home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
        cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
        // Material Design "fingerprint" (Apache 2.0): a filled shape, thickened a little with a stroke
        fp: '<path fill="currentColor" stroke-width="{fpw}" d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12 3c-1.97 0-3.85.47-5.56 1.41-.24.13-.54.04-.68-.2a.506.506 0 0 1 .2-.68C7.82 2.5 9.86 2 12 2s4 .47 6.04 1.5c.25.15.34.45.21.69a.48.48 0 0 1-.44.28M3.5 9.72c-.1 0-.2-.03-.29-.09a.517.517 0 0 1-.12-.7c.99-1.4 2.25-2.5 3.75-3.27C10 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.85 3.75 3.25.16.22.1.54-.12.7-.23.16-.54.11-.7-.1a9.26 9.26 0 0 0-3.39-2.96c-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.95-.08.15-.23.22-.39.22m6.25 12.07c-.13 0-.25-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39a.5.5 0 0 1-.5.5.5.5 0 0 1-.5-.5c0-2.42-2.09-4.39-4.66-4.39s-4.66 1.97-4.66 4.39c0 1.44.32 2.77.93 3.84.64 1.16 1.08 1.65 1.85 2.43.19.2.19.51 0 .71-.12.1-.24.15-.37.15m7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39a.5.5 0 0 1 .5-.5.5.5 0 0 1 .5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.54.13.58.41.05.26-.13.53-.41.58-.57.11-1.07.12-1.21.12M14.91 22h-.13c-1.59-.46-2.63-1.05-3.72-2.12a7.28 7.28 0 0 1-2.17-5.22c0-1.62 1.38-2.94 3.08-2.94s3.08 1.32 3.08 2.94c0 1.07.95 1.94 2.08 1.94 1.15 0 2.08-.87 2.08-1.94 0-3.77-3.25-6.83-7.25-6.83-2.84 0-5.46 1.58-6.61 4.03-.39.81-.59 1.76-.59 2.8 0 .78.07 2.01.67 3.61.1.26-.03.55-.29.64a.504.504 0 0 1-.64-.29c-.5-1.31-.73-2.62-.73-3.96 0-1.2.23-2.29.68-3.24 1.33-2.79 4.28-4.6 7.51-4.6 4.54 0 8.25 3.51 8.25 7.83 0 1.62-1.38 2.94-3.08 2.94s-3.08-1.32-3.08-2.94c0-1.07-.93-1.94-2.08-1.94s-2.08.87-2.08 1.94c0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.84.27.08.42.36.35.62-.05.23-.26.38-.47.38"/>',
        money: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/>',
        me: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        check: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4"/>',
        qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2"/>',
        users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
        grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'
    };
    // [href, icon, id label, en label, i18n key, also-active pages, fab?]
    var items;
    if (role === "admin") {
        items = [
            ["index.html", "home", "Beranda", "Home", "nav_home"],
            ["admin-attendance.html", "check", "Absensi", "Attendance", ""],
            ["qr-send.html", "qr", "QR", "QR", "", [], true],
            ["admin-spp.html", "money", "Keuangan", "Money", "", ["admin-savings.html", "kas.html"]],
            ["admin-menu.html", "grid", "Kelola", "Manage", "", ["settings.html"]]
        ];
    } else if (role === "guru") {
        items = [
            ["teacher.html", "home", "Beranda", "Home", "nav_home", ["index.html", "teacher-leave.html"]],
            ["teacher-class.html", "users", "Kelas", "Classes", "", ["teacher-student.html"]],
            ["attendance.html", "fp", "Absen", "Check in", "nav_attendance", []],
            ["schedule.html", "cal", "Jadwal", "Schedule", "", ["calendar.html"]],
            ["settings.html", "me", "Saya", "Me", "nav_my"]
        ];
    } else {
        items = [
            ["index.html", "home", "Beranda", "Home", "nav_home"],
            ["schedule.html", "cal", "Jadwal", "Schedule", "", ["calendar.html"]],
            ["attendance.html", "fp", "Absen", "Check in", "nav_attendance", []],
            ["history.html", "money", "Uang", "Money", "", ["kas.html"]],
            ["my-attendance.html", "me", "Saya", "Me", "nav_my"]
        ];
    }
    nav.classList.add("v3-nav");
    nav.setAttribute("aria-label", id ? "Menu utama" : "Main menu");
    nav.style.setProperty("--n", items.length);
    nav.innerHTML = items.map(function (it) {
        var on = it[0] === page || (it[5] || []).indexOf(page) !== -1;
        var sz = it[6] ? 26 : it[1] === "fp" ? 38 : 24;   // the check-in fingerprint stands out a little
        var svg = '<svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="none" stroke="currentColor" stroke-width="' + (on || it[6] ? 2 : 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[it[1]].replace("{fpw}", on ? ".55" : ".3") + '</svg>';
        var label = id ? it[2] : it[3];
        if (it[6]) return '<a href="' + it[0] + '" class="v3-fab' + (on ? ' active' : '') + '" aria-label="' + label + '"' + (on ? ' aria-current="page"' : '') + '><span>' + svg + '</span></a>';
        return '<a href="' + it[0] + '" aria-label="' + label + '"' + (on ? ' class="active" aria-current="page"' : '') + '><span>' + svg + '</span><small>' + label + '</small></a>';
    }).join("");
    nav.dataset.role = role || "murid";
  }
  draw();
  // the profile (and so the role) may only arrive after login: redraw if the role changed
  window.addEventListener("attendreem-profile", function () {
    var nav = document.getElementById("mainNav"), r = "";
    try { r = (JSON.parse(localStorage.getItem("attendreem-profile") || "{}")).role || ""; } catch (e) {}
    if (nav && nav.dataset.role !== (r || "murid")) draw();
  });
  window.attNavDraw = draw;
})();
