// Signed-in user for this page. Fast path: the session saved on this device (no network),
// shared by every caller on the page; the server double-checks it in the background.
// (Data itself is still protected by the database rules on every request.)
var _attUserP = null, _attProfP = null, _attPeriodP = null;

// the check-in group of a person: teachers are one group "Guru" (teacher_attendance.sql),
// students their class
function attClassKey(p) {
    if (!p) return null;
    return p.role === "guru" ? "Guru" : (p.class || null);
}

function attMyProfile(uid) {
    if (!_attProfP) {
        _attProfP = supabaseClient
            .from("profiles")
            .select("status, role, name, class, avatar_url, left_date")
            .eq("id", uid)
            .maybeSingle()
            .then(function (r) { return (r && r.data) || null; }, function () { return null; });
    }
    return _attProfP;
}

function _attGoLogin(q) {
    try { localStorage.removeItem("attendreem-profile"); localStorage.removeItem("attendreem-weakpw"); if (window.attSwipePurge) window.attSwipePurge(); } catch (e) {}
    window.location.href = "login.html" + (q || "");
}

function requireLogin() {
    if (_attUserP) return _attUserP;
    _attUserP = (async function () {
        let user = null;
        try {
            const s = await supabaseClient.auth.getSession();
            user = s && s.data && s.data.session ? s.data.session.user : null;
        } catch (e) {}

        if (!user) {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error || !data.user) {
                window.location.href = "login.html";
                return null;
            }
            user = data.user;
        } else {
            // the account may have been removed or blocked since: confirm with the server, quietly
            supabaseClient.auth.getUser().then(function (r) {
                const st = r && r.error && r.error.status;
                if (st === 401 || st === 403 || (r && !r.error && (!r.data || !r.data.user))) _attGoLogin();
            }).catch(function () {});
        }

        if (typeof attSyncClock === "function") attSyncClock();   // server time + school time zone

        attMyProfile(user.id).then(async function (profile) {
            if (!profile) return;
            try {
                localStorage.setItem("attendreem-profile", JSON.stringify({ role: profile.role, name: profile.name, class: profile.class, avatar_url: profile.avatar_url }));
                window.dispatchEvent(new Event("attendreem-profile"));
            } catch (e) {}
            if (profile.status === "inactive") {
                try { await supabaseClient.auth.signOut(); } catch (e) {}
                _attGoLogin("?inactive=1");
            }
        });

        return user;
    })();
    return _attUserP;
}


async function logoutUser() {

    const {
        error
    } = await supabaseClient.auth.signOut();


    if (error) {

        console.error(error);

        showToast(
            "Logout failed: " +
            error.message,
            "error"
        );

        return;

    }


    try { localStorage.removeItem("attendreem-profile"); localStorage.removeItem("attendreem-weakpw"); if (window.attSwipePurge) window.attSwipePurge(); } catch (e) {}

    window.location.href = "login.html";

}

async function getCurrentUser() {
    try {
        const s = await supabaseClient.auth.getSession();
        if (s && s.data && s.data.session) return s.data.session.user;
    } catch (e) {}
    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
}

async function getMyAttendance() {

    const user = await requireLogin();

    if (!user) {
        return { data: null, error: { message: "Not logged in" } };
    }

    const period = await getAttendancePeriod();

    let query = supabaseClient
        .from("attendance")
        .select("*")
        .eq("user_id", user.id);

    if (period.start) {
        query = query.gte("date", period.start);
    }
    if (period.end) {
        query = query.lte("date", period.end);
    }

    return await query.order("date", { ascending: false });

}

/**
 * Same as getMyAttendance(), but ignores the admin's period reset and
 * always returns the student's full attendance history. Used by pages
 * that represent the student's whole time at school (e.g. My Attendance),
 * as opposed to the Dashboard which shows the current counting period.
 */
async function getMyAttendanceAllTime() {

    const user = await requireLogin();

    if (!user) {
        return { data: null, error: { message: "Not logged in" } };
    }

    return await supabaseClient
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

}

/**
 * Reads the global attendance-counting window set by an admin
 * (attendance_period_settings, row id='global'): { start, end }.
 * Either can be null — start=null means "since the beginning",
 * end=null means "through today, no end date".
 */
function getAttendancePeriod() {
    if (!_attPeriodP) _attPeriodP = _attLoadPeriod();
    return _attPeriodP;
}
async function _attLoadPeriod() {
    const { data, error } = await supabaseClient
        .from("attendance_period_settings")
        .select("period_start, period_end")
        .eq("id", "global")
        .maybeSingle();

    if (error || !data) return { start: null, end: null };
    return { start: data.period_start, end: data.period_end };
}

/**
 * The rules that decide whether a date is a school day for a class.
 * Same rule as public.att_day_open() in the database (attendance_rules.sql):
 *   - an agenda date switched OFF (or an old "holiday" row)  -> closed
 *   - an agenda date switched ON                             -> open, even on a weekend
 *   - otherwise the class's active days; no schedule         -> every day allowed
 */
