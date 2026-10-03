// ============================================
// AYIN SINIFI - ADMİN PANELİ MANTIK DOSYASI
// admin.js
// ============================================

// ---------- Durum Değişkenleri ----------
let currentTab = 'leaderboard';
let leaderboardData = [];
let yearlyData = {};

// ============================================
// SAYFA BAŞLANGIÇ
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadRemoteSettings();
    populateSettingsUI();
    // Admin oturum kontrolü
    const adminSession = sessionStorage.getItem('adminSession');
    if (adminSession === 'active') {
        showAdminPanel();
    }
});

// ============================================
// ADMİN GİRİŞ/ÇIKIŞ
// ============================================

/**
 * Admin şifresiyle giriş yapar
 */
async function adminLogin() {
    await loadRemoteSettings();
    const password = document.getElementById('adminPasswordInput').value.trim();
    
    if (!password) {
        showToast('Lütfen şifre girin.', 'warning');
        return;
    }
    
    if (password === APP_CONFIG.adminPassword) {
        sessionStorage.setItem('adminSession', 'active');
        showAdminPanel();
        showToast('Yönetim paneline hoş geldiniz!', 'success');
    } else {
        showToast('Yanlış şifre!', 'error');
        document.getElementById('adminPasswordInput').value = '';
    }
}

/**
 * Admin çıkış yapar
 */
function adminLogout() {
    sessionStorage.removeItem('adminSession');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('adminLoginScreen').classList.remove('hidden');
    document.getElementById('adminPasswordInput').value = '';
}

/**
 * Admin panelini gösterir ve verileri yükler
 */
function showAdminPanel() {
    document.getElementById('adminLoginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    
    // Ayarları göster
    document.getElementById('settingSchoolName').textContent = APP_CONFIG.schoolName;
    document.getElementById('settingClassCount').textContent = APP_CONFIG.classes.length;
    document.getElementById('settingGrandPrize').textContent = APP_CONFIG.grandPrizeThreshold;
    document.getElementById('grandPrizeThreshold').textContent = APP_CONFIG.grandPrizeThreshold;
    document.getElementById('statTotalClasses').textContent = APP_CONFIG.classes.length;
    document.getElementById('statCurrentMonth').textContent = formatMonthKey(getCurrentMonthKey());
    
    // Sınıf filtre dropdown'ını doldur
    populateClassFilter();
    
    // Verileri yükle
    refreshData();
}

/**
 * Tüm verileri yeniler
 */
async function refreshData() {
    showLoading(true, 'Veriler yükleniyor...');
    
    try {
        await Promise.all([
            loadLeaderboard(),
            loadTeacherCount(),
            loadTeachers(),
            loadYearlyChampions(),
            loadArchive(),
            loadVoteDetails(),
            loadTotalVotes()
        ]);
    } catch (error) {
        console.error('Veri yükleme hatası:', error);
        showToast('Verileri yüklerken bir hata oluştu.', 'error');
    }
    
    showLoading(false);
}

// ============================================
// TAB YÖNETİMİ
// ============================================

/**
 * Tab panellerini değiştirir
 * @param {string} tabName - Gösterilecek tab adı
 */
function switchTab(tabName) {


    currentTab = tabName;
    
    // Eğer Karekodlar sekmesine geçiliyorsa otomatik oluştur
    if (tabName === 'qr') {
        setTimeout(() => {
            if (document.getElementById('printArea') && document.getElementById('printArea').innerHTML.trim() === '') {
                generateAllQRCodes();
            }
        }, 100);
    }
    
    // Tab butonlarını güncelle
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Tab panellerini güncelle
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });
}

// ============================================
// LİDERLİK TABLOSU (LEADERBOARD)
// ============================================

/**
 * Aylık liderlik tablosunu yükler
 */
async function loadLeaderboard() {
    const monthKey = getCurrentMonthKey();
    document.getElementById('leaderboardMonth').textContent = formatMonthKey(monthKey);
    
    const snapshot = await db.collection('monthlySummaries')
        .where('monthKey', '==', monthKey)
        .get();
    
    leaderboardData = [];
    snapshot.forEach(doc => {
        leaderboardData.push(doc.data());
    });
    
    // Ortalama puana göre sırala
    leaderboardData.sort((a, b) => b.avgScore - a.avgScore);
    
    renderLeaderboard();
}

/**
 * Liderlik tablosunu HTML olarak render eder
 */
function renderLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    
    if (leaderboardData.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-light);">
                Bu ay henüz değerlendirme yapılmamış.
            </td></tr>`;
        return;
    }
    
    tbody.innerHTML = leaderboardData.map((item, index) => {
        const rank = index + 1;
        let rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
        let trophy = rank === 1 ? ' 🏆' : rank === 2 ? ' 🥈' : rank === 3 ? ' 🥉' : '';
        
        return `
            <tr style="cursor:pointer; transition:background 0.2s;" onclick="showClassDetails('${item.classId}')" title="Sınıfın oy detaylarını görmek için tıklayın" onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background=''">
                <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                <td>
                    <span class="class-name-cell">
                        ${item.classId}${trophy}
                    </span>
                </td>
                <td>
                    <span class="star-count">
                        ⭐ ${item.avgScore.toFixed(2)}
                    </span>
                </td>
                <td>${item.totalScore}</td>
                <td>${item.voteCount}</td>
            </tr>
        `;
    }).join('');
}

// ============================================
// TOPLAM OY İSTATİSTİĞİ
// ============================================

/**
 * Bu ayki toplam oy sayısını yükler
 */
async function loadTotalVotes() {
    const monthKey = getCurrentMonthKey();
    
    const snapshot = await db.collection('votes')
        .where('monthKey', '==', monthKey)
        .get();
    
    document.getElementById('statTotalVotes').textContent = snapshot.size;
}

// ============================================
// ÖĞRETMEN YÖNETİMİ
// ============================================

/**
 * Öğretmen sayısını yükler
 */
async function loadTeacherCount() {
    const snapshot = await db.collection('teachers').get();
    document.getElementById('statTotalTeachers').textContent = snapshot.size;
}

/**
 * Öğretmen listesini yükler ve render eder
 */
async function loadTeachers() {
    const snapshot = await db.collection('teachers')
        .orderBy('name')
        .get();
    
    const container = document.getElementById('teacherList');
    
    if (snapshot.empty) {
        container.innerHTML = `
            <p style="text-align:center; color:var(--text-light); padding:20px;">
                Henüz kayıtlı öğretmen yok. Aşağıdan ekleyebilirsiniz.
            </p>`;
        return;
    }
    
    container.innerHTML = '';
    
    snapshot.forEach(doc => {
        const teacher = doc.data();
        const initials = teacher.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        
        const item = document.createElement('div');
        item.className = 'teacher-item';
        item.innerHTML = `
            <div class="teacher-detail">
                <div class="teacher-avatar">${initials}</div>
                <div>
                    <strong>${teacher.name}</strong>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">
                        ${teacher.branch || 'Branş belirtilmemiş'} • PIN: ${teacher.pin}
                        ${teacher.active === false ? ' • <span style="color:var(--danger);">Pasif</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="teacher-actions">
                <button class="btn btn-sm ${teacher.active === false ? 'btn-success' : 'btn-outline'}" 
                    onclick="toggleTeacherStatus('${doc.id}', ${teacher.active !== false})">
                    ${teacher.active === false ? '✅ Aktifle' : '⏸️ Pasifle'}
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteTeacher('${doc.id}', '${teacher.name}')">
                    🗑️
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

/**
 * Yeni öğretmen ekler
 */
async function addTeacher() {
    const name = document.getElementById('newTeacherName').value.trim();
    const branch = document.getElementById('newTeacherBranch').value.trim();
    const pin = document.getElementById('newTeacherPin').value.trim();
    
    // Doğrulama
    if (!name) {
        showToast('Lütfen öğretmen adı girin.', 'warning');
        return;
    }
    
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
        showToast('PIN kodu 6 haneli rakamlardan oluşmalıdır.', 'warning');
        return;
    }
    
    showLoading(true, 'Öğretmen ekleniyor...');
    
    try {
        // PIN mükerrer kontrolü
        const existing = await db.collection('teachers')
            .where('pin', '==', pin)
            .get();
        
        if (!existing.empty) {
            showLoading(false);
            showToast('Bu PIN kodu zaten kullanılıyor! Farklı bir PIN girin.', 'error');
            return;
        }
        
        // Öğretmeni ekle
        await db.collection('teachers').add({
            name: name,
            branch: branch || null,
            pin: pin,
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Formu temizle
        document.getElementById('newTeacherName').value = '';
        document.getElementById('newTeacherBranch').value = '';
        document.getElementById('newTeacherPin').value = '';
        
        // Listeyi yenile
        await loadTeachers();
        await loadTeacherCount();
        
        showLoading(false);
        showToast(`${name} başarıyla eklendi!`, 'success');
        
    } catch (error) {
        showLoading(false);
        console.error('Öğretmen ekleme hatası:', error);
        showToast('Öğretmen eklenirken bir hata oluştu.', 'error');
    }
}

/**
 * Öğretmenin aktif/pasif durumunu değiştirir
 */
async function toggleTeacherStatus(teacherId, currentlyActive) {
    try {
        await db.collection('teachers').doc(teacherId).update({
            active: !currentlyActive
        });
        
        await loadTeachers();
        showToast(currentlyActive ? 'Öğretmen pasife alındı.' : 'Öğretmen aktifleştirildi.', 'success');
    } catch (error) {
        console.error('Durum değiştirme hatası:', error);
        showToast('İşlem başarısız.', 'error');
    }
}

/**
 * Öğretmeni siler
 */
async function deleteTeacher(teacherId, teacherName) {
    if (!confirm(`"${teacherName}" adlı öğretmeni silmek istediğinize emin misiniz?`)) {
        return;
    }
    
    try {
        await db.collection('teachers').doc(teacherId).delete();
        await loadTeachers();
        await loadTeacherCount();
        showToast(`${teacherName} silindi.`, 'success');
    } catch (error) {
        console.error('Öğretmen silme hatası:', error);
        showToast('Silme işlemi başarısız.', 'error');
    }
}

// ============================================
// YILLIK ŞAMPİYONLUK SİSTEMİ
// ============================================

/**
 * Yıllık şampiyonluk verilerini yükler
 */
async function loadYearlyChampions() {
    try {
        // Yıllık şampiyon puanları
        const champSnapshot = await db.collection('yearlyChampions').get();
        yearlyData = {};
        
        champSnapshot.forEach(doc => {
            const data = doc.data();
            yearlyData[data.classId] = {
                starCount: data.starCount || 0,
                months: data.months || []
            };
        });
        
        renderYearlyProgress();
        
        // Aylık şampiyonlar geçmişi
        const archiveSnapshot = await db.collection('archive')
            .orderBy('archivedAt', 'desc')
            .get();
        
        renderMonthlyChampions(archiveSnapshot);
        
    } catch (error) {
        console.error('Yıllık şampiyon yükleme hatası:', error);
    }
}

/**
 * Yıllık ilerleme çubuklarını render eder
 */
function renderYearlyProgress() {
    const container = document.getElementById('yearlyProgressContainer');
    
    const entries = Object.entries(yearlyData).filter(([_, data]) => data.starCount > 0);
    
    if (entries.length === 0) {
        container.innerHTML = `
            <p style="text-align:center; color:var(--text-light); padding:20px;">
                Henüz aylık şampiyonluk kazanılmamış. İlk ay kapandığında burada veriler görünecektir.
            </p>`;
        return;
    }
    
    // En çok yıldız önce
    entries.sort((a, b) => b[1].starCount - a[1].starCount);
    
    const maxStars = APP_CONFIG.grandPrizeThreshold;
    const barColors = ['gold', 'blue', 'green', 'purple', 'blue', 'green'];
    
    container.innerHTML = entries.map(([classId, data], index) => {
        const percentage = Math.min((data.starCount / maxStars) * 100, 100);
        const color = barColors[index % barColors.length];
        const isWinner = data.starCount >= maxStars;
        
        return `
            <div class="progress-bar-wrapper">
                <span class="progress-class-name">${classId} ${isWinner ? '🎉' : ''}</span>
                <div class="progress-bar-track">
                    <div class="progress-bar-fill ${color}" style="width: ${percentage}%">
                        ${data.starCount} / ${maxStars}
                    </div>
                </div>
                <span class="progress-stars">${'⭐'.repeat(Math.min(data.starCount, maxStars))}</span>
            </div>
        `;
    }).join('');
}

/**
 * Aylık şampiyonlar geçmişini render eder
 */
function renderMonthlyChampions(snapshot) {
    const container = document.getElementById('monthlyChampionsList');
    
    if (snapshot.empty) {
        container.innerHTML = `
            <p style="text-align:center; color:var(--text-light); padding:20px;">
                Henüz arşivlenmiş ay yok.
            </p>`;
        return;
    }
    
    container.innerHTML = '';
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const winner = data.rankings && data.rankings.length > 0 ? data.rankings[0] : null;
        
        const item = document.createElement('div');
        item.className = 'archive-item';
        item.style.cursor = 'default';
        item.innerHTML = `
            <div>
                <span class="archive-month">🏆 ${formatMonthKey(data.monthKey)}</span>
            </div>
            <div class="archive-winner">
                ${winner ? `⭐ ${winner.classId} (Ort: ${winner.avgScore.toFixed(2)})` : 'Veri yok'}
            </div>
        `;
        container.appendChild(item);
    });
}

