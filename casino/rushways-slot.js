(function initRushWaysSlot() {
  "use strict";

  window.GTModules = window.GTModules || {};

  const BASE_PATH = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
  const SAVED_AUTH_KEY = "growtopia_saved_auth_v1";
  const SLOT_TRANSFER_KEY = "gt_casino_slot_transfer_v1";
  const SLOT_CONFIG_URL = "./rushways-config.json";
  const DEFAULT_GAME_KEY = "city_rush_ways";
  const CURRENCY_SCALE = 100;

  const dbModule = (window.GTModules && window.GTModules.db) || {};
  const authModule = (window.GTModules && window.GTModules.auth) || {};
  const authStorageModule = (window.GTModules && window.GTModules.authStorage) || {};
  const catalogModule = (window.GTModules && window.GTModules.itemCatalog) || {};

  const DEFAULT_CONFIG = {
    rows: 4,
    cols: 5,
    minMatchReels: 3,
    defaultBet: 20,
    minBet: 1,
    maxBet: 5000,
    buyBonusCostMultiplier: 100,
    maxRespinChain: 6,
    respinIncrement: 1,
    bonusStartRushMultiplier: 2,
    maxRushMultiplier: 10,
    connectionBiasChance: 0.045,
    basePayoutScale: 0.52,
    maxWinMultiplier: 50000,
    freeSpinsTrigger: { "3": 10, "4": 12, "5": 15 },
    freeSpinsRetrigger: { "3": 10, "4": 12, "5": 15 },
    winCounterHighlightMinRatio: 2.2,
    bonusWinCounterHighlightMinRatio: 7,
    autoplayOptions: [0, 10, 25, 50, 100],
    volatility: "High",
    rtp: "95.90%"
  };

  const DEFAULT_SYMBOLS = [
    { id: "taxi", name: "Taxi", glyph: "TX", weight: 24, pays: { "3": 0.03, "4": 0.05, "5": 0.08 } },
    { id: "bus", name: "Bus", glyph: "BS", weight: 22, pays: { "3": 0.035, "4": 0.055, "5": 0.09 } },
    { id: "train", name: "Train", glyph: "TR", weight: 20, pays: { "3": 0.04, "4": 0.065, "5": 0.1 } },
    { id: "park", name: "Park", glyph: "PK", weight: 18, pays: { "3": 0.045, "4": 0.075, "5": 0.12 } },
    { id: "rent", name: "Rent", glyph: "RT", weight: 14, pays: { "3": 0.06, "4": 0.1, "5": 0.16 } },
    { id: "cab", name: "Cab", glyph: "CB", weight: 11, pays: { "3": 0.09, "4": 0.15, "5": 0.24 } },
    { id: "hotel", name: "Hotel", glyph: "HT", weight: 8, pays: { "3": 0.14, "4": 0.24, "5": 0.38 } },
    { id: "wild", name: "Wild", glyph: "W", weight: 4, wild: true },
    { id: "scatter", name: "Scatter", glyph: "S", weight: 2, scatter: true }
  ];

  const ICON_MAP = {
    taxi: "TX",
    bus: "BS",
    train: "TR",
    park: "PK",
    rent: "RT",
    cab: "CB",
    hotel: "HT",
    wild: "W*",
    scatter: "SC"
  };

  const PHASE = {
    BOOT: "BOOT",
    IDLE: "IDLE",
    SPIN: "SPIN",
    RUSH: "RUSH",
    BONUS: "BONUS",
    CREDIT: "CREDIT"
  };

  const state = {
    db: null,
    user: null,
    refs: { inventory: null },
    handlers: { inventory: null },
    lockRows: resolveLockCurrencies(),
    walletById: {},
    walletCarryCents: 0,
    walletLinked: false,
    balanceSyncPaused: false,
    pendingWalletTotal: null,
    balanceCents: 0,
    balanceDisplayKey: "world_lock",

    gameKey: DEFAULT_GAME_KEY,
    gameName: "City Rush Ways",
    gameSubtitle: "5x4 ways slot with chained rush respins.",
    config: { ...DEFAULT_CONFIG },
    symbols: deepClone(DEFAULT_SYMBOLS),
    symbolById: {},
    regularSymbols: [],
    wildSymbolId: "wild",
    scatterSymbolId: "scatter",
    symbolPickerRows: [],
    symbolWeightTotal: 0,

    grid: [],
    lockedCells: [],
    gridCells: [],

    phase: PHASE.BOOT,
    message: "",
    busy: false,
    turbo: false,
    soundOn: true,
    autoplayRemaining: 0,
    autoplayTimer: 0,
    skipUntil: 0,

    inBonus: false,
    freeSpinsLeft: 0,
    freeSpinsPlayed: 0,

    betWl: DEFAULT_CONFIG.defaultBet,
    spinWinCents: 0,
    roundBetCents: 0,
    bonusWinCents: 0,
    rushMultiplier: 1,
    maxWinReached: false
  };

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
    totalBetValue: document.getElementById("totalBetValue"),
    spinWinValue: document.getElementById("spinWinValue"),
    rushValue: document.getElementById("rushValue"),
    bonusWinValue: document.getElementById("bonusWinValue"),
    spinArea: document.getElementById("spinArea"),
    grid: document.getElementById("grid"),
    banner: document.getElementById("banner"),
    message: document.getElementById("message"),
    floatingLayer: document.getElementById("floatingLayer"),
    betDownBtn: document.getElementById("betDownBtn"),
    betInput: document.getElementById("betInput"),
    betUpBtn: document.getElementById("betUpBtn"),
    betMaxBtn: document.getElementById("betMaxBtn"),
    spinBtn: document.getElementById("spinBtn"),
    buyBonusBtn: document.getElementById("buyBonusBtn"),
    infoModal: document.getElementById("infoModal"),
    closeInfoBtn: document.getElementById("closeInfoBtn"),
    infoContent: document.getElementById("infoContent")
  };

  class AudioManager {
    constructor() {
      this.enabled = true;
      this.ctx = null;
      this.master = null;
      this.unlocked = false;
      this.lastAt = {};
    }

    setEnabled(flag) {
      this.enabled = Boolean(flag);
    }

    async unlock() {
      if (this.unlocked) return true;
      this.ensure();
      if (!this.ctx) return false;
      try {
        if (this.ctx.state === "suspended") await this.ctx.resume();
        this.unlocked = true;
        return true;
      } catch (_error) {
        return false;
      }
    }

    ensure() {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.07;
        this.master.connect(this.ctx.destination);
      } catch (_error) {
        this.ctx = null;
        this.master = null;
      }
    }

    play(name) {
      if (!this.enabled) return;
      this.ensure();
      if (!this.ctx || !this.master) return;
      if (this.ctx.state === "suspended") return;

      const now = this.ctx.currentTime;
      const last = toInt(Math.floor((this.lastAt[name] || 0) * 1000), 0);
      const nowMs = toInt(Math.floor(now * 1000), 0);
      if ((nowMs - last) < 40) return;
      this.lastAt[name] = now;

      const tone = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      tone.connect(gain);
      gain.connect(this.master);

      let freq = 220;
      let type = "triangle";
      let duration = 0.12;
      let gainPeak = 0.35;

      if (name === "spin") {
        freq = 190;
        type = "sawtooth";
        duration = 0.16;
        gainPeak = 0.24;
      } else if (name === "stop") {
        freq = 320;
        type = "triangle";
        duration = 0.08;
        gainPeak = 0.22;
      } else if (name === "win") {
        freq = 420;
        type = "square";
        duration = 0.15;
        gainPeak = 0.3;
      } else if (name === "bigwin") {
        freq = 520;
        type = "square";
        duration = 0.22;
        gainPeak = 0.34;
      } else if (name === "bonus") {
        freq = 650;
        type = "sine";
        duration = 0.26;
        gainPeak = 0.3;
      } else if (name === "retrigger") {
        freq = 770;
        type = "sine";
        duration = 0.2;
        gainPeak = 0.28;
      }

      tone.type = type;
      tone.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + Math.min(0.03, duration * 0.35));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      tone.start(now);
      tone.stop(now + duration + 0.02);
    }
  }

  const audio = new AudioManager();

  function toInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback == null ? 0 : fallback;
    return Math.trunc(n);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  }

  function wlToCents(wl) {
    return Math.max(0, Math.round(Number(wl || 0) * CURRENCY_SCALE));
  }

  function centsToWl(cents) {
    return Math.max(0, Number(cents || 0) / CURRENCY_SCALE);
  }

  function formatWL(cents) {
    return centsToWl(cents).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " WL";
  }

  function getRequestedGameKey() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const raw = String(params.get("game") || params.get("slot") || "").trim().toLowerCase();
      return raw.replace(/[^a-z0-9_-]/g, "") || DEFAULT_GAME_KEY;
    } catch (_error) {
      return DEFAULT_GAME_KEY;
    }
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

  function getBalanceDisplayRows() {
    return state.lockRows && state.lockRows.length ? state.lockRows : resolveLockCurrencies();
  }

  function getActiveBalanceDisplayRow() {
    const rows = getBalanceDisplayRows();
    const key = String(state.balanceDisplayKey || "").trim().toLowerCase();
    const found = rows.find((r) => String(r.key || "").trim().toLowerCase() === key);
    if (found) return found;
    return rows[rows.length - 1] || { key: "world_lock", short: "WL", value: 1 };
  }

  function formatBalanceDisplay(cents) {
    const row = getActiveBalanceDisplayRow();
    const wlValue = centsToWl(cents);
    const unitValue = Math.max(1, Number(row.value) || 1);
    const amount = wlValue / unitValue;
    return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + " " + String(row.short || "WL");
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
    setMessage("Balance view: " + String(next.short || "WL"));
  }

  function walletCarryStorageKey() {
    const accountId = state.user && state.user.accountId ? String(state.user.accountId).trim() : "";
    if (!accountId) return "";
    return "rushways_slot_wallet_carry_v1_" + accountId;
  }

  function loadWalletCarryCents() {
    try {
      const key = walletCarryStorageKey();
      if (!key) return 0;
      const raw = localStorage.getItem(key);
      return clamp(toInt(raw, 0), 0, CURRENCY_SCALE - 1);
    } catch (_error) {
      return 0;
    }
  }

  function saveWalletCarryCents(cents) {
    try {
      const key = walletCarryStorageKey();
      if (!key) return;
      localStorage.setItem(key, String(clamp(toInt(cents, 0), 0, CURRENCY_SCALE - 1)));
    } catch (_error) {
      // noop
    }
  }

  async function connectDb() {
    if (state.db) return state.db;
    if (typeof dbModule.getOrInitAuthDb !== "function") throw new Error("DB module unavailable.");
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
      // fallback
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
      if (state.balanceSyncPaused) return;
      state.balanceCents = liveCents;
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

    const deltaCents = toInt(deltaCentsInput, 0);
    if (!deltaCents) {
      return {
        ok: true,
        amount: 0,
        previousTotal: state.balanceCents,
        nextTotal: state.balanceCents
      };
    }

    const previousTotalCents = Math.max(0, toInt(state.balanceCents, 0));
    const nextTotalCents = previousTotalCents + deltaCents;
    if (nextTotalCents < 0) return { ok: false, reason: "not-enough-locks" };

    const currentWhole = Math.floor(previousTotalCents / CURRENCY_SCALE);
    const nextWhole = Math.floor(nextTotalCents / CURRENCY_SCALE);
    const wholeDelta = nextWhole - currentWhole;
    const nextCarry = clamp(nextTotalCents - (nextWhole * CURRENCY_SCALE), 0, CURRENCY_SCALE - 1);

    let failReason = "";
    if (wholeDelta !== 0) {
      const tx = await state.refs.inventory.transaction((currentRaw) => {
        const currentObj = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
        const wallet = walletFromInventory(currentObj, state.lockRows);
        const nextWholeLive = wallet.total + wholeDelta;
        if (nextWholeLive < 0) {
          failReason = "not-enough-locks";
          return;
        }
        const nextById = decomposeLocks(nextWholeLive, state.lockRows);
        for (let i = 0; i < state.lockRows.length; i++) {
          const row = state.lockRows[i];
          currentObj[row.id] = Math.max(0, Math.floor(Number(nextById[row.id]) || 0));
        }
        return currentObj;
      });
      if (!tx || !tx.committed) return { ok: false, reason: failReason || "aborted" };
    }

    state.walletCarryCents = nextCarry;
    saveWalletCarryCents(nextCarry);
    state.balanceCents = nextTotalCents;
    state.pendingWalletTotal = null;

    return {
      ok: true,
      amount: deltaCents,
      previousTotal: previousTotalCents,
      nextTotal: nextTotalCents
    };
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
    const saved = authStorageModule.loadCredentials(SAVED_AUTH_KEY) || {};
    const username = normalizeUsername(saved.username || "");
    const password = String(saved.password || "");
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

  function normalizeConfig(rawConfig) {
    const cfg = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    const out = { ...DEFAULT_CONFIG };
    out.rows = clamp(toInt(cfg.rows, out.rows), 3, 8);
    out.cols = clamp(toInt(cfg.cols, out.cols), 3, 8);
    out.minMatchReels = clamp(toInt(cfg.minMatchReels, out.minMatchReels), 2, out.cols);
    out.defaultBet = clamp(toInt(cfg.defaultBet, out.defaultBet), 1, 100000000);
    out.minBet = clamp(toInt(cfg.minBet, out.minBet), 1, 100000000);
    out.maxBet = Math.max(out.minBet, toInt(cfg.maxBet, out.maxBet));
    out.buyBonusCostMultiplier = clamp(toInt(cfg.buyBonusCostMultiplier, out.buyBonusCostMultiplier), 20, 20000);
    out.maxRespinChain = clamp(toInt(cfg.maxRespinChain, out.maxRespinChain), 1, 40);
    out.respinIncrement = clamp(toInt(cfg.respinIncrement, out.respinIncrement), 1, 20);
    out.bonusStartRushMultiplier = clamp(toInt(cfg.bonusStartRushMultiplier, out.bonusStartRushMultiplier), 1, 100);
    out.maxRushMultiplier = Math.max(out.bonusStartRushMultiplier, toInt(cfg.maxRushMultiplier, out.maxRushMultiplier));
    out.connectionBiasChance = clamp(Number(cfg.connectionBiasChance), 0, 0.5);
    if (!Number.isFinite(out.connectionBiasChance)) out.connectionBiasChance = DEFAULT_CONFIG.connectionBiasChance;
    out.basePayoutScale = clamp(Number(cfg.basePayoutScale), 0.05, 5);
    if (!Number.isFinite(out.basePayoutScale)) out.basePayoutScale = DEFAULT_CONFIG.basePayoutScale;
    out.maxWinMultiplier = clamp(toInt(cfg.maxWinMultiplier, out.maxWinMultiplier), 100, 1000000000);
    out.freeSpinsTrigger = normalizeSpinAwardMap(cfg.freeSpinsTrigger, DEFAULT_CONFIG.freeSpinsTrigger);
    out.freeSpinsRetrigger = normalizeSpinAwardMap(cfg.freeSpinsRetrigger, out.freeSpinsTrigger);
    out.winCounterHighlightMinRatio = Math.max(0, Number(cfg.winCounterHighlightMinRatio) || DEFAULT_CONFIG.winCounterHighlightMinRatio);
    out.bonusWinCounterHighlightMinRatio = Math.max(0, Number(cfg.bonusWinCounterHighlightMinRatio) || DEFAULT_CONFIG.bonusWinCounterHighlightMinRatio);
    out.autoplayOptions = normalizeAutoplayOptions(cfg.autoplayOptions);
    out.volatility = String(cfg.volatility || out.volatility || "High");
    out.rtp = String(cfg.rtp || out.rtp || "95.90%");
    return out;
  }

  function normalizeAutoplayOptions(list) {
    if (!Array.isArray(list) || !list.length) return DEFAULT_CONFIG.autoplayOptions.slice();
    const used = {};
    const out = [0];
    for (let i = 0; i < list.length; i++) {
      const n = clamp(toInt(list[i], 0), 0, 10000);
      if (used[n]) continue;
      used[n] = true;
      out.push(n);
    }
    out.sort((a, b) => a - b);
    if (out[0] !== 0) out.unshift(0);
    return out;
  }

  function normalizeSpinAwardMap(input, fallback) {
    const src = input && typeof input === "object" ? input : fallback;
    const out = {};
    const keys = Object.keys(src || {});
    for (let i = 0; i < keys.length; i++) {
      const keyRaw = keys[i];
      const scatters = clamp(toInt(keyRaw, 0), 1, 30);
      const spins = clamp(toInt(src[keyRaw], 0), 0, 200);
      if (spins > 0) out[String(scatters)] = spins;
    }
    if (!Object.keys(out).length) return deepClone(fallback || { "3": 10, "4": 12, "5": 15 });
    return out;
  }

  function normalizePayoutTable(table) {
    const src = table && typeof table === "object" ? table : {};
    const out = {};
    const keys = Object.keys(src);
    for (let i = 0; i < keys.length; i++) {
      const k = String(keys[i] || "").trim();
      if (!k) continue;
      const v = Number(src[k]);
      if (!Number.isFinite(v) || v <= 0) continue;
      out[k] = v;
    }
    return out;
  }

  function normalizeSymbols(inputSymbols) {
    const rows = Array.isArray(inputSymbols) && inputSymbols.length ? inputSymbols : DEFAULT_SYMBOLS;
    const out = [];
    const used = {};
    let hasWild = false;
    let hasScatter = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] && typeof rows[i] === "object" ? rows[i] : null;
      if (!row) continue;
      const id = String(row.id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (!id || used[id]) continue;
      used[id] = true;
      const wild = Boolean(row.wild);
      const scatter = Boolean(row.scatter);
      const symbol = {
        id,
        name: String(row.name || id).trim() || id,
        glyph: String(row.glyph || row.uiLabel || row.iconGlyph || id.slice(0, 2).toUpperCase()).trim().slice(0, 6),
        weight: clamp(toInt(row.weight, 1), 0, 100000),
        wild,
        scatter,
        pays: normalizePayoutTable(row.pays)
      };
      if (!symbol.weight && !wild && !scatter) symbol.weight = 1;
      if (wild) hasWild = true;
      if (scatter) hasScatter = true;
      out.push(symbol);
    }
    if (!hasWild) out.push({ id: "wild", name: "Wild", glyph: "W", weight: 2, wild: true, scatter: false, pays: {} });
    if (!hasScatter) out.push({ id: "scatter", name: "Scatter", glyph: "S", weight: 1, wild: false, scatter: true, pays: {} });
    return out;
  }

  async function loadGameDefinition() {
    const requested = getRequestedGameKey();
    let selected = null;
    try {
      const response = await fetch(SLOT_CONFIG_URL, { cache: "no-store" });
      if (response.ok) {
        const raw = await response.json();
        const rows = raw && Array.isArray(raw.games) ? raw.games : [];
        const byKey = {};
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] && typeof rows[i] === "object" ? rows[i] : null;
          if (!row) continue;
          const key = String(row.key || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
          if (!key) continue;
          byKey[key] = row;
        }
        const fallbackKey = String(raw && raw.defaultGame || DEFAULT_GAME_KEY).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || DEFAULT_GAME_KEY;
        selected = byKey[requested] || byKey[fallbackKey] || null;
      }
    } catch (_error) {
      selected = null;
    }
    applyGameDefinition(selected || { key: DEFAULT_GAME_KEY, name: "City Rush Ways", subtitle: "5x4 ways slot with chained rush respins.", config: DEFAULT_CONFIG, symbols: DEFAULT_SYMBOLS });
  }

  function applyGameDefinition(def) {
    const row = def && typeof def === "object" ? def : {};
    state.gameKey = String(row.key || DEFAULT_GAME_KEY).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || DEFAULT_GAME_KEY;
    state.gameName = String(row.name || "City Rush Ways").trim() || "City Rush Ways";
    state.gameSubtitle = String(row.subtitle || "5x4 ways slot with chained rush respins.").trim();
    state.config = normalizeConfig(row.config || {});
    state.symbols = normalizeSymbols(row.symbols || []);
    state.symbolById = {};
    state.regularSymbols = [];
    state.wildSymbolId = "wild";
    state.scatterSymbolId = "scatter";
    for (let i = 0; i < state.symbols.length; i++) {
      const symbol = state.symbols[i];
      state.symbolById[symbol.id] = symbol;
      if (symbol.wild) state.wildSymbolId = symbol.id;
      else if (symbol.scatter) state.scatterSymbolId = symbol.id;
      else state.regularSymbols.push(symbol);
    }
    buildSymbolPickerRows();
    if (el.slotTitle) el.slotTitle.textContent = String(state.gameName || "").toUpperCase();
    if (el.slotSubtitle) el.slotSubtitle.textContent = state.gameSubtitle;
    if (el.buyBonusBtn) el.buyBonusBtn.textContent = "Buy Bonus (" + state.config.buyBonusCostMultiplier + "x)";
    if (el.grid) el.grid.style.setProperty("--slot-cols", String(state.config.cols));
    state.betWl = clamp(state.config.defaultBet, state.config.minBet, state.config.maxBet);
    state.grid = createGrid(state.config.rows, state.config.cols, state.scatterSymbolId);
    state.lockedCells = createBoolGrid(state.config.rows, state.config.cols, false);
    buildGridDom();
    renderGrid(state.grid, { revealAll: true });
    buildInfoContent();
  }

  function createGrid(rows, cols, fill) {
    const out = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push(fill || "");
      out.push(row);
    }
    return out;
  }

  function createBoolGrid(rows, cols, fillValue) {
    const out = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push(Boolean(fillValue));
      out.push(row);
    }
    return out;
  }

  function buildSymbolPickerRows() {
    const rows = [];
    let total = 0;
    for (let i = 0; i < state.symbols.length; i++) {
      const symbol = state.symbols[i];
      const weight = Math.max(0, toInt(symbol.weight, 0));
      if (!weight) continue;
      total += weight;
      rows.push({ id: symbol.id, upto: total, wild: Boolean(symbol.wild), scatter: Boolean(symbol.scatter) });
    }
    state.symbolPickerRows = rows;
    state.symbolWeightTotal = total;
  }

  function symbolIcon(symbolId) {
    if (ICON_MAP[symbolId]) return ICON_MAP[symbolId];
    const symbol = state.symbolById[symbolId];
    if (!symbol) return "?";
    return String(symbol.glyph || symbol.name || "?").slice(0, 2).toUpperCase();
  }

  function buildGridDom() {
    if (!(el.grid instanceof HTMLElement)) return;
    el.grid.innerHTML = "";
    state.gridCells = [];
    for (let r = 0; r < state.config.rows; r++) {
      const row = [];
      for (let c = 0; c < state.config.cols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.setAttribute("data-row", String(r));
        cell.setAttribute("data-col", String(c));

        const icon = document.createElement("div");
        icon.className = "icon";
        const name = document.createElement("div");
        name.className = "name";
        const meta = document.createElement("div");
        meta.className = "meta";

        cell.appendChild(icon);
        cell.appendChild(name);
        cell.appendChild(meta);
        el.grid.appendChild(cell);
        row.push({ root: cell, icon, name, meta });
      }
      state.gridCells.push(row);
    }
  }

  function coordKey(row, col) {
    return String(row) + ":" + String(col);
  }

  function parseCoordKey(key) {
    const parts = String(key || "").split(":");
    return { row: toInt(parts[0], 0), col: toInt(parts[1], 0) };
  }

  function renderGrid(grid, options) {
    const opts = options && typeof options === "object" ? options : {};
    const revealSet = opts.revealSet instanceof Set ? opts.revealSet : null;
    const winSet = opts.winSet instanceof Set ? opts.winSet : null;
    const dimOthers = Boolean(opts.dimOthers);
    const showLocks = opts.showLocks !== false;
    const revealAll = Boolean(opts.revealAll);
    for (let r = 0; r < state.config.rows; r++) {
      for (let c = 0; c < state.config.cols; c++) {
        const ref = state.gridCells[r] && state.gridCells[r][c];
        if (!ref) continue;
        const symbolId = grid[r][c];
        const symbol = state.symbolById[symbolId] || { id: symbolId, name: symbolId, glyph: "?" };
        const root = ref.root;

        root.className = "cell sym-" + String(symbol.id).toLowerCase();
        const key = coordKey(r, c);
        if (showLocks && state.lockedCells[r][c]) root.classList.add("locked");
        if (winSet && winSet.has(key)) root.classList.add("win");
        if (winSet && dimOthers && !winSet.has(key)) root.classList.add("dim");
        if (revealAll || (revealSet && revealSet.has(key))) {
          root.classList.add("reveal");
          root.style.setProperty("--reveal-delay", String((r * 14) + (c * 18)) + "ms");
        } else {
          root.classList.remove("reveal");
          root.style.removeProperty("--reveal-delay");
        }

        ref.icon.textContent = symbolIcon(symbol.id);
        ref.name.textContent = String(symbol.name || symbol.id).toUpperCase();
        if (symbol.scatter) ref.meta.textContent = "SCATTER";
        else if (symbol.wild) ref.meta.textContent = "WILD";
        else ref.meta.textContent = "WAYS";
      }
    }
  }

  function setPhase(phase) {
    state.phase = phase;
    if (el.phaseValue) el.phaseValue.textContent = phase;
  }

  function setMessage(text) {
    state.message = String(text || "");
    if (el.message) el.message.textContent = state.message;
  }

  function setBanner(text, options) {
    if (!(el.banner instanceof HTMLElement)) return;
    const opts = options && typeof options === "object" ? options : {};
    const value = String(text || "").trim();
    if (!value) {
      el.banner.classList.add("hidden");
      el.banner.classList.remove("big");
      el.banner.textContent = "";
      return;
    }
    el.banner.textContent = value;
    el.banner.classList.toggle("big", Boolean(opts.big));
    el.banner.classList.remove("hidden");
  }

  function clearFloatingTexts() {
    if (!(el.floatingLayer instanceof HTMLElement)) return;
    el.floatingLayer.innerHTML = "";
  }

  function addFloatingText(row, col, text, className) {
    if (!(el.floatingLayer instanceof HTMLElement)) return;
    const node = document.createElement("div");
    node.className = "float-text";
    if (className) node.classList.add(className);
    node.textContent = String(text || "");
    node.style.left = (((col + 0.5) / state.config.cols) * 100).toFixed(3) + "%";
    node.style.top = (((row + 0.45) / state.config.rows) * 100).toFixed(3) + "%";
    el.floatingLayer.appendChild(node);
    window.setTimeout(() => {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }, 960);
  }

  function setControlsBusy(flag) {
    state.busy = Boolean(flag);
    const disabled = state.busy || !state.walletLinked;
    if (el.spinBtn instanceof HTMLButtonElement) el.spinBtn.disabled = disabled;
    if (el.buyBonusBtn instanceof HTMLButtonElement) el.buyBonusBtn.disabled = disabled;
    if (el.betDownBtn instanceof HTMLButtonElement) el.betDownBtn.disabled = disabled;
    if (el.betUpBtn instanceof HTMLButtonElement) el.betUpBtn.disabled = disabled;
    if (el.betMaxBtn instanceof HTMLButtonElement) el.betMaxBtn.disabled = disabled;
    if (el.betInput instanceof HTMLInputElement) el.betInput.disabled = disabled;
  }

  function updateTopButtons() {
    if (el.soundBtn instanceof HTMLButtonElement) el.soundBtn.textContent = "Sound: " + (state.soundOn ? "On" : "Off");
    if (el.turboBtn instanceof HTMLButtonElement) el.turboBtn.textContent = "Turbo: " + (state.turbo ? "On" : "Off");
    if (el.autoplayBtn instanceof HTMLButtonElement) {
      if (state.autoplayRemaining > 0) el.autoplayBtn.textContent = "Autoplay: " + state.autoplayRemaining;
      else el.autoplayBtn.textContent = "Autoplay: Off";
    }
  }

  function updateHUD() {
    if (el.balanceValue) {
      el.balanceValue.textContent = formatBalanceDisplay(state.balanceCents);
      el.balanceValue.title = "Click to cycle lock units";
    }
    if (el.betValue) el.betValue.textContent = formatWL(wlToCents(state.betWl));
    if (el.totalBetValue) el.totalBetValue.textContent = formatWL(state.roundBetCents);
    if (el.spinWinValue) el.spinWinValue.textContent = formatWL(state.spinWinCents);
    if (el.bonusWinValue) el.bonusWinValue.textContent = formatWL(state.bonusWinCents);
    if (el.rushValue) el.rushValue.textContent = "x" + state.rushMultiplier.toFixed(0);
    if (el.fsValue) el.fsValue.textContent = String(state.freeSpinsLeft || 0);
    if (el.betInput instanceof HTMLInputElement && document.activeElement !== el.betInput) {
      el.betInput.value = String(state.betWl);
    }
    updateTopButtons();
  }

  function setBet(rawValue) {
    const next = clamp(toInt(rawValue, state.betWl), state.config.minBet, state.config.maxBet);
    state.betWl = next;
    updateHUD();
  }

  function pickWeightedSymbol() {
    if (!state.symbolWeightTotal || !state.symbolPickerRows.length) return state.scatterSymbolId;
    const roll = (Math.random() * state.symbolWeightTotal) + 1;
    for (let i = 0; i < state.symbolPickerRows.length; i++) {
      const row = state.symbolPickerRows[i];
      if (roll <= row.upto) return row.id;
    }
    return state.symbolPickerRows[state.symbolPickerRows.length - 1].id;
  }

  function pickSymbolWithBias(grid, row, col, allowScatter) {
    const biasChance = Number(state.config.connectionBiasChance) || 0;
    const candidates = [];
    if (col > 0) {
      const left = grid[row][col - 1];
      const leftSymbol = state.symbolById[left];
      if (leftSymbol && !leftSymbol.scatter && !leftSymbol.wild) candidates.push(left);
    }
    if (row > 0) {
      const up = grid[row - 1][col];
      const upSymbol = state.symbolById[up];
      if (upSymbol && !upSymbol.scatter && !upSymbol.wild) candidates.push(up);
    }
    if (candidates.length && Math.random() < biasChance) {
      return candidates[toInt(Math.floor(Math.random() * candidates.length), 0)];
    }

    for (let guard = 0; guard < 10; guard++) {
      const id = pickWeightedSymbol();
      const symbol = state.symbolById[id];
      if (!symbol) continue;
      if (!allowScatter && symbol.scatter) continue;
      return id;
    }
    return state.regularSymbols.length ? state.regularSymbols[0].id : state.scatterSymbolId;
  }

  function fillAllGrid(allowScatter) {
    const revealSet = new Set();
    for (let r = 0; r < state.config.rows; r++) {
      for (let c = 0; c < state.config.cols; c++) {
        state.grid[r][c] = pickSymbolWithBias(state.grid, r, c, allowScatter !== false);
        revealSet.add(coordKey(r, c));
      }
    }
    return revealSet;
  }

  function respinUnlockedCells(allowScatter) {
    const revealSet = new Set();
    for (let r = 0; r < state.config.rows; r++) {
      for (let c = 0; c < state.config.cols; c++) {
        if (state.lockedCells[r][c]) continue;
        state.grid[r][c] = pickSymbolWithBias(state.grid, r, c, allowScatter !== false);
        revealSet.add(coordKey(r, c));
      }
    }
    return revealSet;
  }

  function resetLocks() {
    state.lockedCells = createBoolGrid(state.config.rows, state.config.cols, false);
  }

  function countScatterOnGrid(grid) {
    let count = 0;
    for (let r = 0; r < state.config.rows; r++) {
      for (let c = 0; c < state.config.cols; c++) {
        if (grid[r][c] === state.scatterSymbolId) count += 1;
      }
    }
    return count;
  }

  function getPayValue(symbol, length) {
    if (!symbol || !symbol.pays) return 0;
    const keys = Object.keys(symbol.pays).map((k) => toInt(k, 0)).filter((n) => n > 0).sort((a, b) => a - b);
    if (!keys.length) return 0;
    let chosen = keys[0];
    for (let i = 0; i < keys.length; i++) {
      if (length >= keys[i]) chosen = keys[i];
    }
    return Number(symbol.pays[String(chosen)]) || 0;
  }

  function evaluateWaysWins(grid, rushMultiplier) {
    const wins = [];
    const winSet = new Set();
    let total = 0;

    for (let i = 0; i < state.regularSymbols.length; i++) {
      const symbol = state.regularSymbols[i];
      const reels = [];
      let naturalFirstReelCount = 0;

      for (let c = 0; c < state.config.cols; c++) {
        const cells = [];
        for (let r = 0; r < state.config.rows; r++) {
          const id = grid[r][c];
          if (id === symbol.id || id === state.wildSymbolId) {
            cells.push({ row: r, col: c, id });
            if (c === 0 && id === symbol.id) naturalFirstReelCount += 1;
          }
        }
        if (!cells.length) break;
        reels.push(cells);
      }

      if (!naturalFirstReelCount) continue;
      if (reels.length < state.config.minMatchReels) continue;

      const length = reels.length;
      let ways = 1;
      const cellList = [];
      for (let c = 0; c < length; c++) {
        ways *= reels[c].length;
        for (let k = 0; k < reels[c].length; k++) {
          const cell = reels[c][k];
          cellList.push(cell);
          winSet.add(coordKey(cell.row, cell.col));
        }
      }

      const pay = getPayValue(symbol, length);
      if (pay <= 0 || ways <= 0) continue;
      const raw = wlToCents(state.betWl) * pay * ways * state.config.basePayoutScale * Math.max(1, rushMultiplier);
      const payout = Math.max(0, Math.floor(raw));
      if (!payout) continue;

      wins.push({
        symbolId: symbol.id,
        symbolName: symbol.name,
        length,
        ways,
        payout,
        cells: cellList
      });
      total += payout;
    }

    return {
      wins,
      total,
      scatterCount: countScatterOnGrid(grid),
      winSet
    };
  }

  function applyWinningLocks(winSet) {
    const keys = Array.from(winSet || []);
    for (let i = 0; i < keys.length; i++) {
      const coord = parseCoordKey(keys[i]);
      if (coord.row < 0 || coord.row >= state.config.rows || coord.col < 0 || coord.col >= state.config.cols) continue;
      state.lockedCells[coord.row][coord.col] = true;
      state.grid[coord.row][coord.col] = state.wildSymbolId;
    }
  }

  function pause(ms) {
    const duration = Math.max(0, Number(ms) || 0);
    const turboScale = state.turbo ? 0.42 : 1;
    const target = Date.now() + Math.floor(duration * turboScale);
    return new Promise((resolve) => {
      const tick = () => {
        if (Date.now() >= target || Date.now() <= state.skipUntil) {
          resolve();
          return;
        }
        window.setTimeout(tick, 12);
      };
      tick();
    });
  }

  async function animateCounter(fromValue, toValue, durationMs, onUpdate) {
    const start = Math.max(0, toInt(fromValue, 0));
    const end = Math.max(0, toInt(toValue, 0));
    const delta = end - start;
    if (!delta || durationMs <= 0 || Date.now() <= state.skipUntil) {
      onUpdate(end);
      return;
    }
    const duration = Math.max(40, Math.floor(durationMs * (state.turbo ? 0.42 : 1)));
    const timeStart = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        if (Date.now() <= state.skipUntil) {
          onUpdate(end);
          resolve();
          return;
        }
        const t = clamp((now - timeStart) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = start + Math.round(delta * eased);
        onUpdate(value);
        if (t >= 1) {
          onUpdate(end);
          resolve();
          return;
        }
        window.requestAnimationFrame(frame);
      };
      window.requestAnimationFrame(frame);
    });
  }

  function getStepCountDuration(stepWinCents) {
    const betCents = wlToCents(state.betWl);
    if (stepWinCents <= (betCents * 1.5)) return 420;
    if (stepWinCents <= (betCents * 6)) return 760;
    return 1140;
  }

  function getRoundWinTierLabel(totalWinCents) {
    const betCents = Math.max(1, wlToCents(state.betWl));
    const ratio = totalWinCents / betCents;
    if (ratio >= 40) return "JACKPOT WIN";
    if (ratio >= 20) return "HUGE WIN";
    if (ratio >= 10) return "MEGA WIN";
    if (ratio >= 4) return "BIG WIN";
    if (ratio >= state.config.winCounterHighlightMinRatio) return "NICE WIN";
    return "";
  }

  async function applyStepWin(stepWinCents, isBonus, sourceEval) {
    const maxTotalWin = wlToCents(state.betWl) * state.config.maxWinMultiplier;
    const remain = Math.max(0, maxTotalWin - state.spinWinCents);
    const applied = Math.min(Math.max(0, toInt(stepWinCents, 0)), remain);
    if (!applied) {
      state.maxWinReached = true;
      updateHUD();
      return 0;
    }

    const fromSpin = state.spinWinCents;
    const fromBonus = state.bonusWinCents;
    const duration = getStepCountDuration(applied);
    if (applied >= wlToCents(state.betWl) * 4) audio.play("bigwin");
    else audio.play("win");

    await animateCounter(0, applied, duration, (delta) => {
      state.spinWinCents = fromSpin + delta;
      if (isBonus) state.bonusWinCents = fromBonus + delta;
      updateHUD();
    });

    if (sourceEval && sourceEval.wins && sourceEval.wins.length) {
      const first = sourceEval.wins[0];
      if (first && first.cells && first.cells.length) {
        const cell = first.cells[0];
        addFloatingText(cell.row, cell.col, "+" + formatWL(applied), "win-float");
      }
    }

    const label = getRoundWinTierLabel(state.spinWinCents);
    if (label) {
      setBanner(label + " - " + formatWL(state.spinWinCents), { big: true });
      await pause(540);
      setBanner("");
    }

    if (state.spinWinCents >= maxTotalWin) {
      state.maxWinReached = true;
      setBanner("MAX WIN REACHED", { big: true });
      await pause(560);
      setBanner("");
    }
    return applied;
  }

  function getAwardedSpins(scatterCount, inBonus) {
    const table = inBonus ? state.config.freeSpinsRetrigger : state.config.freeSpinsTrigger;
    const keys = Object.keys(table).map((k) => toInt(k, 0)).sort((a, b) => a - b);
    let best = 0;
    for (let i = 0; i < keys.length; i++) {
      if (scatterCount >= keys[i]) best = keys[i];
    }
    if (!best) return 0;
    return Math.max(0, toInt(table[String(best)], 0));
  }

  async function presentSpinGridReveal(revealSet) {
    renderGrid(state.grid, { revealSet, showLocks: true });
    audio.play("spin");
    await pause(620);
  }

  async function presentWinHighlights(evalResult) {
    const winSet = evalResult && evalResult.winSet instanceof Set ? evalResult.winSet : new Set();
    renderGrid(state.grid, { winSet, dimOthers: true, showLocks: true });
    await pause(420);
    renderGrid(state.grid, { showLocks: true });
    await pause(110);
  }

  async function runSingleRushChain(isBonus) {
    resetLocks();
    state.rushMultiplier = isBonus ? state.config.bonusStartRushMultiplier : 1;
    updateHUD();

    let chain = 0;
    let highestScatter = 0;
    let spinTotal = 0;

    const initialReveal = fillAllGrid(true);
    setMessage(isBonus ? "Free spin " + (state.freeSpinsPlayed + 1) + " started." : "Spin started.");
    await presentSpinGridReveal(initialReveal);

    while (chain < state.config.maxRespinChain) {
      chain += 1;
      const evalResult = evaluateWaysWins(state.grid, state.rushMultiplier);
      highestScatter = Math.max(highestScatter, evalResult.scatterCount);

      if (!evalResult.total || !evalResult.wins.length) {
        if (chain === 1) setMessage("No winning ways. Spin ended.");
        else setMessage("Rush chain ended after " + (chain - 1) + " respin" + ((chain - 1) === 1 ? "" : "s") + ".");
        break;
      }

      await presentWinHighlights(evalResult);
      const applied = await applyStepWin(evalResult.total, isBonus, evalResult);
      spinTotal += applied;

      const symbolNames = evalResult.wins.map((w) => w.symbolName + " x" + w.ways).join(" | ");
      setMessage("Rush hit x" + state.rushMultiplier + ": " + symbolNames);
      applyWinningLocks(evalResult.winSet);
      renderGrid(state.grid, { showLocks: true });
      await pause(260);

      if (state.maxWinReached) break;
      if (chain >= state.config.maxRespinChain) {
        setMessage("Rush chain cap reached.");
        break;
      }

      state.rushMultiplier = clamp(state.rushMultiplier + state.config.respinIncrement, 1, state.config.maxRushMultiplier);
      updateHUD();
      const revealSet = respinUnlockedCells(true);
      if (!revealSet.size) {
        setMessage("Board fully locked. Rush chain stopped.");
        break;
      }
      setMessage("Rush respin " + chain + " - multiplier now x" + state.rushMultiplier + ".");
      await presentSpinGridReveal(revealSet);
    }

    const awardedSpins = getAwardedSpins(highestScatter, isBonus);
    return {
      spinTotal,
      chainCount: Math.max(0, chain - 1),
      scatterCount: highestScatter,
      awardedSpins
    };
  }

  async function presentBonusIntro(spins, sourceText) {
    setPhase(PHASE.BONUS);
    audio.play("bonus");
    setBanner("FREE SPINS +" + spins, { big: true });
    setMessage(sourceText || ("Bonus triggered with " + spins + " free spins."));
    await pause(900);
    setBanner("");
  }

  async function runBonusFeature(startSpins, sourceText) {
    const start = Math.max(0, toInt(startSpins, 0));
    if (!start) return 0;
    await presentBonusIntro(start, sourceText);

    state.inBonus = true;
    state.freeSpinsLeft = start;
    state.freeSpinsPlayed = 0;
    updateHUD();

    while (state.freeSpinsLeft > 0) {
      state.freeSpinsLeft -= 1;
      state.freeSpinsPlayed += 1;
      updateHUD();
      setPhase(PHASE.BONUS);

      const result = await runSingleRushChain(true);
      if (result.awardedSpins > 0) {
        state.freeSpinsLeft += result.awardedSpins;
        audio.play("retrigger");
        setBanner("RETRIGGER +" + result.awardedSpins, { big: true });
        setMessage("Bonus retrigger from " + result.scatterCount + " scatters.");
        updateHUD();
        await pause(820);
        setBanner("");
      }
      if (state.maxWinReached) break;
    }

    state.inBonus = false;
    state.freeSpinsLeft = 0;
    updateHUD();
    setBanner("BONUS WIN " + formatWL(state.bonusWinCents), { big: true });
    await pause(900);
    setBanner("");
    return state.bonusWinCents;
  }

  function randomScatterRollForBonusBuy() {
    const roll = Math.random();
    if (roll < 0.6) return 3;
    if (roll < 0.84) return 4;
    if (roll < 0.95) return 5;
    return 4;
  }

  async function runSpin(buyBonus, fromAutoplay) {
    if (state.busy) return;
    if (!state.walletLinked) {
      setMessage("Wallet link unavailable. Reopen from Casino dashboard.");
      return;
    }
    if (fromAutoplay) {
      if (state.autoplayRemaining <= 0) return;
      state.autoplayRemaining -= 1;
      updateTopButtons();
    }

    const betCents = wlToCents(state.betWl);
    if (!betCents) {
      setMessage("Invalid bet.");
      return;
    }

    const roundCost = buyBonus ? (betCents * state.config.buyBonusCostMultiplier) : betCents;
    if (state.balanceCents < roundCost) {
      setMessage("Not enough balance.");
      if (fromAutoplay) state.autoplayRemaining = 0;
      updateTopButtons();
      return;
    }

    clearFloatingTexts();
    state.skipUntil = 0;
    state.maxWinReached = false;
    state.spinWinCents = 0;
    state.bonusWinCents = 0;
    state.roundBetCents = roundCost;
    state.rushMultiplier = 1;
    state.freeSpinsLeft = 0;
    state.freeSpinsPlayed = 0;
    updateHUD();

    setControlsBusy(true);
    setPhase(PHASE.SPIN);
    setBanner("");
    setMessage("Placing bet " + formatWL(roundCost) + "...");

    state.balanceSyncPaused = true;
    const debit = await applyWalletDelta(-roundCost);
    state.balanceSyncPaused = false;
    if (!debit || !debit.ok) {
      setControlsBusy(false);
      setPhase(PHASE.IDLE);
      const reason = debit && debit.reason ? String(debit.reason) : "wallet-tx-failed";
      if (reason === "not-enough-locks") setMessage("Not enough balance.");
      else setMessage("Failed to place bet.");
      if (fromAutoplay) state.autoplayRemaining = 0;
      updateTopButtons();
      return;
    }

    state.balanceCents = toInt(debit.nextTotal, state.balanceCents);
    updateHUD();

    try {
      if (buyBonus) {
        const scatterRoll = randomScatterRollForBonusBuy();
        const spins = getAwardedSpins(scatterRoll, false) || 10;
        setMessage("Bonus buy activated - simulated " + scatterRoll + " scatters.");
        await pause(420);
        await runBonusFeature(spins, "Bonus buy awarded " + spins + " free spins.");
      } else {
        const base = await runSingleRushChain(false);
        if (base.awardedSpins > 0 && !state.maxWinReached) {
          await runBonusFeature(base.awardedSpins, "Triggered by " + base.scatterCount + " scatters.");
        }
      }

      setPhase(PHASE.CREDIT);
      if (state.spinWinCents > 0) {
        setMessage("Crediting " + formatWL(state.spinWinCents) + "...");
        state.balanceSyncPaused = true;
        const credit = await applyWalletDelta(state.spinWinCents);
        state.balanceSyncPaused = false;
        if (credit && credit.ok) {
          const before = toInt(credit.previousTotal, state.balanceCents);
          const after = toInt(credit.nextTotal, before + state.spinWinCents);
          await animateCounter(before, after, 700, (v) => {
            state.balanceCents = v;
            updateHUD();
          });
          setMessage("Round finished - won " + formatWL(state.spinWinCents) + ".");
        } else {
          setMessage("Wallet credit failed. Try again.");
        }
      } else {
        setMessage("Round finished with no win.");
      }
    } catch (error) {
      setMessage("Spin failed: " + ((error && error.message) ? error.message : "unknown"));
    } finally {
      setBanner("");
      setPhase(PHASE.IDLE);
      setControlsBusy(false);
      updateHUD();
      if (state.autoplayRemaining > 0 && !state.busy) {
        queueAutoplay();
      }
    }
  }

  function queueAutoplay() {
    if (state.autoplayRemaining <= 0 || state.busy) return;
    if (state.autoplayTimer) {
      window.clearTimeout(state.autoplayTimer);
      state.autoplayTimer = 0;
    }
    const waitMs = state.turbo ? 180 : 460;
    state.autoplayTimer = window.setTimeout(() => {
      state.autoplayTimer = 0;
      runSpin(false, true);
    }, waitMs);
  }

  function cycleAutoplayMode() {
    const options = Array.isArray(state.config.autoplayOptions) && state.config.autoplayOptions.length
      ? state.config.autoplayOptions
      : DEFAULT_CONFIG.autoplayOptions;

    const current = toInt(state.autoplayRemaining, 0);
    let idx = options.indexOf(current);
    if (idx < 0) idx = 0;
    const next = options[(idx + 1) % options.length];
    state.autoplayRemaining = Math.max(0, toInt(next, 0));
    updateTopButtons();
    if (!state.autoplayRemaining) {
      setMessage("Autoplay disabled.");
      return;
    }
    setMessage("Autoplay set to " + state.autoplayRemaining + " spins.");
    if (!state.busy) queueAutoplay();
  }

  function buildInfoContent() {
    if (!(el.infoContent instanceof HTMLElement)) return;
    let html = "";
    html += "<div><strong>Mechanic:</strong> 5x4 Ways. Wins start from reel 1 and chain through consecutive reels.</div>";
    html += "<div><strong>Rush Feature:</strong> Winning cells lock as Wilds, then non-locked cells respin. Rush multiplier grows by +" + state.config.respinIncrement + " each win, up to x" + state.config.maxRushMultiplier + ".</div>";
    html += "<div><strong>Free Spins:</strong> 3+ scatters award spins. Retriggers use the same scatter mapping.</div>";
    html += "<div><strong>Buy Bonus:</strong> " + state.config.buyBonusCostMultiplier + "x bet.</div>";
    html += "<div><strong>RTP:</strong> " + state.config.rtp + " | <strong>Volatility:</strong> " + state.config.volatility + "</div>";
    html += "<table><thead><tr><th>Symbol</th><th>3 Reels</th><th>4 Reels</th><th>5 Reels</th></tr></thead><tbody>";
    for (let i = 0; i < state.regularSymbols.length; i++) {
      const symbol = state.regularSymbols[i];
      html += "<tr>" +
        "<td>" + escapeHtml(symbol.name) + "</td>" +
        "<td>x" + formatPay(symbol.pays["3"]) + "</td>" +
        "<td>x" + formatPay(symbol.pays["4"]) + "</td>" +
        "<td>x" + formatPay(symbol.pays["5"]) + "</td>" +
      "</tr>";
    }
    html += "</tbody></table>";
    html += "<div><small>Pays are multiplied by ways count, bet, base payout scale, and current rush multiplier.</small></div>";
    el.infoContent.innerHTML = html;
  }

  function formatPay(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "0.00";
    return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setInfoOpen(open) {
    const show = Boolean(open);
    if (!(el.infoModal instanceof HTMLElement)) return;
    el.infoModal.classList.toggle("hidden", !show);
  }

  function requestFastForward() {
    state.skipUntil = Date.now() + 1200;
  }

  function bindEvents() {
    if (el.balanceValue instanceof HTMLElement) {
      el.balanceValue.classList.add("clickable-balance");
      el.balanceValue.addEventListener("click", cycleBalanceDisplayMode);
    }

    if (el.spinArea instanceof HTMLElement) {
      el.spinArea.addEventListener("pointerdown", () => {
        if (!state.busy) return;
        requestFastForward();
      });
    }

    if (el.soundBtn instanceof HTMLButtonElement) {
      el.soundBtn.addEventListener("click", async () => {
        state.soundOn = !state.soundOn;
        audio.setEnabled(state.soundOn);
        if (state.soundOn) await audio.unlock();
        updateTopButtons();
      });
    }

    if (el.turboBtn instanceof HTMLButtonElement) {
      el.turboBtn.addEventListener("click", () => {
        state.turbo = !state.turbo;
        updateTopButtons();
      });
    }

    if (el.autoplayBtn instanceof HTMLButtonElement) {
      el.autoplayBtn.addEventListener("click", () => {
        cycleAutoplayMode();
      });
    }

    if (el.infoBtn instanceof HTMLButtonElement) {
      el.infoBtn.addEventListener("click", () => {
        setInfoOpen(true);
      });
    }
    if (el.closeInfoBtn instanceof HTMLButtonElement) {
      el.closeInfoBtn.addEventListener("click", () => {
        setInfoOpen(false);
      });
    }
    if (el.infoModal instanceof HTMLElement) {
      el.infoModal.addEventListener("click", (event) => {
        if (event.target === el.infoModal) setInfoOpen(false);
      });
    }

    if (el.backBtn instanceof HTMLButtonElement) {
      el.backBtn.addEventListener("click", () => {
        window.location.href = "./index.html";
      });
    }

    if (el.betInput instanceof HTMLInputElement) {
      el.betInput.addEventListener("change", () => {
        setBet(el.betInput.value);
      });
      el.betInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") setBet(el.betInput.value);
      });
    }

    if (el.betDownBtn instanceof HTMLButtonElement) {
      el.betDownBtn.addEventListener("click", () => {
        const step = Math.max(1, Math.floor(state.betWl * 0.1));
        setBet(state.betWl - step);
      });
    }
    if (el.betUpBtn instanceof HTMLButtonElement) {
      el.betUpBtn.addEventListener("click", () => {
        const step = Math.max(1, Math.floor(state.betWl * 0.1));
        setBet(state.betWl + step);
      });
    }
    if (el.betMaxBtn instanceof HTMLButtonElement) {
      el.betMaxBtn.addEventListener("click", () => {
        const maxByBalance = Math.max(state.config.minBet, Math.floor(centsToWl(state.balanceCents)));
        setBet(Math.min(state.config.maxBet, maxByBalance));
      });
    }

    if (el.spinBtn instanceof HTMLButtonElement) {
      el.spinBtn.addEventListener("click", () => {
        runSpin(false, false);
      });
    }

    if (el.buyBonusBtn instanceof HTMLButtonElement) {
      el.buyBonusBtn.addEventListener("click", () => {
        runSpin(true, false);
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        if (state.busy) {
          requestFastForward();
        } else {
          runSpin(false, false);
        }
      } else if (event.code === "KeyS") {
        state.turbo = !state.turbo;
        updateTopButtons();
      } else if (event.code === "KeyA") {
        cycleAutoplayMode();
      } else if (event.code === "Escape") {
        setInfoOpen(false);
      }
    });

    window.addEventListener("pointerdown", () => {
      audio.unlock();
    }, { once: true });
  }

  async function initWallet() {
    setMessage("Linking wallet session...");
    const ok = await ensureWalletSession();
    if (!ok) {
      setControlsBusy(true);
      setMessage("No live wallet session. Open from Casino dashboard.");
      return false;
    }
    state.walletLinked = true;
    state.betWl = clamp(state.betWl, state.config.minBet, state.config.maxBet);
    updateHUD();
    setControlsBusy(false);
    return true;
  }

  async function init() {
    bindEvents();
    await loadGameDefinition();
    updateTopButtons();
    updateHUD();
    setPhase(PHASE.BOOT);
    const walletReady = await initWallet();
    if (walletReady) {
      setPhase(PHASE.IDLE);
      setMessage("Rush Ways ready.");
    }
  }

  init().catch((error) => {
    setPhase(PHASE.BOOT);
    setMessage("Init failed: " + ((error && error.message) ? error.message : "unknown"));
    setControlsBusy(true);
  });
})();

