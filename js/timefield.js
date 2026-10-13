// Hour + minute boxes for <input class="v2-time">, with the round clock picker on the side.
// Same behaviour as the attendance-schedule page. The original input keeps "HH:MM" as its value.
(function () {
    function lang() { try { return (localStorage.getItem("attendly-lang") || "en") === "id"; } catch (e) { return false; } }

    window.normalizeTime = window.normalizeTime || function (raw) {
        var v = String(raw || "").trim().replace(/[.,]/g, ":");
        if (!v) return "";
        var h, m;
        if (v.indexOf(":") >= 0) {
            var parts = v.split(":");
            if (!/^\d{1,2}$/.test(parts[0]) || !/^\d{0,2}$/.test(parts[1] || "")) return null;
            h = Number(parts[0]);
            m = parts[1] ? Number(parts[1].length === 1 ? parts[1] + "0" : parts[1]) : 0;
        } else {
            var d = v.replace(/\D/g, "");
            if (!d || d.length > 4 || d.length !== v.length) return null;
            if (d.length <= 2) { h = Number(d); m = 0; }
            else if (d.length === 3) { h = Number(d.slice(0, 1)); m = Number(d.slice(1)); }
            else { h = Number(d.slice(0, 2)); m = Number(d.slice(2)); }
        }
        if (h > 23 || m > 59) return null;
        return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    };

    window.attTimeField = function (el) {
        if (el.__timeField) return;
        el.__timeField = true;
        var id = lang();
        var wrap = document.createElement("div");
        wrap.className = "v2-time-wrap";
        el.parentNode.insertBefore(wrap, el);
        wrap.appendChild(el);
        el.style.display = "none";

        var box = document.createElement("div");
        box.className = "v2-time-box";
        var hh = document.createElement("input"), mm = document.createElement("input");
        [hh, mm].forEach(function (inp, k) {
            inp.type = "text"; inp.inputMode = "numeric"; inp.maxLength = 2; inp.autocomplete = "off";
            inp.className = "v2-time-seg"; inp.placeholder = "--";
            inp.setAttribute("aria-label", k === 0 ? (id ? "Jam" : "Hour") : (id ? "Menit" : "Minute"));
        });
        var colon = document.createElement("span");
        colon.className = "v2-time-colon"; colon.textContent = ":";
        box.appendChild(hh); box.appendChild(colon); box.appendChild(mm);
        box.addEventListener("click", function (e) { if (e.target === box) (hh.value.length < 2 ? hh : mm).focus(); });
        wrap.appendChild(box);

        var btn = document.createElement("button");
        btn.type = "button"; btn.className = "v2-time-btn";
        btn.setAttribute("aria-label", id ? "Pilih jam" : "Pick a time");
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
        wrap.appendChild(btn);

        var nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        function sync() {
            var h = hh.value, m = mm.value;
            var v = (h || m) ? (h.padStart(2, "0") + ":" + (m || "0").padStart(2, "0")) : "";
            nativeValue.set.call(el, v);
            var bad = (h.length === 2 && Number(h) > 23) || (m.length === 2 && Number(m) > 59);
            box.classList.toggle("invalid", bad);
            el.dispatchEvent(new Event("change"));
        }
        function show(v) {
            var t = normalizeTime(v);
            hh.value = t ? t.slice(0, 2) : "";
            mm.value = t ? t.slice(3, 5) : "";
            box.classList.remove("invalid");
        }
        Object.defineProperty(el, "value", {
            get: function () { return nativeValue.get.call(el); },
            set: function (v) { nativeValue.set.call(el, v); show(v); }
        });
        el.markInvalid = function (bad) { box.classList.toggle("invalid", !!bad); };

        hh.addEventListener("input", function () {
            var d = hh.value.replace(/\D/g, "").slice(0, 2);
            if (d.length === 1 && Number(d) > 2) d = "0" + d;
            hh.value = d; sync();
            if (d.length === 2 && Number(d) <= 23) { mm.focus(); mm.select(); }
        });
        mm.addEventListener("input", function () {
            var d = mm.value.replace(/\D/g, "").slice(0, 2);
            if (d.length === 1 && Number(d) > 5) d = "0" + d;
            mm.value = d; sync();
        });
        mm.addEventListener("keydown", function (e) {
            if (e.key === "Backspace" && mm.value === "") { e.preventDefault(); hh.focus(); hh.value = hh.value.slice(0, -1); sync(); }
        });
        hh.addEventListener("keydown", function (e) {
            if ((e.key === ":" || e.key === ".") && hh.value) { e.preventDefault(); if (hh.value.length === 1) hh.value = "0" + hh.value; sync(); mm.focus(); }
        });
        [hh, mm].forEach(function (inp) {
            inp.addEventListener("focus", function () { inp.select(); });
            inp.addEventListener("click", function () { inp.select(); });
            inp.addEventListener("blur", function () {
                if (inp.value.length === 1) inp.value = "0" + inp.value;
                if (inp === mm && hh.value && !mm.value) mm.value = "00";
                sync();
            });
        });
        btn.addEventListener("click", function () {
            if (typeof openClockPicker !== "function") return;
            openClockPicker(normalizeTime(nativeValue.get.call(el)) || "", function (v) { el.value = v; sync(); });
        });
        show(nativeValue.get.call(el));
    };
})();
