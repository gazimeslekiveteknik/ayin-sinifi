// ============================================
// AYIN SINIFI - KİOSK EKRANI MANTIK DOSYASI
// kiosk.js
// ============================================

const REFRESH_INTERVAL = 60000; // 60 saniye

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Ayarları sunucudan çek (okul ismi vb.)
    await loadRemoteSettings();
    
    // Okul adlarını HTML'ye bas
    document.getElementById('kioskSchoolName').textContent = APP_CONFIG.schoolName;
    document.getElementById('kioskSchoolName2').textContent = APP_CONFIG.schoolName;

    // 2. Kiosk verilerini yükle
    initKiosk();
    startClock();
    
    setInterval(() => {
        loadKioskData();
    }, REFRESH_INTERVAL);
});

async function initKiosk() {
    await loadKioskData();
}

async function loadKioskData() {
    const monthKey = getCurrentMonthKey();
    const monthName = formatMonthKey(monthKey);
    
    document.getElementById('kioskMonth').textContent = monthName;
    document.getElementById('kioskMonth2').textContent = monthName;
    
    try {
        // Sol Panel: Geçmiş Aylar ve Yıldızlar
        await loadArchiveList();
        await loadKioskProgress();
        
        // Sağ Panel: Bu Ayın Oyları (Haftalık hesaplama için)
        const snapshot = await db.collection('votes')
            .where('monthKey', '==', monthKey)
            .get();
            
        if (snapshot.empty) {
            showKioskScreen('noData');
            return;
        }

        // Haftalara göre oyları kümele
        const weeks = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const dateParts = data.dateKey.split('-'); // YYYY-MM-DD
            const day = parseInt(dateParts[2]);
            
            // Ayın kaçıncı haftası? (1-7: 1. Hafta, 8-14: 2. Hafta, vb.)
            const weekNum = Math.ceil(day / 7);
            
            if(!weeks[weekNum]) {
                weeks[weekNum] = {};
            }
            
            if(!weeks[weekNum][data.classId]) {
                weeks[weekNum][data.classId] = { totalScore: 0, voteCount: 0 };
            }
            
            let vScore = data.totalScore;
            if(vScore === undefined && data.ratings) {
                vScore = Object.values(data.ratings).reduce((a,b)=>a+b, 0);
            }
            
            weeks[weekNum][data.classId].totalScore += (vScore || 0);
            weeks[weekNum][data.classId].voteCount += 1;
        });

        // Hangi haftadayız?
        const todayDay = new Date().getDate();
        let currentWeekNum = Math.ceil(todayDay / 7);
        
        // Eğer o hafta hiç veri yoksa, en son verisi olan haftayı güncel kabul edelim
        const activeWeeks = Object.keys(weeks).map(Number).sort((a,b)=>b-a);
        if(!weeks[currentWeekNum] && activeWeeks.length > 0) {
            currentWeekNum = activeWeeks[0];
        }

        document.getElementById('currentWeekNum').textContent = `${currentWeekNum}. Hafta`;

        // 1) Güncel Hafta İlk 10
        renderCurrentWeek(weeks[currentWeekNum] || {});

        // 2) Önceki Haftalar İlk 3
        renderPastWeeks(weeks, currentWeekNum);

        showKioskScreen('content');
    } catch (error) {
        console.error('Kiosk veri yükleme hatası:', error);
        showKioskScreen('noData');
    }
}

function processClassScores(weekData) {
    const classList = [];
    for(const [classId, stats] of Object.entries(weekData)) {
        const avg = stats.totalScore / (stats.voteCount * APP_CONFIG.criteria.length);
        classList.push({ classId, avgScore: avg, totalScore: stats.totalScore, voteCount: stats.voteCount });
    }
    classList.sort((a,b) => b.avgScore - a.avgScore);
    return classList;
}

function renderCurrentWeek(weekData) {
    const grid = document.getElementById('currentWeekGrid');
    grid.innerHTML = '';
    
    const classList = processClassScores(weekData);
    
    if(classList.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; opacity:0.6;">Bu hafta henüz oy kullanılmamış.</div>';
        return;
    }
    
    // Sadece ilk 10
    const top10 = classList.slice(0, 10);
    
    top10.forEach((item, index) => {
        let rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
        
        const div = document.createElement('div');
        div.className = 'top10-item';
        div.innerHTML = `
            <div class="rank ${rankClass}">${index + 1}</div>
            <div class="class-name">${item.classId} ${index === 0 ? '🏆' : ''}</div>
            <div class="class-score">${item.avgScore.toFixed(2)}</div>
        `;
        grid.appendChild(div);
    });
}

