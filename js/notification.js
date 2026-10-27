// =====================================
// IN-APP NOTIFICATIONS (red dot + sound)
// Scope: in-app only, while the page is open.
// Listens for attendance changes for the logged-in user
// via Supabase Realtime and shows a local notification.
// =====================================

const NOTIF_STORAGE_PREFIX = "attendreem-notifications-";
const NOTIF_MAX_STORED = 20;

let notifAudioUnlocked = false;
let notifAudioCtx = null;

const notifStatusKeyMap = {
    Hadir: "status_present",
    Izin: "status_permission",
    Sakit: "status_sick",
    Alpa: "status_absent"
};

function notifStatusLabelOf(status) {
    const entry = translations[notifStatusKeyMap[status]];
    const lang = getLang();
    return (entry ? entry[lang] : "") || status || "";
}

function notifStorageKey(userId) {
    return NOTIF_STORAGE_PREFIX + userId;
}

function loadStoredNotifications(userId) {
    try {
        const raw = localStorage.getItem(notifStorageKey(userId));
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        return [];
    }
}

function saveStoredNotifications(userId, list) {
    try {
        localStorage.setItem(notifStorageKey(userId), JSON.stringify(list.slice(0, NOTIF_MAX_STORED)));
    } catch (error) {
        // ignore storage errors
    }
}

function unlockNotifAudio() {
    if (notifAudioUnlocked) return;
    try {
        notifAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        notifAudioUnlocked = true;
    } catch (error) {
        notifAudioUnlocked = false;
    }
}

function playNotifSound() {
    if (!notifAudioUnlocked || !notifAudioCtx) return;

    try {
        const ctx = notifAudioCtx;
        const now = ctx.currentTime;

        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.setValueAtTime(1180, now + 0.1);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start(now);
        oscillator.stop(now + 0.35);
    } catch (error) {
        console.error("Failed to play notification sound:", error);
    }
}

function formatNotifTime(timestamp) {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return dayMonthLabel(date) + ", " + hh + ":" + mm;
}

function deleteNotification(userId, index, event) {
    if (event) event.stopPropagation();

    const notifications = loadStoredNotifications(userId);
    notifications.splice(index, 1);
    saveStoredNotifications(userId, notifications);

    if (!hasUnreadNotifications(userId)) {
        hideNotificationDot();
    }
}

function addNotification(userId, text) {
    const notifications = loadStoredNotifications(userId);

    notifications.unshift({
        text: text,
        time: Date.now(),
        read: false
    });

    saveStoredNotifications(userId, notifications.slice(0, NOTIF_MAX_STORED));
    showNotificationDot();
    playNotifSound();
}

function showNotificationDot() {
    const dot = document.getElementById("notificationDot");
    if (dot) dot.classList.add("show");
}

function hideNotificationDot() {
    const dot = document.getElementById("notificationDot");
    if (dot) dot.classList.remove("show");
}

function markNotificationsRead(userId) {
    const notifications = loadStoredNotifications(userId);
    let changed = false;

    notifications.forEach(function (item) {
        if (!item.read) {
            item.read = true;
            changed = true;
        }
    });

    if (changed) {
        saveStoredNotifications(userId, notifications);
    }

    hideNotificationDot();
}

function unreadNotificationCount(userId) {
    return loadStoredNotifications(userId).filter(function (item) { return !item.read; }).length;
}

