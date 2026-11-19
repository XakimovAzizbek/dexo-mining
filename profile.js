const AD_THRESHOLD      = 0.0002;
const BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000;
const KEY_BALANCE       = "mining_balance_v2";
const KEY_MINED         = "mining_mined_since_ad_v2";
const KEY_LAST_BONUS    = "mining_last_bonus_v2";

if (window.Telegram?.WebApp) {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
}

const avatarEl    = document.getElementById("avatar");
const userNameEl  = document.getElementById("userName");
const userUnEl    = document.getElementById("userUsername");
const balanceEl   = document.getElementById("balance");
const statusEl    = document.getElementById("statusText");
const nextAdEl    = document.getElementById("nextAdText");
const bonusEl     = document.getElementById("bonusText");

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function loadState() {
  let balance = 0, mined = 0, lastBonus = 0;
  try {
    const b  = localStorage.getItem(KEY_BALANCE);
    const m  = localStorage.getItem(KEY_MINED);
    const lb = localStorage.getItem(KEY_LAST_BONUS);
    if (b  !== null) balance   = parseFloat(b)  || 0;
    if (m  !== null) mined     = parseFloat(m)  || 0;
    if (lb !== null) lastBonus = parseFloat(lb) || 0;
  } catch (e) {}
  return { balance, mined, lastBonus };
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

async function loadCloud(state) {
  const [bVal, mVal, lbVal] = await Promise.all([
    cloudGet(KEY_BALANCE),
    cloudGet(KEY_MINED),
    cloudGet(KEY_LAST_BONUS),
  ]);
  if (bVal)  { const c = parseFloat(bVal)  || 0; if (c > state.balance)   state.balance   = c; }
  if (mVal)  { const c = parseFloat(mVal)  || 0; if (c > state.mined)     state.mined     = c; }
  if (lbVal) { const c = parseFloat(lbVal) || 0; if (c > state.lastBonus) state.lastBonus = c; }
  return state;
}

function renderUser() {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!user) {
    userNameEl.textContent = "Mehmon foydalanuvchi";
    userUnEl.textContent = "";
    return;
  }
  const firstName = user.first_name || "";
  const lastName  = user.last_name || "";
  userNameEl.textContent = `${firstName} ${lastName}`.trim() || "Foydalanuvchi";
  userUnEl.textContent = user.username ? "@" + user.username : `ID: ${user.id}`;
  if (user.photo_url) {
    avatarEl.textContent = "";
    avatarEl.style.backgroundImage = `url("${user.photo_url}")`;
  }
}

function renderBalance(state) {
  balanceEl.textContent = "$" + state.balance.toFixed(5);

  const remaining = Math.max(AD_THRESHOLD - state.mined, 0);
  if (state.balance > 0) {
    if (remaining <= 0.0000001) {
      nextAdEl.textContent = "Reklama tayyor!";
      statusEl.textContent = "Kutilmoqda";
    } else {
      nextAdEl.textContent = "$" + remaining.toFixed(5);
      statusEl.textContent = "Faol";
    }
  } else {
    nextAdEl.textContent = "$" + AD_THRESHOLD.toFixed(5);
    statusEl.textContent = "Boshlanmagan";
  }
}

function renderBonus(state) {
  const ready = Date.now() - state.lastBonus >= BONUS_INTERVAL_MS;
  if (ready) {
    bonusEl.textContent = "Tayyor! 🎁";
    bonusEl.style.color = "#00e676";
  } else {
    bonusEl.textContent = formatCountdown(BONUS_INTERVAL_MS - (Date.now() - state.lastBonus));
    bonusEl.style.color = "";
  }
}

(async function init() {
  renderUser();
  let state = loadState();
  state = await loadCloud(state);
  renderBalance(state);
  renderBonus(state);

  // Har sekund bonus countdown yangilanadi
  setInterval(() => renderBonus(state), 1000);
})();