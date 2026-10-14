// Instagram-style swiping (phones only).
//  1) Pages of the bottom menu: drag left/right and the page follows the finger,
//     with the neighbouring page sliding in next to it. The neighbour is drawn from
//     a snapshot of how it looked the last time it was opened (a light skeleton
//     before the first visit); letting go past the middle opens that page.
//  2) Tabs inside a page (Juara, Class cash): same gesture between the tab panes.
//     Pages register them with  (window.attSwipeQ = window.attSwipeQ || []).push({...})
(function () {
    var page = (location.pathname.split("/").pop() || "index.html").replace(/[?#].*$/, "");
    var SNAP = "att-snap:";

    function purge() {
        try {
            for (var i = localStorage.length - 1; i >= 0; i--) {
                var k = localStorage.key(i);
                if (k && k.indexOf(SNAP) === 0) localStorage.removeItem(k);
            }
        } catch (e) {}
    }
    window.attSwipePurge = purge;
    if (/^(login|reset-password)\.html$/.test(page)) { purge(); return; }
    if (window.self !== window.top) return;

    var coarse = false;
    try { coarse = window.matchMedia("(pointer: coarse)").matches; } catch (e) {}
    var reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    function phone() { return coarse && window.innerWidth < 1024; }

    // ---------- shared gesture helper ----------
    // decides early whether a touch is a horizontal drag (ours) or a vertical scroll (browser's)
    function blocked(t, stopAt) {
        for (var n = t; n && n !== stopAt && n !== document.body; n = n.parentElement) {
            if (n.nodeType !== 1) continue;
            var tag = n.tagName;
            if (/^(INPUT|TEXTAREA|SELECT|IFRAME)$/.test(tag) || n.isContentEditable) return true;
            if (n.hasAttribute("data-noswipe")) return true;
            var cs = getComputedStyle(n);
            if (cs.position === "fixed" && !n.classList.contains("att-swipe-ghost")) return true;   // sheets, dialogs, nav
            if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
        }
        return false;
    }

    function gesture(el, h) {
        var sx = 0, sy = 0, st = 0, dx = 0, mode = "", lastX = 0, lastT = 0, v = 0;
        el.addEventListener("touchstart", function (e) {
            mode = "";
            if (e.touches.length !== 1 || !phone() || (h.enabled && !h.enabled())) { mode = "no"; return; }
            var t = e.touches[0], W = window.innerWidth;
            if (t.clientX < 22 || t.clientX > W - 22) { mode = "no"; return; }   // leave the screen edges to Android "back"
            if (blocked(e.target, el) || (h.skip && h.skip(e.target))) { mode = "no"; return; }
            sx = lastX = t.clientX; sy = t.clientY; st = lastT = Date.now(); dx = 0; v = 0;
        }, { passive: true });
        el.addEventListener("touchmove", function (e) {
            if (mode === "no" || e.touches.length !== 1) return;
            var t = e.touches[0], mx = t.clientX - sx, my = t.clientY - sy;
            if (!mode) {
                if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { mode = "no"; return; }
                if (Math.abs(mx) < 12 || Math.abs(mx) < Math.abs(my) * 1.3) return;
                mode = "drag";
                if (h.start(mx < 0 ? 1 : -1) === false) { mode = "no"; return; }
            }
            if (e.cancelable) e.preventDefault();
            var now = Date.now();
            if (now > lastT) { v = (t.clientX - lastX) / (now - lastT); lastX = t.clientX; lastT = now; }
            dx = mx;
            h.move(dx);
        }, { passive: false });
        function end() {
            if (mode !== "drag") { mode = ""; return; }
            mode = "";
            var W = window.innerWidth;
            var go = Math.abs(dx) > W * 0.32 || (Math.abs(v) > 0.45 && Math.abs(dx) > 30 && (v < 0) === (dx < 0));
            h.end(go, dx);
        }
        el.addEventListener("touchend", end);
        el.addEventListener("touchcancel", function () { if (mode === "drag") { mode = ""; h.end(false, dx); } else mode = ""; });
    }

    function animate(from, to, ms, step, done) {
        if (reduce) ms = 1;
        var t0 = performance.now();
        (function f(now) {
            var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
            step(from + (to - from) * e);
            if (k < 1) requestAnimationFrame(f); else if (done) done();
        })(t0);
    }
    function rubber(dx) { return dx * 0.28; }   // nothing on that side: resist like IG

    // ---------- 1) bottom-menu pages ----------
    function navLinks() {
        var nav = document.querySelector(".bottom-nav");
        if (!nav) return null;
        var links = Array.prototype.slice.call(nav.querySelectorAll("a[href]"));
        var idx = -1;
        links.forEach(function (a, i) {
            var hp = (a.getAttribute("href") || "").split(/[?#]/)[0];
            if (hp === page || (page === "" && hp === "index.html")) idx = i;
        });
        return idx < 0 ? null : { links: links, idx: idx };
    }

    function clean(root) {
        Array.prototype.forEach.call(root.querySelectorAll("script,iframe,object,embed,video,audio,.bottom-nav,.att-swipe-ghost,.att-side,#toastContainer,.toast-container,dialog,[role=dialog]"), function (n) { n.remove(); });
        Array.prototype.forEach.call(root.querySelectorAll("*"), function (n) {
            for (var i = n.attributes.length - 1; i >= 0; i--) {
                var a = n.attributes[i].name;
                if (/^on/i.test(a) || a === "id" || a === "data-count" || a === "data-needs" || a === "autofocus") n.removeAttribute(a);
            }
            if (n.tagName === "A") n.removeAttribute("href");
        });
    }

    function saveSnapshot() {
        if (!navLinks()) return;
        try {
            var c = document.body.cloneNode(true);
            clean(c);
            var html = c.innerHTML;
            if (html.length > 350000) return;
            var cs = getComputedStyle(document.body);
            localStorage.setItem(SNAP + page, JSON.stringify({
                html: html, cls: document.body.className, bg: cs.backgroundColor,
                pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(" "), t: Date.now()
            }));
        } catch (e) {}
    }

    function ghostFor(href, label) {
        var g = document.createElement("div");
        g.className = "att-swipe-ghost";
        g.setAttribute("aria-hidden", "true");
        var snap = null;
        try { snap = JSON.parse(localStorage.getItem(SNAP + href) || "null"); } catch (e) {}
        var inner = document.createElement("div");
        inner.className = "att-swipe-body";
        if (snap && snap.html) {
            var tpl = document.createElement("template");
            tpl.innerHTML = snap.html;
            clean(tpl.content);
            inner.appendChild(tpl.content);
            if (snap.cls) inner.className += " " + snap.cls.replace(/\bhas-side\b/g, "");
            inner.style.padding = snap.pad || "";
            g.style.background = snap.bg || "";
        } else {
            inner.className += " att-swipe-skel";
            inner.innerHTML = '<div class="sk-head"><b></b><i></i></div><div class="sk-title">' + (typeof escapeHTML === "function" ? escapeHTML(label || "") : "") + '</div><div class="sk-card big"></div><div class="sk-row"><div class="sk-card"></div><div class="sk-card"></div></div><div class="sk-card"></div><div class="sk-card"></div>';
            g.style.background = getComputedStyle(document.body).backgroundColor;
        }
        g.appendChild(inner);
        return g;
    }

    function initPages() {
        var info = navLinks();
        if (!info) return;
        document.documentElement.classList.add("att-swipe-page");
        var ghost = null, dir = 0, target = null;
        var root = document.documentElement;
        function setX(x) {
            root.style.setProperty("--att-sw", x + "px");
            if (ghost) ghost.style.transform = "translate3d(" + (x + dir * window.innerWidth) + "px,0,0)";
        }
        function reset() {
            root.classList.remove("att-swiping");
            root.style.removeProperty("--att-sw");
            if (ghost) { ghost.remove(); ghost = null; }
            target = null; dir = 0;
        }
        gesture(document.body, {
            enabled: function () { return !document.querySelector(".att-tabswipe-on"); },
            skip: function (t) { return !!(t.closest && t.closest("[data-swipe-tabs]")); },
            start: function (d) {
                var i = info.idx + d;
                dir = d;
                target = info.links[i] || null;
                root.classList.add("att-swiping");
                if (target) {
                    ghost = ghostFor(target.getAttribute("href").split(/[?#]/)[0], (target.textContent || "").trim());
                    document.body.appendChild(ghost);
                }
            },
            move: function (dx) {
                if (!target || (dir === 1 && dx > 0) || (dir === -1 && dx < 0)) dx = rubber(dx);
                setX(dx);
            },
            end: function (go, dx) {
                var W = window.innerWidth;
                if (go && target && (dx < 0) === (dir === 1)) {
                    var href = target.getAttribute("href");
                    info.links.forEach(function (a) { a.classList.toggle("active", a === target); });
                    animate(dx, -dir * W, 200, setX, function () {
                        saveSnapshot();
                        try { sessionStorage.setItem("att-swiped", "1"); } catch (e) {}
                        location.href = href;
                    });
                } else {
                    var from = (!target || (dir === 1 && dx > 0) || (dir === -1 && dx < 0)) ? rubber(dx) : dx;
                    animate(from, 0, 220, setX, reset);
                }
            }
        });
        // the slide already happened under the finger: no extra page transition on top
        window.addEventListener("pageswap", function (e) {
            var f = null;
            try { f = sessionStorage.getItem("att-swiped"); } catch (x) {}
            if (f && e.viewTransition) e.viewTransition.skipTransition();
        });
        // coming back with the browser's back button keeps the page in memory: undo the slide
        window.addEventListener("pageshow", function (e) { if (e.persisted) reset(); });
        window.addEventListener("pagehide", saveSnapshot);
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") saveSnapshot(); });
        setTimeout(saveSnapshot, 4000);
    }

    // ---------- 2) tabs inside a page ----------
    // cfg: { area: element (holds the panes), listen?: element that takes the swipe (default: area), keys: () => [key], current: () => key, pane: key => element, go: key => void, before?: key => void }
    function tabSwipe(cfg) {
        var area = cfg.area;
        if (!area) return;
        area.setAttribute("data-swipe-tabs", "");
        area.classList.add("att-tabswipe");
        var cur = null, nb = null, dir = 0, W = 0;
        function setX(x) {
            if (cur) cur.style.transform = "translate3d(" + x + "px,0,0)";
            if (nb) nb.style.transform = "translate3d(" + (x + dir * W) + "px,0,0)";
        }
        function reset() {
            [cur, nb].forEach(function (p) { if (p) { p.style.transform = ""; p.style.position = ""; p.style.top = ""; p.style.left = ""; p.style.width = ""; p.classList.remove("att-tabswipe-moving"); } });
            if (nb && nb.getAttribute("data-swipe-was-hidden") === "1") nb.hidden = true;
            if (nb) nb.removeAttribute("data-swipe-was-hidden");
            area.classList.remove("att-tabswipe-on");
            cur = nb = null; dir = 0;
        }
        gesture(cfg.listen || area, {
            start: function (d) {
                var keys = cfg.keys(), k = cfg.current(), i = keys.indexOf(k);
                cur = cfg.pane(k);
                if (!cur) return false;
                dir = d; W = area.clientWidth || window.innerWidth;
                var nk = keys[i + d];
                nb = nk != null ? cfg.pane(nk) : null;
                area.classList.add("att-tabswipe-on");
                cur.classList.add("att-tabswipe-moving");
                if (nb) {
                    if (cfg.before) cfg.before(nk);
                    nb.setAttribute("data-swipe-was-hidden", nb.hidden ? "1" : "0");
                    nb.hidden = false;
                    nb.style.position = "absolute";
                    nb.style.top = cur.offsetTop + "px";
                    nb.style.left = cur.offsetLeft + "px";
                    nb.style.width = cur.offsetWidth + "px";
                    nb.classList.add("att-tabswipe-moving");
                    nb._swipeKey = nk;
                }
            },
            move: function (dx) {
                if (!nb || (dir === 1 && dx > 0) || (dir === -1 && dx < 0)) dx = rubber(dx);
                setX(dx);
            },
            end: function (go, dx) {
                if (go && nb && (dx < 0) === (dir === 1)) {
                    var k = nb._swipeKey;
                    animate(dx, -dir * W, 200, setX, function () {
                        if (nb) nb.setAttribute("data-swipe-was-hidden", "0");
                        reset();
                        cfg.go(k);
                    });
                } else {
                    var from = (!nb || (dir === 1 && dx > 0) || (dir === -1 && dx < 0)) ? rubber(dx) : dx;
                    animate(from, 0, 220, setX, reset);
                }
            }
        });
    }
    window.attTabSwipe = tabSwipe;

    function boot() {
        initPages();
        var q = window.attSwipeQ || [];
        q.forEach(tabSwipe);
        window.attSwipeQ = { push: tabSwipe };
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
