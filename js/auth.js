async function requireLogin() {

    const {
        data,
        error
    } = await supabaseClient.auth.getUser();


    if (error || !data.user) {

        window.location.href = "login.html";

        return null;

    }


    return data.user;

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


    window.location.href = "login.html";

}

async function getCurrentUser() {

    const {
        data,
        error
    } = await supabaseClient.auth.getUser();


    if (error || !data.user) {

        return null;

    }


    return data.user;

}

async function getMyAttendance() {

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
 * Counts school days the student has no attendance record for (auto-Alpa),
 * computed on the fly — nothing is written to the database.
 *
 * A "school day" is any date, between the student's earliest attendance
 * record and yesterday, whose weekday is in that class's active_days
 * (from attendance_schedules) and that isn't a marked holiday.
 *
 * Returns 0 if the student has no attendance history yet (nothing to
 * anchor the range to) or no schedule/class is configured.
 */
async function getAutoAlpaCount(user, attendanceData) {
    if (!user || !attendanceData || attendanceData.length === 0) return 0;

    const { data: profile } = await supabaseClient
        .from("profiles")
        .select("class")
        .eq("id", user.id)
        .single();

    if (!profile || !profile.class) return 0;

    const { data: schedule } = await supabaseClient
        .from("attendance_schedules")
        .select("active_days")
        .eq("class", profile.class)
        .maybeSingle();

    if (!schedule || !schedule.active_days || schedule.active_days.length === 0) return 0;

    const activeDays = schedule.active_days;

    const { data: holidays } = await supabaseClient
        .from("holidays")
        .select("date");

    const holidaySet = new Set((holidays || []).map(h => h.date));
    const recordedSet = new Set(attendanceData.map(a => a.date));

    const dates = attendanceData.map(a => a.date).sort();
    const start = new Date(dates[0] + "T00:00:00");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() - 1);

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
