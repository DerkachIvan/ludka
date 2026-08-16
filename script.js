const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const spinSound = document.getElementById('spinSound');
const percentButtons = document.querySelectorAll('.percent-btn');
const promoTrigger = document.getElementById('promoTrigger');
const promoModal = document.getElementById('promoModal');
const promoClose = document.getElementById('promoClose');
const promoInput = document.getElementById('promoInput');
const promoBtn = document.getElementById('promoBtn');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.querySelector('.clear-history');
const addMoneyBtn = document.getElementById('addMoneyBtn');
const leftChance = document.getElementById('leftChance');
const leftPrize = document.getElementById('leftPrize');
const leftRisk = document.getElementById('leftRisk');

ctx.translate(canvas.width / 2, canvas.height / 2);

// Initialize clicking sound using Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let clickIntervalId = null;
let isPlayingClicks = false;
let lastClickTime = 0;

function playClick() {
    const now = audioContext.currentTime;
    const buffer = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    // Create a white noise buffer for the click
    const bufferSize = audioContext.sampleRate * 0.05; // 50ms
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    buffer.buffer = noiseBuffer;
    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    buffer.connect(gainNode);
    gainNode.connect(audioContext.destination);
    buffer.start(now);
}

function getClickInterval() {
    // Calculate the progress of the spin (0 to 1)
    const elapsed = performance.now() - spinStartTime;
    const progress = Math.min(elapsed / spinDuration, 1);
    
    // Start fast (50ms) and end slow (250ms)
    const minInterval = 50;
    const maxInterval = 350;
    const easeProgress = Math.pow(progress, 0.8); // Ease function for smoother transition
    const currentInterval = minInterval + (maxInterval - minInterval) * easeProgress;
    
    return currentInterval;
}

function createSpinSound() {
    if (isPlayingClicks) return;
    
    isPlayingClicks = true;
    lastClickTime = performance.now();
    
    const updateClicks = () => {
        if (!isPlayingClicks || !isSpinning) {
            isPlayingClicks = false;
            return;
        }
        
        const now = performance.now();
        const interval = getClickInterval();
        
        if (now - lastClickTime >= interval) {
            playClick();
            lastClickTime = now;
        }
        
        requestAnimationFrame(updateClicks);
    };
    
    requestAnimationFrame(updateClicks);
}

function stopSpinSound() {
    isPlayingClicks = false;
    if (clickIntervalId) {
        clearInterval(clickIntervalId);
        clickIntervalId = null;
    }
}

const STORAGE_KEYS = {
    money: 'ludka_money',
    history: 'ludka_history'
};

let currentUserId = null; // Set when user logs in

const savedMoney = Number(localStorage.getItem(STORAGE_KEYS.money));
var money = Number.isFinite(savedMoney) ? savedMoney : 100;
let historyEntries = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]');

function saveMoney() {
    localStorage.setItem(STORAGE_KEYS.money, String(money));
    
    // Also save to Supabase if user is logged in
    if (currentUserId && typeof updateUserBalance === 'function') {
        updateUserBalance(currentUserId, money).catch(err => {
            console.error('Failed to save balance to Supabase:', err);
        });
    }
}

function saveHistory() {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(historyEntries));
}

async function saveHistoryEntry(betAmount, percent, result) {
    // Save locally
    saveHistory();
    
    // Save to Supabase if user is logged in
    if (currentUserId && typeof saveBetHistory === 'function') {
        const success = await saveBetHistory(currentUserId, betAmount, percent, result);
        if (!success) {
            console.error('Failed to save history to Supabase');
        }
    }
}

// Load user balance from Supabase
async function loadUserBalance(userId) {
    if (typeof getUserBalance !== 'function') return;
    
    currentUserId = userId;
    const balance = await getUserBalance(userId);
    
    if (balance !== null && balance !== undefined) {
        money = Number(balance);
        document.getElementById('money').textContent = `${money.toFixed(2)}$`;
    }
}

// Load user history from Supabase
async function loadUserHistory(userId) {
    if (typeof getUserBetHistory !== 'function') return;
    
    const history = await getUserBetHistory(userId, 6);
    
    if (history && history.length > 0) {
        historyEntries = history.map(entry => ({
            value: entry.bet_amount,
            percent: entry.percent,
            result: entry.result
        }));
        renderHistory();
    }
}

