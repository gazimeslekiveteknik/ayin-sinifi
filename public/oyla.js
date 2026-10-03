// ============================================
// AYIN SINIFI - OYLAMA SAYFASI MANTIK DOSYASI
// oyla.js
// ============================================

// ---------- Durum Değişkenleri ----------
let currentClassId = null;     // Geçerli sınıf (URL'den alınır)
let currentTeacher = null;     // Giriş yapan öğretmen bilgisi
let ratings = {};              // Kriter puanlamaları {criteriaId: puan}

// ============================================
// SAYFA BAŞLANGIÇ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

/**
 * Uygulamayı başlatır
 * 1. URL'den sınıf parametresini okur
 * 2. Oturum kontrolü yapar
 * 3. Uygun ekranı gösterir
 */
function initApp() {
    // Okul adını ayarla
    document.getElementById('schoolName').textContent = APP_CONFIG.schoolName;
    
    // URL'den sınıf parametresini al
    const urlParams = new URLSearchParams(window.location.search);
    const sinif = urlParams.get('sinif');
    
    if (!sinif) {
        // Sınıf parametresi yoksa hata göster
        showScreen('errorScreen');
        return;
    }
    
    // Sınıf geçerli mi kontrol et
    if (!APP_CONFIG.classes.includes(sinif)) {
        document.getElementById('errorMessage').textContent = 
            `"${sinif}" geçerli bir sınıf değil. Lütfen doğru QR kodu okutunuz.`;
        showScreen('errorScreen');
        return;
    }
    
    currentClassId = sinif;
    document.getElementById('classBadge').textContent = `📍 ${sinif}`;
    
    // Oturum kontrolü: Daha önce giriş yapılmış mı?
    checkSession();
}

// ============================================
// OTURUM YÖNETİMİ
// ============================================

/**
 * SessionStorage'dan oturum bilgisini kontrol eder
 */
function checkSession() {
    const sessionData = sessionStorage.getItem('teacherSession');
    
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            // Oturum bugüne ait mi kontrol et
            if (session.dateKey === getTodayKey() && session.teacherId && session.teacherName) {
                currentTeacher = session;
                onTeacherVerified();
                return;
            }
        } catch (e) {
            // Geçersiz oturum verisi, temizle
            sessionStorage.removeItem('teacherSession');
        }
    }
    
    // Oturum yoksa giriş ekranını göster
    showScreen('loginScreen');
    setupPinInputs();
}

/**
 * Oturum bilgisini SessionStorage'a kaydeder
 */
function saveSession(teacherData) {
    const session = {
        teacherId: teacherData.id,
        teacherName: teacherData.name,
        pin: teacherData.pin,
        dateKey: getTodayKey()
    };
    sessionStorage.setItem('teacherSession', JSON.stringify(session));
    currentTeacher = session;
}

/**
 * Çıkış yapar - oturum bilgisini temizler
 */
function logout() {
    sessionStorage.removeItem('teacherSession');
    currentTeacher = null;
    ratings = {};
    window.location.reload();
}

// ============================================
// PIN GİRİŞ SİSTEMİ
// ============================================

/**
 * PIN giriş kutucuklarını yapılandırır
 * Her kutucuğa girilen rakamdan sonra otomatik sonrakine geçer
 */
function setupPinInputs() {
    const inputs = document.querySelectorAll('.pin-input');
    
    inputs.forEach((input, index) => {
        // Rakam girildiğinde sonraki kutucuğa geç
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Sadece tek rakam kabul et
            if (value.length > 1) {
                e.target.value = value.slice(-1);
            }
            
            // Sonraki kutucuğa geç
            if (value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
            
            // Son kutucuk dolduğunda otomatik doğrula
            if (index === inputs.length - 1 && value) {
                verifyPIN();
            }
        });
        
        // Backspace ile önceki kutucuğa dön
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
                inputs[index - 1].value = '';
            }
        });
        
        // Yapıştırma desteği
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text').trim();
            const digits = pastedData.replace(/\D/g, '').split('');
            
            digits.forEach((digit, i) => {
                if (inputs[index + i]) {
                    inputs[index + i].value = digit;
                }
            });
            
            // Son doldurulana odaklan
            const lastIndex = Math.min(index + digits.length - 1, inputs.length - 1);
            inputs[lastIndex].focus();
            
            if (index + digits.length >= inputs.length) {
                verifyPIN();
            }
        });
    });
    
    // İlk kutucuğa odaklan
    setTimeout(() => inputs[0].focus(), 300);
}

/**
 * Girilen PIN'i veritabanından doğrular
 */
