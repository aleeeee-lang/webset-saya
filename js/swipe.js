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

    function speed(hs) {
        var n = hs.length;
        if (n < 2) return 0;
        if (n === 2) { var d = hs[1].t - hs[0].t; return d > 0 ? (hs[1].x - hs[0].x) / d : 0; }
        var t0 = hs[0].t, st = 0, sx = 0, stt = 0, stx = 0;
        for (var i = 0; i < n; i++) { var tt = hs[i].t - t0; st += tt; sx += hs[i].x; stt += tt * tt; stx += tt * hs[i].x; }
        var den = n * stt - st * st;
        return den ? (n * stx - st * sx) / den : 0;
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
                // like Android's ViewPager: a small "slop" first, then whichever direction clearly wins
                if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) { mode = "no"; return; }
                if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(my) * 1.15) {
                    // still deciding, but it looks sideways: keep the browser from starting its own
                    // scroll in the meantime (on a slow finger it would otherwise grab the gesture
                    // first and the page would never follow)
                    if (Math.abs(mx) > Math.abs(my) && e.cancelable) e.preventDefault();
                    return;
                }
                mode = "drag";
                // the browser had already started scrolling up/down: freeze that while we drag sideways
                if (!e.cancelable) document.documentElement.classList.add("att-swipe-lock");
                sx = t.clientX;            // start counting from here: no jump of 12 px when the page starts to follow
                if (h.start(mx < 0 ? 1 : -1) === false) { mode = "no"; return; }
                mx = 0;
            }
            if (e.cancelable) e.preventDefault();
            // finger speed (px/ms) for flicks: least-squares over the last ~100 ms, like Android's
            // VelocityTracker - steadier than "last two points" when the finger moves slowly or jitters
            var now = e.timeStamp || performance.now();
            hist.push({ x: t.clientX, t: now });
            while (hist.length > 3 && now - hist[0].t > 100) hist.shift();
            v = speed(hist);
            dx = t.clientX - sx;
            h.move(dx);
        }, { passive: false });
        function end(e) {
            document.documentElement.classList.remove("att-swipe-lock");
            if (mode !== "drag") { mode = ""; return; }
            mode = "";
            // a finger resting still for a moment before lifting means "no flick"
            var now = (e && e.timeStamp) || performance.now();
            if (hist.length && now - hist[hist.length - 1].t > 70) v = 0;
            h.end(v);
        }
        el.addEventListener("touchend", end);
        el.addEventListener("touchcancel", function () { document.documentElement.classList.remove("att-swipe-lock"); if (mode === "drag") { mode = ""; h.end(0, true); } else mode = ""; });
    }

    // returns a handle whose stop() freezes it where it is (a new touch can pick the page up mid-way)
    function animate(from, to, ms, step, done) {
        if (reduce) ms = 1;
        var t0 = performance.now(), id = 0, h = { x: from, stop: function () { if (id) cancelAnimationFrame(id); id = 0; h.stopped = true; } };
        (function f(now) {
            if (h.stopped) return;
            var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 5);   // ease-out quint (ViewPager)
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
    // After the finger lets go the page keeps the finger's exact speed and then eases into place
    // (a critically damped spring, like iOS/Instagram). A slow release therefore glides on
    // gently instead of suddenly shooting away; a flick carries straight through.
    function spring(from, to, v, step, done, near) {
        var w = 15;                                   // stiffness (rad/s): settles in ~0.4 s
        var A = from - to, B = (v || 0) * 1000 + w * A, t0 = performance.now(), id = 0;
        var h = { x: from, stop: function () { if (id) cancelAnimationFrame(id); id = 0; h.stopped = true; } };
        if (reduce) { step(to); h.x = to; if (done) done(); return h; }
        (function f(now) {
            if (h.stopped) return;
            var t = (now - t0) / 1000, e = Math.exp(-w * t), off = (A + B * t) * e;
            var vel = (B - w * (A + B * t)) * e;          // px/s
            // never fly past the target (a hard flick near the end)
            if (A !== 0 && (off === 0 || (off < 0) !== (A < 0))) off = 0;
            h.x = to + off;
            step(h.x);
            if (Math.abs(off) < (near || 0.6) && Math.abs(vel) < (near ? 400 : 40)) { id = 0; step(to); h.x = to; if (done) done(); return; }
            id = requestAnimationFrame(f);
        })(t0);
        return h;
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

    // leave out what isn't on screen (hidden by a class on <html>, which the picture doesn't carry)
    function dropHidden(orig, copy) {
        var oc = orig.children, cc = copy.children;
        if (oc.length !== cc.length) return;
        for (var i = oc.length - 1; i >= 0; i--) {
            var t = oc[i].tagName;
            if (t === "SCRIPT" || t === "VIDEO" || t === "CANVAS" || getComputedStyle(oc[i]).display === "none" || oc[i].hidden) cc[i].remove();
            else if (oc[i].children.length) dropHidden(oc[i], cc[i]);
        }
    }

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
        // the check-in page: only its final state of the day ("you've checked in"), never the
        // camera / fingerprint screen, which is gone the moment you check in
        var isAtt = /attendance\.html$/.test(location.pathname);
        if (isAtt && !document.documentElement.classList.contains("att-co-done")) return;
        try {
            var c = document.body.cloneNode(true);
            if (isAtt) dropHidden(document.body, c);
            trim(document.body, c, window.innerHeight * 1.3);
            clean(c);
            var html = c.innerHTML;
            if (html.length > 350000) return;
            var cs = getComputedStyle(document.body);
            localStorage.setItem(SNAP + page, JSON.stringify({
                html: html, cls: document.body.className, bg: cs.backgroundColor,
                pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(" "),
                theme: document.documentElement.getAttribute("data-theme") || "light", t: Date.now(),
                v: window.attAppVer ? window.attAppVer() : "", done: isAtt || undefined
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
        // the menu can be redrawn after the page opens (js/nav.js, once the role is known):
        // read it again at every swipe instead of keeping the first one
        var info = navLinks();
        if (!document.querySelector(".bottom-nav")) return;
        function refresh() {
            info = navLinks();
            document.documentElement.classList.toggle("att-swipe-page", !!info);
            return info;
        }
        refresh();
        window.addEventListener("attendreem-profile", function () { setTimeout(function () { refresh(); ready = {}; (window.requestIdleCallback || function (f) { return setTimeout(f, 300); })(warm); }, 0); });
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
            movers.forEach(function (m) {
                m.style.transform = ""; m.style.willChange = "";
                if (m.dataset.attMinH != null) { m.style.minHeight = m.dataset.attMinH; delete m.dataset.attMinH; }
            });
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
            if (!info) return;
            [info.links[info.idx - 1], info.links[info.idx + 1]].forEach(function (a) {
                if (a) prepare(a.getAttribute("href").split(/[?#]/)[0], (a.textContent || "").trim());
            });
        }
        (window.requestIdleCallback || function (f) { return setTimeout(f, 1200); })(warm);
        // the whole screen takes the swipe, also the empty part below a short page
        // (that part is outside <body>, so listening on <body> missed it)
        gesture(document.documentElement, {
            enabled: function () { return !committing && !document.querySelector(".att-tabswipe-on") && !document.documentElement.classList.contains("tc-sheet-open") && (active || !!refresh()); },
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
                    movers.forEach(function (m) {
                        m.style.willChange = "transform";
                        // a moving block becomes the frame for "fixed" panels inside it (the check-in
                        // fingerprint panel, docked above the menu): stretch the block to the bottom of
                        // the screen for the drag so they stay where they are instead of jumping up
                        if (m.querySelector && m.querySelector(".v2-fp, .v2-fpchange")) {
                            var gap = window.innerHeight - m.getBoundingClientRect().bottom;
                            if (gap > 0) { m.dataset.attMinH = m.style.minHeight || ""; m.style.minHeight = (parseFloat(getComputedStyle(m).height) + gap) + "px"; }
                        }
                    });
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
                    anim = spring(from, -dir * W, v, apply, function () {
                        try { sessionStorage.setItem("att-swiped", "1"); sessionStorage.setItem("att-swiped-anim", "1"); } catch (e) {}
                        saveSnapshot();
                        if (window.attNavGo) window.attNavGo(href); else location.href = href;
                    }, 2);
                } else {
                    anim = spring(from, 0, from !== x ? v * 0.28 : v, apply, reset);
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
                    anim = spring(from, -dir * W, v, apply, function () {
                        if (nb) nb.setAttribute("data-swipe-was-hidden", "0");
                        reset();
                        committing = false;
                        cfg.go(k);
                    }, 2);
                } else {
                    anim = spring(from, 0, from !== x ? v * 0.28 : v, apply, reset);
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
