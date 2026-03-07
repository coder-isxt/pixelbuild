
window.GTModules = window.GTModules || {};

(function initCasinoSite() {
  "use strict";

  const SAVED_AUTH_KEY = "growtopia_saved_auth_v1";
  const BASE_PATH = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
  const HOUSE_EDGE_MINES = 0.04;
  const TOWER_DIFFICULTY = {
    easy: { traps: 1, stepMult: 1.19 },
    normal: { traps: 2, stepMult: 1.58 },
    hard: { traps: 3, stepMult: 2.38 },
    extreme: { traps: 4, stepMult: 4.75 }
  };
  const GAMES = {
    blackjack: { id: "blackjack", label: "Blackjack", minBet: 1, maxBet: 50000000 },
    tower: { id: "tower", label: "Tower", minBet: 1, maxBet: 50000000 },
    mines: { id: "mines", label: "Mines", minBet: 1, maxBet: 50000000 }
  };

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
    activeGame: "blackjack",
    bet: 10,
    busy: false,
    lockRows: resolveLockCurrencies(),
    history: [],
    bj: null,
    tower: null,
    mines: null
  };

  const els = {
    toGameBtn: document.getElementById("toGameBtn"),
    sessionChip: document.getElementById("sessionChip"),
    walletChip: document.getElementById("walletChip"),
    authUsername: document.getElementById("authUsername"),
    authPassword: document.getElementById("authPassword"),
    authCreateBtn: document.getElementById("authCreateBtn"),
    authLoginBtn: document.getElementById("authLoginBtn"),
    authStatus: document.getElementById("authStatus"),
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
    bjDealBtn: document.getElementById("bjDealBtn"),
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
      els.walletChip.textContent = "Wallet: " + formatLocks(state.walletLocks);
    }
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
  function setGame(gameId) {
    state.activeGame = (gameId === "tower" || gameId === "mines") ? gameId : "blackjack";
    if (els.tabBlackjack instanceof HTMLElement) els.tabBlackjack.classList.toggle("active", state.activeGame === "blackjack");
    if (els.tabTower instanceof HTMLElement) els.tabTower.classList.toggle("active", state.activeGame === "tower");
    if (els.tabMines instanceof HTMLElement) els.tabMines.classList.toggle("active", state.activeGame === "mines");

    if (els.towerDifficultyWrap instanceof HTMLElement) els.towerDifficultyWrap.style.display = state.activeGame === "tower" ? "grid" : "none";
    if (els.minesConfigWrap instanceof HTMLElement) els.minesConfigWrap.style.display = state.activeGame === "mines" ? "grid" : "none";

    const isBj = state.activeGame === "blackjack";
    if (els.bjDealBtn instanceof HTMLElement) els.bjDealBtn.style.display = isBj ? "" : "none";
    if (els.bjHitBtn instanceof HTMLElement) els.bjHitBtn.style.display = isBj ? "" : "none";
    if (els.bjStandBtn instanceof HTMLElement) els.bjStandBtn.style.display = isBj ? "" : "none";

    const label = GAMES[state.activeGame] ? GAMES[state.activeGame].label : "Game";
    if (els.boardTitle instanceof HTMLElement) els.boardTitle.textContent = label;
    if (els.spinBtn instanceof HTMLButtonElement) {
      if (state.activeGame === "blackjack") els.spinBtn.textContent = "Quick Deal";
      else if (state.activeGame === "tower") els.spinBtn.textContent = state.tower && state.tower.active ? "Run Active" : "Start Tower";
      else els.spinBtn.textContent = state.mines && state.mines.active ? "Run Active" : "Start Mines";
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

  async function settleBlackjack() {
    const round = state.bj;
    if (!round || !round.active) return;

    const player = handValue(round.player);
    while (handValue(round.dealer) < 17) {
      round.dealer.push(round.deck.pop());
    }
    const dealer = handValue(round.dealer);

    round.active = false;
    let payout = 0;
    let msg = "";

    if (player > 21) {
      msg = "Blackjack bust. Lost " + formatLocks(round.bet);
    } else if (dealer > 21 || player > dealer) {
      payout = Math.floor(round.bet * (round.natural ? 2.5 : 2));
      msg = "Blackjack win +" + formatLocks(payout);
    } else if (player === dealer) {
      payout = round.bet;
      msg = "Blackjack push. Returned " + formatLocks(round.bet);
    } else {
      msg = "Dealer wins. Lost " + formatLocks(round.bet);
    }

    if (payout > 0) {
      const res = await applyWalletDelta(payout);
      if (!res.ok) {
        setStatus("Failed to credit blackjack payout.", "error");
        pushHistory("Blackjack payout credit failed");
      } else {
        setStatus(msg, "ok");
        pushHistory(msg);
      }
    } else {
      setStatus(msg, "error");
      pushHistory(msg);
    }
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
    const dealer = [deck.pop(), deck.pop()];
    const natural = handValue(player) === 21 && player.length === 2;

    state.bj = {
      active: true,
      bet,
      deck,
      player,
      dealer,
      natural
    };

    if (natural) {
      await settleBlackjack();
      return;
    }

    setStatus("Blackjack started. Hit or stand.", "ok");
    pushHistory("Blackjack started with " + formatLocks(bet) + " bet");
    renderBoard();
  }

  async function blackjackHit() {
    const round = state.bj;
    if (!round || !round.active) return;
    round.player.push(round.deck.pop());
    renderBoard();
    if (handValue(round.player) > 21) {
      await settleBlackjack();
    } else {
      setStatus("Blackjack: choose hit or stand.", "ok");
    }
  }

  async function blackjackStand() {
    if (!state.bj || !state.bj.active) return;
    await settleBlackjack();
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
      return;
    }
    const playerValue = handValue(round.player);
    const dealerValue = round.active ? handValue([round.dealer[0]]) : handValue(round.dealer);

    const playerCards = round.player.map((c) => "<span class=\"card-tile\">" + escapeHtml(c) + "</span>").join("");
    const dealerCards = round.dealer.map((c, i) => {
      if (round.active && i === 1) return "<span class=\"card-tile\">?</span>";
      return "<span class=\"card-tile\">" + escapeHtml(c) + "</span>";
    }).join("");

    els.board.innerHTML = "" +
      "<div class=\"meta-line\"><strong>Bet:</strong> " + escapeHtml(formatLocks(round.bet)) + "</div>" +
      "<div class=\"meta-line\"><strong>Dealer:</strong> " + escapeHtml(String(dealerValue)) + "</div>" +
      "<div class=\"cards\">" + dealerCards + "</div>" +
      "<div class=\"meta-line\"><strong>Player:</strong> " + escapeHtml(String(playerValue)) + "</div>" +
      "<div class=\"cards\">" + playerCards + "</div>";

    if (els.bjHitBtn instanceof HTMLButtonElement) els.bjHitBtn.disabled = !round.active;
    if (els.bjStandBtn instanceof HTMLButtonElement) els.bjStandBtn.disabled = !round.active;
    if (els.bjDealBtn instanceof HTMLButtonElement) els.bjDealBtn.disabled = round.active || !state.user;
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
      let cls = "mines-cell hidden";
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
    else renderBlackjackBoard();

    if (els.spinBtn instanceof HTMLButtonElement) {
      if (state.activeGame === "blackjack") els.spinBtn.textContent = "Quick Deal";
      else if (state.activeGame === "tower") els.spinBtn.textContent = state.tower && state.tower.active ? "Run Active" : "Start Tower";
      else els.spinBtn.textContent = state.mines && state.mines.active ? "Run Active" : "Start Mines";
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

  async function readUserRole(accountId) {
    const db = await connectDb();
    const roleSnap = await db.ref(BASE_PATH + "/roles/" + accountId).once("value");
    const roleVal = String(roleSnap.val() || "").trim().toLowerCase();
    return roleVal || "none";
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

      const role = await readUserRole(accountId);
      state.user = { accountId, username, role };
      setAuthStatus("Logged in as @" + username + ".", "ok");
      setBusy(false);
      refreshSessionChips();
      bindInventoryWatch();
      renderBoard();
    } catch (error) {
      setAuthStatus((error && error.message) || "Auth failed.", "error");
      state.user = null;
      refreshSessionChips();
      setBusy(false);
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
        window.location.href = "index.html";
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

    if (els.spinBtn instanceof HTMLButtonElement) {
      els.spinBtn.addEventListener("click", () => {
        if (!state.user) {
          setStatus("Login first.", "error");
          return;
        }
        if (state.activeGame === "blackjack") startBlackjack();
        else if (state.activeGame === "tower") startTower();
        else startMines();
      });
    }

    if (els.bjDealBtn instanceof HTMLButtonElement) els.bjDealBtn.addEventListener("click", () => startBlackjack());
    if (els.bjHitBtn instanceof HTMLButtonElement) els.bjHitBtn.addEventListener("click", () => blackjackHit());
    if (els.bjStandBtn instanceof HTMLButtonElement) els.bjStandBtn.addEventListener("click", () => blackjackStand());

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
    renderHistory();
    setGame("blackjack");
    setBusy(true);
    setAuthStatus("Ready.");
    setStatus("Login to start gambling games.");
    refreshSessionChips();
    await tryAutoLogin();
    setBusy(false);
  }

  init().catch((error) => {
    setAuthStatus((error && error.message) || "Casino init failed.", "error");
  });
})();
