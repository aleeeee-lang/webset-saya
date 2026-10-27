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
        fp: '<path d="M12 11v3"/><path d="M8.5 7.5a5 5 0 0 1 8.5 3.5v2"/><path d="M7 11v2a5 5 0 0 0 1 3"/><path d="M12 6a6.9 6.9 0 0 0-2 .3"/><path d="M15 18a5 5 0 0 0 1-3"/>',
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
            ["admin-spp.html", "money", "Keuangan", "Money", "", ["admin-savings.html"]],
            ["admin-menu.html", "grid", "Kelola", "Manage", "", ["settings.html"]]
        ];
    } else if (role === "guru") {
        items = [
            ["teacher.html", "home", "Beranda", "Home", "nav_home", ["index.html", "teacher-leave.html"]],
            ["teacher-class.html", "users", "Kelas", "Classes", "", ["teacher-student.html"]],
            ["attendance.html", "fp", "Absen", "Check in", "nav_attendance", [], true],
            ["schedule.html", "cal", "Jadwal", "Schedule", "", ["calendar.html"]],
            ["settings.html", "me", "Saya", "Me", "nav_my"]
        ];
    } else {
        items = [
            ["index.html", "home", "Beranda", "Home", "nav_home"],
            ["schedule.html", "cal", "Jadwal", "Schedule", "", ["calendar.html"]],
            ["attendance.html", "fp", "Absen", "Check in", "nav_attendance", [], true],
            ["history.html", "money", "Uang", "Money", "", ["kas.html"]],
            ["my-attendance.html", "me", "Saya", "Me", "nav_my", ["dashboard.html"]]
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