// ============================================
// OY DETAYLARI
// ============================================

/**
 * Sınıf filtre dropdown'ını doldurur
 */
function populateClassFilter() {
    const select = document.getElementById('voteFilterClass');
    // Mevcut seçenekleri temizle (ilk hariç)
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    APP_CONFIG.classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls;
        option.textContent = cls;
        select.appendChild(option);
    });
}

/**
 * Oy detaylarını yükler
 */
async function loadVoteDetails() {
    const monthKey = getCurrentMonthKey();
    const filterClass = document.getElementById('voteFilterClass').value;
    
    let query = db.collection('votes')
        .where('monthKey', '==', monthKey)
        .orderBy('timestamp', 'desc')
        .limit(100);
    
    if (filterClass) {
        query = db.collection('votes')
            .where('monthKey', '==', monthKey)
            .where('classId', '==', filterClass)
            .orderBy('timestamp', 'desc')
            .limit(100);
    }
    
    try {
        const snapshot = await query.get();
        renderVoteDetails(snapshot);
    } catch (error) {
        console.error('Oy detayı yükleme hatası:', error);
        // Bileşik index gerekebilir hatası
        const container = document.getElementById('voteDetailGrid');
        container.innerHTML = `
            <p style="text-align:center; color:var(--text-secondary); padding:20px; grid-column: 1/-1;">
                ⚠️ Oy detayları yüklenemedi. Firebase Console'dan gerekli bileşik index'leri oluşturmanız gerekebilir.<br>
                <small style="color:var(--text-light);">Hata: ${error.message}</small>
            </p>`;
    }
}

/**
 * Oy detaylarını render eder
 */