async function verifyPIN() {
    const inputs = document.querySelectorAll('.pin-input');
    let pin = '';
    inputs.forEach(input => pin += input.value);
    
    // 6 haneli mi kontrol et
    if (pin.length !== 6) {
        showToast('Lütfen 6 haneli PIN kodunuzu girin.', 'warning');
        return;
    }
    
    showLoading(true, 'Doğrulanıyor...');
    
    try {
        // Firestore'da öğretmen PIN'ini ara
        const snapshot = await db.collection('teachers')
            .where('pin', '==', pin)
            .where('active', '==', true)
            .get();
        
        if (snapshot.empty) {
            showLoading(false);
            showToast('Geçersiz PIN kodu! Lütfen tekrar deneyin.', 'error');
            // PIN kutucuklarını temizle
            inputs.forEach(input => input.value = '');
            inputs[0].focus();
            return;
        }
        
        // Öğretmen bulundu
        const teacherDoc = snapshot.docs[0];
        const teacherData = {
            id: teacherDoc.id,
            name: teacherDoc.data().name,
            pin: pin
        };
        
        // Oturumu kaydet
        saveSession(teacherData);
        
        showLoading(false);
        showToast(`Hoş geldiniz, ${teacherData.name}!`, 'success');
        
        // Oylama ekranına geç
        onTeacherVerified();
        
    } catch (error) {
        showLoading(false);
        console.error('PIN doğrulama hatası:', error);
        showToast('Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
    }
}

// ============================================
// OYLAMA SİSTEMİ
// ============================================

/**
 * Öğretmen doğrulandıktan sonra çağrılır
 * Mükerrer oy kontrolü yapar, sonra oylama ekranını hazırlar
 */
async function onTeacherVerified() {
    document.getElementById('teacherNameDisplay').textContent = currentTeacher.teacherName;
    
    showLoading(true, 'Kontrol ediliyor...');
    
    try {
        // Mükerrer oy kontrolü
        const isDuplicate = await checkDuplicateVote();
        
        if (isDuplicate) {
            showLoading(false);
            showScreen('duplicateScreen');
            return;
        }
        
        // Kriter kartlarını oluştur
        buildCriteriaCards();
        
        showLoading(false);
        showScreen('votingScreen');
        
    } catch (error) {
        showLoading(false);
        console.error('Doğrulama sonrası hata:', error);
        showToast('Bir hata oluştu.', 'error');
    }
}

/**
 * Aynı öğretmen, aynı sınıfa aynı gün oy vermiş mi kontrol eder
 * @returns {boolean} true: mükerrer oy var, false: oy verilebilir
 */
async function checkDuplicateVote() {
    const todayKey = getTodayKey();
    
    const snapshot = await db.collection('votes')
        .where('teacherId', '==', currentTeacher.teacherId)
        .where('classId', '==', currentClassId)
        .where('dateKey', '==', todayKey)
        .get();
    
    return !snapshot.empty;
}

/**
 * Değerlendirme kriter kartlarını dinamik olarak oluşturur
 */
function buildCriteriaCards() {
    const container = document.getElementById('criteriaContainer');
    container.innerHTML = '';
    
    APP_CONFIG.criteria.forEach(criteria => {
        // Her kriter için başlangıç puanı 0
        ratings[criteria.id] = 0;
        
        const card = document.createElement('div');
        card.className = 'criteria-card';
        card.id = `card-${criteria.id}`;
        
        card.innerHTML = `
            <div class="criteria-header">
                <div class="criteria-icon">${criteria.icon}</div>
                <div class="criteria-info">
                    <h3>${criteria.title}</h3>
                    <div class="criteria-desc">${criteria.description}</div>
                    <div class="criteria-goal">🎯 Hedef: ${criteria.goal}</div>
                </div>
            </div>
            <div class="star-rating" id="stars-${criteria.id}">
                ${buildStars(criteria.id)}
            </div>
            <div class="rating-label" id="label-${criteria.id}">Puanlama bekleniyor...</div>
        `;
        
        container.appendChild(card);
    });
}

/**
 * 5 yıldızlık puanlama HTML'i oluşturur
 * @param {string} criteriaId - Kriter kimliği
 * @returns {string} HTML string
 */
function buildStars(criteriaId) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star" data-criteria="${criteriaId}" data-value="${i}" 
                    onclick="setRating('${criteriaId}', ${i})"
                    onmouseenter="hoverStars('${criteriaId}', ${i})"
                    onmouseleave="unhoverStars('${criteriaId}')">★</span>`;
    }
    return html;
}

/**
 * Yıldız puanını ayarlar
 * @param {string} criteriaId - Kriter kimliği
 * @param {number} value - Puan değeri (1-5)
 */
function setRating(criteriaId, value) {
    ratings[criteriaId] = value;
    
    // Yıldızları güncelle
    const stars = document.querySelectorAll(`#stars-${criteriaId} .star`);
    stars.forEach(star => {
        const starValue = parseInt(star.dataset.value);
        star.classList.toggle('active', starValue <= value);
    });
    
    // Etiketi güncelle
    const label = document.getElementById(`label-${criteriaId}`);
    label.textContent = APP_CONFIG.starLabels[value];
    label.style.color = value >= 4 ? 'var(--accent)' : value >= 3 ? 'var(--warning)' : 'var(--danger)';
    
    // Kartı "puanlandı" olarak işaretle
    const card = document.getElementById(`card-${criteriaId}`);
    card.classList.add('rated');
    
    // Dokunma geri bildirimi (mobil titreşim)
    if (navigator.vibrate) {
        navigator.vibrate(30);
    }
}