// inbox.html: the list grouped by day, newest first
function renderInbox(userId) {
    const box = document.getElementById("inboxList");
    if (!box) return;
    const list = loadStoredNotifications(userId);
    const lang = getLang();
    const t = function (k, en, id) { return translations[k] ? translations[k][lang] : (lang === "id" ? id : en); };
    if (!list.length) {
        box.innerHTML = '<div class="v3-empty"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg><p>' + t("no_new_notifications", "No notifications yet.", "Belum ada notifikasi.") + '</p></div>';
        return;
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const groups = [];
    list.forEach(function (item, index) {
        const d = new Date(item.time); const day = new Date(d); day.setHours(0, 0, 0, 0);
        const diff = Math.round((today - day) / 86400000);
        const label = diff <= 0 ? (lang === "id" ? "Hari ini" : "Today") : diff === 1 ? (lang === "id" ? "Kemarin" : "Yesterday") : dayMonthLabel(d);
        let g = groups[groups.length - 1];
        if (!g || g.label !== label) { g = { label: label, items: [] }; groups.push(g); }
        g.items.push({ item: item, index: index, time: String(d.getHours()).padStart(2, "0") + "." + String(d.getMinutes()).padStart(2, "0") });
    });
    const del = translations.btn_delete ? translations.btn_delete[lang] : "Delete";
    box.innerHTML = groups.map(function (g) {
        return '<h2 class="v3-sec">' + escapeHTML(g.label) + '</h2><div class="v3-list">' + g.items.map(function (x) {
            return '<div class="v3-notif' + (x.item.read ? '' : ' unread') + '"><span class="v3-notif-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg></span>' +
                '<div class="v3-notif-body"><p>' + escapeHTML(x.item.text) + '</p><small>' + x.time + '</small></div>' +
                '<button type="button" class="v3-notif-del" aria-label="' + del + '" onclick="deleteNotification(\'' + userId + '\', ' + x.index + ', event); renderInbox(\'' + userId + '\')"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
        }).join("") + '</div>';
    }).join("");
}

function hasUnreadNotifications(userId) {
    const notifications = loadStoredNotifications(userId);
    return notifications.some(function (item) { return !item.read; });
}

const BROADCAST_SEEN_PREFIX = "attendreem-broadcast-seen-";
const BROADCAST_SEEN_MAX_STORED = 50;

function loadSeenBroadcastIds(userId) {
    try {
        const raw = localStorage.getItem(BROADCAST_SEEN_PREFIX + userId);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        return [];
    }
}

function markBroadcastSeen(userId, broadcastId) {
    const seen = loadSeenBroadcastIds(userId);
    if (seen.indexOf(broadcastId) !== -1) return;
    seen.unshift(broadcastId);
    try {
        localStorage.setItem(BROADCAST_SEEN_PREFIX + userId, JSON.stringify(seen.slice(0, BROADCAST_SEEN_MAX_STORED)));
    } catch (error) {
        // ignore storage errors
    }
}

function broadcastMatchesUser(broadcast, userId, userClass) {
    if (!broadcast) return false;
    if (broadcast.target_type === "all") return true;
    if (broadcast.target_type === "class") return !!userClass && broadcast.target_value === userClass;
    if (broadcast.target_type === "student") return broadcast.target_value === userId;
    return false;
}

function broadcastNotificationText(broadcast) {
    const lang = getLang();
    const prefix = translations.notif_broadcast_prefix ? translations.notif_broadcast_prefix[lang] : "";
    return (prefix ? prefix + " " : "") + (broadcast.message || "");
}

async function fetchRecentBroadcasts(userId, userClass) {
    if (typeof supabaseClient === "undefined") return;

    const { data, error } = await supabaseClient
        .from("broadcasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

    if (error || !data) return;

    const seen = loadSeenBroadcastIds(userId);

    data
        .filter(function (b) { return seen.indexOf(b.id) === -1 && broadcastMatchesUser(b, userId, userClass); })
        .reverse()
        .forEach(function (b) {
            addNotification(userId, broadcastNotificationText(b));
            markBroadcastSeen(userId, b.id);
        });
}

async function subscribeBroadcastNotifications(userId, userClass) {
    if (typeof supabaseClient === "undefined") return;

    supabaseClient
        .channel("broadcast-notifications-" + userId)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "broadcasts"
            },
            function (payload) {
                const broadcast = payload.new;
                if (!broadcastMatchesUser(broadcast, userId, userClass)) return;

                const seen = loadSeenBroadcastIds(userId);
                if (seen.indexOf(broadcast.id) !== -1) return;

                addNotification(userId, broadcastNotificationText(broadcast));
                markBroadcastSeen(userId, broadcast.id);
            }
        )
        .subscribe();
}

async function subscribeAttendanceNotifications(userId) {
    if (typeof supabaseClient === "undefined") return;

    supabaseClient
        .channel("attendance-notifications-" + userId)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "attendance",
                filter: "user_id=eq." + userId
            },
            function (payload) {
                const status = payload.new ? payload.new.status : null;
                const statusLabel = notifStatusLabelOf(status);
                const lang = getLang();

                const key = payload.eventType === "UPDATE" ? "notif_attendance_updated" : "notif_attendance_recorded";
                const entry = translations[key];
                const prefix = entry ? entry[lang] : "";

                addNotification(userId, prefix + " " + statusLabel);
            }
        )
        .subscribe();
}

// ===== Task reminders: once per task for "due tomorrow", "due today" and "new class task" =====
const TASK_REMIND_PREFIX = "attendreem-task-remind-";
function loadTaskReminded(userId) { try { return JSON.parse(localStorage.getItem(TASK_REMIND_PREFIX + userId) || "[]"); } catch (e) { return []; } }
function saveTaskReminded(userId, list) { try { localStorage.setItem(TASK_REMIND_PREFIX + userId, JSON.stringify(list.slice(0, 200))); } catch (e) {} }

