// ============================================
// FIREBASE YAPILANDIRMASI
// Bu dosyadaki değerleri kendi Firebase projenizin
// bilgileriyle değiştirin.
// ============================================

const firebaseConfig = {
    apiKey: "BGxhHPBDPWK5Jt1NA7gt6mxbFFmSY5JGxevFPmdz_KRxMsI27QSWfGJdIIqEiTcoz2waxuta61ovLV0MnehwAgI",
    authDomain: "AyinSinifi.firebaseapp.com",
    projectId: "ayinsinifi",
    storageBucket: "proje-adiniz.appspot.com",
    messagingSenderId: "164906254595",
    appId: "1:123456789:web:abcdef123456"
};

// Firebase başlat
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================
// UYGULAMA SABİTLERİ
// ============================================

const APP_CONFIG = {
    // Okul bilgileri (kiosk ve başlıklarda kullanılır)
    schoolName: "Mesleki ve Teknik Anadolu Lisesi",
    appTitle: "Ayın Sınıfı",

    // Sınıf listesi - Okulunuzdaki sınıfları buraya ekleyin
    classes: [
        "9-A", "9-B", "9-C", "9-D",
        "10-A", "10-B", "10-C", "10-D",
        "11-A", "11-B", "11-C", "11-D",
        "12-A", "12-B", "12-C", "12-D"
    ],

    // Değerlendirme Kriterleri
    criteria: [
        {
            id: "temizlik",
            title: "Fiziksel Düzen ve Temizlik",
            description: "Sıraların hizası, yerlerin temizliği, tahtanın ve öğretmen masasının derse hazır/temiz bırakılması.",
            goal: "Çevreye saygı ve sorumluluk",
            icon: "🧹"
        },
        {
            id: "hazirlik",
            title: "Derse Hazır Bulunuşluk",
            description: "Öğretmen sınıfa girdiğinde öğrencilerin ayakta dolaşmaması, ders materyallerinin (kitap, defter, atölye malzemesi) sıraların üzerinde hazır olması.",
            goal: "Zaman yönetimi ve derse odaklanma",
            icon: "📚"
        },
        {
            id: "iletisim",
            title: "Sınıf İçi İletişim ve Nezaket",
            description: "Öğrencilerin birbirlerine ve öğretmene karşı üslubu, kaba sözden kaçınılması, söz hakkı alarak konuşma.",
            goal: "Sağlıklı sosyal beceriler ve saygı",
            icon: "🤝"
        },
        {
            id: "katilim",
            title: "Derse Katılım ve Motivasyon",
            description: "Sınıfın genel olarak dersi dinleme isteği, verilen görevi/etkinliği yapmaya gönüllü olması.",
            goal: "Akademik farkındalık",
            icon: "🎯"
        },
        {
            id: "kurallar",
            title: "Kurallara ve Kılık Kıyafete Uyum",
            description: "Okul kıyafet kurallarına uyum, telefon/teknoloji kullanımı kurallarına riayet.",
            goal: "Toplumsal kurallara uyum",
            icon: "📋"
        }
    ],

    // Yıldız etiketleri (1-5 arası)
    starLabels: [
        "",           // 0 - seçilmedi
        "Çok Kötü",   // 1 yıldız
        "Kötü",       // 2 yıldız
        "Orta",       // 3 yıldız
        "İyi",        // 4 yıldız
        "Mükemmel"    // 5 yıldız
    ],

    // Admin paneli şifresi
    adminPassword: "admin2024",

    // Büyük ödül için gereken şampiyonluk sayısı
    grandPrizeThreshold: 5,

    // Ay isimleri (Türkçe)
    monthNames: [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ]
};

// ============================================
// YARDIMCI FONKSİYONLAR
// ============================================

/**
 * Şu anki ay ve yılı "YYYY-MM" formatında döndürür
 */
function getCurrentMonthKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Şu anki tarihi "YYYY-MM-DD" formatında döndürür
 */
function getTodayKey() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

/**
 * Ay anahtarını okunabilir Türkçe formata çevirir
 * Örn: "2024-10" -> "Ekim 2024"
 */
function formatMonthKey(monthKey) {
    const [year, month] = monthKey.split('-');
    const monthIndex = parseInt(month) - 1;
    return `${APP_CONFIG.monthNames[monthIndex]} ${year}`;
}

/**
 * Toast (bildirim) mesajı gösterir
 * @param {string} message - Gösterilecek mesaj
 * @param {string} type - Bildirim tipi: success, error, warning, info
 * @param {number} duration - Gösterim süresi (ms)
 */
function showToast(message, type = 'info', duration = 3000) {
    // Varsa eski toast'ı kaldır
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animasyon için küçük gecikme
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Yükleniyor ekranını gösterir/gizler
 * @param {boolean} show - true: göster, false: gizle
 * @param {string} message - Gösterilecek mesaj
 */
function showLoading(show, message = 'Yükleniyor...') {
    let overlay = document.getElementById('loadingOverlay');

    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="spinner"></div>
                <p>${message}</p>
            `;
            document.body.appendChild(overlay);
        }
    } else {
        if (overlay) overlay.remove();
    }
}
