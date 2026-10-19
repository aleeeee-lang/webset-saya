// Shared helpers for Tasks & Deadlines (tasks + task_done tables).
(function () {
    function L() { try { return (localStorage.getItem("attendly-lang") || "en") === "id" ? "id" : "en"; } catch (e) { return "en"; } }
    function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
    function dayDiff(due, now) { return Math.round((startOfDay(due) - startOfDay(now)) / 86400000); }
    function hm(d) { return String(d.getHours()).padStart(2, "0") + "." + String(d.getMinutes()).padStart(2, "0"); }
    var DSHORT = { id: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
    var MSHORT = { id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };

    // late | today | tomorrow | week | later
    function bucket(task, now) {
        now = now || new Date();
        var due = new Date(task.due_at);
        if (due < now) return "late";
        var dd = dayDiff(due, now);
        if (dd <= 0) return "today";
        if (dd === 1) return "tomorrow";
        if (dd <= 7) return "week";
        return "later";
    }

    // "Today 08.30", "Tomorrow 23.59", "Thu 13 Oct · 10.15", plus a relative hint
    function dueLabel(task, now) {
        now = now || new Date();
        var id = L() === "id", due = new Date(task.due_at), dd = dayDiff(due, now);
        var time = hm(due), when;
        if (dd === 0) when = (id ? "Hari ini " : "Today ") + time;
        else if (dd === 1) when = (id ? "Besok " : "Tomorrow ") + time;
        else if (dd === -1) when = (id ? "Kemarin " : "Yesterday ") + time;
        else when = DSHORT[L()][due.getDay()] + " " + due.getDate() + " " + MSHORT[L()][due.getMonth()] + " · " + time;
        var rel = "";
        var mins = Math.round((due - now) / 60000);
        if (mins < 0) {
            var late = -mins;
            rel = late < 60 ? (id ? "telat " + late + " mnt" : late + " min late")
                : late < 1440 ? (id ? "telat " + Math.round(late / 60) + " jam" : Math.round(late / 60) + " h late")
                : (id ? "telat " + Math.round(late / 1440) + " hari" : Math.round(late / 1440) + " days late");
        } else if (mins < 60) rel = id ? mins + " mnt lagi" : "in " + mins + " min";
        else if (mins < 1440) rel = id ? Math.round(mins / 60) + " jam lagi" : "in " + Math.round(mins / 60) + " h";
        else rel = id ? dd + " hari lagi" : "in " + dd + " days";
        return { when: when, rel: rel };
    }

    // Tasks visible to me (personal + my class), each with .done = true/false.
    async function fetchMine(client, userId, cls) {
        var q = client.from("tasks").select("*");
        q = cls ? q.or("user_id.eq." + userId + ",class.eq." + JSON.stringify(cls)) : q.eq("user_id", userId);
        var res = await q.order("due_at", { ascending: true });
        if (res.error) return { error: res.error, tasks: [] };
        var tasks = res.data || [];
        var ids = tasks.map(function (t) { return t.id; });
        var done = {};
        if (ids.length) {
            var d = await client.from("task_done").select("*").eq("user_id", userId).in("task_id", ids);
            (d.data || []).forEach(function (r) { done[r.task_id] = r; });
        }
        tasks.forEach(function (t) { var r = done[t.id]; t.done = !!r; t.done_at = r ? r.done_at : null; t.hidden = !!(r && r.hidden_at); t.photo_paths = r ? r.photo_paths || null : null; });
        // finished tasks the student put in the trash are no longer shown to them
        return { tasks: tasks.filter(function (t) { return !t.hidden; }) };
    }

    function localISO(dateStr, timeStr) {
        var p = String(dateStr).split("-"), t = String(timeStr || "23:59").split(":");
        return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), Number(t[0]), Number(t[1] || 0)).toISOString();
    }
    function toDateInput(d) { d = new Date(d); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    function toTimeInput(d) { d = new Date(d); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

    window.Tasks = { bucket: bucket, dueLabel: dueLabel, fetchMine: fetchMine, localISO: localISO, toDateInput: toDateInput, toTimeInput: toTimeInput, dayDiff: dayDiff };
})();