// Reset to local data when user logs out
function resetToLocalData() {
    currentUserId = null;
    const savedMoney = Number(localStorage.getItem(STORAGE_KEYS.money));
    money = Number.isFinite(savedMoney) ? savedMoney : 100;
    historyEntries = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]');
    
    document.getElementById('money').textContent = `${money.toFixed(2)}$`;
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = '';

    historyEntries.forEach(entry => {
        const item = document.createElement('li');
        item.className = `history-item ${entry.result === 'win' ? 'win' : 'loss'}`;
        item.innerHTML = `
            <div class="history-row">
                <span>Ставка</span>
                <span>${Number(entry.value).toFixed(2)}</span>
            </div>
            <div class="history-row">
                <span>Процент</span>
                <span>${Number(entry.percent).toFixed(0)}%</span>
            </div>
            <div class="history-row">
                <span class="history-badge">${entry.result === 'win' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}</span>
                <span></span>
            </div>
        `;
        historyList.appendChild(item);
    });
}

const radius = 200;
const triangleOffset = 40; // Offset for the triangle position
const triangleHeight = 70;
const triangleWidth = 12;

const gradient = ctx.createLinearGradient(0, -radius, 0, radius);
gradient.addColorStop(0, '#00ff00');
gradient.addColorStop(0.5, '#fffb00');
gradient.addColorStop(1, '#ff0000');

let currentAngle = 0;
let spinFromAngle = 0;
let spinToAngle = 0;
let spinStartTime = 0;
let spinDuration = 3000;
let isSpinning = false;
let winAnimationTimer = null;
let wheelGlow = 0;
let wheelGlowTimer = null;

function triggerWinAnimation() {
    const moneyPanel = document.querySelector('.money-panel');
    const particleContainer = document.getElementById('winParticles');
    if (!moneyPanel) return;

    moneyPanel.classList.remove('win-anim');
    void moneyPanel.offsetWidth;
    moneyPanel.classList.add('win-anim');

    if (particleContainer) {
        for (let i = 0; i < 34; i++) {
            const particle = document.createElement('span');
            particle.className = 'particle';
            const angle = (Math.PI * 2 * i) / 34 + (Math.random() - 0.5) * 0.9;
            const distance = 80 + Math.random() * 420;
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance;
            const hue = 42 + Math.random() * 70;

            particle.style.background = `hsla(${hue}, 90%, 65%, 1)`;
            particle.style.setProperty('--dx', `${dx}px`);
            particle.style.setProperty('--dy', `${dy}px`);
            particleContainer.appendChild(particle);

            setTimeout(() => particle.remove(), 950);
        }
    }

    wheelGlow = 1;
    clearTimeout(wheelGlowTimer);
    wheelGlowTimer = setTimeout(() => {
        wheelGlow = 0;
    }, 800);

    clearTimeout(winAnimationTimer);
    winAnimationTimer = setTimeout(() => {
        moneyPanel.classList.remove('win-anim');
    }, 700);
}

function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
}

function isAngleInRange(angle, start, end) {
    const a = normalizeAngle(angle);
    const s = normalizeAngle(start);
    const e = normalizeAngle(end);

    if (s <= e) {
        return a >= s && a <= e;
    }

    return a >= s || a <= e;
}

function onSpinEnd() {
    const p = Number(procent);
    const sectorSize = 360 * p;
    const startAngle = 90 - sectorSize / 2 + angleOffset;
    const endAngle = 90 + sectorSize / 2 + angleOffset;
    const pointerAngle = normalizeAngle(currentAngle);
    console.log(`Pointer angle: ${pointerAngle.toFixed(2)} degrees`);
    console.log('Стрелка остановилась');

    const bet = parseFloat(document.getElementById('betInput').value) || 0;

    if (isAngleInRange(pointerAngle, startAngle, endAngle)) {
        console.log('Вы выиграли!');
        const winChance = Number(procent);
        const winAmount = bet / winChance;
        money += winAmount;
        triggerWinAnimation();
        updateHistory(bet.toFixed(2), 'win');
    } else {
        console.log('Промах');
        updateHistory(bet.toFixed(2), 'loss');
    }

    saveMoney();
    document.body.classList.remove('spin-vignette');
    document.body.classList.add('spin-vignette-fadeout');
    setTimeout(() => {
        document.body.classList.remove('spin-vignette-fadeout');
    }, 800);
    stopSpinSound();
    setPercentButtonsDisabled(false);
    document.getElementById('money').textContent = `${money.toFixed(2)}$`;
    document.getElementById('betInput').disabled = false;
}

