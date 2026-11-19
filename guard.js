// ============ TELEGRAM GUARD ============
// Faqat Telegram Mini App ichida ishlaydi.
// Brauzerda ochilsa — ekran qora bo'lib qoladi.
(function () {
  "use strict";

  var tg = (window.Telegram && window.Telegram.WebApp) || null;

  // initData faqat Telegram ichida to'ldiriladi
  var inTelegram = !!(
    tg && (
      (typeof tg.initData === "string" && tg.initData.length > 0) ||
      (tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id)
    )
  );

  window.__TG_BLOCKED__ = !inTelegram;

  if (inTelegram) {
    // Body ko'rinadigan bo'ladi (CSS orqali)
    document.documentElement.classList.add("tg-ready");
    return;
  }

  // ===== BLOKLANGAN =====
  // Darhol qora fon
  try {
    document.documentElement.style.cssText =
      "background:#000 !important;background-color:#000 !important;" +
      "margin:0 !important;padding:0 !important;" +
      "width:100% !important;height:100% !important;" +
      "overflow:hidden !important;";
  } catch (e) {}

  function lock() {
    try {
      var body = document.body;
      if (!body) return;

      // Body bo'shatiladi va qora qilinadi
      if (body.innerHTML.length > 0) body.innerHTML = "";
      body.style.cssText =
        "background:#000 !important;background-color:#000 !important;" +
        "margin:0 !important;padding:0 !important;" +
        "width:100vw !important;height:100vh !important;" +
        "overflow:hidden !important;" +
        "visibility:hidden !important;" +
        "position:fixed !important;inset:0 !important;" +
        "z-index:2147483647 !important;";
    } catch (e) {}
  }

  if (document.body) lock();
  document.addEventListener("DOMContentLoaded", lock);
  window.addEventListener("load", lock);

  // Kechikkan injectlarga qarshi — 20 marta tekshiradi (~3 sekund)
  var attempts = 0;
  var iv = setInterval(function () {
    attempts++;
    if (!window.__TG_BLOCKED__) { clearInterval(iv); return; }
    lock();
    if (attempts >= 20) clearInterval(iv);
  }, 150);
})();