var _attRulesP = {};
function attDayRules(cls) {
    var k = cls || "";
    if (!_attRulesP[k]) _attRulesP[k] = Promise.all([
        cls ? supabaseClient.from("attendance_schedules").select("*").eq("class", cls).maybeSingle() : Promise.resolve({ data: null }),
        supabaseClient.from("holidays").select("*")
    ]).then(function (r) {
        var agenda = {};
        ((r[1] && r[1].data) || []).forEach(function (h) {
            var a = agenda[h.date] || (agenda[h.date] = { closed: false, open: false, label: "" });
            var on = h.attendance_open === true || h.attendance_open === false ? h.attendance_open : (h.type || "holiday") !== "holiday";
            if (on === false) { a.closed = true; a.label = h.label || a.label; }
            if (h.attendance_open === true) a.open = true;
            if (!a.label) a.label = h.label || "";
        });
        return { schedule: (r[0] && r[0].data) || null, agenda: agenda };
    }, function () { return { schedule: null, agenda: {} }; });
    return _attRulesP[k];
}
function attDayOpen(dateStr, rules) {
    var a = rules.agenda[dateStr];
    if (a && a.closed) return false;
    if (a && a.open) return true;
    var s = rules.schedule;
    if (!s || !s.active_days || !s.active_days.length) return true;
    var d = new Date(dateStr + "T00:00:00"), iso = d.getDay() === 0 ? 7 : d.getDay();
    return s.active_days.indexOf(iso) !== -1;
}

/**
 * What a student's attendance rate is built from:
 *   rows     - check-ins on school days only (a check-in on a closed day doesn't count)
 *   autoAlpa - school days with no check-in at all, counted as Alpa
 * Nothing is written to the database.
 *
 * The range starts at the admin's period start (or the student's first
 * check-in, whichever is later) and ends today - today only once the
 * class's closing time (or late window) has passed - or at the period end,
 * or the date the student left.
 */
async function attCountable(user, attendanceData, period, profileOverride) {
    period = period || {};
    var all = attendanceData || [];
    if (!user) return { rows: all, autoAlpa: 0 };
    // a parent passes the child's profile; everyone else uses their own
    var profile = profileOverride || await attMyProfile(user.id);
    var ckey = attClassKey(profile);
    var rules = await attDayRules(ckey);
    var rows = all.filter(function (r) { return attDayOpen(r.date, rules); });
    var schedule = rules.schedule;
    if (!profile || !ckey || !schedule || !schedule.active_days || !schedule.active_days.length) return { rows: rows, autoAlpa: 0 };

    var dates = all.map(function (a) { return a.date; }).sort();
    var first = dates.length ? dates[0] : null;
    var anchor = period.start && first ? (period.start > first ? period.start : first) : (period.start || first);
    if (!anchor) return { rows: rows, autoAlpa: 0 };

    var start = new Date(anchor + "T00:00:00");
    var now = attNow();
    var today = new Date(now); today.setHours(0, 0, 0, 0);
    // today counts only once check-in has closed for good
    var close = (schedule.late_mode === "late" && schedule.late_end_time) ? schedule.late_end_time : schedule.end_time;
    var includeToday = false;
    if (close) {
        var hm = close.split(":").map(Number), te = new Date(today);
        te.setHours(hm[0], hm[1] || 0, 0, 0);
        includeToday = now >= te;
    }
    var end = new Date(today);
    end.setDate(end.getDate() - (includeToday ? 0 : 1));
    if (period.end) { var pe = new Date(period.end + "T00:00:00"); if (pe < end) end = pe; }
    if (profile.status === "inactive" && profile.left_date) { var ld = new Date(profile.left_date + "T00:00:00"); if (ld < end) end = ld; }
    if (end < start) return { rows: rows, autoAlpa: 0 };

    var recorded = new Set(all.map(function (a) { return a.date; }));
    var missing = 0;
    for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        var ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        if (!recorded.has(ds) && attDayOpen(ds, rules)) missing++;
    }
    return { rows: rows, autoAlpa: missing };
}

// older callers: just the number of auto-Alpa days
async function getAutoAlpaCount(user, attendanceData, period, profileOverride) {
    return (await attCountable(user, attendanceData, period, profileOverride)).autoAlpa;
}

// Fresh numbers when coming back to a page:
//  - Back/Forward can show a page straight from the browser's memory (bfcache),
//    i.e. as it was before - e.g. "0 Hadir" from before today's check-in;
//  - the installed app can sit in the background for a long time.
// Pages that refresh on "tabshow" (Dashboard, History/SPP, My Attendance, ...) reload their data.
(function () {
    var hiddenAt = 0;
    function refresh() { try { window.dispatchEvent(new Event("tabshow")); } catch (e) {} }
    window.addEventListener("pageshow", function (e) { if (e.persisted) refresh(); });
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") hiddenAt = Date.now();
        else if (hiddenAt && Date.now() - hiddenAt > 60000) { hiddenAt = 0; refresh(); }
    });
})();
