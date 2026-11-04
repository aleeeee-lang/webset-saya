// Student check-in page: today's lessons in one small card (the full week is behind "Minggu ini").
(function () {
    function PL(a, b) { return (typeof getLang === "function" ? getLang() : "id") === "id" ? a : b; }
    async function run() {
        var box = document.getElementById("attLessons");
        if (!box || typeof requireLogin !== "function" || !window.Lessons) return;
        var user = await requireLogin(); if (!user) return;
        var me = typeof attMyProfile === "function" ? await attMyProfile(user.id) : null;
        if (!me || me.role !== "murid" || !me.class) return;
        try { await Lessons.loadWeek(); } catch (e) {}
        var r = await supabaseClient.from("class_schedules").select("*").eq("class", me.class);
        var list = (r && r.data) || [];
        if (!list.length) return;
        function draw() {
            var day = Lessons.isoDay(), today = Lessons.forDay(list, day), nowM = Lessons.nowMin();
            var html = '<div class="al-top"><span>' + (today.length ? PL("Pelajaran hari ini · ", "Today's lessons · ") + today.length + PL(" mapel", "") : PL("Hari ini tidak ada pelajaran", "No lessons today")) + '</span>' +
                '<a class="al-week" href="schedule.html">' + PL("Minggu ini", "This week") + '</a></div>';
            if (today.length) {
                html += today.map(function (x) {
                    var s = Lessons.toMin(x.start_time), e = Lessons.toMin(x.end_time);
                    var st = s <= nowM && nowM < e ? " now" : (e <= nowM ? " past" : "");
                    return '<div class="al-row' + st + '"><b>' + Lessons.fmt(x.start_time) + '</b><span>' + Lessons.esc(x.subject) + '</span>' + (st === " now" ? '<em>' + PL("Sekarang", "Now") + '</em>' : '') + '</div>';
                }).join("");
            } else {
                var nx = Lessons.status(list, undefined, me.class);
                if (nx && nx.next) html += '<div class="al-row"><b>' + Lessons.dayShort(nx.nextDay) + '</b><span>' + Lessons.esc(nx.next.subject) + ' · ' + Lessons.fmt(nx.next.start_time) + '</span></div>';
            }
            box.innerHTML = html;
            box.hidden = false;
        }
        draw();
        setInterval(draw, 60000);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
