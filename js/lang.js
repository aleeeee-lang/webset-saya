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
    nav_my: { en: "My", id: "Saya" },

    page_attendance: { en: "Attendance", id: "Absensi" },
    label_date: { en: "Date", id: "Tanggal" },
    label_time: { en: "Time", id: "Waktu" },
    label_status: { en: "Status", id: "Status" },
    status_not_selected: { en: "Not selected", id: "Belum dipilih" },
    status_present: { en: "Present", id: "Hadir" },
    status_permission: { en: "Permission", id: "Izin" },
    status_sick: { en: "Sick", id: "Sakit" },
    status_absent: { en: "Absent", id: "Alpa" },
    label_reason: { en: "Reason", id: "Alasan" },
    reason_placeholder: { en: "Why are you absent?", id: "Kenapa kamu tidak hadir?" },
    label_verification: { en: "VERIFICATION", id: "VERIFIKASI" },
    btn_open_camera: { en: "Open Camera", id: "Buka Kamera" },
    btn_take_photo: { en: "Take Photo", id: "Ambil Foto" },
    btn_submit_attendance: { en: "Submit Attendance", id: "Kirim Absensi" }
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

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
        const entry = translations[el.getAttribute("data-i18n-placeholder")];
        if (entry && entry[lang]) {
            el.placeholder = entry[lang];
        }
    });
}

document.addEventListener("DOMContentLoaded", applyLang);
