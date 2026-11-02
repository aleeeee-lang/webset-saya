// Admin: SPP · Tabungan · Kas kelas as one "Keuangan" section with tabs (2026 redesign).
// Include right after <main>…</main>; does nothing for other roles.
(function () {
    var role = "";
    try { role = (JSON.parse(localStorage.getItem("attendreem-profile") || "{}")).role || ""; } catch (e) {}
    if (role !== "admin") return;
    var main = document.querySelector("main");
    if (!main) return;
    // SPP, Tabungan and Kas kelas are built differently: put the title and the tabs at exactly the
    // same spot on all three, so switching tabs doesn't make them jump up and down
    function align() {
        var nav = main.querySelector(".fin-tabs"), h1 = main.querySelector("h1");
        if (!nav || !h1) return;
        nav.style.marginTop = ""; main.style.marginTop = "";
        var side = document.body.classList.contains("has-side") && window.innerWidth >= 1024;
        var want = side ? 28 : 20, y = window.scrollY || 0;
        var top = h1.getBoundingClientRect().top + y;
        if (Math.abs(top - want) > 0.5) main.style.marginTop = (want - top) + "px";
        var gap = nav.getBoundingClientRect().top - h1.getBoundingClientRect().top;
        if (Math.abs(gap - 46) > 0.5) nav.style.marginTop = (parseFloat(getComputedStyle(nav).marginTop) + 46 - gap) + "px";
    }
    function alignSoon() { requestAnimationFrame(align); }
    align();                                   // before the first paint: no visible move
    window.addEventListener("load", alignSoon);
    window.addEventListener("resize", alignSoon);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignSoon);
    new MutationObserver(alignSoon).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    // the other two tabs are opened quietly in the background (Chrome), so a tap switches at once
    try {
        if (HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules") && !document.getElementById("finPrerender")) {
            var others = ["admin-spp.html", "admin-savings.html", "kas.html"].filter(function (h) { return h !== (location.pathname.split("/").pop() || ""); });
            var sr = document.createElement("script");
            sr.type = "speculationrules"; sr.id = "finPrerender";
            sr.textContent = JSON.stringify({ prerender: [{ source: "list", urls: others, eagerness: "eager" }] });
            document.head.appendChild(sr);
        }
    } catch (e) {}
    if (main.querySelector(".fin-tabs")) return;
    var id = (typeof getLang === "function" ? getLang() : "id") === "id";
    var page = (location.pathname.split("/").pop() || "").toLowerCase();
    var tabs = [["admin-spp.html", "SPP", "SPP"], ["admin-savings.html", "Tabungan", "Savings"], ["kas.html", "Kas kelas", "Class cash"]];
    var nav = document.createElement("nav");
    nav.className = "tl-tabs fin-tabs";
    nav.setAttribute("aria-label", id ? "Keuangan" : "Money");
    nav.innerHTML = tabs.map(function (t) {
        var on = t[0] === page;
        return '<a href="' + t[0] + '"' + (on ? ' class="on" aria-current="page"' : '') + '>' + (id ? t[1] : t[2]) + '</a>';
    }).join("");
    var head = main.querySelector(".attendance-intro, .v2-head, header");
    // one place, one title: every tab says "Keuangan" and has no back button (it's a bottom-menu page)
    if (head) {
        var title = id ? "Keuangan" : "Money";
        if (head.classList.contains("attendance-intro")) {
            var h = document.createElement("header");
            h.className = "v2-head v3-head fin-head";
            h.innerHTML = "<h1></h1>";
            h.firstChild.textContent = title;
            head.replaceWith(h);
            head = h;
        } else {
            var t = head.querySelector("h1, h2");
            if (t) { t.removeAttribute("data-i18n"); t.textContent = title; }
            var back = head.querySelector(".v2-back, .v3-back");
            if (back) back.remove();
        }
    }
    if (head && head.parentNode === main) head.insertAdjacentElement("afterend", nav);
    else main.insertBefore(nav, main.firstChild);
    document.documentElement.classList.add("fin-admin");
    alignSoon();
})();
