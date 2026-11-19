// ============ SOZLAMALAR ============
const START_BALANCE = 0.00001;
const PER_TICK      = 0.00002;
const AD_THRESHOLD  = 0.0002;
const TICK_MS       = 1000;
const BLOCK_ID      = "int-60710";

// Daily bonus
const BONUS_AMOUNT      = 0.001;
const BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 soat

// Storage keys
const KEY_BALANCE    = "mining_balance_v2";
const KEY_MINED      = "mining_mined_since_ad_v2";
const KEY_LAST_BONUS = "mining_last_bonus_v2";

// ============ DOM ============
const balanceEl     = document.getElementById("balance");
const statusEl      = document.getElementById("status");
const startBtn      = document.getElementById("startBtn");
const progressEl    = document.getElementById("progressBar");
const bonusCard     = document.getElementById("bonusCard");
const bonusBtn      = document.getElementById("bonusBtn");
const bonusCountEl  = document.getElementById("bonusCountdown");

// ============ STATE ============
let balance      = 0;
let minedSinceAd = 0;
let lastBonusAt  = 0;   // timestamp (ms)
let timer        = null;
let bonusTimer   = null;
let running      = false;
let adController = null;

// ============ TELEGRAM ============
if (window.Telegram?.WebApp) {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
}

// ============ FORMAT ============
function formatMoney(n) {
  return "$" + n.toFixed(5);
}

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ============ UI ============
function updateUI() {
  balanceEl.textContent = formatMoney(balance);
  const pct = Math.min((minedSinceAd / AD_THRESHOLD) * 100, 100);
  progressEl.style.width = pct + "%";
}

function setStatus(t) { statusEl.textContent = t; }

function haptic(type, style) {
  try {
    const hf = window.Telegram?.WebApp?.HapticFeedback;
    if (!hf) return;
    if (type === "impact") hf.impactOccurred(style || "medium");
    if (type === "notify") hf.notificationOccurred(style || "success");
  } catch (e) {}
}

// ============ STORAGE ============
function saveLocal() {
  try {
    localStorage.setItem(KEY_BALANCE, String(balance));
    localStorage.setItem(KEY_MINED, String(minedSinceAd));
    localStorage.setItem(KEY_LAST_BONUS, String(lastBonusAt));
  } catch (e) {}
}

function saveCloud() {
  if (window.Telegram?.WebApp?.CloudStorage) {
    try {
      Telegram.WebApp.CloudStorage.setItem(KEY_BALANCE, String(balance));
      Telegram.WebApp.CloudStorage.setItem(KEY_MINED, String(minedSinceAd));
      Telegram.WebApp.CloudStorage.setItem(KEY_LAST_BONUS, String(lastBonusAt));
    } catch (e) {}
  }
}

function saveState() { saveLocal(); saveCloud(); }

function loadLocal() {
  try {
    const b  = localStorage.getItem(KEY_BALANCE);
    const m  = localStorage.getItem(KEY_MINED);
    const lb = localStorage.getItem(KEY_LAST_BONUS);
    if (b  !== null) balance      = parseFloat(b)  || 0;
    if (m  !== null) minedSinceAd = parseFloat(m)  || 0;
    if (lb !== null) lastBonusAt  = parseFloat(lb) || 0;
  } catch (e) {}
}

function cloudGet(key) {
  return new Promise((resolve) => {
    if (!window.Telegram?.WebApp?.CloudStorage) return resolve(null);
    try {
      Telegram.WebApp.CloudStorage.getItem(key, (err, val) => {
        if (err || !val) return resolve(null);
        resolve(val);
      });
    } catch (e) { resolve(null); }
  });
}

async function loadCloud() {
  const [bVal, mVal, lbVal] = await Promise.all([
    cloudGet(KEY_BALANCE),
    cloudGet(KEY_MINED),
    cloudGet(KEY_LAST_BONUS),
  ]);

  if (bVal) {
    const c = parseFloat(bVal) || 0;
    if (c > balance) balance = c;
  }
  if (mVal) {
    const c = parseFloat(mVal) || 0;
    if (c > minedSinceAd) minedSinceAd = c;
  }
  if (lbVal) {
    const c = parseFloat(lbVal) || 0;
    if (c > lastBonusAt) lastBonusAt = c; // eng so'nggi claim vaqti
  }
}

async function loadState() {
  loadLocal();
  await loadCloud();
}

// ============ ADSGRAM ============
function initAds() {
  if (!adController && window.Adsgram) {
    adController = window.Adsgram.init({ blockId: BLOCK_ID });
  }
}

