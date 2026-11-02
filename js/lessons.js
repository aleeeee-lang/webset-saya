// Shared helpers for the weekly lesson timetable (class_schedules table).
(function () {
    function L() { try { return (localStorage.getItem("attendly-lang") || "en") === "id" ? "id" : "en"; } catch (e) { return "en"; } }

    var DAYS = {
        id: ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
        en: ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    };
    var DAYS_SHORT = {
        id: ["", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
        en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    };
    // Tones follow the app's colour roles (no red: red means a problem).
    var TONES = ["lime", "cyan", "amber", "navy", "green", "orange"];

    function isoDay(d) { var n = (d || new Date()).getDay(); return n === 0 ? 7 : n; }
    function toMin(t) { if (!t) return 0; var p = String(t).split(":"); return Number(p[0]) * 60 + Number(p[1] || 0); }
    function fmt(t) { if (!t) return ""; var p = String(t).split(":"); return p[0].padStart(2, "0") + "." + String(p[1] || "00").padStart(2, "0"); }
    function nowMin(d) { d = d || new Date(); return d.getHours() * 60 + d.getMinutes(); }
    function tone(subject) {
        var s = String(subject || "").trim().toLowerCase(), h = 0;
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return TONES[h % TONES.length];
    }
    function sortLessons(list) {
        return (list || []).slice().sort(function (a, b) { return a.day - b.day || toMin(a.start_time) - toMin(b.start_time); });
    }
    // which days have school this week: weekly days off (Kalender) are hidden, unless the admin
    // opened that date this week (e.g. a make-up Saturday). WEEK = { off: [6,7], open: {6: true} }
    var WEEK = { off: [], open: {} };
    function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    function loadWeek() {
        if (typeof supabaseClient === "undefined") return Promise.resolve(WEEK);
        var now = typeof attNow === "function" ? attNow() : new Date();
        var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (isoDay(now) - 1)), sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
        return Promise.all([
            supabaseClient.from("attendance_period_settings").select("weekly_off").eq("id", "global").maybeSingle(),
            supabaseClient.from("holidays").select("date,attendance_open,type").gte("date", ymd(mon)).lte("date", ymd(sun)),
            supabaseClient.from("national_holidays").select("date").eq("kind", "libur").gte("date", ymd(mon)).lte("date", ymd(sun))
        ]).then(function (r) {
            var off = (r[0] && !r[0].error && r[0].data && r[0].data.weekly_off) || [], open = {}, closed = {};
            ((r[2] && !r[2].error && r[2].data) || []).forEach(function (n) { closed[isoDay(new Date(n.date + "T00:00:00"))] = true; });
            ((r[1] && r[1].data) || []).forEach(function (h) {
                var d = isoDay(new Date(h.date + "T00:00:00"));
                if (h.attendance_open === true) { open[d] = true; delete closed[d]; }
                if (h.attendance_open === false || (h.attendance_open == null && (h.type || "holiday") === "holiday")) closed[d] = true;
            });
            WEEK = { off: off.map(Number), open: open, closed: closed };
            return WEEK;
        }, function () { return WEEK; });
    }
    function dayOn(d) { return !!WEEK.open[d] || WEEK.off.indexOf(Number(d)) === -1; }
    function forDay(list, day) { return sortLessons((list || []).filter(function (x) { return Number(x.day) === Number(day); })); }

    // { current, next, nextDay } for the given moment. nextDay = day number of `next` (may be a later day).
    function status(list, at) {
        at = at || new Date();
        var d = isoDay(at), m = nowMin(at), today = dayOn(d) && !(WEEK.closed && WEEK.closed[d]) ? forDay(list, d) : [], cur = null, nxt = null;
        today.forEach(function (x) {
            var s = toMin(x.start_time), e = toMin(x.end_time);
            if (s <= m && m < e) cur = x;
            else if (s > m && !nxt) nxt = x;
        });
        var nextDay = nxt ? d : null;
        if (!nxt) {
            for (var k = 1; k <= 7 && !nxt; k++) {
                var dd = ((d - 1 + k) % 7) + 1;
                // later this week: open or not; next week: only the weekly days off are known
                var on = dd > d ? dayOn(dd) : WEEK.off.indexOf(dd) === -1, l = on ? forDay(list, dd) : [];
                if (l.length) { nxt = l[0]; nextDay = dd; }
            }
        }
        return { current: cur, next: nxt, nextDay: nextDay, day: d, minute: m };
    }
    function minutesLabel(mins) {
        var id = L() === "id";
        if (mins < 60) return mins + (id ? " menit" : " min");
        var h = Math.floor(mins / 60), r = mins % 60;
        return h + (id ? " jam" : " h") + (r ? " " + r + (id ? " mnt" : " min") : "");
    }
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

    window.Lessons = {
        DAYS: DAYS, DAYS_SHORT: DAYS_SHORT, isoDay: isoDay, toMin: toMin, fmt: fmt, nowMin: nowMin,
        tone: tone, sort: sortLessons, forDay: forDay, status: status, loadWeek: loadWeek, dayOn: dayOn, week: function () { return WEEK; }, minutesLabel: minutesLabel, esc: esc, lang: L,
        dayName: function (d) { return DAYS[L()][d] || ""; },
        dayShort: function (d) { return DAYS_SHORT[L()][d] || ""; }
    };
})();
