// ============ GUARD: Telegram bo'lmasa — hech narsa ishlamaydi ============
if (window.__TG_BLOCKED__) {
  throw new Error("Telegram WebApp required");
}

// ============ SOZLAMALAR ============
const AD_THRESHOLD      = 0.0002;
const BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000;
const WITHDRAW_MIN      = 1.00;
const WALLET_MIN_LEN    = 10;

// Storage keys (index.js bilan mos)
const KEY_BALANCE    = "mining_balance_v2";
const KEY_MINED      = "mining_mined_since_ad_v2";
const KEY_LAST_BONUS = "mining_last_bonus_v2";
const KEY_WALLET     = "mining_wallet_v3";
const KEY_WITHDRAWS  = "mining_withdraw_requests_v1";

// ============ TELEGRAM ============
if (window.Telegram?.WebApp) {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
}

// ============ DOM ============
const els = {
  avatar:        document.getElementById("avatar"),
  userName:      document.getElementById("userName"),
  userUn:        document.getElementById("userUsername"),
  userId:        document.getElementById("userId"),
  balance:       document.getElementById("balance"),
  status:        document.getElementById("statusText"),
  nextAd:        document.getElementById("nextAdText"),
  bonus:         document.getElementById("bonusText"),
  wallet:        document.getElementById("walletInput"),
  saveWalletBtn: document.getElementById("saveWalletBtn"),
  withdrawBtn:   document.getElementById("withdrawBtn"),
  toast:         document.getElementById("toast"),
};

// ============ STATE ============
const state = {
  balance:   0,
  mined:     0,
  lastBonus: 0,
  wallet:    "",
};

// ============ YORDAMCHI ============
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

