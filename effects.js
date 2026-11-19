// ============ EFFECTS: Sound + Particles ============
(function () {
  "use strict";

  // ===== SOUND MANAGER (Web Audio API) =====
  var _sndEnabled = true;
  try {
    _sndEnabled = localStorage.getItem("_snd_v1") !== "0";
  } catch (e) {}

  var _audioCtx = null;
  var _audioReady = false;

  function initAudio() {
    if (_audioReady) return;
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (_audioCtx.state === "suspended") _audioCtx.resume();
      _audioReady = true;
    } catch (e) {}
  }

  function playTone(freq, duration, type, volume) {
    if (!_sndEnabled) return;
    if (!_audioReady) initAudio();
    if (!_audioCtx) return;
    try {
      var osc = _audioCtx.createOscillator();
      var gain = _audioCtx.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume || 0.1, _audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.start(_audioCtx.currentTime);
      osc.stop(_audioCtx.currentTime + duration);
    } catch (e) {}
  }

  var SoundManager = {
    init: initAudio,
    click: function () { playTone(800, 0.06, "square", 0.08); },
    tick: function () { playTone(700, 0.03, "sine", 0.04); },
    coin: function () {
      playTone(1000, 0.08, "sine", 0.12);
      setTimeout(function () { playTone(1500, 0.12, "sine", 0.1); }, 60);
    },
    bonus: function () {
      playTone(880, 0.08, "triangle", 0.12);
      setTimeout(function () { playTone(1100, 0.12, "triangle", 0.12); }, 80);
      setTimeout(function () { playTone(1320, 0.15, "triangle", 0.12); }, 160);
    },
    success: function () {
      playTone(523, 0.1, "sine", 0.15);
      setTimeout(function () { playTone(659, 0.1, "sine", 0.15); }, 100);
      setTimeout(function () { playTone(784, 0.15, "sine", 0.15); }, 200);
    },
    error: function () {
      playTone(200, 0.15, "sawtooth", 0.1);
    },
    toggle: function () {
      _sndEnabled = !_sndEnabled;
      try { localStorage.setItem("_snd_v1", _sndEnabled ? "1" : "0"); } catch (e) {}
      if (_sndEnabled) initAudio();
      return _sndEnabled;
    },
    isEnabled: function () { return _sndEnabled; }
  };

  // ===== PARTICLES MANAGER (Canvas) =====
  var Particles = {
    _raf: null,
    _ctx: null,
    _canvas: null,
    _particles: [],

    init: function (count) {
      var canvas = document.getElementById("particles");
      if (!canvas) return;
      this._canvas = canvas;
      this._ctx = canvas.getContext("2d");
      var self = this;

      function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      resize();
      window.addEventListener("resize", resize);

      var n = count || 35;
      for (var i = 0; i < n; i++) {
        this._particles.push(this._create());
      }
      this._loop();
    },

    _create: function () {
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.5 + 0.4,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        alpha: Math.random() * 0.4 + 0.15,
        color: Math.random() > 0.5 ? "0,230,118" : "0,176,255",
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02
      };
    },

    _loop: function () {
      var self = this;
      var ctx = this._ctx;
      var canvas = this._canvas;
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (var i = 0; i < this._particles.length; i++) {
        var p = this._particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;

        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        var a = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + p.color + "," + a + ")";
        ctx.fill();
      }

      this._raf = requestAnimationFrame(function () { self._loop(); });
    }
  };

  window.__SND = SoundManager;
  window.__PT = Particles;
})();