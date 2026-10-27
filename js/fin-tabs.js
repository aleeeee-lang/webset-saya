// Admin: SPP · Tabungan · Kas kelas as one "Keuangan" section with tabs (2026 redesign).
// Include right after <main>…</main>; does nothing for other roles.
(function () {
    var role = "";
    try { role = (JSON.parse(localStorage.getItem("attendreem-profile") || "{}")).role || ""; } catch (e) {}
    if (role !== "admin") return;
    var main = document.querySelector("main");
    if (!main || main.querySelector(".fin-tabs")) return;
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
    if (head && head.parentNode === main) head.insertAdjacentElement("afterend", nav);
    else main.insertBefore(nav, main.firstChild);
    document.documentElement.classList.add("fin-admin");
})();
