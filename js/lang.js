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
    banner_text: { en: "Check your records and stay up to date with Attendreem.", id: "Pantau catatanmu dan tetap up to date dengan Attendreem." },
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
    face_loading: { en: "Loading face detector...", id: "Memuat pendeteksi wajah..." },
    face_detected: { en: "Face detected. You can take the photo.", id: "Wajah terdeteksi. Kamu bisa ambil foto." },
    face_not_detected: { en: "Align your face in the frame.", id: "Posisikan wajahmu di dalam bingkai." },
    face_unavailable: { en: "Face detection unavailable, you can still take a photo.", id: "Pendeteksi wajah tidak tersedia, kamu tetap bisa ambil foto." },
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
    quick_action_btn: { en: "Attendance →", id: "Absensi →" },

    page_history: { en: "History", id: "Riwayat" },
    label_month: { en: "MONTH", id: "BULAN" },
    label_status_filter: { en: "STATUS", id: "STATUS" },
    all_months: { en: "All Months", id: "Semua Bulan" },
    all_status: { en: "All Status", id: "Semua Status" },
    no_history_title: { en: "No attendance history", id: "Belum ada riwayat absensi" },
    no_history_text: { en: "Your attendance records will appear here.", id: "Catatan absensimu akan muncul di sini." },
    checkin_at: { en: "Check-in at", id: "Absen masuk pukul" },

    page_my_attendance: { en: "My Attendance", id: "Absensi Saya" },
    score_label: { en: "ATTENDANCE SCORE", id: "SKOR ABSENSI" },
    score_no_data: { en: "No data yet", id: "Belum ada data" },
    score_excellent: { en: "Excellent consistency", id: "Konsistensi sangat baik" },
    score_good: { en: "Good consistency", id: "Konsistensi baik" },
    score_needs_improvement: { en: "Needs improvement", id: "Perlu ditingkatkan" },
    current_streak: { en: "Current Streak", id: "Rentetan Saat Ini" },
    active_days: { en: "Active Days", id: "Hari Aktif" },
    unit_days: { en: "Days", id: "Hari" },
    attendance_activity_label: { en: "ATTENDANCE ACTIVITY", id: "AKTIVITAS ABSENSI" },
    recent_activity: { en: "Recent Activity", id: "Aktivitas Terbaru" },
    no_activity_yet: { en: "No activity yet.", id: "Belum ada aktivitas." },
    monthly_overview_label: { en: "MONTHLY OVERVIEW", id: "RINGKASAN BULANAN" },
    label_today: { en: "TODAY", id: "HARI INI" },
    label_yesterday: { en: "YESTERDAY", id: "KEMARIN" },
    no_attendance_insight_title: { en: "No attendance yet", id: "Belum ada absensi" },
    no_attendance_insight_text: { en: "Start recording your attendance to see insights.", id: "Mulai catat absensimu untuk melihat wawasan." },
    great_insight_title: { en: "You're doing great!", id: "Kerja bagus!" },
    great_insight_text: { en: "Your attendance has been consistent.", id: "Absensimu sudah konsisten." },
    good_insight_title: { en: "Good attendance", id: "Absensi baik" },
    good_insight_text: { en: "Keep it up, you're doing well.", id: "Pertahankan, kamu sudah baik." },
    improve_insight_title: { en: "Keep improving", id: "Terus tingkatkan" },
    improve_insight_text: { en: "Try to attend more consistently.", id: "Coba hadir lebih konsisten." },

    day_sun: { en: "Sunday", id: "Minggu" },
    day_mon: { en: "Monday", id: "Senin" },
    day_tue: { en: "Tuesday", id: "Selasa" },
    day_wed: { en: "Wednesday", id: "Rabu" },
    day_thu: { en: "Thursday", id: "Kamis" },
    day_fri: { en: "Friday", id: "Jumat" },
    day_sat: { en: "Saturday", id: "Sabtu" },

    month_jan: { en: "January", id: "Januari" },
    month_feb: { en: "February", id: "Februari" },
    month_mar: { en: "March", id: "Maret" },
    month_apr: { en: "April", id: "April" },
    month_may: { en: "May", id: "Mei" },
    month_jun: { en: "June", id: "Juni" },
    month_jul: { en: "July", id: "Juli" },
    month_aug: { en: "August", id: "Agustus" },
    month_sep: { en: "September", id: "September" },
    month_oct: { en: "October", id: "Oktober" },
    month_nov: { en: "November", id: "November" },
    month_dec: { en: "December", id: "Desember" },

    page_settings: { en: "Settings", id: "Pengaturan" },
    label_account_info: { en: "Account Info", id: "Info Akun" },
    menu_change_password: { en: "Change Password", id: "Ubah Kata Sandi" },
    label_dark_mode: { en: "Dark Mode", id: "Mode Gelap" },
    label_language: { en: "Language", id: "Bahasa" },
    menu_about: { en: "About Attendreem", id: "Tentang Attendreem" },
    menu_manage_students: { en: "Manage Students", id: "Kelola Siswa" },
    menu_manage_attendance: { en: "Manage Attendance", id: "Kelola Absensi" },
    btn_logout: { en: "Logout", id: "Keluar" },
    label_admin: { en: "Admin", id: "Admin" },

    notifications_title: { en: "Notifications", id: "Notifikasi" },
    no_new_notifications: { en: "No new notifications.", id: "Belum ada notifikasi." },
    notif_attendance_recorded: { en: "Your attendance was recorded as", id: "Absensimu tercatat sebagai" },
    notif_attendance_updated: { en: "Your attendance was updated to", id: "Absensimu diperbarui menjadi" }
};

const dayKeys = ["day_sun", "day_mon", "day_tue", "day_wed", "day_thu", "day_fri", "day_sat"];
const monthKeys = ["month_jan", "month_feb", "month_mar", "month_apr", "month_may", "month_jun", "month_jul", "month_aug", "month_sep", "month_oct", "month_nov", "month_dec"];

function dayNameOf(dateStr) {
    if (!dateStr) return "";
    const parts = String(dateStr).split("-");
    if (parts.length < 3) return "";
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return "";
    const entry = translations[dayKeys[d.getDay()]];
    return entry ? entry[getLang()] : "";
}

function monthNameOf(monthIndex) {
    const entry = translations[monthKeys[monthIndex]];
    return entry ? entry[getLang()] : "";
}

function dayMonthLabel(date) {
    return date.getDate() + " " + monthNameOf(date.getMonth());
}

function dayMonthYearLabel(date) {
    return String(date.getDate()).padStart(2, "0") + " " + monthNameOf(date.getMonth()) + " " + date.getFullYear();
}

function monthYearLabel(date) {
    return monthNameOf(date.getMonth()) + " " + date.getFullYear();
}

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
