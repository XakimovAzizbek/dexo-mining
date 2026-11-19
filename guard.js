// ============ GUARD v2: Telegram + Domain + initData ============
(function () {
  "use strict";

  // ⚠️ O'Z DOMEningizni kiriting! (bo'sh = o'tkazib yuboriladi)
  var ALLOWED_ORIGINS = [
    // "https://your-app.vercel.app",
    // "https://your-app.netlify.app",
    // "https://your-app.pages.dev",
  ];

  function blackScreen() {
    try {
      document.documentElement.style.cssText =
        "background:#000 !important;background-color:#000 !important;" +
        "margin:0 !important;padding:0 !important;" +
        "width:100% !important;height:100% !important;" +
        "overflow:hidden !important;";
    } catch (e) {}
    try {
      var b = document.body;
      if (b) {
        if (b.innerHTML.length > 0) b.innerHTML = "";
        b.style.cssText =
          "background:#000 !important;background-color:#000 !important;" +
          "margin:0 !important;padding:0 !important;" +
          "width:100vw !important;height:100vh !important;" +
          "overflow:hidden !important;" +
          "visibility:hidden !important;" +
          "position:fixed !important;inset:0 !important;" +
          "z-index:2147483647 !important;";
      }
    } catch (e) {}
  }

  function block() {
    window.__TG_BLOCKED__ = true;
    blackScreen();
    document.addEventListener("DOMContentLoaded", blackScreen);
    window.addEventListener("load", blackScreen);
    var n = 0;
    var iv = setInterval(function () {
      n++;
      blackScreen();
      if (n >= 20) clearInterval(iv);
    }, 150);
  }

  // 1) DOMAIN LOCK
  if (ALLOWED_ORIGINS.length > 0) {
    var origin = window.location.origin;
    if (ALLOWED_ORIGINS.indexOf(origin) === -1) return block();
  }

  // 2) TELEGRAM MAVJUDLIGI
  var tg = (window.Telegram && window.Telegram.WebApp) || null;
  if (!tg) return block();

  // 3) initData STRUKTURA VALIDATSIYASI
  var initData = tg.initData || "";
  var user = tg.initDataUnsafe && tg.initDataUnsafe.user;

  if (!initData || initData.length < 50) return block();
  if (!user || typeof user.id !== "number" || user.id <= 0) return block();

  var authDate = parseInt((tg.initDataUnsafe && tg.initDataUnsafe.auth_date) || "0", 10);
  if (!authDate) return block();
  // auth_date kelajakda bo'lmasligi
  if (authDate * 1000 > Date.now() + 60 * 60 * 1000) return block();

  // hash parametri bor-yo'qligi
  var hasHash = false;
  try {
    var params = new URLSearchParams(initData);
    hasHash = !!params.get("hash");
  } catch (e) {}
  if (!hasHash) return block();

  // Platform whitelist
  var platforms = ["android", "ios", "tdesktop", "macos", "web", "weba", "webk", "webz"];
  if (platforms.indexOf(tg.platform) === -1) return block();

  // ✅ O'TDI
  window.__TG_BLOCKED__ = false;
  document.documentElement.classList.add("tg-ready");
})();