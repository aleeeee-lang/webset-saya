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

function renderNotificationList(userId) {
    const listEl = document.getElementById("notificationList");
    if (!listEl) return;

    const notifications = loadStoredNotifications(userId);
    const lang = getLang();

    if (!notifications.length) {
        listEl.innerHTML =
            '<p class="notification-empty" id="notificationEmpty" data-i18n="no_new_notifications">' +
            (translations.no_new_notifications ? translations.no_new_notifications[lang] : "No new notifications.") +
            "</p>";
        return;
    }

    const deleteLabel = translations.btn_delete ? translations.btn_delete[lang] : "Delete";

    listEl.innerHTML = notifications
        .map(function (item, index) {
            const unreadClass = item.read ? "" : " unread";
            const dot = item.read ? "" : '<span class="notification-item-dot"></span>';
            return (
                '<div class="notification-item' + unreadClass + '">' +
                dot +
                '<div class="notification-item-body">' +
                '<p class="notification-item-text">' + item.text + "</p>" +
                '<p class="notification-item-time">' + formatNotifTime(item.time) + "</p>" +
                "</div>" +
                '<button type="button" class="notification-item-delete" aria-label="' + deleteLabel + '" onclick="deleteNotification(\'' + userId + '\', ' + index + ', event)">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 7H19M9 7V5C9 4.4 9.4 4 10 4H14C14.6 4 15 4.4 15 5V7M17 7V18C17 19.1 16.1 20 15 20H9C7.9 20 7 19.1 7 18V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                "</button>" +
                "</div>"
            );
        })
        .join("");
}

function deleteNotification(userId, index, event) {
    if (event) event.stopPropagation();

    const notifications = loadStoredNotifications(userId);
    notifications.splice(index, 1);
    saveStoredNotifications(userId, notifications);
    renderNotificationList(userId);

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
    renderNotificationList(userId);
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
        renderNotificationList(userId);
    }

    hideNotificationDot();
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

    const notificationButton = document.getElementById("notificationButton");
    const notificationPanel = document.getElementById("notificationPanel");

    if (!notificationButton || !notificationPanel) return;

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

        renderNotificationList(user.id);

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
        subscribeTaskNotifications(user.id, userClass);

        if (hasUnreadNotifications(user.id)) {
            showNotificationDot();
        }

        notificationButton.addEventListener("click", function () {
            notificationPanel.classList.toggle("active");

            if (notificationPanel.classList.contains("active")) {
                markNotificationsRead(user.id);
            }
        });
    });

});