function renderVoteDetails(snapshot) {
    const container = document.getElementById('voteDetailGrid');
    
    if (snapshot.empty) {
        container.innerHTML = `
            <p style="text-align:center; color:var(--text-light); padding:20px; grid-column: 1/-1;">
                Bu filtre için henüz oy bulunamadı.
            </p>`;
        return;
    }
    
    container.innerHTML = '';
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleDateString('tr-TR') : data.dateKey;
        const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}) : '';
        
        const card = document.createElement('div');
        card.className = 'vote-detail-card';
        
        // Kriter puanlarını listele
        let criteriaHTML = '';
        if (data.ratings) {
            APP_CONFIG.criteria.forEach(c => {
                const rating = data.ratings[c.id] || 0;
                criteriaHTML += `
                    <div class="vote-criteria-item">
                        <span class="criteria-name">${c.icon} ${c.title}</span>
                        <span class="criteria-stars">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</span>
                    </div>
                `;
            });
        }
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="vote-teacher">👤 ${data.teacherName}</span>
                <span style="background:var(--primary-light); padding:2px 10px; border-radius:20px; font-size:0.78rem; font-weight:600; color:var(--primary);">
                    ${data.classId}
                </span>
            </div>
            <div class="vote-date">📅 ${date} ${time} • Ort: ${data.avgScore?.toFixed(1) || '-'}</div>
            <div class="vote-criteria-list">${criteriaHTML}</div>
            ${data.comment ? `<div style="margin-top:8px; padding:8px; background:var(--primary-light); border-radius:6px; font-size:0.8rem; color:var(--text-secondary);">💬 ${data.comment}</div>` : ''}
        `;
        
        container.appendChild(card);
    });
}

// ============================================
// ARŞİV
// ============================================

/**
 * Arşiv listesini yükler
 */
async function loadArchive() {
    try {
        const snapshot = await db.collection('archive')
            .orderBy('archivedAt', 'desc')
            .get();
        
        const container = document.getElementById('archiveList');
        
        if (snapshot.empty) {
            container.innerHTML = `
                <p style="text-align:center; color:var(--text-light); padding:20px;">
                    Henüz arşivlenmiş ay yok. İlk ayı kapattığınızda veriler burada görünecek.
                </p>`;
            return;
        }
        
        container.innerHTML = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const winner = data.rankings && data.rankings.length > 0 ? data.rankings[0] : null;
            
            const item = document.createElement('div');
            item.className = 'archive-item';
            item.style.cursor = 'pointer';
            item.onclick = () => showArchiveDetail(data);
            
            item.innerHTML = `
                <div>
                    <span class="archive-month">📅 ${formatMonthKey(data.monthKey)}</span>
                    <div style="font-size:0.8rem; color:var(--text-light); margin-top:4px;">
                        ${data.rankings ? data.rankings.length : 0} sınıf • 
                        ${data.totalVotes || '?'} oy
                    </div>
                </div>
                <div class="archive-winner">
                    🏆 ${winner ? winner.classId : '-'} 
                    ${winner ? `(${winner.avgScore.toFixed(2)})` : ''}
                </div>
            `;
            container.appendChild(item);
        });
        
    } catch (error) {
        console.error('Arşiv yükleme hatası:', error);
    }
}

/**
 * Arşiv detay modalını gösterir
 */
function showArchiveDetail(data) {
    document.getElementById('archiveDetailTitle').textContent = formatMonthKey(data.monthKey);
    
    const tbody = document.getElementById('archiveDetailBody');
    
    if (!data.rankings || data.rankings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Detay verisi yok.</td></tr>';
    } else {
        tbody.innerHTML = data.rankings.map((item, index) => {
            const rank = index + 1;
            let rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
            let trophy = rank === 1 ? ' 🏆' : rank === 2 ? ' 🥈' : rank === 3 ? ' 🥉' : '';
            
            return `
                <tr>
                    <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                    <td>${item.classId}${trophy}</td>
                    <td>⭐ ${item.avgScore.toFixed(2)}</td>
                    <td>${item.voteCount}</td>
                </tr>
            `;
        }).join('');
    }
    
    document.getElementById('archiveDetailModal').classList.remove('hidden');
}

/**
 * Arşiv detay modalını kapatır
 */
function closeArchiveDetail() {
    document.getElementById('archiveDetailModal').classList.add('hidden');
}

// ============================================
// AY SONU SIFIRLAMA
// ============================================

/**
 * Sıfırlama modalını gösterir
 */
function showResetModal() {
    // Bu ayın birincisini bul
    if (leaderboardData.length > 0) {
        document.getElementById('resetWinnerName').textContent = 
            `${leaderboardData[0].classId} (Ort: ${leaderboardData[0].avgScore.toFixed(2)})`;
    } else {
        document.getElementById('resetWinnerName').textContent = 'Henüz veri yok';
    }
    
    document.getElementById('resetConfirmInput').value = '';
    document.getElementById('resetModal').classList.remove('hidden');
}

/**
 * Sıfırlama modalını kapatır
 */
function closeResetModal() {
    document.getElementById('resetModal').classList.add('hidden');
}

/**
 * Ay sonu sıfırlama işlemini gerçekleştirir
 * 1. Mevcut verileri arşive taşır
 * 2. Birinci sınıfa yıllık yıldız ekler
 * 3. Aylık özetleri siler
 */
async function executeMonthReset() {
    const confirmText = document.getElementById('resetConfirmInput').value.trim();
    
    if (confirmText !== 'ARŞIVLE') {
        showToast('Lütfen onay kutusuna "ARŞIVLE" yazın.', 'warning');
        return;
    }
    
    if (leaderboardData.length === 0) {
        showToast('Arşivlenecek veri yok!', 'warning');
        return;
    }
    
    showLoading(true, 'Ay sonu işlemleri yapılıyor...');
    closeResetModal();
    
    try {
        const monthKey = getCurrentMonthKey();
        const winner = leaderboardData[0];
        
        // 1. Verileri arşive kaydet
        const archiveData = {
            monthKey: monthKey,
            monthName: formatMonthKey(monthKey),
            rankings: leaderboardData.map(item => ({
                classId: item.classId,
                avgScore: item.avgScore,
                totalScore: item.totalScore,
                voteCount: item.voteCount
            })),
            winner: {
                classId: winner.classId,
                avgScore: winner.avgScore,
                totalScore: winner.totalScore,
                voteCount: winner.voteCount
            },
            totalVotes: leaderboardData.reduce((sum, item) => sum + item.voteCount, 0),
            archivedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('archive').doc(monthKey).set(archiveData);
        
        // 2. Birinci sınıfa yıllık yıldız ekle
        const champRef = db.collection('yearlyChampions').doc(winner.classId);
        const champDoc = await champRef.get();
        
        if (champDoc.exists) {
            const champData = champDoc.data();
            await champRef.update({
                starCount: (champData.starCount || 0) + 1,
                months: firebase.firestore.FieldValue.arrayUnion(monthKey),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await champRef.set({
                classId: winner.classId,
                starCount: 1,
                months: [monthKey],
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // 3. Aylık özetleri sil (yeni ay için temizle)
        const summarySnapshot = await db.collection('monthlySummaries')
            .where('monthKey', '==', monthKey)
            .get();
        
        const batch = db.batch();
        summarySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        // Verileri yenile
        await refreshData();
        
        showLoading(false);
        showToast(`${formatMonthKey(monthKey)} arşivlendi! 🏆 Şampiyon: ${winner.classId}`, 'success', 5000);
        
    } catch (error) {
        showLoading(false);
        console.error('Ay sonu sıfırlama hatası:', error);
        showToast('Arşivleme sırasında bir hata oluştu!', 'error');
    }
}

// ============================================
// QR KOD BAĞLANTILARI
// ============================================

/**
 * Her sınıf için QR kod bağlantılarını oluşturur
 */
function generateQRLinks() {
    const domain = document.getElementById('domainInput').value.trim();
    
    if (!domain) {
        showToast('Lütfen sitenizin adresini girin.', 'warning');
        return;
    }
    
    // Sonundaki slash'ı kaldır
    const baseDomain = domain.replace(/\/+$/, '');
    
    const container = document.getElementById('qrLinksContainer');
    container.innerHTML = `
        <div style="background:var(--bg); padding:16px; border-radius:var(--radius-sm); margin-bottom:12px;">
            <strong>📱 Sınıf QR Kod Bağlantıları</strong>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">
                Bu bağlantıları kopyalayıp herhangi bir QR kod oluşturucu sitede 
                (ör: <a href="https://www.qr-code-generator.com" target="_blank">qr-code-generator.com</a>) 
                karekoda çevirebilirsiniz.
            </p>
        </div>
    `;
    
    APP_CONFIG.classes.forEach(cls => {
        const url = `${baseDomain}/oyla.html?sinif=${encodeURIComponent(cls)}`;
        
        const linkItem = document.createElement('div');
        linkItem.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px 16px; background:white; border-radius:8px; margin-bottom:6px; border:1px solid var(--border-light);';
        linkItem.innerHTML = `
            <strong style="min-width:50px; color:var(--primary);">${cls}</strong>
            <input type="text" value="${url}" readonly 
                style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:0.8rem; font-family:monospace; background:var(--bg);"
                onclick="this.select()">
            <button class="btn btn-sm btn-primary" onclick="copyToClipboard('${url}', this)">📋 Kopyala</button>
        `;
        container.appendChild(linkItem);
    });
}

/**
 * Metni panoya kopyalar
 */
function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Kopyalandı';
        btn.style.background = 'var(--accent)';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    }).catch(() => {
        showToast('Kopyalama başarısız. Elle kopyalayın.', 'warning');
    });
}

// ==========================================
// KAREKOD (QR) OLUŞTURMA VE YAZDIRMA
// ==========================================
function generateAllQRCodes() {
    const printArea = document.getElementById('printArea');
    const printBtn = document.getElementById('printQrBtn');
    
    if (!APP_CONFIG.classes || APP_CONFIG.classes.length === 0) {
        showToast("Sınıf listesi boş! Lütfen önce Ayarlar sekmesinden sınıflarınızı ekleyin.", "warning");
        return;
    }
    
    // Temizle
    printArea.innerHTML = '';
    
    // Vercel linkiniz (Sitenizin kök adresi)
    const baseUrl = window.location.origin;
    
    APP_CONFIG.classes.forEach(sinif => {
        const qrUrl = `${baseUrl}/oyla.html?sinif=${encodeURIComponent(sinif)}`;
        
        // Etiket Konteyneri
        const labelDiv = document.createElement('div');
        labelDiv.className = 'qr-label';
        
        // Sınıf Başlığı
        const title = document.createElement('h3');
        title.textContent = sinif;
        labelDiv.appendChild(title);
        
        // QR Kod Alanı
        const qrDiv = document.createElement('div');
        qrDiv.className = 'qr-code-img';
        labelDiv.appendChild(qrDiv);
        
        // Alt Bilgi
        const footer = document.createElement('div');
        footer.className = 'qr-footer';
        footer.textContent = "Okut ve Oyla";
        labelDiv.appendChild(footer);
        
        printArea.appendChild(labelDiv);
        
        // QR Kodu Çizdir
        new QRCode(qrDiv, {
            text: qrUrl,
            width: 180,
            height: 180,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    });
    
    // Yazdır butonunu göster
    printBtn.classList.remove('hidden');
    showToast("Karekodlar oluşturuldu! Yazdır butonuna basabilirsiniz.", "success");
}



// ==========================================
// SINIF İSTATİSTİK DETAYLARI
// ==========================================
async function showClassDetails(classId) {
    const modal = document.getElementById('classDetailsModal');
    const title = document.getElementById('cdModalTitle');
    const subtitle = document.getElementById('cdModalSubtitle');
    const content = document.getElementById('cdModalContent');
    
    title.textContent = `${classId} Sınıfı İstatistikleri`;
    subtitle.textContent = "Veriler yükleniyor...";
    content.innerHTML = '<div class="spinner" style="margin: 0 auto;"></div>';
    modal.classList.remove('hidden');
    
    const monthKey = document.getElementById('monthSelector').value;
    
    try {
        const snapshot = await db.collection('votes')
            .where('monthKey', '==', monthKey)
            .where('classId', '==', classId)
            .get();
            
        if(snapshot.empty) {
            content.innerHTML = '<p>Bu ay hiç oy alınmamış.</p>';
            subtitle.textContent = "";
            return;
        }
        
        let totals = {};
        let counts = {};
        let totalVotes = 0;
        
        APP_CONFIG.criteria.forEach(c => {
            totals[c.id] = 0;
            counts[c.id] = 0;
        });
        
        snapshot.forEach(doc => {
            const data = doc.data();
            totalVotes++;
            for(const [critId, stars] of Object.entries(data.ratings)) {
                if(totals[critId] !== undefined) {
                    totals[critId] += stars;
                    counts[critId]++;
                }
            }
        });
        
        subtitle.textContent = `Bu ay toplam ${totalVotes} öğretmen oy vermiş.`;
        
        let html = '';
        APP_CONFIG.criteria.forEach(c => {
            const avg = counts[c.id] > 0 ? (totals[c.id] / counts[c.id]).toFixed(1) : 0;
            const percent = (avg / 5) * 100;
            const color = avg >= 4 ? 'var(--success)' : avg >= 2.5 ? 'var(--warning)' : 'var(--danger)';
            
            html += `
                <div style="background:var(--bg); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <strong>${c.icon} ${c.title}</strong>
                        <span style="font-weight:700; color:${color};">⭐ ${avg} / 5</span>
                    </div>
                    <div style="width:100%; height:12px; background:rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
                        <div style="width:${percent}%; height:100%; background:${color}; border-radius:6px;"></div>
                    </div>
                </div>
            `;
        });
        content.innerHTML = html;
        
    } catch(e) {
        console.error(e);
        content.innerHTML = '<p style="color:red;">Veriler yüklenirken hata oluştu.</p>';
    }
}

// ==========================================
// AYARLAR (SETTINGS) YÖNETİMİ YENİ SİSTEM
// ==========================================
let editingClasses = [];
let editingCriteria = [];

function populateSettingsUI() {
    if(!document.getElementById('settingSchoolName')) return;
    
    document.getElementById('settingSchoolName').value = APP_CONFIG.schoolName;
    document.getElementById('settingAdminPassword').value = APP_CONFIG.adminPassword;
    
    editingClasses = [...APP_CONFIG.classes];
    editingCriteria = JSON.parse(JSON.stringify(APP_CONFIG.criteria));
    
    renderSettingClasses();
    renderSettingCriteria();
}

function renderSettingClasses() {
    const container = document.getElementById('settingClassesContainer');
    container.innerHTML = editingClasses.map((c, i) => `
        <div class="class-tag">
            <span onclick="editSettingClass(${i})" title="İsmi değiştirmek için tıklayın">${c}</span>
            <i class="fas fa-times" title="Sil" onclick="removeSettingClass(${i})"></i>
        </div>
    `).join('');
}

function editSettingClass(index) {
    const currentName = editingClasses[index];
    const newName = window.prompt("Sınıfın yeni adını girin:", currentName);
    if (newName !== null && newName.trim() !== '') {
        editingClasses[index] = newName.trim(); // Buyuk/Kucuk harf karisik yazabilmeleri icin uppercase'i kaldirdik.
        renderSettingClasses();
    }
}

function addSettingClass() {
    const inp = document.getElementById('newClassInput');
    const val = inp.value.trim();
    if(val && !editingClasses.includes(val)) {
        editingClasses.push(val);
        inp.value = '';
        renderSettingClasses();
    }
}

function removeSettingClass(index) {
    editingClasses.splice(index, 1);
    renderSettingClasses();
}

function renderSettingCriteria() {
    const container = document.getElementById('settingCriteriaContainer');
    container.innerHTML = editingCriteria.map((c, i) => `
        <div style="background:#fff; border:1px solid var(--border); padding:12px; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:700; font-size:0.95rem;">${c.icon || '📌'} ${c.title}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">${c.description}</div>
            </div>
            <button class="btn btn-sm btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="removeSettingCriterion(${i})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function addSettingCriterion() {
    const tInp = document.getElementById('newCritTitle');
    const dInp = document.getElementById('newCritDesc');
    const title = tInp.value.trim();
    const desc = dInp.value.trim();
    
    if(!title || !desc) {
        showToast("Lütfen başlık ve açıklama girin", "warning");
        return;
    }
    
    editingCriteria.push({
        id: "crit_" + Date.now(),
        title: title,
        description: desc,
        icon: "📌",
        goal: ""
    });
    
    tInp.value = '';
    dInp.value = '';
    renderSettingCriteria();
}