function renderPastWeeks(weeks, currentWeekNum) {
    const container = document.getElementById('pastWeeksContainer');
    container.innerHTML = '';
    
    let pastWeeksExist = false;
    
    // 1'den (currentWeekNum - 1)'e kadar tüm haftaları göster
    for(let w = 1; w < currentWeekNum; w++) {
        if(!weeks[w]) continue;
        
        pastWeeksExist = true;
        const classList = processClassScores(weeks[w]).slice(0, 3); // İlk 3
        
        const card = document.createElement('div');
        card.className = 'past-week-card';
        
        let html = `<div class="pw-title">${w}. Hafta Liderleri</div>`;
        if(classList.length === 0) {
            html += '<div style="opacity:0.5; text-align:center; padding:10px;">Kayıt yok.</div>';
        } else {
            classList.forEach((item, index) => {
                html += `
                    <div class="pw-item">
                        <div class="pw-rank">#${index+1}</div>
                        <div class="pw-class">${item.classId}</div>
                        <div class="pw-score">${item.avgScore.toFixed(2)}</div>
                    </div>
                `;
            });
        }
        card.innerHTML = html;
        container.appendChild(card);
    }
    
    if(!pastWeeksExist) {
        container.innerHTML = '<div style="width:100%; text-align:center; align-self:center; opacity:0.5;">Henüz önceki haftalara ait bir veri bulunmuyor.</div>';
    }
}

async function loadArchiveList() {
    try {
        const snapshot = await db.collection('archive').orderBy('timestamp', 'desc').get();
        const container = document.getElementById('archiveList');
        
        if (snapshot.empty) {
            container.innerHTML = '<div style="text-align:center; opacity:0.6; padding:20px;">Henüz arşivlenmiş ay yok.</div>';
            return;
        }
        
        container.innerHTML = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const monthName = formatMonthKey(data.monthKey);
            
            const div = document.createElement('div');
            div.className = 'champion-item';
            div.innerHTML = `
                <div>
                    <div class="champ-month">${monthName} Birincisi</div>
                    <div class="champ-class">${data.winner.classId}</div>
                </div>
                <div style="font-size:1.5rem;">🥇</div>
            `;
            container.appendChild(div);
        });
        
    } catch(e) {
        console.error("Arşiv yüklenemedi", e);
    }
}

async function loadKioskProgress() {
    try {
        const snapshot = await db.collection('yearlyChampions').get();
        const container = document.getElementById('kioskProgressBars');
        
        if (snapshot.empty) {
            container.innerHTML = '<div style="opacity:0.5; font-size:0.9rem;">Henüz altın yıldız kazanan sınıf yok.</div>';
            return;
        }
        
        const champions = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.classId && data.starCount) {
                champions[data.classId] = data.starCount;
            }
        });
        
        const sorted = Object.entries(champions).sort((a, b) => b[1] - a[1]);
        container.innerHTML = '';
        
        sorted.forEach(([classId, stars]) => {
            const item = document.createElement('div');
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; margin-bottom:4px;">
                    <strong style="color:white; font-size:0.9rem;">${classId}</strong>
                    <span class="champ-stars">${'⭐'.repeat(stars)}</span>
                </div>
            `;
            container.appendChild(item);
        });
        
    } catch (error) {
        console.error('Yıllık ilerleme yükleme hatası:', error);
    }
}

function showKioskScreen(screen) {
    document.getElementById('kioskLoading').classList.toggle('hidden', screen !== 'loading');
    document.getElementById('kioskContent').classList.toggle('hidden', screen !== 'content');
    document.getElementById('kioskNoData').classList.toggle('hidden', screen !== 'noData');
}

function startClock() {
    function updateClock() {
        const now = new Date();
        const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        
        const kTime1 = document.getElementById('kioskTime');
        const kTime2 = document.getElementById('kioskTime2');
        if(kTime1) kTime1.textContent = `${date} • ${time}`;
        if(kTime2) kTime2.textContent = `${date} • ${time}`;
    }
    
    updateClock();
    setInterval(updateClock, 30000);
}
