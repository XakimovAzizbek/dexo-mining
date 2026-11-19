// ============ GUARD ============
if (window.__TG_BLOCKED__) throw new Error("Telegram WebApp required");
if (!window.__SS) throw new Error("Secure storage not loaded");
if (!window.__SND || !window.__PT) throw new Error("Effects not loaded");

(function () {
  "use strict";

  const SND = window.__SND;
  const PT  = window.__PT;

  // ===== SOZLAMALAR =====
  const START_BALANCE = 0.00001;
  const PER_TICK      = 0.00002;
  const AD_THRESHOLD  = 0.0002;
  const TICK_MS       = 1000;
  const BLOCK_ID      = "int-60717";

  const BONUS_AMOUNT      = 0.001;
  const BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000;

  // ===== DOM =====
  const balanceEl    = document.getElementById("balance");
  const statusEl     = document.getElementById("status");
  const startBtn     = document.getElementById("startBtn");
  const progressEl   = document.getElementById("progressBar");
  const bonusCard    = document.getElementById("bonusCard");
  const bonusBtn     = document.getElementById("bonusBtn");
  const bonusCountEl = document.getElementById("bonusCountdown");
  const pickaxeEl    = document.getElementById("pickaxe");
  const soundToggleEl = document.getElementById("soundToggle");

  // ===== STATE =====
  let balance      = 0;
  let minedSinceAd = 0;
  let lastBonusAt  = 0;
  let timer        = null;
  let bonusTimer   = null;
  let running      = false;
  let adController = null;

  // Display state
  let displayValue  = 0;
  let balanceAnimId = 0;
  let tickCounter   = 0;
  let firstRender   = true;

  // ===== TELEGRAM =====
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
  }

  // ===== HONEYPOT =====
  try {
    let _hp = 0;
    Object.defineProperty(window, "balance", {
      get: function () { return _hp; },
      set: function (v) {
        _hp = v;
        try {
          document.body.innerHTML = "";
          document.body.style.cssText =
            "background:#000!important;position:fixed!important;inset:0!important;" +
            "width:100vw!important;height:100vh!important;z-index:2147483647!important;";
          document.documentElement.style.background = "#000";
        } catch (e) {}
      },
      configurable: false,
    });
  } catch (e) {}

  // ===== HELPERS =====
  function formatMoney(n) { return "$" + n.toFixed(5); }

  function formatCountdown(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  // ===== BALANCE COUNT-UP =====
  function setBalanceImmediate(val) {
    balanceAnimId++;
    displayValue = val;
    balanceEl.textContent = formatMoney(val);
  }

  function animateBalance(target) {
    const myId = ++balanceAnimId;
    const start = displayValue;
    const diff = target - start;

    if (Math.abs(diff) < 0.0000001) {
      displayValue = target;
      balanceEl.textContent = formatMoney(target);
      return;
    }

    const absDiff = Math.abs(diff);
    // Mining tick (kichik farq) — 900ms = deyarli sekundga teng (silliq)
    // Bonus/big change — 700ms (tezroq, aks holda juda sekin ko'rinadi)
    const duration = absDiff > 0.0005 ? 700 : 900;
    const startTime = performance.now();

    function step(now) {
      if (myId !== balanceAnimId) return;
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      displayValue = start + diff * eased;
      balanceEl.textContent = formatMoney(displayValue);
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        displayValue = target;
      }
    }
    requestAnimationFrame(step);
  }

  function updateUI() {
    if (firstRender) {
      setBalanceImmediate(balance);
      firstRender = false;
    } else {
      animateBalance(balance);
    }
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

  function saveState() {
    window.__SS.saveState(balance, minedSinceAd, lastBonusAt);
  }

  function loadState() {
    const s = window.__SS.loadState();
    balance = s.v || 0;
    minedSinceAd = s.m || 0;
    lastBonusAt = s.b || 0;
  }

  async function loadCloudState() {
    const c = await window.__SS.loadCloudState();
    if (!c) return;
    if (c.v > balance)      balance = c.v;
    if (c.m > minedSinceAd) minedSinceAd = c.m;
    if (c.b > lastBonusAt)  lastBonusAt = c.b;
  }

  // ===== ADSGRAM =====
  function initAds() {
    if (!adController && window.Adsgram) {
      adController = window.Adsgram.init({ blockId: BLOCK_ID });
    }
  }

  // ===== MINING =====
  function startMining() {
    if (running) return;
    if (!window.__SS.rateLimit("start", 500)) return;

    if (balance <= 0) balance = START_BALANCE;

    running = true;
    tickCounter = 0;
    startBtn.disabled = true;
    startBtn.textContent = "Ishlamoqda...";
    setStatus("⛏️ Mining ishlamoqda...");

    if (pickaxeEl) pickaxeEl.classList.add("active");

    updateUI();
    saveState();

    timer = setInterval(() => {
      balance      += PER_TICK;
      minedSinceAd += PER_TICK;
      tickCounter++;
      saveState();
      updateUI();

      // Har 5 sekundda yumshoq tick ovozi
      if (tickCounter % 5 === 0) SND.tick();

      if (minedSinceAd >= AD_THRESHOLD - 1e-9) {
        stopMining();
        showAd();
      }
    }, TICK_MS);
  }

  function stopMining() {
    running = false;
    if (pickaxeEl) pickaxeEl.classList.remove("active");
    if (timer) { clearInterval(timer); timer = null; }
  }

  // ===== REKLAMA =====
  function showAd() {
    setStatus("📺 Reklama yuklanmoqda...");
    startBtn.disabled = true;
    startBtn.textContent = "Reklama...";

    initAds();

    if (!adController) {
      setStatus("❌ Reklama yuklanmadi. Qayta urinib ko'ring.");
      startBtn.disabled = false;
      startBtn.textContent = "Qayta urinish";
      SND.error();
      return;
    }

    adController.show()
      .then(() => {
        setStatus("✅ Reklama ko'rildi! Mining davom etmoqda...");
        minedSinceAd = 0;
        saveState();
        updateUI();
        haptic("notify", "success");
        SND.success();

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
        SND.error();
      });
  }

  // ===== KUNLIK BONUS =====
  function canClaimBonus() {
    const now = window.__SS.safeNow();
    return now - lastBonusAt >= BONUS_INTERVAL_MS;
  }

  function bonusRemaining() {
    const now = window.__SS.safeNow();
    return Math.max(0, BONUS_INTERVAL_MS - (now - lastBonusAt));
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
    void balanceEl.offsetWidth;
    balanceEl.classList.add("pulse");
    setTimeout(() => balanceEl.classList.remove("pulse"), 800);
  }

  function playCoinAnimation(originEl) {
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < 14; i++) {
      const coin = document.createElement("div");
      coin.className = "coin";
      coin.textContent = ["💰", "💵", "🪙"][i % 3];
      coin.style.left = cx + "px";
      coin.style.top  = cy + "px";

      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const dist  = 90 + Math.random() * 80;
      coin.style.setProperty("--tx", Math.cos(angle) * dist + "px");
      coin.style.setProperty("--ty", Math.sin(angle) * dist - 30 + "px");

      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 1300);
    }
  }

  function claimBonus() {
    if (!window.__SS.rateLimit("bonus", 2000)) return;
    if (!canClaimBonus()) return;

    haptic("impact", "heavy");

    lastBonusAt = window.__SS.safeNow();
    balance += BONUS_AMOUNT;

    saveState();
    updateUI();
    updateBonusUI();
    pulseBalance();
    playCoinAnimation(bonusBtn);

    SND.bonus();
    setTimeout(() => SND.coin(), 100);
    setTimeout(() => haptic("notify", "success"), 150);

    setStatus(`🎁 +$${BONUS_AMOUNT.toFixed(3)} bonus qo'shildi!`);
  }

  // ===== SOUND TOGGLE =====
  if (soundToggleEl) {
    soundToggleEl.textContent = SND.isEnabled() ? "🔊" : "🔇";
    soundToggleEl.addEventListener("click", () => {
      const on = SND.toggle();
      soundToggleEl.textContent = on ? "🔊" : "🔇";
      if (on) SND.click();
    });
  }

  // ===== EVENTS =====
  startBtn.addEventListener("click", () => {
    SND.click();
    haptic("impact", "light");
    if (minedSinceAd >= AD_THRESHOLD - 1e-9) {
      showAd();
    } else {
      startMining();
    }
  });

  bonusBtn.addEventListener("click", claimBonus);

  // ===== INIT =====
  (async function init() {
    // Particles background
    PT.init(35);

    loadState();
    await loadCloudState();
    updateUI();
    updateBonusUI();
    startBonusTicker();

    if (balance > 0) {
      setStatus("Balans yuklandi. Davom etish uchun tugmani bosing.");
    }
  })();
})();