// Personal notes on the calendar (personal_notes.sql). Only the owner sees them.
//   AttNotes.load()                    -> Promise, fills the cache (all of the user's notes)
//   AttNotes.on(dateKey)               -> notes of that day
//   AttNotes.mark(container)           -> adds a dot to day cells (needs data-date on them)
//   AttNotes.open(dateKey, opts)       -> day sheet: school info + my notes, add / delete
//        opts.info: [{ text, dot }]    lines shown at the top (school agenda, my attendance)
//        opts.onChange: function       called after a note was added or deleted
(function () {
    var cache = {};          // date -> [{id,title}]
    var ready = false;       // false = table missing (SQL not run) or not signed in
    function L(id, en) { return (typeof getLang === "function" ? getLang() : "id") === "id" ? id : en; }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function toast(m, t) { if (window.showToast) showToast(m, t); }
    function niceDate(k) {
        var d = new Date(k + "T00:00:00");
        try { return d.toLocaleDateString(L("id-ID", "en-GB"), { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (e) { return k; }
    }

    async function load() {
        try {
            var r = await supabaseClient.from("personal_notes").select("id,date,title").order("created_at");
            if (r.error) { ready = false; return cache; }
            cache = {};
            (r.data || []).forEach(function (n) { (cache[n.date] = cache[n.date] || []).push(n); });
            ready = true;
        } catch (e) { ready = false; }
        return cache;
    }
    function on(k) { return cache[k] || []; }
    function mark(box) {
        if (!box) return;
        box.querySelectorAll("[data-date]").forEach(function (el) {
            el.classList.toggle("has-note", on(el.getAttribute("data-date")).length > 0);
        });
    }

    function open(k, opts) {
        opts = opts || {};
        var w = document.createElement("div");
        w.className = "mn-wrap";
        w.innerHTML = '<div class="mn-sheet" role="dialog" aria-modal="true">' +
            '<div class="mn-head"><b></b><button type="button" class="mn-x" aria-label="Close">×</button></div>' +
            '<div class="mn-info"></div>' +
            '<div class="mn-label"></div><div class="mn-list"></div>' +
            '<form class="mn-add"><input type="text" maxlength="80" autocomplete="off"><button type="submit"></button></form>' +
            '<p class="mn-hint"></p></div>';
        w.querySelector(".mn-head b").textContent = niceDate(k);
        w.querySelector(".mn-label").textContent = L("Catatan saya", "My notes");
        w.querySelector(".mn-add input").placeholder = L("Tulis catatan untuk tanggal ini…", "Write a note for this day…");
        w.querySelector(".mn-add button").textContent = L("Simpan", "Save");
        w.querySelector(".mn-hint").textContent = L("Hanya kamu yang bisa melihat catatan ini.", "Only you can see these notes.");
        var info = (opts.info || []).filter(function (x) { return x && x.text; });
        w.querySelector(".mn-info").innerHTML = info.map(function (x) { return '<div class="mn-line"><i class="legend ' + esc(x.dot || "") + '"></i><span>' + esc(x.text) + '</span></div>'; }).join("");
        w.querySelector(".mn-info").hidden = !info.length;

        function list() {
            var notes = on(k), box = w.querySelector(".mn-list");
            box.innerHTML = notes.length ? notes.map(function (n) {
                return '<div class="mn-note"><i class="mn-dot"></i><span>' + esc(n.title) + '</span><button type="button" class="mn-del" data-id="' + esc(n.id) + '" aria-label="' + esc(L("Hapus", "Delete")) + '">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button></div>';
            }).join("") : '<p class="mn-empty">' + esc(L("Belum ada catatan.", "No notes yet.")) + '</p>';
        }
        list();
        if (!ready) {
            w.querySelector(".mn-add").hidden = true;
            w.querySelector(".mn-hint").textContent = L("Catatan pribadi belum diaktifkan sekolah.", "Personal notes aren't set up yet.");
        }

        function close() { w.classList.remove("in"); setTimeout(function () { w.remove(); }, 180); document.removeEventListener("keydown", key); }
        function key(e) { if (e.key === "Escape") close(); }
        document.addEventListener("keydown", key);
        w.addEventListener("click", function (e) { if (e.target === w) close(); });
        w.querySelector(".mn-x").addEventListener("click", close);

        w.querySelector(".mn-add").addEventListener("submit", async function (e) {
            e.preventDefault();
            var inp = w.querySelector(".mn-add input"), btn = w.querySelector(".mn-add button");
            var t = inp.value.trim();
            if (!t) { inp.focus(); return; }
            btn.disabled = true;
            var r = await supabaseClient.from("personal_notes").insert({ date: k, title: t.slice(0, 80) }).select("id,date,title").single();
            btn.disabled = false;
            if (r.error) { toast(String(r.error.message).indexOf("NOTE_LIMIT") !== -1 ? L("Maksimal 10 catatan per hari.", "At most 10 notes per day.") : L("Gagal menyimpan: ", "Could not save: ") + r.error.message, "error"); return; }
            (cache[k] = cache[k] || []).push(r.data);
            inp.value = "";
            list();
            if (opts.onChange) opts.onChange();
        });
        w.querySelector(".mn-list").addEventListener("click", async function (e) {
            var b = e.target.closest(".mn-del");
            if (!b) return;
            var id = b.getAttribute("data-id");
            b.disabled = true;
            var r = await supabaseClient.from("personal_notes").delete().eq("id", id);
            if (r.error) { b.disabled = false; toast(L("Gagal menghapus: ", "Could not delete: ") + r.error.message, "error"); return; }
            cache[k] = on(k).filter(function (n) { return n.id !== id; });
            list();
            if (opts.onChange) opts.onChange();
        });

        document.body.appendChild(w);
        requestAnimationFrame(function () { w.classList.add("in"); });
    }

    window.AttNotes = { load: load, on: on, mark: mark, open: open, ready: function () { return ready; } };
})();