function showToast(msg, color) {
  els.toast.textContent = msg;
  els.toast.style.borderColor = color || "rgba(255,255,255,0.09)";
  els.toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function haptic(type) {
  try {
    const hf = window.Telegram?.WebApp?.HapticFeedback;
    if (!hf) return;
    if (type === "success" || type === "error" || type === "warning") {
      hf.notificationOccurred(type);
    } else {
      hf.impactOccurred(type || "medium");
    }
  } catch (e) {}
}

// ============ STORAGE ============
function loadLocal() {
  try {
    state.balance   = parseFloat(localStorage.getItem(KEY_BALANCE))    || 0;
    state.mined     = parseFloat(localStorage.getItem(KEY_MINED))      || 0;
    state.lastBonus = parseFloat(localStorage.getItem(KEY_LAST_BONUS)) || 0;
    state.wallet    = localStorage.getItem(KEY_WALLET) || "";
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

function cloudSet(key, val) {
  return new Promise((resolve) => {
    if (!window.Telegram?.WebApp?.CloudStorage) return resolve();
    try {
      Telegram.WebApp.CloudStorage.setItem(key, String(val), () => resolve());
    } catch (e) { resolve(); }
  });
}

async function loadCloud() {
  const [bVal, mVal, lbVal, wVal] = await Promise.all([
    cloudGet(KEY_BALANCE),
    cloudGet(KEY_MINED),
    cloudGet(KEY_LAST_BONUS),
    cloudGet(KEY_WALLET),
  ]);
  if (bVal)  { const c = parseFloat(bVal)  || 0; if (c > state.balance)   state.balance   = c; }
  if (mVal)  { const c = parseFloat(mVal)  || 0; if (c > state.mined)     state.mined     = c; }
  if (lbVal) { const c = parseFloat(lbVal) || 0; if (c > state.lastBonus) state.lastBonus = c; }
  if (wVal && !state.wallet) state.wallet = wVal;
}

// ============ RENDER ============
function renderUser() {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;

  if (!user) {
    els.userName.textContent = "Mehmon foydalanuvchi";
    els.userUn.textContent = "";
    els.userId.textContent = "ID: —";
    els.avatar.textContent = "👤";
    return;
  }

  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Foydalanuvchi";
  els.userName.textContent = name;
  els.userUn.textContent = user.username ? "@" + user.username : "";
  els.userId.textContent = "ID: " + user.id;

  if (user.photo_url) {
    els.avatar.textContent = "";
    const img = document.createElement("img");
    img.src = user.photo_url;
    img.alt = name;
    img.loading = "lazy";
    els.avatar.appendChild(img);
  } else {
    els.avatar.textContent = (name[0] || "👤").toUpperCase();
  }
}

function renderBalance() {
  els.balance.textContent = formatMoney(state.balance);
}

function renderStats() {
  // Mining holati
  if (state.balance > 0) {
    if (state.mined >= AD_THRESHOLD - 1e-9) {
      els.status.textContent = "Kutilmoqda";
      els.status.style.color = "var(--gold)";
      els.nextAd.textContent = "Reklama tayyor!";
      els.nextAd.style.color = "var(--gold)";
    } else {
      els.status.textContent = "Faol ⛏️";
      els.status.style.color = "var(--green)";
      const rem = Math.max(AD_THRESHOLD - state.mined, 0);
      els.nextAd.textContent = "$" + rem.toFixed(5);
      els.nextAd.style.color = "var(--cyan)";
    }
  } else {
    els.status.textContent = "Boshlanmagan";
    els.status.style.color = "var(--muted)";
    els.nextAd.textContent = "$" + AD_THRESHOLD.toFixed(4);
    els.nextAd.style.color = "var(--muted)";
  }

  // Kunlik bonus
  const bonusReady = Date.now() - state.lastBonus >= BONUS_INTERVAL_MS;
  if (bonusReady) {
    els.bonus.textContent = "Tayyor! 🎁";
    els.bonus.style.color = "var(--green)";
  } else {
    els.bonus.textContent = formatCountdown(BONUS_INTERVAL_MS - (Date.now() - state.lastBonus));
    els.bonus.style.color = "var(--cyan)";
  }
}

function renderWallet() {
  if (state.wallet) els.wallet.value = state.wallet;
}

function renderWithdrawBtn() {
  const can = state.balance >= WITHDRAW_MIN && state.wallet.length >= WALLET_MIN_LEN;
  els.withdrawBtn.disabled = !can;
}

// ============ ACTIONS ============
async function saveWallet() {
  const val = (els.wallet.value || "").trim();

  if (val.length < WALLET_MIN_LEN) {
    haptic("error");
    showToast("❌ Manzil juda qisqa (min " + WALLET_MIN_LEN + " belgi)", "var(--red)");
    return;
  }

  state.wallet = val;
  try { localStorage.setItem(KEY_WALLET, val); } catch (e) {}
  await cloudSet(KEY_WALLET, val);

  haptic("success");
  showToast("✅ Hamyon manzili saqlandi", "var(--green)");
  renderWithdrawBtn();
}

async function withdraw() {
  if (state.balance < WITHDRAW_MIN) {
    haptic("error");
    showToast(`❌ Minimal yechish: $${WITHDRAW_MIN.toFixed(2)}`, "var(--red)");
    return;
  }
  if (state.wallet.length < WALLET_MIN_LEN) {
    haptic("error");
    showToast("❌ Avval hamyon manzilini kiriting", "var(--red)");
    return;
  }

  haptic("heavy");

  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const request = {
    userId:    user?.id || 0,
    firstName: user?.first_name || "",
    lastName:  user?.last_name || "",
    username:  user?.username || "",
    wallet:    state.wallet,
    amount:    parseFloat(state.balance.toFixed(5)),
    ts:        Date.now(),
    status:    "pending",
  };

  // CloudStorage'ga yozamiz
  try {
    const existing = await cloudGet(KEY_WITHDRAWS);
    let arr = [];
    if (existing) {
      try { arr = JSON.parse(existing); } catch (e) { arr = []; }
    }
    if (!Array.isArray(arr)) arr = [];
    arr.push(request);
    if (arr.length > 50) arr = arr.slice(-50);
    await cloudSet(KEY_WITHDRAWS, JSON.stringify(arr));
  } catch (e) {}

  // Lokal backup
  try {
    const existingL = localStorage.getItem(KEY_WITHDRAWS);
    let arrL = [];
    if (existingL) {
      try { arrL = JSON.parse(existingL); } catch (e) { arrL = []; }
    }
    if (!Array.isArray(arrL)) arrL = [];
    arrL.push(request);
    if (arrL.length > 50) arrL = arrL.slice(-50);
    localStorage.setItem(KEY_WITHDRAWS, JSON.stringify(arrL));
  } catch (e) {}

  showToast(
    `✅ So'rov qabul qilindi: $${request.amount.toFixed(5)}\nAdmin tez orada ko'rib chiqadi`,
    "var(--green)"
  );
}

// ============ EVENTS ============
els.saveWalletBtn.addEventListener("click", saveWallet);
els.withdrawBtn.addEventListener("click", withdraw);

els.wallet.addEventListener("keypress", (e) => {
  if (e.key === "Enter") saveWallet();
});

// Har sekundda countdown yangilanadi
setInterval(() => {
  loadLocal();
  renderStats();
  renderWithdrawBtn();
}, 1000);

// Sahifa ko'ringanda qayta yuklash
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadLocal();
    renderBalance();
    renderStats();
    renderWithdrawBtn();
  }
});

// ============ INIT ============
(async function init() {
  loadLocal();
  await loadCloud();

  renderUser();
  renderBalance();
  renderStats();
  renderWallet();
  renderWithdrawBtn();
})();