// ============ SECURE STORAGE v3 ============
(function () {
  "use strict";

  // Kalit bo'laklarga ajratilgan (obfuscation)
  var _k = ["a7K", "#mQ", "9$v", "L2@", "pN5", "&wR", "8z!", "xY3"];
  var KEY = _k.join("");

  // FNV-1a 32-bit checksum (8 hex)
  function checksum(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  function xor(s) {
    var o = "";
    for (var i = 0; i < s.length; i++) {
      o += String.fromCharCode(s.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
    }
    return o;
  }

  function enc(obj) {
    try {
      var j = JSON.stringify(obj);
      var sig = checksum(j + KEY);
      var payload = sig + j;
      return btoa(unescape(encodeURIComponent(xor(payload))));
    } catch (e) { return ""; }
  }

  function dec(s) {
    try {
      if (!s || typeof s !== "string") return null;
      var d = decodeURIComponent(escape(atob(s)));
      var p = xor(d);
      var sig = p.slice(0, 8);
      var json = p.slice(8);
      if (checksum(json + KEY) !== sig) return null;
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  // ===== VAQT TAMPER DETECTION =====
  var KEY_TIME = "_sys_t_v1";
  var _lastTime = 0;

  (function initTime() {
    var d = dec(localStorage.getItem(KEY_TIME));
    if (d && typeof d.t === "number" && d.t > 0) _lastTime = d.t;
  })();

  function safeNow() {
    var now = Date.now();
    // Vaqt orqaga ketgan bo'lsa (30 sek+) — clock o'zgartirilgan
    if (_lastTime > 0 && now < _lastTime - 30000) {
      return _lastTime;
    }
    if (now > _lastTime) {
      _lastTime = now;
      try { localStorage.setItem(KEY_TIME, enc({ t: _lastTime })); } catch (e) {}
    }
    return now;
  }

  // ===== RATE LIMIT =====
  var _rate = {};
  function rateLimit(id, ms) {
    var now = Date.now();
    if (_rate[id] && now - _rate[id] < ms) return false;
    _rate[id] = now;
    return true;
  }

  // ===== STATE =====
  var KEY_STATE = "_s_bal_v3";
  var _lastCloudSave = 0;

  function sign(b, m, lb) {
    return checksum(b + "|" + m + "|" + lb + "|" + KEY);
  }

  function verify(d) {
    if (!d || typeof d !== "object") return false;
    if (typeof d.v !== "number" || typeof d.m !== "number" || typeof d.b !== "number") return false;
    return d.s === sign(d.v, d.m, d.b);
  }

  function saveState(balance, mined, bonusAt) {
    var payload = { v: balance, m: mined, b: bonusAt, s: sign(balance, mined, bonusAt) };
    var encrypted = enc(payload);

    // Local: har safar
    try { localStorage.setItem(KEY_STATE, encrypted); } catch (e) {}

    // Cloud: 5 sek throttle
    var now = Date.now();
    if (now - _lastCloudSave > 5000) {
      _lastCloudSave = now;
      try {
        if (window.Telegram && window.Telegram.WebApp && Telegram.WebApp.CloudStorage) {
          Telegram.WebApp.CloudStorage.setItem(KEY_STATE, encrypted);
        }
      } catch (e) {}
    }
  }

  function loadState() {
    var d = dec(localStorage.getItem(KEY_STATE));
    if (!verify(d)) return { v: 0, m: 0, b: 0 };
    return { v: d.v, m: d.m, b: d.b };
  }

  function loadCloudState() {
    return new Promise(function (resolve) {
      if (!window.Telegram || !window.Telegram.WebApp || !Telegram.WebApp.CloudStorage) {
        return resolve(null);
      }
      try {
        Telegram.WebApp.CloudStorage.getItem(KEY_STATE, function (err, val) {
          if (err || !val) return resolve(null);
          var d = dec(val);
          if (!verify(d)) return resolve(null);
          resolve({ v: d.v, m: d.m, b: d.b });
        });
      } catch (e) { resolve(null); }
    });
  }

  // ===== WALLET =====
  var KEY_WALLET = "_w_v3";

  function saveWallet(w) {
    var e = enc({ w: String(w) });
    try { localStorage.setItem(KEY_WALLET, e); } catch (e) {}
    try {
      if (window.Telegram && window.Telegram.WebApp && Telegram.WebApp.CloudStorage) {
        Telegram.WebApp.CloudStorage.setItem(KEY_WALLET, e);
      }
    } catch (e) {}
  }

  function loadWallet() {
    var d = dec(localStorage.getItem(KEY_WALLET));
    return d && typeof d.w === "string" ? d.w : "";
  }

  function loadCloudWallet() {
    return new Promise(function (resolve) {
      if (!window.Telegram || !window.Telegram.WebApp || !Telegram.WebApp.CloudStorage) {
        return resolve("");
      }
      try {
        Telegram.WebApp.CloudStorage.getItem(KEY_WALLET, function (err, val) {
          if (err || !val) return resolve("");
          var d = dec(val);
          resolve(d && typeof d.w === "string" ? d.w : "");
        });
      } catch (e) { resolve(""); }
    });
  }

  // ===== WITHDRAWALS =====
  var KEY_WD = "_wd_v3";

  function saveWithdrawals(arr) {
    var e = enc({ a: arr });
    try { localStorage.setItem(KEY_WD, e); } catch (e) {}
    try {
      if (window.Telegram && window.Telegram.WebApp && Telegram.WebApp.CloudStorage) {
        Telegram.WebApp.CloudStorage.setItem(KEY_WD, e);
      }
    } catch (e) {}
  }

  function loadWithdrawals() {
    var d = dec(localStorage.getItem(KEY_WD));
    return d && Array.isArray(d.a) ? d.a : [];
  }

  // ===== EXPOSE =====
  window.__SS = {
    saveState: saveState,
    loadState: loadState,
    loadCloudState: loadCloudState,
    saveWallet: saveWallet,
    loadWallet: loadWallet,
    loadCloudWallet: loadCloudWallet,
    saveWithdrawals: saveWithdrawals,
    loadWithdrawals: loadWithdrawals,
    safeNow: safeNow,
    rateLimit: rateLimit,
  };
})();