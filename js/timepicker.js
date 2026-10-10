// Round clock-dial time picker (24h), used by the schedule time fields.
// openClockPicker("07:15", function (value) { ... "HH:MM" ... });
(function () {
    var overlay, state = null;

    function t(id, en) { try { return (localStorage.getItem("attendly-lang") || "en") === "id" ? id : en; } catch (e) { return en; } }
    function pad(n) { return String(n).padStart(2, "0"); }

    function build() {
        overlay = document.createElement("div");
        overlay.className = "tp-overlay";
        overlay.innerHTML =
            '<div class="tp-card" role="dialog" aria-modal="true">' +
                '<div class="tp-head"><span class="tp-label"></span>' +
                    '<div class="tp-digits"><button type="button" class="tp-seg" data-mode="h"></button><span>:</span><button type="button" class="tp-seg" data-mode="m"></button></div>' +
                '</div>' +
                '<div class="tp-dial"><div class="tp-hand"><i></i></div><div class="tp-center"></div><div class="tp-nums"></div></div>' +
                '<div class="tp-actions"><button type="button" class="tp-cancel"></button><button type="button" class="tp-ok"></button></div>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
        overlay.querySelector(".tp-cancel").addEventListener("click", close);
        overlay.querySelector(".tp-ok").addEventListener("click", function () {
            var cb = state.cb, v = pad(state.h) + ":" + pad(state.m);
            close(); cb(v);
        });
        overlay.querySelectorAll(".tp-seg").forEach(function (b) {
            b.addEventListener("click", function () { state.mode = b.dataset.mode; render(); });
        });
        var dial = overlay.querySelector(".tp-dial"), dragging = false;
        function pick(e, final) {
            var r = dial.getBoundingClientRect();
            var x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
            var ang = (Math.atan2(y, x) * 180 / Math.PI + 450) % 360;
            var dist = Math.sqrt(x * x + y * y) / (r.width / 2);
            if (state.mode === "h") {
                var n = Math.round(ang / 30) % 12;
                var inner = dist < 0.62;
                state.h = inner ? (n === 0 ? 0 : n + 12) : (n === 0 ? 12 : n);
            } else {
                state.m = Math.round(ang / 6) % 60;
            }
            render();
            if (final && state.mode === "h") setTimeout(function () { state.mode = "m"; render(); }, 220);
        }
        dial.addEventListener("pointerdown", function (e) { dragging = true; dial.setPointerCapture(e.pointerId); pick(e, false); });
        dial.addEventListener("pointermove", function (e) { if (dragging) pick(e, false); });
        dial.addEventListener("pointerup", function (e) { if (dragging) { dragging = false; pick(e, true); } });
        document.addEventListener("keydown", function (e) { if (state && e.key === "Escape") close(); });
    }

    function render() {
        overlay.querySelector(".tp-label").textContent = state.mode === "h" ? t("Pilih jam", "Select hour") : t("Pilih menit", "Select minute");
        overlay.querySelector(".tp-cancel").textContent = t("Batal", "Cancel");
        overlay.querySelector(".tp-ok").textContent = "OK";
        var segs = overlay.querySelectorAll(".tp-seg");
        segs[0].textContent = pad(state.h); segs[1].textContent = pad(state.m);
        segs[0].classList.toggle("on", state.mode === "h"); segs[1].classList.toggle("on", state.mode === "m");

        var nums = overlay.querySelector(".tp-nums"), html = "";
        function place(label, value, angDeg, radius, cls) {
            var a = (angDeg - 90) * Math.PI / 180;
            var x = 50 + Math.cos(a) * radius, y = 50 + Math.sin(a) * radius;
            var sel = state.mode === "h" ? state.h === value : state.m === value;
            html += '<span class="tp-num ' + cls + (sel ? " sel" : "") + '" style="left:' + x + '%;top:' + y + '%">' + label + '</span>';
        }
        var handAng, handLen;
        if (state.mode === "h") {
            for (var i = 1; i <= 12; i++) place(String(i), i, i * 30, 40, "outer");
            for (var j = 13; j <= 24; j++) place(j === 24 ? "00" : String(j), j === 24 ? 0 : j, (j - 12) * 30, 26, "inner");
            handAng = (state.h % 12) * 30;
            handLen = (state.h === 0 || state.h > 12) ? 26 : 40;
        } else {
            for (var k = 0; k < 60; k += 5) place(pad(k), k, k * 6, 40, "outer");
            handAng = state.m * 6; handLen = 40;
        }
        nums.innerHTML = html;
        var hand = overlay.querySelector(".tp-hand");
        hand.style.transform = "rotate(" + handAng + "deg)";
        hand.style.height = handLen + "%";
        hand.classList.toggle("between", state.mode === "m" && state.m % 5 !== 0);
    }

    function close() { overlay.classList.remove("open"); state = null; }

    window.openClockPicker = function (value, cb) {
        if (!overlay) build();
        var m = /^(\d{1,2}):(\d{2})/.exec(value || "");
        state = { h: m ? Number(m[1]) % 24 : 7, m: m ? Number(m[2]) % 60 : 0, mode: "h", cb: cb };
        render();
        overlay.classList.add("open");
    };
})();
