// Shared helpers for the "Juara" (champions) feature: data loading, ranking and small charts.
// Used by juara.html and by the highlight cards on the home pages.
(function () {
    function L(id, en) { return (typeof getLang === "function" ? getLang() : "id") === "id" ? id : en; }
    function esc(s) { return typeof escapeHTML === "function" ? escapeHTML(s) : String(s == null ? "" : s); }
    function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    var MONTH = { id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"], en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] };
    var MON = { id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };
    // escape, and mark the first number so js/animate.js counts it up ("8 hari" -> <span data-count>8</span> hari)
    function cnt(str) { return esc(str).replace(/\d+(?:,\d+)?/, function (n) { return '<span data-count>' + n + '</span>'; }); }
    function lk() { return (typeof getLang === "function" && getLang() === "en") ? "en" : "id"; }

    // month window: offset 0 = this month (up to today), -1 = last month, ...
    function month(offset) {
        var now = attNow();
        var a = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        var b = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
        if (offset === 0) b = now;
        return { from: iso(a), to: iso(b), label: MONTH[lk()][a.getMonth()] + " " + a.getFullYear(), offset: offset };
    }

    // attendance ranking: most present days first, then the earliest average check-in
    function rankAttendance(rows) {
        var list = (rows || []).slice().sort(function (x, y) {
            if (y.hadir !== x.hadir) return y.hadir - x.hadir;
            var tx = x.avg_time || "99.99", ty = y.avg_time || "99.99";
            if (tx !== ty) return tx < ty ? -1 : 1;
            return String(x.name || "").localeCompare(String(y.name || ""));
        });
        var r = 0, prev = null;
        list.forEach(function (row, i) {
            var key = row.hadir + "|" + (row.avg_time || "");
            if (key !== prev) { r = i + 1; prev = key; }
            row.rnk = row.hadir > 0 ? r : null;   // nobody is "champion" with zero days
        });
        return list;
    }

    // round profile picture; falls back to initials when there is no photo (or it fails to load)
    function av(name, url, cls) {
        var u = url && typeof safeURL === "function" ? safeURL(url) : "";
        return '<span class="jr-av' + (cls ? " " + cls : "") + '">' + esc(initials(name)) +
            (u && u !== "#" ? '<img src="' + u + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</span>';
    }
    function initials(name) {
        var p = String(name || "?").trim().split(/\s+/);
        return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
    }
    var MEDAL = ["🥇", "🥈", "🥉"];

    // podium for the top 3: [{name, value, sub}]
    function podium(items) {
        if (!items.length) return "";
        // always three places, so one or two champions don't leave a lone pillar;
        // an empty place is shown faded with a dash
        return '<div class="jr-podium">' + [1, 0, 2].map(function (i) {
            var it = items[i];
            if (!it) return '<div class="jr-pod p' + (i + 1) + ' empty"><span class="jr-medal">' + MEDAL[i] + '</span>' +
                '<span class="jr-av jr-av-empty">–</span><b>' + esc(L("Belum ada", "Nobody yet")) + '</b><small>&nbsp;</small>' +
                '<div class="jr-step"><span>' + (i + 1) + '</span></div></div>';
            return '<div class="jr-pod p' + (i + 1) + '"><span class="jr-medal">' + MEDAL[i] + '</span>' +
                av(it.name, it.avatar) +
                '<b>' + esc(it.name || "-") + '</b><small>' + cnt(it.value) + '</small>' +
                '<div class="jr-step"><span>' + (i + 1) + '</span></div></div>';
        }).join("") + '</div>';
    }

    // daily bar chart (SVG) of attendance % per school day; days: [{day, hadir, total}]
    function dailyChart(days, opts) {
        opts = opts || {};
        if (!days.length) return '<p class="jr-muted">' + esc(L("Belum ada data absen bulan ini.", "No attendance this month yet.")) + '</p>';
        // drawn at its real proportions (no stretching): round pills on a soft track, the day
        // number under each one, faint 50% / 100% guides and a dashed class average
        var W = 320, H = (opts.height || 120) + 10, top = 6, bottom = 18, n = days.length;
        var area = H - top - bottom;
        var gap = Math.max(5, Math.min(12, 120 / n)), bw = Math.min(11, Math.max(4, (W - gap * (n - 1)) / n));
        var x0 = Math.max(0, (W - (bw * n + gap * (n - 1))) / 2);
        var today = iso(attNow());
        var avg = days.reduce(function (s, d) { return s + (d.total ? d.hadir / d.total : 0); }, 0) / n;
        var yOf = function (p) { return top + area - p * area; };
        var guides = [1, 0.5].map(function (p) { return '<line class="jr-guide" x1="0" x2="' + W + '" y1="' + yOf(p).toFixed(1) + '" y2="' + yOf(p).toFixed(1) + '"></line>'; }).join("");
        var r = (bw / 2).toFixed(1);
        var bars = days.map(function (d, i) {
            var pct = d.total ? d.hadir / d.total : 0;
            var h = pct > 0 ? Math.max(bw, pct * area) : 0;
            var x = x0 + i * (bw + gap), y = top + area - h;
            var dd = Number(String(d.day).slice(8, 10));
            var isToday = String(d.day) === today;
            var cls = "jr-bar" + (isToday ? " today" : pct < 0.75 ? " low" : "");
            var lab = (n <= 12 || i % Math.ceil(n / 8) === 0 || i === n - 1 || isToday) ? '<text class="' + (isToday ? "today" : "") + '" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + dd + '</text>' : '';
            return '<g class="' + cls + '"><title>' + esc(dd + " " + MON[lk()][Number(String(d.day).slice(5, 7)) - 1] + ": " + Math.round(pct * 100) + "% (" + d.hadir + "/" + d.total + ")") + '</title>' +
                '<rect class="jr-track" x="' + x.toFixed(1) + '" y="' + top + '" width="' + bw.toFixed(1) + '" height="' + area + '" rx="' + r + '"></rect>' +
                (h ? '<rect class="jr-fill" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + r + '"></rect>' : '') + '</g>' + lab;
        }).join("");
        var ay = yOf(avg).toFixed(1);
        return '<svg class="jr-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(L("Kehadiran kelas per hari", "Class attendance per day")) + '">' +
            guides + bars + '<line class="jr-avg" x1="0" x2="' + W + '" y1="' + ay + '" y2="' + ay + '"></line></svg>' +
            '<div class="jr-chart-foot"><span><i class="jr-dot"></i>' + esc(L("Hadir per hari", "Present per day")) + '</span><span><i class="jr-line"></i><em>' + cnt(L("Rata-rata ", "Average ") + Math.round(avg * 100) + "%") + '</em></span></div>';
    }

    var TROPHY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 21h7M9.5 17h5l.5 4h-6z"/></svg>';
    var GO = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

    // banner for an achievement that is still being celebrated (show_until in the future)
    function medalOf(label) { return /^Juara 1/.test(label || "") ? "🥇" : /^Juara 2/.test(label || "") ? "🥈" : /^Juara 3/.test(label || "") ? "🥉" : "🏅"; }
    // profile photos of the students in a list of achievements: {student_id: url}
    async function avatars(list) {
        var ids = (list || []).map(function (a) { return a.student_id; }).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; });
        if (!ids.length) return {};
        try {
            var r = await supabaseClient.rpc("champ_avatars", { ids: ids });
            var map = {};
            ((r && r.data) || []).forEach(function (x) { map[x.id] = x.avatar_url; });
            return map;
        } catch (e) { return {}; }
    }
    // student photo with the medal as a badge (initials when there is no photo)
    function awardFace(a, map) {
        return '<span class="jr-face">' + av(a.student_name, (map || {})[a.student_id], "md") + '<i>' + medalOf(a.rank_label) + '</i></span>';
    }
    function banner(a, map) {
        if (a.kind === "rank") {
            var names = Array.isArray(a.details) ? a.details.map(function (d) { return MEDAL[(d.rank || 1) - 1] + " " + esc(d.name); }).join(" &nbsp;") : esc(a.title);
            return '<a class="jr-banner rank" href="juara.html#award"><span class="jr-banner-ic">' + TROPHY + '</span><span class="jr-banner-text"><small>' +
                esc(L("Juara kelas ", "Class champions · ") + (a.class || "") + (a.period ? " · " + a.period : "")) + '</small><b>' + names + '</b></span>' + GO + '</a>';
        }
        return '<a class="jr-banner" href="juara.html#award">' + awardFace(a, map) + '<span class="jr-banner-text"><small>' +
            esc(L("Selamat! ", "Congrats! ") + (a.class ? a.class + " · " : "") + (a.level || "")) + '</small><b>' + esc(a.student_name || "-") + '</b><em>' +
            esc((a.rank_label ? a.rank_label + " " : "") + (a.event_name || a.title || "")) + '</em></span>' + GO + '</a>';
    }

    // Highlights on the home pages:
    //  * attendance champions of the user's class: every day (with the daily chart)
    //  * competition wins / announced rankings: only while show_until is in the future (7 days)
    //  * last month's most diligent class: only during the first 7 days of the month
    // After that everything stays reachable in juara.html.
    async function home(el, opt) {
        if (!el || typeof supabaseClient === "undefined") return;
        opt = opt || {};
        var cls = opt.cls || "", uid = opt.userId || "";
        var m = month(0), now = new Date();
        var jobs = [
            supabaseClient.from("achievements").select("*").gt("show_until", now.toISOString()).order("created_at", { ascending: false }).limit(4),
            cls ? supabaseClient.rpc("champ_attendance", { target_class: cls, d_from: m.from, d_to: m.to }) : Promise.resolve({ data: null }),
            cls ? supabaseClient.rpc("champ_daily", { target_class: cls, d_from: m.from, d_to: m.to }) : Promise.resolve({ data: null }),
            now.getDate() <= 7 ? supabaseClient.rpc("champ_classes", { d_from: month(-1).from, d_to: month(-1).to }) : Promise.resolve({ data: null })
        ];
        var r;
        try { r = await Promise.all(jobs); } catch (e) { return; }
        var html = "";

        // 1) celebrations (7 days)
        var awards = (r[0] && !r[0].error && r[0].data) || [];
        // class rankings only matter to that class; competition wins are celebrated school-wide
        if (opt.onlyClass != null) awards = awards.filter(function (a) { return a.kind !== "rank" || a.class === opt.onlyClass; });
        var faces = await avatars(awards);
        html += awards.map(function (a) { return banner(a, faces); }).join("");

        // 2) most diligent class of last month (first week of the month)
        var cl = (r[3] && !r[3].error && r[3].data) || [];
        if (cl.length) {
            var best = cl.map(function (x) { return { c: x.class, rate: x.total ? x.hadir / x.total : 0, h: x.hadir }; })
                .sort(function (a, b) { return b.rate - a.rate || b.h - a.h; })[0];
            var lm = month(-1);
            html += '<a class="jr-banner crown' + (best.c === cls ? " mine" : "") + '" href="juara.html#class"><span class="jr-banner-ic">👑</span><span class="jr-banner-text"><small>' +
                esc(L("Kelas paling rajin · ", "Most diligent class · ") + lm.label) + '</small><b>' + esc(best.c) + (best.c === cls ? ' <i>' + esc(L("Kelasmu!", "Your class!")) + '</i>' : '') + '</b><em>' +
                cnt(Math.round(best.rate * 100) + "% " + L("kehadiran", "attendance")) + '</em></span>' + GO + '</a>';
        }

        // 3) attendance champions - every day
        if (cls && r[1] && !r[1].error && r[1].data) {
            var rows = rankAttendance(r[1].data), top = rows.filter(function (x) { return x.rnk && x.rnk <= 3; }).slice(0, 3);
            var mine = rows.find(function (x) { return x.user_id === uid; });
            var days = (r[2] && !r[2].error && r[2].data) || [];
            html += '<section class="jr-home"><a class="jr-home-head" href="juara.html#att"><span class="jr-home-ic">' + TROPHY + '</span><span class="jr-home-title"><b>' +
                esc(L("Juara kehadiran", "Attendance champions")) + '</b><small>' + esc(L("Kelas ", "Class ") + cls + " · " + m.label) + '</small></span>' +
                (mine && mine.rnk ? '<span class="jr-home-me">' + esc(L("Kamu ", "You ")) + '#<span data-count>' + mine.rnk + '</span></span>' : '') + GO + '</a>' +
                (top.length ? '<div class="jr-home-top">' + top.map(function (x, i) {
                    return '<div class="jr-home-pos r' + x.rnk + (x.user_id === uid ? " me" : "") + '">' + av(x.name, x.avatar_url, "sm") + '<span class="jr-home-name"><b>' + esc(x.name || "-") + '</b><small><span data-count>' + x.hadir + '</span>' + esc(L(" hari", " days")) + '</small></span></div>';
                }).join("") + '</div>' : '<p class="jr-muted">' + esc(L("Juara muncul setelah ada yang absen bulan ini.", "Champions show up once people check in this month.")) + '</p>') +
                (days.length ? '<div class="jr-home-chart">' + dailyChart(days, { height: 78 }) + '</div>' : '') + '</section>';
        }
        // the card usually sits below the fold: hold its animations until it scrolls into view
        el.innerHTML = html.replace(/data-count>/g, "data-count-later>");
        el.hidden = !html;
        el.classList.add("jr-paused");
        function go() {
            el.classList.remove("jr-paused");
            Array.prototype.forEach.call(el.querySelectorAll("[data-count-later]"), function (n) {
                n.removeAttribute("data-count-later"); n.setAttribute("data-count", "");
                var t = n.textContent; n.textContent = t;   // lets js/animate.js count it up now
            });
        }
        if (!("IntersectionObserver" in window)) return go();
        var io = new IntersectionObserver(function (en) {
            if (en.some(function (x) { return x.isIntersecting; })) { io.disconnect(); go(); }
        }, { threshold: 0.25 });
        io.observe(el);
    }

    window.Champs = { L: L, esc: esc, iso: iso, month: month, rankAttendance: rankAttendance, podium: podium, dailyChart: dailyChart, initials: initials, av: av, MEDAL: MEDAL, MONTH: MONTH, MON: MON, lk: lk, cnt: cnt, home: home, banner: banner, avatars: avatars, awardFace: awardFace, medalOf: medalOf };
})();
