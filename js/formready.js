// Form buttons look "waiting" (dim) until the fields they need are filled,
// then switch to "ready". Buttons opt in with data-needs="fieldId,fieldId".
// The button is never disabled: tapping early still shows the usual hint.
(function () {
    function filled(el) {
        if (!el) return true;                                   // field not on this page/state
        if (el.type === "file") return !!(el.files && el.files.length);    // file pickers are often styled/hidden
        if (el.offsetParent === null && el.type !== "hidden") return true;   // hidden field: not required now
        if (el.type === "checkbox") return true;
        return String(el.value || "").trim() !== "";
    }
    function sync() {
        var btns = document.querySelectorAll("[data-needs]");
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            if (b.disabled && b.classList.contains("is-ready")) continue;   // busy saving: keep look
            var ok = b.getAttribute("data-needs").split(",").every(function (id) { return filled(document.getElementById(id.trim())); });
            b.classList.toggle("is-ready", ok);
            b.classList.toggle("is-waiting", !ok);
        }
    }
    var queued = false;
    function later() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; sync(); }); } }
    document.addEventListener("input", later, true);
    document.addEventListener("change", later, true);
    document.addEventListener("click", function () { setTimeout(sync, 60); }, true);   // pickers, tabs, resets
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync); else sync();
    setInterval(sync, 800);                                     // values set by code (lists loading, form reset)
    window.attFormReady = sync;
})();
