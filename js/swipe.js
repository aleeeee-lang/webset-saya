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
        var sx = 0, sy = 0, dx = 0, mode = "", v = 0, hist = [];
        el.addEventListener("touchstart", function (e) {
            mode = "";
            if (e.touches.length !== 1 || !phone() || (h.enabled && !h.enabled())) { mode = "no"; return; }
            var t = e.touches[0], W = window.innerWidth;
            if (t.clientX < 22 || t.clientX > W - 22) { mode = "no"; return; }   // leave the screen edges to Android "back"
            if (blocked(e.target, el) || (h.skip && h.skip(e.target))) { mode = "no"; return; }
            sx = t.clientX; sy = t.clientY; dx = 0; v = 0; hist = [{ x: t.clientX, t: e.timeStamp || performance.now() }];
        }, { passive: true });
        el.addEventListener("touchmove", function (e) {
            if (mode === "no" || e.touches.length !== 1) return;
            var t = e.touches[0], mx = t.clientX - sx, my = t.clientY - sy;
            if (!mode) {
                if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { mode = "no"; return; }
                if (Math.abs(mx) < 12 || Math.abs(mx) < Math.abs(my) * 1.3) return;
                // the browser already decided this is a scroll: leave it alone
                if (!e.cancelable) { mode = "no"; return; }
                mode = "drag";
                sx = t.clientX;            // start counting from here: no jump of 12 px when the page starts to follow
                if (h.start(mx < 0 ? 1 : -1) === false) { mode = "no"; return; }
                mx = 0;
            }
            if (e.cancelable) e.preventDefault();
            // finger speed over the last ~100 ms (px/ms), for flicks
            var now = e.timeStamp || performance.now();
            hist.push({ x: t.clientX, t: now });
            while (hist.length > 2 && now - hist[0].t > 100) hist.shift();
            var span = now - hist[0].t;
            v = span > 0 ? (t.clientX - hist[0].x) / span : (t.clientX - hist[0].x) / 16;
            dx = t.clientX - sx;
            h.move(dx);
        }, { passive: false });
        function end(e) {
            if (mode !== "drag") { mode = ""; return; }
            mode = "";
            // a finger resting still for a moment before lifting means "no flick"
            var now = (e && e.timeStamp) || performance.now();
            if (hist.length && now - hist[hist.length - 1].t > 90) v = 0;
            h.end(v);
        }
        el.addEventListener("touchend", end);
        el.addEventListener("touchcancel", function () { if (mode === "drag") { mode = ""; h.end(0, true); } else mode = ""; });
    }

    // returns a handle whose stop() freezes it where it is (a new touch can pick the page up mid-way)
    function animate(from, to, ms, step, done) {
        if (reduce) ms = 1;
        var t0 = performance.now(), id = 0, h = { x: from, stop: function () { if (id) cancelAnimationFrame(id); id = 0; h.stopped = true; } };
        (function f(now) {
            if (h.stopped) return;
            var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
            h.x = from + (to - from) * e;
            step(h.x);
            if (k < 1) id = requestAnimationFrame(f); else { id = 0; if (done) done(); }
        })(t0);
        return h;
    }
    // past the last page: resist like IG, more and more the further you pull
    function rubber(dx) { var W = window.innerWidth || 400, a = Math.abs(dx); return (dx < 0 ? -1 : 1) * W * 0.18 * (1 - Math.exp(-a / (W * 0.45))); }
    // let go: open the neighbour, or spring back? (x = how far the page is out, v = finger speed px/ms)
    function decide(x, v, W) {
        if (!x) return false;
        var same = v !== 0 && (v < 0) === (x < 0), fast = Math.abs(v) > 0.3;
        if (fast && !same) return false;                 // flicked back: cancel, like IG
        if (fast && same && Math.abs(x) > 20) return true; // quick flick
        return Math.abs(x) > W * 0.4;                    // slow drag: needs to be past ~the middle
    }
    // no long-press text selection / menus while swiping (a slow drag often starts with a hold)
    if (coarse) document.addEventListener("contextmenu", function (e) {
        var t = e.target;
        if (!document.documentElement.classList.contains("att-swipe-page") && !(t.closest && t.closest(".att-tabswipe"))) return;
        if (t.closest && t.closest("input,textarea,select,[contenteditable]")) return;
        e.preventDefault();
    });

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

    function clean(root) { window.attSnapClean(root); }

    // drop everything below the first screens: the swipe only ever shows the top of a page
    function trim(orig, copy, limit) {
        var oc = orig.children, cc = copy.children;
        if (oc.length !== cc.length) return;
        for (var i = oc.length - 1; i >= 0; i--) {
            var r = oc[i].getBoundingClientRect(), top = r.top + window.scrollY, bottom = r.bottom + window.scrollY;
            if (r.width === 0 && r.height === 0) continue;
            if (top > limit) cc[i].remove();
            else if (bottom > limit && oc[i].children.length) trim(oc[i], cc[i], limit);
        }
    }

    // only keep a picture of the page once its data is in (never an empty, half-loaded page)
    function settled() {
        var n = window.attNet;
        if (document.readyState !== "complete" || performance.now() < 1200) return false;
        return !n || (!n.inflight && (!n.ever || Date.now() - n.quietAt > 300));
    }
    function saveSnapshot() {
        if (!navLinks() || !settled()) return;
        try {
            var c = document.body.cloneNode(true);
            trim(document.body, c, window.innerHeight * 1.3);
            clean(c);
            var html = c.innerHTML;
            if (html.length > 350000) return;
            var cs = getComputedStyle(document.body);
            localStorage.setItem(SNAP + page, JSON.stringify({
                html: html, cls: document.body.className, bg: cs.backgroundColor,
                pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(" "),
                theme: document.documentElement.getAttribute("data-theme") || "light", t: Date.now()
            }));
        } catch (e) {}
    }

    var ready = {};   // href -> prepared ghost element (not in the page yet)
    function prepare(href, label) {
        if (!ready[href]) ready[href] = ghostFor(href, label);
        return ready[href];
    }
    function ghostFor(href, label) { return window.attSnapGhost(href, label); }

    function initPages() {
        var info = navLinks();
        if (!info) return;
        document.documentElement.classList.add("att-swipe-page");
        var ghost = null, dir = 0, target = null, movers = [], pend = null, raf = 0;
        var x = 0, base = 0, anim = null, committing = false, active = false;
        var root = document.documentElement;
        function vis(px) { return target && ((dir === 1 && px <= 0) || (dir === -1 && px >= 0)) ? px : rubber(px); }
        function apply(px) {
            var t = "translate3d(" + px + "px,0,0)";
            for (var i = 0; i < movers.length; i++) movers[i].style.transform = t;
            if (ghost) ghost.style.transform = "translate3d(" + (px + dir * window.innerWidth) + "px,0,0)";
        }
        function setX(px) {            // during the drag: at most one paint per frame
            pend = px;
            if (!raf) raf = requestAnimationFrame(function () { raf = 0; if (pend != null) apply(pend); });
        }
        function reset() {
            if (raf) { cancelAnimationFrame(raf); raf = 0; }
            movers.forEach(function (m) { m.style.transform = ""; m.style.willChange = ""; });
            movers = [];
            root.classList.remove("att-swiping");
            if (ghost) { ghost.remove(); ghost = null; }
            target = null; dir = 0; pend = null; x = 0; active = false; anim = null;
        }
        // which neighbour is next to the page: the one on the side the page moved away from
        function side(d) {
            if (d === dir) return;
            if (ghost) ghost.remove();
            dir = d;
            target = info.links[info.idx + d] || null;
            ghost = null;
            if (target) {
                ghost = prepare(target.getAttribute("href").split(/[?#]/)[0], (target.textContent || "").trim());
                ghost.style.transform = "translate3d(" + (dir * window.innerWidth) + "px,0,0)";
                document.body.appendChild(ghost);
            }
        }
        // parse the neighbours' snapshots ahead of time
        function warm() {
            [info.links[info.idx - 1], info.links[info.idx + 1]].forEach(function (a) {
                if (a) prepare(a.getAttribute("href").split(/[?#]/)[0], (a.textContent || "").trim());
            });
        }
        (window.requestIdleCallback || function (f) { return setTimeout(f, 1200); })(warm);
        gesture(document.body, {
            enabled: function () { return !committing && !document.querySelector(".att-tabswipe-on"); },
            skip: function (t) { return !!(t.closest && t.closest("[data-swipe-tabs]")); },
            start: function (d) {
                if (committing) return false;
                if (window.attArriveDone) window.attArriveDone();
                if (anim) { anim.stop(); base = anim.x; anim = null; }   // caught while springing back
                else base = 0;
                if (!active) {
                    active = true;
                    root.classList.add("att-swiping");
                    movers = Array.prototype.filter.call(document.body.children, function (n) {
                        return !/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(n.tagName) && !n.classList.contains("bottom-nav") && !n.classList.contains("att-swipe-ghost") && !n.classList.contains("v2-side") && !n.classList.contains("v2-search-panel");
                    });
                    movers.forEach(function (m) { m.style.willChange = "transform"; });
                    dir = 0;
                    side(d);
                }
            },
            move: function (dx) {
                x = base + dx;
                if (x < -2) side(1); else if (x > 2) side(-1);
                setX(vis(x));
            },
            end: function (v, cancelled) {
                var W = window.innerWidth;
                if (raf) { cancelAnimationFrame(raf); raf = 0; }
                var from = vis(x);
                if (!cancelled && target && decide(x, v, W) && (x < 0) === (dir === 1)) {
                    committing = true;
                    var href = target.getAttribute("href");
                    info.links.forEach(function (a) { a.classList.toggle("active", a === target); });
                    // finish at the finger's speed (faster flick = shorter finish)
                    var left = W - Math.abs(from), ms = Math.max(140, Math.min(300, left / Math.max(1.2, Math.abs(v || 0))));
                    anim = animate(from, -dir * W, ms, apply, function () {
                        try { sessionStorage.setItem("att-swiped", "1"); sessionStorage.setItem("att-swiped-anim", "1"); } catch (e) {}
                        saveSnapshot();
                        location.href = href;
                    });
                } else {
                    anim = animate(from, 0, Math.max(160, Math.min(320, Math.abs(from) * 0.9)), apply, reset);
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
        window.addEventListener("pageshow", function (e) { if (e.persisted) { committing = false; reset(); } });
        window.addEventListener("pagehide", saveSnapshot);
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") saveSnapshot(); });
        // first picture once the page has settled (checked every second, for up to 20 s)
        var tries = 0;
        (function waitSettled() {
            if (settled()) return (window.requestIdleCallback || function (f) { f(); })(saveSnapshot);
            if (++tries < 20) setTimeout(waitSettled, 1000);
        })();
    }

    // ---------- 2) tabs inside a page ----------
    // cfg: { area: element (holds the panes), listen?: element that takes the swipe (default: area), keys: () => [key], current: () => key, pane: key => element, go: key => void, before?: key => void }
    function tabSwipe(cfg) {
        var area = cfg.area;
        if (!area) return;
        area.setAttribute("data-swipe-tabs", "");
        area.classList.add("att-tabswipe");
        var cur = null, nb = null, dir = 0, W = 0, keys = [], ci = -1;
        var pend = null, raf = 0, x = 0, base = 0, anim = null, active = false, committing = false;
        function vis(px) { return nb && ((dir === 1 && px <= 0) || (dir === -1 && px >= 0)) ? px : rubber(px); }
        function apply(px) {
            if (cur) cur.style.transform = "translate3d(" + px + "px,0,0)";
            if (nb) nb.style.transform = "translate3d(" + (px + dir * W) + "px,0,0)";
        }
        function setX(px) {
            pend = px;
            if (!raf) raf = requestAnimationFrame(function () { raf = 0; if (pend != null) apply(pend); });
        }
        function unpin(p) {
            if (!p) return;
            p.style.transform = ""; p.style.position = ""; p.style.top = ""; p.style.left = ""; p.style.width = "";
            p.classList.remove("att-tabswipe-moving");
            if (p.getAttribute("data-swipe-was-hidden") === "1") p.hidden = true;
            p.removeAttribute("data-swipe-was-hidden");
        }
        function reset() {
            if (raf) { cancelAnimationFrame(raf); raf = 0; }
            unpin(nb);
            if (cur) { cur.style.transform = ""; cur.classList.remove("att-tabswipe-moving"); }
            area.classList.remove("att-tabswipe-on");
            cur = nb = null; dir = 0; x = 0; active = false; anim = null;
        }
        function side(d) {
            if (d === dir) return;
            unpin(nb);
            dir = d;
            var nk = keys[ci + d];
            nb = nk != null ? cfg.pane(nk) : null;
            if (nb) {
                if (cfg.before) cfg.before(nk);
                nb.setAttribute("data-swipe-was-hidden", nb.hidden ? "1" : "0");
                nb.hidden = false;
                nb.style.position = "absolute";
                nb.style.top = cur.offsetTop + "px";
                nb.style.left = cur.offsetLeft + "px";
                nb.style.width = cur.offsetWidth + "px";
                nb.style.transform = "translate3d(" + (dir * W) + "px,0,0)";
                nb.classList.add("att-tabswipe-moving");
                nb._swipeKey = nk;
            }
        }
        gesture(cfg.listen || area, {
            enabled: function () { return !committing; },
            start: function (d) {
                if (committing) return false;
                if (anim) { anim.stop(); base = anim.x; anim = null; } else base = 0;
                if (!active) {
                    keys = cfg.keys(); var k = cfg.current(); ci = keys.indexOf(k);
                    cur = cfg.pane(k);
                    if (!cur) return false;
                    active = true;
                    W = area.clientWidth || window.innerWidth;
                    area.classList.add("att-tabswipe-on");
                    cur.classList.add("att-tabswipe-moving");
                    dir = 0;
                    side(d);
                }
            },
            move: function (dx) {
                x = base + dx;
                if (x < -2) side(1); else if (x > 2) side(-1);
                setX(vis(x));
            },
            end: function (v, cancelled) {
                if (raf) { cancelAnimationFrame(raf); raf = 0; }
                var from = vis(x);
                if (!cancelled && nb && decide(x, v, W) && (x < 0) === (dir === 1)) {
                    committing = true;
                    var k = nb._swipeKey;
                    var ms = Math.max(140, Math.min(300, (W - Math.abs(from)) / Math.max(1.2, Math.abs(v || 0))));
                    anim = animate(from, -dir * W, ms, apply, function () {
                        if (nb) nb.setAttribute("data-swipe-was-hidden", "0");
                        reset();
                        committing = false;
                        cfg.go(k);
                    });
                } else {
                    anim = animate(from, 0, Math.max(160, Math.min(320, Math.abs(from) * 0.9)), apply, reset);
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
