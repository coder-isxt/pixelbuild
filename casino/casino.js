
window.GTModules = window.GTModules || {};

(function initCasinoSite() {
  "use strict";

  const SAVED_AUTH_KEY = "growtopia_saved_auth_v1";
  const SESSION_NAV_TRANSFER_KEY = "gt_session_nav_transfer_v1";
  const BASE_PATH = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
  const SLOT_CATALOG_URL = "./slots-config.json";
  const HOUSE_EDGE_MINES = 0.04;
  const TOWER_DIFFICULTY = {
    easy: { traps: 1, stepMult: 1.19 },
    normal: { traps: 2, stepMult: 1.58 },
    hard: { traps: 3, stepMult: 2.38 },
    extreme: { traps: 4, stepMult: 4.75 }
  };
  const GAMES = {
    blackjack: { id: "blackjack", label: "Blackjack", minBet: 1, maxBet: 50000000 },
    plinko: { id: "plinko", label: "Plinko", minBet: 1, maxBet: 50000000 },
    tower: { id: "tower", label: "Tower", minBet: 1, maxBet: 50000000 },
    mines: { id: "mines", label: "Mines", minBet: 1, maxBet: 50000000 }
  };
  const PLINKO_ROWS = 12;
  const PLINKO_MULTIPLIERS = [16, 9, 4, 2, 1.4, 1.1, 0.7, 1.1, 1.4, 2, 4, 9, 16];
  const ADMIN_BALANCE_ROLES = new Set(["admin", "manager", "owner"]);

  const authModule = (window.GTModules && window.GTModules.auth) || {};
  const dbModule = (window.GTModules && window.GTModules.db) || {};
  const authStorageModule = (window.GTModules && window.GTModules.authStorage) || {};

  const state = {
    db: null,
    user: null,
    refs: { inventory: null },
    handlers: { inventory: null },
    walletLocks: 0,
    walletById: {},
    view: "auth",
    activeGame: "blackjack",
    slotCatalog: [],
    bet: 10,
    busy: false,
    lockRows: resolveLockCurrencies(),
    history: [],
    bj: null,
    plinko: null,
    tower: null,
    mines: null
  };

  const els = {
    casinoGrid: document.getElementById("casinoGrid"),
    toGameBtn: document.getElementById("toGameBtn"),
    sessionChip: document.getElementById("sessionChip"),
    walletChip: document.getElementById("walletChip"),
    authUsername: document.getElementById("authUsername"),
    authPassword: document.getElementById("authPassword"),
    authCreateBtn: document.getElementById("authCreateBtn"),
    authLoginBtn: document.getElementById("authLoginBtn"),
    authStatus: document.getElementById("authStatus"),
    authCard: document.getElementById("authCard"),
    dashboardView: document.getElementById("dashboardView"),
    dashboardCards: document.getElementById("dashboardCards"),
    slotCardsMount: document.getElementById("slotCardsMount"),
    slotCategoryCount: document.getElementById("slotCategoryCount"),
    gameView: document.getElementById("gameView"),
    backToDashboardBtn: document.getElementById("backToDashboardBtn"),
    tabBlackjack: document.getElementById("tabBlackjack"),
    tabTower: document.getElementById("tabTower"),
    tabMines: document.getElementById("tabMines"),
    betDownBtn: document.getElementById("betDownBtn"),
    betInput: document.getElementById("betInput"),
    betUpBtn: document.getElementById("betUpBtn"),
    betMaxBtn: document.getElementById("betMaxBtn"),
    towerDifficultyWrap: document.getElementById("towerDifficultyWrap"),
    towerDifficulty: document.getElementById("towerDifficulty"),
    towerCashoutBtn: document.getElementById("towerCashoutBtn"),
    minesConfigWrap: document.getElementById("minesConfigWrap"),
    minesCount: document.getElementById("minesCount"),
    minesCashoutBtn: document.getElementById("minesCashoutBtn"),
    spinBtn: document.getElementById("spinBtn"),
    bjHitBtn: document.getElementById("bjHitBtn"),
    bjStandBtn: document.getElementById("bjStandBtn"),
    bjDoubleBtn: document.getElementById("bjDoubleBtn"),
    bjSplitBtn: document.getElementById("bjSplitBtn"),
    bjDealBtn: document.getElementById("bjDealBtn"),
    adminBalancePanel: document.getElementById("adminBalancePanel"),
    adminBalanceTarget: document.getElementById("adminBalanceTarget"),
    adminBalanceAmount: document.getElementById("adminBalanceAmount"),
    adminBalanceApplyBtn: document.getElementById("adminBalanceApplyBtn"),
    adminBalanceStatus: document.getElementById("adminBalanceStatus"),
    gameStatus: document.getElementById("gameStatus"),
    boardTitle: document.getElementById("boardTitle"),
    board: document.getElementById("board"),
    history: document.getElementById("history")
  };

  function resolveLockCurrencies() {
    const fallback = [
      { id: 43, key: "ruby_lock", value: 1000000, short: "RL" },
      { id: 42, key: "emerald_lock", value: 10000, short: "EL" },
      { id: 24, key: "obsidian_lock", value: 100, short: "OL" },
      { id: 9, key: "world_lock", value: 1, short: "WL" }
    ];
    const catalog = (window.GTModules && window.GTModules.itemCatalog) || {};
    if (typeof catalog.getBlocks !== "function") return fallback;
    const rows = catalog.getBlocks();
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

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  }

  function toCount(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function walletFromInventory(obj) {
    const input = obj && typeof obj === "object" ? obj : {};
    let total = 0;
    const byId = {};
    for (let i = 0; i < state.lockRows.length; i++) {
      const row = state.lockRows[i];
      const count = toCount(input[row.id]);
      byId[row.id] = count;
      total += count * row.value;
    }
    return { total, byId };
  }

  function decomposeLocks(total) {
    let remaining = toCount(total);
    const out = {};
    for (let i = 0; i < state.lockRows.length; i++) {
      const row = state.lockRows[i];
      const count = Math.floor(remaining / row.value);
      out[row.id] = Math.max(0, count);
      remaining -= count * row.value;
    }
    return out;
  }

  function formatLocks(value) {
    return toCount(value).toLocaleString("en-US") + " WL";
  }

  function formatLockBreakdown(value) {
    let remaining = toCount(value);
    const parts = [];
    for (let i = 0; i < state.lockRows.length; i++) {
      const row = state.lockRows[i];
      const count = Math.floor(remaining / row.value);
      if (count > 0) {
        parts.push(count.toLocaleString("en-US") + " " + row.short);
        remaining -= count * row.value;
      }
    }
    if (!parts.length) return "0 WL";
    return parts.join(" ");
  }

  function wait(ms) {
    const delay = Math.max(0, Math.floor(Number(ms) || 0));
    return new Promise((resolve) => {
      window.setTimeout(resolve, delay);
    });
  }

  function plinkoPegPosition(row, col) {
    const safeRow = Math.max(0, Math.min(PLINKO_ROWS - 1, Math.floor(Number(row) || 0)));
    const safeCol = Math.max(0, Math.min(safeRow, Math.floor(Number(col) || 0)));
    const spanUnits = safeCol - (safeRow / 2);
    const maxSpan = PLINKO_ROWS / 2;
    const x = 50 + ((spanUnits / maxSpan) * 42);
    const y = 10 + ((safeRow / Math.max(1, PLINKO_ROWS - 1)) * 64);
    return { x, y };
  }

  function plinkoBinPosition(binIndex) {
    const safeBin = Math.max(0, Math.min(PLINKO_ROWS, Math.floor(Number(binIndex) || 0)));
    const maxSpan = PLINKO_ROWS / 2;
    const spanUnits = safeBin - maxSpan;
    const x = 50 + ((spanUnits / maxSpan) * 42);
    return { x, y: 90 };
  }

  function plinkoStartPosition() {
    return { x: 50, y: 4 };
  }

  function paintPlinkoFrame() {
    if (!(els.board instanceof HTMLElement)) return;
    const root = els.board.querySelector(".plinko-shell");
    if (!(root instanceof HTMLElement)) return;

    const liveLine = els.board.querySelector("[data-plinko-live]");
    const ball = root.querySelector(".plinko-ball");
    const pegNodes = root.querySelectorAll("[data-plinko-peg]");
    const binNodes = root.querySelectorAll("[data-plinko-bin]");

    const live = state.plinko && state.plinko.liveDrop ? state.plinko.liveDrop : null;
    const last = state.plinko && state.plinko.lastDrop ? state.plinko.lastDrop : null;
    const source = live || last;
    const path = source && Array.isArray(source.pathCols) ? source.pathCols : [];

    let revealRowMax = -1;
    let currentRow = -1;
    if (live) {
      currentRow = Math.floor(Number(live.currentRow) || -1);
      if (currentRow >= PLINKO_ROWS) revealRowMax = PLINKO_ROWS - 1;
      else revealRowMax = Math.max(-1, currentRow);
    } else if (last) {
      revealRowMax = PLINKO_ROWS - 1;
    }

    for (let i = 0; i < pegNodes.length; i++) {
      const peg = pegNodes[i];
      const row = Math.max(0, Math.floor(Number(peg.getAttribute("data-row")) || 0));
      const col = Math.max(0, Math.floor(Number(peg.getAttribute("data-col")) || 0));
      const onPath = row < path.length && path[row] === col;
      const isTrail = onPath && row <= revealRowMax;
      const isCurrent = Boolean(live) && onPath && row === currentRow && currentRow < PLINKO_ROWS;
      peg.classList.toggle("trail", isTrail);
      peg.classList.toggle("current", isCurrent);
    }

    let winIndex = -1;
    if (live && currentRow >= PLINKO_ROWS) {
      winIndex = Math.max(0, Math.min(PLINKO_ROWS, Math.floor(Number(live.currentCol) || 0)));
    } else if (!live && last) {
      winIndex = Math.max(0, Math.min(PLINKO_ROWS, Math.floor(Number(last.binIndex) || 0)));
    }
    for (let i = 0; i < binNodes.length; i++) {
      const bin = binNodes[i];
      const idx = Math.max(0, Math.floor(Number(bin.getAttribute("data-plinko-bin")) || 0));
      bin.classList.toggle("win", idx === winIndex);
    }

    if (ball instanceof HTMLElement) {
      let pos = plinkoStartPosition();
      let visible = false;
      if (live) {
        visible = true;
        if (currentRow >= PLINKO_ROWS) pos = plinkoBinPosition(live.currentCol);
        else if (currentRow >= 0 && currentRow < PLINKO_ROWS) pos = plinkoPegPosition(currentRow, path[currentRow]);
      } else if (last) {
        visible = true;
        pos = plinkoBinPosition(last.binIndex);
      }
      ball.classList.toggle("hidden-ball", !visible);
      ball.style.left = pos.x.toFixed(3) + "%";
      ball.style.top = pos.y.toFixed(3) + "%";
    }

    if (liveLine instanceof HTMLElement) {
      if (live) {
        if (currentRow < 0) {
          liveLine.textContent = "Ball drop started...";
        } else if (currentRow < PLINKO_ROWS) {
          liveLine.textContent = "Ball row " + (currentRow + 1) + " / " + PLINKO_ROWS + " | target x" + Number(live.multiplier || 1).toFixed(2);
        } else {
          liveLine.textContent = "Ball landed on x" + Number(live.multiplier || 1).toFixed(2) + ".";
        }
      } else if (last) {
        liveLine.textContent = "Last drop paid " + formatLocks(last.payout) + " at x" + Number(last.multiplier || 0).toFixed(2) + ".";
      } else {
        liveLine.textContent = "Drop a ball to start Plinko.";
      }
    }
  }

  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = out[i];
      out[i] = out[j];
      out[j] = temp;
    }
    return out;
  }

  function pushHistory(message) {
    const text = String(message || "").trim();
    if (!text) return;
    const stamp = new Date();
    const hh = String(stamp.getHours()).padStart(2, "0");
    const mm = String(stamp.getMinutes()).padStart(2, "0");
    state.history.unshift({ text, time: hh + ":" + mm });
    if (state.history.length > 20) state.history.length = 20;
    renderHistory();
  }

  function setStatus(message, mode) {
    if (!(els.gameStatus instanceof HTMLElement)) return;
    els.gameStatus.className = "status";
    if (mode === "ok") els.gameStatus.classList.add("ok");
    if (mode === "error") els.gameStatus.classList.add("error");
    els.gameStatus.textContent = String(message || "");
  }

  function setAuthStatus(message, mode) {
    if (!(els.authStatus instanceof HTMLElement)) return;
    els.authStatus.className = "status";
    if (mode === "ok") els.authStatus.classList.add("ok");
    if (mode === "error") els.authStatus.classList.add("error");
    els.authStatus.textContent = String(message || "");
  }

  function setAuthBusy(isBusy) {
    const busy = Boolean(isBusy);
    if (els.authCreateBtn instanceof HTMLButtonElement) els.authCreateBtn.disabled = busy;
    if (els.authLoginBtn instanceof HTMLButtonElement) els.authLoginBtn.disabled = busy;
    if (els.authUsername instanceof HTMLInputElement) els.authUsername.disabled = busy;
    if (els.authPassword instanceof HTMLInputElement) els.authPassword.disabled = busy;
  }

  function setBusy(isBusy) {
    state.busy = Boolean(isBusy);
    const disabled = state.busy || !state.user;
    if (els.spinBtn instanceof HTMLButtonElement) els.spinBtn.disabled = disabled;
    if (els.betInput instanceof HTMLInputElement) els.betInput.disabled = disabled;
    if (els.betDownBtn instanceof HTMLButtonElement) els.betDownBtn.disabled = disabled;
    if (els.betUpBtn instanceof HTMLButtonElement) els.betUpBtn.disabled = disabled;
    if (els.betMaxBtn instanceof HTMLButtonElement) els.betMaxBtn.disabled = disabled;
  }

  function setView(mode) {
    const next = (mode === "dashboard" || mode === "game" || mode === "auth") ? mode : "auth";
    state.view = next;
    if (els.authCard instanceof HTMLElement) els.authCard.classList.toggle("hidden", next !== "auth");
    if (els.dashboardView instanceof HTMLElement) els.dashboardView.classList.toggle("hidden", next !== "dashboard");
    if (els.gameView instanceof HTMLElement) els.gameView.classList.toggle("hidden", next !== "game");
    if (els.casinoGrid instanceof HTMLElement) {
      els.casinoGrid.classList.toggle("layout-auth", next === "auth");
      els.casinoGrid.classList.toggle("layout-app", next !== "auth");
    }
  }

  function clampBetByGame(raw) {
    const game = GAMES[state.activeGame] || GAMES.blackjack;
    const n = toCount(raw);
    return Math.max(game.minBet, Math.min(game.maxBet, n || game.minBet));
  }

  function setBet(raw) {
    state.bet = clampBetByGame(raw);
    if (els.betInput instanceof HTMLInputElement) els.betInput.value = String(state.bet);
  }

  function refreshSessionChips() {
    if (els.sessionChip instanceof HTMLElement) {
      if (!state.user) els.sessionChip.textContent = "Session: Guest";
      else els.sessionChip.textContent = "Session: @" + state.user.username + " (" + state.user.role + ")";
    }
    if (els.walletChip instanceof HTMLElement) {
      els.walletChip.textContent = "Wallet: " + formatLockBreakdown(state.walletLocks);
      els.walletChip.title = "Total: " + formatLocks(state.walletLocks);
    }
    refreshAdminBalancePanel();
  }

  function canUseAdminBalancePower() {
    if (!state.user) return false;
    const role = String(state.user.role || "").trim().toLowerCase();
    return ADMIN_BALANCE_ROLES.has(role);
  }

  function setAdminBalanceStatus(message, mode) {
    if (!(els.adminBalanceStatus instanceof HTMLElement)) return;
    els.adminBalanceStatus.className = "status";
    if (mode === "ok") els.adminBalanceStatus.classList.add("ok");
    if (mode === "error") els.adminBalanceStatus.classList.add("error");
    els.adminBalanceStatus.textContent = String(message || "");
  }

  function refreshAdminBalancePanel() {
    if (!(els.adminBalancePanel instanceof HTMLElement)) return;
    const allowed = canUseAdminBalancePower();
    els.adminBalancePanel.classList.toggle("hidden", !allowed);
    if (!(els.adminBalanceApplyBtn instanceof HTMLButtonElement)) return;
    els.adminBalanceApplyBtn.disabled = !allowed;
    if (!allowed) {
      setAdminBalanceStatus("Admin permission required.", "error");
      return;
    }
    if (els.adminBalanceTarget instanceof HTMLInputElement && !els.adminBalanceTarget.value) {
      els.adminBalanceTarget.value = String(state.user && state.user.username || "");
    }
    setAdminBalanceStatus("Ready. Leave target blank to credit yourself.");
  }

  function renderHistory() {
    if (!(els.history instanceof HTMLElement)) return;
    if (!state.history.length) {
      els.history.innerHTML = "<div class=\"history-item\">No rounds yet.</div>";
      return;
    }
    let html = "";
    for (let i = 0; i < state.history.length; i++) {
      const row = state.history[i];
      html += "<div class=\"history-item\">[" + escapeHtml(row.time) + "] " + escapeHtml(row.text) + "</div>";
    }
    els.history.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeSlotCatalog(raw) {
    const rows = raw && Array.isArray(raw.slots) ? raw.slots : [];
    const out = [];
    const used = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] && typeof rows[i] === "object" ? rows[i] : null;
      if (!row) continue;
      const key = String(row.key || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (!key || used[key]) continue;
      used[key] = true;
      const rawUrl = String(row.url || "").trim();
      let safeUrl = "";
      if (rawUrl && /^(\.\/|\.\.\/)[a-z0-9_./-]+\.html(?:\?[a-z0-9_=&%-]+)?$/i.test(rawUrl)) {
        safeUrl = rawUrl;
      }
      out.push({
        key,
        name: String(row.name || "Slot Game").trim() || "Slot Game",
        tag: String(row.tag || "Slots").trim() || "Slots",
        subtitle: String(row.subtitle || "Config-based tumble slot").trim() || "Config-based tumble slot",
        url: safeUrl
      });
    }
    return out;
  }

  async function loadSlotCatalog() {
    try {
      const response = await fetch(SLOT_CATALOG_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("slot catalog fetch failed");
      const raw = await response.json();
      state.slotCatalog = normalizeSlotCatalog(raw);
    } catch (_error) {
      state.slotCatalog = [];
    }
  }

  function renderSlotCards() {
    if (!(els.slotCardsMount instanceof HTMLElement)) return;
    const slots = Array.isArray(state.slotCatalog) ? state.slotCatalog : [];
    if (!slots.length) {
      els.slotCardsMount.innerHTML =
        "<button type=\"button\" class=\"game-card\" data-slot-key=\"mergeup_ducks\">" +
        "<span class=\"game-card-tag\">Slots</span>" +
        "<strong>Cluster Rush 1000</strong>" +
        "<small>7x7 cluster tumbles with sticky multipliers and free spins</small>" +
        "</button>";
      if (els.slotCategoryCount instanceof HTMLElement) els.slotCategoryCount.textContent = "1";
      return;
    }
    let html = "";
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const urlAttr = slot.url ? (" data-slot-url=\"" + escapeHtml(slot.url) + "\"") : "";
      html += "<button type=\"button\" class=\"game-card\" data-slot-key=\"" + escapeHtml(slot.key) + "\"" + urlAttr + ">" +
        "<span class=\"game-card-tag\">" + escapeHtml(slot.tag) + "</span>" +
        "<strong>" + escapeHtml(slot.name) + "</strong>" +
        "<small>" + escapeHtml(slot.subtitle) + "</small>" +
      "</button>";
    }
    els.slotCardsMount.innerHTML = html;
    if (els.slotCategoryCount instanceof HTMLElement) els.slotCategoryCount.textContent = String(slots.length);
  }

  function storeSlotSessionTransfer() {
    try {
      if (!state.user || !state.user.accountId) return;
      sessionStorage.setItem("gt_casino_slot_transfer_v1", JSON.stringify({
        accountId: String(state.user.accountId || "").trim(),
        username: String(state.user.username || "").trim().toLowerCase(),
        role: String(state.user.role || "none").trim().toLowerCase(),
        issuedAt: Date.now()
      }));
    } catch (_error) {
      // ignore session transfer storage errors
    }
  }

  function openSlotGame(slotKey, slotUrl) {
    const key = String(slotKey || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const url = String(slotUrl || "").trim();
    storeSlotSessionTransfer();
    if (url && /^(\.\/|\.\.\/)[a-z0-9_./-]+\.html(?:\?[a-z0-9_=&%-]+)?$/i.test(url)) {
      window.location.href = url;
      return;
    }
    window.location.href = "./mergeup-slot.html?slot=" + encodeURIComponent(key || "mergeup_ducks");
  }

  function setGame(gameId) {
    state.activeGame = (gameId === "tower" || gameId === "mines" || gameId === "plinko") ? gameId : "blackjack";
    if (els.tabBlackjack instanceof HTMLElement) els.tabBlackjack.classList.toggle("active", state.activeGame === "blackjack");
    if (els.tabTower instanceof HTMLElement) els.tabTower.classList.toggle("active", state.activeGame === "tower");
    if (els.tabMines instanceof HTMLElement) els.tabMines.classList.toggle("active", state.activeGame === "mines");
    if (els.dashboardCards instanceof HTMLElement) {
      const cards = els.dashboardCards.querySelectorAll("[data-game-card]");
      for (let i = 0; i < cards.length; i++) {
        const node = cards[i];
        if (String(node.getAttribute("data-slot-key") || "").trim()) {
          node.classList.remove("active");
          continue;
        }
        const id = String(node.getAttribute("data-game-card") || "").trim().toLowerCase();
        node.classList.toggle("active", id === state.activeGame);
      }
    }

    if (els.towerDifficultyWrap instanceof HTMLElement) els.towerDifficultyWrap.style.display = state.activeGame === "tower" ? "grid" : "none";
    if (els.minesConfigWrap instanceof HTMLElement) els.minesConfigWrap.style.display = state.activeGame === "mines" ? "grid" : "none";

    const isBj = state.activeGame === "blackjack";
    if (els.bjDealBtn instanceof HTMLElement) els.bjDealBtn.style.display = isBj ? "" : "none";
    if (els.bjHitBtn instanceof HTMLElement) els.bjHitBtn.style.display = isBj ? "" : "none";
    if (els.bjStandBtn instanceof HTMLElement) els.bjStandBtn.style.display = isBj ? "" : "none";
    if (els.bjDoubleBtn instanceof HTMLElement) els.bjDoubleBtn.style.display = isBj ? "" : "none";
    if (els.bjSplitBtn instanceof HTMLElement) els.bjSplitBtn.style.display = isBj ? "" : "none";
    if (els.spinBtn instanceof HTMLElement) els.spinBtn.style.display = isBj ? "none" : "";

    const label = GAMES[state.activeGame] ? GAMES[state.activeGame].label : "Game";
    if (els.boardTitle instanceof HTMLElement) els.boardTitle.textContent = label;
    if (els.spinBtn instanceof HTMLButtonElement) {
      if (state.activeGame === "tower") els.spinBtn.textContent = state.tower && state.tower.active ? "Run Active" : "Start Tower";
      else if (state.activeGame === "mines") els.spinBtn.textContent = state.mines && state.mines.active ? "Run Active" : "Start Mines";
      else els.spinBtn.textContent = "Drop Ball";
    }

    setBet(state.bet);
    renderBoard();
  }

  function createDeck() {
    const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const suits = ["S", "H", "D", "C"];
    const deck = [];
    for (let s = 0; s < suits.length; s++) {
      for (let v = 0; v < values.length; v++) {
        deck.push(values[v] + suits[s]);
      }
    }
    return shuffle(deck);
  }

  function cardPoints(card) {
    const value = String(card || "").replace(/[SHDC]/g, "");
    if (value === "A") return 11;
    if (value === "K" || value === "Q" || value === "J") return 10;
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function parseCard(card) {
    const raw = String(card || "").trim().toUpperCase();
    const suitCode = raw.slice(-1);
    const rank = raw.slice(0, -1) || raw;
    const suitMap = {
      S: { symbol: "♠", color: "black" },
      H: { symbol: "♥", color: "red" },
      D: { symbol: "♦", color: "red" },
      C: { symbol: "♣", color: "black" }
    };
    const suit = suitMap[suitCode] || { symbol: "?", color: "black" };
    return { rank, symbol: suit.symbol, color: suit.color };
  }

  function buildCardHtml(card, hidden) {
    if (hidden) {
      return "<span class=\"playing-card back\"><span class=\"pc-back-mark\"></span></span>";
    }
    const parsed = parseCard(card);
    return "<span class=\"playing-card " + parsed.color + "\">" +
      "<span class=\"pc-rank\">" + escapeHtml(parsed.rank) + "</span>" +
      "<span class=\"pc-suit\">" + escapeHtml(parsed.symbol) + "</span>" +
      "</span>";
  }

  function handValue(hand) {
    const cards = Array.isArray(hand) ? hand : [];
    let total = 0;
    let aces = 0;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const raw = String(c || "");
      if (raw.indexOf("A") === 0) aces += 1;
      total += cardPoints(raw);
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }

  function createTowerRound(bet, difficultyId) {
    const diff = TOWER_DIFFICULTY[difficultyId] || TOWER_DIFFICULTY.normal;
    const floors = 8;
    const cols = 5;
    const trapsByFloor = [];
    for (let y = 0; y < floors; y++) {
      const indices = shuffle([0, 1, 2, 3, 4]).slice(0, diff.traps).sort((a, b) => a - b);
      trapsByFloor.push(indices);
    }
    return {
      active: true,
      bet,
      floors,
      cols,
      currentFloor: 0,
      difficultyId,
      trapsByFloor,
      picks: {}
    };
  }

  function towerMultiplier(round) {
    if (!round) return 1;
    const diff = TOWER_DIFFICULTY[round.difficultyId] || TOWER_DIFFICULTY.normal;
    return Math.max(1, Math.pow(diff.stepMult, Math.max(0, round.currentFloor)));
  }

  function towerPayout(round) {
    if (!round) return 0;
    return Math.max(0, Math.floor(round.bet * towerMultiplier(round)));
  }

  function createMinesRound(bet, minesCount) {
    const rows = 5;
    const cols = 5;
    const total = rows * cols;
    const mines = Math.max(1, Math.min(total - 1, toCount(minesCount)));
    const pool = [];
    for (let i = 0; i < total; i++) pool.push(i);
    const mineList = shuffle(pool).slice(0, mines);
    const mineSet = {};
    for (let i = 0; i < mineList.length; i++) mineSet[mineList[i]] = true;
    return {
      active: true,
      bet,
      rows,
      cols,
      total,
      mines,
      mineSet,
      picked: {}
    };
  }

  function minesSafeClicks(round) {
    if (!round || !round.picked) return 0;
    let count = 0;
    for (const k in round.picked) if (Object.prototype.hasOwnProperty.call(round.picked, k) && round.picked[k]) count += 1;
    return count;
  }

  function minesMultiplier(round, safeClicks) {
    if (!round) return 1;
    const safeTotal = round.total - round.mines;
    let mult = 1;
    for (let i = 0; i < safeClicks; i++) {
      const remainTotal = round.total - i;
      const remainSafe = safeTotal - i;
      if (remainSafe <= 0) break;
      mult *= (remainTotal / remainSafe) * (1 - HOUSE_EDGE_MINES);
    }
    return Math.max(1, mult);
  }

  function minesPayout(round) {
    if (!round) return 0;
    const safe = minesSafeClicks(round);
    return Math.max(0, Math.floor(round.bet * minesMultiplier(round, safe)));
  }

  async function applyWalletDelta(deltaLocks) {
    if (!state.refs.inventory) return { ok: false, reason: "wallet-missing" };
    const delta = Math.floor(Number(deltaLocks) || 0);
    if (!delta) return { ok: true, amount: 0 };

    let failReason = "";
    const txn = await state.refs.inventory.transaction((currentRaw) => {
      const currentObj = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
      const wallet = walletFromInventory(currentObj);
      const nextTotal = wallet.total + delta;
      if (nextTotal < 0) {
        failReason = "not-enough-locks";
        return;
      }
      const nextById = decomposeLocks(nextTotal);
      for (let i = 0; i < state.lockRows.length; i++) {
        const row = state.lockRows[i];
        currentObj[row.id] = toCount(nextById[row.id]);
      }
      return currentObj;
    });

    if (!txn || !txn.committed) {
      return { ok: false, reason: failReason || "aborted" };
    }
    return { ok: true, amount: delta };
  }

  async function runAdminBalanceCredit() {
    if (!(els.adminBalanceAmount instanceof HTMLInputElement)) return;
    if (!state.user) {
      setAdminBalanceStatus("Login first.", "error");
      return;
    }
    if (!canUseAdminBalancePower()) {
      setAdminBalanceStatus("Admin permission required.", "error");
      return;
    }

    const amount = Math.max(0, Math.floor(Number(els.adminBalanceAmount.value)));
    if (!amount) {
      setAdminBalanceStatus("Enter a valid amount in WL.", "error");
      return;
    }

    const selfName = normalizeUsername(state.user.username);
    const targetInput = els.adminBalanceTarget instanceof HTMLInputElement
      ? normalizeUsername(els.adminBalanceTarget.value)
      : "";
    const targetName = targetInput || selfName;
    let targetAccountId = "";

    if (!targetName || targetName === selfName) {
      targetAccountId = String(state.user.accountId || "").trim();
    } else {
      const db = await connectDb();
      const userSnap = await db.ref(BASE_PATH + "/usernames/" + targetName).once("value");
      targetAccountId = String(userSnap && userSnap.val ? (userSnap.val() || "") : "").trim();
    }

    if (!targetAccountId) {
      setAdminBalanceStatus("Target user not found.", "error");
      return;
    }

    if (els.adminBalanceApplyBtn instanceof HTMLButtonElement) els.adminBalanceApplyBtn.disabled = true;
    setAdminBalanceStatus("Applying balance credit...");
    try {
      const db = await connectDb();
      const invRef = db.ref(BASE_PATH + "/player-inventories/" + targetAccountId);
      const tx = await invRef.transaction((currentRaw) => {
        const currentObj = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
        const wallet = walletFromInventory(currentObj);
        const nextById = decomposeLocks(wallet.total + amount);
        for (let i = 0; i < state.lockRows.length; i++) {
          const row = state.lockRows[i];
          currentObj[row.id] = toCount(nextById[row.id]);
        }
        return currentObj;
      });
      if (!tx || !tx.committed) {
        setAdminBalanceStatus("Credit rejected by database.", "error");
        return;
      }

      db.ref(BASE_PATH + "/admin-audit").push({
        action: "casino_balance_credit",
        actorAccountId: String(state.user.accountId || "").trim(),
        actorUsername: String(state.user.username || "admin").slice(0, 20),
        targetAccountId: String(targetAccountId || "").trim(),
        targetUsername: String(targetName || "").slice(0, 20),
        amount: amount,
        level: "warn",
        createdAt: Date.now()
      }).catch(() => {});

      if (targetAccountId === String(state.user.accountId || "").trim()) {
        const nextWallet = walletFromInventory(tx.snapshot && typeof tx.snapshot.val === "function" ? tx.snapshot.val() : {});
        state.walletLocks = nextWallet.total;
        state.walletById = nextWallet.byId;
        refreshSessionChips();
      }

      const msg = "Added " + formatLocks(amount) + " to @" + targetName + ".";
      setAdminBalanceStatus(msg, "ok");
      setStatus(msg, "ok");
      pushHistory("Admin credit +" + formatLocks(amount) + " -> @" + targetName);
      els.adminBalanceAmount.value = "";
    } catch (error) {
      setAdminBalanceStatus("Credit failed: " + ((error && error.message) || "unknown error"), "error");
    } finally {
      if (els.adminBalanceApplyBtn instanceof HTMLButtonElement) els.adminBalanceApplyBtn.disabled = false;
    }
  }

  function isBlackjackNatural(cards) {
    return Array.isArray(cards) && cards.length === 2 && handValue(cards) === 21;
  }

  function canSplitHand(hand) {
    if (!hand || !Array.isArray(hand.cards) || hand.cards.length !== 2) return false;
    return cardPoints(hand.cards[0]) === cardPoints(hand.cards[1]);
  }

  async function settleBlackjackRound() {
    const round = state.bj;
    if (!round) return;

    const hasLiveHand = round.hands.some((h) => handValue(h.cards) <= 21);
    if (hasLiveHand) {
      while (handValue(round.dealerHand) < 17) {
        round.dealerHand.push(round.deck.pop());
      }
    }

    const dealerScore = handValue(round.dealerHand);
    let totalPayout = 0;
    let winHands = 0;
    let pushHands = 0;

    for (let i = 0; i < round.hands.length; i++) {
      const hand = round.hands[i];
      const score = handValue(hand.cards);
      if (score > 21) continue;
      if (dealerScore > 21 || score > dealerScore) {
        totalPayout += hand.bet * 2;
        winHands += 1;
      } else if (score === dealerScore) {
        totalPayout += hand.bet;
        pushHands += 1;
      }
    }

    round.active = false;
    let msg = "Dealer wins all hands.";
    let mode = "error";
    if (totalPayout > 0) {
      const credit = await applyWalletDelta(totalPayout);
      if (!credit.ok) {
        setStatus("Failed to credit blackjack payout.", "error");
        pushHistory("Blackjack payout credit failed");
        renderBoard();
        return;
      }
      mode = "ok";
      if (winHands > 0 && pushHands > 0) msg = "Blackjack mixed result +" + formatLocks(totalPayout);
      else if (winHands > 0) msg = "Blackjack won +" + formatLocks(totalPayout);
      else msg = "Blackjack push returned " + formatLocks(totalPayout);
    }

    round.message = msg;
    setStatus(msg, mode);
    pushHistory(msg);
    renderBoard();
  }

  async function moveToNextBlackjackHandOrSettle() {
    const round = state.bj;
    if (!round || !round.active) return;
    while (round.activeHandIndex < round.hands.length && round.hands[round.activeHandIndex].done) {
      round.activeHandIndex += 1;
    }
    if (round.activeHandIndex >= round.hands.length) {
      await settleBlackjackRound();
      return;
    }
    round.message = "Playing hand " + (round.activeHandIndex + 1) + " / " + round.hands.length;
    setStatus(round.message, "ok");
    renderBoard();
  }

  async function startBlackjack() {
    if (state.bj && state.bj.active) {
      setStatus("Blackjack round already active.", "error");
      return;
    }
    const bet = clampBetByGame(state.bet);
    const spend = await applyWalletDelta(-bet);
    if (!spend.ok) {
      setStatus("Not enough locks for blackjack bet.", "error");
      return;
    }

    const deck = createDeck();
    const player = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];
    const natural = isBlackjackNatural(player);
    const dealerNatural = isBlackjackNatural(dealerHand);

    state.bj = {
      active: true,
      bet,
      deck,
      dealerHand,
      hands: [{ cards: player, bet, done: false }],
      activeHandIndex: 0,
      message: "Hit, stand, double, or split."
    };

    if (natural) {
      state.bj.active = false;
      let payout = 0;
      let msg = "";
      if (dealerNatural) {
        payout = bet;
        msg = "Blackjack push. Returned " + formatLocks(bet);
      } else {
        payout = Math.floor(bet * 2.5);
        msg = "Blackjack natural +" + formatLocks(payout);
      }
      const credit = await applyWalletDelta(payout);
      if (!credit.ok) {
        setStatus("Failed to credit blackjack payout.", "error");
        pushHistory("Blackjack payout credit failed");
      } else {
        setStatus(msg, "ok");
        pushHistory(msg);
      }
      state.bj.message = msg;
      renderBoard();
      return;
    }

    setStatus("Blackjack started. Hit, stand, double, or split.", "ok");
    pushHistory("Blackjack started with " + formatLocks(bet) + " bet");
    renderBoard();
  }

  async function blackjackHit() {
    const round = state.bj;
    if (!round || !round.active) return;
    const hand = round.hands[round.activeHandIndex];
    if (!hand || hand.done) return;
    hand.cards.push(round.deck.pop());
    if (handValue(hand.cards) > 21) {
      hand.done = true;
      round.message = "Hand " + (round.activeHandIndex + 1) + " busted.";
      setStatus(round.message, "error");
    }
    renderBoard();
    await moveToNextBlackjackHandOrSettle();
  }

  async function blackjackStand() {
    const round = state.bj;
    if (!round || !round.active) return;
    const hand = round.hands[round.activeHandIndex];
    if (!hand || hand.done) return;
    hand.done = true;
    round.message = "Stood on hand " + (round.activeHandIndex + 1) + ".";
    setStatus(round.message, "ok");
    renderBoard();
    await moveToNextBlackjackHandOrSettle();
  }

  async function blackjackDouble() {
    const round = state.bj;
    if (!round || !round.active) return;
    const hand = round.hands[round.activeHandIndex];
    if (!hand || hand.done || hand.cards.length !== 2) return;

    const spend = await applyWalletDelta(-hand.bet);
    if (!spend.ok) {
      setStatus("Not enough locks to double.", "error");
      return;
    }
    hand.bet *= 2;
    hand.cards.push(round.deck.pop());
    hand.done = true;
    round.message = "Doubled hand " + (round.activeHandIndex + 1) + ".";
    setStatus(round.message, "ok");
    renderBoard();
    await moveToNextBlackjackHandOrSettle();
  }

  async function blackjackSplit() {
    const round = state.bj;
    if (!round || !round.active) return;
    const hand = round.hands[round.activeHandIndex];
    if (!canSplitHand(hand)) return;

    const spend = await applyWalletDelta(-hand.bet);
    if (!spend.ok) {
      setStatus("Not enough locks to split.", "error");
      return;
    }

    const first = hand.cards[0];
    const second = hand.cards[1];
    const baseBet = hand.bet;
    const handA = { cards: [first, round.deck.pop()], bet: baseBet, done: false };
    const handB = { cards: [second, round.deck.pop()], bet: baseBet, done: false };

    round.hands.splice(round.activeHandIndex, 1, handA, handB);
    round.message = "Split activated. Playing hand " + (round.activeHandIndex + 1) + ".";
    setStatus(round.message, "ok");
    renderBoard();
  }

  function renderPlinkoBoard() {
    if (!(els.board instanceof HTMLElement)) return;
    const last = state.plinko && state.plinko.lastDrop ? state.plinko.lastDrop : null;
    const rows = PLINKO_ROWS;
    const bins = rows + 1;

    let html = "";
    html += "<div class=\"meta-line\"><strong>Rows:</strong> " + rows + " | <strong>Slots:</strong> " + bins + "</div>";
    html += "<div class=\"meta-line\" data-plinko-live>" +
      (last
        ? ("Last drop paid " + escapeHtml(formatLocks(last.payout)) + " at x" + Number(last.multiplier || 0).toFixed(2) + ".")
        : "Drop a ball to start Plinko.")
      + "</div>";

    html += "<div class=\"plinko-shell\">";
    html += "<div class=\"plinko-grid\">";
    for (let r = 0; r < PLINKO_ROWS; r++) {
      for (let c = 0; c <= r; c++) {
        const pegPos = plinkoPegPosition(r, c);
        html += "<span class=\"plinko-peg\" data-plinko-peg data-row=\"" + r + "\" data-col=\"" + c + "\" style=\"left:" + pegPos.x.toFixed(3) + "%;top:" + pegPos.y.toFixed(3) + "%\"></span>";
      }
    }
    html += "<span class=\"plinko-ball hidden-ball\" aria-hidden=\"true\"></span>";
    html += "</div>";

    html += "<div class=\"plinko-bins\">";
    for (let i = 0; i < bins; i++) {
      const mult = Number(PLINKO_MULTIPLIERS[i] || 1);
      html += "<div class=\"plinko-bin\" data-plinko-bin=\"" + i + "\"><span>x" + mult.toFixed(1).replace(".0", "") + "</span></div>";
    }
    html += "</div>";
    html += "</div>";
    els.board.innerHTML = html;
    paintPlinkoFrame();
  }

  async function startPlinko() {
    if (state.busy) return;
    const bet = clampBetByGame(state.bet);
    setBusy(true);
    try {
      const spend = await applyWalletDelta(-bet);
      if (!spend.ok) {
        setStatus("Not enough locks for plinko bet.", "error");
        return;
      }

      let col = 0;
      const pathCols = [];
      for (let r = 0; r < PLINKO_ROWS; r++) {
        pathCols.push(col);
        if (Math.random() >= 0.5) col += 1;
      }

      const binIndex = Math.max(0, Math.min(PLINKO_ROWS, col));
      const multiplier = Number(PLINKO_MULTIPLIERS[binIndex] || 1);
      const payout = Math.max(0, Math.floor(bet * multiplier));

      if (!state.plinko || typeof state.plinko !== "object") state.plinko = {};
      state.plinko.liveDrop = {
        bet,
        pathCols,
        binIndex,
        multiplier,
        currentRow: -1,
        currentCol: 0
      };

      setStatus("Plinko ball dropping...", "ok");
      renderBoard();
      await wait(110);

      for (let r = 0; r < PLINKO_ROWS; r++) {
        if (!state.plinko || !state.plinko.liveDrop) break;
        state.plinko.liveDrop.currentRow = r;
        state.plinko.liveDrop.currentCol = pathCols[r];
        paintPlinkoFrame();
        await wait(125);
      }

      if (state.plinko && state.plinko.liveDrop) {
        state.plinko.liveDrop.currentRow = PLINKO_ROWS;
        state.plinko.liveDrop.currentCol = binIndex;
        paintPlinkoFrame();
      }
      await wait(160);

      const credit = await applyWalletDelta(payout);
      if (!credit.ok) {
        setStatus("Plinko payout failed to credit.", "error");
        if (state.plinko && state.plinko.liveDrop) state.plinko.liveDrop = null;
        renderBoard();
        return;
      }

      if (!state.plinko || typeof state.plinko !== "object") state.plinko = {};
      state.plinko.lastDrop = { bet, payout, multiplier, binIndex, pathCols };
      state.plinko.liveDrop = null;

      const msg = "Plinko hit x" + multiplier.toFixed(2) + " -> +" + formatLocks(payout);
      setStatus(msg, payout > 0 ? "ok" : "error");
      pushHistory(msg);
      renderBoard();
    } finally {
      setBusy(false);
    }
  }

  async function startTower() {
    if (state.tower && state.tower.active) {
      setStatus("Tower run already active. Pick a tile or cash out.", "ok");
      return;
    }
    const bet = clampBetByGame(state.bet);
    const spend = await applyWalletDelta(-bet);
    if (!spend.ok) {
      setStatus("Not enough locks for tower bet.", "error");
      return;
    }
    const difficultyId = String(els.towerDifficulty && els.towerDifficulty.value || "normal");
    state.tower = createTowerRound(bet, difficultyId);
    setStatus("Tower started: pick a tile on floor 1.", "ok");
    pushHistory("Tower started " + formatLocks(bet) + " (" + difficultyId + ")");
    renderBoard();
  }
  function towerPick(col) {
    const round = state.tower;
    if (!round || !round.active) return;
    const floor = round.currentFloor;
    if (floor < 0 || floor >= round.floors) return;

    round.picks[floor] = col;
    const isTrap = round.trapsByFloor[floor].indexOf(col) >= 0;
    if (isTrap) {
      round.active = false;
      setStatus("Tower trap hit. You lost " + formatLocks(round.bet), "error");
      pushHistory("Tower trap on floor " + (floor + 1));
      renderBoard();
      return;
    }

    round.currentFloor += 1;
    if (round.currentFloor >= round.floors) {
      towerCashout();
      return;
    }

    setStatus("Safe floor " + round.currentFloor + "/" + round.floors + ". Next cashout " + formatLocks(towerPayout(round)) + ".", "ok");
    renderBoard();
  }

  async function towerCashout() {
    const round = state.tower;
    if (!round || !round.active) return;
    if (round.currentFloor <= 0) {
      setStatus("Clear at least one floor before cashout.", "error");
      return;
    }
    const payout = towerPayout(round);
    round.active = false;
    const credit = await applyWalletDelta(payout);
    if (!credit.ok) {
      setStatus("Failed to credit tower payout.", "error");
      return;
    }
    setStatus("Tower cashout: +" + formatLocks(payout), "ok");
    pushHistory("Tower cashout +" + formatLocks(payout));
    renderBoard();
  }

  async function startMines() {
    if (state.mines && state.mines.active) {
      setStatus("Mines run already active. Pick a tile or cash out.", "ok");
      return;
    }
    const bet = clampBetByGame(state.bet);
    const spend = await applyWalletDelta(-bet);
    if (!spend.ok) {
      setStatus("Not enough locks for mines bet.", "error");
      return;
    }
    const minesCount = toCount(els.minesCount && els.minesCount.value || 5);
    state.mines = createMinesRound(bet, minesCount);
    setStatus("Mines started. Avoid traps and cash out anytime.", "ok");
    pushHistory("Mines started " + formatLocks(bet) + " (" + minesCount + " mines)");
    renderBoard();
  }

  function minesPick(index) {
    const round = state.mines;
    if (!round || !round.active) return;
    if (round.picked[index]) return;

    if (round.mineSet[index]) {
      round.active = false;
      setStatus("Mines exploded. Lost " + formatLocks(round.bet), "error");
      pushHistory("Mines exploded");
      renderBoard();
      return;
    }

    round.picked[index] = true;
    const safe = minesSafeClicks(round);
    const safeTotal = round.total - round.mines;

    if (safe >= safeTotal) {
      minesCashout();
      return;
    }

    const nextPayout = minesPayout(round);
    setStatus("Mines safe picks: " + safe + ". Cashout now for " + formatLocks(nextPayout) + ".", "ok");
    renderBoard();
  }

  async function minesCashout() {
    const round = state.mines;
    if (!round || !round.active) return;
    const safe = minesSafeClicks(round);
    if (safe <= 0) {
      setStatus("Pick at least one safe tile before cashout.", "error");
      return;
    }
    const payout = minesPayout(round);
    round.active = false;
    const credit = await applyWalletDelta(payout);
    if (!credit.ok) {
      setStatus("Failed to credit mines payout.", "error");
      return;
    }
    setStatus("Mines cashout: +" + formatLocks(payout), "ok");
    pushHistory("Mines cashout +" + formatLocks(payout));
    renderBoard();
  }

  function renderBlackjackBoard() {
    if (!(els.board instanceof HTMLElement)) return;
    const round = state.bj;
    if (!round) {
      els.board.innerHTML = "<div class=\"meta-line\">Press <strong>Deal</strong> to start a round.</div>";
      if (els.bjHitBtn instanceof HTMLButtonElement) els.bjHitBtn.disabled = true;
      if (els.bjStandBtn instanceof HTMLButtonElement) els.bjStandBtn.disabled = true;
      if (els.bjDoubleBtn instanceof HTMLButtonElement) els.bjDoubleBtn.disabled = true;
      if (els.bjSplitBtn instanceof HTMLButtonElement) els.bjSplitBtn.disabled = true;
      if (els.bjDealBtn instanceof HTMLButtonElement) els.bjDealBtn.disabled = !state.user;
      return;
    }

    const dealerValueText = round.active ? "?" : String(handValue(round.dealerHand));
    const dealerCards = round.dealerHand.map((c, i) => buildCardHtml(c, round.active && i === 1)).join("");

    let handsHtml = "";
    for (let i = 0; i < round.hands.length; i++) {
      const hand = round.hands[i];
      const score = handValue(hand.cards);
      const activeClass = (round.active && i === round.activeHandIndex) ? " active-hand" : "";
      const cardsHtml = hand.cards.map((c) => buildCardHtml(c, false)).join("");
      handsHtml += "<div class=\"bj-hand" + activeClass + "\">" +
        "<div class=\"meta-line\"><strong>Hand " + (i + 1) + ":</strong> " + score + " | Bet " + escapeHtml(formatLocks(hand.bet)) + "</div>" +
        "<div class=\"cards playing-cards\">" + cardsHtml + "</div>" +
        "</div>";
    }

    els.board.innerHTML = "" +
      "<div class=\"meta-line\"><strong>Base Bet:</strong> " + escapeHtml(formatLocks(round.bet)) + "</div>" +
      "<div class=\"meta-line\"><strong>Status:</strong> " + escapeHtml(round.message || "") + "</div>" +
      "<div class=\"bj-layout\">" +
      "  <div class=\"bj-hand dealer-hand\">" +
      "    <div class=\"meta-line\"><strong>Dealer:</strong> " + escapeHtml(dealerValueText) + "</div>" +
      "    <div class=\"cards playing-cards\">" + dealerCards + "</div>" +
      "  </div>" +
      handsHtml +
      "</div>";

    const active = Boolean(round.active);
    const hand = active ? round.hands[round.activeHandIndex] : null;
    const canDouble = Boolean(active && hand && hand.cards.length === 2);
    const canSplit = Boolean(active && hand && canSplitHand(hand));

    if (els.bjHitBtn instanceof HTMLButtonElement) els.bjHitBtn.disabled = !active;
    if (els.bjStandBtn instanceof HTMLButtonElement) els.bjStandBtn.disabled = !active;
    if (els.bjDoubleBtn instanceof HTMLButtonElement) els.bjDoubleBtn.disabled = !canDouble;
    if (els.bjSplitBtn instanceof HTMLButtonElement) els.bjSplitBtn.disabled = !canSplit;
    if (els.bjDealBtn instanceof HTMLButtonElement) els.bjDealBtn.disabled = active || !state.user;
  }

  function renderTowerBoard() {
    if (!(els.board instanceof HTMLElement)) return;
    const round = state.tower;
    if (!round) {
      els.board.innerHTML = "<div class=\"meta-line\">Press <strong>Start Tower</strong> to begin.</div>";
      if (els.towerCashoutBtn instanceof HTMLButtonElement) els.towerCashoutBtn.disabled = true;
      return;
    }

    let html = "";
    html += "<div class=\"meta-line\"><strong>Bet:</strong> " + escapeHtml(formatLocks(round.bet)) + "</div>";
    html += "<div class=\"meta-line\"><strong>Floors Cleared:</strong> " + round.currentFloor + " / " + round.floors + "</div>";
    html += "<div class=\"meta-line\"><strong>Current Multiplier:</strong> x" + towerMultiplier(round).toFixed(2) + "</div>";
    html += "<div class=\"meta-line\"><strong>Cashout:</strong> " + escapeHtml(formatLocks(towerPayout(round))) + "</div>";

    html += "<div class=\"tower-grid\">";
    for (let y = 0; y < round.floors; y++) {
      for (let x = 0; x < round.cols; x++) {
        const pick = round.picks[y];
        let cls = "tower-cell";
        let label = "?";
        if (!round.active && typeof pick === "number") {
          const trap = round.trapsByFloor[y].indexOf(pick) >= 0;
          if (x === pick) {
            cls += trap ? " trap" : " safe";
            label = trap ? "X" : "OK";
          } else {
            label = "";
          }
        } else if (round.active && y === round.currentFloor) {
          cls += " active";
        } else if (typeof pick === "number" && x === pick) {
          cls += " safe";
          label = "OK";
        } else {
          label = "";
        }
        html += "<button type=\"button\" class=\"" + cls + "\" data-tower-cell=\"" + x + "\" data-floor=\"" + y + "\">" + label + "</button>";
      }
    }
    html += "</div>";

    els.board.innerHTML = html;
    if (els.towerCashoutBtn instanceof HTMLButtonElement) els.towerCashoutBtn.disabled = !round.active || round.currentFloor <= 0;
  }

  function renderMinesBoard() {
    if (!(els.board instanceof HTMLElement)) return;
    const round = state.mines;
    if (!round) {
      els.board.innerHTML = "<div class=\"meta-line\">Press <strong>Start Mines</strong> to begin.</div>";
      if (els.minesCashoutBtn instanceof HTMLButtonElement) els.minesCashoutBtn.disabled = true;
      return;
    }

    const safe = minesSafeClicks(round);
    const mult = minesMultiplier(round, safe);
    let html = "";
    html += "<div class=\"meta-line\"><strong>Bet:</strong> " + escapeHtml(formatLocks(round.bet)) + "</div>";
    html += "<div class=\"meta-line\"><strong>Mines:</strong> " + round.mines + "</div>";
    html += "<div class=\"meta-line\"><strong>Safe Picks:</strong> " + safe + "</div>";
    html += "<div class=\"meta-line\"><strong>Current Multiplier:</strong> x" + mult.toFixed(2) + "</div>";
    html += "<div class=\"meta-line\"><strong>Cashout:</strong> " + escapeHtml(formatLocks(minesPayout(round))) + "</div>";

    html += "<div class=\"mines-grid\">";
    for (let i = 0; i < round.total; i++) {
      const picked = Boolean(round.picked[i]);
      const isMine = Boolean(round.mineSet[i]);
      let cls = "mines-cell covered";
      let label = "?";
      if (!round.active) {
        if (isMine) {
          cls = "mines-cell mine";
          label = "X";
        } else if (picked) {
          cls = "mines-cell safe";
          label = "OK";
        } else {
          cls = "mines-cell";
          label = "";
        }
      } else if (picked) {
        cls = "mines-cell safe";
        label = "OK";
      }
      html += "<button type=\"button\" class=\"" + cls + "\" data-mines-cell=\"" + i + "\">" + label + "</button>";
    }
    html += "</div>";

    els.board.innerHTML = html;
    if (els.minesCashoutBtn instanceof HTMLButtonElement) els.minesCashoutBtn.disabled = !round.active || safe <= 0;
  }

  function renderBoard() {
    if (state.activeGame === "tower") renderTowerBoard();
    else if (state.activeGame === "mines") renderMinesBoard();
    else if (state.activeGame === "plinko") renderPlinkoBoard();
    else renderBlackjackBoard();

    if (els.spinBtn instanceof HTMLButtonElement) {
      if (state.activeGame === "tower") els.spinBtn.textContent = state.tower && state.tower.active ? "Run Active" : "Start Tower";
      else if (state.activeGame === "mines") els.spinBtn.textContent = state.mines && state.mines.active ? "Run Active" : "Start Mines";
      else els.spinBtn.textContent = "Drop Ball";
    }
  }

  async function connectDb() {
    if (state.db) return state.db;
    if (typeof dbModule.getOrInitAuthDb !== "function") {
      throw new Error("DB module unavailable.");
    }
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
    try {
      const roleSnapLegacy = await db.ref(BASE_PATH + "/roles/" + accountId).once("value");
      const legacy = String(roleSnapLegacy.val() || "").trim().toLowerCase();
      if (legacy) return legacy;
    } catch (_error) {
      // fallback below
    }
    const username = String(usernameHint || (state.user && state.user.username) || "").toLowerCase();
    const byName = window.GT_SETTINGS && window.GT_SETTINGS.ADMIN_ROLE_BY_USERNAME;
    if (username && byName && typeof byName === "object") {
      const roleByName = String(byName[username] || "").trim().toLowerCase();
      if (roleByName) return roleByName;
    }
    return "none";
  }

  function consumeSessionNavigationTransfer() {
    try {
      const raw = sessionStorage.getItem(SESSION_NAV_TRANSFER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;

      const issuedAt = Math.max(0, Math.floor(Number(parsed.issuedAt) || 0));
      if (!issuedAt || Math.abs(Date.now() - issuedAt) > 30000) return null;

      const targetRaw = String(parsed.target || "").trim().toLowerCase();
      const clean = targetRaw.split("#")[0].split("?")[0].replace(/\\/g, "/");
      if (!(clean === "casino/index.html" || clean.endsWith("/casino/index.html") || clean === "casino.html" || clean.endsWith("/casino.html"))) {
        return null;
      }

      const accountId = String(parsed.accountId || "").trim();
      const sessionId = String(parsed.sessionId || "").trim();
      const username = String(parsed.username || "").trim().toLowerCase();
      if (!accountId) return null;

      sessionStorage.removeItem(SESSION_NAV_TRANSFER_KEY);
      return { accountId, sessionId, username };
    } catch (_error) {
      return null;
    }
  }

  async function attemptSessionTransferResume() {
    const transfer = consumeSessionNavigationTransfer();
    if (!transfer) return false;
    setAuthStatus("Linking game session...");

    try {
      const db = await connectDb();
      const sessionSnap = await db.ref(BASE_PATH + "/account-sessions/" + transfer.accountId).once("value");
      const sessionVal = sessionSnap && typeof sessionSnap.val === "function" ? (sessionSnap.val() || {}) : {};
      const liveSessionId = String(sessionVal.sessionId || "").trim();
      const liveUsername = String(sessionVal.username || "").trim().toLowerCase();

      if (!liveSessionId) {
        setAuthStatus("Session transfer expired. Login required.", "error");
        return false;
      }
      if (transfer.sessionId && liveSessionId !== transfer.sessionId) {
        setAuthStatus("Session transfer mismatch. Login required.", "error");
        return false;
      }

      const username = liveUsername || transfer.username || "";
      if (!username) {
        setAuthStatus("Session transfer missing username.", "error");
        return false;
      }

      const role = await readUserRole(transfer.accountId, username);
      state.user = { accountId: transfer.accountId, username, role };
      refreshSessionChips();
      setBusy(false);
      bindInventoryWatch();
      setAuthStatus("Session linked as @" + username + ".", "ok");
      setView("dashboard");
      return true;
    } catch (_error) {
      setAuthStatus("Session transfer failed.", "error");
      return false;
    }
  }
  async function authenticate(createMode) {
    if (!(els.authUsername instanceof HTMLInputElement) || !(els.authPassword instanceof HTMLInputElement)) return;
    const username = normalizeUsername(els.authUsername.value);
    const password = String(els.authPassword.value || "");

    if (typeof authModule.validateCredentials === "function") {
      const validation = authModule.validateCredentials(username, password);
      if (validation) {
        setAuthStatus(validation, "error");
        return;
      }
    }

    if (typeof authModule.sha256Hex !== "function") {
      setAuthStatus("Auth hashing unavailable.", "error");
      return;
    }

    setAuthBusy(true);
    setAuthStatus(createMode ? "Creating account..." : "Logging in...");

    try {
      const db = await connectDb();
      const usernameRef = db.ref(BASE_PATH + "/usernames/" + username);
      let accountId = "";

      if (createMode) {
        accountId = "acc_" + Math.random().toString(36).slice(2, 12);
        const reserved = await usernameRef.transaction((current) => {
          if (current) return;
          return accountId;
        });
        if (!reserved || !reserved.committed) throw new Error("Username already exists.");

        const passwordHashCreate = await authModule.sha256Hex(password);
        await db.ref(BASE_PATH + "/accounts/" + accountId).set({
          username,
          passwordHash: passwordHashCreate,
          createdAt: window.firebase && window.firebase.database ? window.firebase.database.ServerValue.TIMESTAMP : Date.now()
        });
      } else {
        const usernameSnap = await usernameRef.once("value");
        accountId = String(usernameSnap.val() || "").trim();
        if (!accountId) throw new Error("Account not found.");
      }

      const accountSnap = await db.ref(BASE_PATH + "/accounts/" + accountId).once("value");
      const account = accountSnap.val() || {};
      const passwordHash = await authModule.sha256Hex(password);
      if (String(account.passwordHash || "") !== passwordHash) {
        throw new Error("Invalid password.");
      }

      if (typeof authStorageModule.saveCredentials === "function") {
        authStorageModule.saveCredentials(SAVED_AUTH_KEY, username, password);
      }

      const role = await readUserRole(accountId, username);
      state.user = { accountId, username, role };
      setAuthStatus("Logged in as @" + username + ".", "ok");
      setBusy(false);
      refreshSessionChips();
      bindInventoryWatch();
      setView("dashboard");
      renderBoard();
    } catch (error) {
      setAuthStatus((error && error.message) || "Auth failed.", "error");
      state.user = null;
      refreshSessionChips();
      setBusy(false);
      setView("auth");
    } finally {
      setAuthBusy(false);
    }
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
    if (!state.user || !state.user.accountId) return;
    const db = await connectDb();
    state.refs.inventory = db.ref(BASE_PATH + "/player-inventories/" + state.user.accountId);
    state.handlers.inventory = (snap) => {
      const value = snap && typeof snap.val === "function" ? (snap.val() || {}) : {};
      const wallet = walletFromInventory(value);
      state.walletLocks = wallet.total;
      state.walletById = wallet.byId;
      refreshSessionChips();
      setBet(state.bet);
    };
    state.refs.inventory.on("value", state.handlers.inventory);
  }

  function loadSavedCredentials() {
    if (typeof authStorageModule.loadCredentials !== "function") return { username: "", password: "" };
    return authStorageModule.loadCredentials(SAVED_AUTH_KEY) || { username: "", password: "" };
  }

  async function tryAutoLogin() {
    const saved = loadSavedCredentials();
    if (!(els.authUsername instanceof HTMLInputElement) || !(els.authPassword instanceof HTMLInputElement)) return;

    els.authUsername.value = String(saved.username || "").slice(0, 20);
    els.authPassword.value = String(saved.password || "").slice(0, 64);
    if (!saved.username || !saved.password) return;

    await authenticate(false);
  }

  function bindEvents() {
    if (els.toGameBtn instanceof HTMLButtonElement) {
      els.toGameBtn.addEventListener("click", () => {
        window.location.href = "../index.html";
      });
    }

    if (els.authLoginBtn instanceof HTMLButtonElement) {
      els.authLoginBtn.addEventListener("click", () => { authenticate(false); });
    }
    if (els.authCreateBtn instanceof HTMLButtonElement) {
      els.authCreateBtn.addEventListener("click", () => { authenticate(true); });
    }

    if (els.tabBlackjack instanceof HTMLButtonElement) els.tabBlackjack.addEventListener("click", () => setGame("blackjack"));
    if (els.tabTower instanceof HTMLButtonElement) els.tabTower.addEventListener("click", () => setGame("tower"));
    if (els.tabMines instanceof HTMLButtonElement) els.tabMines.addEventListener("click", () => setGame("mines"));
    if (els.dashboardCards instanceof HTMLElement) {
      els.dashboardCards.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const card = target.closest(".game-card");
        if (!(card instanceof HTMLElement)) return;
        const slotKey = String(card.getAttribute("data-slot-key") || "").trim().toLowerCase();
        const slotUrl = String(card.getAttribute("data-slot-url") || "").trim();
        if (slotKey) {
          openSlotGame(slotKey, slotUrl);
          return;
        }
        const gameId = String(card.getAttribute("data-game-card") || "").trim().toLowerCase();
        setGame(gameId);
        setView("game");
      });
    }
    if (els.backToDashboardBtn instanceof HTMLButtonElement) {
      els.backToDashboardBtn.addEventListener("click", () => {
        setView("dashboard");
      });
    }

    if (els.betInput instanceof HTMLInputElement) {
      els.betInput.addEventListener("change", () => setBet(els.betInput.value));
    }
    if (els.betDownBtn instanceof HTMLButtonElement) {
      els.betDownBtn.addEventListener("click", () => setBet(Math.max(1, state.bet - Math.max(1, Math.floor(state.bet * 0.1)))));
    }
    if (els.betUpBtn instanceof HTMLButtonElement) {
      els.betUpBtn.addEventListener("click", () => setBet(state.bet + Math.max(1, Math.floor(state.bet * 0.1))));
    }
    if (els.betMaxBtn instanceof HTMLButtonElement) {
      els.betMaxBtn.addEventListener("click", () => {
        const game = GAMES[state.activeGame] || GAMES.blackjack;
        setBet(Math.min(game.maxBet, state.walletLocks));
      });
    }

    if (els.adminBalanceApplyBtn instanceof HTMLButtonElement) {
      els.adminBalanceApplyBtn.addEventListener("click", () => {
        runAdminBalanceCredit();
      });
    }
    if (els.adminBalanceAmount instanceof HTMLInputElement) {
      els.adminBalanceAmount.addEventListener("keydown", (event) => {
        if (event.key === "Enter") runAdminBalanceCredit();
      });
    }

    if (els.spinBtn instanceof HTMLButtonElement) {
      els.spinBtn.addEventListener("click", () => {
        if (!state.user) {
          setStatus("Login first.", "error");
          return;
        }
        if (state.view !== "game") {
          setStatus("Select a game from the dashboard first.", "error");
          return;
        }
        if (state.activeGame === "blackjack") startBlackjack();
        else if (state.activeGame === "plinko") startPlinko();
        else if (state.activeGame === "tower") startTower();
        else startMines();
      });
    }

    if (els.bjDealBtn instanceof HTMLButtonElement) els.bjDealBtn.addEventListener("click", () => startBlackjack());
    if (els.bjHitBtn instanceof HTMLButtonElement) els.bjHitBtn.addEventListener("click", () => blackjackHit());
    if (els.bjStandBtn instanceof HTMLButtonElement) els.bjStandBtn.addEventListener("click", () => blackjackStand());
    if (els.bjDoubleBtn instanceof HTMLButtonElement) els.bjDoubleBtn.addEventListener("click", () => blackjackDouble());
    if (els.bjSplitBtn instanceof HTMLButtonElement) els.bjSplitBtn.addEventListener("click", () => blackjackSplit());

    if (els.towerCashoutBtn instanceof HTMLButtonElement) els.towerCashoutBtn.addEventListener("click", () => towerCashout());
    if (els.minesCashoutBtn instanceof HTMLButtonElement) els.minesCashoutBtn.addEventListener("click", () => minesCashout());

    if (els.board instanceof HTMLElement) {
      els.board.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        if (state.activeGame === "tower") {
          const btn = target.closest("[data-tower-cell]");
          if (!(btn instanceof HTMLElement)) return;
          const floor = toCount(btn.getAttribute("data-floor"));
          if (!state.tower || !state.tower.active || floor !== state.tower.currentFloor) return;
          const col = toCount(btn.getAttribute("data-tower-cell"));
          towerPick(col);
          return;
        }

        if (state.activeGame === "mines") {
          const btn = target.closest("[data-mines-cell]");
          if (!(btn instanceof HTMLElement)) return;
          const index = toCount(btn.getAttribute("data-mines-cell"));
          minesPick(index);
        }
      });
    }
  }

  async function init() {
    bindEvents();
    await loadSlotCatalog();
    renderSlotCards();
    renderHistory();
    setGame("blackjack");
    setView("auth");
    setBusy(true);
    setAuthStatus("Ready.");
    setStatus("Pick a game from dashboard to start.");
    refreshSessionChips();
    const resumed = await attemptSessionTransferResume();
    if (!resumed) {
      await tryAutoLogin();
      if (state.user) setView("dashboard");
    }
    setBusy(false);
  }

  init().catch((error) => {
    setAuthStatus((error && error.message) || "Casino init failed.", "error");
  });
})();
