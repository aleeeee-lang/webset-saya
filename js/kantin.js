// Kantin (canteen / koperasi), 2026-11.
// Students: browse the menu (with photos), order, pay by saldo or cash, follow the order, show a pay QR.
// Canteen staff (role "koperasi") and admin: incoming orders, counter sales, items + photos, report.
// Money moves only inside the database functions in kantin.sql.
(function () {
    var ID = (typeof getLang === "function" ? getLang() : "id") === "id";
    function PL(a, b) { return ID ? a : b; }
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function rp(n) { return "Rp" + Number(n || 0).toLocaleString("id-ID"); }
    function toast(m, t) { if (typeof showToast === "function") showToast(m, t || "success"); }
    function $(id) { return document.getElementById(id); }
    function errMsg(e) { var m = (e && (e.message || e.details)) || String(e || ""); return m.replace(/^.*?ERROR:\s*/, ""); }
    var SV = function (d, w) { return '<svg viewBox="0 0 24 24" width="' + (w || 20) + '" height="' + (w || 20) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
    var IC = {
        bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        minus: '<path d="M5 12h14"/>',
        qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2"/>',
        cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
        file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        eyeOff: '<path d="M3 3l18 18"/><path d="M9.9 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.7 3.5M6.7 6.7C4 8.3 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.4-1"/><path d="M9.9 14.1a3 3 0 0 1 4.2-4.2"/>',
        gal: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
    };
    var STATUS = {
        baru: [PL("Menunggu", "Waiting"), "new"], dibuat: [PL("Dibuat", "Making"), "wait"], siap: [PL("Siap diambil", "Ready"), "ok"],
        selesai: [PL("Selesai", "Done"), "done"], ditolak: [PL("Ditolak", "Declined"), "bad"], batal: [PL("Dibatalkan", "Cancelled"), "bad"]
    };

    // item kinds (kantin.sql keeps the same list)
    var CATS = [
        ["makanan", PL("Makanan", "Food"), '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-1.7 1-3 3.2-3 6v4h3v8"/>'],
        ["minuman", PL("Minuman", "Drinks"), '<path d="M7 4h10l-1.5 16h-7z"/><path d="M7.5 9h9M12 4l1-2"/>'],
        ["jajanan", PL("Jajanan", "Snacks"), '<circle cx="12" cy="12" r="8"/><circle cx="9.5" cy="10" r=".9"/><circle cx="14" cy="9.5" r=".9"/><circle cx="13.5" cy="14" r=".9"/><circle cx="9.5" cy="14.5" r=".9"/>'],
        ["sekolah", PL("Alat sekolah", "School supplies"), '<path d="M15 4l5 5L9 20H4v-5z"/><path d="M13 6l5 5"/>'],
        ["lainnya", PL("Lainnya", "Other"), '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>']
    ];
    function catName(k) { var c = CATS.find(function (x) { return x[0] === k; }) || CATS[CATS.length - 1]; return c[1]; }
    var me = null, items = [], cart = {}, mode = "", balance = 0, filter = "", query = "";
    // filter chips above a grid; only kinds that have items show up
    function chipsHTML() {
        var have = {}; items.forEach(function (x) { if (x.active) have[x.category || "lainnya"] = 1; });
        var list = CATS.filter(function (c) { return have[c[0]]; });
        if (list.length < 2) { filter = ""; return ""; }
        if (filter && !have[filter]) filter = "";
        return '<div class="kn-chips">' + '<button type="button" data-cat=""' + (filter ? '' : ' class="on"') + '>' + PL("Semua", "All") + '</button>' +
            list.map(function (c) { return '<button type="button" data-cat="' + c[0] + '"' + (filter === c[0] ? ' class="on"' : '') + '>' + SV(c[2], 16) + '<span>' + c[1] + '</span></button>'; }).join("") + '</div>';
    }

    // ---------- small sheet with custom content ----------
    function sheet(html, onReady) {
        var w = document.createElement("div");
        w.className = "ac-wrap ac-confirm kn-sheet";
        w.innerHTML = '<div class="ac-card">' + html + '</div>';
        document.body.appendChild(w);
        requestAnimationFrame(function () { w.classList.add("in"); });
        var api = { el: w, close: function () { w.classList.add("out"); setTimeout(function () { w.remove(); }, 160); if (api.onClose) api.onClose(); } };
        w.addEventListener("click", function (e) { if (e.target === w || e.target.closest("[data-close]")) api.close(); });
        if (onReady) onReady(w, api);
        return api;
    }
    function photoHTML(it, cls) {
        return it.photo ? '<img class="' + (cls || "") + '" src="' + esc(it.photo) + '" alt="" loading="lazy">' : '<span class="kn-noimg ' + (cls || "") + '">' + SV(IC.bag, 26) + '</span>';
    }

    // ---------- items ----------
    async function loadItems() {
        var r = await supabaseClient.from("kantin_items").select("*").order("name", { ascending: true });
        items = (r && r.data) || [];
    }
    function cartList() {
        return Object.keys(cart).filter(function (k) { return cart[k] > 0; }).map(function (k) {
            var it = items.find(function (x) { return x.id === k; });
            return it ? { it: it, qty: cart[k] } : null;
        }).filter(Boolean);
    }
    function cartTotal() { return cartList().reduce(function (a, l) { return a + l.it.price * l.qty; }, 0); }
    function cartCount() { return cartList().reduce(function (a, l) { return a + l.qty; }, 0); }

    function gridHTML(staff) {
        var q = query.trim().toLowerCase();
        var list = items.filter(function (x) { return x.active && (!filter || (x.category || "lainnya") === filter) && (!q || String(x.name).toLowerCase().indexOf(q) !== -1); });
        if (!list.length && q) return chipsHTML() + '<div class="kn-empty">' + SV(IC.bag, 28) + '<b>' + PL("Tidak ketemu", "Nothing found") + '</b><small>' + PL("Coba kata lain.", "Try another word.") + '</small></div>';
        if (!list.length) return '<div class="kn-empty">' + SV(IC.bag, 28) + '<b>' + PL("Belum ada barang", "No items yet") + '</b>' + (staff ? '<small>' + PL("Tambah barang di tab Barang.", "Add items in the Items tab.") + '</small>' : '') + '</div>';
        return chipsHTML() + list.map(function (it) {
            var q = cart[it.id] || 0, out = it.stock <= 0;
            var btn = out ? '' : (q ? '<span class="kn-qty"><button type="button" data-minus="' + it.id + '" aria-label="-">' + SV(IC.minus, 16) + '</button><b>' + q + '</b><button type="button" data-plus="' + it.id + '" aria-label="+">' + SV(IC.plus, 16) + '</button></span>'
                : '<button type="button" class="kn-plus" data-plus="' + it.id + '" aria-label="+">' + SV(IC.plus, 18) + '</button>');
            var low = !out && it.stock <= 5;
            return '<div class="kn-food' + (out ? " out" : "") + (q ? " picked" : "") + '" data-view="' + it.id + '"><div class="kn-img">' + photoHTML(it) + btn + '</div>' +
                '<div class="kn-bd"><p>' + esc(it.name) + '</p><span class="kn-price">' + (out ? PL("Habis", "Sold out") : rp(it.price)) + '</span>' +
                (!out ? '<small class="' + (low ? "low" : "") + '">' + (staff ? PL("Stok ", "Stock ") : PL("Sisa ", "Left ")) + it.stock + '</small>' : '') + '</div></div>';
        }).join("");
    }
    // redraw a grid without the kind chips jumping back to the start
    function redrawGrid(box, staff) {
        var old = box.querySelector(".kn-chips"), sl = old ? old.scrollLeft : 0;
        box.innerHTML = gridHTML(staff);
        var c = box.querySelector(".kn-chips");
        if (!c) return;
        c.scrollLeft = sl;
        var on = c.querySelector(".on");
        if (on) {
            var l = on.offsetLeft - c.offsetLeft, r = l + on.offsetWidth;
            if (l < c.scrollLeft) c.scrollLeft = l - 16;
            else if (r > c.scrollLeft + c.clientWidth) c.scrollLeft = r - c.clientWidth + 16;
        }
    }
    function bindGrid(box, after) {
        box.onclick = function (e) {
            var ch = e.target.closest("[data-cat]");
            if (ch) { filter = ch.getAttribute("data-cat"); after(); return; }
            var p = e.target.closest("[data-plus]"), m = e.target.closest("[data-minus]");
            if (!p && !m) {
                // tap the card itself: a bigger look at the item
                var v = e.target.closest("[data-view]");
                if (v) viewItem(v.getAttribute("data-view"), after);
                return;
            }
            var id = (p || m).getAttribute(p ? "data-plus" : "data-minus");
            var it = items.find(function (x) { return x.id === id; }); if (!it) return;
            var q = (cart[id] || 0) + (p ? 1 : -1);
            if (q > it.stock) { toast(PL("Stok tinggal ", "Only ") + it.stock, "error"); return; }
            cart[id] = Math.max(0, q);
            after();
        };
    }
    function viewItem(id, after) {
        var it = items.find(function (x) { return x.id === id; }); if (!it) return;
        var out = it.stock <= 0;
        sheet('<div class="kn-view-img">' + photoHTML(it) + '</div>' +
            '<div class="kn-view-t"><b>' + esc(it.name) + '</b><small>' + catName(it.category) + (out ? '' : ' · ' + PL("Sisa ", "Left ") + it.stock) + '</small></div>' +
            '<div class="kn-view-row"><span class="kn-view-price' + (out ? ' out' : '') + '">' + (out ? PL("Habis", "Sold out") : rp(it.price)) + '</span>' +
            (out ? '' : '<span class="kn-view-qty"><button type="button" data-q="-1" aria-label="-">' + SV(IC.minus, 18) + '</button><b>0</b><button type="button" data-q="1" aria-label="+">' + SV(IC.plus, 18) + '</button></span>') + '</div>' +
            '<div class="ac-actions' + (out ? ' one' : '') + '">' + (out ? '' : '<button type="button" class="ac-cancel" data-close>' + PL("Tutup", "Close") + '</button>') +
            '<button type="button" class="ac-ok kn-view-ok"' + (out ? ' data-close' : '') + '>' + (out ? PL("Tutup", "Close") : PL("Tambahkan", "Add")) + '</button></div>', function (w, api) {
            if (out) return;
            var q = cart[id] || 0, qb = w.querySelector(".kn-view-qty b");
            function show() { qb.textContent = q; }
            show();
            w.querySelector(".kn-view-qty").onclick = function (e) {
                var b = e.target.closest("[data-q]"); if (!b) return;
                var n = q + Number(b.getAttribute("data-q"));
                if (n > it.stock) { toast(PL("Stok tinggal ", "Only ") + it.stock, "error"); return; }
                q = Math.max(0, n); show();
            };
            w.querySelector(".kn-view-ok").onclick = function () { cart[id] = q; api.close(); after(); };
        });
    }
    function drawCart(btns) {
        var n = cartCount(), bar = $("knCart");
        bar.hidden = !n;
        document.documentElement.classList.toggle("kn-has-cart", !!n);
        if (!n) return;
        $("knCartN").textContent = n + PL(" item", n > 1 ? " items" : " item");
        $("knCartT").textContent = rp(cartTotal());
        $("knCartBtns").innerHTML = btns;
    }

    // ================= STUDENT =================
    async function loadBalance() {
        var r = await supabaseClient.from("savings").select("type,amount").eq("student_id", me.id);
        balance = ((r && r.data) || []).reduce(function (a, x) { return a + (x.type === "setor" ? 1 : -1) * Number(x.amount || 0); }, 0);
        var p = $("knPill"); p.hidden = false; p.textContent = rp(balance); p.title = PL("Saldo tabungan sekolah", "School savings balance");
    }
    function drawStudentMenu() {
        var box = $("knMenu");
        redrawGrid(box, false);
        bindGrid(box, drawStudentMenu);
        drawCart('<button type="button" class="kn-go" id="knOrderGo">' + PL("Pesan", "Order") + '</button>');
        var go = $("knOrderGo"); if (go) go.onclick = orderSheet;
    }
    function orderSheet() {
        var lines = cartList(), tot = cartTotal(), pay = balance >= tot ? "saldo" : "tunai";
        var html = '<div class="ac-top"><b>' + PL("Pesananmu", "Your order") + '</b></div>' +
            '<div class="kn-lines">' + lines.map(function (l) { return '<div><span>' + l.qty + '× ' + esc(l.it.name) + '</span><b>' + rp(l.it.price * l.qty) + '</b></div>'; }).join("") +
            '<div class="kn-lines-tot"><span>Total</span><b>' + rp(tot) + '</b></div></div>' +
            '<div class="savings-field-label">' + PL("Bayar pakai", "Pay with") + '</div>' +
            '<div class="kn-pay"><button type="button" data-pay="saldo"' + (balance < tot ? ' disabled' : '') + '><b>' + PL("Saldo", "Balance") + '</b><small>' + (balance < tot ? PL("Saldo kurang", "Not enough") : rp(balance)) + '</small></button>' +
            '<button type="button" data-pay="tunai"><b>' + PL("Tunai", "Cash") + '</b><small>' + PL("Bayar saat ambil", "Pay at pickup") + '</small></button></div>' +
            '<div class="ac-actions"><button type="button" class="ac-cancel" data-close>' + PL("Batal", "Cancel") + '</button><button type="button" class="ac-ok" id="knSend">' + PL("Kirim pesanan", "Send order") + '</button></div>';
        sheet(html, function (w, api) {
            function mark() { w.querySelectorAll("[data-pay]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-pay") === pay); }); }
            mark();
            w.querySelector(".kn-pay").onclick = function (e) { var b = e.target.closest("[data-pay]"); if (b && !b.disabled) { pay = b.getAttribute("data-pay"); mark(); } };
            w.querySelector("#knSend").onclick = async function () {
                var btn = this; btn.disabled = true;
                var body = lines.map(function (l) { return { id: l.it.id, qty: l.qty }; });
                var r = await supabaseClient.rpc("kantin_order", { p_items: body, p_pay: pay });
                if (r.error) { btn.disabled = false; toast(errMsg(r.error), "error"); return; }
                api.close();
                cart = {};
                toast(PL("Pesanan terkirim. Tunggu kabar dari kantin ya.", "Order sent."));
                await Promise.all([loadItems(), loadBalance()]);
                drawStudentMenu();
                stuTab("mine");
            };
        });
    }
    async function drawMine() {
        var r = await supabaseClient.from("kantin_orders").select("*").eq("student_id", me.id).order("created_at", { ascending: false }).limit(30);
        var list = (r && r.data) || [], box = $("knMine");
        if (!list.length) { box.innerHTML = '<div class="kn-empty">' + SV(IC.bag, 28) + '<b>' + PL("Belum ada pesanan", "No orders yet") + '</b></div>'; return; }
        box.innerHTML = list.map(function (o) {
            var st = STATUS[o.status] || [o.status, ""], live = ["baru", "dibuat", "siap"].indexOf(o.status) !== -1;
            var step = { baru: 1, dibuat: 2, siap: 3 }[o.status] || 0;
            return '<div class="kn-ord' + (live ? " live" : "") + '"><div class="kn-ord-top"><b>#' + esc(o.code) + ' · ' + when(o.created_at) + '</b><span class="kn-badge ' + st[1] + '">' + st[0] + '</span></div>' +
                (live ? '<div class="kn-steps"><i class="' + (step >= 1 ? "d" : "") + '"></i><i class="' + (step >= 2 ? "d" : "") + '"></i><i class="' + (step >= 3 ? "d" : "") + '"></i></div>' +
                    '<div class="kn-steps-lab"><span>' + PL("Dikirim", "Sent") + '</span><span>' + PL("Dibuat", "Making") + '</span><span>' + PL("Siap diambil", "Ready") + '</span></div>' : '') +
                '<div class="kn-ord-items">' + itemsLine(o.items) + '</div>' +
                '<div class="kn-ord-foot"><span>' + (o.source === "kasir" ? PL("Beli di kasir", "At the counter") + " · " : "") + (o.pay === "saldo" ? PL("Saldo", "Balance") : PL("Tunai", "Cash")) + '</span><b>' + rp(o.total) + '</b></div>' +
                (o.status === "baru" ? '<button type="button" class="kn-cancel" data-cancel="' + o.id + '">' + PL("Batalkan pesanan", "Cancel order") + '</button>' : '') + '</div>';
        }).join("");
        box.onclick = async function (e) {
            var b = e.target.closest("[data-cancel]"); if (!b) return;
            var ok = await attConfirm({ title: PL("Batalkan pesanan?", "Cancel this order?"), ok: PL("Batalkan", "Cancel order"), cancel: PL("Tidak", "No") });
            if (!ok) return;
            var r2 = await supabaseClient.rpc("kantin_cancel", { p_id: b.getAttribute("data-cancel") });
            if (r2.error) { toast(errMsg(r2.error), "error"); return; }
            toast(PL("Pesanan dibatalkan", "Order cancelled"));
            await loadItems(); drawStudentMenu(); drawMine();
        };
    }
    async function payQr() {
        var r = await supabaseClient.rpc("kantin_token");
        if (r.error) { toast(errMsg(r.error), "error"); return; }
        var code = r.data, ends = Date.now() + 180000, t = null;
        var qr = qrcode(0, "M"); qr.addData(code); qr.make();
        sheet('<div class="ac-top"><b>' + PL("QR bayar kantin", "Canteen pay QR") + '</b><small>' + PL("Tunjukkan ke petugas kantin. Saldo dipotong setelah petugas scan.", "Show it to the canteen staff.") + '</small></div>' +
            '<div class="kn-qr">' + qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }) + '</div>' +
            '<div class="kn-qr-meta"><b>' + esc(code) + '</b><span id="knQrLeft"></span></div>' +
            '<div class="ac-actions one"><button type="button" class="ac-ok" data-close>' + PL("Tutup", "Close") + '</button></div>', function (w, api) {
            function tick() {
                var s = Math.max(0, Math.round((ends - Date.now()) / 1000)), el = w.querySelector("#knQrLeft");
                if (el) el.textContent = s ? PL("Berlaku ", "Valid ") + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : PL("Kedaluwarsa, buka lagi", "Expired, open again");
                if (!s) { clearInterval(t); w.querySelector(".kn-qr").classList.add("old"); }
            }
            tick(); t = setInterval(tick, 1000);
            api.onClose = function () { clearInterval(t); loadBalance(); drawMine(); };
        });
    }
    function stuTab(t) {
        document.querySelectorAll("#knStuTabs [data-tab]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === t); });
        document.querySelectorAll("#knStudent [data-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-pane") !== t; });
        $("knCart").classList.toggle("off", t !== "menu");
        if (t === "mine") drawMine();
    }
    async function startStudent() {
        mode = "murid";
        $("knStudent").hidden = false;
        $("knSub").textContent = PL("Pesan, ambil di kantin", "Order, pick up at the canteen");
        var tb = document.querySelectorAll("#knStuTabs [data-tab]");
        tb[0].textContent = PL("Menu", "Menu"); tb[1].textContent = PL("Pesananku", "My orders");
        $("knStuTabs").onclick = function (e) { var b = e.target.closest("[data-tab]"); if (b) stuTab(b.getAttribute("data-tab")); };
        $("knPayQr").innerHTML = SV(IC.qr, 18) + '<span>' + PL("Bayar di kasir pakai saldo", "Pay at the counter with balance") + '</span>';
        $("knPayQr").onclick = payQr;
        // search by name: the button next to the balance opens a search line above the menu
        var sb = $("knSearchBtn"), box = $("knSearch"), si = $("knSearchIn");
        sb.hidden = false; sb.setAttribute("aria-label", PL("Cari makanan", "Search"));
        si.placeholder = PL("Cari makanan atau barang", "Search food or items");
        sb.onclick = function () { stuTab("menu"); box.hidden = !box.hidden; if (!box.hidden) si.focus(); else { query = ""; si.value = ""; drawStudentMenu(); } };
        $("knSearchX").onclick = function () { box.hidden = true; query = ""; si.value = ""; drawStudentMenu(); };
        si.oninput = function () { query = si.value; drawStudentMenu(); };
        await Promise.all([loadItems(), loadBalance()]);
        drawStudentMenu();
        if (location.hash === "#pesanan") stuTab("mine");
        live("student", function () { drawMine(); loadBalance(); });
    }

    // ================= STAFF =================
    function staffTab(t) {
        document.querySelectorAll("#knStaffTabs [data-tab]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === t); });
        document.querySelectorAll("#knStaff [data-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-pane") !== t; });
        $("knCart").classList.toggle("off", t !== "kasir");
        if (t === "orders") drawOrders();
        if (t === "kasir") drawKasir();
        if (t === "items") drawItems();
        if (t === "report") drawReport();
    }
    async function drawOrders() {
        var r = await supabaseClient.from("kantin_orders").select("*").in("status", ["baru", "dibuat", "siap"]).order("created_at", { ascending: true }).limit(100);
        var list = (r && r.data) || [], box = $("knOrders");
        var nNew = list.filter(function (o) { return o.status === "baru"; }).length;
        $("knStaffTabs").querySelector('[data-tab="orders"]').textContent = PL("Pesanan", "Orders") + (list.length ? " · " + list.length : "");
        $("knSub").textContent = nNew ? nNew + PL(" pesanan baru", " new orders") : (list.length ? list.length + PL(" pesanan berjalan", " orders in progress") : PL("Belum ada pesanan masuk", "No orders right now"));
        if (!list.length) { box.innerHTML = '<div class="kn-empty">' + SV(IC.bag, 28) + '<b>' + PL("Belum ada pesanan", "No orders") + '</b><small>' + PL("Pesanan siswa muncul di sini otomatis.", "Student orders show up here.") + '</small></div>'; return; }
        box.innerHTML = list.map(function (o) {
            var st = STATUS[o.status];
            var acts = o.status === "baru" ? '<button type="button" data-act="ditolak" class="soft">' + PL("Tolak", "Decline") + '</button><button type="button" data-act="dibuat" class="dark">' + PL("Terima", "Accept") + '</button>'
                : o.status === "dibuat" ? '<button type="button" data-act="siap" class="lime">' + PL("Siap diambil", "Ready") + '</button>'
                : '<button type="button" data-act="selesai" class="green">' + PL("Sudah diambil", "Picked up") + (o.pay === "tunai" ? PL(" · terima ", " · take ") + rp(o.total) : "") + '</button>';
            return '<div class="kn-ord" data-id="' + o.id + '"><div class="kn-ord-top"><b>' + esc(o.student_name || PL("Siswa", "Student")) + (o.student_class ? ' · ' + esc(o.student_class) : '') + '</b><span class="kn-badge ' + st[1] + '">' + (o.status === "baru" ? PL("Baru", "New") : st[0]) + '</span></div>' +
                '<div class="kn-ord-items">' + itemsLine(o.items) + '</div>' +
                '<div class="kn-ord-foot"><span>#' + esc(o.code) + ' · ' + when(o.created_at) + ' · ' + (o.pay === "saldo" ? PL("Saldo", "Balance") : PL("Tunai", "Cash")) + '</span><b>' + rp(o.total) + '</b></div>' +
                '<div class="kn-acts">' + acts + '</div></div>';
        }).join("");
        box.onclick = async function (e) {
            var b = e.target.closest("[data-act]"); if (!b) return;
            var id = b.closest("[data-id]").getAttribute("data-id"), act = b.getAttribute("data-act");
            if (act === "ditolak" && !(await attConfirm({ title: PL("Tolak pesanan ini?", "Decline this order?"), text: PL("Stok dikembalikan dan saldo siswa tidak dipotong.", "Stock goes back; nothing is charged."), ok: PL("Tolak", "Decline") }))) return;
            b.disabled = true;
            var r2 = await supabaseClient.rpc("kantin_set_status", { p_id: id, p_status: act });
            if (r2.error) { b.disabled = false; toast(errMsg(r2.error), "error"); return; }
            drawOrders();
        };
    }
    function drawKasir() {
        var box = $("knKasir");
        redrawGrid(box, true);
        bindGrid(box, drawKasir);
        drawCart('<button type="button" class="kn-go soft" id="knCash">' + PL("Tunai", "Cash") + '</button><button type="button" class="kn-go" id="knScan">' + PL("Scan QR · Saldo", "Scan QR · Balance") + '</button>');
        var c = $("knCash"); if (c) c.onclick = function () { sell("tunai"); };
        var s = $("knScan"); if (s) s.onclick = scanSheet;
    }
    async function sell(pay, code) {
        var lines = cartList(); if (!lines.length) return false;
        if (pay === "tunai" && !(await attConfirm({ title: PL("Terima tunai ", "Take cash ") + rp(cartTotal()) + "?", text: lines.map(function (l) { return l.qty + "× " + l.it.name; }).join(", "), ok: PL("Sudah dibayar", "Paid"), tone: "primary" }))) return false;
        var r = await supabaseClient.rpc("kantin_sell", { p_items: lines.map(function (l) { return { id: l.it.id, qty: l.qty }; }), p_pay: pay, p_code: code || null });
        if (r.error) { toast(errMsg(r.error), "error"); return false; }
        toast(pay === "saldo" ? PL("Saldo ", "Charged ") + (r.data.student_name || "") + PL(" dipotong ", " ") + rp(r.data.total) : PL("Penjualan tercatat ", "Sale recorded ") + rp(r.data.total));
        cart = {};
        await loadItems(); drawKasir();
        return true;
    }
    // camera QR scan (BarcodeDetector, else jsQR from the CDN), or type the code
    function scanSheet() {
        var stream = null, raf = 0, busy = false;
        sheet('<div class="ac-top"><b>' + PL("Scan QR siswa", "Scan student QR") + '</b><small>' + PL("Total ", "Total ") + rp(cartTotal()) + PL(" dipotong dari saldo siswa.", " from the student's balance.") + '</small></div>' +
            '<div class="kn-scan"><video playsinline muted></video><i></i></div>' +
            '<input type="text" class="am-field kn-code" placeholder="' + PL("atau ketik kode, misal KT1A2B3C4D5", "or type the code") + '" autocapitalize="characters">' +
            '<div class="ac-actions"><button type="button" class="ac-cancel" data-close>' + PL("Batal", "Cancel") + '</button><button type="button" class="ac-ok" id="knCodeGo">' + PL("Bayar", "Charge") + '</button></div>', function (w, api) {
            var v = w.querySelector("video"), inp = w.querySelector(".kn-code");
            async function go(code) {
                if (busy || !code) return; busy = true;
                var ok = await sell("saldo", code.trim().toUpperCase());
                busy = false;
                if (ok) api.close();
            }
            w.querySelector("#knCodeGo").onclick = function () { go(inp.value); };
            api.onClose = function () { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); };
            (async function () {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                    v.srcObject = stream; await v.play();
                } catch (e) { w.querySelector(".kn-scan").classList.add("off"); return; }
                var det = null, cv = document.createElement("canvas"), g = cv.getContext("2d", { willReadFrequently: true });
                if ("BarcodeDetector" in window) { try { det = new BarcodeDetector({ formats: ["qr_code"] }); } catch (e) {} }
                if (!det && !window.jsQR) await new Promise(function (res) { var s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"; s.onload = res; s.onerror = res; document.head.appendChild(s); });
                async function loop() {
                    if (!document.body.contains(w)) return;
                    try {
                        var txt = null;
                        if (det) { var res = await det.detect(v); if (res && res[0]) txt = res[0].rawValue; }
                        else if (window.jsQR && v.videoWidth) {
                            cv.width = v.videoWidth; cv.height = v.videoHeight; g.drawImage(v, 0, 0);
                            var d = g.getImageData(0, 0, cv.width, cv.height), c = jsQR(d.data, d.width, d.height);
                            if (c) txt = c.data;
                        }
                        if (txt && /^KT[A-Z0-9]{6,}$/i.test(txt)) { inp.value = txt; await go(txt); if (!document.body.contains(w)) return; }
                    } catch (e) {}
                    raf = requestAnimationFrame(function () { setTimeout(loop, 180); });
                }
                loop();
            })();
        });
    }
    function drawItems() {
        var box = $("knItems");
        $("knAddItem").innerHTML = SV(IC.plus, 18) + '<span>' + PL("Tambah barang", "Add item") + '</span>';
        $("knAddItem").onclick = function () { itemSheet(null); };
        if (!items.length) { box.innerHTML = '<div class="kn-empty">' + SV(IC.bag, 28) + '<b>' + PL("Belum ada barang", "No items yet") + '</b></div>'; return; }
        box.innerHTML = '<div class="kn-list">' + items.map(function (it) {
            return '<button type="button" class="kn-row' + (it.active ? "" : " off") + '" data-id="' + it.id + '">' + photoHTML(it, "kn-thumb") +
                '<span class="kn-row-txt"><b>' + esc(it.name) + '</b><small>' + catName(it.category) + ' · ' + rp(it.price) + (it.active ? "" : " · " + PL("disembunyikan", "hidden")) + '</small></span>' +
                '<span class="kn-stock' + (it.stock <= 0 ? " out" : it.stock <= 5 ? " low" : "") + '">' + (it.stock <= 0 ? PL("Habis", "Sold out") : PL("Stok ", "Stock ") + it.stock) + '</span></button>';
        }).join("") + '</div>';
        box.onclick = function (e) { var b = e.target.closest("[data-id]"); if (b) itemSheet(items.find(function (x) { return x.id === b.getAttribute("data-id"); })); };
    }
    // shrink a photo to max 640px JPEG before upload
    function shrink(file) {
        return new Promise(function (res, rej) {
            var img = new Image(), url = URL.createObjectURL(file);
            img.onload = function () {
                var s = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement("canvas");
                c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
                var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(url);
                c.toBlob(function (b) { b ? res(b) : rej(new Error("photo")); }, "image/jpeg", 0.82);
            };
            img.onerror = function () { URL.revokeObjectURL(url); rej(new Error(PL("Foto tidak bisa dibuka", "Can't open photo"))); };
            img.src = url;
        });
    }
    function itemSheet(it) {
        var blob = null, f = "width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;font-size:16px";
        sheet('<div class="ac-top"><b>' + (it ? PL("Ubah barang", "Edit item") : PL("Barang baru", "New item")) + '</b></div>' +
            '<button type="button" class="kn-photo-pick">' + (it && it.photo ? '<img src="' + esc(it.photo) + '" alt=""><span class="kn-photo-chg">' + PL("Ganti foto", "Change photo") + '</span>' : '<span>' + SV(IC.cam, 28) + '<b>' + PL("Tambah foto", "Add photo") + '</b></span>') + '</button><input type="file" accept="image/*" capture="environment" class="kn-f-cam" hidden><input type="file" accept="image/*" class="kn-f-gal" hidden><input type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif" class="kn-f-file" hidden>' +
            '<div class="savings-field-label">' + PL("Kategori", "Kind") + '</div><div class="kn-catpick">' + CATS.map(function (c) { return '<button type="button" data-k="' + c[0] + '">' + SV(c[2], 18) + '<span>' + c[1] + '</span></button>'; }).join("") + '</div>' +
            '<div class="savings-field-label">' + PL("Nama", "Name") + '</div><input type="text" maxlength="40" class="am-field kn-in-name" style="' + f + '" placeholder="' + PL("misal: Nasi goreng", "e.g. Fried rice") + '">' +
            '<div class="kn-two"><div><div class="savings-field-label">' + PL("Harga", "Price") + '</div><input type="text" inputmode="numeric" class="am-field kn-in-price" style="' + f + '" placeholder="10.000"></div>' +
            '<div><div class="savings-field-label">' + PL("Stok", "Stock") + '</div><input type="text" inputmode="numeric" class="am-field kn-in-stock" style="' + f + '" placeholder="20"></div></div>' +
            '<div class="ac-actions"><button type="button" class="ac-cancel" data-close>' + PL("Batal", "Cancel") + '</button><button type="button" class="ac-ok kn-save">' + PL("Simpan", "Save") + '</button></div>' +
            (it ? '<button type="button" class="kn-del">' + PL("Hapus barang", "Delete item") + '</button>' : ''), function (w, api) {
            var nm = w.querySelector(".kn-in-name"), pr = w.querySelector(".kn-in-price"), stk = w.querySelector(".kn-in-stock"), pick = w.querySelector(".kn-photo-pick"), fCam = w.querySelector(".kn-f-cam"), fGal = w.querySelector(".kn-f-gal"), fFile = w.querySelector(".kn-f-file");
            function num(el) { el.addEventListener("input", function () { var n = Number(el.value.replace(/\D/g, "")); el.value = n ? n.toLocaleString("id-ID") : (el.value.replace(/\D/g, "") === "0" ? "0" : ""); }); }
            num(pr); num(stk);
            var cat = (it && it.category) || filter || "makanan", cp = w.querySelector(".kn-catpick");
            function markCat() { cp.querySelectorAll("[data-k]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-k") === cat); }); }
            markCat();
            cp.onclick = function (e) { var b = e.target.closest("[data-k]"); if (b) { cat = b.getAttribute("data-k"); markCat(); } };
            if (it) { nm.value = it.name; pr.value = Number(it.price).toLocaleString("id-ID"); stk.value = String(it.stock); }
            // tap the photo box: take a new photo or choose one from the gallery
            pick.onclick = async function () {
                var v = await attSheet({ title: PL("Foto barang", "Item photo"), items: [
                    { label: PL("Ambil foto (kamera)", "Take photo"), value: "cam", icon: SV(IC.cam, 20) },
                    { label: PL("Pilih dari galeri", "Choose from gallery"), value: "gal", icon: SV(IC.gal, 20) },
                    { label: PL("Pilih dari file", "Choose a file"), value: "file", icon: SV(IC.file, 20) }
                ] });
                if (v === "cam") fCam.click(); else if (v === "gal") fGal.click(); else if (v === "file") fFile.click();
            };
            async function got(inp) {
                var f0 = inp.files && inp.files[0]; inp.value = "";
                if (!f0) return;
                try { blob = await shrink(f0); } catch (e) { toast(errMsg(e), "error"); return; }
                pick.innerHTML = '<img src="' + URL.createObjectURL(blob) + '" alt=""><span class="kn-photo-chg">' + PL("Ganti foto", "Change photo") + '</span>';
            }
            fCam.onchange = function () { got(fCam); };
            fGal.onchange = function () { got(fGal); };
            fFile.onchange = function () { got(fFile); };
            var del = w.querySelector(".kn-del");
            if (del) del.onclick = async function () {
                if (!(await attConfirm({ title: PL("Hapus ", "Delete ") + it.name + "?", text: PL("Riwayat penjualan tetap tersimpan.", "Past sales stay recorded."), ok: PL("Hapus", "Delete") }))) return;
                var r = await supabaseClient.from("kantin_items").delete().eq("id", it.id);
                if (r.error) { toast(errMsg(r.error), "error"); return; }
                // remove its photo file too
                var m = it.photo && String(it.photo).match(/\/kantin\/(items\/[^?]+)/);
                if (m) { try { await supabaseClient.storage.from("kantin").remove([m[1]]); } catch (e) {} }
                toast(PL("Barang dihapus", "Item deleted"));
                api.close(); await loadItems(); drawItems();
            };
            w.querySelector(".kn-save").onclick = async function () {
                var btn = this, name = nm.value.trim(), price = Number(pr.value.replace(/\D/g, "")), stock = Number(stk.value.replace(/\D/g, "") || 0);
                if (!name) { nm.focus(); return; }
                if (!pr.value.replace(/\D/g, "")) { pr.focus(); return; }
                btn.disabled = true;
                var row = { name: name, price: price, stock: stock, category: cat, updated_at: new Date().toISOString() };
                if (blob) {
                    var path = "items/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + ".jpg";
                    var up = await supabaseClient.storage.from("kantin").upload(path, blob, { contentType: "image/jpeg", upsert: false });
                    if (up.error) { btn.disabled = false; toast(PL("Foto gagal diunggah: ", "Photo upload failed: ") + errMsg(up.error), "error"); return; }
                    row.photo = supabaseClient.storage.from("kantin").getPublicUrl(path).data.publicUrl;
                }
                var r = it ? await supabaseClient.from("kantin_items").update(row).eq("id", it.id) : await supabaseClient.from("kantin_items").insert(row);
                if (r.error) { btn.disabled = false; toast(errMsg(r.error), "error"); return; }
                api.close(); toast(PL("Barang disimpan", "Item saved"));
                await loadItems(); drawItems();
            };
            if (!it) setTimeout(function () { nm.focus(); }, 200);
        });
    }
    async function drawReport() {
        var now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var r = await supabaseClient.from("kantin_orders").select("total,pay,items,created_at,status").gte("created_at", m0.toISOString()).in("status", ["dibuat", "siap", "selesai"]).limit(5000);
        var list = (r && r.data) || [];
        function sum(arr, f) { return arr.reduce(function (a, o) { return a + (f ? (f(o) ? o.total : 0) : o.total); }, 0); }
        var today = list.filter(function (o) { return new Date(o.created_at) >= d0; });
        var top = {};
        list.forEach(function (o) { (o.items || []).forEach(function (l) { top[l.name] = (top[l.name] || 0) + Number(l.qty || 0); }); });
        var topK = Object.keys(top).sort(function (a, b) { return top[b] - top[a]; }).slice(0, 5);
        var low = items.filter(function (x) { return x.active && x.stock <= 5; });
        function card(lab, arr) {
            return '<div class="kn-rep"><span>' + lab + '</span><b>' + rp(sum(arr)) + '</b><div class="kn-rep-row"><small>' + arr.length + PL(" transaksi", " sales") + '</small><small>' + PL("Tunai ", "Cash ") + rp(sum(arr, function (o) { return o.pay === "tunai"; })) + '</small><small>' + PL("Saldo ", "Balance ") + rp(sum(arr, function (o) { return o.pay === "saldo"; })) + '</small></div></div>';
        }
        $("knReport").innerHTML = '<div class="kn-reps">' + card(PL("Hari ini", "Today"), today) + card(now.toLocaleDateString(ID ? "id-ID" : "en-US", { month: "long" }), list) + '</div>' +
            (topK.length ? '<h3 class="kn-h3">' + PL("Paling laku bulan ini", "Best sellers this month") + '</h3><div class="kn-box">' + topK.map(function (k, i) { return '<div class="kn-line"><span>' + (i + 1) + '. ' + esc(k) + '</span><b>' + top[k] + '×</b></div>'; }).join("") + '</div>' : '') +
            (low.length ? '<h3 class="kn-h3">' + PL("Stok hampir habis", "Running low") + '</h3><div class="kn-box">' + low.map(function (x) { return '<div class="kn-line"><span>' + esc(x.name) + '</span><b class="' + (x.stock <= 0 ? "bad" : "warn") + '">' + (x.stock <= 0 ? PL("Habis", "Sold out") : x.stock) + '</b></div>'; }).join("") + '</div>' : '');
        if (me.role === "admin") drawStaffList();
    }
    // admin: canteen staff accounts
    async function drawStaffList() {
        var box = $("knStaffList"); box.hidden = false;
        var r = await supabaseClient.from("profiles").select("id,name,status").eq("role", "koperasi").order("name", { ascending: true });
        var list = (r && r.data) || [];
        box.innerHTML = '<h3 class="kn-h3">' + PL("Petugas kantin", "Canteen staff") + '</h3><div class="kn-box">' +
            (list.length ? list.map(function (p) { return '<div class="kn-line" data-id="' + p.id + '"><span>' + SV(IC.user, 16) + ' ' + esc(p.name) + (p.status === "inactive" ? ' <small>· ' + PL("nonaktif", "inactive") + '</small>' : '') + '</span><button type="button" class="kn-link" data-toggle="' + (p.status === "inactive" ? "active" : "inactive") + '">' + (p.status === "inactive" ? PL("Aktifkan", "Activate") : PL("Nonaktifkan", "Deactivate")) + '</button></div>'; }).join("")
                : '<div class="kn-line"><span class="kn-muted">' + PL("Belum ada petugas", "No staff yet") + '</span></div>') +
            '</div><button type="button" class="kn-add" id="knAddStaff">' + SV(IC.plus, 18) + '<span>' + PL("Tambah petugas", "Add staff") + '</span></button>';
        box.onclick = async function (e) {
            var t = e.target.closest("[data-toggle]");
            if (t) {
                var r2 = await supabaseClient.from("profiles").update({ status: t.getAttribute("data-toggle") }).eq("id", t.closest("[data-id]").getAttribute("data-id"));
                if (r2.error) toast(errMsg(r2.error), "error"); else drawStaffList();
                return;
            }
            if (e.target.closest("#knAddStaff")) addStaff();
        };
    }
    function addStaff() {
        var f = "width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;font-size:16px";
        sheet('<div class="ac-top"><b>' + PL("Petugas kantin baru", "New canteen staff") + '</b><small>' + PL("Petugas hanya bisa membuka halaman kantin.", "Staff can only open the canteen page.") + '</small></div>' +
            '<input type="text" class="am-field kn-s-name" style="' + f + '" placeholder="' + PL("Nama", "Name") + '">' +
            '<input type="email" class="am-field kn-s-mail" style="' + f + '" placeholder="Email">' +
            '<div class="kn-pw"><input type="password" class="am-field kn-s-pass" style="' + f + ';padding-right:46px" autocomplete="new-password" placeholder="' + PL("Password (min. 6 huruf)", "Password (min. 6)") + '"><button type="button" class="kn-eye" aria-label="' + PL("Lihat password", "Show password") + '">' + SV(IC.eye, 20) + '</button></div>' +
            '<div class="ac-actions"><button type="button" class="ac-cancel" data-close>' + PL("Batal", "Cancel") + '</button><button type="button" class="ac-ok kn-s-go">' + PL("Buat akun", "Create") + '</button></div>', function (w, api) {
            var eye = w.querySelector(".kn-eye"), pw = w.querySelector(".kn-s-pass");
            eye.onclick = function () {
                var show = pw.type === "password";
                pw.type = show ? "text" : "password";
                eye.innerHTML = SV(show ? IC.eyeOff : IC.eye, 20);
                eye.setAttribute("aria-label", show ? PL("Sembunyikan password", "Hide password") : PL("Lihat password", "Show password"));
            };
            w.querySelector(".kn-s-go").onclick = async function () {
                var btn = this, name = w.querySelector(".kn-s-name").value.trim(), mail = w.querySelector(".kn-s-mail").value.trim(), pass = w.querySelector(".kn-s-pass").value;
                if (!name || !mail || pass.length < 6) { toast(PL("Isi nama, email, dan password (min. 6)", "Fill in name, email and password"), "error"); return; }
                btn.disabled = true;
                // separate client so the admin stays signed in
                var tmp = window.supabase.createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "sb-temp-signup-auth" } });
                var su = await tmp.auth.signUp({ email: mail, password: pass });
                if (su.error || !su.data || !su.data.user) { btn.disabled = false; toast(errMsg(su.error || PL("Gagal membuat akun", "Couldn't create")), "error"); return; }
                var ins = await supabaseClient.from("profiles").insert({ id: su.data.user.id, role: "koperasi", name: name });
                if (ins.error) { btn.disabled = false; toast(errMsg(ins.error), "error"); return; }
                api.close(); toast(PL("Akun petugas dibuat", "Staff account created")); drawStaffList();
            };
        });
    }
    async function startStaff() {
        mode = "staff";
        $("knStaff").hidden = false;
        var p = $("knPill");
        if (me.role === "koperasi") { p.hidden = false; p.textContent = me.name || PL("Petugas", "Staff"); p.onclick = function () { location.href = "settings.html"; }; }
        var tb = document.querySelectorAll("#knStaffTabs [data-tab]");
        tb[0].textContent = PL("Pesanan", "Orders"); tb[1].textContent = PL("Kasir", "Counter"); tb[2].textContent = PL("Barang", "Items"); tb[3].textContent = PL("Laporan", "Report");
        $("knStaffTabs").onclick = function (e) { var b = e.target.closest("[data-tab]"); if (b) staffTab(b.getAttribute("data-tab")); };
        if (me.role === "koperasi") attCard();
        await loadItems();
        staffTab("orders");
        live("staff", function () { if (!$("knOrders").closest("[data-pane]").hidden) drawOrders(); else drawOrders.call(null); });
        setInterval(function () { if (!document.hidden && !$("knOrders").closest("[data-pane]").hidden) drawOrders(); }, 20000);
    }

    // canteen staff check in too (group "Kantin", kantin_absen.sql): a small card above the tabs
    async function attCard() {
        var a = document.createElement("a");
        a.href = "attendance.html"; a.className = "kn-att"; a.id = "knAtt";
        $("knStaffTabs").parentNode.insertBefore(a, $("knStaffTabs"));
        var day = typeof localDateStr === "function" ? localDateStr() : new Date().toISOString().slice(0, 10);
        var r = await supabaseClient.from("attendance").select("time,status,checkout_time").eq("user_id", me.id).eq("date", day).maybeSingle();
        var row = r && r.data, hm = function (t) { return String(t || "").slice(0, 5).replace(":", "."); };
        var done = !!row, out = row && row.checkout_time;
        a.classList.toggle("done", done);
        a.innerHTML = '<span class="kn-att-ic">' + SV(done ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>' : '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 20) + '</span>' +
            '<span class="kn-att-t"><b>' + (done ? (row.status === "Hadir" ? PL("Sudah absen ", "Checked in ") + hm(row.time) : row.status) : PL("Absen hari ini", "Check in today")) + '</b>' +
            '<small>' + (out ? PL("Pulang ", "Out ") + hm(row.checkout_time) : done ? PL("Jangan lupa absen pulang", "Remember to check out") : PL("Belum absen, pencet untuk absen", "Not yet, tap to check in")) + '</small></span>' +
            SV('<path d="M9 5l7 7-7 7"/>', 18);
    }

    // ---------- helpers ----------
    function itemsLine(arr) { return (arr || []).map(function (l) { return esc(l.qty + "× " + l.name); }).join(" · "); }
    function when(ts) {
        var d = new Date(ts), now = new Date(), t = String(d.getHours()).padStart(2, "0") + "." + String(d.getMinutes()).padStart(2, "0");
        if (d.toDateString() === now.toDateString()) return PL("Hari ini ", "Today ") + t;
        var y = new Date(now); y.setDate(now.getDate() - 1);
        if (d.toDateString() === y.toDateString()) return PL("Kemarin ", "Yesterday ") + t;
        return d.toLocaleDateString(ID ? "id-ID" : "en-US", { day: "numeric", month: "short" }) + " " + t;
    }
    function live(who, fn) {
        try {
            var ch = supabaseClient.channel("kantin-" + who + "-" + Math.random().toString(36).slice(2));
            var opt = { event: "*", schema: "public", table: "kantin_orders" };
            if (who === "student") opt.filter = "student_id=eq." + me.id;
            ch.on("postgres_changes", opt, function () { fn(); }).subscribe();
        } catch (e) {}
    }

    async function init() {
        var user = await requireLogin(); if (!user) return;
        me = await attMyProfile(user.id);
        if (!me) return;
        me.id = user.id;
        if (me.role === "murid") return startStudent();
        if (me.role === "koperasi" || me.role === "admin") return startStaff();
        location.replace(me.role === "guru" ? "teacher.html" : me.role === "orangtua" ? "parent.html" : "index.html");
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
