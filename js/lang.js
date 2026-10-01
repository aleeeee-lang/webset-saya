const translations = {
    welcome_back: { en: "Welcome back", id: "Selamat datang kembali" },
    main_menu: { en: "Main Menu", id: "Menu Utama" },
    menu_attendance: { en: "Attendance", id: "Absensi" },
    check_in: { en: "Check in", id: "Absen sekarang" },
    menu_dashboard: { en: "Dashboard", id: "Dasbor" },
    statistics: { en: "Statistics", id: "Statistik" },
    menu_history: { en: "History", id: "Riwayat" },
    attendance_records: { en: "Attendance records", id: "Catatan absensi" },
    menu_my_attendance: { en: "My Attendance", id: "Absensi Saya" },
    my_personal_record: { en: "My personal record", id: "Catatan pribadi saya" },
    menu_information: { en: "Information", id: "Informasi" },
    information_links: { en: "Information & links", id: "Informasi & tautan" },
    banner_title: { en: "Keep your attendance organized.", id: "Jaga absensimu tetap rapi." },
    banner_text: { en: "Check your records and stay up to date with Attendly.", id: "Pantau catatanmu dan tetap up to date dengan Attendly." },
    nav_home: { en: "Home", id: "Beranda" },
    nav_attendance: { en: "Attendance", id: "Absensi" },
    nav_dashboard: { en: "Dashboard", id: "Dasbor" },
    nav_history: { en: "History", id: "Riwayat" },
    nav_my: { en: "My", id: "Saya" }
};

function getLang() {
    return localStorage.getItem("attendly-lang") || "en";
}

function setLang(lang) {
    localStorage.setItem("attendly-lang", lang);
    applyLang();
}

function applyLang() {
    const lang = getLang();
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
        const entry = translations[el.getAttribute("data-i18n")];
        if (entry && entry[lang]) {
            el.textContent = entry[lang];
        }
    });
}

document.addEventListener("DOMContentLoaded", applyLang);
