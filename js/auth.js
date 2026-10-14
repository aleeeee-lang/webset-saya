// Signed-in user for this page. Fast path: the session saved on this device (no network),
// shared by every caller on the page; the server double-checks it in the background.
// (Data itself is still protected by the database rules on every request.)
var _attUserP = null, _attProfP = null, _attPeriodP = null;

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
 * Counts school days the student has no attendance record for (auto-Alpa),
 * computed on the fly — nothing is written to the database.
 *
 * A "school day" is any date, between the anchor start date and the end
 * of the counting window (the admin's period_end if set, otherwise
 * "today" — inclusive of today once that class's scheduled end time has
 * passed), whose weekday is in that class's active_days (from
 * attendance_schedules) and that isn't a marked holiday. The anchor start
 * date is period.start when an admin has set one (attendance_period_settings),
 * otherwise the student's earliest attendance record.
 *
 * Returns 0 if there's no attendance history and no period.start to anchor
 * the range to, or no schedule/class is configured.
 */
async function getAutoAlpaCount(user, attendanceData, period) {
    period = period || {};
    const periodStart = period.start;
    const periodEnd = period.end;

    if (!user) return 0;
    if (!periodStart && (!attendanceData || attendanceData.length === 0)) return 0;

    const profile = await attMyProfile(user.id);

    if (!profile || !profile.class) return 0;

    // the class schedule and the holiday list don't depend on each other: fetch both at once
    const [schedRes, holRes] = await Promise.all([
        supabaseClient.from("attendance_schedules").select("active_days, end_time").eq("class", profile.class).maybeSingle(),
        supabaseClient.from("holidays").select("date")
    ]);
    const schedule = schedRes.data, holidays = holRes.data;

    if (!schedule || !schedule.active_days || schedule.active_days.length === 0) return 0;

    const activeDays = schedule.active_days;

    const holidaySet = new Set((holidays || []).map(h => h.date));
    const recordedSet = new Set((attendanceData || []).map(a => a.date));

    const dates = (attendanceData || []).map(a => a.date).sort();
    const earliestRecord = dates.length > 0 ? dates[0] : null;

    const anchor = periodStart && earliestRecord
        ? (periodStart > earliestRecord ? periodStart : earliestRecord)
        : (periodStart || earliestRecord);

    if (!anchor) return 0;

    const start = new Date(anchor + "T00:00:00");

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Today only counts once the class's scheduled end time has passed.
    let includeToday = false;
    if (schedule.end_time) {
        const [eh, em] = schedule.end_time.split(":").map(Number);
        const todayEnd = new Date(today);
        todayEnd.setHours(eh, em || 0, 0, 0);
        includeToday = now >= todayEnd;
    }

    let end = new Date(today);
    end.setDate(end.getDate() - (includeToday ? 0 : 1));

    // Never scan past the admin's period_end, if one is set.
    if (periodEnd) {
        const periodEndDate = new Date(periodEnd + "T00:00:00");
        if (periodEndDate < end) end = periodEndDate;
    }

    // If the student has been marked as left/graduated, auto-Alpa must stop
    // advancing past the date they left — missing days after that aren't theirs.
    if (profile.status === "inactive" && profile.left_date) {
        const leftDateObj = new Date(profile.left_date + "T00:00:00");
        if (leftDateObj < end) end = leftDateObj;
    }

    if (end < start) return 0;

    let missing = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const isoWeekday = d.getDay() === 0 ? 7 : d.getDay();
        if (!activeDays.includes(isoWeekday)) continue;

        const dateStr = d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");

        if (holidaySet.has(dateStr)) continue;
        if (recordedSet.has(dateStr)) continue;

        missing++;
    }

    return missing;
}
