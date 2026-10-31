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
    var BILL = ["bill", "🧾", "Tagihan bulanan", "Monthly bills", "#64748B"];
    function cat(type, key) {
        key = key || "";
        if (key.indexOf("bill:") === 0 || key === "bill") return BILL;
        if (key.indexOf("c:") === 0) {
            var own = (state.meta.pf_cats || []).filter(function (c) { return c.id === key; })[0];
            return own ? [own.id, own.emoji || "🏷️", own.name, own.name, own.color || "#6366F1"] : [key, "🏷️", "Lainnya", "Other", "#94A3B8"];
        }
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
        var own = (state.meta.pf_cats || []).filter(function (c) { return (c.type || "tarik") === t; }).map(function (c) { return [c.id, c.emoji || "🏷️", c.name, c.name, c.color || "#6366F1"]; });
        var all = CATS[t].slice(0, -1).concat(own, [CATS[t][CATS[t].length - 1]]);
        box.innerHTML = '<div class="savings-field-label">' + esc(L("Kategori", "Category")) + '</div><div class="pf-chips">' +
            all.map(function (c) {
                return '<button type="button" class="pf-chip' + (c[0] === cur ? " on" : "") + '" data-c="' + esc(c[0]) + '" style="--c:' + c[4] + '"><span>' + esc(c[1]) + '</span>' + esc(catLabel(c)) + '</button>';
            }).join("") + '<button type="button" class="pf-chip add" data-pf="addcat">＋ ' + esc(L("Kategori sendiri", "Your own")) + '</button>' +
            (own.length ? '<button type="button" class="pf-chip add" data-pf="mancat">' + esc(L("Atur", "Manage")) + '</button>' : '') + '</div>';
    }
    document.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("#pfCats .pf-chip[data-c]");
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
            if (x.type === "tarik") { out.spent += a; var k = x.category || "lainnya"; if (k.indexOf("bill:") === 0) k = "bill"; out.byCat[k] = (out.byCat[k] || 0) + a; }
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

    // ---------- monthly bills: a checklist that resets every month ----------
    // pf_bills = [{ id, name, amount, day }] on the student's account. Ticking one records it as a
    // withdrawal (category "bill:<id>"), unticking removes that withdrawal again.
    function billPaid(b) {
        var key = ym(now());
        var row = state.list.filter(function (x) { return x.category === "bill:" + b.id && ym(new Date(x.created_at)) === key; })[0];
        if (row) return row;
        // ticked without taking it from the savings balance (paid with other money)
        var marks = (state.meta.pf_paid || {})[key] || {};
        return marks[b.id] ? { id: null, amount: b.amount, created_at: marks[b.id], outside: true } : null;
    }
    function renderBills() {
        var el = document.getElementById("pfBills");
        if (!el) return;
        var bills = (state.meta.pf_bills || []).slice().sort(function (a, b) { return (a.day || 99) - (b.day || 99); });
        if (!bills.length) {
            el.innerHTML = '<button type="button" class="pf-set" data-pf="addbill">🧾 ' + esc(L("Catat tagihan bulanan", "Add monthly bills")) + '<small>' + esc(L("Kost, listrik, wifi, cicilan… centang tiap sudah dibayar", "Rent, power, wifi… tick each one once paid")) + '</small></button>';
            el.hidden = false; return;
        }
        var today = now().getDate(), paidN = 0, total = 0, paidSum = 0;
        var rows = bills.map(function (b) {
            var p = billPaid(b), amt = Number(b.amount) || 0;
            total += amt; if (p) { paidN++; paidSum += Number(p.amount) || 0; }
            var st = p ? "paid" : !b.day ? "" : b.day < today ? "late" : b.day - today <= 3 ? "soon" : "";
            var sub = p ? L("Lunas " + new Date(p.created_at).getDate() + " " + monthNameOf(new Date(p.created_at).getMonth()), "Paid " + new Date(p.created_at).getDate() + " " + monthNameOf(new Date(p.created_at).getMonth()))
                : b.day ? (st === "late" ? L("Lewat tgl " + b.day, "Overdue since the " + b.day + "th") : b.day === today ? L("Hari ini (tgl " + b.day + ")", "Today") : L("Tiap tgl " + b.day, "Every " + b.day + "th")) : L("Belum dibayar", "Not paid yet");
            return '<div class="pf-bill ' + st + '"><button type="button" class="pf-check" data-bill="' + esc(b.id) + '" aria-pressed="' + (p ? "true" : "false") + '" aria-label="' + esc(L("Tandai lunas ", "Mark paid ") + b.name) + '">' + (p ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>' : '') + '</button>' +
                '<button type="button" class="pf-bill-t" data-billedit="' + esc(b.id) + '"><b>' + esc(b.name) + '</b><small>' + esc(sub) + '</small></button><span class="pf-bill-amt">' + rp(amt) + '</span></div>';
        }).join("");
        el.innerHTML = '<div class="pf-head"><b>🧾 ' + esc(L("Tagihan bulan ini", "This month's bills")) + '</b><small>' + paidN + "/" + bills.length + " " + esc(L("lunas", "paid")) + '</small></div>' +
            '<div class="pf-bar bills"><i style="width:' + Math.round(paidN / bills.length * 100) + '%"></i></div>' + rows +
            '<div class="pf-bill-foot"><span>' + esc(L("Total per bulan ", "Monthly total ")) + '<b>' + rp(total) + '</b></span><button type="button" class="pf-link" data-pf="addbill">＋ ' + esc(L("Tambah", "Add")) + '</button></div>';
        el.hidden = false;
    }
    async function toggleBill(id, btn) {
        var b = (state.meta.pf_bills || []).filter(function (x) { return x.id === id; })[0];
        if (!b) return;
        btn.disabled = true;
        var p = billPaid(b), r, key = ym(now());
        function mark(on) {
            var all = Object.assign({}, state.meta.pf_paid || {}), m = Object.assign({}, all[key] || {});
            if (on) m[b.id] = new Date().toISOString(); else delete m[b.id];
            all = {}; all[key] = m;                      // only this month's marks are kept
            return saveMeta({ pf_paid: all });
        }
        if (p && p.outside) { btn.disabled = false; if (await mark(false)) showToast(L("Tanda lunas dibatalkan", "Unmarked"), "success"); return; }
        if (p) r = await supabaseClient.from("personal_savings").delete().eq("id", p.id);
        else {
            var amt = Number(b.amount) || 0;
            if (amt > balance(state.list)) {
                btn.disabled = false;
                if (typeof attConfirm !== "function") await new Promise(function (ok) { var sc = document.createElement("script"); sc.src = "js/avatarcrop.js?v=" + (window.attAppVer ? attAppVer() : "1"); sc.onload = ok; sc.onerror = ok; document.head.appendChild(sc); });
                var go = typeof attConfirm === "function" ? await attConfirm({ title: L("Saldo tabungan kurang", "Not enough savings"), text: L("Saldo tabungan pribadimu belum cukup untuk " + b.name + ". Tetap tandai lunas tanpa mengurangi saldo (dibayar pakai uang lain)?", "Your savings can't cover " + b.name + ". Mark it paid without taking it from your balance?"), ok: L("Tandai lunas", "Mark paid") }) : false;
                if (go && await mark(true)) showToast(L(b.name + " lunas ✔", b.name + " paid ✔"), "success");
                return;
            }
            r = await supabaseClient.from("personal_savings").insert({ student_id: state.uid, type: "tarik", amount: amt, note: b.name, category: "bill:" + b.id });
            if (r.error && /category/i.test(r.error.message || "")) { btn.disabled = false; showToast(L("Fitur tagihan butuh personal_finance.sql dijalankan dulu.", "Bills need personal_finance.sql to be run first."), "error"); return; }
        }
        btn.disabled = false;
        if (r.error) { showToast(L("Gagal: ", "Failed: ") + r.error.message, "error"); return; }
        showToast(p ? L("Tanda lunas dibatalkan", "Unmarked") : L(b.name + " lunas ✔ — dicatat sebagai pengeluaran", b.name + " paid ✔ — recorded as spending"), "success");
        window.__pfAfterAdd = !p;
        if (typeof loadPersonalSavings === "function") loadPersonalSavings();
    }
    function billReminders() {
        var today = now().getDate();
        (state.meta.pf_bills || []).forEach(function (b) {
            if (!b.day || billPaid(b)) return;
            var d = b.day - today, lvl = d === 1 ? "h1" : d === 0 ? "h0" : "";
            if (!lvl) return;
            var key = "pf-bill-" + state.uid + "-" + b.id + "-" + ym(now()) + "-" + lvl;
            try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) { return; }
            notify("🧾 " + (lvl === "h0" ? L("Hari ini bayar ", "Due today: ") : L("Besok bayar ", "Due tomorrow: ")) + b.name + " (" + rp(b.amount) + ")");
        });
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
                    return '<label class="pf-f"><span>' + esc(f.label) + '</span>' + (f.num ? '<input type="number" inputmode="numeric" min="1" max="31" data-i="' + i + '" class="am-field" placeholder="' + esc(f.ph || "") + '">' : f.money ? '<div class="savings-amount-field"><span class="rp-prefix">Rp</span><input data-money data-i="' + i + '" class="am-field" placeholder="' + esc(f.ph || "") + '"></div>' : '<input data-i="' + i + '" class="am-field" maxlength="40" placeholder="' + esc(f.ph || "") + '">') + '</label>';
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
        renderMonth(); renderGoal(); renderBills(); chips();
        return true;
    }
    document.addEventListener("click", async function (e) {
        var ck = e.target.closest && e.target.closest("[data-bill]");
        if (ck) { toggleBill(ck.dataset.bill, ck); return; }
        var ed = e.target.closest && e.target.closest("[data-billedit]");
        if (ed) { editBill(ed.dataset.billedit); return; }
        var b = e.target.closest && e.target.closest("[data-pf]");
        if (!b) return;
        if (b.dataset.pf === "addbill") { editBill(null); return; }
        if (b.dataset.pf === "addcat") {
            var v0 = await sheet({ title: L("Kategori sendiri", "Your own category"), sub: L("Misal: Kost, Listrik, Bensin, Skincare", "e.g. Rent, Power, Fuel"),
                fields: [{ label: L("Nama kategori", "Name"), ph: L("Kost", "Rent") }, { label: L("Emoji (boleh kosong)", "Emoji (optional)"), ph: "🏠" }] });
            if (!v0 || v0.__clear || !v0[0]) return;
            var palette = ["#6366F1", "#0EA5E9", "#F97316", "#14B8A6", "#EC4899", "#84CC16", "#A855F7", "#EF4444"];
            var mine = (state.meta.pf_cats || []).slice();
            var nc = { id: "c:" + Math.random().toString(36).slice(2, 8), name: v0[0].slice(0, 24), emoji: (v0[1] || "").slice(0, 4) || "🏷️", type: state.type, color: palette[mine.length % palette.length] };
            mine.push(nc);
            if (await saveMeta({ pf_cats: mine })) { state.picked[state.type] = nc.id; chips(); }
            return;
        }
        if (b.dataset.pf === "mancat") {
            var own = (state.meta.pf_cats || []);
            if (typeof attSheet !== "function") await new Promise(function (ok) { var sc = document.createElement("script"); sc.src = "js/avatarcrop.js?v=" + (window.attAppVer ? attAppVer() : "1"); sc.onload = ok; sc.onerror = ok; document.head.appendChild(sc); });
            var pick = typeof attSheet === "function" ? await attSheet({ title: L("Hapus kategori sendiri", "Remove your categories"), items: own.map(function (c) { return { label: (c.emoji || "🏷️") + " " + c.name, value: c.id, danger: true }; }) }) : null;
            if (!pick) return;
            if (await saveMeta({ pf_cats: own.filter(function (c) { return c.id !== pick; }) })) { if (state.picked[state.type] === pick) state.picked[state.type] = CATS[state.type][0][0]; chips(); }
            return;
        }
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

    async function editBill(id) {
        var bills = (state.meta.pf_bills || []).slice(), b = bills.filter(function (x) { return x.id === id; })[0] || {};
        var v = await sheet({ title: id ? L("Ubah tagihan", "Edit bill") : L("Tagihan bulanan", "Monthly bill"), sub: L("Tagihan yang sama tiap bulan. Centang kalau sudah dibayar — otomatis tercatat sebagai pengeluaran.", "The same every month. Tick it once paid — it's recorded as spending."),
            fields: [{ label: L("Nama tagihan", "Bill"), ph: L("Uang kost", "Rent"), value: b.name || null }, { label: L("Jumlah per bulan", "Amount per month"), money: true, ph: "500.000", value: b.amount || null }, { label: L("Bayar tiap tanggal (boleh kosong)", "Due day of the month (optional)"), num: true, ph: "5", value: b.day || null }],
            clear: id ? L("Hapus tagihan", "Delete bill") : "" });
        if (!v) return;
        if (v.__clear) { await saveMeta({ pf_bills: bills.filter(function (x) { return x.id !== id; }) }); return; }
        var amt = Number(v[1]), day = Math.min(31, Math.max(0, parseInt(v[2], 10) || 0));
        if (!v[0] || !amt) { showToast(L("Isi nama dan jumlahnya dulu", "Fill in the name and amount"), "error"); return; }
        var nb = { id: b.id || Math.random().toString(36).slice(2, 8), name: v[0].slice(0, 40), amount: amt, day: day || null };
        if (id) bills = bills.map(function (x) { return x.id === id ? nb : x; }); else bills.push(nb);
        if (await saveMeta({ pf_bills: bills })) showToast(L("Tagihan disimpan", "Bill saved"), "success");
    }

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
            renderMonth(); renderBills(); renderGoal(); chips();
            checkBudget(!!afterAdd);
            billReminders();
        }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", chips); else chips();
})();
