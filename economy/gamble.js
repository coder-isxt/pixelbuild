window.GTModules = window.GTModules || {};

(function initGambleModule() {
  const MACHINE_USE_TIMEOUT_MS = 120000;
  const SLOTS_V2_RENDER_PAYLINES = [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [0, 0, 1, 2, 2],
    [2, 2, 1, 0, 0],
    [1, 0, 1, 2, 1],
    [1, 2, 1, 0, 1],
    [0, 1, 1, 1, 2],
    [3, 3, 3, 3, 3]
  ];
  const slotsModule = (window.GTModules && window.GTModules.slots) || {};
  const slotsDefs = (typeof slotsModule.getDefinitions === "function" ? slotsModule.getDefinitions() : null) || {};
  const slotsDef = slotsDefs.slots || {};
  const slotsV2Def = slotsDefs.slots_v2 || {};
  const slotsV3Def = slotsDefs.slots_v3 || {};
  const slotsV4Def = slotsDefs.slots_v4 || {};
  const slotsV6Def = slotsDefs.slots_v6 || {};

  const MACHINE_DEFS = {
    reme_roulette: {
      id: "reme_roulette",
      name: "Reme Roulette",
      minRoll: 0,
      maxRoll: 37,
      minBet: 1,
      maxBet: 30000,
      maxPayoutMultiplier: 3,
      tripleWinRolls: new Set([0, 19, 28, 37]),
      houseAutoLoseRolls: new Set([0, 19, 28, 37])
    },
    blackjack: {
      id: "blackjack",
      name: "Blackjack",
      minBet: 1,
      maxBet: 30000,
      maxPayoutMultiplier: 3
    },
    slots: {
      id: "slots",
      name: String(slotsDef.name || "Slots"),
      minBet: Math.max(1, Math.floor(Number(slotsDef.minBet) || 1)),
      maxBet: Math.max(1, Math.floor(Number(slotsDef.maxBet) || 30000)),
      maxPayoutMultiplier: Math.max(1, Math.floor(Number(slotsDef.maxPayoutMultiplier) || 10))
    },
    slots_v2: {
      id: "slots_v2",
      name: String(slotsV2Def.name || "Slots v2"),
      minBet: Math.max(1, Math.floor(Number(slotsV2Def.minBet) || 1)),
      maxBet: Math.max(1, Math.floor(Number(slotsV2Def.maxBet) || 30000)),
      maxPayoutMultiplier: Math.max(1, Math.floor(Number(slotsV2Def.maxPayoutMultiplier) || 50)),
      reels: Math.max(1, Math.floor(Number(slotsV2Def.layout && slotsV2Def.layout.reels) || 5)),
      rows: Math.max(1, Math.floor(Number(slotsV2Def.layout && slotsV2Def.layout.rows) || 3))
    },
    le_bandit: {
      id: "le_bandit",
      name: "Le Bandit",
      minBet: 1,
      maxBet: 30000,
      maxPayoutMultiplier: 10000,
      reels: 6,
      rows: 5
    },
    slots_v3: {
      id: "slots_v3",
      name: String(slotsV3Def.name || "Slots v3"),
      minBet: Math.max(1, Math.floor(Number(slotsV3Def.minBet) || 1)),
      maxBet: Math.max(1, Math.floor(Number(slotsV3Def.maxBet) || 30000)),
      // Coverage multiplier for machine solvency (separate from slot engine's internal theoretical max).
      maxPayoutMultiplier: 100,
      reels: Math.max(1, Math.floor(Number(slotsV3Def.layout && slotsV3Def.layout.reels) || 5)),
      rows: Math.max(1, Math.floor(Number(slotsV3Def.layout && slotsV3Def.layout.rows) || 3))
    },
    slots_v4: {
      id: "slots_v4",
      name: String(slotsV4Def.name || "Slots v4"),
      minBet: Math.max(1, Math.floor(Number(slotsV4Def.minBet) || 1)),
      maxBet: Math.max(1, Math.floor(Number(slotsV4Def.maxBet) || 30000)),
      // Coverage multiplier for machine solvency (separate from slot engine's internal theoretical max).
      maxPayoutMultiplier: 120,
      reels: Math.max(1, Math.floor(Number(slotsV4Def.layout && slotsV4Def.layout.reels) || 5)),
      rows: Math.max(1, Math.floor(Number(slotsV4Def.layout && slotsV4Def.layout.rows) || 3))
    },
    slots_v6: {
      id: "slots_v6",
      name: String(slotsV6Def.name || "Slots v6"),
      minBet: Math.max(1, Math.floor(Number(slotsV6Def.minBet) || 1)),
      maxBet: Math.max(1, Math.floor(Number(slotsV6Def.maxBet) || 30000)),
      // Coverage multiplier for machine solvency (separate from slot engine's internal theoretical max).
      maxPayoutMultiplier: 120,
      reels: Math.max(1, Math.floor(Number(slotsV6Def.layout && slotsV6Def.layout.reels) || 5)),
      rows: Math.max(1, Math.floor(Number(slotsV6Def.layout && slotsV6Def.layout.rows) || 3))
    }
  };

  function createController(options) {
    const opts = options || {};
    const machines = new Map();
    const lastBetByTile = new Map();
    let modalCtx = null;
    let modalBound = false;

    function get(k, fallback) {
      const fn = opts[k];
      if (typeof fn === "function") return fn();
      return fallback;
    }

    function esc(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function getTileKey(tx, ty) {
      return String(tx) + "_" + String(ty);
    }

    function normalizeStats(value) {
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
        lastOutcome: String(row.lastOutcome || "").slice(0, 16),
        lastSlotsText: String(row.lastSlotsText || "").slice(0, 220),
        lastSlotsSummary: String(row.lastSlotsSummary || "").slice(0, 180),
        lastSlotsLines: String(row.lastSlotsLines || "").slice(0, 220),
        lastSlotsLineIds: String(row.lastSlotsLineIds || "").slice(0, 120),
        lastSlotsGameId: String(row.lastSlotsGameId || "").slice(0, 24),
        lastPlayerName: String(row.lastPlayerName || "").slice(0, 20),
        lastAt: Number(row.lastAt) || 0
      };
    }

    function normalizeRecord(value) {
      if (!value || typeof value !== "object") return null;
      const typeId = String(value.type || "reme_roulette");
      const def = MACHINE_DEFS[typeId] || MACHINE_DEFS.reme_roulette;
      const blackjackRound = normalizeBlackjackRound(value.blackjackRound);
      const maxBetRaw = Math.floor(Number(value.maxBet));
      const maxBet = Math.max(def.minBet, Math.min(def.maxBet, Number.isFinite(maxBetRaw) ? maxBetRaw : def.maxBet));
      return {
        ownerAccountId: String(value.ownerAccountId || ""),
        ownerName: String(value.ownerName || "").slice(0, 20),
        type: def.id,
        maxBet,
        earningsLocks: Math.max(0, Math.floor(Number(value.earningsLocks) || 0)),
        inUseAccountId: String(value.inUseAccountId || ""),
        inUseSessionId: String(value.inUseSessionId || ""),
        inUseName: String(value.inUseName || "").slice(0, 20),
        inUseAt: Math.max(0, Math.floor(Number(value.inUseAt) || 0)),
        stats: normalizeStats(value.stats),
        blackjackRound: def.id === "blackjack" ? blackjackRound : null,
        updatedAt: Number(value.updatedAt) || 0
      };
    }

    function setLocal(tx, ty, value) {
      const key = getTileKey(tx, ty);
      const normalized = normalizeRecord(value);
      if (!normalized) {
        machines.delete(key);
        if (modalCtx && modalCtx.tx === tx && modalCtx.ty === ty) {
          closeModal();
        }
        return;
      }
      machines.set(key, normalized);
      if (modalCtx && modalCtx.tx === tx && modalCtx.ty === ty) {
        renderOpen();
      }
    }

    function getLocal(tx, ty) {
      return machines.get(getTileKey(tx, ty)) || null;
    }

    function clearAll() {
      if (modalCtx && Number.isInteger(modalCtx.tx) && Number.isInteger(modalCtx.ty)) {
        releaseMachineUsage(modalCtx.tx, modalCtx.ty);
      }
      machines.clear();
      modalCtx = null;
      const modal = get("getGambleModalEl", null);
      if (modal) modal.classList.add("hidden");
    }

    function getModalEls() {
      return {
        modal: get("getGambleModalEl", null),
        title: get("getGambleTitleEl", null),
        body: get("getGambleBodyEl", null),
        actions: get("getGambleActionsEl", null),
        closeBtn: get("getGambleCloseBtnEl", null)
      };
    }

    function closeModal() {
      const prev = modalCtx;
      modalCtx = null;
      const els = getModalEls();
      if (els.modal) els.modal.classList.add("hidden");
      if (prev && Number.isInteger(prev.tx) && Number.isInteger(prev.ty)) {
        releaseMachineUsage(prev.tx, prev.ty);
      }
    }

    function sumDigits(value) {
      const safe = Math.max(0, Math.floor(Number(value) || 0));
      return Math.floor(safe / 10) + (safe % 10);
    }

    function getRemeFromRoll(roll) {
      const r = Math.max(0, Math.floor(Number(roll) || 0));
      if (r === 19 || r === 28 || r === 37) return 0;
      return sumDigits(r);
    }

    function evaluateSpin(def, playerRoll, houseRoll, bet) {
      const playerReme = getRemeFromRoll(playerRoll);
      const houseReme = getRemeFromRoll(houseRoll);
      const houseAutoLose = Boolean(def && def.houseAutoLoseRolls && typeof def.houseAutoLoseRolls.has === "function" && def.houseAutoLoseRolls.has(houseRoll));
      const triple = Boolean(def && def.tripleWinRolls && typeof def.tripleWinRolls.has === "function" && def.tripleWinRolls.has(playerRoll));
      const tie = playerReme === houseReme;
      let multiplier = 0;
      let outcome = "lose";
      if (houseAutoLose) {
        multiplier = 0;
        outcome = "house_roll";
      } else if (triple) {
        multiplier = 3;
        outcome = "triple";
      } else if (!tie && playerReme > houseReme) {
        multiplier = 2;
        outcome = "win";
      }
      return {
        bet: Math.max(1, Math.floor(Number(bet) || 1)),
        playerRoll,
        houseRoll,
        playerReme,
        houseReme,
        houseAutoLose,
        tie,
        multiplier,
        payoutWanted: Math.max(0, Math.floor((Number(bet) || 0) * multiplier)),
        outcome
      };
    }

    function evaluateSlots(def, bet, options) {
      const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
      const opts = options && typeof options === "object" ? options : {};
      if (slotsModule && typeof slotsModule.spin === "function") {
        const raw = slotsModule.spin(def && def.id ? def.id : "slots", safeBet, opts) || {};
        const reels = Array.isArray(raw.reels) ? raw.reels.map((r) => String(r || "?")).slice(0, 8) : ["?", "?", "?"];
        const lineIds = Array.isArray(raw.lineIds) ? raw.lineIds.map((v) => Math.max(1, Math.floor(Number(v) || 0))).filter((v) => v > 0).slice(0, 12) : [];
        const multiplier = Math.max(0, Number(raw.multiplier) || 0);
        const outcome = String(raw.outcome || (multiplier > 0 ? "win" : "lose")).slice(0, 16);
        const payoutWanted = Math.max(0, Math.floor(Number(raw.payoutWanted) || (safeBet * multiplier)));
        const wager = Math.max(1, Math.floor(Number(raw.bet) || safeBet));
        return {
          bet: wager,
          playerRoll: 0,
          houseRoll: 0,
          playerReme: 0,
          houseReme: 0,
          houseAutoLose: false,
          tie: false,
          reels,
          slotsSummary: String(raw.summary || "").slice(0, 180),
          slotsLines: Array.isArray(raw.lineWins) ? raw.lineWins.slice(0, 8).join(" | ") : "",
          slotsLineIds: lineIds.join(","),
          slotsGameId: String(raw.gameId || (def && def.id) || "slots").slice(0, 24),
          bonusView: (raw && raw.bonusView && typeof raw.bonusView === "object") ? raw.bonusView : null,
          freeSpinsAwarded: Math.max(0, Math.floor(Number(raw.freeSpinsAwarded) || 0)),
          multiplier,
          payoutWanted,
          outcome,
          gameType: String(raw.gameId || (def && def.id) || "slots")
        };
      }
      return {
        bet: safeBet,
        playerRoll: 0,
        houseRoll: 0,
        playerReme: 0,
        houseReme: 0,
        houseAutoLose: false,
        tie: false,
        reels: ["?", "?", "?"],
        slotsSummary: "Module unavailable",
        slotsLines: "",
        slotsLineIds: "",
        slotsGameId: String((def && def.id) || "slots").slice(0, 24),
        bonusView: null,
        freeSpinsAwarded: 0,
        multiplier: 0,
        payoutWanted: 0,
        outcome: "lose",
        gameType: String((def && def.id) || "slots")
      };
    }

    function drawCard() {
      return Math.floor(Math.random() * 13) + 1;
    }

    function getCardValue(card) {
      const c = Math.max(1, Math.min(13, Math.floor(Number(card) || 1)));
      if (c === 1) return 11;
      if (c >= 10) return 10;
      return c;
    }

    function getCardLabel(card) {
      const c = Math.max(1, Math.min(13, Math.floor(Number(card) || 1)));
      if (c === 1) return "A";
      if (c === 11) return "J";
      if (c === 12) return "Q";
      if (c === 13) return "K";
      return String(c);
    }

    function scoreHandDetail(cards) {
      const arr = Array.isArray(cards) ? cards : [];
      let total = 0;
      let aces = 0;
      for (let i = 0; i < arr.length; i++) {
        const c = Math.max(1, Math.min(13, Math.floor(Number(arr[i]) || 1)));
        if (c === 1) aces += 1;
        total += getCardValue(c);
      }
      while (total > 21 && aces > 0) {
        total -= 10;
        aces -= 1;
      }
      return {
        total,
        isBlackjack: arr.length === 2 && total === 21
      };
    }

    function scoreHand(cards) {
      return scoreHandDetail(cards).total;
    }

    function formatHand(cards, total, hideSecondCard) {
      const arr = Array.isArray(cards) ? cards : [];
      const labels = arr.map((c, i) => (hideSecondCard && i === 1 ? "?" : getCardLabel(c))).join(" ");
      return labels + " (" + Math.max(0, Math.floor(Number(total) || 0)) + ")";
    }

    function parseSlotsRows(value) {
      const raw = String(value || "");
      const rows = raw.split("|").map((s) => String(s || "").trim()).filter(Boolean);
      if (!rows.length) return [["?", "?", "?"]];
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

    function normalizeSlotsPayline(pattern, reels, rows) {
      const safeReels = Math.max(1, Math.floor(Number(reels) || 5));
      const safeRows = Math.max(1, Math.floor(Number(rows) || 3));
      const arr = Array.isArray(pattern) ? pattern : [];
      const fallback = Math.max(0, Math.min(safeRows - 1, Math.floor(Number(arr[arr.length - 1]) || 0)));
      const out = [];
      for (let c = 0; c < safeReels; c++) {
        out.push(Math.max(0, Math.min(safeRows - 1, Math.floor(Number(arr[c]) || fallback))));
      }
      return out;
    }

    function buildRollingSlotsRows(cols, rows, seed) {
      const symbols = ["GEM", "PICK", "MINER", "GOLD", "DYN", "WILD", "SCAT", "BONUS"];
      const safeCols = Math.max(5, Math.floor(Number(cols) || 5));
      const safeRows = Math.max(1, Math.floor(Number(rows) || 3));
      const safeSeed = Math.max(0, Math.floor(Number(seed) || 0));
      const out = [];
      for (let r = 0; r < safeRows; r++) out[r] = [];
      for (let c = 0; c < safeCols; c++) {
        const base = (safeSeed + c * 17) % symbols.length;
        for (let r = 0; r < safeRows; r++) {
          out[r][c] = symbols[(base + 1 + r * 2) % symbols.length];
        }
      }
      return out;
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

    function getBonusCellClass(token) {
      const key = normalizeSlotsToken(token);
      if (!key || key === ".") return "normal";
      if (key === "COL") return "bonus";
      if (key.charAt(0) === "M") return "wild";
      if (key.charAt(0) === "B") return "dynamite";
      if (key.charAt(0) === "J") return "scatter";
      return "gem";
    }

    function sanitizeCardList(cards) {
      const arr = Array.isArray(cards) ? cards : [];
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        out.push(Math.max(1, Math.min(13, Math.floor(Number(arr[i]) || 1))));
      }
      return out;
    }

    function normalizeBlackjackRound(value) {
      if (!value || typeof value !== "object") return null;
      const handsRaw = Array.isArray(value.hands) ? value.hands : [];
      if (!handsRaw.length) return null;
      const hands = handsRaw.map((handRaw) => {
        const handCards = sanitizeCardList(handRaw && handRaw.cards);
        return {
          cards: handCards,
          bet: Math.max(1, Math.floor(Number(handRaw && handRaw.bet) || 1)),
          fromSplit: Boolean(handRaw && handRaw.fromSplit),
          doubled: Boolean(handRaw && handRaw.doubled),
          done: Boolean(handRaw && handRaw.done),
          outcome: String(handRaw && handRaw.outcome || "").slice(0, 16),
          payout: Math.max(0, Math.floor(Number(handRaw && handRaw.payout) || 0))
        };
      });
      return {
        active: Boolean(value.active),
        playerAccountId: String(value.playerAccountId || ""),
        playerName: String(value.playerName || "").slice(0, 20),
        startedAt: Math.max(0, Math.floor(Number(value.startedAt) || 0)),
        dealerCards: sanitizeCardList(value.dealerCards),
        hands,
        activeHand: Math.max(0, Math.floor(Number(value.activeHand) || 0)),
        dealerDone: Boolean(value.dealerDone),
        resolved: Boolean(value.resolved),
        aggregateOutcome: String(value.aggregateOutcome || "").slice(0, 16),
        totalPayout: Math.max(0, Math.floor(Number(value.totalPayout) || 0)),
        summary: String(value.summary || "").slice(0, 220)
      };
    }

    function getBlackjackCoverageRequired(round) {
      const r = normalizeBlackjackRound(round);
      if (!r) return 0;
      let totalBet = 0;
      for (let i = 0; i < r.hands.length; i++) {
        totalBet += Math.max(1, Math.floor(Number(r.hands[i].bet) || 1));
      }
      return totalBet * 3;
    }

    function firstOpenBlackjackHand(round) {
      const r = normalizeBlackjackRound(round);
      if (!r) return -1;
      for (let i = 0; i < r.hands.length; i++) {
        if (!r.hands[i].done) return i;
      }
      return -1;
    }

    function canSplitHand(hand) {
      if (!hand || !Array.isArray(hand.cards) || hand.cards.length !== 2) return false;
      return getCardValue(hand.cards[0]) === getCardValue(hand.cards[1]);
    }

    function finishBlackjackRound(round) {
      const r = normalizeBlackjackRound(round);
      if (!r) return null;
      const dealerCards = sanitizeCardList(r.dealerCards);
      while (scoreHand(dealerCards) < 17) {
        dealerCards.push(drawCard());
      }
      const dealerScore = scoreHandDetail(dealerCards);
      const dealerBust = dealerScore.total > 21;
      const dealerBlackjack = dealerScore.isBlackjack;
      let totalPayout = 0;
      let summaryWins = 0;
      let summaryPush = 0;
      const outHands = r.hands.map((hand) => {
        const detail = scoreHandDetail(hand.cards);
        const bet = Math.max(1, Math.floor(Number(hand.bet) || 1));
        let payout = 0;
        let outcome = "lose";
        if (detail.total > 21) {
          payout = 0;
          outcome = "bust";
        } else if (detail.isBlackjack && !hand.fromSplit && !dealerBlackjack) {
          payout = Math.max(0, Math.floor(bet * 2.5));
          outcome = "blackjack";
          summaryWins += 1;
        } else if (dealerBust) {
          payout = bet * 2;
          outcome = "win";
          summaryWins += 1;
        } else if (dealerBlackjack && !(detail.isBlackjack && !hand.fromSplit)) {
          payout = 0;
          outcome = "lose";
        } else if (detail.total > dealerScore.total) {
          payout = bet * 2;
          outcome = "win";
          summaryWins += 1;
        } else if (detail.total === dealerScore.total) {
          payout = bet;
          outcome = "push";
          summaryPush += 1;
        } else {
          payout = 0;
          outcome = "lose";
        }
        totalPayout += payout;
        return {
          ...hand,
          done: true,
          outcome,
          payout
        };
      });
      const aggregateOutcome = summaryWins > 0
        ? (outHands.some((h) => h.outcome === "blackjack") ? "blackjack" : "win")
        : (summaryPush > 0 ? "push" : "lose");
      return {
        ...r,
        active: false,
        dealerCards,
        dealerDone: true,
        resolved: true,
        activeHand: -1,
        hands: outHands,
        totalPayout,
        summary: "Dealer " + formatHand(dealerCards, dealerScore.total, false) + ".",
        aggregateOutcome,
        dealerTotal: dealerScore.total
      };
    }

    function canCollect(machine) {
      const pid = String(get("getPlayerProfileId", "") || "");
      return Boolean(machine && pid && machine.ownerAccountId === pid);
    }

    function canEditMachineMaxBet(machine) {
      if (!canCollect(machine)) return false;
      const isLocked = Boolean(get("isWorldLocked", false));
      if (!isLocked) return true;
      const isOwner = Boolean(get("isWorldLockOwner", false));
      if (isOwner) return true;
      const isAdmin = Boolean(get("isWorldLockAdmin", false));
      if (isAdmin) return false;
      return true;
    }

    function canManageMachineAdvanced(machine) {
      if (!canCollect(machine)) return false;
      const isLocked = Boolean(get("isWorldLocked", false));
      if (!isLocked) return true;
      return Boolean(get("isWorldLockOwner", false));
    }

    function normalizeTaxPolicy(value) {
      const row = value && typeof value === "object" ? value : {};
      const percent = Math.max(0, Math.min(100, Math.floor(Number(row.percent) || 0)));
      const ownerAccountId = String(row.ownerAccountId || "").trim();
      const ownerName = String(row.ownerName || "").trim().slice(0, 20);
      const tx = Math.floor(Number(row.tx));
      const ty = Math.floor(Number(row.ty));
      const enabled = Boolean(
        row.enabled !== false &&
        percent > 0 &&
        ownerAccountId &&
        Number.isInteger(tx) &&
        Number.isInteger(ty) &&
        tx >= 0 &&
        ty >= 0
      );
      return {
        enabled,
        percent,
        ownerAccountId,
        ownerName,
        tx: Number.isInteger(tx) ? tx : -1,
        ty: Number.isInteger(ty) ? ty : -1
      };
    }

    function getWorldTaxPolicy() {
      const raw = typeof opts.getWorldTaxPolicy === "function"
        ? opts.getWorldTaxPolicy()
        : null;
      return normalizeTaxPolicy(raw);
    }

    function getTaxSplit(totalLocks, _collectorAccountId) {
      const total = Math.max(0, Math.floor(Number(totalLocks) || 0));
      const policy = getWorldTaxPolicy();
      if (!policy.enabled || total <= 0) {
        return {
          total,
          collectorShare: total,
          ownerShare: 0,
          ownerAccountId: policy.ownerAccountId,
          ownerName: policy.ownerName,
          percent: policy.percent,
          tx: policy.tx,
          ty: policy.ty,
          taxed: false
        };
      }
      const ownerShare = Math.max(0, Math.min(total, Math.floor((total * policy.percent) / 100)));
      if (ownerShare <= 0) {
        return {
          total,
          collectorShare: total,
          ownerShare: 0,
          ownerAccountId: policy.ownerAccountId,
          ownerName: policy.ownerName,
          percent: policy.percent,
          tx: policy.tx,
          ty: policy.ty,
          taxed: false
        };
      }
      return {
        total,
        collectorShare: Math.max(0, total - ownerShare),
        ownerShare,
        ownerAccountId: policy.ownerAccountId,
        ownerName: policy.ownerName,
        percent: policy.percent,
        tx: policy.tx,
        ty: policy.ty,
        taxed: true
      };
    }

    function depositTaxToTaxMachine(split, network, basePath, worldId) {
      const ownerShare = Math.max(0, Math.floor(Number(split && split.ownerShare) || 0));
      const tx = Math.floor(Number(split && split.tx));
      const ty = Math.floor(Number(split && split.ty));
      if (ownerShare <= 0) return Promise.resolve({ ok: true, applied: false });
      if (!network || !network.db || !basePath || !worldId) return Promise.resolve({ ok: false, reason: "missing-context" });
      if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || ty < 0) return Promise.resolve({ ok: false, reason: "missing-tax-tile" });
      const taxRef = network.db.ref(basePath + "/worlds/" + worldId + "/owner-tax");
      return taxRef.transaction((currentRaw) => {
        const current = currentRaw && typeof currentRaw === "object" ? currentRaw : {};
        const currentPercentRaw = current.taxPercent !== undefined ? current.taxPercent : current.percent;
        const currentPercent = Math.max(0, Math.min(100, Math.floor(Number(currentPercentRaw) || 0)));
        const existingBank = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
        const nextPercent = Math.max(0, Math.min(100, Math.floor(Number(split.percent) || currentPercent)));
        const ownerAccountId = String(split.ownerAccountId || current.ownerAccountId || "").trim();
        const ownerName = String(split.ownerName || current.ownerName || "").trim().slice(0, 20);
        return {
          tx,
          ty,
          taxPercent: nextPercent,
          ownerAccountId,
          ownerName,
          earningsLocks: existingBank + ownerShare,
          updatedAt: Date.now()
        };
      }).then((txn) => {
        if (!txn || !txn.committed) return { ok: false, reason: "tax-transaction-not-committed" };
        return { ok: true, applied: true };
      }).catch(() => ({ ok: false, reason: "tax-transaction-failed" }));
    }

    function depositTaxToLocalTaxMachine(split) {
      const ownerShare = Math.max(0, Math.floor(Number(split && split.ownerShare) || 0));
      if (ownerShare <= 0) return { ok: true, applied: false };
      const fn = typeof opts.addWorldTaxToLocalBank === "function"
        ? opts.addWorldTaxToLocalBank
        : null;
      if (!fn) return { ok: false, reason: "missing-local-tax-handler" };
      try {
        const ok = Boolean(fn(ownerShare));
        return ok ? { ok: true, applied: true } : { ok: false, reason: "local-tax-handler-rejected" };
      } catch (_error) {
        return { ok: false, reason: "local-tax-handler-error" };
      }
    }

    function canBreakAt(tx, ty) {
      const machine = getLocal(tx, ty);
      if (!machine) return false;
      return canCollect(machine);
    }

    function getCurrencyIds() {
      const worldLockId = Math.max(0, Math.floor(Number(get("getWorldLockId", 0)) || 0));
      const obsidianLockId = Math.max(0, Math.floor(Number(get("getObsidianLockId", 0)) || 0));
      const emeraldLockId = Math.max(0, Math.floor(Number(get("getEmeraldLockId", 0)) || 0));
      return { worldLockId, obsidianLockId, emeraldLockId };
    }

    function getLockDefsForFallback() {
      const getCfgFn = (opts && typeof opts.getLockCurrencyConfig === "function")
        ? opts.getLockCurrencyConfig
        : null;
      const cfg = getCfgFn ? getCfgFn() : null;
      if (Array.isArray(cfg) && cfg.length) {
        return cfg
          .map((row) => ({
            id: Math.max(0, Math.floor(Number(row && row.id) || 0)),
            value: Math.max(1, Math.floor(Number(row && row.value) || 1))
          }))
          .filter((row) => row.id > 0);
      }
      const ids = getCurrencyIds();
      const defs = [];
      if (ids.worldLockId > 0) defs.push({ id: ids.worldLockId, value: 1 });
      if (ids.obsidianLockId > 0) defs.push({ id: ids.obsidianLockId, value: 100 });
      if (ids.emeraldLockId > 0) defs.push({ id: ids.emeraldLockId, value: 10000 });
      return defs;
    }

    function getTotalLocks(inv) {
      const fn = (opts && typeof opts.getTotalLockValue === "function")
        ? opts.getTotalLockValue
        : null;
      if (typeof fn === "function") {
        return Math.max(0, Math.floor(Number(fn(inv)) || 0));
      }
      const defs = getLockDefsForFallback();
      let total = 0;
      for (let i = 0; i < defs.length; i++) {
        const row = defs[i];
        total += Math.max(0, Math.floor(Number(inv && inv[row.id]) || 0)) * row.value;
      }
      return Math.max(0, Math.floor(total));
    }

    function setCanonicalLocks(inv, totalLocks) {
      const fn = (opts && typeof opts.distributeLockValueToInventory === "function")
        ? opts.distributeLockValueToInventory
        : null;
      if (typeof fn === "function") {
        fn(inv, totalLocks);
        return;
      }
      const total = Math.max(0, Math.floor(Number(totalLocks) || 0));
      const defs = getLockDefsForFallback().slice().sort((a, b) => b.value - a.value);
      let remaining = total;
      for (let i = 0; i < defs.length; i++) {
        const row = defs[i];
        const count = row.value > 0 ? Math.floor(remaining / row.value) : 0;
        inv[row.id] = Math.max(0, count);
        remaining -= count * row.value;
      }
      if (remaining > 0 && defs.length) {
        const base = defs[defs.length - 1];
        inv[base.id] = Math.max(0, Math.floor(Number(inv[base.id]) || 0)) + remaining;
      }
    }

    function spendLocksLocal(inv, amount) {
      const fn = (opts && typeof opts.spendLockValue === "function")
        ? opts.spendLockValue
        : null;
      if (typeof fn === "function") {
        return Boolean(fn(inv, amount));
      }
      const cost = Math.max(0, Math.floor(Number(amount) || 0));
      const total = getTotalLocks(inv);
      if (total < cost) return false;
      setCanonicalLocks(inv, total - cost);
      return true;
    }

    function addLocksLocal(inv, amount) {
      sound.play("slots_win");
      const fn = (opts && typeof opts.addLockValue === "function")
        ? opts.addLockValue
        : null;
      if (typeof fn === "function") {
        fn(inv, amount);
        return;
      }
      const total = getTotalLocks(inv) + Math.max(0, Math.floor(Number(amount) || 0));
      setCanonicalLocks(inv, total);
    }

    function getSelfAccountId() {
      return String(get("getPlayerProfileId", "") || "").trim();
    }

    function getSelfSessionId() {
      const sid = String(get("getPlayerSessionId", "") || "").trim();
      if (sid) return sid;
      const aid = getSelfAccountId();
      return aid ? ("acc_" + aid) : "";
    }

    function isUsageStale(machine) {
      if (!machine || !machine.inUseAt) return false;
      const now = Date.now();
      return (now - Math.max(0, Number(machine.inUseAt) || 0)) > MACHINE_USE_TIMEOUT_MS;
    }

    function isUsedByOther(machine) {
      if (!machine || !machine.inUseAccountId) return false;
      if (isUsageStale(machine)) return false;
      const selfAccount = getSelfAccountId();
      const selfSession = getSelfSessionId();
      if (machine.inUseSessionId && selfSession) return machine.inUseSessionId !== selfSession;
      return machine.inUseAccountId !== selfAccount;
    }

    function releaseUsageFields(current) {
      const next = { ...(current || {}) };
      delete next.inUseAccountId;
      delete next.inUseSessionId;
      delete next.inUseName;
      delete next.inUseAt;
      return next;
    }

    function markInUse(current) {
      const next = { ...(current || {}) };
      next.inUseAccountId = getSelfAccountId();
      next.inUseSessionId = getSelfSessionId();
      next.inUseName = String(get("getPlayerName", "") || "").slice(0, 20);
      next.inUseAt = Date.now();
      return next;
    }

    function acquireMachineUsage(tx, ty) {
      const post = opts.postLocalSystemChat || (() => { });
      const currentLocal = getLocal(tx, ty);
      if (currentLocal && isUsedByOther(currentLocal)) {
        post("This machine is currently in use by @" + (currentLocal.inUseName || "another player") + ".");
        return Promise.resolve(false);
      }
      const network = get("getNetwork", null);
      const basePath = String(get("getBasePath", "") || "");
      const profileId = getSelfAccountId();
      if (!profileId) return Promise.resolve(false);
      if (!network || !network.enabled || !network.db || !basePath) {
        const nextLocal = normalizeRecord(markInUse(currentLocal || {
          ownerAccountId: profileId,
          ownerName: String(get("getPlayerName", "") || "").slice(0, 20),
          type: "reme_roulette",
          earningsLocks: 0,
          stats: normalizeStats({}),
          updatedAt: Date.now()
        }));
        setLocal(tx, ty, nextLocal);
        return Promise.resolve(true);
      }
      const machineRef = getMachineRef(tx, ty);
      if (!machineRef) return Promise.resolve(false);
      let deniedBy = "";
      return machineRef.transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw) || {
          ownerAccountId: profileId,
          ownerName: String(get("getPlayerName", "") || "").slice(0, 20),
          type: "reme_roulette",
          earningsLocks: 0,
          stats: normalizeStats({}),
          updatedAt: 0
        };
        if (isUsedByOther(current)) {
          deniedBy = current.inUseName || "another player";
          return;
        }
        const next = markInUse(current);
        next.updatedAt = Date.now();
        return next;
      }).then((result) => {
        if (!result || !result.committed) {
          if (deniedBy) {
            post("This machine is currently in use by @" + deniedBy + ".");
          } else {
            post("Failed to open machine.");
          }
          return false;
        }
        const raw = result.snapshot && typeof result.snapshot.val === "function" ? result.snapshot.val() : null;
        setLocal(tx, ty, raw);
        return true;
      }).catch(() => {
        post("Failed to open machine.");
        return false;
      });
    }

    function releaseMachineUsage(tx, ty) {
      const local = getLocal(tx, ty);
      if (!local) return;
      const selfAccount = getSelfAccountId();
      const selfSession = getSelfSessionId();
      const ownsBySession = local.inUseSessionId && selfSession && local.inUseSessionId === selfSession;
      const ownsByAccount = !local.inUseSessionId && local.inUseAccountId && local.inUseAccountId === selfAccount;
      if (!ownsBySession && !ownsByAccount && !isUsageStale(local)) return;
      const network = get("getNetwork", null);
      const basePath = String(get("getBasePath", "") || "");
      if (!network || !network.enabled || !network.db || !basePath) {
        const nextLocal = normalizeRecord(releaseUsageFields(local));
        setLocal(tx, ty, nextLocal);
        return;
      }
      const machineRef = getMachineRef(tx, ty);
      if (!machineRef) return;
      machineRef.transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw);
        if (!current) return currentRaw;
        const sameSession = current.inUseSessionId && selfSession && current.inUseSessionId === selfSession;
        const sameAccount = !current.inUseSessionId && current.inUseAccountId && current.inUseAccountId === selfAccount;
        if (!sameSession && !sameAccount && !isUsageStale(current)) return currentRaw;
        return {
          ...releaseUsageFields(current),
          updatedAt: Date.now()
        };
      }).then((result) => {
        if (!result || !result.committed) return;
        const raw = result.snapshot && typeof result.snapshot.val === "function" ? result.snapshot.val() : null;
        setLocal(tx, ty, raw);
      }).catch(() => { });
    }

    function getMachineMaxBetCap(machine, def) {
      const safeDef = def || MACHINE_DEFS.reme_roulette;
      const raw = Math.floor(Number(machine && machine.maxBet));
      const fallback = Math.floor(Number(safeDef.maxBet) || 300);
      return Math.max(safeDef.minBet, Math.min(safeDef.maxBet, Number.isFinite(raw) ? raw : fallback));
    }

    function getMaxBetByBank(bank, def, maxCap) {
      const safeBank = Math.max(0, Math.floor(Number(bank) || 0));
      const coverage = Math.max(1, Math.floor(Number(def && def.maxPayoutMultiplier) || 3));
      const byBank = Math.floor(safeBank / coverage);
      const cap = Math.max(1, Math.floor(Number(maxCap) || Math.floor(Number(def && def.maxBet) || 300)));
      return Math.max(0, Math.min(cap, byBank));
    }

    function getOutcomeLabel(outcome) {
      if (outcome === "blackjack") return "BLACKJACK";
      if (outcome === "jackpot") return "JACKPOT";
      if (outcome === "push") return "PUSH";
      if (outcome === "house_roll") return "HOUSE SPECIAL";
      if (outcome === "triple") return "TRIPLE";
      if (outcome === "bust") return "BUST";
      if (outcome === "win") return "WIN";
      return "LOSE";
    }

    function getOutcomeTone(outcome) {
      const key = String(outcome || "").toLowerCase();
      if (key === "jackpot" || key === "blackjack" || key === "win" || key === "triple") return "win";
      if (key === "push") return "push";
      if (key === "bust" || key === "house_roll" || key === "lose") return "lose";
      return "info";
    }

    function renderModal(tx, ty, machine, spectatingMode) {
      const els = getModalEls();
      if (!els.modal || !els.title || !els.body || !els.actions) return;
      const m = machine || getLocal(tx, ty) || {
        ownerAccountId: "",
        ownerName: "",
        type: "reme_roulette",
        earningsLocks: 0,
        stats: normalizeStats({}),
        updatedAt: 0
      };
      const def = MACHINE_DEFS[m.type] || MACHINE_DEFS.reme_roulette;
      const stats = normalizeStats(m.stats);
      const ownerLabel = m.ownerName || "owner";
      const canEditMaxBet = canEditMachineMaxBet(m);
      const canManageAdvanced = canManageMachineAdvanced(m);
      const canCollectMachine = canCollect(m);
      const isMobileUi = Boolean(get("getIsMobileUi", false));
      const spectating = Boolean(spectatingMode);
      const now = Date.now();
      const rollingUntil = (modalCtx && modalCtx.tx === tx && modalCtx.ty === ty)
        ? Math.max(0, Math.floor(Number(modalCtx.rollingUntil) || 0))
        : 0;
      const isRollingSlotsV2 = Boolean((def.id === "slots_v2" || def.id === "le_bandit" || def.id === "slots_v3" || def.id === "slots_v4" || def.id === "slots_v6") && rollingUntil > now);
      const bank = Math.max(0, Math.floor(Number(m.earningsLocks) || 0));
      const machineMaxCap = getMachineMaxBetCap(m, def);
      const maxBetByBank = getMaxBetByBank(bank, def, machineMaxCap);
      const canSpin = maxBetByBank >= def.minBet;
      const blockedByActiveUser = isUsedByOther(m);
      const blockedByMobileSlots = Boolean((def.id === "slots_v2" || def.id === "le_bandit" || def.id === "slots_v3" || def.id === "slots_v4" || def.id === "slots_v6") && isMobileUi);
      const blockedByRolling = isRollingSlotsV2;
      const canPlayNow = canSpin && !blockedByActiveUser && !spectating && !blockedByMobileSlots && !blockedByRolling;
      const inventory = get("getInventory", {}) || {};
      const playerLocks = getTotalLocks(inventory);
      const maxBetByPlayer = Math.max(0, Math.min(machineMaxCap, playerLocks));
      const maxBetEffective = Math.max(0, Math.min(maxBetByBank, maxBetByPlayer));
      const tileKey = getTileKey(tx, ty);
      const rememberedBet = Math.max(def.minBet, Math.floor(Number(lastBetByTile.get(tileKey)) || def.minBet));
      const displayBet = canSpin
        ? Math.max(def.minBet, Math.min(maxBetByBank, rememberedBet))
        : def.minBet;
      const coverageMult = Math.max(1, Math.floor(Number(def.maxPayoutMultiplier) || 3));
      const buyBonusX = 10;
      const buyBonusCostPreview = Math.max(def.minBet, displayBet) * buyBonusX;
      const selfAccountId = getSelfAccountId();
      const round = def.id === "blackjack" ? normalizeBlackjackRound(m.blackjackRound) : null;
      const roundActive = Boolean(round && round.active && !round.resolved);
      const roundPlayer = roundActive && round ? round.playerAccountId : "";
      const isRoundPlayer = Boolean(roundActive && roundPlayer && roundPlayer === selfAccountId);
      const canActRound = roundActive && isRoundPlayer && !spectating;
      const activeHandIndex = roundActive && round ? Math.max(0, Math.floor(Number(round.activeHand) || 0)) : -1;
      const activeHand = (roundActive && round && round.hands[activeHandIndex]) ? round.hands[activeHandIndex] : null;
      const canSplit = Boolean(canActRound && activeHand && !activeHand.done && canSplitHand(activeHand) && round.hands.length === 1);
      const canDouble = Boolean(canActRound && activeHand && !activeHand.done && !activeHand.doubled && Array.isArray(activeHand.cards) && activeHand.cards.length === 2);
      const realSlotsRows = parseSlotsRows(stats.lastSlotsText);
      const slotsRows = isRollingSlotsV2
        ? buildRollingSlotsRows(
          Math.max(Number(def.reels) || 5, (realSlotsRows[0] && realSlotsRows[0].length) || 5),
          Math.max(Number(def.rows) || 3, realSlotsRows.length || 3),
          Math.floor(now / 80)
        )
        : realSlotsRows;
      const slotsLines = parseSlotsLines(stats.lastSlotsLines);
      const slotsLineIds = parseSlotsLineIds(stats.lastSlotsLineIds);
      const bonusReplay = (modalCtx && modalCtx.tx === tx && modalCtx.ty === ty && modalCtx.slotsV2Bonus && typeof modalCtx.slotsV2Bonus === "object")
        ? modalCtx.slotsV2Bonus
        : null;
      const bonusFrames = bonusReplay && Array.isArray(bonusReplay.frames) ? bonusReplay.frames : [];
      const bonusRows = Math.max(1, Math.floor(Number(bonusReplay && bonusReplay.rows) || 3));
      const bonusReels = Math.max(1, Math.floor(Number(bonusReplay && bonusReplay.reels) || 5));
      const bonusStartedAt = Math.max(0, Math.floor(Number(modalCtx && modalCtx.slotsV2BonusStartedAt) || 0));
      const bonusStepMs = 360;
      const bonusIdx = bonusFrames.length
        ? Math.min(bonusFrames.length - 1, Math.max(0, Math.floor((now - bonusStartedAt) / bonusStepMs)))
        : -1;
      const bonusActive = bonusIdx >= 0 && bonusIdx < (bonusFrames.length - 1) && bonusStartedAt > 0;
      const activeBonusFrame = bonusIdx >= 0 ? bonusFrames[bonusIdx] : null;
      const prevBonusFrame = (bonusIdx > 0) ? bonusFrames[bonusIdx - 1] : null;
      const bonusHitFrame = Boolean(activeBonusFrame && prevBonusFrame && Number(activeBonusFrame.filled) > Number(prevBonusFrame.filled));
      let slotsCols = Math.max(1, Number(def.reels) || 5);
      for (let r = 0; r < slotsRows.length; r++) {
        slotsCols = Math.max(slotsCols, (slotsRows[r] && slotsRows[r].length) || 0);
      }
      const slotsRowsCount = Math.max(1, Number(def.rows) || slotsRows.length || 3);
      let slotsV2BoardHtml = "";
      if (def.id === "slots_v2" || def.id === "le_bandit" || def.id === "slots_v3" || def.id === "slots_v4" || def.id === "slots_v6") {
        const winCellMap = {};
        if (!isRollingSlotsV2 && slotsLineIds.length) {
          for (let i = 0; i < slotsLineIds.length; i++) {
            const basePattern = SLOTS_V2_RENDER_PAYLINES[Math.max(0, slotsLineIds[i] - 1)];
            if (!basePattern) continue;
            const pattern = normalizeSlotsPayline(basePattern, slotsCols, slotsRowsCount);
            for (let c2 = 0; c2 < pattern.length; c2++) {
              winCellMap[String(c2) + "_" + String(pattern[c2])] = true;
            }
          }
        }
        const winStateClass = isRollingSlotsV2
          ? "slotsv2-idle"
          : (stats.lastOutcome === "jackpot"
            ? "slotsv2-jackpot"
            : ((stats.lastOutcome === "win" && stats.lastMultiplier > 0) ? "slotsv2-win" : "slotsv2-idle"));
        for (let c = 0; c < slotsCols; c++) {
          slotsV2BoardHtml += "<div class='slotsv2-reel'>";
          for (let r = 0; r < slotsRowsCount; r++) {
            const tok = (slotsRows[r] && slotsRows[r][c]) || "?";
            const cls = getSlotsSymbolClass(tok);
            const hit = Boolean(winCellMap[String(c) + "_" + String(r)]);
            slotsV2BoardHtml +=
              "<div class='slotsv2-cell " + cls + (hit ? " hit" : "") + "'><span class='slotsv2-glyph'>" + esc(getSlotsSymbolLabel(tok)) + "</span><span class='slotsv2-token'>" + esc(normalizeSlotsToken(tok) || "?") + "</span></div>";
          }
          slotsV2BoardHtml += "</div>";
        }
        let overlayHtml = "";
        if (!isRollingSlotsV2 && slotsLineIds.length) {
          const used = [];
          for (let i = 0; i < slotsLineIds.length; i++) {
            const lineId = slotsLineIds[i];
            if (used.indexOf(lineId) >= 0) continue;
            used.push(lineId);
            const basePattern = SLOTS_V2_RENDER_PAYLINES[Math.max(0, lineId - 1)];
            if (!basePattern) continue;
            const pattern = normalizeSlotsPayline(basePattern, slotsCols, slotsRowsCount);
            const points = [];
            for (let c = 0; c < pattern.length; c++) {
              const x = ((c + 0.5) / slotsCols) * 100;
              const y = ((pattern[c] + 0.5) / slotsRowsCount) * 100;
              points.push(x.toFixed(2) + "," + y.toFixed(2));
            }
            if (points.length >= 2) {
              overlayHtml += "<polyline points='" + points.join(" ") + "' class='slotsv2-winline'/>";
            }
          }
        }
        if (overlayHtml) {
          slotsV2BoardHtml += "<svg class='slotsv2-overlay' viewBox='0 0 100 100' preserveAspectRatio='none'>" + overlayHtml + "</svg>";
        }
        const lineBadges = isRollingSlotsV2
          ? "<span class='slotsv2-line-badge muted'>Spinning...</span>"
          : (slotsLines.length
            ? slotsLines.map((line) => "<span class='slotsv2-line-badge'>" + esc(line) + "</span>").join("")
            : "<span class='slotsv2-line-badge muted'>No winning lines</span>");
        const boardFxHtml = (!isRollingSlotsV2 && !bonusActive && (stats.lastOutcome === "win" || stats.lastOutcome === "jackpot"))
          ? ("<div class='slotsv2-winfx " + (stats.lastOutcome === "jackpot" ? "slotsv2-outcome-jackpot" : "slotsv2-outcome-win") + "'><span></span><span></span><span></span><span></span><span></span><span></span></div>")
          : "";
        slotsV2BoardHtml =
          "<div class='slotsv2-board " + winStateClass + "' style='--slots-cols:" + slotsCols + ";--slots-rows:" + slotsRowsCount + ";'>" + slotsV2BoardHtml + boardFxHtml + "</div>" +
          "<div class='slotsv2-lines'>" + lineBadges + "</div>";
      }
      const showBonusBoard = Boolean(def.id === "slots_v2" && activeBonusFrame);
      const hideBaseBoardForBonus = showBonusBoard;
      const slotsV2ResultHtml = (def.id === "slots_v2" || def.id === "le_bandit" || def.id === "slots_v3" || def.id === "slots_v4" || def.id === "slots_v6")
        ? ("<div class='vending-section'>" +
          "<div class='vending-section-title'>Slots Game</div>" +
          (hideBaseBoardForBonus ? "" : slotsV2BoardHtml) +
          (def.id === "slots_v2" && activeBonusFrame
            ? ("<div class='slotsv2-board slotsv2-" + (bonusActive ? "idle rolling" : (stats.lastMultiplier > 0 ? "win" : "idle")) + (bonusHitFrame ? " slotsv2-bonus-hit" : "") + "' style='--slots-cols:" + bonusReels + ";--slots-rows:" + bonusRows + ";'>" +
              (function buildBonusReplayBoard() {
                let html = "";
                const teaseList = (activeBonusFrame && Array.isArray(activeBonusFrame.tease)) ? activeBonusFrame.tease : [];
                for (let c = 0; c < bonusReels; c++) {
                  html += "<div class='slotsv2-reel'>";
                  for (let r = 0; r < bonusRows; r++) {
                    const idx = (r * bonusReels) + c;
                    const tok = (activeBonusFrame.cells && activeBonusFrame.cells[idx]) ? String(activeBonusFrame.cells[idx]) : ".";
                    const teasing = tok === "." && teaseList.indexOf(idx) >= 0;
                    const cls = getBonusCellClass(teasing ? "C?" : tok);
                    const showTok = teasing ? "C?" : tok;
                    html += "<div class='slotsv2-cell " + cls + (teasing ? " tease" : "") + "'><span class='slotsv2-glyph'>" + esc(showTok === "." ? " " : showTok) + "</span><span class='slotsv2-token'>" + esc(showTok === "." ? "-" : showTok) + "</span></div>";
                  }
                  html += "</div>";
                }
                return html;
              })() +
              "</div>" +
              "<div class='slotsv2-lines'>" +
              "<span class='slotsv2-line-badge" + (bonusActive ? "" : " muted") + "'>Respins: " + Math.max(0, Math.floor(Number(activeBonusFrame.respins) || 0)) + "</span>" +
              "<span class='slotsv2-line-badge'>Filled: " + Math.max(0, Math.floor(Number(activeBonusFrame.filled) || 0)) + "/" + (bonusRows * bonusReels) + "</span>" +
              "</div>")
            : "") +
          "<div class='bj-banner " + (isRollingSlotsV2 ? "bj-banner-info" : ("bj-banner-" + getOutcomeTone(stats.lastOutcome))) + "'>" +
          ((isRollingSlotsV2 || bonusActive)
            ? (bonusActive ? "Hold & Spin in progress..." : "Rolling...")
            : ("Result: " + esc(stats.lastSlotsSummary || "-") + " | Payout: " + esc(stats.lastMultiplier > 0 ? (stats.lastMultiplier + "x") : "-"))) +
          "</div>" +
          "</div>")
        : "";
      let blackjackStateHtml = "";
      if (def.id === "blackjack") {
        if (round) {
          const dealerTotalShown = roundActive
            ? scoreHand([round.dealerCards[0] || 1])
            : scoreHand(round.dealerCards);
          const dealerText = formatHand(round.dealerCards, dealerTotalShown, roundActive);
          let handsHtml = "";
          for (let i = 0; i < round.hands.length; i++) {
            const hand = round.hands[i];
            const handDetail = scoreHandDetail(hand.cards);
            const handTotal = handDetail.total;
            const handTitle = "Hand " + (i + 1);
            const tag = hand.done ? (hand.outcome ? getOutcomeLabel(hand.outcome) : "DONE") : (i === activeHandIndex ? "ACTIVE" : "WAIT");
            const tone = hand.done ? getOutcomeTone(hand.outcome) : (i === activeHandIndex ? "turn" : "info");
            const rowClass = "vending-stat bj-stat bj-stat-" + tone + (i === activeHandIndex ? " active" : "");
            handsHtml +=
              "<div class='" + rowClass + "'>" +
              "<span>" + esc(handTitle) + " - " + esc(tag) + "</span>" +
              "<strong>" + esc(formatHand(hand.cards, handTotal, false)) + "</strong>" +
              "<div class='bj-hand-meta'>Bet " + hand.bet + " WL" + (handDetail.isBlackjack ? " | Natural 21" : "") + "</div>" +
              "</div>";
          }
          let bannerClass = "bj-banner bj-banner-info";
          let bannerText = "Blackjack ready.";
          if (roundActive) {
            bannerClass = isRoundPlayer ? "bj-banner bj-banner-turn" : "bj-banner bj-banner-wait";
            bannerText = isRoundPlayer
              ? "Your turn: choose Hit / Stand / Double / Split."
              : ("Round in progress by @" + esc(round.playerName || "player") + ".");
          } else {
            const tone = getOutcomeTone(round.aggregateOutcome || stats.lastOutcome || "");
            bannerClass = "bj-banner bj-banner-" + tone;
            bannerText = "Round finished: " + esc(getOutcomeLabel(round.aggregateOutcome || stats.lastOutcome || "lose")) + ".";
            if (round.summary) {
              bannerText += " " + esc(round.summary);
            }
          }
          blackjackStateHtml =
            "<div class='vending-section'>" +
            "<div class='vending-section-title'>Blackjack Round</div>" +
            "<div class='" + bannerClass + "'>" + bannerText + "</div>" +
            "<div class='vending-stat-grid'>" +
            "<div class='vending-stat'><span>Player</span><strong>@" + esc(round.playerName || "player") + "</strong></div>" +
            "<div class='vending-stat'><span>Dealer</span><strong>" + esc(dealerText) + "</strong></div>" +
            "<div class='vending-stat'><span>Round State</span><strong>" + esc(roundActive ? "In Progress" : "Finished") + "</strong></div>" +
            "<div class='vending-stat'><span>Your Access</span><strong>" + esc(isRoundPlayer ? "You are playing" : "Spectating") + "</strong></div>" +
            handsHtml +
            "</div>" +
            "</div>";
        } else {
          blackjackStateHtml =
            "<div class='vending-section'>" +
            "<div class='vending-section-title'>Blackjack Round</div>" +
            "<div class='bj-banner bj-banner-info'>No active round. Press Deal to start.</div>" +
            "</div>";
        }
      }

      els.title.textContent = "Gambling Machine";
      els.body.innerHTML =
        "<div class='vending-section'>" +
        "<div class='vending-stat-grid'>" +
        "<div class='vending-stat'><span>Type</span><strong>" + esc(def.name) + "</strong></div>" +
        "<div class='vending-stat'><span>Owner</span><strong>@" + esc(ownerLabel) + "</strong></div>" +
        "<div class='vending-stat'><span>Machine Bank</span><strong>" + bank + " WL</strong></div>" +
        "<div class='vending-stat'><span>Max Bet</span><strong>" + (canSpin ? maxBetByBank : 0) + " WL</strong></div>" +
        //"<div class='vending-stat'><span>In Use</span><strong>" + (m.inUseAccountId && !isUsageStale(m) ? ("@" + esc(m.inUseName || "player")) : "No") + "</strong></div>" +
        // "<div class='vending-stat'><span>Plays</span><strong>" + stats.plays + "</strong></div>" +
        "<div class='vending-stat'><span>Total Bets Placed</span><strong>" + stats.totalBet + " WL</strong></div>" +
        "<div class='vending-stat'><span>Last Player</span><strong>" + (stats.lastPlayerName ? ("@" + esc(stats.lastPlayerName)) : "-") + "</strong></div>" +
        // "<div class='vending-stat'><span>Total Paid Out</span><strong>" + stats.totalPayout + " WL</strong></div>" +
        "</div>" +
        "</div>" +
        (canEditMaxBet
          ? ("<div class='vending-section'>" +
            "<div class='vending-section-title'>Machine Settings</div>" +
            "<div class='vending-field-grid'>" +
            "<label class='vending-field'><span>Max Bet</span><input data-gamble-input='maxbet' type='number' min='" + def.minBet + "' max='" + def.maxBet + "' step='1' value='" + machineMaxCap + "'></label>" +
            "<div class='vending-field'><span>&nbsp;</span><button type='button' data-gamble-act='setmax'>Save Max Bet</button></div>" +
            (canManageAdvanced
              ? ("<label class='vending-field'><span>Game</span>" +
                "<select data-gamble-input='type'>" +
                Object.keys(MACHINE_DEFS).map((id) => {
                  const row = MACHINE_DEFS[id];
                  return "<option value='" + esc(row.id) + "'" + (row.id === def.id ? " selected" : "") + ">" + esc(row.name) + "</option>";
                }).join("") +
                "</select>" +
                "</label>" +
                "<div class='vending-field'><span>&nbsp;</span><button type='button' data-gamble-act='settype'>Save Game</button></div>")
              : "") +
            "</div>" +
            "</div>")
          : "") +
        "<div class='vending-section'>" +
        "<div class='vending-section-title'>Play (" + (def.id === "blackjack" ? "Blackjack" : (def.id === "slots" ? "Slots" : (def.id === "slots_v2" ? "Slots v2" : (def.id === "le_bandit" ? "Le Bandit" : (def.id === "slots_v3" ? "Slots v3" : (def.id === "slots_v4" ? "Slots v4" : (def.id === "slots_v6" ? "Slots v6" : "Player vs House"))))))) + ")</div>" +
        "<div class='vending-field-grid'>" +
        "<label class='vending-field'><span>Bet (World Locks)</span><input data-gamble-input='bet' type='number' min='" + def.minBet + "' max='" + (canSpin ? maxBetByBank : def.minBet) + "' step='1' value='" + displayBet + "'" + (canPlayNow && !roundActive ? "" : " disabled") + "></label>" +
        "<div class='vending-field'><span>&nbsp;</span><button type='button' data-gamble-act='maxbet'" + ((canPlayNow && maxBetEffective > 0 && !roundActive) ? "" : " disabled") + ">Apply Max Bet</button></div>" +
        "</div>" +
        ((def.id === "slots_v2" || def.id === "le_bandit")
          ? ("<div class='vending-field-grid'>" +
            "<label class='vending-field'><span>Buy Bonus (" + buyBonusCostPreview + " WL)</span><input type='text' value='10x bet (fixed)' disabled></label>" +
            "<div class='vending-field'><span>&nbsp;</span><button type='button' data-gamble-act='buybonus'" + (canPlayNow ? "" : " disabled") + ">Buy Bonus</button></div>" +
            "</div>")
          : "") +
        (def.id === "slots_v2" ? ("<div class='vending-auto-stock-note'>Bonus buy starts Hold & Spin directly with 5 locked bonus symbols.</div>") : (def.id === "le_bandit" ? ("<div class='vending-auto-stock-note'>Bonus Buy radically amplifies volatility and ensures massive drops.</div>") : "")) +
        (def.id === "blackjack"
          ? ("<div class='vending-auto-stock-note'>You: Hit, Stand, Double, Split. Dealer hits to 17+ and stands on 17.</div>" +
            "<div class='vending-auto-stock-note'>Blackjack pays 3:2 (floor), win pays 2x, push returns bet.</div>")
          : (def.id === "slots"
            ? ("<div class='vending-auto-stock-note'>3-reel classic slots. Triple seven = jackpot (10x).</div>" +
              "<div class='vending-auto-stock-note'>Triple bar = 6x, other triples = 4x, double seven = 3x, any pair = 2x.</div>")
            : (def.id === "slots_v2"
              ? ("<div class='vending-auto-stock-note'>5-reel slots with paylines (straight, zig-zag, V-shape).</div>" +
                "<div class='vending-auto-stock-note'>Wild substitutes symbols on paylines. Scatter pays anywhere (3+).</div>" +
                "<div class='vending-auto-stock-note'>Bonus symbols (3+) trigger Hold & Spin (3 respins, resets on new symbol).</div>")
              : (def.id === "le_bandit"
                ? ("<div class='vending-auto-stock-note'>6x5 Grid cascades matching clusters. Coins and Rainbow symbols drop randomly.</div>" +
                  "<div class='vending-auto-stock-note'>Triggering Rain of Gold triggers extreme multipliers. High Volatility!</div>")
                : (def.id === "slots_v3"
                  ? ("<div class='vending-auto-stock-note'>5-reel, fixed-payline, high-volatility slot (RTP target below 100%).</div>" +
                    "<div class='vending-auto-stock-note'>3-5 matches must land left-to-right from reel 1. Higher symbols pay more.</div>" +
                    "<div class='vending-auto-stock-note'>Wild substitutes regular symbols. Scatter pays anywhere and 3+ triggers bonus.</div>" +
                    "<div class='vending-auto-stock-note'>Bonus free spins: extra wilds, stacking multipliers, and scatter retriggers.</div>" +
                    "<div class='vending-auto-stock-note'>Spin payout = symbol value x bet x active multipliers. Big wins are rare.</div>")
                  : (def.id === "slots_v4"
                    ? ("<div class='vending-auto-stock-note'>Forgotten-style: 5 reels, fixed paylines, high volatility.</div>" +
                      "<div class='vending-auto-stock-note'>Wins pay left-to-right from reel 1. Low symbols pay small, premium symbols pay bigger.</div>" +
                      "<div class='vending-auto-stock-note'>Wild substitutes regular symbols. Scatter pays anywhere and 3+ starts free spins.</div>" +
                      "<div class='vending-auto-stock-note'>Bonus focus: extra wilds, expanding symbols, win multipliers, and retriggers.</div>" +
                      "<div class='vending-auto-stock-note'>Payout = symbol value x bet x multipliers. Big wins are possible but rare.</div>")
                    : (def.id === "slots_v6"
                      ? ("<div class='vending-auto-stock-note'>Cascade slot: wins clear symbols and new ones drop in same spin.</div>" +
                        "<div class='vending-auto-stock-note'>5 reels, fixed paylines, left-to-right wins from reel 1. Wild substitutes.</div>" +
                        "<div class='vending-auto-stock-note'>3+ Scatter triggers free spins with growing multipliers and retriggers.</div>" +
                        "<div class='vending-auto-stock-note'>One spin can chain multiple cascades before stopping.</div>")
                      : ("<div class='vending-auto-stock-note'>No number selection. You roll vs house roll (0-37). Higher reme wins.</div>" +
                        "<div class='vending-auto-stock-note'>Tie = lose. Special player rolls 0, 19, 28 give 3x.</div>" +
                        "<div class='vending-auto-stock-note'>If house rolls 0, 19, 28 or 37, player auto-loses.</div>")))))))) +
        "<div class='vending-auto-stock-note'>All lost bets go into machine bank. Wins are paid from machine bank.</div>" +
        (def.id === "slots_v2" ? "<div class='vending-auto-stock-note'>Hold & Spin can land collect/multiplier/bomb/jackpot symbols.</div>" : "") +
        (blockedByMobileSlots ? "<div class='vending-auto-stock-note'>" + esc(def.name) + " is desktop-only. Use PC/tablet desktop mode to play.</div>" : "") +
        (spectating ? "<div class='vending-auto-stock-note'>Spectating live: read-only.</div>" : "") +
        (blockedByActiveUser && !spectating ? "<div class='vending-auto-stock-note'>Machine is currently in use by @" + esc(m.inUseName || "another player") + ".</div>" : "") +
        "</div>" +
        slotsV2ResultHtml +
        blackjackStateHtml +
        (def.id === "blackjack" || def.id === "slots_v2" || def.id === "le_bandit" || def.id === "slots_v3" || def.id === "slots_v4" || def.id === "slots_v6"
          ? ""
          : ("<div class='vending-section'>" +
            "<div class='vending-section-title'>Last Result</div>" +
            (stats.plays
              ? ("<div class='bj-banner bj-banner-" + getOutcomeTone(stats.lastOutcome) + "'>Last round: " + esc(getOutcomeLabel(stats.lastOutcome)) + "</div>")
              : "") +
            "<div class='vending-stat-grid'>" +
            ((def.id === "slots" || def.id === "slots_v2" || def.id === "le_bandit")
              ? ("<div class='vending-stat'><span>Reels</span><strong>" + (stats.plays ? esc(stats.lastSlotsText || "-") : "-") + "</strong></div>" +
                "<div class='vending-stat'><span>Result</span><strong>" + (stats.plays ? esc(stats.lastSlotsSummary || "-") : "-") + "</strong></div>")
              : ("<div class='vending-stat'><span>You</span><strong>" + (stats.plays ? esc(stats.lastPlayerRoll + " (" + stats.lastPlayerReme + ")") : "-") + "</strong></div>" +
                "<div class='vending-stat'><span>House</span><strong>" + (stats.plays ? esc(stats.lastHouseRoll + " (" + stats.lastHouseReme + ")") : "-") + "</strong></div>")) +
            "<div class='vending-stat'><span>Outcome</span><strong>" + esc(stats.plays ? getOutcomeLabel(stats.lastOutcome) : "-") + "</strong></div>" +
            "<div class='vending-stat'><span>Multiplier</span><strong>" + (stats.plays ? (stats.lastMultiplier + "x") : "-") + "</strong></div>" +
            "</div>" +
            "</div>"));

      if (def.id === "blackjack" && roundActive) {
        els.actions.innerHTML =
          "<button data-gamble-act='spin' disabled>Deal</button>" +
          "<button data-gamble-act='bj-hit'" + (canActRound ? "" : " disabled") + ">Hit</button>" +
          "<button data-gamble-act='bj-stand'" + (canActRound ? "" : " disabled") + ">Stand</button>" +
          "<button data-gamble-act='bj-double'" + (canDouble ? "" : " disabled") + ">Double</button>" +
          "<button data-gamble-act='bj-split'" + (canSplit ? "" : " disabled") + ">Split</button>" +
          ((canManageAdvanced || canCollectMachine)
            ? ((canManageAdvanced
              ? ("<input data-gamble-input='refill' type='number' min='1' step='1' value='1' style='max-width:120px;'>" +
                "<button data-gamble-act='refill'>Refill</button>")
              : "") +
              "<button data-gamble-act='collect'" + (m.earningsLocks > 0 ? "" : " disabled") + ">Collect</button>")
            : "") +
          "<button data-gamble-act='close'>Close</button>";
      } else {
        const spinLabel = (def.id === "blackjack" ? "Deal" : "Spin");
        els.actions.innerHTML =
          "<button data-gamble-act='spin'" + (canPlayNow && !roundActive ? "" : " disabled") + ">" + spinLabel + "</button>" +
          ((canManageAdvanced || canCollectMachine)
            ? ((canManageAdvanced
              ? ("<input data-gamble-input='refill' type='number' min='1' step='1' value='1' style='max-width:120px;'>" +
                "<button data-gamble-act='refill'>Refill</button>")
              : "") +
              "<button data-gamble-act='collect'" + (m.earningsLocks > 0 ? "" : " disabled") + ">Collect</button>")
            : "") +
          "<button data-gamble-act='close'>Close</button>";
      }

      const prevCtx = (modalCtx && modalCtx.tx === tx && modalCtx.ty === ty) ? modalCtx : {};
      modalCtx = { ...prevCtx, tx, ty, spectating, rollingUntil };
      els.modal.classList.remove("hidden");
    }

    function getMachineRef(tx, ty) {
      const network = get("getNetwork", null);
      const basePath = String(get("getBasePath", "") || "");
      const worldId = String(get("getCurrentWorldId", "") || "");
      if (!network || !network.enabled || !network.db || !basePath || !worldId) return null;
      return network.db.ref(basePath + "/worlds/" + worldId + "/gamble-machines/" + getTileKey(tx, ty));
    }

    function seedOwner(tx, ty) {
      const ref = getMachineRef(tx, ty);
      if (!ref) return;
      const firebaseRef = get("getFirebase", null);
      const profileId = String(get("getPlayerProfileId", "") || "");
      if (!profileId) return;
      const profileName = String(get("getPlayerName", "") || "").slice(0, 20);
      ref.transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw);
        if (current && current.ownerAccountId) return currentRaw;
        return {
          ownerAccountId: profileId,
          ownerName: profileName,
          type: "slots",
          maxBet: MACHINE_DEFS.slots.maxBet,
          earningsLocks: 0,
          stats: normalizeStats({}),
          updatedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        };
      }).catch(() => { });
    }

    function updateMachineAfterSpin(currentRaw, result, playerName, firebaseRef) {
      const current = normalizeRecord(currentRaw) || {
        ownerAccountId: String(get("getPlayerProfileId", "") || ""),
        ownerName: String(get("getPlayerName", "") || "").slice(0, 20),
        type: "reme_roulette",
        earningsLocks: 0,
        stats: normalizeStats({}),
        updatedAt: 0
      };
      const beforeBank = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
      const def = MACHINE_DEFS[current.type] || MACHINE_DEFS.reme_roulette;
      const coverageBet = Math.max(1, Math.floor(Number(result.coverageBet) || Number(result.bet) || 0));
      const bankBet = Math.max(0, Math.floor(Number(result.bankBet)));
      const fallbackBankBet = Math.max(0, Math.floor(Number(result.bet) || 0));
      const effectiveBankBet = Number.isFinite(bankBet) ? bankBet : fallbackBankBet;
      const needsCoverage = coverageBet * Math.max(1, Math.floor(Number(def.maxPayoutMultiplier) || 3));
      if (beforeBank < needsCoverage) return null;
      const payout = Math.max(0, Math.floor(Number(result.payoutWanted) || 0));
      const nextBank = Math.max(0, beforeBank + effectiveBankBet - payout);
      const nextStats = normalizeStats(current.stats);
      nextStats.plays += 1;
      nextStats.totalBet += result.bet;
      nextStats.totalPayout += payout;
      nextStats.lastPlayerRoll = result.playerRoll;
      nextStats.lastHouseRoll = result.houseRoll;
      nextStats.lastPlayerReme = result.playerReme;
      nextStats.lastHouseReme = result.houseReme;
      nextStats.lastMultiplier = result.multiplier;
      nextStats.lastOutcome = result.outcome;
      nextStats.lastSlotsText = Array.isArray(result.reels) ? result.reels.join(" | ") : "";
      nextStats.lastSlotsSummary = String(result.slotsSummary || "").slice(0, 180);
      nextStats.lastSlotsLines = String(result.slotsLines || "").slice(0, 220);
      nextStats.lastSlotsLineIds = String(result.slotsLineIds || "").slice(0, 120);
      nextStats.lastSlotsGameId = String(result.slotsGameId || "").slice(0, 24);
      nextStats.lastPlayerName = playerName;
      nextStats.lastAt = firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now();
      const next = {
        ownerAccountId: current.ownerAccountId,
        ownerName: current.ownerName,
        type: current.type || "reme_roulette",
        maxBet: current.maxBet,
        earningsLocks: nextBank,
        stats: nextStats,
        updatedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
      };
      return { next, payout };
    }

    function getSlotsRevealDelayMs(defId, bonusView) {
      const id = String(defId || "");
      if (id === "slots_v2" || id === "le_bandit") {
        const frames = (bonusView && Array.isArray(bonusView.frames)) ? bonusView.frames.length : 0;
        return 1200 + (frames * 360) + 250;
      }
      if (id === "slots_v3") {
        return 1650;
      }
      if (id === "slots_v4") {
        return 1750;
      }
      if (id === "slots_v6") {
        return 1850;
      }
      return 0;
    }

    function getOutcomeMessage(result, payout) {
      if (result.gameType === "blackjack") {
        if (result.summaryText) return result.summaryText;
        if (result.outcome === "blackjack") return "BLACKJACK. Won " + payout + " WL.";
        if (result.outcome === "win") return "WIN. Won " + payout + " WL.";
        if (result.outcome === "push") return "PUSH. Bet returned (" + payout + " WL).";
        return "LOSE. Lost " + result.bet + " WL.";
      }
      //DONT ADD, Wont look good for a game
      if (result.gameType === "reme_roulette") {
        const playerText = "You " + result.playerRoll + " (" + result.playerReme + ")";
        const houseText = "House " + result.houseRoll + " (" + result.houseReme + ")";
        if (result.outcome === "house_roll") {
          return playerText + " vs " + houseText + ": HOUSE SPECIAL ROLL. Auto-lose " + result.bet + " WL.";
        }
        if (result.outcome === "triple") {
          return playerText + " vs " + houseText + ": TRIPLE. Won " + payout + " WL.";
        }
        if (result.outcome === "win") {
          return playerText + " vs " + houseText + ": WIN. Won " + payout + " WL.";
        }
        if (result.tie) {
          return playerText + " vs " + houseText + ": TIE = LOSE. Lost " + result.bet + " WL.";
        }
        return playerText + " vs " + houseText + ": LOSE. Lost " + result.bet + " WL.";
      }
    }

    function getBlackjackResultFromResolvedRound(round) {
      const r = normalizeBlackjackRound(round);
      if (!r) return null;
      const dealerTotal = scoreHand(r.dealerCards);
      let bestPlayer = 0;
      let totalBet = 0;
      for (let i = 0; i < r.hands.length; i++) {
        const hand = r.hands[i];
        const total = scoreHand(hand.cards);
        if (total <= 21 && total > bestPlayer) bestPlayer = total;
        totalBet += Math.max(1, Math.floor(Number(hand.bet) || 1));
      }
      const payout = Math.max(0, Math.floor(Number(r.totalPayout) || 0));
      const totalHands = r.hands.length;
      const winHands = r.hands.filter((h) => h.outcome === "win" || h.outcome === "blackjack").length;
      const pushHands = r.hands.filter((h) => h.outcome === "push").length;
      const loseHands = Math.max(0, totalHands - winHands - pushHands);
      return {
        gameType: "blackjack",
        bet: totalBet,
        payoutWanted: payout,
        payout,
        outcome: r.aggregateOutcome || (payout > totalBet ? "win" : (payout === totalBet ? "push" : "lose")),
        playerRoll: bestPlayer,
        houseRoll: dealerTotal,
        playerReme: 0,
        houseReme: 0,
        multiplier: totalBet > 0 ? Number((payout / totalBet).toFixed(2)) : 0,
        summaryText: "Dealer " + dealerTotal + ". Hands: " + winHands + "W/" + pushHands + "P/" + loseHands + "L. Payout " + payout + " WL."
      };
    }

    function startBlackjackRoundSnapshot(currentRaw, bet, playerId, playerName) {
      const current = normalizeRecord(currentRaw) || {
        ownerAccountId: String(get("getPlayerProfileId", "") || ""),
        ownerName: String(get("getPlayerName", "") || "").slice(0, 20),
        type: "blackjack",
        earningsLocks: 0,
        stats: normalizeStats({}),
        updatedAt: 0
      };
      const def = MACHINE_DEFS.blackjack;
      const beforeBank = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
      const safeBet = Math.max(def.minBet, Math.floor(Number(bet) || def.minBet));
      if (beforeBank < safeBet * 3) return null;
      const existing = normalizeBlackjackRound(current.blackjackRound);
      if (existing && existing.active && !existing.resolved) return null;
      const playerCards = [drawCard(), drawCard()];
      const dealerCards = [drawCard(), drawCard()];
      const round = normalizeBlackjackRound({
        active: true,
        playerAccountId: String(playerId || ""),
        playerName: String(playerName || "").slice(0, 20),
        startedAt: Date.now(),
        dealerCards,
        hands: [{
          cards: playerCards,
          bet: safeBet,
          fromSplit: false,
          doubled: false,
          done: false
        }],
        activeHand: 0,
        dealerDone: false,
        resolved: false,
        totalPayout: 0
      });
      const openingHand = round && round.hands[0] ? round.hands[0] : null;
      if (!round || !openingHand) return null;
      const playerOpening = scoreHandDetail(openingHand.cards);
      const dealerOpening = scoreHandDetail(round.dealerCards);
      let finalRound = round;
      if (playerOpening.isBlackjack || dealerOpening.isBlackjack) {
        openingHand.done = true;
        finalRound = finishBlackjackRound(round);
      }
      const resolved = Boolean(finalRound && finalRound.resolved);
      const resolvedResult = resolved ? getBlackjackResultFromResolvedRound(finalRound) : null;
      const resolvedPayout = Math.max(0, Math.floor(Number(resolvedResult && resolvedResult.payout) || 0));
      const nextStats = normalizeStats(current.stats);
      if (resolved && resolvedResult) {
        nextStats.plays += 1;
        nextStats.totalBet += resolvedResult.bet;
        nextStats.totalPayout += resolvedPayout;
        nextStats.lastPlayerRoll = resolvedResult.playerRoll;
        nextStats.lastHouseRoll = resolvedResult.houseRoll;
        nextStats.lastPlayerReme = 0;
        nextStats.lastHouseReme = 0;
        nextStats.lastMultiplier = resolvedResult.multiplier;
        nextStats.lastOutcome = resolvedResult.outcome;
        nextStats.lastPlayerName = String(playerName || "").slice(0, 20);
        nextStats.lastAt = Date.now();
      }
      return {
        next: {
          ...current,
          type: "blackjack",
          earningsLocks: Math.max(0, beforeBank + safeBet - resolvedPayout),
          blackjackRound: finalRound,
          stats: nextStats,
          updatedAt: Date.now()
        },
        bet: safeBet,
        resolved,
        result: resolvedResult,
        payout: resolvedPayout
      };
    }

    function applyBlackjackActionToMachine(currentRaw, action, actorAccountId) {
      const current = normalizeRecord(currentRaw);
      if (!current || current.type !== "blackjack") return { kind: "error", code: "invalid_machine" };
      const round = normalizeBlackjackRound(current.blackjackRound);
      if (!round || !round.active || round.resolved) return { kind: "error", code: "no_round" };
      if (round.playerAccountId !== actorAccountId) return { kind: "error", code: "not_your_round" };
      const handIndex = Math.max(0, Math.floor(Number(round.activeHand) || 0));
      const hand = round.hands[handIndex];
      if (!hand || hand.done) return { kind: "error", code: "hand_done" };

      const nextRound = normalizeBlackjackRound(round);
      if (!nextRound) return { kind: "error", code: "invalid_round" };
      const nextHand = nextRound.hands[handIndex];
      let extraBet = 0;

      if (action === "hit") {
        nextHand.cards.push(drawCard());
        const detail = scoreHandDetail(nextHand.cards);
        if (detail.total >= 21) nextHand.done = true;
      } else if (action === "stand") {
        nextHand.done = true;
      } else if (action === "double") {
        if (nextHand.doubled || nextHand.cards.length !== 2) return { kind: "error", code: "cannot_double" };
        nextHand.bet = Math.max(1, Math.floor(Number(nextHand.bet) || 1)) * 2;
        nextHand.doubled = true;
        extraBet = Math.max(1, Math.floor(Number(nextHand.bet) || 1) / 2);
        nextHand.cards.push(drawCard());
        nextHand.done = true;
      } else if (action === "split") {
        if (nextRound.hands.length !== 1 || !canSplitHand(nextHand)) return { kind: "error", code: "cannot_split" };
        const c1 = nextHand.cards[0];
        const c2 = nextHand.cards[1];
        const handBet = Math.max(1, Math.floor(Number(nextHand.bet) || 1));
        extraBet = handBet;
        nextRound.hands = [
          {
            cards: [c1, drawCard()],
            bet: handBet,
            fromSplit: true,
            doubled: false,
            done: false,
            outcome: "",
            payout: 0
          },
          {
            cards: [c2, drawCard()],
            bet: handBet,
            fromSplit: true,
            doubled: false,
            done: false,
            outcome: "",
            payout: 0
          }
        ];
        nextRound.activeHand = 0;
      } else {
        return { kind: "error", code: "invalid_action" };
      }

      if (extraBet > 0) {
        const currentBank = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
        if ((currentBank + extraBet) < getBlackjackCoverageRequired(nextRound)) {
          return { kind: "error", code: "bank_coverage" };
        }
      }

      const nextOpen = firstOpenBlackjackHand(nextRound);
      if (nextOpen >= 0) {
        nextRound.activeHand = nextOpen;
        return {
          kind: "in_progress",
          next: {
            ...current,
            blackjackRound: nextRound,
            earningsLocks: Math.max(0, Math.floor(Number(current.earningsLocks) || 0) + extraBet),
            updatedAt: Date.now()
          },
          extraBet
        };
      }

      const resolvedRound = finishBlackjackRound(nextRound);
      const payout = Math.max(0, Math.floor(Number(resolvedRound && resolvedRound.totalPayout) || 0));
      const nextStats = normalizeStats(current.stats);
      const result = getBlackjackResultFromResolvedRound(resolvedRound);
      nextStats.plays += 1;
      nextStats.totalBet += (result ? result.bet : 0);
      nextStats.totalPayout += payout;
      nextStats.lastPlayerRoll = result ? result.playerRoll : 0;
      nextStats.lastHouseRoll = result ? result.houseRoll : 0;
      nextStats.lastPlayerReme = 0;
      nextStats.lastHouseReme = 0;
      nextStats.lastMultiplier = result ? result.multiplier : 0;
      nextStats.lastOutcome = result ? result.outcome : "lose";
      nextStats.lastPlayerName = round.playerName || "";
      nextStats.lastAt = Date.now();

      return {
        kind: "resolved",
        next: {
          ...current,
          blackjackRound: resolvedRound,
          earningsLocks: Math.max(0, Math.floor(Number(current.earningsLocks) || 0) + extraBet - payout),
          stats: nextStats,
          updatedAt: Date.now()
        },
        extraBet,
        payout,
        result
      };
    }

    function spin(mode) {
      if (!modalCtx) return;
      const modeKey = String(mode || "normal").toLowerCase();
      const actionMode = modeKey === "buybonus" ? "buybonus" : "normal";
      const post = opts.postLocalSystemChat || (() => { });
      const tx = Math.floor(Number(modalCtx.tx));
      const ty = Math.floor(Number(modalCtx.ty));
      const machine = getLocal(tx, ty) || {
        ownerAccountId: "",
        ownerName: "",
        type: "reme_roulette",
        earningsLocks: 0,
        stats: normalizeStats({}),
        updatedAt: 0
      };
      const def = MACHINE_DEFS[machine.type] || MACHINE_DEFS.reme_roulette;
      const isMobileUi = Boolean(get("getIsMobileUi", false));
      if ((def.id === "slots_v2" || def.id === "le_bandit" || def.id === "slots_v3" || def.id === "slots_v4" || def.id === "slots_v6") && isMobileUi) {
        post(def.name + " is desktop-only.");
        return;
      }
      const els = getModalEls();
      const betInput = els.body ? els.body.querySelector("[data-gamble-input='bet']") : null;
      const bankLocal = Math.max(0, Math.floor(Number(machine.earningsLocks) || 0));
      const maxBetByBank = getMaxBetByBank(bankLocal, def, getMachineMaxBetCap(machine, def));
      if (maxBetByBank < def.minBet) {
        post("Machine bank is too low.");
        return;
      }
      const bet = Math.max(def.minBet, Math.min(maxBetByBank, Math.floor(Number(betInput && betInput.value) || 0)));
      const hasFreeSpin = false;
      const effectiveBet = bet;
      lastBetByTile.set(getTileKey(tx, ty), bet);
      const inventory = get("getInventory", {}) || {};
      const haveLocal = getTotalLocks(inventory);
      const buyX = 10;
      const wagerPreview = ((def.id === "slots_v2" || def.id === "le_bandit") && actionMode === "buybonus")
        ? (effectiveBet * buyX)
        : (hasFreeSpin ? 0 : effectiveBet);
      const coveragePreview = effectiveBet * Math.max(1, Math.floor(Number(def.maxPayoutMultiplier) || 3));
      if (bankLocal < coveragePreview) {
        post("Machine bank is too low for this stake.");
        return;
      }
      if (haveLocal < wagerPreview) {
        post("Not enough World Locks. Need " + wagerPreview + ".");
        return;
      }

      const network = get("getNetwork", null);
      const basePath = String(get("getBasePath", "") || "");
      const profileId = String(get("getPlayerProfileId", "") || "");
      const profileName = String(get("getPlayerName", "") || "").slice(0, 20);
      const firebaseRef = get("getFirebase", null);
      const scheduleSlotsBonusReplay = () => {
        if (!modalCtx || modalCtx.tx !== tx || modalCtx.ty !== ty) return;
        const replay = modalCtx.slotsV2Bonus;
        const frames = replay && Array.isArray(replay.frames) ? replay.frames : [];
        const stepMs = 360;
        if (!frames.length) return;
        for (let i = 1; i <= frames.length; i++) {
          setTimeout(() => {
            if (!modalCtx || modalCtx.tx !== tx || modalCtx.ty !== ty) return;
            renderOpen();
          }, i * stepMs);
        }
      };

      // slots_v2 bonus buy is resolved through the normal spin transaction path using mode=buybonus

      if (def.id === "slots_v2" || def.id === "le_bandit" || def.id === "slots_v3" || def.id === "slots_v4" || def.id === "slots_v6") {
        const rollingUntil = Date.now() + 1100;
        modalCtx = { ...(modalCtx || {}), tx, ty, spectating: Boolean(modalCtx && modalCtx.spectating), rollingUntil };
        renderOpen();
        for (let i = 1; i <= 6; i++) {
          setTimeout(() => {
            if (!modalCtx) return;
            if (modalCtx.tx !== tx || modalCtx.ty !== ty) return;
            renderOpen();
          }, i * 140);
        }
        setTimeout(() => {
          if (!modalCtx) return;
          if (modalCtx.tx !== tx || modalCtx.ty !== ty) return;
          renderOpen();
        }, 1150);
      }

      if (def.id === "blackjack") {
        const existingRound = normalizeBlackjackRound(machine.blackjackRound);
        if (existingRound && existingRound.active && !existingRound.resolved) {
          post("Blackjack round already in progress.");
          renderModal(tx, ty, machine, Boolean(modalCtx && modalCtx.spectating));
          return;
        }
        const finalizeLocalStart = () => {
          const current = getLocal(tx, ty) || machine;
          const start = startBlackjackRoundSnapshot(current, bet, profileId, profileName);
          if (!start || !start.next) {
            post("Machine bank changed. Max bet is now " + getMaxBetByBank(Math.max(0, Math.floor(Number(current.earningsLocks) || 0)), def, getMachineMaxBetCap(current, def)) + " WL.");
            renderModal(tx, ty, current);
            return;
          }
          if (!spendLocksLocal(inventory, start.bet)) {
            post("Not enough World Locks.");
            return;
          }
          setLocal(tx, ty, start.next);
          if (typeof opts.saveInventory === "function") opts.saveInventory();
          if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
          renderModal(tx, ty, start.next);
          const startedRound = normalizeBlackjackRound(start.next.blackjackRound);
          if (startedRound && startedRound.resolved) {
            const payout = Math.max(0, Math.floor(Number(start.payout) || 0));
            if (payout > 0) {
              addLocksLocal(inventory, payout);

            }
            const result = start.result || getBlackjackResultFromResolvedRound(startedRound);
            post(getOutcomeMessage(result || { gameType: "blackjack", bet: start.bet, outcome: "lose" }, payout));
            if (typeof opts.saveInventory === "function") opts.saveInventory();
            if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
          } else {
            post("Blackjack round started. Choose Hit, Stand, Double or Split.");
          }
        };

        if (!network || !network.enabled || !network.db || !basePath || !profileId) {
          finalizeLocalStart();
          return;
        }
        const lockRefBj = network.db.ref(basePath + "/player-inventories/" + profileId);
        const machineRefBj = getMachineRef(tx, ty);
        if (!machineRefBj) {
          finalizeLocalStart();
          return;
        }
        lockRefBj.transaction((currentRaw) => {
          const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
          const have = getTotalLocks(current);
          if (have < bet) return;
          setCanonicalLocks(current, have - bet);
          return current;
        }).then((deductTxn) => {
          if (!deductTxn || !deductTxn.committed) {
            post("Not enough World Locks.");
            return null;
          }
          return machineRefBj.transaction((currentRaw) => {
            const update = startBlackjackRoundSnapshot(currentRaw, bet, profileId, profileName);
            if (!update || !update.next) return;
            return update.next;
          }).then((machineTxn) => {
            if (!machineTxn || !machineTxn.committed) {
              lockRefBj.transaction((currentRaw) => {
                const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
                addLocksLocal(current, bet);

                return current;
              }).catch(() => { });
              post("Failed to start blackjack.");
              return null;
            }
            const raw = machineTxn.snapshot && typeof machineTxn.snapshot.val === "function" ? machineTxn.snapshot.val() : null;
            setLocal(tx, ty, raw);
            if (typeof opts.saveInventory === "function") opts.saveInventory();
            if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
            renderModal(tx, ty, getLocal(tx, ty));
            const startedRound = normalizeBlackjackRound(raw && raw.blackjackRound);
            if (startedRound && startedRound.resolved) {
              const result = getBlackjackResultFromResolvedRound(startedRound);
              const payout = result ? result.payout : 0;
              if (payout > 0) {
                return lockRefBj.transaction((currentRaw) => {
                  const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
                  addLocksLocal(current, payout);

                  return current;
                }).then(() => {
                  if (typeof opts.saveInventory === "function") opts.saveInventory();
                  if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
                  post(getOutcomeMessage(result || { gameType: "blackjack", bet, outcome: "lose" }, payout));
                  return true;
                });
              }
              post(getOutcomeMessage(result || { gameType: "blackjack", bet, outcome: "lose" }, 0));
              return true;
            }
            post("Blackjack round started. Choose Hit, Stand, Double or Split.");
            return true;
          });
        }).catch(() => {
          post("Failed to start blackjack.");
        });
        return;
      }

      const result = (() => {
        if (def.id === "slots" || def.id === "slots_v2" || def.id === "le_bandit" || def.id === "slots_v3" || def.id === "slots_v4" || def.id === "slots_v6") {
          return evaluateSlots(def, effectiveBet, { mode: actionMode, buyX });
        }
        const playerRoll = Math.floor(Math.random() * (def.maxRoll - def.minRoll + 1)) + def.minRoll;
        const houseRoll = Math.floor(Math.random() * (def.maxRoll - def.minRoll + 1)) + def.minRoll;
        return evaluateSpin(def, playerRoll, houseRoll, effectiveBet);
      })();
      const coverageStake = (def.id === "slots_v2" || def.id === "le_bandit")
        ? Math.max(def.minBet, Math.floor(Number(effectiveBet) || def.minBet))
        : Math.max(def.minBet, Math.floor(Number(result && result.bet) || effectiveBet));
      const wager = Math.max(1, Math.floor(Number(result && result.bet) || effectiveBet));
      result.gameType = def.id;
      const slotsBonusView = (def.id === "slots_v2" && result && result.bonusView && typeof result.bonusView === "object")
        ? result.bonusView
        : null;
      result.coverageBet = coverageStake;
      result.bankBet = Math.max(0, Math.floor(Number(result.bet) || effectiveBet));
      result.isFreeSpin = false;
      if (haveLocal < wager) {
        post("Not enough World Locks. Need " + wager + ".");
        return;
      }

      const finalizeLocal = () => {
        const current = getLocal(tx, ty) || machine;
        const beforeBank = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
        const needsCoverage = coverageStake * Math.max(1, Math.floor(Number(def.maxPayoutMultiplier) || 3));
        if (beforeBank < needsCoverage) {
          post("Machine bank changed. Max bet is now " + getMaxBetByBank(beforeBank, def, getMachineMaxBetCap(current, def)) + " WL.");
          renderModal(tx, ty, current);
          return;
        }
        const payout = Math.max(0, Math.floor(Number(result.payoutWanted) || 0));
        setCanonicalLocks(inventory, Math.max(0, haveLocal - wager));
        const nextStats = normalizeStats(current.stats);
        nextStats.plays += 1;
        nextStats.totalBet += wager;
        nextStats.totalPayout += payout;
        nextStats.lastPlayerRoll = result.playerRoll;
        nextStats.lastHouseRoll = result.houseRoll;
        nextStats.lastPlayerReme = result.playerReme;
        nextStats.lastHouseReme = result.houseReme;
        nextStats.lastMultiplier = result.multiplier;
        nextStats.lastOutcome = result.outcome;
        nextStats.lastSlotsText = Array.isArray(result.reels) ? result.reels.join(" | ") : "";
        nextStats.lastSlotsSummary = String(result.slotsSummary || "").slice(0, 180);
        nextStats.lastSlotsLines = String(result.slotsLines || "").slice(0, 220);
        nextStats.lastSlotsLineIds = String(result.slotsLineIds || "").slice(0, 120);
        nextStats.lastSlotsGameId = String(result.slotsGameId || "").slice(0, 24);
        nextStats.lastPlayerName = profileName;
        nextStats.lastAt = Date.now();
        const nextMachine = {
          ...current,
          earningsLocks: Math.max(0, beforeBank + wager - payout),
          stats: nextStats,
          updatedAt: Date.now()
        };
        setLocal(tx, ty, nextMachine);
        if ((def.id === "slots_v2" || def.id === "le_bandit") && actionMode === "buybonus") {
          post("Bought bonus for " + (effectiveBet * buyX) + " WL.");
        }
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
        if ((def.id === "slots_v2" || def.id === "le_bandit") && modalCtx && modalCtx.tx === tx && modalCtx.ty === ty) {
          modalCtx = {
            ...modalCtx,
            slotsV2Bonus: slotsBonusView,
            slotsV2BonusStartedAt: slotsBonusView ? Date.now() : 0
          };
          scheduleSlotsBonusReplay();
        }
        try {
          renderModal(tx, ty, nextMachine);
        } catch (renderErr) {
          post("Spin render error: " + String(renderErr && renderErr.message ? renderErr.message : renderErr));
        }
        const outcomeMsg = getOutcomeMessage(result, payout);
        if (outcomeMsg) post(outcomeMsg);
        if (payout > 0) {
          const delayMs = getSlotsRevealDelayMs(def.id, slotsBonusView);
          setTimeout(() => {
            try {
              addLocksLocal(inventory, payout);
              if (typeof opts.saveInventory === "function") opts.saveInventory();
              if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);

              post("Payout credited: +" + payout + " WL.");
            } catch (_) { }
          }, Math.max(0, delayMs));
        }
      };

      if (!network || !network.enabled || !network.db || !basePath || !profileId) {
        finalizeLocal();
        return;
      }

      const lockRef = network.db.ref(basePath + "/player-inventories/" + profileId);
      const machineRef = getMachineRef(tx, ty);
      if (!machineRef) {
        finalizeLocal();
        return;
      }

      lockRef.transaction((currentRaw) => {
        const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
        const have = getTotalLocks(current);
        if (have < wager) return;
        setCanonicalLocks(current, have - wager);
        return current;
      }).then((deductResult) => {
        if (!deductResult.committed) {
          post("Not enough World Locks.");
          return Promise.resolve(null);
        }
        let payout = 0;
        let spinAbortReason = "";
        return machineRef.transaction((currentRaw) => {
          try {
            const current = normalizeRecord(currentRaw);
            if (!current) {
              spinAbortReason = "Machine state unavailable.";
              return;
            }
            const currentDef = MACHINE_DEFS[current.type] || MACHINE_DEFS.reme_roulette;
            const beforeBank = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
            const needsCoverage = Math.max(1, Math.floor(Number(result.coverageBet) || 1)) * Math.max(1, Math.floor(Number(currentDef.maxPayoutMultiplier) || 3));
            if (beforeBank < needsCoverage) {
              spinAbortReason = "Machine bank changed. Need " + needsCoverage + " WL coverage, has " + beforeBank + ".";
              return;
            }
            const update = updateMachineAfterSpin(currentRaw, result, profileName, firebaseRef);
            if (!update) {
              spinAbortReason = "Machine update rejected.";
              return;
            }
            payout = update.payout;
            return update.next;
          } catch (err) {
            spinAbortReason = "Machine spin error: " + String(err && err.message ? err.message : err);
            return;
          }
        }).then((machineTxn) => {
          if (!machineTxn || !machineTxn.committed) {
            lockRef.transaction((currentRaw) => {
              const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
              addLocksLocal(current, wager);
              return current;
            }).catch(() => { });
            post(spinAbortReason || "Spin failed.");
            return null;
          }
          const raw = machineTxn.snapshot && typeof machineTxn.snapshot.val === "function" ? machineTxn.snapshot.val() : null;
          setLocal(tx, ty, raw);
          return { payout };
        });
      }).then((done) => {
        if (!done) return;
        if (def.id === "slots_v2" && actionMode === "buybonus") {
          post("Bought bonus for " + (effectiveBet * buyX) + " WL.");
        }
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
        const latest = getLocal(tx, ty) || machine;
        if (def.id === "slots_v2" && modalCtx && modalCtx.tx === tx && modalCtx.ty === ty) {
          modalCtx = {
            ...modalCtx,
            slotsV2Bonus: slotsBonusView,
            slotsV2BonusStartedAt: slotsBonusView ? Date.now() : 0
          };
          scheduleSlotsBonusReplay();
        }
        try {
          renderModal(tx, ty, latest);
        } catch (renderErr) {
          post("Spin render error: " + String(renderErr && renderErr.message ? renderErr.message : renderErr));
        }
        const outcomeMsg = getOutcomeMessage(result, done.payout);
        if (outcomeMsg) post(outcomeMsg);
        if (done.payout > 0) {
          const delayMs = getSlotsRevealDelayMs(def.id, slotsBonusView);
          setTimeout(() => {
            try {
              lockRef.transaction((currentRaw) => {
                const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
                addLocksLocal(current, done.payout);
                return current;
              }).then((payTxn) => {
                if (!payTxn || !payTxn.committed) {
                  post("Spin payout failed.");
                  return;
                }
                if (typeof opts.saveInventory === "function") opts.saveInventory();
                if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
                post("Payout credited: +" + done.payout + " WL.");
              }).catch(() => {
                post("Spin payout failed.");
              });
            } catch (_) { }
          }, Math.max(0, delayMs));
        }
      }).catch((err) => {
        post("Spin failed: " + String(err && err.message ? err.message : err || "unknown"));
      });
    }

    function performBlackjackAction(action) {
      if (!modalCtx) return;
      const tx = Math.floor(Number(modalCtx.tx));
      const ty = Math.floor(Number(modalCtx.ty));
      const post = opts.postLocalSystemChat || (() => { });
      const machine = getLocal(tx, ty);
      if (!machine || String(machine.type || "") !== "blackjack") {
        post("Blackjack is not active on this machine.");
        return;
      }
      const profileId = String(get("getPlayerProfileId", "") || "");
      const inventory = get("getInventory", {}) || {};
      const network = get("getNetwork", null);
      const basePath = String(get("getBasePath", "") || "");

      const applyLocal = () => {
        const current = getLocal(tx, ty) || machine;
        const preview = applyBlackjackActionToMachine(current, action, profileId);
        if (!preview || preview.kind === "error") {
          post("Action not allowed.");
          renderModal(tx, ty, current, Boolean(modalCtx && modalCtx.spectating));
          return;
        }
        const extra = Math.max(0, Math.floor(Number(preview.extraBet) || 0));
        if (extra > 0 && !spendLocksLocal(inventory, extra)) {
          post("Not enough WL for " + action + ".");
          return;
        }
        setLocal(tx, ty, preview.next);
        if (preview.kind === "resolved" && preview.payout > 0) {
          addLocksLocal(inventory, preview.payout);
          post(getOutcomeMessage(preview.result || { gameType: "blackjack", bet: 0, outcome: "lose" }, preview.payout));
        }
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
        renderModal(tx, ty, preview.next, Boolean(modalCtx && modalCtx.spectating));
      };

      if (!network || !network.enabled || !network.db || !basePath || !profileId) {
        applyLocal();
        return;
      }

      const lockRef = network.db.ref(basePath + "/player-inventories/" + profileId);
      const machineRef = getMachineRef(tx, ty);
      if (!machineRef) {
        applyLocal();
        return;
      }
      const localPreview = applyBlackjackActionToMachine(machine, action, profileId);
      if (!localPreview || localPreview.kind === "error") {
        post("Action not allowed.");
        return;
      }
      const extraExpected = Math.max(0, Math.floor(Number(localPreview.extraBet) || 0));
      if (extraExpected > 0 && getTotalLocks(inventory) < extraExpected) {
        post("Not enough WL for " + action + ".");
        return;
      }
      const deductPromise = extraExpected > 0
        ? lockRef.transaction((currentRaw) => {
          const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
          if (!spendLocksLocal(current, extraExpected)) return;
          return current;
        })
        : Promise.resolve({ committed: true });

      let liveResult = null;
      deductPromise.then((deductTxn) => {
        if (!deductTxn || !deductTxn.committed) {
          post("Not enough WL for " + action + ".");
          return null;
        }
        return machineRef.transaction((currentRaw) => {
          const preview = applyBlackjackActionToMachine(currentRaw, action, profileId);
          if (!preview || preview.kind === "error") return;
          const liveExtra = Math.max(0, Math.floor(Number(preview.extraBet) || 0));
          if (liveExtra !== extraExpected) return;
          liveResult = preview;
          return preview.next;
        });
      }).then((machineTxn) => {
        if (!machineTxn || !machineTxn.committed || !liveResult) {
          if (extraExpected > 0) {
            lockRef.transaction((currentRaw) => {
              const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
              addLocksLocal(current, extraExpected);
              return current;
            }).catch(() => { });
          }
          post("Action failed.");
          return null;
        }
        const raw = machineTxn.snapshot && typeof machineTxn.snapshot.val === "function" ? machineTxn.snapshot.val() : null;
        setLocal(tx, ty, raw);
        if (liveResult.kind === "resolved") {
          const payout = Math.max(0, Math.floor(Number(liveResult.payout) || 0));
          if (payout > 0) {
            return lockRef.transaction((currentRaw) => {
              const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
              addLocksLocal(current, payout);
              return current;
            }).then(() => ({ payout }));
          }
        }
        return { payout: 0 };
      }).then((finalize) => {
        if (!finalize) return;
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
        const latest = getLocal(tx, ty) || machine;
        renderModal(tx, ty, latest, Boolean(modalCtx && modalCtx.spectating));
        if (liveResult && liveResult.kind === "resolved") {
          post(getOutcomeMessage(liveResult.result || { gameType: "blackjack", bet: 0, outcome: "lose" }, finalize.payout));
        }
      }).catch(() => {
        post("Action failed.");
      });
    }

    function setMachineMaxBet() {
      if (!modalCtx) return;
      const tx = Math.floor(Number(modalCtx.tx));
      const ty = Math.floor(Number(modalCtx.ty));
      const post = opts.postLocalSystemChat || (() => { });
      const machine = getLocal(tx, ty);
      if (!machine || !canCollect(machine)) {
        post("Only the machine owner can change max bet.");
        return;
      }
      if (!canEditMachineMaxBet(machine)) {
        post("World admins cannot change max bet. Only world owner + machine owner can.");
        return;
      }
      const def = MACHINE_DEFS[machine.type] || MACHINE_DEFS.reme_roulette;
      const els = getModalEls();
      const maxBetInput = els.body ? els.body.querySelector("[data-gamble-input='maxbet']") : null;
      const requestedMax = Math.floor(Number(maxBetInput && maxBetInput.value));
      const nextMax = Math.max(def.minBet, Math.min(def.maxBet, Number.isFinite(requestedMax) ? requestedMax : def.maxBet));
      const network = get("getNetwork", null);
      const basePath = String(get("getBasePath", "") || "");
      const profileId = String(get("getPlayerProfileId", "") || "");
      if (!network || !network.enabled || !network.db || !basePath || !profileId) {
        const nextMachine = {
          ...machine,
          maxBet: nextMax,
          updatedAt: Date.now()
        };
        setLocal(tx, ty, nextMachine);
        renderModal(tx, ty, nextMachine);
        post("Machine max bet set to " + nextMax + " WL.");
        return;
      }
      const machineRef = getMachineRef(tx, ty);
      if (!machineRef) return;
      machineRef.transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw) || machine;
        if (!canCollect(current)) return currentRaw;
        return {
          ...current,
          maxBet: nextMax,
          updatedAt: Date.now()
        };
      }).then((result) => {
        if (!result || !result.committed) {
          post("Failed to set max bet.");
          return;
        }
        const raw = result.snapshot && typeof result.snapshot.val === "function" ? result.snapshot.val() : null;
        setLocal(tx, ty, raw);
        renderModal(tx, ty, getLocal(tx, ty));
        post("Machine max bet set to " + nextMax + " WL.");
      }).catch(() => {
        post("Failed to set max bet.");
      });
    }

    function refillBank() {
      if (!modalCtx) return;
      const tx = Math.floor(Number(modalCtx.tx));
      const ty = Math.floor(Number(modalCtx.ty));
      const post = opts.postLocalSystemChat || (() => { });
      const machine = getLocal(tx, ty);
      if (!machine || !canManageMachineAdvanced(machine)) {
        post("Only world owner + machine owner can refill.");
        return;
      }
      const els = getModalEls();
      const refillInput = els.actions ? els.actions.querySelector("[data-gamble-input='refill']") : null;
      const amount = Math.max(1, Math.floor(Number(refillInput && refillInput.value) || 0));
      const inventory = get("getInventory", {}) || {};
      const haveLocal = getTotalLocks(inventory);
      if (haveLocal < amount) {
        post("Not enough WL to refill. Need " + amount + ".");
        return;
      }
      const network = get("getNetwork", null);
      const basePath = String(get("getBasePath", "") || "");
      const profileId = String(get("getPlayerProfileId", "") || "");
      if (!network || !network.enabled || !network.db || !basePath || !profileId) {
        setCanonicalLocks(inventory, haveLocal - amount);
        const nextMachine = { ...machine, earningsLocks: Math.max(0, Math.floor(Number(machine.earningsLocks) || 0) + amount), updatedAt: Date.now() };
        setLocal(tx, ty, nextMachine);
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
        renderModal(tx, ty, nextMachine);
        post("Refilled machine by " + amount + " WL.");
        return;
      }
      const lockRef = network.db.ref(basePath + "/player-inventories/" + profileId);
      const machineRef = getMachineRef(tx, ty);
      if (!machineRef) return;
      lockRef.transaction((currentRaw) => {
        const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
        const have = getTotalLocks(current);
        if (have < amount) return;
        setCanonicalLocks(current, have - amount);
        return current;
      }).then((deductTxn) => {
        if (!deductTxn || !deductTxn.committed) {
          post("Not enough WL to refill.");
          return Promise.resolve(false);
        }
        return machineRef.transaction((currentRaw) => {
          const current = normalizeRecord(currentRaw) || machine;
          if (!canManageMachineAdvanced(current)) return currentRaw;
          return {
            ...current,
            earningsLocks: Math.max(0, Math.floor(Number(current.earningsLocks) || 0) + amount),
            updatedAt: Date.now()
          };
        }).then((machineTxn) => {
          if (!machineTxn || !machineTxn.committed) {
            lockRef.transaction((currentRaw) => {
              const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
              addLocksLocal(current, amount);
              return current;
            }).catch(() => { });
            post("Refill failed.");
            return false;
          }
          const raw = machineTxn.snapshot && typeof machineTxn.snapshot.val === "function" ? machineTxn.snapshot.val() : null;
          setLocal(tx, ty, raw);
          if (typeof opts.saveInventory === "function") opts.saveInventory();
          if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
          renderModal(tx, ty, getLocal(tx, ty));
          post("Refilled machine by " + amount + " WL.");
          return true;
        });
      }).catch(() => {
        post("Refill failed.");
      });
    }

    function collectEarnings() {
      if (!modalCtx) return;
      const tx = Math.floor(Number(modalCtx.tx));
      const ty = Math.floor(Number(modalCtx.ty));
      const post = opts.postLocalSystemChat || (() => { });
      const machine = getLocal(tx, ty);
      if (!machine || !canCollect(machine)) {
        post("Only the machine owner can collect.");
        return;
      }
      const amountLocal = Math.max(0, Math.floor(Number(machine.earningsLocks) || 0));
      if (amountLocal <= 0) {
        post("No earnings to collect.");
        return;
      }
      const inventory = get("getInventory", {}) || {};
      const network = get("getNetwork", null);
      const basePath = String(get("getBasePath", "") || "");
      const profileId = String(get("getPlayerProfileId", "") || "");

      if (!network || !network.enabled || !network.db || !basePath || !profileId) {
        const splitLocal = getTaxSplit(amountLocal, profileId);
        addLocksLocal(inventory, Math.max(0, Math.floor(Number(splitLocal.collectorShare) || 0)));
        const localTax = Math.max(0, Math.floor(Number(splitLocal.ownerShare) || 0));
        let localTaxToBank = true;
        if (localTax > 0) {
          const localTaxResult = depositTaxToLocalTaxMachine(splitLocal);
          localTaxToBank = Boolean(localTaxResult && localTaxResult.ok);
          if (!localTaxToBank) {
            addLocksLocal(inventory, localTax);
          }
        }
        const nextMachine = { ...machine, earningsLocks: 0, updatedAt: Date.now() };
        setLocal(tx, ty, nextMachine);
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
        renderModal(tx, ty, nextMachine);
        if (localTax > 0) {
          if (localTaxToBank) {
            post(
              "Collected " + amountLocal + " WL from machine (" +
              (amountLocal - localTax) + " WL to machine owner, " +
              localTax + " WL tax sent to Tax Machine at " + Math.max(0, Math.floor(Number(splitLocal.percent) || 0)) + "%)."
            );
          } else {
            post(
              "Collected " + amountLocal + " WL from machine. Tax Machine unavailable, so " +
              localTax + " WL tax was refunded to machine owner."
            );
          }
          return;
        }
        post("Collected " + amountLocal + " WL from machine.");
        return;
      }

      const machineRef = getMachineRef(tx, ty);
      if (!machineRef) return;
      const worldId = String(get("getCurrentWorldId", "") || "");
      let collected = 0;
      machineRef.transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw);
        if (!current) return currentRaw;
        if (!canCollect(current)) return currentRaw;
        collected = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
        if (collected <= 0) return currentRaw;
        return {
          ...current,
          earningsLocks: 0,
          updatedAt: Date.now()
        };
      }).then((machineTxn) => {
        if (!machineTxn || !machineTxn.committed || collected <= 0) {
          post("No earnings to collect.");
          return null;
        }
        const raw = machineTxn.snapshot && typeof machineTxn.snapshot.val === "function" ? machineTxn.snapshot.val() : null;
        setLocal(tx, ty, raw);
        const split = getTaxSplit(collected, profileId);
        const collectorGain = Math.max(0, Math.floor(Number(split.collectorShare) || 0));
        return network.db.ref(basePath + "/player-inventories/" + profileId).transaction((currentRaw) => {
          const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
          addLocksLocal(current, collectorGain);
          return current;
        }).then(() => ({ collected, split }));
      }).then((done) => {
        if (!done) return null;
        const split = done.split || {};
        const ownerShare = Math.max(0, Math.floor(Number(split.ownerShare) || 0));
        if (!ownerShare) return done;
        return depositTaxToTaxMachine(split, network, basePath, worldId).then((depositResult) => {
          if (depositResult && depositResult.ok) return done;
          return network.db.ref(basePath + "/player-inventories/" + profileId).transaction((currentRaw) => {
            const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
            addLocksLocal(current, ownerShare);
            return current;
          }).then(() => {
            done.split = {
              ...split,
              ownerShare: 0,
              collectorShare: done.collected,
              taxed: false,
              refunded: true
            };
            return done;
          }).catch(() => {
            done.split = {
              ...split,
              ownerShare: 0,
              taxed: false,
              refundFailed: true
            };
            return done;
          });
        });
      }).then((done) => {
        if (!done) return;
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
        renderModal(tx, ty, getLocal(tx, ty));
        const split = done.split || {};
        const ownerShare = Math.max(0, Math.floor(Number(split.ownerShare) || 0));
        if (ownerShare > 0) {
          post(
            "Collected " + done.collected + " WL from machine (" +
            (done.collected - ownerShare) + " WL to machine owner, " +
            ownerShare + " WL tax sent to Tax Machine at " + Math.max(0, Math.floor(Number(split.percent) || 0)) + "%)."
          );
          return;
        }
        post("Collected " + done.collected + " WL from machine.");
        if (split.refunded) {
          post("Tax Machine transfer failed. Tax amount was refunded to collector.");
        } else if (split.refundFailed) {
          post("Tax Machine transfer failed and automatic refund also failed.");
        }
      }).catch(() => {
        post("Failed to collect earnings.");
      });
    }

    function setMachineType() {
      if (!modalCtx) return;
      const tx = Math.floor(Number(modalCtx.tx));
      const ty = Math.floor(Number(modalCtx.ty));
      const post = opts.postLocalSystemChat || (() => { });
      const machine = getLocal(tx, ty);
      if (!machine || !canManageMachineAdvanced(machine)) {
        post("Only world owner + machine owner can change game type.");
        return;
      }
      const els = getModalEls();
      const typeInput = els.body ? els.body.querySelector("[data-gamble-input='type']") : null;
      const nextTypeRaw = typeInput instanceof HTMLSelectElement ? typeInput.value : "";
      const nextDef = MACHINE_DEFS[String(nextTypeRaw || "").trim()] || null;
      if (!nextDef) {
        post("Invalid game type.");
        return;
      }
      if (nextDef.id === machine.type) {
        post("Machine already uses " + nextDef.name + ".");
        return;
      }
      const network = get("getNetwork", null);
      const basePath = String(get("getBasePath", "") || "");
      const profileId = String(get("getPlayerProfileId", "") || "");
      if (!network || !network.enabled || !network.db || !basePath || !profileId) {
        const nextMachine = {
          ...machine,
          type: nextDef.id,
          maxBet: Math.max(nextDef.minBet, Math.min(nextDef.maxBet, Math.floor(Number(machine.maxBet) || nextDef.maxBet))),
          blackjackRound: null,
          stats: normalizeStats({}),
          updatedAt: Date.now()
        };
        setLocal(tx, ty, nextMachine);
        renderModal(tx, ty, nextMachine);
        post("Machine game set to " + nextDef.name + ".");
        return;
      }
      const machineRef = getMachineRef(tx, ty);
      if (!machineRef) return;
      machineRef.transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw) || machine;
        if (!canManageMachineAdvanced(current)) return currentRaw;
        return {
          ...current,
          type: nextDef.id,
          maxBet: Math.max(nextDef.minBet, Math.min(nextDef.maxBet, Math.floor(Number(current.maxBet) || nextDef.maxBet))),
          blackjackRound: null,
          stats: normalizeStats({}),
          updatedAt: Date.now()
        };
      }).then((result) => {
        if (!result || !result.committed) {
          post("Failed to change game type.");
          return;
        }
        const raw = result.snapshot && typeof result.snapshot.val === "function" ? result.snapshot.val() : null;
        setLocal(tx, ty, raw);
        renderModal(tx, ty, getLocal(tx, ty));
        post("Machine game set to " + nextDef.name + ".");
      }).catch(() => {
        post("Failed to change game type.");
      });
    }

    function handleActionClick(event) {
      const target = event && event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = String(target.dataset.gambleAct || "").trim();
      if (!action) return;
      if (modalCtx && modalCtx.spectating && action !== "close") {
        const post = opts.postLocalSystemChat || (() => { });
        post("Spectator mode is read-only.");
        return;
      }
      if (action === "maxbet") {
        if (!modalCtx) return;
        const tx = Math.floor(Number(modalCtx.tx));
        const ty = Math.floor(Number(modalCtx.ty));
        const machine = getLocal(tx, ty);
        const def = MACHINE_DEFS[(machine && machine.type) || "reme_roulette"] || MACHINE_DEFS.reme_roulette;
        const bank = Math.max(0, Math.floor(Number(machine && machine.earningsLocks) || 0));
        const byBank = getMaxBetByBank(bank, def, getMachineMaxBetCap(machine, def));
        const inventory = get("getInventory", {}) || {};
        const byPlayer = Math.max(0, Math.min(getMachineMaxBetCap(machine, def), getTotalLocks(inventory)));
        const effective = Math.max(0, Math.min(byBank, byPlayer));
        const els = getModalEls();
        const betInput = els.body ? els.body.querySelector("[data-gamble-input='bet']") : null;
        const nextBet = Math.max(def.minBet, effective || def.minBet);
        if (betInput) {
          const minBet = Math.max(1, Math.floor(Number(def.minBet) || 1));
          const maxBet = Math.max(minBet, Math.floor(Number(byBank) || minBet));
          betInput.min = String(minBet);
          betInput.max = String(maxBet);
          betInput.value = String(Math.max(minBet, Math.min(maxBet, nextBet)));
        }
        lastBetByTile.set(getTileKey(tx, ty), nextBet);
        return;
      }
      if (action === "close") {
        closeModal();
        return;
      }
      if (action === "spin") {
        spin("normal");
        return;
      }
      if (action === "buybonus") {
        spin("buybonus");
        return;
      }
      if (action === "bj-hit") {
        performBlackjackAction("hit");
        return;
      }
      if (action === "bj-stand") {
        performBlackjackAction("stand");
        return;
      }
      if (action === "bj-double") {
        performBlackjackAction("double");
        return;
      }
      if (action === "bj-split") {
        performBlackjackAction("split");
        return;
      }
      if (action === "collect") {
        collectEarnings();
        return;
      }
      if (action === "refill") {
        refillBank();
        return;
      }
      if (action === "settype") {
        setMachineType();
        return;
      }
      if (action === "setmax") {
        setMachineMaxBet();
      }
    }

    function bindModalEvents() {
      if (modalBound) return;
      modalBound = true;
      const els = getModalEls();
      if (els.closeBtn) {
        els.closeBtn.addEventListener("click", () => closeModal());
      }
      if (els.modal) {
        els.modal.addEventListener("click", (event) => {
          if (event.target === els.modal) {
            closeModal();
          }
        });
      }
      if (els.actions) {
        els.actions.addEventListener("click", handleActionClick);
      }
      if (els.body) {
        els.body.addEventListener("click", handleActionClick);
      }
    }

    function openModal(tx, ty, spectatingMode) {
      if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
      if (modalCtx && (modalCtx.tx !== tx || modalCtx.ty !== ty)) {
        closeModal();
      }
      let machine = getLocal(tx, ty);
      if (!machine) {
        machine = {
          ownerAccountId: String(get("getPlayerProfileId", "") || ""),
          ownerName: String(get("getPlayerName", "") || "").slice(0, 20),
          type: "reme_roulette",
          earningsLocks: 0,
          stats: normalizeStats({}),
          updatedAt: Date.now()
        };
        setLocal(tx, ty, machine);
      }
      seedOwner(tx, ty);
      renderModal(tx, ty, machine, Boolean(spectatingMode));
    }

    function isOpen() {
      const modal = get("getGambleModalEl", null);
      return Boolean(modalCtx && modal && !modal.classList.contains("hidden"));
    }

    function renderOpen() {
      if (!isOpen() || !modalCtx) return;
      const machine = getLocal(modalCtx.tx, modalCtx.ty);
      if (!machine) {
        closeModal();
        return;
      }
      const shouldSpectate = isUsedByOther(machine);
      modalCtx.spectating = Boolean(shouldSpectate);
      renderModal(modalCtx.tx, modalCtx.ty, machine, Boolean(modalCtx.spectating));
    }

    function interact(tx, ty) {
      const world = get("getWorld", null);
      const gambleId = Math.max(0, Math.floor(Number(get("getGambleId", 0)) || 0));
      if (!world || !world[ty] || world[ty][tx] !== gambleId) return;
      acquireMachineUsage(tx, ty).then((ok) => {
        if (ok) {
          openModal(tx, ty, false);
          return;
        }
        const current = getLocal(tx, ty);
        if (current && isUsedByOther(current)) {
          openModal(tx, ty, true);
        }
      });
    }

    function onPlaced(tx, ty) {
      setLocal(tx, ty, {
        ownerAccountId: String(get("getPlayerProfileId", "") || ""),
        ownerName: String(get("getPlayerName", "") || "").slice(0, 20),
        type: "slots",
        maxBet: MACHINE_DEFS.slots.maxBet,
        earningsLocks: 0,
        stats: normalizeStats({}),
        updatedAt: Date.now()
      });
      seedOwner(tx, ty);
    }

    function onBroken(tx, ty) {
      if (modalCtx && modalCtx.tx === tx && modalCtx.ty === ty) {
        closeModal();
      }
      setLocal(tx, ty, null);
    }

    function claimOnBreak(tx, ty) {
      const post = opts.postLocalSystemChat || (() => { });
      const machine = getLocal(tx, ty);
      if (machine && !canCollect(machine)) {
        post("Only the machine owner can break this gambling machine.");
        return;
      }
      const localBank = Math.max(0, Math.floor(Number(machine && machine.earningsLocks) || 0));
      const inventory = get("getInventory", {}) || {};
      const network = get("getNetwork", null);
      const basePath = String(get("getBasePath", "") || "");
      const profileId = String(get("getPlayerProfileId", "") || "");

      const closeAndClear = () => {
        if (modalCtx && modalCtx.tx === tx && modalCtx.ty === ty) {
          closeModal();
        } else {
          setLocal(tx, ty, null);
        }
      };

      if (!network || !network.enabled || !network.db || !basePath || !profileId) {
        if (localBank > 0) {
          const splitLocal = getTaxSplit(localBank, profileId);
          addLocksLocal(inventory, Math.max(0, Math.floor(Number(splitLocal.collectorShare) || 0)));
          const localTax = Math.max(0, Math.floor(Number(splitLocal.ownerShare) || 0));
          let localTaxToBank = true;
          if (localTax > 0) {
            const localTaxResult = depositTaxToLocalTaxMachine(splitLocal);
            localTaxToBank = Boolean(localTaxResult && localTaxResult.ok);
            if (!localTaxToBank) {
              addLocksLocal(inventory, localTax);
            }
          }
          if (typeof opts.saveInventory === "function") opts.saveInventory();
          if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
          if (localTax > 0) {
            if (localTaxToBank) {
              post(
                "Collected " + localBank + " WL from gambling machine (" +
                (localBank - localTax) + " WL to machine owner, " +
                localTax + " WL tax sent to Tax Machine at " + Math.max(0, Math.floor(Number(splitLocal.percent) || 0)) + "%)."
              );
            } else {
              post(
                "Collected " + localBank + " WL from gambling machine. Tax Machine unavailable, so " +
                localTax + " WL tax was refunded to machine owner."
              );
            }
          } else {
            post("Collected " + localBank + " WL from gambling machine.");
          }
        }
        closeAndClear();
        return;
      }

      const machineRef = getMachineRef(tx, ty);
      if (!machineRef) {
        if (localBank > 0) {
          const splitLocal = getTaxSplit(localBank, profileId);
          addLocksLocal(inventory, Math.max(0, Math.floor(Number(splitLocal.collectorShare) || 0)));
          const localTax = Math.max(0, Math.floor(Number(splitLocal.ownerShare) || 0));
          let localTaxToBank = true;
          if (localTax > 0) {
            const localTaxResult = depositTaxToLocalTaxMachine(splitLocal);
            localTaxToBank = Boolean(localTaxResult && localTaxResult.ok);
            if (!localTaxToBank) {
              addLocksLocal(inventory, localTax);
            }
          }
          if (typeof opts.saveInventory === "function") opts.saveInventory();
          if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
          if (localTax > 0) {
            if (localTaxToBank) {
              post(
                "Collected " + localBank + " WL from gambling machine (" +
                (localBank - localTax) + " WL to machine owner, " +
                localTax + " WL tax sent to Tax Machine at " + Math.max(0, Math.floor(Number(splitLocal.percent) || 0)) + "%)."
              );
            } else {
              post(
                "Collected " + localBank + " WL from gambling machine. Tax Machine unavailable, so " +
                localTax + " WL tax was refunded to machine owner."
              );
            }
          } else {
            post("Collected " + localBank + " WL from gambling machine.");
          }
        }
        closeAndClear();
        return;
      }

      const invRef = network.db.ref(basePath + "/player-inventories/" + profileId);
      const worldId = String(get("getCurrentWorldId", "") || "");
      let claimed = 0;
      machineRef.transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw);
        if (current && !canCollect(current)) return currentRaw;
        if (!current) return null;
        claimed = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
        return null; // remove machine node on successful claim
      }).then((txn) => {
        if (!txn || !txn.committed) {
          closeAndClear();
          return null;
        }
        if (claimed <= 0) {
          closeAndClear();
          return null;
        }
        const split = getTaxSplit(claimed, profileId);
        const collectorGain = Math.max(0, Math.floor(Number(split.collectorShare) || 0));
        return invRef.transaction((currentRaw) => {
          const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
          addLocksLocal(current, collectorGain);
          return current;
        }).then(() => ({ claimed, split }));
      }).then((done) => {
        if (!done) return null;
        const split = done.split || {};
        const ownerShare = Math.max(0, Math.floor(Number(split.ownerShare) || 0));
        if (!ownerShare) return done;
        return depositTaxToTaxMachine(split, network, basePath, worldId).then((depositResult) => {
          if (depositResult && depositResult.ok) return done;
          return invRef.transaction((currentRaw) => {
            const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
            addLocksLocal(current, ownerShare);
            return current;
          }).then(() => {
            done.split = {
              ...split,
              ownerShare: 0,
              collectorShare: done.claimed,
              taxed: false,
              refunded: true
            };
            return done;
          }).catch(() => {
            done.split = {
              ...split,
              ownerShare: 0,
              taxed: false,
              refundFailed: true
            };
            return done;
          });
        });
      }).then((done) => {
        closeAndClear();
        if (!done) return;
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar(true);
        const split = done.split || {};
        const ownerShare = Math.max(0, Math.floor(Number(split.ownerShare) || 0));
        if (ownerShare > 0) {
          post(
            "Collected " + done.claimed + " WL from gambling machine (" +
            (done.claimed - ownerShare) + " WL to machine owner, " +
            ownerShare + " WL tax sent to Tax Machine at " + Math.max(0, Math.floor(Number(split.percent) || 0)) + "%)."
          );
          return;
        }
        post("Collected " + done.claimed + " WL from gambling machine.");
        if (split.refunded) {
          post("Tax Machine transfer failed. Tax amount was refunded to collector.");
        } else if (split.refundFailed) {
          post("Tax Machine transfer failed and automatic refund also failed.");
        }
      }).catch(() => {
        closeAndClear();
      });
    }

    return {
      bindModalEvents,
      normalizeRecord,
      setLocal,
      getLocal,
      clearAll,
      closeModal,
      openModal,
      isOpen,
      renderOpen,
      interact,
      seedOwner,
      onPlaced,
      onBroken,
      canBreakAt,
      claimOnBreak
    };
  }

  const api = {
    MACHINE_DEFS,
    createController
  };
  const prev = window.GTModules.gamble;
  if (prev && typeof prev === "object") {
    window.GTModules.gamble = Object.assign({}, prev, api);
  } else {
    window.GTModules.gamble = api;
  }
  window.GTModules.gambling = window.GTModules.gamble;
})();
