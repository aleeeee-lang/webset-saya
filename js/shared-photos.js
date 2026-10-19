// Photos another app shared into Attendreem (Android share menu). sw.js keeps them in the
// "attendreem-share" cache; pages read them here and clear them once they've been used.
(function () {
    var NAME = "attendreem-share";
    function scopeUrl() { return new URL("./", location.href).href; }
    window.attShared = {
        list: async function () {
            if (!("caches" in window)) return [];
            try {
                var cache = await caches.open(NAME);
                var keys = await cache.keys();
                var prefix = scopeUrl() + "__share/";
                keys = keys.filter(function (k) { return k.url.indexOf(prefix) === 0; })
                    .sort(function (a, b) { return Number(a.url.slice(prefix.length)) - Number(b.url.slice(prefix.length)); });
                var out = [];
                for (var i = 0; i < keys.length; i++) {
                    var res = await cache.match(keys[i]);
                    if (res) out.push(await res.blob());
                }
                return out;
            } catch (e) { return []; }
        },
        clear: async function () { try { await caches.delete(NAME); } catch (e) {} },
        // ?shared=1 on the page that should use them
        wanted: function () { return new URLSearchParams(location.search).get("shared") === "1"; },
        forget: function () {
            try { var u = new URL(location.href); u.searchParams.delete("shared"); history.replaceState(history.state, "", u.pathname.split("/").pop() + u.search + u.hash); } catch (e) {}
        }
    };
})();
