// Install-as-app + push notifications (Web Push).
// Loaded on every page by theme.js. Exposes window.AttPush.
(function () {
    if (window.AttPush) return;
    var VAPID_PUBLIC = "BPvOBF5liSGgghJ5kXIImvbw7TUsuuamfI0O_VQoi6ZSvsYzkg1-ktc1npT899M0_gaAQ69LGElry7HvcZjHqRg";
    var hasSW = "serviceWorker" in navigator && location.protocol !== "file:";
    var deferredPrompt = null;

    function b64ToBytes(b64) {
        var pad = "=".repeat((4 - b64.length % 4) % 4);
        var raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
        var out = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    }
    function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
    function isStandalone() { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }
    function pushSupported() { return hasSW && "PushManager" in window && "Notification" in window; }

    var regPromise = hasSW ? navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function (e) { console.warn("sw", e); return null; }) : Promise.resolve(null);

    window.addEventListener("beforeinstallprompt", function (e) {
        e.preventDefault();
        deferredPrompt = e;
        window.dispatchEvent(new Event("attendreem-install"));
    });
    window.addEventListener("appinstalled", function () { deferredPrompt = null; window.dispatchEvent(new Event("attendreem-install")); });

    async function currentSub() {
        if (!pushSupported()) return null;
        var reg = await regPromise;
        if (!reg) return null;
        try { return await reg.pushManager.getSubscription(); } catch (e) { return null; }
    }

    async function save(sub) {
        if (typeof supabaseClient === "undefined") return { ok: false, reason: "no-client" };
        var s = await supabaseClient.auth.getSession();
        var user = s && s.data && s.data.session ? s.data.session.user : null;
        if (!user) return { ok: false, reason: "no-user" };
        var j = sub.toJSON();
        var res = await supabaseClient.rpc("save_push_subscription", {
            p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent.slice(0, 200)
        });
        return res.error ? { ok: false, reason: "save", error: res.error } : { ok: true };
    }

    window.AttPush = {
        supported: pushSupported,
        isIOS: isIOS,
        isStandalone: isStandalone,
        // iPhone only allows web push once the app is on the home screen
        needsInstallFirst: function () { return isIOS() && !isStandalone(); },
        canInstall: function () { return !!deferredPrompt; },
        install: async function () {
            if (!deferredPrompt) return false;
            deferredPrompt.prompt();
            var r = await deferredPrompt.userChoice;
            deferredPrompt = null;
            window.dispatchEvent(new Event("attendreem-install"));
            return r && r.outcome === "accepted";
        },
        permission: function () { return "Notification" in window ? Notification.permission : "unsupported"; },
        isEnabled: async function () { return !!(await currentSub()) && Notification.permission === "granted"; },
        enable: async function () {
            if (!pushSupported()) return { ok: false, reason: "unsupported" };
            if (isIOS() && !isStandalone()) return { ok: false, reason: "ios-install" };
            var perm = await Notification.requestPermission();
            if (perm !== "granted") return { ok: false, reason: "denied" };
            var reg = await regPromise;
            if (!reg) return { ok: false, reason: "no-sw" };
            await navigator.serviceWorker.ready;
            var sub = await reg.pushManager.getSubscription();
            if (!sub) {
                try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) }); }
                catch (e) { return { ok: false, reason: "subscribe", error: e }; }
            }
            return save(sub);
        },
        disable: async function () {
            var sub = await currentSub();
            if (!sub) return { ok: true };
            var endpoint = sub.endpoint;
            try { await sub.unsubscribe(); } catch (e) {}
            if (typeof supabaseClient !== "undefined") await supabaseClient.from("push_subscriptions").delete().eq("endpoint", endpoint);
            return { ok: true };
        },
        // keep the stored subscription fresh (and tied to whoever is signed in now)
        refresh: async function () { var sub = await currentSub(); if (sub && Notification.permission === "granted") return save(sub); }
    };

    window.addEventListener("attendreem-profile", function () { if (window.AttPush) window.AttPush.refresh(); });
})();
