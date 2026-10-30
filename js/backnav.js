// Back button like a phone app:
//   - the bottom-menu pages (tabs) don't pile up: going tab -> tab replaces the page, so
//     "back" from any tab goes to Home, and "back" on Home leaves the app;
//   - a page opened from a tab (it has a back arrow) goes back to that tab, then Home.
// Every page entry keeps its depth in history.state (0 = the first page of this visit).
(function () {
    if (window.self !== window.top) return;
    // a page prepared in the background for a swipe: only set up once it is really shown
    if (document.prerendering) { document.addEventListener("prerenderingchange", init, { once: true }); return; }
    init();
    function init() {
    function file(u) { try { return (new URL(u, location.href).pathname.split("/").pop() || "index.html"); } catch (e) { return ""; } }
    var page = file(location.href);
    var role = "";
    try { role = (JSON.parse(localStorage.getItem("attendreem-profile") || "{}")).role || ""; } catch (e) {}
    var TABS = role === "admin" ? ["index.html", "admin-attendance.html", "qr-send.html", "admin-spp.html", "admin-menu.html"]
        : role === "guru" ? ["teacher.html", "teacher-class.html", "attendance.html", "schedule.html", "settings.html"]
        : role === "orangtua" ? ["parent.html"]
        : ["index.html", "schedule.html", "attendance.html", "history.html", "my-attendance.html"];
    var HOME = TABS[0];
    function isHome(p) { return p === HOME || (role === "guru" && p === "index.html"); }
    function isTab(p) { return TABS.indexOf(p) !== -1 || isHome(p); }
    function get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
    function del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }

    // this entry's depth: kept in history.state, or worked out for a new entry
    function depthNow() {
        var st = history.state || {};
        if (typeof st.attDepth === "number") return st.attDepth;
        var rep = get("att-bn-rep") === page; del("att-bn-rep");
        var prev = Number(get("att-bn-depth")); if (!isFinite(prev) || get("att-bn-depth") === null) prev = -1;
        var d = rep ? Math.max(prev, 0) : prev + 1;
        if (d === 0) set("att-bn-basehome", isHome(page) ? "1" : "0");
        try { history.replaceState(Object.assign({}, st, { attDepth: d }), ""); } catch (e) {}
        return d;
    }
    var depth = depthNow();
    set("att-bn-depth", String(depth));

    // opened straight on a page that isn't Home (a link, a notification): back goes to Home first
    // (not on the login pages: after logging in they are swapped for Home, which then leaves the app)
    var OUTSIDE = ["login.html", "reset-password.html"];
    if (depth === 0 && !isHome(page) && OUTSIDE.indexOf(page) === -1) {
        try { history.pushState({ attDepth: 1, attGuard: 1 }, ""); } catch (e) {}
        depth = 1; set("att-bn-depth", "1");
        window.addEventListener("popstate", function (e) {
            if (e.state && e.state.attGuard) return;
            set("att-bn-rep", HOME); set("att-bn-depth", "0"); set("att-bn-basehome", "1");
            location.replace(HOME);
        });
    }

    window.attNavGo = function (href) {
        var target = file(href);
        if (target === page) return;
        var baseHome = get("att-bn-basehome") === "1";
        if (isHome(target)) {
            if (baseHome && depth > 0) { history.go(-depth); return; }
            set("att-bn-rep", target); location.replace(href); return;
        }
        if (isHome(page)) { location.href = href; return; }
        if (isTab(page)) { set("att-bn-rep", target); location.replace(href); return; }
        // on a page under a tab: step back to the tab level, then swap it for the new tab
        if (baseHome && depth > 1) { set("att-bn-pending", href); history.go(-(depth - 1)); return; }
        location.href = href;
    };

    // arrived back on a tab on the way to another one (see above)
    window.addEventListener("pageshow", function () {
        depth = depthNow(); set("att-bn-depth", String(depth));
        var p = get("att-bn-pending");
        if (!p) return;
        del("att-bn-pending");
        if (file(p) === page) return;
        set("att-bn-rep", file(p));
        location.replace(p);
    });

    // bottom menu taps
    document.addEventListener("click", function (e) {
        if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target.closest && e.target.closest(".bottom-nav a[href]");
        if (!a) return;
        e.preventDefault();
        window.attNavGo(a.getAttribute("href"));
    });
    }
})();
