window.GTModules = window.GTModules || {};

(function initWinCounterModule() {
  "use strict";

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function easeOutCubic(value) {
    var x = clamp01(value);
    return 1 - Math.pow(1 - x, 3);
  }

  function easeOutQuint(value) {
    var x = clamp01(value);
    return 1 - Math.pow(1 - x, 5);
  }

  function resolveTier(multiplier, tiers) {
    var mul = Math.max(0, Number(multiplier) || 0);
    var list = Array.isArray(tiers) && tiers.length
      ? tiers.slice()
      : [
        { id: "epic", label: "EPIC WIN", minX: 50 },
        { id: "mega", label: "MEGA WIN", minX: 25 },
        { id: "big", label: "BIG WIN", minX: 10 },
        { id: "win", label: "WIN", minX: 1 }
      ];
    list.sort(function (a, b) {
      return Math.max(0, Number(b && b.minX) || 0) - Math.max(0, Number(a && a.minX) || 0);
    });
    for (var i = 0; i < list.length; i++) {
      var row = list[i] || {};
      if (mul >= Math.max(0, Number(row.minX) || 0)) {
        return {
          id: String(row.id || "win"),
          label: String(row.label || "WIN"),
          minX: Math.max(0, Number(row.minX) || 0)
        };
      }
    }
    return { id: "none", label: "", minX: 0 };
  }

  function estimateDurationMs(delta, multiplier, options) {
    var cfg = options && typeof options === "object" ? options : {};
    var d = Math.max(0, Number(delta) || 0);
    var mul = Math.max(0, Number(multiplier) || 0);
    var minMs = Math.max(120, Math.floor(Number(cfg.minDurationMs) || 300));
    var maxMs = Math.max(minMs, Math.floor(Number(cfg.maxDurationMs) || 5000));
    var duration = 540;
    if (mul >= 50) duration = 3800;
    else if (mul >= 25) duration = 2850;
    else if (mul >= 10) duration = 1850;
    else if (mul >= 3) duration = 1180;
    else duration = 340 + Math.min(440, (Math.log10(d + 1) * 210));
    if (cfg.turbo) duration = duration * Math.max(0.2, Math.min(1, Number(cfg.turboScale) || 0.38));
    if (Number.isFinite(Number(cfg.durationScale))) duration *= Math.max(0.15, Number(cfg.durationScale) || 1);
    return Math.max(minMs, Math.min(maxMs, Math.floor(duration)));
  }

  function WinCounter(config) {
    this.config = config && typeof config === "object" ? config : {};
    this._active = false;
    this._skipRequested = false;
    this._rafId = 0;
    this._runToken = 0;
  }

  WinCounter.prototype.isRunning = function isRunning() {
    return Boolean(this._active);
  };

  WinCounter.prototype.skip = function skip() {
    this._skipRequested = true;
  };

  WinCounter.prototype._cancelFrame = function _cancelFrame() {
    if (this._rafId) {
      try { window.cancelAnimationFrame(this._rafId); } catch (_error) { /* no-op */ }
      this._rafId = 0;
    }
  };

  WinCounter.prototype.startCountUp = function startCountUp(fromValue, toValue, options) {
    var self = this;
    var opts = options && typeof options === "object" ? options : {};
    var from = Math.max(0, Number(fromValue) || 0);
    var to = Math.max(0, Number(toValue) || 0);
    if (to < from) to = from;

    this._cancelFrame();
    this._active = true;
    this._skipRequested = false;
    this._runToken += 1;
    var token = this._runToken;

    var bet = Math.max(1, Number(opts.bet) || 1);
    var multiplier = Number.isFinite(Number(opts.multiplier))
      ? Math.max(0, Number(opts.multiplier))
      : (to / bet);
    var tier = resolveTier(multiplier, opts.tiers);

    var easeName = String(opts.easing || "quint").trim().toLowerCase();
    var easeFn = easeName === "cubic" ? easeOutCubic : easeOutQuint;
    var duration = Number.isFinite(Number(opts.durationMs))
      ? Math.max(60, Math.floor(Number(opts.durationMs)))
      : estimateDurationMs(to - from, multiplier, opts);

    var onUpdate = typeof opts.onUpdate === "function"
      ? opts.onUpdate
      : (typeof self.config.onUpdate === "function" ? self.config.onUpdate : null);
    var onStart = typeof opts.onStart === "function"
      ? opts.onStart
      : (typeof self.config.onStart === "function" ? self.config.onStart : null);
    var onDone = typeof opts.onDone === "function"
      ? opts.onDone
      : (typeof self.config.onDone === "function" ? self.config.onDone : null);
    var onSkip = typeof opts.onSkip === "function"
      ? opts.onSkip
      : (typeof self.config.onSkip === "function" ? self.config.onSkip : null);
    var onLoopStart = typeof opts.onCountLoopStart === "function"
      ? opts.onCountLoopStart
      : (typeof self.config.onCountLoopStart === "function" ? self.config.onCountLoopStart : null);
    var onLoopStop = typeof opts.onCountLoopStop === "function"
      ? opts.onCountLoopStop
      : (typeof self.config.onCountLoopStop === "function" ? self.config.onCountLoopStop : null);

    if (onStart) {
      try { onStart({ from: from, to: to, durationMs: duration, tier: tier, multiplier: multiplier, bet: bet }); } catch (_error) { /* no-op */ }
    }
    if (onLoopStart) {
      try { onLoopStart({ from: from, to: to, tier: tier, multiplier: multiplier, bet: bet }); } catch (_error) { /* no-op */ }
    }

    if (from === to || duration <= 0) {
      if (onUpdate) {
        try { onUpdate(to, { progress: 1, from: from, to: to, tier: tier, multiplier: multiplier, bet: bet }); } catch (_error) { /* no-op */ }
      }
      if (onLoopStop) {
        try { onLoopStop({ skipped: false, finalValue: to, tier: tier, multiplier: multiplier, bet: bet }); } catch (_error) { /* no-op */ }
      }
      if (onDone) {
        try { onDone({ skipped: false, finalValue: to, tier: tier, multiplier: multiplier, bet: bet }); } catch (_error) { /* no-op */ }
      }
      this._active = false;
      return Promise.resolve({ skipped: false, finalValue: to, tier: tier, multiplier: multiplier, bet: bet });
    }

    return new Promise(function (resolve) {
      var startedAt = 0;
      function finish(skipped, value) {
        if (token !== self._runToken) return;
        self._cancelFrame();
        self._active = false;
        var finalValue = Math.max(0, Number(value) || 0);
        if (onUpdate) {
          try { onUpdate(finalValue, { progress: 1, from: from, to: to, tier: tier, multiplier: multiplier, bet: bet }); } catch (_error) { /* no-op */ }
        }
        if (onLoopStop) {
          try { onLoopStop({ skipped: Boolean(skipped), finalValue: finalValue, tier: tier, multiplier: multiplier, bet: bet }); } catch (_error) { /* no-op */ }
        }
        if (skipped && onSkip) {
          try { onSkip({ finalValue: finalValue, tier: tier, multiplier: multiplier, bet: bet }); } catch (_error) { /* no-op */ }
        }
        if (onDone) {
          try { onDone({ skipped: Boolean(skipped), finalValue: finalValue, tier: tier, multiplier: multiplier, bet: bet }); } catch (_error) { /* no-op */ }
        }
        resolve({ skipped: Boolean(skipped), finalValue: finalValue, tier: tier, multiplier: multiplier, bet: bet });
      }

      function step(ts) {
        if (token !== self._runToken) return;
        if (!startedAt) startedAt = ts;
        if (self._skipRequested) {
          self._skipRequested = false;
          finish(true, to);
          return;
        }
        var progress = clamp01((ts - startedAt) / duration);
        var eased = easeFn(progress);
        var next = from + ((to - from) * eased);
        if (onUpdate) {
          try { onUpdate(next, { progress: progress, from: from, to: to, tier: tier, multiplier: multiplier, bet: bet }); } catch (_error) { /* no-op */ }
        }
        if (progress >= 1) {
          finish(false, to);
          return;
        }
        self._rafId = window.requestAnimationFrame(step);
      }

      self._rafId = window.requestAnimationFrame(step);
    });
  };

  function createWinCounter(config) {
    return new WinCounter(config);
  }

  window.GTModules.winCounter = {
    createWinCounter: createWinCounter,
    resolveTier: resolveTier,
    easeOutCubic: easeOutCubic,
    easeOutQuint: easeOutQuint
  };
})();