function removeSettingCriterion(index) {
    if(editingCriteria.length <= 1) {
        showToast("En az 1 kriter kalmalıdır!", "error");
        return;
    }
    editingCriteria.splice(index, 1);
    renderSettingCriteria();
}

async function saveSettings() {
    const newSchoolName = document.getElementById('settingSchoolName').value.trim();
    const newPassword = document.getElementById('settingAdminPassword').value.trim();
    
    if(!newSchoolName || !newPassword || editingClasses.length === 0 || editingCriteria.length === 0) {
        showToast("Okul adı, şifre, sınıflar veya kriterler boş olamaz!", "error");
        return;
    }
    
    showLoading(true, "Ayarlar kaydediliyor...");
    try {
        await db.collection('settings').doc('general').set({
            schoolName: newSchoolName,
            adminPassword: newPassword,
            classes: editingClasses,
            criteria: editingCriteria
        }, {merge: true});
        
        APP_CONFIG.schoolName = newSchoolName;
        APP_CONFIG.adminPassword = newPassword;
        APP_CONFIG.classes = [...editingClasses];
        APP_CONFIG.criteria = JSON.parse(JSON.stringify(editingCriteria));
        
        showToast("Tüm ayarlar başarıyla kaydedildi! Sitemiz yenileniyor...", "success");
        setTimeout(() => window.location.reload(), 1500);
    } catch(e) {
        console.error(e);
        showToast("Hata oluştu.", "error");
    }
    showLoading(false);
}


