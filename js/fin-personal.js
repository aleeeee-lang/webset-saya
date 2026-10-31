// Personal money (Uang -> Pribadi): more than a piggy bank.
//   - a category for every deposit / withdrawal (personal_savings.category, personal_finance.sql)
//   - "this month": spent / received, compared with last month, by category
//   - a monthly spending limit with a warning (80% / over) - also into Notifications
//   - one savings goal with progress and an estimate of when it is reached
// The limit and the goal are the student's own (kept on their account, nobody else sees them).
(function () {
    function L(id, en) { return (typeof getLang === "function" ? getLang() : "id") === "id" ? id : en; }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function rp(n) { return typeof formatRupiah === "function" ? formatRupiah(n) : "Rp" + Math.round(n).toLocaleString("id-ID"); }

    var CATS = {
        tarik: [
            ["jajan", "🍜", "Jajan & makan", "Snacks & food", "#F97316"],
            ["transport", "🚌", "Transport", "Transport", "#0EA5E9"],
            ["pulsa", "📶", "Pulsa & internet", "Phone & data", "#8B5CF6"],
            ["sekolah", "📚", "Sekolah & buku", "School & books", "#22C55E"],
            ["hiburan", "🎮", "Hiburan", "Fun", "#EC4899"],
            ["belanja", "🛍️", "Belanja", "Shopping", "#EAB308"],
            ["sedekah", "🤲", "Sedekah", "Charity", "#14B8A6"],
            ["lainnya", "•", "Lainnya", "Other", "#94A3B8"]
        ],
        setor: [
            ["saku", "💵", "Uang saku", "Allowance", "#22C55E"],
            ["hadiah", "🎁", "Hadiah", "Gift", "#EC4899"],
            ["kerja", "💼", "Hasil kerja", "Earnings", "#0EA5E9"],
            ["lainnya", "•", "Lainnya", "Other", "#94A3B8"]
        ]
    };
    function cat(type, key) {
        var list = CATS[type] || CATS.tarik;
        for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i];
        return list[list.length - 1];
    }
    function catLabel(c) { return L(c[2], c[3]); }

    var state = { type: "setor", picked: { setor: "saku", tarik: "jajan" }, uid: null, meta: {}, list: [] };

    // ---------- category chips in the form ----------
    function chips() {
        var box = document.getElementById("pfCats");
        if (!box) return;
        var t = state.type, cur = state.picked[t];
        box.innerHTML = '<div class="savings-field-label">' + esc(L("Kategori", "Category")) + '</div><div class="pf-chips">' +
            CATS[t].map(function (c) {
                return '<button type="button" class="pf-chip' + (c[0] === cur ? " on" : "") + '" data-c="' + c[0] + '" style="--c:' + c[4] + '"><span>' + c[1] + '</span>' + esc(catLabel(c)) + '</button>';
            }).join("") + '</div>';
    }
    document.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("#pfCats .pf-chip");
        if (!b) return;
        state.picked[state.type] = b.dataset.c;
        chips();
    });

    // ---------- month maths ----------
    function ym(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
    function now() { return typeof attNow === "function" ? attNow() : new Date(); }
    function monthStats(list, offset) {
        var n = now(), d = new Date(n.getFullYear(), n.getMonth() + (offset || 0), 1), key = ym(d);
        var out = { spent: 0, got: 0, byCat: {} };
        list.forEach(function (x) {
            if (ym(new Date(x.created_at)) !== key) return;
            var a = Number(x.amount) || 0;
            if (x.type === "tarik") { out.spent += a; var k = x.category || "lainnya"; out.byCat[k] = (out.byCat[k] || 0) + a; }
            else out.got += a;
        });
        return out;
    }
    function balance(list) {
        return list.reduce(function (s, x) { return s + (x.type === "setor" ? 1 : -1) * (Number(x.amount) || 0); }, 0);
    }

    // ---------- "this month" card ----------
    function renderMonth() {
        var el = document.getElementById("pfMonth");
        if (!el) return;
        var m = monthStats(state.list, 0), prev = monthStats(state.list, -1);
        var n = now(), daysIn = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate(), day = n.getDate(), left = daysIn - day + 1;
        var budget = Number(state.meta.pf_budget) || 0;
        var html = '<div class="pf-head"><b>' + esc(L("Bulan ini", "This month")) + '</b><small>' + esc(monthNameOf(n.getMonth()) + " " + n.getFullYear()) + '</small></div>';
        html += '<div class="pf-two"><div><small>' + esc(L("Pengeluaran", "Spent")) + '</small><b class="out">' + rp(m.spent) + '</b></div><div><small>' + esc(L("Pemasukan", "Received")) + '</small><b class="in">' + rp(m.got) + '</b></div></div>';
        if (prev.spent > 0) {
            var diff = Math.round((m.spent - prev.spent) / prev.spent * 100);
            html += '<p class="pf-cmp ' + (diff > 0 ? "up" : "down") + '">' + esc(diff > 0 ? L("Naik " + diff + "% dari bulan lalu", diff + "% more than last month") : diff < 0 ? L("Turun " + (-diff) + "% dari bulan lalu 👍", (-diff) + "% less than last month 👍") : L("Sama dengan bulan lalu", "Same as last month")) + '</p>';
        }
        // spending limit
        if (budget > 0) {
            var pct = m.spent / budget, rest = budget - m.spent;
            var lvl = pct >= 1 ? "over" : pct >= 0.8 ? "warn" : "ok";
            html += '<div class="pf-budget ' + lvl + '"><div class="pf-budget-top"><span>' + esc(L("Batas jajan", "Spending limit")) + ' · ' + rp(budget) + '</span><button type="button" class="pf-link" data-pf="budget">' + esc(L("Ubah", "Edit")) + '</button></div>' +
                '<div class="pf-bar"><i style="width:' + Math.min(100, Math.round(pct * 100)) + '%"></i></div>' +
                '<small>' + esc(rest >= 0
                    ? L("Sisa " + rp(rest) + " · aman " + rp(Math.floor(rest / left)) + "/hari sampai akhir bulan", rp(rest) + " left · " + rp(Math.floor(rest / left)) + "/day until month end")
                    : L("Lewat " + rp(-rest) + " dari batas", rp(-rest) + " over the limit")) + '</small></div>';
        } else {
            html += '<button type="button" class="pf-set" data-pf="budget">＋ ' + esc(L("Atur batas jajan bulanan", "Set a monthly spending limit")) + '</button>';
        }
        // by category
        var cats = Object.keys(m.byCat).sort(function (a, b) { return m.byCat[b] - m.byCat[a]; });
        if (cats.length) {
            html += '<div class="pf-cats-sum">' + cats.slice(0, 5).map(function (k) {
                var c = cat("tarik", k), v = m.byCat[k];
                return '<div class="pf-row"><span class="pf-ic" style="--c:' + c[4] + '">' + c[1] + '</span><span class="pf-row-t">' + esc(catLabel(c)) + '<i style="width:' + Math.max(4, Math.round(v / m.spent * 100)) + '%;background:' + c[4] + '"></i></span><b>' + rp(v) + '</b></div>';
            }).join("") + '</div>';
            if (day > 0) html += '<p class="pf-avg">' + esc(L("Rata-rata " + rp(Math.round(m.spent / day)) + " per hari", "Average " + rp(Math.round(m.spent / day)) + " a day")) + '</p>';
        } else {
            html += '<p class="pf-avg">' + esc(L("Belum ada pengeluaran bulan ini.", "No spending this month yet.")) + '</p>';
        }
        el.innerHTML = html;
        el.hidden = false;
    }

    // ---------- savings goal card ----------
    function renderGoal() {
        var el = document.getElementById("pfGoal");
        if (!el) return;
        var g = state.meta.pf_goal;
        if (!g || !g.target) {
            el.innerHTML = '<button type="button" class="pf-set" data-pf="goal">🎯 ' + esc(L("Buat target tabungan", "Set a savings goal")) + '<small>' + esc(L("Misal: beli sepatu, HP, liburan", "e.g. shoes, a phone, a trip")) + '</small></button>';
            el.hidden = false; return;
        }
        var bal = Math.max(0, balance(state.list)), pct = Math.min(1, bal / g.target), need = Math.max(0, g.target - bal);
        // how fast money is being saved: net of the last 60 days
        var since = Date.now() - 60 * 86400000, net = 0;
        state.list.forEach(function (x) { if (new Date(x.created_at).getTime() >= since) net += (x.type === "setor" ? 1 : -1) * (Number(x.amount) || 0); });
        var perDay = net / 60, eta = "";
        if (need === 0) eta = L("Tercapai! 🎉 Saldomu sudah cukup.", "Reached! 🎉 You have enough.");
        else if (perDay > 0) {
            var d = new Date(Date.now() + Math.ceil(need / perDay) * 86400000);
            eta = L("Kurang " + rp(need) + " · kira-kira tercapai " + d.getDate() + " " + monthNameOf(d.getMonth()) + " " + d.getFullYear(), rp(need) + " to go · around " + d.getDate() + " " + monthNameOf(d.getMonth()) + " " + d.getFullYear());
        } else eta = L("Kurang " + rp(need) + " · nabung rutin biar cepat tercapai", rp(need) + " to go · save regularly to get there");
        el.innerHTML = '<div class="pf-head"><b>🎯 ' + esc(g.name || L("Target tabungan", "Savings goal")) + '</b><button type="button" class="pf-link" data-pf="goal">' + esc(L("Ubah", "Edit")) + '</button></div>' +
            '<div class="pf-goal-nums"><b>' + rp(Math.min(bal, g.target)) + '</b><span>/ ' + rp(g.target) + '</span><em>' + Math.round(pct * 100) + '%</em></div>' +
            '<div class="pf-bar goal' + (pct >= 1 ? " done" : "") + '"><i style="width:' + Math.round(pct * 100) + '%"></i></div><small class="pf-eta">' + esc(eta) + '</small>';
        el.hidden = false;
    }

    // ---------- warnings (once per month per level) ----------
    function notify(text) {
        try {
            var k = "attendreem-notifications-" + state.uid, list = JSON.parse(localStorage.getItem(k) || "[]");
            list.unshift({ text: text, time: Date.now(), read: false });
            localStorage.setItem(k, JSON.stringify(list.slice(0, 20)));
        } catch (e) {}
    }
    function checkBudget(toast) {
        var budget = Number(state.meta.pf_budget) || 0;
        if (!budget || !state.uid) return;
        var m = monthStats(state.list, 0), pct = m.spent / budget, lvl = pct >= 1 ? "100" : pct >= 0.8 ? "80" : "";
        if (!lvl) return;
        var key = "pf-warn-" + state.uid + "-" + ym(now()) + "-" + lvl;
        try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) { return; }
        var msg = lvl === "100"
            ? L("💸 Pengeluaranmu bulan ini sudah melewati batas jajan (" + rp(budget) + ").", "💸 This month's spending is over your limit (" + rp(budget) + ").")
            : L("⚠️ Pengeluaranmu bulan ini sudah " + Math.round(pct * 100) + "% dari batas jajan.", "⚠️ You've used " + Math.round(pct * 100) + "% of this month's spending limit.");
        notify(msg);
        if (toast && typeof showToast === "function") showToast(msg, lvl === "100" ? "error" : "warning");
    }

    // ---------- small bottom sheet with one or two fields ----------
    function sheet(o) {
        return new Promise(function (resolve) {
            var w = document.createElement("div");
            w.className = "tc-sheet-wrap";
            w.innerHTML = '<div class="tc-sheet pf-sheet" role="dialog" aria-modal="true"><div class="tc-sheet-grip"></div><h2></h2><p class="tc-sheet-sub"></p><form>' +
                o.fields.map(function (f, i) {
                    return '<label class="pf-f"><span>' + esc(f.label) + '</span>' + (f.money ? '<div class="savings-amount-field"><span class="rp-prefix">Rp</span><input data-money data-i="' + i + '" class="am-field" placeholder="' + esc(f.ph || "") + '"></div>' : '<input data-i="' + i + '" class="am-field" maxlength="40" placeholder="' + esc(f.ph || "") + '">') + '</label>';
                }).join("") +
                '<button type="submit" class="savings-submit-btn">' + esc(L("Simpan", "Save")) + '</button>' + (o.clear ? '<button type="button" class="pf-clear">' + esc(o.clear) + '</button>' : '') + '</form></div>';
            w.querySelector("h2").textContent = o.title;
            w.querySelector(".tc-sheet-sub").textContent = o.sub || "";
            document.body.appendChild(w);
            var ins = w.querySelectorAll("input");
            ins.forEach(function (inp, i) { if (window.AttMoney && inp.hasAttribute("data-money")) AttMoney.setup(inp); if (o.fields[i].value != null) inp.value = o.fields[i].value; });
            document.documentElement.classList.add("tc-sheet-open");
            requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add("in"); }); });
            function close(v) { w.classList.remove("in"); document.documentElement.classList.remove("tc-sheet-open"); setTimeout(function () { w.remove(); }, 220); resolve(v); }
            w.addEventListener("click", function (e) { if (e.target === w) close(null); });
            var cl = w.querySelector(".pf-clear");
            if (cl) cl.addEventListener("click", function () { close({ __clear: true }); });
            w.querySelector("form").addEventListener("submit", function (e) {
                e.preventDefault();
                close(Array.prototype.map.call(ins, function (x) { return x.value.trim(); }));
            });
        });
    }
    async function saveMeta(patch) {
        var r = await supabaseClient.auth.updateUser({ data: patch });
        if (r.error) { showToast(L("Gagal menyimpan: ", "Couldn't save: ") + r.error.message, "error"); return false; }
        Object.keys(patch).forEach(function (k) { state.meta[k] = patch[k]; });
        renderMonth(); renderGoal();
        return true;
    }
    document.addEventListener("click", async function (e) {
        var b = e.target.closest && e.target.closest("[data-pf]");
        if (!b) return;
        if (b.dataset.pf === "budget") {
            var cur = Number(state.meta.pf_budget) || 0;
            var v = await sheet({ title: L("Batas jajan bulanan", "Monthly spending limit"), sub: L("Kamu dikasih tahu waktu pengeluaran bulan ini sudah 80% dan kalau lewat batas.", "You'll be told at 80% and when you go over."),
                fields: [{ label: L("Batas per bulan", "Limit per month"), money: true, ph: "300.000", value: cur || null }], clear: cur ? L("Hapus batas", "Remove limit") : "" });
            if (!v) return;
            if (v.__clear) { await saveMeta({ pf_budget: null }); return; }
            var n = Number(v[0]); if (!n) return;
            if (await saveMeta({ pf_budget: n })) { showToast(L("Batas jajan disimpan", "Limit saved"), "success"); checkBudget(true); }
        } else {
            var g = state.meta.pf_goal || {};
            var r = await sheet({ title: L("Target tabungan", "Savings goal"), sub: L("Progresnya dihitung dari saldo tabungan pribadimu.", "Progress uses your personal savings balance."),
                fields: [{ label: L("Mau nabung untuk apa?", "Saving for?"), ph: L("Beli sepatu", "New shoes"), value: g.name || null }, { label: L("Target", "Target"), money: true, ph: "300.000", value: g.target || null }],
                clear: g.target ? L("Hapus target", "Remove goal") : "" });
            if (!r) return;
            if (r.__clear) { await saveMeta({ pf_goal: null }); return; }
            var t = Number(r[1]); if (!t) return;
            if (await saveMeta({ pf_goal: { name: r[0] || "", target: t } })) showToast(L("Target disimpan", "Goal saved"), "success");
        }
    });

    window.PF = {
        cat: cat, catLabel: catLabel,
        setType: function (t) { state.type = t; chips(); },
        category: function () { return state.picked[state.type] || null; },
        // after the list (re)loads; afterAdd = a transaction was just added (warn about the limit)
        render: async function (list, afterAdd) {
            state.list = list || [];
            if (!state.uid) {
                try {
                    var u = (await supabaseClient.auth.getUser()).data.user;
                    state.uid = u && u.id; state.meta = (u && u.user_metadata) || {};
                } catch (e) {}
            }
            renderMonth(); renderGoal();
            checkBudget(!!afterAdd);
        }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", chips); else chips();
})();
