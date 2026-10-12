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
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
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
        var html = '<div class="v2-side-brand"><img src="favicon.svg?v=2" alt="" width="38" height="38">Attendreem</div>' +
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
        var oldQ = document.getElementById("v2SearchInput");
        oldQ = oldQ ? oldQ.value : "";
        el.innerHTML = html;
        setupSearch(el, role, oldQ);
        el.querySelector(".v2-side-who b").textContent = name;
        el.querySelector(".v2-side-who small").textContent = sub;
    }


    /* ===== Sidebar search ===== */
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
        "admin-spp.html": "spp bayar pembayaran iuran",
        "admin-attendance.html": "absen rekap kehadiran",
        "admin-broadcast.html": "notifikasi pesan kirim pengumuman"
    };
    function norm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function hl(text, q) {
        var t = String(text || ""), i = norm(t).indexOf(norm(q));
        if (!q || i < 0) return esc(t);
        return esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length));
    }
    function featureList(role) {
        var out = [];
        (MENUS[role] || []).concat(EXTRA.all, EXTRA[role] || []).forEach(function (m) {
            if (!m || m.label) return;
            if (out.some(function (o) { return o[0] === m[0]; })) return;
            out.push(m);
        });
        return out;
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

    function setupSearch(side, role, initial) {
        var input = side.querySelector("#v2SearchInput");
        if (!input) return;
        var id = lang() === "id";
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
        function row(it, q) {
            return '<a class="v2-sr-item" href="' + esc(it.href) + '"><span class="v2-sr-ic ' + (it.tone || "") + '">' + (it.letter ? esc(it.letter) : ic(it.icon || "search")) + '</span>' +
                '<span class="v2-sr-txt"><b>' + hl(it.title, q) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' +
                (it.badge != null ? '<em class="v2-sr-badge ' + (it.badgeTone || "") + '">' + esc(it.badge) + '</em>' : '') + '</a>';
        }
        function draw(q, groups, loading) {
            var html = "";
            items = [];
            groups.forEach(function (g) {
                if (!g.items.length) return;
                html += '<div class="v2-sr-head">' + esc(g.title) + '</div>';
                g.items.forEach(function (it) { items.push(it); html += row(it, q); });
            });
            if (loading) html += '<div class="v2-sr-note"><span class="v2-sr-spin"></span>' + (id ? "Mencari…" : "Searching…") + '</div>';
            if (!items.length && !loading) html = '<div class="v2-sr-empty">' + ic("search", 2) + '<b>' + (id ? "Nggak ketemu" : "No results") + '</b><small>' + (id ? "Coba kata lain untuk “" : "Try another word for “") + esc(q) + '”</small></div>';
            html += '<div class="v2-sr-foot"><span><kbd>↑</kbd><kbd>↓</kbd> ' + (id ? "pilih" : "move") + '</span><span><kbd>Enter</kbd> ' + (id ? "buka" : "open") + '</span><span><kbd>Esc</kbd> ' + (id ? "tutup" : "close") + '</span></div>';
            panel.innerHTML = html;
            place();
            panel.classList.add("open");
            active = 0;
            setActive(0);
        }
        function features(q) {
            var n = norm(q).split(/\s+/).filter(Boolean);
            return featureList(role).filter(function (m) {
                var label = norm(m[2] + " " + m[3]);
                var words = norm((m[4] || "") + " " + (KEYS[m[0]] || "")).split(/\s+/);
                return n.every(function (w) {
                    return label.indexOf(w) >= 0 || words.some(function (k) { return k.indexOf(w) === 0; });
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
        function run() {
            var q = input.value.trim();
            side.classList.toggle("searching", !!q);
            if (!q) { close(); return; }
            var my = ++seq;
            var base = [{ title: id ? "Fitur" : "Features", items: features(q) }];
            var willFetch = likeSafe(q).length >= 2 && db();
            draw(q, base, !!willFetch);
            if (!willFetch) return;
            clearTimeout(timer);
            timer = setTimeout(function () {
                remote(q).then(function (gs) { if (my === seq) draw(q, base.concat(gs), false); });
            }, 220);
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
            var els = Array.prototype.indexOf.call(panel.querySelectorAll(".v2-sr-item"), a);
            if (els !== active) setActive(els);
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

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
    else render();
    window.addEventListener("attendreem-profile", render);
})();