/**
 * Yıldızlar üzerinde hover efekti (masaüstü)
 */
function hoverStars(criteriaId, value) {
    const stars = document.querySelectorAll(`#stars-${criteriaId} .star`);
    stars.forEach(star => {
        const starValue = parseInt(star.dataset.value);
        star.classList.toggle('hover', starValue <= value);
    });
}

/**
 * Hover efektini kaldır
 */
function unhoverStars(criteriaId) {
    const stars = document.querySelectorAll(`#stars-${criteriaId} .star`);
    stars.forEach(star => star.classList.remove('hover'));
}

// ============================================
// OY GÖNDERME
// ============================================

/**
 * Oylamayı tamamlar ve Firestore'a kaydeder
 */
async function submitVote() {
    // Tüm kriterler puanlandı mı kontrol et
    const unrated = APP_CONFIG.criteria.filter(c => ratings[c.id] === 0);
    
    if (unrated.length > 0) {
        showToast(`Lütfen tüm kriterleri puanlayın. ${unrated.length} kriter eksik.`, 'warning', 4000);
        
        // İlk eksik kritere kaydır
        const firstUnrated = document.getElementById(`card-${unrated[0].id}`);
        firstUnrated.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstUnrated.style.animation = 'shake 0.5s ease';
        setTimeout(() => firstUnrated.style.animation = '', 500);
        return;
    }
    
    // Gönder butonunu devre dışı bırak
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Kaydediliyor...';
    
    showLoading(true, 'Oylamanız kaydediliyor...');
    
    try {
        const monthKey = getCurrentMonthKey();
        const dateKey = getTodayKey();
        const comment = document.getElementById('teacherComment').value.trim();
        
        // Toplam puanı hesapla
        const totalScore = Object.values(ratings).reduce((sum, val) => sum + val, 0);
        const avgScore = totalScore / APP_CONFIG.criteria.length;
        
        // Firestore'a oyu kaydet
        const voteData = {
            classId: currentClassId,
            teacherId: currentTeacher.teacherId,
            teacherName: currentTeacher.teacherName,
            monthKey: monthKey,
            dateKey: dateKey,
            ratings: { ...ratings },
            totalScore: totalScore,
            avgScore: parseFloat(avgScore.toFixed(2)),
            comment: comment || null,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('votes').add(voteData);
        
        // Aylık özet belgesini güncelle
        await updateMonthlySummary(monthKey, currentClassId, totalScore, avgScore);
        
        showLoading(false);
        showScreen('successScreen');
        showToast('Değerlendirmeniz başarıyla kaydedildi!', 'success');
        
    } catch (error) {
        showLoading(false);
        console.error('Oy kaydetme hatası:', error);
        showToast('Oy kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '✅ Oylamayı Tamamla';
    }
}

/**
 * Aylık özet belgesini günceller (veya oluşturur)
 * Bu belge leaderboard için kullanılır
 */
async function updateMonthlySummary(monthKey, classId, totalScore, avgScore) {
    const summaryRef = db.collection('monthlySummaries').doc(`${monthKey}_${classId}`);
    
    try {
        const doc = await summaryRef.get();
        
        if (doc.exists) {
            // Mevcut özeti güncelle
            const data = doc.data();
            const newVoteCount = (data.voteCount || 0) + 1;
            const newTotalScore = (data.totalScore || 0) + totalScore;
            const newAvgScore = newTotalScore / (newVoteCount * APP_CONFIG.criteria.length);
            
            await summaryRef.update({
                voteCount: newVoteCount,
                totalScore: newTotalScore,
                avgScore: parseFloat(newAvgScore.toFixed(2)),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Yeni özet oluştur
            await summaryRef.set({
                classId: classId,
                monthKey: monthKey,
                voteCount: 1,
                totalScore: totalScore,
                avgScore: parseFloat(avgScore.toFixed(2)),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error('Aylık özet güncelleme hatası:', error);
        // Kritik olmayan hata, oyu engelleme
    }
}

// ============================================
// EKRAN YÖNETİMİ
// ============================================

/**
 * Belirtilen ekranı gösterir, diğerlerini gizler
 * @param {string} screenId - Gösterilecek ekranın ID'si
 */
function showScreen(screenId) {
    const screens = ['errorScreen', 'loginScreen', 'votingScreen', 'successScreen', 'duplicateScreen'];
    
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle('hidden', id !== screenId);
        }
    });
    
    // Yükleme ekranını gizle
    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.classList.add('hidden');
}

// ============================================
// CSS ANİMASYON EKLEMESİ (Shake efekti)
// ============================================
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-8px); }
        75% { transform: translateX(8px); }
    }
`;
document.head.appendChild(shakeStyle);
