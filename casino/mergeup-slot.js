(function initMergeUpSlot() {
  "use strict";

  const SAVED_AUTH_KEY = "growtopia_saved_auth_v1";
  const SLOT_TRANSFER_KEY = "gt_casino_slot_transfer_v1";
  const BASE_PATH = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");

  const dbModule = (window.GTModules && window.GTModules.db) || {};
  const authModule = (window.GTModules && window.GTModules.auth) || {};
  const authStorageModule = (window.GTModules && window.GTModules.authStorage) || {};
  const catalogModule = (window.GTModules && window.GTModules.itemCatalog) || {};

  const SLOT_STATE = {
    IDLE: "IDLE",
    SPIN_START: "SPIN_START",
    REVEAL: "REVEAL",
    EVALUATE: "EVALUATE",
    WIN_ANIMATION: "WIN_ANIMATION",
    MERGE: "MERGE",
    REFILL: "REFILL",
    BONUS_INTRO: "BONUS_INTRO",
    BONUS_SPIN: "BONUS_SPIN",
    BONUS_SUMMARY: "BONUS_SUMMARY",
    CREDIT: "CREDIT"
  };

  const gameConfig = {
    rows: 6,
    cols: 6,
    minCluster: 5,
    defaultBet: 20,
    minBet: 1,
    maxBet: 5000,
    initialBalance: 50000,
    buyBonusCostMultiplier: 120,
    maxCascadesPerSpin: 80,
    freeSpinsTrigger: { 4: 15, 5: 18, 6: 20 },
    freeSpinsRetrigger: { 4: 5, 5: 8, 6: 10 },
    markerStartMultiplier: 2,
    maxCellMultiplier: 128,
    maxWinMultiplier: 5000000,
    rtp: "96.00%",
    volatility: "High",
    autoplayOptions: [0, 10, 25, 50, 100],
    tierByBetMultiplier: [
      { ratio: 80, label: "EPIC WIN" },
      { ratio: 40, label: "MEGA WIN" },
      { ratio: 20, label: "BIG WIN" },
      { ratio: 8, label: "NICE WIN" },
      { ratio: 1, label: "WIN" }
    ]
  };

  const symbolConfig = [
    { id: "lv1", name: "Duck Lv1", level: 1, weight: 24, scatter: false, wild: false, payoutBySize: { 4: 0.16, 5: 0.24, 6: 0.33, 7: 0.44, 8: 0.58, 10: 0.8 } },
    { id: "lv2", name: "Duck Lv2", level: 2, weight: 20, scatter: false, wild: false, payoutBySize: { 4: 0.2, 5: 0.3, 6: 0.42, 7: 0.56, 8: 0.72, 10: 1.0 } },
    { id: "lv3", name: "Duck Lv3", level: 3, weight: 17, scatter: false, wild: false, payoutBySize: { 4: 0.26, 5: 0.38, 6: 0.54, 7: 0.7, 8: 0.92, 10: 1.25 } },
    { id: "lv4", name: "Duck Lv4", level: 4, weight: 14, scatter: false, wild: false, payoutBySize: { 4: 0.34, 5: 0.5, 6: 0.7, 7: 0.92, 8: 1.2, 10: 1.66 } },
    { id: "lv5", name: "Duck Lv5", level: 5, weight: 11, scatter: false, wild: false, payoutBySize: { 4: 0.46, 5: 0.66, 6: 0.92, 7: 1.2, 8: 1.56, 10: 2.2 } },
    { id: "lv6", name: "Duck Lv6", level: 6, weight: 8, scatter: false, wild: false, payoutBySize: { 4: 0.62, 5: 0.88, 6: 1.22, 7: 1.58, 8: 2.1, 10: 3.0 } },
    { id: "lv7", name: "Duck Lv7", level: 7, weight: 5, scatter: false, wild: false, payoutBySize: { 4: 0.88, 5: 1.2, 6: 1.7, 7: 2.2, 8: 3.0, 10: 4.6 } },
    { id: "lv8", name: "Duck Lv8", level: 8, weight: 3, scatter: false, wild: false, payoutBySize: { 4: 1.3, 5: 1.9, 6: 2.6, 7: 3.4, 8: 4.8, 10: 7.2 } },
    { id: "lv9", name: "Duck Lv9", level: 9, weight: 2, scatter: false, wild: false, payoutBySize: { 4: 2.0, 5: 2.8, 6: 3.9, 7: 5.2, 8: 7.4, 10: 11.0 } },
    { id: "scatter", name: "Scatter", level: 0, weight: 2, scatter: true, wild: false, payoutBySize: {} }
  ];

  const symbolMap = {};
  for (let i = 0; i < symbolConfig.length; i++) symbolMap[symbolConfig[i].id] = symbolConfig[i];

  const el = {
    phaseValue: document.getElementById("phaseValue"),
    fsValue: document.getElementById("fsValue"),
    soundBtn: document.getElementById("soundBtn"),
    turboBtn: document.getElementById("turboBtn"),
    autoplayBtn: document.getElementById("autoplayBtn"),
    infoBtn: document.getElementById("infoBtn"),
    backBtn: document.getElementById("backBtn"),
    balanceValue: document.getElementById("balanceValue"),
    betValue: document.getElementById("betValue"),
    spinWinValue: document.getElementById("spinWinValue"),
    tumbleWinValue: document.getElementById("tumbleWinValue"),
    bonusWinValue: document.getElementById("bonusWinValue"),
    grid: document.getElementById("grid"),
    spinArea: document.getElementById("spinArea"),
    floatingLayer: document.getElementById("floatingLayer"),
    banner: document.getElementById("banner"),
    message: document.getElementById("message"),
    betDownBtn: document.getElementById("betDownBtn"),
    betInput: document.getElementById("betInput"),
    betUpBtn: document.getElementById("betUpBtn"),
    betMaxBtn: document.getElementById("betMaxBtn"),
    spinBtn: document.getElementById("spinBtn"),
    buyBonusBtn: document.getElementById("buyBonusBtn"),
    historyList: document.getElementById("historyList"),
    dbgForceScatter: document.getElementById("dbgForceScatter"),
    dbgForceBigWin: document.getElementById("dbgForceBigWin"),
    dbgLogClusters: document.getElementById("dbgLogClusters"),
    dbgUseCustomGrid: document.getElementById("dbgUseCustomGrid"),
    dbgCustomGrid: document.getElementById("dbgCustomGrid"),
    dbgLogResultBtn: document.getElementById("dbgLogResultBtn"),
    debugOutput: document.getElementById("debugOutput"),
    infoModal: document.getElementById("infoModal"),
    infoContent: document.getElementById("infoContent"),
    closeInfoBtn: document.getElementById("closeInfoBtn")
  };

  function toInt(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatWL(value) {
    return toInt(value, 0).toLocaleString("en-US") + " WL";
  }

  function resolveLockCurrencies() {
    const fallback = [
      { id: 43, key: "ruby_lock", value: 1000000, short: "RL" },
      { id: 42, key: "emerald_lock", value: 10000, short: "EL" },
      { id: 24, key: "obsidian_lock", value: 100, short: "OL" },
      { id: 9, key: "world_lock", value: 1, short: "WL" }
    ];
    if (typeof catalogModule.getBlocks !== "function") return fallback;
    const rows = catalogModule.getBlocks();
    if (!Array.isArray(rows)) return fallback;
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      if (!row.worldLock) continue;
      const id = Math.floor(Number(row.id));
      if (!Number.isInteger(id) || id <= 0) continue;
      const value = Math.max(1, Math.floor(Number(row.lockValue) || 1));
      const key = String(row.key || "").trim() || ("lock_" + id);
      let short = "WL";
      if (key === "ruby_lock") short = "RL";
      else if (key === "emerald_lock") short = "EL";
      else if (key === "obsidian_lock") short = "OL";
      out.push({ id, key, value, short });
    }
    if (!out.length) return fallback;
    out.sort((a, b) => (b.value - a.value) || (a.id - b.id));
    return out;
  }

  function walletFromInventory(rawObj, lockRows) {
    const input = rawObj && typeof rawObj === "object" ? rawObj : {};
    const rows = Array.isArray(lockRows) ? lockRows : [];
    const byId = {};
    let total = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const count = Math.max(0, Math.floor(Number(input[row.id]) || 0));
      byId[row.id] = count;
      total += count * row.value;
    }
    return { total, byId };
  }

  function decomposeLocks(total, lockRows) {
    const rows = Array.isArray(lockRows) ? lockRows : [];
    let remaining = Math.max(0, Math.floor(Number(total) || 0));
    const out = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const count = Math.floor(remaining / row.value);
      out[row.id] = Math.max(0, count);
      remaining -= count * row.value;
    }
    return out;
  }

  function cloneGrid(grid) {
    return grid.map((row) => row.slice());
  }

  function createEmptyMarkerGrid(rows, cols) {
    const out = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push({ marked: false, multiplier: 1 });
      out.push(row);
    }
    return out;
  }

  function cloneMarkerGrid(markers) {
    return markers.map((row) => row.map((cell) => ({ marked: Boolean(cell.marked), multiplier: toInt(cell.multiplier, 1) })));
  }

  function countScatterCells(grid) {
    let count = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) if (grid[r][c] === "scatter") count += 1;
    }
    return count;
  }

  class RNG {
    constructor(seed) {
      this.seed = (toInt(seed, Date.now()) >>> 0) || 123456789;
    }

    next() {
      this.seed = (1664525 * this.seed + 1013904223) >>> 0;
      return this.seed / 4294967296;
    }

    int(maxExclusive) {
      const max = Math.max(1, toInt(maxExclusive, 1));
      return Math.floor(this.next() * max);
    }
  }

  class AudioManager {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = true;
      this.volume = 0.35;
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
    }

    unlock() {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
    }

    ping(freq, ms, type, volume) {
      if (!this.enabled) return;
      this.unlock();
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(volume || 0.06, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (ms / 1000));
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + (ms / 1000) + 0.02);
    }

    play(eventName) {
      const e = String(eventName || "");
      if (e === "spin_start") this.ping(160, 140, "triangle", 0.06);
      else if (e === "land") this.ping(220, 85, "square", 0.045);
      else if (e === "cluster_small") this.ping(300, 100, "triangle", 0.05);
      else if (e === "cluster_mid") {
        this.ping(360, 120, "triangle", 0.06);
        this.ping(430, 130, "triangle", 0.06);
      } else if (e === "cluster_big") {
        this.ping(250, 160, "sawtooth", 0.07);
        this.ping(460, 220, "triangle", 0.065);
      } else if (e === "merge") this.ping(540, 110, "square", 0.055);
      else if (e === "scatter") this.ping(620, 170, "triangle", 0.065);
      else if (e === "anticipation") this.ping(190, 190, "sawtooth", 0.055);
      else if (e === "bonus_intro") {
        this.ping(280, 180, "triangle", 0.07);
        this.ping(520, 260, "triangle", 0.07);
      } else if (e === "multiplier") this.ping(760, 110, "square", 0.055);
      else if (e === "spin_tick") this.ping(200, 70, "triangle", 0.04);
      else if (e === "big_win") {
        this.ping(240, 220, "sawtooth", 0.08);
        this.ping(460, 240, "triangle", 0.075);
        this.ping(780, 260, "triangle", 0.07);
      } else if (e === "credit") this.ping(430, 110, "triangle", 0.055);
    }
  }

  class WinCounter {
    constructor() {
      this.active = null;
    }

    skip() {
      if (this.active) this.active.skip = true;
    }

    animate(from, to, duration, onUpdate) {
      const startValue = Number(from) || 0;
      const endValue = Number(to) || 0;
      const ms = Math.max(0, toInt(duration, 0));
      if (!ms || startValue === endValue) {
        onUpdate(endValue);
        return Promise.resolve(endValue);
      }

      if (this.active) this.active.skip = true;
      const ticket = { skip: false };
      this.active = ticket;

      return new Promise((resolve) => {
        const started = performance.now();
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        const frame = (now) => {
          if (ticket.skip) {
            onUpdate(endValue);
            if (this.active === ticket) this.active = null;
            resolve(endValue);
            return;
          }
          const t = clamp((now - started) / ms, 0, 1);
          const eased = easeOutCubic(t);
          const current = startValue + (endValue - startValue) * eased;
          onUpdate(t >= 1 ? endValue : current);
          if (t >= 1) {
            if (this.active === ticket) this.active = null;
            resolve(endValue);
            return;
          }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    }
  }

  class MergeUpEngine {
    constructor(config, symbols) {
      this.config = config;
      this.symbols = symbols;
      this.symbolMap = {};
      this.weightedPool = [];
      this.weightedNoScatterPool = [];
      for (let i = 0; i < symbols.length; i++) {
        const sym = symbols[i];
        this.symbolMap[sym.id] = sym;
        for (let w = 0; w < Math.max(1, toInt(sym.weight, 1)); w++) {
          this.weightedPool.push(sym.id);
          if (!sym.scatter) this.weightedNoScatterPool.push(sym.id);
        }
      }
    }

    scatterToFreeSpins(scatterCount) {
      const n = toInt(scatterCount, 0);
      if (n >= 6) return this.config.freeSpinsTrigger[6];
      if (n === 5) return this.config.freeSpinsTrigger[5];
      if (n === 4) return this.config.freeSpinsTrigger[4];
      return 0;
    }

    scatterToRetrigger(scatterCount) {
      const n = toInt(scatterCount, 0);
      if (n >= 6) return this.config.freeSpinsRetrigger[6];
      if (n === 5) return this.config.freeSpinsRetrigger[5];
      if (n === 4) return this.config.freeSpinsRetrigger[4];
      return 0;
    }

    chooseRandomSymbol(rng, allowScatter) {
      const pool = allowScatter ? this.weightedPool : this.weightedNoScatterPool;
      return pool[rng.int(pool.length)];
    }

    parseCustomGrid(rawText) {
      const text = String(rawText || "").trim();
      if (!text) return null;
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length !== this.config.rows) throw new Error("Custom grid must have 6 rows.");
      const out = [];
      for (let r = 0; r < this.config.rows; r++) {
        const rowRaw = parsed[r];
        if (!Array.isArray(rowRaw) || rowRaw.length !== this.config.cols) throw new Error("Each custom row must have 6 symbols.");
        const row = [];
        for (let c = 0; c < this.config.cols; c++) {
          const tokenRaw = String(rowRaw[c]).trim().toLowerCase();
          const token = tokenRaw === "s" || tokenRaw === "sc" ? "scatter" : tokenRaw;
          const normalized = /^\d+$/.test(token) ? ("lv" + token) : token;
          if (!this.symbolMap[normalized]) throw new Error("Unknown symbol: " + tokenRaw);
          row.push(normalized);
        }
        out.push(row);
      }
      return out;
    }

    generateGrid(rng, opts) {
      const options = opts || {};
      if (Array.isArray(options.customGrid)) return cloneGrid(options.customGrid);

      const grid = [];
      for (let r = 0; r < this.config.rows; r++) {
        const row = [];
        for (let c = 0; c < this.config.cols; c++) row.push(this.chooseRandomSymbol(rng, true));
        grid.push(row);
      }

      if (options.forceBigWin) {
        const forcedCells = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 1], [3, 2]];
        for (let i = 0; i < forcedCells.length; i++) {
          const cell = forcedCells[i];
          grid[cell[0]][cell[1]] = "lv8";
        }
      }

      const minScatter = toInt(options.forceScatterAtLeast, 0);
      if (minScatter > 0) {
        const existing = countScatterCells(grid);
        let need = Math.max(0, minScatter - existing);
        const cells = [];
        for (let r = 0; r < this.config.rows; r++) {
          for (let c = 0; c < this.config.cols; c++) if (grid[r][c] !== "scatter") cells.push([r, c]);
        }
        while (need > 0 && cells.length) {
          const idx = rng.int(cells.length);
          const cell = cells.splice(idx, 1)[0];
          grid[cell[0]][cell[1]] = "scatter";
          need -= 1;
        }
      }
      return grid;
    }

    getPayoutMultiplier(symbolId, clusterSize) {
      const sym = this.symbolMap[symbolId];
      if (!sym || !sym.payoutBySize) return 0;
      const size = toInt(clusterSize, 0);
      const keys = Object.keys(sym.payoutBySize).map((k) => toInt(k, 0)).sort((a, b) => a - b);
      let picked = keys[0] || 0;
      for (let i = 0; i < keys.length; i++) if (size >= keys[i]) picked = keys[i];
      return Number(sym.payoutBySize[picked] || 0);
    }

    // Cluster detection uses flood fill with orthogonal neighbors only.
    findClusters(grid) {
      const rows = this.config.rows;
      const cols = this.config.cols;
      const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
      const clusters = [];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (visited[r][c]) continue;
          visited[r][c] = true;
          const symbolId = grid[r][c];
          if (!symbolId) continue;
          const sym = this.symbolMap[symbolId];
          if (!sym || sym.scatter) continue;

          const queue = [[r, c]];
          const cells = [[r, c]];
          while (queue.length) {
            const cur = queue.shift();
            for (let d = 0; d < dirs.length; d++) {
              const nr = cur[0] + dirs[d][0];
              const nc = cur[1] + dirs[d][1];
              if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
              if (visited[nr][nc]) continue;
              visited[nr][nc] = true;
              if (grid[nr][nc] !== symbolId) continue;
              queue.push([nr, nc]);
              cells.push([nr, nc]);
            }
          }

          if (cells.length >= this.config.minCluster) {
            let minRow = rows;
            let minCol = cols;
            let maxRow = -1;
            let maxCol = -1;
            for (let i = 0; i < cells.length; i++) {
              const p = cells[i];
              minRow = Math.min(minRow, p[0]);
              minCol = Math.min(minCol, p[1]);
              maxRow = Math.max(maxRow, p[0]);
              maxCol = Math.max(maxCol, p[1]);
            }
            clusters.push({ symbolId, cells, size: cells.length, bounds: { minRow, minCol, maxRow, maxCol } });
          }
        }
      }

      clusters.sort((a, b) => {
        if (a.bounds.minRow !== b.bounds.minRow) return a.bounds.minRow - b.bounds.minRow;
        if (a.bounds.minCol !== b.bounds.minCol) return a.bounds.minCol - b.bounds.minCol;
        if (a.size !== b.size) return b.size - a.size;
        return a.symbolId < b.symbolId ? -1 : 1;
      });
      return clusters;
    }

    chooseMergeAnchor(clusterCells) {
      const sorted = clusterCells.slice().sort((a, b) => {
        if (a[0] !== b[0]) return b[0] - a[0];
        return a[1] - b[1];
      });
      return sorted[0];
    }

    getUpgradedSymbol(symbolId) {
      const sym = this.symbolMap[symbolId];
      if (!sym || sym.scatter) return symbolId;
      return "lv" + clamp(sym.level + 1, 1, 9);
    }

    refillGrid(gridAfterMerge, rng) {
      const rows = this.config.rows;
      const cols = this.config.cols;
      const out = Array.from({ length: rows }, () => Array(cols).fill(null));
      const moves = [];
      const spawns = [];

      for (let c = 0; c < cols; c++) {
        let write = rows - 1;
        for (let read = rows - 1; read >= 0; read--) {
          const symbolId = gridAfterMerge[read][c];
          if (!symbolId) continue;
          out[write][c] = symbolId;
          if (write !== read) moves.push({ from: [read, c], to: [write, c], symbolId });
          write -= 1;
        }
        for (let r = write; r >= 0; r--) {
          const symbolId = this.chooseRandomSymbol(rng, true);
          out[r][c] = symbolId;
          spawns.push({ to: [r, c], symbolId, dropDistance: (write - r) + 1 });
        }
      }
      return { grid: out, moves, spawns };
    }

    // Single cascade step: evaluate wins, merge cells up, update bonus markers, refill.
    resolveCascadeStep(params) {
      const p = params || {};
      const grid = p.grid;
      const bet = toInt(p.bet, 0);
      const isBonus = Boolean(p.isBonus);
      const markers = p.markers || null;
      const rng = p.rng;
      const clusters = this.findClusters(grid);
      if (!clusters.length) return null;

      const gridBefore = cloneGrid(grid);
      const gridAfterMerge = cloneGrid(grid);
      const markerBefore = markers ? cloneMarkerGrid(markers) : null;
      const mergeOps = [];
      const wins = [];
      let stepWin = 0;

      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        const sym = this.symbolMap[cluster.symbolId];
        const anchor = this.chooseMergeAnchor(cluster.cells);
        const upgradedSymbolId = this.getUpgradedSymbol(cluster.symbolId);
        const basePayout = Math.floor(bet * this.getPayoutMultiplier(cluster.symbolId, cluster.size));

        let multiplierApplied = 1;
        const activeCellMultipliers = [];
        if (isBonus && markers) {
          for (let k = 0; k < cluster.cells.length; k++) {
            const cell = cluster.cells[k];
            const mk = markers[cell[0]][cell[1]];
            if (mk && mk.marked) {
              multiplierApplied = Math.max(multiplierApplied, toInt(mk.multiplier, 1));
              activeCellMultipliers.push(toInt(mk.multiplier, 1));
            }
          }
        }

        const payout = Math.floor(basePayout * multiplierApplied);
        stepWin += payout;
        wins.push({
          clusterId: i + 1,
          symbolId: cluster.symbolId,
          symbolLevel: sym.level,
          size: cluster.size,
          cells: cluster.cells.map((cell) => [cell[0], cell[1]]),
          anchor: [anchor[0], anchor[1]],
          basePayout,
          multiplierApplied,
          payoutAfterMultiplier: payout,
          activeCellMultipliers
        });

        for (let k = 0; k < cluster.cells.length; k++) {
          const cell = cluster.cells[k];
          gridAfterMerge[cell[0]][cell[1]] = null;
        }
        gridAfterMerge[anchor[0]][anchor[1]] = upgradedSymbolId;

        mergeOps.push({
          clusterId: i + 1,
          fromSymbolId: cluster.symbolId,
          toSymbolId: upgradedSymbolId,
          anchor: [anchor[0], anchor[1]],
          consumedCells: cluster.cells.map((cell) => [cell[0], cell[1]])
        });
      }

      if (isBonus && markers) {
        for (let i = 0; i < wins.length; i++) {
          for (let k = 0; k < wins[i].cells.length; k++) {
            const cell = wins[i].cells[k];
            const mk = markers[cell[0]][cell[1]];
            if (!mk.marked) {
              mk.marked = true;
              mk.multiplier = this.config.markerStartMultiplier;
            } else {
              mk.multiplier = Math.min(this.config.maxCellMultiplier, mk.multiplier * 2);
            }
          }
        }
      }

      const markerAfter = markers ? cloneMarkerGrid(markers) : null;
      const refill = this.refillGrid(gridAfterMerge, rng);

      return {
        clusters: wins,
        mergeOps,
        stepWin,
        gridBefore,
        gridAfterMerge,
        markerBefore,
        markerAfter,
        refillMoves: refill.moves,
        refillSpawns: refill.spawns,
        gridAfterRefill: refill.grid
      };
    }

    resolveSpinChain(params) {
      const p = params || {};
      const rng = p.rng;
      const bet = toInt(p.bet, 0);
      const isBonus = Boolean(p.isBonus);
      const markers = p.markers || null;
      let grid = cloneGrid(p.startGrid);
      const steps = [];
      let totalWin = 0;

      for (let i = 0; i < this.config.maxCascadesPerSpin; i++) {
        const step = this.resolveCascadeStep({ rng, bet, isBonus, markers, grid });
        if (!step) break;
        step.index = i + 1;
        totalWin += step.stepWin;
        step.runningTotal = totalWin;
        steps.push(step);
        grid = cloneGrid(step.gridAfterRefill);
      }

      return {
        initialGrid: cloneGrid(p.startGrid),
        steps,
        finalGrid: grid,
        totalWin,
        scatterCount: countScatterCells(grid)
      };
    }

    resolveBonusRound(params) {
      const p = params || {};
      const rng = p.rng;
      const bet = toInt(p.bet, 0);
      const initialSpins = toInt(p.initialSpins, 0);
      const markers = createEmptyMarkerGrid(this.config.rows, this.config.cols);
      const spins = [];
      let spinsLeft = initialSpins;
      let totalWin = 0;
      let topMultiplier = 1;

      for (let spinNo = 1; spinsLeft > 0 && spinNo <= 1000; spinNo++) {
        spinsLeft -= 1;
        const markerSnapshotBefore = cloneMarkerGrid(markers);
        const startGrid = this.generateGrid(rng, {});
        const chain = this.resolveSpinChain({ rng, bet, startGrid, isBonus: true, markers });
        const retrigger = this.scatterToRetrigger(chain.scatterCount);
        if (retrigger > 0) spinsLeft += retrigger;
        totalWin += chain.totalWin;

        for (let r = 0; r < markers.length; r++) {
          for (let c = 0; c < markers[r].length; c++) {
            if (markers[r][c].marked) topMultiplier = Math.max(topMultiplier, markers[r][c].multiplier);
          }
        }

        spins.push({
          spinIndex: spinNo,
          chain,
          markerSnapshotBefore,
          retriggerAward: retrigger,
          scatterCount: chain.scatterCount,
          spinsLeftAfter: spinsLeft,
          markerSnapshotAfter: cloneMarkerGrid(markers)
        });
      }

      return { triggered: true, initialSpins, spins, totalWin, topMultiplier };
    }

    resolvePaidSpinOutcome(params) {
      const p = params || {};
      const rng = p.rng;
      const bet = toInt(p.bet, 0);
      const debug = p.debug || {};
      const forcedCustomGrid = Array.isArray(debug.customGrid) ? debug.customGrid : null;

      const baseStartGrid = this.generateGrid(rng, {
        forceScatterAtLeast: debug.forceScatterTrigger ? 4 : 0,
        forceBigWin: Boolean(debug.forceBigWin),
        customGrid: forcedCustomGrid
      });

      const base = this.resolveSpinChain({ rng, bet, startGrid: baseStartGrid, isBonus: false, markers: null });
      let freeSpinsAward = this.scatterToFreeSpins(base.scatterCount);
      if (debug.forceScatterTrigger && freeSpinsAward <= 0) freeSpinsAward = this.config.freeSpinsTrigger[4];

      let bonus = { triggered: false, initialSpins: 0, spins: [], totalWin: 0, topMultiplier: 1 };
      if (freeSpinsAward > 0) bonus = this.resolveBonusRound({ rng, bet, initialSpins: freeSpinsAward });

      const totalWinRaw = toInt(base.totalWin, 0) + toInt(bonus.totalWin, 0);
      const cap = bet * this.config.maxWinMultiplier;
      const totalWin = Math.min(totalWinRaw, cap);

      return {
        kind: "paid",
        bet,
        base: { chain: base, freeSpinsAward, triggeredBonus: freeSpinsAward > 0 },
        bonus,
        totalWinRaw,
        totalWin,
        maxWinCapped: totalWin !== totalWinRaw,
        debug: {
          forceScatterTrigger: Boolean(debug.forceScatterTrigger),
          forceBigWin: Boolean(debug.forceBigWin),
          usedCustomGrid: Array.isArray(forcedCustomGrid)
        }
      };
    }

    resolveBonusPurchaseOutcome(params) {
      const p = params || {};
      const rng = p.rng;
      const bet = toInt(p.bet, 0);
      const initialSpins = this.config.freeSpinsTrigger[4];
      const bonus = this.resolveBonusRound({ rng, bet, initialSpins });
      const totalWinRaw = toInt(bonus.totalWin, 0);
      const cap = bet * this.config.maxWinMultiplier;
      const totalWin = Math.min(totalWinRaw, cap);

      return {
        kind: "buy_bonus",
        bet,
        base: {
          chain: {
            initialGrid: this.generateGrid(rng, {}),
            steps: [],
            finalGrid: this.generateGrid(rng, {}),
            totalWin: 0,
            scatterCount: 0
          },
          freeSpinsAward: initialSpins,
          triggeredBonus: true
        },
        bonus,
        totalWinRaw,
        totalWin,
        maxWinCapped: totalWin !== totalWinRaw,
        debug: {
          forceScatterTrigger: false,
          forceBigWin: false,
          usedCustomGrid: false,
          buyBonus: true
        }
      };
    }
  }

  const audio = new AudioManager();
  const counter = new WinCounter();
  const engine = new MergeUpEngine(gameConfig, symbolConfig);

  const settingsKey = "mergeup_slot_ui_v1";
  const saved = loadSettings();

  const state = {
    phase: SLOT_STATE.IDLE,
    balance: clamp(toInt(saved.balance, gameConfig.initialBalance), 0, 999999999),
    bet: clamp(toInt(saved.bet, gameConfig.defaultBet), gameConfig.minBet, gameConfig.maxBet),
    db: null,
    user: null,
    lockRows: resolveLockCurrencies(),
    refs: { inventory: null },
    handlers: { inventory: null },
    walletById: {},
    walletLinked: false,
    balanceSyncPaused: false,
    pendingWalletTotal: null,
    spinWin: 0,
    tumbleWin: 0,
    bonusWin: 0,
    fsLeft: 0,
    busy: false,
    turbo: Boolean(saved.turbo),
    muted: Boolean(saved.muted),
    autoplayRemaining: toInt(saved.autoplayRemaining, 0),
    skipRequested: false,
    lastResolved: null,
    history: []
  };

  audio.setEnabled(!state.muted);

  const cells = [];

  function loadSettings() {
    try {
      const raw = localStorage.getItem(settingsKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(settingsKey, JSON.stringify({
        turbo: state.turbo,
        muted: state.muted,
        autoplayRemaining: state.autoplayRemaining,
        bet: state.bet,
        balance: state.balance
      }));
    } catch (_error) {
      // noop
    }
  }

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  }

  async function connectDb() {
    if (state.db) return state.db;
    if (typeof dbModule.getOrInitAuthDb !== "function") throw new Error("DB module unavailable");
    state.db = await dbModule.getOrInitAuthDb({
      network: {},
      firebaseRef: window.firebase,
      firebaseConfig: window.FIREBASE_CONFIG,
      getFirebaseApiKey: window.getFirebaseApiKey
    });
    return state.db;
  }

  async function readUserRole(accountId, usernameHint) {
    const db = await connectDb();
    try {
      const roleSnap = await db.ref(BASE_PATH + "/admin-roles/" + accountId).once("value");
      const val = roleSnap.val();
      if (typeof val === "string") return val.trim().toLowerCase() || "none";
      if (val && typeof val === "object" && typeof val.role === "string") return val.role.trim().toLowerCase() || "none";
    } catch (_error) {
      // fallback below
    }
    const username = normalizeUsername(usernameHint);
    const byName = window.GT_SETTINGS && window.GT_SETTINGS.ADMIN_ROLE_BY_USERNAME;
    if (username && byName && typeof byName === "object") {
      const role = String(byName[username] || "").trim().toLowerCase();
      if (role) return role;
    }
    return "none";
  }

  function clearInventoryWatch() {
    if (state.refs.inventory && state.handlers.inventory) {
      state.refs.inventory.off("value", state.handlers.inventory);
    }
    state.refs.inventory = null;
    state.handlers.inventory = null;
  }

  async function bindInventoryWatch() {
    clearInventoryWatch();
    if (!state.user || !state.user.accountId) return false;
    const db = await connectDb();
    state.refs.inventory = db.ref(BASE_PATH + "/player-inventories/" + state.user.accountId);
    state.handlers.inventory = (snap) => {
      const value = snap && typeof snap.val === "function" ? (snap.val() || {}) : {};
      const wallet = walletFromInventory(value, state.lockRows);
      state.walletById = wallet.byId;
      if (state.balanceSyncPaused) {
        state.pendingWalletTotal = wallet.total;
        return;
      }
      state.balance = wallet.total;
      state.pendingWalletTotal = null;
      state.walletLinked = true;
      updateHUD();
    };
    state.refs.inventory.on("value", state.handlers.inventory);
    const first = await state.refs.inventory.once("value");
    state.handlers.inventory(first);
    return true;
  }

  async function applyWalletDelta(deltaLocks) {
    if (!state.walletLinked || !state.refs.inventory) return { ok: false, reason: "wallet-unavailable" };
    const delta = Math.floor(Number(deltaLocks) || 0);
    if (!delta) return { ok: true, amount: 0, previousTotal: state.balance, nextTotal: state.balance };

    let failReason = "";
    let previousTotal = 0;
    let nextTotal = 0;

    const tx = await state.refs.inventory.transaction((currentRaw) => {
      const currentObj = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
      const wallet = walletFromInventory(currentObj, state.lockRows);
      previousTotal = wallet.total;
      nextTotal = wallet.total + delta;
      if (nextTotal < 0) {
        failReason = "not-enough-locks";
        return;
      }
      const nextById = decomposeLocks(nextTotal, state.lockRows);
      for (let i = 0; i < state.lockRows.length; i++) {
        const row = state.lockRows[i];
        currentObj[row.id] = Math.max(0, Math.floor(Number(nextById[row.id]) || 0));
      }
      return currentObj;
    });

    if (!tx || !tx.committed) return { ok: false, reason: failReason || "aborted" };
    return { ok: true, amount: delta, previousTotal, nextTotal };
  }

  function consumeSlotTransfer() {
    try {
      const raw = sessionStorage.getItem(SLOT_TRANSFER_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(SLOT_TRANSFER_KEY);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const issuedAt = Math.max(0, Math.floor(Number(parsed.issuedAt) || 0));
      if (!issuedAt || Math.abs(Date.now() - issuedAt) > 120000) return null;
      const accountId = String(parsed.accountId || "").trim();
      const username = normalizeUsername(parsed.username || "");
      const role = normalizeUsername(parsed.role || "none");
      if (!accountId || !username) return null;
      return { accountId, username, role };
    } catch (_error) {
      return null;
    }
  }

  async function trySavedAuthLogin() {
    if (typeof authStorageModule.loadCredentials !== "function") return false;
    const savedCreds = authStorageModule.loadCredentials(SAVED_AUTH_KEY) || {};
    const username = normalizeUsername(savedCreds.username || "");
    const password = String(savedCreds.password || "");
    if (!username || !password) return false;
    if (typeof authModule.sha256Hex !== "function") return false;

    try {
      const db = await connectDb();
      const usernameSnap = await db.ref(BASE_PATH + "/usernames/" + username).once("value");
      const accountId = String(usernameSnap.val() || "").trim();
      if (!accountId) return false;
      const accountSnap = await db.ref(BASE_PATH + "/accounts/" + accountId).once("value");
      const account = accountSnap.val() || {};
      const hash = await authModule.sha256Hex(password);
      if (String(account.passwordHash || "") !== hash) return false;
      const role = await readUserRole(accountId, username);
      state.user = { accountId, username, role };
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function ensureWalletSession() {
    const transfer = consumeSlotTransfer();
    if (transfer) {
      state.user = transfer;
      const bound = await bindInventoryWatch();
      if (bound) return true;
    }
    const logged = await trySavedAuthLogin();
    if (!logged) return false;
    return bindInventoryWatch();
  }

  function applyPendingWalletTotal() {
    if (state.pendingWalletTotal == null) return;
    state.balance = toInt(state.pendingWalletTotal, state.balance);
    state.pendingWalletTotal = null;
    updateHUD();
  }

  function setPhase(phase) {
    state.phase = phase;
    if (el.phaseValue) el.phaseValue.textContent = phase;
  }

  function setMessage(text) {
    if (el.message) el.message.textContent = String(text || "");
  }

  function setBanner(text, isBig) {
    if (!(el.banner instanceof HTMLElement)) return;
    const value = String(text || "").trim();
    if (!value) {
      el.banner.classList.add("hidden");
      el.banner.classList.remove("big");
      el.banner.textContent = "";
      return;
    }
    el.banner.textContent = value;
    el.banner.classList.toggle("big", Boolean(isBig));
    el.banner.classList.remove("hidden");
  }

  function updateTopButtons() {
    if (el.soundBtn) el.soundBtn.textContent = "Sound: " + (state.muted ? "Off" : "On");
    if (el.turboBtn) el.turboBtn.textContent = "Turbo: " + (state.turbo ? "On" : "Off");
    if (el.autoplayBtn) {
      const n = toInt(state.autoplayRemaining, 0);
      el.autoplayBtn.textContent = "Autoplay: " + (n > 0 ? String(n) : "Off");
    }
  }

  function updateHUD() {
    if (el.balanceValue) el.balanceValue.textContent = formatWL(state.balance);
    if (el.betValue) el.betValue.textContent = formatWL(state.bet);
    if (el.spinWinValue) el.spinWinValue.textContent = formatWL(state.spinWin);
    if (el.tumbleWinValue) el.tumbleWinValue.textContent = formatWL(state.tumbleWin);
    if (el.bonusWinValue) el.bonusWinValue.textContent = formatWL(state.bonusWin);
    if (el.fsValue) el.fsValue.textContent = String(state.fsLeft);
    if (el.betInput instanceof HTMLInputElement) el.betInput.value = String(state.bet);
    updateTopButtons();
  }

  function setControlsBusy(flag) {
    const busy = Boolean(flag);
    state.busy = busy;
    if (el.spinBtn instanceof HTMLButtonElement) el.spinBtn.disabled = busy;
    if (el.buyBonusBtn instanceof HTMLButtonElement) el.buyBonusBtn.disabled = busy;
    if (el.betDownBtn instanceof HTMLButtonElement) el.betDownBtn.disabled = busy;
    if (el.betUpBtn instanceof HTMLButtonElement) el.betUpBtn.disabled = busy;
    if (el.betMaxBtn instanceof HTMLButtonElement) el.betMaxBtn.disabled = busy;
    if (el.betInput instanceof HTMLInputElement) el.betInput.disabled = busy;
  }

  function pushHistory(text, isWin) {
    const stamp = new Date();
    const hh = String(stamp.getHours()).padStart(2, "0");
    const mm = String(stamp.getMinutes()).padStart(2, "0");
    state.history.unshift({ text: String(text || ""), time: hh + ":" + mm, win: Boolean(isWin) });
    if (state.history.length > 40) state.history.length = 40;
    renderHistory();
  }

  function renderHistory() {
    if (!(el.historyList instanceof HTMLElement)) return;
    if (!state.history.length) {
      el.historyList.innerHTML = "<div class=\"history-item\">No rounds yet.</div>";
      return;
    }
    let html = "";
    for (let i = 0; i < state.history.length; i++) {
      const row = state.history[i];
      html += "<div class=\"history-item" + (row.win ? " win" : "") + "\">[" + row.time + "] " + escapeHtml(row.text) + "</div>";
    }
    el.historyList.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function symbolLabel(symbolId) {
    if (symbolId === "scatter") return "SCATTER";
    const sym = symbolMap[symbolId];
    if (!sym) return "?";
    return "DUCK";
  }

  function symbolLevelText(symbolId) {
    if (symbolId === "scatter") return "BONUS";
    const sym = symbolMap[symbolId];
    return sym ? ("L" + sym.level) : "";
  }

  const iconMarkupCache = {};
  const visualSpinSymbols = symbolConfig.filter((row) => !row.scatter).map((row) => row.id);

  function levelColor(level) {
    const palette = [
      "#7da9ff",
      "#76c5ff",
      "#67dfd8",
      "#75e5a3",
      "#9fe36b",
      "#e3d569",
      "#f3b56d",
      "#f59583",
      "#f070ab"
    ];
    const idx = clamp(toInt(level, 1) - 1, 0, palette.length - 1);
    return palette[idx];
  }

  function symbolIconMarkup(symbolId) {
    const id = String(symbolId || "");
    if (!id) return "";
    if (iconMarkupCache[id]) return iconMarkupCache[id];

    let html = "";
    if (id === "scatter") {
      html = (
        "<svg viewBox=\"0 0 48 48\" aria-hidden=\"true\" focusable=\"false\">" +
          "<circle cx=\"24\" cy=\"24\" r=\"19\" fill=\"rgba(17,25,40,0.85)\" stroke=\"rgba(255,210,138,0.68)\" stroke-width=\"2\" />" +
          "<path d=\"M24 8l4.2 8.9 9.8 1.2-7.3 6.6 1.9 9.6L24 30l-8.6 4.3 1.9-9.6-7.3-6.6 9.8-1.2z\" fill=\"#ffc978\" />" +
          "<path d=\"M24 11.8l3.2 6.8 7.6.9-5.7 5.2 1.4 7.4L24 28.8l-6.5 3.3 1.4-7.4-5.7-5.2 7.6-.9z\" fill=\"#ff9b62\" opacity=\"0.72\" />" +
          "<circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#fff1cb\" />" +
        "</svg>"
      );
    } else {
      const sym = symbolMap[id];
      const level = sym ? toInt(sym.level, 1) : 1;
      const body = levelColor(level);
      const wing = "rgba(10,16,28,0.28)";
      html = (
        "<svg viewBox=\"0 0 48 48\" aria-hidden=\"true\" focusable=\"false\">" +
          "<circle cx=\"24\" cy=\"24\" r=\"20\" fill=\"rgba(17,25,40,0.84)\" stroke=\"rgba(166,195,238,0.42)\" stroke-width=\"2\" />" +
          "<ellipse cx=\"23\" cy=\"27\" rx=\"11\" ry=\"8.8\" fill=\"" + body + "\" />" +
          "<circle cx=\"30\" cy=\"20\" r=\"5.6\" fill=\"" + body + "\" />" +
          "<ellipse cx=\"19\" cy=\"27\" rx=\"4.2\" ry=\"2.8\" fill=\"" + wing + "\" />" +
          "<polygon points=\"34,21 40,23 34,25\" fill=\"#ffc76d\" />" +
          "<circle cx=\"31.6\" cy=\"19.3\" r=\"1.1\" fill=\"#0e1726\" />" +
          "<rect x=\"15\" y=\"33\" width=\"18\" height=\"2.6\" rx=\"1.3\" fill=\"rgba(255,255,255,0.2)\" />" +
          "<text x=\"24\" y=\"15\" text-anchor=\"middle\" font-size=\"8\" font-weight=\"700\" fill=\"#f0f7ff\">L" + level + "</text>" +
        "</svg>"
      );
    }

    iconMarkupCache[id] = html;
    return html;
  }

  function randomVisualSymbol() {
    if (!visualSpinSymbols.length) return "lv1";
    if (Math.random() < 0.06) return "scatter";
    const idx = Math.floor(Math.random() * visualSpinSymbols.length);
    return visualSpinSymbols[idx];
  }

  function buildSpinPreviewGrid(finalGrid, revealedColumnInclusive) {
    const grid = [];
    const revealUntil = toInt(revealedColumnInclusive, -1);
    for (let r = 0; r < gameConfig.rows; r++) {
      const row = [];
      for (let c = 0; c < gameConfig.cols; c++) {
        if (c <= revealUntil) row.push(finalGrid[r][c]);
        else row.push(randomVisualSymbol());
      }
      grid.push(row);
    }
    return grid;
  }

  function buildGridDom() {
    if (!(el.grid instanceof HTMLElement)) return;
    el.grid.innerHTML = "";
    for (let r = 0; r < gameConfig.rows; r++) {
      const row = [];
      for (let c = 0; c < gameConfig.cols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell empty";
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.dataset.symbol = "";

        const icon = document.createElement("div");
        icon.className = "icon";
        const symbol = document.createElement("div");
        symbol.className = "symbol";
        const level = document.createElement("div");
        level.className = "level";
        const marker = document.createElement("div");
        marker.className = "marker hidden";

        cell.appendChild(icon);
        cell.appendChild(symbol);
        cell.appendChild(level);
        cell.appendChild(marker);
        el.grid.appendChild(cell);
        row.push({ root: cell, icon, symbol, level, marker });
      }
      cells.push(row);
    }
  }

  function clearHighlights() {
    for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < cells[r].length; c++) {
        const root = cells[r][c].root;
        root.classList.remove("win", "dim", "merge-source", "merge-target", "drop-in", "scatter-hit", "spin-cycling", "reveal-pop");
        root.style.animationDelay = "0ms";
      }
    }
  }

  function renderGrid(grid, markers, options) {
    const opts = options || {};
    const drop = Boolean(opts.dropIn);
    const scatterPulse = Boolean(opts.scatterPulse);
    const spinCycle = Boolean(opts.spinCycle);
    const revealPop = Boolean(opts.revealPop);
    const revealColumn = toInt(opts.revealColumn, -1);
    clearHighlights();

    for (let r = 0; r < gameConfig.rows; r++) {
      for (let c = 0; c < gameConfig.cols; c++) {
        const view = cells[r][c];
        const symbolId = grid[r][c];
        const root = view.root;
        root.className = "cell";

        if (!symbolId) {
          root.classList.add("empty");
          root.dataset.symbol = "";
          view.icon.innerHTML = "";
          view.symbol.textContent = "";
          view.level.textContent = "";
        } else {
          root.classList.add("sym-" + symbolId);
          if (root.dataset.symbol !== symbolId) {
            root.dataset.symbol = symbolId;
            view.icon.innerHTML = symbolIconMarkup(symbolId);
          }
          view.symbol.textContent = symbolLabel(symbolId);
          view.level.textContent = symbolLevelText(symbolId);
          if (symbolId === "scatter" && scatterPulse) root.classList.add("scatter-hit");
        }

        if (drop && symbolId) {
          root.classList.add("drop-in");
          root.style.animationDelay = String((r * 22) + (c * 10)) + "ms";
        }
        if (spinCycle && symbolId) root.classList.add("spin-cycling");
        if (revealPop && symbolId) {
          root.classList.add("reveal-pop");
          root.style.animationDelay = String((c * 30) + (r * 8)) + "ms";
        } else if (revealColumn >= 0 && c <= revealColumn && symbolId) {
          root.classList.add("reveal-pop");
          root.style.animationDelay = String((c * 34) + (r * 6)) + "ms";
        }

        const marker = markers && markers[r] && markers[r][c] ? markers[r][c] : null;
        if (marker && marker.marked) {
          view.marker.classList.remove("hidden");
          view.marker.textContent = "x" + toInt(marker.multiplier, 1);
        } else {
          view.marker.classList.add("hidden");
          view.marker.textContent = "";
        }
      }
    }
  }

  function highlightCluster(cluster) {
    const active = new Set(cluster.cells.map((cell) => cell[0] + ":" + cell[1]));
    for (let r = 0; r < gameConfig.rows; r++) {
      for (let c = 0; c < gameConfig.cols; c++) {
        const root = cells[r][c].root;
        if (active.has(r + ":" + c)) root.classList.add("win");
        else root.classList.add("dim");
      }
    }
  }

  function showMergeOps(mergeOps) {
    for (let i = 0; i < mergeOps.length; i++) {
      const op = mergeOps[i];
      for (let k = 0; k < op.consumedCells.length; k++) {
        const p = op.consumedCells[k];
        cells[p[0]][p[1]].root.classList.add("merge-source");
      }
      cells[op.anchor[0]][op.anchor[1]].root.classList.add("merge-target");
    }
  }

  function showFloatingText(row, col, text, isMultiplier) {
    if (!(el.floatingLayer instanceof HTMLElement)) return;
    const node = document.createElement("div");
    node.className = "float-text" + (isMultiplier ? " multiplier" : "");
    node.textContent = String(text || "");
    const x = ((col + 0.5) / gameConfig.cols) * 100;
    const y = ((row + 0.5) / gameConfig.rows) * 100;
    node.style.left = x.toFixed(3) + "%";
    node.style.top = y.toFixed(3) + "%";
    el.floatingLayer.appendChild(node);
    window.setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, 900);
  }

  function pause(baseMs) {
    const scale = state.skipRequested ? 0.07 : (state.turbo ? 0.62 : 1.35);
    const ms = Math.max(0, Math.floor(baseMs * scale));
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function countDurationByWin(win, bet) {
    const ratio = bet > 0 ? win / bet : 0;
    if (ratio >= 20) return state.turbo ? 1200 : 2900;
    if (ratio >= 8) return state.turbo ? 900 : 2100;
    if (ratio >= 3) return state.turbo ? 620 : 1400;
    return state.turbo ? 340 : 780;
  }

  function getWinTierLabel(totalWin, bet) {
    const ratio = bet > 0 ? (totalWin / bet) : 0;
    for (let i = 0; i < gameConfig.tierByBetMultiplier.length; i++) {
      const row = gameConfig.tierByBetMultiplier[i];
      if (ratio >= row.ratio) return row.label;
    }
    return "WIN";
  }

  async function animateSpinWinTo(targetValue, duration) {
    const start = state.spinWin;
    await counter.animate(start, targetValue, duration, (value) => {
      state.spinWin = toInt(Math.round(value), start);
      if (state.spinWin > targetValue) state.spinWin = targetValue;
      updateHUD();
    });
    state.spinWin = targetValue;
    updateHUD();
  }

  async function animateBalanceTo(targetValue, duration) {
    const start = state.balance;
    await counter.animate(start, targetValue, duration, (value) => {
      state.balance = toInt(Math.round(value), start);
      if (state.balance > targetValue) state.balance = targetValue;
      updateHUD();
    });
    state.balance = targetValue;
    updateHUD();
  }

  function collectDebugInput() {
    const debug = {
      forceScatterTrigger: Boolean(el.dbgForceScatter && el.dbgForceScatter.checked),
      forceBigWin: Boolean(el.dbgForceBigWin && el.dbgForceBigWin.checked),
      customGrid: null,
      logClusters: Boolean(el.dbgLogClusters && el.dbgLogClusters.checked)
    };
    if (el.dbgUseCustomGrid && el.dbgUseCustomGrid.checked && el.dbgCustomGrid instanceof HTMLTextAreaElement) {
      debug.customGrid = engine.parseCustomGrid(el.dbgCustomGrid.value);
    }
    return debug;
  }

  function appendDebug(text) {
    if (!(el.debugOutput instanceof HTMLElement)) return;
    const line = "[" + new Date().toLocaleTimeString() + "] " + String(text || "");
    el.debugOutput.textContent = (line + "\n" + el.debugOutput.textContent).slice(0, 12000);
  }

  function logResolvedResult(resolved) {
    if (!resolved) return;
    console.group("MergeUp resolved result");
    console.log(resolved);
    console.groupEnd();
  }

  async function presentCascadeStep(step, isBonus, bet) {
    setPhase(SLOT_STATE.EVALUATE);
    state.tumbleWin = 0;
    renderGrid(step.gridBefore, isBonus ? step.markerBefore : null, {});

    for (let i = 0; i < step.clusters.length; i++) {
      const cluster = step.clusters[i];
      setPhase(SLOT_STATE.WIN_ANIMATION);
      highlightCluster(cluster);
      const clusterWin = toInt(cluster.payoutAfterMultiplier, 0);
      state.tumbleWin += clusterWin;
      updateHUD();

      const targetTotal = state.spinWin + clusterWin;
      const duration = countDurationByWin(clusterWin, bet);
      if (cluster.multiplierApplied > 1) {
        showFloatingText(cluster.anchor[0], cluster.anchor[1], "x" + cluster.multiplierApplied + " cell", true);
        audio.play("multiplier");
      }
      showFloatingText(cluster.anchor[0], cluster.anchor[1], "+" + formatWL(clusterWin), false);

      const ratio = bet > 0 ? (clusterWin / bet) : 0;
      if (ratio >= 10) audio.play("cluster_big");
      else if (ratio >= 3) audio.play("cluster_mid");
      else audio.play("cluster_small");

      await animateSpinWinTo(targetTotal, duration);
      await pause(260);
      clearHighlights();
      renderGrid(step.gridBefore, isBonus ? step.markerBefore : null, {});
    }

    setPhase(SLOT_STATE.MERGE);
    showMergeOps(step.mergeOps);
    setMessage("Merge Up: winning ducks combine into higher levels.");
    audio.play("merge");
    await pause(340);

    renderGrid(step.gridAfterMerge, isBonus ? step.markerAfter : null, {});
    showMergeOps(step.mergeOps);
    await pause(320);

    setPhase(SLOT_STATE.REFILL);
    renderGrid(step.gridAfterRefill, isBonus ? step.markerAfter : null, { dropIn: true });
    setMessage("TUMBLE " + step.index + " | Step win: " + formatWL(step.stepWin));
    audio.play("land");
    await pause(420);
  }

  async function presentSpinChain(chain, isBonus, bet, markerSnapshotBefore) {
    setPhase(SLOT_STATE.REVEAL);
    const markerGrid = isBonus ? markerSnapshotBefore : null;
    setMessage("Spinning...");
    const cycleCount = state.turbo ? 4 : 8;
    for (let i = 0; i < cycleCount; i++) {
      renderGrid(buildSpinPreviewGrid(chain.initialGrid, -1), markerGrid, { spinCycle: true });
      if ((i % 2) === 0) audio.play("spin_tick");
      await pause(60);
    }

    for (let col = 0; col < gameConfig.cols; col++) {
      const revealGrid = buildSpinPreviewGrid(chain.initialGrid, col);
      renderGrid(revealGrid, markerGrid, { spinCycle: true, revealColumn: col });
      audio.play("land");
      await pause(95);
    }

    renderGrid(chain.initialGrid, markerGrid, { dropIn: true, scatterPulse: true, revealPop: true });
    const scatters = countScatterCells(chain.initialGrid);
    if (scatters >= 3) {
      setMessage("Scatter suspense: " + scatters + " visible.");
      audio.play("anticipation");
      await pause(460);
    } else {
      await pause(260);
    }

    if (!chain.steps.length) {
      setMessage("No cluster win this spin.");
      return;
    }
    for (let i = 0; i < chain.steps.length; i++) await presentCascadeStep(chain.steps[i], isBonus, bet);
    renderGrid(chain.finalGrid, isBonus && chain.steps.length ? chain.steps[chain.steps.length - 1].markerAfter : null, {});
  }

  async function presentBonusIntro(spins) {
    setPhase(SLOT_STATE.BONUS_INTRO);
    setBanner("FREE SPINS\n" + spins + " AWARDED", true);
    setMessage("Bonus mode: marked cells can scale multipliers up to x128.");
    audio.play("bonus_intro");
    await pause(1350);
    setBanner("");
  }

  async function presentBonusSummary(bonusWin, topMultiplier) {
    setPhase(SLOT_STATE.BONUS_SUMMARY);
    setBanner("BONUS COMPLETE\n" + formatWL(bonusWin) + "\nTop cell x" + topMultiplier, true);
    setMessage("Free spins complete.");
    await pause(1250);
    setBanner("");
  }

  async function runResolvedRound(resolved, roundCost) {
    state.skipRequested = false;
    state.spinWin = 0;
    state.tumbleWin = 0;
    state.bonusWin = 0;
    state.fsLeft = 0;
    updateHUD();

    if (resolved.kind === "paid") await presentSpinChain(resolved.base.chain, false, resolved.bet, null);

    if (resolved.base.triggeredBonus || resolved.kind === "buy_bonus") {
      await presentBonusIntro(resolved.base.freeSpinsAward);
      state.fsLeft = resolved.base.freeSpinsAward;
      updateHUD();

      setPhase(SLOT_STATE.BONUS_SPIN);
      for (let i = 0; i < resolved.bonus.spins.length; i++) {
        const spin = resolved.bonus.spins[i];
        state.fsLeft = spin.spinsLeftAfter + 1;
        updateHUD();
        setMessage("Free Spin " + spin.spinIndex + " | Remaining: " + state.fsLeft);
        await presentSpinChain(spin.chain, true, resolved.bet, spin.markerSnapshotBefore);

        state.bonusWin += spin.chain.totalWin;
        updateHUD();
        state.fsLeft = spin.spinsLeftAfter;
        updateHUD();

        if (spin.retriggerAward > 0) {
          setBanner("RETRIGGER +" + spin.retriggerAward, false);
          audio.play("bonus_intro");
          await pause(760);
          setBanner("");
        }
      }
      await presentBonusSummary(resolved.bonus.totalWin, resolved.bonus.topMultiplier);
    }

    setPhase(SLOT_STATE.CREDIT);
    const totalWin = toInt(resolved.totalWin, 0);
    const tier = getWinTierLabel(totalWin, resolved.bet);
    const isBig = tier === "BIG WIN" || tier === "MEGA WIN" || tier === "EPIC WIN";

    if (totalWin > 0) {
      if (isBig) {
        setBanner(tier + "\n" + formatWL(totalWin), true);
        audio.play("big_win");
        await pause(1200);
        setBanner("");
      }

      setMessage("Crediting " + formatWL(totalWin) + " to balance...");
      let creditResult = null;
      if (state.walletLinked) {
        state.balanceSyncPaused = true;
        creditResult = await applyWalletDelta(totalWin);
      }

      if (state.walletLinked && (!creditResult || !creditResult.ok)) {
        state.balanceSyncPaused = false;
        applyPendingWalletTotal();
        const reason = (creditResult && creditResult.reason) ? String(creditResult.reason) : "wallet-tx-failed";
        appendDebug("credit-check | displayed=" + totalWin + " | credited=0 | raw=" + resolved.totalWinRaw + " | capped=" + resolved.maxWinCapped + " | reason=" + reason);
        setMessage("Failed to credit wallet. Try again.");
        pushHistory("Credit failed for " + formatWL(totalWin), false);
      } else {
        const startBalance = creditResult ? toInt(creditResult.previousTotal, state.balance) : state.balance;
        const targetBalance = creditResult ? toInt(creditResult.nextTotal, startBalance + totalWin) : (state.balance + totalWin);
        state.balance = startBalance;
        updateHUD();
        await animateBalanceTo(targetBalance, countDurationByWin(totalWin, resolved.bet) + 260);
        state.balanceSyncPaused = false;
        applyPendingWalletTotal();
        audio.play("credit");

        const credited = targetBalance - startBalance;
        const displayed = toInt(resolved.totalWin, 0);
        appendDebug("credit-check | displayed=" + displayed + " | credited=" + credited + " | raw=" + resolved.totalWinRaw + " | capped=" + resolved.maxWinCapped);
        if (displayed !== credited) appendDebug("ERROR: displayed and credited mismatch.");

        setMessage(tier + " " + formatWL(totalWin) + (resolved.maxWinCapped ? " (MAX WIN CAP)" : ""));
        pushHistory(tier + " +" + formatWL(totalWin) + (roundCost > 0 ? (" after " + formatWL(roundCost) + " cost") : ""), true);
      }
    } else {
      setMessage("No win this round.");
      pushHistory("No win (cost " + formatWL(roundCost) + ")", false);
    }

    if (resolved.maxWinCapped) {
      setBanner("MAX WIN CAP REACHED\n" + formatWL(resolved.totalWin), true);
      await pause(1000);
      setBanner("");
    }

    state.fsLeft = 0;
    state.tumbleWin = 0;
    updateHUD();
  }

  async function runSpin(kind) {
    if (state.busy) return;
    if (!state.walletLinked) {
      setMessage("Wallet not linked. Open this slot from Casino dashboard after login.");
      return;
    }
    const mode = String(kind || "paid");
    const cost = mode === "buy_bonus" ? toInt(state.bet * gameConfig.buyBonusCostMultiplier, 0) : toInt(state.bet, 0);
    if (cost <= 0) {
      setMessage("Invalid bet.");
      return;
    }
    if (state.balance < cost) {
      setMessage("Not enough balance.");
      if (state.autoplayRemaining > 0) state.autoplayRemaining = 0;
      updateHUD();
      saveSettings();
      return;
    }

    let debugInput = { forceScatterTrigger: false, forceBigWin: false, customGrid: null, logClusters: false };
    try {
      debugInput = collectDebugInput();
    } catch (error) {
      setMessage("Debug custom grid error: " + ((error && error.message) || "invalid input"));
      return;
    }

    setControlsBusy(true);
    setPhase(SLOT_STATE.SPIN_START);
    state.skipRequested = false;
    counter.skip();
    audio.play("spin_start");

    state.balanceSyncPaused = true;
    const debitResult = await applyWalletDelta(-cost);
    state.balanceSyncPaused = false;
    applyPendingWalletTotal();
    if (!debitResult || !debitResult.ok) {
      const reason = debitResult && debitResult.reason ? String(debitResult.reason) : "wallet-tx-failed";
      if (reason === "not-enough-locks") setMessage("Not enough balance.");
      else setMessage("Wallet debit failed. Try again.");
      appendDebug("debit-check | cost=" + cost + " | reason=" + reason);
      if (state.autoplayRemaining > 0) state.autoplayRemaining = 0;
      setControlsBusy(false);
      setPhase(SLOT_STATE.IDLE);
      updateHUD();
      saveSettings();
      return;
    }
    state.balance = toInt(debitResult.nextTotal, Math.max(0, state.balance - cost));
    updateHUD();
    appendDebug("debit-check | cost=" + cost + " | previous=" + debitResult.previousTotal + " | next=" + debitResult.nextTotal);

    const seed = Date.now() ^ Math.floor(Math.random() * 0x7fffffff);
    const rng = new RNG(seed);

    let resolved;
    if (mode === "buy_bonus") {
      resolved = engine.resolveBonusPurchaseOutcome({ rng, bet: state.bet });
      setMessage("Bonus bought for " + formatWL(cost) + ".");
    } else {
      resolved = engine.resolvePaidSpinOutcome({ rng, bet: state.bet, debug: debugInput });
    }

    state.lastResolved = resolved;
    if (debugInput.logClusters) {
      appendDebug(
        "seed=" + seed +
        " | baseSteps=" + resolved.base.chain.steps.length +
        " | baseWin=" + resolved.base.chain.totalWin +
        " | bonusWin=" + resolved.bonus.totalWin +
        " | total=" + resolved.totalWin +
        " | raw=" + resolved.totalWinRaw +
        " | capped=" + resolved.maxWinCapped
      );
    }

    if (el.dbgForceScatter && el.dbgForceScatter.checked) el.dbgForceScatter.checked = false;
    if (el.dbgForceBigWin && el.dbgForceBigWin.checked) el.dbgForceBigWin.checked = false;
    if (el.dbgUseCustomGrid && el.dbgUseCustomGrid.checked) el.dbgUseCustomGrid.checked = false;

    await runResolvedRound(resolved, cost);

    setPhase(SLOT_STATE.IDLE);
    setControlsBusy(false);
    state.skipRequested = false;

    if (state.autoplayRemaining > 0 && !state.busy) {
      state.autoplayRemaining -= 1;
      updateHUD();
      saveSettings();
      await pause(340);
      if (state.autoplayRemaining > 0) {
        runSpin("paid");
        return;
      }
    }

    saveSettings();
  }

  function buildInfoContent() {
    if (!(el.infoContent instanceof HTMLElement)) return;
    let html = "";
    html += "<section><strong>Game Type:</strong> 6x6 cluster pays, orthogonal adjacency, minimum cluster size 5.</section>";
    html += "<section><strong>MergeUP Rule:</strong> only clusters of 5+ matching ducks win and merge into the next level at a deterministic anchor cell (lowest row, then left-most).</section>";
    html += "<section><strong>Free Spins Trigger:</strong> 4/5/6+ scatters award 15/18/20 free spins. In free spins, marked cells gain multipliers up to x128 and retrigger with 4/5/6+ scatters for +5/+8/+10.</section>";
    html += "<section><strong>Math:</strong> RTP " + gameConfig.rtp + " (config placeholder), volatility " + gameConfig.volatility + ", max win cap " + gameConfig.maxWinMultiplier + "x bet.</section>";

    html += "<section><table><thead><tr><th>Symbol</th><th>Cluster 5</th><th>6</th><th>7</th><th>8</th><th>10+</th></tr></thead><tbody>";
    for (let i = 0; i < symbolConfig.length; i++) {
      const sym = symbolConfig[i];
      if (sym.scatter) continue;
      const p = sym.payoutBySize;
      html += "<tr>" +
        "<td>" + sym.name + "</td>" +
        "<td>x" + Number(p[5] || 0).toFixed(2) + "</td>" +
        "<td>x" + Number(p[6] || 0).toFixed(2) + "</td>" +
        "<td>x" + Number(p[7] || 0).toFixed(2) + "</td>" +
        "<td>x" + Number(p[8] || 0).toFixed(2) + "</td>" +
        "<td>x" + Number(p[10] || 0).toFixed(2) + "</td>" +
        "</tr>";
    }
    html += "</tbody></table></section>";

    html += "<section><strong>Controls:</strong> Space = Spin, S = Turbo, A = Autoplay cycle, Click grid during count/animations = fast-forward.</section>";
    el.infoContent.innerHTML = html;
  }

  function bindEvents() {
    if (el.backBtn instanceof HTMLButtonElement) el.backBtn.addEventListener("click", () => { window.location.href = "./index.html"; });

    if (el.soundBtn instanceof HTMLButtonElement) {
      el.soundBtn.addEventListener("click", () => {
        state.muted = !state.muted;
        audio.setEnabled(!state.muted);
        updateTopButtons();
        saveSettings();
      });
    }

    if (el.turboBtn instanceof HTMLButtonElement) {
      el.turboBtn.addEventListener("click", () => {
        state.turbo = !state.turbo;
        updateTopButtons();
        saveSettings();
      });
    }

    if (el.autoplayBtn instanceof HTMLButtonElement) {
      el.autoplayBtn.addEventListener("click", () => {
        const options = gameConfig.autoplayOptions;
        const current = toInt(state.autoplayRemaining, 0);
        let idx = options.indexOf(current);
        if (idx < 0) idx = 0;
        idx = (idx + 1) % options.length;
        state.autoplayRemaining = options[idx];
        updateTopButtons();
        saveSettings();
        if (state.autoplayRemaining > 0 && !state.busy) runSpin("paid");
      });
    }

    if (el.infoBtn instanceof HTMLButtonElement) el.infoBtn.addEventListener("click", () => { if (el.infoModal instanceof HTMLElement) el.infoModal.classList.remove("hidden"); });
    if (el.closeInfoBtn instanceof HTMLButtonElement) el.closeInfoBtn.addEventListener("click", () => { if (el.infoModal instanceof HTMLElement) el.infoModal.classList.add("hidden"); });
    if (el.infoModal instanceof HTMLElement) el.infoModal.addEventListener("click", (event) => { if (event.target === el.infoModal) el.infoModal.classList.add("hidden"); });

    if (el.betDownBtn instanceof HTMLButtonElement) {
      el.betDownBtn.addEventListener("click", () => {
        const step = Math.max(1, Math.floor(state.bet * 0.1));
        state.bet = clamp(state.bet - step, gameConfig.minBet, gameConfig.maxBet);
        updateHUD();
        saveSettings();
      });
    }

    if (el.betUpBtn instanceof HTMLButtonElement) {
      el.betUpBtn.addEventListener("click", () => {
        const step = Math.max(1, Math.floor(state.bet * 0.1));
        state.bet = clamp(state.bet + step, gameConfig.minBet, gameConfig.maxBet);
        updateHUD();
        saveSettings();
      });
    }

    if (el.betMaxBtn instanceof HTMLButtonElement) {
      el.betMaxBtn.addEventListener("click", () => {
        state.bet = clamp(Math.min(gameConfig.maxBet, state.balance), gameConfig.minBet, gameConfig.maxBet);
        updateHUD();
        saveSettings();
      });
    }

    if (el.betInput instanceof HTMLInputElement) {
      el.betInput.addEventListener("change", () => {
        state.bet = clamp(toInt(el.betInput.value, state.bet), gameConfig.minBet, gameConfig.maxBet);
        updateHUD();
        saveSettings();
      });
    }

    if (el.spinBtn instanceof HTMLButtonElement) el.spinBtn.addEventListener("click", () => runSpin("paid"));
    if (el.buyBonusBtn instanceof HTMLButtonElement) el.buyBonusBtn.addEventListener("click", () => runSpin("buy_bonus"));

    if (el.spinArea instanceof HTMLElement) {
      el.spinArea.addEventListener("pointerdown", () => {
        audio.unlock();
        if (!state.busy) return;
        state.skipRequested = true;
        counter.skip();
      });
    }

    if (el.dbgLogResultBtn instanceof HTMLButtonElement) {
      el.dbgLogResultBtn.addEventListener("click", () => {
        if (!state.lastResolved) {
          appendDebug("No resolved result yet.");
          return;
        }
        logResolvedResult(state.lastResolved);
        appendDebug("Last resolved result logged to console.");
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === " ") {
        event.preventDefault();
        if (state.busy) {
          state.skipRequested = true;
          counter.skip();
        } else {
          runSpin("paid");
        }
      } else if (event.key.toLowerCase() === "s") {
        state.turbo = !state.turbo;
        updateTopButtons();
        saveSettings();
      } else if (event.key.toLowerCase() === "a") {
        const options = gameConfig.autoplayOptions;
        const current = toInt(state.autoplayRemaining, 0);
        let idx = options.indexOf(current);
        if (idx < 0) idx = 0;
        idx = (idx + 1) % options.length;
        state.autoplayRemaining = options[idx];
        updateTopButtons();
        saveSettings();
      }
    });
  }

  async function init() {
    buildGridDom();
    buildInfoContent();
    bindEvents();
    renderHistory();
    setPhase(SLOT_STATE.IDLE);
    setControlsBusy(true);
    updateHUD();
    setMessage("Linking wallet session...");
    const warmGrid = engine.generateGrid(new RNG(Date.now()), {});
    renderGrid(warmGrid, null, {});

    let linked = false;
    try {
      linked = await ensureWalletSession();
    } catch (error) {
      const reason = (error && error.message) ? error.message : "unknown";
      appendDebug("wallet-link error | " + reason);
      linked = false;
    }

    if (!linked) {
      state.walletLinked = false;
      setMessage("Wallet session missing. Open from Casino dashboard after login.");
      appendDebug("wallet-link | unavailable");
      return;
    }

    state.walletLinked = true;
    state.bet = clamp(state.bet, gameConfig.minBet, gameConfig.maxBet);
    updateHUD();
    setControlsBusy(false);
    setMessage("Wallet linked. Spin to start.");
  }

  init();
})();
