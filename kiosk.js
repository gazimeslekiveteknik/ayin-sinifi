// ============================================
// AYIN SINIFI - KİOSK EKRANI (REAL-TIME YENİ NESİL)
// kiosk.js
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Ayarları sunucudan çek (okul ismi vb.)
    await loadRemoteSettings();
    const sName = document.getElementById('kioskSchoolName');
    if(sName) sName.textContent = APP_CONFIG.schoolName;

    // Saat başlat
    startClock();

    // Verileri Dinlemeye Başla (Gerçek Zamanlı)
    initRealtimeListeners();
});

function initRealtimeListeners() {
    const monthKey = getCurrentMonthKey();
    const monthName = formatMonthKey(monthKey);
    document.getElementById('kioskMonth').textContent = monthName;

    // 1) Şampiyonlar (Yıldızlar) Dinleyicisi
    db.collection('yearlyChampions').onSnapshot(snapshot => {
        renderStars(snapshot);
    }, err => console.error(err));

    // 2) Arşiv Dinleyicisi
    db.collection('archive').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        renderArchive(snapshot);
    }, err => console.error(err));

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
        document.getElementById('overlay').classList.add('hidden');
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
        currentWeekNum = activeWeeks[0];
    }

    document.getElementById('weekTitle').textContent = `${currentWeekNum}. Hafta Liderlik Tablosu`;

    // 1) Güncel Hafta İlk 10
    renderCurrentWeek(weeks[currentWeekNum] || {});

    // 2) Önceki Haftalar
    renderPastWeeks(weeks, currentWeekNum);
}

function processScores(weekData) {
    const classList = [];
    for(const [classId, stats] of Object.entries(weekData)) {
        const avg = stats.totalScore / (stats.voteCount * APP_CONFIG.criteria.length);
        classList.push({ classId, avgScore: avg, totalScore: stats.totalScore, voteCount: stats.voteCount });
    }
    // Ortalamaya göre sırala, ortalama eşitse toplam puana bak
    classList.sort((a,b) => b.avgScore - a.avgScore || b.totalScore - a.totalScore);
    return classList;
}

function renderCurrentWeek(weekData) {
    const grid = document.getElementById('leaderboardGrid');
    grid.innerHTML = '';
    
    const classList = processScores(weekData);
    
    if(classList.length === 0) {
        grid.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:1.2rem; padding:40px;">Bu hafta henüz oylama yapılmadı.</div>';
        return;
    }
    
    // Sadece ilk 10
    const top10 = classList.slice(0, 10);
    
    top10.forEach((item, index) => {
        let rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
        
        // Animasyon gecikmesi (şelale efekti)
        let delay = index * 0.1;
        
        const div = document.createElement('div');
        div.className = `lb-row ${rankClass}`;
        div.style.animationDelay = `${delay}s`;
        
        div.innerHTML = `
            <div class="lb-rank">${index + 1}</div>
            <div class="lb-class">${item.classId} ${index === 0 ? '<i class="fas fa-crown" style="font-size:0.8em; margin-left:8px; opacity:0.8;"></i>' : ''}</div>
            <div class="lb-stats">
                <div class="stat-box highlight">
                    <span class="stat-label">Ortalama</span>
                    <span class="stat-val">${item.avgScore.toFixed(2)}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Toplam Puan</span>
                    <span class="stat-val">${item.totalScore}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Kullanılan Oy</span>
                    <span class="stat-val">${item.voteCount}</span>
                </div>
            </div>
        `;
        grid.appendChild(div);
    });
}

function renderPastWeeks(weeks, currentWeekNum) {
    const container = document.getElementById('pastWeeksContainer');
    container.innerHTML = '';
    
    let hasPastWeeks = false;
    
    for(let w = 1; w < currentWeekNum; w++) {
        if(!weeks[w]) continue;
        
        hasPastWeeks = true;
        const top3 = processScores(weeks[w]).slice(0, 3);
        
        const card = document.createElement('div');
        card.className = 'pw-card';
        
        let html = `<div class="pw-title">${w}. Hafta Liderleri</div><div class="pw-list">`;
        
        top3.forEach((item, i) => {
            let prefix = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            html += `
                <div class="pw-item">
                    <span class="pw-item-class">${prefix} ${item.classId}</span>
                    <span class="pw-item-score">${item.avgScore.toFixed(2)}</span>
                </div>
            `;
        });
        html += `</div>`;
        card.innerHTML = html;
        container.appendChild(card);
    }
    
    container.style.display = hasPastWeeks ? 'flex' : 'none';
}

function startClock() {
    function updateClock() {
        const now = new Date();
        document.getElementById('timeDisplay').textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('dateDisplay').textContent = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    updateClock();
    setInterval(updateClock, 10000);
}