// ============ MINING ============
function startMining() {
  if (running) return;

  if (balance <= 0) balance = START_BALANCE;

  running = true;
  startBtn.disabled = true;
  startBtn.textContent = "Ishlamoqda...";
  setStatus("⛏️ Mining ishlamoqda...");
  updateUI();
  saveState();

  timer = setInterval(() => {
    balance      += PER_TICK;
    minedSinceAd += PER_TICK;
    saveState();
    updateUI();

    if (minedSinceAd >= AD_THRESHOLD - 1e-9) {
      stopMining();
      showAd();
    }
  }, TICK_MS);
}

function stopMining() {
  running = false;
  if (timer) { clearInterval(timer); timer = null; }
}

// ============ REKLAMA ============
function showAd() {
  setStatus("📺 Reklama yuklanmoqda...");
  startBtn.disabled = true;
  startBtn.textContent = "Reklama...";

  initAds();

  if (!adController) {
    setStatus("❌ Reklama yuklanmadi. Qayta urinib ko'ring.");
    startBtn.disabled = false;
    startBtn.textContent = "Qayta urinish";
    return;
  }

  adController.show()
    .then(() => {
      setStatus("✅ Reklama ko'rildi! Mining davom etmoqda...");
      minedSinceAd = 0;
      saveState();
      updateUI();
      haptic("notify", "success");

      setTimeout(() => {
        startBtn.disabled = false;
        startBtn.textContent = "Boshlash";
        startMining();
      }, 1000);
    })
    .catch(() => {
      setStatus("⚠️ Reklama to'liq ko'rilmadi. Qayta urinib ko'ring.");
      startBtn.disabled = false;
      startBtn.textContent = "Qayta urinish";
    });
}

// ============ KUNLIK BONUS ============
function canClaimBonus() {
  return Date.now() - lastBonusAt >= BONUS_INTERVAL_MS;
}

function bonusRemaining() {
  return Math.max(0, BONUS_INTERVAL_MS - (Date.now() - lastBonusAt));
}

function updateBonusUI() {
  const ready = canClaimBonus();

  if (ready) {
    bonusBtn.disabled = false;
    bonusBtn.textContent = "🎁 Bonusni olish";
    bonusBtn.classList.add("ready");
    bonusCountEl.textContent = "Tayyor!";
    bonusCard.classList.add("ready-state");
  } else {
    bonusBtn.disabled = true;
    bonusBtn.textContent = "⏳ Kutish...";
    bonusBtn.classList.remove("ready");
    bonusCountEl.textContent = formatCountdown(bonusRemaining());
    bonusCard.classList.remove("ready-state");
  }
}

function startBonusTicker() {
  if (bonusTimer) clearInterval(bonusTimer);
  bonusTimer = setInterval(updateBonusUI, 1000);
}

function pulseBalance() {
  balanceEl.classList.remove("pulse");
  // force reflow
  void balanceEl.offsetWidth;
  balanceEl.classList.add("pulse");
  setTimeout(() => balanceEl.classList.remove("pulse"), 800);
}

function playCoinAnimation(originEl) {
  const rect = originEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const count = 14;
  for (let i = 0; i < count; i++) {
    const coin = document.createElement("div");
    coin.className = "coin";
    coin.textContent = ["💰", "💵", "🪙"][i % 3];
    coin.style.left = cx + "px";
    coin.style.top  = cy + "px";

    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist  = 90 + Math.random() * 80;
    coin.style.setProperty("--tx", Math.cos(angle) * dist + "px");
    coin.style.setProperty("--ty", Math.sin(angle) * dist - 30 + "px");

    document.body.appendChild(coin);
    setTimeout(() => coin.remove(), 1300);
  }
}

function claimBonus() {
  if (!canClaimBonus()) return;

  haptic("impact", "heavy");

  lastBonusAt = Date.now();
  balance += BONUS_AMOUNT;

  saveState();
  updateUI();
  updateBonusUI();
  pulseBalance();
  playCoinAnimation(bonusBtn);

  setTimeout(() => haptic("notify", "success"), 150);
  setStatus(`🎁 +$${BONUS_AMOUNT.toFixed(3)} bonus qo'shildi!`);
}

// ============ EVENTS ============
startBtn.addEventListener("click", () => {
  haptic("impact", "light");
  if (minedSinceAd >= AD_THRESHOLD - 1e-9) {
    showAd();
  } else {
    startMining();
  }
});

bonusBtn.addEventListener("click", claimBonus);

// ============ INIT ============
(async function init() {
  await loadState();
  updateUI();
  updateBonusUI();
  startBonusTicker();

  if (balance > 0) {
    setStatus("Balans yuklandi. Davom etish uchun tugmani bosing.");
  }
})();