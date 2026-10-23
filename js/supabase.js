const supabaseUrl =
    "https://vqpxumrodadqqaxuyehy.supabase.co";

const supabaseKey =
    "sb_publishable_O9MWlDg0y7UwaAOt89j1MQ_QcKGVkII";


const supabaseClient =
    window.supabase.createClient(
        supabaseUrl,
        supabaseKey
    );

// Double-save guard: the same new row sent to the same table twice within 30 seconds
// (a double tap, or pressing "Simpan" again and again) is not added a second time.
// Rows that are different, or sent later, go through as usual.
(function () {
    var WINDOW = 30000;
    var SKIP = { attendance: 1, task_done: 1, personal_notes: 1, push_subscriptions: 1, notif_prefs: 1 };
    var VOLATILE = { created_at: 1, updated_at: 1, submitted_at: 1, sent_at: 1 };
    var recent = {};
    function norm(v) {
        if (Array.isArray(v)) return v.map(norm);
        if (v && typeof v === "object") {
            var o = {};
            Object.keys(v).sort().forEach(function (k) { if (!VOLATILE[k]) o[k] = norm(v[k]); });
            return o;
        }
        return v;
    }
    var from = supabaseClient.from.bind(supabaseClient);
    supabaseClient.from = function (table) {
        var q = from(table);
        if (SKIP[table] || !q || typeof q.insert !== "function") return q;
        var insert = q.insert.bind(q);
        q.insert = function (values, opts) {
            var key = table + "|" + JSON.stringify(norm(values));
            var now = Date.now();
            Object.keys(recent).forEach(function (k) { if (now - recent[k] > WINDOW) delete recent[k]; });
            if (recent[key]) {
                var id = typeof getLang !== "function" || getLang() === "id";
                var res = { data: null, error: { code: "DUPLICATE_RECENT", message: id ? "Data yang sama baru saja disimpan." : "The same entry was just saved." }, status: 409 };
                var fake = {
                    select: function () { return fake; }, single: function () { return fake; }, maybeSingle: function () { return fake; },
                    then: function (ok, bad) { return Promise.resolve(res).then(ok, bad); },
                    catch: function (bad) { return Promise.resolve(res).catch(bad); }
                };
                return fake;
            }
            recent[key] = now;
            var b = insert(values, opts);
            var then = b.then.bind(b);
            // a save that failed may be tried again right away
            b.then = function (ok, bad) {
                return then(function (r) { if (r && r.error) delete recent[key]; return ok ? ok(r) : r; }, function (e) { delete recent[key]; if (bad) return bad(e); throw e; });
            };
            return b;
        };
        return q;
    };
})();