let procent = 0.25;
const angleOffset = 90;
const radOffset = angleOffset * (Math.PI / 180);

function updateLeftInfo() {
    const percentValue = Math.round(procent * 100);
    const prizeValue = Math.round((1 / procent) * 100);

    leftChance.textContent = `${percentValue}%`;
    leftPrize.textContent = `+${prizeValue}%`;

    leftRisk.classList.remove('risk-low', 'risk-medium', 'risk-high');

    if (percentValue < 25) {
        leftRisk.textContent = 'Высокий';
        leftRisk.classList.add('risk-high');
    } else if (percentValue <= 50) {
        leftRisk.textContent = 'Средний';
        leftRisk.classList.add('risk-medium');
    } else {
        leftRisk.textContent = 'Низкий';
        leftRisk.classList.add('risk-low');
    }
}

document.getElementById('money').textContent = `${money.toFixed(2)}$`;
renderHistory();
updateLeftInfo();

function setPercentButtonsDisabled(disabled) {
    percentButtons.forEach(button => {
        button.disabled = disabled;
        button.setAttribute('aria-disabled', String(disabled));
    });
}

percentButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (isSpinning || button.disabled) return;

        percentButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        procent = Number(button.dataset.percent);
        updateLeftInfo();
    });
});

function openPromoModal() {
    promoModal.classList.add('open');
    promoModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => promoInput.focus(), 50);
}

function closePromoModal() {
    promoModal.classList.remove('open');
    promoModal.setAttribute('aria-hidden', 'true');
    promoInput.value = '';
}

promoTrigger.addEventListener('click', openPromoModal);
promoClose.addEventListener('click', closePromoModal);
promoModal.addEventListener('click', (event) => {
    if (event.target === promoModal) {
        closePromoModal();
    }
});

promoBtn.addEventListener('click', () => {
    const enteredCode = promoInput.value.trim();

    if (enteredCode === 'qqwwqq') {
        money += 100;
        saveMoney();
        document.getElementById('money').textContent = `${money.toFixed(2)}$`;
        console.log('Промокод активирован: +100');
        closePromoModal();
    } else {
        console.log('Неверный промокод');
    }
});

function updateHistory(value, result) {
    const percent = Number(procent) * 100;
    const entry = {
        value: Number(value),
        percent: percent,
        result
    };

    historyEntries.unshift(entry);
    historyEntries = historyEntries;
    saveHistoryEntry(Number(value), percent, result);
    renderHistory();
}

clearHistoryBtn.addEventListener('click', async () => {
    historyEntries = [];
    saveHistory();
    renderHistory();
    
    // Clear from Supabase if user is logged in
    if (currentUserId && typeof clearBetHistory === 'function') {
        await clearBetHistory(currentUserId).catch(err => {
            console.error('Failed to clear history on Supabase:', err);
        });
    }
});

function drawArc() {
    ctx.clearRect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);

    const glowStrength = 14 * wheelGlow;
    ctx.shadowBlur = glowStrength;
    ctx.shadowColor = 'rgba(94, 230, 168, 0.7)';

    //drawTriangle(0, -radius - triangleOffset, 90 - (360 * (Number(procent))) / 2 + angleOffset)
    //drawTriangle(0, -radius - triangleOffset, 90 + (360 * (Number(procent))) / 2 + angleOffset)

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = 100;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    const p = Number(procent);
    const sectorSize = Math.PI * 2 * p;
    const start = radOffset - sectorSize / 2;
    const end = radOffset + sectorSize / 2;

    ctx.beginPath();
    ctx.arc(0, 0, radius, start, end);
    ctx.lineWidth = 90;
    ctx.strokeStyle = gradient;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    const text = `${Math.round(procent * 100)}%`;
    const metrics = ctx.measureText(text);
    const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

    ctx.font = "48px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, -metrics.width / 2, actualHeight / 2);

    spinBtn.disabled = isSpinning;
    if (isSpinning) {
        const now = performance.now();
        const elapsed = now - spinStartTime;
        const progress = Math.min(elapsed / spinDuration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        currentAngle = spinFromAngle + (spinToAngle - spinFromAngle) * easedProgress;

        if (progress >= 1) {
            currentAngle = spinToAngle;
            isSpinning = false;
            onSpinEnd();
        }
    }

    drawTriangle(0, -radius - triangleOffset, currentAngle);
}

