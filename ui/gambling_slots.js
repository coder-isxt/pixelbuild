window.GTModules = window.GTModules || {};

(function initGamblingSlotsSite() {
  "use strict";

  const SAVED_AUTH_KEY = "growtopia_saved_auth_v1";
  const GAME_IDS = ["blackjack", "slots_v2", "slots_v7", "le_bandit", "tower", "mines", "snoop_dogg_dollars"];

  // This page is now a standalone casino site.
  // World-based machine browsing is on gambling.html

  // Demo casino mode: independent slot experience not tied to user-hosted machines
  const STANDALONE_MACHINE = {
    tileKey: "demo_slots",
    type: "slots",
    typeName: "Demo Slots",
    tx: 0,
    ty: 0,
    minBet: 1,
    maxBet: 10000,
    maxPayoutMultiplier: 100,
    volatility: "medium",
    reels: 3,
    rows: 1,
    earningsLocks: 99999999,
    ownerName: "Demo",
    ownerAccountId: "demo",
    inUseAccountId: null,
    inUseName: "",
    stats: {
      plays: 0,
      totalBet: 0,
      totalPayout: 0,
      lastOutcome: "lose",
      lastMultiplier: 0,
      lastSlotsText: "",
      lastSlotsLineIds: "",
      lastSlotsLines: "",
      blackjackState: null // { deck, playerHand, dealerHand, active, message }
    }
  };

  // UI-only feature: show different slot game names than the in-game machines
  // This makes the web gamble UI feel distinct from the actual game slots.
  const INFINITE_BANK = true; // toggle to make all banks infinite in the UI
  const UI_GAME_ALIASES = {
    blackjack: "Blackjack",
    slots_v2: "Six Six Six",
    le_bandit: "Le Bandit",
    tower: "Tower",
    mines: "Mines",
    snoop_dogg_dollars: "Snoop Dogg Dollars"
  };
  const VOLATILITY_OVERRIDES = {
    slots_v2: "very-high",
    le_bandit: "high",
    snoop_dogg_dollars: "high"
  };
  const SNOOP_UI = {
    hypeCostX: 20,
    buyCostByScatter: { 3: 80, 4: 140, 5: 220, 6: 320 }
  };
  const BONUS_PHASES = {
    BASE_IDLE: "BASE_IDLE",
    BASE_SPINNING: "BASE_SPINNING",
    BASE_CASCADE: "BASE_CASCADE",
    BASE_RESOLVING: "BASE_RESOLVING",
    BONUS_INTRO: "BONUS_INTRO",
    BONUS_SPINNING: "BONUS_SPINNING",
    BONUS_CASCADE: "BONUS_CASCADE",
    BONUS_RESOLVING: "BONUS_RESOLVING",
    BONUS_END: "BONUS_END"
  };
  const TOWER_CONFIG = {
    floors: 8,
    cols: 5,
    difficulties: {
      easy: { id: "easy", label: "Easy", traps: 1, stepMult: 1.19 },
      normal: { id: "normal", label: "Normal", traps: 2, stepMult: 1.58 },
      hard: { id: "hard", label: "Hard", traps: 3, stepMult: 2.38 },
      extreme: { id: "extreme", label: "Extreme", traps: 4, stepMult: 4.75 }
    }
  };
  const MINES_CONFIG = {
    rows: 5,
    cols: 5,
    totalTiles: 25,
    minMines: 1,
    maxMines: 24,
    defaultMines: 5,
    houseEdge: 0.04
  };
  const PAYLINES_5 = [
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

  const SYMBOL_LABELS = {
    CHERRY: "Cherry", LEMON: "Lemon", BAR: "Bar", BELL: "Bell", SEVEN: "Seven", "7": "Seven",
    GEM: "Gem", PICK: "Pickaxe", MINER: "Miner", GOLD: "Gold", DYN: "Dynamite", WILD: "Wild", SCAT: "Scatter", BONUS: "Bonus",
    RUBY: "Ruby", EMER: "Emerald", CLUB: "Club", RING: "Ring", SKULL: "Skull", REAPR: "Reaper", BLOOD: "Blood",
    LEAF: "Leaf", STON: "Stone", MASK: "Mask", IDOL: "Idol", ORAC: "Oracle", FRGT: "Forgotten",
    COIN: "Coin", ORE: "Ore", CART: "Cart", RELC: "Relic", "?": "Unknown",
    BONE: "Bone", PENT: "Pentagram", BLU_WHEEL: "Blue Wheel", RED_WHEEL: "Red Wheel", BLU_6: "Blue 6", RED_6: "Red 6",
    TRAP: "Trap", CHEESE: "Cheese", BEER: "Beer", BAG: "Bag", HAT: "Hat", WINT: "Wanted", RAIN: "Rain",
    CLOVR: "Clover", POT: "Pot of Gold", LOCK: "Locked",
    MULT: "Multiplier", BOMB: "Bomb", JACK: "Jackpot", COL: "Collect", BLANK: "Tease",
    DIME: "Dime Bag", LITE: "Lighter", MIC: "Mic", BILL: "Dollar", CHN: "Chain", LOWR: "Lowrider", DOGG: "Dogg", CROW: "Crown", WEED: "Weed"
  };

  const SYMBOL_ICONS = {
    CHERRY: "\u{1F352}", LEMON: "\u{1F34B}", BAR: "\u25A0", BELL: "\u{1F514}", SEVEN: "7", "7": "7",
    GEM: "\u{1F48E}", PICK: "\u26CF", MINER: "\u{1F477}", GOLD: "\u{1FA99}", DYN: "\u{1F4A3}", WILD: "\u2728", SCAT: "\u{1F31F}", BONUS: "\u{1F381}",
    RUBY: "\u2666", EMER: "\u{1F49A}", CLUB: "\u2663", RING: "\u{1F48D}", SKULL: "\u2620", REAPR: "\u2623", BLOOD: "\u2697",
    LEAF: "\u{1F343}", STON: "\u{1FAA8}", MASK: "\u{1F3AD}", IDOL: "\u{1F5FF}", ORAC: "\u{1F52E}", FRGT: "\u{1F56F}",
    COIN: "\u{1FA99}", ORE: "\u26D3", CART: "\u{1F6D2}", RELC: "\u{1F4FF}", "?": "\u2754",
    BONE: "\u2694", PENT: "\u26E7", BLU_WHEEL: "\u25C9", RED_WHEEL: "\u25C9", BLU_6: "6", RED_6: "6",
    TRAP: "\u{1F4A9}", CHEESE: "\u{1F9C0}", BEER: "\u{1F37A}", BAG: "\u{1F4B0}", HAT: "\u{1F3A9}", WINT: "\u{1F46E}", RAIN: "\u{1F308}",
    CLOVR: "\u2618", POT: "\u{1F4B0}", LOCK: "\u{1F512}",
    MULT: "\u2716", BOMB: "\u{1F4A3}", JACK: "\u{1F451}", COL: "\u{1F9F2}", BLANK: "\u2736",
    DIME: "\u{1F4BC}", LITE: "\u{1F526}", MIC: "\u{1F3A4}", BILL: "\u{1F4B5}", CHN: "\u26D3", LOWR: "\u{1F697}", DOGG: "\u{1F436}", CROW: "\u{1F451}", WEED: "\u{1F33F}"
  };

  const SYMBOL_CLASSES = {
    WILD: "wild",
    SCAT: "scatter",
    BONUS: "bonus",
    DYN: "bonus",
    BLU_WHEEL: "sixblu",
    RED_WHEEL: "sixred",
    BLU_6: "sixblu",
    RED_6: "sixred",
    WINT: "wanted",
    RAIN: "rain",
    CLOVR: "rain",
    POT: "bonus",
    LOCK: "locked",
    MULT: "bonus",
    BOMB: "bonus",
    JACK: "bonus",
    COL: "scatter",
    BLANK: "locked",
    WEED: "bonus"
  };
  const SYMBOL_POOL = {
    blackjack: ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"],
    slots: ["CHERRY", "LEMON", "BAR", "BELL", "SEVEN"],
    slots_v2: ["SKULL", "BONE", "REAPR", "BLOOD", "PENT", "WILD", "BLU_WHEEL", "RED_WHEEL", "BLU_6", "RED_6"],
    le_bandit: ["TRAP", "CHEESE", "BEER", "BAG", "HAT", "WINT", "WILD", "RAIN", "COIN"],
    slots_v3: ["RUBY", "EMER", "CLUB", "RING", "SKULL", "REAPR", "BLOOD", "WILD", "SCAT"],
    slots_v4: ["LEAF", "STON", "MASK", "IDOL", "ORAC", "FRGT", "WILD", "SCAT"],
    slots_v6: ["COIN", "ORE", "GEM", "PICK", "CART", "RELC", "WILD", "SCAT"],
    snoop_dogg_dollars: ["DIME", "LITE", "LEAF", "MIC", "BILL", "CHN", "LOWR", "DOGG", "CROW", "SCAT", "WILD", "WEED", "SKULL"]
  };

  const authModule = (window.GTModules && window.GTModules.auth) || {};
  const authStorageModule = (window.GTModules && window.GTModules.authStorage) || {};
  const dbModule = (window.GTModules && window.GTModules.db) || {};
  const slotsModule = (window.GTModules && window.GTModules.slots) || {};
  const winCounterModule = (window.GTModules && window.GTModules.winCounter) || {};
  const tumbleEngineModule = (window.GTModules && window.GTModules.tumbleEngine) || {};

  const MACHINE_DEFS = buildMachineDefinitions();
  const LOCK_CURRENCIES = resolveLockCurrencies();
  const DISPLAY_LOCK_ORDER = ["WL", "OL", "EL", "RL"];
  const MACHINE_CATEGORY_DEFS = [
    { id: "all", label: "All Games" },
    { id: "slots", label: "Slots" },
    { id: "table", label: "Table" },
    { id: "risk", label: "Risk" }
  ];
  const UI_SETTINGS_KEY = "growtopia_slots_ui_settings_v2";
  const DEFAULT_UI_SETTINGS = {
    soundEnabled: true,
    soundVolume: 0.8,
    turbo: false,
    autoplayCount: 0,
    autoplayStopOnBigWin: true,
    autoplayStopBalance: 0
  };
  const AUTOPLAY_COUNTS = [0, 10, 25, 50, 100];
  const BIG_WIN_MULTIPLIER = 25;
  const SESSION_NAV_TRANSFER_KEY = "gt_session_nav_transfer_v1";
  const VAULT_BACKUP_KEY_PREFIX = "growtopia_slots_vault_backup_v1_";
  const VAULT_CREDIT_ROLES = new Set(["admin", "manager", "owner"]);

  const state = {
    db: null,
    network: {},
    user: null,
    machines: [],
    selectedMachineKey: "",
    walletLocks: 0,
    webVaultLocks: 0,
    walletBreakdownText: "0 WL",
    refs: { inventory: null },
    handlers: { inventory: null },
    spinBusy: false,
    spinTimer: 0,
    currentBetValue: 1,
    lockDisplayIndex: 0,
    machineCategory: "all",
    uiSettings: { ...DEFAULT_UI_SETTINGS },
    autoplay: { active: false, left: 0, total: 0, mode: "spin" },
    spinHistory: [],
    currentWinValue: 0,
    currentWinBetValue: 1,
    lastPayoutValue: 0,
    winCounterSkipUntil: 0,
    quickStopRequested: false,
    ephemeral: { rows: null, lineIds: [], lineWins: [], markedCells: [], cellMeta: {}, effectCells: {}, upgradeFlashes: {} },
    bonusFlow: {
      phase: "BASE_IDLE",
      active: false,
      machineType: "",
      spinsLeft: 0,
      bonusWin: 0,
      currentSpinWin: 0,
      stickyWilds: 0,
      multiplierCells: 0,
      activeMultiplier: 1,
      spinsTotal: 0,
      spinsPlayed: 0,
      panelTitle: "FREE SPINS"
    },
    tower: {
      roundsByMachine: {},
      difficultyByMachine: {}
    },
    mines: {
      roundsByMachine: {},
      minesByMachine: {}
    },
    vaultRecoveryInFlight: false
  };

  const els = {
    openVaultBtn: document.getElementById("openVaultBtn"),
    vaultModal: document.getElementById("vaultModal"),
    vaultAmount: document.getElementById("vaultAmount"),
    vaultGameBalance: document.getElementById("vaultGameBalance"),
    vaultWebBalance: document.getElementById("vaultWebBalance"),
    vaultUnitHint: document.getElementById("vaultUnitHint"),
    vaultDepositBtn: document.getElementById("vaultDepositBtn"),
    vaultWithdrawBtn: document.getElementById("vaultWithdrawBtn"),
    vaultAdminPanel: document.getElementById("vaultAdminPanel"),
    vaultAdminTarget: document.getElementById("vaultAdminTarget"),
    vaultAdminAmount: document.getElementById("vaultAdminAmount"),
    vaultAdminCreditBtn: document.getElementById("vaultAdminCreditBtn"),
    vaultAdminStatus: document.getElementById("vaultAdminStatus"),
    closeVaultBtn: document.getElementById("closeVaultBtn"),
    vaultStatus: document.getElementById("vaultStatus"),
    openDashboardBtn: document.getElementById("openDashboardBtn"),
    openGameBtn: document.getElementById("openGameBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    authUsername: document.getElementById("authUsername"),
    authPassword: document.getElementById("authPassword"),
    authLoginBtn: document.getElementById("authLoginBtn"),
    authCreateBtn: document.getElementById("authCreateBtn"),
    authStatus: document.getElementById("authStatus"),
    sessionLabel: document.getElementById("sessionLabel"),
    walletLabel: document.getElementById("walletLabel"),
    machineSelect: document.getElementById("machineSelect"),
    machineCategoryTabs: document.getElementById("machineCategoryTabs"),
    machineList: document.getElementById("machineList"),
    currentBetDisplay: document.getElementById("currentBetDisplay"),
    towerDifficultyWrap: document.getElementById("towerDifficultyWrap"),
    towerDifficultySelect: document.getElementById("towerDifficultySelect"),
    minesCountWrap: document.getElementById("minesCountWrap"),
    minesCountSelect: document.getElementById("minesCountSelect"),
    snoopBuyWrap: document.getElementById("snoopBuyWrap"),
    snoopBuySelect: document.getElementById("snoopBuySelect"),
    spinBtn: document.getElementById("spinBtn"),
    towerCashoutBtn: document.getElementById("towerCashoutBtn"),
    minesCashoutBtn: document.getElementById("minesCashoutBtn"),
    snoopHypeBtn: document.getElementById("snoopHypeBtn"),
    snoopBuyBtn: document.getElementById("snoopBuyBtn"),
    bjHitBtn: document.getElementById("bjHitBtn"),
    bjStandBtn: document.getElementById("bjStandBtn"),
    bjDoubleBtn: document.getElementById("bjDoubleBtn"),
    bjSplitBtn: document.getElementById("bjSplitBtn"),
    buyBonusBtn: document.getElementById("buyBonusBtn"),
    lastWinLabel: document.getElementById("lastWinLabel"),
    stage: document.getElementById("stage"),
    boardWrap: document.getElementById("boardWrap"),
    slotBoard: document.getElementById("slotBoard"),
    slotOverlay: document.getElementById("slotOverlay"),
    particles: document.getElementById("particles"),
    lineList: document.getElementById("lineList"),
    bonusHud: document.getElementById("bonusHud"),
    bonusHudState: document.getElementById("bonusHudState"),
    bonusHudLeft: document.getElementById("bonusHudLeft"),
    bonusHudWin: document.getElementById("bonusHudWin"),
    bonusHudSpin: document.getElementById("bonusHudSpin"),
    bonusHudSticky: document.getElementById("bonusHudSticky"),
    bonusHudMulti: document.getElementById("bonusHudMulti"),
    bonusSpinPanel: document.getElementById("bonusSpinPanel"),
    bonusSpinTitle: document.getElementById("bonusSpinTitle"),
    bonusSpinCount: document.getElementById("bonusSpinCount"),
    bonusSpinTotal: document.getElementById("bonusSpinTotal"),
    bonusSpinProgressFill: document.getElementById("bonusSpinProgressFill"),
    bonusBanner: document.getElementById("bonusBanner"),
    bonusOverlay: document.getElementById("bonusOverlay"),
    bonusOverlayTitle: document.getElementById("bonusOverlayTitle"),
    bonusOverlayText: document.getElementById("bonusOverlayText"),
    bonusOverlaySub: document.getElementById("bonusOverlaySub"),
    bonusOverlayContinueBtn: document.getElementById("bonusOverlayContinueBtn"),
    statBank: document.getElementById("statBank"),
    statMaxBet: document.getElementById("statMaxBet"),
    statPlays: document.getElementById("statPlays"),
    statPayout: document.getElementById("statPayout"),
    userBalanceDisplay: document.getElementById("userBalanceDisplay"),
    premiumTopBar: document.getElementById("premiumTopbar"),
    premiumTopBet: document.getElementById("premiumTopBet"),
    premiumTopWin: document.getElementById("premiumTopWin"),
    winMeter: document.getElementById("winMeter"),
    winMeterValue: document.getElementById("winMeterValue"),
    winMeterMult: document.getElementById("winMeterMult"),
    premiumAutoplayStatus: document.getElementById("premiumAutoplayStatus"),
    premiumSoundToggle: document.getElementById("premiumSoundToggle"),
    premiumSettingsBtn: document.getElementById("premiumSettingsBtn"),
    premiumHistoryBtn: document.getElementById("premiumHistoryBtn"),
    premiumFairnessBtn: document.getElementById("premiumFairnessBtn"),
    premiumSettingsPanel: document.getElementById("premiumSettingsPanel"),
    premiumHistoryPanel: document.getElementById("premiumHistoryPanel"),
    premiumHistoryList: document.getElementById("premiumHistoryList"),
    premiumHistoryClear: document.getElementById("premiumHistoryClear"),
    premiumVolume: document.getElementById("premiumVolume"),
    premiumTurboToggle: document.getElementById("premiumTurboToggle"),
    premiumStopBigWin: document.getElementById("premiumStopBigWin"),
    premiumStopBalance: document.getElementById("premiumStopBalance"),
    premiumQuickBet: document.getElementById("premiumQuickBet"),
    premiumBetMinus: document.getElementById("premiumBetMinus"),
    premiumBetPlus: document.getElementById("premiumBetPlus"),
    premiumMaxBet: document.getElementById("premiumMaxBet"),
    premiumAutoplaySelect: document.getElementById("premiumAutoplaySelect"),
    premiumAutoplayBtn: document.getElementById("premiumAutoplayBtn"),
    premiumWinBanner: document.getElementById("premiumWinBanner"),
    tumbleIndicator: document.getElementById("tumbleIndicator"),
    fairnessModal: document.getElementById("fairnessModal"),
    premiumFairnessClose: document.getElementById("premiumFairnessClose"),
    premiumSeedLabel: document.getElementById("premiumSeedLabel"),
    viewLogin: document.getElementById("viewLogin"),
    viewLobby: document.getElementById("viewLobby"),
    viewGame: document.getElementById("viewGame"),
    backToLobbyBtn: document.getElementById("backToLobbyBtn")
  };

  installCasinoVisualRefresh();

  function installCasinoVisualRefresh() {
    if (!(document && document.head)) return;
    if (document.getElementById("casinoVisualRefresh")) return;
    const style = document.createElement("style");
    style.id = "casinoVisualRefresh";
    style.textContent = `
      body.casino-premium .page,
      .page {
        width: min(1520px, 96vw);
      }

      body.casino-premium .head,
      body.casino-premium .card,
      .head,
      .card {
        border-color: rgba(239, 194, 109, 0.36);
        box-shadow:
          inset 0 0 0 1px rgba(255, 232, 183, 0.08),
          0 14px 34px rgba(0, 0, 0, 0.28);
      }

      body.casino-premium .machine-item,
      .machine-item {
        border-color: rgba(239, 194, 109, 0.34);
        background: linear-gradient(180deg, rgba(34, 47, 40, 0.94), rgba(21, 30, 25, 0.96));
      }

      body.casino-premium .machine-item .name,
      .machine-item .name {
        color: #ffe7b5;
      }

      body.casino-premium .machine-item .info,
      .machine-item .info {
        color: #dae6db;
      }

      #viewGame .stage {
        border-radius: 20px;
      }

      #viewGame .stage-wrap {
        max-width: min(1180px, 96vw);
        margin-inline: auto;
      }

      #viewGame .stage.theme-slots_v2,
      body.casino-premium #viewGame .stage.theme-slots_v2 {
        border: 1px solid rgba(239, 194, 109, 0.68);
        border-radius: 22px;
        padding: 14px;
        background:
          radial-gradient(900px 280px at 50% -120px, rgba(245, 218, 154, 0.26), transparent 66%),
          linear-gradient(180deg, rgba(21, 31, 26, 0.98), rgba(10, 15, 13, 0.99));
        box-shadow:
          inset 0 0 0 1px rgba(255, 232, 183, 0.14),
          0 26px 64px rgba(0, 0, 0, 0.52);
      }

      #viewGame .stage.theme-slots_v2 .premium-topbar {
        border-color: rgba(239, 194, 109, 0.52);
        background: linear-gradient(180deg, rgba(36, 49, 41, 0.94), rgba(22, 31, 27, 0.96));
        box-shadow: inset 0 0 0 1px rgba(255, 235, 193, 0.1);
      }

      #viewGame .stage.theme-slots_v2 .board-wrap {
        border: 1px solid rgba(239, 194, 109, 0.56);
        border-radius: 18px;
        padding: 12px;
        background:
          linear-gradient(180deg, rgba(35, 45, 39, 0.97), rgba(17, 24, 21, 0.98));
        box-shadow:
          inset 0 0 0 1px rgba(255, 236, 194, 0.12),
          inset 0 10px 18px rgba(255, 255, 255, 0.02),
          inset 0 -16px 28px rgba(0, 0, 0, 0.36);
      }

      #viewGame .stage.theme-slots_v2 .board-wrap.dimmed {
        filter: brightness(0.9) saturate(0.95);
      }

      #viewGame .stage.theme-slots_v2 .board {
        gap: 8px;
      }

      #viewGame .stage.theme-slots_v2 .reel {
        border: 1px solid rgba(239, 194, 109, 0.36);
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(52, 67, 58, 0.95), rgba(30, 40, 34, 0.97));
        box-shadow:
          inset 0 0 0 1px rgba(255, 231, 184, 0.08),
          inset 0 -10px 18px rgba(0, 0, 0, 0.34);
      }

      #viewGame .stage.theme-slots_v2 .cell {
        border: 1px solid rgba(239, 194, 109, 0.28);
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(89, 107, 96, 0.98), rgba(51, 64, 57, 0.98));
        box-shadow:
          inset 0 0 0 1px rgba(255, 238, 204, 0.1),
          inset 0 -8px 14px rgba(0, 0, 0, 0.24);
      }

      #viewGame .stage.theme-slots_v2 .cell .icon {
        font-size: clamp(24px, 3.5vw, 34px);
        color: #fff1d2;
        text-shadow:
          0 1px 0 rgba(0, 0, 0, 0.6),
          0 0 10px rgba(255, 235, 190, 0.2);
      }

      #viewGame .stage.theme-slots_v2 .line-list {
        border-color: rgba(239, 194, 109, 0.42);
        border-radius: 12px;
        min-height: 58px;
        background: rgba(22, 30, 26, 0.92);
      }

      #viewGame .stage.theme-slots_v2 .line-badge {
        border-color: rgba(239, 194, 109, 0.38);
        background: rgba(34, 45, 38, 0.96);
        color: #f2f7f2;
      }

      #viewGame .stage.theme-slots_v2 .line-badge.hot {
        border-color: rgba(112, 197, 143, 0.72);
        background: rgba(25, 65, 45, 0.95);
      }

      #viewGame .stage.theme-slots_v2 .game-controls {
        border-color: rgba(239, 194, 109, 0.36);
        background: linear-gradient(180deg, rgba(29, 40, 34, 0.94), rgba(17, 24, 21, 0.96)) !important;
        box-shadow: inset 0 0 0 1px rgba(255, 236, 194, 0.08);
      }

      #viewGame .stage.theme-slots_v2 .quick-btn,
      #viewGame .stage.theme-slots_v2 .chip {
        border-color: rgba(239, 194, 109, 0.54);
        background: linear-gradient(180deg, rgba(61, 46, 26, 0.94), rgba(43, 32, 18, 0.96));
        color: #f8ebcf;
      }

      #viewGame .stage.theme-slots_v2 #spinBtn {
        width: 90px;
        height: 90px;
        min-width: 90px !important;
        border: 3px solid rgba(255, 226, 160, 0.88);
        background:
          radial-gradient(circle at 36% 26%, rgba(255, 98, 90, 0.98), rgba(164, 25, 24, 0.99));
        color: #fff4d9;
        box-shadow:
          inset 0 0 0 2px rgba(255, 237, 201, 0.24),
          0 0 0 4px rgba(19, 10, 8, 0.54),
          0 10px 24px rgba(0, 0, 0, 0.4),
          0 0 22px rgba(255, 100, 90, 0.28);
      }

      #viewGame .stage.theme-slots_v2 .bonus-hud {
        border-color: rgba(239, 194, 109, 0.42);
        background: linear-gradient(180deg, rgba(37, 48, 41, 0.94), rgba(20, 29, 24, 0.96));
      }

      #viewGame .bonus-spin-panel {
        position: absolute;
        left: 50%;
        top: 10px;
        transform: translateX(-50%);
        width: min(420px, calc(100% - 22px));
        border: 1px solid rgba(239, 194, 109, 0.62);
        border-radius: 12px;
        background:
          linear-gradient(180deg, rgba(31, 43, 37, 0.96), rgba(16, 23, 20, 0.98));
        box-shadow:
          inset 0 0 0 1px rgba(255, 236, 194, 0.1),
          0 10px 22px rgba(0, 0, 0, 0.34);
        display: grid;
        gap: 3px;
        align-items: center;
        justify-items: center;
        padding: 7px 10px 8px;
        z-index: 14;
        text-align: center;
        pointer-events: none;
      }

      #viewGame .bonus-spin-panel .bonus-spin-title {
        font-size: 8px;
        letter-spacing: 0.12em;
        color: #ffe8b5;
      }

      #viewGame .bonus-spin-panel .bonus-spin-count {
        font-size: 15px;
        color: #f6fbf6;
      }

      #viewGame .bonus-spin-panel .bonus-spin-total {
        font-size: 8px;
        color: #d4e2d8;
      }

      #viewGame .bonus-spin-panel .bonus-spin-progress {
        width: 100%;
        height: 7px;
        border-radius: 999px;
        border: 1px solid rgba(239, 194, 109, 0.44);
        background: rgba(13, 19, 16, 0.9);
        overflow: hidden;
      }

      #viewGame .bonus-spin-panel .bonus-spin-progress > span {
        display: block;
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, rgba(255, 214, 133, 0.96), rgba(112, 197, 143, 0.96));
        box-shadow: 0 0 12px rgba(255, 217, 139, 0.4);
        transition: width 180ms ease;
      }

      #viewGame .stage.theme-slots_v2 .bonus-spin-panel {
        border-color: rgba(239, 194, 109, 0.62);
      }

      #viewGame .bonus-spin-panel.hidden {
        display: none !important;
      }

      @media (max-width: 980px) {
        #viewGame .stage.theme-slots_v2 #spinBtn {
          width: 78px;
          height: 78px;
          min-width: 78px !important;
          font-size: 10px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildMachineDefinitions() {
    const slotsDefs = typeof slotsModule.getDefinitions === "function" ? slotsModule.getDefinitions() : {};
    const fallback = {
      blackjack: { name: "Blackjack", minBet: 1, maxBet: 20000, maxPayoutMultiplier: 2.5, reels: 0, rows: 0, volatility: "table" },
      slots: { name: "Classic Slots", minBet: 1, maxBet: 30000, maxPayoutMultiplier: 10, reels: 3, rows: 1, volatility: "medium" },
      slots_v2: { name: "Neon Mine", minBet: 1, maxBet: 30000, maxPayoutMultiplier: 50, reels: 5, rows: 4, volatility: "very-high" },
      slots_v3: { name: "Blood Vault", minBet: 1, maxBet: 30000, maxPayoutMultiplier: 5000, reels: 5, rows: 4, volatility: "high" },
      slots_v4: { name: "Ancient Jungle", minBet: 1, maxBet: 30000, maxPayoutMultiplier: 5000, reels: 5, rows: 4, volatility: "high" },
      slots_v6: { name: "Deep Core", minBet: 1, maxBet: 30000, maxPayoutMultiplier: 5000, reels: 5, rows: 3, volatility: "high" },
      le_bandit: { name: "Le Bandit", minBet: 1, maxBet: 30000, maxPayoutMultiplier: 10000, reels: 6, rows: 5, volatility: "high" },
      tower: { name: "Tower", minBet: 1, maxBet: 30000, maxPayoutMultiplier: 25000, reels: 5, rows: 8, volatility: "risk" },
      mines: { name: "Mines", minBet: 1, maxBet: 30000, maxPayoutMultiplier: 25000, reels: 5, rows: 5, volatility: "risk" },
      snoop_dogg_dollars: { name: "Snoop Dogg Dollars", minBet: 1, maxBet: 30000, maxPayoutMultiplier: 10000, reels: 6, rows: 8, volatility: "high", mechanic: "tumble", payMode: "cluster", clusterMin: 6 }
    };
    const out = {};
    GAME_IDS.forEach((id) => {
      const row = slotsDefs[id] || {};
      const base = fallback[id] || fallback.slots;
      const layout = row && row.layout && typeof row.layout === "object" ? row.layout : {};
      out[id] = {
        id,
        name: String(row.name || base.name),
        minBet: Math.max(1, Math.floor(Number(row.minBet) || base.minBet)),
        maxBet: Math.max(1, Math.floor(Number(row.maxBet) || base.maxBet)),
        maxPayoutMultiplier: Math.max(1, Math.floor(Number(row.maxPayoutMultiplier) || base.maxPayoutMultiplier)),
        reels: Math.max(1, Math.floor(Number(layout.reels) || base.reels)),
        rows: Math.max(1, Math.floor(Number(layout.rows) || base.rows)),
        volatility: String(row.volatility || base.volatility || "medium").trim().toLowerCase(),
        mechanic: String(row.mechanic || base.mechanic || "classic").trim().toLowerCase(),
        payMode: String(row.payMode || base.payMode || "lines").trim().toLowerCase(),
        clusterMin: Math.max(0, Math.floor(Number(row.clusterMin || base.clusterMin) || 0)),
        symbolWeights: row.symbolWeights && typeof row.symbolWeights === "object" ? { ...row.symbolWeights } : {}
      };
    });
    Object.keys(slotsDefs || {}).forEach((id) => {
      if (out[id]) return;
      const row = slotsDefs[id] || {};
      const base = fallback[id] || fallback.slots;
      const layout = row && row.layout && typeof row.layout === "object" ? row.layout : {};
      out[id] = {
        id,
        name: String(row.name || base.name || id),
        minBet: Math.max(1, Math.floor(Number(row.minBet) || base.minBet || 1)),
        maxBet: Math.max(1, Math.floor(Number(row.maxBet) || base.maxBet || 30000)),
        maxPayoutMultiplier: Math.max(1, Math.floor(Number(row.maxPayoutMultiplier) || base.maxPayoutMultiplier || 10)),
        reels: Math.max(1, Math.floor(Number(layout.reels) || base.reels || 5)),
        rows: Math.max(1, Math.floor(Number(layout.rows) || base.rows || 3)),
        volatility: String(row.volatility || base.volatility || "medium").trim().toLowerCase(),
        mechanic: String(row.mechanic || base.mechanic || "classic").trim().toLowerCase(),
        payMode: String(row.payMode || base.payMode || "lines").trim().toLowerCase(),
        clusterMin: Math.max(0, Math.floor(Number(row.clusterMin || base.clusterMin) || 0)),
        symbolWeights: row.symbolWeights && typeof row.symbolWeights === "object" ? { ...row.symbolWeights } : {}
      };
    });
    // Apply UI-only aliases for display in the web UI
    Object.keys(UI_GAME_ALIASES).forEach((id) => {
      if (out[id]) out[id].name = UI_GAME_ALIASES[id];
    });
    Object.keys(VOLATILITY_OVERRIDES).forEach((id) => {
      if (out[id]) out[id].volatility = String(VOLATILITY_OVERRIDES[id] || out[id].volatility || "medium").trim().toLowerCase();
    });
    return out;
  }

  function formatVolatility(volatility) {
    const raw = String(volatility || "").trim().toLowerCase();
    if (!raw) return "Unknown";
    if (raw === "very-high") return "Very High";
    if (raw === "medium-high") return "Medium-High";
    if (raw === "high") return "High";
    if (raw === "medium") return "Medium";
    if (raw === "low") return "Low";
    if (raw === "risk") return "Risk";
    if (raw === "table") return "Table";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  // Blackjack Logic
  function getDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (let s of suits) {
      for (let r of ranks) {
        let val = parseInt(r);
        if (isNaN(val)) val = (r === 'A') ? 11 : 10;
        deck.push({ rank: r, suit: s, value: val, color: (s === '♥' || s === '♦') ? 'red' : 'black' });
      }
    }
    return deck.sort(() => Math.random() - 0.5);
  }

  function calculateHand(hand) {
    let score = 0;
    let aces = 0;
    for (let c of hand) {
      score += c.value;
      if (c.rank === 'A') aces++;
    }
    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }
    return score;
  }

  function isBlackjack(hand) {
    return hand.length === 2 && calculateHand(hand) === 21;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function nextFrame() { return new Promise((resolve) => window.requestAnimationFrame(() => resolve())); }
  function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
  function easeOutCubic(t) {
    const x = clamp01(t);
    return 1 - Math.pow(1 - x, 3);
  }
  function easeOutQuint(t) {
    const x = clamp01(t);
    return 1 - Math.pow(1 - x, 5);
  }
  function safeVibrate(ms) {
    if (!("vibrate" in navigator)) return;
    try { navigator.vibrate(Math.max(0, Math.floor(Number(ms) || 0))); } catch (_error) { /* no-op */ }
  }

  function loadUiSettings() {
    try {
      const raw = localStorage.getItem(UI_SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        soundEnabled: parsed && parsed.soundEnabled !== undefined ? Boolean(parsed.soundEnabled) : DEFAULT_UI_SETTINGS.soundEnabled,
        soundVolume: clamp01(parsed && parsed.soundVolume !== undefined ? Number(parsed.soundVolume) : DEFAULT_UI_SETTINGS.soundVolume),
        turbo: parsed && parsed.turbo !== undefined ? Boolean(parsed.turbo) : DEFAULT_UI_SETTINGS.turbo,
        autoplayCount: AUTOPLAY_COUNTS.indexOf(Math.max(0, Math.floor(Number(parsed && parsed.autoplayCount) || 0))) >= 0
          ? Math.max(0, Math.floor(Number(parsed.autoplayCount) || 0))
          : DEFAULT_UI_SETTINGS.autoplayCount,
        autoplayStopOnBigWin: parsed && parsed.autoplayStopOnBigWin !== undefined ? Boolean(parsed.autoplayStopOnBigWin) : DEFAULT_UI_SETTINGS.autoplayStopOnBigWin,
        autoplayStopBalance: Math.max(0, Math.floor(Number(parsed && parsed.autoplayStopBalance) || 0))
      };
    } catch (_error) {
      return { ...DEFAULT_UI_SETTINGS };
    }
  }

  function saveUiSettings() {
    try {
      localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(state.uiSettings));
    } catch (_error) {
      // ignore storage failures
    }
  }

  function createAudioManager() {
    let audioCtx = null;
    let masterGain = null;
    let unlocked = false;
    const loops = new Map();

    function ensureContext() {
      if (audioCtx) return audioCtx;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = clamp01(state.uiSettings.soundVolume);
      masterGain.connect(audioCtx.destination);
      return audioCtx;
    }

    function setVolume(volume) {
      state.uiSettings.soundVolume = clamp01(volume);
      if (masterGain) masterGain.gain.value = state.uiSettings.soundEnabled ? state.uiSettings.soundVolume : 0;
      saveUiSettings();
    }

    function setEnabled(enabled) {
      state.uiSettings.soundEnabled = Boolean(enabled);
      if (masterGain) masterGain.gain.value = state.uiSettings.soundEnabled ? state.uiSettings.soundVolume : 0;
      saveUiSettings();
      renderPremiumHud();
    }

    async function unlock() {
      const ctx = ensureContext();
      if (!ctx) return false;
      try {
        if (ctx.state === "suspended") await ctx.resume();
        unlocked = true;
        masterGain.gain.value = state.uiSettings.soundEnabled ? state.uiSettings.soundVolume : 0;
        return true;
      } catch (_error) {
        return false;
      }
    }

    function playTone(options) {
      const ctx = ensureContext();
      if (!ctx || !unlocked || !state.uiSettings.soundEnabled) return;
      const opts = options && typeof options === "object" ? options : {};
      const now = ctx.currentTime;
      const duration = Math.max(0.02, Number(opts.duration) || 0.08);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = String(opts.type || "triangle");
      const startFreq = Math.max(40, Number(opts.freqStart) || 440);
      const endFreq = Math.max(40, Number(opts.freqEnd) || startFreq);
      const volume = Math.max(0.0001, Math.min(0.35, Number(opts.volume) || 0.08));
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    function startLoop(id) {
      const key = String(id || "");
      if (!key || loops.has(key)) return;
      const ctx = ensureContext();
      if (!ctx || !unlocked || !state.uiSettings.soundEnabled) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      if (key === "countup") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(168, ctx.currentTime);
        gain.gain.setValueAtTime(0.0036, ctx.currentTime);
      } else {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(92, ctx.currentTime);
        gain.gain.setValueAtTime(0.0048, ctx.currentTime);
      }
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      loops.set(key, { osc, gain });
    }

    function stopLoop(id) {
      const key = String(id || "");
      const row = loops.get(key);
      if (!row) return;
      loops.delete(key);
      try {
        row.gain.gain.exponentialRampToValueAtTime(0.0001, ensureContext().currentTime + 0.08);
        row.osc.stop(ensureContext().currentTime + 0.1);
      } catch (_error) {
        // no-op
      }
    }

    function stopAllLoops() {
      const keys = Array.from(loops.keys());
      for (let i = 0; i < keys.length; i++) stopLoop(keys[i]);
    }

    function play(eventName) {
      const event = String(eventName || "").trim().toLowerCase();
      if (event === "spin_start") {
        startLoop("spin");
        playTone({ freqStart: 170, freqEnd: 220, duration: 0.08, type: "sine", volume: 0.032 });
        window.setTimeout(() => playTone({ freqStart: 220, freqEnd: 290, duration: 0.045, type: "triangle", volume: 0.02 }), 44);
        return;
      }
      if (event === "reel_stop") {
        playTone({ freqStart: 360, freqEnd: 300, duration: 0.045, type: "sine", volume: 0.03 });
        return;
      }
      if (event === "spin_end") {
        stopLoop("spin");
        return;
      }
      if (event === "countup_start") {
        startLoop("countup");
        return;
      }
      if (event === "countup_end") {
        stopLoop("countup");
        return;
      }
      if (event === "win_small") {
        playTone({ freqStart: 280, freqEnd: 430, duration: 0.14, type: "triangle", volume: 0.05 });
        return;
      }
      if (event === "win_medium") {
        playTone({ freqStart: 260, freqEnd: 520, duration: 0.18, type: "triangle", volume: 0.06 });
        window.setTimeout(() => playTone({ freqStart: 420, freqEnd: 620, duration: 0.14, type: "triangle", volume: 0.052 }), 92);
        return;
      }
      if (event === "win_big") {
        playTone({ freqStart: 170, freqEnd: 660, duration: 0.22, type: "triangle", volume: 0.076 });
        window.setTimeout(() => playTone({ freqStart: 350, freqEnd: 840, duration: 0.16, type: "triangle", volume: 0.062 }), 102);
        return;
      }
      if (event === "bonus_intro") {
        playTone({ freqStart: 210, freqEnd: 420, duration: 0.2, type: "sine", volume: 0.05 });
        window.setTimeout(() => playTone({ freqStart: 320, freqEnd: 560, duration: 0.16, type: "triangle", volume: 0.045 }), 116);
        return;
      }
      if (event === "bonus_tick") {
        playTone({ freqStart: 300, freqEnd: 380, duration: 0.05, type: "sine", volume: 0.028 });
        return;
      }
      if (event === "bonus_hit") {
        playTone({ freqStart: 240, freqEnd: 620, duration: 0.16, type: "triangle", volume: 0.058 });
        return;
      }
      if (event === "vault_deposit") {
        playTone({ freqStart: 260, freqEnd: 590, duration: 0.16, type: "triangle", volume: 0.09 });
        return;
      }
      if (event === "vault_withdraw") {
        playTone({ freqStart: 520, freqEnd: 280, duration: 0.14, type: "triangle", volume: 0.085 });
        return;
      }
      if (event === "admin_credit") {
        playTone({ freqStart: 300, freqEnd: 820, duration: 0.2, type: "sawtooth", volume: 0.11 });
        window.setTimeout(() => playTone({ freqStart: 520, freqEnd: 980, duration: 0.15, type: "triangle", volume: 0.085 }), 72);
        return;
      }
      if (event === "wallet_recover") {
        playTone({ freqStart: 210, freqEnd: 420, duration: 0.18, type: "sine", volume: 0.08 });
        return;
      }
      if (event === "bonus_loop_start") {
        startLoop("bonus");
        return;
      }
      if (event === "bonus_loop_end") {
        stopLoop("bonus");
        return;
      }
      if (event === "button_click") {
        playTone({ freqStart: 330, freqEnd: 410, duration: 0.045, type: "sine", volume: 0.02 });
      }
    }

    return {
      unlock,
      setEnabled,
      setVolume,
      play,
      startLoop,
      stopLoop,
      stopAllLoops
    };
  }

  function createReelAnimator() {
    let activeRun = null;

    function clearBoardClasses() {
      if (!(els.boardWrap instanceof HTMLElement)) return;
      els.boardWrap.classList.remove("reel-accelerate", "reel-decel", "reel-bounce");
    }

    async function animate(machine, finalRows, options) {
      const m = machine || STANDALONE_MACHINE;
      const rows = Math.max(1, Math.floor(Number(m.rows) || 1));
      const cols = Math.max(1, Math.floor(Number(m.reels) || 1));
      const finalGrid = Array.isArray(finalRows) && finalRows.length ? finalRows : randomRowsForMachine(m, 1);
      const turbo = Boolean(state.uiSettings.turbo);
      const opts = options && typeof options === "object" ? options : {};
      const anticipation = Boolean(opts.anticipation);
      const pool = SYMBOL_POOL[m.type] || SYMBOL_POOL.slots;
      const safePoolLen = Math.max(1, pool.length);
      const startTs = performance.now();
      const baseSpin = turbo ? 430 : 900;
      const stagger = turbo ? 84 : 142;
      const anticipationDelay = anticipation ? (turbo ? 150 : 310) : 0;
      const stopTimes = [];
      const stopped = [];
      const reelPhase = [];
      const reelStartTimes = [];
      const reelFrameTs = [];
      for (let c = 0; c < cols; c++) {
        const reelStart = startTs + (c * (turbo ? 16 : 24));
        reelStartTimes[c] = reelStart;
        stopTimes[c] = reelStart + baseSpin + (c * stagger) + (c === cols - 1 ? anticipationDelay : 0);
        stopped[c] = false;
        reelPhase[c] = Math.random() * safePoolLen;
        reelFrameTs[c] = startTs;
      }

      state.ephemeral.rows = randomRowsForMachine(m, 0);
      state.ephemeral.lineIds = [];
      state.ephemeral.lineWins = ["Spinning..."];
      renderBoard();

      if (els.boardWrap instanceof HTMLElement) {
        els.boardWrap.classList.add("reel-accelerate");
        els.boardWrap.classList.add("spinning");
      }

      const run = { cancelled: false, quickStop: false };
      activeRun = run;

      await new Promise((resolve) => {
        function step(ts) {
          if (run.cancelled) {
            resolve();
            return;
          }
          if (run.quickStop) {
            for (let c = 0; c < cols; c++) {
              if (stopped[c]) continue;
              stopTimes[c] = Math.min(stopTimes[c], ts + 48 + (c * 24));
            }
          }

          let allStopped = true;
          for (let c = 0; c < cols; c++) {
            if (stopped[c]) continue;
            allStopped = false;
            const reelStart = reelStartTimes[c];
            const reelStop = stopTimes[c];
            const reelDuration = Math.max(160, reelStop - reelStart);
            const reelProgress = Math.max(0, Math.min(1, (ts - reelStart) / reelDuration));
            const accelWindow = turbo ? 0.14 : 0.18;
            const decelStart = turbo ? 0.74 : 0.69;
            let speedFactor = 1;
            if (reelProgress < accelWindow) {
              speedFactor = Math.max(0.08, easeOutCubic(reelProgress / accelWindow));
            } else if (reelProgress > decelStart) {
              const tail = (reelProgress - decelStart) / (1 - decelStart);
              speedFactor = Math.max(0.06, 1 - (tail * tail * tail));
            }
            const dt = Math.max(8, Math.min(42, ts - reelFrameTs[c]));
            reelFrameTs[c] = ts;
            const baseSymbolsPerSecond = turbo ? 28 : 22;
            const anticipationLift = anticipation && c === cols - 1 && reelProgress > 0.84 ? 2.2 : 0;
            const symbolsPerSecond = Math.max(2, (baseSymbolsPerSecond * speedFactor) + anticipationLift);
            reelPhase[c] += (symbolsPerSecond * dt) / 1000;
            for (let r = 0; r < rows; r++) {
              const idx = (Math.floor(reelPhase[c] + (r * 1.91) + (c * 0.73)) % safePoolLen + safePoolLen) % safePoolLen;
              state.ephemeral.rows[r][c] = pool[idx] || "?";
            }
            if (ts >= reelStop) {
              stopped[c] = true;
              for (let r = 0; r < rows; r++) {
                if (!state.ephemeral.rows[r]) state.ephemeral.rows[r] = [];
                state.ephemeral.rows[r][c] = normalizeToken(finalGrid[r] && finalGrid[r][c] ? finalGrid[r][c] : "?");
              }
              audioManager.play("reel_stop");
              if (turbo) safeVibrate(5);
              else safeVibrate(9);
            }
          }
          renderBoard();
          if (allStopped) {
            resolve();
            return;
          }
          window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);
      });

      activeRun = null;
      if (els.boardWrap instanceof HTMLElement) {
        els.boardWrap.classList.remove("reel-accelerate");
        els.boardWrap.classList.add("reel-decel");
      }
      await sleep(turbo ? 70 : 130);
      if (els.boardWrap instanceof HTMLElement) {
        els.boardWrap.classList.remove("reel-decel");
        els.boardWrap.classList.add("reel-bounce");
      }
      renderBoard();
      await sleep(turbo ? 80 : 140);
      if (els.boardWrap instanceof HTMLElement) {
        els.boardWrap.classList.remove("reel-bounce");
      }
      clearBoardClasses();
    }

    function requestQuickStop() {
      if (!activeRun) return false;
      activeRun.quickStop = true;
      return true;
    }

    function stop() {
      if (activeRun) activeRun.cancelled = true;
      clearBoardClasses();
    }

    return {
      animate,
      requestQuickStop,
      stop
    };
  }

  function formatWinMultiplierText(winValue, betValue) {
    const win = Math.max(0, Number(winValue) || 0);
    const bet = Math.max(1, Number(betValue) || 1);
    return (win / bet).toFixed(2) + "x";
  }

  function updateWinDisplays() {
    if (els.premiumTopWin instanceof HTMLElement) {
      els.premiumTopWin.innerHTML = "Win: " + formatLocksByDisplayUnitHtml(state.currentWinValue);
    }
    if (els.winMeterValue instanceof HTMLElement) {
      els.winMeterValue.innerHTML = formatLocksByDisplayUnitHtml(state.currentWinValue);
    }
    if (els.winMeterMult instanceof HTMLElement) {
      els.winMeterMult.textContent = formatWinMultiplierText(state.currentWinValue, state.currentWinBetValue);
    }
  }

  function resolveWinTier(pay, stake) {
    const payout = Math.max(0, Number(pay) || 0);
    const bet = Math.max(1, Number(stake) || 1);
    const mul = payout / bet;
    if (mul >= 150) return { id: "max", label: "MAX WIN", className: "win-tier-max", sound: "win_big", durationScale: 1.45 };
    if (mul >= 50) return { id: "epic", label: "EPIC WIN", className: "win-tier-big", sound: "win_big", durationScale: 1.3 };
    if (mul >= 25) return { id: "mega", label: "MEGA WIN", className: "win-tier-big", sound: "win_big", durationScale: 1.15 };
    if (mul >= 10) return { id: "big", label: "BIG WIN", className: "win-tier-medium", sound: "win_medium", durationScale: 1.05 };
    if (mul > 0) return { id: "small", label: "WIN", className: "win-tier-small", sound: "win_small", durationScale: 1 };
    return { id: "none", label: "", className: "", sound: "", durationScale: 1 };
  }

  let winCounter = null;
  let tumbleAnimator = null;

  function createWinPresenter() {
    let bannerHideTimer = 0;

    function clearBannerTimer() {
      if (!bannerHideTimer) return;
      window.clearTimeout(bannerHideTimer);
      bannerHideTimer = 0;
    }

    function clearWinTier() {
      if (!(els.stage instanceof HTMLElement)) return;
      els.stage.classList.remove("win-tier-small", "win-tier-medium", "win-tier-big", "win-tier-max", "screen-shake", "screen-shake-max");
    }

    function showBanner(text, tierId, options) {
      if (!(els.premiumWinBanner instanceof HTMLElement)) return;
      const opts = options && typeof options === "object" ? options : {};
      const tier = String(tierId || "").trim().toLowerCase();
      clearBannerTimer();
      els.premiumWinBanner.textContent = String(text || "WIN!");
      els.premiumWinBanner.classList.remove("is-center", "is-big", "is-max", "is-final");
      if (opts.center === true) els.premiumWinBanner.classList.add("is-center");
      if (tier === "big" || tier === "mega" || tier === "epic" || tier === "max") {
        els.premiumWinBanner.classList.add("is-big");
      }
      if (tier === "max") {
        els.premiumWinBanner.classList.add("is-max");
      }
      if (opts.final === true) {
        els.premiumWinBanner.classList.add("is-final");
      }
      els.premiumWinBanner.classList.remove("hidden");
      const hideAfterMs = Math.max(0, Math.floor(Number(opts.hideAfterMs) || 0));
      if (hideAfterMs > 0) {
        bannerHideTimer = window.setTimeout(() => {
          hideBanner();
        }, hideAfterMs);
      }
    }

    function hideBanner() {
      if (!(els.premiumWinBanner instanceof HTMLElement)) return;
      clearBannerTimer();
      els.premiumWinBanner.classList.remove("is-center", "is-big", "is-max", "is-final");
      els.premiumWinBanner.classList.add("hidden");
    }

    function setCurrentWinValue(value, betValue) {
      state.currentWinValue = Math.max(0, Math.floor(Number(value) || 0));
      if (Number.isFinite(Number(betValue)) && Number(betValue) > 0) {
        state.currentWinBetValue = Math.max(1, Math.floor(Number(betValue) || 1));
      }
      updateWinDisplays();
    }

    async function countTo(targetValue, betValue, options) {
      const target = Math.max(0, Math.floor(Number(targetValue) || 0));
      const start = Math.max(0, Math.floor(Number(state.currentWinValue) || 0));
      const stake = Math.max(1, Math.floor(Number(betValue) || 1));
      const opts = options && typeof options === "object" ? options : {};
      if (target <= start) {
        setCurrentWinValue(target, stake);
        return { skipped: false, finalValue: target };
      }
      if (!winCounter || typeof winCounter.startCountUp !== "function") {
        setCurrentWinValue(target, stake);
        return { skipped: false, finalValue: target };
      }
      return await winCounter.startCountUp(start, target, {
        bet: stake,
        turbo: Boolean(state.uiSettings.turbo),
        durationScale: Number.isFinite(Number(opts.durationScale)) ? Number(opts.durationScale) : 1
      });
    }

    async function presentWin(payout, bet, options) {
      const opts = options && typeof options === "object" ? options : {};
      const pay = Math.max(0, Math.floor(Number(payout) || 0));
      const stake = Math.max(1, Math.floor(Number(bet) || 1));
      const tier = resolveWinTier(pay, stake);
      clearWinTier();
      if (pay <= 0) {
        hideBanner();
        setCurrentWinValue(0, stake);
        return;
      }
      const forceCounter = opts.forceCounter === true;
      const replayFromZero = forceCounter && opts.replayFromZero === true;
      if (!forceCounter && pay < (stake * 2)) {
        hideBanner();
        setCurrentWinValue(pay, stake);
        return;
      }

      if (els.stage instanceof HTMLElement && tier.className) {
        els.stage.classList.add(tier.className);
        if (tier.id === "max") {
          els.stage.classList.add("screen-shake-max");
          window.setTimeout(() => {
            if (els.stage instanceof HTMLElement) els.stage.classList.remove("screen-shake-max");
          }, 980);
        } else if (tier.id === "epic" || tier.id === "mega") {
          els.stage.classList.add("screen-shake");
          window.setTimeout(() => {
            if (els.stage instanceof HTMLElement) els.stage.classList.remove("screen-shake");
          }, 520);
        }
      }
      showBanner(tier.label || "WIN", tier.id, { center: false });
      if (tier.sound) audioManager.play(tier.sound);
      if (tier.id === "max") {
        safeVibrate(26);
        spawnParticles("jackpot");
        window.setTimeout(() => spawnParticles("jackpot"), 140);
        window.setTimeout(() => spawnParticles("jackpot"), 300);
      } else if (tier.id === "epic" || tier.id === "mega") {
        safeVibrate(18);
        spawnParticles("jackpot");
      } else if (tier.id === "big") {
        safeVibrate(12);
        spawnParticles("win");
      }

      if (replayFromZero) {
        setCurrentWinValue(0, stake);
      }

      if (!opts.alreadyCounted || replayFromZero) {
        await countTo(pay, stake, { durationScale: tier.durationScale });
      } else {
        setCurrentWinValue(pay, stake);
      }
      showBanner(
        "WIN " + formatLocksByDisplayUnit(pay),
        tier.id,
        {
          center: true,
          final: true,
          hideAfterMs: tier.id === "max" ? 2800 : (tier.id === "epic" || tier.id === "mega" || tier.id === "big" ? 1900 : 1300)
        }
      );
    }

    return {
      presentWin,
      clearWinTier,
      hideBanner,
      setCurrentWinValue
    };
  }

  const AudioManager = createAudioManager();
  const audioManager = AudioManager;
  winCounter = typeof winCounterModule.createWinCounter === "function"
    ? winCounterModule.createWinCounter({
      onUpdate: (value) => {
        state.currentWinValue = Math.max(0, Math.floor(Number(value) || 0));
        updateWinDisplays();
      },
      onCountLoopStart: () => audioManager.play("countup_start"),
      onCountLoopStop: () => audioManager.play("countup_end")
    })
    : null;
  const ReelAnimator = createReelAnimator();
  const WinPresenter = createWinPresenter();
  const reelAnimator = ReelAnimator;
  const winPresenter = WinPresenter;
  tumbleAnimator = typeof tumbleEngineModule.createTumbleEngine === "function"
    ? tumbleEngineModule.createTumbleEngine({
      applyFrame: (payload) => applyTumbleFrame(payload),
      setIndicator: (text) => setTumbleIndicator(text)
    })
    : null;
  const GameState = {
    get snapshot() { return state; },
    get isSpinning() { return Boolean(state.spinBusy); },
    setSpinning(next) { state.spinBusy = Boolean(next); },
    getBet(machine) { return clampBetToMachine(machine || getSelectedMachine(), state.currentBetValue); },
    setBet(next) { state.currentBetValue = Math.max(1, Math.floor(Number(next) || 1)); },
    get settings() { return state.uiSettings; }
  };

  function setBonusPhase(phase) {
    const next = String(phase || BONUS_PHASES.BASE_IDLE);
    state.bonusFlow.phase = next;
    state.bonusFlow.active = next.indexOf("BONUS_") === 0;
    if (!state.bonusFlow.active) {
      state.bonusFlow.spinsLeft = 0;
      state.bonusFlow.spinsTotal = 0;
      state.bonusFlow.spinsPlayed = 0;
    }
    if (els.stage instanceof HTMLElement) els.stage.dataset.bonusPhase = next;
    if (!state.bonusFlow.active) showBonusSpinPanel(false);
  }

  function showBonusHud(show) {
    if (!(els.bonusHud instanceof HTMLElement)) return;
    els.bonusHud.classList.toggle("hidden", !show);
    if (!show) showBonusSpinPanel(false);
  }

  function setTumbleIndicator(text) {
    if (!(els.tumbleIndicator instanceof HTMLElement)) return;
    const value = String(text || "").trim();
    if (!value) {
      els.tumbleIndicator.classList.remove("active");
      return;
    }
    els.tumbleIndicator.textContent = value;
    els.tumbleIndicator.classList.add("active");
  }

  function ensureBonusSpinPanel() {
    if (els.bonusSpinPanel instanceof HTMLElement) return els.bonusSpinPanel;
    if (!(els.boardWrap instanceof HTMLElement)) return null;
    const panel = document.createElement("div");
    panel.id = "bonusSpinPanel";
    panel.className = "bonus-spin-panel hidden";
    panel.innerHTML = [
      "<div class=\"bonus-spin-title\" id=\"bonusSpinTitle\">FREE SPINS</div>",
      "<div class=\"bonus-spin-count\" id=\"bonusSpinCount\">0 / 0</div>",
      "<div class=\"bonus-spin-total\" id=\"bonusSpinTotal\">TOTAL 0 WL</div>",
      "<div class=\"bonus-spin-progress\"><span id=\"bonusSpinProgressFill\"></span></div>"
    ].join("");
    els.boardWrap.appendChild(panel);
    els.bonusSpinPanel = panel;
    els.bonusSpinTitle = panel.querySelector("#bonusSpinTitle");
    els.bonusSpinCount = panel.querySelector("#bonusSpinCount");
    els.bonusSpinTotal = panel.querySelector("#bonusSpinTotal");
    els.bonusSpinProgressFill = panel.querySelector("#bonusSpinProgressFill");
    return panel;
  }

  function showBonusSpinPanel(show) {
    const panel = ensureBonusSpinPanel();
    if (!(panel instanceof HTMLElement)) return;
    panel.classList.toggle("hidden", !show);
    panel.classList.toggle("active", Boolean(show));
  }

  function updateBonusSpinPanel(data) {
    const panel = ensureBonusSpinPanel();
    if (!(panel instanceof HTMLElement)) return;
    const row = data && typeof data === "object" ? data : {};
    const title = String(row.title || state.bonusFlow.panelTitle || "FREE SPINS").trim() || "FREE SPINS";
    const total = Math.max(1, Math.floor(Number(row.total) || Number(state.bonusFlow.spinsTotal) || 1));
    const played = Math.max(0, Math.min(total, Math.floor(Number(row.played) || Number(state.bonusFlow.spinsPlayed) || 0)));
    const totalWin = Math.max(0, Math.floor(Number(row.totalWin) || Number(state.bonusFlow.bonusWin) || 0));
    if (els.bonusSpinTitle instanceof HTMLElement) els.bonusSpinTitle.textContent = title;
    if (els.bonusSpinCount instanceof HTMLElement) els.bonusSpinCount.textContent = played + " / " + total;
    if (els.bonusSpinTotal instanceof HTMLElement) {
      els.bonusSpinTotal.innerHTML = "TOTAL " + formatLocksByDisplayUnitHtml(totalWin);
    }
    if (els.bonusSpinProgressFill instanceof HTMLElement) {
      const width = total > 0 ? (played / total) * 100 : 0;
      els.bonusSpinProgressFill.style.width = Math.max(0, Math.min(100, width)).toFixed(2) + "%";
    }
  }

  function updateBonusHud(data) {
    const row = data && typeof data === "object" ? data : {};
    state.bonusFlow.spinsLeft = Math.max(0, Math.floor(Number(row.spinsLeft || row.freeSpinsLeft) || 0));
    state.bonusFlow.bonusWin = Math.max(0, Math.floor(Number(row.bonusWin) || 0));
    state.bonusFlow.currentSpinWin = Math.max(0, Math.floor(Number(row.currentSpinWin) || 0));
    state.bonusFlow.stickyWilds = Math.max(0, Math.floor(Number(row.stickyWilds) || 0));
    state.bonusFlow.multiplierCells = Math.max(0, Math.floor(Number(row.multiplierCells) || 0));
    state.bonusFlow.activeMultiplier = Math.max(1, Number(row.activeMultiplier) || 1);
    if (Number.isFinite(Number(row.spinsTotal))) {
      state.bonusFlow.spinsTotal = Math.max(0, Math.floor(Number(row.spinsTotal) || 0));
    }
    if (Number.isFinite(Number(row.spinsPlayed))) {
      state.bonusFlow.spinsPlayed = Math.max(0, Math.floor(Number(row.spinsPlayed) || 0));
    }
    const panelTitle = String(row.panelTitle || row.mode || state.bonusFlow.panelTitle || "FREE SPINS").trim();
    state.bonusFlow.panelTitle = panelTitle || "FREE SPINS";

    if (els.bonusHudState instanceof HTMLElement) {
      const mode = String(row.mode || "FREE SPINS");
      els.bonusHudState.textContent = mode;
    }
    if (els.bonusHudLeft instanceof HTMLElement) els.bonusHudLeft.textContent = "Left: " + state.bonusFlow.spinsLeft;
    if (els.bonusHudWin instanceof HTMLElement) els.bonusHudWin.innerHTML = "Bonus Win: " + formatLocksByDisplayUnitHtml(state.bonusFlow.bonusWin);
    if (els.bonusHudSpin instanceof HTMLElement) els.bonusHudSpin.innerHTML = "Spin Win: " + formatLocksByDisplayUnitHtml(state.bonusFlow.currentSpinWin);
    if (els.bonusHudSticky instanceof HTMLElement) {
      const stickyLabel = String(row.stickyLabel || "").trim();
      els.bonusHudSticky.textContent = stickyLabel || ("Wilds: " + state.bonusFlow.stickyWilds);
    }
    if (els.bonusHudMulti instanceof HTMLElement) {
      const multiLabel = String(row.multiLabel || "").trim();
      els.bonusHudMulti.textContent = multiLabel || ("x10 Cells: " + state.bonusFlow.multiplierCells);
    }

    const inferredTotal = state.bonusFlow.spinsTotal > 0
      ? state.bonusFlow.spinsTotal
      : Math.max(0, state.bonusFlow.spinsLeft + state.bonusFlow.spinsPlayed);
    const inferredPlayed = inferredTotal > 0
      ? Math.max(0, Math.min(inferredTotal, state.bonusFlow.spinsPlayed || (inferredTotal - state.bonusFlow.spinsLeft)))
      : 0;
    if (state.bonusFlow.active || inferredTotal > 0 || state.bonusFlow.spinsLeft > 0) {
      showBonusSpinPanel(true);
      updateBonusSpinPanel({
        title: state.bonusFlow.panelTitle,
        played: inferredPlayed,
        total: inferredTotal > 0 ? inferredTotal : 1,
        totalWin: state.bonusFlow.bonusWin
      });
    } else {
      showBonusSpinPanel(false);
    }
  }

  function setBoardDimmed(dimmed) {
    if (!(els.boardWrap instanceof HTMLElement)) return;
    els.boardWrap.classList.toggle("dimmed", Boolean(dimmed));
  }

  async function showBonusOverlay(title, text, sub, showContinue) {
    if (!(els.bonusOverlay instanceof HTMLElement)) return;
    if (els.bonusOverlayTitle instanceof HTMLElement) els.bonusOverlayTitle.textContent = String(title || "FREE SPINS");
    if (els.bonusOverlayText instanceof HTMLElement) els.bonusOverlayText.textContent = String(text || "");
    if (els.bonusOverlaySub instanceof HTMLElement) els.bonusOverlaySub.textContent = String(sub || "");
    if (els.bonusOverlayContinueBtn instanceof HTMLButtonElement) {
      els.bonusOverlayContinueBtn.classList.toggle("hidden", !showContinue);
      els.bonusOverlayContinueBtn.disabled = !showContinue;
    }
    els.bonusOverlay.classList.remove("hidden");
    await nextFrame();
    els.bonusOverlay.classList.add("active");
  }

  async function hideBonusOverlay() {
    if (!(els.bonusOverlay instanceof HTMLElement)) return;
    els.bonusOverlay.classList.remove("active");
    await sleep(180);
    els.bonusOverlay.classList.add("hidden");
  }

  async function waitBonusContinue(timeoutMs) {
    const btn = els.bonusOverlayContinueBtn;
    if (!(btn instanceof HTMLButtonElement)) {
      await sleep(Math.max(300, Math.floor(Number(timeoutMs) || 1200)));
      return;
    }
    return await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        btn.removeEventListener("click", onClick);
        resolve();
      };
      const onClick = () => finish();
      btn.addEventListener("click", onClick);
      const waitMs = Math.max(1200, Math.floor(Number(timeoutMs) || 10000));
      window.setTimeout(finish, waitMs);
    });
  }

  function showBonusBanner(text) {
    if (!(els.bonusBanner instanceof HTMLElement)) return;
    const msg = String(text || "").trim();
    if (!msg) {
      els.bonusBanner.classList.remove("active");
      els.bonusBanner.classList.add("hidden");
      return;
    }
    els.bonusBanner.textContent = msg;
    els.bonusBanner.classList.remove("hidden");
    window.requestAnimationFrame(() => els.bonusBanner.classList.add("active"));
    window.setTimeout(() => {
      if (!(els.bonusBanner instanceof HTMLElement)) return;
      els.bonusBanner.classList.remove("active");
      window.setTimeout(() => {
        if (els.bonusBanner instanceof HTMLElement) els.bonusBanner.classList.add("hidden");
      }, 180);
    }, 1300);
  }

  function clearBonusUiState() {
    setBonusPhase(BONUS_PHASES.BASE_IDLE);
    state.bonusFlow.machineType = "";
    updateBonusHud({ spinsLeft: 0, bonusWin: 0, currentSpinWin: 0, stickyWilds: 0, multiplierCells: 0, mode: "FREE SPINS" });
    showBonusHud(false);
    setTumbleIndicator("");
    showBonusBanner("");
    winPresenter.hideBanner();
    winPresenter.clearWinTier();
    setBoardDimmed(false);
    hideBonusOverlay();
  }

  function resetEphemeralVisuals() {
    state.ephemeral.rows = null;
    state.ephemeral.lineIds = [];
    state.ephemeral.lineWins = [];
    state.ephemeral.markedCells = [];
    state.ephemeral.cellMeta = {};
    state.ephemeral.effectCells = {};
    state.ephemeral.upgradeFlashes = {};
    winPresenter.hideBanner();
    winPresenter.clearWinTier();
  }

  function normalizeTowerDifficultyId(value) {
    const raw = String(value || "").trim().toLowerCase();
    return TOWER_CONFIG.difficulties[raw] ? raw : "normal";
  }

  function getTowerDifficultyConfig(value) {
    return TOWER_CONFIG.difficulties[normalizeTowerDifficultyId(value)] || TOWER_CONFIG.difficulties.normal;
  }

  function getTowerDifficultyForMachine(machine) {
    if (!machine || !machine.tileKey) return "normal";
    const byMachine = state.tower && state.tower.difficultyByMachine ? state.tower.difficultyByMachine : {};
    return normalizeTowerDifficultyId(byMachine[machine.tileKey]);
  }

  function setTowerDifficultyForMachine(machine, difficultyId) {
    if (!machine || !machine.tileKey) return;
    const id = normalizeTowerDifficultyId(difficultyId);
    if (!state.tower || !state.tower.difficultyByMachine) return;
    state.tower.difficultyByMachine[machine.tileKey] = id;
  }

  function getTowerRoundForMachine(machine) {
    if (!machine || !machine.tileKey) return null;
    const byMachine = state.tower && state.tower.roundsByMachine ? state.tower.roundsByMachine : {};
    return byMachine[machine.tileKey] || null;
  }

  function setTowerRoundForMachine(machine, round) {
    if (!machine || !machine.tileKey || !state.tower || !state.tower.roundsByMachine) return;
    if (round) state.tower.roundsByMachine[machine.tileKey] = round;
    else delete state.tower.roundsByMachine[machine.tileKey];
  }

  function randomUniqueIndices(count, pickCount) {
    const total = Math.max(1, Math.floor(Number(count) || 1));
    const needed = Math.max(0, Math.min(total, Math.floor(Number(pickCount) || 0)));
    const arr = [];
    for (let i = 0; i < total; i++) arr.push(i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr.slice(0, needed).sort((a, b) => a - b);
  }

  function createTowerRound(machine, bet, difficultyId) {
    const cfg = getTowerDifficultyConfig(difficultyId);
    const floors = Math.max(4, Math.floor(TOWER_CONFIG.floors || 8));
    const cols = Math.max(3, Math.floor(TOWER_CONFIG.cols || 5));
    const traps = Math.max(1, Math.min(cols - 1, Math.floor(Number(cfg.traps) || 1)));
    const safePerFloor = Math.max(1, cols - traps);
    const safeColsByFloor = [];
    for (let floor = 0; floor < floors; floor++) safeColsByFloor.push(randomUniqueIndices(cols, safePerFloor));
    const multipliers = [];
    let mult = 1;
    const step = Math.max(1.01, Number(cfg.stepMult) || 1.25);
    for (let floor = 0; floor < floors; floor++) {
      mult *= step;
      multipliers.push(Number(mult.toFixed(4)));
    }
    return {
      machineKey: machine.tileKey,
      startedAt: Date.now(),
      bet: Math.max(1, Math.floor(Number(bet) || 1)),
      difficultyId: cfg.id,
      difficultyLabel: cfg.label,
      floors,
      cols,
      traps,
      safePerFloor,
      stepMult: step,
      safeColsByFloor,
      multipliers,
      picksByFloor: [],
      currentFloor: 0,
      active: true,
      ended: false,
      revealAll: false,
      result: "running",
      payout: 0,
      hit: null
    };
  }

  function towerClearedFloors(round) {
    if (!round) return 0;
    return Math.max(0, Math.min(round.floors, Math.floor(Number(round.currentFloor) || 0)));
  }

  function towerCurrentMultiplier(round) {
    if (!round) return 1;
    const cleared = towerClearedFloors(round);
    if (cleared <= 0) return 1;
    return Math.max(1, Number(round.multipliers && round.multipliers[cleared - 1]) || 1);
  }

  function towerNextMultiplier(round) {
    if (!round) return 1;
    const cleared = towerClearedFloors(round);
    const next = round.multipliers && round.multipliers[cleared];
    return Math.max(1, Number(next) || towerCurrentMultiplier(round));
  }

  function formatMultiplier(mult) {
    const safe = Math.max(0, Number(mult) || 0);
    if (safe >= 1000) return safe.toFixed(0) + "x";
    if (safe >= 100) return safe.toFixed(1) + "x";
    if (safe >= 10) return safe.toFixed(2) + "x";
    return safe.toFixed(3) + "x";
  }

  function formatTowerPayout(round, mult) {
    if (!round) return 0;
    return Math.max(0, Math.floor(round.bet * Math.max(1, Number(mult) || 1)));
  }

  function updateTowerMachineStatsOnStart(machine, round) {
    if (!machine || !machine.stats || !round) return;
    machine.stats.plays = toCount(machine.stats.plays) + 1;
    machine.stats.totalBet = toCount(machine.stats.totalBet) + round.bet;
    machine.stats.lastOutcome = "running";
    machine.stats.lastMultiplier = 1;
    machine.stats.lastSlotsSummary = "Tower run started (" + round.difficultyLabel + ")";
    machine.stats.lastSlotsText = "";
    machine.stats.lastSlotsLines = "";
    machine.stats.lastSlotsLineIds = "";
  }

  function updateTowerMachineStatsOnResolve(machine, round, outcome, payout) {
    if (!machine || !machine.stats || !round) return;
    const safeOutcome = String(outcome || "lose").slice(0, 24);
    const safePayout = Math.max(0, Math.floor(Number(payout) || 0));
    const mult = towerCurrentMultiplier(round);
    machine.stats.lastOutcome = safeOutcome;
    machine.stats.lastMultiplier = Number(mult.toFixed(4));
    machine.stats.lastSlotsSummary = "Tower " + safeOutcome + " | " + towerClearedFloors(round) + "/" + round.floors + " floors | " + formatMultiplier(mult);
    if (safePayout > 0) machine.stats.totalPayout = toCount(machine.stats.totalPayout) + safePayout;
  }

  async function startTowerRun(machine) {
    if (!machine || machine.type !== "tower" || state.spinBusy) return;
    const existing = getTowerRoundForMachine(machine);
    if (existing && existing.active) return;
    const bet = clampBetToMachine(machine, state.currentBetValue);
    if (state.webVaultLocks < bet) return;

    const debit = await adjustWallet(-bet);
    if (!debit.ok) return;

    const difficultyId = getTowerDifficultyForMachine(machine);
    const round = createTowerRound(machine, bet, difficultyId);
    setTowerRoundForMachine(machine, round);
    updateTowerMachineStatsOnStart(machine, round);
    if (els.lastWinLabel instanceof HTMLElement) {
      els.lastWinLabel.textContent = "Tower Started";
      els.lastWinLabel.classList.remove("hidden");
      els.lastWinLabel.classList.remove("good");
    }
    renderAll();
  }

  async function cashOutTowerRun(machine, reason) {
    if (!machine || machine.type !== "tower") return;
    const round = getTowerRoundForMachine(machine);
    if (!round || !round.active) return;
    const cleared = towerClearedFloors(round);
    if (cleared <= 0) return;
    const outcome = reason === "top" ? "top" : "cashout";
    const mult = towerCurrentMultiplier(round);
    const payout = formatTowerPayout(round, mult);
    if (payout > 0) {
      const credit = await adjustWallet(payout);
      if (!credit || !credit.ok) {
        if (els.lastWinLabel instanceof HTMLElement) {
          els.lastWinLabel.textContent = "Cashout Failed";
          els.lastWinLabel.classList.remove("hidden");
          els.lastWinLabel.classList.remove("good");
        }
        renderAll();
        return;
      }
    }
    round.active = false;
    round.ended = true;
    round.result = outcome;
    round.payout = payout;
    round.revealAll = true;
    updateTowerMachineStatsOnResolve(machine, round, outcome, payout);
    if (els.lastWinLabel instanceof HTMLElement) {
      els.lastWinLabel.textContent = "Won: " + payout + " WL";
      els.lastWinLabel.classList.remove("hidden");
      els.lastWinLabel.classList.add("good");
    }
    spawnParticles(payout >= round.bet * 25 ? "jackpot" : "win");
    renderAll();
  }

  async function handleTowerPick(machine, floor, col) {
    if (!machine || machine.type !== "tower") return;
    const round = getTowerRoundForMachine(machine);
    if (!round || !round.active) return;
    const floorIdx = Math.floor(Number(floor));
    const colIdx = Math.floor(Number(col));
    if (floorIdx !== round.currentFloor) return;
    if (colIdx < 0 || colIdx >= round.cols) return;
    if (round.picksByFloor[floorIdx] !== undefined) return;

    round.picksByFloor[floorIdx] = colIdx;
    const safeCols = Array.isArray(round.safeColsByFloor[floorIdx]) ? round.safeColsByFloor[floorIdx] : [];
    const safe = safeCols.indexOf(colIdx) >= 0;
    if (!safe) {
      round.active = false;
      round.ended = true;
      round.result = "lose";
      round.payout = 0;
      round.revealAll = true;
      round.hit = { floor: floorIdx, col: colIdx };
      updateTowerMachineStatsOnResolve(machine, round, "lose", 0);
      if (els.lastWinLabel instanceof HTMLElement) {
        els.lastWinLabel.textContent = "Trap Hit";
        els.lastWinLabel.classList.remove("hidden");
        els.lastWinLabel.classList.remove("good");
      }
      renderAll();
      return;
    }

    round.currentFloor += 1;
    const mult = towerCurrentMultiplier(round);
    if (els.lastWinLabel instanceof HTMLElement) {
      els.lastWinLabel.textContent = "Tower: " + formatMultiplier(mult);
      els.lastWinLabel.classList.remove("hidden");
      els.lastWinLabel.classList.add("good");
    }

    if (round.currentFloor >= round.floors) {
      await cashOutTowerRun(machine, "top");
      return;
    }

    renderAll();
  }

  function normalizeMinesCount(value) {
    const raw = Math.floor(Number(value) || MINES_CONFIG.defaultMines);
    return Math.max(MINES_CONFIG.minMines, Math.min(MINES_CONFIG.maxMines, raw));
  }

  function getMinesCountForMachine(machine) {
    if (!machine || !machine.tileKey) return MINES_CONFIG.defaultMines;
    const byMachine = state.mines && state.mines.minesByMachine ? state.mines.minesByMachine : {};
    return normalizeMinesCount(byMachine[machine.tileKey]);
  }

  function setMinesCountForMachine(machine, minesCount) {
    if (!machine || !machine.tileKey || !state.mines || !state.mines.minesByMachine) return;
    state.mines.minesByMachine[machine.tileKey] = normalizeMinesCount(minesCount);
  }

  function getMinesRoundForMachine(machine) {
    if (!machine || !machine.tileKey) return null;
    const byMachine = state.mines && state.mines.roundsByMachine ? state.mines.roundsByMachine : {};
    return byMachine[machine.tileKey] || null;
  }

  function setMinesRoundForMachine(machine, round) {
    if (!machine || !machine.tileKey || !state.mines || !state.mines.roundsByMachine) return;
    if (round) state.mines.roundsByMachine[machine.tileKey] = round;
    else delete state.mines.roundsByMachine[machine.tileKey];
  }

  function createMinesRound(machine, bet, minesCount) {
    const totalTiles = MINES_CONFIG.totalTiles;
    const safeTotal = totalTiles - minesCount;
    const mineIndices = randomUniqueIndices(totalTiles, minesCount);
    const mineMap = {};
    for (let i = 0; i < mineIndices.length; i++) mineMap[mineIndices[i]] = true;
    return {
      machineKey: machine.tileKey,
      startedAt: Date.now(),
      bet: Math.max(1, Math.floor(Number(bet) || 1)),
      minesCount,
      totalTiles,
      rows: MINES_CONFIG.rows,
      cols: MINES_CONFIG.cols,
      safeTotal,
      mineIndices,
      mineMap,
      revealedSafeIndices: [],
      revealedSafeMap: {},
      pickedMineIndex: -1,
      active: true,
      ended: false,
      revealAll: false,
      result: "running",
      payout: 0
    };
  }

  function minesSafeClicks(round) {
    if (!round || !Array.isArray(round.revealedSafeIndices)) return 0;
    return Math.max(0, round.revealedSafeIndices.length);
  }

  function minesMultiplierForClicks(round, safeClicks) {
    if (!round) return 1;
    const clicks = Math.max(0, Math.min(Math.floor(Number(safeClicks) || 0), round.safeTotal));
    if (clicks <= 0) return 1;
    const edgeFactor = Math.max(0.8, Math.min(1, 1 - (Number(MINES_CONFIG.houseEdge) || 0.04)));
    let mult = 1;
    for (let i = 0; i < clicks; i++) {
      const remainingSafe = round.safeTotal - i;
      const remainingTotal = round.totalTiles - i;
      if (remainingSafe <= 0 || remainingTotal <= 0) break;
      mult *= (remainingTotal / remainingSafe) * edgeFactor;
    }
    return Math.max(1, Number(mult.toFixed(6)));
  }

  function minesCurrentMultiplier(round) {
    return minesMultiplierForClicks(round, minesSafeClicks(round));
  }

  function minesNextMultiplier(round) {
    return minesMultiplierForClicks(round, minesSafeClicks(round) + 1);
  }

  function minesCashoutPayout(round) {
    if (!round) return 0;
    return Math.max(0, Math.floor(round.bet * minesCurrentMultiplier(round)));
  }

  function updateMinesMachineStatsOnStart(machine, round) {
    if (!machine || !machine.stats || !round) return;
    machine.stats.plays = toCount(machine.stats.plays) + 1;
    machine.stats.totalBet = toCount(machine.stats.totalBet) + round.bet;
    machine.stats.lastOutcome = "running";
    machine.stats.lastMultiplier = 1;
    machine.stats.lastSlotsSummary = "Mines run started (" + round.minesCount + " mines)";
    machine.stats.lastSlotsText = "";
    machine.stats.lastSlotsLines = "";
    machine.stats.lastSlotsLineIds = "";
  }

  function updateMinesMachineStatsOnResolve(machine, round, outcome, payout) {
    if (!machine || !machine.stats || !round) return;
    const safeOutcome = String(outcome || "lose").slice(0, 24);
    const safePayout = Math.max(0, Math.floor(Number(payout) || 0));
    const safeClicks = minesSafeClicks(round);
    const mult = minesCurrentMultiplier(round);
    machine.stats.lastOutcome = safeOutcome;
    machine.stats.lastMultiplier = Number(mult.toFixed(6));
    machine.stats.lastSlotsSummary = "Mines " + safeOutcome + " | " + safeClicks + " safe | " + formatMultiplier(mult);
    if (safePayout > 0) machine.stats.totalPayout = toCount(machine.stats.totalPayout) + safePayout;
  }

  async function startMinesRun(machine) {
    if (!machine || machine.type !== "mines" || state.spinBusy) return;
    const existing = getMinesRoundForMachine(machine);
    if (existing && existing.active) return;

    const bet = clampBetToMachine(machine, state.currentBetValue);
    if (state.webVaultLocks < bet) return;
    const debit = await adjustWallet(-bet);
    if (!debit.ok) return;

    const minesCount = getMinesCountForMachine(machine);
    const round = createMinesRound(machine, bet, minesCount);
    setMinesRoundForMachine(machine, round);
    updateMinesMachineStatsOnStart(machine, round);
    if (els.lastWinLabel instanceof HTMLElement) {
      els.lastWinLabel.textContent = "Mines Started";
      els.lastWinLabel.classList.remove("hidden");
      els.lastWinLabel.classList.remove("good");
    }
    renderAll();
  }

  async function cashOutMinesRun(machine, reason) {
    if (!machine || machine.type !== "mines") return;
    const round = getMinesRoundForMachine(machine);
    if (!round || !round.active) return;
    const safeClicks = minesSafeClicks(round);
    if (safeClicks <= 0) return;
    const payout = minesCashoutPayout(round);
    if (payout > 0) {
      const credit = await adjustWallet(payout);
      if (!credit || !credit.ok) {
        if (els.lastWinLabel instanceof HTMLElement) {
          els.lastWinLabel.textContent = "Cashout Failed";
          els.lastWinLabel.classList.remove("hidden");
          els.lastWinLabel.classList.remove("good");
        }
        renderAll();
        return;
      }
    }
    const outcome = reason === "clear" ? "clear" : "cashout";
    round.active = false;
    round.ended = true;
    round.result = outcome;
    round.payout = payout;
    round.revealAll = true;
    updateMinesMachineStatsOnResolve(machine, round, outcome, payout);
    if (els.lastWinLabel instanceof HTMLElement) {
      els.lastWinLabel.textContent = "Won: " + payout + " WL";
      els.lastWinLabel.classList.remove("hidden");
      els.lastWinLabel.classList.add("good");
    }
    spawnParticles(payout >= round.bet * 25 ? "jackpot" : "win");
    renderAll();
  }

  async function handleMinesPick(machine, tileIndex) {
    if (!machine || machine.type !== "mines") return;
    const round = getMinesRoundForMachine(machine);
    if (!round || !round.active) return;
    const idx = Math.floor(Number(tileIndex));
    if (idx < 0 || idx >= round.totalTiles) return;
    if (round.revealedSafeMap[idx]) return;
    if (round.pickedMineIndex === idx) return;

    if (round.mineMap[idx]) {
      round.active = false;
      round.ended = true;
      round.result = "lose";
      round.payout = 0;
      round.revealAll = true;
      round.pickedMineIndex = idx;
      updateMinesMachineStatsOnResolve(machine, round, "lose", 0);
      if (els.lastWinLabel instanceof HTMLElement) {
        els.lastWinLabel.textContent = "Mine Hit";
        els.lastWinLabel.classList.remove("hidden");
        els.lastWinLabel.classList.remove("good");
      }
      renderAll();
      return;
    }

    round.revealedSafeMap[idx] = true;
    round.revealedSafeIndices.push(idx);
    const mult = minesCurrentMultiplier(round);
    if (els.lastWinLabel instanceof HTMLElement) {
      els.lastWinLabel.textContent = "Mines: " + formatMultiplier(mult);
      els.lastWinLabel.classList.remove("hidden");
      els.lastWinLabel.classList.add("good");
    }

    if (minesSafeClicks(round) >= round.safeTotal) {
      await cashOutMinesRun(machine, "clear");
      return;
    }

    renderAll();
  }

  // Standalone/casino spin logic
  function simulateStandaloneSpin(machine, bet) {
    const pool = SYMBOL_POOL[machine.type] || SYMBOL_POOL.slots;
    const reelsCount = machine.reels || 3;
    const reels = [];
    for (let i = 0; i < reelsCount; i++) {
      reels.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    let payout = 0;
    let lines = [];

    // Simple 5-reel logic: match 3+ from left
    const first = reels[0];
    let matchCount = 1;
    for (let i = 1; i < reels.length; i++) {
      if (reels[i] === first || reels[i] === "WILD") matchCount++;
      else break;
    }

    if (matchCount >= 3) {
      const mult = matchCount === 5 ? 50 : (matchCount === 4 ? 10 : 2);
      payout += bet * mult;
      lines.push(matchCount + "x " + first);
    }

    // Bonus scatter check
    const scatters = reels.filter(s => s === "SCAT" || s === "BONUS").length;
    if (scatters >= 3) {
      payout += bet * 15;
      lines.push("Bonus Triggered!");
    }
    const result = {
      reels,
      lineWins: lines,
      lineIds: lines,
      outcome: payout > 0 ? "win" : "lose",
      payoutWanted: payout,
      summary: payout > 0 ? "Demo spin" : ""
    };
    return result;
  }

  const SIX_PAYLINES = [
    [1, 1, 1, 1, 1], // Horizontal 1
    [0, 0, 0, 0, 0], // Horizontal 0
    [2, 2, 2, 2, 2], // Horizontal 2
    [3, 3, 3, 3, 3], // Horizontal 3
    [0, 1, 2, 1, 0], // V-shape
    [1, 2, 3, 2, 1], // V-shape low
    [3, 2, 1, 2, 3], // ^-shape low
    [2, 1, 0, 1, 2], // ^-shape
    [0, 0, 1, 2, 2], // Diagonal down
    [2, 2, 1, 0, 0], // Diagonal up
    [1, 1, 2, 3, 3], // Diagonal down low
    [3, 3, 2, 1, 1], // Diagonal up low
    [0, 1, 1, 1, 0], // Bump
    [3, 2, 2, 2, 3]  // Dip
  ];

  const SIX666_CONFIG = {
    layout: { cols: 5, rows: 4, wheelReels: [0, 2, 4] },
    paylines: SIX_PAYLINES,
    maxRoundWinMultiplier: 10000,
    maxSpinWinMultiplier: 500,
    defaultBonusSpins: 10,
    animation: { turboScale: 0.62 },
    symbols: [
      { id: "SKULL", weight: 4, pays: { 3: 1.4, 4: 4.5, 5: 16 } },
      { id: "BLOOD", weight: 8, pays: { 3: 0.9, 4: 3.0, 5: 10 } },
      { id: "REAPR", weight: 11, pays: { 3: 0.55, 4: 1.8, 5: 6 } },
      { id: "PENT", weight: 15, pays: { 3: 0.35, 4: 1.1, 5: 3.6 } },
      { id: "BONE", weight: 22, pays: { 3: 0.2, 4: 0.7, 5: 2.1 } },
      { id: "WILD", weight: 1, pays: { 3: 1.8, 4: 5.5, 5: 18 } }
    ],
    base: {
      wheelChance: { blue: 0.018, red: 0.006 },
      sixChance: { blue: 0.1, red: 0.12 },
      allowBlue: true,
      allowRed: true,
      blueSixEnabled: true,
      guaranteedRed: false
    },
    tiers: {
      A: {
        id: "A",
        title: "DESCENT SPINS",
        subtitle: "Tier A",
        spins: 10,
        wheelChance: { blue: 0.08, red: 0.05 },
        sixChance: { blue: 0, red: 0.18 },
        allowBlue: true,
        allowRed: true,
        blueSixEnabled: false,
        guaranteedRed: false
      },
      B: {
        id: "B",
        title: "CHAOS SPINS",
        subtitle: "Tier B",
        spins: 10,
        wheelChance: { blue: 0, red: 0.12 },
        sixChance: { blue: 0, red: 0.24 },
        allowBlue: false,
        allowRed: true,
        blueSixEnabled: false,
        guaranteedRed: false
      },
      C: {
        id: "C",
        title: "ABYSS SPINS",
        subtitle: "Tier C",
        spins: 10,
        wheelChance: { blue: 0, red: 0.16 },
        sixChance: { blue: 0, red: 0.3 },
        allowBlue: false,
        allowRed: true,
        blueSixEnabled: false,
        guaranteedRed: true
      }
    },
    bonusBuy: {
      enabled: true,
      costMultiplier: 25,
      tiers: [
        { id: "A", weight: 72 },
        { id: "B", weight: 28 }
      ]
    },
    wheelOutcomes: {
      blue: [
        { type: "none", value: 0, label: "MISS", weight: 58 },
        { type: "instant", value: 1, label: "+1x", weight: 18 },
        { type: "instant", value: 2, label: "+2x", weight: 8 },
        { type: "instant", value: 3, label: "+3x", weight: 2 },
        { type: "add", value: 1, label: "ADD +1x", weight: 10 },
        { type: "mul", value: 2, label: "MULTI x2", weight: 3 },
        { type: "spins", value: 2, label: "+2 SPINS", weight: 1 }
      ],
      red: [
        { type: "none", value: 0, label: "MISS", weight: 44 },
        { type: "instant", value: 2, label: "+2x", weight: 20 },
        { type: "instant", value: 4, label: "+4x", weight: 12 },
        { type: "instant", value: 6, label: "+6x", weight: 6 },
        { type: "instant", value: 10, label: "+10x", weight: 1 },
        { type: "add", value: 2, label: "ADD +2x", weight: 8 },
        { type: "add", value: 3, label: "ADD +3x", weight: 3 },
        { type: "mul", value: 2, label: "MULTI x2", weight: 4 },
        { type: "spins", value: 3, label: "+3 SPINS", weight: 2 }
      ]
    }
  };

  function sixPickWeighted(entries) {
    const rows = Array.isArray(entries) ? entries : [];
    let total = 0;
    for (let i = 0; i < rows.length; i++) {
      total += Math.max(0, Number(rows[i] && rows[i].weight) || 0);
    }
    if (total <= 0) return rows[0] || null;
    let roll = Math.random() * total;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const w = Math.max(0, Number(row.weight) || 0);
      roll -= w;
      if (roll <= 0) return row;
    }
    return rows[rows.length - 1] || null;
  }

  function sixCloneRules(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    return {
      id: String(src.id || "BASE"),
      title: String(src.title || "BASE"),
      subtitle: String(src.subtitle || ""),
      spins: Math.max(0, Math.floor(Number(src.spins) || 0)),
      wheelChance: {
        blue: Math.max(0, Math.min(1, Number(src.wheelChance && src.wheelChance.blue) || 0)),
        red: Math.max(0, Math.min(1, Number(src.wheelChance && src.wheelChance.red) || 0))
      },
      sixChance: {
        blue: Math.max(0, Math.min(1, Number(src.sixChance && src.sixChance.blue) || 0)),
        red: Math.max(0, Math.min(1, Number(src.sixChance && src.sixChance.red) || 0))
      },
      allowBlue: Boolean(src.allowBlue),
      allowRed: Boolean(src.allowRed),
      blueSixEnabled: src.blueSixEnabled !== false,
      guaranteedRed: Boolean(src.guaranteedRed)
    };
  }

  function sixRulesForBase() {
    const base = sixCloneRules(SIX666_CONFIG.base);
    base.id = "BASE";
    base.title = "BASE GAME";
    base.subtitle = "Base";
    base.spins = 0;
    return base;
  }

  function sixRulesForTier(tierId) {
    const key = String(tierId || "").trim().toUpperCase();
    const src = SIX666_CONFIG.tiers[key] || SIX666_CONFIG.tiers.A;
    return sixCloneRules(src);
  }

  function sixIsWheelToken(token) {
    const tok = normalizeToken(token);
    return tok === "BLU_WHEEL" || tok === "RED_WHEEL" || tok === "BLU_6" || tok === "RED_6";
  }

  function sixWheelToken(color, activated) {
    if (String(color) === "red") return activated ? "RED_6" : "RED_WHEEL";
    return activated ? "BLU_6" : "BLU_WHEEL";
  }

  function sixFormatMultiplier(mult) {
    const safe = Math.max(1, Number(mult) || 1);
    if (safe >= 100) return safe.toFixed(0);
    if (safe >= 10) return safe.toFixed(1);
    return safe.toFixed(2);
  }

  function sixBuildRegularGrid() {
    const rows = Math.max(1, Math.floor(Number(SIX666_CONFIG.layout.rows) || 4));
    const cols = Math.max(1, Math.floor(Number(SIX666_CONFIG.layout.cols) || 5));
    const out = [];
    for (let r = 0; r < rows; r++) {
      out[r] = [];
      for (let c = 0; c < cols; c++) {
        const picked = sixPickWeighted(SIX666_CONFIG.symbols) || {};
        out[r][c] = normalizeToken(picked.id || "BONE");
      }
    }
    return out;
  }

  function sixGenerateSpinGrid(ruleSet) {
    const rules = sixCloneRules(ruleSet);
    const rows = Math.max(1, Math.floor(Number(SIX666_CONFIG.layout.rows) || 4));
    const wheelReels = Array.isArray(SIX666_CONFIG.layout.wheelReels) ? SIX666_CONFIG.layout.wheelReels.slice() : [0, 2, 4];
    const grid = sixBuildRegularGrid();
    const wheels = [];
    const guaranteedReel = rules.guaranteedRed && wheelReels.length ? wheelReels[Math.floor(Math.random() * wheelReels.length)] : -1;

    for (let i = 0; i < wheelReels.length; i++) {
      const col = Math.max(0, Math.floor(Number(wheelReels[i]) || 0));
      let color = "";
      if (col === guaranteedReel && rules.allowRed) {
        color = "red";
      } else {
        const redRoll = Math.random();
        if (rules.allowRed && redRoll < rules.wheelChance.red) {
          color = "red";
        } else {
          const blueRoll = Math.random();
          if (rules.allowBlue && blueRoll < rules.wheelChance.blue) color = "blue";
        }
      }
      if (!color) continue;

      const row = Math.floor(Math.random() * rows);
      const sixChance = color === "red" ? rules.sixChance.red : rules.sixChance.blue;
      const wantsSix = Math.random() < sixChance;
      const activated = color === "blue" ? (rules.blueSixEnabled && wantsSix) : wantsSix;
      const token = sixWheelToken(color, activated);
      grid[row][col] = token;
      wheels.push({
        row,
        col,
        key: row + "_" + col,
        color,
        activated,
        token
      });
    }

    wheels.sort((a, b) => a.col - b.col || a.row - b.row);
    return { grid, wheels };
  }

  function sixEvaluatePaylines(grid, bet, activeMultiplier) {
    const rows = Array.isArray(grid) ? grid : [];
    const paylineSet = Array.isArray(SIX666_CONFIG.paylines) ? SIX666_CONFIG.paylines : SIX_PAYLINES;
    const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
    let total = 0;
    const lineIds = [];
    const lineWins = [];
    for (let i = 0; i < paylineSet.length; i++) {
      const pattern = paylineSet[i];
      let baseSym = "";
      let count = 0;
      for (let c = 0; c < pattern.length; c++) {
        const r = Math.max(0, Math.floor(Number(pattern[c]) || 0));
        const sym = normalizeToken(rows[r] && rows[r][c] ? rows[r][c] : "?");
        if (sixIsWheelToken(sym)) break;
        if (sym === "WILD") {
          count += 1;
          continue;
        }
        if (!baseSym) {
          baseSym = sym;
          count += 1;
          continue;
        }
        if (sym === baseSym) {
          count += 1;
          continue;
        }
        break;
      }
      if (count < 3) continue;
      const target = baseSym || "WILD";
      const payRow = SIX666_CONFIG.symbols.find((row) => row.id === target);
      if (!payRow || !payRow.pays) continue;
      const payKey = count >= 5 ? 5 : count;
      const lineMult = Math.max(0, Number(payRow.pays[payKey]) || 0);
      if (lineMult <= 0) continue;
      const lineValue = safeBet * lineMult * Math.max(1, Number(activeMultiplier) || 1);
      total += lineValue;
      lineIds.push(i + 1);
      lineWins.push(
        "L" + (i + 1) + " " + SYMBOL_LABELS[target] + " x" + count
        + " (" + lineMult.toFixed(1) + "x * " + sixFormatMultiplier(activeMultiplier) + "x)"
      );
    }
    return { total, lineIds, lineWins };
  }

  function sixResolveWheels(wheels, bet) {
    const list = Array.isArray(wheels) ? wheels.slice() : [];
    const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
    let spinMultiplier = 1;
    let instantWin = 0;
    let extraSpins = 0;
    const events = [];

    for (let i = 0; i < list.length; i++) {
      const wheel = list[i] && typeof list[i] === "object" ? list[i] : {};
      const color = wheel.color === "red" ? "red" : "blue";
      let table = SIX666_CONFIG.wheelOutcomes[color] || SIX666_CONFIG.wheelOutcomes.blue;
      if (!wheel.activated) {
        table = [
          { type: "none", value: 0, label: "MISS", weight: 82 },
          { type: "instant", value: 1, label: "+1x", weight: 14 },
          { type: "add", value: 1, label: "ADD +1x", weight: 3 },
          { type: "mul", value: 2, label: "MULTI x2", weight: 1 }
        ];
      }
      const outcome = sixPickWeighted(table) || table[0] || { type: "instant", value: 1, label: "+1x" };
      const value = Math.max(0, Number(outcome.value) || 0);
      const type = String(outcome.type || "instant");

      if (type === "instant") {
        instantWin += safeBet * value;
      } else if (type === "add") {
        spinMultiplier += value;
      } else if (type === "mul") {
        spinMultiplier *= Math.max(1, value);
      } else if (type === "spins") {
        extraSpins += Math.max(0, Math.floor(value));
      } else if (type === "none") {
        // Explicit dead wheel result.
      }

      spinMultiplier = Math.max(1, Number(spinMultiplier) || 1);
      events.push({
        key: String(wheel.key || ""),
        row: Math.max(0, Math.floor(Number(wheel.row) || 0)),
        col: Math.max(0, Math.floor(Number(wheel.col) || 0)),
        color,
        activated: Boolean(wheel.activated),
        resultType: type,
        resultValue: value,
        resultLabel: String(outcome.label || ""),
        afterMultiplier: spinMultiplier
      });
    }

    return { events, spinMultiplier, instantWin, extraSpins };
  }

  function sixMapTriggerTierByActivatedCount(count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (n === 1) return "A";
    if (n === 2) return "B";
    if (n >= 3) return "C";
    return "";
  }

  function sixPickBuyTier() {
    if (!SIX666_CONFIG.bonusBuy || !SIX666_CONFIG.bonusBuy.enabled) return "";
    const picked = sixPickWeighted(SIX666_CONFIG.bonusBuy.tiers);
    const tier = picked && picked.id ? String(picked.id).trim().toUpperCase() : "A";
    if (tier === "C") return "B";
    return tier === "B" ? "B" : "A";
  }

  function sixFormatRuleFlags(rules) {
    const row = sixCloneRules(rules);
    return {
      blueAllowed: Boolean(row.allowBlue),
      redAllowed: Boolean(row.allowRed),
      guaranteedRed: Boolean(row.guaranteedRed)
    };
  }

  function sixSummarizeRuleFlags(rules) {
    const flags = sixFormatRuleFlags(rules);
    return "Blue Wheels: " + (flags.blueAllowed ? "ON" : "OFF")
      + " | Red Wheels: " + (flags.redAllowed ? "ON" : "OFF")
      + " | Guaranteed Red: " + (flags.guaranteedRed ? "YES" : "NO");
  }

  function sixToReels(grid) {
    const rows = Array.isArray(grid) ? grid : [];
    const out = [];
    for (let r = 0; r < rows.length; r++) out.push((rows[r] || []).join(","));
    return out;
  }

  function sixBuildSpinFrame(machine, baseBet, rules, spinIndex, spinsLeftBefore) {
    const ruleSet = sixCloneRules(rules);
    const board = sixGenerateSpinGrid(ruleSet);
    const wheel = sixResolveWheels(board.wheels, baseBet);
    const pay = sixEvaluatePaylines(board.grid, baseBet, wheel.spinMultiplier);
    const rawSpinPay = Math.max(0, wheel.instantWin + pay.total);
    const spinPay = Math.max(0, Math.floor(rawSpinPay));
    const lineText = "FS " + spinIndex + " | Wheels " + board.wheels.length
      + " | Multi x" + sixFormatMultiplier(wheel.spinMultiplier)
      + " | " + (spinPay > 0 ? ("Win " + spinPay + " WL") : "No Win");
    const flags = sixFormatRuleFlags(ruleSet);
    return {
      frameType: "bonus_spin",
      reels: sixToReels(board.grid),
      lineText,
      lineWins: pay.lineWins.slice(0, 18),
      lineIds: pay.lineIds.slice(0, 24),
      markedCells: board.wheels.map((w) => w.key),
      effectCells: {},
      wheelEvents: wheel.events,
      spinPay,
      extraSpins: wheel.extraSpins,
      activeMultiplier: wheel.spinMultiplier,
      rules: flags,
      spinsLeftBefore: Math.max(0, Math.floor(Number(spinsLeftBefore) || 0))
    };
  }

  function simulateSixSixSix(machine, bet, buyBonus) {
    const safeBet = Math.max(1, Math.floor(Number(bet) || 1));
    const buyMode = Boolean(buyBonus);
    const baseRules = sixRulesForBase();
    const baseSpin = sixBuildSpinFrame(machine, safeBet, baseRules, 0, 0);
    const basePay = Math.max(0, Math.floor(Number(baseSpin.spinPay) || 0));
    baseSpin.spinPay = basePay;
    const baseWheels = Array.isArray(baseSpin.wheelEvents) ? baseSpin.wheelEvents : [];
    const activatedCount = baseWheels.filter((row) => row.activated).length;
    const baseTier = sixMapTriggerTierByActivatedCount(activatedCount);
    const buyTier = buyMode ? sixPickBuyTier() : "";
    const triggerTier = buyTier || baseTier;
    const triggerRules = triggerTier ? sixRulesForTier(triggerTier) : null;
    const triggerFlags = triggerRules ? sixFormatRuleFlags(triggerRules) : null;

    const lineWins = [];
    for (let i = 0; i < baseSpin.lineWins.length; i++) lineWins.push(baseSpin.lineWins[i]);
    if (baseWheels.length) {
      const wheelText = [];
      for (let i = 0; i < baseWheels.length; i++) {
        const ev = baseWheels[i] || {};
        const wheelType = ev.color === "red" ? "Red Wheel" : "Blue Wheel";
        wheelText.push(wheelType + " " + String(ev.resultLabel || ""));
      }
      if (wheelText.length) lineWins.push(wheelText.join(" | "));
    }

    const bonusFrames = [];
    let bonusTotal = 0;
    let spinsLeft = triggerRules ? Math.max(0, Math.floor(Number(triggerRules.spins) || Number(SIX666_CONFIG.defaultBonusSpins) || 10)) : 0;

    if (triggerRules) {
      const introTitle = triggerRules.title || "FREE SPINS";
      const introText = buyMode
        ? ("Bonus Buy: " + triggerRules.subtitle + " | " + spinsLeft + " Free Spins")
        : ("Triggered " + triggerRules.subtitle + " | " + spinsLeft + " Free Spins");
      bonusFrames.push({
        frameType: "bonus_intro",
        reels: baseSpin.reels,
        tierId: triggerRules.id,
        tierTitle: introTitle,
        tierSubtitle: triggerRules.subtitle,
        awardedSpins: spinsLeft,
        triggerWheelKeys: baseWheels.filter((row) => row.activated).map((row) => row.key),
        wheelRules: triggerFlags,
        lineText: introText
      });

      let spinIndex = 0;
      while (spinsLeft > 0 && bonusFrames.length < 128) {
        spinsLeft -= 1;
        spinIndex += 1;
        const frame = sixBuildSpinFrame(machine, safeBet, triggerRules, spinIndex, spinsLeft);
        const appliedSpinPay = Math.max(0, Math.floor(Number(frame.spinPay) || 0));
        frame.spinPay = appliedSpinPay;
        bonusTotal += appliedSpinPay;
        if (frame.extraSpins > 0) {
          spinsLeft += frame.extraSpins;
          frame.banner = "EXTRA SPINS +" + frame.extraSpins;
        }
        frame.hud = {
          mode: triggerRules.title || "FREE SPINS",
          spinsLeft,
          bonusWin: bonusTotal,
          currentSpinWin: frame.spinPay,
          activeMultiplier: frame.activeMultiplier,
          wheelRules: triggerFlags
        };
        bonusFrames.push(frame);
      }

      bonusFrames.push({
        frameType: "bonus_end",
        summary: {
          bonusWin: Math.max(0, Math.floor(bonusTotal)),
          tierId: triggerRules.id,
          tierTitle: triggerRules.title || "FREE SPINS"
        }
      });
    }

    const totalPayout = Math.max(0, Math.floor(basePay + bonusTotal));
    if (triggerRules) {
      lineWins.push("Bonus: " + triggerRules.subtitle + " (" + (triggerRules.spins || 10) + " FS)");
    }

    const baseOutcome = totalPayout > 0 ? (totalPayout >= safeBet * 300 ? "jackpot" : "win") : "lose";
    const summary = triggerRules
      ? (triggerRules.title + " | " + sixSummarizeRuleFlags(triggerRules))
      : (baseSpin.spinPay > 0 ? "Wicked Wheels Paid" : "");

    return {
      gameId: "slots_v2",
      reels: baseSpin.reels,
      payoutWanted: totalPayout,
      outcome: baseOutcome,
      lineWins: lineWins.slice(0, 18),
      lineIds: baseSpin.lineIds.slice(0, 24),
      bet: buyMode ? (safeBet * Math.max(1, Math.floor(Number(SIX666_CONFIG.bonusBuy && SIX666_CONFIG.bonusBuy.costMultiplier) || 25))) : safeBet,
      summary,
      bonusTriggered: Boolean(triggerRules),
      bonusFrames: bonusFrames.slice(0, 128)
    };
  }

  const LB_CLUSTER_PAY = {
    TRAP: { 5: 0.2, 6: 0.4, 7: 0.6, 8: 1.0, 9: 1.5, 10: 2.5, 12: 4, 15: 8 },
    CHEESE: { 5: 0.3, 6: 0.5, 7: 0.8, 8: 1.3, 9: 2.0, 10: 3.5, 12: 6, 15: 12 },
    BEER: { 5: 0.4, 6: 0.7, 7: 1.1, 8: 1.8, 9: 3.0, 10: 5, 12: 9, 15: 18 },
    BAG: { 5: 0.7, 6: 1.2, 7: 1.9, 8: 3.0, 9: 4.5, 10: 8, 12: 15, 15: 25 },
    HAT: { 5: 1.2, 6: 2.2, 7: 3.5, 8: 6.0, 9: 9.0, 10: 16, 12: 28, 15: 55 },
    WINT: { 5: 2.5, 6: 4.5, 7: 7.5, 8: 13, 9: 20, 10: 38, 12: 65, 15: 140 }
  };
  const LE_BANDIT_BASE_PAY_SCALE = 0.68;
  const LE_BANDIT_BONUS_PAY_SCALE = 0.62;

  function simulateLeBandit(machine, bet, buyBonus) {
    const COLS = 6, ROWS = 5;
    const pool = [
      ...Array(25).fill("TRAP"), ...Array(20).fill("CHEESE"), ...Array(18).fill("BEER"),
      ...Array(12).fill("BAG"), ...Array(8).fill("HAT"), ...Array(4).fill("WINT"),
      "WILD" // Only 1 WILD in a larger pool
    ];
    function pick() { return pool[Math.floor(Math.random() * pool.length)]; }
    function makeGrid(rc) { const g = []; for (let r = 0; r < ROWS; r++) { g[r] = []; for (let c = 0; c < COLS; c++) { let s = pick(); if (Math.random() < rc) s = "RAIN"; g[r][c] = s; } } return g; }
    function cpay(sym, n) { const t = LB_CLUSTER_PAY[sym]; if (!t) return 0; let b = 0; for (const k in t) { if (n >= Number(k)) b = t[k]; } return b; }
    function clusters(g) {
      const vis = new Set(), out = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const sym = g[r][c]; if (sym === "RAIN" || sym === "WILD" || vis.has(r + "_" + c) || !LB_CLUSTER_PAY[sym]) continue;
        const stk = [[r, c]], cells = [];
        while (stk.length) { const [rr, cc] = stk.pop(); const k = rr + "_" + cc; if (vis.has(k)) continue; const s = g[rr][cc]; if (s !== sym && s !== "WILD") continue; vis.add(k); cells.push({ r: rr, c: cc }); if (rr > 0) stk.push([rr - 1, cc]); if (rr < ROWS - 1) stk.push([rr + 1, cc]); if (cc > 0) stk.push([rr, cc - 1]); if (cc < COLS - 1) stk.push([rr, cc + 1]); }
        if (cells.length >= 5) out.push({ sym, cells });
      }
      return out;
    }
    function cntRain(g) { let n = 0; for (let r = 0; r < ROWS; r++)for (let c = 0; c < COLS; c++)if (g[r][c] === "RAIN") n++; return n; }
    function toReels(g) { const o = []; for (let r = 0; r < ROWS; r++)o.push(g[r].join(",")); return o; }

    // ────── BASE SPIN ──────
    const baseGrid = makeGrid(buyBonus ? 0.035 : 0.01);
    const baseC = clusters(baseGrid);
    let basePay = 0;
    const lines = [];
    for (const cl of baseC) {
      const m = cpay(cl.sym, cl.cells.length);
      if (m > 0) {
        basePay += bet * m * LE_BANDIT_BASE_PAY_SCALE;
        lines.push(cl.cells.length + "x " + (SYMBOL_LABELS[cl.sym] || cl.sym) + " (" + m + "x)");
      }
    }
    const triggerBonus = cntRain(baseGrid) >= 4 || buyBonus;
    const reels = toReels(baseGrid);

    // ────── FREE SPINS BONUS ──────
    let bonusPay = 0;
    const bonusFrames = [];
    const FREE_SPINS = 8;
    const marked = new Set();

    if (triggerBonus) {
      lines.push("🌈 BONUS! " + FREE_SPINS + " Free Spins!");
      for (let s = 0; s < FREE_SPINS; s++) {
        const fsGrid = makeGrid(0.04);
        const fsC = clusters(fsGrid);
        let sPay = 0;
        const sLines = [];

        // Cluster wins → mark cells
        for (const cl of fsC) {
          const m = cpay(cl.sym, cl.cells.length);
          if (m > 0) {
            sPay += bet * m * LE_BANDIT_BONUS_PAY_SCALE;
            sLines.push(cl.cells.length + "x " + (SYMBOL_LABELS[cl.sym] || cl.sym));
            for (const cell of cl.cells) marked.add(cell.r + "_" + cell.c);
          }
        }

        // Rainbow fill
        const rain = cntRain(fsGrid);
        let fills = null;
        let frameMarked = Array.from(marked); // Capture current state for the frame

        if (rain > 0 && frameMarked.length > 0) {
          const fb = {};
          for (const key of frameMarked) {
            const roll = Math.random(), [fr, fc] = key.split("_").map(Number);
            if (roll < 0.70) {
              // Favors lower coins
              const vs = [1, 1, 1, 1, 2, 2, 3, 5]; fb[key] = { type: "COIN", value: vs[Math.floor(Math.random() * vs.length)] };
            }
            else if (roll < 0.92) {
              const ms = [2, 2, 3, 4, 5]; fb[key] = { type: "CLOVR", value: ms[Math.floor(Math.random() * ms.length)] };
            }
            else { fb[key] = { type: "POT", value: 0 }; }
          }
          // Clovers multiply adjacent coins
          for (const k of Object.keys(fb)) { if (fb[k].type !== "CLOVR") continue; const [cr, cc] = k.split("_").map(Number); for (const [ar, ac] of [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]]) { const ak = ar + "_" + ac; if (fb[ak] && fb[ak].type === "COIN") fb[ak].value *= fb[k].value; } }
          // Sum coins
          let coinVal = 0; for (const k of Object.keys(fb)) { if (fb[k].type === "COIN") coinVal += fb[k].value; }
          // Pot respin
          let hasPot = false, respinV = 0; for (const k of Object.keys(fb)) { if (fb[k].type === "POT") { hasPot = true; break; } }
          if (hasPot && coinVal > 0) { for (const k of Object.keys(fb)) { if (fb[k].type === "COIN") { const rv = [1, 2, 3, 5, 8, 10]; respinV += rv[Math.floor(Math.random() * rv.length)]; } }; coinVal += respinV; }
          bonusPay += bet * coinVal * LE_BANDIT_BONUS_PAY_SCALE;
          const fillCells = frameMarked.map(k => { const [r, c] = k.split("_").map(Number); return { r, c, ...fb[k] }; });
          fills = { cells: fillCells, totalMult: coinVal, hasPot, respinMult: respinV };
          sLines.push("🌈 " + frameMarked.length + " fills" + (hasPot ? " + POT respin" : "") + " (" + coinVal + "x)");
          // Marked area cleared AFTER push below
        } else if (rain > 0) { sLines.push("🌈 (no marked area)"); }

        bonusPay += sPay;
        const txt = "FS" + (s + 1) + ": " + (sLines.length ? sLines.join(" | ") : "no win");
        lines.push(txt);
        bonusFrames.push({
          grid: fsGrid,
          reels: toReels(fsGrid),
          markedCells: frameMarked,
          fills,
          lineText: txt,
          spinPay: sPay + (fills ? bet * fills.totalMult * LE_BANDIT_BONUS_PAY_SCALE : 0)
        });

        if (fills) marked.clear(); // Persistence ends on fill
      }
    }

    const totalPay = Math.floor(basePay + bonusPay);
    let summary = triggerBonus ? ("Bonus " + FREE_SPINS + " FS | Total " + (totalPay / Math.max(1, bet)).toFixed(1) + "x") : (basePay > 0 ? ("Cluster " + (basePay / bet).toFixed(1) + "x") : "");

    return {
      gameId: "le_bandit", reels, payoutWanted: totalPay,
      outcome: totalPay > 0 ? (totalPay >= bet * 50 ? "jackpot" : "win") : "lose",
      lineWins: lines, lineIds: [], bet: buyBonus ? bet * 10 : bet, summary,
      bonusFrames
    };
  }

  function sampleFramesEvenly(frames, maxCount) {
    const list = Array.isArray(frames) ? frames : [];
    const cap = Math.max(1, Math.floor(Number(maxCount) || 1));
    if (list.length <= cap) return list.slice();
    const out = [];
    const step = list.length / cap;
    for (let i = 0; i < cap; i++) {
      const idx = Math.min(list.length - 1, Math.floor(i * step));
      out.push(list[idx]);
    }
    const last = list[list.length - 1];
    if (out[out.length - 1] !== last) out[out.length - 1] = last;
    return out;
  }

  function decodeSlotsV2BonusCellToken(value) {
    const raw = String(value || "").trim().toUpperCase();
    if (!raw || raw === ".") return { token: "LOCK", mult: 0 };
    if (raw === "COL") return { token: "COL", mult: 0 };
    const prefix = raw.charAt(0);
    const num = Math.max(0, Math.floor(Number(raw.slice(1)) || 0));
    if (prefix === "C") return { token: "COIN", mult: num };
    if (prefix === "M") return { token: "MULT", mult: Math.max(2, num) };
    if (prefix === "B") return { token: "BOMB", mult: num };
    if (prefix === "J") return { token: "JACK", mult: num };
    return { token: "BLANK", mult: 0 };
  }

  function buildSlotsV2BonusFrames(bonusView) {
    if (!bonusView || typeof bonusView !== "object") return [];
    const allFrames = Array.isArray(bonusView.frames) ? bonusView.frames : [];
    if (!allFrames.length) return [];
    const rows = Math.max(1, Math.floor(Number(bonusView.rows) || 4));
    const cols = Math.max(1, Math.floor(Number(bonusView.reels) || 5));
    const totalSlots = rows * cols;
    const sampled = sampleFramesEvenly(allFrames, 20);
    const out = [];
    for (let i = 0; i < sampled.length; i++) {
      const frame = sampled[i] || {};
      const cells = Array.isArray(frame.cells) ? frame.cells : [];
      const tease = Array.isArray(frame.tease) ? frame.tease : [];
      const grid = [];
      for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
          grid[r][c] = "LOCK";
        }
      }
      for (let idx = 0; idx < totalSlots; idx++) {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const decoded = decodeSlotsV2BonusCellToken(cells[idx]);
        grid[r][c] = decoded.token;
      }
      for (let iTease = 0; iTease < tease.length; iTease++) {
        const teaseIdx = Math.max(0, Math.floor(Number(tease[iTease]) || 0));
        if (teaseIdx >= totalSlots) continue;
        const tr = Math.floor(teaseIdx / cols);
        const tc = teaseIdx % cols;
        if (grid[tr][tc] === "LOCK") grid[tr][tc] = "BLANK";
      }
      const markedCells = [];
      let filled = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tok = String(grid[r][c] || "");
          if (tok === "LOCK" || tok === "BLANK") continue;
          filled += 1;
          markedCells.push(r + "_" + c);
        }
      }
      out.push({
        reels: grid.map((row) => row.join(",")),
        markedCells,
        fills: null,
        spinPay: 0,
        lineText: "Hold&Spin " + (i + 1) + "/" + sampled.length + " | Filled " + filled + "/" + totalSlots + " | Respins " + Math.max(0, Math.floor(Number(frame.respins) || 0))
      });
    }
    return out;
  }

  function extractBonusFrames(machineType, rawResult) {
    const type = String(machineType || "").trim().toLowerCase();
    if (type === "le_bandit") {
      return Array.isArray(rawResult && rawResult.bonusFrames) ? rawResult.bonusFrames : [];
    }
    if (type === "slots_v2") {
      if (Array.isArray(rawResult && rawResult.bonusFrames) && rawResult.bonusFrames.length) {
        return rawResult.bonusFrames;
      }
      return buildSlotsV2BonusFrames(rawResult && rawResult.bonusView);
    }
    if (type === "snoop_dogg_dollars") {
      return Array.isArray(rawResult && rawResult.bonusFrames) ? rawResult.bonusFrames : [];
    }
    return [];
  }

  function rowsFromTumbleInput(input, machineType) {
    if (!Array.isArray(input) || !input.length) return [];
    if (Array.isArray(input[0])) {
      return input.map((row) => Array.isArray(row) ? row.map((cell) => normalizeToken(cell)) : ["?"]);
    }
    return rowsFromResult(input, machineType);
  }

  function sanitizeTumbleFrame(machineType, frame, index) {
    const row = frame && typeof frame === "object" ? frame : {};
    const beforeRows = rowsFromTumbleInput(row.beforeRows || row.beforeReels || row.reelsBefore || row.reels, machineType);
    const afterRows = rowsFromTumbleInput(row.afterRows || row.afterReels || row.reelsAfter || row.reels, machineType);
    const winningKeys = Array.isArray(row.winningKeys) ? row.winningKeys.map((v) => String(v || "")).filter(Boolean) : [];
    const clearedKeys = Array.isArray(row.clearedKeys) ? row.clearedKeys.map((v) => String(v || "")).filter(Boolean) : winningKeys.slice();
    const lineText = String(row.lineText || "Tumble " + index).trim();
    if (!beforeRows.length && !afterRows.length) return null;
    return {
      index: Math.max(1, Math.floor(Number(row.index) || index)),
      payout: Math.max(0, Math.floor(Number(row.payout) || Number(row.winPay) || Number(row.cascadePay) || 0)),
      lineText: lineText || ("Tumble " + index),
      beforeRows: beforeRows.length ? beforeRows : afterRows,
      afterRows: afterRows.length ? afterRows : beforeRows,
      winningKeys: winningKeys.slice(0, 256),
      clearedKeys: clearedKeys.slice(0, 256),
      markedCells: Array.isArray(row.markedCells) ? row.markedCells.slice(0, 256) : [],
      beforeCellMeta: sanitizeCellMeta(row.beforeCellMeta),
      afterCellMeta: sanitizeCellMeta(row.afterCellMeta),
      effectCells: sanitizeEffectCells(row.effectCells)
    };
  }

  function extractTumbleFrames(machineType, rawResult) {
    const source = Array.isArray(rawResult && rawResult.tumbleFrames) ? rawResult.tumbleFrames : [];
    if (!source.length) return [];
    const out = [];
    for (let i = 0; i < source.length; i++) {
      const parsed = sanitizeTumbleFrame(machineType, source[i], i + 1);
      if (!parsed) continue;
      out.push(parsed);
    }
    return out.slice(0, 64);
  }

  function resolveSpinStartRows(machineType, rawResult, tumbleFrames, fallbackRows) {
    const safeFallback = Array.isArray(fallbackRows) ? fallbackRows : [["?"]];
    const startRaw = rowsFromResult(rawResult && rawResult.spinStartReels, machineType);
    if (Array.isArray(startRaw) && startRaw.length) return startRaw;
    if (Array.isArray(tumbleFrames) && tumbleFrames.length && Array.isArray(tumbleFrames[0].beforeRows) && tumbleFrames[0].beforeRows.length) {
      return tumbleFrames[0].beforeRows;
    }
    return safeFallback;
  }

  async function applyTumbleFrame(payload) {
    const row = payload && typeof payload === "object" ? payload : {};
    const phase = String(row.phase || "").trim().toLowerCase();
    state.ephemeral.rows = Array.isArray(row.rows) && row.rows.length ? row.rows : state.ephemeral.rows;
    state.ephemeral.lineIds = [];
    state.ephemeral.lineWins = [String(row.lineText || "Tumble step")];
    state.ephemeral.markedCells = Array.isArray(row.markedCells) ? row.markedCells.slice(0, 256) : [];
    state.ephemeral.cellMeta = sanitizeCellMeta(row.cellMeta);
    const effectCells = sanitizeEffectCells(row.effectCells);
    const winningKeys = Array.isArray(row.winningKeys) ? row.winningKeys : [];
    for (let i = 0; i < winningKeys.length; i++) {
      const key = String(winningKeys[i] || "");
      if (!key) continue;
      effectCells[key] = phase === "clear" ? "tumble-clear" : (phase === "drop" ? "tumble-drop" : "tumble-win");
    }
    state.ephemeral.effectCells = effectCells;
    state.ephemeral.upgradeFlashes = {};
    renderBoard();
  }

  async function runTumblePlayback(machine, tumbleFrames, betValue) {
    const frames = Array.isArray(tumbleFrames) ? tumbleFrames : [];
    if (!frames.length) return { steps: 0, totalWin: 0 };
    const safeBet = Math.max(1, Math.floor(Number(betValue) || 1));
    const totalWin = frames.reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row && row.payout) || 0)), 0);
    if (!tumbleAnimator || typeof tumbleAnimator.playSequence !== "function") {
      if (totalWin > 0 && winCounter && typeof winCounter.startCountUp === "function") {
        await winCounter.startCountUp(state.currentWinValue, state.currentWinValue + totalWin, {
          bet: safeBet,
          turbo: Boolean(state.uiSettings.turbo),
          durationScale: 0.9
        });
      }
      setTumbleIndicator("");
      return { steps: frames.length, totalWin };
    }

    const result = await tumbleAnimator.playSequence(frames, {
      turbo: Boolean(state.uiSettings.turbo),
      onStepWin: async (step) => {
        const add = Math.max(0, Math.floor(Number(step && step.payout) || 0));
        if (add <= 0 || !winCounter || typeof winCounter.startCountUp !== "function") return;
        await winCounter.startCountUp(state.currentWinValue, state.currentWinValue + add, {
          bet: safeBet,
          turbo: Boolean(state.uiSettings.turbo),
          durationScale: 0.78
        });
      }
    });
    setTumbleIndicator("");
    return result || { steps: frames.length, totalWin };
  }

  function resolveLockCurrencies() {
    const fallback = [
      { id: 43, key: "ruby_lock", value: 1000000, short: "RL", icon: "./assets/blocks/special/ruby_lock.png" },
      { id: 42, key: "emerald_lock", value: 10000, short: "EL", icon: "./assets/blocks/special/emerald_lock.png" },
      { id: 24, key: "obsidian_lock", value: 100, short: "OL", icon: "./assets/blocks/special/obsidian_lock.png" },
      { id: 9, key: "world_lock", value: 1, short: "WL", icon: "./assets/blocks/special/world_lock.png" }
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

          let short = "WL";
          if (key === "ruby_lock") short = "RL";
          else if (key === "emerald_lock") short = "EL";
          else if (key === "obsidian_lock") short = "OL";

          const image = String(row.image || "").trim();
          const icon = image ? (blockAssetBase + "/" + image.replace(/^\/+/, "")) : "";
          out.push({ id, key, value, short, icon });
        }
        if (out.length) {
          out.sort((a, b) => b.value - a.value || a.id - b.id);
          return out;
        }
      }
    }
    return fallback;
  }

  function toCount(value) { return Math.max(0, Math.floor(Number(value) || 0)); }

  function hasVaultBalanceField(raw) {
    return Boolean(raw && typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, "web_vault_balance"));
  }

  function getVaultBackupStorageKey(accountId) {
    const safe = String(accountId || "").trim();
    if (!safe) return "";
    return VAULT_BACKUP_KEY_PREFIX + safe;
  }

  function readVaultBackupForAccount(accountId) {
    const key = getVaultBackupStorageKey(accountId);
    if (!key) return 0;
    try {
      return toCount(localStorage.getItem(key));
    } catch (_error) {
      return 0;
    }
  }

  function writeVaultBackupForAccount(accountId, value) {
    const key = getVaultBackupStorageKey(accountId);
    if (!key) return;
    const safe = toCount(value);
    try {
      localStorage.setItem(key, String(safe));
    } catch (_error) {
      // ignore storage failures
    }
  }

  function syncVaultBackupForCurrentUser(value) {
    if (!state.user || !state.user.accountId) return;
    writeVaultBackupForAccount(state.user.accountId, value);
  }

  function toWallet(invRaw) {
    const inv = invRaw && typeof invRaw === "object" ? invRaw : {};
    const byId = {};
    let total = 0;
    for (let i = 0; i < LOCK_CURRENCIES.length; i++) {
      const row = LOCK_CURRENCIES[i];
      const c = toCount(inv[row.id]);
      byId[row.id] = c;
      total += c * row.value;
    }
    const vault = toCount(inv.web_vault_balance);
    return { byId, total, vault };
  }

  function fromWallet(totalValue, vaultValue) {
    let left = toCount(totalValue);
    const out = {};
    for (let i = 0; i < LOCK_CURRENCIES.length; i++) {
      const row = LOCK_CURRENCIES[i];
      const c = Math.floor(left / row.value);
      out[row.id] = Math.max(0, c);
      left -= c * row.value;
    }
    out.web_vault_balance = Math.max(0, Math.floor(Number(vaultValue) || 0));
    return out;
  }

  function walletText(byId) {
    const safe = byId && typeof byId === "object" ? byId : {};
    const parts = [];
    for (let i = 0; i < LOCK_CURRENCIES.length; i++) {
      const row = LOCK_CURRENCIES[i];
      const c = toCount(safe[row.id]);
      if (c > 0) parts.push(c + " " + row.short);
    }
    return parts.length ? parts.join(" | ") : "0 WL";
  }

  function resolveDisplayLockRow(shortCode) {
    const code = String(shortCode || "").trim().toUpperCase();
    for (let i = 0; i < LOCK_CURRENCIES.length; i++) {
      if (String(LOCK_CURRENCIES[i].short || "").toUpperCase() === code) return LOCK_CURRENCIES[i];
    }
    if (code === "RL") return { id: 43, key: "ruby_lock", value: 1000000, short: "RL", icon: "./assets/blocks/special/ruby_lock.png" };
    if (code === "EL") return { id: 42, key: "emerald_lock", value: 10000, short: "EL", icon: "./assets/blocks/special/emerald_lock.png" };
    if (code === "OL") return { id: 24, key: "obsidian_lock", value: 100, short: "OL", icon: "./assets/blocks/special/obsidian_lock.png" };
    return { id: 9, key: "world_lock", value: 1, short: "WL", icon: "./assets/blocks/special/world_lock.png" };
  }

  function getDisplayLockCycle() {
    const out = [];
    for (let i = 0; i < DISPLAY_LOCK_ORDER.length; i++) {
      out.push(resolveDisplayLockRow(DISPLAY_LOCK_ORDER[i]));
    }
    return out;
  }

  function getActiveDisplayLockRow() {
    const cycle = getDisplayLockCycle();
    if (!cycle.length) return resolveDisplayLockRow("WL");
    const idx = Math.max(0, Math.floor(Number(state.lockDisplayIndex) || 0)) % cycle.length;
    return cycle[idx];
  }

  function formatDisplayLockNumber(value) {
    const n = Number(value) || 0;
    if (Number.isInteger(n)) return n.toLocaleString("en-US");
    const abs = Math.abs(n);
    const maxFractionDigits = abs >= 100 ? 2 : (abs >= 10 ? 3 : 4);
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFractionDigits
    });
  }

  function formatLocksByDisplayUnit(value) {
    const safe = Math.max(0, Number(value) || 0);
    const unit = getActiveDisplayLockRow();
    const unitValue = Math.max(1, Number(unit.value) || 1);
    const converted = safe / unitValue;
    return formatDisplayLockNumber(converted) + " " + unit.short;
  }

  function formatLockUnitChipHtml(unitRow) {
    const row = unitRow && typeof unitRow === "object" ? unitRow : getActiveDisplayLockRow();
    const short = String(row && row.short || "WL");
    const iconSrc = String(row && row.icon || "").trim();
    if (!iconSrc) return escapeHtml(short);
    return "<span class=\"lock-amt-inline\">" +
      "<img class=\"lock-amt-icon\" src=\"" + escapeHtml(iconSrc) + "\" alt=\"" + escapeHtml(short) + "\" draggable=\"false\">" +
      "<span>" + escapeHtml(short) + "</span>" +
      "</span>";
  }

  function formatLocksByDisplayUnitHtml(value) {
    const text = formatLocksByDisplayUnit(value);
    const unit = getActiveDisplayLockRow();
    const iconSrc = String(unit && unit.icon || "").trim();
    if (!iconSrc) return escapeHtml(text);
    return "<span class=\"lock-amt-inline\">" +
      "<img class=\"lock-amt-icon\" src=\"" + escapeHtml(iconSrc) + "\" alt=\"" + escapeHtml(String(unit.short || "WL")) + "\" draggable=\"false\">" +
      "<span>" + escapeHtml(text) + "</span>" +
      "</span>";
  }

  function cycleLockDisplayUnit() {
    const cycle = getDisplayLockCycle();
    const len = Math.max(1, cycle.length);
    state.lockDisplayIndex = (Math.max(0, Math.floor(Number(state.lockDisplayIndex) || 0)) + 1) % len;
    renderAll();
  }

  function renderBetChipLabels() {
    const betBtns = document.querySelectorAll(".bet-btn");
    const selectedValue = Math.max(1, Math.floor(Number(state.currentBetValue) || 1));
    betBtns.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const raw = Math.max(0, Math.floor(Number(btn.dataset.bet) || 0));
      if (raw <= 0) return;
      btn.textContent = formatLocksByDisplayUnit(raw);
      btn.classList.toggle("active", raw === selectedValue);
    });
  }

  function renderWalletDisplay() {
    if (!(els.walletLabel instanceof HTMLElement)) return;
    const unit = getActiveDisplayLockRow();
    const vaultValue = formatLocksByDisplayUnitHtml(state.webVaultLocks);
    const gameValue = formatLocksByDisplayUnitHtml(state.walletLocks);
    els.walletLabel.innerHTML =
      "<span class=\"wallet-top\">" +
      "<span>Tap to cycle display unit</span>" +
      "<span class=\"wallet-unit\">" + formatLockUnitChipHtml(unit) + "</span>" +
      "</span>" +
      "<span class=\"wallet-main\">" +
      "<span class=\"wallet-entry\"><span class=\"label\">Vault:</span><span class=\"value\">" + vaultValue + "</span></span>" +
      "<span class=\"wallet-sep\">|</span>" +
      "<span class=\"wallet-entry\"><span class=\"label\">Game:</span><span class=\"value\">" + gameValue + "</span></span>" +
      "</span>";
    els.walletLabel.title = "Click to cycle lock display (WL/OL/EL/RL). Current: " + unit.short;
    els.walletLabel.style.cursor = "pointer";
  }

  function renderVaultPanel() {
    const unit = getActiveDisplayLockRow();
    if (els.vaultGameBalance instanceof HTMLElement) {
      els.vaultGameBalance.innerHTML = formatLocksByDisplayUnitHtml(state.walletLocks);
    }
    if (els.vaultWebBalance instanceof HTMLElement) {
      els.vaultWebBalance.innerHTML = formatLocksByDisplayUnitHtml(state.webVaultLocks);
    }
    if (els.vaultUnitHint instanceof HTMLElement) {
      els.vaultUnitHint.innerHTML = "Display unit: " + formatLockUnitChipHtml(unit) + " (transfers are stored as WL).";
    }
    if (els.vaultAmount instanceof HTMLInputElement) {
      els.vaultAmount.placeholder = "Amount (" + unit.short + " display)";
    }
    const canCredit = Boolean(state.user && VAULT_CREDIT_ROLES.has(String(state.user.role || "none").trim().toLowerCase()));
    if (els.vaultAdminPanel instanceof HTMLElement) {
      els.vaultAdminPanel.classList.toggle("hidden", !canCredit);
    }
  }

  function syncTurboSetting() {
    window.GT_SETTINGS = window.GT_SETTINGS || {};
    window.GT_SETTINGS.SLOTS_TURBO = Boolean(state.uiSettings.turbo);
  }

  function renderSpinHistory() {
    if (!(els.premiumHistoryList instanceof HTMLElement)) return;
    if (!state.spinHistory.length) {
      els.premiumHistoryList.innerHTML = "<div class=\"premium-history-item\">No spins yet.</div>";
      return;
    }
    els.premiumHistoryList.innerHTML = state.spinHistory.map((row) => {
      const r = row && typeof row === "object" ? row : {};
      const cls = ["premium-history-item"];
      if (r.payout > 0) cls.push("win");
      if (r.bigWin) cls.push("big");
      const ts = r.time ? new Date(r.time).toLocaleTimeString([], { hour12: false }) : "--:--:--";
      return (
        "<div class=\"" + cls.join(" ") + "\">" +
        "<div>" + escapeHtml(ts) + " | " + escapeHtml(String(r.game || "")) + "</div>" +
        "<div>Bet: " + formatLocksByDisplayUnitHtml(Math.max(0, Math.floor(Number(r.bet) || 0))) + "</div>" +
        "<div>Payout: " + formatLocksByDisplayUnitHtml(Math.max(0, Math.floor(Number(r.payout) || 0))) + (r.bigWin ? " <strong>(BIG)</strong>" : "") + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function pushSpinHistory(row) {
    const item = row && typeof row === "object" ? row : {};
    state.spinHistory.unshift({
      time: Date.now(),
      game: String(item.game || ""),
      bet: Math.max(0, Math.floor(Number(item.bet) || 0)),
      payout: Math.max(0, Math.floor(Number(item.payout) || 0)),
      bigWin: Boolean(item.bigWin)
    });
    state.spinHistory = state.spinHistory.slice(0, 10);
    renderSpinHistory();
  }

  function updateAutoplayStatusText() {
    if (!(els.premiumAutoplayStatus instanceof HTMLElement)) return;
    if (!state.autoplay.active) {
      els.premiumAutoplayStatus.textContent = "Autoplay: Off";
      return;
    }
    els.premiumAutoplayStatus.textContent = "Autoplay: " + state.autoplay.left + "/" + state.autoplay.total;
  }

  function syncTopPanelButtons() {
    if (els.premiumSettingsBtn instanceof HTMLButtonElement) {
      const open = els.premiumSettingsPanel instanceof HTMLElement && !els.premiumSettingsPanel.classList.contains("hidden");
      els.premiumSettingsBtn.classList.toggle("active", open);
    }
    if (els.premiumHistoryBtn instanceof HTMLButtonElement) {
      const open = els.premiumHistoryPanel instanceof HTMLElement && !els.premiumHistoryPanel.classList.contains("hidden");
      els.premiumHistoryBtn.classList.toggle("active", open);
    }
    if (els.premiumFairnessBtn instanceof HTMLButtonElement) {
      const open = els.fairnessModal instanceof HTMLElement && !els.fairnessModal.classList.contains("hidden");
      els.premiumFairnessBtn.classList.toggle("active", open);
    }
    if (els.premiumSoundToggle instanceof HTMLButtonElement) {
      els.premiumSoundToggle.classList.toggle("is-off", !state.uiSettings.soundEnabled);
    }
  }

  function renderPremiumHud() {
    const machine = getSelectedMachine();
    const bet = clampBetToMachine(machine, state.currentBetValue);
    if (els.premiumTopBet instanceof HTMLElement) {
      els.premiumTopBet.innerHTML = "Bet: " + formatLocksByDisplayUnitHtml(bet);
    }
    updateWinDisplays();
    updateAutoplayStatusText();
    if (els.premiumSoundToggle instanceof HTMLButtonElement) {
      els.premiumSoundToggle.textContent = state.uiSettings.soundEnabled ? "Sound: On" : "Sound: Off";
    }
    if (els.premiumVolume instanceof HTMLInputElement) {
      const nextVol = Math.round(clamp01(state.uiSettings.soundVolume) * 100);
      if (Number(els.premiumVolume.value) !== nextVol) els.premiumVolume.value = String(nextVol);
    }
    if (els.premiumTurboToggle instanceof HTMLInputElement) els.premiumTurboToggle.checked = Boolean(state.uiSettings.turbo);
    if (els.premiumStopBigWin instanceof HTMLInputElement) els.premiumStopBigWin.checked = Boolean(state.uiSettings.autoplayStopOnBigWin);
    if (els.premiumStopBalance instanceof HTMLInputElement) {
      const safe = Math.max(0, Math.floor(Number(state.uiSettings.autoplayStopBalance) || 0));
      if (Number(els.premiumStopBalance.value) !== safe) els.premiumStopBalance.value = String(safe);
    }
    if (els.premiumAutoplaySelect instanceof HTMLSelectElement) {
      const count = Math.max(0, Math.floor(Number(state.uiSettings.autoplayCount) || 0));
      if (els.premiumAutoplaySelect.value !== String(count)) els.premiumAutoplaySelect.value = String(count);
    }
    if (els.premiumAutoplayBtn instanceof HTMLButtonElement) {
      els.premiumAutoplayBtn.textContent = state.autoplay.active ? "Stop Auto" : "Start Auto";
    }
    syncTopPanelButtons();
    renderSpinHistory();
  }

  function applyUiSettings(settings) {
    const src = settings && typeof settings === "object" ? settings : DEFAULT_UI_SETTINGS;
    state.uiSettings.soundEnabled = Boolean(src.soundEnabled);
    state.uiSettings.soundVolume = clamp01(src.soundVolume);
    state.uiSettings.turbo = Boolean(src.turbo);
    state.uiSettings.autoplayCount = AUTOPLAY_COUNTS.indexOf(Math.max(0, Math.floor(Number(src.autoplayCount) || 0))) >= 0
      ? Math.max(0, Math.floor(Number(src.autoplayCount) || 0))
      : 0;
    state.uiSettings.autoplayStopOnBigWin = Boolean(src.autoplayStopOnBigWin);
    state.uiSettings.autoplayStopBalance = Math.max(0, Math.floor(Number(src.autoplayStopBalance) || 0));
    syncTurboSetting();
    audioManager.setVolume(state.uiSettings.soundVolume);
    audioManager.setEnabled(state.uiSettings.soundEnabled);
    saveUiSettings();
    renderPremiumHud();
  }

  function setAutoplayActive(active, count) {
    const next = Boolean(active);
    if (!next) {
      state.autoplay.active = false;
      state.autoplay.left = 0;
      state.autoplay.total = 0;
      updateAutoplayStatusText();
      renderPremiumHud();
      return;
    }
    const n = Math.max(0, Math.floor(Number(count) || Number(state.uiSettings.autoplayCount) || 0));
    if (n <= 0) {
      state.autoplay.active = false;
      state.autoplay.left = 0;
      state.autoplay.total = 0;
      updateAutoplayStatusText();
      renderPremiumHud();
      return;
    }
    state.autoplay.active = true;
    state.autoplay.left = n;
    state.autoplay.total = n;
    updateAutoplayStatusText();
    renderPremiumHud();
  }

  // UI helper: format bank value for display in lists when banks are considered infinite
  function formatBankForList(row) {
    if (INFINITE_BANK) return "Infinite";
    const v = (row && row.earningsLocks) ?? 0;
    return formatLocksByDisplayUnit(v);
  }

  function setStatus(el, message, mode) {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = String(message || "");
    el.classList.remove("ok", "error");
    if (mode === "ok") el.classList.add("ok");
    if (mode === "error") el.classList.add("error");
  }

  function populateMinesCountSelect() {
    if (!(els.minesCountSelect instanceof HTMLSelectElement)) return;
    const current = normalizeMinesCount(els.minesCountSelect.value || MINES_CONFIG.defaultMines);
    let html = "";
    for (let i = MINES_CONFIG.minMines; i <= MINES_CONFIG.maxMines; i++) {
      html += "<option value=\"" + i + "\">" + i + "</option>";
    }
    els.minesCountSelect.innerHTML = html;
    els.minesCountSelect.value = String(current);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeToken(value) { return String(value || "").trim().toUpperCase() || "?"; }
  function parseDisplayToken(token) {
    const raw = normalizeToken(token);
    const idx = raw.indexOf("@");
    if (idx <= 0) return { raw, base: raw, overlay: "" };
    return {
      raw,
      base: normalizeToken(raw.slice(0, idx)),
      overlay: normalizeToken(raw.slice(idx + 1))
    };
  }
  function symbolIcon(token) {
    const parsed = parseDisplayToken(token);
    return SYMBOL_ICONS[parsed.base] || SYMBOL_ICONS["?"];
  }
  function symbolLabel(token) {
    const parsed = parseDisplayToken(token);
    const baseLabel = SYMBOL_LABELS[parsed.base] || parsed.base;
    if (!parsed.overlay) return baseLabel;
    const match = /^([WM])(\d+)$/.exec(parsed.overlay);
    if (!match) return baseLabel + " " + parsed.overlay;
    const mult = Math.max(1, Math.floor(Number(match[2]) || 1));
    if (match[1] === "W") return baseLabel + " x" + mult;
    return baseLabel + " x" + mult;
  }
  function symbolClass(token) {
    const parsed = parseDisplayToken(token);
    const baseClass = SYMBOL_CLASSES[parsed.base] || "";
    if (!parsed.overlay) return baseClass;
    return baseClass ? (baseClass + " boosted") : "boosted";
  }
  function symbolTokenClass(token) {
    const parsed = parseDisplayToken(token);
    const safe = String(parsed.base || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!safe) return "";
    return "tok-" + safe;
  }

  function parseRows(raw) {
    const text = String(raw || "");
    const rows = text.split("|").map((s) => String(s || "").trim()).filter(Boolean);
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      out.push(rows[i].split(",").map((t) => normalizeToken(t)).filter(Boolean));
    }
    const normalized = out.filter((row) => row.length > 0);
    if (!normalized.length) return [];
    const singleCol = normalized.length > 1 && normalized.every((row) => row.length === 1);
    if (singleCol) return [normalized.map((row) => row[0])];
    return normalized;
  }

  function parseLineWins(raw) {
    if (Array.isArray(raw)) return raw.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 18);
    return String(raw || "").split("|").map((s) => String(s || "").trim()).filter(Boolean).slice(0, 18);
  }

  function parseLineIds(raw) {
    if (Array.isArray(raw)) return raw.map((v) => Math.max(1, Math.floor(Number(v) || 0))).filter((v) => v > 0).slice(0, 12);
    return String(raw || "").split(",").map((v) => Math.max(1, Math.floor(Number(v) || 0))).filter((v) => v > 0).slice(0, 12);
  }

  function normalizeMachineRecord(tileKey, raw) {
    if (!raw || typeof raw !== "object") return null;
    const [txRaw, tyRaw] = String(tileKey || "").split("_");
    const tx = Math.floor(Number(txRaw));
    const ty = Math.floor(Number(tyRaw));
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;

    const type = String(raw.type || "").trim();
    if (!MACHINE_DEFS[type]) return null;
    const def = MACHINE_DEFS[type] || MACHINE_DEFS.slots;
    const maxBetRaw = Math.floor(Number(raw.maxBet));
    const maxBet = Math.max(def.minBet, Math.min(def.maxBet, Number.isFinite(maxBetRaw) ? maxBetRaw : def.maxBet));
    const stats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};

    return {
      tileKey: String(tileKey || ""),
      tx,
      ty,
      type: def.id,
      typeName: def.name,
      minBet: def.minBet,
      hardMaxBet: def.maxBet,
      maxPayoutMultiplier: def.maxPayoutMultiplier,
      reels: def.reels,
      rows: def.rows,
      volatility: String(def.volatility || "medium"),
      maxBet,
      ownerAccountId: String(raw.ownerAccountId || "").trim(),
      ownerName: String(raw.ownerName || "").trim().slice(0, 20),
      inUseAccountId: String(raw.inUseAccountId || "").trim(),
      inUseName: String(raw.inUseName || "").trim().slice(0, 20),
      earningsLocks: toCount(raw.earningsLocks),
      updatedAt: toCount(raw.updatedAt),
      stats: {
        plays: toCount(stats.plays),
        totalBet: toCount(stats.totalBet),
        totalPayout: toCount(stats.totalPayout),
        lastOutcome: String(stats.lastOutcome || "").slice(0, 24),
        lastMultiplier: Math.max(0, Number(stats.lastMultiplier) || 0),
        lastSlotsText: String(stats.lastSlotsText || "").slice(0, 220),
        lastSlotsSummary: String(stats.lastSlotsSummary || "").slice(0, 220),
        lastSlotsLines: String(stats.lastSlotsLines || "").slice(0, 220),
        lastSlotsLineIds: String(stats.lastSlotsLineIds || "").slice(0, 120),
        lastPlayerName: String(stats.lastPlayerName || "").slice(0, 24),
        lastAt: toCount(stats.lastAt)
      }
    };
  }

  function getMachineByKey(tileKey) {
    const safe = String(tileKey || "");
    for (let i = 0; i < state.machines.length; i++) if (state.machines[i].tileKey === safe) return state.machines[i];
    return null;
  }

  function getSelectedMachine() { return getMachineByKey(state.selectedMachineKey) || STANDALONE_MACHINE; }
  function machineLabel(machine) { return machine ? (machine.typeName + " @ " + machine.tx + "," + machine.ty) : "Unknown"; }

  function clearSessionRefs() {
    if (state.refs.inventory && state.handlers.inventory) state.refs.inventory.off("value", state.handlers.inventory);
    state.refs.inventory = null;
    state.handlers.inventory = null;
    state.vaultRecoveryInFlight = false;
    setAutoplayActive(false);
    audioManager.stopAllLoops();
    stopSpinFx();
  }

  async function ensureDb() {
    if (state.db) return state.db;
    if (typeof dbModule.getOrInitAuthDb !== "function") throw new Error("DB module missing.");
    state.db = await dbModule.getOrInitAuthDb({
      network: state.network,
      firebaseRef: window.firebase,
      firebaseConfig: window.FIREBASE_CONFIG,
      getFirebaseApiKey: window.getFirebaseApiKey
    });
    return state.db;
  }
  function loadSavedCredentials() {
    if (typeof authStorageModule.loadCredentials === "function") return authStorageModule.loadCredentials(SAVED_AUTH_KEY);
    try {
      const raw = localStorage.getItem(SAVED_AUTH_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return { username: String(parsed && parsed.username || ""), password: String(parsed && parsed.password || "") };
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
      // ignore
    }
  }

  async function adjustWallet(delta) {
    const d = Math.floor(Number(delta) || 0);
    if (!state.refs.inventory || !state.user || d === 0) return { ok: false, reason: "not-ready" };
    const txn = await state.refs.inventory.transaction((raw) => {
      const currentObj = raw && typeof raw === "object" ? { ...raw } : {};
      const vault = toCount(currentObj.web_vault_balance);
      const nextVault = vault + d;
      if (nextVault < 0) return; // Halt transaction safely if insufficient funds.
      currentObj.web_vault_balance = nextVault;
      currentObj.web_vault_balance_backup = nextVault;
      return currentObj;
    });
    if (!txn || !txn.committed) return { ok: false, reason: d < 0 ? "not-enough" : "rejected" };

    // Refresh local state representation on success
    const wallet = toWallet(txn.snapshot && typeof txn.snapshot.val === "function" ? txn.snapshot.val() : {});
    state.walletLocks = wallet.total;
    state.webVaultLocks = wallet.vault;
    state.walletBreakdownText = walletText(wallet.byId);
    syncVaultBackupForCurrentUser(wallet.vault);
    renderSession();
    return { ok: true, total: wallet.vault };
  }

  async function depositToVault(amount) {
    const d = Math.floor(Number(amount) || 0);
    if (!state.refs.inventory || !state.user || d <= 0) return { ok: false, reason: "invalid-amount" };
    const txn = await state.refs.inventory.transaction((raw) => {
      const currentObj = raw && typeof raw === "object" ? { ...raw } : {};
      const wallet = toWallet(currentObj);
      if (wallet.total < d) return; // Not enough physical locks to deposit
      const nextTotal = wallet.total - d;
      const decomp = fromWallet(nextTotal, wallet.vault + d);
      for (let i = 0; i < LOCK_CURRENCIES.length; i++) currentObj[LOCK_CURRENCIES[i].id] = toCount(decomp[LOCK_CURRENCIES[i].id]);
      currentObj.web_vault_balance = decomp.web_vault_balance;
      currentObj.web_vault_balance_backup = decomp.web_vault_balance;
      return currentObj;
    });
    if (!txn || !txn.committed) return { ok: false, reason: "rejected" };
    const wallet = toWallet(txn.snapshot && typeof txn.snapshot.val === "function" ? txn.snapshot.val() : {});
    state.walletLocks = wallet.total;
    state.webVaultLocks = wallet.vault;
    state.walletBreakdownText = walletText(wallet.byId);
    syncVaultBackupForCurrentUser(wallet.vault);
    renderSession();
    return { ok: true, vault: wallet.vault };
  }

  async function withdrawFromVault(amount) {
    const d = Math.floor(Number(amount) || 0);
    if (!state.refs.inventory || !state.user || d <= 0) return { ok: false, reason: "invalid-amount" };
    const txn = await state.refs.inventory.transaction((raw) => {
      const currentObj = raw && typeof raw === "object" ? { ...raw } : {};
      const wallet = toWallet(currentObj);
      if (wallet.vault < d) return; // Not enough vault locks to withdraw
      const nextTotal = wallet.total + d;
      const decomp = fromWallet(nextTotal, wallet.vault - d);
      for (let i = 0; i < LOCK_CURRENCIES.length; i++) currentObj[LOCK_CURRENCIES[i].id] = toCount(decomp[LOCK_CURRENCIES[i].id]);
      currentObj.web_vault_balance = decomp.web_vault_balance;
      currentObj.web_vault_balance_backup = decomp.web_vault_balance;
      return currentObj;
    });
    if (!txn || !txn.committed) return { ok: false, reason: "rejected" };
    const wallet = toWallet(txn.snapshot && typeof txn.snapshot.val === "function" ? txn.snapshot.val() : {});
    state.walletLocks = wallet.total;
    state.webVaultLocks = wallet.vault;
    state.walletBreakdownText = walletText(wallet.byId);
    syncVaultBackupForCurrentUser(wallet.vault);
    renderSession();
    return { ok: true, vault: wallet.vault };
  }

  async function recoverMissingVaultBalance(rawInventory) {
    if (state.vaultRecoveryInFlight) return;
    if (!state.user || !state.user.accountId || !state.refs.inventory) return;
    const raw = rawInventory && typeof rawInventory === "object" ? rawInventory : {};
    const hasVault = hasVaultBalanceField(raw);
    const rawVault = toCount(raw.web_vault_balance);
    const backupField = toCount(raw.web_vault_balance_backup);
    if (hasVault && rawVault > 0) return;
    if (hasVault && backupField <= 0) return;
    const backup = hasVault
      ? backupField
      : Math.max(readVaultBackupForAccount(state.user.accountId), backupField);
    if (backup <= 0) return;
    state.vaultRecoveryInFlight = true;
    try {
      const txn = await state.refs.inventory.transaction((currentRaw) => {
        const currentObj = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
        const currentHasVault = hasVaultBalanceField(currentObj);
        const currentVault = toCount(currentObj.web_vault_balance);
        const currentBackup = toCount(currentObj.web_vault_balance_backup);
        if (currentHasVault && currentVault > 0) return currentObj;
        if (currentHasVault && currentBackup <= 0) return currentObj;
        const recoverTo = currentHasVault ? currentBackup : Math.max(backup, currentBackup);
        if (recoverTo <= 0) return currentObj;
        currentObj.web_vault_balance = recoverTo;
        currentObj.web_vault_balance_backup = recoverTo;
        return currentObj;
      });
      if (txn && txn.committed) {
        const wallet = toWallet(txn.snapshot && typeof txn.snapshot.val === "function" ? txn.snapshot.val() : {});
        state.walletLocks = wallet.total;
        state.webVaultLocks = wallet.vault;
        state.walletBreakdownText = walletText(wallet.byId);
        syncVaultBackupForCurrentUser(wallet.vault);
        renderSession();
        renderMachineStats();
        audioManager.play("wallet_recover");
      }
    } catch (_error) {
      // ignore auto-recovery failure
    } finally {
      state.vaultRecoveryInFlight = false;
    }
  }

  function getMaxBetByBank(machine) {
    if (!machine) return 0;
    // Infinite bank mode for the web UI: no cap based on owner funds
    if (INFINITE_BANK) return Number.POSITIVE_INFINITY;
    const maxPayout = Math.max(1, Math.floor(Number(machine.maxPayoutMultiplier) || 1));
    return Math.max(0, Math.floor(toCount(machine.earningsLocks) / maxPayout));
  }

  function getSpinMaxBet(machine) {
    return Number.MAX_SAFE_INTEGER;
  }

  function clampBetToMachine(machine, wager) {
    if (!machine) return 1;
    const safe = Math.floor(Number(wager) || 1);
    return Math.max(machine.minBet, safe);
  }

  function setAuthBusy(isBusy) {
    const busy = Boolean(isBusy);
    if (els.authLoginBtn instanceof HTMLButtonElement) els.authLoginBtn.disabled = busy;
    if (els.authCreateBtn instanceof HTMLButtonElement) els.authCreateBtn.disabled = busy;
    if (els.authUsername instanceof HTMLInputElement) els.authUsername.disabled = busy;
    if (els.authPassword instanceof HTMLInputElement) els.authPassword.disabled = busy;
  }

  function renderSession() {
    if (els.sessionLabel instanceof HTMLElement) {
      els.sessionLabel.textContent = state.user ? ("@" + state.user.username + " (" + state.user.accountId + ")") : "Not logged in";
    }
    renderWalletDisplay();
    if (els.userBalanceDisplay instanceof HTMLElement) {
      const unit = getActiveDisplayLockRow();
      els.userBalanceDisplay.innerHTML = "Balance: <strong>" + formatLocksByDisplayUnitHtml(state.webVaultLocks) + "</strong>";
      els.userBalanceDisplay.title = "Click to cycle lock display (WL/OL/EL/RL). Current: " + unit.short;
      els.userBalanceDisplay.style.cursor = "pointer";
    }
    if (els.logoutBtn instanceof HTMLButtonElement) els.logoutBtn.classList.toggle("hidden", !state.user);
    if (els.openVaultBtn instanceof HTMLButtonElement) els.openVaultBtn.classList.toggle("hidden", !state.user);
    renderVaultPanel();
    renderPremiumHud();
  }

  function buildRowsForRender(machine) {
    if (state.ephemeral.rows && Array.isArray(state.ephemeral.rows) && state.ephemeral.rows.length) {
      return { rows: state.ephemeral.rows, lineIds: state.ephemeral.lineIds || [], lineWins: state.ephemeral.lineWins || [] };
    }
    if (!machine) return { rows: [["?"]], lineIds: [], lineWins: [] };
    const rows = parseRows(machine.stats.lastSlotsText);
    if (rows.length) {
      const parsedLineIds = parseLineIds(machine.stats.lastSlotsLineIds);
      const parsedLines = parseLineWins(machine.stats.lastSlotsLines);
      if (!parsedLineIds.length && machine.type === "slots" && String(machine.stats.lastOutcome || "") !== "lose") {
        parsedLineIds.push(1);
        if (!parsedLines.length && machine.stats.lastSlotsSummary) {
          parsedLines.push(String(machine.stats.lastSlotsSummary));
        }
      }
      return {
        rows,
        lineIds: parsedLineIds,
        lineWins: parsedLines
      };
    }
    const fallbackRows = [];
    for (let r = 0; r < machine.rows; r++) {
      fallbackRows[r] = [];
      for (let c = 0; c < machine.reels; c++) fallbackRows[r][c] = (SYMBOL_POOL[machine.type] || SYMBOL_POOL.slots)[0] || "?";
    }
    return { rows: fallbackRows, lineIds: [], lineWins: [] };
  }

  function normalizePattern(base, cols, rows) {
    const arr = Array.isArray(base) ? base : [];
    const safeCols = Math.max(1, Math.floor(Number(cols) || 1));
    const safeRows = Math.max(1, Math.floor(Number(rows) || 1));
    const fallback = Math.max(0, Math.min(safeRows - 1, Math.floor(Number(arr[arr.length - 1]) || 0)));
    const out = [];
    for (let c = 0; c < safeCols; c++) out.push(Math.max(0, Math.min(safeRows - 1, Math.floor(Number(arr[c]) || fallback))));
    return out;
  }

  function linePattern(lineId, cols, rows, machineType) {
    const id = Math.max(1, Math.floor(Number(lineId) || 1));
    if (machineType === "slots") return normalizePattern([0, 0, 0], cols, rows);
    if (machineType === "slots_v2") {
      const lines = Array.isArray(SIX666_CONFIG.paylines) ? SIX666_CONFIG.paylines : SIX_PAYLINES;
      if (lines[id - 1]) return normalizePattern(lines[id - 1], cols, rows);
    }
    return normalizePattern(PAYLINES_5[id - 1] || PAYLINES_5[0], cols, rows);
  }

  function buildHitMask(lineIds, cols, rows, machineType) {
    const mask = {};
    const ids = Array.isArray(lineIds) ? lineIds : [];
    for (let i = 0; i < ids.length; i++) {
      const pattern = linePattern(ids[i], cols, rows, machineType);
      for (let c = 0; c < pattern.length; c++) mask[pattern[c] + "_" + c] = true;
    }
    return mask;
  }

  function renderBlackjackBoard(machine, animCtx) {
    if (!(els.slotBoard instanceof HTMLElement)) return;
    const state = machine.stats.blackjackState;
    if (!state) {
      els.slotBoard.innerHTML = "<div class='bj-table'><div class='bj-msg'>Press Deal to start</div></div>";
      return;
    }

    const renderCard = (card, hidden, animate, isSplit) => {
      const animClass = animate ? " pop-in" : "";
      // If split, maybe show cards slightly smaller or just normal? 
      // CSS handles layout, so we keep card rendering standard.
      if (hidden) return `<div class="bj-card hidden-card${animClass}"></div>`;
      return `<div class="bj-card ${card.color}${animClass}">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.suit}</span>
        <span class="rank bot">${card.rank}</span>
      </div>`;
    };

    const dealerScore = state.active ? "?" : calculateHand(state.dealerHand);

    const isDeal = animCtx === 'deal';
    const isHit = animCtx === 'hit';
    const isDealer = animCtx === 'dealer';

    const html = `
      <div class="bj-table">
        <div class="bj-hand-area">
          <div class="bj-score">Dealer: ${dealerScore}</div>
          <div class="bj-hand">
            ${state.dealerHand.map((c, i) => {
      return renderCard(c, state.active && i === 1, isDeal || (isDealer && i === state.dealerHand.length - 1));
    }).join('')}
          </div>
        </div>
        <div class="bj-msg">${state.message || ""}</div>
        <div class="bj-hand-area">
          <div class="bj-player-hands">
            ${state.hands.map((hand, hIdx) => {
      const isActive = state.active && hIdx === state.activeHandIndex;
      const score = calculateHand(hand.cards);
      const handClass = isActive ? "bj-hand active-hand" : "bj-hand";
      return `
                <div class="bj-hand-container">
                  <div class="${handClass}">
                    ${hand.cards.map((c, i) => {
        return renderCard(c, false, isDeal || (isActive && isHit && i === hand.cards.length - 1));
      }).join('')}
                  </div>
                  <div class="bj-score">${score}</div>
                  ${hand.bet > state.bet ? '<div class="tag warn" style="font-size:8px;margin-top:4px;">Doubled</div>' : ''}
                </div>`;
    }).join('')}
          </div>
        </div>
      </div>`;
    els.slotBoard.innerHTML = html;
  }

  function renderTowerBoard(machine) {
    if (!(els.slotBoard instanceof HTMLElement) || !(els.lineList instanceof HTMLElement)) return;
    const round = getTowerRoundForMachine(machine);
    const difficultyId = round ? normalizeTowerDifficultyId(round.difficultyId) : getTowerDifficultyForMachine(machine);
    const difficulty = getTowerDifficultyConfig(difficultyId);
    const floors = round ? Math.max(1, Math.floor(Number(round.floors) || TOWER_CONFIG.floors)) : TOWER_CONFIG.floors;
    const cols = round ? Math.max(1, Math.floor(Number(round.cols) || TOWER_CONFIG.cols)) : TOWER_CONFIG.cols;

    els.slotBoard.classList.add("tower-board");
    els.slotBoard.style.setProperty("--tower-cols", String(cols));
    els.slotBoard.style.setProperty("--tower-rows", String(floors));

    let html = "";
    for (let floor = floors - 1; floor >= 0; floor--) {
      const pick = round && Array.isArray(round.picksByFloor) ? round.picksByFloor[floor] : undefined;
      const safeCols = round && Array.isArray(round.safeColsByFloor) && Array.isArray(round.safeColsByFloor[floor]) ? round.safeColsByFloor[floor] : [];
      for (let col = 0; col < cols; col++) {
        let cls = "tower-cell locked";
        let text = "?";
        const isPicked = pick === col;
        const isSafe = safeCols.indexOf(col) >= 0;
        if (round && round.active) {
          if (floor < round.currentFloor && isPicked) {
            cls = "tower-cell safe";
            text = "SAFE";
          } else if (floor === round.currentFloor) {
            cls = "tower-cell active";
            text = "PICK";
          }
        } else if (round && round.ended) {
          if (isPicked && round.result === "lose") {
            cls = "tower-cell trap";
            text = "TRAP";
          } else if (isPicked && isSafe) {
            cls = "tower-cell safe";
            text = "SAFE";
          } else if (round.revealAll) {
            if (isSafe) {
              cls = "tower-cell revealed-safe";
              text = "SAFE";
            } else {
              cls = "tower-cell revealed-trap";
              text = "TRAP";
            }
          }
        }
        html += "<div class=\"" + cls + "\" data-floor=\"" + floor + "\" data-col=\"" + col + "\">" + text + "</div>";
      }
    }
    els.slotBoard.innerHTML = html;

    const rows = [];
    rows.push("<span class=\"line-badge\">Tower " + escapeHtml(difficulty.label) + "</span>");
    rows.push("<span class=\"line-badge\">Traps: " + difficulty.traps + "/" + cols + "</span>");

    if (!round) {
      rows.push("<span class=\"line-badge muted\">Start run, pick one tile per floor, cash out anytime.</span>");
      els.lineList.innerHTML = rows.join("");
      return;
    }

    const cleared = towerClearedFloors(round);
    const currentMult = towerCurrentMultiplier(round);
    const nextMult = towerNextMultiplier(round);
    rows.push("<span class=\"line-badge\">Progress: " + cleared + "/" + round.floors + "</span>");
    rows.push("<span class=\"line-badge\">Now: " + formatMultiplier(currentMult) + "</span>");

    if (round.active) {
      rows.push("<span class=\"line-badge\">Next: " + formatMultiplier(nextMult) + "</span>");
      if (cleared > 0) rows.push("<span class=\"line-badge hot\">Cashout: " + formatTowerPayout(round, currentMult) + " WL</span>");
    } else if (round.result === "lose") {
      rows.push("<span class=\"line-badge hot\">Trap hit. Lost " + round.bet + " WL</span>");
    } else {
      rows.push("<span class=\"line-badge hot\">Paid: " + Math.max(0, Math.floor(Number(round.payout) || 0)) + " WL</span>");
    }

    els.lineList.innerHTML = rows.slice(0, 8).join("");
  }

  function renderMinesBoard(machine) {
    if (!(els.slotBoard instanceof HTMLElement) || !(els.lineList instanceof HTMLElement)) return;
    const round = getMinesRoundForMachine(machine);
    const rows = MINES_CONFIG.rows;
    const cols = MINES_CONFIG.cols;
    const totalTiles = MINES_CONFIG.totalTiles;
    const minesCount = round ? round.minesCount : getMinesCountForMachine(machine);

    els.slotBoard.classList.add("mines-board");
    els.slotBoard.style.setProperty("--mines-cols", String(cols));
    els.slotBoard.style.setProperty("--mines-rows", String(rows));

    let html = "";
    for (let idx = 0; idx < totalTiles; idx++) {
      let cls = "mines-cell hidden";
      let text = "?";

      if (!round) {
        cls = "mines-cell active";
        text = "PICK";
      } else {
        const isMine = Boolean(round.mineMap[idx]);
        const isSafePicked = Boolean(round.revealedSafeMap[idx]);
        if (round.active) {
          if (isSafePicked) {
            cls = "mines-cell safe";
            text = "SAFE";
          } else {
            cls = "mines-cell active";
            text = "PICK";
          }
        } else if (round.ended) {
          if (isSafePicked) {
            cls = "mines-cell safe";
            text = "SAFE";
          } else if (round.revealAll && isMine) {
            cls = idx === round.pickedMineIndex ? "mines-cell mine" : "mines-cell revealed-mine";
            text = "MINE";
          } else if (round.revealAll) {
            cls = "mines-cell revealed-safe";
            text = "SAFE";
          }
        }
      }

      html += "<div class=\"" + cls + "\" data-index=\"" + idx + "\">" + text + "</div>";
    }
    els.slotBoard.innerHTML = html;

    const badges = [];
    badges.push("<span class=\"line-badge\">Mines: " + minesCount + "</span>");
    badges.push("<span class=\"line-badge\">Edge: " + Math.round((Number(MINES_CONFIG.houseEdge) || 0) * 10000) / 100 + "%</span>");

    if (!round) {
      badges.push("<span class=\"line-badge muted\">Pick mine count, press Start Run, then open safe tiles.</span>");
      badges.push("<span class=\"line-badge muted\">Cash out anytime after at least one safe pick.</span>");
      els.lineList.innerHTML = badges.join("");
      return;
    }

    const safeClicks = minesSafeClicks(round);
    const currentMult = minesCurrentMultiplier(round);
    const nextMult = minesNextMultiplier(round);
    const remainingTiles = Math.max(0, round.totalTiles - safeClicks);
    const remainingSafe = Math.max(0, round.safeTotal - safeClicks);
    const nextChance = remainingTiles > 0 ? (remainingSafe / remainingTiles) : 0;

    badges.push("<span class=\"line-badge\">Safe: " + safeClicks + "/" + round.safeTotal + "</span>");
    badges.push("<span class=\"line-badge\">Current: " + formatMultiplier(currentMult) + "</span>");

    if (round.active) {
      badges.push("<span class=\"line-badge hot\">Next: " + formatMultiplier(nextMult) + "</span>");
      badges.push("<span class=\"line-badge\">Next Safe Chance: " + Math.max(0, Math.min(100, Math.round(nextChance * 10000) / 100)) + "%</span>");
      if (safeClicks > 0) badges.push("<span class=\"line-badge hot\">Cashout: " + minesCashoutPayout(round) + " WL</span>");
    } else if (round.result === "lose") {
      badges.push("<span class=\"line-badge hot\">Mine hit. Lost " + round.bet + " WL</span>");
    } else {
      badges.push("<span class=\"line-badge hot\">Paid: " + Math.max(0, Math.floor(Number(round.payout) || 0)) + " WL</span>");
    }

    els.lineList.innerHTML = badges.slice(0, 24).join("");
  }

  function renderBoard(animCtx) {
    if (!(els.slotBoard instanceof HTMLElement) || !(els.slotOverlay instanceof SVGElement) || !(els.lineList instanceof HTMLElement)) return;
    const machine = getSelectedMachine();

    // Clear overlay
    els.slotOverlay.innerHTML = "";

    if (machine.type === 'blackjack') {
      if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.add('blackjack-mode');
      els.slotBoard.classList.remove("tower-board");
      els.slotBoard.classList.remove("mines-board");
      renderBlackjackBoard(machine, animCtx);
      els.lineList.innerHTML = ""; // No paylines for BJ
      return;
    } else if (machine.type === "tower") {
      if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.remove('blackjack-mode');
      els.slotBoard.classList.remove("mines-board");
      renderTowerBoard(machine);
      return;
    } else if (machine.type === "mines") {
      if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.remove('blackjack-mode');
      els.slotBoard.classList.remove("tower-board");
      renderMinesBoard(machine);
      return;
    } else {
      if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.remove('blackjack-mode');
      els.slotBoard.classList.remove("tower-board");
      els.slotBoard.classList.remove("mines-board");
    }

    const model = buildRowsForRender(machine);
    const rows = Array.isArray(model.rows) ? model.rows : [];
    const rowCount = Math.max(1, rows.length);
    let colCount = 1;
    for (let r = 0; r < rows.length; r++) colCount = Math.max(colCount, (rows[r] && rows[r].length) || 0);

    const safeMachineType = machine ? machine.type : "slots";
    const hitMask = buildHitMask(model.lineIds, colCount, rowCount, safeMachineType);
    const markedCells = Array.isArray(state.ephemeral.markedCells) ? state.ephemeral.markedCells : [];
    const markedMask = {};
    for (const m of markedCells) markedMask[m] = true;
    const cellMeta = state.ephemeral.cellMeta && typeof state.ephemeral.cellMeta === "object" ? state.ephemeral.cellMeta : {};
    const effectCells = state.ephemeral.effectCells && typeof state.ephemeral.effectCells === "object" ? state.ephemeral.effectCells : {};
    const upgradeFlashes = state.ephemeral.upgradeFlashes && typeof state.ephemeral.upgradeFlashes === "object" ? state.ephemeral.upgradeFlashes : {};

    let boardHtml = "";
    for (let c = 0; c < colCount; c++) {
      boardHtml += "<div class=\"reel\" style=\"--rows:" + rowCount + ";\">";
      for (let r = 0; r < rowCount; r++) {
        const key = r + "_" + c;
        const tok = normalizeToken(rows[r] && rows[r][c] ? rows[r][c] : "?");
        const cls = symbolClass(tok);
        const tokCls = symbolTokenClass(tok);
        const hit = hitMask[key] ? " hit" : "";
        const markedCls = markedMask[key] ? " marked" : "";
        const meta = cellMeta[key] && typeof cellMeta[key] === "object" ? cellMeta[key] : {};
        const lockedCls = meta.locked ? " locked-flag" : "";
        const effect = String(effectCells[key] || "").trim().toLowerCase();
        const effectCls = effect ? (" effect-" + effect) : "";
        let badgeHtml = "";
        if (meta.wildMult && meta.wildMult > 1) badgeHtml += "<span class=\"cell-badge wild\">x" + meta.wildMult + "</span>";
        if (meta.cellMult && meta.cellMult > 1) badgeHtml += "<span class=\"cell-badge mult\">x" + meta.cellMult + "</span>";
        if (meta.locked) badgeHtml += "<span class=\"cell-badge lock\">L</span>";
        if (badgeHtml) badgeHtml = "<span class=\"cell-badges\">" + badgeHtml + "</span>";
        const flash = String(upgradeFlashes[key] || "").trim();
        const flashHtml = flash ? ("<span class=\"cell-upgrade-flash\">" + escapeHtml(flash) + "</span>") : "";
        boardHtml += "<div class=\"cell " + cls + (tokCls ? (" " + tokCls) : "") + hit + markedCls + lockedCls + effectCls + "\" data-col=\"" + c + "\" data-row=\"" + r + "\"><span class=\"icon\">" + escapeHtml(symbolIcon(tok)) + "</span><span class=\"txt\">" + escapeHtml(symbolLabel(tok)) + "</span>" + badgeHtml + flashHtml + "</div>";
      }
      boardHtml += "</div>";
    }
    els.slotBoard.style.setProperty("--cols", String(colCount));
    els.slotBoard.innerHTML = boardHtml;

    // --- draw paylines using real DOM cell centers (pixel-perfect) ---
    const wrap = els.boardWrap;
    if (wrap instanceof HTMLElement) {
      const wrapRect = wrap.getBoundingClientRect();

      // Make SVG coordinate system match boardWrap pixels
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      els.slotOverlay.setAttribute("viewBox", `0 0 ${w} ${h}`);
      els.slotOverlay.setAttribute("width", String(w));
      els.slotOverlay.setAttribute("height", String(h));

      const getCellCenter = (col, row) => {
        const el = wrap.querySelector(`.cell[data-col="${col}"][data-row="${row}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: (r.left - wrapRect.left) + r.width / 2,
          y: (r.top - wrapRect.top) + r.height / 2
        };
      };

      for (let i = 0; i < model.lineIds.length; i++) {
        const pattern = linePattern(model.lineIds[i], colCount, rowCount, safeMachineType);

        const pts = [];
        for (let c = 0; c < pattern.length; c++) {
          const p = getCellCenter(c, pattern[c]);
          if (p) pts.push(p);
        }
        if (pts.length < 2) continue;

        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        poly.setAttribute("points", pts.map(p => `${p.x},${p.y}`).join(" "));
        els.slotOverlay.appendChild(poly);
      }
    }

    const lineWins = model.lineWins.length ? model.lineWins : (model.lineIds.length ? model.lineIds.map((id) => "Line " + id) : []);
    if (els.boardWrap instanceof HTMLElement) {
      els.boardWrap.classList.toggle("has-win", lineWins.length > 0);
    }
    if (lineWins.length) {
      els.lineList.innerHTML = lineWins.slice(0, 18).map((line, index) => "<span class=\"line-badge hot\">#" + (index + 1) + " " + escapeHtml(line) + "</span>").join("");
    } else {
      els.lineList.innerHTML = "<span class=\"line-badge muted\">No winning lines in the latest spin.</span>";
    }
  }

  function randomRowsForMachine(machine, tick) {
    const m = machine || MACHINE_DEFS.slots;
    const rows = Math.max(1, Math.floor(Number(m.rows) || 1));
    const cols = Math.max(1, Math.floor(Number(m.reels) || 3));
    const pool = SYMBOL_POOL[m.type] || SYMBOL_POOL.slots;
    const out = [];
    for (let r = 0; r < rows; r++) {
      out[r] = [];
      for (let c = 0; c < cols; c++) {
        const idx = Math.floor(Math.abs(Math.sin((tick + 1) * (r + 2) * (c + 4))) * pool.length) % pool.length;
        out[r][c] = pool[idx] || "?";
      }
    }
    return out;
  }

  function startSpinFx(machine, isBonus, betForDisplay) {
    if (els.lastWinLabel) els.lastWinLabel.classList.add("hidden");
    stopSpinFx();
    state.spinBusy = true;
    state.quickStopRequested = false;
    winPresenter.clearWinTier();
    winPresenter.hideBanner();
    winPresenter.setCurrentWinValue(0, Math.max(1, Math.floor(Number(betForDisplay) || Number(state.currentBetValue) || 1)));
    audioManager.play("spin_start");
    if (!state.bonusFlow.active) {
      setBonusPhase(BONUS_PHASES.BASE_SPINNING);
      showBonusHud(false);
    }
    // Clear previous spin win-lines immediately when starting a new spin/buy bonus.
    state.ephemeral.lineIds = [];
    state.ephemeral.lineWins = [isBonus ? "Buying bonus..." : "Spinning..."];
    if (els.slotOverlay instanceof SVGElement) els.slotOverlay.innerHTML = "";
    if (els.lineList instanceof HTMLElement) {
      els.lineList.innerHTML = "<span class=\"line-badge muted\">" + (isBonus ? "Buying bonus..." : "Spinning...") + "</span>";
    }
    state.ephemeral.cellMeta = {};
    state.ephemeral.effectCells = {};
    state.ephemeral.upgradeFlashes = {};
    if (els.boardWrap instanceof HTMLElement) {
      els.boardWrap.classList.add("spinning");
      // Remove stopped class from all cells for next spin
      const cells = els.boardWrap.querySelectorAll('.cell');
      cells.forEach(c => c.classList.remove('stopped', 'wheel-anim', 'hit'));
    }
    if (els.spinBtn instanceof HTMLButtonElement) {
      els.spinBtn.disabled = false;
      els.spinBtn.textContent = "Quick Stop";
      els.spinBtn.classList.add("spinning");
    }
    if (els.buyBonusBtn instanceof HTMLButtonElement) els.buyBonusBtn.disabled = true;
    let tick = 0;

    // We maintain visual sync by occasionally re-rendering random rows for blurring effects
    state.spinTimer = window.setInterval(() => {
      tick += 1;
      // Only randomize rows that are NOT stopped in the logic handled below
      if (!state.ephemeral.stoppedCols) {
        state.ephemeral.rows = randomRowsForMachine(machine, tick);
        state.ephemeral.lineIds = [];
        state.ephemeral.lineWins = [isBonus ? "BONUS BUY..." : "Spinning..."];
        renderBoard();
      }
    }, 90);
  }

  function stopSpinFx() {
    if (state.spinTimer) {
      window.clearInterval(state.spinTimer);
      state.spinTimer = 0;
    }
    state.spinBusy = false;
    state.ephemeral.stoppedCols = null;
    reelAnimator.stop();
    audioManager.play("spin_end");
    if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.remove("spinning");
    if (els.spinBtn instanceof HTMLButtonElement) {
      els.spinBtn.textContent = "Spin";
      els.spinBtn.classList.remove("spinning");
    }
    if (!state.bonusFlow.active) setBonusPhase(BONUS_PHASES.BASE_IDLE);
    renderPremiumHud();
  }

  function bonusAnimTimings(machineType) {
    const type = String(machineType || "").trim().toLowerCase();
    if (type === "slots_v2") {
      const turboEnabled = Boolean(window.GT_SETTINGS && window.GT_SETTINGS.SLOTS_TURBO);
      const scale = turboEnabled
        ? Math.max(0.25, Math.min(1, Number(SIX666_CONFIG.animation && SIX666_CONFIG.animation.turboScale) || 0.62))
        : 1;
      return {
        intro: Math.floor(760 * scale),
        spin: Math.floor(380 * scale),
        wheel: Math.floor(860 * scale),
        reveal: Math.floor(420 * scale),
        fillFx: Math.floor(420 * scale),
        fillSettle: Math.floor(220 * scale),
        between: Math.floor(260 * scale)
      };
    }
    if (type === "snoop_dogg_dollars") {
      return { intro: 520, spin: 420, reveal: 700, fillFx: 420, fillSettle: 220, between: 300 };
    }
    return { intro: 1500, spin: 650, reveal: 1200, fillFx: 1000, fillSettle: 500, between: 600 };
  }

  function countLockedFromCellMeta(metaMap) {
    const meta = metaMap && typeof metaMap === "object" ? metaMap : {};
    const keys = Object.keys(meta);
    let wilds = 0;
    let multis = 0;
    for (let i = 0; i < keys.length; i++) {
      const row = meta[keys[i]] && typeof meta[keys[i]] === "object" ? meta[keys[i]] : {};
      if (Math.max(0, Math.floor(Number(row.wildMult) || 0)) > 0) wilds += 1;
      if (Math.max(0, Math.floor(Number(row.cellMult) || 0)) > 1) multis += 1;
    }
    return { wilds, multis };
  }

  async function runSnoopBonusIntroFrame(machine, frame) {
    const intro = frame && frame.intro && typeof frame.intro === "object" ? frame.intro : {};
    const awarded = Math.max(0, Math.floor(Number(intro.awardedSpins) || 0));
    const beforeRows = Array.isArray(frame && frame.reels) ? frame.reels : [];
    const beforeMeta = sanitizeCellMeta(frame && frame.cellMeta);
    const afterRows = Array.isArray(intro.afterReels) ? intro.afterReels : beforeRows;
    const afterMeta = sanitizeCellMeta(intro.afterCellMeta);
    const scatterKeys = Array.isArray(intro.scatterKeys) ? intro.scatterKeys : [];
    const transformations = Array.isArray(intro.transformations) ? intro.transformations : [];

    setBonusPhase(BONUS_PHASES.BONUS_INTRO);
    state.bonusFlow.active = true;
    state.bonusFlow.machineType = machine ? machine.type : "";
    showBonusHud(true);
    updateBonusHud({
      mode: "FREE SPINS",
      spinsLeft: awarded,
      bonusWin: 0,
      currentSpinWin: 0,
      stickyWilds: countLockedFromCellMeta(beforeMeta).wilds,
      multiplierCells: countLockedFromCellMeta(beforeMeta).multis
    });

    state.ephemeral.rows = rowsFromResult(beforeRows, machine.type);
    state.ephemeral.lineIds = [];
    state.ephemeral.lineWins = [String(frame && frame.lineText || "FREE SPINS")];
    state.ephemeral.markedCells = scatterKeys.slice(0, 256);
    state.ephemeral.cellMeta = beforeMeta;
    state.ephemeral.effectCells = {};
    for (let i = 0; i < scatterKeys.length; i++) {
      const key = String(scatterKeys[i] || "");
      if (key) state.ephemeral.effectCells[key] = "scatter";
    }
    state.ephemeral.upgradeFlashes = {};
    renderBoard();

    setBoardDimmed(true);
    await showBonusOverlay(
      "FREE SPINS",
      "You won " + awarded + " Free Spins",
      "Trigger scatters are transforming into Sticky Wilds or x10 cells.",
      false
    );
    await sleep(420);

    for (let i = 0; i < transformations.length; i++) {
      const tr = transformations[i] && typeof transformations[i] === "object" ? transformations[i] : {};
      const key = String(tr.key || "");
      if (!key) continue;
      state.ephemeral.effectCells[key] = "transform";
      renderBoard();
      await sleep(180);
      state.ephemeral.effectCells[key] = tr.to === "wild" ? "wild-up" : "weed";
      if (tr.to === "wild") state.ephemeral.upgradeFlashes[key] = "+10";
      renderBoard();
      await sleep(220);
    }

    state.ephemeral.rows = rowsFromResult(afterRows, machine.type);
    state.ephemeral.markedCells = [];
    state.ephemeral.cellMeta = afterMeta;
    state.ephemeral.effectCells = {};
    state.ephemeral.upgradeFlashes = {};
    renderBoard();

    const counts = countLockedFromCellMeta(afterMeta);
    updateBonusHud({
      mode: "FREE SPINS",
      spinsLeft: awarded,
      bonusWin: 0,
      currentSpinWin: 0,
      stickyWilds: counts.wilds,
      multiplierCells: counts.multis
    });
    await sleep(260);
    await hideBonusOverlay();
    setBoardDimmed(false);
  }

  function sixHudRuleText(raw) {
    const row = raw && typeof raw === "object" ? raw : {};
    const blue = row.blueAllowed ? "B:on" : "B:off";
    const red = row.redAllowed ? "R:on" : "R:off";
    const lock = row.guaranteedRed ? "Red+" : "Red-";
    return blue + " " + red + " " + lock;
  }

  function updateSixBonusHud(hud, defaults) {
    const row = hud && typeof hud === "object" ? hud : {};
    const fallback = defaults && typeof defaults === "object" ? defaults : {};
    const rules = row.wheelRules && typeof row.wheelRules === "object"
      ? row.wheelRules
      : (fallback.wheelRules && typeof fallback.wheelRules === "object" ? fallback.wheelRules : {});
    const activeMultiplier = Math.max(1, Number(row.activeMultiplier) || Number(fallback.activeMultiplier) || 1);
    updateBonusHud({
      mode: String(row.mode || fallback.mode || "FREE SPINS"),
      spinsLeft: Math.max(0, Math.floor(Number(row.spinsLeft) || Number(fallback.spinsLeft) || 0)),
      bonusWin: Math.max(0, Math.floor(Number(row.bonusWin) || Number(fallback.bonusWin) || 0)),
      currentSpinWin: Math.max(0, Math.floor(Number(row.currentSpinWin) || Number(fallback.currentSpinWin) || 0)),
      activeMultiplier,
      stickyLabel: "Multi: x" + sixFormatMultiplier(activeMultiplier),
      multiLabel: "Wheels: " + sixHudRuleText(rules)
    });
  }

  async function runSlotsV2BonusIntroFrame(machine, frame, bonusFx) {
    const row = frame && typeof frame === "object" ? frame : {};
    const awarded = Math.max(0, Math.floor(Number(row.awardedSpins) || 0));
    const tierTitle = String(row.tierTitle || "FREE SPINS");
    const tierSubtitle = String(row.tierSubtitle || "Tier");
    const triggerKeys = Array.isArray(row.triggerWheelKeys) ? row.triggerWheelKeys.map((v) => String(v || "")).filter(Boolean) : [];
    const wheelRules = row.wheelRules && typeof row.wheelRules === "object" ? row.wheelRules : {};

    setBonusPhase(BONUS_PHASES.BONUS_INTRO);
    state.bonusFlow.active = true;
    state.bonusFlow.machineType = machine ? machine.type : "";
    showBonusHud(true);
    updateSixBonusHud({
      mode: tierTitle,
      spinsLeft: awarded,
      bonusWin: 0,
      currentSpinWin: 0,
      activeMultiplier: 1,
      wheelRules
    });

    state.ephemeral.rows = rowsFromResult(row.reels, machine.type);
    state.ephemeral.lineIds = [];
    state.ephemeral.lineWins = [String(row.lineText || (tierSubtitle + " activated"))];
    state.ephemeral.markedCells = triggerKeys.slice(0, 24);
    state.ephemeral.cellMeta = {};
    state.ephemeral.effectCells = {};
    state.ephemeral.upgradeFlashes = {};
    for (let i = 0; i < triggerKeys.length; i++) state.ephemeral.effectCells[triggerKeys[i]] = "wheel-highlight";
    renderBoard();

    setBoardDimmed(true);
    await showBonusOverlay(
      tierTitle,
      awarded + " FREE SPINS",
      tierSubtitle + " | " + sixHudRuleText(wheelRules),
      false
    );
    await sleep(Math.max(220, Math.floor(Number(bonusFx.intro) || 720)));

    for (let i = 0; i < triggerKeys.length; i++) {
      const key = triggerKeys[i];
      state.ephemeral.effectCells[key] = "wheel-spin";
      state.ephemeral.upgradeFlashes[key] = "6";
      renderBoard();
      await sleep(200);
      state.ephemeral.effectCells[key] = "wheel-hit";
      renderBoard();
      await sleep(160);
      delete state.ephemeral.upgradeFlashes[key];
    }
    state.ephemeral.effectCells = {};
    state.ephemeral.upgradeFlashes = {};
    state.ephemeral.markedCells = [];
    renderBoard();
    await hideBonusOverlay();
    setBoardDimmed(false);
  }

  function clearBonusFrameFx() {
    if (!(els.boardWrap instanceof HTMLElement)) return;
    els.boardWrap.classList.remove("bonus-frame-glow", "bonus-frame-hit", "bonus-frame-epic");
  }

  function pulseBonusFrameFx(level) {
    if (!(els.boardWrap instanceof HTMLElement)) return;
    clearBonusFrameFx();
    if (level === "epic") {
      els.boardWrap.classList.add("bonus-frame-epic");
      return;
    }
    if (level === "hit") {
      els.boardWrap.classList.add("bonus-frame-hit");
      return;
    }
    els.boardWrap.classList.add("bonus-frame-glow");
  }

  async function animateBonusHudTo(machineType, targetSpin, targetTotal, leftSpins, delayMs) {
    const steps = Math.max(2, Math.min(10, Math.floor((Number(delayMs) || 240) / 45)));
    const startSpin = Math.max(0, Math.floor(Number(state.bonusFlow.currentSpinWin) || 0));
    const startTotal = Math.max(0, Math.floor(Number(state.bonusFlow.bonusWin) || 0));
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      const eased = easeOutCubic(p);
      updateBonusHud({
        mode: "FREE SPINS",
        spinsLeft: Math.max(0, Math.floor(Number(leftSpins) || 0)),
        bonusWin: Math.floor(startTotal + ((targetTotal - startTotal) * eased)),
        currentSpinWin: Math.floor(startSpin + ((targetSpin - startSpin) * eased)),
        stickyWilds: state.bonusFlow.stickyWilds,
        multiplierCells: state.bonusFlow.multiplierCells,
        spinsTotal: state.bonusFlow.spinsTotal,
        spinsPlayed: state.bonusFlow.spinsPlayed,
        panelTitle: state.bonusFlow.panelTitle || "FREE SPINS"
      });
      if (machineType === "slots_v2") {
        // slots_v2 has dedicated HUD function; this keeps the generic animation additive
        updateSixBonusHud({
          mode: "FREE SPINS",
          spinsLeft: Math.max(0, Math.floor(Number(leftSpins) || 0)),
          bonusWin: Math.floor(startTotal + ((targetTotal - startTotal) * eased)),
          currentSpinWin: Math.floor(startSpin + ((targetSpin - startSpin) * eased)),
          activeMultiplier: Math.max(1, Number(state.bonusFlow.activeMultiplier) || 1)
        });
      }
      await sleep(Math.max(12, Math.floor((Number(delayMs) || 240) / steps)));
    }
  }

  async function runGenericBonusIntroFrame(machine, frame) {
    const row = frame && typeof frame === "object" ? frame : {};
    const awarded = Math.max(0, Math.floor(Number(row.awardedSpins) || Number(row.freeSpinsLeft) || 0));
    state.bonusFlow.active = true;
    state.bonusFlow.machineType = machine ? machine.type : "";
    state.bonusFlow.spinsTotal = Math.max(0, awarded);
    state.bonusFlow.spinsPlayed = 0;
    state.bonusFlow.panelTitle = "FREE SPINS";
    setBonusPhase(BONUS_PHASES.BONUS_INTRO);
    setBoardDimmed(true);
    showBonusHud(true);
    showBonusSpinPanel(true);
    updateBonusSpinPanel({ title: "FREE SPINS", total: Math.max(1, awarded), played: 0, totalWin: 0 });
    updateBonusHud({
      mode: "FEATURE",
      spinsLeft: awarded,
      bonusWin: 0,
      currentSpinWin: 0,
      stickyWilds: 0,
      multiplierCells: 0,
      spinsTotal: Math.max(0, awarded),
      spinsPlayed: 0,
      panelTitle: "FREE SPINS"
    });
    audioManager.play("bonus_intro");
    await showBonusOverlay(
      String(machine && machine.typeName ? machine.typeName : "Bonus Feature"),
      awarded > 0 ? ("Feature started: " + awarded + " bonus spins") : "Feature activated",
      String(row.lineText || "Bonus sequence"),
      false
    );
    pulseBonusFrameFx("glow");
    spawnParticles("win");
    await sleep(620);
    clearBonusFrameFx();
    await hideBonusOverlay();
    setBoardDimmed(false);
  }

  async function runBonusPlayback(machine, bonusFrames, betValue) {
    const frames = Array.isArray(bonusFrames) ? bonusFrames : [];
    if (!frames.length) return { bonusTotal: 0, biggestSpinWin: 0, biggestCascadeWin: 0, countedWin: 0 };
    const safeBet = Math.max(1, Math.floor(Number(betValue) || 1));
    const bonusFx = bonusAnimTimings(machine.type);
    const isSnoop = machine.type === "snoop_dogg_dollars";
    const isSix = machine.type === "slots_v2";
    const showHud = true;
    const totalSpinFrames = frames.reduce((sum, row) => {
      const t = String(row && row.frameType || "bonus_spin").trim().toLowerCase();
      return sum + (t === "bonus_spin" ? 1 : 0);
    }, 0);
    let bonusTotal = 0;
    let biggestSpinWin = 0;
    let biggestCascadeWin = 0;
    let countedWin = 0;
    let resolvedSpinCount = 0;
    state.bonusFlow.active = true;
    state.bonusFlow.spinsTotal = Math.max(1, totalSpinFrames);
    state.bonusFlow.spinsPlayed = 0;
    state.bonusFlow.panelTitle = "FREE SPINS";
    setBonusPhase(BONUS_PHASES.BONUS_SPINNING);
    if (els.stage instanceof HTMLElement) els.stage.classList.add("bonus-live");
    audioManager.play("bonus_intro");
    audioManager.play("bonus_loop_start");
    showBonusHud(showHud);
    showBonusSpinPanel(showHud);
    if (showHud) updateBonusSpinPanel({ title: "FREE SPINS", total: Math.max(1, totalSpinFrames), played: 0, totalWin: 0 });
    const firstType = String(frames[0] && frames[0].frameType || "").trim().toLowerCase();
    await sleep(firstType === "bonus_intro" ? Math.min(180, bonusFx.intro) : bonusFx.intro);
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i] && typeof frames[i] === "object" ? frames[i] : {};
      const frameType = String(frame.frameType || "bonus_spin").trim().toLowerCase();
      if (frameType === "bonus_intro" && isSnoop) {
        await runSnoopBonusIntroFrame(machine, frame);
        continue;
      }
      if (frameType === "bonus_intro" && isSix) {
        await runSlotsV2BonusIntroFrame(machine, frame, bonusFx);
        continue;
      }
      if (frameType === "bonus_intro") {
        await runGenericBonusIntroFrame(machine, frame);
        continue;
      }
      if (frameType === "bonus_end") {
        const summary = frame.summary && typeof frame.summary === "object" ? frame.summary : {};
        bonusTotal = Math.max(bonusTotal, Math.max(0, Math.floor(Number(summary.bonusWin) || 0)));
        biggestCascadeWin = Math.max(biggestCascadeWin, Math.max(0, Math.floor(Number(summary.biggestCascadeWin) || 0)));
        if (showHud) {
          updateBonusSpinPanel({
            title: "FREE SPINS",
            total: Math.max(1, totalSpinFrames),
            played: Math.max(0, resolvedSpinCount),
            totalWin: bonusTotal
          });
        }
        continue;
      }

      setBonusPhase(BONUS_PHASES.BONUS_SPINNING);
      resolvedSpinCount += 1;
      state.bonusFlow.spinsPlayed = resolvedSpinCount;
      state.ephemeral.stoppedCols = 0;
      if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.add("spinning");
      if (!isSix) showBonusBanner("Spin " + resolvedSpinCount + " / " + Math.max(1, totalSpinFrames));
      if (showHud) {
        updateBonusSpinPanel({
          title: "FREE SPINS",
          total: Math.max(1, totalSpinFrames),
          played: resolvedSpinCount,
          totalWin: bonusTotal
        });
      }
      pulseBonusFrameFx("glow");
      audioManager.play("bonus_tick");
      renderBoard();
      await sleep(bonusFx.spin);
      if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.remove("spinning");
      state.ephemeral.stoppedCols = machine.reels;

      const frameFinalRows = rowsFromResult(frame.reels, machine.type);
      const frameTumbleFrames = extractTumbleFrames(machine.type, { tumbleFrames: frame.tumbleFrames });
      const frameStartRows = resolveSpinStartRows(machine.type, frame, frameTumbleFrames, frameFinalRows);
      if (frameTumbleFrames.length) {
        state.ephemeral.rows = frameStartRows;
        state.ephemeral.lineIds = [];
        state.ephemeral.lineWins = [String(frame.lineText || "Tumble sequence")];
        state.ephemeral.markedCells = [];
        state.ephemeral.cellMeta = sanitizeCellMeta(frame.cellMeta);
        state.ephemeral.effectCells = {};
        state.ephemeral.upgradeFlashes = {};
        renderBoard();
      }
      applyFrameToEphemeral(frame, machine.type);
      const sixLineIds = isSix ? state.ephemeral.lineIds.slice() : [];
      const sixLineWins = isSix ? state.ephemeral.lineWins.slice() : [];
      if (isSix) {
        state.ephemeral.lineIds = [];
        state.ephemeral.lineWins = [String(frame.lineText || "Resolving Wicked Wheels...")];
      }
      renderBoard();
      if (isSix) {
        const wheelEvents = Array.isArray(frame.wheelEvents) ? frame.wheelEvents : [];
        for (let w = 0; w < wheelEvents.length; w++) {
          const ev = wheelEvents[w] && typeof wheelEvents[w] === "object" ? wheelEvents[w] : {};
          const key = String(ev.key || "");
          if (!key) continue;
          setBonusPhase(BONUS_PHASES.BONUS_RESOLVING);
          state.ephemeral.effectCells[key] = "wheel-spin";
          state.ephemeral.upgradeFlashes[key] = String(ev.resultLabel || "").trim() || "x";
          renderBoard();
          showBonusBanner((ev.color === "red" ? "Red" : "Blue") + " Wheel: " + (ev.resultLabel || ""));
          safeVibrate(ev.color === "red" ? 12 : 8);
          updateSixBonusHud({
            mode: frame.hud && frame.hud.mode ? frame.hud.mode : "FREE SPINS",
            spinsLeft: Math.max(0, Math.floor(Number(frame.hud && frame.hud.spinsLeft) || 0)),
            bonusWin: Math.max(0, Math.floor(Number(frame.hud && frame.hud.bonusWin) || bonusTotal)),
            currentSpinWin: Math.max(0, Math.floor(Number(frame.hud && frame.hud.currentSpinWin) || 0)),
            activeMultiplier: Math.max(1, Number(ev.afterMultiplier) || 1),
            wheelRules: frame.hud && frame.hud.wheelRules ? frame.hud.wheelRules : {}
          });
          await sleep(Math.max(240, Math.floor(Number(bonusFx.wheel) || 760)));
          state.ephemeral.effectCells[key] = "wheel-hit";
          renderBoard();
          await sleep(120);
          delete state.ephemeral.upgradeFlashes[key];
        }
        state.ephemeral.lineIds = sixLineIds.slice(0, 24);
        state.ephemeral.lineWins = sixLineWins.length ? sixLineWins.slice(0, 18) : [String(frame.lineText || "Spin Result")];
        if (els.boardWrap instanceof HTMLElement && state.ephemeral.lineIds.length) els.boardWrap.classList.add("winfx");
        renderBoard();
      }
      setBonusPhase(BONUS_PHASES.BONUS_RESOLVING);
      await sleep(bonusFx.reveal);
      if (isSix && els.boardWrap instanceof HTMLElement) els.boardWrap.classList.remove("winfx");

      const spinPay = Math.max(0, Math.floor(Number(frame.spinPay) || 0));
      let tumbleCounted = 0;
      if (frameTumbleFrames.length) {
        setBonusPhase(BONUS_PHASES.BONUS_CASCADE);
        const beforeTumbleValue = Math.max(0, Math.floor(Number(state.currentWinValue) || 0));
        const tumbleSummary = await runTumblePlayback(machine, frameTumbleFrames, safeBet);
        tumbleCounted = Math.max(
          0,
          Math.floor(Number(state.currentWinValue) || 0) - beforeTumbleValue
        );
        state.ephemeral.rows = frameFinalRows;
        state.ephemeral.lineIds = Array.isArray(frame.lineIds)
          ? frame.lineIds.map((v) => Math.max(1, Math.floor(Number(v) || 0))).filter((v) => v > 0).slice(0, 24)
          : [];
        state.ephemeral.lineWins = Array.isArray(frame.lineWins) && frame.lineWins.length
          ? frame.lineWins.map((v) => String(v || "").trim()).filter(Boolean).slice(0, 18)
          : [String(frame.lineText || "Bonus step")];
        state.ephemeral.markedCells = Array.isArray(frame.markedCells) ? frame.markedCells.slice(0, 256) : [];
        state.ephemeral.cellMeta = sanitizeCellMeta(frame.cellMeta);
        state.ephemeral.effectCells = sanitizeEffectCells(frame.effectCells);
        state.ephemeral.upgradeFlashes = {};
        renderBoard();
      }
      bonusTotal += spinPay;
      if (spinPay > biggestSpinWin) biggestSpinWin = spinPay;
      if (frame && frame.summary && typeof frame.summary === "object") {
        biggestCascadeWin = Math.max(
          biggestCascadeWin,
          Math.max(0, Math.floor(Number(frame.summary.biggestCascadeWin) || 0))
        );
      }
      const hud = frame.hud && typeof frame.hud === "object" ? frame.hud : {};
      const metaCounts = countLockedFromCellMeta(state.ephemeral.cellMeta);
      if (showHud && isSix) {
        updateSixBonusHud({
          mode: String(hud.mode || "FREE SPINS"),
          spinsLeft: Math.max(0, Math.floor(Number(hud.spinsLeft) || 0)),
          bonusWin: Math.max(0, Math.floor(Number(hud.bonusWin) || bonusTotal)),
          currentSpinWin: Math.max(0, Math.floor(Number(hud.currentSpinWin) || spinPay)),
          activeMultiplier: Math.max(1, Number(hud.activeMultiplier) || 1),
          wheelRules: hud.wheelRules && typeof hud.wheelRules === "object" ? hud.wheelRules : {}
        });
      } else if (showHud) {
        const leftSpins = Math.max(0, Math.floor(Number(hud.freeSpinsLeft) || Number(hud.spinsLeft) || 0));
        const targetTotal = Math.max(0, Math.floor(Number(hud.bonusWin) || bonusTotal));
        const targetSpin = Math.max(0, Math.floor(Number(hud.currentSpinWin) || spinPay));
        updateBonusHud({
          mode: "FREE SPINS",
          spinsLeft: leftSpins,
          bonusWin: targetTotal,
          currentSpinWin: targetSpin,
          stickyWilds: Math.max(0, Math.floor(Number(hud.stickyWilds) || metaCounts.wilds)),
          multiplierCells: Math.max(0, Math.floor(Number(hud.multiplierCells) || metaCounts.multis)),
          spinsTotal: Math.max(1, totalSpinFrames),
          spinsPlayed: resolvedSpinCount,
          panelTitle: "FREE SPINS"
        });
        await animateBonusHudTo(machine.type, targetSpin, targetTotal, leftSpins, Math.max(120, Math.floor(Number(bonusFx.between) || 220)));
      }
      if (showHud) {
        updateBonusSpinPanel({
          title: "FREE SPINS",
          total: Math.max(1, totalSpinFrames),
          played: resolvedSpinCount,
          totalWin: Math.max(0, Math.floor(Number(bonusTotal) || 0))
        });
      }

      const banner = String(frame.banner || "").trim();
      if (banner) showBonusBanner(banner);
      if (!banner && frame.lineText) showBonusBanner(String(frame.lineText).slice(0, 120));
      if (spinPay > 0) {
        const frameCountedByTumble = Math.max(0, Math.min(spinPay, tumbleCounted));
        const remaining = Math.max(0, spinPay - frameCountedByTumble);
        countedWin += frameCountedByTumble;
        if (remaining > 0 && winCounter && typeof winCounter.startCountUp === "function") {
          await winCounter.startCountUp(state.currentWinValue, state.currentWinValue + remaining, {
            bet: safeBet,
            turbo: Boolean(state.uiSettings.turbo),
            durationScale: 0.84
          });
          countedWin += remaining;
        } else if (remaining > 0) {
          winPresenter.setCurrentWinValue(state.currentWinValue + remaining, safeBet);
          countedWin += remaining;
        }
        audioManager.play("bonus_hit");
        if (spinPay >= (Math.max(1, machine.minBet || 1) * BIG_WIN_MULTIPLIER)) {
          pulseBonusFrameFx("epic");
          spawnParticles("jackpot");
          safeVibrate(18);
        } else {
          pulseBonusFrameFx("hit");
          spawnParticles("win");
          safeVibrate(10);
        }
      }
      if (frame && frame.fills) {
        setBonusPhase(BONUS_PHASES.BONUS_RESOLVING);
        if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.add("winfx");
        await sleep(bonusFx.fillFx);
        if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.remove("winfx");
        pulseBonusFrameFx("hit");
        await sleep(bonusFx.fillSettle);
      }
      await sleep(bonusFx.between);
      clearBonusFrameFx();
    }

    if (frames.length) {
      setBonusPhase(BONUS_PHASES.BONUS_END);
      setBoardDimmed(true);
      const subText = biggestCascadeWin > 0
        ? ("Biggest Spin: " + biggestSpinWin + " WL | Best Cascade: " + biggestCascadeWin + " WL")
        : ("Biggest Spin: " + biggestSpinWin + " WL");
      await showBonusOverlay(
        String(machine && machine.typeName ? machine.typeName : "BONUS COMPLETE"),
        "Total Bonus Win: " + bonusTotal + " WL",
        subText,
        true
      );
      await waitBonusContinue(12000);
      await hideBonusOverlay();
      setBoardDimmed(false);
    }
    setBoardDimmed(false);
    state.bonusFlow.active = false;
    state.ephemeral.effectCells = {};
    state.ephemeral.upgradeFlashes = {};
    showBonusHud(false);
    clearBonusFrameFx();
    audioManager.play("bonus_loop_end");
    if (els.stage instanceof HTMLElement) els.stage.classList.remove("bonus-live");
    setBonusPhase(BONUS_PHASES.BASE_IDLE);
    return { bonusTotal, biggestSpinWin, biggestCascadeWin, countedWin };
  }

  function spawnParticles(tone) {
    if (!(els.particles instanceof HTMLElement)) return;
    const symbols = tone === "jackpot"
      ? ["\u2728", "\u{1F48E}", "\u{1FA99}", "\u{1F31F}", "\u{1F389}"]
      : ["\u2728", "\u{1F4A5}", "\u{1FA99}", "\u{1F4AB}"];
    const count = tone === "jackpot" ? 18 : 10;
    let html = "";
    for (let i = 0; i < count; i++) {
      const left = Math.floor(Math.random() * 95);
      const delay = Math.floor(Math.random() * 180);
      const size = 14 + Math.floor(Math.random() * 12);
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      html += "<span class=\"particle\" style=\"left:" + left + "%;animation-delay:" + delay + "ms;font-size:" + size + "px;\">" + symbol + "</span>";
    }
    els.particles.innerHTML = html;
    window.setTimeout(() => { if (els.particles instanceof HTMLElement) els.particles.innerHTML = ""; }, 1100);
  }

  function getMachineCategoryId(machineType) {
    const type = String(machineType || "").trim().toLowerCase();
    if (type === "blackjack") return "table";
    if (type === "tower" || type === "mines") return "risk";
    return "slots";
  }

  function getMachineCategoryLabel(categoryId) {
    const id = String(categoryId || "").trim().toLowerCase();
    for (let i = 0; i < MACHINE_CATEGORY_DEFS.length; i++) {
      if (MACHINE_CATEGORY_DEFS[i].id === id) return MACHINE_CATEGORY_DEFS[i].label;
    }
    return "Slots";
  }

  function ensureValidMachineCategory(countByCategory) {
    const by = countByCategory && typeof countByCategory === "object" ? countByCategory : {};
    const selected = String(state.machineCategory || "all");
    const known = MACHINE_CATEGORY_DEFS.some((row) => row.id === selected);
    if (!known) {
      state.machineCategory = "all";
      return;
    }
    if (selected !== "all" && Math.max(0, Math.floor(Number(by[selected]) || 0)) <= 0) {
      state.machineCategory = "all";
    }
  }

  // Renders the "Tablet" style grid of games in the lobby
  function renderMachineSelector() {
    if (!(els.machineList instanceof HTMLElement)) return;
    const rows = state.machines.slice().sort((a, b) => a.ty - b.ty || a.tx - b.tx);
    if (!rows.length) {
      if (els.machineCategoryTabs instanceof HTMLElement) els.machineCategoryTabs.innerHTML = "";
      els.machineList.innerHTML = "<div class=\"status\">No games available.</div>";
      return;
    }

    const countByCategory = { all: rows.length, slots: 0, table: 0, risk: 0 };
    for (let i = 0; i < rows.length; i++) {
      const cat = getMachineCategoryId(rows[i].type);
      countByCategory[cat] = Math.max(0, Math.floor(Number(countByCategory[cat]) || 0)) + 1;
    }
    ensureValidMachineCategory(countByCategory);

    if (els.machineCategoryTabs instanceof HTMLElement) {
      els.machineCategoryTabs.innerHTML = MACHINE_CATEGORY_DEFS
        .filter((row) => row.id === "all" || Math.max(0, Math.floor(Number(countByCategory[row.id]) || 0)) > 0)
        .map((row) => {
          const active = row.id === state.machineCategory ? " active" : "";
          const count = Math.max(0, Math.floor(Number(countByCategory[row.id]) || 0));
          return (
            "<button type=\"button\" class=\"machine-cat-btn" + active + "\" data-category=\"" + row.id + "\">" +
            "<span>" + escapeHtml(row.label) + "</span>" +
            "<span class=\"count\">" + count + "</span>" +
            "</button>"
          );
        }).join("");
    }

    const selected = String(state.machineCategory || "all");
    const renderMachineCard = (row) => {
      const catId = getMachineCategoryId(row.type);
      const catLabel = getMachineCategoryLabel(catId);
      return (
        "<div class=\"machine-item\" data-machine-key=\"" + escapeHtml(row.tileKey) + "\">" +
        "<div class=\"machine-cat " + escapeHtml(catId) + "\">" + escapeHtml(catLabel) + "</div>" +
        "<div class=\"name\">" + escapeHtml(row.typeName) + "</div>" +
        "<div class=\"info\">Volatility: " + escapeHtml(formatVolatility(row.volatility)) + "</div>" +
        "<div class=\"info\">Plays: " + row.stats.plays + "</div>" +
        "</div>"
      );
    };

    if (selected === "all") {
      const orderedCategories = MACHINE_CATEGORY_DEFS.filter((row) => row.id !== "all");
      const groupsHtml = [];
      for (let i = 0; i < orderedCategories.length; i++) {
        const cat = orderedCategories[i];
        const catRows = rows.filter((row) => getMachineCategoryId(row.type) === cat.id);
        if (!catRows.length) continue;
        groupsHtml.push(
          "<section class=\"machine-group\">" +
          "<div class=\"machine-group-head\">" +
          "<span class=\"machine-group-title\">" + escapeHtml(cat.label) + "</span>" +
          "<span class=\"machine-group-count\">" + catRows.length + "</span>" +
          "</div>" +
          "<div class=\"machine-group-grid\">" + catRows.map(renderMachineCard).join("") + "</div>" +
          "</section>"
        );
      }
      els.machineList.innerHTML = groupsHtml.length ? groupsHtml.join("") : "<div class=\"status\">No games available.</div>";
      return;
    }

    const visible = rows.filter((row) => getMachineCategoryId(row.type) === selected);
    if (!visible.length) {
      els.machineList.innerHTML = "<div class=\"status\">No games in this category.</div>";
      return;
    }
    els.machineList.innerHTML = visible.map(renderMachineCard).join("");
  }

  function renderMachineStats() {
    const machine = getSelectedMachine();
    if (!machine) {
      showBonusHud(false);
      if (els.statBank instanceof HTMLElement) els.statBank.innerHTML = "Bank: " + formatLocksByDisplayUnitHtml(0);
      if (els.statMaxBet instanceof HTMLElement) els.statMaxBet.textContent = "Volatility: -";
      if (els.statPlays instanceof HTMLElement) els.statPlays.textContent = "Plays: 0";
      if (els.statPayout instanceof HTMLElement) els.statPayout.innerHTML = "Total Payout: " + formatLocksByDisplayUnitHtml(0);
      if (els.stage instanceof HTMLElement) els.stage.classList.remove("theme-slots", "theme-slots_v2", "theme-slots_v3", "theme-slots_v4", "theme-slots_v6", "theme-le_bandit", "theme-tower", "theme-mines", "theme-snoop_dogg_dollars");
      if (els.spinBtn instanceof HTMLButtonElement) els.spinBtn.disabled = true;
      if (els.buyBonusBtn instanceof HTMLButtonElement) {
        els.buyBonusBtn.classList.add("hidden");
        els.buyBonusBtn.disabled = true;
      }
      if (els.towerDifficultyWrap instanceof HTMLElement) els.towerDifficultyWrap.classList.add("hidden");
      if (els.towerCashoutBtn instanceof HTMLButtonElement) {
        els.towerCashoutBtn.classList.add("hidden");
        els.towerCashoutBtn.disabled = true;
      }
      if (els.minesCountWrap instanceof HTMLElement) els.minesCountWrap.classList.add("hidden");
      if (els.minesCashoutBtn instanceof HTMLButtonElement) {
        els.minesCashoutBtn.classList.add("hidden");
        els.minesCashoutBtn.disabled = true;
      }
      if (els.snoopBuyWrap instanceof HTMLElement) els.snoopBuyWrap.classList.add("hidden");
      if (els.snoopHypeBtn instanceof HTMLButtonElement) {
        els.snoopHypeBtn.classList.add("hidden");
        els.snoopHypeBtn.disabled = true;
      }
      if (els.snoopBuyBtn instanceof HTMLButtonElement) {
        els.snoopBuyBtn.classList.add("hidden");
        els.snoopBuyBtn.disabled = true;
      }
      return;
    }

    if (machine.type !== "snoop_dogg_dollars" && !state.bonusFlow.active) {
      showBonusHud(false);
    }

    if (els.statBank instanceof HTMLElement) {
      const bankText = INFINITE_BANK ? "Infinite" : formatLocksByDisplayUnit(machine.earningsLocks);
      els.statBank.innerHTML = INFINITE_BANK ? ("Bank: " + bankText) : ("Bank: " + formatLocksByDisplayUnitHtml(machine.earningsLocks));
    }
    if (els.statMaxBet instanceof HTMLElement) els.statMaxBet.textContent = "Volatility: " + formatVolatility(machine.volatility);
    if (els.statPlays instanceof HTMLElement) els.statPlays.textContent = "Plays: " + machine.stats.plays;
    if (els.statPayout instanceof HTMLElement) els.statPayout.innerHTML = "Total Payout: " + formatLocksByDisplayUnitHtml(machine.stats.totalPayout);

    if (els.stage instanceof HTMLElement) {
      const currentType = machine.type;
      els.stage.classList.remove("theme-slots", "theme-slots_v2", "theme-slots_v3", "theme-slots_v4", "theme-slots_v6", "theme-le_bandit", "theme-tower", "theme-mines", "theme-snoop_dogg_dollars");
      if (typeof currentType === "string") {
        if (currentType === "le_bandit") els.stage.classList.add("theme-le_bandit");
        else if (currentType === "tower") els.stage.classList.add("theme-tower");
        else if (currentType === "mines") els.stage.classList.add("theme-mines");
        else if (currentType === "snoop_dogg_dollars") els.stage.classList.add("theme-snoop_dogg_dollars");
        else if (currentType.startsWith("slots")) els.stage.classList.add("theme-" + currentType);
      }
    }

    // Toggle controls based on game type
    const isBlackjack = machine.type === 'blackjack';
    const isTower = machine.type === "tower";
    const isMines = machine.type === "mines";
    const isSnoop = machine.type === "snoop_dogg_dollars";
    const isSlotSpinGame = !isBlackjack && !isTower && !isMines;
    const bjState = machine.stats.blackjackState;
    const activeHand = (bjState && bjState.hands && bjState.hands[bjState.activeHandIndex]) || null;
    const towerRound = isTower ? getTowerRoundForMachine(machine) : null;
    const minesRound = isMines ? getMinesRoundForMachine(machine) : null;

    const bet = clampBetToMachine(machine, state.currentBetValue);
    let displayBet = bet;

    if (isBlackjack && bjState && bjState.active && Array.isArray(bjState.hands)) {
      displayBet = bjState.hands.reduce((sum, h) => sum + (Number(h.bet) || 0), 0);
    }

    if (els.currentBetDisplay instanceof HTMLElement) {
      els.currentBetDisplay.innerHTML = formatLocksByDisplayUnitHtml(displayBet);
    }

    const maxStake = Math.max(machine.minBet, getSpinMaxBet(machine));
    const busyByOther = Boolean(machine.inUseAccountId && machine.inUseAccountId !== (state.user && state.user.accountId));
    const canBet = !state.spinBusy && !busyByOther && state.webVaultLocks >= displayBet;

    // Blackjack specific buttons
    if (els.bjHitBtn) els.bjHitBtn.classList.toggle("hidden", !isBlackjack);
    if (els.bjStandBtn) els.bjStandBtn.classList.toggle("hidden", !isBlackjack);
    if (els.bjDoubleBtn) els.bjDoubleBtn.classList.toggle("hidden", !isBlackjack);
    if (els.bjSplitBtn) els.bjSplitBtn.classList.toggle("hidden", !isBlackjack);
    if (els.towerDifficultyWrap instanceof HTMLElement) els.towerDifficultyWrap.classList.toggle("hidden", !isTower);
    if (els.towerCashoutBtn instanceof HTMLButtonElement) els.towerCashoutBtn.classList.toggle("hidden", !isTower);
    if (els.minesCountWrap instanceof HTMLElement) els.minesCountWrap.classList.toggle("hidden", !isMines);
    if (els.minesCashoutBtn instanceof HTMLButtonElement) els.minesCashoutBtn.classList.toggle("hidden", !isMines);
    if (els.snoopBuyWrap instanceof HTMLElement) els.snoopBuyWrap.classList.toggle("hidden", !isSnoop);
    if (els.snoopHypeBtn instanceof HTMLButtonElement) els.snoopHypeBtn.classList.toggle("hidden", !isSnoop);
    if (els.snoopBuyBtn instanceof HTMLButtonElement) els.snoopBuyBtn.classList.toggle("hidden", !isSnoop);

    if (isTower && els.towerDifficultySelect instanceof HTMLSelectElement) {
      const selectedDifficulty = getTowerDifficultyForMachine(machine);
      if (els.towerDifficultySelect.value !== selectedDifficulty) els.towerDifficultySelect.value = selectedDifficulty;
      els.towerDifficultySelect.disabled = Boolean(towerRound && towerRound.active);
    }
    if (isTower && els.towerCashoutBtn instanceof HTMLButtonElement) {
      const canCashout = Boolean(towerRound && towerRound.active && towerClearedFloors(towerRound) > 0);
      const currentMult = towerRound ? towerCurrentMultiplier(towerRound) : 1;
      els.towerCashoutBtn.textContent = "Cash Out " + formatLocksByDisplayUnit(towerRound ? formatTowerPayout(towerRound, currentMult) : 0);
      els.towerCashoutBtn.disabled = !canCashout;
    }
    if (isMines && els.minesCountSelect instanceof HTMLSelectElement) {
      const selectedMines = String(getMinesCountForMachine(machine));
      if (els.minesCountSelect.value !== selectedMines) els.minesCountSelect.value = selectedMines;
      els.minesCountSelect.disabled = Boolean(minesRound && minesRound.active);
    }
    if (isMines && els.minesCashoutBtn instanceof HTMLButtonElement) {
      const canCashout = Boolean(minesRound && minesRound.active && minesSafeClicks(minesRound) > 0);
      els.minesCashoutBtn.textContent = "Cash Out " + formatLocksByDisplayUnit(minesRound ? minesCashoutPayout(minesRound) : 0);
      els.minesCashoutBtn.disabled = !canCashout;
    }
    if (isSnoop && els.snoopBuySelect instanceof HTMLSelectElement) {
      const val = Math.max(3, Math.min(6, Math.floor(Number(els.snoopBuySelect.value) || 3)));
      if (els.snoopBuySelect.value !== String(val)) els.snoopBuySelect.value = String(val);
      els.snoopBuySelect.disabled = false;
    }
    if (isSnoop && els.snoopHypeBtn instanceof HTMLButtonElement) {
      const hypeCost = bet * Math.max(1, Math.floor(Number(SNOOP_UI.hypeCostX) || 20));
      els.snoopHypeBtn.textContent = "Hype Spin " + formatLocksByDisplayUnit(hypeCost);
      els.snoopHypeBtn.disabled = !canBet || state.webVaultLocks < hypeCost;
    }
    if (isSnoop && els.snoopBuyBtn instanceof HTMLButtonElement && els.snoopBuySelect instanceof HTMLSelectElement) {
      const scatters = Math.max(3, Math.min(6, Math.floor(Number(els.snoopBuySelect.value) || 3)));
      const buyX = Math.max(1, Math.floor(Number(SNOOP_UI.buyCostByScatter[scatters]) || 1));
      const buyCost = bet * buyX;
      els.snoopBuyBtn.textContent = "Buy " + scatters + "SC " + formatLocksByDisplayUnit(buyCost);
      els.snoopBuyBtn.disabled = !canBet || state.webVaultLocks < buyCost;
    }

    if (els.premiumAutoplaySelect instanceof HTMLSelectElement) {
      els.premiumAutoplaySelect.classList.toggle("hidden", !isSlotSpinGame);
      els.premiumAutoplaySelect.disabled = !isSlotSpinGame || state.spinBusy;
    }
    if (els.premiumAutoplayBtn instanceof HTMLButtonElement) {
      els.premiumAutoplayBtn.classList.toggle("hidden", !isSlotSpinGame);
      els.premiumAutoplayBtn.disabled = !isSlotSpinGame || (!state.autoplay.active && !canBet);
    }
    if (!isSlotSpinGame && state.autoplay.active) setAutoplayActive(false);

    if (isBlackjack) {
      const active = bjState && bjState.active;
      const canSplit = active && activeHand && activeHand.cards.length === 2 && activeHand.cards[0].value === activeHand.cards[1].value && state.webVaultLocks >= bjState.bet;

      if (els.bjHitBtn) els.bjHitBtn.disabled = !active;
      if (els.bjStandBtn) els.bjStandBtn.disabled = !active;
      if (els.bjDoubleBtn) els.bjDoubleBtn.disabled = !active || state.webVaultLocks < bjState.bet;
      if (els.bjSplitBtn) els.bjSplitBtn.disabled = !canSplit;
      if (els.spinBtn) {
        els.spinBtn.textContent = active ? "Game Active" : "Deal";
        els.spinBtn.disabled = active || !canBet;
      }
    } else if (isTower) {
      const activeTower = Boolean(towerRound && towerRound.active);
      if (els.spinBtn) {
        els.spinBtn.textContent = activeTower ? "Run Active" : "Start Run";
        els.spinBtn.disabled = activeTower || !canBet;
      }
    } else if (isMines) {
      const activeMines = Boolean(minesRound && minesRound.active);
      if (els.spinBtn) {
        els.spinBtn.textContent = activeMines ? "Run Active" : "Start Run";
        els.spinBtn.disabled = activeMines || !canBet;
      }
    } else if (isSnoop) {
      if (els.spinBtn) {
        els.spinBtn.textContent = "Spin";
        els.spinBtn.disabled = !canBet;
      }
    } else {
      if (els.spinBtn) {
        els.spinBtn.textContent = "Spin";
        els.spinBtn.disabled = !canBet;
      }
    }

    if (state.spinBusy && isSlotSpinGame && els.spinBtn instanceof HTMLButtonElement) {
      els.spinBtn.textContent = "Quick Stop";
      els.spinBtn.disabled = false;
      els.spinBtn.classList.add("spinning");
    }

    const buyEnabled = machine.type === "slots_v2" || machine.type === "le_bandit";
    if (els.buyBonusBtn instanceof HTMLButtonElement) {
      els.buyBonusBtn.classList.toggle("hidden", !buyEnabled);
      if (buyEnabled) {
        const costX = machine.type === "slots_v2"
          ? Math.max(1, Math.floor(Number(SIX666_CONFIG.bonusBuy && SIX666_CONFIG.bonusBuy.costMultiplier) || 25))
          : 10;
        const cost = bet * costX;
        els.buyBonusBtn.textContent = "Buy Bonus " + formatLocksByDisplayUnit(cost);
        els.buyBonusBtn.disabled = !canBet || state.webVaultLocks < cost;
      } else {
        els.buyBonusBtn.disabled = true;
      }
    }

    renderBetChipLabels();
    renderPremiumHud();
  }

  function renderAll(animCtx) {
    renderSession();
    renderMachineSelector();
    renderMachineStats();
    renderBoard(animCtx);
    renderPremiumHud();
  }

  function switchView(viewName) {
    if (els.viewLogin) els.viewLogin.classList.add("hidden");
    if (els.viewLobby) els.viewLobby.classList.add("hidden");
    if (els.viewGame) els.viewGame.classList.add("hidden");

    if (viewName === "login" && els.viewLogin) els.viewLogin.classList.remove("hidden");
    if (viewName === "lobby" && els.viewLobby) els.viewLobby.classList.remove("hidden");
    if (viewName === "game" && els.viewGame) els.viewGame.classList.remove("hidden");
    if (viewName !== "game") {
      clearBonusUiState();
      setAutoplayActive(false);
      winPresenter.hideBanner();
      winPresenter.clearWinTier();
      if (els.premiumSettingsPanel instanceof HTMLElement) els.premiumSettingsPanel.classList.add("hidden");
      if (els.premiumHistoryPanel instanceof HTMLElement) els.premiumHistoryPanel.classList.add("hidden");
      if (els.fairnessModal instanceof HTMLElement) els.fairnessModal.classList.add("hidden");
    }
    syncTopPanelButtons();
  }

  async function resolveUserRole(accountId, username) {
    const db = await ensureDb();
    const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
    try {
      const roleSnap = await db.ref(basePath + "/admin-roles/" + accountId).once("value");
      const val = roleSnap.val();
      if (typeof val === "string") return val.trim().toLowerCase();
      if (val && typeof val === "object" && typeof val.role === "string") return val.role.trim().toLowerCase();
    } catch (_error) {
      // ignore
    }
    const byName = window.GT_SETTINGS && window.GT_SETTINGS.ADMIN_ROLE_BY_USERNAME;
    return String(byName && typeof byName === "object" ? (byName[username] || "none") : "none").trim().toLowerCase();
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
      const targetNoHash = targetRaw.split("#")[0];
      const targetNoQuery = targetNoHash.split("?")[0];
      const targetParts = targetNoQuery.replace(/\\/g, "/").split("/");
      const target = String(targetParts[targetParts.length - 1] || targetNoQuery || "").trim().toLowerCase();
      if (target && target !== "gambling_slots.html") return null;
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
    setStatus(els.authStatus, "Linking game session...");
    try {
      const db = await ensureDb();
      const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
      const sessionSnap = await db.ref(basePath + "/account-sessions/" + transfer.accountId).once("value");
      const session = sessionSnap && sessionSnap.val ? (sessionSnap.val() || {}) : {};
      const liveSessionId = String(session.sessionId || "").trim();
      const liveUsername = String(session.username || "").trim().toLowerCase();
      if (!liveSessionId) {
        setStatus(els.authStatus, "Session transfer expired. Login required.");
        return false;
      }
      const resolvedUsername = liveUsername || transfer.username;
      if (!resolvedUsername) {
        setStatus(els.authStatus, "Session transfer missing username.");
        return false;
      }
      const role = await resolveUserRole(transfer.accountId, resolvedUsername);
      state.user = {
        accountId: transfer.accountId,
        username: resolvedUsername,
        role
      };
      renderSession();
      setStatus(els.authStatus, "Session linked as @" + resolvedUsername + ".", "ok");
      attachUserSession();
      switchView("lobby");
      return true;
    } catch (_error) {
      setStatus(els.authStatus, "Session transfer failed.");
      return false;
    }
  }

  async function loginWithPassword(createMode, options) {
    const opts = options && typeof options === "object" ? options : {};
    const requireActiveSession = Boolean(opts.requireActiveSession);
    const silentFailure = Boolean(opts.silentFailure);
    if (!(els.authUsername instanceof HTMLInputElement) || !(els.authPassword instanceof HTMLInputElement)) return;
    const username = String(els.authUsername.value || "").trim().toLowerCase();
    const password = String(els.authPassword.value || "");

    if (typeof authModule.validateCredentials === "function") {
      const validation = authModule.validateCredentials(username, password);
      if (validation) {
        setStatus(els.authStatus, validation, "error");
        return;
      }
    }

    setAuthBusy(true);
    setStatus(els.authStatus, createMode ? "Creating account..." : "Logging in...");
    try {
      const db = await ensureDb();
      const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
      const firebaseRef = window.firebase;
      const usernameRef = db.ref(basePath + "/usernames/" + username);

      let accountId = "";
      if (createMode) {
        accountId = "acc_" + Math.random().toString(36).slice(2, 12);
        const reserve = await usernameRef.transaction((current) => {
          if (current) return;
          return accountId;
        });
        if (!reserve || !reserve.committed) throw new Error("Username already exists.");
        if (typeof authModule.sha256Hex !== "function") throw new Error("Auth module missing hash.");
        const passwordHash = await authModule.sha256Hex(password);
        await db.ref(basePath + "/accounts/" + accountId).set({
          username,
          passwordHash,
          createdAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        });
      } else {
        const userSnap = await usernameRef.once("value");
        accountId = String(userSnap.val() || "").trim();
        if (!accountId) throw new Error("Account not found.");
      }

      const accountSnap = await db.ref(basePath + "/accounts/" + accountId).once("value");
      const account = accountSnap.val() || {};
      if (typeof authModule.sha256Hex !== "function") throw new Error("Auth module missing hash.");
      const passwordHash = await authModule.sha256Hex(password);
      if (String(account.passwordHash || "") !== passwordHash) throw new Error("Invalid password.");

      if (requireActiveSession) {
        const sessionSnap = await db.ref(basePath + "/account-sessions/" + accountId).once("value");
        const session = sessionSnap && sessionSnap.val ? (sessionSnap.val() || {}) : {};
        const sessionId = String(session.sessionId || "").trim();
        const sessionUsername = String(session.username || "").trim().toLowerCase();
        if (!sessionId || (sessionUsername && sessionUsername !== username)) {
          throw new Error("Session expired.");
        }
      }

      const role = await resolveUserRole(accountId, username);
      state.user = { accountId, username, role };

      saveCredentials(username, password);
      renderSession();
      setStatus(els.authStatus, "Logged in as @" + username + ".", "ok");

      attachUserSession();
      switchView("lobby");
    } catch (error) {
      if (!silentFailure) {
        setStatus(els.authStatus, (error && error.message) || "Login failed.", "error");
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function attemptSavedSessionResume() {
    if (!(els.authUsername instanceof HTMLInputElement) || !(els.authPassword instanceof HTMLInputElement)) return false;
    const saved = loadSavedCredentials();
    const savedUsername = String(saved && saved.username || "").trim().toLowerCase();
    const savedPassword = String(saved && saved.password || "");
    if (!savedUsername || !savedPassword) return false;
    els.authUsername.value = savedUsername.slice(0, 20);
    els.authPassword.value = savedPassword.slice(0, 64);
    setStatus(els.authStatus, "Restoring session...");
    await loginWithPassword(false, { requireActiveSession: true, silentFailure: true });
    if (!state.user) {
      // Fallback: allow auto-login from saved credentials if account-session key was released.
      await loginWithPassword(false, { requireActiveSession: false, silentFailure: true });
    }
    if (!state.user) {
      setStatus(els.authStatus, "Session expired. Please login.");
      return false;
    }
    setStatus(els.authStatus, "Session restored as @" + state.user.username + ".", "ok");
    return true;
  }

  function logout() {
    clearSessionRefs();
    state.user = null;
    state.walletLocks = 0;
    state.webVaultLocks = 0;
    state.walletBreakdownText = "0 WL";
    resetEphemeralVisuals();
    clearBonusUiState();
    state.tower.roundsByMachine = {};
    state.tower.difficultyByMachine = {};
    state.mines.roundsByMachine = {};
    state.mines.minesByMachine = {};
    renderAll();
    state.selectedMachineKey = "";
    setStatus(els.authStatus, "Logged out.");
    switchView("login");
  }

  async function attachUserSession() {
    if (!state.user) return;
    try {
      const db = await ensureDb();
      const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
      clearSessionRefs();
      state.refs.inventory = db.ref(basePath + "/player-inventories/" + state.user.accountId);

      state.handlers.inventory = (snap) => {
        const raw = snap && typeof snap.val === "function" ? (snap.val() || {}) : {};
        const wallet = toWallet(raw);
        state.walletLocks = wallet.total;
        state.webVaultLocks = wallet.vault;
        state.walletBreakdownText = walletText(wallet.byId);
        const backupField = toCount(raw && raw.web_vault_balance_backup);
        if (hasVaultBalanceField(raw) && wallet.vault <= 0 && backupField > 0) {
          void recoverMissingVaultBalance(raw);
        } else if (hasVaultBalanceField(raw)) {
          syncVaultBackupForCurrentUser(wallet.vault);
        } else {
          void recoverMissingVaultBalance(raw);
        }
        renderSession();
        renderMachineStats(); // Re-render stats to update button disabled states
      };

      state.refs.inventory.on("value", state.handlers.inventory);
    } catch (error) {
      // silent fail
    }
  }

  function rowsFromResult(reels, machineType) {
    const arr = Array.isArray(reels) ? reels : [];
    if (!arr.length) return [["?"]];
    if (machineType === "slots") return [arr.map((v) => normalizeToken(v))];
    const rows = [];
    for (let i = 0; i < arr.length; i++) {
      const row = String(arr[i] || "").split(",").map((v) => normalizeToken(v)).filter(Boolean);
      rows.push(row.length ? row : ["?"]);
    }
    const normalized = rows.filter((row) => row.length > 0);
    const singleCol = normalized.length > 1 && normalized.every((row) => row.length === 1);
    if (singleCol) return [normalized.map((row) => row[0])];
    return normalized.length ? normalized : [["?"]];
  }

  function sanitizeEffectCells(rawMap) {
    const src = rawMap && typeof rawMap === "object" ? rawMap : {};
    const out = {};
    const keys = Object.keys(src);
    for (let i = 0; i < keys.length; i++) {
      const key = String(keys[i] || "");
      if (!key) continue;
      const val = String(src[key] || "").trim().toLowerCase();
      if (!val) continue;
      out[key] = val;
    }
    return out;
  }

  function sanitizeCellMeta(rawMeta) {
    const src = rawMeta && typeof rawMeta === "object" ? rawMeta : {};
    const out = {};
    const keys = Object.keys(src);
    for (let i = 0; i < keys.length; i++) {
      const key = String(keys[i] || "");
      if (!key) continue;
      const row = src[key] && typeof src[key] === "object" ? src[key] : {};
      const wildMult = Math.max(0, Math.floor(Number(row.wildMult) || 0));
      const cellMult = Math.max(0, Math.floor(Number(row.cellMult) || 0));
      const locked = Boolean(row.locked || wildMult > 0 || cellMult > 1);
      if (!locked && wildMult <= 0 && cellMult <= 0) continue;
      out[key] = { locked, wildMult, cellMult };
    }
    return out;
  }

  function applyFrameToEphemeral(frame, machineType) {
    const row = frame && typeof frame === "object" ? frame : {};
    state.ephemeral.rows = rowsFromResult(row.reels, machineType);
    state.ephemeral.lineIds = Array.isArray(row.lineIds)
      ? row.lineIds.map((v) => Math.max(1, Math.floor(Number(v) || 0))).filter((v) => v > 0).slice(0, 24)
      : [];
    state.ephemeral.lineWins = Array.isArray(row.lineWins) && row.lineWins.length
      ? row.lineWins.map((v) => String(v || "").trim()).filter(Boolean).slice(0, 18)
      : [String(row.lineText || "Bonus step")];
    state.ephemeral.markedCells = Array.isArray(row.markedCells) ? row.markedCells.slice(0, 256) : [];
    state.ephemeral.cellMeta = sanitizeCellMeta(row.cellMeta);
    state.ephemeral.effectCells = sanitizeEffectCells(row.effectCells);
    state.ephemeral.upgradeFlashes = {};
    const upgrades = Array.isArray(row.wildUpgrades) ? row.wildUpgrades : [];
    for (let i = 0; i < upgrades.length; i++) {
      const up = upgrades[i] && typeof upgrades[i] === "object" ? upgrades[i] : {};
      const key = String(up.key || "");
      if (!key) continue;
      const to = Math.max(0, Math.floor(Number(up.to) || 0));
      const from = Math.max(0, Math.floor(Number(up.from) || 0));
      if (to > from) state.ephemeral.upgradeFlashes[key] = "+" + (to - from);
    }
  }

  async function runBlackjackAction(action) {
    const machine = getSelectedMachine();
    if (!machine || machine.type !== 'blackjack') return;

    // Initialize state if missing
    if (!machine.stats.blackjackState) {
      machine.stats.blackjackState = { active: false, hands: [], dealerHand: [], deck: [], bet: 0, message: "Place bet and Deal", activeHandIndex: 0 };
    }
    const bj = machine.stats.blackjackState;

    if (action === 'deal') {
      if (els.lastWinLabel) els.lastWinLabel.classList.add("hidden");
      if (bj.active) return;
      const bet = clampBetToMachine(machine, state.currentBetValue);
      if (state.webVaultLocks < bet) return;

      // Deduct bet
      const debit = await adjustWallet(-bet);
      if (!debit.ok) return;

      bj.bet = bet;
      bj.deck = getDeck();
      bj.hands = [{ cards: [bj.deck.pop(), bj.deck.pop()], bet: bet, done: false }];
      bj.dealerHand = [bj.deck.pop(), bj.deck.pop()];
      bj.active = true;
      bj.activeHandIndex = 0;
      bj.message = "Hit or Stand?";

      // Check natural blackjack
      if (isBlackjack(bj.hands[0].cards)) {
        bj.active = false;
        if (isBlackjack(bj.dealerHand)) {
          bj.message = "Push! Both have Blackjack.";
          await adjustWallet(bet); // Return bet
          if (els.lastWinLabel) { els.lastWinLabel.textContent = "Push"; els.lastWinLabel.classList.remove("hidden"); }
        } else {
          const win = Math.floor(bet * 2.5);
          bj.message = `Blackjack! Won ${win} WL`;
          await adjustWallet(win);
          if (els.lastWinLabel) { els.lastWinLabel.textContent = "Won: " + win + " WL"; els.lastWinLabel.classList.remove("hidden"); }
        }
      }
      renderAll('deal');
    } else if (action === 'hit') {
      if (!bj.active) return;
      const hand = bj.hands[bj.activeHandIndex];
      hand.cards.push(bj.deck.pop());
      renderAll('hit');
      if (calculateHand(hand.cards) > 21) {
        await sleep(600);
        hand.done = true;
        // Move to next hand or finish
        if (bj.activeHandIndex < bj.hands.length - 1) {
          bj.activeHandIndex++;
        } else {
          await finishDealer(bj);
        }
        renderAll();
      }
    } else if (action === 'stand') {
      if (!bj.active) return;

      const hand = bj.hands[bj.activeHandIndex];
      hand.done = true;

      if (bj.activeHandIndex < bj.hands.length - 1) {
        bj.activeHandIndex++;
      } else {
        await finishDealer(bj);
      }
      renderAll();
    } else if (action === 'double') {
      if (!bj.active) return;
      const hand = bj.hands[bj.activeHandIndex];
      if (hand.cards.length !== 2) return;
      if (state.webVaultLocks < bj.bet) return; // Need enough for 2nd bet

      const debit = await adjustWallet(-bj.bet);
      if (!debit.ok) return;

      hand.bet *= 2;
      hand.cards.push(bj.deck.pop());
      renderAll('hit');

      await sleep(600);
      hand.done = true;

      if (bj.activeHandIndex < bj.hands.length - 1) {
        bj.activeHandIndex++;
      } else {
        await finishDealer(bj);
      }
      renderAll();
    } else if (action === 'split') {
      if (!bj.active) return;
      const hand = bj.hands[bj.activeHandIndex];
      if (hand.cards.length !== 2 || hand.cards[0].value !== hand.cards[1].value) return;
      if (state.webVaultLocks < bj.bet) return;

      const debit = await adjustWallet(-bj.bet);
      if (!debit.ok) return;

      // Split logic
      const card1 = hand.cards[0];
      const card2 = hand.cards[1];

      // Replace current hand with first split hand
      hand.cards = [card1, bj.deck.pop()];

      // Insert second split hand after current
      bj.hands.splice(bj.activeHandIndex + 1, 0, {
        cards: [card2, bj.deck.pop()],
        bet: bj.bet,
        done: false
      });

      bj.message = "Split! Playing Hand 1.";
      renderAll('deal');
    }
  }

  async function finishDealer(bj) {
    bj.active = false;
    renderAll(); // Reveal hidden

    // Only play dealer if at least one player hand didn't bust
    const anyLive = bj.hands.some(h => calculateHand(h.cards) <= 21);

    if (anyLive) {
      while (calculateHand(bj.dealerHand) < 17) {
        await sleep(800);
        bj.dealerHand.push(bj.deck.pop());
        renderAll('dealer');
      }
    }

    const dScore = calculateHand(bj.dealerHand);
    let totalWin = 0;
    let anyWin = false;
    let anyPush = false;

    for (const hand of bj.hands) {
      const pScore = calculateHand(hand.cards);
      if (pScore > 21) {
        // Bust, already lost bet
      } else if (dScore > 21 || pScore > dScore) {
        const win = hand.bet * 2;
        totalWin += win;
        anyWin = true;
        await adjustWallet(win);
      } else if (dScore === pScore) {
        totalWin += hand.bet;
        anyPush = true;
        await adjustWallet(hand.bet);
      }
    }

    if (anyWin) {
      bj.message = `Won ${totalWin} WL total!`;
      if (els.lastWinLabel) { els.lastWinLabel.textContent = "Won: " + totalWin + " WL"; els.lastWinLabel.classList.remove("hidden"); els.lastWinLabel.classList.add("good"); }
    } else if (anyPush) {
      bj.message = "Push. Bets returned.";
      if (els.lastWinLabel) { els.lastWinLabel.textContent = "Push"; els.lastWinLabel.classList.remove("hidden"); els.lastWinLabel.classList.remove("good"); }
    } else {
      bj.message = "Dealer Wins All.";
      if (els.lastWinLabel) { els.lastWinLabel.textContent = "Dealer Wins"; els.lastWinLabel.classList.remove("hidden"); els.lastWinLabel.classList.remove("good"); }
    }
  }

  async function creditPayoutAfterSpin(payout) {
    const amount = Math.max(0, Math.floor(Number(payout) || 0));
    if (amount <= 0) return { ok: true, amount: 0 };
    for (let i = 0; i < 3; i++) {
      const credit = await adjustWallet(amount);
      if (credit && credit.ok) return { ok: true, amount };
      await sleep(120 + (i * 90));
    }
    return { ok: false, amount };
  }

  async function maybeContinueAutoplay(result) {
    if (!state.autoplay.active) return;
    const row = result && typeof result === "object" ? result : {};
    const payout = Math.max(0, Math.floor(Number(row.payout) || 0));
    const bet = Math.max(1, Math.floor(Number(row.bet) || 1));
    const isBigWin = payout >= (bet * BIG_WIN_MULTIPLIER);
    state.autoplay.left = Math.max(0, state.autoplay.left - 1);
    updateAutoplayStatusText();
    renderPremiumHud();

    const stopByBigWin = state.uiSettings.autoplayStopOnBigWin && isBigWin;
    const stopByBalance = state.uiSettings.autoplayStopBalance > 0 && state.webVaultLocks < state.uiSettings.autoplayStopBalance;
    const noSpinsLeft = state.autoplay.left <= 0;
    if (stopByBigWin || stopByBalance || noSpinsLeft) {
      setAutoplayActive(false);
      return;
    }

    await sleep(state.uiSettings.turbo ? 130 : 260);
    if (!state.autoplay.active || state.spinBusy) return;
    await runSpin(state.autoplay.mode || "spin");
  }

  async function runSpin(mode) {
    const nowMs = Date.now();
    if (nowMs < Math.max(0, Math.floor(Number(state.winCounterSkipUntil) || 0))) return;
    if (winCounter && typeof winCounter.isRunning === "function" && winCounter.isRunning()) {
      if (typeof winCounter.skip === "function") winCounter.skip();
      state.winCounterSkipUntil = Date.now() + 180;
      return;
    }
    if (tumbleAnimator && typeof tumbleAnimator.isRunning === "function" && tumbleAnimator.isRunning()) {
      if (typeof tumbleAnimator.skip === "function") tumbleAnimator.skip();
      state.winCounterSkipUntil = Date.now() + 180;
      return;
    }
    if (state.spinBusy) {
      state.quickStopRequested = true;
      reelAnimator.requestQuickStop();
      return;
    }
    if (!state.user) {
      return;
    }
    const machine = getSelectedMachine();
    if (!machine) {
      return;
    }

    if (machine.type === 'blackjack') {
      runBlackjackAction('deal');
      return;
    }
    if (machine.type === "tower") {
      await startTowerRun(machine);
      return;
    }
    if (machine.type === "mines") {
      await startMinesRun(machine);
      return;
    }

    const modeText = String(mode || "spin").trim().toLowerCase();
    if (modeText !== "spin" && state.autoplay.active) setAutoplayActive(false);
    const buyBonus = modeText === "buybonus" && (machine.type === "slots_v2" || machine.type === "le_bandit");
    const snoopBuyMatch = machine.type === "snoop_dogg_dollars" ? /^snoop_buy_([3-6])$/.exec(modeText) : null;
    const isSnoopHype = machine.type === "snoop_dogg_dollars" && modeText === "hype";
    const isSnoopBuy = Boolean(snoopBuyMatch);
    let wagerX = 1;
    let spinOptions = {};
    if (buyBonus) {
      if (machine.type === "slots_v2") {
        wagerX = Math.max(1, Math.floor(Number(SIX666_CONFIG.bonusBuy && SIX666_CONFIG.bonusBuy.costMultiplier) || 25));
      } else {
        wagerX = 10;
      }
      spinOptions = { mode: "buybonus" };
    } else if (isSnoopHype) {
      wagerX = Math.max(1, Math.floor(Number(SNOOP_UI.hypeCostX) || 20));
      spinOptions = { mode: "hype" };
    } else if (isSnoopBuy) {
      const scatters = Math.max(3, Math.min(6, Math.floor(Number(snoopBuyMatch[1]) || 3)));
      wagerX = Math.max(1, Math.floor(Number(SNOOP_UI.buyCostByScatter[scatters]) || 1));
      spinOptions = { mode: "buybonus_" + scatters };
    }
    const isPremiumSpin = buyBonus || isSnoopHype || isSnoopBuy;
    const showBonusSpinText = buyBonus || isSnoopBuy;
    const bet = clampBetToMachine(machine, state.currentBetValue);

    const wager = bet * wagerX;
    if (state.webVaultLocks < wager) {
      if (state.autoplay.active) setAutoplayActive(false);
      return;
    }

    startSpinFx(machine, showBonusSpinText, bet);

    const debit = await adjustWallet(-wager);
    if (!debit.ok) {
      stopSpinFx();
      resetEphemeralVisuals();
      clearBonusUiState();
      renderAll();
      return;
    }

    let applied = false;
    let resolved = null;
    let payout = 0;

    // Standalone / Casino Mode Handling
    if (machine.tileKey.startsWith("demo_")) {

      let rawResult = {};
      if (machine.type === "slots_v2") {
        rawResult = simulateSixSixSix(machine, bet, buyBonus);
      } else if (machine.type === "le_bandit") {
        rawResult = simulateLeBandit(machine, bet, buyBonus);
      } else if (typeof slotsModule.spin === "function") {
        rawResult = slotsModule.spin(machine.type, bet, spinOptions) || {};
      } else {
        rawResult = simulateStandaloneSpin(machine, bet);
      }

      const resultWager = Math.max(1, Math.floor(Number(rawResult.bet) || wager));
      const wanted = Math.max(0, Math.floor(Number(rawResult.payoutWanted) || 0));

      const lines = Array.isArray(rawResult.lineWins) ? rawResult.lineWins.map((s) => String(s || "").trim()).filter(Boolean) : [];
      const lineIds = Array.isArray(rawResult.lineIds) ? rawResult.lineIds.map((n) => Math.max(1, Math.floor(Number(n) || 0))).filter((n) => n > 0) : [];
      const reels = Array.isArray(rawResult.reels) ? rawResult.reels : [];
      const finalRows = rowsFromResult(reels, machine.type);
      const tumbleFrames = extractTumbleFrames(machine.type, rawResult);
      const spinStartRows = resolveSpinStartRows(machine.type, rawResult, tumbleFrames, finalRows);

      if (!lineIds.length && String(rawResult.gameId || machine.type || "") === "slots" && wanted > 0) {
        lineIds.push(1);
        if (!lines.length && rawResult.summary) {
          lines.push(String(rawResult.summary));
        }
      }

      applied = true;
      payout = wanted;
      resolved = {
        type: machine.type,
        rows: finalRows,
        spinStartRows: spinStartRows,
        tumbleFrames: tumbleFrames,
        lineWins: lines,
        lineIds: lineIds,
        outcome: String(rawResult.outcome || "lose").slice(0, 24),
        multiplier: Math.max(0, Number(rawResult.multiplier) || 0),
        summary: String(rawResult.summary || "").slice(0, 220),
        wager: resultWager,
        cellMeta: sanitizeCellMeta(rawResult && rawResult.cellMeta),
        bonusFrames: extractBonusFrames(machine.type, rawResult)
      };

      if (state.spinTimer) {
        window.clearInterval(state.spinTimer);
        state.spinTimer = 0;
      }
      state.ephemeral.stoppedCols = 0;
      await reelAnimator.animate(machine, resolved.spinStartRows, {
        anticipation: resolved.outcome === "jackpot" || payout >= (bet * BIG_WIN_MULTIPLIER)
      });
      state.ephemeral.stoppedCols = Math.max(1, Math.floor(Number(machine.reels) || 1));

      // Update local ephemeral stats
      machine.stats.plays++;
      machine.stats.totalBet += resultWager;
      machine.stats.totalPayout += wanted;
      machine.stats.lastOutcome = resolved.outcome;
      machine.stats.lastSlotsText = reels.join("|");
      machine.stats.lastSlotsLines = lines.join("|");
      machine.stats.lastSlotsLineIds = lineIds.join(",");
      let payoutCredited = payout <= 0;

      // If NOT a bonus, stop immediately. If bonus, stay busy!
      const bonusFrames = Array.isArray(resolved.bonusFrames) ? resolved.bonusFrames : [];
      const hasBonus = bonusFrames.length > 0;
      let countedPayout = 0;
      if (!hasBonus) {
        stopSpinFx();
      }

      const tumbleFramesSafe = Array.isArray(resolved.tumbleFrames) ? resolved.tumbleFrames : [];
      if (!state.bonusFlow.active) setBonusPhase(BONUS_PHASES.BASE_RESOLVING);
      state.ephemeral.rows = tumbleFramesSafe.length ? resolved.spinStartRows : resolved.rows;
      state.ephemeral.lineWins = resolved.lineWins;
      state.ephemeral.lineIds = resolved.lineIds;
      state.ephemeral.markedCells = [];
      state.ephemeral.cellMeta = sanitizeCellMeta(resolved.cellMeta);
      state.ephemeral.effectCells = {};
      state.ephemeral.upgradeFlashes = {};
      renderBoard();

      if (tumbleFramesSafe.length) {
        setBonusPhase(BONUS_PHASES.BASE_CASCADE);
        const beforeTumbleValue = Math.max(0, Math.floor(Number(state.currentWinValue) || 0));
        await runTumblePlayback(machine, tumbleFramesSafe, bet);
        countedPayout += Math.max(
          0,
          Math.floor(Number(state.currentWinValue) || 0) - beforeTumbleValue
        );
        state.ephemeral.rows = resolved.rows;
        state.ephemeral.lineWins = resolved.lineWins;
        state.ephemeral.lineIds = resolved.lineIds;
        state.ephemeral.markedCells = [];
        state.ephemeral.cellMeta = sanitizeCellMeta(resolved.cellMeta);
        state.ephemeral.effectCells = {};
        state.ephemeral.upgradeFlashes = {};
        renderBoard();
      }

      // --- Bonus Playback Loop ---
      if (hasBonus) {
        const beforeBonusValue = Math.max(0, Math.floor(Number(state.currentWinValue) || 0));
        const bonusSummary = await runBonusPlayback(machine, bonusFrames, bet);
        countedPayout += Math.max(
          0,
          Math.floor(Number(state.currentWinValue) || 0) - beforeBonusValue
        );
        if (els.lastWinLabel && bonusSummary.bonusTotal > 0) {
          els.lastWinLabel.textContent = "Bonus: " + Math.floor(bonusSummary.bonusTotal) + " WL";
          els.lastWinLabel.classList.add("good");
          els.lastWinLabel.classList.remove("hidden");
        }
        stopSpinFx();
      }

      if (payout > 0) {
        const creditOut = await creditPayoutAfterSpin(payout);
        payoutCredited = Boolean(creditOut && creditOut.ok);
      }

      const shouldShowCounter = hasBonus || payout >= (bet * 2);
      await winPresenter.presentWin(payout, bet, {
        forceCounter: shouldShowCounter,
        replayFromZero: shouldShowCounter,
        alreadyCounted: shouldShowCounter ? false : (countedPayout >= payout)
      });
      const isBigWin = payout >= (bet * BIG_WIN_MULTIPLIER);
      pushSpinHistory({
        game: machine.typeName || machine.type,
        bet: wager,
        payout,
        bigWin: isBigWin
      });

      if (els.lastWinLabel) {
        if (payout > 0) {
          els.lastWinLabel.textContent = payoutCredited
            ? ("Won: " + payout + " WL")
            : ("Won: " + payout + " WL (sync pending)");
          els.lastWinLabel.classList.remove("hidden");
          els.lastWinLabel.classList.toggle("good", payoutCredited);
        } else {
          els.lastWinLabel.textContent = "No Win";
          els.lastWinLabel.classList.remove("hidden");
          els.lastWinLabel.classList.remove("good");
        }
      }
      if (resolved.outcome === "win" || resolved.outcome === "jackpot" || isPremiumSpin || payout > 0) {
        if (els.boardWrap instanceof HTMLElement) {
          els.boardWrap.classList.add("winfx");
          window.setTimeout(() => { if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.remove("winfx"); }, 800);
        }
        spawnParticles(payout >= bet * 50 ? "jackpot" : "win");
      }
      renderAll();
      await maybeContinueAutoplay({
        payout,
        bet,
        mode: "spin"
      });
      return;
    } else {
      // Player-hosted machine handling (DB Transaction)
      try {
        const db = await ensureDb();
        const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
        const ref = db.ref(basePath + "/worlds/" + state.worldId + "/gamble-machines/" + machine.tileKey);
        const playerName = String(state.user.username || "").slice(0, 24);
        const playerId = String(state.user.accountId || "").trim();

        const txn = await ref.transaction((currentRaw) => {
          const current = normalizeMachineRecord(machine.tileKey, currentRaw);
          if (!current) return currentRaw;
          if (current.inUseAccountId && current.inUseAccountId !== playerId) return currentRaw;

          const liveMax = getSpinMaxBet(current);
          if (bet > liveMax) return currentRaw;

          let rawResult = {};
          if (current.type === "slots_v2") {
            rawResult = simulateSixSixSix(current, bet, buyBonus);
          } else if (current.type === "le_bandit") {
            rawResult = simulateLeBandit(current, bet, buyBonus);
          } else {
            rawResult = slotsModule.spin(current.type, bet, spinOptions) || {};
          }
          const resultWager = Math.max(1, Math.floor(Number(rawResult.bet) || wager));
          const wanted = Math.max(0, Math.floor(Number(rawResult.payoutWanted) || 0));
          if (resultWager !== wager) return currentRaw;
          if (!INFINITE_BANK && (current.earningsLocks + resultWager - wanted) < 0) return currentRaw;

          const lines = Array.isArray(rawResult.lineWins) ? rawResult.lineWins.map((s) => String(s || "").trim()).filter(Boolean) : [];
          const lineIds = Array.isArray(rawResult.lineIds) ? rawResult.lineIds.map((n) => Math.max(1, Math.floor(Number(n) || 0))).filter((n) => n > 0) : [];
          const reels = Array.isArray(rawResult.reels) ? rawResult.reels : [];
          const finalRows = rowsFromResult(reels, current.type);
          const tumbleFrames = extractTumbleFrames(current.type, rawResult);
          const spinStartRows = resolveSpinStartRows(current.type, rawResult, tumbleFrames, finalRows);
          const nextAt = Date.now();
          if (!lineIds.length && String(rawResult.gameId || current.type || "") === "slots" && wanted > 0) {
            lineIds.push(1);
            if (!lines.length && rawResult.summary) {
              lines.push(String(rawResult.summary));
            }
          }

          const stats = current.stats && typeof current.stats === "object" ? { ...current.stats } : {};
          stats.plays = toCount(stats.plays) + 1;
          stats.totalBet = toCount(stats.totalBet) + resultWager;
          stats.totalPayout = toCount(stats.totalPayout) + wanted;
          stats.lastOutcome = String(rawResult.outcome || "lose").slice(0, 24);
          stats.lastMultiplier = Math.max(0, Number(rawResult.multiplier) || 0);
          stats.lastSlotsText = reels.join("|").slice(0, 220);
          stats.lastSlotsSummary = String(rawResult.summary || "").slice(0, 220);
          stats.lastSlotsLines = lines.join(" | ").slice(0, 220);
          stats.lastSlotsLineIds = lineIds.join(",").slice(0, 120);
          stats.lastPlayerName = playerName;
          stats.lastAt = nextAt;

          applied = true;
          payout = wanted;
          resolved = {
            type: current.type,
            rows: finalRows,
            spinStartRows: spinStartRows,
            tumbleFrames: tumbleFrames,
            lineWins: lines,
            lineIds: lineIds,
            outcome: stats.lastOutcome,
            multiplier: stats.lastMultiplier,
            summary: stats.lastSlotsSummary,
            wager: resultWager,
            cellMeta: sanitizeCellMeta(rawResult && rawResult.cellMeta),
            bonusFrames: extractBonusFrames(current.type, rawResult)
          };

          const nextEarningsLocks = INFINITE_BANK
            ? toCount(current.earningsLocks)
            : Math.max(0, current.earningsLocks + resultWager - wanted);

          return {
            ...currentRaw,
            earningsLocks: nextEarningsLocks,
            updatedAt: nextAt,
            stats
          };
        });

        if (!txn || !txn.committed || !applied || !resolved) {
          await adjustWallet(wager);
          stopSpinFx();
          resetEphemeralVisuals();
          clearBonusUiState();
          renderAll();
          return;
        }

        if (state.spinTimer) {
          window.clearInterval(state.spinTimer);
          state.spinTimer = 0;
        }
        state.ephemeral.stoppedCols = 0;
        await reelAnimator.animate(machine, resolved.spinStartRows, {
          anticipation: resolved.outcome === "jackpot" || payout >= (bet * BIG_WIN_MULTIPLIER)
        });
        state.ephemeral.stoppedCols = Math.max(1, Math.floor(Number(machine.reels) || 1));

        let payoutCredited = payout <= 0;

        // Defer stop if bonus
        const bonusFrames = Array.isArray(resolved.bonusFrames) ? resolved.bonusFrames : [];
        const hasBonus = bonusFrames.length > 0;
        let countedPayout = 0;
        if (!hasBonus) {
          stopSpinFx();
        }

        const tumbleFramesSafe = Array.isArray(resolved.tumbleFrames) ? resolved.tumbleFrames : [];
        if (!state.bonusFlow.active) setBonusPhase(BONUS_PHASES.BASE_RESOLVING);
        state.ephemeral.rows = tumbleFramesSafe.length ? resolved.spinStartRows : resolved.rows;
        state.ephemeral.lineWins = resolved.lineWins;
        state.ephemeral.lineIds = resolved.lineIds;
        state.ephemeral.markedCells = [];
        state.ephemeral.cellMeta = sanitizeCellMeta(resolved.cellMeta);
        state.ephemeral.effectCells = {};
        state.ephemeral.upgradeFlashes = {};
        renderBoard();

        if (tumbleFramesSafe.length) {
          setBonusPhase(BONUS_PHASES.BASE_CASCADE);
          const beforeTumbleValue = Math.max(0, Math.floor(Number(state.currentWinValue) || 0));
          await runTumblePlayback(machine, tumbleFramesSafe, bet);
          countedPayout += Math.max(
            0,
            Math.floor(Number(state.currentWinValue) || 0) - beforeTumbleValue
          );
          state.ephemeral.rows = resolved.rows;
          state.ephemeral.lineWins = resolved.lineWins;
          state.ephemeral.lineIds = resolved.lineIds;
          state.ephemeral.markedCells = [];
          state.ephemeral.cellMeta = sanitizeCellMeta(resolved.cellMeta);
          state.ephemeral.effectCells = {};
          state.ephemeral.upgradeFlashes = {};
          renderBoard();
        }

        // --- Bonus Playback Loop (Hosted Machine) ---
        if (hasBonus) {
          const beforeBonusValue = Math.max(0, Math.floor(Number(state.currentWinValue) || 0));
          const bonusSummary = await runBonusPlayback(machine, bonusFrames, bet);
          countedPayout += Math.max(
            0,
            Math.floor(Number(state.currentWinValue) || 0) - beforeBonusValue
          );
          if (els.lastWinLabel && bonusSummary.bonusTotal > 0) {
            els.lastWinLabel.textContent = "Bonus: " + Math.floor(bonusSummary.bonusTotal) + " WL";
            els.lastWinLabel.classList.add("good");
            els.lastWinLabel.classList.remove("hidden");
          }
          stopSpinFx();
        }

        if (payout > 0) {
          const creditOut = await creditPayoutAfterSpin(payout);
          payoutCredited = Boolean(creditOut && creditOut.ok);
        }

        const shouldShowCounter = hasBonus || payout >= (bet * 2);
        await winPresenter.presentWin(payout, bet, {
          forceCounter: shouldShowCounter,
          replayFromZero: shouldShowCounter,
          alreadyCounted: shouldShowCounter ? false : (countedPayout >= payout)
        });
        const isBigWin = payout >= (bet * BIG_WIN_MULTIPLIER);
        pushSpinHistory({
          game: machine.typeName || machine.type,
          bet: wager,
          payout,
          bigWin: isBigWin
        });

        if (els.lastWinLabel) {
          if (payout > 0) {
            els.lastWinLabel.textContent = payoutCredited
              ? ("Won: " + payout + " WL")
              : ("Won: " + payout + " WL (sync pending)");
            els.lastWinLabel.classList.remove("hidden");
            els.lastWinLabel.classList.toggle("good", payoutCredited);
          } else {
            els.lastWinLabel.textContent = "No Win";
            els.lastWinLabel.classList.remove("hidden");
            els.lastWinLabel.classList.remove("good");
          }
        }

        if (resolved.outcome === "win" || resolved.outcome === "jackpot" || isPremiumSpin || payout > 0) {
          if (els.boardWrap instanceof HTMLElement) {
            els.boardWrap.classList.add("winfx");
            window.setTimeout(() => { if (els.boardWrap instanceof HTMLElement) els.boardWrap.classList.remove("winfx"); }, 420);
          }
          spawnParticles(payout >= bet * 50 ? "jackpot" : "win");
        }
        renderAll();
        await maybeContinueAutoplay({
          payout,
          bet,
          mode: "spin"
        });
      } catch (error) {
        await adjustWallet(wager);
        stopSpinFx();
        resetEphemeralVisuals();
        clearBonusUiState();
        renderAll();
        return;
      }
    }
  }

  function bindEvents() {
    if (els.openGameBtn instanceof HTMLButtonElement) els.openGameBtn.addEventListener("click", () => { window.location.href = "index.html"; });
    if (els.logoutBtn instanceof HTMLButtonElement) els.logoutBtn.addEventListener("click", logout);
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const clickable = target.closest("button, .chip, .machine-item, .machine-cat-btn, .vault-quick-btn");
      if (!clickable) return;
      if (!state.user) return;
      if (clickable.id === "authLoginBtn" || clickable.id === "authCreateBtn") return;
      audioManager.play("button_click");
    });
    if (els.premiumSettingsBtn instanceof HTMLButtonElement && els.premiumSettingsPanel instanceof HTMLElement) {
      els.premiumSettingsBtn.addEventListener("click", () => {
        const next = els.premiumSettingsPanel.classList.contains("hidden");
        els.premiumSettingsPanel.classList.toggle("hidden", !next);
        if (next && els.premiumHistoryPanel instanceof HTMLElement) els.premiumHistoryPanel.classList.add("hidden");
        syncTopPanelButtons();
      });
    }
    if (els.premiumHistoryBtn instanceof HTMLButtonElement && els.premiumHistoryPanel instanceof HTMLElement) {
      els.premiumHistoryBtn.addEventListener("click", () => {
        const next = els.premiumHistoryPanel.classList.contains("hidden");
        els.premiumHistoryPanel.classList.toggle("hidden", !next);
        if (next && els.premiumSettingsPanel instanceof HTMLElement) els.premiumSettingsPanel.classList.add("hidden");
        syncTopPanelButtons();
      });
    }
    if (els.premiumHistoryClear instanceof HTMLButtonElement) {
      els.premiumHistoryClear.addEventListener("click", () => {
        state.spinHistory = [];
        renderSpinHistory();
      });
    }
    if (els.premiumFairnessBtn instanceof HTMLButtonElement && els.fairnessModal instanceof HTMLElement) {
      els.premiumFairnessBtn.addEventListener("click", () => {
        els.fairnessModal.classList.remove("hidden");
        syncTopPanelButtons();
      });
    }
    if (els.premiumFairnessClose instanceof HTMLButtonElement && els.fairnessModal instanceof HTMLElement) {
      els.premiumFairnessClose.addEventListener("click", () => {
        els.fairnessModal.classList.add("hidden");
        syncTopPanelButtons();
      });
    }
    document.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (els.premiumSettingsPanel instanceof HTMLElement && !els.premiumSettingsPanel.classList.contains("hidden")) {
        const hitSettings = target.closest("#premiumSettingsPanel, #premiumSettingsBtn");
        if (!hitSettings) els.premiumSettingsPanel.classList.add("hidden");
      }
      if (els.premiumHistoryPanel instanceof HTMLElement && !els.premiumHistoryPanel.classList.contains("hidden")) {
        const hitHistory = target.closest("#premiumHistoryPanel, #premiumHistoryBtn");
        if (!hitHistory) els.premiumHistoryPanel.classList.add("hidden");
      }
      if (els.fairnessModal instanceof HTMLElement && !els.fairnessModal.classList.contains("hidden")) {
        const hitFairness = target.closest("#fairnessModal, #premiumFairnessBtn");
        if (!hitFairness) els.fairnessModal.classList.add("hidden");
      }
      syncTopPanelButtons();
    });
    if (els.premiumSoundToggle instanceof HTMLButtonElement) {
      els.premiumSoundToggle.addEventListener("click", async () => {
        await audioManager.unlock();
        audioManager.setEnabled(!state.uiSettings.soundEnabled);
      });
    }
    if (els.premiumVolume instanceof HTMLInputElement) {
      els.premiumVolume.addEventListener("input", async () => {
        await audioManager.unlock();
        const next = clamp01((Number(els.premiumVolume.value) || 0) / 100);
        audioManager.setVolume(next);
        state.uiSettings.soundVolume = next;
        saveUiSettings();
        renderPremiumHud();
      });
    }
    if (els.premiumTurboToggle instanceof HTMLInputElement) {
      els.premiumTurboToggle.addEventListener("change", () => {
        state.uiSettings.turbo = Boolean(els.premiumTurboToggle.checked);
        syncTurboSetting();
        saveUiSettings();
        renderPremiumHud();
      });
    }
    if (els.premiumStopBigWin instanceof HTMLInputElement) {
      els.premiumStopBigWin.addEventListener("change", () => {
        state.uiSettings.autoplayStopOnBigWin = Boolean(els.premiumStopBigWin.checked);
        saveUiSettings();
        renderPremiumHud();
      });
    }
    if (els.premiumStopBalance instanceof HTMLInputElement) {
      els.premiumStopBalance.addEventListener("change", () => {
        state.uiSettings.autoplayStopBalance = Math.max(0, Math.floor(Number(els.premiumStopBalance.value) || 0));
        saveUiSettings();
        renderPremiumHud();
      });
    }
    if (els.premiumQuickBet instanceof HTMLSelectElement) {
      els.premiumQuickBet.addEventListener("change", () => {
        const val = Math.max(0, Math.floor(Number(els.premiumQuickBet.value) || 0));
        if (val > 0) {
          state.currentBetValue = val;
          renderMachineStats();
          renderPremiumHud();
        }
        els.premiumQuickBet.value = "";
      });
    }
    if (els.premiumBetMinus instanceof HTMLButtonElement) {
      els.premiumBetMinus.addEventListener("click", () => {
        const machine = getSelectedMachine();
        const base = clampBetToMachine(machine, state.currentBetValue);
        state.currentBetValue = Math.max(1, Math.floor(base * 0.5));
        renderMachineStats();
      });
    }
    if (els.premiumBetPlus instanceof HTMLButtonElement) {
      els.premiumBetPlus.addEventListener("click", () => {
        const machine = getSelectedMachine();
        const base = clampBetToMachine(machine, state.currentBetValue);
        state.currentBetValue = Math.max(1, Math.floor(base * 2));
        renderMachineStats();
      });
    }
    if (els.premiumMaxBet instanceof HTMLButtonElement) {
      els.premiumMaxBet.addEventListener("click", () => {
        const machine = getSelectedMachine();
        if (!machine) return;
        state.currentBetValue = Math.max(machine.minBet, Math.floor(Number(machine.maxBet) || state.currentBetValue || 1));
        renderMachineStats();
      });
    }
    if (els.premiumAutoplaySelect instanceof HTMLSelectElement) {
      els.premiumAutoplaySelect.addEventListener("change", () => {
        const val = Math.max(0, Math.floor(Number(els.premiumAutoplaySelect.value) || 0));
        state.uiSettings.autoplayCount = AUTOPLAY_COUNTS.indexOf(val) >= 0 ? val : 0;
        saveUiSettings();
        renderPremiumHud();
      });
    }
    if (els.premiumAutoplayBtn instanceof HTMLButtonElement) {
      els.premiumAutoplayBtn.addEventListener("click", async () => {
        if (state.autoplay.active) {
          setAutoplayActive(false);
          return;
        }
        const count = Math.max(0, Math.floor(Number(state.uiSettings.autoplayCount) || 0));
        if (count <= 0) return;
        setAutoplayActive(true, count);
        state.autoplay.mode = "spin";
        await runSpin("spin");
      });
    }
    document.addEventListener("pointerdown", (event) => {
      const skipCounter = winCounter && typeof winCounter.isRunning === "function" && winCounter.isRunning();
      const skipTumble = tumbleAnimator && typeof tumbleAnimator.isRunning === "function" && tumbleAnimator.isRunning();
      if (!skipCounter && !skipTumble) return;
      if (skipCounter && typeof winCounter.skip === "function") winCounter.skip();
      if (skipTumble && typeof tumbleAnimator.skip === "function") tumbleAnimator.skip();
      state.winCounterSkipUntil = Date.now() + 180;
      event.preventDefault();
    }, true);
    window.addEventListener("keydown", async (event) => {
      if (event.key !== " " || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      event.preventDefault();
      const skipCounter = winCounter && typeof winCounter.isRunning === "function" && winCounter.isRunning();
      const skipTumble = tumbleAnimator && typeof tumbleAnimator.isRunning === "function" && tumbleAnimator.isRunning();
      if (skipCounter || skipTumble) {
        if (skipCounter && typeof winCounter.skip === "function") winCounter.skip();
        if (skipTumble && typeof tumbleAnimator.skip === "function") tumbleAnimator.skip();
        state.winCounterSkipUntil = Date.now() + 180;
        return;
      }
      await runSpin("spin");
    });
    const unlockAudio = () => { audioManager.unlock(); };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    if (els.authLoginBtn instanceof HTMLButtonElement) els.authLoginBtn.addEventListener("click", () => loginWithPassword(false));
    if (els.authCreateBtn instanceof HTMLButtonElement) els.authCreateBtn.addEventListener("click", () => loginWithPassword(true));
    if (els.authPassword instanceof HTMLInputElement) {
      els.authPassword.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        loginWithPassword(false);
      });
    }
    if (els.walletLabel instanceof HTMLElement) {
      els.walletLabel.addEventListener("click", (event) => {
        event.preventDefault();
        cycleLockDisplayUnit();
      });
    }
    if (els.userBalanceDisplay instanceof HTMLElement) {
      els.userBalanceDisplay.addEventListener("click", (event) => {
        event.preventDefault();
        cycleLockDisplayUnit();
      });
    }
    if (els.machineCategoryTabs instanceof HTMLElement) {
      els.machineCategoryTabs.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const btn = target.closest(".machine-cat-btn");
        if (!(btn instanceof HTMLElement)) return;
        const next = String(btn.dataset.category || "all");
        if (!next || state.machineCategory === next) return;
        state.machineCategory = next;
        renderMachineSelector();
      });
    }

    if (els.machineList instanceof HTMLElement) {
      els.machineList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const item = target.closest(".machine-item");
        if (!(item instanceof HTMLElement)) return;
        const key = String(item.dataset.machineKey || "");
        if (!key) return;
        state.selectedMachineKey = key;
        winPresenter.setCurrentWinValue(0, Math.max(1, Math.floor(Number(state.currentBetValue) || 1)));
        resetEphemeralVisuals();
        clearBonusUiState();
        renderAll();
        switchView("game");
      });
    }

    const betBtns = document.querySelectorAll(".bet-btn");
    betBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const machine = getSelectedMachine();
        if (!machine) return;

        // Prevent changing bet while spin is active or BJ is active
        if (state.spinBusy) return;
        if (machine.type === 'blackjack' && machine.stats.blackjackState && machine.stats.blackjackState.active) return;

        let target = e.target;
        if (!target.dataset.bet && target.parentElement.dataset.bet) target = target.parentElement;

        const val = parseInt(target.dataset.bet, 10);
        if (!isNaN(val)) {
          state.currentBetValue = val;
          betBtns.forEach(b => b.classList.remove("active"));
          target.classList.add("active");
          renderMachineStats();
        }
      });
    });

    if (els.spinBtn instanceof HTMLButtonElement) els.spinBtn.addEventListener("click", () => runSpin("spin"));
    if (els.buyBonusBtn instanceof HTMLButtonElement) els.buyBonusBtn.addEventListener("click", () => runSpin("buybonus"));
    if (els.snoopHypeBtn instanceof HTMLButtonElement) els.snoopHypeBtn.addEventListener("click", () => runSpin("hype"));
    if (els.snoopBuyBtn instanceof HTMLButtonElement) {
      els.snoopBuyBtn.addEventListener("click", () => {
        const scatters = els.snoopBuySelect instanceof HTMLSelectElement
          ? Math.max(3, Math.min(6, Math.floor(Number(els.snoopBuySelect.value) || 3)))
          : 3;
        runSpin("snoop_buy_" + scatters);
      });
    }
    if (els.towerDifficultySelect instanceof HTMLSelectElement) {
      els.towerDifficultySelect.addEventListener("change", () => {
        const machine = getSelectedMachine();
        if (!machine || machine.type !== "tower") return;
        setTowerDifficultyForMachine(machine, els.towerDifficultySelect.value);
        renderAll();
      });
    }
    if (els.towerCashoutBtn instanceof HTMLButtonElement) {
      els.towerCashoutBtn.addEventListener("click", async () => {
        const machine = getSelectedMachine();
        if (!machine || machine.type !== "tower") return;
        await cashOutTowerRun(machine, "cashout");
      });
    }
    if (els.minesCountSelect instanceof HTMLSelectElement) {
      els.minesCountSelect.addEventListener("change", () => {
        const machine = getSelectedMachine();
        if (!machine || machine.type !== "mines") return;
        setMinesCountForMachine(machine, els.minesCountSelect.value);
        renderAll();
      });
    }
    if (els.minesCashoutBtn instanceof HTMLButtonElement) {
      els.minesCashoutBtn.addEventListener("click", async () => {
        const machine = getSelectedMachine();
        if (!machine || machine.type !== "mines") return;
        await cashOutMinesRun(machine, "cashout");
      });
    }
    if (els.slotBoard instanceof HTMLElement) {
      els.slotBoard.addEventListener("click", async (event) => {
        const machine = getSelectedMachine();
        if (!machine || (machine.type !== "tower" && machine.type !== "mines")) return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (machine.type === "tower") {
          const cell = target.closest(".tower-cell");
          if (!(cell instanceof HTMLElement)) return;
          const floor = Math.floor(Number(cell.dataset.floor));
          const col = Math.floor(Number(cell.dataset.col));
          if (!Number.isFinite(floor) || !Number.isFinite(col)) return;
          await handleTowerPick(machine, floor, col);
          return;
        }
        const cell = target.closest(".mines-cell");
        if (!(cell instanceof HTMLElement)) return;
        const tileIndex = Math.floor(Number(cell.dataset.index));
        if (!Number.isFinite(tileIndex)) return;
        await handleMinesPick(machine, tileIndex);
      });
    }

    if (els.bjHitBtn) els.bjHitBtn.addEventListener("click", () => runBlackjackAction("hit"));
    if (els.bjStandBtn) els.bjStandBtn.addEventListener("click", () => runBlackjackAction("stand"));
    if (els.bjDoubleBtn) els.bjDoubleBtn.addEventListener("click", () => runBlackjackAction("double"));
    if (els.bjSplitBtn) els.bjSplitBtn.addEventListener("click", () => runBlackjackAction("split"));

    // Vault Events
    function setVaultButtonsBusy(busy) {
      const flag = Boolean(busy);
      if (els.vaultDepositBtn instanceof HTMLButtonElement) els.vaultDepositBtn.disabled = flag;
      if (els.vaultWithdrawBtn instanceof HTMLButtonElement) els.vaultWithdrawBtn.disabled = flag;
    }

    async function runVaultTransfer(direction) {
      if (!(els.vaultAmount instanceof HTMLInputElement)) return;
      const val = Math.floor(Number(els.vaultAmount.value));
      if (val <= 0 || isNaN(val)) {
        if (els.vaultStatus instanceof HTMLElement) els.vaultStatus.textContent = "Invalid amount.";
        return;
      }
      const isDeposit = direction === "deposit";
      if (els.vaultStatus instanceof HTMLElement) {
        els.vaultStatus.textContent = isDeposit ? "Depositing..." : "Withdrawing...";
      }
      setVaultButtonsBusy(true);
      const tx = isDeposit ? await depositToVault(val) : await withdrawFromVault(val);
      setVaultButtonsBusy(false);

      if (els.vaultStatus instanceof HTMLElement) {
        if (tx && tx.ok) {
          els.vaultStatus.textContent = isDeposit
            ? ("Success! Deposited " + val + " WL.")
            : ("Success! Withdrew " + val + " WL.");
          audioManager.play(isDeposit ? "vault_deposit" : "vault_withdraw");
          els.vaultAmount.value = "";
        } else {
          const reason = tx && tx.reason ? String(tx.reason) : "rejected";
          els.vaultStatus.textContent = "Failed to " + (isDeposit ? "deposit" : "withdraw") + ": " + reason;
        }
      }
      renderVaultPanel();
      renderSession();
      renderMachineStats();
    }

    function canUseVaultCreditAdmin() {
      if (!state.user) return false;
      const role = String(state.user.role || "none").trim().toLowerCase();
      return VAULT_CREDIT_ROLES.has(role);
    }

    async function runAdminVaultCredit() {
      if (!(els.vaultAdminStatus instanceof HTMLElement) || !(els.vaultAdminAmount instanceof HTMLInputElement)) return;
      if (!state.user) {
        els.vaultAdminStatus.textContent = "Login first.";
        return;
      }
      if (!canUseVaultCreditAdmin()) {
        els.vaultAdminStatus.textContent = "Admin permission required.";
        return;
      }
      const amount = Math.max(0, Math.floor(Number(els.vaultAdminAmount.value)));
      if (!amount) {
        els.vaultAdminStatus.textContent = "Invalid credit amount.";
        return;
      }

      const selfName = String(state.user.username || "").trim().toLowerCase();
      const targetInput = (els.vaultAdminTarget instanceof HTMLInputElement)
        ? String(els.vaultAdminTarget.value || "").trim().toLowerCase()
        : "";
      const targetName = targetInput || selfName;
      let targetAccountId = "";
      let targetDisplayName = targetName || selfName;

      if (!targetName || targetName === selfName) {
        targetAccountId = String(state.user.accountId || "").trim();
      } else {
        try {
          const db = await ensureDb();
          const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
          const userSnap = await db.ref(basePath + "/usernames/" + targetName).once("value");
          targetAccountId = String(userSnap && userSnap.val ? (userSnap.val() || "") : "").trim();
        } catch (_error) {
          targetAccountId = "";
        }
      }
      if (!targetAccountId) {
        els.vaultAdminStatus.textContent = "Target user not found.";
        return;
      }

      if (els.vaultAdminCreditBtn instanceof HTMLButtonElement) els.vaultAdminCreditBtn.disabled = true;
      els.vaultAdminStatus.textContent = "Applying admin credit...";
      try {
        const db = await ensureDb();
        const basePath = String(window.GT_SETTINGS && window.GT_SETTINGS.BASE_PATH || "growtopia-test");
        const invRef = db.ref(basePath + "/player-inventories/" + targetAccountId);
        const tx = await invRef.transaction((raw) => {
          const currentObj = raw && typeof raw === "object" ? { ...raw } : {};
          const vault = toCount(currentObj.web_vault_balance);
          const nextVault = vault + amount;
          currentObj.web_vault_balance = nextVault;
          currentObj.web_vault_balance_backup = nextVault;
          return currentObj;
        });
        if (!tx || !tx.committed) {
          els.vaultAdminStatus.textContent = "Credit was rejected.";
          return;
        }

        if (targetAccountId === String(state.user.accountId || "").trim()) {
          const wallet = toWallet(tx.snapshot && typeof tx.snapshot.val === "function" ? tx.snapshot.val() : {});
          state.walletLocks = wallet.total;
          state.webVaultLocks = wallet.vault;
          state.walletBreakdownText = walletText(wallet.byId);
          syncVaultBackupForCurrentUser(wallet.vault);
          renderSession();
          renderMachineStats();
        }

        db.ref(basePath + "/admin-audit").push({
          action: "vault_credit",
          actorAccountId: String(state.user.accountId || "").trim(),
          actorUsername: String(state.user.username || "admin").slice(0, 20),
          targetAccountId: targetAccountId,
          targetUsername: String(targetDisplayName || targetName || "").slice(0, 20),
          amount: amount,
          level: "warn",
          createdAt: Date.now()
        }).catch(() => {});

        audioManager.play("admin_credit");
        els.vaultAdminStatus.textContent = "Added " + amount + " WL to @" + String(targetDisplayName || targetName || "user") + ".";
        els.vaultAdminAmount.value = "";
      } catch (error) {
        els.vaultAdminStatus.textContent = "Credit failed: " + ((error && error.message) || "unknown error");
      } finally {
        if (els.vaultAdminCreditBtn instanceof HTMLButtonElement) els.vaultAdminCreditBtn.disabled = false;
      }
    }

    if (els.openVaultBtn instanceof HTMLButtonElement) {
      els.openVaultBtn.addEventListener("click", () => {
        if (!state.user || !(els.vaultModal instanceof HTMLElement)) return;
        renderVaultPanel();
        if (els.vaultStatus instanceof HTMLElement) els.vaultStatus.textContent = "Ready.";
        const canCredit = canUseVaultCreditAdmin();
        if (els.vaultAdminPanel instanceof HTMLElement) {
          els.vaultAdminPanel.classList.toggle("hidden", !canCredit);
        }
        if (canCredit && els.vaultAdminTarget instanceof HTMLInputElement && !els.vaultAdminTarget.value) {
          els.vaultAdminTarget.value = String(state.user.username || "");
        }
        if (els.vaultAdminStatus instanceof HTMLElement) {
          els.vaultAdminStatus.textContent = canCredit
            ? "Admin wallet credit ready."
            : "Admin wallet credit hidden.";
        }
        els.vaultModal.classList.remove("hidden");
      });
    }
    if (els.closeVaultBtn instanceof HTMLButtonElement) {
      els.closeVaultBtn.addEventListener("click", () => {
        if (els.vaultModal instanceof HTMLElement) els.vaultModal.classList.add("hidden");
      });
    }
    if (els.vaultDepositBtn instanceof HTMLButtonElement) {
      els.vaultDepositBtn.addEventListener("click", async () => runVaultTransfer("deposit"));
    }
    if (els.vaultWithdrawBtn instanceof HTMLButtonElement) {
      els.vaultWithdrawBtn.addEventListener("click", async () => runVaultTransfer("withdraw"));
    }
    if (els.vaultAmount instanceof HTMLInputElement) {
      els.vaultAmount.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        runVaultTransfer("deposit");
      });
    }
    if (els.vaultAdminCreditBtn instanceof HTMLButtonElement) {
      els.vaultAdminCreditBtn.addEventListener("click", async () => {
        await runAdminVaultCredit();
      });
    }
    if (els.vaultAdminAmount instanceof HTMLInputElement) {
      els.vaultAdminAmount.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        runAdminVaultCredit();
      });
    }
    const quickVaultBtns = document.querySelectorAll("[data-vault-amount]");
    quickVaultBtns.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      btn.addEventListener("click", () => {
        if (!(els.vaultAmount instanceof HTMLInputElement)) return;
        const val = Math.max(1, Math.floor(Number(btn.dataset.vaultAmount) || 0));
        if (!val) return;
        els.vaultAmount.value = String(val);
        els.vaultAmount.focus();
      });
    });

    if (els.backToLobbyBtn instanceof HTMLButtonElement) {
      els.backToLobbyBtn.addEventListener("click", () => switchView("lobby"));
    }

    window.addEventListener("beforeunload", () => { clearSessionRefs(); });
  }

  async function init() {
    if (document.body instanceof HTMLElement) document.body.classList.add("casino-premium");
    populateMinesCountSelect();
    applyUiSettings(loadUiSettings());
    bindEvents();

    if (els.premiumSeedLabel instanceof HTMLElement) {
      const seed = "seed-" + Math.random().toString(36).slice(2, 12);
      els.premiumSeedLabel.textContent = seed;
    }

    const saved = loadSavedCredentials();
    if (els.authUsername instanceof HTMLInputElement && saved.username) els.authUsername.value = String(saved.username || "").slice(0, 20);
    if (els.authPassword instanceof HTMLInputElement && saved.password) els.authPassword.value = String(saved.password || "").slice(0, 64);

    // Populate with casino games instead of loading from world
    state.machines = GAME_IDS.map(type => {
      const def = MACHINE_DEFS[type] || MACHINE_DEFS.slots;
      return {
        ...STANDALONE_MACHINE,
        tileKey: "demo_" + type,
        type: type,
        typeName: def.name,
        minBet: def.minBet,
        maxBet: def.maxBet,
        volatility: String(def.volatility || "medium"),
        reels: def.reels,
        rows: def.rows,
        maxPayoutMultiplier: def.maxPayoutMultiplier,
        stats: { ...STANDALONE_MACHINE.stats }
      };
    });
    state.selectedMachineKey = state.machines[0].tileKey;

    setStatus(els.authStatus, "Login with your game account.");

    const transferResumed = await attemptSessionTransferResume().catch(() => false);
    const resumed = transferResumed ? true : await attemptSavedSessionResume().catch(() => false);
    if (!resumed) {
      switchView("login");
    }
    renderAll();
  }

  init().catch(() => {
    switchView("login");
    renderAll();
  });
})();