// Ayarlar içi menü geçişi
function switchSettingsSection(sectionId, btn) {
    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById('set-' + sectionId).classList.add('active');
    if(btn) btn.classList.add('active');
}


// ============================================
// ÖĞRETMEN DÜZENLEME
// ============================================
async function editTeacher(teacherId, oldName, oldBranch, oldPin) {
    const newName = window.prompt("Öğretmen Adı Soyadı:", oldName);
    if(newName === null) return;
    
    const newBranch = window.prompt("Branşı:", oldBranch);
    if(newBranch === null) return;
    
    const newPin = window.prompt("Giriş Şifresi (PIN):", oldPin);
    if(newPin === null) return;
    
    if(newName.trim() === '' || newPin.trim() === '') {
        showToast("İsim ve PIN boş olamaz!", "warning");
        return;
    }
    
    showLoading(true, "Güncelleniyor...");
    try {
        await db.collection('teachers').doc(teacherId).update({
            name: newName.trim(),
            branch: newBranch.trim(),
            pin: newPin.trim()
        });
        showToast("Öğretmen başarıyla güncellendi.", "success");
        await loadTeachers();
    } catch(e) {
        console.error(e);
        showToast("Güncelleme başarısız oldu.", "error");
    }
    showLoading(false);
}


// ============================================
// MEBBİS EXCEL İLE TOPLU ÖĞRETMEN EKLEME
// ============================================
async function handleMebbisExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(true, "Excel dosyası tamamen tarayıcınızda (güvenli) işleniyor...");
    
    try {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                // XLSX kütüphanesi ile oku (tarayıcı içi)
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheet = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheet];
                
                // Verileri 2 boyutlu dizi olarak al
                const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
                
                let addedCount = 0;
                let batch = db.batch(); // Toplu ekleme için
                let operationCount = 0;
                
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length < 2) continue;
                    
                    // Satırdaki TC Kimlik numarasını bul (11 haneli rakam)
                    let tcIndex = -1;
                    let tcValue = "";
                    
                    for (let j = 0; j < row.length; j++) {
                        const cellStr = String(row[j] || '').replace(/\s/g, '');
                        if (cellStr.length === 11 && /^\d{11}$/.test(cellStr)) {
                            tcIndex = j;
                            tcValue = cellStr;
                            break;
                        }
                    }
                    
                    if (tcIndex !== -1) {
                        // TC bulundu. MEBBIS listelerinde genelde TC'nin sağı Ad Soyad, onun sağı veya 2 sağı Branştır.
                        // Basit bir tahmin algoritması:
                        let name = String(row[tcIndex + 1] || '').trim();
                        let branch = String(row[tcIndex + 2] || '').trim();
                        let pin = tcValue.substring(0, 6); // TC İlk 6 hane
                        
                        // İsim aşırı kısaysa veya boşsa, belki TC sağında değil solundadır
                        if (name.length < 3 && tcIndex > 0) {
                            name = String(row[tcIndex - 1] || '').trim();
                        }
                        
                        if (name && name.length > 2) {
                            // Yeni döküman oluştur
                            const docRef = db.collection('teachers').doc();
                            batch.set(docRef, {
                                name: name,
                                branch: branch,
                                pin: pin,
                                active: true,
                                addedVia: 'excel'
                            });
                            
                            addedCount++;
                            operationCount++;
                            
                            // Firestore batch limit is 500. Commit if approaching limit.
                            if (operationCount >= 450) {
                                await batch.commit();
                                batch = db.batch(); // Yeni batch başlat
                                operationCount = 0;
                            }
                        }
                    }
                }
                
                // Kalanları commit et
                if (operationCount > 0) {
                    await batch.commit();
                }
                
                // Güvenlik: Dosya hafızadan silinsin (input temizle)
                event.target.value = '';
                
                showLoading(false);
                if (addedCount > 0) {
                    showToast(`Başarılı! ${addedCount} öğretmen güvenle sisteme eklendi.`, "success");
                    await loadTeachers();
                    await loadTeacherCount();
                } else {
                    showToast("Dosyada geçerli T.C. Kimlik Numarası (11 haneli) bulunamadı. Sütunları kontrol edin.", "warning");
                }
                
            } catch(err) {
                console.error(err);
                showLoading(false);
                event.target.value = '';
                showToast("Excel dosyası okunurken hata oluştu.", "error");
            }
        };
        
        reader.readAsArrayBuffer(file);
        
    } catch(err) {
        console.error(err);
        showLoading(false);
        event.target.value = '';
        showToast("İşlem sırasında hata oluştu.", "error");
    }
}

