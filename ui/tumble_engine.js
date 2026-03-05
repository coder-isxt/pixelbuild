window.GTModules = window.GTModules || {};

(function initTumbleEngineModule() {
  "use strict";

  function normalizeToken(value) {
    return String(value || "").trim().toUpperCase() || "?";
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, Math.max(0, Math.floor(Number(ms) || 0)));
    });
  }

  function rowsFromInput(input) {
    if (Array.isArray(input)) {
      if (!input.length) return [["?"]];
      if (Array.isArray(input[0])) {
        var out = [];
        for (var r = 0; r < input.length; r++) {
          var row = Array.isArray(input[r]) ? input[r] : [];
          out.push(row.map(function (cell) { return normalizeToken(cell); }));
        }
        return out.length ? out : [["?"]];
      }
      var parsed = [];
      for (var i = 0; i < input.length; i++) {
        var text = String(input[i] || "");
        var cells = text.split(",").map(function (cell) { return normalizeToken(cell); }).filter(Boolean);
        parsed.push(cells.length ? cells : ["?"]);
      }
      return parsed.length ? parsed : [["?"]];
    }
    return [["?"]];
  }

  function cloneRows(rows) {
    var safe = Array.isArray(rows) ? rows : [["?"]];
    var out = [];
    for (var r = 0; r < safe.length; r++) {
      var row = Array.isArray(safe[r]) ? safe[r] : ["?"];
      out.push(row.slice());
    }
    return out;
  }

  function applyClearRows(rows, keys) {
    var grid = cloneRows(rows);
    var safeKeys = Array.isArray(keys) ? keys : [];
    for (var i = 0; i < safeKeys.length; i++) {
      var parts = String(safeKeys[i] || "").split("_");
      var r = Math.floor(Number(parts[0]));
      var c = Math.floor(Number(parts[1]));
      if (r < 0 || c < 0 || r >= grid.length || c >= (grid[r] ? grid[r].length : 0)) continue;
      grid[r][c] = "?";
    }
    return grid;
  }

  function sanitizeFrame(rawFrame) {
    var frame = rawFrame && typeof rawFrame === "object" ? rawFrame : {};
    var beforeRows = rowsFromInput(frame.beforeRows || frame.beforeReels || frame.reelsBefore || frame.reels || []);
    var afterRows = rowsFromInput(frame.afterRows || frame.afterReels || frame.reelsAfter || frame.reels || beforeRows);
    var winningKeys = Array.isArray(frame.winningKeys)
      ? frame.winningKeys.map(function (v) { return String(v || ""); }).filter(Boolean)
      : [];
    var clearedKeys = Array.isArray(frame.clearedKeys)
      ? frame.clearedKeys.map(function (v) { return String(v || ""); }).filter(Boolean)
      : winningKeys.slice();
    var effectCells = frame.effectCells && typeof frame.effectCells === "object" ? frame.effectCells : {};
    var lineText = String(frame.lineText || "").trim();
    return {
      index: Math.max(1, Math.floor(Number(frame.index) || 1)),
      payout: Math.max(0, Math.floor(Number(frame.payout) || Number(frame.winPay) || Number(frame.cascadePay) || 0)),
      beforeRows: beforeRows,
      afterRows: afterRows,
      winningKeys: winningKeys.slice(0, 512),
      clearedKeys: clearedKeys.slice(0, 512),
      lineText: lineText,
      effectCells: effectCells,
      markedCells: Array.isArray(frame.markedCells) ? frame.markedCells.slice(0, 512) : [],
      beforeCellMeta: frame.beforeCellMeta && typeof frame.beforeCellMeta === "object" ? frame.beforeCellMeta : {},
      afterCellMeta: frame.afterCellMeta && typeof frame.afterCellMeta === "object" ? frame.afterCellMeta : {}
    };
  }

  function TumbleEngine(config) {
    this.config = config && typeof config === "object" ? config : {};
    this._skipRequested = false;
    this._active = false;
  }

  TumbleEngine.prototype.isRunning = function isRunning() {
    return Boolean(this._active);
  };

  TumbleEngine.prototype.skip = function skip() {
    this._skipRequested = true;
  };

  TumbleEngine.prototype._applyFrame = async function _applyFrame(payload) {
    var fn = this.config && typeof this.config.applyFrame === "function" ? this.config.applyFrame : null;
    if (!fn) return;
    await Promise.resolve(fn(payload && typeof payload === "object" ? payload : {}));
  };

  TumbleEngine.prototype._setIndicator = function _setIndicator(text) {
    var fn = this.config && typeof this.config.setIndicator === "function" ? this.config.setIndicator : null;
    if (!fn) return;
    try { fn(String(text || "")); } catch (_error) { /* no-op */ }
  };

  TumbleEngine.prototype.playSequence = async function playSequence(frames, options) {
    var list = Array.isArray(frames) ? frames : [];
    if (!list.length) return { steps: 0, totalWin: 0 };
    var opts = options && typeof options === "object" ? options : {};
    var turbo = Boolean(opts.turbo);
    var turboScale = turbo ? Math.max(0.2, Math.min(1, Number(opts.turboScale) || 0.42)) : 1;
    var highlightMs = Math.max(30, Math.floor((Number(opts.highlightMs) || 240) * turboScale));
    var clearMs = Math.max(30, Math.floor((Number(opts.clearMs) || 160) * turboScale));
    var fallMs = Math.max(40, Math.floor((Number(opts.fallMs) || 260) * turboScale));

    var onStepWin = typeof opts.onStepWin === "function" ? opts.onStepWin : null;
    var onSequenceStart = typeof opts.onSequenceStart === "function" ? opts.onSequenceStart : null;
    var onSequenceEnd = typeof opts.onSequenceEnd === "function" ? opts.onSequenceEnd : null;

    this._active = true;
    this._skipRequested = false;
    if (onSequenceStart) {
      try { onSequenceStart({ totalSteps: list.length }); } catch (_error) { /* no-op */ }
    }

    var totalWin = 0;
    var finalRows = rowsFromInput(list[list.length - 1] && (list[list.length - 1].afterRows || list[list.length - 1].afterReels || list[list.length - 1].reelsAfter || list[list.length - 1].reels));
    for (var i = 0; i < list.length; i++) {
      var frame = sanitizeFrame(list[i]);
      var tumbleLabel = "TUMBLE x" + (i + 1);
      this._setIndicator(tumbleLabel);

      await this._applyFrame({
        phase: "highlight",
        tumbleIndex: i + 1,
        lineText: frame.lineText || tumbleLabel,
        rows: frame.beforeRows,
        winningKeys: frame.winningKeys,
        markedCells: frame.markedCells,
        cellMeta: frame.beforeCellMeta,
        effectCells: frame.effectCells
      });
      if (!this._skipRequested) await sleep(highlightMs);

      var clearRows = applyClearRows(frame.beforeRows, frame.clearedKeys.length ? frame.clearedKeys : frame.winningKeys);
      await this._applyFrame({
        phase: "clear",
        tumbleIndex: i + 1,
        lineText: frame.lineText || tumbleLabel,
        rows: clearRows,
        winningKeys: [],
        markedCells: frame.markedCells,
        cellMeta: frame.beforeCellMeta,
        effectCells: frame.effectCells
      });
      if (!this._skipRequested) await sleep(clearMs);

      await this._applyFrame({
        phase: "drop",
        tumbleIndex: i + 1,
        lineText: frame.lineText || tumbleLabel,
        rows: frame.afterRows,
        winningKeys: [],
        markedCells: frame.markedCells,
        cellMeta: frame.afterCellMeta,
        effectCells: frame.effectCells
      });
      if (!this._skipRequested) await sleep(fallMs);

      totalWin += frame.payout;
      if (onStepWin) {
        await Promise.resolve(onStepWin({
          tumbleIndex: i + 1,
          totalSteps: list.length,
          payout: frame.payout,
          totalWin: totalWin,
          lineText: frame.lineText || tumbleLabel
        }));
      }

      if (this._skipRequested) {
        await this._applyFrame({
          phase: "settle",
          tumbleIndex: list.length,
          lineText: "TUMBLE SKIPPED",
          rows: finalRows,
          winningKeys: [],
          markedCells: [],
          cellMeta: {},
          effectCells: {}
        });
        break;
      }
    }

    this._setIndicator("");
    this._active = false;
    this._skipRequested = false;
    if (onSequenceEnd) {
      try { onSequenceEnd({ steps: list.length, totalWin: totalWin }); } catch (_error) { /* no-op */ }
    }
    return { steps: list.length, totalWin: totalWin };
  };

  function createTumbleEngine(config) {
    return new TumbleEngine(config);
  }

  window.GTModules.tumbleEngine = {
    createTumbleEngine: createTumbleEngine
  };
})();

