// ============================================
// AYIN SINIFI - KİOSK EKRANI MANTIK DOSYASI
// kiosk.js
// ============================================

// Otomatik yenileme aralığı (milisaniye)
const REFRESH_INTERVAL = 60000; // 60 saniye

// ============================================
// SAYFA BAŞLANGIÇ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initKiosk();
    startClock();
    
    // Otomatik yenileme zamanlayıcısı
    setInterval(() => {
        loadKioskData();
    }, REFRESH_INTERVAL);
});

/**
 * Kiosk ekranını başlatır
 */
async function initKiosk() {
    // Okul adını ayarla
    document.getElementById('kioskSchoolName').textContent = APP_CONFIG.schoolName;
    document.getElementById('kioskSchoolName2').textContent = APP_CONFIG.schoolName;
    
    await loadKioskData();
}

/**
 * Kiosk verilerini Firestore'dan yükler
 */
async function loadKioskData() {
    const monthKey = getCurrentMonthKey();
    const monthName = formatMonthKey(monthKey);
    
    document.getElementById('kioskMonth').textContent = monthName;
    document.getElementById('kioskMonth2').textContent = monthName;
    
    try {
        // Bu ayın aylık özetlerini çek
        const snapshot = await db.collection('monthlySummaries')
            .where('monthKey', '==', monthKey)
            .get();
        
        if (snapshot.empty) {
            // Veri yok
            showKioskScreen('noData');
            return;
        }
        
        // Sınıfları puan sırasına göre sırala
        const summaries = [];
        snapshot.forEach(doc => {
            summaries.push(doc.data());
        });
        
        summaries.sort((a, b) => b.avgScore - a.avgScore);
        
        if (summaries.length === 0) {
            showKioskScreen('noData');
            return;
        }
        
        // Birinci sınıfı göster
        const winner = summaries[0];
        
        document.getElementById('kioskWinnerName').textContent = winner.classId;
        document.getElementById('kioskScore').textContent = 
            `Ortalama Puan: ${winner.avgScore.toFixed(1)} / 5.0  |  Toplam Oy: ${winner.voteCount}`;
        
        // Yıldızları puana göre göster
        const fullStars = Math.round(winner.avgScore);
        let starsHTML = '';
        for (let i = 0; i < 5; i++) {
            starsHTML += i < fullStars ? '⭐' : '☆';
        }
        document.getElementById('kioskStars').textContent = starsHTML;
        
        // Yıllık ilerleme çubuklarını yükle
        await loadKioskProgress();
        
        // Konfeti efekti
        createConfetti();
        
        showKioskScreen('content');
        
    } catch (error) {
        console.error('Kiosk veri yükleme hatası:', error);
        showKioskScreen('noData');
    }
}

/**
 * Büyük ödül ilerleme çubuklarını yükler
 */
async function loadKioskProgress() {
    try {
        const snapshot = await db.collection('yearlyChampions').get();
        
        if (snapshot.empty) {
            document.getElementById('kioskProgressSection').classList.add('hidden');
            return;
        }
        
        const champions = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.classId && data.starCount) {
                champions[data.classId] = data.starCount;
            }
        });
        
        if (Object.keys(champions).length === 0) {
            document.getElementById('kioskProgressSection').classList.add('hidden');
            return;
        }
        
        // Sırala (en çok yıldız önce)
        const sorted = Object.entries(champions).sort((a, b) => b[1] - a[1]);
        const maxStars = APP_CONFIG.grandPrizeThreshold;
        
        const container = document.getElementById('kioskProgressBars');
        container.innerHTML = '';
        
        sorted.forEach(([classId, stars]) => {
            const percentage = Math.min((stars / maxStars) * 100, 100);
            
            const item = document.createElement('div');
            item.className = 'kiosk-progress-item';
            item.innerHTML = `
                <span class="kp-class">${classId}</span>
                <div class="kp-track">
                    <div class="kp-fill" style="width: ${percentage}%">${stars}/${maxStars}</div>
                </div>
                <span class="kp-stars">${'⭐'.repeat(Math.min(stars, maxStars))}</span>
            `;
            container.appendChild(item);
        });
        
        document.getElementById('kioskProgressSection').classList.remove('hidden');
        
    } catch (error) {
        console.error('Yıllık ilerleme yükleme hatası:', error);
        document.getElementById('kioskProgressSection').classList.add('hidden');
    }
}

/**
 * Kiosk ekranlarını yönetir
 * @param {string} screen - 'content', 'noData', 'loading'
 */
function showKioskScreen(screen) {
    document.getElementById('kioskLoading').classList.toggle('hidden', screen !== 'loading');
    document.getElementById('kioskContent').classList.toggle('hidden', screen !== 'content');
    document.getElementById('kioskNoData').classList.toggle('hidden', screen !== 'noData');
}

/**
 * Saat gösterimi
 */
function startClock() {
    function updateClock() {
        const now = new Date();
        const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString('tr-TR', { 
            day: 'numeric', month: 'long', year: 'numeric' 
        });
        document.getElementById('kioskTime').textContent = `${date} • ${time}`;
    }
    
    updateClock();
    setInterval(updateClock, 30000); // 30 saniyede bir güncelle
}

/**
 * Konfeti efekti oluşturur
 */
function createConfetti() {
    // Önceki konfetileri temizle
    document.querySelectorAll('.confetti-piece').forEach(el => el.remove());
    
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
    const shapes = ['●', '■', '▲', '★', '♦'];
    
    for (let i = 0; i < 40; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.color = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.fontSize = (Math.random() * 20 + 10) + 'px';
        confetti.style.animationDuration = (Math.random() * 5 + 5) + 's';
        confetti.style.animationDelay = (Math.random() * 10) + 's';
        
        document.body.appendChild(confetti);
        
        // Animasyon bitince kaldır
        confetti.addEventListener('animationend', () => confetti.remove());
    }
}
