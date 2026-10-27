// Desktop sidebar (shown at >= 1024px via CSS). Phones keep the bottom nav.
(function () {
    var inFrame = window.self !== window.top;
    var page = (location.pathname.split("/").pop() || "index.html").replace(/\?.*$/, "");
    if (/^(login|reset-password)\.html$/.test(page)) return;

    var ICON = {
        home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
        cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
        bar: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
        wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/>',
        cash: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
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
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
        task: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 9l2 2 4-4M8 15h8"/>',
        book: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h6M8 11h6"/>',
        trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 21h7M9.5 17h5l.5 4h-6z"/>',
        checkin: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 15.5a3.5 3.5 0 0 1-.5-1.8V12a3.5 3.5 0 0 1 7 0v.6"/><path d="M12 12v1.5a5 5 0 0 1-1 3"/><path d="M15.5 15a6 6 0 0 1-.6 1.8"/>',
        qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3M21 14v.01M14 21h7v-4"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'
    };
    function ic(n, w) {
        return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>';
    }

    var MENUS = {
        murid: [
            ["index.html", "home", "Home", "Beranda"],
            ["attendance.html", "checkin", "Check in", "Absensi"],
            ["dashboard.html", "bar", "Dashboard", "Dasbor"],
            ["history.html", "wallet", "Savings", "Tabungan"],
            ["my-attendance.html", "user", "My Attendance", "Absensi Saya"],
            null,
            ["schedule.html", "book", "Lessons", "Jadwal pelajaran"],
            ["tasks.html", "task", "Tasks", "Tugas"],
            ["kas.html", "cash", "Class Cash", "Kas kelas"],
            ["juara.html", "trophy", "Champions", "Juara"],
            ["goals.html", "target", "Learning Goals", "Target belajar"],
            ["leave.html", "doc", "Leave Request", "Ajukan izin"],
            ["calendar.html", "cal", "Calendar", "Kalender"],
            ["information.html", "info", "Information", "Informasi"],
            ["piket.html", "broom", "Duty Roster", "Piket"]
        ],
        guru: [
            ["teacher.html", "home", "Teacher Dashboard", "Beranda guru"],
            ["attendance.html", "checkin", "Check in", "Absen saya"],
            ["qr-send.html", "qr", "Send check-in QR", "Kirim QR absen"],
            ["schedule.html", "book", "Teaching Schedule", "Jadwal mengajar"],
            ["tasks.html", "task", "Class Tasks", "Tugas kelas"],
            ["kas.html", "cash", "Class Cash", "Kas kelas"],
            ["juara.html", "trophy", "Champions", "Juara"],
            ["goals.html", "target", "My Goals", "Target saya"],
            ["calendar.html", "cal", "Calendar", "Kalender"],
            ["information.html", "info", "Information", "Informasi"]
        ],
        orangtua: [
            ["parent.html", "home", "Parent Portal", "Portal orang tua"],
            ["juara.html", "trophy", "Champions", "Juara"],
            ["schedule.html", "book", "Lessons", "Jadwal pelajaran"],
            ["calendar.html", "cal", "Calendar", "Kalender"],
            ["information.html", "info", "Information", "Informasi"]
        ],
        admin: [
            { label: ["General", "Menu umum"] },
            ["index.html", "home", "Home", "Beranda"],
            { label: ["Manage", "Kelola"] },
            ["settings.html", "grid", "Admin Panel", "Panel admin"],
            ["admin-students.html", "users", "Students", "Kelola siswa"],
            ["admin-teachers.html", "user", "Teachers", "Kelola guru"],
            ["admin-parents.html", "users", "Parents", "Akun orang tua"],
            ["admin-attendance.html", "checkin", "Attendance", "Kelola absensi"],
            ["qr-send.html", "qr", "Send check-in QR", "Kirim QR absen"],
            ["admin-schedule.html", "clock", "Schedule", "Jadwal absen"],
            ["admin-lessons.html", "book", "Lesson Schedule", "Jadwal pelajaran"],
            ["admin-spp.html", "wallet", "SPP", "Kelola SPP"],
            ["admin-savings.html", "wallet", "Manage Savings", "Kelola tabungan"],
            ["kas.html", "cash", "Class Cash", "Kas kelas"],
            ["juara.html", "trophy", "Champions", "Juara"],
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
        var html = '<div class="v2-side-brand"><img src="favicon.svg?v=4" alt="" width="38" height="38">Attendreem</div>' +
            '<div class="v2-side-search"><label>' + ic("search", 2.2) + '<input id="v2SearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="' + (id ? "Cari fitur" + (role === "admin" || role === "guru" ? ", siswa…" : ", nilai…") : "Search features" + (role === "admin" || role === "guru" ? ", students…" : ", scores…")) + '" aria-label="' + (id ? "Cari" : "Search") + '"><kbd>Ctrl K</kbd></label></div>' +
            '<nav class="v2-side-nav" aria-label="Menu">';
        MENUS[role].forEach(function (m) {
            if (!m) { html += '<div class="v2-side-sep"></div>'; return; }
            if (m.label) { html += '<div class="v2-side-label">' + (id ? m.label[1] : m.label[0]) + '</div>'; return; }
            var on = m[0] === page;
            html += '<a href="' + m[0] + '"' + (on ? ' class="on" aria-current="page"' : '') + '>' + ic(m[1]) + '<span>' + (id ? m[3] : m[2]) + '</span></a>';
        });
        html += '</nav>';
        var name = p.name || "";
        var sub = p.class || ({ guru: id ? "Guru" : "Teacher", orangtua: id ? "Orang tua" : "Parent", admin: "Admin", murid: "" })[role] || "";
        var av = p.avatar_url ? '<img src="' + safeURL(p.avatar_url) + '" alt="">' : escapeHTML(name.trim().charAt(0).toUpperCase() || "?");
        html += '<a href="settings.html" class="v2-side-user' + (page === "settings.html" && role !== "admin" ? " on" : "") + '"><span class="v2-side-av">' + av + '</span><span class="v2-side-who"><b></b><small></small></span>' + ic("menu", 2) + '</a>';
        var el = document.getElementById("v2Side");
        if (!el) {
            el = document.createElement("aside");
            el.id = "v2Side";
            el.className = "v2-side";
            document.body.insertBefore(el, document.body.firstChild);
            document.body.classList.add("has-side");
        }
        var oldQ = document.getElementById("v2SearchInput");
        oldQ = oldQ ? oldQ.value : "";
        el.innerHTML = html;
        setupSearch(el, role, oldQ);
        el.querySelector(".v2-side-who b").textContent = name;
        el.querySelector(".v2-side-who small").textContent = sub;
    }


    /* ===== Search (desktop sidebar + phone sheet) ===== */
    var EXTRA = {
        all: [
            ["settings.html", "gear", "Settings", "Pengaturan", "profile profil foto avatar theme tema dark gelap terang language bahasa akun account"],
            ["change-password.html", "gear", "Change password", "Ganti password", "kata sandi password sandi keamanan security"],
            ["about.html", "info", "About", "Tentang aplikasi", "tentang about versi"]
        ],
        murid: [["feedback.html", "msg", "Send suggestion", "Kirim saran", "saran kritik masukan feedback"]]
    };
    var KEYS = {
        "index.html": "beranda home utama",
        "attendance.html": "absen absensi hadir kamera foto wajah check in izin sakit",
        "dashboard.html": "statistik grafik dasbor ringkasan spp",
        "history.html": "tabungan uang saldo nabung savings money",
        "my-attendance.html": "nilai score grade rapor kalender rekap riwayat kegiatan aktivitas",
        "goals.html": "target tujuan goal belajar",
        "leave.html": "izin cuti sakit surat",
        "calendar.html": "kalender libur ujian event acara",
        "information.html": "info pengumuman berita",
        "piket.html": "piket jadwal kebersihan",
        "teacher.html": "guru kelas absen nilai input",
        "parent.html": "anak orang tua",
        "admin-students.html": "siswa murid tambah akun",
        "admin-development.html": "nilai score grade perkembangan kegiatan",
        "admin-schedule.html": "jadwal jam waktu absen",
        "tasks.html": "tugas pr deadline pekerjaan rumah assignment homework kumpul",
        "schedule.html": "jadwal pelajaran mapel mata ruangan ruang guru kelas timetable lesson",
        "admin-lessons.html": "jadwal pelajaran mapel mata ruangan ruang guru kelas timetable lesson",
        "admin-spp.html": "spp bayar pembayaran iuran",
        "admin-attendance.html": "absen rekap kehadiran",
        "admin-broadcast.html": "notifikasi pesan kirim pengumuman",
        "juara.html": "juara champion prestasi lomba peringkat ranking rajin kehadiran nilai terbaik trophy piala award",
        "kas.html": "kas uang kas iuran bendahara keuangan kelas pemasukan pengeluaran saldo cash treasurer"
    };
    var SHORTCUTS = {
        murid: [["attendance.html", "Absen", "Check in", "lime", "checkin"], ["schedule.html", "Jadwal", "Lessons", "", "book"], ["tasks.html", "Tugas", "Tasks", "amber", "task"], ["my-attendance.html#devTabs", "Nilai saya", "My scores", "cyan", "grad"], ["goals.html", "Target", "Goals", "amber", "target"], ["history.html", "Tabungan", "Savings", "", "wallet"], ["leave.html", "Ajukan izin", "Leave", "red", "doc"]],
        guru: [["attendance.html", "Absen saya", "My check-in", "lime", "checkin"], ["teacher.html", "Absen kelas", "Class check-in", "lime", "checkin"], ["schedule.html", "Jadwal mengajar", "Teaching", "", "book"], ["tasks.html", "Beri tugas", "Give a task", "amber", "task"], ["teacher.html#secGrade", "Input nilai", "Add score", "cyan", "grad"], ["goals.html", "Target", "Goals", "amber", "target"], ["calendar.html", "Kalender", "Calendar", "", "cal"]],
        orangtua: [["parent.html", "Portal anak", "Child portal", "lime", "home"], ["calendar.html", "Kalender", "Calendar", "", "cal"], ["information.html", "Informasi", "Information", "cyan", "info"]],
        admin: [["admin-students.html", "Kelola siswa", "Students", "lime", "users"], ["admin-lessons.html", "Jadwal pelajaran", "Lessons", "cyan", "book"], ["admin-schedule.html", "Jadwal absen", "Schedule", "", "clock"], ["admin-spp.html", "Kelola SPP", "SPP", "amber", "wallet"], ["admin-leave.html", "Persetujuan izin", "Leave", "red", "doc"], ["admin-broadcast.html", "Kirim notifikasi", "Notify", "cyan", "bell"]]
    };
    function norm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function hl(text, q) {
        var t = String(text || ""), i = norm(t).indexOf(norm(q));
        if (!q || i < 0) return esc(t);
        return esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length));
    }
    function db() { try { return typeof supabaseClient !== "undefined" ? supabaseClient : null; } catch (e) { return null; } }
    var uidCache = null;
    function myId() {
        if (uidCache) return Promise.resolve(uidCache);
        var c = db();
        if (!c) return Promise.resolve(null);
        return c.auth.getSession().then(function (r) { uidCache = r && r.data && r.data.session ? r.data.session.user.id : null; return uidCache; }).catch(function () { return null; });
    }
    function likeSafe(q) { return q.replace(/[%_,()\\]/g, " ").trim(); }
    function currentRole() { var p = profile(); return MENUS[p.role] ? p.role : guessRole(); }

    function engine(role) {
        var id = lang() === "id";
        function featureList() {
            var out = [];
            (MENUS[role] || []).concat(EXTRA.all, EXTRA[role] || []).forEach(function (m) {
                if (!m || m.label) return;
                if (out.some(function (o) { return o[0] === m[0]; })) return;
                out.push(m);
            });
            return out;
        }
        function features(q) {
            var n = norm(q).split(/\s+/).filter(Boolean);
            return featureList().filter(function (m) {
                var words = norm(m[2] + " " + m[3] + " " + (m[4] || "") + " " + (KEYS[m[0]] || "")).split(/\s+/);
                return n.every(function (w) {
                    return words.some(function (k) { return k.indexOf(w) === 0; });
                });
            }).slice(0, 6).map(function (m) {
                return { href: m[0], icon: m[1], title: id ? m[3] : m[2], sub: id ? "Fitur" : "Feature" };
            });
        }
        function gradeItem(g) {
            var sc = Number(g.score) || 0;
            return { href: "my-attendance.html#devTabs", letter: (g.subject || "?").trim().charAt(0).toUpperCase(), tone: "cyan", title: g.subject || "-", sub: g.period || (id ? "Nilai" : "Score"), badge: Number.isInteger(sc) ? sc : sc.toFixed(1), badgeTone: sc >= 85 ? "good" : sc >= 70 ? "ok" : "low" };
        }
        function remote(q) {
            var c = db(), safe = likeSafe(q), tasks = [];
            if (!c || safe.length < 2) return Promise.resolve([]);
            var nq = norm(q), wantsGrades = /^(nil|sco|gra|rap)/.test(nq);
            if (role === "admin" || role === "guru") {
                var pq = c.from("profiles").select("id,name,class,role").ilike("name", "%" + safe + "%").limit(6);
                if (role === "guru") { var cls = profile().class; pq = pq.eq("role", "murid"); if (cls) pq = pq.eq("class", cls); }
                else pq = pq.in("role", ["murid", "guru", "orangtua"]);
                tasks.push(pq.then(function (r) {
                    var lab = { murid: id ? "Siswa" : "Student", guru: id ? "Guru" : "Teacher", orangtua: id ? "Orang tua" : "Parent" };
                    return { title: id ? "Orang" : "People", items: (r.data || []).map(function (p) {
                        var href = role === "guru" ? "teacher.html?student=" + p.id : p.role === "murid" ? "admin-development.html?student=" + p.id : p.role === "guru" ? "admin-teachers.html" : "admin-parents.html";
                        return { href: href, letter: (p.name || "?").trim().charAt(0).toUpperCase(), tone: p.role === "murid" ? "lime" : p.role === "guru" ? "navy" : "amber", title: p.name, sub: [lab[p.role], p.class].filter(Boolean).join(" · ") };
                    }) };
                }));
            }
            if (role === "murid") {
                tasks.push(myId().then(function (uid) {
                    if (!uid) return { title: "", items: [] };
                    var gq = c.from("student_grades").select("subject,score,period,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(wantsGrades ? 6 : 5);
                    if (!wantsGrades) gq = gq.ilike("subject", "%" + safe + "%");
                    return gq.then(function (r) { return { title: id ? "Nilai kamu" : "Your scores", items: (r.data || []).map(gradeItem) }; });
                }));
            }
            if (role === "murid" || role === "guru") {
                tasks.push(myId().then(function (uid) {
                    if (!uid) return { title: "", items: [] };
                    return c.from("learning_goals").select("title,progress_percent,period").eq("user_id", uid).ilike("title", "%" + safe + "%").limit(4).then(function (r) {
                        return { title: id ? "Target belajar" : "Learning goals", items: (r.data || []).map(function (g) {
                            return { href: "goals.html", icon: "target", tone: "amber", title: g.title, sub: g.period || "", badge: g.progress_percent != null ? Math.round(g.progress_percent) + "%" : null };
                        }) };
                    });
                }));
            }
            return Promise.all(tasks.map(function (t) { return Promise.resolve(t).catch(function () { return { title: "", items: [] }; }); }));
        }
        return { features: features, remote: remote, id: id };
    }

    function rowHTML(it, q) {
        return '<a class="v2-sr-item" href="' + esc(it.href) + '" data-title="' + esc(it.title) + '"><span class="v2-sr-ic ' + (it.tone || "") + '">' + (it.letter ? esc(it.letter) : ic(it.icon || "search")) + '</span>' +
            '<span class="v2-sr-txt"><b>' + hl(it.title, q) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' +
            (it.badge != null ? '<em class="v2-sr-badge ' + (it.badgeTone || "") + '">' + esc(it.badge) + '</em>' : '') + '</a>';
    }
    function groupsHTML(q, groups, loading, id, wrap) {
        var html = "", items = [];
        groups.forEach(function (g) {
            if (!g.items.length) return;
            var rows = g.items.map(function (it) { items.push(it); return rowHTML(it, q); }).join("");
            html += '<div class="v2-sr-head">' + esc(g.title) + '</div>' + (wrap ? '<div class="v2-sr-group">' + rows + '</div>' : rows);
        });
        if (loading) html += '<div class="v2-sr-note"><span class="v2-sr-spin"></span>' + (id ? "Mencari…" : "Searching…") + '</div>';
        if (!items.length && !loading) html = '<div class="v2-sr-empty">' + ic("search", 2) + '<b>' + (id ? "Nggak ketemu" : "No results") + '</b><small>' + (id ? "Coba kata lain untuk “" : "Try another word for “") + esc(q) + '”</small></div>';
        return { html: html, items: items };
    }
    function runQuery(q, eng, onDraw) {
        var base = [{ title: eng.id ? "Fitur" : "Features", items: eng.features(q) }];
        var willFetch = likeSafe(q).length >= 2 && db();
        onDraw(base, !!willFetch);
        if (!willFetch) return null;
        return setTimeout(function () { eng.remote(q).then(function (gs) { onDraw(base.concat(gs), false, true); }); }, 220);
    }

    /* recent picks (per viewer, phone sheet) */
    function getRecent() { try { return JSON.parse(localStorage.getItem("attendreem-recent") || "[]").slice(0, 5); } catch (e) { return []; } }
    function addRecent(title, href) {
        if (!title || !href) return;
        try {
            var r = getRecent().filter(function (x) { return x.h !== href || x.t !== title; });
            r.unshift({ t: title, h: href });
            localStorage.setItem("attendreem-recent", JSON.stringify(r.slice(0, 5)));
        } catch (e) {}
    }

    function setupSearch(side, role, initial) {
        var input = side.querySelector("#v2SearchInput");
        if (!input) return;
        var eng = engine(role), id = eng.id;
        var panel = document.getElementById("v2SearchPanel");
        if (!panel) {
            panel = document.createElement("div");
            panel.id = "v2SearchPanel";
            panel.className = "v2-search-panel";
            panel.setAttribute("role", "listbox");
            document.body.appendChild(panel);
        }
        var timer = null, seq = 0, active = 0, items = [];
        function place() {
            var r = input.closest("label").getBoundingClientRect();
            panel.style.left = r.left + "px";
            panel.style.top = (r.bottom + 8) + "px";
        }
        function close() { panel.classList.remove("open"); }
        function setActive(i) {
            var els = panel.querySelectorAll(".v2-sr-item");
            if (!els.length) return;
            active = (i + els.length) % els.length;
            els.forEach(function (e, k) { e.classList.toggle("on", k === active); });
            els[active].scrollIntoView({ block: "nearest" });
        }
        function run() {
            var q = input.value.trim();
            side.classList.toggle("searching", !!q);
            clearTimeout(timer);
            if (!q) { close(); return; }
            var my = ++seq;
            timer = runQuery(q, eng, function (groups, loading) {
                if (my !== seq) return;
                var r = groupsHTML(q, groups, loading, id, false);
                items = r.items;
                panel.innerHTML = r.html + '<div class="v2-sr-foot"><span><kbd>↑</kbd><kbd>↓</kbd> ' + (id ? "pilih" : "move") + '</span><span><kbd>Enter</kbd> ' + (id ? "buka" : "open") + '</span><span><kbd>Esc</kbd> ' + (id ? "tutup" : "close") + '</span></div>';
                place();
                panel.classList.add("open");
                setActive(0);
            });
        }
        input.addEventListener("input", run);
        input.addEventListener("focus", function () { if (input.value.trim()) run(); });
        input.addEventListener("keydown", function (e) {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
            else if (e.key === "Enter") { var it = items[active]; if (it) { e.preventDefault(); location.href = it.href; } }
            else if (e.key === "Escape") { input.value = ""; side.classList.remove("searching"); close(); input.blur(); }
        });
        panel.onmousemove = function (e) {
            var a = e.target.closest(".v2-sr-item");
            if (!a) return;
            var k = Array.prototype.indexOf.call(panel.querySelectorAll(".v2-sr-item"), a);
            if (k !== active) setActive(k);
        };
        if (!window.__v2SearchBound) {
            window.__v2SearchBound = true;
            document.addEventListener("mousedown", function (e) {
                var p = document.getElementById("v2SearchPanel");
                if (p && !p.contains(e.target) && !e.target.closest(".v2-side-search")) p.classList.remove("open");
            });
            document.addEventListener("keydown", function (e) {
                if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
                    var i = document.getElementById("v2SearchInput");
                    if (i && i.offsetParent) { e.preventDefault(); i.focus(); i.select(); }
                }
            });
            window.addEventListener("resize", function () { var p = document.getElementById("v2SearchPanel"); if (p) p.classList.remove("open"); });
        }
        if (initial) { input.value = initial; }
    }

    /* ===== Phone: search button in the page header + full-screen sheet ===== */
    var SLOTS = [
        [".v2-hero-top .top-actions", "prepend", "dark"],
        [".v2-par-head", "beforeIcon", "light"],
        [".v2-my-who", "beforeLast", "dark"],
        [".v2-head-split", "append", "light"],
        ["main.v2-wrap > .v2-head", "append", "light"],
        ["main.attendance-page > .attendance-intro", "append", "light"]
    ];
    function mountMobileButton() {
        // 2026 layout: the page has its own search button(s) in the header
        var own = document.querySelectorAll("[data-v3-search]");
        if (own.length) {
            Array.prototype.forEach.call(own, function (b) { if (!b.__v3s) { b.__v3s = true; b.addEventListener("click", function (e) { e.preventDefault(); openSheet(); }); } });
            return;
        }
        if (document.querySelector(".v2-msearch")) return;
        if (!/^(index|teacher|parent)\.html$/.test(page)) return;   // phone: only on each role's home
        if (document.querySelector(".v2-teach-top")) {
            var f = document.createElement("button");
            f.type = "button";
            f.className = "v2-msearch v2-msearch-fab";
            f.setAttribute("aria-label", lang() === "id" ? "Cari" : "Search");
            f.innerHTML = ic("search", 2.4);
            f.addEventListener("click", openSheet);
            document.body.appendChild(f);
            return;
        }
        for (var i = 0; i < SLOTS.length; i++) {
            var host = document.querySelector(SLOTS[i][0]);
            if (!host) continue;
            var b = document.createElement("button");
            b.type = "button";
            b.className = "v2-msearch " + SLOTS[i][2];
            b.setAttribute("aria-label", lang() === "id" ? "Cari" : "Search");
            b.innerHTML = ic("search", 2.2);
            b.addEventListener("click", openSheet);
            if (SLOTS[i][1] === "prepend") host.insertBefore(b, host.firstChild);
            else if (SLOTS[i][1] === "beforeIcon") host.insertBefore(b, host.querySelector("a,button") || null);
            else if (SLOTS[i][1] === "beforeLast" && host.lastElementChild && host.lastElementChild.tagName === "A") host.insertBefore(b, host.lastElementChild);
            else host.appendChild(b);
            return;
        }
    }

    var sheet = null;
    function openSheet() {
        var role = currentRole(), eng = engine(role), id = eng.id;
        if (!sheet) {
            sheet = document.createElement("div");
            sheet.className = "v2-msheet";
            sheet.setAttribute("role", "dialog");
            sheet.setAttribute("aria-modal", "true");
            document.body.appendChild(sheet);
        }
        sheet.innerHTML = '<div class="v2-msheet-top"><label class="v2-msheet-in">' + ic("search", 2.2) +
            '<input type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="' + (id ? (role === "admin" || role === "guru" ? "Cari fitur, nama siswa…" : "Cari fitur, nilai, target…") : (role === "admin" || role === "guru" ? "Search features, students…" : "Search features, scores, goals…")) + '"></label>' +
            '<button type="button" class="v2-msheet-cancel">' + (id ? "Batal" : "Cancel") + '</button></div><div class="v2-msheet-body"></div>';
        var input = sheet.querySelector("input"), body = sheet.querySelector(".v2-msheet-body");
        var timer = null, seq = 0;
        function idle() {
            var sc = (SHORTCUTS[role] || []).map(function (s) {
                return '<a class="v2-mchip" href="' + s[0] + '" data-title="' + esc(id ? s[1] : s[2]) + '"><b class="' + s[3] + '">' + ic(s[4], 2) + '</b>' + esc(id ? s[1] : s[2]) + '</a>';
            }).join("");
            var rec = getRecent();
            var rh = rec.length ? '<div class="v2-sr-head">' + (id ? "Terakhir dibuka" : "Recently opened") + '</div><div class="v2-sr-group">' + rec.map(function (r) {
                return '<a class="v2-mrec" href="' + esc(r.h) + '" data-title="' + esc(r.t) + '">' + ic("clock", 2) + '<span>' + esc(r.t) + '</span></a>';
            }).join("") + '</div>' : "";
            // every menu that is not already in the bottom menu, as a grid
            var inNav = Array.prototype.map.call(document.querySelectorAll(".bottom-nav a[href]"), function (a) { return a.getAttribute("href"); });
            var all = (MENUS[role] || []).filter(function (m) { return m && m.length && inNav.indexOf(m[0]) === -1 && m[0] !== "dashboard.html"; });
            if (all.length) {
                var grid = all.map(function (m) {
                    return '<a class="v3-mtile" href="' + m[0] + '" data-title="' + esc(id ? m[3] : m[2]) + '">' + ic(m[1], 1.8) + '<span>' + esc(id ? m[3] : m[2]) + '</span></a>';
                }).join("");
                body.innerHTML = rh + '<div class="v2-sr-head">' + (id ? "Semua menu" : "All menus") + '</div><div class="v3-mgrid">' + grid + '</div>';
                return;
            }
            body.innerHTML = '<div class="v2-sr-head">' + (id ? "Pintasan" : "Shortcuts") + '</div><div class="v2-mchips">' + sc + '</div>' + rh;
        }
        function run() {
            var q = input.value.trim();
            clearTimeout(timer);
            if (!q) { seq++; idle(); return; }
            var my = ++seq;
            timer = runQuery(q, eng, function (groups, loading) {
                if (my !== seq) return;
                body.innerHTML = groupsHTML(q, groups, loading, id, true).html;
            });
        }
        input.addEventListener("input", run);
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { var a = body.querySelector(".v2-sr-item"); if (a) { e.preventDefault(); a.click(); } }
            else if (e.key === "Escape") closeSheet();
        });
        body.addEventListener("click", function (e) {
            var a = e.target.closest("a");
            if (a) addRecent(a.getAttribute("data-title"), a.getAttribute("href"));
        });
        sheet.querySelector(".v2-msheet-cancel").addEventListener("click", function () { closeSheet(); });
        idle();
        document.documentElement.classList.add("v2-msheet-lock");
        sheet.classList.add("open");
        try { history.pushState({ v2search: 1 }, ""); } catch (e) {}
        setTimeout(function () { input.focus(); }, 30);
    }
    function closeSheet(fromPop) {
        if (!sheet || !sheet.classList.contains("open")) return;
        sheet.classList.remove("open");
        document.documentElement.classList.remove("v2-msheet-lock");
        if (!fromPop) { try { if (history.state && history.state.v2search) history.back(); } catch (e) {} }
    }
    window.addEventListener("popstate", function () { closeSheet(true); });
    window.attOpenSearch = function () { openSheet(); };
    window.addEventListener("pageshow", function () { if (sheet) { sheet.classList.remove("open"); document.documentElement.classList.remove("v2-msheet-lock"); } });

    // gentle reminder for accounts that still use a short/weak password
    function mountWeakPw() {
        if (inFrame || !/^(index|teacher|parent)\.html$/.test(location.pathname.split("/").pop() || "index.html")) return;
        try { if (localStorage.getItem("attendreem-weakpw") !== "1" || sessionStorage.getItem("attendreem-weakpw-later")) return; } catch (e) { return; }
        if (document.querySelector(".att-weakpw")) return;
        var id = (localStorage.getItem("attendly-lang") || "en") === "id";
        var box = document.createElement("div");
        box.className = "att-weakpw";
        box.innerHTML = '<span class="att-weakpw-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>' +
            '<div class="att-weakpw-txt"><b>' + (id ? "Kata sandimu masih lemah" : "Your password is weak") + '</b><span>' +
            (id ? "Yuk ganti ke minimal 8 karakter dengan huruf dan angka biar akunmu lebih aman." : "Change it to at least 8 characters with letters and numbers to keep your account safe.") +
            '</span><div class="att-weakpw-act"><a href="change-password.html">' + (id ? "Ganti sekarang" : "Change now") + '</a><button type="button">' + (id ? "Nanti" : "Later") + '</button></div></div>';
        box.querySelector("button").addEventListener("click", function () {
            try { sessionStorage.setItem("attendreem-weakpw-later", "1"); } catch (e) {}
            box.remove();
        });
        var home = document.querySelector(".v2-home-main"), hero = document.querySelector(".v2-teach-hero, .v2-par-head");
        if (home) home.insertBefore(box, home.firstChild);
        else if (hero) hero.parentNode.insertBefore(box, hero.nextSibling);
    }
    function boot() { if (!inFrame) render(); mountMobileButton(); mountWeakPw(); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
    if (!inFrame) window.addEventListener("attendreem-profile", render);
})();
