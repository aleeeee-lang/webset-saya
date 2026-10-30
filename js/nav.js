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
        fp: '<g transform="translate(12 12) scale(1.08) translate(-12 -12)"><path vector-effect="non-scaling-stroke" d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path vector-effect="non-scaling-stroke" d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path vector-effect="non-scaling-stroke" d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path vector-effect="non-scaling-stroke" d="M2 12a10 10 0 0 1 18-6"/><path vector-effect="non-scaling-stroke" d="M2 16h.01"/><path vector-effect="non-scaling-stroke" d="M21.8 16c.2-2 .131-5.354 0-6"/><path vector-effect="non-scaling-stroke" d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path vector-effect="non-scaling-stroke" d="M8.65 22c.21-.66.45-1.32.57-2"/><path vector-effect="non-scaling-stroke" d="M9 6.8a6 6 0 0 1 9 5.2v2"/></g>',
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
        var svg = '<svg viewBox="0 0 24 24" width="' + (it[6] ? 26 : 24) + '" height="' + (it[6] ? 26 : 24) + '" fill="none" stroke="currentColor" stroke-width="' + (on || it[6] ? 2 : 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[it[1]] + '</svg>';
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