async function fetchTaskReminders(userId, userClass) {
    if (typeof supabaseClient === "undefined") return;
    try {
        const now = new Date();
        const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();
        let q = supabaseClient.from("tasks").select("id,title,subject,due_at,class,created_at").gte("due_at", now.toISOString()).lt("due_at", horizon);
        q = userClass ? q.or("user_id.eq." + userId + ",class.eq." + JSON.stringify(userClass)) : q.eq("user_id", userId);
        const { data, error } = await q.order("due_at", { ascending: true });
        if (error || !data || !data.length) return;
        const { data: done } = await supabaseClient.from("task_done").select("task_id").eq("user_id", userId).in("task_id", data.map(function (t) { return t.id; }));
        const doneIds = (done || []).map(function (d) { return d.task_id; });
        const seen = loadTaskReminded(userId), lang = getLang();
        const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        data.forEach(function (t) {
            if (doneIds.indexOf(t.id) !== -1) return;
            const due = new Date(t.due_at);
            const dd = Math.round((new Date(due.getFullYear(), due.getMonth(), due.getDate()) - today0) / 86400000);
            if (due < now || dd > 1) return;
            const stage = dd <= 0 ? "h0" : "h1";
            const key = t.id + ":" + stage;
            if (seen.indexOf(key) !== -1) return;
            const label = translations[stage === "h0" ? "notif_task_today" : "notif_task_tomorrow"][lang];
            const time = String(due.getHours()).padStart(2, "0") + "." + String(due.getMinutes()).padStart(2, "0");
            addNotification(userId, label + " " + (t.subject ? t.subject + " · " : "") + t.title + " (" + time + ")");
            seen.unshift(key);
        });
        saveTaskReminded(userId, seen);
    } catch (e) { /* tasks table may not exist yet */ }
}

// ===== Exam reminders (academic calendar, type "exam"): 3 days before, the day before, on the day =====
async function fetchExamReminders(userId) {
    if (typeof supabaseClient === "undefined") return;
    try {
        const now = new Date();
        const iso = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
        const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const from = new Date(today0); from.setDate(from.getDate() - 1);
        const to = new Date(today0); to.setDate(to.getDate() + 3);
        const { data, error } = await supabaseClient.from("holidays").select("id,date,label,type").eq("type", "exam").gte("date", iso(from)).lte("date", iso(to)).order("date");
        if (error || !data || !data.length) return;
        const dates = data.map(function (h) { return h.date + "|" + (h.label || ""); });
        const seen = loadTaskReminded(userId), lang = getLang();
        data.forEach(function (h) {
            const d = new Date(h.date + "T00:00:00");
            const dd = Math.round((d - today0) / 86400000);
            const prev = new Date(d); prev.setDate(prev.getDate() - 1);
            const firstDay = dates.indexOf(iso(prev) + "|" + (h.label || "")) === -1;   // not a continuation of yesterday's exam
            let stage = "";
            if (dd === 0) stage = "h0";
            else if (firstDay && dd === 1) stage = "h1";
            else if (firstDay && dd >= 2 && dd <= 3) stage = "h3";
            if (!stage) return;
            const key = "exam:" + h.id + ":" + stage;
            if (seen.indexOf(key) !== -1) return;
            const label = translations[stage === "h0" ? "notif_exam_today" : stage === "h1" ? "notif_exam_tomorrow" : "notif_exam_soon"][lang].replace("{n}", dd);
            addNotification(userId, "📝 " + label + " " + (h.label || ""));
            seen.unshift(key);
        });
        saveTaskReminded(userId, seen);
    } catch (e) { /* calendar not available */ }
}

function subscribeTaskNotifications(userId, userClass) {
    if (typeof supabaseClient === "undefined" || !userClass) return;
    supabaseClient
        .channel("task-notifications-" + userId)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter: "class=eq." + userClass }, function (payload) {
            const t = payload.new;
            if (!t || t.created_by === userId) return;
            const seen = loadTaskReminded(userId), key = t.id + ":new";
            if (seen.indexOf(key) !== -1) return;
            addNotification(userId, translations.notif_task_new[getLang()] + " " + (t.subject ? t.subject + " · " : "") + t.title);
            seen.unshift(key); saveTaskReminded(userId, seen);
        })
        .subscribe();
}

