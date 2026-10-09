// ============================================
// AYIN SINIFI - KİOSK EKRANI (HATA AYIKLAMA SÜRÜMÜ)
// kiosk.js
// ============================================

// Genel JS hatalarını (eski tarayıcı uyumsuzlukları vb.) ekrana yazdırmak için
window.onerror = function(message, source, lineno, colno, error) {
    showErrorOnScreen("Sistem/JS Hatası", { message: message + " (Satır: " + lineno + ")" });
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Ayarları sunucudan çek (okul ismi vb.)
        await loadRemoteSettings();
        
        // Verileri Dinlemeye Başla (Gerçek Zamanlı)
        initRealtimeListeners();
    } catch (err) {
        showErrorOnScreen("Ayarlar Yüklenirken Hata", err);
    }
});

// TV EKRANINA HATA YAZDIRMA FONKSİYONU
function showErrorOnScreen(context, err) {
    const grid = document.getElementById('leaderboardGrid');
    if(grid) {
        grid.innerHTML = `
        <div style="background-color: #450a0a; color: #f87171; padding: 20px; border-radius: 12px; margin: 20px; font-size: 1.2rem; border: 2px solid #dc2626; box-shadow: 0 0 20px rgba(220, 38, 38, 0.5);">
            <h3 style="color: white; margin-bottom: 10px;">🛑 HATA TESPİT EDİLDİ (${context})</h3>
            <p style="margin-bottom: 8px;"><strong>Hata Mesajı:</strong> ${err.message || err.toString()}</p>
            <p><small><strong>Hata Kodu:</strong> ${err.code || 'Mevcut Değil'}</small></p>
            <p style="margin-top: 15px; font-size: 0.9rem; color: #fca5a5;">Lütfen bu ekranın fotoğrafını çekin veya hatayı not alın.</p>
        </div>`;
    }
    
    // Yükleniyor ekranını gizle ki hata görünsün
    const overlay = document.getElementById('overlay');
    if(overlay && !overlay.classList.contains('hidden')) {
        overlay.classList.add('hidden');
    }
}

function initRealtimeListeners() {
    const monthKey = getCurrentMonthKey();
    const monthName = formatMonthKey(monthKey);
    document.getElementById('kioskMonth').textContent = monthName;

    // 1) Şampiyonlar (Yıldızlar) Dinleyicisi
    db.collection('yearlyChampions').onSnapshot(snapshot => {
        renderStars(snapshot);
    }, err => {
        console.error(err);
        showErrorOnScreen("Yıldızlar Veritabanı (Firestore)", err);
    });

    // 2) Arşiv Dinleyicisi
    db.collection('archive').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        renderArchive(snapshot);
    }, err => {
        console.error(err);
        showErrorOnScreen("Arşiv Veritabanı (Firestore)", err);
    });

    // 3) Güncel Ayın Oyları Dinleyicisi (En önemlisi)
    db.collection('votes').where('monthKey', '==', monthKey).onSnapshot(snapshot => {
        processAndRenderVotes(snapshot);
        // İlk yüklemeden sonra loading ekranını kaldır
        const overlay = document.getElementById('overlay');
        if(!overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
        }
    }, err => {
        console.error("Oylar dinlenirken hata:", err);
        showErrorOnScreen("Oylar Veritabanı (Firestore)", err);
    });
}

// YILDIZLAR RENDER
function renderStars(snapshot) {
    const container = document.getElementById('starsList');
    if (snapshot.empty) {
        container.innerHTML = '<div style="opacity:0.4; font-size:0.9rem; text-align:center; padding:10px;">Henüz yıldız kazanan sınıf yok.</div>';
        return;
    }
    
    const champions = {};
    snapshot.forEach(doc => {
        const d = doc.data();
        if (d.classId && d.starCount) champions[d.classId] = d.starCount;
    });
    
    const sorted = Object.entries(champions).sort((a, b) => b[1] - a[1]);
    container.innerHTML = '';
    
    sorted.forEach(([classId, stars]) => {
        const div = document.createElement('div');
        div.className = 'star-card';
        div.innerHTML = `
            <span class="sc-class">${classId}</span>
            <span class="sc-stars">${'⭐'.repeat(stars)}</span>
        `;
        container.appendChild(div);
    });
}

// ARŞİV RENDER
function renderArchive(snapshot) {
    const container = document.getElementById('archiveList');
    if (snapshot.empty) {
        container.innerHTML = '<div style="opacity:0.4; font-size:0.9rem; text-align:center; padding:10px;">Arşiv boş.</div>';
        return;
    }
    
    container.innerHTML = '';
    snapshot.forEach(doc => {
        const data = doc.data();
        const monthName = formatMonthKey(data.monthKey);
        
        const div = document.createElement('div');
        div.className = 'archive-card';
        div.innerHTML = `
            <div class="ac-month">${monthName}</div>
            <div class="ac-class">🥇 ${data.winner.classId}</div>
        `;
        container.appendChild(div);
    });
}

// HAFTALIK PUAN HESAPLAMA VE RENDER
function processAndRenderVotes(snapshot) {
    if(snapshot.empty) {
        document.getElementById('leaderboardGrid').innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:1.2rem; padding:40px;">Bu ay henüz oylama yapılmadı. İlk oyu veren siz olun!</div>';
        document.getElementById('pastWeeksContainer').style.display = 'none';
        return;
    }

    const weeks = {};
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const dateParts = data.dateKey.split('-'); // YYYY-MM-DD
        const day = parseInt(dateParts[2]);
        
        // Ayın kaçıncı haftası?
        const weekNum = Math.ceil(day / 7);
        
        if(!weeks[weekNum]) weeks[weekNum] = {};
        if(!weeks[weekNum][data.classId]) weeks[weekNum][data.classId] = { totalScore: 0, voteCount: 0 };
        
        let vScore = data.totalScore;
        if(vScore === undefined && data.ratings) {
            vScore = Object.values(data.ratings).reduce((a,b)=>a+b, 0);
        }
        
        weeks[weekNum][data.classId].totalScore += (vScore || 0);
        weeks[weekNum][data.classId].voteCount += 1;
    });

    // Güncel haftayı bul (Bugünün tarihine göre veya en son veri olan hafta)
    const todayDay = new Date().getDate();
    let currentWeekNum = Math.ceil(todayDay / 7);
    
    const activeWeeks = Object.keys(weeks).map(Number).sort((a,b)=>b-a);
    if(!weeks[currentWeekNum] && activeWeeks.length > 0) {
