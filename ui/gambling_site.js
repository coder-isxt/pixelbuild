window.GTModules = window.GTModules || {};

(function initGamblingSite() {
  "use strict";

  const SAVED_AUTH_KEY = "growtopia_saved_auth_v1";
  const LAST_WORLD_KEY = "gt_gambling_site_world_v1";

  const authModule = (window.GTModules && window.GTModules.auth) || {};
  const authStorageModule = (window.GTModules && window.GTModules.authStorage) || {};
  const dbModule = (window.GTModules && window.GTModules.db) || {};
  const slotsModule = (window.GTModules && window.GTModules.slots) || {};
  const SLOT_MACHINE_IDS = ["slots", "slots_v2", "slots_v3", "slots_v4", "slots_v6", "le_bandit"];
  const SLOT_SYMBOLS = {
    slots: ["CHERRY", "LEMON", "BAR", "BELL", "SEVEN"],
    slots_v2: ["GEM", "PICK", "MINER", "GOLD", "DYN", "WILD", "SCAT", "BONUS"],
    slots_v3: ["RUBY", "EMER", "CLUB", "RING", "SKULL", "REAPR", "BLOOD", "WILD", "SCAT"],
    slots_v4: ["LEAF", "STON", "MASK", "IDOL", "ORAC", "FRGT", "WILD", "SCAT"],
    slots_v6: ["COIN", "ORE", "GEM", "PICK", "CART", "RELC", "WILD", "SCAT"],
    le_bandit: ["TRAP", "CHEESE", "BEER", "BAG", "HAT", "WINT", "WILD", "RAIN", "COIN"]
  };

  const MACHINE_DEFS = buildMachineDefinitions();
  const LOCK_CURRENCIES = resolveLockCurrencies();

  const state = {
    db: null,
    network: {},
    user: null,
    worldId: "",
    worldLock: null,
    ownerTax: null,
    machines: [],
    refs: {
      lock: null,
      machines: null,
      ownerTax: null,
      inventoryLocks: null
    },
    handlers: {
      lock: null,
      machines: null,
      ownerTax: null,
      inventoryLocks: null
    },
    machineSearch: "",
    walletLocks: 0,
    webVaultLocks: 0,
    walletBreakdownText: "0 WL",
    selectedSpectateTileKey: "",
    selectedPlayTileKey: "",
    playBusy: false,
    playBoardHtml: "",
    playResultText: ""
  };
  let playRollIntervalId = 0;

  const els = {
    openVaultBtn: document.getElementById("openVaultBtn"),
    vaultModal: document.getElementById("vaultModal"),
    vaultAmount: document.getElementById("vaultAmount"),
    vaultDepositBtn: document.getElementById("vaultDepositBtn"),
    vaultWithdrawBtn: document.getElementById("vaultWithdrawBtn"),
    closeVaultBtn: document.getElementById("closeVaultBtn"),
    vaultStatus: document.getElementById("vaultStatus"),
    openSlotsSiteBtn: document.getElementById("openSlotsSiteBtn"),
    openGameBtn: document.getElementById("openGameBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    authCard: document.getElementById("authCard"),
    authUsername: document.getElementById("authUsername"),
    authPassword: document.getElementById("authPassword"),
    authLoginBtn: document.getElementById("authLoginBtn"),
    authCreateBtn: document.getElementById("authCreateBtn"),
    authStatus: document.getElementById("authStatus"),
    sessionLabel: document.getElementById("sessionLabel"),
    scopeLabel: document.getElementById("scopeLabel"),
    lockAccessLabel: document.getElementById("lockAccessLabel"),
    dashboardCard: document.getElementById("dashboardCard"),
    worldInput: document.getElementById("worldInput"),
    loadWorldBtn: document.getElementById("loadWorldBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    machineSearch: document.getElementById("machineSearch"),
    sumMachines: document.getElementById("sumMachines"),
    sumBank: document.getElementById("sumBank"),
    sumMine: document.getElementById("sumMine"),
    sumWallet: document.getElementById("sumWallet"),
    sumTax: document.getElementById("sumTax"),
    taxControls: document.getElementById("taxControls"),
    taxPercentInput: document.getElementById("taxPercentInput"),
    saveTaxBtn: document.getElementById("saveTaxBtn"),
    machineTbody: document.getElementById("machineTbody"),
    machineEmpty: document.getElementById("machineEmpty"),
    spectateBody: document.getElementById("spectateBody"),
    playConsole: document.getElementById("playConsole"),
    playMachineSelect: document.getElementById("playMachineSelect"),
    playBetInput: document.getElementById("playBetInput"),
    playMaxBtn: document.getElementById("playMaxBtn"),
    playSpinBtn: document.getElementById("playSpinBtn"),
    playMeta: document.getElementById("playMeta"),
    playBoard: document.getElementById("playBoard"),
    playStatus: document.getElementById("playStatus")
  };

  function buildMachineDefinitions() {
    const slotsDefs = typeof slotsModule.getDefinitions === "function"
      ? slotsModule.getDefinitions()
      : {};
    const defaultSlotConfig = {
      slots: { maxPayoutMultiplier: 10, reels: 3, rows: 1 },
      slots_v2: { maxPayoutMultiplier: 50, reels: 5, rows: 4 },
      slots_v3: { maxPayoutMultiplier: 5000, reels: 5, rows: 4 },
      slots_v4: { maxPayoutMultiplier: 5000, reels: 5, rows: 4 },
      slots_v6: { maxPayoutMultiplier: 5000, reels: 5, rows: 3 },
      le_bandit: { maxPayoutMultiplier: 10000, reels: 6, rows: 5 }
    };
    const out = {
      reme_roulette: {
        id: "reme_roulette",
        name: "Reme Roulette",
        minBet: 1,
        maxBet: 30000,
        maxPayoutMultiplier: 2,
        reels: 0,
        rows: 0
      },
      blackjack: {
        id: "blackjack",
        name: "Blackjack",
        minBet: 1,
        maxBet: 30000,
        maxPayoutMultiplier: 3,
        reels: 0,
        rows: 0
      }
    };
    SLOT_MACHINE_IDS.forEach((id) => {
      const row = slotsDefs && slotsDefs[id] ? slotsDefs[id] : {};
      const fallback = defaultSlotConfig[id] || defaultSlotConfig.slots;
      const layout = row && row.layout && typeof row.layout === "object" ? row.layout : {};
      out[id] = {
        id,
        name: String(row.name || id.replace(/_/g, " ")),
        minBet: Math.max(1, Math.floor(Number(row.minBet) || 1)),
        maxBet: Math.max(1, Math.floor(Number(row.maxBet) || 30000)),
        maxPayoutMultiplier: Math.max(1, Math.floor(Number(row.maxPayoutMultiplier) || fallback.maxPayoutMultiplier)),
        reels: Math.max(1, Math.floor(Number(layout.reels) || fallback.reels)),
        rows: Math.max(1, Math.floor(Number(layout.rows) || fallback.rows))
      };
    });
    return out;
  }

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  }

  function resolveLockCurrencies() {
    const fallback = [
      { id: 43, key: "ruby_lock", name: "Ruby Lock", value: 1000000, short: "RL", icon: "./assets/blocks/special/ruby_lock.png" },
      { id: 42, key: "emerald_lock", name: "Emerald Lock", value: 10000, short: "EL", icon: "./assets/blocks/special/emerald_lock.png" },
      { id: 24, key: "obsidian_lock", name: "Obsidian Lock", value: 100, short: "OL", icon: "./assets/blocks/special/obsidian_lock.png" },
      { id: 9, key: "world_lock", name: "World Lock", value: 1, short: "WL", icon: "./assets/blocks/special/world_lock.png" }
    ];
    const catalog = (window.GTModules && window.GTModules.itemCatalog) || {};
    const blockAssetBase = typeof catalog.getBlockAssetBasePath === "function"
      ? String(catalog.getBlockAssetBasePath() || "./assets/blocks").replace(/\/+$/, "")
      : "./assets/blocks";
    if (typeof catalog.getBlocks === "function") {
      const rows = catalog.getBlocks();
      if (Array.isArray(rows)) {
        const out = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] || {};
          if (!row.worldLock) continue;
          const id = Math.floor(Number(row.id));
          if (!Number.isInteger(id) || id <= 0) continue;
          const value = Math.max(1, Math.floor(Number(row.lockValue) || 1));
          const key = String(row.key || "").trim() || ("lock_" + id);
          const name = String(row.name || key).trim().slice(0, 32) || ("Lock " + id);

          let short = "WL";
          if (key === "ruby_lock") short = "RL";
          else if (key === "emerald_lock") short = "EL";
          else if (key === "obsidian_lock") short = "OL";

          const image = String(row.image || "").trim();
          const icon = image ? (blockAssetBase + "/" + image.replace(/^\/+/, "")) : "";
          out.push({ id, key, name, value, short, icon });
        }
        if (out.length) {
          out.sort((a, b) => {
            if (b.value !== a.value) return b.value - a.value;
            return a.id - b.id;
          });
          return out;
        }
      }
    }
    return fallback;
  }

  function toLockCount(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function getLockWalletFromInventory(value) {
    const inv = value && typeof value === "object" ? value : {};
    const byId = {};
    let total = 0;
    for (let i = 0; i < LOCK_CURRENCIES.length; i++) {
      const row = LOCK_CURRENCIES[i];
      const count = toLockCount(inv[row.id]);
      byId[row.id] = count;
      total += count * row.value;
    }
    const vault = toLockCount(inv.web_vault_balance);
    return { byId, total, vault };
  }

  function decomposeLockValue(totalValue, vaultValue) {
    let remaining = toLockCount(totalValue);
    const out = {};
    for (let i = 0; i < LOCK_CURRENCIES.length; i++) {
      const row = LOCK_CURRENCIES[i];
      const count = Math.floor(remaining / row.value);
      out[row.id] = Math.max(0, count);
      remaining -= count * row.value;
    }
    out.web_vault_balance = Math.max(0, Math.floor(Number(vaultValue) || 0));
    return out;
  }

  function buildWalletBreakdownText(byId) {
    const safeById = byId && typeof byId === "object" ? byId : {};
    const parts = [];
    for (let i = 0; i < LOCK_CURRENCIES.length; i++) {
      const row = LOCK_CURRENCIES[i];
      const count = toLockCount(safeById[row.id]);
      if (count <= 0) continue;
      parts.push(count + " " + row.short);
    }
    return parts.length ? parts.join(" | ") : "0 WL";
  }

  function getLockRowByShort(shortCode) {
    const code = String(shortCode || "WL").trim().toUpperCase();
    for (let i = 0; i < LOCK_CURRENCIES.length; i++) {
      const row = LOCK_CURRENCIES[i];
      if (String(row.short || "").toUpperCase() === code) return row;
    }
    return LOCK_CURRENCIES[LOCK_CURRENCIES.length - 1] || {
      id: 9,
      key: "world_lock",
      name: "World Lock",
      value: 1,
      short: "WL",
      icon: "./assets/blocks/special/world_lock.png"
    };
  }

  function formatLocksHtml(value, shortCode) {
    const amount = Math.max(0, Math.floor(Number(value) || 0));
    const row = getLockRowByShort(shortCode || "WL");
    const unitShort = String(row.short || "WL");
    const iconSrc = String(row.icon || "").trim();
    const text = amount.toLocaleString("en-US") + " " + unitShort;
    if (!iconSrc) return escapeHtml(text);
    return "<span class=\"lock-amount-inline\">" +
      "<img class=\"lock-amount-icon\" src=\"" + escapeHtml(iconSrc) + "\" alt=\"" + escapeHtml(unitShort) + "\" draggable=\"false\">" +
      "<span>" + escapeHtml(text) + "</span>" +
      "</span>";
  }

  function normalizeWorldId(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, 24);
  }

  function makeStatus(message, mode) {
    if (!(els.authStatus instanceof HTMLElement)) return;
    els.authStatus.textContent = String(message || "");
    els.authStatus.classList.remove("error", "ok");
    if (mode === "error") {
      els.authStatus.classList.add("error");
    } else if (mode === "ok") {
      els.authStatus.classList.add("ok");
    }
  }

  function setAuthBusy(isBusy) {
    const busy = Boolean(isBusy);
    if (els.authLoginBtn instanceof HTMLButtonElement) els.authLoginBtn.disabled = busy;
    if (els.authCreateBtn instanceof HTMLButtonElement) els.authCreateBtn.disabled = busy;
    if (els.authUsername instanceof HTMLInputElement) els.authUsername.disabled = busy;
    if (els.authPassword instanceof HTMLInputElement) els.authPassword.disabled = busy;
  }

  function setWorldBusy(isBusy) {
    const busy = Boolean(isBusy);
    if (els.loadWorldBtn instanceof HTMLButtonElement) els.loadWorldBtn.disabled = busy;
    if (els.refreshBtn instanceof HTMLButtonElement) els.refreshBtn.disabled = busy;
    if (els.worldInput instanceof HTMLInputElement) els.worldInput.disabled = busy;
  }

  function updateSessionUi() {
    if (els.sessionLabel instanceof HTMLElement) {
      els.sessionLabel.textContent = state.user
        ? "@" + escapeHtml(state.user.username) + " (" + escapeHtml(state.user.role || "none") + ")"
        : "Not logged in";
    }
    if (els.scopeLabel instanceof HTMLElement) {
      els.scopeLabel.textContent = state.worldId ? state.worldId : "No world selected";
    }
    if (els.lockAccessLabel instanceof HTMLElement) {
      const user = state.user;
      const lock = state.worldLock;
      if (!user || !lock || !lock.ownerAccountId) {
        els.lockAccessLabel.textContent = "No world lock context";
      } else if (isWorldLockOwner()) {
        els.lockAccessLabel.textContent = "World owner";
      } else if (isWorldLockAdmin()) {
        els.lockAccessLabel.textContent = "World admin";
      } else {
        els.lockAccessLabel.textContent = "Visitor";
      }
    }
    if (els.logoutBtn instanceof HTMLButtonElement) {
      els.logoutBtn.classList.toggle("hidden", !state.user);
    }
    if (els.openVaultBtn instanceof HTMLButtonElement) {
      els.openVaultBtn.classList.toggle("hidden", !state.user);
    }
    if (els.dashboardCard instanceof HTMLElement) {
      els.dashboardCard.classList.toggle("hidden", !state.user);
    }
  }

  function loadSavedCredentials() {
    if (typeof authStorageModule.loadCredentials === "function") {
      return authStorageModule.loadCredentials(SAVED_AUTH_KEY);
    }
    try {
      const raw = localStorage.getItem(SAVED_AUTH_KEY);
      if (!raw) return { username: "", password: "" };
      const parsed = JSON.parse(raw);
      return {
        username: String(parsed && parsed.username || ""),
        password: String(parsed && parsed.password || "")
      };
    } catch (_error) {
      return { username: "", password: "" };
    }
  }

  function saveCredentials(username, password) {
    if (typeof authStorageModule.saveCredentials === "function") {
      authStorageModule.saveCredentials(SAVED_AUTH_KEY, username, password);
      return;
    }
    try {
      localStorage.setItem(SAVED_AUTH_KEY, JSON.stringify({
        username: String(username || "").slice(0, 20),
        password: String(password || "").slice(0, 64)
      }));
    } catch (_error) {
      // ignore localStorage write failures
    }
  }

  function loadLastWorld() {
    try {
      return normalizeWorldId(localStorage.getItem(LAST_WORLD_KEY) || "");
    } catch (_error) {
      return "";
    }
  }

  function saveLastWorld(worldId) {
    try {
      localStorage.setItem(LAST_WORLD_KEY, normalizeWorldId(worldId));
    } catch (_error) {
      // ignore
    }
  }

  async function ensureDb() {
    if (state.db) return state.db;
    if (typeof dbModule.getOrInitAuthDb !== "function") {
      throw new Error("DB module missing.");
    }
    const db = await dbModule.getOrInitAuthDb({
      network: state.network,
      firebaseRef: window.firebase,
      firebaseConfig: window.FIREBASE_CONFIG,
      getFirebaseApiKey: window.getFirebaseApiKey
    });
    state.db = db;
    return db;
  }

  function normalizeLockRecord(value) {
    if (!value || typeof value !== "object") return null;
    const ownerAccountId = String(value.ownerAccountId || "").trim();
    if (!ownerAccountId) return null;
    const adminsRaw = value.admins && typeof value.admins === "object" ? value.admins : {};
    const admins = {};
    Object.keys(adminsRaw).forEach((accountId) => {
      const safeId = String(accountId || "").trim();
      if (!safeId || safeId === ownerAccountId) return;
      const row = adminsRaw[accountId] && typeof adminsRaw[accountId] === "object" ? adminsRaw[accountId] : {};
      admins[safeId] = { username: normalizeUsername(row.username || "") };
    });
    return {
      ownerAccountId,
      ownerName: String(value.ownerName || "").trim().slice(0, 20),
      admins
    };
  }

  function normalizeOwnerTax(value) {
    if (!value || typeof value !== "object") return null;
    const percentRaw = value.taxPercent !== undefined ? value.taxPercent : value.percent;
    const txRaw = Math.floor(Number(value.tx));
    const tyRaw = Math.floor(Number(value.ty));
    return {
      percent: Math.max(0, Math.min(100, Math.floor(Number(percentRaw) || 0))),
      earningsLocks: Math.max(0, Math.floor(Number(value.earningsLocks) || 0)),
      tx: Number.isInteger(txRaw) ? txRaw : -1,
      ty: Number.isInteger(tyRaw) ? tyRaw : -1,
      ownerAccountId: String(value.ownerAccountId || "").trim(),
      ownerName: String(value.ownerName || "").trim().slice(0, 20)
    };
  }

  function normalizeMachineStats(value) {
    const row = value && typeof value === "object" ? value : {};
    return {
      plays: Math.max(0, Math.floor(Number(row.plays) || 0)),
      totalBet: Math.max(0, Math.floor(Number(row.totalBet) || 0)),
      totalPayout: Math.max(0, Math.floor(Number(row.totalPayout) || 0)),
      lastPlayerRoll: Math.max(0, Math.floor(Number(row.lastPlayerRoll) || 0)),
      lastHouseRoll: Math.max(0, Math.floor(Number(row.lastHouseRoll) || 0)),
      lastPlayerReme: Math.max(0, Math.floor(Number(row.lastPlayerReme) || 0)),
      lastHouseReme: Math.max(0, Math.floor(Number(row.lastHouseReme) || 0)),
      lastMultiplier: Math.max(0, Number(row.lastMultiplier) || 0),
      lastOutcome: String(row.lastOutcome || "").slice(0, 24),
      lastSlotsText: String(row.lastSlotsText || "").slice(0, 220),
      lastSlotsSummary: String(row.lastSlotsSummary || "").slice(0, 220),
      lastSlotsLines: String(row.lastSlotsLines || "").slice(0, 220),
      lastSlotsLineIds: String(row.lastSlotsLineIds || "").slice(0, 120),
      lastPlayerName: String(row.lastPlayerName || "").slice(0, 24),
      lastAt: Math.max(0, Math.floor(Number(row.lastAt) || 0))
    };
  }

  function normalizeBlackjackRound(value) {
    if (!value || typeof value !== "object") return null;
    const handsRaw = Array.isArray(value.hands) ? value.hands : [];
    const dealerCardsRaw = Array.isArray(value.dealerCards) ? value.dealerCards : [];
    return {
      active: Boolean(value.active),
      playerName: String(value.playerName || "").slice(0, 20),
      summary: String(value.summary || "").slice(0, 220),
      aggregateOutcome: String(value.aggregateOutcome || "").slice(0, 24),
      totalPayout: Math.max(0, Math.floor(Number(value.totalPayout) || 0)),
      dealerCards: dealerCardsRaw
        .map((n) => Math.max(1, Math.min(13, Math.floor(Number(n) || 1))))
        .slice(0, 16),
      hands: handsRaw.slice(0, 4).map((handRaw) => {
        const hand = handRaw && typeof handRaw === "object" ? handRaw : {};
        const cardsRaw = Array.isArray(hand.cards) ? hand.cards : [];
        return {
          cards: cardsRaw
            .map((n) => Math.max(1, Math.min(13, Math.floor(Number(n) || 1))))
            .slice(0, 16),
          bet: Math.max(1, Math.floor(Number(hand.bet) || 1)),
          done: Boolean(hand.done),
          outcome: String(hand.outcome || "").slice(0, 24),
          payout: Math.max(0, Math.floor(Number(hand.payout) || 0))
        };
      })
    };
  }

  function normalizeMachineRecord(tileKey, raw) {
    if (!raw || typeof raw !== "object") return null;
    const [txRaw, tyRaw] = String(tileKey || "").split("_");
    const tx = Math.floor(Number(txRaw));
    const ty = Math.floor(Number(tyRaw));
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;

    const typeId = String(raw.type || "reme_roulette").trim();
    const def = MACHINE_DEFS[typeId] || MACHINE_DEFS.reme_roulette;
    const maxBetRaw = Math.floor(Number(raw.maxBet));
    const maxBet = Math.max(def.minBet, Math.min(def.maxBet, Number.isFinite(maxBetRaw) ? maxBetRaw : def.maxBet));

    return {
      tileKey: String(tileKey || ""),
      tx,
      ty,
      type: def.id,
      typeName: def.name,
      minBet: def.minBet,
      hardMaxBet: def.maxBet,
      maxBet,
      ownerAccountId: String(raw.ownerAccountId || "").trim(),
      ownerName: String(raw.ownerName || "").trim().slice(0, 20),
      inUseAccountId: String(raw.inUseAccountId || "").trim(),
      inUseName: String(raw.inUseName || "").trim().slice(0, 20),
      earningsLocks: Math.max(0, Math.floor(Number(raw.earningsLocks) || 0)),
      updatedAt: Math.max(0, Math.floor(Number(raw.updatedAt) || 0)),
      stats: normalizeMachineStats(raw.stats),
      blackjackRound: normalizeBlackjackRound(raw.blackjackRound)
    };
  }

  function getMachineOwnerLabel(machine) {
    const name = String(machine.ownerName || "").trim();
    if (name) return "@" + name;
    return machine.ownerAccountId || "unknown";
  }

  function isWorldLocked() {
    return Boolean(state.worldLock && state.worldLock.ownerAccountId);
  }

  function isWorldLockOwner() {
    const user = state.user;
    return Boolean(user && state.worldLock && state.worldLock.ownerAccountId && state.worldLock.ownerAccountId === user.accountId);
  }

  function isWorldLockAdmin() {
    const user = state.user;
    if (!user || !state.worldLock || !state.worldLock.admins) return false;
    if (isWorldLockOwner()) return false;
    return Boolean(state.worldLock.admins[user.accountId]);
  }

  function canCollectMachine(machine) {
    const user = state.user;
    if (!user || !machine) return false;
    return Boolean(machine.ownerAccountId && machine.ownerAccountId === user.accountId);
  }

  function canEditMachineMaxBet(machine) {
    if (!machine || !state.user) return false;
    if (isWorldLocked()) {
      if (isWorldLockOwner()) return true;
      if (!canCollectMachine(machine)) return false;
      if (isWorldLockAdmin()) return false;
      return true;
    }
    return canCollectMachine(machine);
  }

  function isSlotsMachineType(typeId) {
    return SLOT_MACHINE_IDS.indexOf(String(typeId || "").trim()) >= 0;
  }

  function getSlotsMachines() {
    const rows = Array.isArray(state.machines) ? state.machines : [];
    return rows.filter((row) => isSlotsMachineType(row && row.type));
  }

  function getMachinePlayableBetMax(machine, walletLocks) {
    if (!machine) return 0;
    const def = MACHINE_DEFS[machine.type] || MACHINE_DEFS.slots;
    const bank = Math.max(0, Math.floor(Number(machine.earningsLocks) || 0));
    const machineCap = Math.max(def.minBet, Math.floor(Number(machine.maxBet) || def.maxBet));
    const byWallet = Math.max(0, Math.floor(Number(walletLocks) || 0)); // this will receive webVaultLocks
    const payoutCap = Math.max(1, Math.floor(Number(def.maxPayoutMultiplier) || 1));
    const byBank = Math.max(0, Math.floor(bank / payoutCap));
    return Math.max(0, Math.min(machineCap, byWallet, byBank));
  }

  function detachWorldListeners() {
    stopPlayRolling();
    if (state.refs.lock && state.handlers.lock) state.refs.lock.off("value", state.handlers.lock);
    if (state.refs.machines && state.handlers.machines) state.refs.machines.off("value", state.handlers.machines);
    if (state.refs.ownerTax && state.handlers.ownerTax) state.refs.ownerTax.off("value", state.handlers.ownerTax);
    if (state.refs.inventoryLocks && state.handlers.inventoryLocks) state.refs.inventoryLocks.off("value", state.handlers.inventoryLocks);

    state.refs.lock = null;
    state.refs.machines = null;
    state.refs.ownerTax = null;
    state.refs.inventoryLocks = null;
    state.handlers.lock = null;
    state.handlers.machines = null;
    state.handlers.ownerTax = null;
    state.handlers.inventoryLocks = null;
    state.worldLock = null;
    state.ownerTax = null;
    state.machines = [];
    state.walletLocks = 0;
    state.walletBreakdownText = "0 WL";
    state.selectedSpectateTileKey = "";
    state.selectedPlayTileKey = "";
    state.playBusy = false;
    state.playBoardHtml = "";
    state.playResultText = "";
  }

  function renderSummary() {
    const rows = Array.isArray(state.machines) ? state.machines : [];
    const me = state.user ? state.user.accountId : "";
    const totalBank = rows.reduce((sum, row) => sum + Math.max(0, Number(row.earningsLocks) || 0), 0);
    const mine = rows.filter((row) => row.ownerAccountId && row.ownerAccountId === me).length;
    const tax = state.ownerTax || { percent: 0, earningsLocks: 0 };

    if (els.sumMachines instanceof HTMLElement) els.sumMachines.textContent = String(rows.length);
    if (els.sumBank instanceof HTMLElement) els.sumBank.innerHTML = formatLocksHtml(totalBank, "WL");
    if (els.sumMine instanceof HTMLElement) els.sumMine.textContent = String(mine);
    if (els.sumWallet instanceof HTMLElement) {
      els.sumWallet.innerHTML = "Vault: " + formatLocksHtml(state.webVaultLocks, "WL")
        + " | Game: " + formatLocksHtml(state.walletLocks, "WL")
        + " (" + escapeHtml(state.walletBreakdownText) + ")";
    }
    if (els.sumTax instanceof HTMLElement) els.sumTax.innerHTML = escapeHtml(String(tax.percent)) + "% / " + formatLocksHtml(tax.earningsLocks, "WL");
  }

  function renderScope() {
    updateSessionUi();
    const lock = state.worldLock;
    if (!state.worldId) {
      if (els.scopeLabel instanceof HTMLElement) els.scopeLabel.textContent = "No world selected";
      return;
    }
    if (els.scopeLabel instanceof HTMLElement) {
      if (!lock || !lock.ownerAccountId) {
        els.scopeLabel.textContent = state.worldId + " (unlocked)";
      } else {
        const ownerName = String(lock.ownerName || "").trim() || lock.ownerAccountId;
        els.scopeLabel.textContent = state.worldId + " (lock owner @" + ownerName + ")";
      }
    }
  }

  function renderMachines() {
    if (!(els.machineTbody instanceof HTMLElement) || !(els.machineEmpty instanceof HTMLElement)) return;
    els.machineTbody.innerHTML = "";

    const query = String(state.machineSearch || "").trim().toLowerCase();
    const rows = (Array.isArray(state.machines) ? state.machines : []).filter((row) => {
      if (!query) return true;
      const owner = (row.ownerName || row.ownerAccountId || "").toLowerCase();
      const type = String(row.typeName || row.type || "").toLowerCase();
      const tile = row.tx + "," + row.ty;
      return owner.includes(query) || type.includes(query) || tile.includes(query) || row.tileKey.includes(query);
    });

    if (!rows.length) {
      els.machineEmpty.classList.remove("hidden");
      return;
    }
    els.machineEmpty.classList.add("hidden");

    const frag = document.createDocumentFragment();

    rows.sort((a, b) => {
      if (a.ty !== b.ty) return a.ty - b.ty;
      return a.tx - b.tx;
    }).forEach((machine) => {
      const tr = document.createElement("tr");

      const tdTile = document.createElement("td");
      tdTile.textContent = machine.tx + ", " + machine.ty;

      const tdType = document.createElement("td");
      tdType.textContent = machine.typeName;

      const tdOwner = document.createElement("td");
      const ownerSpan = document.createElement("span");
      ownerSpan.className = "machine-owner" + (canCollectMachine(machine) ? " me" : "");
      ownerSpan.textContent = getMachineOwnerLabel(machine);
      tdOwner.appendChild(ownerSpan);

      const tdBank = document.createElement("td");
      tdBank.innerHTML = formatLocksHtml(machine.earningsLocks, "WL");

      const tdState = document.createElement("td");
      const stateTag = document.createElement("span");
      stateTag.className = "tag " + (machine.inUseAccountId ? "warn" : "good");
      stateTag.textContent = machine.inUseAccountId
        ? ("In use" + (machine.inUseName ? " by @" + machine.inUseName : ""))
        : "Idle";
      tdState.appendChild(stateTag);

      const tdMaxBet = document.createElement("td");
      const wrap = document.createElement("div");
      wrap.className = "machine-bet";
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(machine.minBet);
      input.max = String(machine.hardMaxBet);
      input.step = "1";
      input.value = String(machine.maxBet);
      input.dataset.tileKey = machine.tileKey;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Save";
      btn.dataset.tileKey = machine.tileKey;
      btn.dataset.act = "save-maxbet";

      const canEdit = canEditMachineMaxBet(machine);
      input.disabled = !canEdit;
      btn.disabled = !canEdit;

      wrap.appendChild(input);
      wrap.appendChild(btn);

      if (!canEdit) {
        const info = document.createElement("span");
        info.className = "tag danger";
        info.textContent = isWorldLocked() ? "No lock permission" : "Not machine owner";
        wrap.appendChild(info);
      }

      tdMaxBet.appendChild(wrap);

      const tdBankActions = document.createElement("td");
      const bankWrap = document.createElement("div");
      bankWrap.className = "machine-bank-controls";
      const bankAmountInput = document.createElement("input");
      bankAmountInput.type = "number";
      bankAmountInput.min = "1";
      bankAmountInput.step = "1";
      bankAmountInput.placeholder = "WL amount";
      bankAmountInput.value = "1";
      bankAmountInput.dataset.tileKey = machine.tileKey;
      bankAmountInput.dataset.bankAmount = "1";

      const refillBtn = document.createElement("button");
      refillBtn.type = "button";
      refillBtn.textContent = "Refill";
      refillBtn.dataset.tileKey = machine.tileKey;
      refillBtn.dataset.act = "refill-bank";

      const withdrawBtn = document.createElement("button");
      withdrawBtn.type = "button";
      withdrawBtn.textContent = "Withdraw";
      withdrawBtn.dataset.tileKey = machine.tileKey;
      withdrawBtn.dataset.act = "withdraw-bank";

      const emptyBtn = document.createElement("button");
      emptyBtn.type = "button";
      emptyBtn.textContent = "Empty";
      emptyBtn.dataset.tileKey = machine.tileKey;
      emptyBtn.dataset.act = "empty-bank";

      const canBank = canCollectMachine(machine);
      bankAmountInput.disabled = !canBank;
      refillBtn.disabled = !canBank;
      withdrawBtn.disabled = !canBank;
      emptyBtn.disabled = !canBank || machine.earningsLocks <= 0;

      bankWrap.appendChild(bankAmountInput);
      bankWrap.appendChild(refillBtn);
      bankWrap.appendChild(withdrawBtn);
      bankWrap.appendChild(emptyBtn);
      if (!canBank) {
        const bankMuted = document.createElement("span");
        bankMuted.className = "bank-muted";
        bankMuted.textContent = "Machine owner only";
        bankWrap.appendChild(bankMuted);
      }
      tdBankActions.appendChild(bankWrap);

      const tdSpectate = document.createElement("td");
      const spectateBtn = document.createElement("button");
      spectateBtn.type = "button";
      spectateBtn.textContent = state.selectedSpectateTileKey === machine.tileKey ? "Spectating" : "Spectate";
      spectateBtn.dataset.tileKey = machine.tileKey;
      spectateBtn.dataset.act = "spectate-machine";
      tdSpectate.appendChild(spectateBtn);

      tr.appendChild(tdTile);
      tr.appendChild(tdType);
      tr.appendChild(tdOwner);
      tr.appendChild(tdBank);
      tr.appendChild(tdState);
      tr.appendChild(tdMaxBet);
      tr.appendChild(tdBankActions);
      tr.appendChild(tdSpectate);
      frag.appendChild(tr);
    });

    els.machineTbody.appendChild(frag);
  }

  function renderAll() {
    renderScope();
    renderTaxControls();
    renderSummary();
    renderMachines();
    renderSpectate();
    renderPlayPanel();
  }

  function findMachineByTileKey(tileKey) {
    const safe = String(tileKey || "");
    const rows = Array.isArray(state.machines) ? state.machines : [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].tileKey === safe) return rows[i];
    }
    return null;
  }

  function formatCard(value) {
    const c = Math.max(1, Math.min(13, Math.floor(Number(value) || 1)));
    if (c === 1) return "A";
    if (c === 11) return "J";
    if (c === 12) return "Q";
    if (c === 13) return "K";
    return String(c);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getCardSuit(index, value) {
    const suits = ["♠", "♥", "♦", "♣"];
    const i = Math.abs((Math.floor(Number(index) || 0) + Math.floor(Number(value) || 1)) % suits.length);
    return suits[i];
  }

  function getCardSuitClass(suit) {
    if (suit === "♥" || suit === "♦") return "red";
    return "black";
  }

  function renderCardStrip(cards) {
    const src = Array.isArray(cards) ? cards : [];
    if (!src.length) return "<div class=\"spec-cards-empty\">No cards</div>";
    return src.map((value, index) => {
      const rank = formatCard(value);
      const suit = getCardSuit(index, value);
      const suitClass = getCardSuitClass(suit);
      return (
        "<div class=\"spec-card " + suitClass + "\">" +
        "<div class=\"spec-card-corner\">" + escapeHtml(rank) + suit + "</div>" +
        "<div class=\"spec-card-center\">" + escapeHtml(rank) + "</div>" +
        "<div class=\"spec-card-suit\">" + suit + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function normalizeSlotsToken(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getSlotsSymbolLabel(token) {
    const key = normalizeSlotsToken(token);
    if (key === "GEM") return "GEM";
    if (key === "PICK") return "PICK";
    if (key === "MINER") return "MINER";
    if (key === "GOLD") return "GOLD";
    if (key === "DYN") return "DYN";
    if (key === "WILD") return "WILD";
    if (key === "SCAT") return "SCAT";
    if (key === "BONUS") return "BONUS";
    if (key === "SEVEN" || key === "7") return "7";
    if (key === "BAR") return "BAR";
    if (key === "CHERRY") return "CHERRY";
    if (key === "LEMON") return "LEMON";
    if (key === "BELL") return "BELL";
    return key || "?";
  }

  function getSlotsSymbolClass(token) {
    const key = normalizeSlotsToken(token);
    if (key === "WILD") return "wild";
    if (key === "SCAT") return "scatter";
    if (key === "BONUS") return "bonus";
    if (key === "DYN") return "dynamite";
    if (key === "GEM") return "gem";
    return "normal";
  }

  function parseSlotsRows(value) {
    const raw = String(value || "");
    const rows = raw.split("|").map((s) => String(s || "").trim()).filter(Boolean);
    if (!rows.length) return [];
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].split(",").map((s) => String(s || "").trim()).filter(Boolean);
      out.push(row.length ? row : ["?"]);
    }
    return out;
  }

  function parseSlotsLines(value) {
    const raw = String(value || "");
    if (!raw) return [];
    return raw.split("|").map((s) => String(s || "").trim()).filter(Boolean).slice(0, 8);
  }

  function parseSlotsLineIds(value) {
    const raw = String(value || "");
    if (!raw) return [];
    const out = [];
    const parts = raw.split(",").map((s) => String(s || "").trim()).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const id = Math.max(1, Math.floor(Number(parts[i]) || 0));
      if (id > 0 && out.indexOf(id) < 0) out.push(id);
    }
    return out.slice(0, 12);
  }

  function normalizeBoardRows(rows) {
    const safe = Array.isArray(rows) ? rows : [];
    if (!safe.length) return [];
    const normalized = safe
      .map((row) => Array.isArray(row) ? row.map((cell) => String(cell || "").trim()).filter(Boolean) : [])
      .filter((row) => row.length > 0);
    const singleCellRows = normalized.length > 1 && normalized.every((row) => row.length === 1);
    if (singleCellRows) {
      return [normalized.map((row) => row[0])];
    }
    return normalized;
  }

  function buildSlotsBoardFromRows(rows, lines, lineIds) {
    const safeRows = normalizeBoardRows(rows);
    if (!safeRows.length) {
      return "<div class=\"spec-note\">No board snapshot yet.</div>";
    }

    const safeLines = Array.isArray(lines)
      ? lines.map((line) => String(line || "").trim()).filter(Boolean).slice(0, 12)
      : [];
    const safeLineIds = Array.isArray(lineIds)
      ? lineIds.map((id) => Math.max(1, Math.floor(Number(id) || 0))).filter((id) => id > 0).slice(0, 12)
      : [];

    const rowCount = Math.max(1, safeRows.length);
    let colCount = 1;
    for (let r = 0; r < safeRows.length; r++) {
      colCount = Math.max(colCount, safeRows[r] ? safeRows[r].length : 0);
    }
    let boardHtml = "";
    for (let c = 0; c < colCount; c++) {
      boardHtml += "<div class='slotsv2-reel'>";
      for (let r = 0; r < rowCount; r++) {
        const tok = (safeRows[r] && safeRows[r][c]) || "?";
        const cls = getSlotsSymbolClass(tok);
        boardHtml +=
          "<div class='slotsv2-cell " + cls + "'>" +
          "<span class='slotsv2-glyph'>" + escapeHtml(getSlotsSymbolLabel(tok)) + "</span>" +
          "<span class='slotsv2-token'>" + escapeHtml(normalizeSlotsToken(tok) || "?") + "</span>" +
          "</div>";
      }
      boardHtml += "</div>";
    }

    const badges = safeLines.length
      ? safeLines.map((line) => "<span class='slotsv2-line-badge'>" + escapeHtml(line) + "</span>").join("")
      : (safeLineIds.length
        ? safeLineIds.map((id) => "<span class='slotsv2-line-badge'>Line " + id + "</span>").join("")
        : "<span class='slotsv2-line-badge muted'>No winning lines</span>");

    return (
      "<div class='slotsv2-board slotsv2-idle' style='--slots-cols:" + colCount + ";--slots-rows:" + rowCount + ";'>" +
      boardHtml +
      "</div>" +
      "<div class='slotsv2-lines'>" + badges + "</div>"
    );
  }

  function buildSlotsBoardHtml(stats) {
    return buildSlotsBoardFromRows(
      parseSlotsRows(stats && stats.lastSlotsText),
      parseSlotsLines(stats && stats.lastSlotsLines),
      parseSlotsLineIds(stats && stats.lastSlotsLineIds)
    );
  }

  function buildRowsFromSpinResult(result, machineType) {
    const reels = result && Array.isArray(result.reels) ? result.reels : [];
    if (!reels.length) return [];
    if (machineType === "slots") {
      return [reels.map((v) => String(v || "").trim()).filter(Boolean)];
    }
    const out = [];
    for (let i = 0; i < reels.length; i++) {
      out.push(String(reels[i] || "").split(",").map((v) => String(v || "").trim()).filter(Boolean));
    }
    return out;
  }

  function buildRollingRows(machineType, spinTick) {
    const def = MACHINE_DEFS[machineType] || MACHINE_DEFS.slots;
    const rowsCount = Math.max(1, Math.floor(Number(def.rows) || (machineType === "slots" ? 1 : 3)));
    const colsCount = Math.max(1, Math.floor(Number(def.reels) || (machineType === "slots" ? 3 : 5)));
    const symbols = SLOT_SYMBOLS[machineType] || SLOT_SYMBOLS.slots;
    const out = [];
    for (let r = 0; r < rowsCount; r++) {
      out[r] = [];
      for (let c = 0; c < colsCount; c++) {
        const idx = Math.floor(Math.abs(Math.sin((spinTick + 1) * (r + 3) * (c + 5))) * symbols.length) % symbols.length;
        out[r][c] = symbols[idx] || "?";
      }
    }
    return out;
  }

  function setPlayStatus(message, mode) {
    if (!(els.playStatus instanceof HTMLElement)) return;
    els.playStatus.textContent = String(message || "");
    els.playStatus.classList.remove("error", "ok");
    if (mode === "error") {
      els.playStatus.classList.add("error");
    } else if (mode === "ok") {
      els.playStatus.classList.add("ok");
    }
  }

  function stopPlayRolling() {
    if (playRollIntervalId) {
      window.clearInterval(playRollIntervalId);
      playRollIntervalId = 0;
    }
  }

  function startPlayRolling(machineType) {
    stopPlayRolling();
    let tick = 0;
    playRollIntervalId = window.setInterval(() => {
      tick += 1;
      const rows = buildRollingRows(machineType, tick);
      state.playBoardHtml = buildSlotsBoardFromRows(rows, ["Spinning..."], []);
      renderPlayPanel();
    }, 90);
  }

  function formatTs(ts) {
    const safe = Math.max(0, Math.floor(Number(ts) || 0));
    if (!safe) return "-";
    const d = new Date(safe);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return hh + ":" + mm + ":" + ss;
  }

  function renderSpectate() {
    if (!(els.spectateBody instanceof HTMLElement)) return;
    const rows = Array.isArray(state.machines) ? state.machines : [];
    if (!rows.length) {
      els.spectateBody.innerHTML = "<div class=\"spec-empty\">No machines to spectate in this world.</div>";
      return;
    }
    let machine = findMachineByTileKey(state.selectedSpectateTileKey);
    if (!machine) {
      machine = rows.find((row) => row.inUseAccountId) || rows[0];
      state.selectedSpectateTileKey = machine ? machine.tileKey : "";
    }
    if (!machine) {
      els.spectateBody.innerHTML = "<div class=\"spec-empty\">Pick a machine to spectate.</div>";
      return;
    }

    const stats = machine.stats || {};
    const headerHtml =
      "<div class=\"spec-head\">" +
      "<div class=\"spec-title\">" + escapeHtml(machine.typeName) + " at " + machine.tx + "," + machine.ty + "</div>" +
      "<div class=\"spec-tags\">" +
      "<span class=\"spec-tag\">Owner: " + escapeHtml(getMachineOwnerLabel(machine)) + "</span>" +
      "<span class=\"spec-tag " + (machine.inUseAccountId ? "live" : "") + "\">" +
      (machine.inUseAccountId ? ("LIVE @" + escapeHtml(machine.inUseName || machine.inUseAccountId)) : "Idle") +
      "</span>" +
      "<span class=\"spec-tag\">Bank: " + formatLocksHtml(machine.earningsLocks, "WL") + "</span>" +
      "<span class=\"spec-tag\">Max Bet: " + formatLocksHtml(machine.maxBet, "WL") + "</span>" +
      "</div>" +
      "</div>";

    const metricsHtml =
      "<div class=\"spec-metrics\">" +
      "<div class=\"spec-metric\"><span>Plays</span><strong>" + (stats.plays || 0) + "</strong></div>" +
      "<div class=\"spec-metric\"><span>Total Bet</span><strong>" + formatLocksHtml(stats.totalBet || 0, "WL") + "</strong></div>" +
      "<div class=\"spec-metric\"><span>Total Payout</span><strong>" + formatLocksHtml(stats.totalPayout || 0, "WL") + "</strong></div>" +
      "<div class=\"spec-metric\"><span>Last At</span><strong>" + escapeHtml(formatTs(stats.lastAt)) + "</strong></div>" +
      "</div>";

    let modeHtml = "";
    if (machine.type === "blackjack") {
      const round = machine.blackjackRound;
      const handsHtml = round && Array.isArray(round.hands)
        ? round.hands.map((hand, index) => {
          return (
            "<div class=\"spec-bj-lane\">" +
            "<div class=\"spec-bj-head\">Hand " + (index + 1) + " | Bet " + formatLocksHtml(hand.bet, "WL") + " | " + escapeHtml(hand.outcome || (hand.done ? "done" : "playing")) + "</div>" +
            "<div class=\"spec-cards\">" + renderCardStrip(hand.cards) + "</div>" +
            "</div>"
          );
        }).join("")
        : "<div class=\"spec-note\">No active blackjack hand.</div>";
      modeHtml =
        "<div class=\"spec-mode spec-blackjack\">" +
        "<div class=\"spec-mode-title\">Blackjack Table" + (round && round.playerName ? (" - @" + escapeHtml(round.playerName)) : "") + "</div>" +
        "<div class=\"spec-blackjack-table\">" +
        "<div class=\"spec-bj-lane dealer\">" +
        "<div class=\"spec-bj-head\">Dealer</div>" +
        "<div class=\"spec-cards\">" + renderCardStrip(round && round.dealerCards) + "</div>" +
        "</div>" +
        "<div class=\"spec-bj-divider\"></div>" +
        handsHtml +
        "</div>" +
        (round && round.summary ? ("<div class=\"spec-note\">" + escapeHtml(round.summary) + "</div>") : "") +
        "</div>";
    } else if (machine.type.indexOf("slots") === 0) {
      modeHtml =
        "<div class=\"spec-mode\">" +
        "<div class=\"spec-mode-title\">Slots Snapshot</div>" +
        buildSlotsBoardHtml(stats) +
        "<div class=\"spec-grid\">" +
        "<div><span>Outcome</span><strong>" + escapeHtml(stats.lastOutcome || "-") + "</strong></div>" +
        "<div><span>Multiplier</span><strong>x" + Number(stats.lastMultiplier || 0).toFixed(2) + "</strong></div>" +
        "<div><span>Player</span><strong>" + escapeHtml(stats.lastPlayerName || "-") + "</strong></div>" +
        "<div><span>Updated</span><strong>" + escapeHtml(formatTs(stats.lastAt)) + "</strong></div>" +
        "</div>" +
        (stats.lastSlotsSummary ? ("<div class=\"spec-note\">" + escapeHtml(stats.lastSlotsSummary) + "</div>") : "") +
        "</div>";
    } else {
      modeHtml =
        "<div class=\"spec-mode\">" +
        "<div class=\"spec-mode-title\">Roulette Snapshot</div>" +
        "<div class=\"spec-grid\">" +
        "<div><span>Player Roll</span><strong>" + (stats.lastPlayerRoll || 0) + "</strong></div>" +
        "<div><span>House Roll</span><strong>" + (stats.lastHouseRoll || 0) + "</strong></div>" +
        "<div><span>Player Reme</span><strong>" + (stats.lastPlayerReme || 0) + "</strong></div>" +
        "<div><span>House Reme</span><strong>" + (stats.lastHouseReme || 0) + "</strong></div>" +
        "<div><span>Multiplier</span><strong>x" + Number(stats.lastMultiplier || 0).toFixed(2) + "</strong></div>" +
        "<div><span>Outcome</span><strong>" + escapeHtml(stats.lastOutcome || "-") + "</strong></div>" +
        "</div>" +
        "</div>";
    }

    els.spectateBody.innerHTML = headerHtml + metricsHtml + modeHtml;
  }

  function renderPlayPanel() {
    if (!(els.playConsole instanceof HTMLElement)) return;
    const show = Boolean(state.user && state.worldId);
    els.playConsole.classList.toggle("hidden", !show);
    if (!show) return;

    const slotRows = getSlotsMachines().slice().sort((a, b) => {
      if (a.ty !== b.ty) return a.ty - b.ty;
      return a.tx - b.tx;
    });
    const hasSlots = slotRows.length > 0;
    const safeCurrent = String(state.selectedPlayTileKey || "");
    const fromSpectate = findMachineByTileKey(state.selectedSpectateTileKey);
    if (!hasSlots) {
      state.selectedPlayTileKey = "";
      state.playBoardHtml = "";
      if (els.playMachineSelect instanceof HTMLSelectElement) {
        els.playMachineSelect.innerHTML = "<option value=\"\">No slots machine in world</option>";
        els.playMachineSelect.disabled = true;
      }
      if (els.playBetInput instanceof HTMLInputElement) els.playBetInput.disabled = true;
      if (els.playSpinBtn instanceof HTMLButtonElement) els.playSpinBtn.disabled = true;
      if (els.playMaxBtn instanceof HTMLButtonElement) els.playMaxBtn.disabled = true;
      if (els.playMeta instanceof HTMLElement) {
        els.playMeta.innerHTML = "<span class=\"tag danger\">No playable slot machines found.</span>";
      }
      if (els.playBoard instanceof HTMLElement) {
        els.playBoard.innerHTML = "<div class=\"spec-empty\">Place slot machines in-game, then reload world here.</div>";
      }
      setPlayStatus("No slot machine available in this world.", "error");
      return;
    }

    if (!safeCurrent || !slotRows.some((row) => row.tileKey === safeCurrent)) {
      state.selectedPlayTileKey = (fromSpectate && isSlotsMachineType(fromSpectate.type))
        ? fromSpectate.tileKey
        : slotRows[0].tileKey;
      state.playBoardHtml = "";
      state.playResultText = "";
    }
    const selected = findMachineByTileKey(state.selectedPlayTileKey) || slotRows[0];
    if (!selected) return;

    if (els.playMachineSelect instanceof HTMLSelectElement) {
      const options = slotRows.map((row) => {
        const mark = row.inUseAccountId ? " [IN USE]" : "";
        return (
          "<option value=\"" + escapeHtml(row.tileKey) + "\">" +
          escapeHtml(row.typeName + " @ " + row.tx + "," + row.ty + mark) +
          "</option>"
        );
      }).join("");
      els.playMachineSelect.innerHTML = options;
      els.playMachineSelect.value = selected.tileKey;
      els.playMachineSelect.disabled = state.playBusy;
    }

    const def = MACHINE_DEFS[selected.type] || MACHINE_DEFS.slots;
    const bank = Math.max(0, Math.floor(Number(selected.earningsLocks) || 0));
    const byBank = Math.max(0, Math.floor(bank / Math.max(1, Math.floor(Number(def.maxPayoutMultiplier) || 1))));
    const maxPlayable = getMachinePlayableBetMax(selected, state.walletLocks);
    const minPlayable = def.minBet;
    const canSpin = maxPlayable >= minPlayable && !state.playBusy && (!selected.inUseAccountId || selected.inUseAccountId === state.user.accountId);

    if (els.playBetInput instanceof HTMLInputElement) {
      const currentBet = parsePositiveAmount(els.playBetInput.value);
      const bet = Math.max(minPlayable, Math.min(maxPlayable || minPlayable, currentBet || minPlayable));
      els.playBetInput.min = String(minPlayable);
      els.playBetInput.max = String(Math.max(minPlayable, maxPlayable));
      els.playBetInput.value = String(bet);
      els.playBetInput.disabled = !canSpin;
    }
    if (els.playSpinBtn instanceof HTMLButtonElement) {
      els.playSpinBtn.disabled = !canSpin;
      els.playSpinBtn.textContent = state.playBusy ? "Spinning..." : "Spin";
    }
    if (els.playMaxBtn instanceof HTMLButtonElement) {
      els.playMaxBtn.disabled = !canSpin || maxPlayable <= 0;
    }

    if (els.playMeta instanceof HTMLElement) {
      const machineOwner = getMachineOwnerLabel(selected);
      const lockTag = selected.inUseAccountId && selected.inUseAccountId !== state.user.accountId
        ? "<span class=\"tag warn\">In use by @" + escapeHtml(selected.inUseName || selected.inUseAccountId) + "</span>"
        : "<span class=\"tag good\">Ready</span>";
      const limitTag = maxPlayable >= minPlayable
        ? "<span class=\"tag\">Playable Bet: " + formatLocksHtml(maxPlayable, "WL") + "</span>"
        : "<span class=\"tag danger\">Machine needs more bank</span>";
      els.playMeta.innerHTML =
        "<span class=\"tag\">Owner: " + escapeHtml(machineOwner) + "</span>" +
        "<span class=\"tag\">Bank: " + formatLocksHtml(bank, "WL") + "</span>" +
        "<span class=\"tag\">Wallet: " + formatLocksHtml(state.walletLocks, "WL") + "</span>" +
        "<span class=\"tag\">Bank Bet Cap: " + formatLocksHtml(byBank, "WL") + "</span>" +
        "<span class=\"tag\">Max Bet Set: " + formatLocksHtml(selected.maxBet, "WL") + "</span>" +
        lockTag +
        limitTag;
    }

    if (els.playBoard instanceof HTMLElement) {
      const fallbackBoard = buildSlotsBoardHtml(selected.stats || {});
      els.playBoard.innerHTML = state.playBoardHtml || fallbackBoard;
    }
    if (!state.playBusy && !state.playResultText) {
      if (maxPlayable < minPlayable) {
        setPlayStatus("Machine bank too low for this slot's max payout coverage. Refill machine bank.", "error");
      } else if (selected.inUseAccountId && selected.inUseAccountId !== state.user.accountId) {
        setPlayStatus("Machine is currently in use by another player.", "error");
      } else {
        setPlayStatus("Ready. Bet and spin using your game locks.", "ok");
      }
    }
  }

  function renderTaxControls() {
    if (!(els.taxControls instanceof HTMLElement)) return;
    const show = Boolean(state.user && state.worldId && isWorldLockOwner());
    els.taxControls.classList.toggle("hidden", !show);
    if (!show) return;
    const tax = state.ownerTax;
    const hasTaxMachine = Boolean(tax && Number.isInteger(tax.tx) && tax.tx >= 0 && Number.isInteger(tax.ty) && tax.ty >= 0);
    if (els.taxPercentInput instanceof HTMLInputElement) {
      if (hasTaxMachine) {
        els.taxPercentInput.disabled = false;
        els.taxPercentInput.value = String(Math.max(0, Math.min(100, Math.floor(Number(tax && tax.percent) || 0))));
      } else {
        els.taxPercentInput.disabled = true;
        els.taxPercentInput.value = "";
      }
    }
    if (els.saveTaxBtn instanceof HTMLButtonElement) {
      els.saveTaxBtn.disabled = !hasTaxMachine;
    }
  }

  function parsePositiveAmount(rawValue) {
    const parsed = Math.floor(Number(rawValue));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed;
  }

  async function adjustWalletLocks(amountDelta) {
    const user = state.user;
    if (!user || !state.worldId) return { ok: false, reason: "not-ready", amount: 0 };
    if (!state.refs.inventoryLocks) return { ok: false, reason: "missing-wallet-ref", amount: 0 };
    const delta = Math.floor(Number(amountDelta) || 0);
    if (!Number.isInteger(delta) || delta === 0) return { ok: false, reason: "invalid-delta", amount: 0 };

    const txn = await state.refs.inventoryLocks.transaction((currentRaw) => {
      const currentObj = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
      const vault = toLockCount(currentObj.web_vault_balance);
      const nextVault = vault + delta;
      if (nextVault < 0) return;
      currentObj.web_vault_balance = nextVault;
      return currentObj;
    });

    if (!txn || !txn.committed) {
      return { ok: false, reason: delta < 0 ? "not-enough-locks" : "wallet-update-rejected", amount: 0 };
    }
    const snap = txn && txn.snapshot ? txn.snapshot : null;
    const nextWallet = getLockWalletFromInventory(snap && typeof snap.val === "function" ? snap.val() : {});
    state.walletLocks = nextWallet.total;
    state.webVaultLocks = nextWallet.vault;
    state.walletBreakdownText = buildWalletBreakdownText(nextWallet.byId);
    return { ok: true, next: nextWallet.vault, amount: Math.abs(delta) };
  }

  async function depositToVaultLocks(amountDelta) {
    const user = state.user;
    if (!user || !state.worldId) return { ok: false, reason: "not-ready", amount: 0 };
    if (!state.refs.inventoryLocks) return { ok: false, reason: "missing-wallet-ref", amount: 0 };
    const delta = Math.floor(Number(amountDelta) || 0);
    if (!Number.isInteger(delta) || delta <= 0) return { ok: false, reason: "invalid-delta", amount: 0 };

    const txn = await state.refs.inventoryLocks.transaction((currentRaw) => {
      const currentObj = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
      const wallet = getLockWalletFromInventory(currentObj);
      if (wallet.total < delta) return;
      const nextTotal = wallet.total - delta;
      const nextById = decomposeLockValue(nextTotal, wallet.vault + delta);
      for (let i = 0; i < LOCK_CURRENCIES.length; i++) {
        const row = LOCK_CURRENCIES[i];
        currentObj[row.id] = toLockCount(nextById[row.id]);
      }
      currentObj.web_vault_balance = nextById.web_vault_balance;
      return currentObj;
    });

    if (!txn || !txn.committed) {
      return { ok: false, reason: "wallet-update-rejected", amount: 0 };
    }
    const snap = txn && txn.snapshot ? txn.snapshot : null;
    const nextWallet = getLockWalletFromInventory(snap && typeof snap.val === "function" ? snap.val() : {});
    state.walletLocks = nextWallet.total;
    state.webVaultLocks = nextWallet.vault;
    state.walletBreakdownText = buildWalletBreakdownText(nextWallet.byId);
    return { ok: true, next: nextWallet.vault, amount: Math.abs(delta) };
  }

  async function withdrawFromVaultLocks(amountDelta) {
    const user = state.user;
    if (!user || !state.worldId) return { ok: false, reason: "not-ready", amount: 0 };
    if (!state.refs.inventoryLocks) return { ok: false, reason: "missing-wallet-ref", amount: 0 };
    const delta = Math.floor(Number(amountDelta) || 0);
    if (!Number.isInteger(delta) || delta <= 0) return { ok: false, reason: "invalid-delta", amount: 0 };

    const txn = await state.refs.inventoryLocks.transaction((currentRaw) => {
      const currentObj = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
      const wallet = getLockWalletFromInventory(currentObj);
      if (wallet.vault < delta) return;
      const nextTotal = wallet.total + delta;
      const nextById = decomposeLockValue(nextTotal, wallet.vault - delta);
      for (let i = 0; i < LOCK_CURRENCIES.length; i++) {
        const row = LOCK_CURRENCIES[i];
        currentObj[row.id] = toLockCount(nextById[row.id]);
      }
      currentObj.web_vault_balance = nextById.web_vault_balance;
      return currentObj;
    });

    if (!txn || !txn.committed) {
      return { ok: false, reason: "wallet-update-rejected", amount: 0 };
    }
    const snap = txn && txn.snapshot ? txn.snapshot : null;
    const nextWallet = getLockWalletFromInventory(snap && typeof snap.val === "function" ? snap.val() : {});
    state.walletLocks = nextWallet.total;
    state.webVaultLocks = nextWallet.vault;
    state.walletBreakdownText = buildWalletBreakdownText(nextWallet.byId);
    return { ok: true, next: nextWallet.vault, amount: Math.abs(delta) };
  }

  function setVaultBusy(isBusy) {
    const busy = Boolean(isBusy);
    if (els.vaultDepositBtn instanceof HTMLButtonElement) els.vaultDepositBtn.disabled = busy;
    if (els.vaultWithdrawBtn instanceof HTMLButtonElement) els.vaultWithdrawBtn.disabled = busy;
    if (els.vaultAmount instanceof HTMLInputElement) els.vaultAmount.disabled = busy;
  }

  function formatVaultErrorReason(reason, direction) {
    const safe = String(reason || "").trim().toLowerCase();
    if (safe === "not-ready") return "login and load a world first";
    if (safe === "missing-wallet-ref") return "wallet reference is unavailable";
    if (safe === "invalid-delta") return "invalid amount";
    if (safe === "wallet-update-rejected") {
      return direction === "deposit"
        ? "not enough game WL or transaction rejected"
        : "not enough vault WL or transaction rejected";
    }
    return safe || "transaction rejected";
  }

  async function runVaultTransfer(direction) {
    if (!(els.vaultAmount instanceof HTMLInputElement)) return;
    const isDeposit = String(direction || "").toLowerCase() === "deposit";
    const amount = parsePositiveAmount(els.vaultAmount.value);
    if (!amount) {
      if (els.vaultStatus instanceof HTMLElement) els.vaultStatus.textContent = "Invalid amount.";
      return;
    }
    if (els.vaultStatus instanceof HTMLElement) {
      els.vaultStatus.textContent = isDeposit ? "Depositing..." : "Withdrawing...";
    }
    setVaultBusy(true);
    let result = null;
    try {
      result = isDeposit
        ? await depositToVaultLocks(amount)
        : await withdrawFromVaultLocks(amount);
    } catch (error) {
      result = { ok: false, reason: (error && error.message) || "request-failed" };
    } finally {
      setVaultBusy(false);
    }

    if (els.vaultStatus instanceof HTMLElement) {
      if (result && result.ok) {
        els.vaultStatus.textContent = isDeposit
          ? ("Success! Deposited " + amount + " WL.")
          : ("Success! Withdrew " + amount + " WL.");
        els.vaultAmount.value = "";
      } else {
        els.vaultStatus.textContent = "Failed to " + (isDeposit ? "deposit" : "withdraw") + ": " + formatVaultErrorReason(result && result.reason, isDeposit ? "deposit" : "withdraw") + ".";
      }
    }
    renderSummary();
    renderPlayPanel();
  }

  function buildPlayResultMessage(machine, result, wager, payout) {
    const typeName = machine && machine.typeName ? machine.typeName : "Slots";
    const summary = String(result && result.summary || "").trim();
    const diff = payout - wager;
    let lead = typeName + ": ";
    if (diff > 0) {
      lead += "Won +" + diff + " WL";
    } else if (diff < 0) {
      lead += "Lost " + Math.abs(diff) + " WL";
    } else {
      lead += "Break-even";
    }
    if (summary) {
      lead += " | " + summary;
    }
    return lead.slice(0, 260);
  }

  async function spinSelectedMachine() {
    if (state.playBusy) return;
    if (!state.user || !state.worldId) {
      setPlayStatus("Login and load a world first.", "error");
      return;
    }
    const playerAccountId = String(state.user.accountId || "").trim();
    const playerUsername = String(state.user.username || "").trim().slice(0, 24);
    if (!playerAccountId) {
      setPlayStatus("Missing account session.", "error");
      return;
    }
    const machine = findMachineByTileKey(state.selectedPlayTileKey);
    if (!machine || !isSlotsMachineType(machine.type)) {
      setPlayStatus("Select a playable slots machine first.", "error");
      return;
    }
    const def = MACHINE_DEFS[machine.type] || MACHINE_DEFS.slots;
    if (machine.inUseAccountId && machine.inUseAccountId !== state.user.accountId) {
      setPlayStatus("Machine is currently in use by another player.", "error");
      return;
    }
    const requested = parsePositiveAmount(els.playBetInput && els.playBetInput.value);
    const maxPlayable = getMachinePlayableBetMax(machine, state.walletLocks);
    if (!requested || requested < def.minBet) {
      setPlayStatus("Bet must be at least " + def.minBet + " WL.", "error");
      return;
    }
    if (requested > maxPlayable) {
      setPlayStatus("Bet exceeds current playable max (" + maxPlayable + " WL).", "error");
      return;
    }
    if (typeof slotsModule.spin !== "function") {
      setPlayStatus("Slots module unavailable.", "error");
      return;
    }

    state.playBusy = true;
    state.playResultText = "";
    startPlayRolling(machine.type);
    setPlayStatus("Spinning " + machine.typeName + " for " + requested + " WL...", "");
    renderPlayPanel();

    const walletDebit = await adjustWalletLocks(-requested);
    if (!walletDebit.ok) {
      stopPlayRolling();
      state.playBusy = false;
      state.playResultText = walletDebit.reason === "not-enough-locks" ? "Not enough locks in your inventory." : "Failed to spend locks.";
      setPlayStatus(state.playResultText, "error");
      renderPlayPanel();
      return;
    }

    let applied = false;
    let resolvedResult = null;
    let resolvedWager = requested;
    let resolvedPayout = 0;
    let payoutCreditIssue = false;

    try {
      const db = await ensureDb();
      const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
      const machineRef = db.ref(basePath + "/worlds/" + state.worldId + "/gamble-machines/" + machine.tileKey);
      const txn = await machineRef.transaction((currentRaw) => {
        const current = normalizeMachineRecord(machine.tileKey, currentRaw);
        if (!current || !isSlotsMachineType(current.type)) return currentRaw;
        if (current.inUseAccountId && current.inUseAccountId !== playerAccountId) return currentRaw;

        const liveDef = MACHINE_DEFS[current.type] || MACHINE_DEFS.slots;
        const bankBefore = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
        const byBank = Math.max(0, Math.floor(bankBefore / Math.max(1, Math.floor(Number(liveDef.maxPayoutMultiplier) || 1))));
        const machineCap = Math.max(liveDef.minBet, Math.floor(Number(current.maxBet) || liveDef.maxBet));
        const liveMax = Math.max(0, Math.min(machineCap, byBank));
        if (requested < liveDef.minBet || requested > liveMax) return currentRaw;

        const rawResult = slotsModule.spin(current.type, requested, {}) || {};
        const wager = Math.max(liveDef.minBet, Math.floor(Number(rawResult.bet) || requested));
        const payout = Math.max(0, Math.floor(Number(rawResult.payoutWanted) || 0));
        if (wager !== requested) return currentRaw;
        if ((bankBefore + wager - payout) < 0) return currentRaw;

        const stats = normalizeMachineStats(currentRaw && currentRaw.stats);
        const reelsArray = Array.isArray(rawResult.reels) ? rawResult.reels : [];
        const lineWinsArray = Array.isArray(rawResult.lineWins)
          ? rawResult.lineWins.map((line) => String(line || "").trim()).filter(Boolean)
          : [];
        const lineIdsArray = Array.isArray(rawResult.lineIds)
          ? rawResult.lineIds.map((id) => Math.max(1, Math.floor(Number(id) || 0))).filter((id) => id > 0)
          : [];

        const nextAt = Date.now();
        stats.plays += 1;
        stats.totalBet += wager;
        stats.totalPayout += payout;
        stats.lastPlayerRoll = 0;
        stats.lastHouseRoll = 0;
        stats.lastPlayerReme = 0;
        stats.lastHouseReme = 0;
        stats.lastMultiplier = Math.max(0, Number(rawResult.multiplier) || 0);
        stats.lastOutcome = String(rawResult.outcome || "lose").slice(0, 24);
        stats.lastSlotsText = reelsArray.join("|").slice(0, 220);
        stats.lastSlotsSummary = String(rawResult.summary || "").slice(0, 220);
        stats.lastSlotsLines = lineWinsArray.join(" | ").slice(0, 220);
        stats.lastSlotsLineIds = lineIdsArray.join(",").slice(0, 120);
        stats.lastPlayerName = playerUsername;
        stats.lastAt = nextAt;

        applied = true;
        resolvedResult = {
          gameId: String(rawResult.gameId || current.type || "slots").slice(0, 24),
          summary: stats.lastSlotsSummary,
          outcome: stats.lastOutcome,
          multiplier: stats.lastMultiplier,
          lineWins: lineWinsArray.slice(0, 18),
          lineIds: lineIdsArray.slice(0, 12),
          reels: reelsArray.slice(0, 6)
        };
        resolvedWager = wager;
        resolvedPayout = payout;

        return {
          ...currentRaw,
          earningsLocks: Math.max(0, bankBefore + wager - payout),
          updatedAt: nextAt,
          stats
        };
      });

      if (!txn || !txn.committed || !applied || !resolvedResult) {
        await adjustWalletLocks(requested);
        stopPlayRolling();
        state.playBusy = false;
        state.playResultText = "Spin was rejected (bank changed, machine busy, or limits changed).";
        setPlayStatus(state.playResultText, "error");
        renderPlayPanel();
        return;
      }

      if (resolvedPayout > 0) {
        let creditOk = false;
        for (let i = 0; i < 3; i++) {
          const credit = await adjustWalletLocks(resolvedPayout);
          if (credit && credit.ok) {
            creditOk = true;
            break;
          }
        }
        if (!creditOk) {
          payoutCreditIssue = true;
        }
      }

      stopPlayRolling();
      state.playBusy = false;
      state.selectedSpectateTileKey = machine.tileKey;
      state.playBoardHtml = buildSlotsBoardFromRows(
        buildRowsFromSpinResult(resolvedResult, machine.type),
        resolvedResult.lineWins,
        resolvedResult.lineIds
      );
      state.playResultText = buildPlayResultMessage(machine, resolvedResult, resolvedWager, resolvedPayout);
      if (payoutCreditIssue) {
        state.playResultText += " | payout credit pending retry";
      }
      setPlayStatus(
        state.playResultText,
        payoutCreditIssue ? "error" : (resolvedPayout > resolvedWager ? "ok" : "")
      );
      makeStatus("Website spin: " + state.playResultText, payoutCreditIssue ? "error" : (resolvedPayout > resolvedWager ? "ok" : ""));
      renderAll();
    } catch (error) {
      await adjustWalletLocks(requested);
      stopPlayRolling();
      state.playBusy = false;
      state.playResultText = (error && error.message) || "Failed to spin machine.";
      setPlayStatus(state.playResultText, "error");
      renderPlayPanel();
    }
  }

  async function refillMachineBank(tileKey, amountRaw) {
    const machine = findMachineByTileKey(tileKey);
    if (!machine || !state.user || !state.worldId) return;
    if (!canCollectMachine(machine)) {
      makeStatus("Only machine owner can refill the machine.", "error");
      return;
    }
    const amount = parsePositiveAmount(amountRaw);
    if (!amount) {
      makeStatus("Invalid refill amount.", "error");
      return;
    }

    try {
      const walletTxn = await adjustWalletLocks(-amount);
      if (!walletTxn.ok) {
        makeStatus(walletTxn.reason === "not-enough-locks" ? "Not enough World Locks in your inventory." : "Failed to spend World Locks.", "error");
        return;
      }

      const db = await ensureDb();
      const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
      const machineRef = db.ref(basePath + "/worlds/" + state.worldId + "/gamble-machines/" + machine.tileKey);
      const myAccountId = state.user.accountId;

      const txn = await machineRef.transaction((currentRaw) => {
        const current = normalizeMachineRecord(machine.tileKey, currentRaw);
        if (!current) return currentRaw;
        if (!current.ownerAccountId || current.ownerAccountId !== myAccountId) return currentRaw;
        return {
          ...currentRaw,
          earningsLocks: Math.max(0, Math.floor(Number(current.earningsLocks) || 0)) + amount,
          updatedAt: Date.now()
        };
      });

      if (!txn || !txn.committed) {
        await adjustWalletLocks(amount);
        makeStatus("Refill rejected. Your WL were refunded.", "error");
        return;
      }

      makeStatus("Refilled machine with " + amount + " WL.", "ok");
    } catch (error) {
      await adjustWalletLocks(amount);
      makeStatus((error && error.message) || "Failed to refill machine.", "error");
    }
  }

  async function withdrawMachineBank(tileKey, amountRaw, emptyAll) {
    const machine = findMachineByTileKey(tileKey);
    if (!machine || !state.user || !state.worldId) return;
    if (!canCollectMachine(machine)) {
      makeStatus("Only machine owner can withdraw from the machine.", "error");
      return;
    }
    const requestedAmount = emptyAll
      ? Math.max(0, Math.floor(Number(machine.earningsLocks) || 0))
      : parsePositiveAmount(amountRaw);
    if (!requestedAmount) {
      makeStatus(emptyAll ? "Machine bank is already empty." : "Invalid withdraw amount.", "error");
      return;
    }

    try {
      const db = await ensureDb();
      const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
      const machineRef = db.ref(basePath + "/worlds/" + state.worldId + "/gamble-machines/" + machine.tileKey);
      const myAccountId = state.user.accountId;
      let withdrawn = 0;

      const txn = await machineRef.transaction((currentRaw) => {
        const current = normalizeMachineRecord(machine.tileKey, currentRaw);
        if (!current) return currentRaw;
        if (!current.ownerAccountId || current.ownerAccountId !== myAccountId) return currentRaw;
        const bank = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
        if (bank <= 0) return currentRaw;
        const amount = emptyAll ? bank : Math.min(bank, requestedAmount);
        withdrawn = amount;
        return {
          ...currentRaw,
          earningsLocks: Math.max(0, bank - amount),
          updatedAt: Date.now()
        };
      });

      if (!txn || !txn.committed || withdrawn <= 0) {
        makeStatus("Withdraw rejected.", "error");
        return;
      }

      const walletTxn = await adjustWalletLocks(withdrawn);
      if (!walletTxn.ok) {
        await machineRef.transaction((currentRaw) => {
          const current = normalizeMachineRecord(machine.tileKey, currentRaw);
          if (!current) return currentRaw;
          if (!current.ownerAccountId || current.ownerAccountId !== myAccountId) return currentRaw;
          return {
            ...currentRaw,
            earningsLocks: Math.max(0, Math.floor(Number(current.earningsLocks) || 0)) + withdrawn,
            updatedAt: Date.now()
          };
        });
        makeStatus("Failed to move withdrawn WL to your inventory. Machine bank restored.", "error");
        return;
      }

      makeStatus((emptyAll ? "Emptied machine bank: " : "Withdrew ") + withdrawn + " WL.", "ok");
    } catch (error) {
      makeStatus((error && error.message) || "Failed to withdraw from machine.", "error");
    }
  }

  async function saveTaxPercent() {
    if (!state.user || !state.worldId) return;
    if (!isWorldLockOwner()) {
      makeStatus("Only world owner can modify tax amount.", "error");
      return;
    }
    const tax = state.ownerTax;
    if (!tax || !Number.isInteger(tax.tx) || tax.tx < 0 || !Number.isInteger(tax.ty) || tax.ty < 0) {
      makeStatus("Owner tax machine not found in this world.", "error");
      return;
    }
    if (!(els.taxPercentInput instanceof HTMLInputElement)) return;
    const nextPercent = Math.max(0, Math.min(100, Math.floor(Number(els.taxPercentInput.value) || 0)));

    try {
      const db = await ensureDb();
      const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
      const taxRef = db.ref(basePath + "/worlds/" + state.worldId + "/owner-tax");
      await taxRef.set({
        tx: tax.tx,
        ty: tax.ty,
        taxPercent: nextPercent,
        ownerAccountId: String(state.worldLock && state.worldLock.ownerAccountId || state.user.accountId || "").trim(),
        ownerName: String(state.worldLock && state.worldLock.ownerName || state.user.username || "").trim().slice(0, 20),
        earningsLocks: Math.max(0, Math.floor(Number(tax.earningsLocks) || 0)),
        updatedAt: Date.now()
      });
      makeStatus("Updated world owner tax to " + nextPercent + "%.", "ok");
    } catch (error) {
      makeStatus((error && error.message) || "Failed to save tax amount.", "error");
    }
  }

  function normalizeAdminRole(rawRole) {
    const allowed = ["none", "moderator", "admin", "manager", "owner"];
    if (rawRole === undefined || rawRole === null) return "none";
    if (typeof rawRole === "string") {
      const safe = rawRole.trim().toLowerCase();
      return allowed.includes(safe) ? safe : "none";
    }
    if (typeof rawRole === "object") {
      const row = rawRole || {};
      const candidate = row.role !== undefined
        ? row.role
        : (row.value !== undefined ? row.value : row.name);
      return normalizeAdminRole(candidate);
    }
    return "none";
  }

  async function resolveUserRole(accountId, username) {
    const db = await ensureDb();
    const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
    try {
      const roleSnap = await db.ref(basePath + "/admin-roles/" + accountId).once("value");
      const role = normalizeAdminRole(roleSnap.val());
      if (role !== "none") return role;
    } catch (_error) {
      // ignore
    }

    const byName = window.GT_SETTINGS && window.GT_SETTINGS.ADMIN_ROLE_BY_USERNAME;
    const fromName = byName && typeof byName === "object"
      ? normalizeAdminRole(byName[username])
      : "none";
    return fromName;
  }

  async function loginWithPassword(createMode, options) {
    const opts = options && typeof options === "object" ? options : {};
    const requireActiveSession = Boolean(opts.requireActiveSession);
    const silentFailure = Boolean(opts.silentFailure);
    if (!(els.authUsername instanceof HTMLInputElement) || !(els.authPassword instanceof HTMLInputElement)) return;

    const username = normalizeUsername(els.authUsername.value || "");
    const password = String(els.authPassword.value || "");

    if (typeof authModule.validateCredentials === "function") {
      const validation = authModule.validateCredentials(username, password);
      if (validation) {
        makeStatus(validation, "error");
        return;
      }
    }

    setAuthBusy(true);
    makeStatus(createMode ? "Creating account..." : "Logging in...");
    try {
      const db = await ensureDb();
      const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
      const firebaseRef = window.firebase;

      let accountId = "";
      const usernameRef = db.ref(basePath + "/usernames/" + username);

      if (createMode) {
        accountId = "acc_" + Math.random().toString(36).slice(2, 12);
        const reserve = await usernameRef.transaction((current) => {
          if (current) return;
          return accountId;
        });
        if (!reserve || !reserve.committed) {
          throw new Error("Username already exists.");
        }
        if (typeof authModule.sha256Hex !== "function") {
          throw new Error("Auth module missing hash function.");
        }
        const passwordHash = await authModule.sha256Hex(password);
        await db.ref(basePath + "/accounts/" + accountId).set({
          username,
          passwordHash,
          createdAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        });
      } else {
        const usernameSnap = await usernameRef.once("value");
        accountId = String(usernameSnap.val() || "").trim();
        if (!accountId) throw new Error("Account not found.");
      }

      const accountSnap = await db.ref(basePath + "/accounts/" + accountId).once("value");
      const account = accountSnap.val() || {};

      if (typeof authModule.sha256Hex !== "function") {
        throw new Error("Auth module missing hash function.");
      }
      const passwordHash = await authModule.sha256Hex(password);
      if (String(account.passwordHash || "") !== passwordHash) {
        throw new Error("Invalid password.");
      }

      if (requireActiveSession) {
        const sessionSnap = await db.ref(basePath + "/account-sessions/" + accountId).once("value");
        const session = sessionSnap && sessionSnap.val ? (sessionSnap.val() || {}) : {};
        const sessionId = String(session.sessionId || "").trim();
        const sessionUsername = normalizeUsername(session.username || "");
        if (!sessionId || (sessionUsername && sessionUsername !== username)) {
          throw new Error("Session expired.");
        }
      }

      const role = await resolveUserRole(accountId, username);
      state.user = {
        accountId,
        username,
        role
      };

      saveCredentials(username, password);
      updateSessionUi();
      makeStatus("Logged in as @" + username + ".", "ok");

      const lastWorld = loadLastWorld();
      if (lastWorld && els.worldInput instanceof HTMLInputElement) {
        els.worldInput.value = lastWorld;
      }
    } catch (error) {
      if (!silentFailure) {
        makeStatus((error && error.message) || "Login failed.", "error");
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function attemptSavedSessionResume() {
    if (!(els.authUsername instanceof HTMLInputElement) || !(els.authPassword instanceof HTMLInputElement)) return false;
    const saved = loadSavedCredentials();
    const savedUsername = normalizeUsername(saved && saved.username || "");
    const savedPassword = String(saved && saved.password || "");
    if (!savedUsername || !savedPassword) return false;
    els.authUsername.value = savedUsername.slice(0, 20);
    els.authPassword.value = savedPassword.slice(0, 64);
    makeStatus("Restoring session...", false);
    await loginWithPassword(false, { requireActiveSession: true, silentFailure: true });
    if (!state.user) {
      // Fallback: allow saved-credential auto-login even if global account-session no longer exists.
      await loginWithPassword(false, { requireActiveSession: false, silentFailure: true });
    }
    if (!state.user) {
      makeStatus("Session expired. Please login.", false);
      return false;
    }
    makeStatus("Session restored as @" + state.user.username + ".", "ok");
    const lastWorld = loadLastWorld();
    if (lastWorld) {
      await attachWorld(lastWorld);
    }
    return true;
  }

  function logout() {
    detachWorldListeners();
    state.user = null;
    state.worldId = "";
    state.machineSearch = "";
    if (els.machineSearch instanceof HTMLInputElement) els.machineSearch.value = "";
    updateSessionUi();
    renderAll();
    makeStatus("Logged out.");
  }

  async function attachWorld(worldId) {
    const user = state.user;
    if (!user) {
      makeStatus("Login first.", "error");
      return;
    }

    const safeWorldId = normalizeWorldId(worldId);
    if (!safeWorldId) {
      makeStatus("Invalid world id.", "error");
      return;
    }

    setWorldBusy(true);
    makeStatus("Loading world " + safeWorldId + "...");

    try {
      const db = await ensureDb();
      const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");

      detachWorldListeners();
      state.worldId = safeWorldId;
      saveLastWorld(safeWorldId);

      const root = db.ref(basePath + "/worlds/" + safeWorldId);
      state.refs.lock = root.child("lock");
      state.refs.machines = root.child("gamble-machines");
      state.refs.ownerTax = root.child("owner-tax");
      state.refs.inventoryLocks = db.ref(basePath + "/player-inventories/" + state.user.accountId);

      state.handlers.lock = (snapshot) => {
        state.worldLock = normalizeLockRecord(snapshot.val());
        renderAll();
      };
      state.handlers.machines = (snapshot) => {
        const value = snapshot.val();
        const rows = [];
        if (value && typeof value === "object") {
          Object.keys(value).forEach((tileKey) => {
            const row = normalizeMachineRecord(tileKey, value[tileKey]);
            if (row) rows.push(row);
          });
        }
        state.machines = rows;
        if (state.selectedSpectateTileKey && !rows.some((row) => row.tileKey === state.selectedSpectateTileKey)) {
          state.selectedSpectateTileKey = "";
        }
        renderAll();
      };
      state.handlers.ownerTax = (snapshot) => {
        state.ownerTax = normalizeOwnerTax(snapshot.val());
        renderAll();
      };
      state.handlers.inventoryLocks = (snapshot) => {
        const wallet = getLockWalletFromInventory(snapshot && snapshot.val ? snapshot.val() : {});
        state.walletLocks = wallet.total;
        state.webVaultLocks = wallet.vault;
        state.walletBreakdownText = buildWalletBreakdownText(wallet.byId);
        renderSummary();
        renderPlayPanel();
      };

      state.refs.lock.on("value", state.handlers.lock);
      state.refs.machines.on("value", state.handlers.machines);
      state.refs.ownerTax.on("value", state.handlers.ownerTax);
      state.refs.inventoryLocks.on("value", state.handlers.inventoryLocks);

      makeStatus("Loaded world " + safeWorldId + ".", "ok");
      renderAll();
    } catch (error) {
      makeStatus((error && error.message) || "Failed to load world.", "error");
    } finally {
      setWorldBusy(false);
    }
  }

  async function saveMachineMaxBet(tileKey, inputValue) {
    const machine = findMachineByTileKey(tileKey);
    if (!machine || !state.user || !state.worldId) return;
    if (!canEditMachineMaxBet(machine)) {
      makeStatus("You do not have permission to edit this machine.", "error");
      return;
    }

    const requestedRaw = Math.floor(Number(inputValue));
    const requested = Math.max(machine.minBet, Math.min(machine.hardMaxBet, Number.isFinite(requestedRaw) ? requestedRaw : machine.maxBet));

    try {
      const db = await ensureDb();
      const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
      const machineRef = db.ref(basePath + "/worlds/" + state.worldId + "/gamble-machines/" + machine.tileKey);

      const now = Date.now();
      const lock = state.worldLock;
      const myAccountId = state.user.accountId;

      const txn = await machineRef.transaction((currentRaw) => {
        const current = normalizeMachineRecord(machine.tileKey, currentRaw);
        if (!current) return currentRaw;

        const isLocked = Boolean(lock && lock.ownerAccountId);
        const isOwner = Boolean(lock && lock.ownerAccountId && lock.ownerAccountId === myAccountId);
        const isAdmin = Boolean(lock && lock.admins && lock.admins[myAccountId]);
        const ownsMachine = Boolean(current.ownerAccountId && current.ownerAccountId === myAccountId);

        let canEdit = false;
        if (isLocked) {
          if (isOwner) {
            canEdit = true;
          } else if (ownsMachine && !isAdmin) {
            canEdit = true;
          }
        } else {
          canEdit = ownsMachine;
        }

        if (!canEdit) return currentRaw;

        return {
          ...currentRaw,
          maxBet: requested,
          updatedAt: now
        };
      });

      if (!txn || !txn.committed) {
        makeStatus("Max bet update was rejected.", "error");
        return;
      }

      makeStatus("Updated max bet to " + requested + " WL at tile " + machine.tx + "," + machine.ty + ".", "ok");
    } catch (error) {
      makeStatus((error && error.message) || "Failed to update max bet.", "error");
    }
  }

  function bindEvents() {
    if (els.openVaultBtn instanceof HTMLButtonElement) {
      els.openVaultBtn.addEventListener("click", () => {
        if (!state.user || !(els.vaultModal instanceof HTMLElement)) return;
        if (els.vaultStatus instanceof HTMLElement) els.vaultStatus.textContent = "Ready.";
        if (els.vaultAmount instanceof HTMLInputElement) {
          els.vaultAmount.value = "";
          els.vaultAmount.disabled = false;
        }
        if (els.vaultDepositBtn instanceof HTMLButtonElement) els.vaultDepositBtn.disabled = false;
        if (els.vaultWithdrawBtn instanceof HTMLButtonElement) els.vaultWithdrawBtn.disabled = false;
        els.vaultModal.classList.remove("hidden");
      });
    }

    if (els.closeVaultBtn instanceof HTMLButtonElement) {
      els.closeVaultBtn.addEventListener("click", () => {
        if (els.vaultModal instanceof HTMLElement) els.vaultModal.classList.add("hidden");
      });
    }

    if (els.vaultModal instanceof HTMLElement) {
      els.vaultModal.addEventListener("click", (event) => {
        if (event.target !== els.vaultModal) return;
        els.vaultModal.classList.add("hidden");
      });
    }

    if (els.vaultDepositBtn instanceof HTMLButtonElement) {
      els.vaultDepositBtn.addEventListener("click", () => {
        runVaultTransfer("deposit");
      });
    }

    if (els.vaultWithdrawBtn instanceof HTMLButtonElement) {
      els.vaultWithdrawBtn.addEventListener("click", () => {
        runVaultTransfer("withdraw");
      });
    }

    if (els.vaultAmount instanceof HTMLInputElement) {
      els.vaultAmount.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        runVaultTransfer("deposit");
      });
    }

    if (els.openSlotsSiteBtn instanceof HTMLButtonElement) {
      els.openSlotsSiteBtn.addEventListener("click", () => {
        window.location.href = "casino/index.html";
      });
    }

    if (els.openGameBtn instanceof HTMLButtonElement) {
      els.openGameBtn.addEventListener("click", () => {
        window.location.href = "index.html";
      });
    }

    if (els.logoutBtn instanceof HTMLButtonElement) {
      els.logoutBtn.addEventListener("click", logout);
    }

    if (els.authLoginBtn instanceof HTMLButtonElement) {
      els.authLoginBtn.addEventListener("click", () => {
        loginWithPassword(false);
      });
    }

    if (els.authCreateBtn instanceof HTMLButtonElement) {
      els.authCreateBtn.addEventListener("click", () => {
        loginWithPassword(true);
      });
    }

    if (els.authPassword instanceof HTMLInputElement) {
      els.authPassword.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        loginWithPassword(false);
      });
    }

    if (els.loadWorldBtn instanceof HTMLButtonElement) {
      els.loadWorldBtn.addEventListener("click", () => {
        if (!(els.worldInput instanceof HTMLInputElement)) return;
        attachWorld(els.worldInput.value || "");
      });
    }

    if (els.refreshBtn instanceof HTMLButtonElement) {
      els.refreshBtn.addEventListener("click", () => {
        if (!state.worldId) {
          makeStatus("No world selected.", "error");
          return;
        }
        attachWorld(state.worldId);
      });
    }

    if (els.worldInput instanceof HTMLInputElement) {
      els.worldInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        attachWorld(els.worldInput.value || "");
      });
    }

    if (els.machineSearch instanceof HTMLInputElement) {
      els.machineSearch.addEventListener("input", () => {
        state.machineSearch = String(els.machineSearch.value || "").trim().toLowerCase();
        renderMachines();
      });
    }

    if (els.machineTbody instanceof HTMLElement) {
      els.machineTbody.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const tileKey = String(target.dataset.tileKey || "").trim();
        const act = String(target.dataset.act || "").trim();
        if (!tileKey || !act) return;

        if (act === "spectate-machine") {
          state.selectedSpectateTileKey = tileKey;
          const machine = findMachineByTileKey(tileKey);
          if (machine && isSlotsMachineType(machine.type)) {
            state.selectedPlayTileKey = tileKey;
            state.playBoardHtml = "";
            state.playResultText = "";
          }
          renderAll();
          return;
        }

        if (act === "save-maxbet") {
          const input = els.machineTbody.querySelector('input[data-tile-key="' + tileKey + '"]:not([data-bank-amount])');
          if (!(input instanceof HTMLInputElement)) return;
          saveMachineMaxBet(tileKey, input.value);
          return;
        }

        if (act === "refill-bank" || act === "withdraw-bank") {
          const bankInput = els.machineTbody.querySelector('input[data-tile-key="' + tileKey + '"][data-bank-amount]');
          if (!(bankInput instanceof HTMLInputElement)) return;
          if (act === "refill-bank") {
            refillMachineBank(tileKey, bankInput.value);
          } else {
            withdrawMachineBank(tileKey, bankInput.value, false);
          }
          return;
        }

        if (act === "empty-bank") {
          withdrawMachineBank(tileKey, 0, true);
        }
      });
    }

    if (els.saveTaxBtn instanceof HTMLButtonElement) {
      els.saveTaxBtn.addEventListener("click", () => {
        saveTaxPercent();
      });
    }

    if (els.taxPercentInput instanceof HTMLInputElement) {
      els.taxPercentInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        saveTaxPercent();
      });
    }

    if (els.playMachineSelect instanceof HTMLSelectElement) {
      els.playMachineSelect.addEventListener("change", () => {
        state.selectedPlayTileKey = String(els.playMachineSelect.value || "").trim();
        state.selectedSpectateTileKey = state.selectedPlayTileKey;
        state.playBoardHtml = "";
        state.playResultText = "";
        renderAll();
      });
    }

    if (els.playMaxBtn instanceof HTMLButtonElement) {
      els.playMaxBtn.addEventListener("click", () => {
        const machine = findMachineByTileKey(state.selectedPlayTileKey);
        if (!machine || !(els.playBetInput instanceof HTMLInputElement)) return;
        const maxPlayable = getMachinePlayableBetMax(machine, state.walletLocks);
        if (maxPlayable <= 0) return;
        els.playBetInput.value = String(maxPlayable);
      });
    }

    if (els.playSpinBtn instanceof HTMLButtonElement) {
      els.playSpinBtn.addEventListener("click", () => {
        spinSelectedMachine();
      });
    }

    if (els.playBetInput instanceof HTMLInputElement) {
      els.playBetInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        spinSelectedMachine();
      });
    }

    window.addEventListener("beforeunload", () => {
      stopPlayRolling();
      detachWorldListeners();
    });
  }

  async function init() {
    bindEvents();
    updateSessionUi();
    renderAll();

    const saved = loadSavedCredentials();
    if (els.authUsername instanceof HTMLInputElement && saved.username) {
      els.authUsername.value = String(saved.username || "").slice(0, 20);
    }
    if (els.authPassword instanceof HTMLInputElement && saved.password) {
      els.authPassword.value = String(saved.password || "").slice(0, 64);
    }

    const lastWorld = loadLastWorld();
    if (els.worldInput instanceof HTMLInputElement && lastWorld) {
      els.worldInput.value = lastWorld;
    }
    await attemptSavedSessionResume().catch(() => false);
  }

  init().catch(() => {
    updateSessionUi();
    renderAll();
  });
})();
