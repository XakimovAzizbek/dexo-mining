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
  const state = { balance: 0, mined: 0, lastBonus: 0, wallet: "" };

  // Balance display
  let displayValue  = 0;
  let balanceAnimId = 0;
  let firstRender   = true;

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

  function setBalanceImmediate(val) {
    balanceAnimId++;
    displayValue = val;
    els.balance.textContent = formatMoney(val);
  }

  function animateBalance(target) {
    const myId = ++balanceAnimId;
    const start = displayValue;
    const diff = target - start;

    if (Math.abs(diff) < 0.0000001) {
      displayValue = target;
      els.balance.textContent = formatMoney(target);
      return;
    }

    const duration = Math.abs(diff) > 0.0005 ? 700 : 900;
    const startTime = performance.now();

    function step(now) {
      if (myId !== balanceAnimId) return;
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      displayValue = start + diff * eased;
      els.balance.textContent = formatMoney(displayValue);
      if (p < 1) requestAnimationFrame(step);
      else displayValue = target;
    }
    requestAnimationFrame(step);
  }

  // ===== STORAGE =====
  function loadLocal() {
    const s = window.__SS.loadState();
    state.balance   = s.v || 0;
    state.mined     = s.m || 0;
    state.lastBonus = s.b || 0;
    state.wallet    = window.__SS.loadWallet();
  }

  async function loadCloud() {
    const c = await window.__SS.loadCloudState();
    if (c) {
      if (c.v > state.balance)   state.balance   = c.v;
      if (c.m > state.mined)     state.mined     = c.m;
      if (c.b > state.lastBonus) state.lastBonus = c.b;
    }
    if (!state.wallet) {
      const cw = await window.__SS.loadCloudWallet();
      if (cw) state.wallet = cw;
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

  function renderBalance() {
    if (firstRender) {
      setBalanceImmediate(state.balance);
      firstRender = false;
    } else {
      animateBalance(state.balance);
    }
  }

  function renderStats() {
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

    const now = window.__SS.safeNow();
    const bonusReady = now - state.lastBonus >= BONUS_INTERVAL_MS;
    if (bonusReady) {
      els.bonus.textContent = "Tayyor! 🎁";
      els.bonus.style.color = "var(--green)";
    } else {
      els.bonus.textContent = formatCountdown(BONUS_INTERVAL_MS - (now - state.lastBonus));
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

  // ===== ACTIONS =====
  async function saveWallet() {
    if (!window.__SS.rateLimit("save_wallet", 1500)) return;

    const val = (els.wallet.value || "").trim();

    if (val.length < WALLET_MIN_LEN) {
      haptic("error");
      SND.error();
      showToast("❌ Manzil juda qisqa (min " + WALLET_MIN_LEN + " belgi)", "var(--red)");
      return;
    }

    state.wallet = val;
    window.__SS.saveWallet(val);

    haptic("success");
    SND.success();
    showToast("✅ Hamyon manzili saqlandi", "var(--green)");
    renderWithdrawBtn();
  }

  async function withdraw() {
    if (!window.__SS.rateLimit("withdraw", 3000)) return;

    if (state.balance < WITHDRAW_MIN) {
      haptic("error");
      SND.error();
      showToast(`❌ Minimal yechish: $${WITHDRAW_MIN.toFixed(2)}`, "var(--red)");
      return;
    }
    if (state.wallet.length < WALLET_MIN_LEN) {
      haptic("error");
      SND.error();
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
      ts:        window.__SS.safeNow(),
      status:    "pending",
    };

    const arr = window.__SS.loadWithdrawals();
    arr.push(request);
    if (arr.length > 50) arr.splice(0, arr.length - 50);
    window.__SS.saveWithdrawals(arr);

    SND.bonus();
    setTimeout(() => SND.coin(), 100);
    haptic("success");

    showToast(
      `✅ So'rov qabul qilindi: $${request.amount.toFixed(5)}\nAdmin tez orada ko'rib chiqadi`,
      "var(--green)"
    );
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
  els.withdrawBtn.addEventListener("click", withdraw);

  els.wallet.addEventListener("keypress", (e) => {
    if (e.key === "Enter") saveWallet();
  });

  setInterval(() => {
    loadLocal();
    renderStats();
    renderWithdrawBtn();
  }, 1000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadLocal();
      renderBalance();
      renderStats();
      renderWithdrawBtn();
    }
  });

  // ===== INIT =====
  (async function init() {
    PT.init(25);

    loadLocal();
    await loadCloud();

    renderUser();
    renderBalance();
    renderStats();
    renderWallet();
    renderWithdrawBtn();
  })();
})();