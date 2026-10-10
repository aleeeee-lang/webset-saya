// Desktop sidebar (shown at >= 1024px via CSS). Phones keep the bottom nav.
(function () {
    if (window.self !== window.top) return;
    var page = (location.pathname.split("/").pop() || "index.html").replace(/\?.*$/, "");
    if (/^(login|reset-password)\.html$/.test(page)) return;

    var ICON = {
        home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
        cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
        bar: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
        wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
        users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5 6.5-5s5.7 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.6 5"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
        cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
        broom: '<path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M10 20v-5h4v5"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
        msg: '<path d="M4 5h16v11H8l-4 4z"/>',
        log: '<path d="M12 8v5l3 2"/><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 4v4.5H8"/>',
        grad: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        check: '<path d="M5 13l4 4L19 7"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'
    };
    function ic(n, w) {
        return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>';
    }

    var MENUS = {
        murid: [
            ["index.html", "home", "Home", "Beranda"],
            ["attendance.html", "cam", "Check in", "Absensi"],
            ["dashboard.html", "bar", "Dashboard", "Dasbor"],
            ["history.html", "wallet", "Savings", "Tabungan"],
            ["my-attendance.html", "user", "My Attendance", "Absensi Saya"],
            null,
            ["goals.html", "target", "Learning Goals", "Target belajar"],
            ["leave.html", "doc", "Leave Request", "Ajukan izin"],
            ["calendar.html", "cal", "Calendar", "Kalender"],
            ["information.html", "info", "Information", "Informasi"],
            ["piket.html", "broom", "Duty Roster", "Piket"]
        ],
        guru: [
            ["teacher.html", "home", "Teacher Dashboard", "Beranda guru"],
            ["goals.html", "target", "My Goals", "Target saya"],
            ["calendar.html", "cal", "Calendar", "Kalender"],
            ["information.html", "info", "Information", "Informasi"]
        ],
        orangtua: [
            ["parent.html", "home", "Parent Portal", "Portal orang tua"],
            ["calendar.html", "cal", "Calendar", "Kalender"],
            ["information.html", "info", "Information", "Informasi"]
        ],
        admin: [
            { label: ["General", "Menu umum"] },
            ["index.html", "home", "Home", "Beranda"],
            ["attendance.html", "cam", "Check in", "Absensi"],
            ["dashboard.html", "bar", "Dashboard", "Dasbor"],
            ["history.html", "wallet", "Savings", "Tabungan"],
            ["my-attendance.html", "user", "My Attendance", "Absensi Saya"],
            { label: ["Manage", "Kelola"] },
            ["settings.html", "grid", "Admin Panel", "Panel admin"],
            ["admin-students.html", "users", "Students", "Kelola siswa"],
            ["admin-teachers.html", "user", "Teachers", "Kelola guru"],
            ["admin-parents.html", "users", "Parents", "Akun orang tua"],
            ["admin-attendance.html", "cam", "Attendance", "Kelola absensi"],
            ["admin-schedule.html", "clock", "Schedule", "Jadwal absen"],
            ["admin-spp.html", "wallet", "SPP", "Kelola SPP"],
            ["admin-savings.html", "wallet", "Manage Savings", "Kelola tabungan"],
            ["admin-leave.html", "doc", "Leave Requests", "Persetujuan izin"],
            ["admin-development.html", "grad", "Development", "Perkembangan siswa"],
            null,
            ["admin-broadcast.html", "bell", "Send Notification", "Kirim notifikasi"],
            ["admin-information.html", "info", "Information", "Kelola informasi"],
            ["admin-piket.html", "broom", "Duty Roster", "Atur piket"],
            ["admin-feedback.html", "msg", "Suggestions", "Saran siswa"],
            ["admin-audit-log.html", "log", "Audit Log", "Log audit"]
        ]
    };

    function lang() { try { return localStorage.getItem("attendly-lang") || "en"; } catch (e) { return "en"; } }
    function profile() { try { return JSON.parse(localStorage.getItem("attendreem-profile") || "{}"); } catch (e) { return {}; } }
    function guessRole() {
        if (page === "teacher.html") return "guru";
        if (page === "parent.html") return "orangtua";
        if (/^admin-/.test(page)) return "admin";
        return "murid";
    }

    function render() {
        var p = profile();
        var role = MENUS[p.role] ? p.role : guessRole();
        var id = lang() === "id";
        var html = '<div class="v2-side-brand"><img src="favicon.svg?v=2" alt="" width="38" height="38">Attendreem</div><nav class="v2-side-nav" aria-label="Menu">';
        MENUS[role].forEach(function (m) {
            if (!m) { html += '<div class="v2-side-sep"></div>'; return; }
            if (m.label) { html += '<div class="v2-side-label">' + (id ? m.label[1] : m.label[0]) + '</div>'; return; }
            var on = m[0] === page;
            html += '<a href="' + m[0] + '"' + (on ? ' class="on" aria-current="page"' : '') + '>' + ic(m[1]) + '<span>' + (id ? m[3] : m[2]) + '</span></a>';
        });
        html += '</nav>';
        var name = p.name || "";
        var sub = p.class || ({ guru: id ? "Guru" : "Teacher", orangtua: id ? "Orang tua" : "Parent", admin: "Admin", murid: "" })[role] || "";
        var av = p.avatar_url ? '<img src="' + p.avatar_url + '" alt="">' : (name.trim().charAt(0).toUpperCase() || "?");
        html += '<a href="settings.html" class="v2-side-user' + (page === "settings.html" && role !== "admin" ? " on" : "") + '"><span class="v2-side-av">' + av + '</span><span class="v2-side-who"><b></b><small></small></span>' + ic("menu", 2) + '</a>';
        var el = document.getElementById("v2Side");
        if (!el) {
            el = document.createElement("aside");
            el.id = "v2Side";
            el.className = "v2-side";
            document.body.insertBefore(el, document.body.firstChild);
            document.body.classList.add("has-side");
        }
        el.innerHTML = html;
        el.querySelector(".v2-side-who b").textContent = name;
        el.querySelector(".v2-side-who small").textContent = sub;
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
    else render();
    window.addEventListener("attendreem-profile", render);
})();
