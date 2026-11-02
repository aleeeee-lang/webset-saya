// Admin: related pages shown as one place with tabs at the top (Kelola -> Pengguna / Jadwal /
// Pesan / Pengaturan & data). Big "add" forms fold away behind a small button. Each tab is still its own page; switching replaces the page so
// "back" always goes straight to Kelola. Only for admins, only on these pages.
(function () {
    var role = "";
    try { role = (JSON.parse(localStorage.getItem("attendreem-profile") || "{}")).role || ""; } catch (e) {}
    if (role !== "admin" || window.self !== window.top) return;
    function L(id, en) { try { return (localStorage.getItem("attendly-lang") || "en") === "id" ? id : en; } catch (e) { return en; } }
    var page = (location.pathname.split("/").pop() || "index.html");

    var GROUPS = [
        { title: L("Pengguna", "People"), tabs: [
            ["admin-students.html", L("Siswa", "Students")],
            ["admin-teachers.html", L("Guru", "Teachers")],
            ["admin-parents.html", L("Orang tua", "Parents")],
            ["admin-development.html", L("Perkembangan", "Progress")]] },
        { title: L("Jadwal", "Schedule"), tabs: [
            ["admin-schedule.html", L("Jam absen", "Check-in")],
            ["admin-lessons.html", L("Pelajaran", "Lessons")],
            ["admin-piket.html", L("Piket", "Duty")],
            ["calendar.html", L("Kalender", "Calendar")]] },
        { title: L("Pesan", "Messages"), tabs: [
            ["admin-broadcast.html", L("Pengumuman", "Announce")],
            ["admin-leave.html", L("Izin", "Leave"), "leave"],
            ["admin-feedback.html", L("Saran", "Feedback"), "feedback"],
            ["admin-information.html", L("Info", "Info")]] },
        { title: L("Pengaturan & data", "Settings & data"), tabs: [
            ["settings.html", L("Pengaturan", "Settings")],
            ["admin-audit-log.html", L("Riwayat aktivitas", "Activity log")]] }
    ];
    var group = null;
    GROUPS.forEach(function (g) { g.tabs.forEach(function (t) { if (t[0] === page) group = g; }); });
    if (!group) return;
    window.AttAdminTabs = { groups: GROUPS };

    function build() {
        var main = document.querySelector("main");
        if (!main || document.getElementById("admTabs")) return;
        var head = main.querySelector(":scope > .attendance-intro, :scope > .v3-head, :scope > header");
        // the page's own title becomes the group name (the tab says which part you're in)
        var h = head && head.querySelector("h1, h2");
        if (h) { h.removeAttribute("data-i18n"); h.textContent = group.title; }
        if (head && head.classList.contains("attendance-intro")) head.style.marginBottom = "14px";
        if (head) head.classList.add("adm-head");
        var nav = document.createElement("nav");
        nav.id = "admTabs";
        nav.className = "adm-tabs";
        nav.setAttribute("role", "tablist");
        nav.setAttribute("data-noswipe", "");
        nav.innerHTML = group.tabs.map(function (t) {
            var on = t[0] === page;
            return '<a role="tab" aria-selected="' + on + '" class="' + (on ? "on" : "") + '" href="' + t[0] + '"' + (t[2] ? ' data-adm-n="' + t[2] + '"' : "") + '>' +
                t[1].replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }) + (t[2] ? '<i hidden></i>' : "") + '</a>';
        }).join("");
        if (head) head.insertAdjacentElement("afterend", nav); else main.insertBefore(nav, main.firstChild);
        var cur = nav.querySelector(".on");
        if (cur && cur.scrollIntoView) try { cur.scrollIntoView({ inline: "center", block: "nearest" }); } catch (e) {}
        // the same depth as the page it replaces: "back" goes to Kelola, not through every tab
        nav.addEventListener("click", function (e) {
            var a = e.target.closest("a[href]");
            if (!a) return;
            e.preventDefault();
            if (a.classList.contains("on")) return;
            try { sessionStorage.setItem("att-bn-rep", a.getAttribute("href")); } catch (x) {}
            location.replace(a.getAttribute("href"));
        });
        counts(nav);
        addButtons(main);
        align();
        window.addEventListener("load", alignSoon);
        window.addEventListener("resize", alignSoon);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignSoon);
        new MutationObserver(alignSoon).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
    // every page is built a little differently: put the title and the tabs at exactly the same
    // spot on all of them, so switching tabs doesn't make anything jump
    function align() {
        var main = document.querySelector("main"), nav = document.getElementById("admTabs");
        var h = main && main.querySelector(".adm-head h1, .adm-head h2");
        if (!nav || !h) return;
        nav.style.marginTop = nav.style.marginLeft = nav.style.width = h.style.marginLeft = ""; main.style.marginTop = "";
        var side = document.body.classList.contains("has-side") && window.innerWidth >= 1024;
        var y = window.scrollY || 0, top = h.getBoundingClientRect().top + y, want = side ? 28 : 19;
        if (Math.abs(top - want) > 0.5) main.style.marginTop = (parseFloat(getComputedStyle(main).marginTop) + want - top) + "px";
        var gap = nav.getBoundingClientRect().top - h.getBoundingClientRect().top, g = side ? 42 : 46;
        if (Math.abs(gap - g) > 0.5) nav.style.marginTop = (parseFloat(getComputedStyle(nav).marginTop) + g - gap) + "px";
        if (!side) {   // the same 15px edges on the phone
            var r = nav.getBoundingClientRect(), b = document.body.getBoundingClientRect();
            var L0 = b.left + 15, R0 = b.right - 15;
            if (Math.abs(r.left - L0) > 0.5 || Math.abs(r.right - R0) > 0.5) {
                nav.style.marginLeft = (parseFloat(getComputedStyle(nav).marginLeft) + L0 - r.left) + "px";
                nav.style.width = (R0 - L0) + "px";
            }
            var dx = b.left + 63 - h.getBoundingClientRect().left;   // the title starts at the same x, next to the back arrow
            if (Math.abs(dx) > 0.5 && Math.abs(dx) < 10) h.style.marginLeft = (parseFloat(getComputedStyle(h).marginLeft) + dx) + "px";
        }
    }
    function alignSoon() { requestAnimationFrame(align); }
    var ICON = {
        plus: '<path d="M12 5v14M5 12h14"/>',
        up: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
        x: '<path d="M6 6l12 12M18 6 6 18"/>'
    };
    function svg(k) { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>'; }
    // big "add ..." forms stay folded away behind a small button; the list is what you see first
    function addButtons(main) {
        var secs = [].slice.call(main.querySelectorAll("[data-adm-add]"));
        if (!secs.length) return;
        var bar = document.createElement("div");
        bar.className = "adm-add";
        secs.forEach(function (sec) {
            var t = sec.getAttribute("data-adm-add").split("|"), label = L(t[0], t[1] || t[0]);
            var ic = sec.getAttribute("data-adm-ic") || "plus";
            var b = document.createElement("button");
            b.type = "button";
            sec.classList.add("adm-fold");
            sec.hidden = true;
            function paint() { b.innerHTML = sec.hidden ? svg(ic) + "<span>" + label + "</span>" : svg("x") + "<span>" + L("Tutup", "Close") + "</span>"; b.classList.toggle("on", !sec.hidden); }
            b.addEventListener("click", function () {
                var open = sec.hidden;
                secs.forEach(function (s) { s.hidden = true; });
                sec.hidden = !open;
                bar.querySelectorAll("button").forEach(function (x) { x._paint(); });
                if (open) { var f = sec.querySelector("input,textarea,select"); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }
            });
            b._paint = paint;
            paint();
            bar.appendChild(b);
        });
        secs[0].parentNode.insertBefore(bar, secs[0]);
    }
    // unread leave requests / feedback on the Pesan tabs
    async function counts(nav) {
        if (!nav.querySelector("[data-adm-n]")) return;
        for (var i = 0; i < 40 && typeof supabaseClient === "undefined"; i++) await new Promise(function (r) { setTimeout(r, 100); });
        if (typeof supabaseClient === "undefined") return;
        var head = { count: "exact", head: true };
        try {
            var r = await Promise.all([
                supabaseClient.from("leave_requests").select("id", head).eq("status", "pending"),
                supabaseClient.from("feedback").select("id", head).or("status.is.null,status.eq.new")
            ]);
            [["leave", r[0]], ["feedback", r[1]]].forEach(function (x) {
                var n = x[1] && !x[1].error ? x[1].count : 0, el = nav.querySelector('[data-adm-n="' + x[0] + '"] i');
                if (el && n) { el.textContent = n; el.hidden = false; }
            });
        } catch (e) {}
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
