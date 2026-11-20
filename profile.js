// ============ GUARD ============
if (window.__TG_BLOCKED__) throw new Error("Telegram WebApp required");
if (!window.__SS) throw new Error("Secure storage not loaded");
if (!window.__SND || !window.__PT) throw new Error("Effects not loaded");

(function () {
  "use strict";

  const SND = window.__SND;
  const PT  = window.__PT;

  // ===== SOZLAMALAR =====
  const AD_THRESHOLD      = 0.0002;
  const BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const WITHDRAW_MIN      = 1.00;
  const WALLET_MIN_LEN    = 10;

  // ===== TELEGRAM =====
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
  }

  // ===== DOM =====
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
    soundToggle:   document.getElementById("soundToggle"),
  };

  // ===== STATE =====
  let balance = 0;
  let mined = 0; // Hozircha brauzerda saqlanadi, lekin uni ham keyin serverga o'tkazamiz
  let lastBonus = 0;

  // ===== HELPERS =====
  function formatMoney(n) { return "$" + n.toFixed(5); }

  function formatCountdown(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
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
      if (type === "success" || type === "error" || type === "warning") hf.notificationOccurred(type);
      else hf.impactOccurred(type || "medium");
    } catch (e) {}
  }

  // ===== SERVER BILAN ALOQA =====
  async function fetchBalance() {
    if (!window.Telegram?.WebApp?.initData) return;
    try {
      const res = await fetch('/endpoints/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: Telegram.WebApp.initData,
          action: 'get'
        })
      });
      const data = await res.json();
      balance = data.balance;
      els.balance.textContent = formatMoney(balance);
      renderWithdrawBtn();
    } catch (e) {
      console.warn("Balansni yuklashda xato", e);
    }
  }

  // ===== RENDER =====
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

  function renderStats() {
    // Hozircha mined (adgacha yig'ilgan) ni localdan olamiz
    const s = window.__SS.loadState();
    mined = s.m || 0;
    lastBonus = s.b || 0;

    if (balance > 0) {
      if (mined >= AD_THRESHOLD - 1e-9) {
        els.status.textContent = "Kutilmoqda";
        els.status.style.color = "var(--gold)";
        els.nextAd.textContent = "Reklama tayyor!";
        els.nextAd.style.color = "var(--gold)";
      } else {
        els.status.textContent = "Faol ⛏️";
        els.status.style.color = "var(--green)";
        const rem = Math.max(AD_THRESHOLD - mined, 0);
        els.nextAd.textContent = "$" + rem.toFixed(5);
        els.nextAd.style.color = "var(--cyan)";
      }
    } else {
      els.status.textContent = "Boshlanmagan";
      els.status.style.color = "var(--muted)";
      els.nextAd.textContent = "$" + AD_THRESHOLD.toFixed(4);
      els.nextAd.style.color = "var(--muted)";
    }

    const now = window.__SS.safeNow();
    const bonusReady = now - lastBonus >= BONUS_INTERVAL_MS;
    if (bonusReady) {
      els.bonus.textContent = "Tayyor! 🎁";
      els.bonus.style.color = "var(--green)";
    } else {
      els.bonus.textContent = formatCountdown(BONUS_INTERVAL_MS - (now - lastBonus));
      els.bonus.style.color = "var(--cyan)";
    }
  }

  function renderWithdrawBtn() {
    const can = balance >= WITHDRAW_MIN; // Hamyon keyingi bosqichda ulanadi
    els.withdrawBtn.disabled = !can;
  }

  // ===== ACTIONS =====
  async function saveWallet() {
    if (!window.__SS.rateLimit("save_wallet", 1500)) return;
    const val = (els.wallet.value || "").trim();
    if (val.length < WALLET_MIN_LEN) {
      haptic("error");
      SND.error();
      showToast("❌ Manzil juda qisqa", "var(--red)");
      return;
    }
    window.__SS.saveWallet(val);
    haptic("success");
    SND.success();
    showToast("✅ Hamyon manzili saqlandi", "var(--green)");
  }

  // ===== SOUND TOGGLE =====
  if (els.soundToggle) {
    els.soundToggle.textContent = SND.isEnabled() ? "🔊" : "🔇";
    els.soundToggle.addEventListener("click", () => {
      const on = SND.toggle();
      els.soundToggle.textContent = on ? "🔊" : "🔇";
      if (on) SND.click();
    });
  }

  // ===== EVENTS =====
  els.saveWalletBtn.addEventListener("click", saveWallet);

  // Har 3 sekundda serverdan balansni yangilab turamiz (profil sahifasida turgan vaqtda)
  setInterval(() => {
    fetchBalance();
    renderStats();
  }, 3000);

  // ===== INIT =====
  (async function init() {
    PT.init(25);
    
    // Dastlab serverdan balansni yuklaymiz
    await fetchBalance();
    
    renderUser();
    renderStats();
    els.wallet.value = window.__SS.loadWallet();
  })();
})();