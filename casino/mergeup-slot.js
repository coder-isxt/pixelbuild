(function initMergeUpSlot() {
  "use strict";

  const SAVED_AUTH_KEY = "growtopia_saved_auth_v1";
  const SLOT_TRANSFER_KEY = "gt_casino_slot_transfer_v1";
  const SLOT_CATALOG_URL = "./slots-config.json";
  const DEFAULT_SLOT_KEY = "mergeup_ducks";
  const BASE_PATH = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
  const WL_CENT_SCALE = 100;

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

  const DEFAULT_GAME_CONFIG = {
    rows: 7,
    cols: 7,
    minCluster: 5,
    winCounterHighlightMinRatio: 1.6,
    bonusWinCounterHighlightMinRatio: 6,
    defaultBet: 20,
    minBet: 1,
    maxBet: 5000,
    currencyScale: 100,
    initialBalance: 50000,
    buyBonusCostMultiplier: 100,
    buySuperBonusCostMultiplier: 500,
    maxCascadesPerSpin: 80,
    freeSpinsTrigger: { 3: 10, 4: 12, 5: 15, 6: 20, 7: 30 },
    freeSpinsRetrigger: { 3: 10, 4: 12, 5: 15, 6: 20, 7: 30 },
    markerStartMultiplier: 2,
    maxCellMultiplier: 1024,
    clusterMultiplierCombine: "sum",
    maxClusterMultiplierApplied: 50176,
    connectionBiasChance: 0.035,
    basePayoutScale: 1.2,
    maxWinMultiplier: 50000,
    highBetPayoutBoostTiers: [
      { minBet: 100, multiplier: 1.01 },
      { minBet: 250, multiplier: 1.03 },
      { minBet: 500, multiplier: 1.05 },
      { minBet: 1000, multiplier: 1.07 },
      { minBet: 2500, multiplier: 1.1 }
    ],
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

  const DEFAULT_SYMBOL_CONFIG = [
    { id: "lv1", name: "Duck Lv1", uiLabel: "Duck", level: 1, weight: 24, scatter: false, wild: false, iconGlyph: "d1", iconColor: "#7da9ff", payoutBySize: { 4: 0.16, 5: 0.24, 6: 0.33, 7: 0.44, 8: 0.58, 10: 0.8 } },
    { id: "lv2", name: "Duck Lv2", uiLabel: "Duck", level: 2, weight: 20, scatter: false, wild: false, iconGlyph: "d2", iconColor: "#76c5ff", payoutBySize: { 4: 0.2, 5: 0.3, 6: 0.42, 7: 0.56, 8: 0.72, 10: 1.0 } },
    { id: "lv3", name: "Duck Lv3", uiLabel: "Duck", level: 3, weight: 17, scatter: false, wild: false, iconGlyph: "d3", iconColor: "#67dfd8", payoutBySize: { 4: 0.26, 5: 0.38, 6: 0.54, 7: 0.7, 8: 0.92, 10: 1.25 } },
    { id: "lv4", name: "Duck Lv4", uiLabel: "Duck", level: 4, weight: 14, scatter: false, wild: false, iconGlyph: "d4", iconColor: "#75e5a3", payoutBySize: { 4: 0.34, 5: 0.5, 6: 0.7, 7: 0.92, 8: 1.2, 10: 1.66 } },
    { id: "lv5", name: "Duck Lv5", uiLabel: "Duck", level: 5, weight: 11, scatter: false, wild: false, iconGlyph: "d5", iconColor: "#9fe36b", payoutBySize: { 4: 0.46, 5: 0.66, 6: 0.92, 7: 1.2, 8: 1.56, 10: 2.2 } },
    { id: "lv6", name: "Duck Lv6", uiLabel: "Duck", level: 6, weight: 8, scatter: false, wild: false, iconGlyph: "d6", iconColor: "#e3d569", payoutBySize: { 4: 0.62, 5: 0.88, 6: 1.22, 7: 1.58, 8: 2.1, 10: 3.0 } },
    { id: "lv7", name: "Duck Lv7", uiLabel: "Duck", level: 7, weight: 5, scatter: false, wild: false, iconGlyph: "d7", iconColor: "#f3b56d", payoutBySize: { 4: 0.88, 5: 1.2, 6: 1.7, 7: 2.2, 8: 3.0, 10: 4.6 } },
    { id: "lv8", name: "Duck Lv8", uiLabel: "Duck", level: 8, weight: 3, scatter: false, wild: false, iconGlyph: "d8", iconColor: "#f59583", payoutBySize: { 4: 1.3, 5: 1.9, 6: 2.6, 7: 3.4, 8: 4.8, 10: 7.2 } },
    { id: "lv9", name: "Duck Lv9", uiLabel: "Duck", level: 9, weight: 2, scatter: false, wild: false, iconGlyph: "d9", iconColor: "#f070ab", payoutBySize: { 4: 2.0, 5: 2.8, 6: 3.9, 7: 5.2, 8: 7.4, 10: 11.0 } },
    { id: "scatter", name: "Scatter", uiLabel: "Scatter", level: 0, weight: 2, scatter: true, wild: false, iconGlyph: "S", payoutBySize: {} }
  ];

  let gameConfig = JSON.parse(JSON.stringify(DEFAULT_GAME_CONFIG));
  let symbolConfig = JSON.parse(JSON.stringify(DEFAULT_SYMBOL_CONFIG));
  let currentSlotKey = DEFAULT_SLOT_KEY;
  let currentSlotMeta = {
    name: "Cluster Rush 1000",
    subtitle: "7x7 cluster tumbles with sticky cell multipliers",
    tag: "Slots"
  };
  let symbolMap = {};
  let visualSpinSymbols = [];
  const iconMarkupCache = {};

  function rebuildSymbolMap() {
    symbolMap = {};
    visualSpinSymbols = [];
    for (let i = 0; i < symbolConfig.length; i++) {
      const row = symbolConfig[i];
      if (!row || !row.id) continue;
      symbolMap[row.id] = row;
      if (!row.scatter) visualSpinSymbols.push(row.id);
    }
    const keys = Object.keys(iconMarkupCache);
    for (let i = 0; i < keys.length; i++) delete iconMarkupCache[keys[i]];
  }

  rebuildSymbolMap();

  const el = {
    slotTitle: document.getElementById("slotTitle"),
    slotSubtitle: document.getElementById("slotSubtitle"),
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
    totalBetValue: document.getElementById("totalBetValue"),
    tumbleWinValue: document.getElementById("tumbleWinValue"),
    bonusWinValue: document.getElementById("bonusWinValue"),
    grid: document.getElementById("grid"),
    spinArea: document.getElementById("spinArea"),
    winCounterOverlay: document.getElementById("winCounterOverlay"),
    winCounterLabel: document.getElementById("winCounterLabel"),
    winCounterValue: document.getElementById("winCounterValue"),
    floatingLayer: document.getElementById("floatingLayer"),
    banner: document.getElementById("banner"),
    message: document.getElementById("message"),
    betDownBtn: document.getElementById("betDownBtn"),
    betInput: document.getElementById("betInput"),
    betUpBtn: document.getElementById("betUpBtn"),
    betMaxBtn: document.getElementById("betMaxBtn"),
    spinBtn: document.getElementById("spinBtn"),
    buyBonusBtn: document.getElementById("buyBonusBtn"),
    buySuperBonusBtn: document.getElementById("buySuperBonusBtn"),
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

  function currencyScale() {
    return Math.max(1, toInt(gameConfig && gameConfig.currencyScale, WL_CENT_SCALE));
  }

  function wlToCents(wlValue) {
    return Math.max(0, Math.round((Number(wlValue) || 0) * currencyScale()));
  }

  function centsToWl(centsValue) {
    return (Math.max(0, toInt(centsValue, 0)) / currencyScale());
  }

  function formatWL(valueInCents) {
    const amount = centsToWl(valueInCents);
    return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " WL";
  }

  function ratioToBet(winCents, betWl) {
    const betCents = Math.max(1, wlToCents(betWl));
    return Math.max(0, toInt(winCents, 0)) / betCents;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitizeSlotKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  }

  function getRequestedSlotKey() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return sanitizeSlotKey(params.get("slot") || "");
    } catch (_error) {
      return "";
    }
  }

  function normalizeSpinAwardMap(input, fallback) {
    const base = fallback && typeof fallback === "object" ? fallback : {};
    const source = input && typeof input === "object" ? input : {};
    const out = {};
    const keys = Object.keys(base);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const fallbackValue = Math.max(0, toInt(base[key], 0));
      const nextValue = Math.max(0, toInt(source[key], fallbackValue));
      out[key] = nextValue;
    }
    return out;
  }

  function normalizePayoutBySize(input, fallback) {
    const base = fallback && typeof fallback === "object" ? fallback : {};
    const source = input && typeof input === "object" ? input : {};
    const out = {};
    const keys = Object.keys(base);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const fallbackValue = Math.max(0, Number(base[key]) || 0);
      const nextValue = Math.max(0, Number(source[key]));
      out[key] = Number.isFinite(nextValue) && nextValue > 0 ? nextValue : fallbackValue;
    }
    return out;
  }

  function normalizeHighBetBoostRows(input, fallback) {
    const rows = Array.isArray(input) ? input : (Array.isArray(fallback) ? fallback : []);
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] && typeof rows[i] === "object" ? rows[i] : null;
      if (!row) continue;
      out.push({
        minBet: Math.max(0, toInt(row.minBet, 0)),
        multiplier: Math.max(1, Number(row.multiplier) || 1)
      });
    }
    out.sort((a, b) => a.minBet - b.minBet);
    return out.length ? out : deepClone(DEFAULT_GAME_CONFIG.highBetPayoutBoostTiers);
  }

  function normalizeSymbolList(inputSymbols) {
    const fallbackRows = deepClone(DEFAULT_SYMBOL_CONFIG);
    const fallbackById = {};
    for (let i = 0; i < fallbackRows.length; i++) fallbackById[fallbackRows[i].id] = fallbackRows[i];
    if (!Array.isArray(inputSymbols) || !inputSymbols.length) return fallbackRows;

    const out = [];
    const seen = {};
    for (let i = 0; i < inputSymbols.length; i++) {
      const raw = inputSymbols[i] && typeof inputSymbols[i] === "object" ? inputSymbols[i] : null;
      if (!raw) continue;
      const id = sanitizeSlotKey(raw.id);
      if (!id || seen[id]) continue;
      seen[id] = true;
      const fallback = fallbackById[id] || {};
      const scatter = Boolean(raw.scatter || fallback.scatter);
      const level = scatter ? 0 : Math.max(1, toInt(raw.level, toInt(fallback.level, 1)));
      const row = {
        id,
        name: String(raw.name || fallback.name || id).trim() || id,
        uiLabel: String(raw.uiLabel || fallback.uiLabel || raw.name || fallback.name || id).trim().slice(0, 16),
        level,
        weight: Math.max(1, toInt(raw.weight, toInt(fallback.weight, 1))),
        scatter,
        wild: Boolean(raw.wild || fallback.wild),
        iconGlyph: String(raw.iconGlyph || fallback.iconGlyph || "").trim().slice(0, 3),
        iconColor: String(raw.iconColor || fallback.iconColor || "").trim(),
        iconRingColor: String(raw.iconRingColor || fallback.iconRingColor || "").trim(),
        payoutBySize: scatter ? {} : normalizePayoutBySize(raw.payoutBySize, fallback.payoutBySize)
      };
      out.push(row);
    }

    let hasScatter = false;
    let nonScatterCount = 0;
    for (let i = 0; i < out.length; i++) {
      if (out[i].scatter) hasScatter = true;
      else nonScatterCount += 1;
    }

    if (!hasScatter) out.push(deepClone(fallbackById.scatter || DEFAULT_SYMBOL_CONFIG[DEFAULT_SYMBOL_CONFIG.length - 1]));
    if (!nonScatterCount) return fallbackRows;

    out.sort((a, b) => {
      if (a.scatter !== b.scatter) return a.scatter ? 1 : -1;
      if (a.level !== b.level) return a.level - b.level;
      return a.id < b.id ? -1 : 1;
    });
    return out;
  }

  function applySlotHeader() {
    const title = String(currentSlotMeta.name || "Cluster Rush 1000").trim() || "Cluster Rush 1000";
    const subtitle = String(currentSlotMeta.subtitle || "").trim() || "Config based tumble slot";
    if (el.slotTitle instanceof HTMLElement) el.slotTitle.textContent = title.toUpperCase();
    if (el.slotSubtitle instanceof HTMLElement) el.slotSubtitle.textContent = subtitle;
    document.title = "PIXELBUILD " + title;
  }

  function applySlotDefinition(slotDef) {
    const row = slotDef && typeof slotDef === "object" ? slotDef : {};
    currentSlotKey = sanitizeSlotKey(row.key || DEFAULT_SLOT_KEY) || DEFAULT_SLOT_KEY;
    currentSlotMeta = {
      name: String(row.name || "Cluster Rush 1000").trim() || "Cluster Rush 1000",
      subtitle: String(row.subtitle || "7x7 cluster tumbles with sticky multipliers").trim() || "7x7 cluster tumbles with sticky multipliers",
      tag: String(row.tag || "Slots").trim() || "Slots"
    };

    const cfgSource = row.config && typeof row.config === "object" ? row.config : {};
    const cfg = deepClone(DEFAULT_GAME_CONFIG);
    const keys = Object.keys(cfgSource);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!Object.prototype.hasOwnProperty.call(cfg, key)) continue;
      cfg[key] = cfgSource[key];
    }
    cfg.rows = Math.max(3, toInt(cfg.rows, DEFAULT_GAME_CONFIG.rows));
    cfg.cols = Math.max(3, toInt(cfg.cols, DEFAULT_GAME_CONFIG.cols));
    cfg.minCluster = Math.max(4, toInt(cfg.minCluster, DEFAULT_GAME_CONFIG.minCluster));
    cfg.winCounterHighlightMinRatio = Math.max(0.1, Number(cfg.winCounterHighlightMinRatio) || DEFAULT_GAME_CONFIG.winCounterHighlightMinRatio);
    cfg.bonusWinCounterHighlightMinRatio = Math.max(0.1, Number(cfg.bonusWinCounterHighlightMinRatio) || DEFAULT_GAME_CONFIG.bonusWinCounterHighlightMinRatio);
    cfg.defaultBet = Math.max(1, toInt(cfg.defaultBet, DEFAULT_GAME_CONFIG.defaultBet));
    cfg.minBet = Math.max(1, toInt(cfg.minBet, DEFAULT_GAME_CONFIG.minBet));
    cfg.maxBet = Math.max(cfg.minBet, toInt(cfg.maxBet, DEFAULT_GAME_CONFIG.maxBet));
    cfg.currencyScale = Math.max(1, toInt(cfg.currencyScale, DEFAULT_GAME_CONFIG.currencyScale || WL_CENT_SCALE));
    cfg.buyBonusCostMultiplier = Math.max(1, toInt(cfg.buyBonusCostMultiplier, DEFAULT_GAME_CONFIG.buyBonusCostMultiplier));
    cfg.buySuperBonusCostMultiplier = Math.max(1, toInt(cfg.buySuperBonusCostMultiplier, DEFAULT_GAME_CONFIG.buySuperBonusCostMultiplier));
    cfg.maxCascadesPerSpin = Math.max(8, toInt(cfg.maxCascadesPerSpin, DEFAULT_GAME_CONFIG.maxCascadesPerSpin));
    cfg.markerStartMultiplier = Math.max(1, toInt(cfg.markerStartMultiplier, DEFAULT_GAME_CONFIG.markerStartMultiplier));
    cfg.maxCellMultiplier = Math.max(cfg.markerStartMultiplier, toInt(cfg.maxCellMultiplier, DEFAULT_GAME_CONFIG.maxCellMultiplier));
    cfg.maxClusterMultiplierApplied = Math.max(1, toInt(cfg.maxClusterMultiplierApplied, DEFAULT_GAME_CONFIG.maxClusterMultiplierApplied));
    cfg.connectionBiasChance = clamp(Number(cfg.connectionBiasChance) || 0, 0, 0.5);
    cfg.basePayoutScale = Math.max(0.05, Number(cfg.basePayoutScale) || DEFAULT_GAME_CONFIG.basePayoutScale);
    cfg.maxWinMultiplier = Math.max(100, toInt(cfg.maxWinMultiplier, DEFAULT_GAME_CONFIG.maxWinMultiplier));
    cfg.clusterMultiplierCombine = String(cfg.clusterMultiplierCombine || DEFAULT_GAME_CONFIG.clusterMultiplierCombine).trim().toLowerCase();
    cfg.freeSpinsTrigger = normalizeSpinAwardMap(cfg.freeSpinsTrigger, DEFAULT_GAME_CONFIG.freeSpinsTrigger);
    cfg.freeSpinsRetrigger = normalizeSpinAwardMap(cfg.freeSpinsRetrigger, DEFAULT_GAME_CONFIG.freeSpinsRetrigger);
    cfg.highBetPayoutBoostTiers = normalizeHighBetBoostRows(cfg.highBetPayoutBoostTiers, DEFAULT_GAME_CONFIG.highBetPayoutBoostTiers);
    cfg.tierByBetMultiplier = Array.isArray(cfg.tierByBetMultiplier) && cfg.tierByBetMultiplier.length
      ? cfg.tierByBetMultiplier
      : deepClone(DEFAULT_GAME_CONFIG.tierByBetMultiplier);
    cfg.autoplayOptions = Array.isArray(cfg.autoplayOptions) && cfg.autoplayOptions.length
      ? cfg.autoplayOptions.map((v) => Math.max(0, toInt(v, 0)))
      : deepClone(DEFAULT_GAME_CONFIG.autoplayOptions);
    cfg.rtp = String(cfg.rtp || DEFAULT_GAME_CONFIG.rtp);
    cfg.volatility = String(cfg.volatility || DEFAULT_GAME_CONFIG.volatility);

    gameConfig = cfg;
    symbolConfig = normalizeSymbolList(row.symbols);
    rebuildSymbolMap();
    applySlotHeader();
  }

  async function loadSlotDefinitionFromCatalog() {
    const requested = getRequestedSlotKey();
    let selected = null;
    try {
      const response = await fetch(SLOT_CATALOG_URL, { cache: "no-store" });
      if (response.ok) {
        const raw = await response.json();
        const slots = raw && Array.isArray(raw.slots) ? raw.slots : [];
        const byKey = {};
        for (let i = 0; i < slots.length; i++) {
          const row = slots[i] && typeof slots[i] === "object" ? slots[i] : null;
          if (!row) continue;
          const key = sanitizeSlotKey(row.key);
          if (!key) continue;
          byKey[key] = row;
        }
        const fallbackKey = sanitizeSlotKey(raw && raw.defaultSlot ? raw.defaultSlot : DEFAULT_SLOT_KEY) || DEFAULT_SLOT_KEY;
        selected = byKey[requested] || byKey[fallbackKey] || null;
      }
    } catch (_error) {
      selected = null;
    }

    if (!selected) {
      applySlotDefinition({ key: DEFAULT_SLOT_KEY, name: "Cluster Rush 1000", subtitle: "7x7 cluster tumbles with sticky multipliers", tag: "Slots" });
      return false;
    }
    applySlotDefinition(selected);
    return true;
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
      else if (e === "ui_click") this.ping(380, 75, "triangle", 0.038);
      else if (e === "spin_reveal") this.ping(185, 65, "triangle", 0.042);
      else if (e === "land") this.ping(220, 85, "square", 0.045);
      else if (e === "drop_swish") this.ping(170, 95, "sawtooth", 0.038);
      else if (e === "cluster_small") this.ping(300, 100, "triangle", 0.05);
      else if (e === "cluster_mid") {
        this.ping(360, 120, "triangle", 0.06);
        this.ping(430, 130, "triangle", 0.06);
      } else if (e === "cluster_big") {
        this.ping(250, 160, "sawtooth", 0.07);
        this.ping(460, 220, "triangle", 0.065);
      } else if (e === "cluster_burst") {
        this.ping(310, 95, "triangle", 0.055);
        this.ping(520, 115, "square", 0.048);
      } else if (e === "merge") this.ping(540, 110, "square", 0.055);
      else if (e === "merge_flux") {
        this.ping(430, 95, "triangle", 0.05);
        this.ping(630, 120, "square", 0.048);
      }
      else if (e === "scatter") this.ping(620, 170, "triangle", 0.065);
      else if (e === "anticipation") this.ping(190, 190, "sawtooth", 0.055);
      else if (e === "bonus_intro") {
        this.ping(280, 180, "triangle", 0.07);
        this.ping(520, 260, "triangle", 0.07);
      } else if (e === "bonus_retrigger") {
        this.ping(360, 150, "triangle", 0.062);
        this.ping(620, 190, "triangle", 0.062);
      } else if (e === "multiplier") this.ping(760, 110, "square", 0.055);
      else if (e === "multiplier_burst") {
        this.ping(780, 120, "square", 0.058);
        this.ping(940, 90, "triangle", 0.053);
      }
      else if (e === "spin_tick") this.ping(200, 70, "triangle", 0.04);
      else if (e === "count_tick") this.ping(510, 56, "triangle", 0.028);
      else if (e === "big_win") {
        this.ping(240, 220, "sawtooth", 0.08);
        this.ping(460, 240, "triangle", 0.075);
        this.ping(780, 260, "triangle", 0.07);
      } else if (e === "max_win") {
        this.ping(180, 240, "sawtooth", 0.085);
        this.ping(420, 300, "triangle", 0.078);
        this.ping(760, 340, "triangle", 0.075);
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
          let speedBoost = 1;
          try {
            if (state && state.fastForwardUntil > Date.now()) speedBoost = state.turbo ? 2.8 : 2.2;
          } catch (_error) {
            speedBoost = 1;
          }
          const t = clamp(((now - started) * speedBoost) / ms, 0, 1);
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
      this.levelToId = {};
      this.maxLevel = 1;
      this.weightedPool = [];
      this.weightedNoScatterPool = [];
      for (let i = 0; i < symbols.length; i++) {
        const sym = symbols[i];
        this.symbolMap[sym.id] = sym;
        if (!sym.scatter) {
          const level = Math.max(1, toInt(sym.level, 1));
          if (!this.levelToId[level]) this.levelToId[level] = sym.id;
          this.maxLevel = Math.max(this.maxLevel, level);
        }
        for (let w = 0; w < Math.max(1, toInt(sym.weight, 1)); w++) {
          this.weightedPool.push(sym.id);
          if (!sym.scatter) this.weightedNoScatterPool.push(sym.id);
        }
      }
    }

    getSymbolIdByLevel(level) {
      const target = clamp(toInt(level, 1), 1, this.maxLevel);
      return this.levelToId[target] || this.levelToId[this.maxLevel] || "lv1";
    }

    scatterToFreeSpins(scatterCount) {
      const n = toInt(scatterCount, 0);
      if (n >= 7) return toInt(this.config.freeSpinsTrigger[7], 0);
      if (n === 6) return toInt(this.config.freeSpinsTrigger[6], 0);
      if (n === 5) return toInt(this.config.freeSpinsTrigger[5], 0);
      if (n === 4) return toInt(this.config.freeSpinsTrigger[4], 0);
      if (n === 3) return toInt(this.config.freeSpinsTrigger[3], 0);
      return 0;
    }

    scatterToRetrigger(scatterCount) {
      const n = toInt(scatterCount, 0);
      if (n >= 7) return toInt(this.config.freeSpinsRetrigger[7], 0);
      if (n === 6) return toInt(this.config.freeSpinsRetrigger[6], 0);
      if (n === 5) return toInt(this.config.freeSpinsRetrigger[5], 0);
      if (n === 4) return toInt(this.config.freeSpinsRetrigger[4], 0);
      if (n === 3) return toInt(this.config.freeSpinsRetrigger[3], 0);
      return 0;
    }

    rollFeatureStartScatter(rng) {
      const roll = (rng && typeof rng.next === "function") ? rng.next() : Math.random();
      if (roll < 0.52) return 3;
      if (roll < 0.8) return 4;
      if (roll < 0.93) return 5;
      if (roll < 0.985) return 6;
      return 7;
    }

    chooseRandomSymbol(rng, allowScatter, preferredSymbols) {
      const preferred = Array.isArray(preferredSymbols) ? preferredSymbols : [];
      if (preferred.length) {
        const filtered = [];
        for (let i = 0; i < preferred.length; i++) {
          const id = String(preferred[i] || "");
          if (!id) continue;
          if (!this.symbolMap[id]) continue;
          if (!allowScatter && this.symbolMap[id].scatter) continue;
          if (this.symbolMap[id].scatter) continue;
          if (filtered.indexOf(id) >= 0) continue;
          filtered.push(id);
        }
        const connectionChance = clamp(Number(this.config.connectionBiasChance) || 0, 0, 0.5);
        if (filtered.length && rng.next() < connectionChance) {
          return filtered[rng.int(filtered.length)];
        }
      }
      const pool = allowScatter ? this.weightedPool : this.weightedNoScatterPool;
      return pool[rng.int(pool.length)];
    }

    parseCustomGrid(rawText) {
      const text = String(rawText || "").trim();
      if (!text) return null;
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length !== this.config.rows) {
        throw new Error("Custom grid must have " + this.config.rows + " rows.");
      }
      const out = [];
      for (let r = 0; r < this.config.rows; r++) {
        const rowRaw = parsed[r];
        if (!Array.isArray(rowRaw) || rowRaw.length !== this.config.cols) {
          throw new Error("Each custom row must have " + this.config.cols + " symbols.");
        }
        const row = [];
        for (let c = 0; c < this.config.cols; c++) {
          const tokenRaw = String(rowRaw[c]).trim().toLowerCase();
          const token = tokenRaw === "s" || tokenRaw === "sc" ? "scatter" : tokenRaw;
          const normalized = /^\d+$/.test(token) ? this.getSymbolIdByLevel(toInt(token, 1)) : token;
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
        for (let c = 0; c < this.config.cols; c++) {
          const preferred = [];
          if (c > 0) preferred.push(row[c - 1]);
          if (r > 0) preferred.push(grid[r - 1][c]);
          if (c > 1) preferred.push(row[c - 2]);
          row.push(this.chooseRandomSymbol(rng, true, preferred));
        }
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

    getHighBetPayoutMultiplier(bet) {
      const betValue = Math.max(0, toInt(bet, 0));
      const rows = Array.isArray(this.config.highBetPayoutBoostTiers) ? this.config.highBetPayoutBoostTiers : [];
      let out = 1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] || {};
        const minBet = Math.max(0, toInt(row.minBet, 0));
        const multiplier = Math.max(1, Number(row.multiplier) || 1);
        if (betValue >= minBet) out = multiplier;
      }
      return out;
    }

    combineClusterMultiplier(activeCellMultipliers) {
      const vals = Array.isArray(activeCellMultipliers) ? activeCellMultipliers : [];
      if (!vals.length) return 1;
      const mode = String(this.config.clusterMultiplierCombine || "sum").trim().toLowerCase();
      const cap = Math.max(1, toInt(this.config.maxClusterMultiplierApplied, 4096));

      if (mode === "max") {
        let max = 0;
        for (let i = 0; i < vals.length; i++) {
          const v = Math.max(0, toInt(vals[i], 0));
          if (v > 1) max = Math.max(max, v);
        }
        return Math.min(cap, Math.max(1, max));
      }

      if (mode === "sum" || mode === "add" || mode === "stack") {
        let sum = 0;
        for (let i = 0; i < vals.length; i++) {
          const v = Math.max(0, toInt(vals[i], 0));
          if (v <= 1) continue;
          sum += v;
          if (sum >= cap) return cap;
        }
        return Math.min(cap, Math.max(1, sum));
      }

      let out = 1;
      for (let i = 0; i < vals.length; i++) {
        const v = Math.max(0, toInt(vals[i], 0));
        if (v <= 1) continue;
        out *= v;
        if (out >= cap) return cap;
      }
      return Math.min(cap, Math.max(1, out));
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
          const symbolId = grid[r][c];
          if (!symbolId) continue;
          const sym = this.symbolMap[symbolId];
          const hasPaytable = !!(sym && sym.payoutBySize && Object.keys(sym.payoutBySize).length);
          if (!sym || sym.scatter || !hasPaytable) continue;

          const queue = [[r, c]];
          const cells = [[r, c]];
          visited[r][c] = true;
          while (queue.length) {
            const cur = queue.shift();
            for (let d = 0; d < dirs.length; d++) {
              const nr = cur[0] + dirs[d][0];
              const nc = cur[1] + dirs[d][1];
              if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
              if (visited[nr][nc]) continue;
              if (grid[nr][nc] !== symbolId) continue;
              visited[nr][nc] = true;
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

    chooseMergeAnchors(clusterCells, count) {
      const sorted = clusterCells.slice().sort((a, b) => {
        if (a[0] !== b[0]) return b[0] - a[0];
        return a[1] - b[1];
      });
      const take = clamp(toInt(count, 1), 1, sorted.length);
      return sorted.slice(0, take);
    }

    getUpgradedSymbol(symbolId) {
      const sym = this.symbolMap[symbolId];
      if (!sym || sym.scatter) return symbolId;
      return this.getSymbolIdByLevel(sym.level + 1);
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
          const preferred = [];
          if (r < rows - 1 && out[r + 1][c]) preferred.push(out[r + 1][c]);
          if (c > 0 && out[r][c - 1]) preferred.push(out[r][c - 1]);
          if (c < cols - 1 && out[r][c + 1]) preferred.push(out[r][c + 1]);
          const symbolId = this.chooseRandomSymbol(rng, true, preferred);
          out[r][c] = symbolId;
          spawns.push({ to: [r, c], symbolId, dropDistance: (write - r) + 1 });
        }
      }
      return { grid: out, moves, spawns };
    }

    // Single cascade step: evaluate wins, clear winning clusters, update multiplier cells, refill.
    resolveCascadeStep(params) {
      const p = params || {};
      const grid = p.grid;
      const bet = toInt(p.bet, 0);
      const markers = p.markers || createEmptyMarkerGrid(this.config.rows, this.config.cols);
      const rng = p.rng;
      const clusters = this.findClusters(grid);
      if (!clusters.length) return null;

      const gridBefore = cloneGrid(grid);
      const gridAfterClear = cloneGrid(grid);
      const markerBefore = cloneMarkerGrid(markers);
      const clearOps = [];
      const wins = [];
      let stepWin = 0;

      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        const sym = this.symbolMap[cluster.symbolId];
        const anchor = this.chooseMergeAnchor(cluster.cells);
        const highBetBoost = this.getHighBetPayoutMultiplier(bet);
        const payoutScale = Math.max(0.1, Number(this.config.basePayoutScale) || 1);
        const currencyScale = Math.max(1, toInt(this.config.currencyScale, WL_CENT_SCALE));
        const basePayout = Math.max(1, Math.round(bet * currencyScale * this.getPayoutMultiplier(cluster.symbolId, cluster.size) * highBetBoost * payoutScale));

        const activeCellMultipliers = [];
        const multiplierCellDetails = [];
        for (let k = 0; k < cluster.cells.length; k++) {
          const cell = cluster.cells[k];
          const mk = markers[cell[0]][cell[1]];
          if (mk && mk.marked) {
            const current = Math.max(1, toInt(mk.multiplier, 1));
            const activated = current < this.config.markerStartMultiplier
              ? this.config.markerStartMultiplier
              : Math.min(this.config.maxCellMultiplier, current * 2);
            activeCellMultipliers.push(activated);
            multiplierCellDetails.push({ row: cell[0], col: cell[1], multiplier: activated });
          }
        }
        const multiplierApplied = this.combineClusterMultiplier(activeCellMultipliers);

        const payout = Math.max(1, Math.round(basePayout * Math.max(1, multiplierApplied)));
        stepWin += payout;
        wins.push({
          clusterId: i + 1,
          symbolId: cluster.symbolId,
          symbolLevel: sym.level,
          size: cluster.size,
          cells: cluster.cells.map((cell) => [cell[0], cell[1]]),
          anchor: [anchor[0], anchor[1]],
          basePayout,
          highBetBoost,
          multiplierSum: multiplierApplied,
          multiplierApplied,
          multiplierContribution: Math.max(0, payout - basePayout),
          payoutAfterMultiplier: payout,
          activeMarkedCells: activeCellMultipliers.length,
          activeCellMultipliers,
          multiplierCellDetails
        });

        for (let k = 0; k < cluster.cells.length; k++) {
          const cell = cluster.cells[k];
          gridAfterClear[cell[0]][cell[1]] = null;
        }
        clearOps.push({ clusterId: i + 1, clearedCells: cluster.cells.map((cell) => [cell[0], cell[1]]) });
      }

      for (let i = 0; i < wins.length; i++) {
        for (let k = 0; k < wins[i].cells.length; k++) {
          const cell = wins[i].cells[k];
          const mk = markers[cell[0]][cell[1]];
          if (!mk.marked) {
            mk.marked = true;
            mk.multiplier = 1;
          } else {
            const current = Math.max(1, toInt(mk.multiplier, 1));
            mk.multiplier = current < this.config.markerStartMultiplier
              ? this.config.markerStartMultiplier
              : Math.min(this.config.maxCellMultiplier, current * 2);
          }
        }
      }

      const markerAfter = cloneMarkerGrid(markers);
      const refill = this.refillGrid(gridAfterClear, rng);

      return {
        clusters: wins,
        clearOps,
        mergeOps: [],
        stepWin,
        gridBefore,
        gridAfterMerge: gridAfterClear,
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
      const markers = p.markers || createEmptyMarkerGrid(this.config.rows, this.config.cols);
      let grid = cloneGrid(p.startGrid);
      const steps = [];
      let totalWin = 0;
      const markerSnapshotBefore = cloneMarkerGrid(markers);

      for (let i = 0; i < this.config.maxCascadesPerSpin; i++) {
        const step = this.resolveCascadeStep({ rng, bet, markers, grid });
        if (!step) break;
        step.index = i + 1;
        totalWin += step.stepWin;
        step.runningTotal = totalWin;
        steps.push(step);
        grid = cloneGrid(step.gridAfterRefill);
      }

      return {
        initialGrid: cloneGrid(p.startGrid),
        markerSnapshotBefore,
        steps,
        finalGrid: grid,
        markerSnapshotAfter: cloneMarkerGrid(markers),
        totalWin,
        scatterCount: countScatterCells(grid)
      };
    }

    resolveBonusRound(params) {
      const p = params || {};
      const rng = p.rng;
      const bet = toInt(p.bet, 0);
      const initialSpins = toInt(p.initialSpins, 0);
      const superStart = Boolean(p.superStart);
      const markers = createEmptyMarkerGrid(this.config.rows, this.config.cols);
      if (superStart) {
        for (let r = 0; r < this.config.rows; r++) {
          for (let c = 0; c < this.config.cols; c++) {
            markers[r][c].marked = true;
            markers[r][c].multiplier = this.config.markerStartMultiplier;
          }
        }
      }
      const spins = [];
      let spinsLeft = initialSpins;
      let totalWin = 0;
      let topMultiplier = 1;

      for (let spinNo = 1; spinsLeft > 0 && spinNo <= 1000; spinNo++) {
        spinsLeft -= 1;
        const markerSnapshotBefore = cloneMarkerGrid(markers);
        const startGrid = this.generateGrid(rng, {});
        const chain = this.resolveSpinChain({ rng, bet, startGrid, markers });
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

      return { triggered: true, initialSpins, spins, totalWin, topMultiplier, bonusMode: superStart ? "super" : "normal" };
    }

    resolvePaidSpinOutcome(params) {
      const p = params || {};
      const rng = p.rng;
      const bet = toInt(p.bet, 0);
      const debug = p.debug || {};
      const forcedCustomGrid = Array.isArray(debug.customGrid) ? debug.customGrid : null;

      const baseStartGrid = this.generateGrid(rng, {
        forceScatterAtLeast: debug.forceScatterTrigger ? 3 : 0,
        forceBigWin: Boolean(debug.forceBigWin),
        customGrid: forcedCustomGrid
      });

      const baseMarkers = createEmptyMarkerGrid(this.config.rows, this.config.cols);
      const base = this.resolveSpinChain({ rng, bet, startGrid: baseStartGrid, markers: baseMarkers });
      let freeSpinsAward = this.scatterToFreeSpins(base.scatterCount);
      if (debug.forceScatterTrigger && freeSpinsAward <= 0) freeSpinsAward = this.config.freeSpinsTrigger[3];

      let bonus = { triggered: false, initialSpins: 0, spins: [], totalWin: 0, topMultiplier: 1, bonusMode: "none" };
      if (freeSpinsAward > 0) bonus = this.resolveBonusRound({ rng, bet, initialSpins: freeSpinsAward, superStart: false });

      const totalWinRaw = toInt(base.totalWin, 0) + toInt(bonus.totalWin, 0);
      const currencyScale = Math.max(1, toInt(this.config.currencyScale, WL_CENT_SCALE));
      const cap = bet * this.config.maxWinMultiplier * currencyScale;
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
      const mode = String(p.mode || "normal").trim().toLowerCase();
      const isSuper = mode === "super";
      const startScatter = this.rollFeatureStartScatter(rng);
      const initialSpins = Math.max(1, this.scatterToFreeSpins(startScatter));
      const bonus = this.resolveBonusRound({ rng, bet, initialSpins, superStart: isSuper });
      const totalWinRaw = toInt(bonus.totalWin, 0);
      const currencyScale = Math.max(1, toInt(this.config.currencyScale, WL_CENT_SCALE));
      const cap = bet * this.config.maxWinMultiplier * currencyScale;
      const totalWin = Math.min(totalWinRaw, cap);

      return {
        kind: isSuper ? "buy_super_bonus" : "buy_bonus",
        bet,
        base: {
          chain: {
            initialGrid: this.generateGrid(rng, {}),
            markerSnapshotBefore: createEmptyMarkerGrid(this.config.rows, this.config.cols),
            steps: [],
            finalGrid: this.generateGrid(rng, {}),
            markerSnapshotAfter: createEmptyMarkerGrid(this.config.rows, this.config.cols),
            totalWin: 0,
            scatterCount: 0
          },
          freeSpinsAward: initialSpins,
          startScatter,
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
          buyBonus: !isSuper,
          buySuperBonus: isSuper
        }
      };
    }
  }

  const audio = new AudioManager();
  const counter = new WinCounter();
  let engine = null;

  const settingsKey = "mergeup_slot_ui_v1";
  const saved = loadSettings();

  const state = {
    phase: SLOT_STATE.IDLE,
    animationPhase: SLOT_STATE.IDLE,
    balance: clamp(wlToCents(gameConfig.initialBalance), 0, 99999999999),
    bet: clamp(toInt(saved.bet, gameConfig.defaultBet), gameConfig.minBet, gameConfig.maxBet),
    db: null,
    user: null,
    lockRows: resolveLockCurrencies(),
    refs: { inventory: null },
    handlers: { inventory: null },
    walletById: {},
    walletCarryCents: 0,
    balanceDisplayKey: String(saved.balanceDisplayKey || "world_lock").trim().toLowerCase() || "world_lock",
    walletLinked: false,
    balanceSyncPaused: false,
    pendingWalletTotal: null,
    spinWin: 0,
    totalBetDisplay: wlToCents(clamp(toInt(saved.bet, gameConfig.defaultBet), gameConfig.minBet, gameConfig.maxBet)),
    tumbleWin: 0,
    bonusWin: 0,
    bonusTotalWin: 0,
    fsLeft: 0,
    currentScatterCount: 0,
    currentTumbleIndex: 0,
    multipliersPersist: false,
    currentGrid: null,
    currentMarkerMap: null,
    busy: false,
    turbo: Boolean(saved.turbo),
    muted: Boolean(saved.muted),
    autoplayRemaining: toInt(saved.autoplayRemaining, 0),
    fastForwardUntil: 0,
    lastResolved: null,
    history: []
  };

  let winCounterHideTimer = 0;
  let winCounterDismissResolve = null;
  let winCounterAnimating = false;
  let winCounterAtEnd = false;
  let winCounterTargetValue = 0;
  let winCounterCurrentValue = 0;
  let winCounterLastPulseAt = 0;

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
        balance: state.balance,
        balanceDisplayKey: state.balanceDisplayKey
      }));
    } catch (_error) {
      // noop
    }
  }

  function getBalanceDisplayRows() {
    const rows = Array.isArray(state.lockRows) ? state.lockRows.slice() : [];
    rows.sort((a, b) => (a.value - b.value) || (a.id - b.id));
    if (!rows.length) rows.push({ id: 9, key: "world_lock", value: 1, short: "WL" });
    return rows;
  }

  function getActiveBalanceDisplayRow() {
    const rows = getBalanceDisplayRows();
    const key = String(state.balanceDisplayKey || "").trim().toLowerCase();
    let row = rows.find((r) => String(r.key || "").trim().toLowerCase() === key);
    if (!row) row = rows.find((r) => toInt(r.value, 0) === 1);
    return row || rows[0];
  }

  function formatBalanceDisplay(valueInCents) {
    const row = getActiveBalanceDisplayRow();
    const wlValue = centsToWl(valueInCents);
    const unitValue = Math.max(1, Number(row.value) || 1);
    const amount = wlValue / unitValue;
    const minFrac = unitValue === 1 ? 2 : 2;
    const maxFrac = unitValue === 1 ? 2 : 4;
    return amount.toLocaleString("en-US", { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac }) + " " + String(row.short || "WL");
  }

  function cycleBalanceDisplayMode() {
    const rows = getBalanceDisplayRows();
    if (rows.length <= 1) return;
    const currentKey = String(state.balanceDisplayKey || "").trim().toLowerCase();
    let idx = rows.findIndex((r) => String(r.key || "").trim().toLowerCase() === currentKey);
    if (idx < 0) idx = rows.findIndex((r) => toInt(r.value, 0) === 1);
    if (idx < 0) idx = 0;
    const next = rows[(idx + 1) % rows.length];
    state.balanceDisplayKey = String(next.key || "world_lock").trim().toLowerCase();
    updateHUD();
    saveSettings();
    setMessage("Balance view: " + String(next.short || "WL"));
  }

  function walletCarryStorageKey() {
    const accountId = state.user && state.user.accountId ? String(state.user.accountId).trim() : "";
    if (!accountId) return "";
    return "mergeup_slot_wallet_carry_v1_" + accountId;
  }

  function loadWalletCarryCents() {
    try {
      const key = walletCarryStorageKey();
      if (!key) return 0;
      const raw = localStorage.getItem(key);
      return clamp(toInt(raw, 0), 0, currencyScale() - 1);
    } catch (_error) {
      return 0;
    }
  }

  function saveWalletCarryCents(cents) {
    try {
      const key = walletCarryStorageKey();
      if (!key) return;
      localStorage.setItem(key, String(clamp(toInt(cents, 0), 0, currencyScale() - 1)));
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
    state.walletCarryCents = loadWalletCarryCents();
    const db = await connectDb();
    state.refs.inventory = db.ref(BASE_PATH + "/player-inventories/" + state.user.accountId);
    state.handlers.inventory = (snap) => {
      const value = snap && typeof snap.val === "function" ? (snap.val() || {}) : {};
      const wallet = walletFromInventory(value, state.lockRows);
      state.walletById = wallet.byId;
      const liveCents = wlToCents(wallet.total) + state.walletCarryCents;
      if (state.balanceSyncPaused) {
        return;
      }
      state.balance = liveCents;
      state.pendingWalletTotal = null;
      state.walletLinked = true;
      updateHUD();
    };
    state.refs.inventory.on("value", state.handlers.inventory);
    const first = await state.refs.inventory.once("value");
    state.handlers.inventory(first);
    return true;
  }

  async function applyWalletDelta(deltaCentsInput) {
    if (!state.walletLinked || !state.refs.inventory) return { ok: false, reason: "wallet-unavailable" };
    const scale = currencyScale();
    const deltaCents = toInt(deltaCentsInput, 0);
    if (!deltaCents) return { ok: true, amount: 0, previousTotal: state.balance, nextTotal: state.balance };

    const previousTotalCents = Math.max(0, toInt(state.balance, 0));
    const nextTotalCents = previousTotalCents + deltaCents;
    if (nextTotalCents < 0) return { ok: false, reason: "not-enough-locks" };

    const currentWholeLocks = Math.floor(previousTotalCents / scale);
    const nextWholeLocks = Math.floor(nextTotalCents / scale);
    const wholeLockDelta = nextWholeLocks - currentWholeLocks;
    const nextCarryCents = clamp(nextTotalCents - (nextWholeLocks * scale), 0, scale - 1);

    let failReason = "";
    if (wholeLockDelta !== 0) {
      const tx = await state.refs.inventory.transaction((currentRaw) => {
        const currentObj = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
        const wallet = walletFromInventory(currentObj, state.lockRows);
        const nextWholeFromLive = wallet.total + wholeLockDelta;
        if (nextWholeFromLive < 0) {
          failReason = "not-enough-locks";
          return;
        }
        const nextById = decomposeLocks(nextWholeFromLive, state.lockRows);
        for (let i = 0; i < state.lockRows.length; i++) {
          const row = state.lockRows[i];
          currentObj[row.id] = Math.max(0, Math.floor(Number(nextById[row.id]) || 0));
        }
        return currentObj;
      });
      if (!tx || !tx.committed) return { ok: false, reason: failReason || "aborted" };
    }

    state.walletCarryCents = nextCarryCents;
    saveWalletCarryCents(state.walletCarryCents);
    state.balance = nextTotalCents;
    state.pendingWalletTotal = null;

    return { ok: true, amount: deltaCents, previousTotal: previousTotalCents, nextTotal: nextTotalCents };
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
    state.balance = Math.max(0, toInt(state.pendingWalletTotal, state.balance));
    state.pendingWalletTotal = null;
    updateHUD();
  }

  function setPhase(phase) {
    state.phase = phase;
    state.animationPhase = phase;
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
    hideWinCounterNow();
    el.banner.textContent = value;
    el.banner.classList.toggle("big", Boolean(isBig));
    el.banner.classList.remove("hidden");
  }

  function clearWinCounterTimer() {
    if (!winCounterHideTimer) return;
    window.clearTimeout(winCounterHideTimer);
    winCounterHideTimer = 0;
  }

  function isWinCounterVisible() {
    return (el.winCounterOverlay instanceof HTMLElement) && !el.winCounterOverlay.classList.contains("hidden");
  }

  function hideWinCounterNow() {
    clearWinCounterTimer();
    if (el.winCounterOverlay instanceof HTMLElement) {
      el.winCounterOverlay.classList.add("hidden");
      el.winCounterOverlay.classList.remove("counting");
    }
    if (el.winCounterValue instanceof HTMLElement) el.winCounterValue.classList.remove("value-pop");
    winCounterAnimating = false;
    winCounterAtEnd = false;
    winCounterTargetValue = 0;
    winCounterCurrentValue = 0;
    winCounterLastPulseAt = 0;
    if (typeof winCounterDismissResolve === "function") {
      const resolve = winCounterDismissResolve;
      winCounterDismissResolve = null;
      resolve();
    }
  }

  function showWinCounter(label) {
    clearWinCounterTimer();
    if (el.winCounterLabel instanceof HTMLElement) {
      el.winCounterLabel.textContent = String(label || "WIN").trim().toUpperCase();
    }
    if (el.winCounterOverlay instanceof HTMLElement) el.winCounterOverlay.classList.remove("hidden");
    winCounterAtEnd = false;
    if (!winCounterAnimating) winCounterTargetValue = Math.max(winCounterTargetValue, winCounterCurrentValue);
  }

  function setWinCounterCounting(flag) {
    if (!(el.winCounterOverlay instanceof HTMLElement)) return;
    el.winCounterOverlay.classList.toggle("counting", Boolean(flag));
  }

  function queueHideWinCounter(ms) {
    clearWinCounterTimer();
    const delay = Math.max(0, toInt(ms, state.turbo ? 280 : 520));
    winCounterHideTimer = window.setTimeout(() => {
      winCounterHideTimer = 0;
      hideWinCounterNow();
    }, delay);
  }

  function waitForWinCounterDismiss() {
    if (!isWinCounterVisible()) return Promise.resolve();
    if (typeof winCounterDismissResolve === "function") return Promise.resolve();
    return new Promise((resolve) => {
      winCounterDismissResolve = resolve;
    });
  }

  function setWinCounterValue(value) {
    if (!(el.winCounterValue instanceof HTMLElement)) return;
    winCounterCurrentValue = Math.max(0, toInt(value, 0));
    el.winCounterValue.textContent = formatWL(winCounterCurrentValue);
    if (winCounterAnimating) {
      const now = Date.now();
      if ((now - winCounterLastPulseAt) >= (state.turbo ? 90 : 130)) {
        winCounterLastPulseAt = now;
        el.winCounterValue.classList.remove("value-pop");
        window.requestAnimationFrame(() => {
          if (el.winCounterValue instanceof HTMLElement) el.winCounterValue.classList.add("value-pop");
        });
      }
    } else {
      el.winCounterValue.classList.remove("value-pop");
    }
    if (!winCounterAnimating && winCounterCurrentValue >= winCounterTargetValue) winCounterAtEnd = true;
  }

  function handleWinCounterClick() {
    if (!isWinCounterVisible()) return false;
    if (winCounterAnimating && !winCounterAtEnd) {
      counter.skip();
      requestFastForward(state.turbo ? 340 : 620);
      return true;
    }
    if (winCounterAtEnd) {
      hideWinCounterNow();
      return true;
    }
    return true;
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
    if (el.balanceValue) {
      el.balanceValue.textContent = formatBalanceDisplay(state.balance);
      el.balanceValue.title = "Click to cycle lock unit";
    }
    if (el.betValue) el.betValue.textContent = formatWL(wlToCents(state.bet));
    if (el.spinWinValue) el.spinWinValue.textContent = formatWL(state.spinWin);
    if (el.totalBetValue) el.totalBetValue.textContent = formatWL(state.totalBetDisplay);
    if (el.tumbleWinValue) el.tumbleWinValue.textContent = formatWL(state.tumbleWin);
    if (el.bonusWinValue) el.bonusWinValue.textContent = formatWL(state.bonusWin);
    if (el.fsValue) el.fsValue.textContent = String(state.fsLeft);
    if (el.betInput instanceof HTMLInputElement) el.betInput.value = String(state.bet);
    if (el.buyBonusBtn instanceof HTMLButtonElement) el.buyBonusBtn.textContent = "Buy Bonus (" + gameConfig.buyBonusCostMultiplier + "x)";
    if (el.buySuperBonusBtn instanceof HTMLButtonElement) el.buySuperBonusBtn.textContent = "Buy Super (" + gameConfig.buySuperBonusCostMultiplier + "x)";
    updateTopButtons();
  }

  function setControlsBusy(flag) {
    const busy = Boolean(flag);
    state.busy = busy;
    if (el.spinBtn instanceof HTMLButtonElement) el.spinBtn.disabled = busy;
    if (el.buyBonusBtn instanceof HTMLButtonElement) el.buyBonusBtn.disabled = busy;
    if (el.buySuperBonusBtn instanceof HTMLButtonElement) el.buySuperBonusBtn.disabled = busy;
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
    const sym = symbolMap[symbolId];
    if (!sym) return symbolId ? String(symbolId).toUpperCase() : "?";
    const value = String(sym.uiLabel || sym.name || symbolId).trim();
    if (!value) return "?";
    return value.slice(0, 14).toUpperCase();
  }

  function symbolLevelText(symbolId) {
    const sym = symbolMap[symbolId];
    if (!sym) return "";
    if (sym.scatter) return String(sym.bonusLabel || "BONUS").slice(0, 8).toUpperCase();
    if (sym.level <= 0) return "";
    return "L" + toInt(sym.level, 1);
  }

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

  function escapeSvgText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function symbolIconMarkup(symbolId) {
    const id = String(symbolId || "");
    if (!id) return "";
    if (iconMarkupCache[id]) return iconMarkupCache[id];

    const sym = symbolMap[id] || {};
    const level = Math.max(0, toInt(sym.level, 0));
    const bodyColor = String(sym.iconColor || levelColor(level || 1));
    const ringColor = String(sym.iconRingColor || (sym.scatter ? "rgba(255,210,138,0.72)" : "rgba(166,195,238,0.42)"));
    const glyphRaw = String(sym.iconGlyph || (sym.scatter ? "S" : (level > 0 ? ("L" + level) : ""))).trim();
    const glyph = escapeSvgText(glyphRaw.slice(0, 3).toUpperCase());
    const underText = sym.scatter ? "BONUS" : ("L" + Math.max(1, level));

    const html =
      "<svg viewBox=\"0 0 48 48\" aria-hidden=\"true\" focusable=\"false\">" +
        "<circle cx=\"24\" cy=\"24\" r=\"20\" fill=\"rgba(17,25,40,0.84)\" stroke=\"" + ringColor + "\" stroke-width=\"2\" />" +
        "<circle cx=\"24\" cy=\"24\" r=\"11.5\" fill=\"" + bodyColor + "\" />" +
        "<circle cx=\"24\" cy=\"24\" r=\"11.5\" fill=\"url(#shine_" + id + ")\" opacity=\"0.26\" />" +
        "<defs><radialGradient id=\"shine_" + id + "\" cx=\"35%\" cy=\"30%\" r=\"75%\"><stop offset=\"0%\" stop-color=\"#ffffff\" stop-opacity=\"0.95\"/><stop offset=\"100%\" stop-color=\"#ffffff\" stop-opacity=\"0\"/></radialGradient></defs>" +
        "<text x=\"24\" y=\"26.8\" text-anchor=\"middle\" font-size=\"8.6\" font-weight=\"800\" fill=\"#f5faff\" letter-spacing=\"0.2\">" + glyph + "</text>" +
        "<text x=\"24\" y=\"39.5\" text-anchor=\"middle\" font-size=\"6.2\" font-weight=\"700\" fill=\"rgba(236,245,255,0.92)\" letter-spacing=\"0.25\">" + escapeSvgText(underText) + "</text>" +
      "</svg>";

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

  function cellKey(row, col) {
    return String(row) + ":" + String(col);
  }

  function buildSpinDropDistanceMap() {
    const map = {};
    for (let r = 0; r < gameConfig.rows; r++) {
      for (let c = 0; c < gameConfig.cols; c++) {
        map[cellKey(r, c)] = r + 3 + (c % 2);
      }
    }
    return map;
  }

  function buildRevealColumnDropDistanceMap(colIndex) {
    const map = {};
    const col = clamp(toInt(colIndex, 0), 0, gameConfig.cols - 1);
    for (let r = 0; r < gameConfig.rows; r++) map[cellKey(r, col)] = r + 2;
    return map;
  }

  function buildRefillDropDistanceMap(step) {
    const map = {};
    if (!step || typeof step !== "object") return map;

    const moves = Array.isArray(step.refillMoves) ? step.refillMoves : [];
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i] || {};
      const from = Array.isArray(move.from) ? move.from : null;
      const to = Array.isArray(move.to) ? move.to : null;
      if (!from || !to || from.length < 2 || to.length < 2) continue;
      const toRow = toInt(to[0], -1);
      const toCol = toInt(to[1], -1);
      const fromRow = toInt(from[0], -1);
      if (toRow < 0 || toCol < 0 || fromRow < 0) continue;
      const dist = Math.max(1, toRow - fromRow);
      const key = cellKey(toRow, toCol);
      map[key] = Math.max(toInt(map[key], 0), dist);
    }

    const spawns = Array.isArray(step.refillSpawns) ? step.refillSpawns : [];
    for (let i = 0; i < spawns.length; i++) {
      const spawn = spawns[i] || {};
      const to = Array.isArray(spawn.to) ? spawn.to : null;
      if (!to || to.length < 2) continue;
      const toRow = toInt(to[0], -1);
      const toCol = toInt(to[1], -1);
      if (toRow < 0 || toCol < 0) continue;
      let dist = toInt(spawn.dropDistance, 0);
      if (dist <= 0) dist = toRow + 2;
      dist = Math.max(dist, toRow + 1);
      const key = cellKey(toRow, toCol);
      map[key] = Math.max(toInt(map[key], 0), dist + 1);
    }
    return map;
  }

  function buildGridDom() {
    if (!(el.grid instanceof HTMLElement)) return;
    el.grid.innerHTML = "";
    el.grid.style.setProperty("--slot-cols", String(gameConfig.cols));
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
        root.style.removeProperty("--drop-from");
        root.style.removeProperty("--drop-delay");
        root.style.removeProperty("--reveal-delay");
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
    const dropDistances = opts.dropDistances && typeof opts.dropDistances === "object" ? opts.dropDistances : null;
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
          const sym = symbolMap[symbolId];
          view.symbol.textContent = (sym && sym.scatter) ? symbolLabel(symbolId) : "";
          view.level.textContent = symbolLevelText(symbolId);
          if (symbolId === "scatter" && scatterPulse) root.classList.add("scatter-hit");
        }

        if (drop && symbolId) {
          const key = cellKey(r, c);
          let distance = 0;
          if (dropDistances) distance = toInt(dropDistances[key], 0);
          if (!dropDistances || distance > 0) {
            if (distance <= 0) distance = r + 1;
            const px = Math.min(300, 18 + (distance * 20));
            root.classList.add("drop-in");
            root.style.setProperty("--drop-from", String(px) + "px");
            const delayMs = (dropDistances ? (c * 20) + (r * 7) : (r * 22) + (c * 10));
            root.style.setProperty("--drop-delay", String(delayMs) + "ms");
          }
        }
        if (spinCycle && symbolId) root.classList.add("spin-cycling");
        if (revealPop && symbolId) {
          root.classList.add("reveal-pop");
          root.style.setProperty("--reveal-delay", String((c * 30) + (r * 8)) + "ms");
        } else if (revealColumn >= 0 && c <= revealColumn && symbolId) {
          root.classList.add("reveal-pop");
          root.style.setProperty("--reveal-delay", String((c * 34) + (r * 6)) + "ms");
        }

        const marker = markers && markers[r] && markers[r][c] ? markers[r][c] : null;
        if (marker && marker.marked) {
          root.classList.add("marked-cell");
          const markerValue = Math.max(1, toInt(marker.multiplier, 1));
          if (markerValue > 1) root.classList.add("mult-active");
          view.marker.classList.remove("hidden");
          view.marker.textContent = markerValue > 1 ? ("x" + markerValue) : "•";
        } else {
          root.classList.remove("marked-cell", "mult-active");
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
      const targets = Array.isArray(op.anchors) && op.anchors.length ? op.anchors : [op.anchor];
      for (let t = 0; t < targets.length; t++) {
        const target = targets[t];
        cells[target[0]][target[1]].root.classList.add("merge-target");
      }
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

  function getWinSfxByAmount(winAmount, bet) {
    const ratio = ratioToBet(winAmount, bet);
    if (ratio >= 10) return "cluster_big";
    if (ratio >= 3) return "cluster_mid";
    return "cluster_small";
  }

  function triggerAreaFx(className, durationMs) {
    if (!(el.spinArea instanceof HTMLElement)) return;
    const cls = String(className || "").trim();
    if (!cls) return;
    const duration = Math.max(120, toInt(durationMs, 280));
    el.spinArea.classList.remove(cls);
    window.requestAnimationFrame(() => {
      el.spinArea.classList.add(cls);
      window.setTimeout(() => el.spinArea.classList.remove(cls), duration);
    });
  }

  function triggerOverlayFx(className, durationMs) {
    if (!(el.winCounterOverlay instanceof HTMLElement)) return;
    const cls = String(className || "").trim();
    if (!cls) return;
    const duration = Math.max(120, toInt(durationMs, 420));
    el.winCounterOverlay.classList.remove(cls);
    window.requestAnimationFrame(() => {
      el.winCounterOverlay.classList.add(cls);
      window.setTimeout(() => el.winCounterOverlay.classList.remove(cls), duration);
    });
  }

  function appendFxNode(node, ttlMs) {
    if (!(el.floatingLayer instanceof HTMLElement) || !(node instanceof HTMLElement)) return;
    el.floatingLayer.appendChild(node);
    const cleanup = () => {
      if (node.parentNode) node.parentNode.removeChild(node);
    };
    node.addEventListener("animationend", cleanup, { once: true });
    window.setTimeout(cleanup, Math.max(220, toInt(ttlMs, 900)));
  }

  function spawnParticlesAtPercent(x, y, options) {
    if (!(el.floatingLayer instanceof HTMLElement)) return;
    const opts = options || {};
    const kind = String(opts.kind || "win").trim();
    const count = clamp(toInt(opts.count, 10), 1, 56);
    const spread = clamp(toInt(opts.spread, 54), 14, 160);
    const duration = clamp(toInt(opts.duration, 760), 320, 2000);
    const sizeBase = clamp(toInt(opts.size, 8), 4, 16);
    for (let i = 0; i < count; i++) {
      const node = document.createElement("div");
      node.className = "fx-particle " + kind;
      const angle = Math.random() * Math.PI * 2;
      const distance = spread * (0.35 + (Math.random() * 0.75));
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - (12 + Math.random() * 22);
      const dur = duration * (0.8 + Math.random() * 0.5);
      node.style.left = x.toFixed(3) + "%";
      node.style.top = y.toFixed(3) + "%";
      node.style.setProperty("--dx", dx.toFixed(2) + "px");
      node.style.setProperty("--dy", dy.toFixed(2) + "px");
      node.style.setProperty("--dur", Math.max(300, Math.floor(dur)) + "ms");
      node.style.setProperty("--size", (sizeBase * (0.82 + Math.random() * 0.55)).toFixed(2) + "px");
      appendFxNode(node, dur + 180);
    }
  }

  function spawnRingAtPercent(x, y, kind) {
    const node = document.createElement("div");
    node.className = "fx-ring " + String(kind || "win");
    node.style.left = x.toFixed(3) + "%";
    node.style.top = y.toFixed(3) + "%";
    appendFxNode(node, 800);
  }

  function spawnCellFx(row, col, kind, strength) {
    const x = ((toInt(col, 0) + 0.5) / gameConfig.cols) * 100;
    const y = ((toInt(row, 0) + 0.5) / gameConfig.rows) * 100;
    const count = clamp(toInt(strength, 8), 4, 28);
    const tone = String(kind || "win");
    spawnRingAtPercent(x, y, tone);
    spawnParticlesAtPercent(x, y, {
      kind: tone,
      count,
      spread: tone === "bonus" ? 84 : 62,
      duration: tone === "bonus" ? 980 : 760,
      size: tone === "bonus" ? 10 : 8
    });
  }

  function spawnClusterFx(cluster, kind) {
    if (!cluster || !Array.isArray(cluster.cells) || !cluster.cells.length) return;
    const tone = String(kind || "win");
    const cellsInCluster = cluster.cells;
    const sampleCount = Math.min(4, cellsInCluster.length);
    const step = Math.max(1, Math.floor(cellsInCluster.length / sampleCount));
    let emitted = 0;
    for (let i = 0; i < cellsInCluster.length && emitted < sampleCount; i += step) {
      const cell = cellsInCluster[i];
      spawnCellFx(cell[0], cell[1], tone, 7 + Math.floor(Math.random() * 5));
      emitted += 1;
    }
    if (cluster.anchor && cluster.anchor.length >= 2) {
      spawnCellFx(cluster.anchor[0], cluster.anchor[1], tone, 11 + Math.min(12, Math.floor(cluster.size / 2)));
    }
  }

  function spawnCenterFx(kind, count) {
    spawnParticlesAtPercent(50, 48, {
      kind: String(kind || "win"),
      count: clamp(toInt(count, 18), 8, 64),
      spread: 120,
      duration: 1100,
      size: 10
    });
    spawnRingAtPercent(50, 48, String(kind || "win"));
  }

  function flashScatterCells(grid) {
    if (!Array.isArray(grid)) return;
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] || [];
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== "scatter") continue;
        spawnCellFx(r, c, "scatter", 13);
      }
    }
  }

  function isFastForwardActive() {
    return state.fastForwardUntil > Date.now();
  }

  function requestFastForward(durationMs) {
    const fallback = state.turbo ? 650 : 1200;
    const ms = Math.max(250, toInt(durationMs, fallback));
    state.fastForwardUntil = Math.max(state.fastForwardUntil, Date.now() + ms);
  }

  function pause(baseMs) {
    let scale = state.turbo ? 0.62 : 1.35;
    if (isFastForwardActive()) scale = scale * 0.58;
    const floorMs = isFastForwardActive() ? 34 : 0;
    const ms = Math.max(floorMs, Math.floor(baseMs * scale));
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function countDurationByWin(win, bet) {
    const ratio = ratioToBet(win, bet);
    let duration = 0;
    if (ratio >= 20) duration = state.turbo ? 1200 : 2900;
    else if (ratio >= 8) duration = state.turbo ? 900 : 2100;
    else if (ratio >= 3) duration = state.turbo ? 620 : 1400;
    else duration = state.turbo ? 340 : 780;
    if (isFastForwardActive()) duration = Math.max(160, Math.floor(duration * 0.56));
    return duration;
  }

  function getWinTierLabel(totalWin, bet) {
    const ratio = ratioToBet(totalWin, bet);
    for (let i = 0; i < gameConfig.tierByBetMultiplier.length; i++) {
      const row = gameConfig.tierByBetMultiplier[i];
      if (ratio >= row.ratio) return row.label;
    }
    return "WIN";
  }

  function getFinalWinCounterLabel(totalWin, bet, options) {
    const opts = options || {};
    if (opts.maxWin) return "MAX WIN";
    const ratio = ratioToBet(totalWin, bet);
    if (ratio >= 40) return "MASSIVE WIN";
    if (ratio >= 20) return "BIG WIN";
    if (ratio >= 8) return "NICE WIN";
    if (opts.bonusTriggered) return "BONUS WIN";
    return "WIN";
  }

  function getMilestoneWinLabel(totalWin, bet, isBonus) {
    const win = Math.max(0, toInt(totalWin, 0));
    const baseBet = Math.max(1, wlToCents(bet));
    const ratio = win / baseBet;
    const minRatio = isBonus
      ? Math.max(0.1, Number(gameConfig.bonusWinCounterHighlightMinRatio) || 6)
      : Math.max(0.1, Number(gameConfig.winCounterHighlightMinRatio) || 1.6);
    if (ratio < minRatio) return "";
    if (ratio >= 50) return "MAX WIN";
    if (ratio >= 20) return "EPIC WIN";
    if (ratio >= 8) return "MASSIVE WIN";
    if (ratio >= 3) return "MEGA WIN";
    return "BIG WIN";
  }

  async function presentMilestoneWinCounter(totalWin, bet, isBonus) {
    const win = Math.max(0, toInt(totalWin, 0));
    if (!win) return;
    const tier = getMilestoneWinLabel(win, bet, isBonus);
    if (!tier) return;
    const label = isBonus ? ("BONUS " + tier) : tier;
    setMessage(label + " " + formatWL(win));
    await presentFinalWinCounter(win, bet, label);
  }

  async function presentFinalWinCounter(totalWin, bet, label) {
    const finalTotal = Math.max(0, toInt(totalWin, 0));
    if (!finalTotal) {
      hideWinCounterNow();
      return;
    }
    hideWinCounterNow();
    showWinCounter(label || "WIN");
    setWinCounterValue(0);

    const ratio = ratioToBet(finalTotal, bet);
    const labelText = String(label || "").toUpperCase();
    if (labelText.indexOf("MAX") >= 0) {
      audio.play("max_win");
      triggerOverlayFx("fx-tier-max", 1700);
      triggerAreaFx("fx-big-impact", 1100);
      spawnCenterFx("max", state.turbo ? 26 : 36);
    } else if (ratio >= 40) {
      audio.play("big_win");
      triggerOverlayFx("fx-tier-mega", 1400);
      triggerAreaFx("fx-win-pulse", 860);
      spawnCenterFx("bonus", state.turbo ? 22 : 30);
    } else if (ratio >= 20) {
      audio.play("cluster_big");
      triggerOverlayFx("fx-tier-big", 1180);
      triggerAreaFx("fx-win-pulse", 740);
      spawnCenterFx("gold", state.turbo ? 16 : 22);
    } else if (ratio >= 8) {
      audio.play("cluster_mid");
      triggerOverlayFx("fx-tier-mid", 980);
      spawnCenterFx("win", state.turbo ? 12 : 16);
    } else {
      audio.play("cluster_small");
      triggerOverlayFx("fx-tier-small", 760);
      spawnCenterFx("win", 10);
    }

    winCounterTargetValue = finalTotal;
    winCounterAnimating = true;
    winCounterAtEnd = false;
    setWinCounterCounting(true);
    const duration = countDurationByWin(finalTotal, bet) + (state.turbo ? 170 : 360);
    const tickEvery = state.turbo ? 190 : 250;
    const tickHandle = window.setInterval(() => {
      if (!isWinCounterVisible()) return;
      audio.play("count_tick");
      if (!state.turbo && Math.random() < 0.45) spawnCenterFx("win", 5);
    }, tickEvery);
    await counter.animate(0, finalTotal, duration, (value) => {
      setWinCounterValue(toInt(Math.round(value), 0));
    });
    window.clearInterval(tickHandle);
    winCounterAnimating = false;
    winCounterAtEnd = true;
    setWinCounterCounting(false);
    setWinCounterValue(finalTotal);
    queueHideWinCounter(state.turbo ? 170 : 320);
    await waitForWinCounterDismiss();
  }

  async function animateSpinWinTo(targetValue, duration, options) {
    const opts = options || {};
    const start = state.spinWin;
    const target = Math.max(0, toInt(targetValue, start));
    const hasTumbleSync = Number.isFinite(Number(opts.tumbleFrom)) && Number.isFinite(Number(opts.tumbleTo));
    const tumbleFrom = hasTumbleSync ? Math.max(0, toInt(opts.tumbleFrom, state.tumbleWin)) : state.tumbleWin;
    const tumbleTo = hasTumbleSync ? Math.max(0, toInt(opts.tumbleTo, tumbleFrom)) : state.tumbleWin;
    const spinSpan = target - start;

    if (opts.showOverlay !== false && target > start) {
      showWinCounter(opts.label || "WIN");
      winCounterTargetValue = target;
      winCounterAnimating = true;
      winCounterAtEnd = false;
      setWinCounterCounting(true);
      setWinCounterValue(start);
    }
    await counter.animate(start, target, duration, (value) => {
      state.spinWin = toInt(Math.round(value), start);
      if (state.spinWin > target) state.spinWin = target;
      if (hasTumbleSync) {
        if (!spinSpan) {
          state.tumbleWin = tumbleTo;
        } else {
          const progress = clamp((state.spinWin - start) / spinSpan, 0, 1);
          const tumbleNow = tumbleFrom + ((tumbleTo - tumbleFrom) * progress);
          state.tumbleWin = Math.max(0, toInt(Math.round(tumbleNow), tumbleFrom));
        }
      }
      updateHUD();
      if (opts.showOverlay !== false) setWinCounterValue(state.spinWin);
    });
    state.spinWin = target;
    if (hasTumbleSync) state.tumbleWin = tumbleTo;
    updateHUD();
    if (opts.showOverlay !== false) {
      winCounterAnimating = false;
      winCounterAtEnd = true;
      setWinCounterCounting(false);
      setWinCounterValue(state.spinWin);
    }
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
    state.currentTumbleIndex = toInt(step && step.index, 0);
    state.tumbleWin = 0;
    state.currentGrid = cloneGrid(step.gridBefore);
    state.currentMarkerMap = isBonus ? cloneMarkerGrid(step.markerBefore || createEmptyMarkerGrid(gameConfig.rows, gameConfig.cols)) : cloneMarkerGrid(step.markerBefore || createEmptyMarkerGrid(gameConfig.rows, gameConfig.cols));
    renderGrid(step.gridBefore, step.markerBefore, {});
    triggerAreaFx("fx-cascade-start", 420);
    await pause(150);

    for (let i = 0; i < step.clusters.length; i++) {
      const cluster = step.clusters[i];
      setPhase(SLOT_STATE.WIN_ANIMATION);
      highlightCluster(cluster);
      const clusterWin = toInt(cluster.payoutAfterMultiplier, 0);
      const baseWin = Math.max(0, toInt(cluster.basePayout, 0));
      const multiplierSum = Math.max(1, toInt(cluster.multiplierSum || cluster.multiplierApplied, 1));
      const multiplierContribution = Math.max(0, toInt(cluster.multiplierContribution, clusterWin - baseWin));
      const hasMultiplierStage = multiplierSum > 1 && multiplierContribution > 0;

      const preClusterTotal = state.spinWin;
      const preTumbleTotal = state.tumbleWin;
      const targetTotal = preClusterTotal + clusterWin;
      const targetTumbleTotal = preTumbleTotal + clusterWin;
      const duration = countDurationByWin(clusterWin, bet);
      const cellContrib = Array.isArray(cluster.multiplierCellDetails) ? cluster.multiplierCellDetails : [];
      let multiText = "x1";
      if (cellContrib.length) {
        const parts = [];
        for (let p = 0; p < cellContrib.length; p++) parts.push("x" + toInt(cellContrib[p].multiplier, 1));
        multiText = parts.join("+") + " => x" + multiplierSum;
      }

      setMessage(
        "Cluster " + cluster.clusterId +
        " | Base " + formatWL(baseWin) +
        " | Multipliers " + multiText +
        " | Paid " + formatWL(clusterWin)
      );

      if (hasMultiplierStage) {
        const baseTarget = preClusterTotal + baseWin;
        const baseTumbleTarget = preTumbleTotal + baseWin;
        const boostedWin = multiplierContribution;

        showFloatingText(cluster.anchor[0], cluster.anchor[1], "+" + formatWL(baseWin), false);
        spawnClusterFx(cluster, "gold");
        triggerAreaFx("fx-cluster-hit", 300);
        audio.play("cluster_burst");
        audio.play(getWinSfxByAmount(baseWin, bet));

        await animateSpinWinTo(baseTarget, countDurationByWin(baseWin, bet), {
          label: "WIN",
          showOverlay: false,
          tumbleFrom: preTumbleTotal,
          tumbleTo: baseTumbleTarget
        });
        await pause(120);

        showFloatingText(cluster.anchor[0], cluster.anchor[1], multiText + " +" + formatWL(boostedWin), true);
        spawnClusterFx(cluster, "multiplier");
        triggerAreaFx("fx-multiplier-hit", 360);
        audio.play("multiplier_burst");
        await animateSpinWinTo(targetTotal, countDurationByWin(boostedWin, bet) + 100, {
          label: "WIN",
          showOverlay: false,
          tumbleFrom: baseTumbleTarget,
          tumbleTo: targetTumbleTotal
        });
      } else {
        showFloatingText(cluster.anchor[0], cluster.anchor[1], "+" + formatWL(clusterWin), false);
        spawnClusterFx(cluster, "win");
        triggerAreaFx("fx-cluster-hit", 300);
        audio.play("cluster_burst");

        if (multiplierSum > 1) {
          showFloatingText(cluster.anchor[0], cluster.anchor[1], multiText + " applied", true);
          spawnClusterFx(cluster, "multiplier");
          triggerAreaFx("fx-multiplier-hit", 320);
          audio.play("multiplier");
        }

        audio.play(getWinSfxByAmount(clusterWin, bet));

        await animateSpinWinTo(targetTotal, duration, {
          label: "WIN",
          showOverlay: false,
          tumbleFrom: preTumbleTotal,
          tumbleTo: targetTumbleTotal
        });
      }
      await pause(260);
      clearHighlights();
      renderGrid(step.gridBefore, step.markerBefore, {});
    }

    setPhase(SLOT_STATE.MERGE);
    setMessage("Clearing winning clusters...");
    const clearOps = Array.isArray(step.clearOps) ? step.clearOps : [];
    for (let i = 0; i < clearOps.length; i++) {
      const cellsCleared = Array.isArray(clearOps[i].clearedCells) ? clearOps[i].clearedCells : [];
      for (let k = 0; k < cellsCleared.length; k++) {
        const t = cellsCleared[k];
        spawnCellFx(t[0], t[1], "merge", 6);
      }
    }
    triggerAreaFx("fx-merge-hit", 340);
    audio.play("merge");
    audio.play("merge_flux");
    await pause(260);

    renderGrid(step.gridAfterMerge, step.markerAfter, {});
    state.currentGrid = cloneGrid(step.gridAfterMerge);
    state.currentMarkerMap = cloneMarkerGrid(step.markerAfter || createEmptyMarkerGrid(gameConfig.rows, gameConfig.cols));
    await pause(220);

    setPhase(SLOT_STATE.REFILL);
    renderGrid(step.gridAfterRefill, step.markerAfter, {
      dropIn: true,
      dropDistances: buildRefillDropDistanceMap(step)
    });
    state.currentGrid = cloneGrid(step.gridAfterRefill);
    state.currentMarkerMap = cloneMarkerGrid(step.markerAfter || createEmptyMarkerGrid(gameConfig.rows, gameConfig.cols));
    setMessage("TUMBLE " + step.index + " | Step win: " + formatWL(step.stepWin));
    triggerAreaFx("fx-refill-drop", 280);
    audio.play("drop_swish");
    audio.play("land");
    await pause(420);
  }

  async function presentSpinChain(chain, isBonus, bet, markerSnapshotBefore) {
    setPhase(SLOT_STATE.REVEAL);
    const markerGrid = Array.isArray(markerSnapshotBefore) ? markerSnapshotBefore : null;
    state.currentTumbleIndex = 0;
    state.currentGrid = cloneGrid(chain.initialGrid);
    state.currentMarkerMap = cloneMarkerGrid(markerGrid || createEmptyMarkerGrid(gameConfig.rows, gameConfig.cols));
    setMessage("Spinning...");
    triggerAreaFx("fx-spin-start", 520);
    const cycleCount = state.turbo ? 4 : 8;
    for (let i = 0; i < cycleCount; i++) {
      renderGrid(buildSpinPreviewGrid(chain.initialGrid, -1), markerGrid, { spinCycle: true });
      if ((i % 2) === 0) audio.play("spin_tick");
      await pause(60);
    }

    for (let col = 0; col < gameConfig.cols; col++) {
      const revealGrid = buildSpinPreviewGrid(chain.initialGrid, col);
      renderGrid(revealGrid, markerGrid, {
        spinCycle: true,
        revealColumn: col,
        dropIn: true,
        dropDistances: buildRevealColumnDropDistanceMap(col)
      });
      if (col >= gameConfig.cols - 2) audio.play("spin_reveal");
      audio.play("land");
      await pause(95);
    }

    renderGrid(chain.initialGrid, markerGrid, {
      dropIn: true,
      dropDistances: buildSpinDropDistanceMap(),
      scatterPulse: true,
      revealPop: true
    });
    const scatters = countScatterCells(chain.initialGrid);
    state.currentScatterCount = scatters;
    if (scatters >= 3) {
      setMessage("Scatter suspense: " + scatters + " visible.");
      flashScatterCells(chain.initialGrid);
      triggerAreaFx("fx-scatter-alert", 560);
      audio.play("scatter");
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
    const finalMarkers = chain.markerSnapshotAfter || (chain.steps.length ? chain.steps[chain.steps.length - 1].markerAfter : markerGrid);
    renderGrid(chain.finalGrid, finalMarkers, {});
    state.currentGrid = cloneGrid(chain.finalGrid);
    state.currentMarkerMap = cloneMarkerGrid(finalMarkers || createEmptyMarkerGrid(gameConfig.rows, gameConfig.cols));
    state.currentScatterCount = countScatterCells(chain.finalGrid);
  }

  async function presentBonusIntro(spins, isSuperMode, startScatter) {
    setPhase(SLOT_STATE.BONUS_INTRO);
    const superMode = Boolean(isSuperMode);
    const scatterText = toInt(startScatter, 0) > 0 ? (" (" + toInt(startScatter, 0) + " scatters)") : "";
    setBanner((superMode ? "SUPER BONUS" : "FREE SPINS") + "\n" + spins + " AWARDED" + scatterText, true);
    if (superMode) {
      setMessage("Super bonus: every cell starts preloaded at x" + gameConfig.markerStartMultiplier + " and persists until feature ends.");
    } else {
      setMessage("Bonus mode: multiplier spots persist for the entire feature.");
    }
    triggerAreaFx("fx-bonus-intro", 1400);
    spawnCenterFx("bonus", state.turbo ? 22 : 34);
    audio.play("bonus_intro");
    await pause(1350);
    setBanner("");
  }

  async function presentBonusSummary(bonusWin, topMultiplier) {
    setPhase(SLOT_STATE.BONUS_SUMMARY);
    setBanner("BONUS COMPLETE\n" + formatWL(bonusWin) + "\nTop cell x" + topMultiplier, true);
    setMessage("Free spins complete.");
    triggerAreaFx("fx-bonus-summary", 1300);
    spawnCenterFx("bonus", state.turbo ? 16 : 24);
    await pause(1250);
    setBanner("");
  }

  async function runResolvedRound(resolved, roundCost) {
    state.fastForwardUntil = 0;
    hideWinCounterNow();
    state.spinWin = 0;
    state.tumbleWin = 0;
    state.bonusWin = 0;
    state.bonusTotalWin = 0;
    state.fsLeft = 0;
    state.multipliersPersist = false;
    state.currentScatterCount = 0;
    state.currentTumbleIndex = 0;
    updateHUD();

    if (resolved.kind === "paid") {
      await presentSpinChain(resolved.base.chain, false, resolved.bet, resolved.base.chain.markerSnapshotBefore);
      await presentMilestoneWinCounter(resolved.base.chain.totalWin, resolved.bet, false);
    }

    if (resolved.base.triggeredBonus || resolved.kind === "buy_bonus" || resolved.kind === "buy_super_bonus") {
      state.multipliersPersist = true;
      const triggerScatter = toInt(resolved.base.startScatter, toInt(resolved.base && resolved.base.chain ? resolved.base.chain.scatterCount : 0, 0));
      if (resolved.kind === "paid" && triggerScatter >= 3) {
        setMessage("Scatter trigger! " + triggerScatter + " scatters -> " + resolved.base.freeSpinsAward + " free spins.");
        flashScatterCells(resolved.base.chain.finalGrid || resolved.base.chain.initialGrid || []);
        setBanner("SCATTER TRIGGER\n" + triggerScatter + " SCATTERS", false);
        audio.play("scatter");
        await pause(700);
        setBanner("");
      }
      await presentBonusIntro(resolved.base.freeSpinsAward, resolved.bonus && resolved.bonus.bonusMode === "super", triggerScatter);
      state.fsLeft = resolved.base.freeSpinsAward;
      updateHUD();

      setPhase(SLOT_STATE.BONUS_SPIN);
      for (let i = 0; i < resolved.bonus.spins.length; i++) {
        const spin = resolved.bonus.spins[i];
        state.fsLeft = spin.spinsLeftAfter + 1;
        updateHUD();
        setMessage("Free Spin " + spin.spinIndex + " | Remaining: " + state.fsLeft);
        await presentSpinChain(spin.chain, true, resolved.bet, spin.markerSnapshotBefore);
        await presentMilestoneWinCounter(spin.chain.totalWin, resolved.bet, true);

        state.bonusWin += spin.chain.totalWin;
        state.bonusTotalWin = state.bonusWin;
        updateHUD();
        state.fsLeft = spin.spinsLeftAfter;
        updateHUD();

        if (spin.retriggerAward > 0) {
          setBanner("RETRIGGER +" + spin.retriggerAward, false);
          triggerAreaFx("fx-retrigger", 760);
          spawnCenterFx("gold", state.turbo ? 10 : 16);
          audio.play("bonus_retrigger");
          await pause(760);
          setBanner("");
        }
      }
      await presentBonusSummary(resolved.bonus.totalWin, resolved.bonus.topMultiplier);
    }

    setPhase(SLOT_STATE.CREDIT);
    const totalWin = toInt(resolved.totalWin, 0);
    const finalWinLabel = getFinalWinCounterLabel(totalWin, resolved.bet, {
      maxWin: Boolean(resolved.maxWinCapped),
      bonusTriggered: Boolean(resolved.base && resolved.base.triggeredBonus) || resolved.kind === "buy_bonus" || resolved.kind === "buy_super_bonus"
    });

    if (totalWin > 0) {
      setMessage(finalWinLabel + " " + formatWL(totalWin));
      await presentFinalWinCounter(totalWin, resolved.bet, finalWinLabel);

      setMessage("Crediting " + formatWL(totalWin) + " to balance...");
      triggerAreaFx("fx-crediting", 760);
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
        spawnCenterFx("win", state.turbo ? 8 : 12);

        const credited = targetBalance - startBalance;
        const displayed = toInt(resolved.totalWin, 0);
        appendDebug("credit-check | displayed=" + displayed + " | credited=" + credited + " | raw=" + resolved.totalWinRaw + " | capped=" + resolved.maxWinCapped);
        if (displayed !== credited) appendDebug("ERROR: displayed and credited mismatch.");

        setMessage(finalWinLabel + " " + formatWL(totalWin) + (resolved.maxWinCapped ? " (MAX WIN CAP)" : ""));
        pushHistory(finalWinLabel + " +" + formatWL(totalWin) + (roundCost > 0 ? (" after " + formatWL(roundCost) + " cost") : ""), true);
      }
    } else {
      setMessage("No win this round.");
      pushHistory("No win (cost " + formatWL(roundCost) + ")", false);
    }

    state.fsLeft = 0;
    state.tumbleWin = 0;
    state.multipliersPersist = false;
    updateHUD();
    hideWinCounterNow();
  }

  async function runSpin(kind) {
    if (state.busy) return;
    if (isWinCounterVisible()) {
      setMessage("Tap WIN counter to continue.");
      return;
    }
    if (!state.walletLinked) {
      setMessage("Wallet not linked. Open this slot from Casino dashboard after login.");
      return;
    }
    const mode = String(kind || "paid");
    let cost = wlToCents(state.bet);
    if (mode === "buy_bonus") cost = toInt(wlToCents(state.bet) * gameConfig.buyBonusCostMultiplier, 0);
    else if (mode === "buy_super_bonus") cost = toInt(wlToCents(state.bet) * gameConfig.buySuperBonusCostMultiplier, 0);
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
    state.fastForwardUntil = 0;
    state.totalBetDisplay = cost;
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
      resolved = engine.resolveBonusPurchaseOutcome({ rng, bet: state.bet, mode: "normal" });
      setMessage("Bonus bought for " + formatWL(cost) + ".");
    } else if (mode === "buy_super_bonus") {
      resolved = engine.resolveBonusPurchaseOutcome({ rng, bet: state.bet, mode: "super" });
      setMessage("Super bonus bought for " + formatWL(cost) + ".");
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
    state.fastForwardUntil = 0;

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
    const trigger3 = toInt(gameConfig.freeSpinsTrigger && gameConfig.freeSpinsTrigger[3], 10);
    const trigger4 = toInt(gameConfig.freeSpinsTrigger && gameConfig.freeSpinsTrigger[4], 12);
    const trigger5 = toInt(gameConfig.freeSpinsTrigger && gameConfig.freeSpinsTrigger[5], 15);
    const trigger6 = toInt(gameConfig.freeSpinsTrigger && gameConfig.freeSpinsTrigger[6], 20);
    const trigger7 = toInt(gameConfig.freeSpinsTrigger && gameConfig.freeSpinsTrigger[7], 30);
    const retrig3 = toInt(gameConfig.freeSpinsRetrigger && gameConfig.freeSpinsRetrigger[3], 10);
    const retrig4 = toInt(gameConfig.freeSpinsRetrigger && gameConfig.freeSpinsRetrigger[4], 12);
    const retrig5 = toInt(gameConfig.freeSpinsRetrigger && gameConfig.freeSpinsRetrigger[5], 15);
    const retrig6 = toInt(gameConfig.freeSpinsRetrigger && gameConfig.freeSpinsRetrigger[6], 20);
    const retrig7 = toInt(gameConfig.freeSpinsRetrigger && gameConfig.freeSpinsRetrigger[7], 30);
    let html = "";
    html += "<section><strong>Game Type:</strong> " + gameConfig.rows + "x" + gameConfig.cols + " cluster pays, orthogonal adjacency, minimum cluster size " + gameConfig.minCluster + ".</section>";
    html += "<section><strong>Cluster & Tumble:</strong> wins require 5+ orthogonally connected matching symbols. Winning symbols are removed, the board tumbles, and new symbols drop from above until no cluster remains. Scatters do not form cluster wins.</section>";
    html += "<section><strong>Multiplier Cells:</strong> every winning cell is marked. If a later winning symbol lands on that marked cell, it activates at x" + gameConfig.markerStartMultiplier + " and doubles on each later reuse up to x" + gameConfig.maxCellMultiplier + ". Cluster multiplier uses added active cells (x2+x4 = x6).</section>";
    html += "<section><strong>Payout Precision:</strong> wins are calculated in 0.01 WL steps so small clusters can pay partial amounts (for example 0.40 WL on a 1.00 WL bet).</section>";
    html += "<section><strong>Free Spins Trigger:</strong> 3/4/5/6/7 scatters award " + trigger3 + "/" + trigger4 + "/" + trigger5 + "/" + trigger6 + "/" + trigger7 + " free spins. Retriggers use +" + retrig3 + "/+" + retrig4 + "/+" + retrig5 + "/+" + retrig6 + "/+" + retrig7 + ". In free spins, multiplier cells persist for the whole feature.</section>";
    html += "<section><strong>Bonus Buy:</strong> normal bonus costs " + gameConfig.buyBonusCostMultiplier + "x bet, super bonus costs " + gameConfig.buySuperBonusCostMultiplier + "x bet and starts with all cells preloaded at x" + gameConfig.markerStartMultiplier + ".</section>";
    html += "<section><strong>Milestone Counter:</strong> base spins at x" + Number(gameConfig.winCounterHighlightMinRatio || 1.6).toFixed(1) + "+ and bonus spins at x" + Number(gameConfig.bonusWinCounterHighlightMinRatio || 6).toFixed(1) + "+ bet trigger center win counter with tier text (BIG/MEGA/MASSIVE/EPIC/MAX).</section>";
    const boostRows = Array.isArray(gameConfig.highBetPayoutBoostTiers) ? gameConfig.highBetPayoutBoostTiers : [];
    let boostText = "none";
    if (boostRows.length) {
      const parts = [];
      for (let i = 0; i < boostRows.length; i++) {
        const row = boostRows[i] || {};
        const minBet = Math.max(0, toInt(row.minBet, 0));
        const mul = Math.max(1, Number(row.multiplier) || 1);
        parts.push(minBet + "+ -> x" + mul.toFixed(2));
      }
      boostText = parts.join(", ");
    }
    html += "<section><strong>Math:</strong> RTP " + gameConfig.rtp + " (config placeholder), volatility " + gameConfig.volatility + ", max win cap " + gameConfig.maxWinMultiplier + "x bet, stacked cluster multiplier cap x" + gameConfig.maxClusterMultiplierApplied + ", base payout scale x" + Number(gameConfig.basePayoutScale || 1).toFixed(2) + ", high-bet payout boost tiers: " + boostText + ".</section>";

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
    const btnNodes = document.querySelectorAll(".btn");
    for (let i = 0; i < btnNodes.length; i++) {
      const btn = btnNodes[i];
      btn.addEventListener("pointerdown", () => {
        audio.unlock();
        audio.play("ui_click");
      }, { passive: true });
    }

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
        if (!state.busy) state.totalBetDisplay = wlToCents(state.bet);
        updateHUD();
        saveSettings();
      });
    }

    if (el.betUpBtn instanceof HTMLButtonElement) {
      el.betUpBtn.addEventListener("click", () => {
        const step = Math.max(1, Math.floor(state.bet * 0.1));
        state.bet = clamp(state.bet + step, gameConfig.minBet, gameConfig.maxBet);
        if (!state.busy) state.totalBetDisplay = wlToCents(state.bet);
        updateHUD();
        saveSettings();
      });
    }

    if (el.betMaxBtn instanceof HTMLButtonElement) {
      el.betMaxBtn.addEventListener("click", () => {
        state.bet = clamp(Math.min(gameConfig.maxBet, Math.floor(centsToWl(state.balance))), gameConfig.minBet, gameConfig.maxBet);
        if (!state.busy) state.totalBetDisplay = wlToCents(state.bet);
        updateHUD();
        saveSettings();
      });
    }

    if (el.betInput instanceof HTMLInputElement) {
      el.betInput.addEventListener("change", () => {
        state.bet = clamp(toInt(el.betInput.value, state.bet), gameConfig.minBet, gameConfig.maxBet);
        if (!state.busy) state.totalBetDisplay = wlToCents(state.bet);
        updateHUD();
        saveSettings();
      });
    }

    if (el.spinBtn instanceof HTMLButtonElement) el.spinBtn.addEventListener("click", () => runSpin("paid"));
    if (el.buyBonusBtn instanceof HTMLButtonElement) el.buyBonusBtn.addEventListener("click", () => runSpin("buy_bonus"));
    if (el.buySuperBonusBtn instanceof HTMLButtonElement) el.buySuperBonusBtn.addEventListener("click", () => runSpin("buy_super_bonus"));
    if (el.balanceValue instanceof HTMLElement) {
      el.balanceValue.classList.add("clickable-balance");
      el.balanceValue.addEventListener("click", () => {
        audio.unlock();
        audio.play("ui_click");
        cycleBalanceDisplayMode();
      });
    }

    if (el.spinArea instanceof HTMLElement) {
      el.spinArea.addEventListener("pointerdown", () => {
        audio.unlock();
        if (handleWinCounterClick()) return;
        if (!state.busy) return;
        requestFastForward();
      });
    }

    if (el.winCounterOverlay instanceof HTMLElement) {
      el.winCounterOverlay.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        audio.unlock();
        handleWinCounterClick();
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
          if (handleWinCounterClick()) return;
          requestFastForward();
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
    await loadSlotDefinitionFromCatalog();
    engine = new MergeUpEngine(gameConfig, symbolConfig);
    state.bet = clamp(toInt(state.bet, gameConfig.defaultBet), gameConfig.minBet, gameConfig.maxBet);
    state.totalBetDisplay = wlToCents(state.bet);

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
    state.bet = clamp(toInt(state.bet, gameConfig.defaultBet), gameConfig.minBet, gameConfig.maxBet);
    state.totalBetDisplay = wlToCents(state.bet);
    updateHUD();
    setControlsBusy(false);
    setMessage("Wallet linked. Spin to start.");
  }

  init();
})();