// ============================================
// MEBBİS TOPLU ÖĞRETMEN EKLEME (EXCEL & PDF)
// ============================================
async function handleMebbisExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(true, "Dosya güvenli bir şekilde tarayıcınızda işleniyor...");
    
    try {
        let fullText = "";
        
        if (file.name.toLowerCase().endsWith('.pdf')) {
            // PDF.js ile oku
            const arrayBuffer = await file.arrayBuffer();
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(s => s.str).join(' ') + ' ';
            }
        } else {
            // XLSX ile Excel oku
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            
            const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            for (const row of rows) {
                fullText += row.join(' ') + ' ';
            }
        }
        
        // Temizlik: Bazen MEBBIS dosyalarında boşluklar veya gereksiz karakterler olur
        fullText = fullText.replace(/\s+/g, ' ');
        
        // Düzenli ifade (Regex) ile isim ve 11 haneli T.C.'yi yakala
        // Format: AD SOYAD (12345678901)
        const regex = /([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü\s]+?)\s*\((\d{11})\)/g;
        let match;
        const teachersToAdd = [];
        
        while ((match = regex.exec(fullText)) !== null) {
            let name = match[1].trim();
            const tc = match[2];
            const pin = tc.substring(0, 6);
            
            // "ÖĞRENİM DURUMU" veya "Uzman Öğretmen" gibi başlıklar isme yapışmışsa temizle
            name = name.replace(/ÖĞRENİM DURUMU/gi, '').replace(/Uzman Öğretmen/gi, '').replace(/Başöğretmen/gi, '').trim();
            if (name.length < 3) continue;
            
            // Branş tespiti için ismin geçtiği yerden sonraki kısımlara bakalım (isteğe bağlı, genel branş atayalım bulamazsak)
            // MEBBİS PDF'lerinde genelde branşlar Lisans veya Yüksek Lisans'tan sonra gelir.
            // Fakat metin karmaşık olabileceği için temel branşı 'Branş Belirtilmemiş' yapıp, 
            // idarecinin listeden düzenlemesine olanak tanımak en güvenlisidir. 
            // (Karmaşık Regex ile branş bulmaya çalışmak bazı öğretmenleri atlamaya sebep olabilir)
            
            let branch = "";
            const textAfter = fullText.substring(match.index + match[0].length, match.index + match[0].length + 200);
            const branchMatch = textAfter.match(/(?:Lisans|Lisansüstü|TEZLİ|TEZSİZ|Ön Lisans).*?\s([A-Za-zÇĞİÖŞÜçğıöşü\s]+?)\s*\//);
            if (branchMatch && branchMatch[1]) {
                branch = branchMatch[1].replace(/\)/g, '').trim();
                // Bazen öğretmen ibaresi de gelir
                if (branch.includes("Öğretmen")) branch = branch.replace(/Öğretmen(i|liği|lik)?/gi, '').trim();
            }
            
            teachersToAdd.push({
                name: name,
                tc: tc,
                pin: pin,
                branch: branch || 'Belirtilmemiş'
            });
        }
        
        if (teachersToAdd.length > 0) {
            let addedCount = 0;
            let batch = db.batch();
            let opCount = 0;
            
            for (const t of teachersToAdd) {
                const docRef = db.collection('teachers').doc();
                batch.set(docRef, {
                    name: t.name,
                    branch: t.branch,
                    pin: t.pin,
                    active: true,
                    addedVia: 'bulk_import'
                });
                addedCount++;
                opCount++;
                
                if (opCount >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    opCount = 0;
                }
            }
            
            if (opCount > 0) {
                await batch.commit();
            }
            
            showToast(`Başarılı! ${addedCount} öğretmen (PDF/Excel'den) eklendi.`, "success");
            await loadTeachers();
            await loadTeacherCount();
        } else {
            showToast("Dosyada geçerli T.C. Kimlik formatı (Örn: AD SOYAD (12345678901)) bulunamadı.", "warning");
        }
        
        event.target.value = '';
        showLoading(false);
        
    } catch(err) {
        console.error(err);
        showLoading(false);
        event.target.value = '';
        showToast("Dosya okunurken bir hata oluştu. PDF formatı desteklenmiyor olabilir.", "error");
    }
}