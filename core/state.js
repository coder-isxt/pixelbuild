window.GTModules = window.GTModules || {};
window.GTState = window.GTState || {};

window.GTModules.state = (function createStateModule() {
  const root = window.GTState;

  function aliasGlobal(name) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    if (descriptor && !descriptor.configurable) return;
    Object.defineProperty(globalThis, name, {
      configurable: true,
      enumerable: false,
      get() {
        return root[name];
      },
      set(value) {
        root[name] = value;
      }
    });
  }

  function ensure(name, initFactory) {
    if (!Object.prototype.hasOwnProperty.call(root, name)) {
      root[name] = typeof initFactory === "function" ? initFactory() : initFactory;
    }
    aliasGlobal(name);
    return root[name];
  }

  function setValue(name, value) {
    root[name] = value;
    aliasGlobal(name);
    return value;
  }

  function buildWeatherPresets(images) {
    const rows = Array.isArray(images) ? images : [];
    const out = [{ id: "none", name: "Default Sky", url: "" }];
    const seen = new Set(["none"]);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const id = String(row.id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
      const name = String(row.name || "").trim().slice(0, 36);
      const url = String(row.url || "").trim().slice(0, 420);
      if (!id || seen.has(id)) continue;
      out.push({ id, name: name || id, url });
      seen.add(id);
    }
    return out;
  }

  const DEFAULT_DOM_REF_MAP = {
    authScreenEl: "authScreen",
    gameShellEl: "gameShell",
    authUsernameEl: "authUsername",
    authPasswordEl: "authPassword",
    authCreateBtn: "authCreateBtn",
    authLoginBtn: "authLoginBtn",
    authStatusEl: "authStatus",
    authMainNoticeEl: "authMainNotice",
    canvas: "game",
    toolbarEl: "toolbar",
    leftPanelResizeHandleEl: "leftPanelResizeHandle",
    rightPanelResizeHandleEl: "rightPanelResizeHandle",
    canvasWrapEl: "canvasWrap",
    menuScreenEl: "menuScreen",
    menuMainNoticeEl: "menuMainNotice",
    mobileControlsEl: "mobileControls",
    mobileLeftBtn: "mobileLeftBtn",
    mobileRightBtn: "mobileRightBtn",
    mobileJumpBtn: "mobileJumpBtn",
    mobilePrimaryBtn: "mobilePrimaryBtn",
    mobileSecondaryBtn: "mobileSecondaryBtn",
    mobileFistBtn: "mobileFistBtn",
    mobileWrenchBtn: "mobileWrenchBtn",
    mobilePlayModeBtn: "mobilePlayModeBtn",
    mobileChatBtn: "mobileChatBtn",
    mobileInventoryBtn: "mobileInventoryBtn",
    mobileExitBtn: "mobileExitBtn",
    networkStateEl: "networkState",
    gemsCountEl: "gemsCount",
    onlineCountEl: "onlineCount",
    totalOnlineCountEl: "totalOnlineCount",
    currentWorldLabelEl: "currentWorldLabel",
    worldButtonsEl: "worldButtons",
    worldInputEl: "worldInput",
    enterWorldBtn: "enterWorldBtn",
    chatToggleBtn: "chatToggleBtn",
    friendsToggleBtn: "friendsToggleBtn",
    titlesToggleBtn: "titlesToggleBtn",
    questsToggleBtn: "questsToggleBtn",
    achievementsToggleBtn: "achievementsToggleBtn",
    shopToggleBtn: "shopToggleBtn",
    adminToggleBtn: "adminToggleBtn",
    respawnBtn: "respawnBtn",
    adminPanelEl: "adminPanel",
    adminSearchInput: "adminSearchInput",
    adminAuditActionFilterEl: "adminAuditActionFilter",
    adminAuditActorFilterEl: "adminAuditActorFilter",
    adminAuditTargetFilterEl: "adminAuditTargetFilter",
    adminForceReloadBtn: "adminForceReloadBtn",
    adminBackupDownloadBtn: "adminBackupDownloadBtn",
    adminBackupUploadBtn: "adminBackupUploadBtn",
    adminBackupUploadInput: "adminBackupUploadInput",
    adminAuditExportBtn: "adminAuditExportBtn",
    adminCloseBtn: "adminCloseBtn",
    adminAccountsEl: "adminAccounts",
    adminInventoryModalEl: "adminInventoryModal",
    adminInventoryTitleEl: "adminInventoryTitle",
    adminInventoryBodyEl: "adminInventoryBody",
    adminInventoryCloseBtn: "adminInventoryCloseBtn",
    vendingModalEl: "vendingModal",
    vendingTitleEl: "vendingTitle",
    vendingBodyEl: "vendingBody",
    vendingActionsEl: "vendingActions",
    vendingCloseBtn: "vendingCloseBtn",
    donationModalEl: "donationModal",
    donationTitleEl: "donationTitle",
    donationBodyEl: "donationBody",
    donationActionsEl: "donationActions",
    donationCloseBtn: "donationCloseBtn",
    chestModalEl: "chestModal",
    chestTitleEl: "chestTitle",
    chestBodyEl: "chestBody",
    chestActionsEl: "chestActions",
    chestCloseBtn: "chestCloseBtn",
    gambleModalEl: "gambleModal",
    gambleTitleEl: "gambleTitle",
    gambleBodyEl: "gambleBody",
    gambleActionsEl: "gambleActions",
    gambleCloseBtn: "gambleCloseBtn",
    signModalEl: "signModal",
    signTitleEl: "signTitle",
    signTextInputEl: "signTextInput",
    signSaveBtn: "signSaveBtn",
    signCloseBtn: "signCloseBtn",
    announcementPopupEl: "announcementPopup",
    announcementTextEl: "announcementText",
    tradeMenuModalEl: "tradeMenuModal",
    tradeMenuTitleEl: "tradeMenuTitle",
    tradeMenuCloseBtn: "tradeMenuCloseBtn",
    tradeStartBtn: "tradeStartBtn",
    tradeCancelBtn: "tradeCancelBtn",
    tradeRequestModalEl: "tradeRequestModal",
    tradeRequestTextEl: "tradeRequestText",
    tradeAcceptBtn: "tradeAcceptBtn",
    tradeDeclineBtn: "tradeDeclineBtn",
    profileModalEl: "profileModal",
    profileTitleEl: "profileTitle",
    profileBodyEl: "profileBody",
    profileActionsEl: "profileActions",
    profileCloseBtn: "profileCloseBtn",
    friendsModalEl: "friendsModal",
    friendsTitleEl: "friendsTitle",
    friendsBodyEl: "friendsBody",
    friendsActionsEl: "friendsActions",
    friendsCloseBtn: "friendsCloseBtn",
    titlesModalEl: "titlesModal",
    titlesTitleEl: "titlesTitle",
    titlesBodyEl: "titlesBody",
    titlesActionsEl: "titlesActions",
    titlesCloseBtn: "titlesCloseBtn",
    achievementsModalEl: "achievementsModal",
    achievementsTitleEl: "achievementsTitle",
    achievementsBodyEl: "achievementsBody",
    achievementsActionsEl: "achievementsActions",
    achievementsCloseBtn: "achievementsCloseBtn",
    questsModalEl: "questsModal",
    questsTitleEl: "questsTitle",
    questsBodyEl: "questsBody",
    questsActionsEl: "questsActions",
    questsCloseBtn: "questsCloseBtn",
    worldLockModalEl: "worldLockModal",
    worldLockTitleEl: "worldLockTitle",
    worldLockAdminInputEl: "worldLockAdminInput",
    worldLockAdminAddBtn: "worldLockAdminAddBtn",
    worldLockAdminsEl: "worldLockAdmins",
    worldLockBanInputEl: "worldLockBanInput",
    worldLockBan1hBtn: "worldLockBan1hBtn",
    worldLockBanPermBtn: "worldLockBanPermBtn",
    worldLockBansEl: "worldLockBans",
    worldLockCloseBtn: "worldLockCloseBtn",
    ownerTaxModalEl: "ownerTaxModal",
    ownerTaxTitleEl: "ownerTaxTitle",
    ownerTaxPercentInputEl: "ownerTaxPercentInput",
    ownerTaxBankLabelEl: "ownerTaxBankLabel",
    ownerTaxSaveBtn: "ownerTaxSaveBtn",
    ownerTaxCollectBtn: "ownerTaxCollectBtn",
    ownerTaxCloseBtn: "ownerTaxCloseBtn",
    doorModalEl: "doorModal",
    doorTitleEl: "doorTitle",
    doorPublicBtn: "doorPublicBtn",
    doorOwnerOnlyBtn: "doorOwnerOnlyBtn",
    doorCloseBtn: "doorCloseBtn",
    cameraModalEl: "cameraModal",
    cameraTitleEl: "cameraTitle",
    cameraCloseBtn: "cameraCloseBtn",
    cameraSaveBtn: "cameraSaveBtn",
    cameraEventJoinEl: "cameraEventJoin",
    cameraEventLeaveEl: "cameraEventLeave",
    cameraEventVendingEl: "cameraEventVending",
    cameraFilterStaffEl: "cameraFilterStaff",
    cameraLogsListEl: "cameraLogsList",
    weatherModalEl: "weatherModal",
    weatherTitleEl: "weatherTitle",
    weatherCloseBtn: "weatherCloseBtn",
    weatherPresetSelectEl: "weatherPresetSelect",
    weatherImageUrlInputEl: "weatherImageUrlInput",
    weatherResolvedLabelEl: "weatherResolvedLabel",
    weatherPreviewImgEl: "weatherPreviewImg",
    weatherPreviewEmptyEl: "weatherPreviewEmpty",
    weatherSaveBtn: "weatherSaveBtn",
    weatherClearBtn: "weatherClearBtn",
    updatingOverlayEl: "updatingOverlay",
    chatPanelEl: "chatPanel",
    chatMessagesEl: "chatMessages",
    chatInputRowEl: "chatInputRow",
    chatInputEl: "chatInput",
    chatSendBtn: "chatSendBtn",
    logsMessagesEl: "logsMessages",
    exitWorldBtn: "exitWorldBtn",
    logoutBtn: "logoutBtn"
  };

  function buildDefaultModuleRefMap() {
    return {
      adminModule: "admin",
      blocksModule: "blocks",
      farmablesModule: "farmables",
      seedsModule: "seeds",
      plantsModule: "plants",
      gemsModule: "gems",
      rewardsModule: "rewards",
      texturesModule: "textures",
      blockKeysModule: "blockKeys",
      itemsModule: "items",
      cosmeticsModule: "cosmetics",
      playerModule: "player",
      adminsModule: "admins",
      authModule: "auth",
      authStorageModule: "authStorage",
      dbModule: "db",
      worldModule: "world",
      physicsModule: "physics",
      animationsModule: "animations",
      particlesModule: "particles",
      drawUtilsModule: "drawUtils",
      drawModule: "draw",
      stateModule: "state",
      eventsModule: {
        keys: ["events"],
        fallback: {
          on(target, type, listener, options) {
            if (!target || typeof target.addEventListener !== "function") return false;
            target.addEventListener(type, listener, options);
            return true;
          }
        }
      },
      inputUtilsModule: "inputUtils",
      syncPlayerModule: "syncPlayer",
      syncBlocksModule: "syncBlocks",
      syncWorldsModule: "syncWorlds",
      syncHitsModule: "syncHits",
      commandsModule: "commands",
      chatModule: "chat",
      menuModule: "menu",
      messagesModule: "messages",
      anticheatModule: "anticheat",
      progressionModule: "progression",
      achievementsModule: "achievements",
      questsModule: "quests",
      gachaModule: "gacha",
      backupModule: "backup",
      vendingModule: "vending",
      donationModule: "donation",
      chestModule: "chest",
      friendsModule: "friends",
      tradeModule: "trade",
      shopModule: "shop",
      signModule: "sign",
      gambleModule: ["gambling", "gamble"],
      dropsModule: "drops",
      adminPanelModule: "adminPanel",
      questWorldModule: "questWorld"
    };
  }

  function initDomRefs(refMap) {
    const map = refMap && typeof refMap === "object" ? refMap : {};
    const keys = Object.keys(map);
    for (let i = 0; i < keys.length; i++) {
      const name = keys[i];
      const id = String(map[name] || "").trim();
      if (!id) continue;
      root[name] = document.getElementById(id);
      aliasGlobal(name);
    }
    return root;
  }

  function initDefaultDomRefs() {
    return initDomRefs(DEFAULT_DOM_REF_MAP);
  }

  function resolveModuleSpec(modules, spec) {
    if (typeof spec === "string") {
      return modules[spec] || {};
    }
    if (Array.isArray(spec)) {
      for (let i = 0; i < spec.length; i++) {
        const key = String(spec[i] || "").trim();
        if (!key) continue;
        if (modules[key] !== undefined) return modules[key] || {};
      }
      return {};
    }
    if (spec && typeof spec === "object") {
      const keys = Array.isArray(spec.keys) ? spec.keys : [];
      for (let i = 0; i < keys.length; i++) {
        const key = String(keys[i] || "").trim();
        if (!key) continue;
        if (modules[key] !== undefined) return modules[key] || {};
      }
      return spec.fallback !== undefined ? spec.fallback : {};
    }
    return {};
  }

  function initModuleRefs(options) {
    const opts = options || {};
    const modules = opts.modules && typeof opts.modules === "object" ? opts.modules : {};
    const map = opts.map && typeof opts.map === "object" ? opts.map : {};
    const names = Object.keys(map);
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      root[name] = resolveModuleSpec(modules, map[name]);
      aliasGlobal(name);
    }
    return root;
  }

  function initDefaultModuleRefs(modules) {
    const moduleBag = modules && typeof modules === "object" ? modules : (window.GTModules || {});
    setValue("modules", moduleBag);
    return initModuleRefs({
      modules: moduleBag,
      map: buildDefaultModuleRefMap()
    });
  }

  function initCoreState(options) {
    const opts = options || {};
    const settings = opts.settings && typeof opts.settings === "object"
      ? opts.settings
      : (window.GT_SETTINGS || {});
    const adminModuleRef = root.adminModule && typeof root.adminModule === "object" ? root.adminModule : {};
    const blocksModuleRef = root.blocksModule && typeof root.blocksModule === "object" ? root.blocksModule : {};
    const farmablesModuleRef = root.farmablesModule && typeof root.farmablesModule === "object" ? root.farmablesModule : {};

    setValue("SETTINGS", settings);
    setValue("TILE", Number(settings.TILE_SIZE) || 32);
    setValue("WORLD_W", Number(settings.WORLD_WIDTH_TILES) || 140);
    setValue("WORLD_H", Number(settings.WORLD_HEIGHT_TILES) || 30);
    setValue("GRAVITY", Number(settings.GRAVITY) || 0.32);
    setValue("FRICTION", Number(settings.FRICTION_GROUND) || 0.86);
    setValue("AIR_CONTROL", Number(settings.AIR_CONTROL) || 0.6);
    setValue("AIR_FRICTION", Number(settings.FRICTION_AIR) || 0.94);
    setValue("PLAYER_W", Number(settings.PLAYER_WIDTH) || 22);
    setValue("PLAYER_H", Number(settings.PLAYER_HEIGHT) || 30);
    setValue("WATER_MOVE_MULT", 0.62);
    setValue("WATER_GRAVITY_MULT", 0.35);
    setValue("WATER_FALL_MULT", 0.52);
    setValue("WATER_FRICTION_MULT", 0.86);
    setValue("ANTI_GRAV_RADIUS_TILES", Math.max(2, Number(settings.ANTI_GRAV_RADIUS_TILES) || 8));
    setValue("ANTI_GRAV_GRAVITY_MULT", Math.max(0.05, Math.min(1, Number(settings.ANTI_GRAV_GRAVITY_MULT) || 0.2)));
    setValue("ANTI_GRAV_FALL_MULT", Math.max(0.05, Math.min(1, Number(settings.ANTI_GRAV_FALL_MULT) || 0.42)));
    setValue("ANTI_GRAV_AIR_JUMP_COOLDOWN_MS", Math.max(70, Number(settings.ANTI_GRAV_AIR_JUMP_COOLDOWN_MS) || 140));
    setValue("BASE_PATH", typeof settings.BASE_PATH === "string" && settings.BASE_PATH ? settings.BASE_PATH : "growtopia-test");
    setValue("LOG_VIEWER_USERNAMES", Array.isArray(settings.LOG_VIEWER_USERNAMES) ? settings.LOG_VIEWER_USERNAMES : ["isxt"]);
    const DEFAULT_ADMIN_ROLE_RANK = { none: 0, moderator: 1, admin: 2, manager: 3, owner: 4 };
    const DEFAULT_ADMIN_PERMISSIONS = {
      owner: ["panel_open", "view_logs", "view_audit", "clear_logs", "force_reload", "db_backup", "db_restore", "setrole", "tempban", "permban", "unban", "kick", "resetinv", "givex", "give_block", "give_item", "give_title", "remove_title", "tp", "reach", "bring", "summon", "freeze", "unfreeze", "godmode", "clearworld", "announce", "announce_user"],
      manager: ["panel_open", "view_logs", "view_audit", "clear_logs", "setrole_limited", "tempban", "permban", "unban", "kick", "resetinv", "givex", "give_block", "give_item", "give_title", "remove_title", "tp", "reach", "bring", "summon", "freeze", "unfreeze", "godmode", "clearworld", "announce", "announce_user"],
      admin: ["panel_open", "view_logs", "view_audit", "kick", "resetinv", "givex", "give_block", "give_item", "give_title", "remove_title", "tp", "reach", "bring", "summon", "freeze", "unfreeze", "godmode", "clearworld", "announce", "announce_user"],
      moderator: ["panel_open", "kick", "tp", "reach", "bring", "summon", "announce", "announce_user"],
      none: []
    };
    const DEFAULT_ADMIN_COMMAND_COOLDOWNS_MS = {
      owner: {},
      manager: { tempban: 2000, permban: 2000, unban: 1000, kick: 700, give_block: 600, give_item: 600, givetitle: 600, removetitle: 600, tp: 300, reach: 500, bring: 700, summon: 700, setrole: 2000, freeze: 700, unfreeze: 700, godmode: 700, clearworld: 2500, announce: 500, announce_user: 500 },
      admin: { kick: 900, give_block: 900, give_item: 900, givetitle: 900, removetitle: 900, tp: 400, reach: 600, bring: 900, summon: 900, freeze: 900, unfreeze: 900, godmode: 900, clearworld: 3000, announce: 700, announce_user: 700 },
      moderator: { kick: 1200, tp: 600, reach: 900, bring: 1200, summon: 1200, announce: 900, announce_user: 900 },
      none: {}
    };
    const moduleRoleConfig = typeof adminModuleRef.createRoleConfig === "function"
      ? (adminModuleRef.createRoleConfig(settings) || {})
      : {};
    const hasEntries = (value) => Boolean(value && typeof value === "object" && Object.keys(value).length);
    setValue("adminRoleConfig", {
      roleRank: settings.ADMIN_ROLE_RANK && typeof settings.ADMIN_ROLE_RANK === "object"
        ? settings.ADMIN_ROLE_RANK
        : (hasEntries(moduleRoleConfig.roleRank) ? moduleRoleConfig.roleRank : DEFAULT_ADMIN_ROLE_RANK),
      permissions: settings.ADMIN_PERMISSIONS && typeof settings.ADMIN_PERMISSIONS === "object"
        ? settings.ADMIN_PERMISSIONS
        : (hasEntries(moduleRoleConfig.permissions) ? moduleRoleConfig.permissions : DEFAULT_ADMIN_PERMISSIONS),
      commandCooldownsMs: settings.ADMIN_COMMAND_COOLDOWNS_MS && typeof settings.ADMIN_COMMAND_COOLDOWNS_MS === "object"
        ? settings.ADMIN_COMMAND_COOLDOWNS_MS
        : (hasEntries(moduleRoleConfig.commandCooldownsMs) ? moduleRoleConfig.commandCooldownsMs : DEFAULT_ADMIN_COMMAND_COOLDOWNS_MS),
      roleByUsername: settings.ADMIN_ROLE_BY_USERNAME && typeof settings.ADMIN_ROLE_BY_USERNAME === "object"
        ? settings.ADMIN_ROLE_BY_USERNAME
        : (moduleRoleConfig.roleByUsername && typeof moduleRoleConfig.roleByUsername === "object" ? moduleRoleConfig.roleByUsername : {}),
      adminUsernames: Array.isArray(settings.ADMIN_USERNAMES)
        ? settings.ADMIN_USERNAMES
        : (Array.isArray(moduleRoleConfig.adminUsernames) && moduleRoleConfig.adminUsernames.length ? moduleRoleConfig.adminUsernames : ["isxt"])
    });
    setValue("JUMP_COOLDOWN_MS", Number(settings.JUMP_COOLDOWN_MS) || 200);
    setValue("PLAYER_SYNC_MIN_MS", Math.max(25, Number(settings.PLAYER_SYNC_MIN_MS) || 60));
    setValue("GLOBAL_SYNC_MIN_MS", Math.max(root.PLAYER_SYNC_MIN_MS, Number(settings.GLOBAL_SYNC_MIN_MS) || 170));
    setValue("LAYOUT_PREFS_KEY", "gt_layout_panels_v3");
    setValue("DESKTOP_PANEL_LEFT_DEFAULT", 302);
    setValue("DESKTOP_PANEL_RIGHT_DEFAULT", 375);
    setValue("DESKTOP_PANEL_MIN", 140);
    setValue("DESKTOP_PANEL_MAX_RATIO", 0.26);
    setValue("MOVE_ACCEL", Number(settings.MOVE_ACCEL) || 0.46);
    setValue("JUMP_VELOCITY", Number(settings.JUMP_VELOCITY) || -7.2);
    setValue("MAX_MOVE_SPEED", Number(settings.MAX_MOVE_SPEED) || 3.7);
    setValue("MAX_FALL_SPEED", Number(settings.MAX_FALL_SPEED) || 10);
    setValue("WEATHER_PRESET_IMAGES", Array.isArray(settings.WEATHER_PRESET_IMAGES) ? settings.WEATHER_PRESET_IMAGES : []);
    setValue("SAVED_AUTH_KEY", "growtopia_saved_auth_v1");
    setValue("FORCE_RELOAD_MARKER_KEY", "growtopia_force_reload_marker_v1");
    setValue("FORCE_RELOAD_NOTICE_KEY", "growtopia_force_reload_notice_v1");
    setValue("CAMERA_ZOOM_PREF_KEY", "growtopia_camera_zoom_v1");
    setValue("CAMERA_ZOOM_MIN", Math.max(0.5, Number(settings.CAMERA_ZOOM_MIN) || 0.7));
    setValue("CAMERA_ZOOM_MAX", Math.max(root.CAMERA_ZOOM_MIN + 0.1, Number(settings.CAMERA_ZOOM_MAX) || 2.2));
    setValue("CAMERA_ZOOM_STEP", Math.max(0.05, Number(settings.CAMERA_ZOOM_STEP) || 0.12));

    const baseDefs = typeof blocksModuleRef.getBlockDefs === "function" ? blocksModuleRef.getBlockDefs() : {};
    const rawFarmableDefs = typeof farmablesModuleRef.getFarmableDefs === "function" ? farmablesModuleRef.getFarmableDefs() : {};
    const mergedFarmableDefs = {};
    const farmableBlockIdCollisions = [];
    Object.keys(rawFarmableDefs || {}).forEach((idRaw) => {
      const id = Math.floor(Number(idRaw));
      if (!Number.isInteger(id) || id < 0) return;
      if (baseDefs[id]) {
        farmableBlockIdCollisions.push(id);
        return;
      }
      mergedFarmableDefs[id] = rawFarmableDefs[id];
    });
    if (farmableBlockIdCollisions.length) {
      console.warn("[farmables] Ignoring overlapping farmable ids:", farmableBlockIdCollisions.join(", "));
    }
    setValue("baseBlockDefs", baseDefs);
    setValue("farmableBlockDefs", mergedFarmableDefs);
    setValue("farmableBlockIdCollisions", farmableBlockIdCollisions);
    setValue("worldBlockDefs", { ...baseDefs, ...mergedFarmableDefs });
    setValue("SPAWN_TILE_X", 8);
    setValue("SPAWN_TILE_Y", 11);
    setValue("SPAWN_DOOR_ID", 7);
    setValue("SPAWN_BASE_ID", 8);
    setValue("SPAWN_MOVER_ID", 40);
    setValue("WORLD_LOCK_ID", 9);
    setValue("DOOR_BLOCK_ID", 10);
    setValue("WATER_ID", 11);
    setValue("PLATFORM_ID", 12);
    setValue("STAIR_BASE_ID", 13);
    setValue("STAIR_ROTATION_IDS", [13, 14, 15, 16]);
    setValue("SPIKE_BASE_ID", 33);
    setValue("SPIKE_ROTATION_IDS", [33, 37, 38, 39]);
    setValue("VENDING_ID", 17);
    setValue("GAMBLE_ID", 32);
    setValue("SIGN_ID", 18);
    setValue("ANTI_GRAV_ID", 19);
    setValue("CAMERA_ID", 20);
    setValue("WEATHER_MACHINE_ID", 21);
    setValue("DISPLAY_BLOCK_ID", 22);
    setValue("WOOD_PLANK_ID", 23);
    setValue("OBSIDIAN_LOCK_ID", 24);
    setValue("EMERALD_LOCK_ID", 42);
    setValue("TAX_BLOCK_ID", 52);
    setValue("QUEST_NPC_ID", 53);
    setValue("DONATION_BOX_ID", 34);
    setValue("STORAGE_CHEST_ID", 36);
    setValue("TREE_YIELD_BLOCK_ID", 4);
    setValue("TREE_GROW_MS", Math.max(5000, Number(settings.TREE_GROW_MS) || 120000));
    setValue("TREE_STAGE_COUNT", 4);
    setValue("TREE_GEM_MIN", Math.max(0, Math.floor(Number(settings.TREE_GEM_MIN) || 1)));
    setValue("TREE_GEM_MAX", Math.max(root.TREE_GEM_MIN, Math.floor(Number(settings.TREE_GEM_MAX) || 4)));
    setValue("SEED_DROP_CHANCE", 1 / 8);
    setValue("BREAK_RETURN_ITEM_CHANCE", 1 / 5);
    setValue("PASSIVE_LOCK_AUTOCONVERT", Boolean(settings.PASSIVE_LOCK_AUTOCONVERT));
    setValue("INVENTORY_ITEM_LIMIT", 300);
    setValue("spawnTileX", root.SPAWN_TILE_X);
    setValue("spawnTileY", root.SPAWN_TILE_Y);
    setValue("DEFAULT_EDIT_REACH_TILES", 4.5);
    setValue("MIN_EDIT_REACH_TILES", 1);
    setValue("MAX_EDIT_REACH_TILES", 16);
    setValue("TOOL_FIST", "fist");
    setValue("TOOL_WRENCH", "wrench");
    setValue(
      "farmableRegistry",
      typeof farmablesModuleRef.createRegistry === "function"
        ? farmablesModuleRef.createRegistry(root.farmableBlockDefs, {})
        : {
            ids: [],
            byId: {},
            isFarmable: () => false,
            rollGems: () => 0,
            getBreakXp: (_id, fallbackXp) => Math.max(1, Math.floor(Number(fallbackXp) || 1))
          }
    );

    return root;
  }

  function initRuntimeState(options) {
    const opts = options || {};
    const inventoryIds = Array.isArray(opts.inventoryIds) ? opts.inventoryIds : [];
    const titleCatalog = Array.isArray(opts.titleCatalog) ? opts.titleCatalog : [];
    const cosmeticItems = Array.isArray(opts.cosmeticItems) ? opts.cosmeticItems : [];
    const cosmeticSlots = Array.isArray(opts.cosmeticSlots) ? opts.cosmeticSlots : [];

    ensure("cosmeticImageCache", () => new Map());
    ensure("blockImageCache", () => new Map());
    ensure("waterFramePathCache", () => []);
    ensure("WATER_FRAME_MS", () => Math.max(80, Number(opts.waterFrameMs) || 170));
    ensure("WEATHER_PRESETS", () => buildWeatherPresets(opts.weatherPresetImages));
    ensure("WEATHER_PRESET_MAP", () => new Map((root.WEATHER_PRESETS || []).map((preset) => [preset.id, preset])));
    ensure("inventory", () => {
      const inv = {};
      for (let i = 0; i < inventoryIds.length; i++) {
        inv[inventoryIds[i]] = 0;
      }
      return inv;
    });
    ensure("selectedSlot", () => 0);
    ensure("keys", () => ({}));
    ensure("playerId", () => "p_" + Math.random().toString(36).slice(2, 10));
    ensure("playerName", () => "");
    ensure("playerProfileId", () => "");
    ensure("playerSessionRef", () => null);
    ensure("playerSessionId", () => "");
    ensure("playerSessionStartedAt", () => 0);
    ensure("progressionXp", () => 0);
    ensure("progressionLevel", () => 1);
    ensure("progressionXpIntoLevel", () => 0);
    ensure("progressionXpForNext", () => 100);
    ensure("progressionSaveTimer", () => 0);
    ensure("achievementsState", () => null);
    ensure("achievementsSaveTimer", () => 0);
    ensure("questsState", () => null);
    ensure("questsSaveTimer", () => 0);
    ensure("worldChatStartedAt", () => 0);
    ensure("desktopLeftPanelWidth", () => Math.floor(Number(opts.desktopPanelLeftDefault) || 0));
    ensure("desktopRightPanelWidth", () => Math.floor(Number(opts.desktopPanelRightDefault) || 0));
    ensure("layoutResizeSide", () => "");
    ensure("gameBootstrapped", () => false);
    ensure("pendingTeleportSelf", () => null);
    ensure("lastHandledTeleportCommandId", () => "");
    ensure("hasSeenInitialTeleportCommandSnapshot", () => false);
    ensure("lastHandledReachCommandId", () => "");
    ensure("lastPrivateMessageFrom", () => null);
    ensure("worldJoinRequestToken", () => 0);
    ensure("remotePlayers", () => new Map());
    ensure("remoteAnimationTracker", () => {
      const moduleRef = opts.animationsModule || {};
      if (typeof moduleRef.createTracker === "function") {
        return moduleRef.createTracker();
      }
      return new Map();
    });
    ensure("remoteHitTracker", () => {
      const moduleRef = opts.syncHitsModule || {};
      if (typeof moduleRef.createRemoteHitTracker === "function") {
        return moduleRef.createRemoteHitTracker();
      }
      return new Map();
    });
    ensure("overheadChatByPlayer", () => new Map());
    ensure("displayItemsByTile", () => new Map());
    ensure("doorAccessByTile", () => new Map());
    ensure("antiGravityByTile", () => new Map());
    ensure("cameraConfigsByTile", () => new Map());
    ensure("cameraLogsByTile", () => new Map());
    ensure("localWeatherByWorld", () => new Map());
    ensure("worldOccupancy", () => new Map());
    ensure("worldLockOwnerCache", () => new Map());
    ensure("worldIndexMetaById", () => ({}));
    ensure("ownedWorldScanInFlight", () => false);
    ensure("ownedWorldScanToken", () => 0);
    ensure("vendingController", () => null);
    ensure("gambleController", () => null);
    ensure("donationController", () => null);
    ensure("chestController", () => null);
    ensure("friendsController", () => null);
    ensure("tradeController", () => null);
    ensure("messagesController", () => null);
    ensure("shopController", () => null);
    ensure("signController", () => null);
    ensure("plantsController", () => null);
    ensure("gemsController", () => null);
    ensure("rewardsController", () => null);
    ensure("dropsController", () => null);
    ensure("drawController", () => null);
    ensure("adminPanelController", () => null);
    ensure("questWorldController", () => null);
    ensure("cameraX", () => 0);
    ensure("cameraY", () => 0);
    ensure("cameraZoom", () => {
      if (typeof opts.loadCameraZoomPref === "function") {
        return Number(opts.loadCameraZoomPref()) || 1;
      }
      return 1;
    });
    ensure("mouseWorld", () => ({ tx: 0, ty: 0 }));
    ensure("editReachTiles", () => Number(opts.defaultEditReachTiles) || 0);
    ensure("worldLockEditContext", () => null);
    ensure("ownerTaxEditContext", () => null);
    ensure("doorEditContext", () => null);
    ensure("cameraEditContext", () => null);
    ensure("weatherEditContext", () => null);
    ensure("currentWorldWeather", () => null);
    ensure("currentWorldTax", () => null);
    ensure("knownWorldIds", () => []);
    ensure("totalOnlinePlayers", () => 0);
    ensure("hasRenderedMenuWorldList", () => false);
    ensure("currentWorldLock", () => null);
    ensure("lastLockDeniedNoticeAt", () => 0);
    ensure("lastHandledForceReloadEventId", () => {
      if (typeof opts.loadForceReloadMarker === "function") {
        return String(opts.loadForceReloadMarker() || "");
      }
      return "";
    });
    ensure("lastHandledAnnouncementEventId", () => "");
    ensure("lastHandledFreezeCommandId", () => "");
    ensure("lastHandledGodModeCommandId", () => "");
    ensure("lastHandledPrivateAnnouncementId", () => "");
    ensure("announcementHideTimer", () => 0);
    ensure("serverMainPageNoticeText", () => "");
    ensure("localUpdateNoticeText", () => "");
    ensure("publicMainNoticeDb", () => null);
    ensure("publicMainNoticeRef", () => null);
    ensure("publicMainNoticeHandler", () => null);
    ensure("isCoarsePointer", () => {
      if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        return window.matchMedia("(pointer: coarse)").matches;
      }
      return false;
    });
    ensure("isMobileUi", () => false);
    ensure("isChatOpen", () => false);
    ensure("suppressChatOpenUntilMs", () => 0);
    ensure("isLogsOpen", () => false);
    ensure("canViewAccountLogs", () => false);
    ensure("canUseAdminPanel", () => false);
    ensure("currentAdminRole", () => "none");
    ensure("adminDataListening", () => false);
    ensure("adminSearchQuery", () => "");
    ensure("adminAuditActionFilter", () => "");
    ensure("adminAuditActorFilter", () => "");
    ensure("adminAuditTargetFilter", () => "");
    ensure("adminBackupList", () => []);
    ensure("adminBackupSelectedId", () => "");
    ensure("adminBackupLoading", () => false);
    ensure("isAdminOpen", () => false);
    ensure("adminCommandsMenuOpen", () => false);
    ensure("adminDashboardTab", () => "overview");
    ensure("hasSeenAdminRoleSnapshot", () => false);
    ensure("adminCommandLastUsedAt", () => new Map());
    ensure("chatMessages", () => []);
    ensure("recentChatFingerprintAt", () => new Map());
    ensure("logsMessages", () => []);
    ensure("antiCheatMessages", () => []);
    ensure("CHAT_BUBBLE_FULL_MS", () => 5000);
    ensure("CHAT_BUBBLE_FADE_MS", () => 1500);
    ensure("CHAT_BUBBLE_MS", () => root.CHAT_BUBBLE_FULL_MS + root.CHAT_BUBBLE_FADE_MS);
    ensure("CHAT_BUBBLE_MAX_WIDTH", () => 190);
    ensure("CHAT_BUBBLE_LINE_HEIGHT", () => 13);
    ensure("DROP_PICKUP_RADIUS", () => 26);
    ensure("DROP_MAX_PER_WORLD", () => 220);
    ensure("PLAYER_NAME_FONT", () => "12px 'Trebuchet MS', sans-serif");
    ensure("playerWrenchHitboxes", () => []);
    ensure("localPlayerWrenchHitbox", () => []);
    ensure("worldDrops", () => new Map());
    ensure("tileDamageByKey", () => new Map());
    ensure("lastDropAtMs", () => 0);
    ensure("inventoryDrag", () => ({
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      moved: false,
      amount: 1,
      maxAmount: 1,
      entry: null,
      ghostEl: null
    }));
    ensure("toolbarRenderQueued", () => false);
    ensure("toolbarRenderRafId", () => 0);
    ensure("lastToolbarRefresh", () => 0);
    ensure("suppressInventoryClickUntilMs", () => 0);
    ensure("pickupInventoryFlushTimer", () => 0);
    ensure("inventorySaveTimer", () => 0);
    ensure("manualLockConvertHoldUntilMs", () => 0);
    ensure("lastInventoryFullHintAt", () => 0);
    ensure("isPointerDown", () => false);
    ensure("currentWorldId", () => {
      if (typeof opts.getInitialWorldId === "function") {
        return opts.getInitialWorldId();
      }
      return "START";
    });
    ensure("world", () => {
      if (typeof opts.makeWorld === "function") {
        return opts.makeWorld(root.currentWorldId);
      }
      return [];
    });
    ensure("inWorld", () => false);
    ensure("player", () => {
      const tile = Number(opts.tileSize) || 32;
      return {
        x: tile * 8,
        y: tile * 11,
        vx: 0,
        vy: 0,
        grounded: false,
        facing: 1
      };
    });
    ensure("currentPhysicsLimits", () => ({
      maxMoveSpeedPerTick: Math.max(0.01, Number(opts.maxMoveSpeed) || 0),
      maxFallSpeedPerTick: Math.max(0.01, Number(opts.maxFallSpeed) || 0),
      gravityPerTick: Math.max(0.001, Number(opts.gravity) || 0),
      jumpVelocityPerTick: Math.abs(Number(opts.jumpVelocity) || 0),
      inWater: false,
      inAntiGravity: false
    }));

    const cosmeticState = (opts.cosmeticsModule && typeof opts.cosmeticsModule.createInventoryState === "function")
      ? opts.cosmeticsModule.createInventoryState(cosmeticItems, cosmeticSlots)
      : { cosmeticInventory: {}, equippedCosmetics: {} };
    ensure("cosmeticInventory", () => cosmeticState.cosmeticInventory || {});
    ensure("titleInventory", () => {
      const out = {};
      for (let i = 0; i < titleCatalog.length; i++) {
        const title = titleCatalog[i] || {};
        const id = String(title.id || "");
        if (!id) continue;
        out[id] = title.defaultUnlocked ? 1 : 0;
      }
      return out;
    });
    ensure("equippedCosmetics", () => cosmeticState.equippedCosmetics || { shirts: "", pants: "", shoes: "", hats: "", wings: "", swords: "" });
    ensure("equippedTitleId", () => String(opts.titleDefaultId || ""));
    if (!root.equippedTitleId && opts.titleDefaultId && root.titleInventory && root.titleInventory[opts.titleDefaultId]) {
      root.equippedTitleId = String(opts.titleDefaultId);
    }

    return root;
  }

  return {
    initCoreState,
    initDefaultDomRefs,
    initDefaultModuleRefs,
    initDomRefs,
    initModuleRefs,
    initRuntimeState
  };
})();
