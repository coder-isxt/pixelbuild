window.GTModules = window.GTModules || {};

(function initSlotsModule() {
  const GAME_DEFS = {
    slots: {
      id: "slots",
      name: "Slots",
      minBet: 1,
      maxBet: 30000,
      maxPayoutMultiplier: 10,
      rtp: 0.95,
      volatility: "medium",
      layout: { reels: 3, rows: 1 }
    },
    slots_v2: {
      id: "slots_v2",
      name: "Slots v2",
      minBet: 1,
      maxBet: 30000,
      maxPayoutMultiplier: 50,
      rtp: 0.96,
      volatility: "medium-high",
      layout: { reels: 5, rows: 4 }
    },
    le_bandit: {
      id: "le_bandit",
      name: "Le Bandit",
      minBet: 1,
      maxBet: 30000,
      maxPayoutMultiplier: 10000,
      rtp: 0.955,
      volatility: "high",
      layout: { reels: 6, rows: 5 }
    },
    snoop_dogg_dollars: {
      id: "snoop_dogg_dollars",
      name: "Snoop Dogg Dollars",
      minBet: 1,
      maxBet: 30000,
      maxPayoutMultiplier: 10000,
      rtp: 0.96,
      volatility: "very-high",
      layout: { reels: 6, rows: 8 }
    },
    slots_v3: {
      id: "slots_v3",
      name: "Slots v3",
      minBet: 1,
      maxBet: 30000,
      maxPayoutMultiplier: 5000,
      rtp: 0.96,
      volatility: "high",
      layout: { reels: 5, rows: 4 } //NEEDS 4 ROWS
    },
    slots_v4: {
      id: "slots_v4",
      name: "Slots v4",
      minBet: 1,
      maxBet: 30000,
      maxPayoutMultiplier: 5000,
      rtp: 0.955,
      volatility: "high",
      layout: { reels: 5, rows: 4 } //NEEDS 4 ROWS
    },
    slots_v6: {
      id: "slots_v6",
      name: "Slots v6",
      minBet: 1,
      maxBet: 30000,
      maxPayoutMultiplier: 5000,
      rtp: 0.96,
      volatility: "high",
      layout: { reels: 5, rows: 3 }
    }
  };

  const SYMBOLS_V1 = [
    { id: "cherry", icon: "CHERRY", weight: 30 },
    { id: "lemon", icon: "LEMON", weight: 28 },
    { id: "bar", icon: "BAR", weight: 20 },
    { id: "bell", icon: "BELL", weight: 14 },
    { id: "seven", icon: "SEVEN", weight: 8 }
  ];

  const SYMBOLS_V2 = [
    { id: "gem", icon: "GEM", weight: 25 },
    { id: "pickaxe", icon: "PICK", weight: 20 },
    { id: "miner", icon: "MINER", weight: 18 },
    { id: "gold", icon: "GOLD", weight: 12 },
    { id: "dynamite", icon: "DYN", weight: 10 },
    { id: "wild", icon: "WILD", weight: 9 },
    { id: "scatter", icon: "SCAT", weight: 4 },
    { id: "bonus", icon: "BONUS", weight: 2 }
  ];

  const SYMBOLS_V3 = [
    { id: "ruby", icon: "RUBY", weight: 22 },
    { id: "emerald", icon: "EMER", weight: 22 },
    { id: "club", icon: "CLUB", weight: 20 },
    { id: "ring", icon: "RING", weight: 18 },
    { id: "skull", icon: "SKULL", weight: 11 },
    { id: "reaper", icon: "REAPR", weight: 7 },
    { id: "blood", icon: "BLOOD", weight: 5 },
    { id: "wild", icon: "WILD", weight: 3 },
    { id: "scatter", icon: "SCAT", weight: 2 }
  ];

  const SYMBOLS_V4 = [
    { id: "leaf", icon: "LEAF", weight: 24 },
    { id: "stone", icon: "STON", weight: 23 },
    { id: "mask", icon: "MASK", weight: 15 },
    { id: "idol", icon: "IDOL", weight: 11 },
    { id: "oracle", icon: "ORAC", weight: 7 },
    { id: "forgotten", icon: "FRGT", weight: 4 },
    { id: "wild", icon: "WILD", weight: 4 },
    { id: "scatter", icon: "SCAT", weight: 2 }
  ];

  const SYMBOLS_V6 = [
    { id: "coin", icon: "COIN", weight: 24 },
    { id: "ore", icon: "ORE", weight: 22 },
    { id: "gem", icon: "GEM", weight: 18 },
    { id: "pick", icon: "PICK", weight: 13 },
    { id: "cart", icon: "CART", weight: 9 },
    { id: "relic", icon: "RELC", weight: 6 },
    { id: "wild", icon: "WILD", weight: 5 },
    { id: "scatter", icon: "SCAT", weight: 3 }
  ];

  const V2_ROWS = Math.max(1, Math.floor(Number(GAME_DEFS.slots_v2.layout.rows) || 3));
  const V2_REELS = Math.max(1, Math.floor(Number(GAME_DEFS.slots_v2.layout.reels) || 5));

  const PAYLINES_V2 = [
    [1, 1, 1, 1, 1], // middle
    [0, 0, 0, 0, 0], // top
    [2, 2, 2, 2, 2], // bottom
    [0, 1, 2, 1, 0], // V
    [2, 1, 0, 1, 2], // inverted V
    [0, 0, 1, 2, 2], // zig-zag
    [2, 2, 1, 0, 0], // zig-zag
    [1, 0, 1, 2, 1], // wave
    [1, 2, 1, 0, 1], // wave
    [0, 1, 1, 1, 2], // slope
    [3, 3, 3, 3, 3]  // row 4 (for 4-row slot modes)
  ];

  const PAYTABLE_V2 = {
    gem: { 3: 3, 4: 6, 5: 10 },
    pickaxe: { 3: 4, 4: 8, 5: 14 },
    miner: { 3: 5, 4: 10, 5: 18 },
    gold: { 3: 6, 4: 12, 5: 22 },
    dynamite: { 3: 8, 4: 16, 5: 28 }
  };

  const BONUS_V2 = {
    normal: {
      respins: 3,
      addChance: 0.33,
      addChanceDecay: 0.02,
      maxSpins: 60,
      coinValues: [1, 1, 2, 2, 3, 4, 5, 8, 12],
      coinWeights: [34, 26, 16, 12, 6, 3, 2, 1, 1],
      specialWeights: {
        coin: 76,
        blank: 10,
        multiplier: 5,
        bomb: 4,
        jackpot: 1,
        collect: 4
      },
      multiplierValues: [2, 3],
      multiplierWeights: [82, 18],
      bombValues: [4, 6, 8, 10, 12],
      bombWeights: [30, 26, 20, 14, 10],
      jackpotValues: [40, 60, 90],
      jackpotWeights: [72, 20, 8],
      fullScreenBonus: 90
    },
    buy: {
      // Buy-bonus profile: lower EV, more variance, real bust chance.
      respins: 3,
      addChance: 0.24,
      addChanceDecay: 0.03,
      maxSpins: 54,
      coinValues: [1, 1, 1, 1, 2, 2, 3, 4, 6],
      coinWeights: [32, 24, 18, 10, 7, 4, 3, 1, 1],
      specialWeights: {
        coin: 62,
        blank: 22,
        multiplier: 4,
        bomb: 4,
        jackpot: 1,
        collect: 7
      },
      multiplierValues: [2, 3],
      multiplierWeights: [88, 12],
      bombValues: [3, 4, 5, 6, 8],
      bombWeights: [30, 24, 22, 14, 10],
      jackpotValues: [25, 40, 60],
      jackpotWeights: [75, 18, 7],
      fullScreenBonus: 55
    }
  };

  const V3_ROWS = Math.max(1, Math.floor(Number(GAME_DEFS.slots_v3.layout.rows) || 3));
  const V3_REELS = Math.max(1, Math.floor(Number(GAME_DEFS.slots_v3.layout.reels) || 5));
  const PAYLINES_V3 = PAYLINES_V2.slice(0, 11);
  const PAYTABLE_V3 = {
    ruby: { 3: 1.4, 4: 2.2, 5: 3.8 },
    emerald: { 3: 1.6, 4: 2.6, 5: 4.4 },
    club: { 3: 1.8, 4: 3.2, 5: 5.8 },
    ring: { 3: 2.2, 4: 4.4, 5: 8.5 },
    skull: { 3: 3.8, 4: 8.6, 5: 18 },
    reaper: { 3: 6.5, 4: 15, 5: 34 },
    blood: { 3: 12, 4: 28, 5: 66 }
  };
  const BONUS_V3 = {
    initialFreeSpins: 10,
    extraSpinsOnScatter: 2,
    baseSpinMultiplierMin: 1,
    baseSpinMultiplierMax: 3,
    stackMultiplierValues: [2, 3],
    stackMultiplierWeights: [78, 22],
    stackMultiplierChanceOnWin: 0.36,
    featureWildChance: 0.42,
    featureUpgradeChance: 0.28,
    maxFeatureSpins: 60
  };
  const V4_ROWS = Math.max(1, Math.floor(Number(GAME_DEFS.slots_v4.layout.rows) || 3));
  const V4_REELS = Math.max(1, Math.floor(Number(GAME_DEFS.slots_v4.layout.reels) || 5));
  const PAYLINES_V4 = PAYLINES_V2.slice(0, 11);
  const PAYTABLE_V4 = {
    leaf: { 3: 1.3, 4: 2.3, 5: 3.9 },
    stone: { 3: 1.5, 4: 2.7, 5: 4.6 },
    mask: { 3: 2.2, 4: 4.7, 5: 9.8 },
    idol: { 3: 3.8, 4: 8.9, 5: 18.5 },
    oracle: { 3: 6.8, 4: 16.5, 5: 38 },
    forgotten: { 3: 13, 4: 31, 5: 78 }
  };
  const BONUS_V4 = {
    initialFreeSpins: 10,
    retriggerSpins: 2,
    extraWildChance: 0.34,
    expandingChance: 0.24,
    spinMultiplierMin: 1,
    spinMultiplierMax: 3,
    stackChance: 0.32,
    stackValues: [2, 3],
    stackWeights: [82, 18],
    maxFeatureSpins: 70
  };
  const V6_ROWS = Math.max(1, Math.floor(Number(GAME_DEFS.slots_v6.layout.rows) || 3));
  const V6_REELS = Math.max(1, Math.floor(Number(GAME_DEFS.slots_v6.layout.reels) || 5));
  const PAYLINES_V6 = PAYLINES_V2.slice(0, 10);
  const PAYTABLE_V6 = {
    coin: { 3: 1.2, 4: 2.1, 5: 3.6 },
    ore: { 3: 1.5, 4: 2.8, 5: 4.9 },
    gem: { 3: 2.2, 4: 4.8, 5: 9.8 },
    pick: { 3: 3.5, 4: 8.4, 5: 18 },
    cart: { 3: 5.5, 4: 13.8, 5: 30 },
    relic: { 3: 10, 4: 25, 5: 62 }
  };
  const BONUS_V6 = {
    initialFreeSpins: 8,
    retriggerSpins: 2,
    cascadeMultiplierStep: 0.5,
    baseSpinMultiplierMin: 1,
    baseSpinMultiplierMax: 3,
    growthPerWinSpin: 0.35,
    extraWildChance: 0.32,
    maxFeatureSpins: 60
  };

  const SNOOP_CFG = {
    rows: Math.max(1, Math.floor(Number(GAME_DEFS.snoop_dogg_dollars.layout.rows) || 8)),
    reels: Math.max(1, Math.floor(Number(GAME_DEFS.snoop_dogg_dollars.layout.reels) || 6)),
    rtp: Number(GAME_DEFS.snoop_dogg_dollars.rtp) || 0.96,
    clusterMin: 6,
    maxCascade: 10,
    digUpChance: 0.08,
    fsDigUpChance: 0.04,
    digIconWeights: {
      none: 91,
      scatter: 5,
      wild: 2,
      weed: 1,
      skull: 1
    },
    freeSpinsByScatters: { 3: 6, 4: 8, 5: 10, 6: 12 },
    buyBonusCosts: { 3: 80, 4: 140, 5: 220, 6: 320 },
    hypeCostX: 20,
    multiplierCellValue: 10,
    weedAddsMultiplierCells: 1,
    wildUpgradeStep: 10,
    wildUpgradeMax: 30,
    wildMarkedStart: 10,
    payoutMultiplierScale: 0.12,
    maxAppliedPayoutMultiplier: 6,
    featureDeadSpinChance: 0.68,
    featureNoClusterAttempts: 24,
    houseEdge: 0.04,
    maxRoundWinX: 300,
    maxFeatureSpins: 120,
    lowPayingSymbols: ["dimebag", "lighter", "leaf", "mic"],
    symbols: [
      { id: "dimebag", icon: "DIME", weight: 22, payouts: { 5: 0.12, 9: 0.25, 13: 0.5, 17: 0.9 } },
      { id: "lighter", icon: "LITE", weight: 20, payouts: { 5: 0.14, 9: 0.3, 13: 0.6, 17: 1.1 } },
      { id: "leaf", icon: "LEAF", weight: 18, payouts: { 5: 0.16, 9: 0.35, 13: 0.7, 17: 1.3 } },
      { id: "mic", icon: "MIC", weight: 16, payouts: { 5: 0.2, 9: 0.45, 13: 0.9, 17: 1.6 } },
      { id: "dollar", icon: "BILL", weight: 13, payouts: { 5: 0.28, 9: 0.65, 13: 1.3, 17: 2.4 } },
      { id: "chain", icon: "CHN", weight: 11, payouts: { 5: 0.36, 9: 0.85, 13: 1.7, 17: 3.2 } },
      { id: "lowrider", icon: "LOWR", weight: 8, payouts: { 5: 0.5, 9: 1.2, 13: 2.4, 17: 4.5 } },
      { id: "dogg", icon: "DOGG", weight: 6, payouts: { 5: 0.75, 9: 1.8, 13: 3.6, 17: 6.8 } },
      { id: "crown", icon: "CROW", weight: 4, payouts: { 5: 1.1, 9: 2.6, 13: 5.0, 17: 9.5 } }
    ],
    dropExtras: [
      { id: "scatter", icon: "SCAT", weight: 1 },
      { id: "wild", icon: "WILD", weight: 1 }
    ]
  };
  const SNOOP_DROP_SYMBOLS = SNOOP_CFG.symbols
    .map((row) => ({ id: row.id, icon: row.icon, weight: row.weight }))
    .concat(SNOOP_CFG.dropExtras.slice());
  const SNOOP_KEY_LIST = (() => {
    const out = [];
    for (let r = 0; r < SNOOP_CFG.rows; r++) {
      for (let c = 0; c < SNOOP_CFG.reels; c++) out.push(r + "_" + c);
    }
    return out;
  })();

  function cloneDef(row) {
    const def = row || GAME_DEFS.slots;
    return {
      id: String(def.id || "slots"),
      name: String(def.name || "Slots"),
      minBet: Math.max(1, Math.floor(Number(def.minBet) || 1)),
      maxBet: Math.max(1, Math.floor(Number(def.maxBet) || 30000)),
      maxPayoutMultiplier: Math.max(1, Math.floor(Number(def.maxPayoutMultiplier) || 10)),
      rtp: Number(def.rtp) || 0.95,
      volatility: String(def.volatility || "medium"),
      layout: {
        reels: Math.max(1, Math.floor(Number(def.layout && def.layout.reels) || 3)),
        rows: Math.max(1, Math.floor(Number(def.layout && def.layout.rows) || 1))
      }
    };
  }

  function getDefinitions() {
    const out = {};
    const ids = Object.keys(GAME_DEFS);
    for (let i = 0; i < ids.length; i++) {
      out[ids[i]] = cloneDef(GAME_DEFS[ids[i]]);
    }
    return out;
  }

  function pickWeighted(symbols) {
    const safe = Array.isArray(symbols) ? symbols : [];
    let total = 0;
    for (let i = 0; i < safe.length; i++) total += Math.max(1, Math.floor(Number(safe[i].weight) || 1));
    let roll = Math.floor(Math.random() * Math.max(1, total));
    for (let i = 0; i < safe.length; i++) {
      roll -= Math.max(1, Math.floor(Number(safe[i].weight) || 1));
      if (roll < 0) return safe[i];
    }
    return safe[0] || { id: "none", icon: "?" };
  }

  function spinV1(bet) {
    const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
    const reels = [pickWeighted(SYMBOLS_V1), pickWeighted(SYMBOLS_V1), pickWeighted(SYMBOLS_V1)];
    const counts = {};
    for (let i = 0; i < reels.length; i++) {
      const id = String(reels[i] && reels[i].id || "");
      counts[id] = (counts[id] || 0) + 1;
    }
    const ids = Object.keys(counts);
    let multiplier = 0;
    let outcome = "lose";
    let summary = "No match";
    for (let i = 0; i < ids.length; i++) {
      if (counts[ids[i]] === 3) {
        if (ids[i] === "seven") {
          multiplier = 10; outcome = "jackpot"; summary = "Triple seven";
        } else if (ids[i] === "bar") {
          multiplier = 6; outcome = "win"; summary = "Triple bar";
        } else {
          multiplier = 4; outcome = "win"; summary = "Triple match";
        }
        break;
      }
    }
    if (multiplier <= 0) {
      if ((counts.seven || 0) === 2) {
        multiplier = 3; outcome = "win"; summary = "Double seven";
      } else if (ids.some((id) => counts[id] === 2)) {
        multiplier = 2; outcome = "win"; summary = "Double match";
      }
    }
    return {
      gameId: "slots",
      bet: safeBet,
      reels: reels.map((r) => String(r && r.icon || "?")),
      multiplier,
      payoutWanted: Math.max(0, Math.floor(safeBet * multiplier)),
      outcome,
      summary
    };
  }

  function buildGridV2() {
    const rows = V2_ROWS;
    const cols = V2_REELS;
    const grid = [];
    for (let r = 0; r < rows; r++) grid[r] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        grid[r][c] = pickWeighted(SYMBOLS_V2);
      }
    }
    return grid;
  }

  function normalizePattern(pattern, cols, rows) {
    const out = [];
    const safeCols = Math.max(1, Math.floor(Number(cols) || V2_REELS));
    const safeRows = Math.max(1, Math.floor(Number(rows) || V2_ROWS));
    const arr = Array.isArray(pattern) ? pattern : [];
    const fallback = Math.max(0, Math.min(safeRows - 1, Math.floor(Number(arr[arr.length - 1]) || 0)));
    for (let c = 0; c < safeCols; c++) {
      const row = Math.max(0, Math.min(safeRows - 1, Math.floor(Number(arr[c]) || fallback)));
      out.push(row);
    }
    return out;
  }

  function gridToTextRows(grid) {
    const safe = Array.isArray(grid) ? grid : [];
    const out = [];
    for (let r = 0; r < safe.length; r++) {
      const row = Array.isArray(safe[r]) ? safe[r] : [];
      out.push(row.map((cell) => String(cell && cell.icon || "?")).join(","));
    }
    return out;
  }

  function getLineSymbols(grid, pattern) {
    const out = [];
    const maxRow = Math.max(0, (Array.isArray(grid) ? grid.length : 0) - 1);
    for (let c = 0; c < pattern.length; c++) {
      const r = Math.max(0, Math.min(maxRow, Math.floor(Number(pattern[c]) || 0)));
      const cell = (grid[r] && grid[r][c]) ? grid[r][c] : { id: "none", icon: "?" };
      out.push(cell);
    }
    return out;
  }

  function resolveLineBaseSymbol(line) {
    for (let i = 0; i < line.length; i++) {
      const id = String(line[i] && line[i].id || "");
      if (id && id !== "wild" && id !== "scatter" && id !== "bonus") return id;
    }
    return "";
  }

  function evaluatePayline(line, betPerLine) {
    const base = resolveLineBaseSymbol(line);
    if (!base) return { multiplier: 0, matchCount: 0, symbol: "", text: "" };
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      const id = String(line[i] && line[i].id || "");
      if (id === base || id === "wild") count += 1;
      else break;
    }
    if (count < 3) return { multiplier: 0, matchCount: count, symbol: base, text: "" };
    const row = PAYTABLE_V2[base] || {};
    const lineMult = Math.max(0, Number(row[count]) || 0);
    return {
      multiplier: lineMult,
      matchCount: count,
      symbol: base,
      text: base.toUpperCase() + " x" + count + " (" + lineMult + "x line)"
    };
  }

  function runMiningBonus(safeBet) {
    const mode = String(safeBet && safeBet.mode || "").toLowerCase() === "buy" ? "buy" : "normal";
    const safe = BONUS_V2[mode] || BONUS_V2.normal;
    const totalSlots = Math.max(1, V2_ROWS * V2_REELS);
    const trigger = Math.max(3, Math.min(totalSlots, Math.floor(Number(safeBet && safeBet.triggerCount) || 3)));
    const bet = Math.max(1, Math.floor(Number(safeBet && safeBet.bet) || 1));
    const locked = [];
    const board = new Array(totalSlots).fill(null);
    const frames = [];

    function captureFrame(respins, teaseCount) {
      const cells = [];
      for (let i = 0; i < board.length; i++) {
        const cell = board[i];
        if (!cell) {
          cells.push(".");
        } else if (cell.id === "collect") {
          cells.push("COL");
        } else if (cell.id === "multiplier") {
          cells.push("M" + Math.max(2, Math.floor(Number(cell.mult) || 2)));
        } else if (cell.id === "bomb") {
          cells.push("B" + Math.max(1, Math.floor(Number(cell.mult) || 1)));
        } else if (cell.id === "jackpot") {
          cells.push("J" + Math.max(1, Math.floor(Number(cell.mult) || 1)));
        } else {
          cells.push("C" + Math.max(1, Math.floor(Number(cell.mult) || 1)));
        }
      }
      const tease = [];
      const teaseN = Math.max(0, Math.floor(Number(teaseCount) || 0));
      if (teaseN > 0) {
        const open = [];
        for (let i = 0; i < board.length; i++) {
          if (!board[i]) open.push(i);
        }
        while (open.length && tease.length < teaseN) {
          const pick = Math.floor(Math.random() * open.length);
          tease.push(open[pick]);
          open.splice(pick, 1);
        }
      }
      frames.push({
        respins: Math.max(0, Math.floor(Number(respins) || 0)),
        filled: locked.length,
        cells,
        tease
      });
    }

    function placeOnBoard(symbol) {
      const free = [];
      for (let i = 0; i < board.length; i++) {
        if (!board[i]) free.push(i);
      }
      if (!free.length) return false;
      const idx = free[Math.floor(Math.random() * free.length)];
      board[idx] = symbol;
      return true;
    }

    function pickFrom(values, weights) {
      const arr = Array.isArray(values) ? values : [];
      const w = Array.isArray(weights) ? weights : [];
      if (!arr.length) return 0;
      let total = 0;
      for (let i = 0; i < arr.length; i++) total += Math.max(1, Math.floor(Number(w[i]) || 1));
      let roll = Math.floor(Math.random() * Math.max(1, total));
      for (let i = 0; i < arr.length; i++) {
        roll -= Math.max(1, Math.floor(Number(w[i]) || 1));
        if (roll < 0) return arr[i];
      }
      return arr[0];
    }

    function pickBonusSymbol() {
      const bag = [
        { id: "coin", weight: safe.specialWeights.coin },
        { id: "blank", weight: safe.specialWeights.blank },
        { id: "multiplier", weight: safe.specialWeights.multiplier },
        { id: "bomb", weight: safe.specialWeights.bomb },
        { id: "jackpot", weight: safe.specialWeights.jackpot },
        { id: "collect", weight: safe.specialWeights.collect }
      ];
      const row = pickWeighted(bag);
      const id = String(row && row.id || "coin");
      if (id === "coin") {
        return { id: "coin", mult: Math.max(1, Number(pickFrom(safe.coinValues, safe.coinWeights)) || 5) };
      }
      if (id === "multiplier") {
        return { id: "multiplier", mult: Math.max(2, Number(pickFrom(safe.multiplierValues, safe.multiplierWeights)) || 2) };
      }
      if (id === "bomb") {
        return { id: "bomb", mult: Math.max(1, Number(pickFrom(safe.bombValues, safe.bombWeights)) || 8) };
      }
      if (id === "jackpot") {
        return { id: "jackpot", mult: Math.max(10, Number(pickFrom(safe.jackpotValues, safe.jackpotWeights)) || 80) };
      }
      if (id === "blank") {
        return { id: "blank", mult: 0 };
      }
      return { id: "collect", mult: 0 };
    }

    for (let i = 0; i < trigger && locked.length < totalSlots; i++) {
      const s = { id: "coin", mult: Math.max(1, Number(pickFrom(safe.coinValues, safe.coinWeights)) || 5) };
      if (!placeOnBoard(s)) break;
      locked.push(s);
    }
    captureFrame(Math.max(1, Math.floor(Number(safe.respins) || 3)));

    let respins = Math.max(1, Math.floor(Number(safe.respins) || 3));
    let spins = 0;
    while (respins > 0 && locked.length < totalSlots && spins < safe.maxSpins) {
      spins += 1;
      const chance = Math.max(0.08, Number(safe.addChance) - (spins * Number(safe.addChanceDecay || 0)));
      if (Math.random() < chance) {
        const left = totalSlots - locked.length;
        const addCount = Math.max(1, Math.min(left, Math.random() < 0.22 ? 2 : 1));
        captureFrame(respins, Math.max(1, Math.min(4, left)));
        for (let a = 0; a < addCount; a++) {
          if (locked.length >= totalSlots) break;
          const s = pickBonusSymbol();
          if (!placeOnBoard(s)) break;
          locked.push(s);
        }
        respins = Math.max(1, Math.floor(Number(safe.respins) || 3));
        captureFrame(respins);
      } else {
        captureFrame(respins, Math.max(1, Math.min(3, totalSlots - locked.length)));
        respins -= 1;
        captureFrame(respins);
      }
    }

    let coinMult = 0;
    let multiplierMult = 1;
    let bombMult = 0;
    let jackpotMult = 0;
    let collectCount = 0;
    const labelList = [];
    for (let i = 0; i < locked.length; i++) {
      const s = locked[i];
      const id = String(s && s.id || "coin");
      const mult = Math.max(0, Number(s && s.mult) || 0);
      if (id === "coin") {
        coinMult += mult;
        labelList.push("C" + mult);
      } else if (id === "multiplier") {
        multiplierMult *= Math.max(2, mult);
        labelList.push("M" + Math.max(2, mult));
      } else if (id === "bomb") {
        bombMult += mult;
        labelList.push("B" + mult);
      } else if (id === "jackpot") {
        jackpotMult += mult;
        labelList.push("J" + mult);
      } else if (id === "blank") {
        labelList.push("X");
      } else {
        collectCount += 1;
        labelList.push("COL");
      }
    }

    const collectMult = collectCount > 0 ? (coinMult * collectCount) : 0;
    const fullScreen = locked.length >= totalSlots;
    const fullScreenMult = fullScreen ? Math.max(0, Number(safe.fullScreenBonus) || 0) : 0;
    const preMul = Math.max(0, coinMult + bombMult + jackpotMult + collectMult + fullScreenMult);
    const totalMult = Math.max(0, preMul * Math.max(1, multiplierMult));
    const payout = Math.max(0, Math.floor(bet * totalMult));
    const summary =
      "Hold&Spin " + totalMult + "x (" +
      locked.length + "/" + totalSlots +
      ", coin " + coinMult +
      ", mult x" + multiplierMult +
      (bombMult > 0 ? (", bomb " + bombMult) : "") +
      (jackpotMult > 0 ? (", jackpot " + jackpotMult) : "") +
      (collectMult > 0 ? (", collect " + collectMult) : "") +
      (fullScreen ? ", FULL" : "") +
      ")";

    return {
      triggered: true,
      payout,
      multiplier: totalMult,
      summary,
      picks: labelList.slice(0, 24),
      filled: locked.length,
      totalSlots,
      fullScreen,
      bonusView: {
        rows: V2_ROWS,
        reels: V2_REELS,
        frames: frames.slice(0, 96)
      }
    };
  }

  function evaluateV2Grid(grid, safeBet, options) {
    const opts = options && typeof options === "object" ? options : {};
    const safeGrid = Array.isArray(grid) ? grid : buildGridV2();
    const cols = (safeGrid[0] && safeGrid[0].length) || V2_REELS;
    const paylines = PAYLINES_V2.map((p) => normalizePattern(p, cols, safeGrid.length));
    const paylineCount = paylines.length;
    const betPerLine = safeBet / paylineCount;
    let totalMultiplier = 0;
    const lineWins = [];
    let scatterCount = 0;
    let bonusCount = 0;

    for (let r = 0; r < safeGrid.length; r++) {
      for (let c = 0; c < safeGrid[r].length; c++) {
        const id = String(safeGrid[r][c] && safeGrid[r][c].id || "");
        if (id === "scatter") scatterCount += 1;
        if (id === "bonus") bonusCount += 1;
      }
    }

    const lineIds = [];
    for (let i = 0; i < paylines.length; i++) {
      const line = getLineSymbols(safeGrid, paylines[i]);
      const evalLine = evaluatePayline(line, betPerLine);
      if (evalLine.multiplier > 0) {
        totalMultiplier += evalLine.multiplier / paylineCount;
        lineWins.push("L" + (i + 1) + " " + evalLine.text);
        lineIds.push(i + 1);
      }
    }

    if (scatterCount >= 3 && opts.allowScatterPayout !== false) {
      const scatterMult = scatterCount >= 5 ? 10 : (scatterCount === 4 ? 5 : 2);
      totalMultiplier += scatterMult;
      lineWins.push("SCATTER x" + scatterCount + " (" + scatterMult + "x)");
    }

    let bonus = null;
    if (bonusCount >= 3 && opts.allowBonus !== false) {
      bonus = runMiningBonus({ bet: safeBet, triggerCount: bonusCount });
    }

    const basePayout = Math.max(0, Math.floor(safeBet * totalMultiplier));
    const bonusPayout = bonus && bonus.triggered ? Math.max(0, Math.floor(Number(bonus.payout) || 0)) : 0;
    const payoutWanted = basePayout + bonusPayout;
    const finalMultiplier = safeBet > 0 ? Number((payoutWanted / safeBet).toFixed(2)) : 0;

    let outcome = "lose";
    if (finalMultiplier >= 20) outcome = "jackpot";
    else if (finalMultiplier > 0) outcome = "win";

    const summary = lineWins.length
      ? lineWins.slice(0, 3).join(" | ")
      : "No winning paylines";
    const bonusSummary = bonus && bonus.triggered
      ? (bonus.summary + " [" + bonus.picks.join(", ") + "]")
      : "";

    return {
      reels: gridToTextRows(safeGrid), // 3 row strings, csv by reel
      multiplier: finalMultiplier,
      payoutWanted,
      outcome,
      summary: bonusSummary ? (summary + " | " + bonusSummary) : summary,
      paylines: paylineCount,
      lineIds,
      lineWins,
      scatterCount,
      bonusTriggered: Boolean(bonus && bonus.triggered),
      bonusView: bonus && bonus.triggered ? (bonus.bonusView || null) : null
    };
  }

  function spinV2(bet, options) {
    const opts = options && typeof options === "object" ? options : {};
    const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
    const buyX = 10;
    const boughtBonus = String(opts.mode || "").toLowerCase() === "buybonus";
    const wager = safeBet * (boughtBonus ? buyX : 1);
    const baseGrid = buildGridV2();
    const base = evaluateV2Grid(
      baseGrid,
      safeBet,
      boughtBonus
        ? { allowScatterPayout: false, allowBonus: false }
        : { allowScatterPayout: true, allowBonus: true }
    );
    const allLineWins = Array.isArray(base.lineWins) ? base.lineWins.slice(0, 14) : [];
    const allLineIds = Array.isArray(base.lineIds) ? base.lineIds.slice(0, 12) : [];
    const summaryParts = [String(base.summary || "No winning paylines")];

    let boughtBonusPayout = 0;
    let boughtBonusSummary = "";
    let boughtBonusView = null;
    if (boughtBonus) {
      const bonusRound = runMiningBonus({ bet: safeBet, triggerCount: 5, mode: "buy" });
      boughtBonusPayout = Math.max(0, Math.floor(Number(bonusRound && bonusRound.payout) || 0));
      boughtBonusSummary = String(bonusRound && bonusRound.summary || "").slice(0, 220);
      boughtBonusView = bonusRound && bonusRound.bonusView ? bonusRound.bonusView : null;
      allLineWins.length = 0;
      allLineIds.length = 0;
      allLineWins.push("BUY BONUS x10 (10x bet)");
      summaryParts.length = 0;
      summaryParts.push("Bought bonus for " + wager + " WL.");
      if (boughtBonusSummary) summaryParts.push(boughtBonusSummary);
    }
    const resolvedBonusView = boughtBonus
      ? boughtBonusView
      : (base && base.bonusView ? base.bonusView : null);

    const uncapped = Math.max(0, (boughtBonus ? boughtBonusPayout : Math.floor(Number(base.payoutWanted) || 0)));
    const cap = wager * Math.max(1, Math.floor(Number(GAME_DEFS.slots_v2.maxPayoutMultiplier) || 50));
    const payoutWanted = Math.max(0, Math.min(cap, uncapped));
    const multiplierBase = boughtBonus ? safeBet : wager;
    const finalMultiplier = multiplierBase > 0 ? Number((payoutWanted / multiplierBase).toFixed(2)) : 0;
    const outcome = finalMultiplier >= 20 ? "jackpot" : (finalMultiplier > 0 ? "win" : "lose");

    return {
      gameId: "slots_v2",
      bet: wager,
      baseBet: safeBet,
      buyX,
      reels: base.reels,
      multiplier: finalMultiplier,
      payoutWanted,
      outcome,
      summary: summaryParts.join(" | ").slice(0, 220),
      paylines: base.paylines,
      lineIds: allLineIds.slice(0, 12),
      lineWins: allLineWins.slice(0, 18),
      scatterCount: base.scatterCount,
      bonusTriggered: Boolean(boughtBonus || base.bonusTriggered),
      freeSpinsAwarded: 0,
      freeSpinsPlayed: 0,
      freeSpinPayout: 0,
      bonusView: resolvedBonusView
    };
  }

  function buildGridV3(extraWildChance) {
    const rows = V3_ROWS;
    const cols = V3_REELS;
    const grid = [];
    const wildChance = Math.max(0, Math.min(0.7, Number(extraWildChance) || 0));
    for (let r = 0; r < rows; r++) grid[r] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (Math.random() < wildChance) {
          grid[r][c] = { id: "wild", icon: "WILD" };
        } else {
          grid[r][c] = pickWeighted(SYMBOLS_V3);
        }
      }
    }
    return grid;
  }

  function evaluatePaylineV3(line) {
    let base = "";
    for (let i = 0; i < line.length; i++) {
      const id = String(line[i] && line[i].id || "");
      if (id && id !== "wild" && id !== "scatter") {
        base = id;
        break;
      }
    }
    if (!base) return { mult: 0, text: "", count: 0 };
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      const id = String(line[i] && line[i].id || "");
      if (id === base || id === "wild") count += 1;
      else break;
    }
    if (count < 3) return { mult: 0, text: "", count };
    const row = PAYTABLE_V3[base] || {};
    const mult = Math.max(0, Number(row[count]) || 0);
    if (mult <= 0) return { mult: 0, text: "", count };
    return {
      mult,
      count,
      text: base.toUpperCase() + " x" + count + " (" + mult + "x line)"
    };
  }

  function evaluateGridV3(grid, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const payUpgrade = Math.max(0, Number(options.payUpgrade) || 0);
    const cols = (grid[0] && grid[0].length) || V3_REELS;
    const paylines = PAYLINES_V3.map((p) => normalizePattern(p, cols, grid.length));
    let scatterCount = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (String(grid[r][c] && grid[r][c].id || "") === "scatter") scatterCount += 1;
      }
    }
    let totalMult = 0;
    const lineWins = [];
    const lineIds = [];
    for (let i = 0; i < paylines.length; i++) {
      const line = getLineSymbols(grid, paylines[i]);
      const row = evaluatePaylineV3(line);
      if (row.mult > 0) {
        const up = row.mult + payUpgrade;
        totalMult += up / paylines.length;
        lineWins.push("L" + (i + 1) + " " + row.text.replace("(" + row.mult + "x line)", "(" + up + "x line)"));
        lineIds.push(i + 1);
      }
    }
    if (scatterCount >= 3 && options.allowScatterPay !== false) {
      const scat = scatterCount >= 5 ? 25 : (scatterCount === 4 ? 8 : 3);
      totalMult += scat;
      lineWins.push("SCATTER x" + scatterCount + " (" + scat + "x)");
    }
    return {
      reels: gridToTextRows(grid),
      lineWins,
      lineIds,
      scatterCount,
      baseMultiplier: totalMult
    };
  }

  function runFreeSpinsV3(safeBet, triggerScatters) {
    const start = BONUS_V3;
    let spinsLeft = Math.max(1, Math.floor(Number(start.initialFreeSpins) || 8));
    let played = 0;
    let totalPayout = 0;
    let stackedMult = 1;
    let wildBoost = 0;
    let payUpgrade = 0;
    const timeline = [];
    const trigger = Math.max(3, Math.floor(Number(triggerScatters) || 3));
    if (trigger > 3) spinsLeft += (trigger - 3);
    function pickWeightedNumber(values, weights, fallback) {
      const vals = Array.isArray(values) ? values : [];
      const w = Array.isArray(weights) ? weights : [];
      if (!vals.length) return fallback;
      let total = 0;
      for (let i = 0; i < vals.length; i++) total += Math.max(1, Math.floor(Number(w[i]) || 1));
      let roll = Math.floor(Math.random() * Math.max(1, total));
      for (let i = 0; i < vals.length; i++) {
        roll -= Math.max(1, Math.floor(Number(w[i]) || 1));
        if (roll < 0) return Number(vals[i]) || fallback;
      }
      return Number(vals[0]) || fallback;
    }
    while (spinsLeft > 0 && played < start.maxFeatureSpins) {
      spinsLeft -= 1;
      played += 1;
      const grid = buildGridV3(wildBoost);
      const spinEval = evaluateGridV3(grid, { payUpgrade, allowScatterPay: true });
      const scat = spinEval.scatterCount;
      if (scat >= 3) spinsLeft += Math.max(0, Math.floor(Number(start.extraSpinsOnScatter) || 2));
      if (spinEval.baseMultiplier > 0) {
        const baseSpinMult = Math.max(
          Number(start.baseSpinMultiplierMin) || 1,
          Math.floor(Math.random() * (Math.max(Number(start.baseSpinMultiplierMax) || 3, Number(start.baseSpinMultiplierMin) || 1) - (Number(start.baseSpinMultiplierMin) || 1) + 1)) + (Number(start.baseSpinMultiplierMin) || 1)
        );
        if (Math.random() < Number(start.stackMultiplierChanceOnWin) || 0) {
          const add = pickWeightedNumber(start.stackMultiplierValues, start.stackMultiplierWeights, 2);
          stackedMult *= Math.max(2, add);
          timeline.push("STACK x" + stackedMult);
        }
        const payout = Math.max(0, Math.floor(safeBet * spinEval.baseMultiplier * baseSpinMult * stackedMult));
        totalPayout += payout;
        timeline.push("FS" + played + ": " + Math.floor(spinEval.baseMultiplier * baseSpinMult * stackedMult) + "x");
      } else {
        timeline.push("FS" + played + ": miss");
      }
      if (Math.random() < start.featureWildChance) {
        wildBoost = Math.min(0.45, wildBoost + 0.04);
        timeline.push("+wild");
      }
      if (Math.random() < start.featureUpgradeChance) {
        payUpgrade = Math.min(20, payUpgrade + 1);
        timeline.push("+pay");
      }
    }
    return {
      spinsPlayed: played,
      payout: totalPayout,
      summary: "Free spins " + played + " | Stack x" + stackedMult.toFixed(2) + " | Upgrades +" + payUpgrade,
      timeline: timeline.slice(0, 24)
    };
  }

  function spinV3(bet) {
    const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
    const baseGrid = buildGridV3(0);
    const base = evaluateGridV3(baseGrid, { payUpgrade: 0, allowScatterPay: true });
    let payout = Math.max(0, Math.floor(safeBet * Math.max(0, base.baseMultiplier)));
    const summaryParts = [];
    if (base.lineWins.length) summaryParts.push(base.lineWins.slice(0, 2).join(" | "));
    let fs = null;
    if (base.scatterCount >= 3) {
      fs = runFreeSpinsV3(safeBet, base.scatterCount);
      payout += Math.max(0, Math.floor(Number(fs.payout) || 0));
      summaryParts.push("BONUS TRIGGERED");
      summaryParts.push(fs.summary);
    }
    const cap = safeBet * Math.max(1, Math.floor(Number(GAME_DEFS.slots_v3.maxPayoutMultiplier) || 5000));
    payout = Math.max(0, Math.min(cap, payout));
    const mult = safeBet > 0 ? Number((payout / safeBet).toFixed(2)) : 0;
    const outcome = mult >= 100 ? "jackpot" : (mult > 0 ? "win" : "lose");
    const lines = base.lineWins.slice(0, 12);
    if (fs && fs.timeline && fs.timeline.length) lines.push("FS: " + fs.timeline.slice(0, 6).join(" / "));
    return {
      gameId: "slots_v3",
      bet: safeBet,
      reels: base.reels,
      multiplier: mult,
      payoutWanted: payout,
      outcome,
      summary: (summaryParts.join(" | ") || "No winning paylines").slice(0, 220),
      paylines: PAYLINES_V3.length,
      lineIds: base.lineIds.slice(0, 12),
      lineWins: lines.slice(0, 18),
      scatterCount: base.scatterCount,
      bonusTriggered: Boolean(fs)
    };
  }

  function buildGridV4(extraWildChance) {
    const rows = V4_ROWS;
    const cols = V4_REELS;
    const grid = [];
    const wildChance = Math.max(0, Math.min(0.65, Number(extraWildChance) || 0));
    for (let r = 0; r < rows; r++) grid[r] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (Math.random() < wildChance) grid[r][c] = { id: "wild", icon: "WILD" };
        else grid[r][c] = pickWeighted(SYMBOLS_V4);
      }
    }
    return grid;
  }

  function evaluatePaylineV4(line) {
    let base = "";
    for (let i = 0; i < line.length; i++) {
      const id = String(line[i] && line[i].id || "");
      if (id && id !== "wild" && id !== "scatter") {
        base = id;
        break;
      }
    }
    if (!base) return { mult: 0, text: "", count: 0 };
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      const id = String(line[i] && line[i].id || "");
      if (id === base || id === "wild") count += 1;
      else break;
    }
    if (count < 3) return { mult: 0, text: "", count };
    const row = PAYTABLE_V4[base] || {};
    const mult = Math.max(0, Number(row[count]) || 0);
    if (mult <= 0) return { mult: 0, text: "", count };
    return {
      mult,
      count,
      text: base.toUpperCase() + " x" + count + " (" + mult + "x line)"
    };
  }

  function evaluateGridV4(grid, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const cols = (grid[0] && grid[0].length) || V4_REELS;
    const paylines = PAYLINES_V4.map((p) => normalizePattern(p, cols, grid.length));
    const extraPay = Math.max(0, Number(options.extraPay) || 0);
    let scatterCount = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (String(grid[r][c] && grid[r][c].id || "") === "scatter") scatterCount += 1;
      }
    }
    let totalMult = 0;
    const lineWins = [];
    const lineIds = [];
    for (let i = 0; i < paylines.length; i++) {
      const line = getLineSymbols(grid, paylines[i]);
      const row = evaluatePaylineV4(line);
      if (row.mult > 0) {
        const out = row.mult + extraPay;
        totalMult += out / paylines.length;
        lineWins.push("L" + (i + 1) + " " + row.text.replace("(" + row.mult + "x line)", "(" + out + "x line)"));
        lineIds.push(i + 1);
      }
    }
    if (scatterCount >= 3 && options.allowScatterPay !== false) {
      const scat = scatterCount >= 5 ? 30 : (scatterCount === 4 ? 9 : 4);
      totalMult += scat;
      lineWins.push("SCATTER x" + scatterCount + " (" + scat + "x)");
    }
    return {
      reels: gridToTextRows(grid),
      lineWins,
      lineIds,
      scatterCount,
      baseMultiplier: totalMult
    };
  }

  function runFreeSpinsV4(safeBet, triggerScatters) {
    const cfg = BONUS_V4;
    const trigger = Math.max(3, Math.floor(Number(triggerScatters) || 3));
    let spinsLeft = Math.max(1, Math.floor(Number(cfg.initialFreeSpins) || 10)) + (trigger - 3);
    let played = 0;
    let totalPayout = 0;
    let stackedMult = 1;
    let extraWild = 0.06;
    let extraPay = 0;
    const timeline = [];

    function pickStackMult() {
      let total = 0;
      for (let i = 0; i < cfg.stackValues.length; i++) {
        total += Math.max(1, Math.floor(Number(cfg.stackWeights[i]) || 1));
      }
      let roll = Math.floor(Math.random() * Math.max(1, total));
      for (let i = 0; i < cfg.stackValues.length; i++) {
        roll -= Math.max(1, Math.floor(Number(cfg.stackWeights[i]) || 1));
        if (roll < 0) return Math.max(2, Number(cfg.stackValues[i]) || 2);
      }
      return 2;
    }

    while (spinsLeft > 0 && played < cfg.maxFeatureSpins) {
      spinsLeft -= 1;
      played += 1;
      let grid = buildGridV4(extraWild);
      if (Math.random() < cfg.expandingChance) {
        const candidates = ["mask", "idol", "oracle", "forgotten"];
        const expandId = candidates[Math.floor(Math.random() * candidates.length)];
        for (let c = 0; c < V4_REELS; c++) {
          let has = false;
          for (let r = 0; r < V4_ROWS; r++) {
            if (String(grid[r][c] && grid[r][c].id || "") === expandId) {
              has = true;
              break;
            }
          }
          if (has) {
            for (let r = 0; r < V4_ROWS; r++) grid[r][c] = { id: expandId, icon: String(expandId).toUpperCase().slice(0, 4) };
          }
        }
        timeline.push("EXP " + expandId.toUpperCase());
      }
      const ev = evaluateGridV4(grid, { extraPay, allowScatterPay: true });
      if (ev.scatterCount >= 3) {
        spinsLeft += Math.max(0, Math.floor(Number(cfg.retriggerSpins) || 2));
        timeline.push("RETRIGGER +" + Math.max(0, Math.floor(Number(cfg.retriggerSpins) || 2)));
      }
      if (ev.baseMultiplier > 0) {
        if (Math.random() < cfg.stackChance) {
          stackedMult *= pickStackMult();
          timeline.push("STACK x" + stackedMult);
        }
        const spinMult = Math.max(
          Number(cfg.spinMultiplierMin) || 1,
          Math.floor(Math.random() * (Math.max(Number(cfg.spinMultiplierMax) || 3, Number(cfg.spinMultiplierMin) || 1) - (Number(cfg.spinMultiplierMin) || 1) + 1)) + (Number(cfg.spinMultiplierMin) || 1)
        );
        const payout = Math.max(0, Math.floor(safeBet * ev.baseMultiplier * spinMult * stackedMult));
        totalPayout += payout;
        timeline.push("FS" + played + ": " + Math.floor(ev.baseMultiplier * spinMult * stackedMult) + "x");
      } else {
        timeline.push("FS" + played + ": miss");
      }
      if (Math.random() < cfg.extraWildChance) {
        extraWild = Math.min(0.58, extraWild + 0.05);
        timeline.push("+WILD");
      }
      if (Math.random() < 0.24) {
        extraPay = Math.min(30, extraPay + 1);
        timeline.push("+PAY");
      }
    }
    return {
      spinsPlayed: played,
      payout: totalPayout,
      summary: "Free spins " + played + " | Stack x" + stackedMult.toFixed(2) + " | Wild+" + Math.floor(extraWild * 100) + "%",
      timeline: timeline.slice(0, 26)
    };
  }

  function spinV4(bet) {
    const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
    const baseGrid = buildGridV4(0);
    const base = evaluateGridV4(baseGrid, { extraPay: 0, allowScatterPay: true });
    let payout = Math.max(0, Math.floor(safeBet * Math.max(0, base.baseMultiplier)));
    const summaryParts = [];
    if (base.lineWins.length) summaryParts.push(base.lineWins.slice(0, 2).join(" | "));
    let fs = null;
    if (base.scatterCount >= 3) {
      fs = runFreeSpinsV4(safeBet, base.scatterCount);
      payout += Math.max(0, Math.floor(Number(fs.payout) || 0));
      summaryParts.push("BONUS TRIGGERED");
      summaryParts.push(fs.summary);
    }
    const cap = safeBet * Math.max(1, Math.floor(Number(GAME_DEFS.slots_v4.maxPayoutMultiplier) || 5000));
    payout = Math.max(0, Math.min(cap, payout));
    const mult = safeBet > 0 ? Number((payout / safeBet).toFixed(2)) : 0;
    const outcome = mult >= 120 ? "jackpot" : (mult > 0 ? "win" : "lose");
    const lines = base.lineWins.slice(0, 12);
    if (fs && fs.timeline && fs.timeline.length) lines.push("FS: " + fs.timeline.slice(0, 6).join(" / "));
    return {
      gameId: "slots_v4",
      bet: safeBet,
      reels: base.reels,
      multiplier: mult,
      payoutWanted: payout,
      outcome,
      summary: (summaryParts.join(" | ") || "No winning paylines").slice(0, 220),
      paylines: PAYLINES_V4.length,
      lineIds: base.lineIds.slice(0, 12),
      lineWins: lines.slice(0, 18),
      scatterCount: base.scatterCount,
      bonusTriggered: Boolean(fs)
    };
  }

  function buildGridV6(extraWildChance) {
    const rows = V6_ROWS;
    const cols = V6_REELS;
    const grid = [];
    const wildChance = Math.max(0, Math.min(0.6, Number(extraWildChance) || 0));
    for (let r = 0; r < rows; r++) grid[r] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (Math.random() < wildChance) grid[r][c] = { id: "wild", icon: "WILD" };
        else grid[r][c] = pickWeighted(SYMBOLS_V6);
      }
    }
    return grid;
  }

  function evaluatePaylineV6(line) {
    let base = "";
    for (let i = 0; i < line.length; i++) {
      const id = String(line[i] && line[i].id || "");
      if (id && id !== "wild" && id !== "scatter") {
        base = id;
        break;
      }
    }
    if (!base) return { mult: 0, count: 0, text: "" };
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      const id = String(line[i] && line[i].id || "");
      if (id === base || id === "wild") count += 1;
      else break;
    }
    if (count < 3) return { mult: 0, count, text: "" };
    const row = PAYTABLE_V6[base] || {};
    const mult = Math.max(0, Number(row[count]) || 0);
    if (mult <= 0) return { mult: 0, count, text: "" };
    return {
      mult,
      count,
      text: base.toUpperCase() + " x" + count + " (" + mult + "x line)"
    };
  }

  function evaluateGridV6(grid) {
    const cols = (grid[0] && grid[0].length) || V6_REELS;
    const paylines = PAYLINES_V6.map((p) => normalizePattern(p, cols, grid.length));
    let scatterCount = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (String(grid[r][c] && grid[r][c].id || "") === "scatter") scatterCount += 1;
      }
    }
    let totalMult = 0;
    const lineWins = [];
    const lineIds = [];
    const winCells = {};
    for (let i = 0; i < paylines.length; i++) {
      const pat = paylines[i];
      const line = getLineSymbols(grid, pat);
      const row = evaluatePaylineV6(line);
      if (row.mult > 0) {
        totalMult += row.mult / paylines.length;
        lineWins.push("L" + (i + 1) + " " + row.text);
        lineIds.push(i + 1);
        for (let c = 0; c < row.count; c++) {
          const r = Math.max(0, Math.min(V6_ROWS - 1, Math.floor(Number(pat[c]) || 0)));
          winCells[String(c) + "_" + String(r)] = true;
        }
      }
    }
    return {
      reels: gridToTextRows(grid),
      lineWins,
      lineIds,
      scatterCount,
      baseMultiplier: totalMult,
      winCells
    };
  }

  function collapseGridV6(grid, winCells, extraWildChance) {
    const next = [];
    for (let r = 0; r < V6_ROWS; r++) next[r] = [];
    for (let c = 0; c < V6_REELS; c++) {
      const survivors = [];
      for (let r = V6_ROWS - 1; r >= 0; r--) {
        if (!winCells[String(c) + "_" + String(r)]) survivors.push(grid[r][c]);
      }
      while (survivors.length < V6_ROWS) {
        if (Math.random() < Math.max(0, Math.min(0.6, Number(extraWildChance) || 0))) {
          survivors.push({ id: "wild", icon: "WILD" });
        } else {
          survivors.push(pickWeighted(SYMBOLS_V6));
        }
      }
      for (let r = V6_ROWS - 1, i = 0; r >= 0; r--, i++) next[r][c] = survivors[i];
    }
    return next;
  }

  function runCascadeSpinV6(safeBet, grid, cascadeStep, spinMult, extraWildChance) {
    const step = Math.max(0, Number(cascadeStep) || 0.5);
    const sMult = Math.max(1, Number(spinMult) || 1);
    let work = grid;
    let cascade = 0;
    let payout = 0;
    const lines = [];
    const lineIds = [];
    while (cascade < 8) {
      const ev = evaluateGridV6(work);
      if (ev.baseMultiplier <= 0) break;
      cascade += 1;
      const cascadeMult = 1 + ((cascade - 1) * step);
      const hit = Math.max(0, Math.floor(safeBet * ev.baseMultiplier * cascadeMult * sMult));
      payout += hit;
      for (let i = 0; i < ev.lineWins.length && lines.length < 20; i++) {
        lines.push("C" + cascade + " " + ev.lineWins[i]);
      }
      for (let i = 0; i < ev.lineIds.length; i++) {
        if (lineIds.indexOf(ev.lineIds[i]) < 0) lineIds.push(ev.lineIds[i]);
      }
      work = collapseGridV6(work, ev.winCells, extraWildChance);
    }
    const finalEval = evaluateGridV6(work);
    return {
      payout,
      cascades: cascade,
      lineWins: lines.slice(0, 20),
      lineIds: lineIds.slice(0, 12),
      scatterCount: finalEval.scatterCount,
      finalGrid: work
    };
  }

  function runFreeSpinsV6(safeBet, triggerScatters) {
    const cfg = BONUS_V6;
    const trigger = Math.max(3, Math.floor(Number(triggerScatters) || 3));
    let spinsLeft = Math.max(1, Math.floor(Number(cfg.initialFreeSpins) || 8)) + (trigger - 3);
    let played = 0;
    let totalPayout = 0;
    let spinGrowth = 1;
    let extraWild = 0.06;
    const timeline = [];
    while (spinsLeft > 0 && played < cfg.maxFeatureSpins) {
      spinsLeft -= 1;
      played += 1;
      const spinMult = Math.max(
        Number(cfg.baseSpinMultiplierMin) || 1,
        Math.floor(Math.random() * (Math.max(Number(cfg.baseSpinMultiplierMax) || 3, Number(cfg.baseSpinMultiplierMin) || 1) - (Number(cfg.baseSpinMultiplierMin) || 1) + 1)) + (Number(cfg.baseSpinMultiplierMin) || 1)
      ) * spinGrowth;
      const baseGrid = buildGridV6(extraWild);
      const out = runCascadeSpinV6(safeBet, baseGrid, cfg.cascadeMultiplierStep, spinMult, extraWild);
      totalPayout += Math.max(0, Math.floor(Number(out.payout) || 0));
      if (out.payout > 0) {
        spinGrowth += Math.max(0, Number(cfg.growthPerWinSpin) || 0.35);
        timeline.push("FS" + played + ": " + Math.floor((out.payout / safeBet) || 0) + "x");
      } else {
        timeline.push("FS" + played + ": miss");
      }
      if (out.scatterCount >= 3) {
        const plus = Math.max(0, Math.floor(Number(cfg.retriggerSpins) || 2));
        spinsLeft += plus;
        timeline.push("RETRIGGER +" + plus);
      }
      if (Math.random() < cfg.extraWildChance) {
        extraWild = Math.min(0.55, extraWild + 0.05);
        timeline.push("+WILD");
      }
    }
    return {
      spinsPlayed: played,
      payout: totalPayout,
      summary: "Free spins " + played + " | Growth x" + spinGrowth.toFixed(2) + " | Wild+" + Math.floor(extraWild * 100) + "%",
      timeline: timeline.slice(0, 28)
    };
  }

  function spinV6(bet) {
    const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
    const baseGrid = buildGridV6(0);
    const baseRun = runCascadeSpinV6(safeBet, baseGrid, BONUS_V6.cascadeMultiplierStep, 1, 0);
    let payout = Math.max(0, Math.floor(Number(baseRun.payout) || 0));
    const summaryParts = [];
    if (baseRun.lineWins.length) summaryParts.push(baseRun.lineWins.slice(0, 2).join(" | "));
    let fs = null;
    if (baseRun.scatterCount >= 3) {
      fs = runFreeSpinsV6(safeBet, baseRun.scatterCount);
      payout += Math.max(0, Math.floor(Number(fs.payout) || 0));
      summaryParts.push("BONUS TRIGGERED");
      summaryParts.push(fs.summary);
    }
    const cap = safeBet * Math.max(1, Math.floor(Number(GAME_DEFS.slots_v6.maxPayoutMultiplier) || 5000));
    payout = Math.max(0, Math.min(cap, payout));
    const mult = safeBet > 0 ? Number((payout / safeBet).toFixed(2)) : 0;
    const outcome = mult >= 120 ? "jackpot" : (mult > 0 ? "win" : "lose");
    const lines = baseRun.lineWins.slice(0, 14);
    if (fs && fs.timeline && fs.timeline.length) lines.push("FS: " + fs.timeline.slice(0, 6).join(" / "));
    return {
      gameId: "slots_v6",
      bet: safeBet,
      reels: gridToTextRows(baseRun.finalGrid),
      multiplier: mult,
      payoutWanted: payout,
      outcome,
      summary: (summaryParts.join(" | ") || "No winning paylines").slice(0, 220),
      paylines: PAYLINES_V6.length,
      lineIds: baseRun.lineIds.slice(0, 12),
      lineWins: lines.slice(0, 18),
      scatterCount: baseRun.scatterCount,
      bonusTriggered: Boolean(fs)
    };
  }

  function snoopKey(r, c) {
    return String(r) + "_" + String(c);
  }

  function snoopShuffle(list) {
    const arr = Array.isArray(list) ? list.slice() : [];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function snoopRegularCell(row) {
    return {
      id: String(row && row.id || "none"),
      icon: String(row && row.icon || "?"),
      kind: "regular"
    };
  }

  function snoopScatterCell() {
    return { id: "scatter", icon: "SCAT", kind: "scatter" };
  }

  function snoopStickyWildCell(mult) {
    return {
      id: "wild",
      icon: "WILD",
      kind: "sticky_wild",
      sticky: true,
      wildMult: Math.max(1, Math.floor(Number(mult) || 1))
    };
  }

  function snoopCreateGrid() {
    const grid = [];
    for (let r = 0; r < SNOOP_CFG.rows; r++) {
      grid[r] = [];
      for (let c = 0; c < SNOOP_CFG.reels; c++) grid[r][c] = null;
    }
    return grid;
  }

  function snoopPickClusterPayout(symbolId, size) {
    const safeSize = Math.max(0, Math.floor(Number(size) || 0));
    const row = SNOOP_CFG.symbols.find((s) => String(s && s.id || "") === String(symbolId || ""));
    const pays = row && row.payouts ? row.payouts : {};
    if (safeSize >= 17) return Math.max(0, Number(pays[17]) || 0);
    if (safeSize >= 13) return Math.max(0, Number(pays[13]) || 0);
    if (safeSize >= 9) return Math.max(0, Number(pays[9]) || 0);
    if (safeSize >= 5) return Math.max(0, Number(pays[5]) || 0);
    return 0;
  }

  function snoopCreateRoundState(bet) {
    const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
    return {
      bet: safeBet,
      winCap: safeBet * Math.max(1, Math.floor(Number(SNOOP_CFG.maxRoundWinX) || 10000)),
      marked: {},
      stickyWilds: {},
      cellMultipliers: {},
      scatterCollected: 0,
      collectScatters: true
    };
  }

  function snoopSpawnCell(state, r, c) {
    const key = snoopKey(r, c);
    const lockedWild = Math.max(0, Math.floor(Number(state.stickyWilds[key]) || 0));
    if (lockedWild > 0) return snoopStickyWildCell(lockedWild);
    const pick = pickWeighted(SNOOP_DROP_SYMBOLS);
    const id = String(pick && pick.id || "");
    if (id === "wild") {
      const base = state.marked[key] ? snoopMarkedWildStart() : 1;
      state.stickyWilds[key] = Math.max(base, Math.floor(Number(state.stickyWilds[key]) || 0));
      return snoopStickyWildCell(state.stickyWilds[key]);
    }
    if (id === "scatter") {
      if (state.collectScatters) state.scatterCollected += 1;
      return snoopScatterCell();
    }
    return snoopRegularCell(pick);
  }

  function snoopRefillGrid(grid, state) {
    const out = Array.isArray(grid) ? grid : snoopCreateGrid();
    for (let c = 0; c < SNOOP_CFG.reels; c++) {
      const anchors = {};
      for (let r = 0; r < SNOOP_CFG.rows; r++) {
        const key = snoopKey(r, c);
        const wild = Math.max(0, Math.floor(Number(state.stickyWilds[key]) || 0));
        if (wild > 0) anchors[r] = snoopStickyWildCell(wild);
      }
      const movers = [];
      for (let r = SNOOP_CFG.rows - 1; r >= 0; r--) {
        if (anchors[r]) continue;
        const cell = out[r] && out[r][c] ? out[r][c] : null;
        if (cell) movers.push(cell);
      }
      for (let r = SNOOP_CFG.rows - 1; r >= 0; r--) {
        if (anchors[r]) {
          out[r][c] = anchors[r];
          continue;
        }
        if (movers.length > 0) out[r][c] = movers.shift();
        else out[r][c] = snoopSpawnCell(state, r, c);
      }
    }
    return out;
  }

  function snoopBuildFreshGrid(state, options) {
    const opts = options && typeof options === "object" ? options : {};
    const avoidWins = Boolean(opts.avoidWins);
    const attempts = Math.max(
      1,
      Math.floor(
        Number(opts.maxAttempts) ||
        Number(SNOOP_CFG.featureNoClusterAttempts) ||
        12
      )
    );
    let grid = snoopRefillGrid(snoopCreateGrid(), state);
    if (!avoidWins) return grid;
    for (let i = 0; i < attempts; i++) {
      grid = snoopRefillGrid(snoopCreateGrid(), state);
      if (!snoopFindWinningClusters(grid).length) return grid;
    }
    return grid;
  }

  function snoopGridToTextRows(grid, state) {
    const safe = Array.isArray(grid) ? grid : [];
    const ctx = state && typeof state === "object" ? state : { stickyWilds: {}, cellMultipliers: {} };
    const out = [];
    for (let r = 0; r < safe.length; r++) {
      const row = Array.isArray(safe[r]) ? safe[r] : [];
      const tokens = [];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c] && typeof row[c] === "object" ? row[c] : null;
        if (!cell) {
          tokens.push("?");
          continue;
        }
        const key = snoopKey(r, c);
        const base = String(cell.icon || "?");
        const wildMult = String(cell.id || "") === "wild"
          ? Math.max(1, Math.floor(Number(cell.wildMult || ctx.stickyWilds[key]) || 1))
          : 1;
        const cellMult = Math.max(1, Math.floor(Number(ctx.cellMultipliers[key]) || 1));
        if (String(cell.id || "") === "wild" && wildMult > 1) {
          tokens.push(base + "@W" + wildMult);
        } else if (cellMult > 1) {
          tokens.push(base + "@M" + cellMult);
        } else {
          tokens.push(base);
        }
      }
      out.push(tokens.join(","));
    }
    return out;
  }

  function snoopFindClusterCandidates(grid, symbolId) {
    const visited = {};
    const out = [];
    const target = String(symbolId || "");
    function inBounds(r, c) {
      return r >= 0 && c >= 0 && r < SNOOP_CFG.rows && c < SNOOP_CFG.reels;
    }
    function allowed(cell) {
      if (!cell || typeof cell !== "object") return false;
      const id = String(cell.id || "");
      return id === target || id === "wild";
    }
    for (let r = 0; r < SNOOP_CFG.rows; r++) {
      for (let c = 0; c < SNOOP_CFG.reels; c++) {
        const k = snoopKey(r, c);
        if (visited[k]) continue;
        const cell = grid[r] && grid[r][c] ? grid[r][c] : null;
        if (!allowed(cell)) continue;
        const queue = [{ r, c }];
        const cells = [];
        let natural = 0;
        visited[k] = true;
        while (queue.length) {
          const cur = queue.shift();
          const ck = snoopKey(cur.r, cur.c);
          const cc = grid[cur.r] && grid[cur.r][cur.c] ? grid[cur.r][cur.c] : null;
          if (!allowed(cc)) continue;
          cells.push({ r: cur.r, c: cur.c, key: ck, cell: cc });
          if (String(cc.id || "") === target) natural += 1;
          const next = [
            { r: cur.r - 1, c: cur.c },
            { r: cur.r + 1, c: cur.c },
            { r: cur.r, c: cur.c - 1 },
            { r: cur.r, c: cur.c + 1 }
          ];
          for (let i = 0; i < next.length; i++) {
            const n = next[i];
            if (!inBounds(n.r, n.c)) continue;
            const nk = snoopKey(n.r, n.c);
            if (visited[nk]) continue;
            const nc = grid[n.r] && grid[n.r][n.c] ? grid[n.r][n.c] : null;
            if (!allowed(nc)) continue;
            visited[nk] = true;
            queue.push(n);
          }
        }
        if (cells.length >= SNOOP_CFG.clusterMin && natural > 0) {
          const pay = snoopPickClusterPayout(target, cells.length);
          if (pay > 0) out.push({ symbolId: target, cells, size: cells.length, pay });
        }
      }
    }
    return out;
  }

  function snoopFindWinningClusters(grid) {
    const all = [];
    for (let i = 0; i < SNOOP_CFG.symbols.length; i++) {
      const row = SNOOP_CFG.symbols[i];
      const id = String(row && row.id || "");
      if (!id) continue;
      const found = snoopFindClusterCandidates(grid, id);
      for (let f = 0; f < found.length; f++) all.push(found[f]);
    }
    all.sort((a, b) => {
      const aVal = (Number(a.pay) || 0) * (Number(a.size) || 0);
      const bVal = (Number(b.pay) || 0) * (Number(b.size) || 0);
      if (bVal !== aVal) return bVal - aVal;
      return (Number(b.size) || 0) - (Number(a.size) || 0);
    });
    const used = {};
    const selected = [];
    for (let i = 0; i < all.length; i++) {
      const row = all[i];
      let conflict = false;
      for (let c = 0; c < row.cells.length; c++) {
        if (used[row.cells[c].key]) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;
      for (let c = 0; c < row.cells.length; c++) used[row.cells[c].key] = true;
      selected.push(row);
    }
    return selected;
  }

  function snoopAddMarked(state, key) {
    if (!state.marked[key]) state.marked[key] = true;
  }

  function snoopWildStepValue() {
    return Math.max(1, Math.floor(Number(SNOOP_CFG.wildUpgradeStep) || 10));
  }

  function snoopWildMaxValue() {
    return Math.max(snoopWildStepValue(), Math.floor(Number(SNOOP_CFG.wildUpgradeMax) || 100));
  }

  function snoopMarkedWildStart() {
    return Math.max(snoopWildStepValue(), Math.floor(Number(SNOOP_CFG.wildMarkedStart) || 10));
  }

  function snoopRaiseWildValue(current, steps, ensureAtLeastStep) {
    const step = snoopWildStepValue();
    const max = snoopWildMaxValue();
    const safeSteps = Math.max(0, Math.floor(Number(steps) || 0));
    let base = Math.max(1, Math.floor(Number(current) || 1));
    if (ensureAtLeastStep && base < step) base = step;
    if (safeSteps <= 0) return Math.min(max, base);
    const next = base + (step * safeSteps);
    return Math.max(1, Math.min(max, next));
  }

  function snoopBuildCellMeta(state) {
    const ctx = state && typeof state === "object" ? state : {};
    const meta = {};
    const wildKeys = Object.keys(ctx.stickyWilds || {});
    for (let i = 0; i < wildKeys.length; i++) {
      const key = wildKeys[i];
      const wildMult = Math.max(1, Math.floor(Number(ctx.stickyWilds[key]) || 1));
      if (!meta[key]) meta[key] = {};
      meta[key].locked = true;
      meta[key].wildMult = wildMult;
    }
    const multKeys = Object.keys(ctx.cellMultipliers || {});
    for (let i = 0; i < multKeys.length; i++) {
      const key = multKeys[i];
      const mult = Math.max(1, Math.floor(Number(ctx.cellMultipliers[key]) || 1));
      if (mult <= 1) continue;
      if (!meta[key]) meta[key] = {};
      meta[key].locked = true;
      meta[key].cellMult = mult;
    }
    return meta;
  }

  function snoopCountStickyWilds(state) {
    return Object.keys(state && state.stickyWilds || {}).length;
  }

  function snoopCountMultiplierCells(state) {
    const keys = Object.keys(state && state.cellMultipliers || {});
    let total = 0;
    for (let i = 0; i < keys.length; i++) {
      if (Math.max(1, Math.floor(Number(state.cellMultipliers[keys[i]]) || 1)) > 1) total += 1;
    }
    return total;
  }

  function snoopBoostWilds(state, grid, steps) {
    const safeSteps = Math.max(0, Math.floor(Number(steps) || 0));
    if (safeSteps <= 0) return { count: 0, upgrades: [] };
    const keys = Object.keys(state.stickyWilds || {});
    const upgrades = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const prev = Math.max(1, Math.floor(Number(state.stickyWilds[k]) || 1));
      const next = snoopRaiseWildValue(prev, safeSteps, true);
      state.stickyWilds[k] = next;
      if (next !== prev) upgrades.push({ key: k, from: prev, to: next });
      const parts = k.split("_");
      const r = Math.floor(Number(parts[0]));
      const c = Math.floor(Number(parts[1]));
      if (r >= 0 && c >= 0 && r < SNOOP_CFG.rows && c < SNOOP_CFG.reels) {
        grid[r][c] = snoopStickyWildCell(state.stickyWilds[k]);
      }
    }
    return { count: upgrades.length, upgrades };
  }

  function snoopAddMultiplierCells(state, addCount) {
    const want = Math.max(0, Math.floor(Number(addCount) || 0));
    if (want <= 0) return { count: 0, keys: [] };
    const preferred = [];
    const fallback = [];
    for (let i = 0; i < SNOOP_KEY_LIST.length; i++) {
      const key = SNOOP_KEY_LIST[i];
      if (state && state.marked && state.marked[key]) preferred.push(key);
      else fallback.push(key);
    }
    const shuffled = snoopShuffle(preferred).concat(snoopShuffle(fallback));
    const cellMult = Math.max(1, Math.floor(Number(SNOOP_CFG.multiplierCellValue) || 10));
    let added = 0;
    const keys = [];
    for (let i = 0; i < shuffled.length && added < want; i++) {
      const key = shuffled[i];
      const current = Math.max(1, Math.floor(Number(state.cellMultipliers[key]) || 1));
      if (current >= cellMult) continue;
      state.cellMultipliers[key] = Math.max(current, cellMult);
      added += 1;
      keys.push(key);
    }
    return { count: added, keys };
  }

  function snoopPickDigIcon(chanceOverride) {
    const rollChance = Number.isFinite(Number(chanceOverride))
      ? Number(chanceOverride)
      : (Number(SNOOP_CFG.digUpChance) || 0.30);
    if (Math.random() > Math.max(0, Math.min(1, rollChance))) return "none";
    const bag = [
      { id: "none", weight: SNOOP_CFG.digIconWeights.none },
      { id: "scatter", weight: SNOOP_CFG.digIconWeights.scatter },
      { id: "wild", weight: SNOOP_CFG.digIconWeights.wild },
      { id: "weed", weight: SNOOP_CFG.digIconWeights.weed },
      { id: "skull", weight: SNOOP_CFG.digIconWeights.skull }
    ];
    const pick = pickWeighted(bag);
    return String(pick && pick.id || "none");
  }

  function snoopApplySkull(grid, state) {
    const low = {};
    for (let i = 0; i < SNOOP_CFG.lowPayingSymbols.length; i++) low[String(SNOOP_CFG.lowPayingSymbols[i])] = true;
    const removed = [];
    for (let r = 0; r < SNOOP_CFG.rows; r++) {
      for (let c = 0; c < SNOOP_CFG.reels; c++) {
        const cell = grid[r] && grid[r][c] ? grid[r][c] : null;
        if (!cell || String(cell.id || "") === "wild") continue;
        if (!low[String(cell.id || "")]) continue;
        const k = snoopKey(r, c);
        grid[r][c] = null;
        snoopAddMarked(state, k);
        removed.push({ r, c, key: k });
      }
    }
    return removed;
  }

  function snoopApplyDigUps(state, grid, clearedCells, guaranteeWildCount, chanceOverride) {
    const safeCells = Array.isArray(clearedCells) ? clearedCells.slice() : [];
    const reveals = [];
    for (let i = 0; i < safeCells.length; i++) {
      const cell = safeCells[i];
      reveals.push({
        r: Math.floor(Number(cell.r)),
        c: Math.floor(Number(cell.c)),
        key: String(cell.key || snoopKey(cell.r, cell.c)),
        icon: snoopPickDigIcon(chanceOverride)
      });
    }
    const forceWild = Math.max(0, Math.floor(Number(guaranteeWildCount) || 0));
    let wildNow = 0;
    for (let i = 0; i < reveals.length; i++) if (reveals[i].icon === "wild") wildNow += 1;
    if (forceWild > wildNow) {
      const candidates = [];
      for (let i = 0; i < reveals.length; i++) {
        if (reveals[i].icon !== "wild") candidates.push(i);
      }
      let needed = forceWild - wildNow;
      while (candidates.length && needed > 0) {
        const pick = Math.floor(Math.random() * candidates.length);
        const idx = candidates[pick];
        reveals[idx].icon = "wild";
        candidates.splice(pick, 1);
        needed -= 1;
      }
    }
    let scatters = 0;
    let weeds = 0;
    let skulls = 0;
    let wilds = 0;
    for (let i = 0; i < reveals.length; i++) {
      const row = reveals[i];
      const key = row.key;
      if (row.icon === "scatter") {
        grid[row.r][row.c] = snoopScatterCell();
        if (state.collectScatters) state.scatterCollected += 1;
        scatters += 1;
      } else if (row.icon === "wild") {
        const base = state.marked[key] ? snoopMarkedWildStart() : 1;
        const next = Math.max(base, Math.floor(Number(state.stickyWilds[key]) || 0));
        state.stickyWilds[key] = next;
        grid[row.r][row.c] = snoopStickyWildCell(next);
        wilds += 1;
      } else if (row.icon === "weed") {
        weeds += 1;
      } else if (row.icon === "skull") {
        skulls += 1;
      }
    }
    let addedMultiplierCells = 0;
    let multiplierCellKeys = [];
    let boostedWilds = 0;
    let wildUpgrades = [];
    if (weeds > 0) {
      const addRes = snoopAddMultiplierCells(state, weeds * Math.max(1, Math.floor(Number(SNOOP_CFG.weedAddsMultiplierCells) || 2)));
      addedMultiplierCells = Math.max(0, Math.floor(Number(addRes && addRes.count) || 0));
      multiplierCellKeys = Array.isArray(addRes && addRes.keys) ? addRes.keys.slice(0) : [];
      const boostRes = snoopBoostWilds(state, grid, weeds);
      boostedWilds = Math.max(0, Math.floor(Number(boostRes && boostRes.count) || 0));
      wildUpgrades = Array.isArray(boostRes && boostRes.upgrades) ? boostRes.upgrades.slice(0) : [];
    }
    let skullRemoved = [];
    if (skulls > 0) {
      skullRemoved = snoopApplySkull(grid, state);
    }
    return {
      scatters,
      weeds,
      skulls,
      wilds,
      addedMultiplierCells,
      multiplierCellKeys,
      boostedWilds,
      wildUpgrades,
      skullRemoved
    };
  }

  function snoopTransformScattersForFeature(state, grid, triggerCount) {
    const need = Math.max(0, Math.floor(Number(triggerCount) || 0));
    if (need <= 0) return {
      transformedWilds: 0,
      transformedMultipliers: 0,
      scatterKeys: [],
      transformations: [],
      grid
    };
    const scatterCells = [];
    for (let r = 0; r < SNOOP_CFG.rows; r++) {
      for (let c = 0; c < SNOOP_CFG.reels; c++) {
        const cell = grid[r] && grid[r][c] ? grid[r][c] : null;
        if (cell && String(cell.id || "") === "scatter") {
          scatterCells.push({ r, c, key: snoopKey(r, c) });
        }
      }
    }
    const picks = snoopShuffle(scatterCells).slice(0, need);
    if (picks.length < need) {
      const taken = {};
      for (let i = 0; i < picks.length; i++) taken[picks[i].key] = true;
      const shuffled = snoopShuffle(SNOOP_KEY_LIST);
      for (let i = 0; i < shuffled.length && picks.length < need; i++) {
        if (taken[shuffled[i]]) continue;
        const parts = shuffled[i].split("_");
        picks.push({ r: Math.floor(Number(parts[0])), c: Math.floor(Number(parts[1])), key: shuffled[i] });
        taken[shuffled[i]] = true;
      }
    }
    let transformedWilds = 0;
    let transformedMultipliers = 0;
    const scatterKeys = picks.map((row) => String(row && row.key || ""));
    const transformations = [];
    for (let i = 0; i < picks.length; i++) {
      const row = picks[i];
      if (Math.random() < 0.5) {
        const base = state.marked[row.key] ? snoopMarkedWildStart() : snoopWildStepValue();
        state.stickyWilds[row.key] = Math.max(base, Math.floor(Number(state.stickyWilds[row.key]) || 0));
        grid[row.r][row.c] = snoopStickyWildCell(state.stickyWilds[row.key]);
        transformedWilds += 1;
        transformations.push({
          key: row.key,
          r: row.r,
          c: row.c,
          to: "wild",
          toMult: Math.max(1, Math.floor(Number(state.stickyWilds[row.key]) || 1))
        });
      } else {
        state.cellMultipliers[row.key] = Math.max(
          Math.floor(Number(state.cellMultipliers[row.key]) || 1),
          Math.max(1, Math.floor(Number(SNOOP_CFG.multiplierCellValue) || 10))
        );
        grid[row.r][row.c] = null;
        transformedMultipliers += 1;
        transformations.push({
          key: row.key,
          r: row.r,
          c: row.c,
          to: "multiplier",
          toMult: Math.max(1, Math.floor(Number(state.cellMultipliers[row.key]) || 10))
        });
      }
    }
    grid = snoopRefillGrid(grid, state);
    return { transformedWilds, transformedMultipliers, scatterKeys, transformations, grid };
  }

  function snoopComputeClusterWin(state, cluster) {
    const safeCluster = cluster || {};
    const cells = Array.isArray(safeCluster.cells) ? safeCluster.cells : [];
    let highestCellMult = 1;
    let highestWildMult = 1;
    for (let i = 0; i < cells.length; i++) {
      const row = cells[i];
      const key = String(row && row.key || "");
      if (!key) continue;
      highestCellMult = Math.max(highestCellMult, Math.max(1, Math.floor(Number(state.cellMultipliers[key]) || 1)));
      const cell = row.cell || {};
      if (String(cell.id || "") === "wild") {
        const w = Math.max(1, Math.floor(Number(cell.wildMult || state.stickyWilds[key]) || 1));
        highestWildMult = Math.max(highestWildMult, w);
      }
    }
    const base = Math.max(0, Number(safeCluster.pay) || 0) * Math.max(1, Number(state.bet) || 1);
    const edgeFactor = Math.max(0.8, Math.min(1, 1 - (Number(SNOOP_CFG.houseEdge) || 0.04)));
    const displayApplied = Math.max(highestCellMult, highestWildMult);
    const scale = Math.max(0.05, Math.min(1, Number(SNOOP_CFG.payoutMultiplierScale) || 0.28));
    const maxApplied = Math.max(1, Number(SNOOP_CFG.maxAppliedPayoutMultiplier) || 18);
    const applied = Math.max(1, Math.min(maxApplied, 1 + ((displayApplied - 1) * scale)));
    const payout = Math.max(0, Math.floor(base * applied * edgeFactor));
    return {
      payout,
      appliedMultiplier: displayApplied,
      payoutMultiplier: Number(applied.toFixed(2)),
      highestCellMult,
      highestWildMult
    };
  }

  function snoopRunCascades(state, startGrid, options) {
    let grid = Array.isArray(startGrid) ? startGrid : snoopBuildFreshGrid(state);
    const opts = options && typeof options === "object" ? options : {};
    let guaranteedWild = Math.max(0, Math.floor(Number(opts.guaranteedWild) || 0));
    const digChance = Number.isFinite(Number(opts.digChance)) ? Number(opts.digChance) : undefined;
    const includeEvents = Boolean(opts.includeEvents);
    const lineWins = [];
    const events = [];
    let totalPayout = 0;
    let cascades = 0;
    let biggestCascadeWin = 0;
    while (cascades < Math.max(1, Math.floor(Number(SNOOP_CFG.maxCascade) || 12))) {
      const winners = snoopFindWinningClusters(grid);
      if (!winners.length) break;
      cascades += 1;
      let cascadePayout = 0;
      const cleared = [];
      const clearedMap = {};
      const wildUpgrades = [];
      for (let w = 0; w < winners.length; w++) {
        const row = winners[w];
        const win = snoopComputeClusterWin(state, row);
        const winPay = Math.max(0, Math.floor(Number(win.payout) || 0));
        totalPayout += winPay;
        cascadePayout += winPay;
        lineWins.push(
          "C" + cascades + " " +
          String(row.symbolId || "").toUpperCase() +
          " x" + row.size +
          " -> " + Math.floor(winPay / Math.max(1, state.bet)) + "x"
        );
        for (let i = 0; i < row.cells.length; i++) {
          const cellRef = row.cells[i];
          const key = String(cellRef && cellRef.key || "");
          const cell = cellRef && cellRef.cell ? cellRef.cell : null;
          if (!cell || !key) continue;
          if (String(cell.id || "") === "wild") {
            const prev = Math.max(1, Math.floor(Number(state.stickyWilds[key] || cell.wildMult) || 1));
            const next = snoopRaiseWildValue(prev, 1, true);
            state.stickyWilds[key] = next;
            grid[cellRef.r][cellRef.c] = snoopStickyWildCell(next);
            if (next !== prev) wildUpgrades.push({ key, r: cellRef.r, c: cellRef.c, from: prev, to: next });
            continue;
          }
          grid[cellRef.r][cellRef.c] = null;
          snoopAddMarked(state, key);
          if (!clearedMap[key]) {
            clearedMap[key] = true;
            cleared.push({ r: cellRef.r, c: cellRef.c, key });
          }
        }
      }
      if (cascadePayout > biggestCascadeWin) biggestCascadeWin = cascadePayout;
      if (!cleared.length) break;
      const dig = snoopApplyDigUps(state, grid, cleared, guaranteedWild, digChance);
      guaranteedWild = 0;
      if (dig.wilds > 0) lineWins.push("DIG: +" + dig.wilds + " Sticky Wild");
      if (dig.scatters > 0) lineWins.push("DIG: +" + dig.scatters + " Scatter");
      if (dig.weeds > 0) {
        lineWins.push("DIG: WEED x" + dig.weeds + " (+" + dig.addedMultiplierCells + " x10 cells, +" + dig.boostedWilds + " wild upgrades)");
      }
      if (dig.skulls > 0) {
        lineWins.push("DIG: SKULL x" + dig.skulls + " (cleanse)");
      }
      if (Array.isArray(dig.skullRemoved) && dig.skullRemoved.length) {
        lineWins.push("SKULL removed " + dig.skullRemoved.length + " low symbols");
      }
      const totalWildUps = wildUpgrades.length + (Array.isArray(dig.wildUpgrades) ? dig.wildUpgrades.length : 0);
      if (totalWildUps > 0) {
        lineWins.push("WILD UP +" + snoopWildStepValue() + " x" + totalWildUps);
      }
      if (includeEvents) {
        const mergedWildUpgrades = wildUpgrades.slice(0);
        if (Array.isArray(dig.wildUpgrades) && dig.wildUpgrades.length) {
          for (let i = 0; i < dig.wildUpgrades.length; i++) mergedWildUpgrades.push(dig.wildUpgrades[i]);
        }
        events.push({
          cascade: cascades,
          payout: cascadePayout,
          wildUpgrades: mergedWildUpgrades.slice(0, 64),
          weeds: Math.max(0, Math.floor(Number(dig.weeds) || 0)),
          weedCells: Array.isArray(dig.multiplierCellKeys) ? dig.multiplierCellKeys.slice(0, 64) : [],
          skulls: Math.max(0, Math.floor(Number(dig.skulls) || 0)),
          skullRemoved: Array.isArray(dig.skullRemoved) ? dig.skullRemoved.map((row) => String(row && row.key || "")).filter(Boolean) : []
        });
      }
      grid = snoopRefillGrid(grid, state);
      if (totalPayout >= state.winCap) {
        totalPayout = state.winCap;
        break;
      }
    }
    return {
      payout: Math.max(0, Math.min(state.winCap, totalPayout)),
      cascades,
      lineWins: lineWins.slice(0, 48),
      finalGrid: grid,
      events: events.slice(0, 128),
      biggestCascadeWin: Math.max(0, Math.floor(Number(biggestCascadeWin) || 0))
    };
  }

  function snoopFsAward(scatterCount) {
    const safe = Math.max(0, Math.floor(Number(scatterCount) || 0));
    const clamped = Math.max(3, Math.min(6, safe));
    return Math.max(0, Math.floor(Number(SNOOP_CFG.freeSpinsByScatters[clamped]) || 0));
  }

  function runSnoopFeatureSpins(state, startGrid, awardedSpins) {
    const totalSpins = Math.max(0, Math.floor(Number(awardedSpins) || 0));
    let played = 0;
    let payout = 0;
    let spinsLeft = totalSpins;
    let totalAwarded = totalSpins;
    let retriggeredSpins = 0;
    let biggestCascadeWin = 0;
    let grid = Array.isArray(startGrid) ? startGrid : snoopBuildFreshGrid(state);
    const timeline = [];
    const frames = [];
    const originalCollect = state.collectScatters;
    state.collectScatters = true;
    const deadSpinChance = Math.max(
      0,
      Math.min(0.95, Number(SNOOP_CFG.featureDeadSpinChance) || 0)
    );
    while (spinsLeft > 0 && played < Math.max(1, Math.floor(Number(SNOOP_CFG.maxFeatureSpins) || 220))) {
      spinsLeft -= 1;
      played += 1;
      const preferDeadSpin = Math.random() < deadSpinChance;
      grid = snoopBuildFreshGrid(state, {
        avoidWins: preferDeadSpin,
        maxAttempts: Number(SNOOP_CFG.featureNoClusterAttempts) || 16
      });
      const scattersBefore = Math.max(0, Math.floor(Number(state.scatterCollected) || 0));
      const run = snoopRunCascades(state, grid, {
        includeEvents: true,
        digChance: Number(SNOOP_CFG.fsDigUpChance) || Number(SNOOP_CFG.digUpChance) || 0.24
      });
      const spinPay = Math.max(0, Math.floor(Number(run.payout) || 0));
      payout += spinPay;
      grid = run.finalGrid;
      if (run.biggestCascadeWin > biggestCascadeWin) biggestCascadeWin = run.biggestCascadeWin;

      const scattersAfter = Math.max(0, Math.floor(Number(state.scatterCollected) || 0));
      const scattersThisSpin = Math.max(0, scattersAfter - scattersBefore);

      let retriggerAward = 0;
      let retriggerScatters = 0;
      let retriggerTransform = null;
      if (scattersThisSpin >= 3) {
        retriggerScatters = Math.max(3, Math.min(6, Math.floor(Number(scattersThisSpin) || 3)));
        retriggerAward = snoopFsAward(retriggerScatters);
        if (retriggerAward > 0) {
          spinsLeft += retriggerAward;
          retriggeredSpins += retriggerAward;
          totalAwarded += retriggerAward;
          retriggerTransform = snoopTransformScattersForFeature(state, grid, retriggerScatters);
          grid = retriggerTransform.grid;
        }
      }

      if (spinPay > 0) {
        timeline.push("FS" + played + ": " + Math.floor(spinPay / Math.max(1, state.bet)) + "x");
      } else {
        timeline.push("FS" + played + ": miss");
      }
      const payX = Math.floor(spinPay / Math.max(1, state.bet));
      const detail = Array.isArray(run.lineWins) && run.lineWins.length
        ? " | " + String(run.lineWins[0] || "No clusters").slice(0, 96)
        : "";
      const effectCells = {};
      const frameWildUpgrades = [];
      if (Array.isArray(run.events)) {
        for (let e = 0; e < run.events.length; e++) {
          const ev = run.events[e] || {};
          const weedCells = Array.isArray(ev.weedCells) ? ev.weedCells : [];
          for (let i = 0; i < weedCells.length; i++) effectCells[String(weedCells[i])] = "weed";
          const skullRemoved = Array.isArray(ev.skullRemoved) ? ev.skullRemoved : [];
          for (let i = 0; i < skullRemoved.length; i++) effectCells[String(skullRemoved[i])] = "skull";
          const wildUpgrades = Array.isArray(ev.wildUpgrades) ? ev.wildUpgrades : [];
          for (let i = 0; i < wildUpgrades.length; i++) {
            const up = wildUpgrades[i] && typeof wildUpgrades[i] === "object" ? wildUpgrades[i] : {};
            const key = String(up.key || "");
            if (key) effectCells[key] = "wild-up";
            frameWildUpgrades.push(up);
          }
        }
      }
      if (retriggerTransform && Array.isArray(retriggerTransform.scatterKeys)) {
        for (let i = 0; i < retriggerTransform.scatterKeys.length; i++) {
          effectCells[String(retriggerTransform.scatterKeys[i])] = "scatter";
        }
      }
      const hud = {
        freeSpinsLeft: Math.max(0, spinsLeft),
        bonusWin: Math.max(0, Math.floor(payout)),
        currentSpinWin: Math.max(0, spinPay),
        stickyWilds: snoopCountStickyWilds(state),
        multiplierCells: snoopCountMultiplierCells(state)
      };
      frames.push({
        frameType: "bonus_spin",
        reels: snoopGridToTextRows(grid, state),
        markedCells: Object.keys(state.marked || {}),
        cellMeta: snoopBuildCellMeta(state),
        effectCells,
        fills: run.cascades > 0 ? { cascades: run.cascades } : null,
        spinPay: spinPay,
        lineText:
          "FS " + played + "/" + Math.max(1, totalAwarded) +
          " | " +
          (payX > 0 ? ("Win " + payX + "x") : (preferDeadSpin && run.cascades === 0 ? "Dead spin" : "No win")) +
          detail,
        hud,
        banner: retriggerAward > 0 ? ("RETRIGGER! +" + retriggerAward + " Spins") : "",
        retriggerAward,
        retriggerScatters,
        wildUpgrades: frameWildUpgrades.slice(0, 64)
      });
      if (payout >= state.winCap) {
        payout = state.winCap;
        break;
      }
    }
    state.collectScatters = originalCollect;
    return {
      spinsPlayed: played,
      totalAwarded,
      retriggeredSpins,
      payout: Math.max(0, Math.min(state.winCap, payout)),
      timeline: timeline.slice(0, 32),
      finalGrid: grid,
      frames: frames.slice(0, Math.max(1, totalAwarded)),
      biggestCascadeWin: Math.max(0, Math.floor(Number(biggestCascadeWin) || 0))
    };
  }

  function parseSnoopBuyTrigger(modeText) {
    const raw = String(modeText || "").trim().toLowerCase();
    const direct = /^buybonus[_-]?([3-6])$/.exec(raw);
    if (direct) return Math.max(3, Math.min(6, Math.floor(Number(direct[1]) || 3)));
    const short = /^buy[_-]?([3-6])$/.exec(raw);
    if (short) return Math.max(3, Math.min(6, Math.floor(Number(short[1]) || 3)));
    const prefixed = /^snoop[_-]?buy[_-]?([3-6])$/.exec(raw);
    if (prefixed) return Math.max(3, Math.min(6, Math.floor(Number(prefixed[1]) || 3)));
    return 0;
  }

  function spinSnoopDollars(bet, options) {
    const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
    const opts = options && typeof options === "object" ? options : {};
    const mode = String(opts.mode || "spin").trim().toLowerCase();
    const buyTrigger = parseSnoopBuyTrigger(mode);
    const isHype = mode === "hype";

    let wagerMult = 1;
    if (isHype) {
      wagerMult = Math.max(1, Math.floor(Number(SNOOP_CFG.hypeCostX) || 20));
    } else if (buyTrigger >= 3) {
      wagerMult = Math.max(1, Math.floor(Number(SNOOP_CFG.buyBonusCosts[buyTrigger]) || 1));
    }
    const wager = Math.max(1, Math.floor(safeBet * wagerMult));
    const state = snoopCreateRoundState(safeBet);
    const lineWins = [];

    let basePayout = 0;
    let bonusTriggered = false;
    let freeSpinsAwarded = 0;
    let freeSpinsPlayed = 0;
    let freeSpinPayout = 0;
    let biggestCascadeWin = 0;
    let grid = snoopBuildFreshGrid(state);
    const bonusFrames = [];

    if (buyTrigger >= 3) {
      bonusTriggered = true;
      freeSpinsAwarded = snoopFsAward(buyTrigger);
      lineWins.push("BUY BONUS " + buyTrigger + " SCAT (" + wagerMult + "x bet)");
      const introBeforeRows = snoopGridToTextRows(grid, state);
      const introBeforeMeta = snoopBuildCellMeta(state);
      const transform = snoopTransformScattersForFeature(state, grid, buyTrigger);
      grid = transform.grid;
      lineWins.push("Transform: " + transform.transformedWilds + " Sticky Wild | " + transform.transformedMultipliers + " x10 Cells");
      bonusFrames.push({
        frameType: "bonus_intro",
        reels: introBeforeRows,
        markedCells: Array.isArray(transform.scatterKeys) ? transform.scatterKeys.slice(0) : [],
        cellMeta: introBeforeMeta,
        fills: null,
        spinPay: 0,
        lineText: "BONUS BUY START | " + freeSpinsAwarded + " Free Spins",
        intro: {
          awardedSpins: freeSpinsAwarded,
          scatterKeys: Array.isArray(transform.scatterKeys) ? transform.scatterKeys.slice(0) : [],
          transformations: Array.isArray(transform.transformations) ? transform.transformations.slice(0) : [],
          afterReels: snoopGridToTextRows(grid, state),
          afterCellMeta: snoopBuildCellMeta(state)
        }
      });
    } else {
      const baseRun = snoopRunCascades(state, grid, { guaranteedWild: isHype ? 1 : 0 });
      basePayout = Math.max(0, Math.floor(Number(baseRun.payout) || 0));
      grid = baseRun.finalGrid;
      if (baseRun.biggestCascadeWin > biggestCascadeWin) biggestCascadeWin = baseRun.biggestCascadeWin;
      for (let i = 0; i < baseRun.lineWins.length && lineWins.length < 42; i++) lineWins.push(baseRun.lineWins[i]);
      if (isHype) lineWins.unshift("Hype Spin: Guaranteed 1 Sticky Wild");
      if (state.scatterCollected >= 3) {
        bonusTriggered = true;
        const scat = Math.max(3, Math.min(6, Math.floor(Number(state.scatterCollected) || 3)));
        freeSpinsAwarded = snoopFsAward(scat);
        const introBeforeRows = snoopGridToTextRows(grid, state);
        const introBeforeMeta = snoopBuildCellMeta(state);
        const transform = snoopTransformScattersForFeature(state, grid, scat);
        grid = transform.grid;
        lineWins.push("SCATTER x" + scat + " -> " + freeSpinsAwarded + " FS");
        lineWins.push("Transform: " + transform.transformedWilds + " Sticky Wild | " + transform.transformedMultipliers + " x10 Cells");
        bonusFrames.push({
          frameType: "bonus_intro",
          reels: introBeforeRows,
          markedCells: Array.isArray(transform.scatterKeys) ? transform.scatterKeys.slice(0) : [],
          cellMeta: introBeforeMeta,
          fills: null,
          spinPay: 0,
          lineText: "FEATURE TRIGGER | SCATTER x" + scat + " -> " + freeSpinsAwarded + " FS",
          intro: {
            awardedSpins: freeSpinsAwarded,
            scatterKeys: Array.isArray(transform.scatterKeys) ? transform.scatterKeys.slice(0) : [],
            transformations: Array.isArray(transform.transformations) ? transform.transformations.slice(0) : [],
            afterReels: snoopGridToTextRows(grid, state),
            afterCellMeta: snoopBuildCellMeta(state)
          }
        });
      }
    }

    if (freeSpinsAwarded > 0) {
      const fs = runSnoopFeatureSpins(state, grid, freeSpinsAwarded);
      freeSpinsPlayed = Math.max(0, Math.floor(Number(fs.spinsPlayed) || 0));
      freeSpinPayout = Math.max(0, Math.floor(Number(fs.payout) || 0));
      if (fs.biggestCascadeWin > biggestCascadeWin) biggestCascadeWin = fs.biggestCascadeWin;
      grid = fs.finalGrid;
      if (fs.timeline.length) lineWins.push("FS: " + fs.timeline.slice(0, 8).join(" / "));
      if (Array.isArray(fs.frames) && fs.frames.length) {
        for (let i = 0; i < fs.frames.length && bonusFrames.length < 96; i++) {
          bonusFrames.push(fs.frames[i]);
        }
      }
      bonusFrames.push({
        frameType: "bonus_end",
        reels: snoopGridToTextRows(grid, state),
        markedCells: [],
        cellMeta: snoopBuildCellMeta(state),
        fills: null,
        spinPay: 0,
        lineText: "BONUS COMPLETE | Total " + Math.floor(freeSpinPayout / Math.max(1, safeBet)) + "x",
        summary: {
          bonusWin: Math.max(0, Math.floor(freeSpinPayout)),
          biggestCascadeWin: Math.max(0, Math.floor(Number(biggestCascadeWin) || 0))
        }
      });
    }

    const uncapped = Math.max(0, basePayout + freeSpinPayout);
    const cap = Math.max(1, Math.floor(Number(state.winCap) || (safeBet * 10000)));
    const payoutWanted = Math.max(0, Math.min(cap, uncapped));
    const multiplier = safeBet > 0 ? Number((payoutWanted / safeBet).toFixed(2)) : 0;
    const outcome = multiplier >= 300 ? "jackpot" : (multiplier > 0 ? "win" : "lose");
    const summary = lineWins.length
      ? lineWins.slice(0, 3).join(" | ")
      : "No clusters";

    return {
      gameId: "snoop_dogg_dollars",
      bet: wager,
      baseBet: safeBet,
      buyX: wagerMult,
      reels: snoopGridToTextRows(grid, state),
      multiplier,
      payoutWanted,
      outcome,
      summary: String(summary || "No clusters").slice(0, 220),
      paylines: 0,
      lineIds: [],
      lineWins: lineWins.slice(0, 24),
      scatterCount: Math.max(0, Math.floor(Number(state.scatterCollected) || 0)),
      bonusTriggered: Boolean(bonusTriggered),
      freeSpinsAwarded,
      freeSpinsPlayed,
      freeSpinPayout,
      bonusFrames: bonusFrames.slice(0, 96),
      biggestCascadeWin: Math.max(0, Math.floor(Number(biggestCascadeWin) || 0)),
      cellMeta: snoopBuildCellMeta(state),
      rtpTarget: Number(SNOOP_CFG.rtp) || Number(GAME_DEFS.snoop_dogg_dollars.rtp) || 0.96
    };
  }

  function simulateSnoopDollars(spins, bet, options) {
    const n = Math.max(1, Math.floor(Number(spins) || 100000));
    const stake = Math.max(1, Math.floor(Number(bet) || 1));
    const opts = options && typeof options === "object" ? options : {};
    let totalWager = 0;
    let totalPayout = 0;
    let wins = 0;
    let jackpots = 0;
    for (let i = 0; i < n; i++) {
      const out = spinSnoopDollars(stake, opts);
      const w = Math.max(1, Math.floor(Number(out && out.bet) || stake));
      const p = Math.max(0, Math.floor(Number(out && out.payoutWanted) || 0));
      totalWager += w;
      totalPayout += p;
      if (p > 0) wins += 1;
      if (String(out && out.outcome || "") === "jackpot") jackpots += 1;
    }
    return {
      gameId: "snoop_dogg_dollars",
      spins: n,
      totalWager,
      totalPayout,
      rtp: totalWager > 0 ? Number((totalPayout / totalWager).toFixed(6)) : 0,
      hitRate: Number((wins / n).toFixed(6)),
      jackpotRate: Number((jackpots / n).toFixed(6))
    };
  }

  function spin(gameId, bet, options) {
    const id = String(gameId || "slots").trim().toLowerCase();
    if (id === "slots_v2") return spinV2(bet, options);
    if (id === "snoop_dogg_dollars") return spinSnoopDollars(bet, options);
    if (id === "slots_v3") return spinV3(bet, options);
    if (id === "slots_v4") return spinV4(bet, options);
    if (id === "slots_v6") return spinV6(bet, options);
    if (id === "le_bandit") return { gameId: "le_bandit", payoutWanted: 0, multiplier: 0, outcome: "lose", bet }; // Stub for server side fallback
    return spinV1(bet, options);
  }

  const api = {
    spin,
    getDefinitions,
    simulateSnoopDollars
  };

  window.GTModules.slots = api;
})();
