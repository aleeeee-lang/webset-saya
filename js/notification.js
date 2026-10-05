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

    listEl.innerHTML = notifications
        .map(function (item) {
            const unreadClass = item.read ? "" : " unread";
            const dot = item.read ? "" : '<span class="notification-item-dot"></span>';
            return (
                '<div class="notification-item' + unreadClass + '">' +
                dot +
                '<div class="notification-item-body">' +
                '<p class="notification-item-text">' + item.text + "</p>" +
                '<p class="notification-item-time">' + formatNotifTime(item.time) + "</p>" +
                "</div>" +
                "</div>"
            );
        })
        .join("");
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

    getCurrentUser().then(function (user) {
        if (!user) return;

        renderNotificationList(user.id);

        if (hasUnreadNotifications(user.id)) {
            showNotificationDot();
        }

        subscribeAttendanceNotifications(user.id);

        notificationButton.addEventListener("click", function () {
            notificationPanel.classList.toggle("active");

            if (notificationPanel.classList.contains("active")) {
                markNotificationsRead(user.id);
            }
        });
    });

});
