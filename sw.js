// Attendreem service worker: makes the app open fast (keeps the app's own files on the phone),
// shows push notifications and opens the right page when one is tapped.
var CACHE = "attendreem-files-v1";

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) {
    event.waitUntil((async function () {
        var names = await caches.keys();
        await Promise.all(names.filter(function (n) { return n.indexOf("attendreem-files-") === 0 && n !== CACHE; }).map(function (n) { return caches.delete(n); }));
        if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (e) {} }
        await self.clients.claim();
    })());
});

// What gets kept: the app's pages, styles, scripts, icons and fonts, plus the Supabase library.
// Never kept: anything from Supabase itself (data, login, photos) - that always comes live.
function keepable(url) {
    if (/\.supabase\.co$/.test(url.hostname)) return false;
    if (url.origin === self.location.origin) return true;
    return url.hostname === "cdn.jsdelivr.net" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}
async function put(req, res) {
    if (!res || !(res.ok || res.type === "opaque")) return;
    try {
        var cache = await caches.open(CACHE);
        await cache.put(req, res);
        // a new ?v= of a file replaces the older copies of the same file
        var u = new URL(req.url);
        if (u.search) {
            var keys = await cache.keys();
            keys.forEach(function (k) {
                var ku = new URL(k.url);
                if (ku.origin === u.origin && ku.pathname === u.pathname && ku.search !== u.search) cache.delete(k);
            });
        }
    } catch (e) {}
}
// pages: fresh from the internet when it answers quickly, otherwise the copy on the phone
async function page(event) {
    var req = event.request;
    var cached = caches.match(req, { ignoreSearch: false });
    var net = (async function () {
        var res = (event.preloadResponse && await event.preloadResponse) || await fetch(req);
        put(req, res.clone());
        return res;
    })();
    event.waitUntil(net.then(function () {}, function () {}));
    var timeout = new Promise(function (r) { setTimeout(function () { r(null); }, 900); });
    var first = await Promise.race([net.catch(function () { return null; }), timeout]);
    if (first) return first;
    var c = await cached;
    if (c) return c;
    return net;
}
// styles, scripts, icons: straight from the phone, refreshed quietly in the background
async function file(event) {
    var req = event.request;
    var c = await caches.match(req);
    var net = fetch(req).then(function (res) { put(req, res.clone()); return res; });
    event.waitUntil(net.then(function () {}, function () {}));
    return c || net;
}
// Photos shared to the app from another app (Android share menu, see share_target in
// manifest.webmanifest): keep them on the phone for a moment, then open share.html to pick
// what they're for (transfer proof for class cash, or photos of a task).
var SHARE_CACHE = "attendreem-share";
async function receiveShare(event) {
    var scope = self.registration.scope;
    try {
        var form = await event.request.formData();
        var files = form.getAll("photos").filter(function (f) { return f && f.size && /^image\//.test(f.type || "image/"); }).slice(0, 10);
        await caches.delete(SHARE_CACHE);
        var cache = await caches.open(SHARE_CACHE);
        for (var i = 0; i < files.length; i++) {
            await cache.put(new Request(scope + "__share/" + i), new Response(files[i], { headers: { "content-type": files[i].type || "image/jpeg", "x-name": encodeURIComponent(files[i].name || "") } }));
        }
    } catch (e) {}
    return Response.redirect(scope + "share.html", 303);
}

self.addEventListener("fetch", function (event) {
    var req = event.request;
    if (req.method === "POST" && /\/share-target\/?$/.test(new URL(req.url).pathname)) { event.respondWith(receiveShare(event)); return; }
    if (req.method !== "GET") return;
    var url = new URL(req.url);
    if (!keepable(url)) return;
    if (req.cache === "no-store") return;          // the page asking "is there a newer version?" (js/theme.js)
    if (req.mode === "navigate") { event.respondWith(page(event)); return; }
    event.respondWith(file(event));
});

self.addEventListener("push", function (event) {
    var data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
    var title = data.title || "Attendreem";
    event.waitUntil(self.registration.showNotification(title, {
        body: data.body || "",
        badge: "badge-96.png",
        tag: data.tag || undefined,
        renotify: !!data.tag,
        // "Absen sudah dibuka" stays on screen until the student taps or swipes it (not on iPhone)
        requireInteraction: String(data.tag || "").indexOf("attopen-") === 0,
        data: { url: data.url || "index.html" }
    }));
});

self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    var url = new URL((event.notification.data && event.notification.data.url) || "index.html", self.registration.scope).href;
    event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].url.indexOf(self.registration.scope) === 0 && "focus" in list[i]) { list[i].navigate(url); return list[i].focus(); }
        }
        return self.clients.openWindow(url);
    }));
});
