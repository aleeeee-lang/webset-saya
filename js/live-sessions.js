// Live session recap for admins and teachers (live_sessions.sql).
//   LiveSessions.mount(el)  -> fills el (hidden for students / before the SQL is run)
// Asks the server every 10 s (and right away when a check-in comes in), so the numbers
// follow the classroom in real time.
(function () {
    function L(id, en) { return (typeof getLang === "function" ? getLang() : "id") === "id" ? id : en; }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    var POLL = 10000;

    function ring(pct) {
        var r = 26, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
        return '<svg class="ls-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="' + r + '" class="tr"/>' +
            '<circle cx="32" cy="32" r="' + r + '" class="fl" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg>';
    }
    function chip(cls, n, label) { return n ? '<span class="ls-chip ' + cls + '"><b>' + n + '</b> ' + esc(label) + '</span>' : ""; }

    function sessionCard(s, open) {
        var pct = s.total ? Math.round(s.hadir / s.total * 100) : 0;
        var last = (s.present || []).slice(0, 3).map(function (p) { return esc(p.name) + " " + esc(p.time || ""); }).join(" · ");
        var missing = s.missing || [];
        return '<article class="ls-s" data-key="' + esc(s.class + "|" + s.start) + '">' +
            '<div class="ls-s-top"><span class="ls-class">' + esc(s.class) + '</span><div class="ls-s-title"><b>' + esc(s.subject || "-") + '</b><small>' +
            esc(s.start + "–" + s.end) + (s.room ? " · " + esc(s.room) : "") + (s.teacher ? " · " + esc(s.teacher) : "") + '</small></div></div>' +
            '<div class="ls-time"><i style="width:' + Math.max(0, Math.min(100, s.progress || 0)) + '%"></i></div>' +
            '<div class="ls-s-main"><div class="ls-ring-wrap">' + ring(pct) + '<span>' + pct + '%</span></div>' +
            '<div class="ls-num"><b class="ls-hadir">' + s.hadir + '</b><span> / ' + s.total + '</span><small>' + esc(L("siswa hadir", "students present")) + '</small></div></div>' +
            '<div class="ls-chips">' + chip("telat", s.telat, L("telat", "late")) + chip("izin", s.izin, "Izin") + chip("sakit", s.sakit, "Sakit") +
            chip("alpa", s.alpa, "Alpa") + chip("belum", s.belum, L("belum absen", "not yet")) + '</div>' +
            (last ? '<p class="ls-last"><span>' + esc(L("Baru absen", "Just checked in")) + ':</span> ' + last + '</p>' : "") +
            (missing.length ? '<button type="button" class="ls-more" aria-expanded="' + (open ? "true" : "false") + '">' +
                esc(L("Belum absen", "Not checked in")) + " (" + missing.length + ")" +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>' +
                '<div class="ls-missing"' + (open ? "" : " hidden") + '>' + missing.map(function (n) { return "<span>" + esc(n) + "</span>"; }).join("") + "</div>" : "") +
            "</article>";
    }

    function classRow(c) {
        var pct = c.total ? Math.round(c.hadir / c.total * 100) : 0;
        return '<div class="ls-row"><span class="ls-class">' + esc(c.class) + '</span><div class="ls-bar"><i style="width:' + pct + '%"></i></div>' +
            '<b>' + c.hadir + "/" + c.total + "</b></div>";
    }

    var curStudent = false;
    function mount(el) {
        if (!el || typeof supabaseClient === "undefined") return;
        // parents have no class to follow
        try { var pr = JSON.parse(localStorage.getItem("attendreem-profile") || "{}"); if (pr.role === "orangtua") { el.hidden = true; return; } } catch (e) {}
        var open = {}, last = null, timer = 0, wake = 0, busy = false, prevHadir = {}, active = false;
        el.classList.add("ls-card");
        el.hidden = true;
        el.addEventListener("click", function (e) {
            var b = e.target.closest(".ls-more");
            if (!b) return;
            var card = b.closest(".ls-s"), key = card.getAttribute("data-key");
            open[key] = !open[key];
            b.setAttribute("aria-expanded", open[key] ? "true" : "false");
            card.querySelector(".ls-missing").hidden = !open[key];
        });

        async function load() {
            if (busy || document.visibilityState === "hidden") return;
            busy = true;
            var r;
            try { r = await supabaseClient.rpc("live_sessions"); } catch (e) { r = { error: e }; }
            busy = false;
            if (r.error || !r.data) { if (!last) el.hidden = true; return; }   // students, or the SQL isn't run yet
            last = r.data;
            render(r.data);
            // only keep checking while a lesson is going on; otherwise sleep until the next one
            active = !!(r.data.sessions && r.data.sessions.length);
            clearInterval(timer); clearTimeout(wake); timer = 0; wake = 0;
            if (active) timer = setInterval(load, POLL);
            else if (r.data.next_in > 0) wake = setTimeout(load, (r.data.next_in + 2) * 1000);
        }

        function render(d) {
            var ses = d.sessions || [], cls = d.classes || [];
            curStudent = !!d.student;
            var t = (d.now || "").slice(11, 19).replace(/:/g, ".");
            var body = ses.length
                ? '<div class="ls-list">' + ses.map(function (s) { return sessionCard(s, open[s.class + "|" + s.start]); }).join("") + "</div>"
                : '<p class="ls-empty">' + esc(curStudent ? L("Tidak ada pelajaran yang sedang berlangsung. Kehadiran kelasmu hari ini:", "No lesson right now. Your class today:")
                                                          : L("Tidak ada pelajaran yang sedang berlangsung. Rekap hari ini per kelas:", "No lesson is going on right now. Today per class:")) + "</p>" +
                  (cls.length ? '<div class="ls-rows">' + cls.map(classRow).join("") + "</div>" : "");
            el.classList.toggle("ls-student", curStudent);
            el.innerHTML = '<div class="ls-head"><div><b>' + esc(curStudent ? L("Kelasmu sekarang", "Your class now") : L("Rekap sesi", "Session recap")) + '</b><small>' +
                esc(ses.length ? L(ses.length + " pelajaran berlangsung · diperbarui ", ses.length + " lesson(s) now · updated ") + t
                               : (d.next_in > 0 ? L("Mulai lagi saat pelajaran berikutnya", "Starts again with the next lesson") : L("Tidak ada pelajaran lagi hari ini", "No more lessons today"))) + "</small></div>" +
                (ses.length ? '<span class="ls-live"><i></i>LIVE</span>' : '<span class="ls-idle">' + esc(L("Tidak ada sesi", "No session")) + "</span>") + "</div>" + body;
            el.hidden = false;
            // a little flash on the number that just went up
            ses.forEach(function (s) {
                var k = s.class + "|" + s.start;
                if (prevHadir[k] != null && s.hadir > prevHadir[k]) {
                    var n = el.querySelector('.ls-s[data-key="' + CSS.escape(k) + '"] .ls-hadir');
                    if (n) n.classList.add("bump");
                }
                prevHadir[k] = s.hadir;
            });
        }

        load();
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") load(); });
        window.addEventListener("tabshow", load);
        // a new check-in: refresh right away (when the database sends live changes)
        try {
            supabaseClient.channel("ls-attendance-" + Math.random().toString(36).slice(2))
                .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance" }, function () { if (active) setTimeout(load, 400); })
                .subscribe();
        } catch (e) {}
    }

    window.LiveSessions = { mount: mount };
})();
