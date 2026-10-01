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
    btn_submit_attendance: { en: "Submit Attendance", id: "Kirim Absensi" },

    page_dashboard: { en: "Dashboard", id: "Dasbor" },
    overview_label: { en: "Attendance Overview", id: "Ringkasan Absensi" },
    overview_title: { en: "Your attendance summary", id: "Ringkasan absensimu" },
    overview_text: { en: "Keep your attendance consistent and stay on track.", id: "Jaga konsistensi absensimu dan tetap pada jalurnya." },
    total_attendance: { en: "Total Attendance", id: "Total Absensi" },
    status_hadir_label: { en: "Hadir", id: "Hadir" },
    status_izin_label: { en: "Izin", id: "Izin" },
    status_sakit_label: { en: "Sakit", id: "Sakit" },
    status_alpa_label: { en: "Alpa", id: "Alpa" },
    attendance_label: { en: "ATTENDANCE", id: "ABSENSI" },
    attendance_calendar: { en: "Attendance Calendar", id: "Kalender Absensi" },
    activity_label: { en: "ACTIVITY", id: "AKTIVITAS" },
    recent_attendance: { en: "Recent Attendance", id: "Absensi Terbaru" },
    view_all: { en: "View All", id: "Lihat Semua" },
    show_less: { en: "Show Less", id: "Tampilkan Lebih Sedikit" },
    no_attendance_yet: { en: "No attendance data yet.", id: "Belum ada data absensi." },
    statistics_label: { en: "STATISTICS", id: "STATISTIK" },
    attendance_statistics: { en: "Attendance Statistics", id: "Statistik Absensi" },
    attendance_rate: { en: "Attendance Rate", id: "Tingkat Kehadiran" },
    stat_total: { en: "Total", id: "Total" },
    stat_present: { en: "Present", id: "Hadir" },
    stat_absent: { en: "Absent", id: "Tidak Hadir" },
    insight_label: { en: "ATTENDANCE INSIGHT", id: "WAWASAN ABSENSI" },
    ready_label: { en: "READY?", id: "SIAP?" },
    quick_action_title: { en: "Take your attendance today", id: "Catat absensimu hari ini" },
    quick_action_text: { en: "Don't forget to record your attendance.", id: "Jangan lupa catat absensimu." },
    quick_action_btn: { en: "Attendance →", id: "Absensi →" }
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