document.addEventListener("DOMContentLoaded", function () {

    // 2026 layout: a red dot on the menu button (any page) and the list on inbox.html
    const inboxPage = !!document.getElementById("inboxList");

    if (!document.getElementById("notificationDot") && !inboxPage) return;

    document.addEventListener(
        "click",
        unlockNotifAudio,
        { once: true }
    );
    document.addEventListener(
        "touchstart",
        unlockNotifAudio,
        { once: true }
    );

    getCurrentUser().then(async function (user) {
        if (!user) return;

        // parents: only the important alerts, kept in the database (parent_alerts.sql)
        let role = "";
        try { role = (JSON.parse(localStorage.getItem("attendreem-profile") || "{}")).role || ""; } catch (e) {}
        if (role === "orangtua" && await parentAlerts(user.id, inboxPage)) return;

        if (hasUnreadNotifications(user.id)) {
            showNotificationDot();
        }

        subscribeAttendanceNotifications(user.id);

        let userClass = null;
        if (typeof supabaseClient !== "undefined") {
            const { data: profile } = await supabaseClient
                .from("profiles")
                .select("class")
                .eq("id", user.id)
                .single();
            userClass = profile ? profile.class : null;
        }

        await fetchRecentBroadcasts(user.id, userClass);
        subscribeBroadcastNotifications(user.id, userClass);
        await fetchTaskReminders(user.id, userClass);
        await fetchExamReminders(user.id);
        subscribeTaskNotifications(user.id, userClass);

        if (hasUnreadNotifications(user.id)) {
            showNotificationDot();
        }

        if (inboxPage) { renderInbox(user.id); markNotificationsRead(user.id); }
    });

});


// ===== Parents (parent_alerts.sql): child not checked in / Alpa, SPP unpaid or proof rejected, announcements =====
const PA_IC = {
    not_in: ['warn', '<path d="M10.3 4.2 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>'],
    absent: ['warn', '<path d="M10.3 4.2 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>'],
    spp_unpaid: ['money', '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/>'],
    spp_rejected: ['warn', '<path d="M6 6l12 12M18 6 6 18"/>'],
    announce: ['', '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>']
};
async function parentAlerts(userId, inboxPage) {
    if (typeof supabaseClient === "undefined") return false;
    const { data, error } = await supabaseClient.from("parent_alerts").select("id, kind, title, body, created_at, read_at").eq("parent_id", userId).order("created_at", { ascending: false }).limit(40);
    if (error) return false;   // table not there yet: the usual in-app notifications
    const list = data || [];
    if (list.some(function (a) { return !a.read_at; })) showNotificationDot(); else hideNotificationDot();
    if (!inboxPage) return true;
    const box = document.getElementById("inboxList");
    const L = function (id, en) { return getLang() === "id" ? id : en; };
    const sub = document.getElementById("inboxSub");
    if (sub) { sub.textContent = L("Hanya yang penting tentang anak Anda", "Only what matters about your child"); sub.hidden = false; }
    const foot = '<p class="pa-foot">' + escapeHTML(L("Kabar harian (jam masuk, pulang, nilai) tetap bisa dilihat di halaman utama, tanpa notifikasi.", "Daily news (check-in, check-out, grades) stays on the home page, without notifications.")) + '</p>';
    if (!list.length) {
        box.innerHTML = '<div class="v3-empty"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><p>' + escapeHTML(L("Tidak ada yang perlu diperhatikan", "Nothing needs your attention")) + '</p></div>' + foot;
        return true;
    }
    const today = localDateStr();
    const groups = [[L("Hari ini", "Today"), []], [L("Sebelumnya", "Earlier"), []]];
    list.forEach(function (a) { groups[localDateStr(new Date(a.created_at)) === today ? 0 : 1][1].push(a); });
    box.innerHTML = groups.filter(function (g) { return g[1].length; }).map(function (g) {
        return '<h2 class="v3-sec">' + escapeHTML(g[0]) + '</h2><div class="v3-list">' + g[1].map(function (a) {
            const ic = PA_IC[a.kind] || PA_IC.announce;
            return '<div class="v3-notif pa-' + ic[0] + (a.read_at ? "" : " unread") + '"><span class="v3-notif-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ic[1] + '</svg></span>' +
                '<div class="v3-notif-body"><p>' + escapeHTML(a.title) + '</p>' + (a.body ? '<span class="pa-body">' + escapeHTML(a.body) + '</span>' : '') + '<small>' + escapeHTML(formatNotifTime(a.created_at)) + '</small></div>' +
                (a.read_at ? '' : '<i class="pa-dot" aria-hidden="true"></i>') + '</div>';
        }).join("") + '</div>';
    }).join("") + foot;
    const unread = list.filter(function (a) { return !a.read_at; }).map(function (a) { return a.id; });
    if (unread.length) supabaseClient.from("parent_alerts").update({ read_at: new Date().toISOString() }).in("id", unread).then(function () { hideNotificationDot(); });
    return true;
}
