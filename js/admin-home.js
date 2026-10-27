// Beranda admin (admin_home.sql): today's picture of the school instead of the student's own
// check-in. index.html calls AdminHome.start(user, profile) when the person is an admin.
(function () {
    function L(id, en) { return (typeof getLang === "function" ? getLang() : "id") === "id" ? id : en; }
    function esc(s) { return typeof escapeHTML === "function" ? escapeHTML(s) : String(s == null ? "" : s); }
    function n(x) { return Number(x || 0); }
    function fmt(x) { return n(x).toLocaleString(L("id-ID", "en-US")); }
    var IC = {
        check: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 15.5a3.5 3.5 0 0 1-.5-1.8V12a3.5 3.5 0 0 1 7 0v.6"/><path d="M12 12v1.5a5 5 0 0 1-1 3"/>',
        leave: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
        spp: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/>',
        msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3M21 14v.01M14 21h7v-4"/>',
        bell: '<path d="M18 10a6 6 0 0 0-12 0v4l-1.5 3h15L18 14z"/><path d="M10 20h4"/>',
        clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 1.8"/>',
        db: '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/><path d="M5 11.5v6c0 1.4 3.1 2.5 7 2.5"/><path d="M17 15v6M14.5 18.5 17 21l2.5-2.5"/>',
        users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c.6-3.4 2.6-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.9c1.5.7 2.3 2.4 2.6 5.1"/>',
        go: '<path d="M9 6l6 6-6 6"/>',
        ok: '<path d="M20 6 9 17l-5-5"/>'
    };
    function ic(k, s) { return '<svg viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>'; }

    function seg(s) {
        var t = n(s.total) || 1, parts = [["hadir", n(s.hadir)], ["izin", n(s.izin) + n(s.izin_sakit)], ["sakit", n(s.sakit)], ["alpa", n(s.alpa)], ["belum", n(s.belum)]];
        return '<div class="ah-bar">' + parts.filter(function (p) { return p[1] > 0; }).map(function (p) {
            return '<i class="' + p[0] + '" style="width:' + (p[1] / t * 100).toFixed(2) + '%"></i>';
        }).join("") + '</div>';
    }

    // the top of the page: how many students and teachers are in today
    function hero(d) {
        var s = d.students || {}, t = d.teachers || {};
        var pct = n(s.total) ? Math.round(n(s.hadir) / n(s.total) * 100) : 0;
        var title = document.getElementById("homeTitle");
        title.removeAttribute("aria-busy");
        title.textContent = d.school_day ? L("Kehadiran hari ini", "Attendance today") : L("Hari ini tidak ada absen", "No check-in today");
        var box = document.getElementById("ahHero");
        box.innerHTML =
            '<div class="ah-num"><b>' + fmt(s.hadir) + '</b><span>/ ' + fmt(s.total) + ' ' + esc(L("siswa hadir", "students in")) + '</span><em>' + pct + '%</em></div>' +
            seg(s) +
            '<div class="ah-legend">' +
                '<span><i class="hadir"></i>' + esc(L("Hadir", "Present")) + ' ' + fmt(s.hadir) + '</span>' +
                '<span><i class="izin"></i>Izin ' + fmt(s.izin) + '</span>' +
                '<span><i class="sakit"></i>Sakit ' + fmt(s.sakit) + '</span>' +
                '<span><i class="alpa"></i>Alpa ' + fmt(s.alpa) + '</span>' +
                '<span><i class="belum"></i>' + esc(L("Belum", "Not yet")) + ' ' + fmt(s.belum) + '</span>' +
            '</div>' +
            (n(t.total) ? '<div class="ah-teach">' + ic("users", 16) + '<span>' + esc(L("Guru", "Teachers")) + ' <b>' + fmt(t.hadir) + ' / ' + fmt(t.total) + '</b> ' + esc(L("hadir", "in")) +
                (n(t.belum) ? ' · ' + fmt(t.belum) + ' ' + esc(L("belum absen", "not yet")) : '') + '</span></div>' : '');
        box.hidden = false;
        var cta = document.getElementById("homeCta");
        cta.href = "admin-attendance.html";
        cta.classList.remove("is-loading");
        var lab = document.getElementById("homeCtaLabel");
        lab.removeAttribute("data-i18n");
        lab.textContent = L("Kelola absensi", "Manage attendance");
    }

    function todo(p) {
        var items = [
            ["admin-leave.html", "leave", L("Izin menunggu", "Leave to approve"), n(p.leave)],
            ["admin-spp.html", "spp", L("Bukti SPP", "SPP proofs"), n(p.spp)],
            ["admin-feedback.html", "msg", L("Saran baru", "New suggestions"), n(p.feedback)]
        ];
        var all0 = items.every(function (x) { return !x[3]; });
        return '<section class="ah-card"><div class="ah-head"><h2>' + esc(L("Perlu tindakan", "To do")) + '</h2>' +
            (all0 ? '<span class="ah-done">' + ic("ok", 14) + esc(L("Semua beres", "All clear")) + '</span>' : '') + '</div>' +
            '<div class="ah-todo">' + items.map(function (x) {
                return '<a href="' + x[0] + '" class="' + (x[3] ? "has" : "") + '"><span class="ah-todo-ic">' + ic(x[1]) + '</span><b>' + fmt(x[3]) + '</b><small>' + esc(x[2]) + '</small></a>';
            }).join("") + '</div></section>';
    }

    var showAllClasses = false;
    function classes(list) {
        if (!list.length) return "";
        var rows = showAllClasses ? list : list.slice(0, 6);
        return '<section class="ah-card" id="ahClasses"><div class="ah-head"><h2>' + esc(L("Kehadiran per kelas", "Attendance by class")) + '</h2><small>' + esc(L("terendah di atas", "lowest first")) + '</small></div>' +
            rows.map(function (c) {
                var pct = n(c.total) ? Math.round(n(c.hadir) / n(c.total) * 100) : 0;
                var tone = !c.open_today ? "off" : pct >= 90 ? "good" : pct >= 75 ? "ok" : "low";
                return '<div class="ah-row"><span class="ah-cls">' + esc(c["class"]) + '</span>' +
                    '<div class="ah-row-mid"><div class="ah-mini ' + tone + '"><i style="width:' + pct + '%"></i></div>' +
                    '<small>' + (c.open_today ? fmt(c.hadir) + '/' + fmt(c.total) + ' ' + esc(L("hadir", "in")) + (n(c.belum) ? ' · ' + fmt(c.belum) + ' ' + esc(L("belum", "not yet")) : '') : esc(L("libur hari ini", "no check-in today"))) + '</small></div>' +
                    '<b class="ah-pct ' + tone + '">' + (c.open_today ? pct + '%' : '–') + '</b></div>';
            }).join("") +
            (list.length > 6 ? '<button type="button" class="ah-more" id="ahMoreClasses">' + esc(showAllClasses ? L("Tampilkan lebih sedikit", "Show less") : L("Lihat semua kelas", "See all classes") + " (" + list.length + ")") + '</button>' : '') +
            '</section>';
    }

    function watch(d) {
        var w = d.watch || [];
        if (!w.length) return "";
        var more = n(d.watch_total) - w.length;
        return '<section class="ah-card"><div class="ah-head"><h2>' + esc(L("Perlu perhatian", "Needs attention")) + '</h2><small>' + esc(L("tidak hadir ≥ 3 hari bulan ini", "absent 3+ days this month")) + '</small></div>' +
            w.map(function (x) {
                return '<a class="ah-watch" href="admin-development.html?student=' + encodeURIComponent(x.id) + '"><span class="ah-av">' + esc(String(x.name || "?").trim().charAt(0).toUpperCase()) + '</span>' +
                    '<span class="ah-watch-t"><b>' + esc(x.name) + '</b><small>' + esc(x["class"] || "") + '</small></span>' +
                    '<span class="ah-watch-n">' + fmt(x.n) + ' ' + esc(L("hari", "days")) + '</span>' + ic("go", 16) + '</a>';
            }).join("") +
            (more > 0 ? '<p class="ah-note">' + esc(L("+" + more + " siswa lainnya", "+" + more + " more")) + '</p>' : '') +
            '</section>';
    }

    function quick() {
        var q = [["qr-send.html", "qr", L("Kirim QR absen", "Send check-in QR")], ["admin-broadcast.html", "bell", L("Kirim pengumuman", "Send announcement")],
                 ["admin-schedule.html", "clock", L("Jadwal absen", "Check-in hours")], ["settings.html", "db", L("Backup data", "Back up data")]];
        return '<section class="ah-quick-wrap"><div class="v2-section-head"><h2>' + esc(L("Aksi cepat", "Quick actions")) + '</h2></div><div class="v2-more ah-quick">' +
            q.map(function (x) { return '<a href="' + x[0] + '">' + ic(x[1]) + '<span>' + esc(x[2]) + '</span></a>'; }).join("") + '</div></section>';
    }

    var last = null, mounted = false;
    function render(d) {
        last = d;
        hero(d);
        var box = document.getElementById("ahMain");
        if (!mounted) {
            box.innerHTML = '<div id="ahTodo"></div><section id="liveSessions" hidden></section><div id="ahClassWrap"></div><div id="ahWatch"></div><div id="ahQuick">' + quick() + '</div>';
            if (window.LiveSessions) LiveSessions.mount(document.getElementById("liveSessions"));
            mounted = true;
        }
        document.getElementById("ahTodo").innerHTML = todo(d.pending || {});
        document.getElementById("ahClassWrap").innerHTML = classes(d.classes || []);
        document.getElementById("ahWatch").innerHTML = watch(d);
        box.hidden = false;
        var mb = document.getElementById("ahMoreClasses");
        if (mb) mb.addEventListener("click", function () { showAllClasses = !showAllClasses; render(last); });
    }

    // the student-only parts of the home page go away; the bottom bar points to admin pages
    function layout() {
        document.documentElement.classList.add("is-admin-home");
        var home = document.querySelector(".v2-home");
        if (home) home.classList.add("is-admin");
        ["homeChips"].forEach(function (id) { var e = document.getElementById(id); if (e) e.innerHTML = ""; });
        var title = document.getElementById("homeTitle");
        if (title && !title.textContent) { title.textContent = L("Kehadiran hari ini", "Attendance today"); }
        var hero = document.querySelector(".v2-hero");
        if (hero && !document.getElementById("ahHero")) {
            var h = document.createElement("div"); h.id = "ahHero"; h.className = "ah-hero"; h.hidden = true;
            hero.insertBefore(h, document.getElementById("homeCta"));
        }
        var main = document.querySelector(".v2-home-main");
        if (main && !document.getElementById("ahMain")) {
            var m = document.createElement("div"); m.id = "ahMain"; m.className = "ah"; m.hidden = true;
            main.insertBefore(m, main.firstChild);
        }
        // the bottom menu for admins is drawn by js/nav.js
        if (window.attNavDraw) window.attNavDraw();
    }

    async function start(user, profile) {
        layout();
        var r;
        try { r = await supabaseClient.rpc("admin_overview"); } catch (e) { r = { error: e }; }
        if (r.error || !r.data) {
            var title = document.getElementById("homeTitle");
            title.removeAttribute("aria-busy");
            title.textContent = L("Beranda admin", "Admin home");
            var box = document.getElementById("ahHero");
            box.innerHTML = '<p class="ah-setup">' + esc(L("Jalankan admin_home.sql di Supabase untuk menampilkan ringkasan sekolah.", "Run admin_home.sql in Supabase to show the school summary.")) + '</p>';
            box.hidden = false;
            var cta = document.getElementById("homeCta"); cta.href = "admin-attendance.html"; cta.classList.remove("is-loading");
            var lab = document.getElementById("homeCtaLabel"); lab.removeAttribute("data-i18n"); lab.textContent = L("Kelola absensi", "Manage attendance");
            document.getElementById("ahMain").innerHTML = quick(); document.getElementById("ahMain").hidden = false; mounted = true;
            return;
        }
        render(r.data);
    }

    // refresh when coming back to the page
    window.addEventListener("tabshow", function () {
        if (!document.documentElement.classList.contains("is-admin-home")) return;
        supabaseClient.rpc("admin_overview").then(function (r) { if (!r.error && r.data) render(r.data); });
    });

    window.AdminHome = { start: start, layout: layout };
})();