function drawTriangle(x, y, angle) {
    const radians = (Math.PI*2) * (angle%360 / 360);
    ctx.save();
    ctx.rotate(radians);
    ctx.beginPath();
    ctx.moveTo(0 + x, 0 + y);
    ctx.lineTo(-triangleWidth + x, -triangleHeight + y);
    ctx.lineTo(0 + x, -triangleHeight + y * 0.9);
    ctx.lineTo(triangleWidth + x, -triangleHeight + y);
    ctx.closePath();
    ctx.fillStyle = "#ffbb00";
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(0 + x, 0 + y);
    ctx.lineTo(0 + x, -triangleHeight + y * 0.9);
    ctx.lineTo(triangleWidth + x, -triangleHeight + y);
    ctx.closePath();
    ctx.fillStyle = "#ff9900";
    ctx.fill();


    ctx.restore();
}

spinBtn.addEventListener('click', () => {
    const betInput = document.getElementById('betInput');
    const betAmount = parseFloat(betInput.value);

    if(isNaN(betAmount) || betAmount <= 0) {
        alert('Введите корректную ставку');
        return;
    }

    if(betAmount > money) {
        alert('Недостаточно средств');
        return;
    }

    if (isSpinning) return;

    betInput.disabled = true;
    setPercentButtonsDisabled(true);
    money -= betAmount;
    saveMoney();
    document.body.classList.remove('spin-vignette-fadeout');
    document.body.classList.add('spin-vignette');
    document.getElementById('money').textContent = `${money.toFixed(2)}$`;
    
    createSpinSound();

    const maxFullRotation = 5;
    const minFullRotation = 2;
    const fullRotations = Math.floor(Math.random() * (maxFullRotation - minFullRotation + 1)) + minFullRotation;
    const randomAngle = Math.random() * 360;
    const totalAngle = fullRotations * 360 + randomAngle;

    spinFromAngle = 0;
    spinToAngle = spinFromAngle + totalAngle;
    spinStartTime = performance.now();
    isSpinning = true;

    console.log(`Full rotations: ${fullRotations}`);
    console.log(`Random angle: ${randomAngle.toFixed(2)} degrees`);
    console.log(`Total angle: ${totalAngle} degrees`);
});


setInterval(drawArc, 1000/140); // Call drawArc every 100 milliseconds

var time = 0;
var deltaTime = 0;
var lastFrameTime = performance.now();
var frameCount = 0;
var fps = 0;
var fpsUpdateTime = performance.now();
function calcTime(){
    var now = performance.now();
    time = now / 1000; // seconds
    deltaTime = (now - lastFrameTime) / 1000; // seconds
    lastFrameTime = now;

    frameCount++;
    if (now - fpsUpdateTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        fpsUpdateTime = now;
    }
}


const liveFeed = document.getElementById('liveFeed');
const fakeNames = ['Alex', 'Nina', 'Luna', 'Dima', 'Ari', 'Kira', 'Max', 'Sera', 'Jin', 'Vik', 'Milo', 'Jade', 'Rex', 'Zoe', 'Mira'];

function spawnLiveWin() {
    if (!liveFeed) return;

    const item = document.createElement('div');
    item.className = 'live-item';
    const name = fakeNames[Math.floor(Math.random() * fakeNames.length)];
    const amount = (10 + Math.random() * 160).toFixed(0);

    item.innerHTML = `
        <span class="name">${name}</span>
        <span class="amount">+${amount}$</span>
    `;

    liveFeed.appendChild(item);

    setTimeout(() => {
        item.remove();
    }, 3600);
}

setInterval(spawnLiveWin, 2200);