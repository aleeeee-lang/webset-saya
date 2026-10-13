// Attendreem service worker: shows push notifications and opens the right page when tapped.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (event) {
    var data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
    var title = data.title || "Attendreem";
    event.waitUntil(self.registration.showNotification(title, {
        body: data.body || "",
        icon: "icon-512.png",
        badge: "badge-96.png",
        tag: data.tag || undefined,
        renotify: !!data.tag,
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
