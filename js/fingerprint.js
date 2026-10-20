// Fingerprint check-in (WebAuthn): the phone's own fingerprint / screen lock.
// The finger never leaves the phone. The "webauthn" Edge Function checks the
// phone's signed answer and returns a one-time ticket that the attendance
// check on the server accepts once (attendance_security.sql).
(function () {
    var b64u = {
        toBuf: function (s) {
            s = String(s).replace(/-/g, "+").replace(/_/g, "/");
            while (s.length % 4) s += "=";
            var bin = atob(s), u = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
            return u.buffer;
        },
        fromBuf: function (buf) {
            var u = new Uint8Array(buf), s = "";
            for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
            return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        }
    };

    async function call(action, extra) {
        var body = Object.assign({ action: action }, extra || {});
        var r = await supabaseClient.functions.invoke("webauthn", { body: body });
        if (!r.error) return r.data || {};
        var msg = r.error.message || "error";
        try { var j = await r.error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
        var err = new Error(msg); err.code = msg; throw err;
    }

    function regCredJSON(c) {
        var res = c.response;
        return {
            id: c.id, rawId: b64u.fromBuf(c.rawId), type: c.type,
            authenticatorAttachment: c.authenticatorAttachment || undefined,
            clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {},
            response: {
                clientDataJSON: b64u.fromBuf(res.clientDataJSON),
                attestationObject: b64u.fromBuf(res.attestationObject),
                transports: res.getTransports ? res.getTransports() : undefined
            }
        };
    }
    function authCredJSON(c) {
        var res = c.response;
        return {
            id: c.id, rawId: b64u.fromBuf(c.rawId), type: c.type,
            authenticatorAttachment: c.authenticatorAttachment || undefined,
            clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {},
            response: {
                clientDataJSON: b64u.fromBuf(res.clientDataJSON),
                authenticatorData: b64u.fromBuf(res.authenticatorData),
                signature: b64u.fromBuf(res.signature),
                userHandle: res.userHandle ? b64u.fromBuf(res.userHandle) : undefined
            }
        };
    }

    window.AttFP = {
        // true when this phone has a fingerprint / face / PIN lock the browser can use
        supported: async function () {
            try {
                return !!(window.PublicKeyCredential && navigator.credentials &&
                    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
            } catch (e) { return false; }
        },
        status: function () { return call("status"); },
        register: async function () {
            var o = await call("register-options");
            o.challenge = b64u.toBuf(o.challenge);
            o.user = Object.assign({}, o.user, { id: b64u.toBuf(o.user.id) });
            o.excludeCredentials = (o.excludeCredentials || []).map(function (c) { return Object.assign({}, c, { id: b64u.toBuf(c.id) }); });
            var cred = await navigator.credentials.create({ publicKey: o });
            if (!cred) throw new Error("CANCELLED");
            return call("register-verify", { response: regCredJSON(cred), device: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "" });
        },
        // returns a one-time ticket for the attendance insert
        verify: async function () {
            var o = await call("auth-options");
            o.challenge = b64u.toBuf(o.challenge);
            o.allowCredentials = (o.allowCredentials || []).map(function (c) { return Object.assign({}, c, { id: b64u.toBuf(c.id) }); });
            var cred = await navigator.credentials.get({ publicKey: o });
            if (!cred) throw new Error("CANCELLED");
            var r = await call("auth-verify", { response: authCredJSON(cred) });
            return r.ticket;
        }
    };
})();
