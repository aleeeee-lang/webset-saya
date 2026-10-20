// Profile photo cropper: drag / pinch / zoom inside a circle, export a sharp square.
// openAvatarCropper(file) -> Promise<Blob|null>;  attConfirm(opts) -> Promise<boolean>
(function () {
    function L(id, en) { try { return (localStorage.getItem("attendly-lang") || "en") === "id" ? id : en; } catch (e) { return en; } }
    var MAX_OUT = 1024;

    function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

    window.openAvatarCropper = function (file) {
        return new Promise(function (resolve) {
            if (!file || !/^image\//.test(file.type)) { resolve(null); return; }
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
            img.onload = function () { build(img, file, url, resolve); };
            img.src = url;
        });
    };

    function build(img, file, url, resolve) {
        var wrap = el("div", "ac-wrap");
        wrap.setAttribute("role", "dialog");
        wrap.setAttribute("aria-modal", "true");
        wrap.className = "ac-wrap ac-full";
        wrap.innerHTML =
            '<div class="ac-bar"><button type="button" class="ac-cancel">' + L("Batal", "Cancel") + '</button>' +
            '<b>' + L("Atur foto", "Move and scale") + '</b>' +
            '<button type="button" class="ac-ok">' + L("Selesai", "Done") + '</button></div>' +
            '<div class="ac-body"><div class="ac-stage"><img alt="" draggable="false"><span class="ac-grid"><i></i><i></i><i></i><i></i></span><span class="ac-ring"></span></div>' +
            '<p class="ac-hint">' + L("Geser untuk memindah · cubit untuk zoom", "Drag to move · pinch to zoom") + '</p>' +
            '<div class="ac-zoom"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6"/></svg>' +
            '<input type="range" min="0" max="1000" value="0" aria-label="Zoom">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6"/></svg></div></div>';
        document.body.appendChild(wrap);
        document.documentElement.classList.add("ac-lock");

        var stage = wrap.querySelector(".ac-stage"), view = stage.querySelector("img"), range = wrap.querySelector("input[type=range]");
        view.src = url;
        var W = img.naturalWidth, H = img.naturalHeight, S = 0, minS = 1, maxS = 1, s = 1, x = 0, y = 0;

        function layout() {
            S = stage.clientWidth;
            var prevMin = minS;
            minS = S / Math.min(W, H);
            // zoom up to 5x, but never past ~1.5 screen px per source px
            maxS = Math.max(minS * 1.0001, Math.min(minS * 5, Math.max(minS, S / 120)));
            if (!s || s === prevMin || s < minS) s = minS;
            if (s > maxS) s = maxS;
            if (x === 0 && y === 0) { x = (S - W * s) / 2; y = (S - H * s) / 2; }
            clamp(); paint();
        }
        function clamp() {
            x = Math.min(0, Math.max(S - W * s, x));
            y = Math.min(0, Math.max(S - H * s, y));
        }
        function paint() {
            view.style.width = W * s + "px";
            view.style.height = H * s + "px";
            view.style.transform = "translate3d(" + x + "px," + y + "px,0)";
            range.value = String(Math.round(((s - minS) / (maxS - minS || 1)) * 1000));
        }
        function zoomTo(ns, cx, cy) {
            ns = Math.min(maxS, Math.max(minS, ns));
            if (cx == null) { cx = S / 2; cy = S / 2; }
            x = cx - (cx - x) * (ns / s);
            y = cy - (cy - y) * (ns / s);
            s = ns; clamp(); paint();
        }

        var pts = {}, last = null;
        function center() {
            var k = Object.keys(pts), r = stage.getBoundingClientRect();
            if (k.length === 1) return { x: pts[k[0]].x - r.left, y: pts[k[0]].y - r.top, d: 0 };
            var a = pts[k[0]], b = pts[k[1]];
            return { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top, d: Math.hypot(a.x - b.x, a.y - b.y) };
        }
        stage.addEventListener("pointerdown", function (e) {
            stage.setPointerCapture(e.pointerId);
            pts[e.pointerId] = { x: e.clientX, y: e.clientY };
            last = center();
            stage.classList.add("grab");
        });
        stage.addEventListener("pointermove", function (e) {
            if (!pts[e.pointerId]) return;
            pts[e.pointerId] = { x: e.clientX, y: e.clientY };
            var c = center();
            if (last) {
                if (c.d && last.d) zoomTo(s * (c.d / last.d), c.x, c.y);
                x += c.x - last.x; y += c.y - last.y; clamp(); paint();
            }
            last = c;
        });
        function up(e) {
            delete pts[e.pointerId];
            last = Object.keys(pts).length ? center() : null;
            if (!last) stage.classList.remove("grab");
        }
        var lastTap = 0;
        stage.addEventListener("pointerup", function (e) {
            var now = Date.now();
            if (now - lastTap < 280 && !Object.keys(pts).filter(function (k) { return k != e.pointerId; }).length) {
                s = minS; x = (S - W * s) / 2; y = (S - H * s) / 2; clamp(); paint();
            }
            lastTap = now;
        });
        stage.addEventListener("pointerup", up);
        stage.addEventListener("pointercancel", up);
        stage.addEventListener("wheel", function (e) {
            e.preventDefault();
            var r = stage.getBoundingClientRect();
            zoomTo(s * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
        }, { passive: false });
        range.addEventListener("input", function () { zoomTo(minS + (maxS - minS) * (Number(range.value) / 1000)); });

        function done(result) {
            window.removeEventListener("resize", layout);
            document.removeEventListener("keydown", onKey);
            wrap.classList.add("out");
            document.documentElement.classList.remove("ac-lock");
            setTimeout(function () { wrap.remove(); URL.revokeObjectURL(url); }, 160);
            resolve(result);
        }
        function onKey(e) { if (e.key === "Escape") done(null); }
        document.addEventListener("keydown", onKey);
        wrap.querySelector(".ac-cancel").addEventListener("click", function () { done(null); });
        wrap.querySelector(".ac-ok").addEventListener("click", function () {
            var btn = this; btn.disabled = true;
            var sx = -x / s, sy = -y / s, sw = S / s;
            var out = Math.max(1, Math.min(MAX_OUT, Math.round(sw)));   // never upscale
            var c = document.createElement("canvas");
            c.width = out; c.height = out;
            var g = c.getContext("2d");
            g.imageSmoothingEnabled = true;
            g.imageSmoothingQuality = "high";
            var png = file.type === "image/png";
            if (!png) { g.fillStyle = "#fff"; g.fillRect(0, 0, out, out); }
            g.drawImage(img, sx, sy, sw, sw, 0, 0, out, out);
            c.toBlob(function (b) { done(b); }, png ? "image/png" : "image/jpeg", 0.95);
        });

        window.addEventListener("resize", layout);
        requestAnimationFrame(function () { wrap.classList.add("in"); layout(); });
    }

    // Instagram-style action sheet: items [{label, value, danger}] -> Promise<value|null>
    window.attSheet = function (o) {
        return new Promise(function (resolve) {
            var w = el("div", "ac-wrap ac-sheet");
            var html = '<div class="ac-card">' + (o.title ? '<div class="ac-sheet-head">' + (o.image ? '<span class="ac-sheet-av">' + o.image + '</span>' : '') + '<b></b></div>' : '') + '<div class="ac-sheet-list">';
            o.items.forEach(function (it, i) { html += '<button type="button" data-i="' + i + '" class="' + (it.danger ? "danger" : "") + '">' + (it.icon || "") + '<span></span></button>'; });
            html += '</div><button type="button" class="ac-sheet-cancel">' + L("Batal", "Cancel") + '</button></div>';
            w.innerHTML = html;
            if (o.title) w.querySelector(".ac-sheet-head b").textContent = o.title;
            o.items.forEach(function (it, i) { w.querySelector('[data-i="' + i + '"] span').textContent = it.label; });
            document.body.appendChild(w);
            requestAnimationFrame(function () { w.classList.add("in"); });
            function fin(v) { w.classList.add("out"); setTimeout(function () { w.remove(); }, 160); document.removeEventListener("keydown", k); resolve(v); }
            function k(e) { if (e.key === "Escape") fin(null); }
            document.addEventListener("keydown", k);
            w.addEventListener("click", function (e) {
                if (e.target === w || e.target.closest(".ac-sheet-cancel")) return fin(null);
                var b = e.target.closest("[data-i]");
                if (b) fin(o.items[Number(b.getAttribute("data-i"))].value);
            });
        });
    };

    window.attConfirm = function (o) {
        return new Promise(function (resolve) {
            var w = el("div", "ac-wrap ac-confirm");
            w.innerHTML = '<div class="ac-card"><div class="ac-top"><b></b><small></small></div><div class="ac-actions"><button type="button" class="ac-cancel"></button><button type="button" class="ac-ok danger"></button></div></div>';
            w.querySelector("b").textContent = o.title || "";
            w.querySelector("small").textContent = o.text || "";
            w.querySelector(".ac-cancel").textContent = o.cancel || L("Batal", "Cancel");
            w.querySelector(".ac-ok").textContent = o.ok || "OK";
            // o.tone: "primary" = a normal "continue" button (default stays red, for deleting)
            if (o.tone === "primary") w.querySelector(".ac-ok").classList.remove("danger");
            // o.info: just a message with one button
            if (o.info) { w.querySelector(".ac-cancel").remove(); w.querySelector(".ac-actions").classList.add("one"); }
            document.body.appendChild(w);
            requestAnimationFrame(function () { w.classList.add("in"); });
            function fin(v) { w.classList.add("out"); setTimeout(function () { w.remove(); }, 160); document.removeEventListener("keydown", k); resolve(v); }
            function k(e) { if (e.key === "Escape") fin(false); }
            document.addEventListener("keydown", k);
            w.addEventListener("click", function (e) { if (e.target === w) fin(false); });
            var cb = w.querySelector(".ac-cancel"); if (cb) cb.addEventListener("click", function () { fin(false); });
            w.querySelector(".ac-ok").addEventListener("click", function () { fin(true); });
        });
    };
})();
