// Shared by the teacher pages (teacher.html, teacher-class.html, teacher-student.html).
// A teacher may lead one class (profiles.class = homeroom: full access to its students)
// and teach others (class_schedules.teacher_id: grades only, see teacher_grades.sql).
(function () {
    var ID = (typeof getLang === "function" ? getLang() : "id") === "id";
    function L(id, en) { return ID ? id : en; }
    var DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    var DAY_S = ID ? DAYS : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var MON = ID ? ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var _ctx = null;

    // who is signed in, their homeroom and every class they teach
    function init() {
        if (_ctx) return _ctx;
        _ctx = (async function () {
            var user = await requireLogin();
            if (!user) return null;
            var r = await supabaseClient.from("profiles").select("role, class, name, avatar_url").eq("id", user.id).single();
            var p = r.data;
            if (!p || p.role !== "guru") { location.replace("index.html"); return null; }
            var taught = await supabaseClient.from("class_schedules").select("class").eq("teacher_id", user.id);
            var homeroom = p.class || "";
            var classes = Array.from(new Set([homeroom].concat(((taught && taught.data) || []).map(function (x) { return x.class; })).filter(Boolean)));
            classes.sort(function (a, b) { return a === homeroom ? -1 : b === homeroom ? 1 : a.localeCompare(b, "id", { numeric: true }); });
            return { user: user, profile: p, homeroom: homeroom, classes: classes };
        })();
        return _ctx;
    }

    async function students(classes) {
        if (!classes || !classes.length) return [];
        var r = await supabaseClient.from("profiles").select("id, name, class, nis, status, avatar_url, left_date, created_at")
            .eq("role", "murid").in("class", classes).order("name", { ascending: true });
        return ((r && r.data) || []).filter(function (s) { return s.status !== "inactive"; });
    }

    // today's rows by student id (only the homeroom class is readable)
    async function today(ids) {
        var out = {};
        if (!ids || !ids.length) return out;
        var r = await supabaseClient.from("attendance").select("id, user_id, status, time, method, photo_url").eq("date", localDateStr()).in("user_id", ids);
        ((r && r.data) || []).forEach(function (a) { out[a.user_id] = a; });
        return out;
    }

    // pending Izin / Sakit that cover today, by student id
    async function pendingLeave() {
        var out = {}, t = localDateStr();
        var r = await supabaseClient.from("leave_requests").select("user_id, type, start_date, end_date").eq("status", "pending");
        ((r && r.data) || []).forEach(function (x) {
            if (x.start_date <= t && (x.end_date || x.start_date) >= t) out[x.user_id] = x.type || "Izin";
        });
        return out;
    }

    // the teacher sets a student's status for today (homeroom class only)
    async function setStatus(student, status) {
        var t = localDateStr();
        var ex = await supabaseClient.from("attendance").select("id, status").eq("user_id", student.id).eq("date", t).maybeSingle();
        if (ex.data && ex.data.status === status) return { same: true };
        var payload = { user_id: student.id, name: student.name, class: student.class, date: t, day: DAYS[new Date(t + "T00:00:00").getDay()], status: status, reason: "" };
        var res = ex.data
            ? await supabaseClient.from("attendance").update(payload).eq("id", ex.data.id)
            : await supabaseClient.from("attendance").insert([payload]);
        return { error: res.error };
    }

    function letter(name) { return escapeHTML(((name || "?").trim().charAt(0) || "?").toUpperCase()); }

    // the small status pill used in the lists
    function badge(rec, leave) {
        if (rec) {
            var s = rec.status;
            if (s === "Hadir") return '<span class="tc-pill ok">' + L("Hadir", "Present") + (rec.time ? " " + String(rec.time).slice(0, 5).replace(":", ".") : "") + '</span>';
            if (s === "Izin") return '<span class="tc-pill izin">' + L("Izin", "Leave") + '</span>';
            if (s === "Sakit") return '<span class="tc-pill sick">' + L("Sakit", "Sick") + '</span>';
            if (s === "Alpa") return '<span class="tc-pill no">' + L("Alpa", "Absent") + '</span>';
        }
        if (leave) return '<span class="tc-pill izin">' + (leave === "Sakit" ? L("Sakit diajukan", "Sick requested") : L("Izin diajukan", "Leave requested")) + '</span>';
        return '<span class="tc-pill">' + L("Belum", "Not yet") + '</span>';
    }

    function dateLong(d) { d = d || attNow(); return DAY_S[d.getDay()] + ", " + d.getDate() + " " + MON[d.getMonth()]; }
    function dateShort(s) { var d = new Date(String(s).slice(0, 10) + "T00:00:00"); return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); }

    // a bottom sheet with a form; resolves with the form values, or null when closed
    function sheet(opts) {
        return new Promise(function (resolve) {
            var wrap = document.createElement("div");
            wrap.className = "tc-sheet-wrap";
            wrap.innerHTML = '<div class="tc-sheet" role="dialog" aria-modal="true" aria-label="' + escapeHTML(opts.title) + '">' +
                '<div class="tc-sheet-grip"></div><h2>' + escapeHTML(opts.title) + '</h2>' +
                (opts.sub ? '<p class="tc-sheet-sub">' + escapeHTML(opts.sub) + '</p>' : '') +
                '<form novalidate>' + opts.fields.map(function (f) {
                    var v = f.value == null ? "" : String(f.value);
                    var input;
                    if (f.type === "select") input = '<select name="' + f.name + '">' + f.options.map(function (o) { return '<option value="' + escapeHTML(o[0]) + '"' + (o[0] === v ? " selected" : "") + '>' + escapeHTML(o[1]) + '</option>'; }).join("") + '</select>';
                    else if (f.type === "seg") input = '<div class="tc-seg" data-name="' + f.name + '">' + f.options.map(function (o) { return '<button type="button" data-v="' + escapeHTML(o[0]) + '" class="' + (o[0] === v ? "on" : "") + '">' + escapeHTML(o[1]) + '</button>'; }).join("") + '</div><input type="hidden" name="' + f.name + '" value="' + escapeHTML(v) + '">';
                    else if (f.type === "area") input = '<textarea name="' + f.name + '" rows="3" placeholder="' + escapeHTML(f.placeholder || "") + '">' + escapeHTML(v) + '</textarea>';
                    else input = '<input name="' + f.name + '" type="' + (f.type || "text") + '" value="' + escapeHTML(v) + '" placeholder="' + escapeHTML(f.placeholder || "") + '"' + (f.type === "number" ? ' inputmode="decimal" min="0" max="100"' : '') + (f.list ? ' list="tcl-' + f.name + '"' : '') + ' autocomplete="off">' +
                        (f.list ? '<datalist id="tcl-' + f.name + '">' + f.list.map(function (x) { return '<option value="' + escapeHTML(x) + '">'; }).join("") + '</datalist>' : '');
                    return '<label class="tc-field' + (f.half ? " half" : "") + '"><span>' + escapeHTML(f.label) + (f.optional ? ' <i>' + L("(opsional)", "(optional)") + '</i>' : '') + '</span>' + input + '</label>';
                }).join("") +
                '<div class="tc-sheet-act">' + (opts.danger ? '<button type="button" class="tc-btn danger" data-act="danger">' + escapeHTML(opts.danger) + '</button>' : '') +
                '<button type="submit" class="tc-btn solid">' + escapeHTML(opts.ok || L("Simpan", "Save")) + '</button></div></form></div>';
            document.body.appendChild(wrap);
            document.documentElement.classList.add("tc-sheet-open");
            requestAnimationFrame(function () { wrap.classList.add("in"); });
            var form = wrap.querySelector("form");
            function close(val) {
                wrap.classList.remove("in");
                document.documentElement.classList.remove("tc-sheet-open");
                setTimeout(function () { wrap.remove(); }, 220);
                resolve(val);
            }
            wrap.addEventListener("click", function (e) {
                if (e.target === wrap) close(null);
                var sb = e.target.closest(".tc-seg button");
                if (sb) {
                    var seg = sb.parentNode;
                    seg.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b === sb); });
                    form.querySelector('input[name="' + seg.dataset.name + '"]').value = sb.dataset.v;
                }
                if (e.target.closest('[data-act="danger"]')) close({ __danger: true });
            });
            document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { document.removeEventListener("keydown", esc); close(null); } });
            form.addEventListener("submit", function (e) {
                e.preventDefault();
                var val = {};
                new FormData(form).forEach(function (v, k) { val[k] = String(v).trim(); });
                var bad = opts.check ? opts.check(val) : "";
                if (bad) { showToast(bad, "error"); return; }
                close(val);
            });
            var first = form.querySelector("input:not([type=hidden]),textarea");
            if (first && !opts.noFocus) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 260);
        });
    }

    window.TC = { L: L, init: init, students: students, today: today, pendingLeave: pendingLeave, setStatus: setStatus, letter: letter, badge: badge, dateLong: dateLong, dateShort: dateShort, sheet: sheet };
})();
