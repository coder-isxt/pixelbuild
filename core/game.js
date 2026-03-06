    (() => {
      const modules = window.GTModules || {};
      const stateModule = modules.state || {};
      const remoteSyncModule = modules.remoteSync || {};
      const readSyncModule = modules.readSync || {};
      const splicingModule = modules.splicing || {};
      const cloudflareGatewayModule = modules.cloudflareGateway || {};
      const STATE_FALLBACK_INJECT_KEY = "gt_state_fallback_injected_v2";
      const STATE_FALLBACK_RELOAD_KEY = "gt_state_fallback_reloaded_v2";
      let remotePlayerSyncController = null;
      let readSyncController = null;
      let splicingController = null;
      let cloudflareGatewayController = null;
      const readTaskSeqByName = {};
      function tryLoadStateFallbackOnce(reason) {
        try {
          if (sessionStorage.getItem(STATE_FALLBACK_INJECT_KEY) !== "1") {
            sessionStorage.setItem(STATE_FALLBACK_INJECT_KEY, "1");
            const script = document.createElement("script");
            script.src = "core/state_fallback.js?v=" + encodeURIComponent(String(Date.now()));
            script.onload = function () {
              const refreshedStateModule = (window.GTModules || {}).state || {};
              const ok = typeof refreshedStateModule.initDefaultDomRefs === "function"
                && typeof refreshedStateModule.initDefaultModuleRefs === "function"
                && typeof refreshedStateModule.initCoreState === "function"
                && typeof refreshedStateModule.initRuntimeState === "function";
              if (!ok) return;
              const url = new URL(window.location.href);
              url.searchParams.set("v", String(Date.now()));
              window.location.replace(url.toString());
            };
            script.onerror = function () {
              console.error("Failed to load core/state_fallback.js (" + String(reason || "unknown") + ").");
            };
            document.head.appendChild(script);
            return true;
          }
          if (sessionStorage.getItem(STATE_FALLBACK_RELOAD_KEY) !== "1") {
            sessionStorage.setItem(STATE_FALLBACK_RELOAD_KEY, "1");
            const url = new URL(window.location.href);
            url.searchParams.set("v", String(Date.now()));
            window.location.replace(url.toString());
            return true;
          }
          return false;
        } catch (error) {
          return false;
        }
      }

      const missingBaseStateApi = typeof stateModule.initDefaultDomRefs !== "function"
        || typeof stateModule.initDefaultModuleRefs !== "function"
        || typeof stateModule.initCoreState !== "function";
      if (missingBaseStateApi) {
        if (tryLoadStateFallbackOnce("missing-base-api")) return;
        throw new Error("state.js missing required init APIs (initDefaultDomRefs/initDefaultModuleRefs/initCoreState).");
      }
      try {
        sessionStorage.removeItem(STATE_FALLBACK_INJECT_KEY);
        sessionStorage.removeItem(STATE_FALLBACK_RELOAD_KEY);
      } catch (error) {
        // ignore storage errors
      }

      stateModule.initDefaultDomRefs();
      const ctx = canvas.getContext("2d");
      const gtQuickActionsEl = document.getElementById("gtQuickActions");
      const gtMainMenuBtnEl = document.getElementById("gtMainMenuBtn");
      const gtMainMenuPopupEl = document.getElementById("gtMainMenuPopup");
      const gtMenuQuitBtnEl = document.getElementById("gtMenuQuitBtn");
      const gtMenuRespawnBtnEl = document.getElementById("gtMenuRespawnBtn");
      const gtMenuAdminBtnEl = document.getElementById("gtMenuAdminBtn");
      const gtMenuAchievementsBtnEl = document.getElementById("gtMenuAchievementsBtn");
      const gtMenuTitlesBtnEl = document.getElementById("gtMenuTitlesBtn");
      const gtMenuResumeBtnEl = document.getElementById("gtMenuResumeBtn");
      const gtShopQuickBtnEl = document.getElementById("gtShopQuickBtn");
      const gtSocialMenuBtnEl = document.getElementById("gtSocialMenuBtn");
      const gtSocialMenuPopupEl = document.getElementById("gtSocialMenuPopup");
      const gtSocialFriendsBtnEl = document.getElementById("gtSocialFriendsBtn");
      const gtSocialQuestsBtnEl = document.getElementById("gtSocialQuestsBtn");
      const gtSocialResumeBtnEl = document.getElementById("gtSocialResumeBtn");
      let gtQuickMenuMode = "";

      function ensureGambleModalDom() {
        if (document.getElementById("gambleModal")) return;
        const host = document.getElementById("gameShell") || document.body;
        if (!host) return;
        const wrap = document.createElement("div");
        wrap.innerHTML =
          '<div id="gambleModal" class="vending-modal hidden">' +
            '<div class="vending-card sign-card">' +
              '<div class="vending-header">' +
                '<strong id="gambleTitle">Gambling Machine</strong>' +
                '<button id="gambleCloseBtn" type="button">Close</button>' +
              '</div>' +
              '<div id="gambleBody" class="vending-body"></div>' +
              '<div id="gambleActions" class="vending-actions"></div>' +
            '</div>' +
          '</div>';
        if (wrap.firstElementChild) host.appendChild(wrap.firstElementChild);
      }
      ensureGambleModalDom();

      stateModule.initDefaultModuleRefs(modules);
      stateModule.initCoreState({ settings: window.GT_SETTINGS || {} });

      const seedRegistry = typeof seedsModule.createSeedRegistry === "function"
        ? seedsModule.createSeedRegistry(worldBlockDefs, {
            growMs: TREE_GROW_MS,
            growMsByYieldId: SETTINGS.SEED_GROW_MS_BY_BLOCK || {},
            forceSeedForBlockIds: Array.isArray(farmableRegistry.ids) ? farmableRegistry.ids : []
          })
        : { defs: {}, config: {} };
      const blockDefs = { ...worldBlockDefs, ...(seedRegistry.defs || {}) };
      const LOCK_BLOCK_IDS = (() => {
        const ids = Object.values(blockDefs)
          .filter((def) => def && def.worldLock === true)
          .map((def) => Number(def.id))
          .filter((id) => Number.isInteger(id) && id > 0);
        return ids.length ? ids : [WORLD_LOCK_ID];
      })();
      const LOCK_BLOCK_ID_SET = new Set(LOCK_BLOCK_IDS);
      const LOCK_VALUE_BY_ID = (() => {
        const out = {};
        for (const id of LOCK_BLOCK_IDS) {
          const def = blockDefs[id] || {};
          const value = Math.max(1, Math.floor(Number(def.lockValue) || (id === OBSIDIAN_LOCK_ID ? 100 : 1)));
          out[id] = value;
        }
        return out;
      })();
      const LOCK_CURRENCY_DEFS = LOCK_BLOCK_IDS
        .map((id) => ({
          id,
          value: Math.max(1, Math.floor(Number(LOCK_VALUE_BY_ID[id]) || 1)),
          autoConvert: Boolean((blockDefs[id] || {}).lockAutoConvert !== false)
        }))
        .sort((a, b) => a.value - b.value);
      const PLANT_SEED_CONFIG = seedRegistry && seedRegistry.config && typeof seedRegistry.config === "object"
        ? seedRegistry.config
        : {};
      const PLANT_SEED_IDS = Object.keys(PLANT_SEED_CONFIG).map((id) => Number(id)).filter((id) => Number.isInteger(id));
      const PLANT_SEED_ID_SET = new Set(PLANT_SEED_IDS);
      const SEED_DROP_BY_BLOCK_ID = (() => {
        const out = {};
        for (const seedId of PLANT_SEED_IDS) {
          const cfg = PLANT_SEED_CONFIG[seedId] || {};
          const sourceId = Math.max(0, Math.floor(Number(cfg.dropFromBlockId) || 0));
          if (sourceId > 0) out[sourceId] = seedId;
        }
        return out;
      })();
      const SPLICER_ID = (() => {
        const machine = Object.values(blockDefs).find((def) => def && def.key === "splicing_machine");
        const id = machine ? Math.floor(Number(machine.id) || 0) : 0;
        return id > 0 ? id : 51;
      })();
      const MANNEQUIN_ID = (() => {
        const machine = Object.values(blockDefs).find((def) => def && def.key === "mannequin_block");
        const id = machine ? Math.floor(Number(machine.id) || 0) : 0;
        return id > 0 ? id : 54;
      })();
      const mannequinOutfitsByTile = new Map();
      const isInventoryObtainableBlockId = (id) => {
        if (!Number.isInteger(id) || id <= 0) return false;
        if (id === QUEST_NPC_ID) return false;
        const def = blockDefs[id];
        if (!def) return false;
        return def.obtainable !== false;
      };
      const BASE_BLOCK_INVENTORY_IDS = Object.keys(baseBlockDefs || {})
        .map((id) => Math.floor(Number(id)))
        .filter((id) => isInventoryObtainableBlockId(id))
        .sort((a, b) => a - b);
      const FARMABLE_INVENTORY_IDS = (Array.isArray(farmableRegistry.ids) ? farmableRegistry.ids : [])
        .map((id) => Math.floor(Number(id)))
        .filter((id) => isInventoryObtainableBlockId(id))
        .sort((a, b) => a - b);
      const SEED_INVENTORY_IDS = Object.keys(seedRegistry.defs || {})
        .map((id) => Math.floor(Number(id)))
        .filter((id) => isInventoryObtainableBlockId(id))
        .sort((a, b) => a - b);
      const blockOnlyInventorySet = new Set();
      const BLOCK_ONLY_INVENTORY_IDS = [];
      for (let i = 0; i < BASE_BLOCK_INVENTORY_IDS.length; i++) {
        const id = BASE_BLOCK_INVENTORY_IDS[i];
        if (blockOnlyInventorySet.has(id)) continue;
        blockOnlyInventorySet.add(id);
        BLOCK_ONLY_INVENTORY_IDS.push(id);
      }
      for (let i = 0; i < FARMABLE_INVENTORY_IDS.length; i++) {
        const id = FARMABLE_INVENTORY_IDS[i];
        if (blockOnlyInventorySet.has(id)) continue;
        blockOnlyInventorySet.add(id);
        BLOCK_ONLY_INVENTORY_IDS.push(id);
      }
      const inventoryIdSet = new Set(BLOCK_ONLY_INVENTORY_IDS);
      const INVENTORY_IDS = BLOCK_ONLY_INVENTORY_IDS.slice();
      for (let i = 0; i < SEED_INVENTORY_IDS.length; i++) {
        const id = SEED_INVENTORY_IDS[i];
        if (inventoryIdSet.has(id)) continue;
        inventoryIdSet.add(id);
        INVENTORY_IDS.push(id);
      }
      const farmableInventoryIdSet = new Set(FARMABLE_INVENTORY_IDS);
      const NORMAL_BLOCK_INVENTORY_IDS = BLOCK_ONLY_INVENTORY_IDS.filter((id) => !farmableInventoryIdSet.has(id));
      const slotOrder = [TOOL_FIST, TOOL_WRENCH].concat(INVENTORY_IDS);
      const cosmeticBundle = typeof cosmeticsModule.buildCatalog === "function"
        ? cosmeticsModule.buildCatalog(itemsModule)
        : {
            slots: ["shirts", "pants", "shoes", "hats", "wings", "swords"],
            lookup: {},
            items: []
          };
      const COSMETIC_SLOTS = Array.isArray(cosmeticBundle.slots) ? cosmeticBundle.slots : ["shirts", "pants", "shoes", "hats", "wings", "swords"];
      const blockMaps = typeof blockKeysModule.buildMaps === "function"
        ? blockKeysModule.buildMaps(blockDefs)
        : { idToKey: {}, keyToId: {} };
      if (typeof texturesModule.applyDefaultBlockTextures === "function") {
        texturesModule.applyDefaultBlockTextures(blockDefs);
      }
      const BLOCK_ID_TO_KEY = blockMaps.idToKey || {};
      const BLOCK_KEY_TO_ID = blockMaps.keyToId || {};
      const COSMETIC_LOOKUP = cosmeticBundle.lookup && typeof cosmeticBundle.lookup === "object" ? cosmeticBundle.lookup : {};
      const COSMETIC_ITEMS = Array.isArray(cosmeticBundle.items) ? cosmeticBundle.items : [];
      const TITLE_CATALOG = (typeof itemsModule.getTitleCatalog === "function"
        ? itemsModule.getTitleCatalog()
        : [])
        .map((raw) => {
          const row = raw && typeof raw === "object" ? raw : {};
          const styleRaw = row.style && typeof row.style === "object" ? row.style : {};
          const rawGradientColors = styleRaw.gradientColors != null ? styleRaw.gradientColors : styleRaw.colors;
          const gradientSource = Array.isArray(rawGradientColors)
            ? rawGradientColors
            : (typeof rawGradientColors === "string" ? rawGradientColors.split(/[|,]/g) : []);
          const gradientColors = gradientSource
            .map((color) => String(color || "").trim().slice(0, 24))
            .filter(Boolean)
            .slice(0, 6);
          if (!gradientColors.length) gradientColors.push("#8fb4ff", "#f7fbff");
          if (gradientColors.length === 1) gradientColors.push("#f7fbff");
          const gradientAngleRaw = Number(styleRaw.gradientAngle);
          return {
            id: String(row.id || "").trim().slice(0, 32),
            name: String(row.name || "").trim().slice(0, 24),
            color: String(row.color || "").trim().slice(0, 24) || "#8fb4ff",
            defaultUnlocked: Boolean(row.defaultUnlocked),
            style: {
              bold: Boolean(styleRaw.bold),
              glow: Boolean(styleRaw.glow),
              rainbow: Boolean(styleRaw.rainbow),
              glowColor: String(styleRaw.glowColor || "").trim().slice(0, 24),
              gradient: Boolean(styleRaw.gradient),
              gradientShift: styleRaw.gradientShift !== false,
              gradientAngle: Number.isFinite(gradientAngleRaw) ? Math.max(-360, Math.min(360, gradientAngleRaw)) : 90,
              gradientColors
            }
          };
        })
        .filter((row) => row.id && row.name);
      const TITLE_LOOKUP = {};
      for (const title of TITLE_CATALOG) {
        TITLE_LOOKUP[title.id] = title;
      }
      const TITLE_DEFAULT_ID = (TITLE_CATALOG.find((title) => title.defaultUnlocked) || TITLE_CATALOG[0] || {}).id || "";
      if (typeof stateModule.initRuntimeState !== "function") {
        if (tryLoadStateFallbackOnce("missing-runtime-api")) return;
        throw new Error("state.js missing required initRuntimeState API.");
      }
      stateModule.initRuntimeState({
        weatherPresetImages: WEATHER_PRESET_IMAGES,
        waterFrameMs: Math.max(80, Number(SETTINGS.WATER_FRAME_MS) || 170),
        inventoryIds: INVENTORY_IDS,
        desktopPanelLeftDefault: DESKTOP_PANEL_LEFT_DEFAULT,
        desktopPanelRightDefault: DESKTOP_PANEL_RIGHT_DEFAULT,
        defaultEditReachTiles: DEFAULT_EDIT_REACH_TILES,
        loadForceReloadMarker,
        animationsModule,
        syncHitsModule,
        tileSize: TILE,
        maxMoveSpeed: MAX_MOVE_SPEED,
        maxFallSpeed: MAX_FALL_SPEED,
        gravity: GRAVITY,
        jumpVelocity: JUMP_VELOCITY,
        getInitialWorldId,
        makeWorld,
        cosmeticItems: COSMETIC_ITEMS,
        cosmeticSlots: COSMETIC_SLOTS,
        titleCatalog: TITLE_CATALOG,
        titleDefaultId: TITLE_DEFAULT_ID,
        loadCameraZoomPref,
        cosmeticsModule
      });
      function getVendingController() {
        if (vendingController) return vendingController;
        if (typeof vendingModule.createController !== "function") return null;
        vendingController = vendingModule.createController({
          getNetwork: () => network,
          getBasePath: () => BASE_PATH,
          getCurrentWorldId: () => currentWorldId,
          getPlayerProfileId: () => playerProfileId,
          getPlayerSessionId: () => playerSessionId,
          getPlayerName: () => playerName,
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : null),
          getBlockKeyById,
          parseBlockRef,
          getActiveSellableBlockId,
          saveInventory,
          refreshToolbar,
          syncBlock,
          postLocalSystemChat,
          canEditTarget,
          getInventory: () => inventory,
          getInventoryIds: () => INVENTORY_IDS,
          getCosmeticInventory: () => cosmeticInventory,
          getCosmeticItems: () => COSMETIC_ITEMS,
          getVendingId: () => VENDING_ID,
          getWorldLockId: () => WORLD_LOCK_ID,
          getObsidianLockId: () => OBSIDIAN_LOCK_ID,
          getLockCurrencyConfig,
          getTotalLockValue,
          distributeLockValueToInventory,
          spendLockValue,
          addLockValue,
          getWorld: () => world,
          getVendingModalEl: () => vendingModalEl,
          getVendingTitleEl: () => vendingTitleEl,
          getVendingBodyEl: () => vendingBodyEl,
          getVendingActionsEl: () => vendingActionsEl,
          getVendingCloseBtnEl: () => vendingCloseBtn,
          onVendingPurchase: (payload) => {
            const raw = payload && typeof payload === "object" ? payload : {};
            const buyerName = (raw.buyerName || playerName || "player").toString().slice(0, 20);
            const buyerAccountId = (raw.buyerAccountId || playerProfileId || "").toString();
            const itemLabel = (raw.itemLabel || "item").toString().slice(0, 44);
            const totalItems = Math.max(1, Math.floor(Number(raw.totalItems) || 1));
            const totalPrice = Math.max(0, Math.floor(Number(raw.totalPrice) || 0));
            playSfxEvent("vending_purchase", 0.58, "success", "vending purchase");
            logCameraEvent(
              "vending_purchase",
              buyerName + " bought " + totalItems + "x " + itemLabel + " for " + totalPrice + " WL.",
              buyerAccountId,
              buyerName
            );
          }
        });
        if (typeof vendingController.bindModalEvents === "function") {
          vendingController.bindModalEvents();
        }
        return vendingController;
      }

      function getDonationController() {
        if (donationController) return donationController;
        if (typeof donationModule.createController !== "function") return null;
        donationController = donationModule.createController({
          getNetwork: () => network,
          getBasePath: () => BASE_PATH,
          getCurrentWorldId: () => currentWorldId,
          getPlayerProfileId: () => playerProfileId,
          getPlayerName: () => playerName,
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : null),
          getInventory: () => inventory,
          getCosmeticInventory: () => cosmeticInventory,
          getInventoryIds: () => INVENTORY_IDS,
          getCosmeticItems: () => COSMETIC_ITEMS,
          getBlockDefs: () => blockDefs,
          clampInventoryCount,
          saveInventory,
          refreshToolbar,
          postLocalSystemChat,
          getDonationModalEl: () => donationModalEl,
          getDonationTitleEl: () => donationTitleEl,
          getDonationBodyEl: () => donationBodyEl,
          getDonationActionsEl: () => donationActionsEl,
          getDonationCloseBtnEl: () => donationCloseBtn
        });
        if (typeof donationController.bindModalEvents === "function") {
          donationController.bindModalEvents();
        }
        return donationController;
      }

      function getChestController() {
        if (chestController) return chestController;
        if (typeof chestModule.createController !== "function") return null;
        chestController = chestModule.createController({
          getNetwork: () => network,
          getBasePath: () => BASE_PATH,
          getCurrentWorldId: () => currentWorldId,
          getPlayerProfileId: () => playerProfileId,
          getPlayerName: () => playerName,
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : null),
          getInventory: () => inventory,
          getCosmeticInventory: () => cosmeticInventory,
          getInventoryIds: () => INVENTORY_IDS,
          getCosmeticItems: () => COSMETIC_ITEMS,
          getBlockDefs: () => blockDefs,
          clampInventoryCount,
          saveInventory,
          refreshToolbar,
          postLocalSystemChat,
          canManageAt: () => isWorldLocked() && isWorldLockOwner(),
          isWorldLocked: () => isWorldLocked(),
          getChestModalEl: () => chestModalEl,
          getChestTitleEl: () => chestTitleEl,
          getChestBodyEl: () => chestBodyEl,
          getChestActionsEl: () => chestActionsEl,
          getChestCloseBtnEl: () => chestCloseBtn
        });
        if (typeof chestController.bindModalEvents === "function") {
          chestController.bindModalEvents();
        }
        return chestController;
      }

      function getGambleController() {
        if (gambleController) return gambleController;
        if (typeof gambleModule.createController !== "function") return null;
        gambleController = gambleModule.createController({
          getNetwork: () => network,
          getBasePath: () => BASE_PATH,
          getCurrentWorldId: () => currentWorldId,
          getPlayerProfileId: () => playerProfileId,
          getPlayerName: () => playerName,
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : null),
          getInventory: () => inventory,
          getWorld: () => world,
          getGambleId: () => GAMBLE_ID,
          getWorldLockId: () => WORLD_LOCK_ID,
          getObsidianLockId: () => OBSIDIAN_LOCK_ID,
          getLockCurrencyConfig,
          getTotalLockValue,
          distributeLockValueToInventory,
          spendLockValue,
          addLockValue,
          getIsMobileUi: () => Boolean(isMobileUi),
          isWorldLocked: () => isWorldLocked(),
          isWorldLockOwner: () => isWorldLockOwner(),
          isWorldLockAdmin: () => isWorldLockAdmin(),
          getWorldTaxPolicy: () => getCurrentWorldTaxPolicy(),
          addWorldTaxToLocalBank: (amount) => addOwnerTaxToLocalBank(amount),
          clampInventoryCount,
          saveInventory,
          refreshToolbar,
          postLocalSystemChat,
          getGambleModalEl: () => gambleModalEl || document.getElementById("gambleModal"),
          getGambleTitleEl: () => gambleTitleEl || document.getElementById("gambleTitle"),
          getGambleBodyEl: () => gambleBodyEl || document.getElementById("gambleBody"),
          getGambleActionsEl: () => gambleActionsEl || document.getElementById("gambleActions"),
          getGambleCloseBtnEl: () => gambleCloseBtn || document.getElementById("gambleCloseBtn")
        });
        if (typeof gambleController.bindModalEvents === "function") {
          gambleController.bindModalEvents();
        }
        return gambleController;
      }

      function getSplicingController() {
        if (splicingController) return splicingController;
        if (typeof splicingModule.createController !== "function") return null;
        splicingController = splicingModule.createController({
          getWorld: () => world,
          getSplicerId: () => SPLICER_ID,
          getInventory: () => inventory,
          getInventoryIds: () => INVENTORY_IDS,
          getSeedInventoryIds: () => SEED_INVENTORY_IDS,
          getBlockDefs: () => blockDefs,
          getInventoryItemLimit: () => INVENTORY_ITEM_LIMIT,
          getTileSize: () => TILE,
          spawnWorldDropEntry,
          saveInventory,
          refreshToolbar,
          postLocalSystemChat
        });
        if (typeof splicingController.bindModalEvents === "function") {
          splicingController.bindModalEvents();
        }
        return splicingController;
      }

      function getQuestWorldController() {
        if (questWorldController) return questWorldController;
        if (typeof questWorldModule.createController !== "function") return null;
        questWorldController = questWorldModule.createController({
          normalizeWorldId,
          getNetwork: () => network,
          getBasePath: () => BASE_PATH,
          getCurrentWorldId: () => currentWorldId,
          getWorld: () => world,
          getWorldSize: () => ({ w: WORLD_W, h: WORLD_H }),
          getQuestNpcId: () => QUEST_NPC_ID,
          getBlockDefs: () => blockDefs,
          getInventory: () => inventory,
          getCosmeticInventory: () => cosmeticInventory,
          getCosmeticItems: () => COSMETIC_ITEMS,
          parseBlockRef,
          getPlayerName: () => playerName,
          getPlayerProfileId: () => playerProfileId,
          writeAdminSet: (path, value) => proxyAdminSet(path, value),
          writeAdminRemove: (path) => proxyAdminRemove(path),
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : null),
          saveInventory,
          refreshToolbar,
          hasOwnerRole: () => normalizeAdminRole(currentAdminRole) === "owner",
          grantQuestReward: (reward, ctx) => {
            const row = reward && typeof reward === "object" ? reward : {};
            const grants = resolveQuestRewardGrants(row);
            const parts = [];
            let inventoryChanged = false;
            let needsSync = false;
            const txRaw = Number(ctx && ctx.tx);
            const tyRaw = Number(ctx && ctx.ty);
            const tx = Number.isFinite(txRaw)
              ? Math.max(0, Math.min(WORLD_W - 1, Math.floor(txRaw)))
              : Math.max(0, Math.min(WORLD_W - 1, Math.floor((player.x + PLAYER_W * 0.5) / TILE)));
            const ty = Number.isFinite(tyRaw)
              ? Math.max(0, Math.min(WORLD_H - 1, Math.floor(tyRaw)))
              : Math.max(0, Math.min(WORLD_H - 1, Math.floor((player.y + PLAYER_H * 0.5) / TILE)));

            for (let i = 0; i < grants.length; i++) {
              const grant = grants[i];
              if (!grant || !grant.type) continue;
              if (grant.type === "gems") {
                const gained = addPlayerGems(Math.max(0, Math.floor(Number(grant.amount) || 0)), true);
                if (gained > 0) parts.push(gained + " gems");
                continue;
              }
              if (grant.type === "block") {
                const blockId = Math.max(0, Math.floor(Number(grant.blockId) || 0));
                const amount = Math.max(1, Math.floor(Number(grant.amount) || 1));
                if (!blockId) continue;
                const granted = grantGachaBlockReward(blockId, amount, tx, ty);
                if (granted > 0) {
                  const def = blockDefs[blockId];
                  const label = def && def.name ? def.name : ("Block " + blockId);
                  parts.push(granted + "x " + label);
                  inventoryChanged = true;
                }
                continue;
              }
              if (grant.type === "cosmetic") {
                const cosmeticId = String(grant.id || grant.cosmeticId || "").trim();
                const amount = Math.max(1, Math.floor(Number(grant.amount) || 1));
                if (!cosmeticId) continue;
                const granted = grantGachaCosmeticReward(cosmeticId, amount);
                if (granted > 0) {
                  const item = COSMETIC_ITEMS.find((it) => it && it.id === cosmeticId);
                  parts.push(granted + "x " + (item && item.name ? item.name : cosmeticId));
                  inventoryChanged = true;
                  needsSync = true;
                }
                continue;
              }
              if (grant.type === "title") {
                const titleId = String(grant.id || grant.titleId || "").trim();
                const amount = Math.max(1, Math.floor(Number(grant.amount) || 1));
                if (!titleId) continue;
                const granted = grantGachaTitleReward(titleId, amount);
                const titleDef = TITLE_LOOKUP[titleId] || null;
                const titleName = titleDef && titleDef.name ? titleDef.name : titleId;
                if (granted > 0) {
                  parts.push("title " + titleName);
                  inventoryChanged = true;
                  needsSync = true;
                } else if ((titleInventory[titleId] || 0) > 0) {
                  parts.push("title " + titleName + " (already owned)");
                }
                continue;
              }
              if (grant.type === "tool") {
                const toolId = normalizeQuestRewardToolId(grant.id || grant.toolId || "");
                const amount = Math.max(1, Math.floor(Number(grant.amount) || 1));
                if (!toolId) continue;
                const ok = spawnWorldDropEntry({ type: "tool", toolId }, amount, tx * TILE, ty * TILE);
                if (ok) {
                  const toolLabel = toolId === TOOL_WRENCH ? "Wrench" : "Fist";
                  parts.push(amount + "x " + toolLabel);
                }
              }
            }

            if (inventoryChanged) {
              saveInventory(false);
              refreshToolbar(true);
            }
            if (needsSync) {
              syncPlayer(true);
            }
            return {
              ok: true,
              rewardText: parts.join(", ")
            };
          },
          clearTileDamage,
          syncBlock,
          respawnPlayerAtDoor,
          postLocalSystemChat
        });
        if (typeof questWorldController.bindModalEvents === "function") {
          questWorldController.bindModalEvents();
        }
        return questWorldController;
      }

      function getPresenceByAccountId(accountId) {
        const targetId = String(accountId || "");
        if (!targetId) return null;
        const players = adminState.globalPlayers || {};
        for (const entry of Object.values(players)) {
          if (!entry || typeof entry !== "object") continue;
          if (String(entry.accountId || "") !== targetId) continue;
          return {
            accountId: targetId,
            name: String(entry.name || "").slice(0, 20),
            world: normalizeWorldId(entry.world || ""),
            x: Number(entry.x),
            y: Number(entry.y),
            online: true,
            progression: normalizeProgressionRecord(entry.progression || {}),
            achievements: {
              completed: Math.max(0, Math.floor(Number(entry.achievements && entry.achievements.completed) || 0)),
              total: Math.max(0, Math.floor(Number(entry.achievements && entry.achievements.total) || 0))
            }
          };
        }
        return null;
      }

      function warpToFriendAccount(accountId) {
        const presence = getPresenceByAccountId(accountId);
        if (!presence || !presence.online || !presence.world) return false;
        const warpWorld = normalizeWorldId(presence.world);
        if (!warpWorld) return false;
        const warpX = Number.isFinite(presence.x) ? Math.floor(presence.x) : Math.floor(player.x);
        const warpY = Number.isFinite(presence.y) ? Math.floor(presence.y) : Math.floor(player.y);
        pendingTeleportSelf = {
          worldId: warpWorld,
          x: warpX,
          y: warpY
        };
        switchWorld(warpWorld, false);
        postLocalSystemChat("Warping to @" + (presence.name || accountId) + "...");
        return true;
      }

      function getFriendsController() {
        if (friendsController) return friendsController;
        if (typeof friendsModule.createController !== "function") return null;
        friendsController = friendsModule.createController({
          getNetwork: () => network,
          getBasePath: () => BASE_PATH,
          getPlayerProfileId: () => playerProfileId,
          getPlayerName: () => playerName,
          getFriendsToggleBtnEl: () => friendsToggleBtn,
          getProfileModalEl: () => profileModalEl,
          getProfileTitleEl: () => profileTitleEl,
          getProfileBodyEl: () => profileBodyEl,
          getProfileActionsEl: () => profileActionsEl,
          getProfileCloseBtnEl: () => profileCloseBtn,
          getFriendsModalEl: () => friendsModalEl,
          getFriendsTitleEl: () => friendsTitleEl,
          getFriendsBodyEl: () => friendsBodyEl,
          getFriendsActionsEl: () => friendsActionsEl,
          getFriendsCloseBtnEl: () => friendsCloseBtn,
          getPresenceByAccountId,
          onWarpToFriend: (accountId) => warpToFriendAccount(accountId),
          onFriendRequestSent: () => {
            playSfxEvent("friend_request_sent", 0.5, "input", "friend request sent");
          },
          onFriendRequestAccepted: () => {
            playSfxEvent("friend_request_accepted", 0.54, "success", "friend request accepted");
          },
          onFriendRequestReceived: () => {
            playSfxEvent("friend_request_received", 0.52, "success", "friend request received");
          },
          onOpenTrade: (accountId, name) => {
            const tradeCtrl = getTradeController();
            if (!tradeCtrl || typeof tradeCtrl.handleWrenchPlayer !== "function") return;
            tradeCtrl.handleWrenchPlayer({ accountId, name });
          },
          getProfileProgressionHtml: ({ presence }) => {
            const progression = presence && presence.progression ? presence.progression : null;
            const ach = presence && presence.achievements ? presence.achievements : { completed: 0, total: 0 };
            const achCompleted = Math.max(0, Math.floor(Number(ach.completed) || 0));
            const achTotalRaw = Math.max(0, Math.floor(Number(ach.total) || 0));
            const achTotal = achTotalRaw > 0
              ? achTotalRaw
              : Math.max(0, Math.floor(Number((typeof achievementsModule.getCatalog === "function" ? achievementsModule.getCatalog().length : 0)) || 0));
            if (!progression) {
              return (
                "<div class='vending-section'>" +
                  "<div class='vending-section-title'>Progression</div>" +
                  "<div class='vending-stat-grid'>" +
                    "<div class='vending-stat'><span>Level</span><strong>?</strong></div>" +
                    "<div class='vending-stat'><span>XP</span><strong>?</strong></div>" +
                    "<div class='vending-stat'><span>Achievements</span><strong>" + achCompleted + " / " + achTotal + "</strong></div>" +
                  "</div>" +
                "</div>"
              );
            }
            const level = Math.max(1, Math.floor(Number(progression.level) || 1));
            const xpInto = Math.max(0, Math.floor(Number(progression.xpIntoLevel) || 0));
            const xpNext = Math.max(0, Math.floor(Number(progression.xpForNext) || 0));
            const pct = xpNext > 0 ? Math.max(0, Math.min(100, (xpInto / xpNext) * 100)) : 100;
            return (
              "<div class='vending-section'>" +
                "<div class='vending-section-title'>Progression</div>" +
                "<div class='vending-stat-grid'>" +
                  "<div class='vending-stat'><span>Level</span><strong>" + level + "</strong></div>" +
                  "<div class='vending-stat'><span>XP</span><strong>" + xpInto + " / " + xpNext + "</strong></div>" +
                  "<div class='vending-stat'><span>Achievements</span><strong>" + achCompleted + " / " + achTotal + "</strong></div>" +
                "</div>" +
                "<div style='margin-top:8px;height:9px;border-radius:999px;background:rgba(18,35,52,0.85);border:1px solid rgba(128,182,232,0.35);overflow:hidden;'>" +
                  "<div style='height:100%;width:" + pct.toFixed(2) + "%;background:linear-gradient(90deg,#55d6ff,#7cff9b);'></div>" +
                "</div>" +
              "</div>"
            );
          },
          postLocalSystemChat
        });
        if (typeof friendsController.bindUiEvents === "function") {
          friendsController.bindUiEvents();
        }
        return friendsController;
      }

      function getTradeController() {
        if (tradeController) return tradeController;
        if (typeof tradeModule.createController !== "function") return null;
        tradeController = tradeModule.createController({
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : null),
          getNetwork: () => network,
          getBasePath: () => BASE_PATH,
          getCurrentWorldId: () => currentWorldId,
          getPlayerProfileId: () => playerProfileId,
          getPlayerName: () => playerName,
          getPlayerSessionStartedAt: () => playerSessionStartedAt,
          getInventory: () => inventory,
          getCosmeticInventory: () => cosmeticInventory,
          getEquippedCosmetics: () => equippedCosmetics,
          getInventoryIds: () => INVENTORY_IDS,
          getCosmeticItems: () => COSMETIC_ITEMS,
          getCosmeticSlots: () => COSMETIC_SLOTS,
          getRemotePlayers: () => remotePlayers,
          getBlockDefs: () => blockDefs,
          getBlockKeyById,
          getPlayerRect: () => ({ w: PLAYER_W, h: PLAYER_H }),
          getTileSize: () => TILE,
          rectsOverlap,
          postLocalSystemChat,
          showAnnouncementPopup,
          refreshToolbar,
          saveInventory,
          getTradeMenuModalEl: () => tradeMenuModalEl,
          getTradeMenuTitleEl: () => tradeMenuTitleEl,
          getTradeMenuCloseBtnEl: () => tradeMenuCloseBtn,
          getTradeStartBtnEl: () => tradeStartBtn,
          getTradeCancelBtnEl: () => tradeCancelBtn,
          getTradeRequestModalEl: () => tradeRequestModalEl,
          getTradeRequestTextEl: () => tradeRequestTextEl,
          getTradeAcceptBtnEl: () => tradeAcceptBtn,
          getTradeDeclineBtnEl: () => tradeDeclineBtn,
          getTradePanelModalEl: () => document.getElementById("tradePanelModal"),
          getTradePanelTitleEl: () => document.getElementById("tradePanelTitle"),
          getTradePanelBodyEl: () => document.getElementById("tradePanelBody"),
          getTradePanelActionsEl: () => document.getElementById("tradePanelActions"),
          getTradePanelCloseBtnEl: () => document.getElementById("tradePanelCloseBtn"),
          getToolbarEl: () => toolbarEl,
          getFriendsController: () => getFriendsController(),
          onTradeAccepted: () => {
            playSfxEvent("trade_accept", 0.56, "success", "trade accepted");
          },
          onTradeDeclined: () => {
            playSfxEvent("trade_decline", 0.56, "deny", "trade declined");
          },
          onTradeRequestAccepted: () => {
            playSfxEvent("trade_request_accept", 0.56, "success", "trade request accepted");
          },
          onTradeRequestDeclined: () => {
            playSfxEvent("trade_request_decline", 0.56, "deny", "trade request declined");
          },
          startInventoryDragFromTrade: (entry, event) => {
            startInventoryDrag(entry, event);
          },
          onTradeCompleted: (payload) => {
            const tradeId = payload && payload.tradeId ? String(payload.tradeId) : "";
            playSfxEvent("trade_accept", 0.58, "success", "trade completed");
            applyQuestEvent("trade_complete", { tradeId, count: 1 });
            applyAchievementEvent("trade_complete", { tradeId });
            applyQuestWorldGameplayEvent("trade_complete", { tradeId, count: 1 });
          }
        });
        return tradeController;
      }

      function getPlantsController() {
        if (plantsController) return plantsController;
        if (typeof plantsModule.createController !== "function") return null;
        plantsController = plantsModule.createController({
          getNetwork: () => network,
          getTreeGrowMs: () => TREE_GROW_MS,
          getTreeYieldBlockId: () => TREE_YIELD_BLOCK_ID,
          getTreeStageCount: () => TREE_STAGE_COUNT,
          getBlockDefs: () => blockDefs
        });
        return plantsController;
      }

      function getShopController() {
        if (shopController) return shopController;
        if (typeof shopModule.createController !== "function") return null;
        shopController = shopModule.createController({
          getPlayerGems: () => {
            const ctrl = getGemsController();
            if (!ctrl || typeof ctrl.get !== "function") return 0;
            return Math.max(0, Math.floor(Number(ctrl.get()) || 0));
          },
          spendPlayerGems: (amount) => {
            const cost = Math.max(0, Math.floor(Number(amount) || 0));
            if (cost <= 0) return true;
            const ctrl = getGemsController();
            if (!ctrl || typeof ctrl.get !== "function" || typeof ctrl.add !== "function") return false;
            const current = Math.max(0, Math.floor(Number(ctrl.get()) || 0));
            if (current < cost) return false;
            ctrl.add(-cost);
            updateGemsLabel();
            return true;
          },
          getInventory: () => inventory,
          getCosmeticInventory: () => cosmeticInventory,
          getInventoryItemLimit: () => INVENTORY_ITEM_LIMIT,
          getBlockDefs: () => blockDefs,
          getCosmeticItems: () => COSMETIC_ITEMS,
          saveInventory,
          refreshToolbar,
          postLocalSystemChat,
          showAnnouncementPopup,
          onPurchase: () => {
            playSfxEvent("shop_buy", 0.54, "success", "shop buy");
          }
        });
        return shopController;
      }

      function getMessagesController() {
        if (messagesController) return messagesController;
        if (typeof messagesModule.createController !== "function") return null;
        messagesController = messagesModule.createController({
          getNetwork: () => network,
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : null),
          getBasePath: () => BASE_PATH,
          getPlayerProfileId: () => playerProfileId,
          getPlayerName: () => playerName,
          getPlayerSessionStartedAt: () => playerSessionStartedAt,
          resolveAccountIdByUsernameFast,
          findAccountIdByUserRef,
          postLocalSystemChat
        });
        return messagesController;
      }

      function getSignController() {
        if (signController) return signController;
        if (typeof signModule.createController !== "function") return null;
        signController = signModule.createController({
          getTileKey,
          getWorld: () => world,
          getWorldSize: () => ({ w: WORLD_W, h: WORLD_H }),
          getSignId: () => SIGN_ID,
          canEditTarget,
          canEditCurrentWorld,
          notifyWorldLockedDenied,
          getNetwork: () => network,
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : null),
          wrapChatText,
          getPlayer: () => player,
          getPlayerRect: () => ({ w: PLAYER_W, h: PLAYER_H }),
          getTileSize: () => TILE,
          getCamera: () => ({ x: cameraX, y: cameraY }),
          getCameraZoom: () => cameraZoom,
          getCanvas: () => canvas,
          getSignModalElements: () => ({
            modal: signModalEl,
            title: signTitleEl,
            input: signTextInputEl
          })
        });
        return signController;
      }

      function getGemsController() {
        if (gemsController) return gemsController;
        if (typeof gemsModule.createController !== "function") return null;
        gemsController = gemsModule.createController({});
        return gemsController;
      }

      function getRewardsController() {
        if (rewardsController) return rewardsController;
        if (typeof rewardsModule.createController !== "function") return null;
        rewardsController = rewardsModule.createController({
          getTreeGemMin: () => TREE_GEM_MIN,
          getTreeGemMax: () => TREE_GEM_MAX
        });
        return rewardsController;
      }

      function getDropsController() {
        if (dropsController) return dropsController;
        if (typeof dropsModule.createController !== "function") return null;
        dropsController = dropsModule.createController({
          getWorldDrops: () => worldDrops,
          getNetwork: () => network,
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : (window.firebase || null)),
          getInWorld: () => inWorld,
          getTileSize: () => TILE,
          getWorldWidthTiles: () => WORLD_W,
          getWorldHeightTiles: () => WORLD_H,
          getDropPickupRadius: () => DROP_PICKUP_RADIUS,
          getDropMaxPerWorld: () => DROP_MAX_PER_WORLD,
          getPlayer: () => player,
          getPlayerWidth: () => PLAYER_W,
          getPlayerHeight: () => PLAYER_H,
          getPlayerProfileId: () => playerProfileId,
          getPlayerSessionId: () => playerSessionId,
          getPlayerName: () => playerName,
          getInventory: () => inventory,
          getInventoryIds: () => INVENTORY_IDS,
          getCosmeticInventory: () => cosmeticInventory,
          getCosmeticItems: () => COSMETIC_ITEMS,
          getEquippedCosmetics: () => equippedCosmetics,
          getCosmeticSlots: () => COSMETIC_SLOTS,
          getBlockDefs: () => blockDefs,
          getInventoryItemLimit: () => INVENTORY_ITEM_LIMIT,
          getSlotOrder: () => slotOrder,
          getSelectedSlot: () => selectedSlot,
          getToolFist: () => TOOL_FIST,
          getToolWrench: () => TOOL_WRENCH,
          getCameraX: () => cameraX,
          getCameraY: () => cameraY,
          getCameraViewWidth,
          getCameraViewHeight,
          getParticleController: () => particleController,
          getLastDropAtMs: () => lastDropAtMs,
          setLastDropAtMs: (value) => {
            lastDropAtMs = Number(value) || 0;
          },
          getLastInventoryFullHintAt: () => lastInventoryFullHintAt,
          setLastInventoryFullHintAt: (value) => {
            lastInventoryFullHintAt = Number(value) || 0;
          },
          clampInventoryCount,
          schedulePickupInventoryFlush,
          saveInventory,
          refreshToolbar,
          syncPlayer,
          postLocalSystemChat
        });
        return dropsController;
      }

      function getRemotePlayerSyncController() {
        if (remotePlayerSyncController) return remotePlayerSyncController;
        if (typeof remoteSyncModule.createController !== "function") return null;
        const workerVersion = encodeURIComponent(String(window.GT_ASSET_VERSION || "dev"));
        const configuredInterpolationMs = Number(SETTINGS.REMOTE_SYNC_INTERPOLATION_MS);
        const configuredMaxExtrapolationMs = Number(SETTINGS.REMOTE_SYNC_MAX_EXTRAPOLATION_MS);
        const configuredSnapDistancePx = Number(SETTINGS.REMOTE_SYNC_SNAP_DISTANCE_PX);
        remotePlayerSyncController = remoteSyncModule.createController({
          remotePlayers,
          workerPath: "sync/remote_sync_worker.js?v=" + workerVersion,
          interpolationDelayMs: Number.isFinite(configuredInterpolationMs)
            ? Math.max(16, configuredInterpolationMs)
            : 85,
          maxExtrapolationMs: Number.isFinite(configuredMaxExtrapolationMs)
            ? Math.max(0, configuredMaxExtrapolationMs)
            : 0,
          snapDistancePx: Number.isFinite(configuredSnapDistancePx)
            ? Math.max(TILE * 2, configuredSnapDistancePx)
            : (TILE * 4)
        });
        return remotePlayerSyncController;
      }

      function getReadSyncController() {
        if (readSyncController) return readSyncController;
        if (typeof readSyncModule.createController !== "function") return null;
        const workerVersion = encodeURIComponent(String(window.GT_ASSET_VERSION || "dev"));
        readSyncController = readSyncModule.createController({
          workerPath: "sync/read_worker.js?v=" + workerVersion,
          timeoutMs: 1500
        });
        return readSyncController;
      }

      function processReadTask(taskName, payload) {
        const fallback = payload && typeof payload === "object" ? payload : {};
        const ctrl = getReadSyncController();
        if (!ctrl || typeof ctrl.process !== "function") {
          return Promise.resolve(fallback);
        }
        return ctrl.process(taskName, fallback).catch(() => fallback);
      }

      function processReadTaskLatest(taskName, payload, applyFn) {
        if (typeof applyFn !== "function") return;
        const name = String(taskName || "task");
        const nextSeq = (readTaskSeqByName[name] || 0) + 1;
        readTaskSeqByName[name] = nextSeq;
        processReadTask(name, payload).then((result) => {
          if (readTaskSeqByName[name] !== nextSeq) return;
          applyFn(result && typeof result === "object" ? result : payload);
        });
      }

      function getDrawController() {
        if (drawController) return drawController;
        if (typeof drawModule.createController !== "function") return null;
        drawController = drawModule.createController({
          sync: (scope) => {
            if (!scope || typeof scope !== "object") return;
            scope.ctx = ctx;
            scope.canvas = canvas;
            scope.cameraX = cameraX;
            scope.cameraY = cameraY;
            scope.cameraZoom = cameraZoom;
            scope.TILE = TILE;
            scope.WORLD_W = WORLD_W;
            scope.WORLD_H = WORLD_H;
            scope.PLAYER_W = PLAYER_W;
            scope.PLAYER_H = PLAYER_H;
            scope.WATER_FRAME_MS = WATER_FRAME_MS;
            scope.SETTINGS = SETTINGS;
            scope.world = world;
            scope.blockDefs = blockDefs;
            scope.worldDrops = worldDrops;
            scope.tileDamageByKey = tileDamageByKey;
            scope.remotePlayers = remotePlayers;
            scope.overheadChatByPlayer = overheadChatByPlayer;
            scope.player = player;
            scope.playerId = playerId;
            scope.playerName = playerName;
            scope.playerProfileId = playerProfileId;
            scope.currentWorldId = currentWorldId;
            scope.inventory = inventory;
            scope.cosmeticInventory = cosmeticInventory;
            scope.equippedCosmetics = equippedCosmetics;
            scope.slotOrder = slotOrder;
            scope.selectedSlot = selectedSlot;
            scope.danceUntilMs = danceUntilMs;
            scope.lastHitAtMs = lastHitAtMs;
            scope.lastHitDirectionY = lastHitDirectionY;
            scope.inWorld = inWorld;
            scope.COSMETIC_ITEMS = COSMETIC_ITEMS;
            scope.COSMETIC_LOOKUP = COSMETIC_LOOKUP;
            scope.PLAYER_NAME_FONT = PLAYER_NAME_FONT;
            scope.CHAT_BUBBLE_FADE_MS = CHAT_BUBBLE_FADE_MS;
            scope.CHAT_BUBBLE_MAX_WIDTH = CHAT_BUBBLE_MAX_WIDTH;
            scope.CHAT_BUBBLE_LINE_HEIGHT = CHAT_BUBBLE_LINE_HEIGHT;
            scope.HIT_ANIM_MS = HIT_ANIM_MS;
            scope.PLATFORM_ID = PLATFORM_ID;
            scope.STAIR_ROTATION_IDS = STAIR_ROTATION_IDS;
            scope.SPIKE_ROTATION_IDS = SPIKE_ROTATION_IDS;
            scope.DISPLAY_BLOCK_ID = DISPLAY_BLOCK_ID;
            scope.MANNEQUIN_BLOCK_ID = MANNEQUIN_ID;
            scope.SIGN_ID = SIGN_ID;
            scope.VENDING_ID = VENDING_ID;
            scope.WATER_ID = WATER_ID;
            scope.STAIR_BASE_ID = STAIR_BASE_ID;
            scope.SPIKE_BASE_ID = SPIKE_BASE_ID;
            scope.TREE_YIELD_BLOCK_ID = TREE_YIELD_BLOCK_ID;
            scope.TREE_GROW_MS = TREE_GROW_MS;
            scope.TOOL_WRENCH = TOOL_WRENCH;
            scope.TOOL_FIST = TOOL_FIST;
            scope.playerWrenchHitboxes = playerWrenchHitboxes;
            scope.localPlayerWrenchHitbox = localPlayerWrenchHitbox;
            scope.cosmeticImageCache = cosmeticImageCache;
            scope.blockImageCache = blockImageCache;
            scope.waterFramePathCache = waterFramePathCache;
            scope.remoteAnimationTracker = remoteAnimationTracker;
            scope.actionFeedbackEvents = actionFeedbackEvents;
            scope.lastActionLatencyMs = lastActionLatencyMs;
            scope.worldTransitionTarget = worldTransitionTarget;
            scope.worldTransitionStartedAt = worldTransitionStartedAt;
            scope.worldTransitionToken = worldTransitionToken;
            scope.hudExpanded = hudExpanded;
            scope.FEEDBACK_TILES_TTL_MS = FEEDBACK_TILES_TTL_MS;
            scope.FEEDBACK_MAX_EVENTS = FEEDBACK_MAX_EVENTS;
            scope.INPUT_RESPONSE_TARGET_MS = INPUT_RESPONSE_TARGET_MS;
            scope.WORLD_TRANSITION_MIN_VISIBLE_MS = WORLD_TRANSITION_MIN_VISIBLE_MS;
            scope.WORLD_TRANSITION_MAX_VISIBLE_MS = WORLD_TRANSITION_MAX_VISIBLE_MS;
            scope.WORLD_TRANSITION_LABEL = WORLD_TRANSITION_LABEL;
            scope.drawUtilsModule = drawUtilsModule;
            scope.animationsModule = animationsModule;
            scope.particleController = particleController;
            scope.getCameraViewWidth = getCameraViewWidth;
            scope.getCameraViewHeight = getCameraViewHeight;
            scope.getActiveWeatherImageUrl = getActiveWeatherImageUrl;
            scope.getBlockDurability = getBlockDurability;
            scope.isPlantSeedBlockId = isPlantSeedBlockId;
            scope.getLocalDisplayItem = getLocalDisplayItem;
            scope.getLocalMannequinOutfit = getLocalMannequinOutfit;
            scope.getSignController = getSignController;
            scope.getVendingController = getVendingController;
            scope.getPlantsController = getPlantsController;
            scope.getLocalTreePlant = getLocalTreePlant;
            scope.resolvePlantFruitAmount = resolvePlantFruitAmount;
            scope.getWingFlapPulse = getWingFlapPulse;
            scope.getEquippedTitleDef = getEquippedTitleDef;
            scope.formatTitleWithUsername = formatTitleWithUsername;
            scope.shouldShowNameAlongsideTitle = shouldShowNameAlongsideTitle;
            scope.normalizeTitleStyle = normalizeTitleStyle;
            scope.getRainbowTitleColor = getRainbowTitleColor;
            scope.getTitleDef = getTitleDef;
            scope.currentAdminRole = currentAdminRole;
            scope.normalizeAdminRole = normalizeAdminRole;
            scope.getAccountRole = getAccountRole;
            scope.getEditReachTiles = getEditReachTiles;
            scope.canEditTarget = canEditTarget;
            scope.getFriendsController = getFriendsController;
            scope.canvasPointFromClient = canvasPointFromClient;
          }
        });
        return drawController;
      }

      function getAdminPanelController() {
        if (adminPanelController) return adminPanelController;
        if (typeof adminPanelModule.createController !== "function") return null;
        adminPanelController = adminPanelModule.createController({
          getNetwork: () => network,
          getBackupModule: () => backupModule,
          getGatewayController: () => getCloudflareGatewayController(),
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : (window.firebase || null)),
          getBasePath: () => BASE_PATH,
          getPlayerProfileId: () => playerProfileId,
          getPlayerName: () => playerName,
          getInWorld: () => inWorld,
          getCurrentWorldId: () => currentWorldId,
          getIsAdminOpen: () => isAdminOpen,
          getAdminState: () => adminState,
          getAdminAccountsEl: () => adminAccountsEl,
          getAdminAuditActionFilterEl: () => adminAuditActionFilterEl,
          getAdminBackupUploadInput: () => adminBackupUploadInput,
          getAdminBackupList: () => adminBackupList,
          setAdminBackupList: (value) => {
            adminBackupList = Array.isArray(value) ? value : [];
          },
          getAdminBackupSelectedId: () => adminBackupSelectedId,
          setAdminBackupSelectedId: (value) => {
            adminBackupSelectedId = String(value || "").trim();
          },
          getAdminBackupLoading: () => adminBackupLoading,
          setAdminBackupLoading: (value) => {
            adminBackupLoading = Boolean(value);
          },
          getAdminAuditActionFilter: () => adminAuditActionFilter,
          setAdminAuditActionFilter: (value) => {
            adminAuditActionFilter = String(value || "").trim().toLowerCase();
          },
          getAdminAuditActorFilter: () => adminAuditActorFilter,
          getAdminAuditTargetFilter: () => adminAuditTargetFilter,
          hasAdminPermission,
          formatChatTimestamp,
          escapeHtml,
          renderAdminPanel,
          refreshAdminBackups,
          logAdminAudit,
          pushAdminAuditEntry,
          postLocalSystemChat,
          switchWorld
        });
        return adminPanelController;
      }

      function logAntiCheatEvent(rule, severity, details) {
        if (!network.db) return;
        const safeRule = String(rule || "unknown").trim().slice(0, 48);
        if (!safeRule) return;
        const safeSeverity = String(severity || "warn").trim().toLowerCase().slice(0, 16) || "warn";
        const detailText = typeof details === "string"
          ? details
          : JSON.stringify(details || {}).slice(0, 800);
        network.db.ref(BASE_PATH + "/anti-cheat-logs").push({
          rule: safeRule,
          severity: safeSeverity,
          details: detailText,
          accountId: playerProfileId || "",
          username: (playerName || "").toString().slice(0, 20),
          sessionId: playerSessionId || "",
          world: inWorld ? (currentWorldId || "") : "menu",
          createdAt: firebase.database.ServerValue.TIMESTAMP
        }).catch(() => {});
      }

      const antiCheatController = typeof anticheatModule.createController === "function"
        ? anticheatModule.createController({
          getPlayerName: () => playerName,
          getPlayerProfileId: () => playerProfileId,
          getPlayerSessionId: () => playerSessionId,
          getCurrentWorldId: () => currentWorldId,
          getInWorld: () => inWorld,
          getPlayer: () => player,
          getPlayerRect: () => ({ w: PLAYER_W, h: PLAYER_H }),
          getTileSize: () => TILE,
          getTickRate: () => FIXED_FPS,
          getEditReachTiles: () => editReachTiles,
          getPhysicsLimits: () => currentPhysicsLimits,
          postLocalSystemChat,
          getWatchedStorageKeys: () => ([
            SAVED_AUTH_KEY,
            getInventoryStorageKey(),
            getProgressionStorageKey(),
            getAchievementsStorageKey(),
            getQuestsStorageKey()
          ]),
          appendLogEntry: (entry) => {
            if (!entry || !entry.rule) return;
            logAntiCheatEvent(entry.rule, entry.severity, entry.details);
          }
        })
        : null;
      const playerSyncController = typeof syncPlayerModule.createController === "function"
        ? syncPlayerModule.createController({
          playerMinIntervalMs: PLAYER_SYNC_MIN_MS,
          globalMinIntervalMs: GLOBAL_SYNC_MIN_MS
        })
        : null;
      const blockSyncer = typeof syncBlocksModule.createBatchSync === "function"
        ? syncBlocksModule.createBatchSync({
          getRef: () => network.blocksRef,
          onError: () => setNetworkState("Network error", true),
          flushDelayMs: 16
        })
        : null;
      const gachaController = typeof gachaModule.createController === "function"
        ? gachaModule.createController({
          getBlockIdByKey: (blockKey) => parseBlockRef(blockKey),
          random: Math.random
        })
        : null;
      const particleController = typeof particlesModule.createController === "function"
        ? particlesModule.createController({
          maxParticles: Number(SETTINGS.PARTICLES_MAX) || 340
        })
        : null;
      let lastJumpAtMs = -9999;
      let lastAirJumpAtMs = -9999;
      let airJumpsUsed = 0;
      let wingFlapPulseEndsAtMs = 0;
      let wingFlapPulseStrength = 0;
      let wasJumpHeld = false;
      let lastHitAtMs = -9999;
      let lastBlockHitAtMs = -9999;
      let lastHoldActionAtMs = -9999;
      let lastHoldActionTile = null;
      let lastHitDirectionY = 0;
      let lastWaterSplashAtMs = -9999;
      let lastSpikeKillAtMs = -9999;
      let wasInWaterLastFrame = false;
      let danceUntilMs = 0;
      let isFrozenByAdmin = false;
      let isGodModeByAdmin = false;
      let isChatMutedByAdmin = false;
      let chatMutedReason = "";
      let chatMutedByAdminName = "";
      let frozenByAdminBy = "";
      let lastFrozenHintAtMs = -9999;
      let suppressSpawnSafetyUntilMs = 0;
      let mobileLastTouchActionAt = 0;
      let mobileTouchActionMode = "primary";
      let isMobileInventoryOpen = false;
      let mobilePlayModeEnabled = true;
      let actionFeedbackEvents = [];
      let lastActionLatencyMs = -9999;
      let worldTransitionTarget = "";
      let worldTransitionStartedAt = 0;
      let worldTransitionToken = 0;
      let worldTransitionToneEnabled = false;
      let suppressNextWorldTransitionTone = false;
      let suppressTransitionTonesUntilMs = 0;
      let hudExpanded = false;
      let hasSeenFriendRequestsSnapshot = false;
      let hasSeenFriendsSnapshot = false;
      let lastFriendRequestCount = 0;
      let lastFriendCount = 0;
      const CHAT_PANEL_POS_KEY = "gt_chat_panel_top_v1";
      const CHAT_PANEL_TOP_DEFAULT = 10;
      const CHAT_PANEL_TOP_MIN = 8;
      const CHAT_PANEL_BOTTOM_GAP = 12;
      const CHAT_MESSAGES_LIMIT = 100;
      const SYSTEM_CHAT_TEXT_MAX = 240;
      const INVENTORY_PANEL_OFFSET_KEY = "gt_inventory_panel_offset_v1";
      const INVENTORY_PANEL_PEEK_PX = 40;
      const INVENTORY_PANEL_BOTTOM_GAP = 8;
      let chatPanelTopPx = CHAT_PANEL_TOP_DEFAULT;
      let chatDragActive = false;
      let chatDragPointerId = -1;
      let chatDragStartY = 0;
      let chatDragStartTopPx = CHAT_PANEL_TOP_DEFAULT;
      let chatDragHandleEl = null;
      let inventoryPanelOffsetPx = 0;
      let inventoryPanelDragActive = false;
      let inventoryPanelDragPointerId = -1;
      let inventoryPanelDragStartY = 0;
      let inventoryPanelDragStartOffsetPx = 0;
      let inventoryPanelHandleEl = null;
      let inventoryPanelDragBound = false;
      const touchControls = {
        left: false,
        right: false,
        jump: false
      };
      const HIT_ANIM_MS = 200;
      const BLOCK_HIT_COOLDOWN_MS = Math.max(60, Number(SETTINGS.BLOCK_HIT_COOLDOWN_MS) || 120);
      const FEEDBACK_TILES_TTL_MS = 320;
      const FEEDBACK_MAX_EVENTS = 24;
      const INPUT_RESPONSE_TARGET_MS = 100;
      const WORLD_TRANSITION_MIN_VISIBLE_MS = 140;
      const WORLD_TRANSITION_MAX_VISIBLE_MS = 500;
      const WORLD_TRANSITION_LABEL = "Switching worlds...";
      const SPIKE_KILL_COOLDOWN_MS = Math.max(350, Number(SETTINGS.SPIKE_KILL_COOLDOWN_MS) || 700);
      const DANCE_DURATION_MS = Math.max(1200, Number(SETTINGS.DANCE_DURATION_MS) || 5000);
      const FIXED_FPS = 60;
      const FIXED_FRAME_MS = 1000 / FIXED_FPS;
      const MAX_TICK_CATCHUP = 4;
      let feedbackAudioContext = null;
      let lastActionToneAtMs = -9999;
      let feedbackNoiseBuffer = null;
      const FEEDBACK_MASTER_GAIN = Math.max(0, Math.min(1, Number(SETTINGS.FEEDBACK_SFX_GAIN) || 0.2));
      const feedbackToneLastByKey = {};
      const ACTION_TONE_PRESETS = {
        tap: { wave: "triangle", from: 620, to: 760, duration: 0.048, gain: 0.26, cooldownMs: 18, harmonic: 1.8, harmonicGain: 0.22 },
        tap_soft: { wave: "sine", from: 520, to: 590, duration: 0.04, gain: 0.2, cooldownMs: 18, harmonic: 0, harmonicGain: 0 },
        success: { wave: "sine", from: 760, to: 980, duration: 0.07, gain: 0.34, cooldownMs: 28, harmonic: 2, harmonicGain: 0.32 },
        warn: { wave: "sawtooth", from: 520, to: 430, duration: 0.08, gain: 0.3, cooldownMs: 38, harmonic: 1.5, harmonicGain: 0.16 },
        deny: { wave: "square", from: 280, to: 190, duration: 0.11, gain: 0.35, cooldownMs: 84, harmonic: 0, harmonicGain: 0 },
        hit: { wave: "triangle", from: 240, to: 150, duration: 0.055, gain: 0.3, cooldownMs: 24, harmonic: 2.2, harmonicGain: 0.14, noiseGain: 0.22, noiseFreq: 1500 },
        break: { wave: "triangle", from: 320, to: 110, duration: 0.085, gain: 0.36, cooldownMs: 42, harmonic: 1.6, harmonicGain: 0.18, noiseGain: 0.3, noiseFreq: 1200 },
        place: { wave: "triangle", from: 440, to: 560, duration: 0.06, gain: 0.28, cooldownMs: 28, harmonic: 2.1, harmonicGain: 0.16, noiseGain: 0.12, noiseFreq: 1800 },
        rotate: { wave: "triangle", from: 500, to: 720, duration: 0.055, gain: 0.26, cooldownMs: 24, harmonic: 2.2, harmonicGain: 0.2 },
        ui_open: { wave: "sine", from: 560, to: 680, duration: 0.07, gain: 0.3, cooldownMs: 60, harmonic: 2, harmonicGain: 0.22 },
        harvest: { wave: "sine", from: 760, to: 1100, duration: 0.12, gain: 0.36, cooldownMs: 88, harmonic: 1.5, harmonicGain: 0.35 },
        world_start: { wave: "triangle", from: 180, to: 320, duration: 0.1, gain: 0.3, cooldownMs: 130, harmonic: 2, harmonicGain: 0.18 },
        world_end: { wave: "sine", from: 420, to: 820, duration: 0.095, gain: 0.34, cooldownMs: 130, harmonic: 2, harmonicGain: 0.28 }
      };
      const SFX_BASE_PATH = "sounds/";
      const sfxTemplateByEvent = {};
      const sfxUnavailableByEvent = {};
      const sfxLastPlayAtByEvent = {};
      let sfxAssetsPrimed = false;
      const SFX_EVENT_CONFIG = {
        hit: { file: "sfx_hit.ogg", fallbackTone: "success", fallbackLabel: "tile hit", volume: 0.42, cooldownMs: 34 },
        place: { file: "sfx_place.ogg", fallbackTone: "success", fallbackLabel: "placed block", volume: 0.4, cooldownMs: 42 },
        collect: { file: "sfx_collect.ogg", fallbackTone: "success", fallbackLabel: "collect", volume: 0.36, cooldownMs: 70 },
        ui: { file: "sfx_ui.ogg", fallbackTone: "input", fallbackLabel: "ui", volume: 0.34, cooldownMs: 55 },
        shop_buy: { file: "sfx_shop_buy.ogg", fallbackTone: "success", fallbackLabel: "shop buy", volume: 0.42, cooldownMs: 90 },
        jump: { file: "sfx_jump.ogg", fallbackTone: "input", fallbackLabel: "jump", volume: 0.35, cooldownMs: 80 },
        door: { file: "sfx_door.ogg", fallbackTone: "success", fallbackLabel: "door", volume: 0.38, cooldownMs: 75 },
        drop: { file: "sfx_drop.ogg", fallbackTone: "warn", fallbackLabel: "drop", volume: 0.38, cooldownMs: 65 },
        vending_purchase: { file: "sfx_vending_purchase.ogg", fallbackTone: "success", fallbackLabel: "vending purchase", volume: 0.4, cooldownMs: 120 },
        chat_sent: { file: "sfx_chat_sent.ogg", fallbackTone: "input", fallbackLabel: "chat sent", volume: 0.3, cooldownMs: 44 },
        pm_received: { file: "sfx_pm_received.ogg", fallbackTone: "success", fallbackLabel: "pm received", volume: 0.32, cooldownMs: 120 },
        pm_sent: { file: "sfx_pm_sent.ogg", fallbackTone: "input", fallbackLabel: "pm sent", volume: 0.32, cooldownMs: 90 },
        friend_request_sent: { file: "sfx_friend_request_sent.ogg", fallbackTone: "input", fallbackLabel: "friend request sent", volume: 0.3, cooldownMs: 110 },
        friend_request_received: { file: "sfx_friend_request_received.ogg", fallbackTone: "success", fallbackLabel: "friend request received", volume: 0.32, cooldownMs: 140 },
        friend_request_accepted: { file: "sfx_friend_request_accepted.ogg", fallbackTone: "success", fallbackLabel: "friend request accepted", volume: 0.34, cooldownMs: 140 },
        trade_accept: { file: "sfx_trade_accept.ogg", fallbackTone: "success", fallbackLabel: "trade accepted", volume: 0.36, cooldownMs: 120 },
        trade_decline: { file: "sfx_trade_decline.ogg", fallbackTone: "deny", fallbackLabel: "trade declined", volume: 0.33, cooldownMs: 120 },
        trade_request_accept: { file: "sfx_trade_request_accept.ogg", fallbackTone: "success", fallbackLabel: "trade request accepted", volume: 0.35, cooldownMs: 120 },
        trade_request_decline: { file: "sfx_trade_request_decline.ogg", fallbackTone: "deny", fallbackLabel: "trade request declined", volume: 0.33, cooldownMs: 120 }
      };

      function getFeedbackAudioContext() {
        if (typeof window === "undefined") return null;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        if (!feedbackAudioContext) {
          feedbackAudioContext = new AudioContextClass();
        }
        return feedbackAudioContext;
      }

      function getFeedbackNoiseBuffer(ctxAudio) {
        if (!ctxAudio) return null;
        if (feedbackNoiseBuffer) return feedbackNoiseBuffer;
        try {
          const sampleRate = Math.max(8000, Math.floor(Number(ctxAudio.sampleRate) || 44100));
          const durationSeconds = 0.14;
          const frameCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
          const buffer = ctxAudio.createBuffer(1, frameCount, sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < frameCount; i++) {
            const t = i / frameCount;
            const decay = 1 - t;
            data[i] = (Math.random() * 2 - 1) * decay * decay;
          }
          feedbackNoiseBuffer = buffer;
        } catch (error) {
          feedbackNoiseBuffer = null;
        }
        return feedbackNoiseBuffer;
      }

      function primeSfxAssets() {
        if (sfxAssetsPrimed) return;
        if (typeof Audio === "undefined") return;
        sfxAssetsPrimed = true;
        Object.keys(SFX_EVENT_CONFIG).forEach((eventKey) => {
          const cfg = SFX_EVENT_CONFIG[eventKey];
          if (!cfg || !cfg.file) return;
          try {
            const template = new Audio(SFX_BASE_PATH + cfg.file);
            template.preload = "auto";
            template.volume = Math.max(0, Math.min(1, Number(cfg.volume) || 0.4));
            template.addEventListener("error", () => {
              sfxUnavailableByEvent[eventKey] = true;
            });
            template.load();
            sfxTemplateByEvent[eventKey] = template;
          } catch (error) {
            sfxUnavailableByEvent[eventKey] = true;
          }
        });
      }

      function playSfxEvent(eventKey, intensity, fallbackTone, fallbackLabel) {
        const key = String(eventKey || "").trim().toLowerCase();
        if (!key) {
          playActionTone(fallbackTone || "input", intensity, fallbackLabel || "sfx");
          return false;
        }
        const cfg = SFX_EVENT_CONFIG[key] || null;
        if (!cfg) {
          playActionTone(fallbackTone || "input", intensity, fallbackLabel || key);
          return false;
        }
        const fallbackAllowed = key !== "hit" && key !== "place";
        const now = performance.now();
        const cooldownMs = Math.max(8, Math.floor(Number(cfg.cooldownMs) || 40));
        const lastPlayAt = Number(sfxLastPlayAtByEvent[key]) || -9999;
        if ((now - lastPlayAt) < cooldownMs) return false;
        sfxLastPlayAtByEvent[key] = now;

        const globalSound = (typeof window !== "undefined" && window && window.sound) ? window.sound : null;
        const canUseGlobalSound = !!(cfg && typeof cfg.file === "string" && /\.mp3$/i.test(cfg.file));
        if (canUseGlobalSound && globalSound && typeof globalSound.play === "function") {
          try {
            const fileId = String(cfg.file || "").replace(/\.[^/.]+$/, "");
            if (fileId) {
              globalSound.play(fileId);
              return true;
            }
          } catch (error) {
            // fall through to direct audio + synth fallback
          }
        }

        primeSfxAssets();
        const template = sfxTemplateByEvent[key];
        const canPlayReal = template && !sfxUnavailableByEvent[key];
        if (canPlayReal) {
          try {
            const clip = template.cloneNode();
            const baseVolume = Math.max(0, Math.min(1, Number(cfg.volume) || 0.4));
            const amp = Math.max(0.08, Math.min(1, Number(intensity) || 0.45));
            clip.volume = Math.max(0, Math.min(1, baseVolume * (0.5 + amp * 0.6)));
            const playPromise = clip.play();
            if (playPromise && typeof playPromise.catch === "function") {
              playPromise.catch(() => {
                sfxUnavailableByEvent[key] = true;
                if (fallbackAllowed) {
                  playActionTone(cfg.fallbackTone || fallbackTone || "input", intensity, cfg.fallbackLabel || fallbackLabel || key);
                }
              });
            }
            return true;
          } catch (error) {
            sfxUnavailableByEvent[key] = true;
          }
        }
        if (fallbackAllowed) {
          playActionTone(cfg.fallbackTone || fallbackTone || "input", intensity, cfg.fallbackLabel || fallbackLabel || key);
        }
        return false;
      }

      function resolveActionToneEvent(toneType, label) {
        const kind = String(toneType || "input").toLowerCase();
        const detail = String(label || "").toLowerCase();
        if (detail.indexOf("world transition start") !== -1) return "world_start";
        if (detail.indexOf("world transition end") !== -1) return "world_end";
        if (detail.indexOf("block broken") !== -1) return "break";
        if (detail.indexOf("harvested seed") !== -1) return "harvest";
        if (detail.indexOf("placed block") !== -1 || detail.indexOf("world lock placed") !== -1 || detail.indexOf("spawn moved") !== -1) {
          return "place";
        }
        if (detail.indexOf("tile hit") !== -1) return "hit";
        if (detail.indexOf("rotated") !== -1) return "rotate";
        if (
          detail.indexOf("world lock") !== -1 ||
          detail.indexOf("vending") !== -1 ||
          detail.indexOf("gamble") !== -1 ||
          detail.indexOf("donation box") !== -1 ||
          detail.indexOf("chest") !== -1 ||
          detail.indexOf("splicer") !== -1 ||
          detail.indexOf("owner tax") !== -1 ||
          detail.indexOf("sign") !== -1 ||
          detail.indexOf("door") !== -1 ||
          detail.indexOf("camera") !== -1 ||
          detail.indexOf("weather") !== -1 ||
          detail.indexOf("quest interaction") !== -1
        ) {
          return "ui_open";
        }
        if (kind === "deny") return "deny";
        if (kind === "warn") return "warn";
        if (kind === "success") return "success";
        return "tap";
      }

      function resolveActionSfxEvent(toneType, label) {
        const kind = String(toneType || "input").toLowerCase();
        const detail = String(label || "").toLowerCase();
        if (
          detail.indexOf("tile hit") !== -1 ||
          detail.indexOf("block broken") !== -1 ||
          detail.indexOf("harvested seed") !== -1
        ) return "hit";
        if (
          detail.indexOf("placed block") !== -1 ||
          detail.indexOf("world lock placed") !== -1 ||
          detail.indexOf("spawn moved") !== -1
        ) return "place";
        if (detail.indexOf("door") !== -1) return "door";
        if (
          detail.indexOf("vending") !== -1 ||
          detail.indexOf("world lock") !== -1 ||
          detail.indexOf("gamble") !== -1 ||
          detail.indexOf("donation box") !== -1 ||
          detail.indexOf("chest") !== -1 ||
          detail.indexOf("splicer") !== -1 ||
          detail.indexOf("owner tax") !== -1 ||
          detail.indexOf("sign") !== -1 ||
          detail.indexOf("camera") !== -1 ||
          detail.indexOf("weather") !== -1 ||
          detail.indexOf("quest interaction") !== -1
        ) return "ui";
        return "";
      }

      function resolveSystemMessageSfxEvent(text) {
        const detail = String(text || "").toLowerCase();
        if (!detail) return "";
        if (detail.indexOf("[pm]") === 0) return "pm_received";
        if (
          detail.indexOf("private message sent") !== -1 ||
          detail.indexOf("pm sent") !== -1
        ) return "pm_sent";
        if (detail.indexOf("trade request") !== -1) {
          if (detail.indexOf("accept") !== -1) return "trade_request_accept";
          if (
            detail.indexOf("declin") !== -1 ||
            detail.indexOf("reject") !== -1 ||
            detail.indexOf("denied") !== -1
          ) return "trade_request_decline";
        }
        if (detail.indexOf("trade") !== -1) {
          if (detail.indexOf("accept") !== -1) return "trade_accept";
          if (
            detail.indexOf("declin") !== -1 ||
            detail.indexOf("reject") !== -1 ||
            detail.indexOf("cancel") !== -1
          ) return "trade_decline";
        }
        if (detail.indexOf("friend request") !== -1) {
          if (detail.indexOf("sent") !== -1) return "friend_request_sent";
          if (detail.indexOf("accept") !== -1) return "friend_request_accepted";
          if (detail.indexOf("received") !== -1 || detail.indexOf("from @") !== -1) return "friend_request_received";
        }
        if (detail.indexOf("collected ") !== -1) return "collect";
        if (detail.indexOf("bought ") !== -1 && detail.indexOf(" wl") !== -1) return "vending_purchase";
        if ((detail.indexOf("shop") !== -1 || detail.indexOf("store") !== -1) && (detail.indexOf("bought") !== -1 || detail.indexOf("purchased") !== -1)) {
          return "shop_buy";
        }
        if (detail.indexOf("door ") !== -1) return "door";
        return "";
      }

      function resolveTradeDecisionKind(value) {
        const raw = value && typeof value === "object" ? value : {};
        if (typeof raw.accepted === "boolean") return raw.accepted ? "accept" : "decline";
        if (typeof raw.declined === "boolean" && raw.declined) return "decline";
        const probe = [
          raw.status,
          raw.state,
          raw.response,
          raw.result,
          raw.action,
          raw.decision
        ].map((row) => String(row || "").toLowerCase());
        for (let i = 0; i < probe.length; i++) {
          const text = probe[i];
          if (!text) continue;
          if (text.indexOf("accept") !== -1 || text === "ok" || text === "approved" || text === "true") return "accept";
          if (text.indexOf("declin") !== -1 || text.indexOf("reject") !== -1 || text.indexOf("deny") !== -1 || text.indexOf("cancel") !== -1 || text === "false") {
            return "decline";
          }
        }
        return "";
      }

      function playOscillatorLayer(ctxAudio, when, preset, ampScale) {
        try {
          const fromFreq = Math.max(40, Number(preset.from) || 440);
          const toFreq = Math.max(40, Number(preset.to) || fromFreq);
          const duration = Math.max(0.03, Number(preset.duration) || 0.06);
          const wave = String(preset.wave || "triangle");
          const gainAmount = Math.max(0.0002, Number(preset.gain) || 0.25) * ampScale;
          const attack = 0.004;

          const osc = ctxAudio.createOscillator();
          const gain = ctxAudio.createGain();
          osc.type = wave;
          osc.frequency.setValueAtTime(fromFreq, when);
          osc.frequency.exponentialRampToValueAtTime(toFreq, when + duration);
          gain.gain.setValueAtTime(0.0001, when);
          gain.gain.exponentialRampToValueAtTime(gainAmount, when + attack);
          gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
          osc.connect(gain);
          gain.connect(ctxAudio.destination);
          osc.start(when);
          osc.stop(when + duration + 0.02);
          osc.onended = () => {
            try {
              osc.disconnect();
              gain.disconnect();
            } catch (error) {
              // ignore cleanup errors
            }
          };

          const harmonicRatio = Number(preset.harmonic) || 0;
          const harmonicGain = Math.max(0, Number(preset.harmonicGain) || 0);
          if (harmonicRatio > 0 && harmonicGain > 0.001) {
            const harmOsc = ctxAudio.createOscillator();
            const harmGain = ctxAudio.createGain();
            harmOsc.type = wave === "square" ? "triangle" : "sine";
            harmOsc.frequency.setValueAtTime(Math.max(40, fromFreq * harmonicRatio), when);
            harmOsc.frequency.exponentialRampToValueAtTime(Math.max(40, toFreq * harmonicRatio), when + duration);
            harmGain.gain.setValueAtTime(0.0001, when);
            harmGain.gain.exponentialRampToValueAtTime(gainAmount * harmonicGain, when + attack);
            harmGain.gain.exponentialRampToValueAtTime(0.0001, when + duration * 0.92);
            harmOsc.connect(harmGain);
            harmGain.connect(ctxAudio.destination);
            harmOsc.start(when);
            harmOsc.stop(when + duration + 0.02);
            harmOsc.onended = () => {
              try {
                harmOsc.disconnect();
                harmGain.disconnect();
              } catch (error) {
                // ignore cleanup errors
              }
            };
          }
        } catch (error) {
          // ignore synthesis failures
        }
      }

      function playNoiseLayer(ctxAudio, when, preset, ampScale) {
        const noiseGainAmount = Math.max(0, Number(preset.noiseGain) || 0);
        if (noiseGainAmount <= 0.001) return;
        const buffer = getFeedbackNoiseBuffer(ctxAudio);
        if (!buffer) return;
        try {
          const duration = Math.max(0.03, Number(preset.duration) || 0.06);
          const noiseSource = ctxAudio.createBufferSource();
          noiseSource.buffer = buffer;
          const filter = ctxAudio.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(Math.max(140, Number(preset.noiseFreq) || 1300), when);
          filter.Q.value = 0.8;
          const gain = ctxAudio.createGain();
          gain.gain.setValueAtTime(Math.max(0.0001, noiseGainAmount * ampScale), when);
          gain.gain.exponentialRampToValueAtTime(0.0001, when + duration * 0.82);
          noiseSource.connect(filter);
          filter.connect(gain);
          gain.connect(ctxAudio.destination);
          noiseSource.start(when);
          noiseSource.stop(when + Math.max(0.04, duration));
          noiseSource.onended = () => {
            try {
              noiseSource.disconnect();
              filter.disconnect();
              gain.disconnect();
            } catch (error) {
              // ignore cleanup errors
            }
          };
        } catch (error) {
          // ignore synthesis failures
        }
      }

      function addActionFeedbackEvent(tx, ty, tier, label, latencyMs, intensity) {
        if (!Array.isArray(actionFeedbackEvents)) {
          actionFeedbackEvents = [];
        }
        const safeTx = Math.floor(Number(tx));
        const safeTy = Math.floor(Number(ty));
        if (!Number.isInteger(safeTx) || !Number.isInteger(safeTy)) return;
        if (safeTx < 0 || safeTy < 0 || safeTx >= WORLD_W || safeTy >= WORLD_H) return;
        const now = performance.now();
        actionFeedbackEvents.push({
          tx: safeTx,
          ty: safeTy,
          tier: String(tier || "input").slice(0, 16),
          label: String(label || "").slice(0, 40),
          createdAt: now,
          latencyMs: Number.isFinite(Number(latencyMs)) ? Math.max(0, Math.round(Number(latencyMs))) : 0,
          intensity: Number.isFinite(Number(intensity)) ? Math.max(0.2, Math.min(1, Number(intensity))) : 1
        });
        while (actionFeedbackEvents.length > FEEDBACK_MAX_EVENTS) {
          actionFeedbackEvents.shift();
        }
      }

      function recordActionLatency(startedAtMs) {
        const now = performance.now();
        const latencyMs = Number.isFinite(startedAtMs) ? Math.max(0, Math.round(now - Number(startedAtMs))) : 0;
        lastActionLatencyMs = latencyMs;
        return latencyMs;
      }

      function reportActionLatencyResult(startedAtMs, tx, ty, outcome, label) {
        const latencyMs = recordActionLatency(startedAtMs);
        const safeTx = Math.floor(Number(tx));
        const safeTy = Math.floor(Number(ty));
        if (!Number.isFinite(safeTx) || !Number.isFinite(safeTy)) return latencyMs;
        const result = String(outcome || "warn").toLowerCase();
        const tier = result === "success" && latencyMs > INPUT_RESPONSE_TARGET_MS
          ? "warn"
          : result;
        addActionFeedbackEvent(safeTx, safeTy, tier, label, latencyMs, result === "success" ? 0.95 : 0.75);
        const latencyRatio = INPUT_RESPONSE_TARGET_MS > 0
          ? Math.max(0, Math.min(1.8, latencyMs / INPUT_RESPONSE_TARGET_MS))
          : 0;
        const baseIntensity = result === "success" ? 0.5 : 0.62;
        const toneIntensity = Math.max(0.2, Math.min(1, baseIntensity + (latencyRatio > 1 ? (latencyRatio - 1) * 0.08 : 0)));
        const sfxEvent = resolveActionSfxEvent(tier, label);
        if (sfxEvent) {
          playSfxEvent(sfxEvent, toneIntensity, tier, label);
        }
        return latencyMs;
      }

      function reportActionOutcome(startedAtMs, tx, ty, outcome, label) {
        if (!Number.isFinite(startedAtMs)) return outcome;
        return reportActionLatencyResult(startedAtMs, tx, ty, outcome, label);
      }

      function reportActionTap(tx, ty) {
        const safeTx = Math.floor(Number(tx));
        const safeTy = Math.floor(Number(ty));
        if (!Number.isFinite(safeTx) || !Number.isFinite(safeTy)) return;
        addActionFeedbackEvent(safeTx, safeTy, "input", "action");
      }

      function playActionTone(toneType, intensity, label) {
        const now = performance.now();
        if (!Number.isFinite(now)) return;
        const eventKey = resolveActionToneEvent(toneType, label);
        const preset = ACTION_TONE_PRESETS[eventKey] || ACTION_TONE_PRESETS.tap;
        const perEventCooldown = Math.max(8, Math.floor(Number(preset.cooldownMs) || 24));
        const lastForKey = Number(feedbackToneLastByKey[eventKey]) || -9999;
        if ((now - lastForKey) < perEventCooldown) return;
        if ((now - lastActionToneAtMs) < 10) return;
        const ctxAudio = getFeedbackAudioContext();
        if (!ctxAudio) return;
        const amp = Math.max(0.08, Math.min(1, Number(intensity) || 0.45));
        const ampScale = Math.max(0.02, FEEDBACK_MASTER_GAIN * (0.46 + amp * 0.7));
        const resumePromise = ctxAudio.state === "suspended" ? ctxAudio.resume() : Promise.resolve();
        feedbackToneLastByKey[eventKey] = now;
        lastActionToneAtMs = now;
        resumePromise.then(() => {
          const t = ctxAudio.currentTime + 0.001;
          playOscillatorLayer(ctxAudio, t, preset, ampScale);
          playNoiseLayer(ctxAudio, t, preset, ampScale);
        }).catch(() => {
          // ignore audio failures
        });
      }

      function beginWorldTransition(targetWorldId) {
        const token = Math.max(0, Number(worldTransitionToken) || 0) + 1;
        worldTransitionToken = token;
        worldTransitionTarget = String(targetWorldId || "");
        worldTransitionStartedAt = performance.now();
        const targetId = String(targetWorldId || "").trim().toLowerCase();
        const suppressToneOnce = suppressNextWorldTransitionTone;
        suppressNextWorldTransitionTone = false;
        const transitionAtMs = Number.isFinite(worldTransitionStartedAt) ? worldTransitionStartedAt : performance.now();
        const suppressByAuthCooldown = transitionAtMs < (Number(suppressTransitionTonesUntilMs) || 0);
        worldTransitionToneEnabled = false;
        const safeStartedAt = worldTransitionStartedAt;
        window.setTimeout(() => {
          if (worldTransitionToken !== token) return;
          if (worldTransitionStartedAt !== safeStartedAt) return;
          worldTransitionTarget = "";
          worldTransitionStartedAt = 0;
          worldTransitionToneEnabled = false;
        }, WORLD_TRANSITION_MAX_VISIBLE_MS);
        return token;
      }

      function finishWorldTransition(token) {
        if (!token || Number(worldTransitionToken) !== Number(token)) return;
        if (!worldTransitionTarget || !worldTransitionStartedAt) return;
        const elapsedMs = Math.max(0, performance.now() - worldTransitionStartedAt);
        const remainingMs = Math.max(0, WORLD_TRANSITION_MIN_VISIBLE_MS - elapsedMs);
        const finalize = () => {
          if (Number(worldTransitionToken) !== Number(token)) return;
          worldTransitionTarget = "";
          worldTransitionStartedAt = 0;
          worldTransitionToneEnabled = false;
        };
        if (remainingMs > 0) {
          window.setTimeout(finalize, remainingMs);
        } else {
          finalize();
        }
      }

      function triggerWingFlapPulse(strength) {
        const now = performance.now();
        wingFlapPulseEndsAtMs = now + 260;
        wingFlapPulseStrength = Math.max(0.35, Number(strength) || 1);
        if (particleController && typeof particleController.emitWingFlap === "function") {
          particleController.emitWingFlap(
            player.x + PLAYER_W / 2,
            player.y + 15,
            player.facing || 1,
            wingFlapPulseStrength
          );
        }
      }

      function getWingFlapPulse(nowMs) {
        if (nowMs >= wingFlapPulseEndsAtMs) return 0;
        const durationMs = 260;
        const progress = Math.max(0, Math.min(1, 1 - ((wingFlapPulseEndsAtMs - nowMs) / durationMs)));
        // One impulse cycle: upstroke first, then downstroke.
        const envelope = Math.sin(progress * Math.PI);
        const direction = -1 + (2 * progress); // -1 -> +1 across pulse
        return envelope * direction * wingFlapPulseStrength;
      }

      const networkModule = modules.network || {};
      if (typeof networkModule.createNetworkState !== "function") {
        const reloadKey = "gt_network_module_reload_once_v1";
        try {
          if (sessionStorage.getItem(reloadKey) !== "1") {
            sessionStorage.setItem(reloadKey, "1");
            const script = document.createElement("script");
            script.src = "network.js?v=" + encodeURIComponent(String(Date.now()));
            script.onload = function () {
              const url = new URL(window.location.href);
              url.searchParams.set("v", String(Date.now()));
              window.location.replace(url.toString());
            };
            document.head.appendChild(script);
            return;
          }
        } catch (error) {
          // ignore storage/script injection failures and throw below
        }
        throw new Error("network.js module missing: GTModules.network.createNetworkState");
      }
      const network = networkModule.createNetworkState();
      try {
        sessionStorage.removeItem("gt_network_module_reload_once_v1");
      } catch (error) {
        // ignore storage errors
      }

      const adminState = {
        accounts: {},
        usernames: {},
        roles: {},
        audit: [],
        bans: {},
        chatMutes: {},
        sessions: {},
        inventories: {},
        globalPlayers: {}
      };
      let directAdminRole = "none";

      function setAuthStatus(text, isError) {
        const message = String(text || "").replace(/^\s*(notify|error)\s*:\s*/i, "");
        const hasError = Boolean(isError);
        authStatusEl.textContent = (hasError ? "Error: " : "Notify: ") + message;
        authStatusEl.classList.toggle("danger", hasError);
        authStatusEl.classList.toggle("notify", !hasError);
      }

      function setAuthBusy(isBusy) {
        authCreateBtn.disabled = isBusy;
        authLoginBtn.disabled = isBusy;
        authUsernameEl.disabled = isBusy;
        authPasswordEl.disabled = isBusy;
      }

      function normalizeUsername(value) {
        return (value || "").trim().toLowerCase();
      }

      const SESSION_NAV_TRANSFER_KEY = "gt_session_nav_transfer_v1";
      let pendingSessionTransferTarget = "";
      let pendingSessionTransferIssuedAt = 0;

      function normalizeSessionTransferTarget(value) {
        const raw = String(value || "").trim().toLowerCase();
        if (!raw) return "";
        const noHash = raw.split("#")[0];
        const noQuery = noHash.split("?")[0];
        const cleaned = noQuery.replace(/\\/g, "/");
        const parts = cleaned.split("/");
        return String(parts[parts.length - 1] || cleaned || "").trim().toLowerCase();
      }

      function isSessionTransferTarget(value) {
        const target = normalizeSessionTransferTarget(value);
        return target === "gambling_slots.html" || target === "gambling.html";
      }

      function shouldPreserveSessionOnNavigation() {
        try {
          if (isSessionTransferTarget(pendingSessionTransferTarget)) {
            const age = Math.abs(Date.now() - Math.max(0, Math.floor(Number(pendingSessionTransferIssuedAt) || 0)));
            if (age <= 30000) return true;
          }
          const raw = sessionStorage.getItem(SESSION_NAV_TRANSFER_KEY);
          if (!raw) return false;
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") return false;
          const target = String(parsed.target || "");
          if (!isSessionTransferTarget(target)) return false;
          const issuedAt = Math.max(0, Math.floor(Number(parsed.issuedAt) || 0));
          if (!issuedAt) return false;
          return Math.abs(Date.now() - issuedAt) <= 30000;
        } catch (_error) {
          return false;
        }
      }

      function prepareSessionNavigation(targetPath) {
        const target = String(targetPath || "").trim();
        if (!target) return;
        pendingSessionTransferTarget = target;
        pendingSessionTransferIssuedAt = Date.now();
        try {
          sessionStorage.setItem(SESSION_NAV_TRANSFER_KEY, JSON.stringify({
            target,
            issuedAt: pendingSessionTransferIssuedAt,
            accountId: String(playerProfileId || "").trim(),
            username: String(playerName || "").trim().toLowerCase(),
            sessionId: String(playerSessionId || "").trim()
          }));
        } catch (_error) {
          // ignore sessionStorage errors
        }
        window.location.href = target;
      }

      if (typeof window !== "undefined") {
        window.prepareSessionNavigation = prepareSessionNavigation;
      }

      function saveCredentials(username, password) {
        if (typeof authStorageModule.saveCredentials === "function") {
          authStorageModule.saveCredentials(SAVED_AUTH_KEY, username, password);
          return;
        }
        saveJsonToLocalStorage(SAVED_AUTH_KEY, {
          username: (username || "").toString().slice(0, 20),
          password: (password || "").toString().slice(0, 64)
        });
      }

      function loadSavedCredentials() {
        if (typeof authStorageModule.loadCredentials === "function") {
          return authStorageModule.loadCredentials(SAVED_AUTH_KEY);
        }
        const parsed = loadJsonFromLocalStorage(SAVED_AUTH_KEY);
        return {
          username: (parsed && parsed.username || "").toString(),
          password: (parsed && parsed.password || "").toString()
        };
      }

      function applySavedCredentialsToForm() {
        const saved = loadSavedCredentials();
        if (saved.username) authUsernameEl.value = saved.username;
        if (saved.password) authPasswordEl.value = saved.password;
        const secure = window.GTModules && window.GTModules.secureStorage;
        if ((!saved.username && !saved.password) && secure && typeof secure.init === "function") {
          secure.init().then(() => {
            const late = loadSavedCredentials();
            if (late.username && !authUsernameEl.value) authUsernameEl.value = late.username;
            if (late.password && !authPasswordEl.value) authPasswordEl.value = late.password;
          }).catch(() => {});
        }
      }

      function saveJsonToLocalStorage(storageKey, payload) {
        const key = String(storageKey || "");
        if (!key) return;
        const secure = window.GTModules && window.GTModules.secureStorage;
        if (secure && typeof secure.saveJson === "function") {
          secure.saveJson(key, payload);
          return;
        }
        try {
          localStorage.setItem(key, JSON.stringify(payload));
        } catch (error) {
          // ignore localStorage failures
        }
      }

      function loadJsonFromLocalStorage(storageKey) {
        const key = String(storageKey || "");
        if (!key) return null;
        const secure = window.GTModules && window.GTModules.secureStorage;
        if (secure && typeof secure.loadJson === "function") {
          const value = secure.loadJson(key);
          if (value && typeof value === "object") return value;
        }
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" ? parsed : null;
        } catch (error) {
          return null;
        }
      }

      function loadForceReloadMarker() {
        try {
          return (sessionStorage.getItem(FORCE_RELOAD_MARKER_KEY) || "").toString();
        } catch (error) {
          return "";
        }
      }

      function saveForceReloadMarker(eventId) {
        try {
          sessionStorage.setItem(FORCE_RELOAD_MARKER_KEY, (eventId || "").toString().slice(0, 60));
        } catch (error) {
          // ignore sessionStorage failures
        }
      }

      function saveForceReloadNotice(text) {
        try {
          sessionStorage.setItem(FORCE_RELOAD_NOTICE_KEY, String(text || "").slice(0, 200));
        } catch (error) {
          // ignore sessionStorage failures
        }
      }

      function takeForceReloadNotice() {
        try {
          const text = (sessionStorage.getItem(FORCE_RELOAD_NOTICE_KEY) || "").toString();
          if (text) sessionStorage.removeItem(FORCE_RELOAD_NOTICE_KEY);
          return text;
        } catch (error) {
          return "";
        }
      }

      function renderMainPageNotice() {
        const parts = [];
        if (localUpdateNoticeText) parts.push(localUpdateNoticeText);
        if (serverMainPageNoticeText) parts.push(serverMainPageNoticeText);
        const text = parts.join(" | ").trim().slice(0, 420);
        const apply = (el) => {
          if (!(el instanceof HTMLElement)) return;
          if (!text) {
            el.textContent = "";
            el.classList.add("hidden");
            return;
          }
          el.textContent = text;
          el.classList.remove("hidden");
        };
        apply(authMainNoticeEl);
        apply(menuMainNoticeEl);
      }

      function setServerMainPageNotice(text) {
        serverMainPageNoticeText = String(text || "").trim().slice(0, 220);
        renderMainPageNotice();
      }

      function setLocalUpdateNotice(text) {
        localUpdateNoticeText = String(text || "").trim().slice(0, 220);
        renderMainPageNotice();
      }

      async function startPublicMainNoticeListener() {
        if (publicMainNoticeRef) return;
        try {
          publicMainNoticeDb = await getAuthDb();
          if (!publicMainNoticeDb) return;
          publicMainNoticeRef = publicMainNoticeDb.ref(BASE_PATH + "/system/main-notification");
          publicMainNoticeHandler = (snapshot) => {
            const value = snapshot && snapshot.val ? (snapshot.val() || {}) : {};
            const text = (value.text || "").toString().trim().slice(0, 220);
            setServerMainPageNotice(text);
          };
          publicMainNoticeRef.on("value", publicMainNoticeHandler);
        } catch (error) {
          // ignore when DB is unavailable pre-login
        }
      }

      function normalizeCameraZoom(value) {
        const numeric = Number(value);
        const safe = Number.isFinite(numeric) ? numeric : 1;
        return Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, safe));
      }

      function loadCameraZoomPref() {
        try {
          return normalizeCameraZoom(localStorage.getItem(CAMERA_ZOOM_PREF_KEY) || 1);
        } catch (error) {
          return 1;
        }
      }

      function saveCameraZoomPref(value) {
        try {
          localStorage.setItem(CAMERA_ZOOM_PREF_KEY, String(normalizeCameraZoom(value)));
        } catch (error) {
          // ignore localStorage failures
        }
      }

      function setCameraZoom(nextZoom, persist) {
        const normalized = normalizeCameraZoom(nextZoom);
        if (Math.abs(normalized - cameraZoom) < 0.0001) return;
        cameraZoom = normalized;
        if (persist) saveCameraZoomPref(cameraZoom);
        updateCamera(true);
      }

      function changeCameraZoom(delta) {
        setCameraZoom(cameraZoom + Number(delta || 0), true);
      }

      function getCameraViewWidth() {
        return canvas.width / Math.max(0.01, cameraZoom);
      }

      function getCameraViewHeight() {
        return canvas.height / Math.max(0.01, cameraZoom);
      }

      function canUserViewLogs(username) {
        const normalized = normalizeUsername(username);
        if (LOG_VIEWER_USERNAMES.includes(normalized)) return true;
        return hasAdminPermission("view_logs");
      }

      function canViewAntiCheatLogs() {
        return getRoleRank(currentAdminRole) >= getRoleRank("manager");
      }

      function normalizeAdminRole(role) {
        if (typeof adminModule.normalizeAdminRole === "function") {
          return adminModule.normalizeAdminRole(role, adminRoleConfig);
        }
        const value = String(role || "").trim().toLowerCase();
        return ["none", "moderator", "admin", "manager", "owner"].includes(value) ? value : "none";
      }

      function readAdminRoleValue(rawRole) {
        if (rawRole === undefined || rawRole === null) return "none";
        if (typeof rawRole === "string") return normalizeAdminRole(rawRole);
        if (typeof rawRole === "object") {
          const row = rawRole || {};
          const candidate = row.role !== undefined
            ? row.role
            : (row.value !== undefined
              ? row.value
              : (row.name !== undefined ? row.name : ""));
          return normalizeAdminRole(candidate);
        }
        return normalizeAdminRole(rawRole);
      }

      function getRoleRank(role) {
        if (typeof adminModule.getRoleRank === "function") {
          return adminModule.getRoleRank(role, adminRoleConfig);
        }
        const map = adminRoleConfig && adminRoleConfig.roleRank ? adminRoleConfig.roleRank : {};
        return Number(map[normalizeAdminRole(role)]) || 0;
      }

      function hasAdminPermission(permissionKey) {
        if (typeof adminModule.hasAdminPermission === "function") {
          return adminModule.hasAdminPermission(currentAdminRole, permissionKey, adminRoleConfig);
        }
        const role = normalizeAdminRole(currentAdminRole);
        const map = adminRoleConfig && adminRoleConfig.permissions ? adminRoleConfig.permissions : {};
        const list = Array.isArray(map[role]) ? map[role] : [];
        return list.includes(permissionKey);
      }

      function getConfiguredRoleForUsername(username) {
        if (typeof adminModule.getConfiguredRoleForUsername === "function") {
          return adminModule.getConfiguredRoleForUsername(username, adminRoleConfig);
        }
        const normalized = normalizeUsername(username);
        if (!normalized) return "none";
        const roleByUsername = adminRoleConfig && adminRoleConfig.roleByUsername ? adminRoleConfig.roleByUsername : {};
        if (roleByUsername[normalized]) return normalizeAdminRole(roleByUsername[normalized]);
        const adminUsernames = adminRoleConfig && Array.isArray(adminRoleConfig.adminUsernames) ? adminRoleConfig.adminUsernames : ["isxt"];
        if (adminUsernames.includes(normalized)) return "owner";
        return "none";
      }

      function getAccountRole(accountId, username) {
        const safeAccountId = String(accountId || "").trim();
        if (safeAccountId && playerProfileId && safeAccountId === playerProfileId && directAdminRole !== "none") {
          return directAdminRole;
        }
        if (safeAccountId && Object.prototype.hasOwnProperty.call(adminState.roles, safeAccountId)) {
          return readAdminRoleValue(adminState.roles[safeAccountId]);
        }
        return getConfiguredRoleForUsername(username);
      }

      function formatRoleLabel(role) {
        const normalized = normalizeAdminRole(role);
        if (normalized === "none") return "Player";
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
      }

      function refreshAdminCapabilities(announceRoleChange) {
        const previousRole = normalizeAdminRole(currentAdminRole);
        currentAdminRole = normalizeAdminRole(getAccountRole(playerProfileId, playerName));
        const nextRole = normalizeAdminRole(currentAdminRole);
        if (announceRoleChange && playerProfileId && previousRole !== nextRole) {
          const prevRank = getRoleRank(previousRole);
          const nextRank = getRoleRank(nextRole);
          let headline = "Your role was updated.";
          if (nextRank > prevRank) headline = "You were promoted to";
          if (nextRank < prevRank) headline = "You were demoted to";
          const details = formatRoleLabel(nextRole);
          showAnnouncementPopup(headline + " " + details, 5600);
          postLocalSystemChat("[System] Role change: " + details + ".");
        }
        canUseAdminPanel = hasAdminPermission("panel_open");
        canViewAccountLogs = canUserViewLogs(playerName);
        adminToggleBtn.classList.toggle("hidden", !canUseAdminPanel);
        syncQuickAdminButtonVisibility();
        if (adminForceReloadBtn) {
          const canForceReload = hasAdminPermission("force_reload");
          adminForceReloadBtn.classList.toggle("hidden", !canForceReload);
          adminForceReloadBtn.disabled = !canForceReload;
        }
        if (adminBackupDownloadBtn) {
          const canDownloadBackupJson = hasAdminPermission("db_restore");
          adminBackupDownloadBtn.classList.toggle("hidden", !canDownloadBackupJson);
          adminBackupDownloadBtn.disabled = !canDownloadBackupJson;
        }
        if (adminBackupUploadBtn) {
          const canUploadBackupJson = hasAdminPermission("db_backup");
          adminBackupUploadBtn.classList.toggle("hidden", !canUploadBackupJson);
          adminBackupUploadBtn.disabled = !canUploadBackupJson;
        }
        if (adminBackupUploadInput) {
          adminBackupUploadInput.disabled = !hasAdminPermission("db_backup");
        }
        if (adminAuditActionFilterEl) adminAuditActionFilterEl.disabled = !hasAdminPermission("view_audit");
        if (adminAuditActorFilterEl) adminAuditActorFilterEl.disabled = !hasAdminPermission("view_audit");
        if (adminAuditTargetFilterEl) adminAuditTargetFilterEl.disabled = !hasAdminPermission("view_audit");
        if (adminAuditExportBtn) adminAuditExportBtn.disabled = !hasAdminPermission("view_audit");
        if (!hasAdminPermission("db_restore")) {
          adminBackupList = [];
          adminBackupSelectedId = "";
          adminBackupLoading = false;
        }
        if (network.accountLogsRootRef && network.handlers.accountLogAdded) {
          network.accountLogsRootRef.off("value", network.handlers.accountLogAdded);
          if (canViewAccountLogs) {
            network.accountLogsRootRef.on("value", network.handlers.accountLogAdded);
          } else {
            clearLogsView();
          }
        }
        if (network.antiCheatLogsRef && network.handlers.antiCheatLogAdded) {
          network.antiCheatLogsRef.off("value", network.handlers.antiCheatLogAdded);
          if (canViewAntiCheatLogs()) {
            network.antiCheatLogsRef.on("value", network.handlers.antiCheatLogAdded);
          } else {
            antiCheatMessages.length = 0;
          }
        }
        if (!canUseAdminPanel) setAdminOpen(false);
        if (network.enabled) {
          syncAdminDataListeners();
        }
      }

      function canActorAffectTarget(targetAccountId, targetRole) {
        if (typeof adminsModule.canActorAffectTarget === "function") {
          return adminsModule.canActorAffectTarget(
            currentAdminRole,
            targetRole,
            targetAccountId,
            playerProfileId,
            adminRoleConfig
          );
        }
        if (!targetAccountId) return false;
        if (targetAccountId === playerProfileId) return true;
        const actorRank = getRoleRank(currentAdminRole);
        const targetRank = getRoleRank(targetRole);
        return actorRank > targetRank;
      }

      function canActorGrantTarget(targetAccountId, targetRole) {
        if (!targetAccountId) return false;
        if (targetAccountId === playerProfileId) return true;
        return canActorAffectTarget(targetAccountId, targetRole);
      }

      function canUserUseAdmin() {
        return hasAdminPermission("panel_open");
      }

      function canSetRoleTo(targetAccountId, nextRole) {
        if (typeof adminsModule.canSetRoleTo === "function") {
          const targetRoleFromState = getAccountRole(targetAccountId, adminState.accounts[targetAccountId] && adminState.accounts[targetAccountId].username);
          return adminsModule.canSetRoleTo(
            currentAdminRole,
            targetRoleFromState,
            targetAccountId,
            playerProfileId,
            nextRole,
            hasAdminPermission("setrole_limited"),
            adminRoleConfig
          );
        }
        const actorRole = normalizeAdminRole(currentAdminRole);
        const targetRole = getAccountRole(targetAccountId, adminState.accounts[targetAccountId] && adminState.accounts[targetAccountId].username);
        const actorRank = getRoleRank(actorRole);
        const targetRank = getRoleRank(targetRole);
        const desiredRole = normalizeAdminRole(nextRole);
        if (!targetAccountId || targetAccountId === playerProfileId) return false;
        if (actorRole === "owner") return true;
        if (!hasAdminPermission("setrole_limited")) return false;
        if (targetRank >= actorRank) return false;
        return desiredRole === "none" || desiredRole === "moderator" || desiredRole === "admin";
      }

      function getAssignableRoles() {
        if (normalizeAdminRole(currentAdminRole) === "owner") {
          return ["none", "moderator", "admin", "manager", "owner"];
        }
        if (hasAdminPermission("setrole_limited")) {
          return ["none", "moderator", "admin"];
        }
        return [];
      }

      function parseDurationToMs(input) {
        if (typeof adminsModule.parseDurationToMs === "function") {
          return adminsModule.parseDurationToMs(input);
        }
        if (typeof adminModule.parseDurationToMs === "function") {
          return adminModule.parseDurationToMs(input);
        }
        const value = String(input || "").trim().toLowerCase();
        const match = value.match(/^(\d+)\s*([smhd])$/);
        if (!match) return 0;
        const amount = Number(match[1]);
        const unit = match[2];
        if (!Number.isFinite(amount) || amount <= 0) return 0;
        const unitMs = unit === "s" ? 1000 : unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000;
        return amount * unitMs;
      }

      function formatRemainingMs(ms) {
        if (typeof adminsModule.formatRemainingMs === "function") {
          return adminsModule.formatRemainingMs(ms);
        }
        if (typeof adminModule.formatRemainingMs === "function") {
          return adminModule.formatRemainingMs(ms);
        }
        const safe = Math.max(0, Math.floor(ms));
        if (safe < 60000) return Math.ceil(safe / 1000) + "s";
        if (safe < 3600000) return Math.ceil(safe / 60000) + "m";
        if (safe < 86400000) return Math.ceil(safe / 3600000) + "h";
        return Math.ceil(safe / 86400000) + "d";
      }

      function getCommandCooldownMs(commandKey) {
        if (typeof adminModule.getCommandCooldownMs === "function") {
          return adminModule.getCommandCooldownMs(currentAdminRole, commandKey, adminRoleConfig);
        }
        const role = normalizeAdminRole(currentAdminRole);
        const map = adminRoleConfig && adminRoleConfig.commandCooldownsMs ? adminRoleConfig.commandCooldownsMs : {};
        const roleMap = map[role] && typeof map[role] === "object" ? map[role] : {};
        return Number(roleMap[commandKey]) || 0;
      }

      function consumeCommandCooldown(commandKey) {
        const cooldown = getCommandCooldownMs(commandKey);
        if (cooldown <= 0) return 0;
        const now = Date.now();
        const key = (playerProfileId || "guest") + ":" + commandKey;
        const last = adminCommandLastUsedAt.get(key) || 0;
        const remaining = cooldown - (now - last);
        if (remaining > 0) {
          return remaining;
        }
        adminCommandLastUsedAt.set(key, now);
        return 0;
      }

      function ensureCommandReady(commandKey) {
        const left = consumeCommandCooldown(commandKey);
        if (left > 0) {
          postLocalSystemChat("Cooldown: wait " + formatRemainingMs(left) + " for /" + commandKey + ".");
          return false;
        }
        return true;
      }

      function normalizeBanRecord(record) {
        if (typeof adminsModule.normalizeBanRecord === "function") {
          return adminsModule.normalizeBanRecord(record);
        }
        const value = record || {};
        const typeRaw = String(value.type || "").toLowerCase();
        const type = typeRaw === "permanent" ? "permanent" : "temporary";
        const expiresAt = Number(value.expiresAt) || 0;
        return {
          type,
          expiresAt,
          reason: (value.reason || "Banned by admin").toString(),
          bannedBy: (value.bannedBy || "").toString(),
          createdAt: Number(value.createdAt) || 0
        };
      }

      function getBanStatus(record, nowMs) {
        if (typeof adminsModule.getBanStatus === "function") {
          return adminsModule.getBanStatus(record, nowMs);
        }
        if (!record) return { active: false, expired: false, type: "temporary", remainingMs: 0, reason: "" };
        const normalized = normalizeBanRecord(record);
        if (normalized.type === "permanent") {
          return { active: true, expired: false, type: "permanent", remainingMs: Infinity, reason: normalized.reason };
        }
        const remainingMs = normalized.expiresAt - nowMs;
        if (!normalized.expiresAt || remainingMs <= 0) {
          return { active: false, expired: true, type: "temporary", remainingMs: 0, reason: normalized.reason };
        }
        return { active: true, expired: false, type: "temporary", remainingMs, reason: normalized.reason };
      }

      function normalizeChatMuteRecord(record) {
        if (!record) return null;
        if (record === true) {
          return { muted: true, reason: "", mutedBy: "", createdAt: 0, expiresAt: 0 };
        }
        if (typeof record !== "object") return null;
        const row = record || {};
        if (row.muted === false) return null;
        return {
          muted: true,
          reason: (row.reason || "").toString().slice(0, 120),
          mutedBy: (row.mutedBy || row.by || "").toString().slice(0, 20),
          createdAt: Number(row.createdAt) || 0,
          expiresAt: Number(row.expiresAt) || 0
        };
      }

      function getChatMuteStatus(record, nowMs) {
        const normalized = normalizeChatMuteRecord(record);
        if (!normalized) {
          return { active: false, expired: false, remainingMs: 0, reason: "", mutedBy: "", permanent: false };
        }
        const expiresAt = Math.max(0, Number(normalized.expiresAt) || 0);
        if (!expiresAt) {
          return {
            active: true,
            expired: false,
            remainingMs: Infinity,
            reason: normalized.reason,
            mutedBy: normalized.mutedBy,
            permanent: true
          };
        }
        const remainingMs = expiresAt - nowMs;
        if (remainingMs <= 0) {
          return {
            active: false,
            expired: true,
            remainingMs: 0,
            reason: normalized.reason,
            mutedBy: normalized.mutedBy,
            permanent: false
          };
        }
        return {
          active: true,
          expired: false,
          remainingMs,
          reason: normalized.reason,
          mutedBy: normalized.mutedBy,
          permanent: false
        };
      }

      function copyTextToClipboard(text) {
        const safeText = String(text || "").trim();
        if (!safeText) return Promise.resolve(false);
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function" && window.isSecureContext) {
          return navigator.clipboard.writeText(safeText).then(() => true).catch(() => false);
        }
        return new Promise((resolve) => {
          try {
            const area = document.createElement("textarea");
            area.value = safeText;
            area.setAttribute("readonly", "readonly");
            area.style.position = "fixed";
            area.style.opacity = "0";
            area.style.pointerEvents = "none";
            document.body.appendChild(area);
            area.select();
            const ok = document.execCommand("copy");
            area.remove();
            resolve(Boolean(ok));
          } catch (error) {
            resolve(false);
          }
        });
      }

      function setAdminOpen(open) {
        if (typeof document !== "undefined" && document.body) {
          document.body.classList.toggle("admin-dashboard-open", false);
        }
        if (!canUseAdminPanel) {
          isAdminOpen = false;
          adminPanelEl.classList.add("hidden");
          closeAdminInventoryModal();
          return;
        }
        isAdminOpen = Boolean(open);
        adminPanelEl.classList.toggle("hidden", !isAdminOpen);
        if (typeof document !== "undefined" && document.body) {
          document.body.classList.toggle("admin-dashboard-open", isAdminOpen);
        }
        if (isAdminOpen) {
          refreshAuditActionFilterOptions();
          if (hasAdminPermission("db_restore")) {
            refreshAdminBackups(true);
          }
          renderAdminPanel();
        }
        if (!isAdminOpen) {
          closeAdminInventoryModal();
        }
      }

      function renderAdminPanelFromLiveUpdate() {
        if (isAdminOpen) return;
        renderAdminPanel();
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll("\"", "&quot;")
          .replaceAll("'", "&#039;");
      }

      function totalInventoryCount(inv) {
        if (typeof adminsModule.totalInventoryCount === "function") {
          return adminsModule.totalInventoryCount(inv, INVENTORY_IDS);
        }
        if (!inv || typeof inv !== "object") return 0;
        let total = 0;
        for (const id of INVENTORY_IDS) {
          total += Math.max(0, Number(inv[id]) || 0);
        }
        return total;
      }

      function getAvailableRankCommands() {
        const list = [
          "/myrole",
          "/warp <world>",
          "/dance",
          "/msg <user> <message>",
          "/r <message>",
          "/lock",
          "/unlock",
          "/online"
        ];
        if (hasAdminPermission("tp")) list.push("/where <user>", "/goto <user>", "/tp <user>");
        if (hasAdminPermission("bring")) list.push("/bringall", "/bring <user>", "/summon <user>");
        if (hasAdminPermission("announce")) list.push("/announce <message>");
        if (hasAdminPermission("announce")) list.push("/mainnotif <message>", "/mainnotif clear");
        if (hasAdminPermission("announce_user")) list.push("/announcep <user> <message>");
        if (hasAdminPermission("tempban")) list.push("/tempban <user> <60m|12h|7d> [reason]", "/ban <user> [60m|12h|7d] [reason]");
        if (hasAdminPermission("permban")) list.push("/permban <user> [reason]");
        if (hasAdminPermission("unban")) list.push("/unban <user>");
        if (hasAdminPermission("kick")) list.push("/kick <user>");
        if (hasAdminPermission("freeze")) list.push("/freeze <user>");
        if (hasAdminPermission("unfreeze")) list.push("/unfreeze <user>");
        if (hasAdminPermission("godmode")) list.push("/godmode [user] <on|off>");
        if (hasAdminPermission("clearworld")) list.push("/clearworld");
        if (hasAdminPermission("resetinv")) list.push("/resetinv <user>");
        if (hasAdminPermission("give_block")) list.push("/givex <user> <block_key> <amount>", "/givefarmable <user> <farmable_key> <amount>");
        if (hasAdminPermission("give_item")) list.push("/giveitem <user> <item_id> <amount>", "/spawnd <item> <qty_per_drop> <tile_amount>");
        if (hasAdminPermission("give_title")) list.push("/givetitle <user> <title_id> <amount>");
        if (hasAdminPermission("remove_title")) list.push("/removetitle <user> <title_id> <amount>");
        if (hasAdminPermission("reach")) list.push("/reach <user> <amount>");
        if (hasAdminPermission("setrole") || hasAdminPermission("setrole_limited")) list.push("/setrole <user> <none|moderator|admin|manager|owner>", "/role <user>");
        if (hasAdminPermission("clear_logs")) list.push("/clearaudit", "/clearlogs");
        if (normalizeAdminRole(currentAdminRole) === "owner") list.push("/questworld", "/questworldoff");
        return list;
      }

      function getAuditLevel(action) {
        if (typeof adminModule.getAuditLevel === "function") {
          return adminModule.getAuditLevel(action);
        }
        return "info";
      }

      function getLogLevel(text) {
        if (typeof adminModule.getLogLevel === "function") {
          return adminModule.getLogLevel(text);
        }
        return "info";
      }

      function scrollElementToBottom(el) {
        if (!(el instanceof HTMLElement)) return;
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }

      function closeAdminInventoryModal() {
        if (adminInventoryModalEl) {
          adminInventoryModalEl.classList.add("hidden");
          delete adminInventoryModalEl.dataset.accountId;
        }
      }

      function canEditAdminInventoryModal() {
        return getRoleRank(currentAdminRole) >= getRoleRank("manager");
      }

      function syncAdminPanelAfterInventoryChange(accountId) {
        if (!accountId) return;
        if (isAdminOpen) {
          renderAdminPanel();
        }
        if (adminInventoryModalEl && !adminInventoryModalEl.classList.contains("hidden") && adminInventoryModalEl.dataset.accountId === accountId) {
          openAdminInventoryModal(accountId);
        }
      }

      function setLocalInventoryBlockCount(accountId, blockId, nextValue) {
        if (!accountId) return;
        if (!adminState.inventories[accountId] || typeof adminState.inventories[accountId] !== "object") {
          adminState.inventories[accountId] = {};
        }
        const safeId = Number(blockId);
        adminState.inventories[accountId][safeId] = Math.max(0, Math.floor(Number(nextValue) || 0));
      }

      function setLocalInventoryCosmeticCount(accountId, itemId, nextValue) {
        if (!accountId) return;
        if (!adminState.inventories[accountId] || typeof adminState.inventories[accountId] !== "object") {
          adminState.inventories[accountId] = {};
        }
        if (!adminState.inventories[accountId].cosmeticItems || typeof adminState.inventories[accountId].cosmeticItems !== "object") {
          adminState.inventories[accountId].cosmeticItems = {};
        }
        const safeItemId = String(itemId || "");
        adminState.inventories[accountId].cosmeticItems[safeItemId] = Math.max(0, Math.floor(Number(nextValue) || 0));
      }

      function setLocalInventoryTitleCount(accountId, titleId, nextValue) {
        if (!accountId) return;
        if (!adminState.inventories[accountId] || typeof adminState.inventories[accountId] !== "object") {
          adminState.inventories[accountId] = {};
        }
        if (!adminState.inventories[accountId].titleItems || typeof adminState.inventories[accountId].titleItems !== "object") {
          adminState.inventories[accountId].titleItems = {};
        }
        const safeTitleId = String(titleId || "");
        adminState.inventories[accountId].titleItems[safeTitleId] = clampTitleUnlocked(nextValue);
      }

      function adjustLocalInventoryBlockCount(accountId, blockId, delta) {
        const safeId = Number(blockId);
        const current = Math.max(0, Math.floor(Number(adminState.inventories[accountId] && adminState.inventories[accountId][safeId]) || 0));
        setLocalInventoryBlockCount(accountId, safeId, current + Number(delta || 0));
      }

      function adjustLocalInventoryCosmeticCount(accountId, itemId, delta) {
        const safeItemId = String(itemId || "");
        const current = Math.max(0, Math.floor(Number(adminState.inventories[accountId] && adminState.inventories[accountId].cosmeticItems && adminState.inventories[accountId].cosmeticItems[safeItemId]) || 0));
        setLocalInventoryCosmeticCount(accountId, safeItemId, current + Number(delta || 0));
      }

      function buildAdminInventoryItemOptions(kind) {
        if (kind === "farmable") {
          return FARMABLE_INVENTORY_IDS.map((id) => {
            const label = blockDefs[id] && blockDefs[id].name ? blockDefs[id].name : ("Farmable " + id);
            return '<option value="' + escapeHtml(getBlockKeyById(id)) + '">' + escapeHtml(label + " (" + getBlockKeyById(id) + ")") + "</option>";
          }).join("");
        }
        if (kind === "cosmetic") {
          return COSMETIC_ITEMS.map((item) => {
            return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.name + " (" + item.id + ")") + "</option>";
          }).join("");
        }
        if (kind === "title") {
          return TITLE_CATALOG.map((title) => {
            return '<option value="' + escapeHtml(title.id) + '">' + escapeHtml(title.name + " (" + title.id + ")") + "</option>";
          }).join("");
        }
        return NORMAL_BLOCK_INVENTORY_IDS.map((id) => {
          const label = blockDefs[id] && blockDefs[id].name ? blockDefs[id].name : ("Block " + id);
          return '<option value="' + escapeHtml(getBlockKeyById(id)) + '">' + escapeHtml(label + " (" + getBlockKeyById(id) + ")") + "</option>";
        }).join("");
      }

      function openAdminInventoryModal(accountId) {
        if (!canUseAdminPanel || !adminInventoryModalEl || !adminInventoryTitleEl || !adminInventoryBodyEl) return;
        const account = adminState.accounts[accountId] || {};
        const username = (account.username || accountId || "unknown").toString();
        const inv = adminState.inventories[accountId] || {};
        const rows = [];
        for (const id of INVENTORY_IDS) {
          const qty = Math.max(0, Math.floor(Number(inv[id]) || 0));
          if (qty <= 0) continue;
          const def = blockDefs[id] || {};
          const blockKey = getBlockKeyById(id);
          const isFarmable = FARMABLE_INVENTORY_IDS.includes(id);
          rows.push({
            kind: isFarmable ? "farmable" : "block",
            itemId: blockKey,
            label: def.name ? (def.name + " (" + (isFarmable ? "Farmable " : "Block ") + id + ")") : ((isFarmable ? "Farmable " : "Block ") + id),
            qty
          });
        }
        const itemRecord = inv && inv.cosmeticItems || {};
        for (const item of COSMETIC_ITEMS) {
          const qty = Math.max(0, Math.floor(Number(itemRecord[item.id]) || 0));
          if (qty <= 0) continue;
          rows.push({
            kind: "cosmetic",
            itemId: item.id,
            label: (item.name || item.id) + " (" + item.slot + ")",
            qty
          });
        }
        const titleRecord = inv && inv.titleItems || {};
        for (const title of TITLE_CATALOG) {
          const qty = Math.max(0, Math.floor(Number(titleRecord[title.id]) || 0));
          if (qty <= 0) continue;
          rows.push({
            kind: "title",
            itemId: title.id,
            label: title.name + " (title)",
            qty
          });
        }
        adminInventoryTitleEl.textContent = "@" + username + " Inventory";
        adminInventoryModalEl.dataset.accountId = accountId;
        const canEdit = canEditAdminInventoryModal() && canActorGrantTarget(accountId, getAccountRole(accountId, username));
        const currentItemOptions = rows.length
          ? rows.map((row) => {
            return '<option value="' + escapeHtml(row.kind + ":" + row.itemId) + '">' + escapeHtml(row.label + " x" + row.qty) + "</option>";
          }).join("")
          : "<option value=''>No owned items</option>";
        const editorMarkup = canEdit
          ? "<div class='admin-inventory-tools'>" +
            "<select class='admin-inv-kind' data-account-id='" + escapeHtml(accountId) + "'>" +
            "<option value='block'>Blocks</option>" +
            "<option value='farmable'>Farmables</option>" +
            "<option value='cosmetic'>Cosmetics</option>" +
            "<option value='title'>Titles</option>" +
            "</select>" +
            "<select class='admin-inv-item' data-account-id='" + escapeHtml(accountId) + "'>" + buildAdminInventoryItemOptions("block") + "</select>" +
            "<input class='admin-inv-amount' data-account-id='" + escapeHtml(accountId) + "' type='number' min='1' step='1' value='1'>" +
            "<button data-admin-inv-act='add' data-account-id='" + escapeHtml(accountId) + "'>Add</button>" +
            "<button data-admin-inv-act='remove' data-account-id='" + escapeHtml(accountId) + "'>Remove</button>" +
            "<select class='admin-inv-current' data-account-id='" + escapeHtml(accountId) + "'>" + currentItemOptions + "</select>" +
            "<button data-admin-inv-act='removeallselected' data-account-id='" + escapeHtml(accountId) + "' " + (rows.length ? "" : "disabled") + ">Remove Selected All</button>" +
            "</div>"
          : "";
        if (!rows.length) {
          adminInventoryBodyEl.innerHTML = editorMarkup + "<div class='admin-inventory-row'><span class='admin-inventory-item'>No items.</span><span class='admin-inventory-qty'>0</span></div>";
        } else {
          adminInventoryBodyEl.innerHTML = editorMarkup + rows.map((row) => {
            return "<div class='admin-inventory-row'>" +
              "<span class='admin-inventory-item'>" + escapeHtml(row.label) + "</span>" +
              "<span class='admin-inventory-qty'>" + row.qty + "</span>" +
              (canEdit
                ? "<button data-admin-inv-act='removeall' data-account-id='" + escapeHtml(accountId) + "' data-kind='" + escapeHtml(row.kind) + "' data-item-id='" + escapeHtml(row.itemId) + "'>Remove All</button>"
                : "") +
              "</div>";
          }).join("");
        }
        adminInventoryModalEl.classList.remove("hidden");
      }

      function closeVendingModal() {
        const ctrl = getVendingController();
        if (ctrl && typeof ctrl.closeModal === "function") {
          ctrl.closeModal();
          return;
        }
        if (vendingModalEl) vendingModalEl.classList.add("hidden");
      }

      function renderVendingModal(tx, ty, vm) {
        const ctrl = getVendingController();
        if (ctrl && typeof ctrl.renderModal === "function") {
          ctrl.renderModal(tx, ty, vm);
        }
      }

      function normalizeDonationBoxRecord(value) {
        const ctrl = getDonationController();
        if (ctrl && typeof ctrl.normalizeRecord === "function") {
          return ctrl.normalizeRecord(value);
        }
        return value && typeof value === "object" ? value : {};
      }

      function setLocalDonationBox(tx, ty, value) {
        const ctrl = getDonationController();
        if (ctrl && typeof ctrl.setLocal === "function") {
          ctrl.setLocal(tx, ty, value);
        }
      }

      function getLocalDonationBox(tx, ty) {
        const ctrl = getDonationController();
        if (ctrl && typeof ctrl.getLocal === "function") {
          return ctrl.getLocal(tx, ty);
        }
        return null;
      }

      function closeDonationModal() {
        const ctrl = getDonationController();
        if (ctrl && typeof ctrl.closeModal === "function") {
          ctrl.closeModal();
          return;
        }
        if (donationModalEl) donationModalEl.classList.add("hidden");
      }

      function seedDonationBoxOwner(tx, ty) {
        const ctrl = getDonationController();
        if (ctrl && typeof ctrl.seedOwner === "function") {
          ctrl.seedOwner(tx, ty);
        }
      }

      function getDonationStoredCount(items) {
        const ctrl = getDonationController();
        if (ctrl && typeof ctrl.getStoredCount === "function") {
          return ctrl.getStoredCount(items);
        }
        const list = items && typeof items === "object" ? items : {};
        let total = 0;
        for (const value of Object.values(list)) {
          total += Math.max(0, Math.floor(Number(value) || 0));
        }
        return total;
      }

      function openDonationModal(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return;
        if (!isDonationBoxBlockId(world[ty][tx])) return;
        const ctrl = getDonationController();
        if (ctrl && typeof ctrl.openModal === "function") {
          ctrl.openModal(tx, ty);
        }
      }

      function closeChestModal() {
        const ctrl = getChestController();
        if (ctrl && typeof ctrl.closeModal === "function") {
          ctrl.closeModal();
          return;
        }
        if (chestModalEl) chestModalEl.classList.add("hidden");
      }

      function openChestModal(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return;
        if (!isChestBlockId(world[ty][tx])) return;
        const ctrl = getChestController();
        if (ctrl && typeof ctrl.openModal === "function") {
          ctrl.openModal(tx, ty);
        }
      }

      function closeGambleModal() {
        const ctrl = getGambleController();
        if (ctrl && typeof ctrl.closeModal === "function") {
          ctrl.closeModal();
          return;
        }
        if (gambleModalEl) gambleModalEl.classList.add("hidden");
      }

      function openGambleModal(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return;
        const tileId = Number(world[ty] && world[ty][tx]);
        if (tileId !== GAMBLE_ID) return;
        const ctrl = getGambleController();
        if (ctrl && typeof ctrl.openModal === "function") {
          ctrl.openModal(tx, ty);
          return;
        }
        postLocalSystemChat("Gamble module unavailable.");
      }

      function getAdminBackupOptionsMarkup() {
        const ctrl = getAdminPanelController();
        if (ctrl && typeof ctrl.getAdminBackupOptionsMarkup === "function") {
          return ctrl.getAdminBackupOptionsMarkup();
        }
        if (!adminBackupList.length) return "<option value=''>No backups found</option>";
        return adminBackupList.map((row) => "<option value='" + escapeHtml(row.id) + "'>" + escapeHtml(String(row.id || "")) + "</option>").join("");
      }

      function refreshAdminBackups(force) {
        const ctrl = getAdminPanelController();
        if (ctrl && typeof ctrl.refreshAdminBackups === "function") {
          return ctrl.refreshAdminBackups(force);
        }
        return Promise.resolve([]);
      }

      function runDatabaseBackup(sourceTag) {
        const ctrl = getAdminPanelController();
        if (ctrl && typeof ctrl.runDatabaseBackup === "function") {
          ctrl.runDatabaseBackup(sourceTag);
        }
      }

      function runDatabaseRestore(backupId, sourceTag) {
        const ctrl = getAdminPanelController();
        if (ctrl && typeof ctrl.runDatabaseRestore === "function") {
          ctrl.runDatabaseRestore(backupId, sourceTag);
        }
      }

      function getSelectedBackupId() {
        const ctrl = getAdminPanelController();
        if (ctrl && typeof ctrl.getSelectedBackupId === "function") {
          return ctrl.getSelectedBackupId();
        }
        return String(adminBackupSelectedId || "").trim();
      }

      function downloadSelectedBackupJson() {
        const ctrl = getAdminPanelController();
        if (ctrl && typeof ctrl.downloadSelectedBackupJson === "function") {
          ctrl.downloadSelectedBackupJson();
        }
      }

      function importBackupJsonFile(file) {
        const ctrl = getAdminPanelController();
        if (ctrl && typeof ctrl.importBackupJsonFile === "function") {
          ctrl.importBackupJsonFile(file);
        }
      }

      function closeFriendModals() {
        const ctrl = getFriendsController();
        if (ctrl && typeof ctrl.closeAll === "function") {
          ctrl.closeAll();
        }
        closeAchievementsMenu();
        closeTitlesMenu();
      }

      function renderAdminPanel() {
        if (!canUseAdminPanel) {
          adminAccountsEl.innerHTML = "";
          return;
        }
        const nowMs = Date.now();
        const accountIds = Object.keys(adminState.accounts || {}).sort((a, b) => {
          const aAcc = adminState.accounts[a] || {};
          const bAcc = adminState.accounts[b] || {};
          const aRole = getRoleRank(getAccountRole(a, aAcc.username));
          const bRole = getRoleRank(getAccountRole(b, bAcc.username));
          if (bRole !== aRole) return bRole - aRole;
          const aOnline = Boolean(adminState.sessions[a] && adminState.sessions[a].sessionId);
          const bOnline = Boolean(adminState.sessions[b] && adminState.sessions[b].sessionId);
          if (aOnline !== bOnline) return aOnline ? -1 : 1;
          return (aAcc.username || a).localeCompare(bAcc.username || b);
        });
        const query = adminSearchQuery.trim().toLowerCase();
        const filteredIds = query
          ? accountIds.filter((accountId) => {
            const account = adminState.accounts[accountId] || {};
            const username = (account.username || "").toLowerCase();
            return username.includes(query) || accountId.toLowerCase().includes(query);
          })
          : accountIds;
        const onlineCount = accountIds.filter((accountId) => Boolean(adminState.sessions[accountId] && adminState.sessions[accountId].sessionId)).length;
        const bannedCount = accountIds.filter((accountId) => getBanStatus(adminState.bans[accountId], nowMs).active).length;
        const assignable = getAssignableRoles();
        const playerOptions = accountIds.map((accountId) => {
          const account = adminState.accounts[accountId] || {};
          const username = (account.username || accountId).toString();
          const role = getAccountRole(accountId, username);
          const online = Boolean(adminState.sessions[accountId] && adminState.sessions[accountId].sessionId);
          const label = "@" + username + " [" + role + (online ? ", online" : ", offline") + "]";
          return '<option value="' + escapeHtml(accountId) + '">' + escapeHtml(label) + "</option>";
        }).join("");
        const canUseGiveAction = hasAdminPermission("give_block") || hasAdminPermission("give_item") || hasAdminPermission("give_title");
        const adminActionOptions = [
          { id: "viewinv", label: "View Inventory", perm: "panel_open" },
          { id: "copy_discord", label: "Copy Discord Tag", perm: "panel_open" },
          { id: "kick", label: "Kick", perm: "kick" },
          { id: "resetinv", label: "Reset Inventory", perm: "resetinv" },
          { id: "unban", label: "Unban", perm: "unban" },
          { id: "tempban", label: "Temp Ban", perm: "tempban" },
          { id: "permban", label: "Perm Ban", perm: "permban" },
          { id: "mutechat", label: "Mute Chat", perm: "kick" },
          { id: "unmutechat", label: "Unmute Chat", perm: "kick" },
          { id: "freeze", label: "Freeze", perm: "freeze" },
          { id: "unfreeze", label: "Unfreeze", perm: "unfreeze" },
          { id: "godmode", label: "Godmode", perm: "godmode" },
          { id: "setrole", label: "Set Role", perm: hasAdminPermission("setrole") ? "setrole" : "setrole_limited" },
          ...(canUseGiveAction ? [{ id: "give", label: "Give", perm: "panel_open" }] : []),
          { id: "remove_title", label: "Remove Title", perm: "remove_title" },
          { id: "reach", label: "Set Reach", perm: "reach" },
          { id: "announce_user", label: "Private Announcement", perm: "announce_user" },
          { id: "db_backup", label: "Backup DB", perm: "db_backup" },
          { id: "db_restore", label: "Restore Backup", perm: "db_restore" }
        ].filter((row) => hasAdminPermission(row.perm));
        const actionOptionsMarkup = adminActionOptions.map((row) => {
          return '<option value="' + escapeHtml(row.id) + '">' + escapeHtml(row.label) + "</option>";
        }).join("");
        const backupOptionsMarkup = getAdminBackupOptionsMarkup();
        const consoleGiveOptions = buildAdminConsoleOptionRows("give");
        const adminConsoleMarkup = `
          <div class="admin-console admin-card">
            <div class="admin-card-header">
              <div class="admin-audit-title">Action Console</div>
            </div>
            <div class="admin-console-help">Flow: choose player, choose action, fill required fields, then execute.</div>
            <div class="admin-console-grid">
              <div class="admin-console-field admin-console-field-wide">
                <label>Find Player</label>
                <input class="admin-console-player-filter" type="text" placeholder="Filter players...">
              </div>
              <div class="admin-console-field">
                <label>Target</label>
                <select class="admin-console-player">${playerOptions}</select>
              </div>
              <div class="admin-console-field">
                <label>Action</label>
                <select class="admin-console-action">${actionOptionsMarkup}</select>
              </div>
              <div class="admin-console-opt admin-console-opt-item-search hidden admin-console-field admin-console-field-wide">
                <label>Find Item</label>
                <input class="admin-console-item-search" type="text" maxlength="80" placeholder="Search by name, key, or id">
              </div>
              <div class="admin-console-opt admin-console-opt-duration hidden admin-console-field">
                <label>Duration</label>
                <input class="admin-console-duration" type="text" value="15m" placeholder="60m / 12h / 7d">
              </div>
              <div class="admin-console-opt admin-console-opt-reason hidden admin-console-field admin-console-field-wide">
                <label>Reason</label>
                <input class="admin-console-reason" type="text" maxlength="80" value="Banned by admin" placeholder="Reason">
              </div>
              <div class="admin-console-opt admin-console-opt-role hidden admin-console-field">
                <label>Role</label>
                <select class="admin-console-role">
                  ${assignable.map((r) => '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + "</option>").join("")}
                </select>
              </div>
              <div class="admin-console-opt admin-console-opt-give hidden admin-console-field admin-console-field-wide">
                <label>Item</label>
                <select class="admin-console-give">
                  ${consoleGiveOptions.map((row) => '<option value="' + escapeHtml(row.value) + '">' + escapeHtml(row.label) + "</option>").join("")}
                </select>
              </div>
              <div class="admin-console-opt admin-console-opt-amount hidden admin-console-field">
                <label>Amount</label>
                <div class="admin-console-amount-row">
                  <input class="admin-console-amount" type="number" min="1" step="1" value="1" placeholder="Amount">
                  <div class="admin-console-amount-presets">
                    <button type="button" data-admin-act="setconsoleamount" data-amount="1">1</button>
                    <button type="button" data-admin-act="setconsoleamount" data-amount="10">10</button>
                    <button type="button" data-admin-act="setconsoleamount" data-amount="50">50</button>
                    <button type="button" data-admin-act="setconsoleamount" data-amount="100">100</button>
                    <button type="button" data-admin-act="setconsoleamount" data-amount="300">300</button>
                  </div>
                </div>
              </div>
              <div class="admin-console-opt admin-console-opt-backup hidden admin-console-field admin-console-field-wide">
                <label>Backup</label>
                <select class="admin-console-backup">${backupOptionsMarkup}</select>
              </div>
              <div class="admin-console-opt admin-console-opt-reach hidden admin-console-field">
                <label>Reach Tiles</label>
                <input class="admin-console-reach" type="number" min="1" max="16" step="0.1" value="4.5" placeholder="Reach tiles">
              </div>
              <div class="admin-console-opt admin-console-opt-godmode hidden admin-console-field">
                <label>Godmode</label>
                <select class="admin-console-godmode">
                  <option value="on">Godmode ON</option>
                  <option value="off">Godmode OFF</option>
                </select>
              </div>
              <div class="admin-console-opt admin-console-opt-message hidden admin-console-field admin-console-field-wide">
                <label>Message</label>
                <input class="admin-console-message" type="text" maxlength="140" placeholder="Message">
              </div>
              <div class="admin-console-run-wrap">
                <button data-admin-act="runconsole">Execute Action</button>
              </div>
            </div>
          </div>
        `;
        const rows = filteredIds.map((accountId) => {
          const account = adminState.accounts[accountId] || {};
          const username = account.username || accountId;
          const discordInfo = account.discordUsername ? ` (@${account.discordUsername} | ${account.discordId})` : "";
          const discordCopyText = account.discordUsername
            ? ("@" + account.discordUsername + (account.discordId ? " (" + account.discordId + ")" : ""))
            : "";
          const banStatus = getBanStatus(adminState.bans[accountId], nowMs);
          const chatMuteStatus = getChatMuteStatus(adminState.chatMutes[accountId], nowMs);
          const banned = banStatus.active;
          const chatMuted = chatMuteStatus.active;
          const online = Boolean(adminState.sessions[accountId] && adminState.sessions[accountId].sessionId);
          const invTotal = totalInventoryCount(adminState.inventories[accountId]);
          const role = getAccountRole(accountId, username);
          const banText = banned
            ? (banStatus.type === "permanent" ? "Perm Banned" : "Temp Banned (" + formatRemainingMs(banStatus.remainingMs) + ")")
            : "Active";
          const chatMuteText = chatMuted
            ? (chatMuteStatus.permanent ? "Chat Muted" : ("Chat Muted (" + formatRemainingMs(chatMuteStatus.remainingMs) + ")"))
            : "Chat Open";
          const onlineStatusClass = online ? "online" : "offline";
          const banStatusClass = banned ? "banned" : "active";
          const chatMuteStatusClass = chatMuted ? "muted" : "neutral";
          const quickButtons = [];
          quickButtons.push('<button class="admin-quick-btn" data-admin-act="viewinv" data-account-id="' + escapeHtml(accountId) + '">View Inv</button>');
          if (hasAdminPermission("kick")) {
            quickButtons.push('<button class="admin-quick-btn admin-quick-btn-warn" data-admin-act="quickkick" data-account-id="' + escapeHtml(accountId) + '">Kick</button>');
            quickButtons.push('<button class="admin-quick-btn admin-quick-btn-warn" data-admin-act="quickmutechat" data-account-id="' + escapeHtml(accountId) + '">Mute Chat</button>');
            quickButtons.push('<button class="admin-quick-btn" data-admin-act="quickunmutechat" data-account-id="' + escapeHtml(accountId) + '">Unmute Chat</button>');
          }
          if (hasAdminPermission("tempban")) {
            quickButtons.push('<button class="admin-quick-btn admin-quick-btn-danger" data-admin-act="quicktempban" data-account-id="' + escapeHtml(accountId) + '">Temp Ban 12h</button>');
          }
          if (hasAdminPermission("permban")) {
            quickButtons.push('<button class="admin-quick-btn admin-quick-btn-danger" data-admin-act="quickpermban" data-account-id="' + escapeHtml(accountId) + '">Perm Ban</button>');
          }
          if (hasAdminPermission("unban") && banStatusClass === "banned") {
            quickButtons.push('<button class="admin-quick-btn" data-admin-act="quickunban" data-account-id="' + escapeHtml(accountId) + '">Unban</button>');
          }
          quickButtons.push(
            '<button class="admin-quick-btn" data-admin-act="quickcopydiscord" data-account-id="' + escapeHtml(accountId) + '" data-copy-text="' + escapeHtml(discordCopyText) + '"' + (discordCopyText ? "" : " disabled") + ">Copy Discord</button>"
            );
          return `
            <div class="admin-row" data-account-id="${escapeHtml(accountId)}">
              <div class="admin-meta">
                <strong>@${escapeHtml(username)}${escapeHtml(discordInfo)} <span class="admin-role role-${escapeHtml(role)}">${escapeHtml(role)}</span></strong>
                <div class="admin-status-row">
                  <span class="admin-status ${onlineStatusClass}">${online ? "Online" : "Offline"}</span>
                  <span class="admin-status ${banStatusClass}">${escapeHtml(banText)}</span>
                  <span class="admin-status ${chatMuteStatusClass}">${escapeHtml(chatMuteText)}</span>
                  <span class="admin-status neutral">Blocks ${invTotal}</span>
                </div>
                <div class="admin-sub">${escapeHtml(accountId)}</div>
              </div>
              <div class="admin-actions-row">
                ${quickButtons.join("")}
              </div>
            </div>
          `;
        });
        const normalizedActionFilter = adminAuditActionFilter.trim().toLowerCase();
        const normalizedActorFilter = adminAuditActorFilter.trim().toLowerCase();
        const normalizedTargetFilter = adminAuditTargetFilter.trim().toLowerCase();
        const filteredAudit = (adminState.audit || []).filter((entry) => {
          const action = (entry.action || "").toLowerCase();
          const actor = (entry.actor || "").toLowerCase();
          const target = (entry.target || "").toLowerCase();
          if (normalizedActionFilter && action !== normalizedActionFilter) return false;
          if (normalizedActorFilter && !actor.includes(normalizedActorFilter)) return false;
          if (normalizedTargetFilter && !target.includes(normalizedTargetFilter)) return false;
          return true;
        });
        const auditRows = filteredAudit.slice(-120).map((entry) => {
          const level = getAuditLevel(entry.action || "");
          return `<div class="admin-audit-row level-${escapeHtml(level)}">${escapeHtml(entry.time || "--:--")} | ${escapeHtml(entry.actor || "system")} | ${escapeHtml(entry.action || "-")} ${escapeHtml(entry.target || "")} ${escapeHtml(entry.details || "")}</div>`;
        }).join("");
        const logRows = logsMessages.slice(-200).map((entry) => {
          const level = getLogLevel(entry.text || "");
          return `<div class="admin-audit-row level-${escapeHtml(level)}">${escapeHtml(formatChatTimestamp(entry.createdAt || 0))} | ${escapeHtml(entry.text || "")}</div>`;
        }).join("");
        const auditMarkup = hasAdminPermission("view_audit")
          ? `<div class="admin-audit admin-card">
            <div class="admin-card-header">
              <div class="admin-audit-title">Audit Trail</div>
              <button data-admin-act="clearaudit" ${hasAdminPermission("clear_logs") ? "" : "disabled"}>Clear</button>
            </div>
            <div class="admin-audit-list">${auditRows || "<div class='admin-audit-row'>No entries yet.</div>"}</div>
          </div>`
          : "";
        const logsMarkup = canViewAccountLogs
          ? `<div class="admin-audit admin-card">
            <div class="admin-card-header">
              <div class="admin-audit-title">Account Logs</div>
              <button data-admin-act="clearlogs" ${hasAdminPermission("clear_logs") ? "" : "disabled"}>Clear</button>
            </div>
            <div class="admin-logs-list">${logRows || "<div class='admin-audit-row'>No logs yet.</div>"}</div>
          </div>`
          : "";
        const antiCheatRows = antiCheatMessages.slice(-220).map((entry) => {
          const sev = (entry.severity || "warn").toString().toLowerCase();
          const level = sev === "critical" ? "danger" : (sev === "warn" ? "warn" : "info");
          return `<div class="admin-audit-row level-${escapeHtml(level)}">${escapeHtml(formatChatTimestamp(entry.createdAt || 0))} | [${escapeHtml(sev.toUpperCase())}] ${escapeHtml(entry.text || "")}</div>`;
        }).join("");
        const antiCheatMarkup = canViewAntiCheatLogs()
          ? `<div class="admin-audit admin-card">
            <div class="admin-card-header">
              <div class="admin-audit-title">Anti-Cheat</div>
              <button data-admin-act="clearanticheat" ${hasAdminPermission("clear_logs") ? "" : "disabled"}>Clear</button>
            </div>
            <div class="admin-anticheat-list">${antiCheatRows || "<div class='admin-audit-row'>No anti-cheat logs yet.</div>"}</div>
          </div>`
          : "";
        const statsCardsMarkup = `
          <div class="admin-dash-stats">
            <div class="admin-dash-stat admin-dash-stat-teal">
              <div class="admin-dash-stat-label">Players (Visible)</div>
              <div class="admin-dash-stat-value">${filteredIds.length}<span>/${accountIds.length}</span></div>
            </div>
            <div class="admin-dash-stat admin-dash-stat-cyan">
              <div class="admin-dash-stat-label">Online Now</div>
              <div class="admin-dash-stat-value">${onlineCount}</div>
            </div>
            <div class="admin-dash-stat admin-dash-stat-red">
              <div class="admin-dash-stat-label">Banned</div>
              <div class="admin-dash-stat-value">${bannedCount}</div>
            </div>
            <div class="admin-dash-stat admin-dash-stat-amber">
              <div class="admin-dash-stat-label">Global Online</div>
              <div class="admin-dash-stat-value">${totalOnlinePlayers}</div>
            </div>
          </div>
        `;
        const playersRowsMarkup = rows.join("") || "<div class='admin-row'><div class='admin-meta'><strong>No players match filter.</strong></div></div>";
        const dashboardTabs = [
          { id: "overview", label: "Overview" },
          { id: "players", label: "Players (" + filteredIds.length + ")" },
          { id: "console", label: "Action Console" }
        ];
        if (hasAdminPermission("view_audit")) {
          dashboardTabs.push({ id: "audit", label: "Audit (" + filteredAudit.length + ")" });
        }
        if (canViewAccountLogs) {
          dashboardTabs.push({ id: "logs", label: "Logs (" + logsMessages.length + ")" });
        }
        if (canViewAntiCheatLogs()) {
          dashboardTabs.push({ id: "anticheat", label: "Anti-Cheat (" + antiCheatMessages.length + ")" });
        }
        const availableTabIds = dashboardTabs.map((tab) => tab.id);
        if (!availableTabIds.includes(adminDashboardTab)) {
          adminDashboardTab = availableTabIds[0] || "overview";
        }
        const dashboardTabsMarkup = dashboardTabs.map((tab) => {
          const activeClass = adminDashboardTab === tab.id ? " active" : "";
          return '<button type="button" class="admin-tab-btn' + activeClass + '" data-admin-act="settab" data-tab-id="' + escapeHtml(tab.id) + '">' + escapeHtml(tab.label) + "</button>";
        }).join("");
        const recentAuditPreviewMarkup = hasAdminPermission("view_audit")
          ? filteredAudit.slice(-8).map((entry) => {
            const level = getAuditLevel(entry.action || "");
            return '<div class="admin-audit-row level-' + escapeHtml(level) + '">' + escapeHtml(entry.time || "--:--") + " | " + escapeHtml(entry.action || "-") + " " + escapeHtml(entry.target || "") + "</div>";
          }).join("")
          : "";
        const recentAuditPreviewEmptyText = hasAdminPermission("view_audit")
          ? "No audit entries yet."
          : "Audit tab unavailable for your role.";
        const quickJumpButtons = [
          '<button type="button" data-admin-act="settab" data-tab-id="players">Manage Players</button>',
          '<button type="button" data-admin-act="settab" data-tab-id="console">Run Actions</button>'
        ];
        if (availableTabIds.includes("audit")) quickJumpButtons.push('<button type="button" data-admin-act="settab" data-tab-id="audit">Open Audit</button>');
        if (availableTabIds.includes("logs")) quickJumpButtons.push('<button type="button" data-admin-act="settab" data-tab-id="logs">Open Logs</button>');
        if (availableTabIds.includes("anticheat")) quickJumpButtons.push('<button type="button" data-admin-act="settab" data-tab-id="anticheat">Open Anti-Cheat</button>');
        const overviewPanelMarkup = `
          <div class="admin-layout admin-layout-single">
            <div class="admin-main">
              <div class="admin-card admin-tab-card">
                <div class="admin-card-header">
                  <div class="admin-audit-title">Quick Access</div>
                </div>
                <div class="admin-overview-actions">
                  ${quickJumpButtons.join("")}
                </div>
              </div>
              <div class="admin-card admin-tab-card">
                <div class="admin-card-header">
                  <div class="admin-audit-title">Latest Activity</div>
                </div>
                <div class="admin-audit-list admin-overview-audit">
                  ${recentAuditPreviewMarkup || "<div class='admin-audit-row'>" + escapeHtml(recentAuditPreviewEmptyText) + "</div>"}
                </div>
              </div>
            </div>
          </div>
        `;
        const playersPanelMarkup = `
          <div class="admin-layout admin-layout-single">
            <div class="admin-main">
              <div class="admin-card admin-tab-card">
                <div class="admin-card-header">
                  <div class="admin-audit-title">Players</div>
                </div>
                <div class="admin-list admin-tab-list">
                  ${playersRowsMarkup}
                </div>
              </div>
            </div>
          </div>
        `;
        const consolePanelMarkup = `
          <div class="admin-layout admin-layout-single">
            <div class="admin-main">
              <div class="admin-summary">
                ${adminConsoleMarkup}
              </div>
            </div>
          </div>
        `;
        const roleCommandList = getAvailableRankCommands();
        const commandItemsMarkup = roleCommandList.map((cmd) => {
          return '<div class="admin-cmd-item" data-cmd-text="' + escapeHtml(String(cmd).toLowerCase()) + '"><code>' + escapeHtml(cmd) + "</code></div>";
        }).join("");
        adminAccountsEl.innerHTML = `
          <div class="admin-dashboard">
            <aside class="admin-dash-sidebar">
              <div class="admin-dash-brand">Dashboard</div>
              <div class="admin-dash-user">Signed in as <strong>@${escapeHtml(playerName || "guest")}</strong></div>
              <div class="admin-dash-role">Role: ${escapeHtml(currentAdminRole)}</div>
              <button class="admin-sidebar-btn" data-admin-act="togglecommands">Commands (${roleCommandList.length})</button>
              <div class="admin-summary-hint">Quick: /adminhelp, /where user, /goto user, /bringall, /announce</div>
            </aside>
            <div class="admin-dash-main">
              ${statsCardsMarkup}
              <div class="admin-dash-tabs">
                ${dashboardTabsMarkup}
              </div>
              <div class="admin-tab-panels">
                <div class="admin-tab-panel ${adminDashboardTab === "overview" ? "" : "hidden"}" data-tab-panel="overview">
                  ${overviewPanelMarkup}
                </div>
                <div class="admin-tab-panel ${adminDashboardTab === "players" ? "" : "hidden"}" data-tab-panel="players">
                  ${playersPanelMarkup}
                </div>
                <div class="admin-tab-panel ${adminDashboardTab === "console" ? "" : "hidden"}" data-tab-panel="console">
                  ${consolePanelMarkup}
                </div>
                <div class="admin-tab-panel ${adminDashboardTab === "audit" ? "" : "hidden"}" data-tab-panel="audit">
                  ${auditMarkup}
                </div>
                <div class="admin-tab-panel ${adminDashboardTab === "logs" ? "" : "hidden"}" data-tab-panel="logs">
                  ${logsMarkup}
                </div>
                <div class="admin-tab-panel ${adminDashboardTab === "anticheat" ? "" : "hidden"}" data-tab-panel="anticheat">
                  ${antiCheatMarkup}
                </div>
              </div>
            </div>
            <div class="admin-commands-modal ${adminCommandsMenuOpen ? "" : "hidden"}">
              <div class="admin-commands-card">
                <div class="admin-card-header">
                  <div class="admin-audit-title">Commands For ${escapeHtml(currentAdminRole)}</div>
                  <button data-admin-act="closecommands">Close</button>
                </div>
                <div class="admin-console-field admin-console-field-wide">
                  <label>Search Commands</label>
                  <input class="admin-cmd-search" type="text" placeholder="Type command or keyword...">
                </div>
                <div class="admin-sidebar-commands-list">${commandItemsMarkup || "<div class='admin-cmd-item'><code>No commands.</code></div>"}</div>
              </div>
            </div>
          </div>
        `;
        adminAccountsEl.querySelectorAll(".admin-audit-list").forEach((el) => scrollElementToBottom(el));
        adminAccountsEl.querySelectorAll(".admin-logs-list").forEach((el) => scrollElementToBottom(el));
        adminAccountsEl.querySelectorAll(".admin-anticheat-list").forEach((el) => scrollElementToBottom(el));
        updateAdminConsoleOptionVisibility();
      }

      function buildAdminConsoleOptionRows(action) {
        const safeAction = String(action || "");
        let rows = [];
        if (safeAction === "give_block") {
          rows = NORMAL_BLOCK_INVENTORY_IDS.map((id) => {
            const key = getBlockKeyById(id);
            const name = blockDefs[id] && blockDefs[id].name ? blockDefs[id].name : ("Block " + id);
            return { value: key, label: name + " (" + key + ")" };
          });
        } else if (safeAction === "give_farmable") {
          rows = FARMABLE_INVENTORY_IDS.map((id) => {
            const key = getBlockKeyById(id);
            const name = blockDefs[id] && blockDefs[id].name ? blockDefs[id].name : ("Farmable " + id);
            return { value: key, label: name + " (" + key + ")" };
          });
        } else if (safeAction === "give_seed") {
          rows = SEED_INVENTORY_IDS.map((id) => {
            const key = getBlockKeyById(id);
            const name = blockDefs[id] && blockDefs[id].name ? blockDefs[id].name : ("Seed " + id);
            return { value: key, label: name + " (" + key + ")" };
          });
        } else if (safeAction === "give_item") {
          rows = COSMETIC_ITEMS.map((item) => {
            const id = String(item && item.id || "");
            const name = String(item && item.name || id || "Cosmetic");
            return { value: id, label: name + " (" + id + ")" };
          });
        } else if (safeAction === "give_title" || safeAction === "remove_title") {
          rows = TITLE_CATALOG.map((title) => {
            const id = String(title && title.id || "");
            const name = String(title && title.name || id || "Title");
            return { value: id, label: name + " (" + id + ")" };
          });
        } else if (safeAction === "give") {
          const merged = [];
          if (hasAdminPermission("give_block")) {
            NORMAL_BLOCK_INVENTORY_IDS.forEach((id) => {
              const key = getBlockKeyById(id);
              const name = blockDefs[id] && blockDefs[id].name ? blockDefs[id].name : ("Block " + id);
              merged.push({ value: "block:" + key, label: "[Block] " + name + " (" + key + ")" });
            });
            FARMABLE_INVENTORY_IDS.forEach((id) => {
              const key = getBlockKeyById(id);
              const name = blockDefs[id] && blockDefs[id].name ? blockDefs[id].name : ("Farmable " + id);
              merged.push({ value: "block:" + key, label: "[Farmable] " + name + " (" + key + ")" });
            });
            SEED_INVENTORY_IDS.forEach((id) => {
              const key = getBlockKeyById(id);
              const name = blockDefs[id] && blockDefs[id].name ? blockDefs[id].name : ("Seed " + id);
              merged.push({ value: "block:" + key, label: "[Seed] " + name + " (" + key + ")" });
            });
          }
          if (hasAdminPermission("give_item")) {
            COSMETIC_ITEMS.forEach((item) => {
              const id = String(item && item.id || "");
              const name = String(item && item.name || id || "Cosmetic");
              merged.push({ value: "cosmetic:" + id, label: "[Cosmetic] " + name + " (" + id + ")" });
            });
          }
          if (hasAdminPermission("give_title")) {
            TITLE_CATALOG.forEach((title) => {
              const id = String(title && title.id || "");
              const name = String(title && title.name || id || "Title");
              merged.push({ value: "title:" + id, label: "[Title] " + name + " (" + id + ")" });
            });
          }
          rows = merged;
        }
        rows = rows.filter((row) => row && row.value && row.label);
        const dedup = new Map();
        rows.forEach((row) => {
          const key = String(row.value || "");
          if (!key || dedup.has(key)) return;
          dedup.set(key, row);
        });
        rows = Array.from(dedup.values());
        rows.sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" }));
        return rows;
      }

      function getAdminConsoleSelectByAction(action) {
        const safeAction = String(action || "");
        if (safeAction === "give" || safeAction === "remove_title") return adminAccountsEl.querySelector(".admin-console-give");
        if (safeAction === "give_block") return adminAccountsEl.querySelector(".admin-console-block");
        if (safeAction === "give_farmable") return adminAccountsEl.querySelector(".admin-console-farmable");
        if (safeAction === "give_seed") return adminAccountsEl.querySelector(".admin-console-seed");
        if (safeAction === "give_item") return adminAccountsEl.querySelector(".admin-console-item");
        if (safeAction === "give_title") return adminAccountsEl.querySelector(".admin-console-title");
        return null;
      }

      function getAdminConsoleItemSearchPlaceholder(action) {
        const safeAction = String(action || "");
        if (safeAction === "give") return "Search blocks, seeds, cosmetics, and titles";
        if (safeAction === "remove_title") return "Search titles by name or id";
        if (safeAction === "give_block") return "Search blocks by name or key";
        if (safeAction === "give_farmable") return "Search farmables by name or key";
        if (safeAction === "give_seed") return "Search seeds by name or key";
        if (safeAction === "give_item") return "Search cosmetics by name or id";
        if (safeAction === "give_title" || safeAction === "remove_title") return "Search titles by name or id";
        return "Search by name, key, or id";
      }

      function refreshAdminConsoleItemOptions(action, rawQuery) {
        const selectEl = getAdminConsoleSelectByAction(action);
        if (!(selectEl instanceof HTMLSelectElement)) return;
        const rows = buildAdminConsoleOptionRows(action);
        const query = String(rawQuery || "").trim().toLowerCase();
        const filtered = query
          ? rows.filter((row) => {
              const label = String(row.label || "").toLowerCase();
              const value = String(row.value || "").toLowerCase();
              return label.includes(query) || value.includes(query);
            })
          : rows;
        const previousValue = String(selectEl.value || "");
        if (!filtered.length) {
          selectEl.innerHTML = "<option value=\"\">No results</option>";
          selectEl.disabled = true;
          return;
        }
        selectEl.disabled = false;
        selectEl.innerHTML = filtered.map((row) => {
          return '<option value="' + escapeHtml(row.value) + '">' + escapeHtml(row.label) + "</option>";
        }).join("");
        if (filtered.some((row) => row.value === previousValue)) {
          selectEl.value = previousValue;
        } else {
          selectEl.value = filtered[0].value;
        }
      }

      function updateAdminConsoleOptionVisibility() {
        const actionEl = adminAccountsEl.querySelector(".admin-console-action");
        if (!(actionEl instanceof HTMLSelectElement)) return;
        const action = String(actionEl.value || "");
        const map = {
          duration: adminAccountsEl.querySelector(".admin-console-opt-duration"),
          reason: adminAccountsEl.querySelector(".admin-console-opt-reason"),
          role: adminAccountsEl.querySelector(".admin-console-opt-role"),
          give: adminAccountsEl.querySelector(".admin-console-opt-give"),
          itemSearch: adminAccountsEl.querySelector(".admin-console-opt-item-search"),
          amount: adminAccountsEl.querySelector(".admin-console-opt-amount"),
          backup: adminAccountsEl.querySelector(".admin-console-opt-backup"),
          reach: adminAccountsEl.querySelector(".admin-console-opt-reach"),
          godmode: adminAccountsEl.querySelector(".admin-console-opt-godmode"),
          message: adminAccountsEl.querySelector(".admin-console-opt-message")
        };
        Object.values(map).forEach((el) => {
          if (el instanceof HTMLElement) el.classList.add("hidden");
        });
        if (action === "tempban") {
          if (map.duration instanceof HTMLElement) map.duration.classList.remove("hidden");
          if (map.reason instanceof HTMLElement) map.reason.classList.remove("hidden");
        } else if (action === "permban") {
          if (map.reason instanceof HTMLElement) map.reason.classList.remove("hidden");
        } else if (action === "mutechat") {
          if (map.reason instanceof HTMLElement) map.reason.classList.remove("hidden");
          const reasonInput = adminAccountsEl.querySelector(".admin-console-reason");
          if (reasonInput instanceof HTMLInputElement) {
            const currentReason = String(reasonInput.value || "").trim();
            if (!currentReason || currentReason.toLowerCase() === "banned by admin" || currentReason.toLowerCase() === "permanently banned by admin") {
              reasonInput.value = "Muted by admin";
            }
          }
        } else if (action === "setrole") {
          if (map.role instanceof HTMLElement) map.role.classList.remove("hidden");
        } else if (action === "give" || action === "remove_title") {
          if (map.itemSearch instanceof HTMLElement) map.itemSearch.classList.remove("hidden");
          if (map.give instanceof HTMLElement) map.give.classList.remove("hidden");
          if (map.amount instanceof HTMLElement) map.amount.classList.remove("hidden");
        } else if (action === "reach") {
          if (map.reach instanceof HTMLElement) map.reach.classList.remove("hidden");
        } else if (action === "godmode") {
          if (map.godmode instanceof HTMLElement) map.godmode.classList.remove("hidden");
        } else if (action === "announce_user") {
          if (map.message instanceof HTMLElement) map.message.classList.remove("hidden");
        } else if (action === "db_restore") {
          if (map.backup instanceof HTMLElement) map.backup.classList.remove("hidden");
        }
        const searchEl = adminAccountsEl.querySelector(".admin-console-item-search");
        const query = searchEl instanceof HTMLInputElement ? searchEl.value : "";
        if (searchEl instanceof HTMLInputElement) {
          searchEl.placeholder = getAdminConsoleItemSearchPlaceholder(action);
        }
        refreshAdminConsoleItemOptions(action, query);
      }

      function handleAdminAction(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.dataset.adminAct;
        const accountId = target.dataset.accountId;
        if (!action) {
          const row = target.closest(".admin-row");
          if (row instanceof HTMLElement) {
            const rowAccountId = String(row.dataset.accountId || "").trim();
            const playerSelectEl = adminAccountsEl.querySelector(".admin-console-player");
            if (rowAccountId && playerSelectEl instanceof HTMLSelectElement) {
              playerSelectEl.value = rowAccountId;
            }
          }
          return;
        }
        if (!action || !canUseAdminPanel) return;
        if (action === "settab") {
          const nextTab = String(target.dataset.tabId || "").trim().toLowerCase();
          const availableTabs = Array.from(adminAccountsEl.querySelectorAll(".admin-tab-btn[data-tab-id]"))
            .map((el) => String(el.dataset.tabId || "").trim().toLowerCase())
            .filter(Boolean);
          if (!nextTab || !availableTabs.includes(nextTab)) return;
          adminDashboardTab = nextTab;
          renderAdminPanel();
          return;
        }
        if (action === "setconsoleamount") {
          const amountInput = adminAccountsEl.querySelector(".admin-console-amount");
          if (!(amountInput instanceof HTMLInputElement)) return;
          const next = Math.max(1, Math.min(1000000, Math.floor(Number(target.dataset.amount) || 1)));
          amountInput.value = String(next);
          amountInput.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }
        if (action === "togglecommands") {
          adminCommandsMenuOpen = !adminCommandsMenuOpen;
          renderAdminPanel();
          return;
        }
        if (action === "closecommands") {
          adminCommandsMenuOpen = false;
          renderAdminPanel();
          return;
        }
        if (action === "clearaudit") {
          if (!hasAdminPermission("clear_logs")) return;
          clearAdminAuditTrail().then((ok) => {
            if (!ok) {
              postLocalSystemChat("Failed to clear audit trail.");
              return;
            }
            adminState.audit = [];
            renderAdminPanel();
            postLocalSystemChat("Audit trail cleared.");
          });
          return;
        }
        if (action === "clearlogs") {
          clearLogsData();
          return;
        }
        if (action === "clearanticheat") {
          if (!hasAdminPermission("clear_logs")) return;
          proxyAdminRemove("/" + BASE_PATH + "/anti-cheat-logs").then((out) => {
            if (!out || !out.ok) {
              postLocalSystemChat("Failed to clear anti-cheat logs.");
              return;
            }
            antiCheatMessages.length = 0;
            renderAdminPanel();
            postLocalSystemChat("Anti-cheat logs cleared.");
            logAdminAudit("Admin(panel) cleared anti-cheat logs.");
            pushAdminAuditEntry("clear_logs", "", "target=anti-cheat");
          }).catch(() => {
            postLocalSystemChat("Failed to clear anti-cheat logs.");
          });
          return;
        }
        if (action === "runconsole") {
          if (!network.db) return;
          const playerSelectEl = adminAccountsEl.querySelector(".admin-console-player");
          const actionSelectEl = adminAccountsEl.querySelector(".admin-console-action");
          if (!(playerSelectEl instanceof HTMLSelectElement) || !(actionSelectEl instanceof HTMLSelectElement)) return;
          const selectedAction = String(actionSelectEl.value || "").trim();
          if (!selectedAction) {
            postLocalSystemChat("Select action first.");
            return;
          }
          if (selectedAction === "db_backup") {
            runDatabaseBackup("panel");
            return;
          }
          if (selectedAction === "db_restore") {
            const backupEl = adminAccountsEl.querySelector(".admin-console-backup");
            const backupId = backupEl instanceof HTMLSelectElement ? (backupEl.value || "") : "";
            runDatabaseRestore(backupId, "panel");
            return;
          }
          const targetAccountId = String(playerSelectEl.value || "").trim();
          if (!targetAccountId) {
            postLocalSystemChat("Select player first.");
            return;
          }
          const targetUsername = (adminState.accounts[targetAccountId] && adminState.accounts[targetAccountId].username) || targetAccountId;
          if (selectedAction === "copy_discord") {
            const account = adminState.accounts[targetAccountId] || {};
            const copyText = account.discordUsername
              ? ("@" + account.discordUsername + (account.discordId ? " (" + account.discordId + ")" : ""))
              : "";
            if (!copyText) {
              postLocalSystemChat("Selected player has no Discord tag.");
              return;
            }
            copyTextToClipboard(copyText).then((ok) => {
              postLocalSystemChat(ok ? "Copied Discord tag for @" + targetUsername + "." : "Failed to copy Discord tag.");
            });
            return;
          }
          if (selectedAction === "viewinv") {
            openAdminInventoryModal(targetAccountId);
            return;
          }
          if (selectedAction === "setrole") {
            const roleSelectEl = adminAccountsEl.querySelector(".admin-console-role");
            if (!(roleSelectEl instanceof HTMLSelectElement)) return;
            const nextRole = normalizeAdminRole(roleSelectEl.value || "none");
            const ok = applyAdminRoleChange(targetAccountId, nextRole, "panel");
            if (ok) {
              postLocalSystemChat("Role updated for @" + targetUsername + ".");
            }
            return;
          }
          if (selectedAction === "tempban") {
            const durationEl = adminAccountsEl.querySelector(".admin-console-duration");
            const reasonEl = adminAccountsEl.querySelector(".admin-console-reason");
            const durationText = durationEl instanceof HTMLInputElement ? durationEl.value : "15m";
            const reasonText = reasonEl instanceof HTMLInputElement ? reasonEl.value : "Banned by admin";
            const durationMs = parseDurationToMs(durationText);
            if (!durationMs) {
              postLocalSystemChat("Invalid temp ban duration. Use 60m / 12h / 7d.");
              return;
            }
            applyAdminAction("tempban", targetAccountId, "panel", { durationMs, reason: reasonText, rawDuration: durationText });
            return;
          }
          if (selectedAction === "permban") {
            const reasonEl = adminAccountsEl.querySelector(".admin-console-reason");
            const reasonText = reasonEl instanceof HTMLInputElement ? reasonEl.value : "Banned by admin";
            applyAdminAction("permban", targetAccountId, "panel", { reason: reasonText });
            return;
          }
          if (selectedAction === "mutechat") {
            const reasonEl = adminAccountsEl.querySelector(".admin-console-reason");
            const reasonText = reasonEl instanceof HTMLInputElement ? reasonEl.value : "Muted by admin";
            const ok = applyAdminAction("mutechat", targetAccountId, "panel", { reason: reasonText });
            if (ok) {
              postLocalSystemChat("Chat muted for @" + targetUsername + ".");
            }
            return;
          }
          if (selectedAction === "unmutechat") {
            const ok = applyAdminAction("unmutechat", targetAccountId, "panel", {});
            if (ok) {
              postLocalSystemChat("Chat unmuted for @" + targetUsername + ".");
            }
            return;
          }
          if (selectedAction === "give") {
            const giveEl = adminAccountsEl.querySelector(".admin-console-give");
            const amountEl = adminAccountsEl.querySelector(".admin-console-amount");
            if (!(giveEl instanceof HTMLSelectElement) || !(amountEl instanceof HTMLInputElement)) return;
            const selectedValue = String(giveEl.value || "").trim();
            const amount = Number(amountEl.value);
            if (!selectedValue) {
              postLocalSystemChat("Select an item to give.");
              return;
            }
            let grantType = "";
            let grantRef = "";
            const separatorIndex = selectedValue.indexOf(":");
            if (separatorIndex > 0) {
              grantType = selectedValue.slice(0, separatorIndex).toLowerCase();
              grantRef = selectedValue.slice(separatorIndex + 1).trim();
            } else {
              const legacyValue = selectedValue.trim();
              if (TITLE_LOOKUP[legacyValue]) {
                grantType = "title";
                grantRef = legacyValue;
              } else if (COSMETIC_ITEMS.some((item) => String(item && item.id || "") === legacyValue)) {
                grantType = "cosmetic";
                grantRef = legacyValue;
              } else {
                grantType = "block";
                grantRef = legacyValue;
              }
            }
            if (!grantRef) {
              postLocalSystemChat("Invalid give selection.");
              return;
            }
            if (grantType === "block") {
              const ok = applyInventoryGrant(targetAccountId, grantRef, amount, "panel", targetUsername);
              if (ok) {
                postLocalSystemChat("Added " + amount + " of block " + grantRef + " to @" + targetUsername + ".");
              }
              return;
            }
            if (grantType === "cosmetic") {
              const ok = applyCosmeticItemGrant(targetAccountId, grantRef, amount, "panel", targetUsername);
              if (ok) {
                postLocalSystemChat("Added item " + grantRef + " x" + amount + " to @" + targetUsername + ".");
              }
              return;
            }
            if (grantType === "title") {
              const ok = applyTitleGrant(targetAccountId, grantRef, amount, "panel", targetUsername, false);
              if (ok) {
                postLocalSystemChat("Added title " + grantRef + " x" + amount + " to @" + targetUsername + ".");
              }
              return;
            }
            postLocalSystemChat("Unsupported give type.");
            return;
          }
          if (selectedAction === "remove_title") {
            const giveEl = adminAccountsEl.querySelector(".admin-console-give");
            const amountEl = adminAccountsEl.querySelector(".admin-console-amount");
            if (!(giveEl instanceof HTMLSelectElement) || !(amountEl instanceof HTMLInputElement)) return;
            const selectedValue = String(giveEl.value || "").trim();
            const amount = Number(amountEl.value);
            const titleId = selectedValue.startsWith("title:") ? selectedValue.slice(6).trim() : selectedValue;
            if (!titleId) {
              postLocalSystemChat("Select a title to remove.");
              return;
            }
            const ok = applyTitleGrant(targetAccountId, titleId, amount, "panel", targetUsername, true);
            if (ok) {
              postLocalSystemChat("Removed title " + titleId + " x" + amount + " from @" + targetUsername + ".");
            }
            return;
          }
          if (selectedAction === "reach") {
            if (!hasAdminPermission("reach")) {
              postLocalSystemChat("Permission denied.");
              return;
            }
            if (!ensureCommandReady("reach")) return;
            const reachEl = adminAccountsEl.querySelector(".admin-console-reach");
            const amountRaw = reachEl instanceof HTMLInputElement ? Number(reachEl.value) : NaN;
            if (!Number.isFinite(amountRaw)) {
              postLocalSystemChat("Invalid reach amount.");
              return;
            }
            const targetRole = getAccountRole(targetAccountId, targetUsername);
            if (targetAccountId !== playerProfileId && !canActorAffectTarget(targetAccountId, targetRole)) {
              postLocalSystemChat("Permission denied on target role.");
              return;
            }
            const amount = Math.max(1, Math.min(16, Math.round(amountRaw * 10) / 10));
            issueReachCommand(targetAccountId, amount).then((ok) => {
              if (!ok) {
                postLocalSystemChat("Failed to set reach for @" + targetUsername + ".");
                return;
              }
              postLocalSystemChat("Set @" + targetUsername + " reach to " + amount.toFixed(1) + " tiles.");
              logAdminAudit("Admin(panel) set reach for @" + targetUsername + " to " + amount.toFixed(1) + ".");
              pushAdminAuditEntry("reach", targetAccountId, "amount=" + amount.toFixed(1));
            }).catch(() => {
              postLocalSystemChat("Failed to set reach for @" + targetUsername + ".");
            });
            return;
          }
          if (selectedAction === "announce_user") {
            if (!hasAdminPermission("announce_user")) {
              postLocalSystemChat("Permission denied.");
              return;
            }
            if (!ensureCommandReady("announcep")) return;
            const msgEl = adminAccountsEl.querySelector(".admin-console-message");
            const msg = msgEl instanceof HTMLInputElement ? String(msgEl.value || "").trim() : "";
            if (!msg) {
              postLocalSystemChat("Message is required.");
              return;
            }
            const targetRole = getAccountRole(targetAccountId, targetUsername);
            if (!canActorAffectTarget(targetAccountId, targetRole)) {
              postLocalSystemChat("Permission denied on target role.");
              return;
            }
            issuePrivateAnnouncement(targetAccountId, msg).then((ok) => {
              if (!ok) {
                postLocalSystemChat("Failed to send private announcement.");
                return;
              }
              postLocalSystemChat("Private announcement sent to @" + targetUsername + ".");
              logAdminAudit("Admin(panel) private announced to @" + targetUsername + ".");
              pushAdminAuditEntry("announce_user", targetAccountId, msg.slice(0, 80));
            });
            return;
          }
          if (selectedAction === "godmode") {
            const modeEl = adminAccountsEl.querySelector(".admin-console-godmode");
            const mode = modeEl instanceof HTMLSelectElement ? String(modeEl.value || "on") : "on";
            const enabled = mode !== "off";
            const ok = applyAdminAction("godmode", targetAccountId, "panel", { enabled });
            if (ok) {
              postLocalSystemChat("Set godmode " + (enabled ? "ON" : "OFF") + " for @" + targetUsername + ".");
            }
            return;
          }
          applyAdminAction(selectedAction, targetAccountId, "panel");
          return;
        }
        if (!accountId) return;
        const playerSelectEl = adminAccountsEl.querySelector(".admin-console-player");
        if (playerSelectEl instanceof HTMLSelectElement) {
          playerSelectEl.value = accountId;
        }
        if (action === "viewinv") {
          openAdminInventoryModal(accountId);
          return;
        }
        if (action === "quickcopydiscord") {
          const copyText = String(target.dataset.copyText || "").trim();
          const username = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId;
          if (!copyText) {
            postLocalSystemChat("No Discord tag on @" + username + ".");
            return;
          }
          copyTextToClipboard(copyText).then((ok) => {
            postLocalSystemChat(ok ? "Copied Discord tag for @" + username + "." : "Failed to copy Discord tag.");
          });
          return;
        }
        if (action === "quicktempban") {
          const username = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId;
          const durationText = "12h";
          const durationMs = parseDurationToMs(durationText);
          const ok = applyAdminAction("tempban", accountId, "panel-quick", {
            durationMs,
            reason: "Temporarily banned by admin",
            rawDuration: durationText
          });
          if (ok) {
            postLocalSystemChat("Temp banned @" + username + " for " + durationText + ".");
          }
          return;
        }
        if (action === "quickkick") {
          const username = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId;
          const ok = applyAdminAction("kick", accountId, "panel-quick");
          if (ok) {
            postLocalSystemChat("Kicked @" + username + ".");
          }
          return;
        }
        if (action === "quickpermban") {
          const username = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId;
          const ok = applyAdminAction("permban", accountId, "panel-quick", { reason: "Permanently banned by admin" });
          if (ok) {
            postLocalSystemChat("Perm banned @" + username + ".");
          }
          return;
        }
        if (action === "quickunban") {
          const username = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId;
          const ok = applyAdminAction("unban", accountId, "panel-quick");
          if (ok) {
            postLocalSystemChat("Unbanned @" + username + ".");
          }
          return;
        }
        if (action === "quickmutechat") {
          const username = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId;
          const ok = applyAdminAction("mutechat", accountId, "panel-quick", { reason: "Muted by admin" });
          if (ok) {
            postLocalSystemChat("Chat muted for @" + username + ".");
          }
          return;
        }
        if (action === "quickunmutechat") {
          const username = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId;
          const ok = applyAdminAction("unmutechat", accountId, "panel-quick");
          if (ok) {
            postLocalSystemChat("Chat unmuted for @" + username + ".");
          }
          return;
        }
        if (!network.db) return;
        if (action === "giveitem") {
          const itemSelect = adminAccountsEl.querySelector('.admin-give-item-id[data-account-id="' + accountId + '"]');
          const amountInput = adminAccountsEl.querySelector('.admin-give-item-amount[data-account-id="' + accountId + '"]');
          if (!(itemSelect instanceof HTMLSelectElement) || !(amountInput instanceof HTMLInputElement)) return;
          const itemId = itemSelect.value || "";
          const amount = Number(amountInput.value);
          const username = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId;
          const ok = applyCosmeticItemGrant(accountId, itemId, amount, "panel", username);
          if (ok) {
            postLocalSystemChat("Added item " + itemId + " x" + amount + " to @" + username + ".");
          }
          return;
        }
        if (action === "givetitle" || action === "removetitle") {
          const titleSelect = adminAccountsEl.querySelector('.admin-give-title-id[data-account-id="' + accountId + '"]');
          const amountInput = adminAccountsEl.querySelector('.admin-give-title-amount[data-account-id="' + accountId + '"]');
          if (!(titleSelect instanceof HTMLSelectElement) || !(amountInput instanceof HTMLInputElement)) return;
          const titleId = titleSelect.value || "";
          const amount = Number(amountInput.value);
          const username = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId;
          const ok = applyTitleGrant(accountId, titleId, amount, "panel", username, action === "removetitle");
          if (ok) {
            postLocalSystemChat((action === "removetitle" ? "Removed title " : "Added title ") + titleId + " x" + amount + (action === "removetitle" ? " from @" : " to @") + username + ".");
          }
          return;
        }
        if (action === "tempban" || action === "permban") {
          const durationInput = adminAccountsEl.querySelector('.admin-ban-duration[data-account-id="' + accountId + '"]');
          const reasonInput = adminAccountsEl.querySelector('.admin-ban-reason[data-account-id="' + accountId + '"]');
          const durationText = durationInput instanceof HTMLInputElement ? durationInput.value : "60m";
          const reasonText = reasonInput instanceof HTMLInputElement ? reasonInput.value : "Banned by admin";
          if (action === "tempban") {
            const durationMs = parseDurationToMs(durationText);
            if (!durationMs) {
              postLocalSystemChat("Invalid temp ban duration. Use formats like 60m, 12h, 7d.");
              return;
            }
            applyAdminAction("tempban", accountId, "panel", { durationMs, reason: reasonText, rawDuration: durationText });
          } else {
            applyAdminAction("permban", accountId, "panel", { reason: reasonText });
          }
          return;
        }
        if (action === "give") {
          const blockInput = adminAccountsEl.querySelector('.admin-give-block[data-account-id="' + accountId + '"]');
          const amountInput = adminAccountsEl.querySelector('.admin-give-amount[data-account-id="' + accountId + '"]');
          if (!(blockInput instanceof HTMLSelectElement) || !(amountInput instanceof HTMLInputElement)) return;
          const blockId = blockInput.value || "";
          const amount = Number(amountInput.value);
          const username = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId;
          const ok = applyInventoryGrant(accountId, blockId, amount, "panel", username);
          if (ok) {
            postLocalSystemChat("Added " + amount + " of block " + blockId + " to @" + username + ".");
          }
          return;
        }
        if (action === "setrole") {
          const select = adminAccountsEl.querySelector('.admin-role-select[data-account-id="' + accountId + '"]');
          if (!(select instanceof HTMLSelectElement)) return;
          const nextRole = normalizeAdminRole(select.value);
          const ok = applyAdminRoleChange(accountId, nextRole, "panel");
          if (ok) {
            postLocalSystemChat("Role updated for @" + ((adminState.accounts[accountId] && adminState.accounts[accountId].username) || accountId) + ".");
          }
          return;
        }
        applyAdminAction(action, accountId, "panel");
      }

      function handleAdminInputChange(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target instanceof HTMLSelectElement && target.classList.contains("admin-console-action")) {
          updateAdminConsoleOptionVisibility();
          const searchEl = adminAccountsEl.querySelector(".admin-console-item-search");
          if (searchEl instanceof HTMLInputElement) {
            searchEl.value = "";
          }
          refreshAdminConsoleItemOptions(String(target.value || ""), "");
          if (String(target.value || "") === "db_restore" && !adminBackupList.length) {
            refreshAdminBackups(false);
          }
          return;
        }
        if (target instanceof HTMLSelectElement && target.classList.contains("admin-console-backup")) {
          adminBackupSelectedId = String(target.value || "").trim();
          return;
        }
        if (target instanceof HTMLSelectElement && target.classList.contains("admin-console-player")) {
          return;
        }
        if (target instanceof HTMLInputElement && target.classList.contains("admin-console-player-filter")) {
          const select = adminAccountsEl.querySelector(".admin-console-player");
          if (!(select instanceof HTMLSelectElement)) return;
          const query = String(target.value || "").trim().toLowerCase();
          let firstVisible = "";
          for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            const label = String(option.text || "").toLowerCase();
            const value = String(option.value || "").toLowerCase();
            const visible = !query || label.includes(query) || value.includes(query);
            option.hidden = !visible;
            if (visible && !firstVisible) firstVisible = option.value;
          }
          if (firstVisible && (select.selectedOptions.length === 0 || select.selectedOptions[0].hidden)) {
            select.value = firstVisible;
          }
          return;
        }
        if (target instanceof HTMLInputElement && target.classList.contains("admin-console-item-search")) {
          const actionEl = adminAccountsEl.querySelector(".admin-console-action");
          const action = actionEl instanceof HTMLSelectElement ? String(actionEl.value || "") : "";
          refreshAdminConsoleItemOptions(action, target.value || "");
          return;
        }
        if (target instanceof HTMLInputElement && target.classList.contains("admin-cmd-search")) {
          const q = String(target.value || "").trim().toLowerCase();
          const rows = adminAccountsEl.querySelectorAll(".admin-cmd-item[data-cmd-text]");
          let any = false;
          rows.forEach((row) => {
            if (!(row instanceof HTMLElement)) return;
            const txt = String(row.dataset.cmdText || "");
            const show = !q || txt.includes(q);
            row.classList.toggle("hidden", !show);
            if (show) any = true;
          });
          const list = adminAccountsEl.querySelector(".admin-sidebar-commands-list");
          if (list instanceof HTMLElement) {
            let empty = list.querySelector(".admin-cmd-empty");
            if (!any) {
              if (!empty) {
                const el = document.createElement("div");
                el.className = "admin-cmd-empty";
                el.textContent = "No matching commands.";
                list.appendChild(el);
              }
            } else if (empty) {
              empty.remove();
            }
          }
          return;
        }
        if (target instanceof HTMLSelectElement && target.classList.contains("admin-ban-preset")) {
          const accountId = target.dataset.accountId;
          if (!accountId) return;
          if (target.value === "custom") return;
          const durationInput = adminAccountsEl.querySelector('.admin-ban-duration[data-account-id="' + accountId + '"]');
          if (durationInput instanceof HTMLInputElement) {
            durationInput.value = target.value;
          }
          return;
        }
        if (!(target instanceof HTMLInputElement)) return;
        const accountId = String(target.dataset.accountId || "");
        if (!accountId) return;
        const isBlockFilter = target.classList.contains("admin-give-block-filter");
        const isItemFilter = target.classList.contains("admin-give-item-filter");
        const isTitleFilter = target.classList.contains("admin-give-title-filter");
        if (!isBlockFilter && !isItemFilter && !isTitleFilter) return;
        const query = String(target.value || "").trim().toLowerCase();
        let select = null;
        let options = [];
        if (isBlockFilter) {
          select = adminAccountsEl.querySelector('.admin-give-block[data-account-id="' + accountId + '"]');
          options = INVENTORY_IDS.map((id) => {
            const key = getBlockKeyById(id);
            const label = (blockDefs[id] && blockDefs[id].name ? blockDefs[id].name : ("Block " + id)) + " (" + key + ")";
            return { value: key, label };
          });
        } else if (isItemFilter) {
          select = adminAccountsEl.querySelector('.admin-give-item-id[data-account-id="' + accountId + '"]');
          options = COSMETIC_ITEMS.map((item) => ({ value: item.id, label: (item.name || item.id) + " (" + item.id + ")" }));
        } else {
          select = adminAccountsEl.querySelector('.admin-give-title-id[data-account-id="' + accountId + '"]');
          options = TITLE_CATALOG.map((title) => ({ value: title.id, label: title.name + " (" + title.id + ")" }));
        }
        if (!(select instanceof HTMLSelectElement)) return;
        const prev = String(select.value || "");
        const filtered = query
          ? options.filter((opt) => opt.label.toLowerCase().includes(query) || opt.value.toLowerCase().includes(query))
          : options;
        select.innerHTML = filtered.map((opt) => "<option value=\"" + escapeHtml(opt.value) + "\">" + escapeHtml(opt.label) + "</option>").join("");
        if (filtered.length <= 0) {
          select.innerHTML = "<option value=\"\">No results</option>";
          select.disabled = true;
          return;
        }
        select.disabled = false;
        if (filtered.some((opt) => opt.value === prev)) {
          select.value = prev;
        }
      }

      function handleAdminKeydown(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (event.key !== "Enter") return;
        const insideConsole = target.closest(".admin-console");
        if (!(insideConsole instanceof HTMLElement)) return;
        if (target instanceof HTMLTextAreaElement) return;
        event.preventDefault();
        event.stopPropagation();
        const runButton = adminAccountsEl.querySelector('button[data-admin-act="runconsole"]');
        if (runButton instanceof HTMLButtonElement && !runButton.disabled) {
          runButton.click();
        }
      }

      function handleAdminInventoryModalChange(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!(target instanceof HTMLSelectElement)) return;
        if (!target.classList.contains("admin-inv-kind")) return;
        const accountId = target.dataset.accountId || "";
        if (!accountId) return;
        const itemSelect = adminInventoryBodyEl.querySelector('.admin-inv-item[data-account-id="' + accountId + '"]');
        if (!(itemSelect instanceof HTMLSelectElement)) return;
        const kind = target.value === "cosmetic"
          ? "cosmetic"
          : (target.value === "title"
              ? "title"
              : (target.value === "farmable" ? "farmable" : "block"));
        itemSelect.innerHTML = buildAdminInventoryItemOptions(kind);
      }

      function handleAdminInventoryModalAction(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const action = (target.dataset.adminInvAct || "").trim();
        if (!action) return;
        if (!canUseAdminPanel) return;
        const accountId = (target.dataset.accountId || "").trim();
        if (!accountId) return;
        const account = adminState.accounts[accountId] || {};
        const username = (account.username || accountId).toString();
        const role = getAccountRole(accountId, username);
        if (!canEditAdminInventoryModal() || !canActorGrantTarget(accountId, role)) {
          postLocalSystemChat("Permission denied.");
          return;
        }
        const kindSelect = adminInventoryBodyEl.querySelector('.admin-inv-kind[data-account-id="' + accountId + '"]');
        const itemSelect = adminInventoryBodyEl.querySelector('.admin-inv-item[data-account-id="' + accountId + '"]');
        const amountInput = adminInventoryBodyEl.querySelector('.admin-inv-amount[data-account-id="' + accountId + '"]');
        if (!(kindSelect instanceof HTMLSelectElement) || !(itemSelect instanceof HTMLSelectElement) || !(amountInput instanceof HTMLInputElement)) return;
        const removeAllItem = (kind, itemId) => {
          const cleanKind = kind === "cosmetic" ? "cosmetic" : (kind === "title" ? "title" : (kind === "farmable" ? "farmable" : "block"));
          const cleanItemId = String(itemId || "").trim();
          if (!cleanItemId) return;
          if (cleanKind === "cosmetic") {
            const itemDef = COSMETIC_ITEMS.find((it) => it.id === cleanItemId);
            if (!itemDef) return;
            proxyAdminSet("/" + BASE_PATH + "/player-inventories/" + accountId + "/cosmeticItems/" + cleanItemId, 0).then((out) => {
              if (!out || !out.ok) {
                postLocalSystemChat("Failed to remove cosmetic item.");
                return;
              }
              setLocalInventoryCosmeticCount(accountId, cleanItemId, 0);
              logAdminAudit("Admin(inventory-modal) removed all item " + cleanItemId + " for @" + username + ".");
              pushAdminAuditEntry("inventory_remove_all", accountId, "item=" + cleanItemId);
              syncAdminPanelAfterInventoryChange(accountId);
            }).catch(() => {
              postLocalSystemChat("Failed to remove cosmetic item.");
            });
            return;
          }
          if (cleanKind === "title") {
            const titleDef = TITLE_LOOKUP[cleanItemId];
            if (!titleDef) return;
            proxyAdminSet("/" + BASE_PATH + "/player-inventories/" + accountId + "/titleItems/" + cleanItemId, 0).then((out) => {
              if (!out || !out.ok) {
                postLocalSystemChat("Failed to remove title.");
                return;
              }
              setLocalInventoryTitleCount(accountId, cleanItemId, 0);
              logAdminAudit("Admin(inventory-modal) removed all title " + cleanItemId + " for @" + username + ".");
              pushAdminAuditEntry("inventory_remove_all", accountId, "title=" + cleanItemId);
              syncAdminPanelAfterInventoryChange(accountId);
            }).catch(() => {
              postLocalSystemChat("Failed to remove title.");
            });
            return;
          }
          const blockId = parseBlockRef(cleanItemId);
          if (cleanKind === "farmable") {
            if (!FARMABLE_INVENTORY_IDS.includes(blockId)) return;
          } else if (!NORMAL_BLOCK_INVENTORY_IDS.includes(blockId)) {
            return;
          }
          proxyAdminSet("/" + BASE_PATH + "/player-inventories/" + accountId + "/" + blockId, 0).then((out) => {
            if (!out || !out.ok) {
              postLocalSystemChat("Failed to remove block item.");
              return;
            }
            setLocalInventoryBlockCount(accountId, blockId, 0);
            logAdminAudit("Admin(inventory-modal) removed all block " + blockId + " for @" + username + ".");
            pushAdminAuditEntry("inventory_remove_all", accountId, "block=" + blockId);
            syncAdminPanelAfterInventoryChange(accountId);
          }).catch(() => {
            postLocalSystemChat("Failed to remove block item.");
          });
        };
        if (action === "removeallselected") {
          const currentSelect = adminInventoryBodyEl.querySelector('.admin-inv-current[data-account-id="' + accountId + '"]');
          if (!(currentSelect instanceof HTMLSelectElement)) return;
          const raw = String(currentSelect.value || "");
          const sep = raw.indexOf(":");
          if (sep <= 0) return;
          const selectedKind = raw.slice(0, sep);
          const selectedItemId = raw.slice(sep + 1);
          removeAllItem(selectedKind, selectedItemId);
          return;
        }
        if (action === "removeall") {
          removeAllItem(target.dataset.kind, target.dataset.itemId);
          return;
        }
        const amount = Math.max(1, Math.floor(Number(amountInput.value) || 1));
        const delta = action === "remove" ? -amount : amount;
        if (kindSelect.value === "cosmetic") {
          const itemId = (itemSelect.value || "").toString();
          if (!itemId) return;
          const itemDef = COSMETIC_ITEMS.find((it) => it.id === itemId);
          if (!itemDef) return;
          proxyAdminIncrement("/" + BASE_PATH + "/player-inventories/" + accountId + "/cosmeticItems/" + itemId, delta, {
            min: 0,
            integer: true
          }).then((out) => {
            if (!out || !out.ok) {
              postLocalSystemChat("Failed to update cosmetic item.");
              return;
            }
            const currentLocal = Math.max(0, Math.floor(Number(adminState.inventories[accountId] && adminState.inventories[accountId].cosmeticItems && adminState.inventories[accountId].cosmeticItems[itemId]) || 0));
            const nextFromWorker = Number(out && out.result && out.result.next);
            const next = Math.max(0, Math.floor(Number.isFinite(nextFromWorker) ? nextFromWorker : (currentLocal + delta)));
            setLocalInventoryCosmeticCount(accountId, itemId, next);
            logAdminAudit("Admin(inventory-modal) " + (delta > 0 ? "added " : "removed ") + "item " + itemId + " x" + amount + " for @" + username + ".");
            pushAdminAuditEntry(delta > 0 ? "inventory_add" : "inventory_remove", accountId, "item=" + itemId + " amount=" + amount);
            syncAdminPanelAfterInventoryChange(accountId);
          }).catch(() => {
            postLocalSystemChat("Failed to update cosmetic item.");
          });
          return;
        }
        if (kindSelect.value === "title") {
          const titleId = String(itemSelect.value || "").trim();
          if (!titleId || !TITLE_LOOKUP[titleId]) return;
          const nextValue = delta > 0 ? 1 : 0;
          proxyAdminSet("/" + BASE_PATH + "/player-inventories/" + accountId + "/titleItems/" + titleId, nextValue).then((out) => {
            if (!out || !out.ok) {
              postLocalSystemChat("Failed to update title.");
              return;
            }
            const next = clampTitleUnlocked(nextValue);
            setLocalInventoryTitleCount(accountId, titleId, next);
            logAdminAudit("Admin(inventory-modal) " + (delta > 0 ? "unlocked " : "removed ") + "title " + titleId + " for @" + username + ".");
            pushAdminAuditEntry(delta > 0 ? "inventory_add" : "inventory_remove", accountId, "title=" + titleId + " unlocked=" + next);
            syncAdminPanelAfterInventoryChange(accountId);
          }).catch(() => {
            postLocalSystemChat("Failed to update title.");
          });
          return;
        }
        const blockKind = kindSelect.value === "farmable" ? "farmable" : "block";
        const blockId = parseBlockRef(itemSelect.value || "");
        if (blockKind === "farmable") {
          if (!FARMABLE_INVENTORY_IDS.includes(blockId)) return;
        } else if (!NORMAL_BLOCK_INVENTORY_IDS.includes(blockId)) {
          return;
        }
        proxyAdminIncrement("/" + BASE_PATH + "/player-inventories/" + accountId + "/" + blockId, delta, {
          min: 0,
          integer: true
        }).then((out) => {
          if (!out || !out.ok) {
            postLocalSystemChat("Failed to update block item.");
            return;
          }
          const currentLocal = Math.max(0, Math.floor(Number(adminState.inventories[accountId] && adminState.inventories[accountId][blockId]) || 0));
          const nextFromWorker = Number(out && out.result && out.result.next);
          const next = Math.max(0, Math.floor(Number.isFinite(nextFromWorker) ? nextFromWorker : (currentLocal + delta)));
          setLocalInventoryBlockCount(accountId, blockId, next);
          logAdminAudit("Admin(inventory-modal) " + (delta > 0 ? "added " : "removed ") + "block " + blockId + " x" + amount + " for @" + username + ".");
          pushAdminAuditEntry(delta > 0 ? "inventory_add" : "inventory_remove", accountId, "block=" + blockId + " amount=" + amount);
          syncAdminPanelAfterInventoryChange(accountId);
        }).catch(() => {
          postLocalSystemChat("Failed to update block item.");
        });
      }

      function refreshAuditActionFilterOptions() {
        const ctrl = getAdminPanelController();
        if (ctrl && typeof ctrl.refreshAuditActionFilterOptions === "function") {
          ctrl.refreshAuditActionFilterOptions();
        }
      }

      function exportAuditTrail() {
        const ctrl = getAdminPanelController();
        if (ctrl && typeof ctrl.exportAuditTrail === "function") {
          ctrl.exportAuditTrail();
        }
      }

      function buildAssetVersionTag() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const mi = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        return yyyy + "-" + mm + "-" + dd + "-" + hh + mi + ss;
      }

      async function hardReloadClient(assetVersion) {
        try {
          if ("caches" in window && window.caches && typeof window.caches.keys === "function") {
            const keys = await window.caches.keys();
            await Promise.all(keys.map((key) => window.caches.delete(key)));
          }
        } catch (error) {
          // ignore cache cleanup failures
        }
        const url = new URL(window.location.href);
        const nextVersion = (assetVersion || "").toString().trim();
        if (nextVersion) {
          url.searchParams.set("v", nextVersion);
          try {
            localStorage.setItem("gt_asset_version", nextVersion);
          } catch (error) {
            // ignore localStorage write failures
          }
        }
        url.searchParams.set("_fr", Date.now().toString());
        window.location.replace(url.toString());
      }

      function showUpdatingOverlay() {
        if (!updatingOverlayEl) return;
        updatingOverlayEl.classList.remove("hidden");
      }

      function hideAnnouncementPopup() {
        if (!announcementPopupEl) return;
        announcementPopupEl.classList.add("hidden");
      }

      function showAnnouncementPopup(message, durationMs) {
        if (!announcementPopupEl || !announcementTextEl) return;
        const text = (message || "").toString().trim().slice(0, 180);
        if (!text) return;
        const safeDuration = Math.max(1200, Math.min(8000, Math.floor(Number(durationMs) || 5000)));
        announcementTextEl.textContent = text;
        announcementPopupEl.classList.remove("hidden");
        if (announcementHideTimer) {
          clearTimeout(announcementHideTimer);
        }
        announcementHideTimer = setTimeout(() => {
          hideAnnouncementPopup();
          announcementHideTimer = 0;
        }, safeDuration);
      }

      function getCloudflareGatewayController() {
        if (cloudflareGatewayController) return cloudflareGatewayController;
        if (typeof cloudflareGatewayModule.createController !== "function") return null;
        cloudflareGatewayController = cloudflareGatewayModule.createController({
          basePath: BASE_PATH,
          endpoint: window.CLOUDFLARE_PACKET_ENDPOINT || "",
          timeoutMs: 9000
        });
        return cloudflareGatewayController;
      }

      function proxyAdminSet(path, value) {
        const ctrl = getCloudflareGatewayController();
        if (!ctrl || typeof ctrl.writeSet !== "function") {
          return Promise.resolve({ ok: false, error: "Cloudflare gateway unavailable." });
        }
        return ctrl.writeSet(path, value);
      }

      function proxyAdminUpdate(path, value) {
        const ctrl = getCloudflareGatewayController();
        if (!ctrl || typeof ctrl.writeUpdate !== "function") {
          return Promise.resolve({ ok: false, error: "Cloudflare gateway unavailable." });
        }
        return ctrl.writeUpdate(path, value);
      }

      function proxyAdminRemove(path) {
        const ctrl = getCloudflareGatewayController();
        if (!ctrl || typeof ctrl.writeRemove !== "function") {
          return Promise.resolve({ ok: false, error: "Cloudflare gateway unavailable." });
        }
        return ctrl.writeRemove(path);
      }

      function proxyAdminIncrement(path, delta, options) {
        const ctrl = getCloudflareGatewayController();
        if (!ctrl || typeof ctrl.writeIncrement !== "function") {
          return Promise.resolve({ ok: false, error: "Cloudflare gateway unavailable." });
        }
        return ctrl.writeIncrement(path, delta, options);
      }

      function makeAdminPushKey(path) {
        if (network.db && typeof network.db.ref === "function") {
          try {
            const safePath = String(path || "").replace(/^\/+/, "");
            const key = network.db.ref(safePath).push().key;
            if (key) return String(key);
          } catch (error) {
            // ignore and fallback
          }
        }
        return "k_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
      }

      function issueGlobalAnnouncement(messageText) {
        const text = (messageText || "").toString().trim().slice(0, 140);
        if (!text) return Promise.resolve(false);
        const payload = {
          id: "an_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          text,
          actorUsername: (playerName || "admin").toString().slice(0, 20),
          createdAt: Date.now()
        };
        const path = "/" + BASE_PATH + "/system/announcement";
        return proxyAdminSet(path, payload).then((out) => {
          if (out && out.ok) {
            window.__gtLastAdminBackendError = "";
            return true;
          }
          const status = Number(out && out.status);
          const errorText = out && out.error ? String(out.error) : "";
          window.__gtLastAdminBackendError = errorText || (Number.isFinite(status) && status > 0 ? ("status " + status) : "unknown backend error");
          return false;
        }).catch((error) => {
          window.__gtLastAdminBackendError = String(error && error.message || "request failed");
          return false;
        });
      }

      function clearAdminAuditTrail() {
        if (!hasAdminPermission("clear_logs")) return Promise.resolve(false);
        const path = "/" + BASE_PATH + "/admin-audit";
        return proxyAdminRemove(path).then((out) => {
          if (out && out.ok) {
            window.__gtLastAdminBackendError = "";
            return true;
          }
          const status = Number(out && out.status);
          const errorText = out && out.error ? String(out.error) : "";
          window.__gtLastAdminBackendError = errorText || (Number.isFinite(status) && status > 0 ? ("status " + status) : "unknown backend error");
          return false;
        }).catch((error) => {
          window.__gtLastAdminBackendError = String(error && error.message || "request failed");
          return false;
        });
      }

      function triggerForceReloadAll(sourceTag) {
        if (!hasAdminPermission("force_reload")) {
          postLocalSystemChat("Permission denied.");
          return;
        }
        const eventId = "fr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        const assetVersion = buildAssetVersionTag();
        proxyAdminSet("/" + BASE_PATH + "/system/force-reload", {
          id: eventId,
          assetVersion,
          createdAt: Date.now(),
          actorAccountId: playerProfileId || "",
          actorUsername: playerName || "",
          source: (sourceTag || "panel").toString().slice(0, 16)
        }).then((out) => {
          if (!out || !out.ok) {
            postLocalSystemChat("Failed to send reload broadcast.");
            return;
          }
          logAdminAudit("Admin(" + (sourceTag || "panel") + ") requested global client reload.");
          pushAdminAuditEntry("force_reload", "", "all_clients version=" + assetVersion);
          postLocalSystemChat("Force reload broadcast sent (v=" + assetVersion + ").");
        }).catch(() => {
          postLocalSystemChat("Failed to send reload broadcast.");
        });
      }

      function logAdminAudit(text) {
        if (!text) return;
        addClientLog(text.toString().slice(0, 180), playerProfileId, playerName, "admin_audit");
      }

      function applyInventoryGrant(accountId, blockId, amount, sourceTag, targetLabel) {
        if (!accountId || !canUseAdminPanel) return false;
        if (!ensureCommandReady("give_block")) return false;
        if (!hasAdminPermission("give_block")) {
          postLocalSystemChat("Permission denied.");
          return false;
        }
        const targetUsername = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || "";
        const targetRole = getAccountRole(accountId, targetUsername);
        if (!canActorGrantTarget(accountId, targetRole)) {
          postLocalSystemChat("Permission denied on target role.");
          return false;
        }
        const safeAmount = Math.floor(Number(amount));
        const safeBlock = parseBlockRef(blockId);
        if (!INVENTORY_IDS.includes(safeBlock) || !Number.isInteger(safeAmount) || safeAmount <= 0) {
          postLocalSystemChat("Usage: blockId <number|key> (e.g. wood_block) and amount >= 1.");
          return false;
        }
        proxyAdminIncrement("/" + BASE_PATH + "/player-inventories/" + accountId + "/" + safeBlock, safeAmount, {
          min: 0,
          integer: true
        }).then((out) => {
          if (!out || !out.ok) {
            postLocalSystemChat("Failed to update inventory.");
            return;
          }
          const currentLocal = Math.max(0, Math.floor(Number(adminState.inventories[accountId] && adminState.inventories[accountId][safeBlock]) || 0));
          const nextFromWorker = Number(out && out.result && out.result.next);
          const next = Math.max(0, Math.floor(Number.isFinite(nextFromWorker) ? nextFromWorker : (currentLocal + safeAmount)));
          setLocalInventoryBlockCount(accountId, safeBlock, next);
          const target = targetLabel || targetUsername || accountId;
          logAdminAudit("Admin(" + sourceTag + ") gave @" + target + " block " + safeBlock + " amount " + safeAmount + ".");
          pushAdminAuditEntry("givex", accountId, "block=" + safeBlock + " amount=" + safeAmount);
          syncAdminPanelAfterInventoryChange(accountId);
          //postLocalSystemChat("Granted block " + safeBlock + " x" + safeAmount + " to @" + target + ".");
        }).catch(() => {
          postLocalSystemChat("Failed to update inventory.");
        });
        return true;
      }

      function applyCosmeticItemGrant(accountId, itemId, amount, sourceTag, targetLabel) {
        if (!accountId || !canUseAdminPanel) return false;
        if (!ensureCommandReady("give_item")) return false;
        if (!hasAdminPermission("give_item")) {
          postLocalSystemChat("Permission denied.");
          return false;
        }
        const targetUsername = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || "";
        const targetRole = getAccountRole(accountId, targetUsername);
        if (!canActorGrantTarget(accountId, targetRole)) {
          postLocalSystemChat("Permission denied on target role.");
          return false;
        }
        const amountSafe = Math.floor(Number(amount));
        const itemIdSafe = String(itemId || "");
        const itemDef = COSMETIC_ITEMS.find((it) => it.id === itemIdSafe);
        if (!itemDef || !Number.isInteger(amountSafe) || amountSafe <= 0) {
          postLocalSystemChat("Usage: /giveitem <user> <itemId> <amount>");
          return false;
        }
        proxyAdminIncrement("/" + BASE_PATH + "/player-inventories/" + accountId + "/cosmeticItems/" + itemIdSafe, amountSafe, {
          min: 0,
          integer: true
        }).then((out) => {
          if (!out || !out.ok) {
            postLocalSystemChat("Failed to give item.");
            return;
          }
          const currentLocal = Math.max(0, Math.floor(Number(adminState.inventories[accountId] && adminState.inventories[accountId].cosmeticItems && adminState.inventories[accountId].cosmeticItems[itemIdSafe]) || 0));
          const nextFromWorker = Number(out && out.result && out.result.next);
          const next = Math.max(0, Math.floor(Number.isFinite(nextFromWorker) ? nextFromWorker : (currentLocal + amountSafe)));
          setLocalInventoryCosmeticCount(accountId, itemIdSafe, next);
          const target = targetLabel || targetUsername || accountId;
          logAdminAudit("Admin(" + sourceTag + ") gave @" + target + " item " + itemIdSafe + " x" + amountSafe + ".");
          pushAdminAuditEntry("giveitem", accountId, "item=" + itemIdSafe + " amount=" + amountSafe);
          syncAdminPanelAfterInventoryChange(accountId);
          //postLocalSystemChat("Granted item " + itemIdSafe + " x" + amountSafe + " to @" + target + ".");
        }).catch(() => {
          postLocalSystemChat("Failed to give item.");
        });
        return true;
      }

      function applyTitleGrant(accountId, titleId, amount, sourceTag, targetLabel, removeMode) {
        if (!accountId || !canUseAdminPanel) return false;
        if (!ensureCommandReady(removeMode ? "removetitle" : "givetitle")) return false;
        if (!hasAdminPermission(removeMode ? "remove_title" : "give_title")) {
          postLocalSystemChat("Permission denied.");
          return false;
        }
        const targetUsername = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || "";
        const targetRole = getAccountRole(accountId, targetUsername);
        if (!canActorGrantTarget(accountId, targetRole)) {
          postLocalSystemChat("Permission denied on target role.");
          return false;
        }
        const amountSafe = Math.floor(Number(amount));
        const titleIdSafe = String(titleId || "").trim();
        const titleDef = TITLE_LOOKUP[titleIdSafe] || null;
        if (!titleDef || !Number.isInteger(amountSafe) || amountSafe <= 0) {
          postLocalSystemChat("Usage: " + (removeMode ? "/removetitle" : "/givetitle") + " <user> <title_id> <amount>");
          return false;
        }
        const nextValue = removeMode ? 0 : 1;
        proxyAdminSet("/" + BASE_PATH + "/player-inventories/" + accountId + "/titleItems/" + titleIdSafe, nextValue).then((out) => {
          if (!out || !out.ok) {
            postLocalSystemChat("Failed to update title.");
            return;
          }
          const next = clampTitleUnlocked(nextValue);
          setLocalInventoryTitleCount(accountId, titleIdSafe, next);
          const target = targetLabel || targetUsername || accountId;
          logAdminAudit("Admin(" + sourceTag + ") " + (removeMode ? "removed title " : "unlocked title ") + titleIdSafe + " " + (removeMode ? "from" : "to") + " @" + target + ".");
          pushAdminAuditEntry(removeMode ? "removetitle" : "givetitle", accountId, "title=" + titleIdSafe + " unlocked=" + next);
          syncAdminPanelAfterInventoryChange(accountId);
        }).catch(() => {
          postLocalSystemChat("Failed to update title.");
        });
        return true;
      }

      function pushAdminAuditEntry(action, targetAccountId, details) {
        const auditPath = "/" + BASE_PATH + "/admin-audit";
        const auditKey = makeAdminPushKey(auditPath);
        const payload = {
          actorAccountId: playerProfileId || "",
          actorUsername: playerName || "",
          actorRole: currentAdminRole,
          action: action || "",
          targetAccountId: targetAccountId || "",
          targetUsername: (adminState.accounts[targetAccountId] && adminState.accounts[targetAccountId].username) || "",
          details: (details || "").toString().slice(0, 180),
          createdAt: Date.now()
        };
        proxyAdminSet(auditPath + "/" + auditKey, payload).catch(() => {});
      }

      function applyAdminAction(action, accountId, sourceTag, opts) {
        if (!action || !accountId || !canUseAdminPanel) return false;
        if (!ensureCommandReady(action)) return false;
        const options = opts || {};
        const targetUsername = (adminState.accounts[accountId] && adminState.accounts[accountId].username) || "";
        const targetRole = getAccountRole(accountId, targetUsername);
        const affectsTarget = action !== "tp";
        const isSelfTarget = accountId === playerProfileId;
        const permissionAction = (action === "mutechat" || action === "unmutechat") ? "kick" : action;
        if (!hasAdminPermission(permissionAction)) {
          postLocalSystemChat("Permission denied for action: " + action);
          return false;
        }
        if (isSelfTarget && (action === "kick" || action === "tempban" || action === "permban" || action === "mutechat")) {
          postLocalSystemChat("You cannot use " + action + " on yourself.");
          return false;
        }
        if (affectsTarget && !canActorAffectTarget(accountId, targetRole)) {
          postLocalSystemChat("Permission denied on target role.");
          return false;
        }
        if (action === "tempban") {
          const durationMs = Number(options.durationMs) || 0;
          if (!durationMs) {
            postLocalSystemChat("Temp ban duration is required.");
            return false;
          }
          const reason = (options.reason || "Temporarily banned by admin").toString().slice(0, 80);
          const expiresAt = Date.now() + durationMs;
          proxyAdminSet("/" + BASE_PATH + "/bans/" + accountId, {
            type: "temporary",
            reason,
            bannedBy: playerName,
            durationMs,
            expiresAt,
            createdAt: Date.now()
          }).then((out) => {
            if (!out || !out.ok) return;
            proxyAdminRemove("/" + BASE_PATH + "/account-sessions/" + accountId).catch(() => {});
            const durationLabel = options.rawDuration || formatRemainingMs(durationMs);
            logAdminAudit("Admin(" + sourceTag + ") tempbanned account " + accountId + " for " + durationLabel + ".");
            pushAdminAuditEntry("tempban", accountId, "duration=" + durationLabel + " reason=" + reason);
          }).catch(() => {});
          return true;
        }
        if (action === "permban") {
          const reason = (options.reason || "Permanently banned by admin").toString().slice(0, 80);
          proxyAdminSet("/" + BASE_PATH + "/bans/" + accountId, {
            type: "permanent",
            reason,
            bannedBy: playerName,
            createdAt: Date.now()
          }).then((out) => {
            if (!out || !out.ok) return;
            proxyAdminRemove("/" + BASE_PATH + "/account-sessions/" + accountId).catch(() => {});
            logAdminAudit("Admin(" + sourceTag + ") permbanned account " + accountId + ".");
            pushAdminAuditEntry("permban", accountId, "reason=" + reason);
          }).catch(() => {});
          return true;
        }
        if (action === "unban") {
          proxyAdminRemove("/" + BASE_PATH + "/bans/" + accountId).then((out) => {
            if (!out || !out.ok) return;
            logAdminAudit("Admin(" + sourceTag + ") unbanned account " + accountId + ".");
            pushAdminAuditEntry("unban", accountId, "");
          }).catch(() => {});
          return true;
        }
        if (action === "kick") {
          proxyAdminRemove("/" + BASE_PATH + "/account-sessions/" + accountId).then((out) => {
            if (!out || !out.ok) return;
            logAdminAudit("Admin(" + sourceTag + ") kicked account " + accountId + ".");
            pushAdminAuditEntry("kick", accountId, "");
          }).catch(() => {});
          return true;
        }
        if (action === "mutechat") {
          const durationMs = Math.max(0, Math.floor(Number(options.durationMs) || 0));
          const reason = (options.reason || "Muted by admin").toString().slice(0, 120);
          const payload = {
            muted: true,
            reason,
            mutedBy: (playerName || "admin").toString().slice(0, 20),
            createdAt: Date.now()
          };
          if (durationMs > 0) {
            payload.expiresAt = Date.now() + durationMs;
          }
          proxyAdminSet("/" + BASE_PATH + "/chat-mutes/" + accountId, payload).then((out) => {
            if (!out || !out.ok) return;
            logAdminAudit("Admin(" + sourceTag + ") muted chat for account " + accountId + ".");
            pushAdminAuditEntry("mutechat", accountId, durationMs > 0 ? ("durationMs=" + durationMs + " reason=" + reason) : ("reason=" + reason));
          }).catch(() => {});
          return true;
        }
        if (action === "unmutechat") {
          proxyAdminRemove("/" + BASE_PATH + "/chat-mutes/" + accountId).then((out) => {
            if (!out || !out.ok) return;
            logAdminAudit("Admin(" + sourceTag + ") unmuted chat for account " + accountId + ".");
            pushAdminAuditEntry("unmutechat", accountId, "");
          }).catch(() => {});
          return true;
        }
        if (action === "freeze" || action === "unfreeze") {
          const frozen = action === "freeze";
          issueFreezeCommand(accountId, frozen).then((ok) => {
            if (!ok) return;
            logAdminAudit("Admin(" + sourceTag + ") " + (frozen ? "froze" : "unfroze") + " account " + accountId + ".");
            pushAdminAuditEntry(action, accountId, "");
          }).catch(() => {});
          return true;
        }
        if (action === "godmode") {
          const enabled = Boolean(options.enabled);
          issueGodModeCommand(accountId, enabled).then((ok) => {
            if (!ok) return;
            logAdminAudit("Admin(" + sourceTag + ") set godmode " + (enabled ? "ON" : "OFF") + " for account " + accountId + ".");
            pushAdminAuditEntry("godmode", accountId, "enabled=" + (enabled ? "1" : "0"));
          }).catch(() => {});
          return true;
        }
        if (action === "resetinv") {
          const cosmeticItems = {};
          for (const item of COSMETIC_ITEMS) {
            cosmeticItems[item.id] = 0;
          }
          const titleItems = {};
          for (const title of TITLE_CATALOG) {
            titleItems[title.id] = title.defaultUnlocked ? 1 : 0;
          }
          const resetPayload = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
            cosmeticItems,
            titleItems,
            equippedTitle: TITLE_DEFAULT_ID || "",
            equippedCosmetics: { shirts: "", pants: "", shoes: "", hats: "", wings: "", swords: "" }
          };
          proxyAdminSet("/" + BASE_PATH + "/player-inventories/" + accountId, resetPayload).then((out) => {
            if (!out || !out.ok) return;
            adminState.inventories[accountId] = JSON.parse(JSON.stringify(resetPayload));
            logAdminAudit("Admin(" + sourceTag + ") reset inventory for " + accountId + ".");
            pushAdminAuditEntry("resetinv", accountId, "");
            syncAdminPanelAfterInventoryChange(accountId);
          }).catch(() => {});
          return true;
        }
        return false;
      }

      function applyAdminRoleChange(accountId, nextRole, sourceTag) {
        if (!accountId || !canUseAdminPanel) return false;
        if (!ensureCommandReady("setrole")) return false;
        const normalized = normalizeAdminRole(nextRole);
        if (!hasAdminPermission("setrole") && !hasAdminPermission("setrole_limited")) {
          postLocalSystemChat("You cannot set roles.");
          return false;
        }
        if (!canSetRoleTo(accountId, normalized)) {
          postLocalSystemChat("You cannot set that role for this account.");
          return false;
        }
        const rolePath = "/" + BASE_PATH + "/admin-roles/" + accountId;
        const op = normalized === "none"
          ? proxyAdminRemove(rolePath)
          : proxyAdminSet(rolePath, normalized);
        op.then((out) => {
          if (!out || !out.ok) throw new Error("Role update failed.");
          logAdminAudit("Admin(" + sourceTag + ") set role " + normalized + " for account " + accountId + ".");
          pushAdminAuditEntry("setrole", accountId, "role=" + normalized);
        }).catch(() => {
          postLocalSystemChat("Role update failed.");
        });
        return true;
      }

      function findAccountIdByUserRef(userRef) {
        const ref = normalizeUsername(userRef);
        if (!ref) return "";
        if (ref.startsWith("acc_") && adminState.accounts[ref]) return ref;
        const byUsername = adminState.usernames[ref];
        if (byUsername) return byUsername;
        const fallback = Object.keys(adminState.accounts).find((id) => {
          const u = (adminState.accounts[id] && adminState.accounts[id].username || "").toLowerCase();
          return u === ref;
        });
        return fallback || "";
      }

      function clampTeleport(value, min, max) {
        if (typeof playerModule.clamp === "function") {
          return playerModule.clamp(value, min, max);
        }
        const n = Number(value);
        if (!Number.isFinite(n)) return min;
        return Math.max(min, Math.min(max, n));
      }

      function findOnlineGlobalPlayerByAccountId(accountId) {
        const players = adminState.globalPlayers || {};
        const ids = Object.keys(players);
        for (const id of ids) {
          const p = players[id] || {};
          if ((p.accountId || "") === accountId) {
            return p;
          }
        }
        return null;
      }

      function issueTeleportCommand(targetAccountId, worldId, x, y) {
        if (!targetAccountId) return Promise.resolve(false);
        const safeWorld = normalizeWorldId(worldId || currentWorldId);
        if (!safeWorld) return Promise.resolve(false);
        const commandId = "tp_" + Math.random().toString(36).slice(2, 12);
        const payload = {
          id: commandId,
          world: safeWorld,
          x: clampTeleport(x, 0, WORLD_W * TILE - PLAYER_W - 2),
          y: clampTeleport(y, 0, WORLD_H * TILE - PLAYER_H - 2),
          by: playerName,
          issuedAt: Date.now()
        };
        return proxyAdminSet("/" + BASE_PATH + "/account-commands/" + targetAccountId + "/teleport", payload)
          .then((out) => Boolean(out && out.ok))
          .catch(() => false);
      }

      function normalizeEditReachTiles(value) {
        const n = Number(value);
        const safe = Number.isFinite(n) ? n : DEFAULT_EDIT_REACH_TILES;
        return Math.max(MIN_EDIT_REACH_TILES, Math.min(MAX_EDIT_REACH_TILES, safe));
      }

      function getEditReachTiles() {
        return normalizeEditReachTiles(editReachTiles);
      }

      function setEditReachTiles(value) {
        editReachTiles = normalizeEditReachTiles(value);
      }

      function resetEditReachTiles() {
        editReachTiles = DEFAULT_EDIT_REACH_TILES;
      }

      function clearOwnReachCommandRecord() {
        if (!playerProfileId || !network.db) return;
        const path = BASE_PATH + "/account-commands/" + playerProfileId + "/reach";
        network.db.ref(path).remove().catch(() => {});
      }

      function clearReachOverrideOnExit(clearRemoteRecord) {
        resetEditReachTiles();
        lastHandledReachCommandId = "";
        if (clearRemoteRecord) {
          clearOwnReachCommandRecord();
        }
      }

      function issueReachCommand(targetAccountId, reachTiles) {
        if (!targetAccountId) return Promise.resolve(false);
        const payload = {
          id: "rch_" + Math.random().toString(36).slice(2, 12),
          reachTiles: normalizeEditReachTiles(reachTiles),
          by: (playerName || "admin").toString().slice(0, 20),
          issuedAt: Date.now()
        };
        return proxyAdminSet("/" + BASE_PATH + "/account-commands/" + targetAccountId + "/reach", payload)
          .then((out) => Boolean(out && out.ok))
          .catch(() => false);
      }

      function issueFreezeCommand(targetAccountId, frozen) {
        if (!targetAccountId) return Promise.resolve(false);
        const commandId = "frz_" + Math.random().toString(36).slice(2, 12);
        const payload = {
          id: commandId,
          frozen: Boolean(frozen),
          by: (playerName || "admin").toString().slice(0, 20),
          issuedAt: Date.now()
        };
        return proxyAdminSet("/" + BASE_PATH + "/account-commands/" + targetAccountId + "/freeze", payload)
          .then((out) => Boolean(out && out.ok))
          .catch(() => false);
      }

      function issueGodModeCommand(targetAccountId, enabled) {
        if (!targetAccountId) return Promise.resolve(false);
        const commandId = "god_" + Math.random().toString(36).slice(2, 12);
        const payload = {
          id: commandId,
          enabled: Boolean(enabled),
          by: (playerName || "admin").toString().slice(0, 20),
          issuedAt: Date.now()
        };
        return proxyAdminSet("/" + BASE_PATH + "/account-commands/" + targetAccountId + "/godmode", payload)
          .then((out) => Boolean(out && out.ok))
          .catch(() => false);
      }

      function issuePrivateAnnouncement(targetAccountId, messageText) {
        if (!targetAccountId) return Promise.resolve(false);
        const commandId = "pa_" + Math.random().toString(36).slice(2, 12);
        const text = (messageText || "").toString().trim().slice(0, 180);
        if (!text) return Promise.resolve(false);
        const payload = {
          id: commandId,
          text,
          actorUsername: (playerName || "admin").toString().slice(0, 20),
          issuedAt: Date.now()
        };
        return proxyAdminSet("/" + BASE_PATH + "/account-commands/" + targetAccountId + "/announce", payload)
          .then((out) => Boolean(out && out.ok))
          .catch(() => false);
      }

      function issuePrivateMessage(targetAccountId, messageText) {
        if (!targetAccountId) return Promise.resolve(false);
        const text = (messageText || "").toString().trim().slice(0, 160);
        if (!text) return Promise.resolve(false);
        const rootPath = "/" + BASE_PATH + "/account-commands/" + targetAccountId + "/pm";
        const messageKey = makeAdminPushKey(rootPath);
        const payload = {
          id: "pm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          fromAccountId: playerProfileId || "",
          fromUsername: (playerName || "").toString().slice(0, 20),
          text,
          createdAt: Date.now()
        };
        return proxyAdminSet(rootPath + "/" + messageKey, payload)
          .then((out) => Boolean(out && out.ok))
          .catch(() => false);
      }

      function resolveAccountIdByUsernameFast(username) {
        if (!network.db) return Promise.resolve("");
        const normalized = normalizeUsername(username);
        if (!normalized) return Promise.resolve("");
        return network.db.ref(BASE_PATH + "/usernames/" + normalized).once("value")
          .then((snap) => (snap && snap.val ? String(snap.val() || "") : ""))
          .catch(() => "");
      }

      function applySelfTeleport(worldId, x, y) {
        const safeWorld = normalizeWorldId(worldId);
        if (!safeWorld) return;
        const safeX = clampTeleport(x, 0, WORLD_W * TILE - PLAYER_W - 2);
        const safeY = clampTeleport(y, 0, WORLD_H * TILE - PLAYER_H - 2);
        if (!inWorld || currentWorldId !== safeWorld) {
          suppressSpawnSafetyUntilMs = performance.now() + 2500;
          pendingTeleportSelf = { worldId: safeWorld, x: safeX, y: safeY };
          switchWorld(safeWorld, false);
          return;
        }
        suppressSpawnSafetyUntilMs = performance.now() + 900;
        player.x = safeX;
        player.y = safeY;
        player.vx = 0;
        player.vy = 0;
      }

      function setFrozenState(nextFrozen, byName) {
        const frozen = Boolean(nextFrozen);
        isFrozenByAdmin = frozen;
        frozenByAdminBy = (byName || "").toString().slice(0, 20);
        if (frozen) {
          player.vx = 0;
          player.vy = 0;
          const suffix = frozenByAdminBy ? " by @" + frozenByAdminBy : "";
          postLocalSystemChat("You were frozen" + suffix + ".");
        } else {
          const suffix = frozenByAdminBy ? " by @" + frozenByAdminBy : "";
          postLocalSystemChat("You were unfrozen" + suffix + ".");
        }
      }

      function setGodModeState(nextEnabled, byName) {
        const enabled = Boolean(nextEnabled);
        isGodModeByAdmin = enabled;
        const actor = (byName || "").toString().slice(0, 20);
        if (enabled) {
          const suffix = actor ? " by @" + actor : "";
          postLocalSystemChat("Godmode enabled" + suffix + ".");
          return;
        }
        const suffix = actor ? " by @" + actor : "";
        postLocalSystemChat("Godmode disabled" + suffix + ".");
      }

      function shouldBlockActionForFreeze() {
        if (!isFrozenByAdmin) return false;
        const now = performance.now();
        if (now - lastFrozenHintAtMs > 900) {
          lastFrozenHintAtMs = now;
          postLocalSystemChat("You are frozen and cannot act.");
        }
        return true;
      }

      function postLocalSystemChat(text) {
        const safeText = (text || "").toString().slice(0, SYSTEM_CHAT_TEXT_MAX);
        const sfxEvent = resolveSystemMessageSfxEvent(safeText);
        if (sfxEvent) {
          playSfxEvent(sfxEvent, 0.45, "input", safeText);
        }
        addChatMessage({
          name: "[System]",
          playerId: "",
          text: safeText,
          createdAt: Date.now()
        });
      }

      function handleAdminChatCommand(rawText) {
        if (typeof commandsModule.handleChatCommand !== "function") return false;
        return commandsModule.handleChatCommand({
          normalizeWorldId,
          switchWorld,
          postLocalSystemChat,
          setDanceUntilMs: (value) => { danceUntilMs = Number(value) || 0; },
          DANCE_DURATION_MS,
          inWorld,
          syncPlayer,
          isWorldLocked,
          isWorldLockOwner,
          notifyWorldLockedDenied,
          getSpawnStructureTiles,
          getSelectedSlot: () => selectedSlot,
          setSelectedSlot: (value) => { selectedSlot = Number(value) || 0; },
          slotOrder,
          WORLD_LOCK_ID,
          LOCK_BLOCK_IDS,
          inventory,
          tryPlace,
          refreshToolbar,
          currentWorldLock,
          setCurrentWorldLock: (value) => { currentWorldLock = value; },
          network,
          tryBreak,
          WORLD_W,
          WORLD_H,
          hasAdminPermission,
          currentAdminRole,
          normalizeAdminRole,
          totalOnlinePlayers,
          remotePlayers,
          currentWorldId,
          canUseAdminPanel,
          findAccountIdByUserRef,
          findOnlineGlobalPlayerByAccountId,
          TILE,
          ensureCommandReady,
          applySelfTeleport,
          pushAdminAuditEntry,
          getAccountRole,
          adminState,
          canActorAffectTarget,
          issuePrivateAnnouncement,
          issueGlobalAnnouncement,
          issueReachCommand,
          logAdminAudit,
          BASE_PATH,
          playerName,
          firebase,
          sendSystemWorldMessage,
          clearLogsData,
          clearAdminAuditTrail,
          refreshAuditActionFilterOptions,
          renderAdminPanel,
          playerProfileId,
          isGodModeEnabled: () => isGodModeByAdmin,
          issueTeleportCommand,
          player,
          applyAdminAction,
          clearCurrentWorldToBedrock,
          parseBlockRef,
          INVENTORY_IDS,
          FARMABLE_INVENTORY_IDS,
          NORMAL_BLOCK_INVENTORY_IDS,
          getBlockNameById: (id) => {
            const def = blockDefs[Math.floor(Number(id) || 0)];
            return def && def.name ? def.name : "";
          },
          getCosmeticItems: () => COSMETIC_ITEMS,
          TOOL_FIST,
          TOOL_WRENCH,
          QUEST_NPC_ID,
          spawnWorldDropEntry,
          spawnAdminWorldDrops,
          applyInventoryGrant,
          applyCosmeticItemGrant,
          applyTitleGrant,
          getPlayerCenterTile: () => ({
            tx: Math.max(0, Math.min(WORLD_W - 1, Math.floor((player.x + PLAYER_W * 0.5) / TILE))),
            ty: Math.max(0, Math.min(WORLD_H - 1, Math.floor((player.y + PLAYER_H * 0.5) / TILE)))
          }),
          enableQuestWorldAtTile: (tx, ty) => {
            const ctrl = getQuestWorldController();
            if (!ctrl || typeof ctrl.enableWorld !== "function") return { ok: false, reason: "missing_controller" };
            return ctrl.enableWorld(tx, ty);
          },
          disableQuestWorldMode: () => {
            const ctrl = getQuestWorldController();
            if (!ctrl || typeof ctrl.disableWorld !== "function") return { ok: false, reason: "missing_controller" };
            return ctrl.disableWorld();
          },
          isQuestWorldActive: () => {
            const ctrl = getQuestWorldController();
            return Boolean(ctrl && typeof ctrl.isActive === "function" && ctrl.isActive());
          },
          getCurrentQuestWorldPathId: () => {
            const ctrl = getQuestWorldController();
            if (!ctrl || typeof ctrl.getCurrentQuestPathId !== "function") return "";
            return String(ctrl.getCurrentQuestPathId() || "");
          },
          listQuestWorldPaths: () => {
            const ctrl = getQuestWorldController();
            if (!ctrl || typeof ctrl.listQuestPaths !== "function") return [];
            return ctrl.listQuestPaths();
          },
          setQuestWorldPath: (pathId) => {
            const ctrl = getQuestWorldController();
            if (!ctrl || typeof ctrl.setWorldQuestPath !== "function") return { ok: false, reason: "missing_controller" };
            return ctrl.setWorldQuestPath(pathId);
          },
          addQuestWorldFetchQuest: (pathId, blockRef, amount, title, description, rewardText) => {
            const ctrl = getQuestWorldController();
            if (!ctrl || typeof ctrl.addFetchQuestToPath !== "function") return { ok: false, reason: "missing_controller" };
            return ctrl.addFetchQuestToPath(pathId, blockRef, amount, title, description, rewardText);
          },
          addQuestWorldFetchCosmeticQuest: (pathId, cosmeticId, amount, title, description, rewardText) => {
            const ctrl = getQuestWorldController();
            if (!ctrl || typeof ctrl.addFetchCosmeticQuestToPath !== "function") return { ok: false, reason: "missing_controller" };
            return ctrl.addFetchCosmeticQuestToPath(pathId, cosmeticId, amount, title, description, rewardText);
          },
          parseDurationToMs,
          applyAdminRoleChange,
          handlePrivateMessageCommand: (command, parts) => {
            const ctrl = getMessagesController();
            if (!ctrl || typeof ctrl.handleCommand !== "function") return false;
            return ctrl.handleCommand(command, parts);
          },
          resolveAccountIdByUsernameFast,
          issuePrivateMessage,
          getLastPrivateMessageFrom: () => lastPrivateMessageFrom
        }, rawText);
      }

      // Auth orchestration is delegated to auth.js via a controller.
      async function getAuthDb() {
        if (typeof dbModule.getOrInitAuthDb === "function") {
          return dbModule.getOrInitAuthDb({
            network,
            firebaseRef: (typeof firebase !== "undefined" ? firebase : window.firebase || null),
            firebaseConfig: window.FIREBASE_CONFIG,
            getFirebaseApiKey: window.getFirebaseApiKey
          });
        }
        if (!window.firebase) {
          throw new Error("Firebase SDK not loaded.");
        }
        const firebaseConfig = window.FIREBASE_CONFIG;
        if (firebaseConfig && !firebaseConfig.apiKey && typeof window.getFirebaseApiKey === "function") {
          const fetched = await window.getFirebaseApiKey();
          const apiKey =
            (fetched && typeof fetched === "object" && fetched.ok && typeof fetched.key === "string" && fetched.key) ||
            (typeof fetched === "string" && fetched.trim()) ||
            "";
          if (!apiKey) throw new Error("Failed to fetch Firebase API key at runtime.");
          firebaseConfig.apiKey = apiKey;
        }
        if (!hasFirebaseConfig(firebaseConfig)) {
          throw new Error("Set firebase-config.js first.");
        }
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        if (!network.authDb) {
          network.authDb = firebase.database();
        }
        return network.authDb;
      }

      let authController = null;

      function getAuthController() {
        if (authController) return authController;
        if (typeof authModule.createController !== "function") return null;
        authController = authModule.createController({
          getNetwork: () => network,
          getFirebase: () => (typeof firebase !== "undefined" ? firebase : window.firebase || null),
          getBasePath: () => BASE_PATH,
          getCredentialsInput: () => ({
            username: authUsernameEl.value || "",
            password: authPasswordEl.value || ""
          }),
          normalizeUsername,
          setAuthBusy,
          setAuthStatus,
          onAuthSuccess,
          saveCredentials,
          addClientLog,
          getBanStatus,
          formatRemainingMs,
          onDbReady: (db) => {
            network.db = db;
          },
          getSession: () => ({
            ref: playerSessionRef,
            sessionId: playerSessionId,
            startedAt: playerSessionStartedAt
          }),
          setSession: (ref, sessionId, startedAt) => {
            playerSessionRef = ref || null;
            playerSessionId = sessionId || "";
            playerSessionStartedAt = Math.max(0, Number(startedAt) || 0);
          },
          onChatSessionReset: () => {
            chatMessages.length = 0;
            recentChatFingerprintAt.clear();
            renderChatMessages();
          },
          getPlayerName: () => (playerName || "")
        });
        return authController;
      }

      function releaseAccountSession() {
        clearReachOverrideOnExit(true);
        const ctrl = getAuthController();
        if (ctrl && typeof ctrl.releaseAccountSession === "function") {
          ctrl.releaseAccountSession();
          return;
        }
        if (playerSessionRef) {
          playerSessionRef.remove().catch(() => {});
        }
        playerSessionRef = null;
        playerSessionId = "";
        playerSessionStartedAt = 0;
      }

      async function createAccountAndLogin() {
        const ctrl = getAuthController();
        if (!ctrl || typeof ctrl.createAccountAndLogin !== "function") {
          setAuthStatus("Auth module missing.", true);
          return;
        }
        await ctrl.createAccountAndLogin();
      }

      async function loginWithAccount() {
        const ctrl = getAuthController();
        if (!ctrl || typeof ctrl.loginWithAccount !== "function") {
          setAuthStatus("Auth module missing.", true);
          return;
        }
        await ctrl.loginWithAccount();
      }

      function onAuthSuccess(accountId, username) {
        playerProfileId = accountId;
        playerName = username;
        loadQuestsFromLocal();
        postDailyQuestStatus();
        const gemsCtrl = getGemsController();
        if (gemsCtrl && typeof gemsCtrl.reset === "function") {
          gemsCtrl.reset();
        }
        updateGemsLabel();
        adminSearchQuery = "";
        adminAuditActionFilter = "";
        adminAuditActorFilter = "";
        adminAuditTargetFilter = "";
        adminDashboardTab = "overview";
        adminBackupList = [];
        adminBackupSelectedId = "";
        adminBackupLoading = false;
        if (adminSearchInput) adminSearchInput.value = "";
        if (adminAuditActionFilterEl) adminAuditActionFilterEl.value = "";
        if (adminAuditActorFilterEl) adminAuditActorFilterEl.value = "";
        if (adminAuditTargetFilterEl) adminAuditTargetFilterEl.value = "";
        currentAdminRole = normalizeAdminRole(getConfiguredRoleForUsername(username));
        refreshAdminCapabilities();
        if (antiCheatController && typeof antiCheatController.onSessionStart === "function") {
          antiCheatController.onSessionStart();
        }
        addClientLog("Authenticated as @" + username + ".");
        authScreenEl.classList.add("hidden");
        gameShellEl.classList.remove("hidden");
        suppressNextWorldTransitionTone = true;
        suppressTransitionTonesUntilMs = performance.now() + 8000;
        authPasswordEl.value = "";
        if (!gameBootstrapped) {
          bootstrapGame();
          gameBootstrapped = true;
        } else {
          loadInventoryFromLocal();
          loadProgressionFromLocal();
          if (!loadAchievementsFromLocal()) {
            achievementsState = normalizeAchievementsState({});
          }
          if (!loadQuestsFromLocal()) {
            questsState = normalizeQuestsState({});
          }
          refreshToolbar();
          //postDailyQuestStatus();
          setInWorldState(false);
          updateOnlineCount();
          initFirebaseMultiplayer();
        }
      }

      function getInventoryStorageKey() {
        return "growtopia_inventory_" + (playerProfileId || "guest");
      }

      function getProgressionStorageKey() {
        return "growtopia_progression_" + (playerProfileId || "guest");
      }

      function normalizeProgressionRecord(raw) {
        if (typeof progressionModule.normalizeProgress === "function") {
          return progressionModule.normalizeProgress(raw || {});
        }
        const xp = Math.max(0, Math.floor(Number(raw && raw.xp) || 0));
        return {
          xp,
          level: Math.max(1, Math.floor(Number(raw && raw.level) || 1)),
          xpIntoLevel: Math.max(0, Math.floor(Number(raw && raw.xpIntoLevel) || 0)),
          xpForNext: Math.max(0, Math.floor(Number(raw && raw.xpForNext) || 100))
        };
      }

      function buildProgressionPayload() {
        const normalized = normalizeProgressionRecord({ xp: progressionXp });
        return {
          xp: normalized.xp,
          level: normalized.level,
          xpIntoLevel: normalized.xpIntoLevel,
          xpForNext: normalized.xpForNext
        };
      }

      function ensureLevelTitleUnlocks(level, announce, persistInventory) {
        if (typeof progressionModule.getTitleUnlockIdsForLevel !== "function") return false;
        const unlockIds = progressionModule.getTitleUnlockIdsForLevel(level);
        if (!Array.isArray(unlockIds) || !unlockIds.length) return false;
        const unlockedNames = [];
        for (let i = 0; i < unlockIds.length; i++) {
          const id = String(unlockIds[i] || "").trim();
          if (!id || !TITLE_LOOKUP[id]) continue;
          if ((titleInventory[id] || 0) > 0) continue;
          titleInventory[id] = 1;
          unlockedNames.push(TITLE_LOOKUP[id].name || id);
        }
        if (!unlockedNames.length) return false;
        if (persistInventory) {
          saveInventory();
        }
        refreshToolbar();
        if (announce) {
          postLocalSystemChat("Unlocked title(s): " + unlockedNames.join(", ") + ".");
        }
        return true;
      }

      function applyProgressionFromRecord(record, announceUnlocks) {
        const normalized = normalizeProgressionRecord(record || {});
        progressionXp = normalized.xp;
        progressionLevel = normalized.level;
        progressionXpIntoLevel = normalized.xpIntoLevel;
        progressionXpForNext = normalized.xpForNext;
        ensureLevelTitleUnlocks(progressionLevel, Boolean(announceUnlocks), false);
      }

      function saveProgressionToLocal() {
        saveJsonToLocalStorage(getProgressionStorageKey(), buildProgressionPayload());
      }

      function loadProgressionFromLocal() {
        const parsed = loadJsonFromLocalStorage(getProgressionStorageKey());
        if (!parsed) return false;
        applyProgressionFromRecord(parsed, false);
        return true;
      }

      function flushProgressionSave() {
        progressionSaveTimer = 0;
        saveProgressionToLocal();
        if (!network.enabled || !network.progressRef) return;
        const payload = buildProgressionPayload();
        payload.updatedAt = firebase.database.ServerValue.TIMESTAMP;
        network.progressRef.set(payload).catch(() => {
          setNetworkState("Progression save error", true);
        });
      }

      function scheduleProgressionSave(immediate) {
        if (immediate) {
          if (progressionSaveTimer) { clearTimeout(progressionSaveTimer); progressionSaveTimer = 0; }
          flushProgressionSave();
          return;
        }
        if (!progressionSaveTimer) {
          progressionSaveTimer = setTimeout(flushProgressionSave, 260);
        }
      }

      function awardXp(amount, reason) {
        const add = Math.max(0, Math.floor(Number(amount) || 0));
        if (!add) return;
        const before = buildProgressionPayload();
        let next = null;
        if (typeof progressionModule.gainXp === "function") {
          const result = progressionModule.gainXp({ xp: before.xp }, add);
          next = result && result.after ? result.after : null;
        }
        if (!next) {
          next = normalizeProgressionRecord({ xp: before.xp + add });
        }
        progressionXp = next.xp;
        progressionLevel = next.level;
        progressionXpIntoLevel = next.xpIntoLevel;
        progressionXpForNext = next.xpForNext;
        const leveledUp = progressionLevel > before.level;
        ensureLevelTitleUnlocks(progressionLevel, leveledUp, true);
        scheduleProgressionSave(false);
        if (leveledUp) {
          postLocalSystemChat("Level up! You are now level " + progressionLevel + ".");
          if (reason) {
            postLocalSystemChat("+ " + add + " XP (" + reason + ").");
          }
        }
        syncPlayer(leveledUp);
      }

      function getAchievementsStorageKey() {
        return "growtopia_achievements_" + (playerProfileId || "guest");
      }

      function normalizeAchievementsState(raw) {
        if (typeof achievementsModule.normalizeState === "function") {
          return achievementsModule.normalizeState(raw || {});
        }
        return raw && typeof raw === "object" ? raw : {};
      }

      function buildAchievementsPayload() {
        if (typeof achievementsModule.buildPayload === "function") {
          return achievementsModule.buildPayload(achievementsState || {});
        }
        return normalizeAchievementsState(achievementsState || {});
      }

      function getAchievementsSummary() {
        const state = normalizeAchievementsState(achievementsState || {});
        achievementsState = state;
        if (typeof achievementsModule.summarize === "function") {
          const summary = achievementsModule.summarize(state);
          return {
            completed: Math.max(0, Math.floor(Number(summary && summary.completed) || 0)),
            total: Math.max(0, Math.floor(Number(summary && summary.total) || 0))
          };
        }
        const rows = state.achievements && typeof state.achievements === "object" ? state.achievements : {};
        let completed = 0;
        const ids = Object.keys(rows);
        for (let i = 0; i < ids.length; i++) {
          if (rows[ids[i]] && rows[ids[i]].completed) completed += 1;
        }
        return { completed, total: ids.length };
      }

      function saveAchievementsToLocal() {
        saveJsonToLocalStorage(getAchievementsStorageKey(), buildAchievementsPayload());
      }

      function loadAchievementsFromLocal() {
        const parsed = loadJsonFromLocalStorage(getAchievementsStorageKey());
        if (!parsed) return false;
        achievementsState = normalizeAchievementsState(parsed);
        return true;
      }

      function flushAchievementsSave() {
        achievementsSaveTimer = 0;
        saveAchievementsToLocal();
        if (!network.enabled || !network.achievementsRef) return;
        const payload = buildAchievementsPayload();
        payload.updatedAt = firebase.database.ServerValue.TIMESTAMP;
        network.achievementsRef.set(payload).catch(() => {
          setNetworkState("Achievement save error", true);
        });
      }

      function scheduleAchievementsSave(immediate) {
        if (immediate) {
          if (achievementsSaveTimer) { clearTimeout(achievementsSaveTimer); achievementsSaveTimer = 0; }
          flushAchievementsSave();
          return;
        }
        if (!achievementsSaveTimer) {
          achievementsSaveTimer = setTimeout(flushAchievementsSave, 260);
        }
      }

      function applyAchievementEvent(eventType, payload) {
        if (typeof achievementsModule.applyEvent !== "function") return;
        const result = achievementsModule.applyEvent(achievementsState || {}, eventType, payload || {});
        if (!result || !result.state) return;
        achievementsState = normalizeAchievementsState(result.state);
        if (!result.changed) return;
        if (achievementsModalEl && !achievementsModalEl.classList.contains("hidden")) {
          renderAchievementsMenu();
        }
        const unlocked = Array.isArray(result.unlockedNow) ? result.unlockedNow : [];
        for (let i = 0; i < unlocked.length; i++) {
          const id = String(unlocked[i] || "");
          if (!id) continue;
          const def = typeof achievementsModule.getAchievementById === "function"
            ? achievementsModule.getAchievementById(id)
            : null;
          postLocalSystemChat("Achievement unlocked: " + (def && def.label ? def.label : id) + ".");
        }
        scheduleAchievementsSave(false);
      }

      function addPlayerGems(amount, trackAchievement) {
        const delta = Math.floor(Number(amount) || 0);
        if (!delta) return 0;
        const gemsCtrl = getGemsController();
        if (!gemsCtrl || typeof gemsCtrl.add !== "function" || typeof gemsCtrl.get !== "function") return 0;
        const before = Math.max(0, Math.floor(Number(gemsCtrl.get()) || 0));
        gemsCtrl.add(delta);
        const after = Math.max(0, Math.floor(Number(gemsCtrl.get()) || 0));
        const gained = Math.max(0, after - before);
        updateGemsLabel();
        if (trackAchievement && gained > 0) {
          applyAchievementEvent("gems_earned", { amount: gained });
          applyQuestEvent("gems_earned", { amount: gained });
          applyQuestWorldGameplayEvent("gems_earned", { amount: gained });
        }
        return gained;
      }

      function renderAchievementsMenu() {
        if (!achievementsBodyEl || !achievementsActionsEl || !achievementsTitleEl) return;
        const state = normalizeAchievementsState(achievementsState || {});
        achievementsState = state;
        const catalog = typeof achievementsModule.getCatalog === "function" ? achievementsModule.getCatalog() : [];
        const summary = getAchievementsSummary();
        achievementsTitleEl.textContent = "Achievements (" + summary.completed + "/" + summary.total + ")";
        if (!catalog.length) {
          achievementsBodyEl.innerHTML = "<div class='vending-empty'>No achievements configured.</div>";
          achievementsActionsEl.innerHTML = "<button type='button' data-ach-act='close'>Close</button>";
          return;
        }
        const rows = [];
        for (let i = 0; i < catalog.length; i++) {
          const def = catalog[i];
          const row = state.achievements && state.achievements[def.id] ? state.achievements[def.id] : { progress: 0, completed: false };
          const target = Math.max(1, Math.floor(Number(def.target) || 1));
          const progress = Math.max(0, Math.min(target, Math.floor(Number(row.progress) || 0)));
          const pct = Math.max(0, Math.min(100, (progress / target) * 100));
          rows.push(
            "<div class='vending-section'>" +
              "<div class='vending-stat-grid'>" +
                "<div class='vending-stat'><span>Achievement</span><strong>" + escapeHtml(def.label || def.id) + "</strong></div>" +
                "<div class='vending-stat'><span>Status</span><strong>" + (row.completed ? "Completed" : "In progress") + "</strong></div>" +
                "<div class='vending-stat'><span>Progress</span><strong>" + progress + " / " + target + "</strong></div>" +
              "</div>" +
              "<div style='margin-top:8px;height:8px;border-radius:999px;background:rgba(18,35,52,0.8);border:1px solid rgba(128,182,232,0.35);overflow:hidden;'>" +
                "<div style='height:100%;width:" + pct.toFixed(2) + "%;background:" + (row.completed ? "linear-gradient(90deg,#7cff9b,#5ff1c8)" : "linear-gradient(90deg,#55d6ff,#8fb4ff)") + ";'></div>" +
              "</div>" +
            "</div>"
          );
        }
        achievementsBodyEl.innerHTML = rows.join("");
        achievementsActionsEl.innerHTML = "<button type='button' data-ach-act='close'>Close</button>";
      }

      function closeAchievementsMenu() {
        if (achievementsModalEl) achievementsModalEl.classList.add("hidden");
      }

      function openAchievementsMenu() {
        renderAchievementsMenu();
        if (achievementsModalEl) achievementsModalEl.classList.remove("hidden");
      }

      function renderQuestsMenu() {
        if (!questsBodyEl || !questsActionsEl || !questsTitleEl) return;
        const state = normalizeQuestsState(questsState || {});
        questsState = state;
        const catalog = typeof questsModule.getCatalog === "function" ? questsModule.getCatalog() : [];
        if (!catalog.length) {
          questsTitleEl.textContent = "Quests";
          questsBodyEl.innerHTML = "<div class='vending-empty'>No quests configured.</div>";
          questsActionsEl.innerHTML = "<button type='button' data-quest-act='close'>Close</button>";
          return;
        }

        const daily = [];
        const other = [];
        let doneCount = 0;
        for (let i = 0; i < catalog.length; i++) {
          const def = catalog[i];
          const group = String(def.category || "daily") === "other" ? other : daily;
          group.push(def);
          const rowSource = String(def.category || "daily") === "other"
            ? (state.globalQuests && state.globalQuests[def.id])
            : (state.quests && state.quests[def.id]);
          if (rowSource && rowSource.completed) doneCount++;
        }
        questsTitleEl.textContent = "Quests (" + doneCount + "/" + catalog.length + ")";

        const renderGroup = (title, defs, groupKey) => {
          if (!defs.length) return "";
          const rows = [];
          for (let i = 0; i < defs.length; i++) {
            const def = defs[i];
            const rowSource = groupKey === "other"
              ? (state.globalQuests && state.globalQuests[def.id])
              : (state.quests && state.quests[def.id]);
            const row = rowSource || { progress: 0, completed: false, rewarded: false };
            const target = Math.max(1, Math.floor(Number(def.target) || 1));
            const progress = Math.max(0, Math.min(target, Math.floor(Number(row.progress) || 0)));
            const pct = Math.max(0, Math.min(100, (progress / target) * 100));
            const status = row.rewarded ? "Rewarded" : (row.completed ? "Completed" : "In progress");
            const rewardText = describeQuestRewards(def.rewards || {});
            rows.push(
              "<div class='vending-section'>" +
                "<div class='vending-stat-grid'>" +
                  "<div class='vending-stat'><span>Quest</span><strong>" + escapeHtml(def.label || def.id) + "</strong></div>" +
                  "<div class='vending-stat'><span>Status</span><strong>" + escapeHtml(status) + "</strong></div>" +
                  "<div class='vending-stat'><span>Progress</span><strong>" + progress + " / " + target + "</strong></div>" +
                "</div>" +
                "<div style='margin-top:8px;height:8px;border-radius:999px;background:rgba(18,35,52,0.8);border:1px solid rgba(128,182,232,0.35);overflow:hidden;'>" +
                  "<div style='height:100%;width:" + pct.toFixed(2) + "%;background:" + (row.completed ? "linear-gradient(90deg,#7cff9b,#5ff1c8)" : "linear-gradient(90deg,#55d6ff,#8fb4ff)") + ";'></div>" +
                "</div>" +
                (rewardText ? ("<div class='sign-hint' style='margin-top:8px;'>Reward: " + escapeHtml(rewardText) + "</div>") : "") +
              "</div>"
            );
          }
          return "<div class='vending-section'><strong>" + escapeHtml(title) + "</strong></div>" + rows.join("");
        };

        questsBodyEl.innerHTML = renderGroup("Daily Quests", daily, "daily") + renderGroup("Other Quests", other, "other");
        questsActionsEl.innerHTML = "<button type='button' data-quest-act='close'>Close</button>";
      }

      function closeQuestsMenu() {
        if (questsModalEl) questsModalEl.classList.add("hidden");
      }

      function openQuestsMenu() {
        renderQuestsMenu();
        if (questsModalEl) questsModalEl.classList.remove("hidden");
      }

      function renderTitlesMenu() {
        if (!titlesBodyEl || !titlesActionsEl || !titlesTitleEl) return;
        const unlocked = [];
        for (const title of TITLE_CATALOG) {
          if ((titleInventory[title.id] || 0) <= 0) continue;
          unlocked.push(title);
        }
        titlesTitleEl.textContent = "Titles (" + unlocked.length + "/" + TITLE_CATALOG.length + ")";
        if (!unlocked.length) {
          titlesBodyEl.innerHTML = "<div class='vending-empty'>No titles unlocked yet.</div>";
          titlesActionsEl.innerHTML = "<button type='button' data-title-act='close'>Close</button>";
          return;
        }
        const rows = [];
        for (let i = 0; i < unlocked.length; i++) {
          const title = unlocked[i];
          const equipped = equippedTitleId === title.id;
          const previewName = formatTitleWithUsername(title.name || title.id, playerName || "Player");
          const style = normalizeTitleStyle(title.style);
          const previewView = buildTitleTextView(style, title.color || "#8fb4ff");
          const previewClass = ["title-menu-preview"].concat(previewView.classes).join(" ");
          const previewStyleText = previewView.inlineStyles.join(";");
          rows.push(
            "<div class='vending-section'>" +
              "<div class='vending-stat-grid'>" +
                "<div class='vending-stat'><span>Title</span><strong class='" + previewClass + "'" + (previewStyleText ? (" style='" + escapeHtml(previewStyleText) + "'") : "") + ">" + escapeHtml(previewName) + "</strong></div>" +
                //"<div class='vending-stat'><span>Status</span><strong>" + (equipped ? "Equipped" : "Unlocked") + "</strong></div>" +
              "</div>" +
              "<div class='vending-actions' style='justify-content:flex-start;'>" +
                "<button type='button' data-title-equip='" + escapeHtml(title.id) + "'>" + (equipped ? "Unequip" : "Equip") + "</button>" +
              "</div>" +
            "</div>"
          );
        }
        titlesBodyEl.innerHTML = rows.join("");
        titlesActionsEl.innerHTML = "<button type='button' data-title-act='close'>Close</button>";
      }

      function closeTitlesMenu() {
        if (titlesModalEl) titlesModalEl.classList.add("hidden");
      }

      function openTitlesMenu() {
        renderTitlesMenu();
        if (titlesModalEl) titlesModalEl.classList.remove("hidden");
      }

      function getQuestsStorageKey() {
        return "growtopia_quests_" + (playerProfileId || "guest");
      }

      function normalizeQuestsState(raw) {
        if (typeof questsModule.normalizeState === "function") {
          return questsModule.normalizeState(raw || {}, Date.now());
        }
        return raw && typeof raw === "object" ? raw : {};
      }

      function buildQuestsPayload() {
        if (typeof questsModule.buildPayload === "function") {
          return questsModule.buildPayload(questsState || {});
        }
        return normalizeQuestsState(questsState || {});
      }

      function saveQuestsToLocal() {
        saveJsonToLocalStorage(getQuestsStorageKey(), buildQuestsPayload());
      }

      function loadQuestsFromLocal() {
        const parsed = loadJsonFromLocalStorage(getQuestsStorageKey());
        if (!parsed) return false;
        questsState = normalizeQuestsState(parsed);
        return true;
      }

      function normalizeQuestRewardToolId(value) {
        const raw = String(value || "").trim().toLowerCase();
        if (!raw) return "";
        if (raw === TOOL_FIST || raw === "fist" || raw === "tool_fist") return TOOL_FIST;
        if (raw === TOOL_WRENCH || raw === "wrench" || raw === "tool_wrench") return TOOL_WRENCH;
        return "";
      }

      function resolveQuestRewardGrants(rewards) {
        const row = rewards && typeof rewards === "object" ? rewards : {};
        const out = [];
        const cosmeticSet = new Set((COSMETIC_ITEMS || []).map((it) => String(it && it.id || "").trim()).filter(Boolean));
        const addGrant = (entry) => {
          const g = entry && typeof entry === "object" ? entry : {};
          const rawType = String(g.type || g.kind || "").trim().toLowerCase();
          let type = "";
          if (rawType === "gems" || rawType === "gem") type = "gems";
          else if (rawType === "block" || rawType === "item_block" || rawType === "seed" || rawType === "farmable") type = "block";
          else if (rawType === "cosmetic" || rawType === "item" || rawType === "wearable") type = "cosmetic";
          else if (rawType === "title") type = "title";
          else if (rawType === "tool") type = "tool";
          if (!type) return;

          const amount = type === "gems"
            ? Math.max(0, Math.floor(Number(g.amount || g.count) || 0))
            : Math.max(1, Math.floor(Number(g.amount || g.count) || 1));
          if (!amount) return;

          if (type === "gems") {
            out.push({ type: "gems", amount });
            return;
          }
          if (type === "block") {
            let blockId = Math.max(0, Math.floor(Number(g.blockId) || 0));
            const blockKey = String(g.blockKey || g.block || g.id || g.item || "").trim().toLowerCase();
            if (!blockId && blockKey) blockId = parseBlockRef(blockKey);
            if (!blockId) return;
            out.push({ type: "block", blockId, amount });
            return;
          }
          if (type === "cosmetic") {
            const id = String(g.id || g.cosmeticId || g.itemId || "").trim();
            if (!id || !cosmeticSet.has(id)) return;
            out.push({ type: "cosmetic", id, amount });
            return;
          }
          if (type === "title") {
            const id = String(g.id || g.titleId || "").trim();
            if (!id || !TITLE_LOOKUP[id]) return;
            out.push({ type: "title", id, amount });
            return;
          }
          if (type === "tool") {
            const toolId = normalizeQuestRewardToolId(g.id || g.toolId || g.tool);
            if (!toolId) return;
            out.push({ type: "tool", id: toolId, amount });
          }
        };

        if (Array.isArray(row.grants)) {
          for (let i = 0; i < row.grants.length; i++) addGrant(row.grants[i]);
        }

        if (row.gems !== undefined) addGrant({ type: "gems", amount: row.gems });
        if (row.blockId !== undefined || row.blockKey !== undefined || row.block !== undefined || row.blockAmount !== undefined) {
          addGrant({ type: "block", blockId: row.blockId, blockKey: row.blockKey || row.block, amount: row.blockAmount || row.amount });
        }
        if (row.cosmeticId !== undefined || row.itemId !== undefined || row.cosmeticAmount !== undefined) {
          addGrant({ type: "cosmetic", id: row.cosmeticId || row.itemId, amount: row.cosmeticAmount || row.amount });
        }
        if (row.titleId !== undefined || row.title !== undefined || row.titleAmount !== undefined) {
          addGrant({ type: "title", id: row.titleId || row.title, amount: row.titleAmount || row.amount });
        }
        if (row.toolId !== undefined || row.tool !== undefined || row.toolAmount !== undefined) {
          addGrant({ type: "tool", id: row.toolId || row.tool, amount: row.toolAmount || row.amount });
        }

        const blocksMap = row.blocks && typeof row.blocks === "object" ? row.blocks : {};
        Object.keys(blocksMap).forEach((ref) => addGrant({ type: "block", blockKey: ref, amount: blocksMap[ref] }));
        const cosmeticsMap = row.cosmetics && typeof row.cosmetics === "object" ? row.cosmetics : {};
        Object.keys(cosmeticsMap).forEach((id) => addGrant({ type: "cosmetic", id, amount: cosmeticsMap[id] }));
        const titlesMap = row.titles && typeof row.titles === "object" ? row.titles : {};
        Object.keys(titlesMap).forEach((id) => addGrant({ type: "title", id, amount: titlesMap[id] }));
        const toolsMap = row.tools && typeof row.tools === "object" ? row.tools : {};
        Object.keys(toolsMap).forEach((id) => addGrant({ type: "tool", id, amount: toolsMap[id] }));

        const itemsMap = row.items && typeof row.items === "object" ? row.items : {};
        Object.keys(itemsMap).forEach((refRaw) => {
          const amount = itemsMap[refRaw];
          const ref = String(refRaw || "").trim();
          const idx = ref.indexOf(":");
          if (idx > 0) {
            const kind = ref.slice(0, idx).trim().toLowerCase();
            const value = ref.slice(idx + 1).trim();
            if (kind === "block") addGrant({ type: "block", blockKey: value, amount });
            else if (kind === "cosmetic") addGrant({ type: "cosmetic", id: value, amount });
            else if (kind === "title") addGrant({ type: "title", id: value, amount });
            else if (kind === "tool") addGrant({ type: "tool", id: value, amount });
            return;
          }
          const asBlockId = parseBlockRef(ref);
          if (asBlockId > 0) {
            addGrant({ type: "block", blockId: asBlockId, amount });
            return;
          }
          if (cosmeticSet.has(ref)) {
            addGrant({ type: "cosmetic", id: ref, amount });
            return;
          }
          if (TITLE_LOOKUP[ref]) {
            addGrant({ type: "title", id: ref, amount });
            return;
          }
          addGrant({ type: "tool", id: ref, amount });
        });

        const merged = {};
        for (let i = 0; i < out.length; i++) {
          const g = out[i];
          const id = g.type === "block" ? String(g.blockId || "")
            : String(g.id || "");
          const key = g.type + ":" + id;
          if (!merged[key]) {
            merged[key] = { ...g };
          } else {
            merged[key].amount = Math.max(0, Math.floor(Number(merged[key].amount) || 0)) + Math.max(0, Math.floor(Number(g.amount) || 0));
          }
        }
        return Object.values(merged).filter((g) => Math.max(0, Math.floor(Number(g.amount) || 0)) > 0);
      }

      function formatQuestRewardGrant(grant) {
        const g = grant && typeof grant === "object" ? grant : {};
        if (g.type === "gems") {
          return Math.max(0, Math.floor(Number(g.amount) || 0)) + " gems";
        }
        if (g.type === "block") {
          const blockId = Math.max(0, Math.floor(Number(g.blockId) || 0));
          const amount = Math.max(1, Math.floor(Number(g.amount) || 1));
          const def = blockDefs[blockId];
          const label = def && def.name ? def.name : ("Block " + blockId);
          return amount + "x " + label;
        }
        if (g.type === "cosmetic") {
          const amount = Math.max(1, Math.floor(Number(g.amount) || 1));
          const id = String(g.id || "").trim();
          const item = COSMETIC_ITEMS.find((it) => it && it.id === id);
          return amount + "x " + (item && item.name ? item.name : id);
        }
        if (g.type === "title") {
          const amount = Math.max(1, Math.floor(Number(g.amount) || 1));
          const id = String(g.id || "").trim();
          const titleName = TITLE_LOOKUP[id] && TITLE_LOOKUP[id].name ? TITLE_LOOKUP[id].name : id;
          return amount + "x title " + titleName;
        }
        if (g.type === "tool") {
          const amount = Math.max(1, Math.floor(Number(g.amount) || 1));
          const id = String(g.id || "").trim();
          const toolLabel = id === TOOL_WRENCH ? "Wrench" : (id === TOOL_FIST ? "Fist" : id);
          return amount + "x " + toolLabel;
        }
        return "";
      }

      function describeQuestRewards(rewards) {
        const grants = resolveQuestRewardGrants(rewards);
        const parts = [];
        for (let i = 0; i < grants.length; i++) {
          const text = formatQuestRewardGrant(grants[i]);
          if (text) parts.push(text);
        }
        return parts.join(", ");
      }

      function grantQuestRewards(questDef) {
        const def = questDef && typeof questDef === "object" ? questDef : null;
        if (!def) return false;
        const rewards = def.rewards && typeof def.rewards === "object" ? def.rewards : {};
        const grants = resolveQuestRewardGrants(rewards);
        let changed = false;
        let inventoryChanged = false;
        let needsSync = false;
        const tx = Math.max(0, Math.min(WORLD_W - 1, Math.floor((player.x + PLAYER_W * 0.5) / TILE)));
        const ty = Math.max(0, Math.min(WORLD_H - 1, Math.floor((player.y + PLAYER_H * 0.5) / TILE)));

        for (let i = 0; i < grants.length; i++) {
          const grant = grants[i];
          if (!grant || !grant.type) continue;
          if (grant.type === "gems") {
            const gained = addPlayerGems(Math.max(0, Math.floor(Number(grant.amount) || 0)), true);
            if (gained > 0) changed = true;
            continue;
          }
          if (grant.type === "block") {
            const blockId = Math.max(0, Math.floor(Number(grant.blockId) || 0));
            const amount = Math.max(1, Math.floor(Number(grant.amount) || 1));
            if (!blockId) continue;
            const granted = grantGachaBlockReward(blockId, amount, tx, ty);
            if (granted > 0) {
              changed = true;
              inventoryChanged = true;
            }
            continue;
          }
          if (grant.type === "cosmetic") {
            const id = String(grant.id || "").trim();
            const amount = Math.max(1, Math.floor(Number(grant.amount) || 1));
            if (!id) continue;
            const granted = grantGachaCosmeticReward(id, amount);
            if (granted > 0) {
              changed = true;
              inventoryChanged = true;
              needsSync = true;
            }
            continue;
          }
          if (grant.type === "title") {
            const id = String(grant.id || "").trim();
            const amount = Math.max(1, Math.floor(Number(grant.amount) || 1));
            if (!id) continue;
            const granted = grantGachaTitleReward(id, amount);
            if (granted > 0) {
              changed = true;
              inventoryChanged = true;
              needsSync = true;
            }
            continue;
          }
          if (grant.type === "tool") {
            const toolId = normalizeQuestRewardToolId(grant.id || grant.toolId || "");
            const amount = Math.max(1, Math.floor(Number(grant.amount) || 1));
            if (!toolId) continue;
            const spawned = spawnWorldDropEntry({ type: "tool", toolId }, amount, tx * TILE, ty * TILE);
            if (spawned) {
              changed = true;
            }
          }
        }

        if (inventoryChanged) {
          saveInventory();
          refreshToolbar();
        }
        if (needsSync) {
          syncPlayer(true);
        }
        const categoryLabel = String(def.category || "daily") === "other" ? "Quest" : "Daily quest";
        const rewardText = describeQuestRewards(rewards);
        if (rewardText) {
          postLocalSystemChat(categoryLabel + " complete: " + (def.label || def.id) + " -> " + rewardText + ".");
        } else {
          postLocalSystemChat(categoryLabel + " complete: " + (def.label || def.id) + ".");
        }
        return changed;
      }

      function flushQuestsSave() {
        questsSaveTimer = 0;
        saveQuestsToLocal();
        if (!network.enabled || !network.questsRef) return;
        const payload = buildQuestsPayload();
        payload.updatedAt = firebase.database.ServerValue.TIMESTAMP;
        network.questsRef.set(payload).catch(() => {
          setNetworkState("Quest save error", true);
        });
      }

      function scheduleQuestsSave(immediate) {
        if (immediate) {
          if (questsSaveTimer) { clearTimeout(questsSaveTimer); questsSaveTimer = 0; }
          flushQuestsSave();
          return;
        }
        if (!questsSaveTimer) {
          questsSaveTimer = setTimeout(flushQuestsSave, 260);
        }
      }

      function applyQuestEvent(eventType, payload) {
        if (typeof questsModule.applyEvent !== "function") return;
        const result = questsModule.applyEvent(questsState || {}, eventType, payload || {});
        if (!result || !result.state) return;
        questsState = normalizeQuestsState(result.state);
        if (!result.changed) return;
        const completed = Array.isArray(result.completedNow) ? result.completedNow : [];
        for (let i = 0; i < completed.length; i++) {
          const questId = String(completed[i] || "");
          if (!questId) continue;
          const row = questsState && questsState.quests ? questsState.quests[questId] : null;
          if (!row || row.rewarded) continue;
          const def = typeof questsModule.getQuestById === "function"
            ? questsModule.getQuestById(questId)
            : null;
          grantQuestRewards(def);
          if (typeof questsModule.markRewarded === "function") {
            const marked = questsModule.markRewarded(questsState, questId);
            if (marked && marked.state) questsState = normalizeQuestsState(marked.state);
          } else {
            row.rewarded = true;
          }
        }
        scheduleQuestsSave(false);
      }

      function applyQuestWorldGameplayEvent(eventType, payload) {
        const ctrl = getQuestWorldController();
        if (!ctrl || typeof ctrl.onGameplayEvent !== "function") return;
        ctrl.onGameplayEvent(eventType, payload || {});
      }

      function postDailyQuestStatus() {
        const state = normalizeQuestsState(questsState || {});
        questsState = state;
        const catalog = typeof questsModule.getCatalog === "function" ? questsModule.getCatalog() : [];
        if (!Array.isArray(catalog) || !catalog.length) return;
        const pending = [];
        for (let i = 0; i < catalog.length; i++) {
          const def = catalog[i];
          if (String(def.category || "daily") !== "daily") continue;
          const row = state.quests && state.quests[def.id] ? state.quests[def.id] : null;
          if (!row || row.rewarded) continue;
          pending.push((def.label || def.id) + " (" + Math.max(0, Number(row.progress) || 0) + "/" + Math.max(1, Number(def.target) || 1) + ")");
        }
        if (!pending.length) {
          postLocalSystemChat("Daily quests completed for today.");
          return;
        }
        postLocalSystemChat("Daily quests: " + pending.slice(0, 3).join(" | "));
      }

      function clampInventoryCount(value) {
        const n = Number(value);
        const safe = Number.isFinite(n) ? Math.floor(n) : 0;
        return Math.max(0, Math.min(INVENTORY_ITEM_LIMIT, safe));
      }

      function clampTitleUnlocked(value) {
        return Number(value) > 0 ? 1 : 0;
      }

      function getLockCurrencyConfig() {
        return LOCK_CURRENCY_DEFS.slice();
      }

      function getAutoLockDefsAsc() {
        return LOCK_CURRENCY_DEFS.filter((row) => row.autoConvert !== false).slice().sort((a, b) => a.value - b.value);
      }

      function getNonAutoLockDefsDesc() {
        return LOCK_CURRENCY_DEFS.filter((row) => row.autoConvert === false).slice().sort((a, b) => b.value - a.value);
      }

      function getAutoLockValue(inv) {
        const source = inv && typeof inv === "object" ? inv : inventory;
        let total = 0;
        for (const row of getAutoLockDefsAsc()) {
          total += Math.max(0, Math.floor(Number(source[row.id]) || 0)) * row.value;
        }
        return Math.max(0, Math.floor(total));
      }

      function getNonAutoLockValue(inv) {
        const source = inv && typeof inv === "object" ? inv : inventory;
        let total = 0;
        for (const row of getNonAutoLockDefsDesc()) {
          total += Math.max(0, Math.floor(Number(source[row.id]) || 0)) * row.value;
        }
        return Math.max(0, Math.floor(total));
      }

      function getTotalLockValue(inv) {
        const source = inv && typeof inv === "object" ? inv : inventory;
        let total = 0;
        for (const row of LOCK_CURRENCY_DEFS) {
          const count = Math.max(0, Math.floor(Number(source[row.id]) || 0));
          total += count * row.value;
        }
        return Math.max(0, Math.floor(total));
      }

      function setAutoLockValue(inv, totalValue) {
        const source = inv && typeof inv === "object" ? inv : inventory;
        let remaining = Math.max(0, Math.floor(Number(totalValue) || 0));
        const defs = getAutoLockDefsAsc().slice().sort((a, b) => b.value - a.value);
        if (!defs.length) return;
        for (let i = 0; i < defs.length; i++) {
          const row = defs[i];
          if (!row || row.id <= 0) continue;
          const count = row.value > 0 ? Math.floor(remaining / row.value) : 0;
          const next = clampInventoryCount(count);
          source[row.id] = next;
          remaining -= next * row.value;
        }
        if (remaining > 0 && defs.length) {
          const base = defs[defs.length - 1];
          source[base.id] = clampInventoryCount(Math.max(0, Math.floor(Number(source[base.id]) || 0)) + remaining);
        }
      }

      function setNonAutoLockValue(inv, totalValue) {
        const source = inv && typeof inv === "object" ? inv : inventory;
        let remaining = Math.max(0, Math.floor(Number(totalValue) || 0));
        const defs = getNonAutoLockDefsDesc();
        if (!defs.length) return;
        for (let i = 0; i < defs.length; i++) {
          const row = defs[i];
          const count = row.value > 0 ? Math.floor(remaining / row.value) : 0;
          const next = clampInventoryCount(count);
          source[row.id] = next;
          remaining -= next * row.value;
        }
      }

      function distributeLockValueToInventory(inv, totalValue) {
        const source = inv && typeof inv === "object" ? inv : inventory;
        const targetTotal = Math.max(0, Math.floor(Number(totalValue) || 0));
        const nonAutoTotal = getNonAutoLockValue(source);
        const autoTarget = Math.max(0, targetTotal - nonAutoTotal);
        setAutoLockValue(source, autoTarget);
      }

      function spendLockValue(inv, amount) {
        const source = inv && typeof inv === "object" ? inv : inventory;
        const cost = Math.max(0, Math.floor(Number(amount) || 0));
        if (!cost) return true;
        const autoTotal = getAutoLockValue(source);
        const nonAutoTotal = getNonAutoLockValue(source);
        if ((autoTotal + nonAutoTotal) < cost) return false;
        if (autoTotal >= cost) {
          setAutoLockValue(source, autoTotal - cost);
          return true;
        }
        const remainingCost = cost - autoTotal;
        setAutoLockValue(source, 0);
        setNonAutoLockValue(source, Math.max(0, nonAutoTotal - remainingCost));
        return true;
      }

      function addLockValue(inv, amount) {
        const source = inv && typeof inv === "object" ? inv : inventory;
        const add = Math.max(0, Math.floor(Number(amount) || 0));
        if (!add) return;
        const autoTotal = getAutoLockValue(source);
        setAutoLockValue(source, autoTotal + add);
      }

      function getNextHigherAutoLockDef(lockId) {
        const defs = LOCK_CURRENCY_DEFS.filter((row) => row.autoConvert !== false).slice().sort((a, b) => a.value - b.value);
        const idx = defs.findIndex((row) => row.id === lockId);
        if (idx < 0 || idx >= defs.length - 1) return null;
        return defs[idx + 1];
      }

      function getNextLowerAutoLockDef(lockId) {
        const defs = LOCK_CURRENCY_DEFS.filter((row) => row.autoConvert !== false).slice().sort((a, b) => a.value - b.value);
        const idx = defs.findIndex((row) => row.id === lockId);
        if (idx <= 0) return null;
        return defs[idx - 1];
      }

      function convertLockByDoubleClick(lockId) {
        const safeId = Math.max(0, Math.floor(Number(lockId) || 0));
        const selfDef = LOCK_CURRENCY_DEFS.find((row) => row.id === safeId);
        if (!selfDef || selfDef.autoConvert === false) return;
        const higher = getNextHigherAutoLockDef(safeId);
        if (higher) {
          const current = Math.max(0, Math.floor(Number(inventory[safeId]) || 0));
          const needed = Math.max(1, Math.floor(higher.value / selfDef.value));
          const currentHigher = Math.max(0, Math.floor(Number(inventory[higher.id]) || 0));
          if (current >= needed && currentHigher < INVENTORY_ITEM_LIMIT) {
            inventory[safeId] = current - needed;
            inventory[higher.id] = currentHigher + 1;
            manualLockConvertHoldUntilMs = performance.now() + 1800;
            saveInventory();
            refreshToolbar(true);
            postLocalSystemChat("Converted " + needed + " " + (blockDefs[safeId] && blockDefs[safeId].name || "locks") + " into 1 " + (blockDefs[higher.id] && blockDefs[higher.id].name || "lock") + ".");
            return;
          }
        }
        const lower = getNextLowerAutoLockDef(safeId);
        if (!lower) return;
        const current = Math.max(0, Math.floor(Number(inventory[safeId]) || 0));
        if (current <= 0) return;
        const ratio = Math.max(1, Math.floor(selfDef.value / lower.value));
        const lowerNow = Math.max(0, Math.floor(Number(inventory[lower.id]) || 0));
        if ((lowerNow + ratio) > INVENTORY_ITEM_LIMIT) {
          postLocalSystemChat("Cannot convert: " + (blockDefs[lower.id] && blockDefs[lower.id].name || "target lock") + " would exceed " + INVENTORY_ITEM_LIMIT + ".");
          return;
        }
        inventory[safeId] = current - 1;
        inventory[lower.id] = lowerNow + ratio;
        manualLockConvertHoldUntilMs = performance.now() + 1800;
        saveInventory();
        refreshToolbar(true);
        postLocalSystemChat("Converted 1 " + (blockDefs[safeId] && blockDefs[safeId].name || "lock") + " into " + ratio + " " + (blockDefs[lower.id] && blockDefs[lower.id].name || "locks") + ".");
      }

      function autoConvertWorldLocksInInventory(force) {
        if (!force && !PASSIVE_LOCK_AUTOCONVERT) return false;
        if (performance.now() < manualLockConvertHoldUntilMs) return false;
        const before = getTotalLockValue(inventory);
        distributeLockValueToInventory(inventory, before);
        const after = getTotalLockValue(inventory);
        return before !== after;
      }

      function clampLocalInventoryAll() {
        autoConvertWorldLocksInInventory();
        for (const id of INVENTORY_IDS) {
          inventory[id] = clampInventoryCount(inventory[id]);
        }
        if (typeof cosmeticsModule.clampInventory === "function") {
          cosmeticsModule.clampInventory(cosmeticInventory, COSMETIC_ITEMS, clampInventoryCount);
        } else {
          for (const item of COSMETIC_ITEMS) {
            cosmeticInventory[item.id] = clampInventoryCount(cosmeticInventory[item.id]);
          }
        }
        for (const title of TITLE_CATALOG) {
          titleInventory[title.id] = clampTitleUnlocked(titleInventory[title.id]);
        }
      }

      function ensureDefaultTitleUnlocked() {
        if (!TITLE_DEFAULT_ID) return;
        if ((titleInventory[TITLE_DEFAULT_ID] || 0) <= 0) {
          titleInventory[TITLE_DEFAULT_ID] = 1;
        }
      }

      function getTitleDef(titleId) {
        const id = String(titleId || "").trim();
        return id ? (TITLE_LOOKUP[id] || null) : null;
      }

      function formatTitleWithUsername(titleText, username) {
        const template = String(titleText || "");
        if (!template) return "";
        const uname = String(username || "Player").slice(0, 16);
        return template.replace(/\{username\}/gi, uname);
      }

      function normalizeTitleStyle(styleRaw) {
        const style = styleRaw && typeof styleRaw === "object" ? styleRaw : {};
        const baseColor = sanitizeTitleColorValue(style.color || style.glowColor || "#8fb4ff", "#8fb4ff");
        return {
          bold: Boolean(style.bold),
          glow: Boolean(style.glow),
          rainbow: Boolean(style.rainbow),
          glowColor: sanitizeTitleColorValue(style.glowColor || "", ""),
          gradient: Boolean(style.gradient),
          gradientShift: style.gradientShift !== false,
          gradientAngle: normalizeTitleGradientAngle(style.gradientAngle),
          gradientColors: normalizeTitleGradientColors(style.gradientColors || style.colors, baseColor)
        };
      }

      function sanitizeTitleColorValue(raw, fallback) {
        const value = String(raw || "").trim().slice(0, 40);
        if (!value) return String(fallback || "");
        const HEX = /^#[0-9a-fA-F]{3,8}$/;
        const RGB = /^rgba?\(\s*[\d.\s,%-]+\)$/i;
        const HSL = /^hsla?\(\s*[\d.\s,%-]+\)$/i;
        const NAMED = /^[a-zA-Z]{3,20}$/;
        if (HEX.test(value) || RGB.test(value) || HSL.test(value) || NAMED.test(value)) {
          return value;
        }
        return String(fallback || "");
      }

      function normalizeTitleGradientAngle(raw) {
        const angleNum = Number(raw);
        if (!Number.isFinite(angleNum)) return 90;
        return Math.max(-360, Math.min(360, Math.round(angleNum * 100) / 100));
      }

      function normalizeTitleGradientColors(raw, fallbackColor) {
        const fallbackA = sanitizeTitleColorValue(fallbackColor, "#8fb4ff");
        const fallbackB = "#f7fbff";
        let source = [];
        if (Array.isArray(raw)) {
          source = raw;
        } else if (typeof raw === "string") {
          source = raw.split(/[|,]/g);
        }
        const out = [];
        for (let i = 0; i < source.length; i++) {
          const color = sanitizeTitleColorValue(source[i], "");
          if (!color) continue;
          out.push(color);
          if (out.length >= 6) break;
        }
        if (!out.length) {
          return [fallbackA, fallbackB];
        }
        if (out.length === 1) {
          out.push(fallbackB);
        }
        return out;
      }

      function buildTitleTextView(styleInput, baseColorInput) {
        const baseColor = sanitizeTitleColorValue(baseColorInput, "#8fb4ff");
        const styleSource = styleInput && typeof styleInput === "object" ? styleInput : {};
        const style = normalizeTitleStyle(Object.assign({ color: baseColor }, styleSource));
        const classes = [];
        const inlineStyles = [];
        if (style.rainbow) {
          classes.push("chat-title-rainbow");
        } else if (style.gradient) {
          classes.push("chat-title-gradient");
          if (style.gradientShift) {
            classes.push("chat-title-gradient-animated");
          }
          const gradient = style.gradientColors.join(",");
          inlineStyles.push("--title-gradient-angle:" + style.gradientAngle + "deg");
          inlineStyles.push("--title-gradient-colors:" + gradient);
        } else {
          inlineStyles.push("color:" + baseColor);
        }
        if (style.bold) {
          inlineStyles.push("font-weight:800");
        }
        if (style.glow) {
          const glowFallback = style.gradient ? style.gradientColors[0] : baseColor;
          const glowColor = sanitizeTitleColorValue(style.glowColor || "", glowFallback);
          inlineStyles.push("text-shadow:0 0 10px " + glowColor + ",0 0 16px " + glowColor);
        }
        return { classes, inlineStyles };
      }

      function getTitleStyleById(titleId) {
        const def = getTitleDef(titleId);
        return normalizeTitleStyle(def && def.style);
      }

      function shouldShowNameAlongsideTitle(titleText, username) {
        const safeTitle = String(titleText || "").trim().toLowerCase();
        const safeUser = String(username || "").trim().toLowerCase();
        if (!safeTitle || !safeUser) return true;
        return !safeTitle.includes(safeUser);
      }

      function getRainbowTitleColor(nowMs) {
        const t = (Number(nowMs) || performance.now()) * 0.12;
        return "hsl(" + (Math.floor(t) % 360) + " 95% 66%)";
      }

      function getEquippedTitleDef() {
        const def = getTitleDef(equippedTitleId);
        if (!def) return null;
        if ((titleInventory[def.id] || 0) <= 0) return null;
        return def;
      }

      function getEquippedTitlePayload() {
        const def = getEquippedTitleDef();
        if (!def) return { id: "", name: "", color: "", style: normalizeTitleStyle(null) };
        return {
          id: def.id,
          name: formatTitleWithUsername(def.name, playerName),
          color: def.color || "#8fb4ff",
          style: normalizeTitleStyle(def.style)
        };
      }

      function applyInventoryFromRecord(record) {
        for (const id of INVENTORY_IDS) {
          const keyName = getBlockKeyById(id);
          const directValue = Number(record && record[id]);
          const keyValue = keyName ? Number(record && record[keyName]) : NaN;
          const value = Number.isFinite(directValue) ? directValue : keyValue;
          inventory[id] = clampInventoryCount(value);
        }
        autoConvertWorldLocksInInventory();
        if (typeof cosmeticsModule.applyFromRecord === "function") {
          cosmeticsModule.applyFromRecord({
            record,
            cosmeticInventory,
            equippedCosmetics,
            items: COSMETIC_ITEMS,
            lookup: COSMETIC_LOOKUP,
            slots: COSMETIC_SLOTS,
            clampCount: clampInventoryCount
          });
        }
        const titleRecord = record && record.titleItems || {};
        for (const title of TITLE_CATALOG) {
          const nestedValue = Number(titleRecord[title.id]);
          const topLevelValue = Number(record && record[title.id]);
          let finalValue = 0;
          if (Number.isFinite(nestedValue)) finalValue = clampTitleUnlocked(nestedValue);
          if (!finalValue && Number.isFinite(topLevelValue)) finalValue = clampTitleUnlocked(topLevelValue);
          if (!finalValue && title.defaultUnlocked) finalValue = 1;
          titleInventory[title.id] = clampTitleUnlocked(finalValue);
        }
        ensureDefaultTitleUnlocked();
        const equippedTitleRaw = String(record && record.equippedTitle || "");
        equippedTitleId = equippedTitleRaw && TITLE_LOOKUP[equippedTitleRaw] && (titleInventory[equippedTitleRaw] || 0) > 0
          ? equippedTitleRaw
          : "";
        if (!equippedTitleId && TITLE_DEFAULT_ID && (titleInventory[TITLE_DEFAULT_ID] || 0) > 0) {
          equippedTitleId = TITLE_DEFAULT_ID;
        }
        const gemsCtrl = getGemsController();
        if (gemsCtrl && typeof gemsCtrl.readFromRecord === "function") {
          gemsCtrl.readFromRecord(record || {});
        }
        updateGemsLabel();
      }

      function normalizeRemoteEquippedCosmetics(raw) {
        if (typeof cosmeticsModule.normalizeRemoteEquipped === "function") {
          return cosmeticsModule.normalizeRemoteEquipped(raw, COSMETIC_SLOTS, COSMETIC_LOOKUP);
        }
        return { shirts: "", pants: "", shoes: "", hats: "", wings: "", swords: "" };
      }

      function buildInventoryPayload() {
        clampLocalInventoryAll();
        const payload = {};
        for (const id of INVENTORY_IDS) {
          payload[id] = clampInventoryCount(inventory[id]);
        }
        if (typeof cosmeticsModule.writePayload === "function") {
          cosmeticsModule.writePayload(payload, cosmeticInventory, equippedCosmetics, COSMETIC_ITEMS, COSMETIC_SLOTS, clampInventoryCount);
        } else {
          const itemPayload = {};
          for (const item of COSMETIC_ITEMS) {
            itemPayload[item.id] = clampInventoryCount(cosmeticInventory[item.id]);
          }
          payload.cosmeticItems = itemPayload;
          payload.equippedCosmetics = {};
          for (const slot of COSMETIC_SLOTS) {
            payload.equippedCosmetics[slot] = equippedCosmetics[slot] || "";
          }
        }
        const titlePayload = {};
        for (const title of TITLE_CATALOG) {
          titlePayload[title.id] = clampTitleUnlocked(titleInventory[title.id]);
        }
        payload.titleItems = titlePayload;
        payload.equippedTitle = getEquippedTitlePayload().id || "";
        const gemsCtrl = getGemsController();
        if (gemsCtrl && typeof gemsCtrl.writeToPayload === "function") {
          gemsCtrl.writeToPayload(payload);
        } else {
          payload.gems = 0;
        }
        return payload;
      }

      function updateGemsLabel() {
        if (!gemsCountEl) return;
        const gemsCtrl = getGemsController();
        if (gemsCtrl && typeof gemsCtrl.formatLabel === "function") {
          gemsCountEl.textContent = gemsCtrl.formatLabel();
        } else {
          gemsCountEl.textContent = "0 gems";
        }
        const shopCtrl = getShopController();
        if (shopCtrl && typeof shopCtrl.isOpen === "function" && shopCtrl.isOpen() && typeof shopCtrl.render === "function") {
          shopCtrl.render();
        }
      }

      function loadInventoryFromLocal() {
        const parsed = loadJsonFromLocalStorage(getInventoryStorageKey());
        if (!parsed) return false;
        applyInventoryFromRecord(parsed);
        return true;
      }

      function saveInventoryToLocal() {
        saveJsonToLocalStorage(getInventoryStorageKey(), buildInventoryPayload());
      }

      function saveInventory(immediate = true) {
        if (immediate) {
          if (inventorySaveTimer) { clearTimeout(inventorySaveTimer); inventorySaveTimer = 0; }
          clampLocalInventoryAll();
          saveInventoryToLocal();
          if (network.enabled && network.inventoryRef) {
            network.inventoryRef.set(buildInventoryPayload()).catch(() => {});
          }
          return;
        }
        if (!inventorySaveTimer) {
          inventorySaveTimer = setTimeout(() => {
            inventorySaveTimer = 0;
            saveInventory(true);
          }, 1000);
        }
      }

      function schedulePickupInventoryFlush() {
        if (pickupInventoryFlushTimer) return;
        pickupInventoryFlushTimer = window.setTimeout(() => {
          pickupInventoryFlushTimer = 0;
          playSfxEvent("collect", 0.5, "success", "collect");
          saveInventory(true);
          refreshToolbar();
        }, 70);
      }

      function reloadMyInventoryFromServer() {
        if (!network.enabled || !network.inventoryRef) return;
        network.inventoryRef.once("value").then((snapshot) => {
          if (!snapshot.exists()) return;
          applyInventoryFromRecord(snapshot.val() || {});
          saveInventoryToLocal();
          refreshToolbar();
        }).catch(() => {});
      }

      function getInitialWorldId() {
        return "default-world";
      }

      function normalizeWorldId(value) {
        return (value || "")
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9_-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^[-_]+|[-_]+$/g, "")
          .slice(0, 24);
      }

      function makeWorld(worldId) {
        const hashFn = typeof blocksModule.hashWorldSeed === "function"
          ? blocksModule.hashWorldSeed
          : (typeof worldModule.hashWorldSeed === "function" ? worldModule.hashWorldSeed.bind(worldModule) : null);
        if (typeof worldModule.createWorld === "function") {
          return worldModule.createWorld(
            worldId,
            WORLD_W,
            WORLD_H,
            hashFn,
            SPAWN_TILE_X,
            SPAWN_TILE_Y,
            SPAWN_DOOR_ID,
            SPAWN_BASE_ID
          );
        }
        const w = Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill(0));
        for (let x = 0; x < WORLD_W; x++) {
          if (WORLD_H - 2 >= 0) w[WORLD_H - 2][x] = SPAWN_BASE_ID;
          if (WORLD_H - 1 >= 0) w[WORLD_H - 1][x] = SPAWN_BASE_ID;
        }
        if (typeof worldModule.applySpawnStructureToGrid === "function") {
          worldModule.applySpawnStructureToGrid(w, WORLD_W, WORLD_H, SPAWN_TILE_X, SPAWN_TILE_Y, SPAWN_DOOR_ID, SPAWN_BASE_ID);
        }
        return w;
      }

      function getSpawnStructureTiles() {
        const safeTx = Math.max(0, Math.min(WORLD_W - 1, Math.floor(Number(spawnTileX))));
        const safeTy = Math.max(0, Math.min(WORLD_H - 2, Math.floor(Number(spawnTileY))));
        return {
          door: { tx: safeTx, ty: safeTy, id: SPAWN_DOOR_ID },
          base: { tx: safeTx, ty: safeTy + 1, id: SPAWN_BASE_ID }
        };
      }

      function setSpawnStructureTile(tx, ty) {
        const rawTx = Number(tx);
        const rawTy = Number(ty);
        const nextTx = Number.isFinite(rawTx) ? Math.floor(rawTx) : SPAWN_TILE_X;
        const nextTy = Number.isFinite(rawTy) ? Math.floor(rawTy) : SPAWN_TILE_Y;
        const safeTx = Math.max(0, Math.min(WORLD_W - 1, nextTx));
        const safeTy = Math.max(0, Math.min(WORLD_H - 2, nextTy));
        spawnTileX = safeTx;
        spawnTileY = safeTy;
      }

      function resetSpawnStructureTile() {
        setSpawnStructureTile(SPAWN_TILE_X, SPAWN_TILE_Y);
      }

      function refreshSpawnStructureFromWorld() {
        for (let ty = 0; ty < WORLD_H; ty++) {
          const row = world[ty];
          if (!Array.isArray(row)) continue;
          for (let tx = 0; tx < WORLD_W; tx++) {
            if (row[tx] === SPAWN_DOOR_ID) {
              setSpawnStructureTile(tx, ty);
              return;
            }
          }
        }
        resetSpawnStructureTile();
      }

      function applySpawnStructureFromBlockMap(blockMap) {
        const data = blockMap && typeof blockMap === "object" ? blockMap : {};
        for (const [key, rawId] of Object.entries(data)) {
          if (Math.floor(Number(rawId)) !== SPAWN_DOOR_ID) continue;
          const parts = String(key).split("_");
          if (parts.length !== 2) continue;
          const tx = Math.floor(Number(parts[0]));
          const ty = Math.floor(Number(parts[1]));
          if (!Number.isInteger(tx) || !Number.isInteger(ty)) continue;
          if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) continue;
          setSpawnStructureTile(tx, ty);
          return true;
        }
        return false;
      }

      function applySpawnStructureToGrid(grid) {
        if (!Array.isArray(grid) || !grid.length) return;
        const tiles = getSpawnStructureTiles();
        if (typeof worldModule.applySpawnStructureToGrid === "function") {
          worldModule.applySpawnStructureToGrid(grid, WORLD_W, WORLD_H, tiles.door.tx, tiles.door.ty, SPAWN_DOOR_ID, SPAWN_BASE_ID);
          return;
        }
        grid[tiles.door.ty][tiles.door.tx] = tiles.door.id;
        grid[tiles.base.ty][tiles.base.tx] = tiles.base.id;
      }

      function getProtectedTileRequiredId(tx, ty) {
        if (ty >= WORLD_H - 2 && tx >= 0 && tx < WORLD_W) return SPAWN_BASE_ID;
        const tiles = getSpawnStructureTiles();
        if (tx === tiles.door.tx && ty === tiles.door.ty) return tiles.door.id;
        if (tx === tiles.base.tx && ty === tiles.base.ty) return tiles.base.id;
        return 0;
      }

      function enforceSpawnStructureInWorldData() {
        applySpawnStructureToGrid(world);
      }

      function enforceSpawnStructureInDatabase() {
        if (!network.enabled || !network.blocksRef || !network.db) return;
        const tiles = getSpawnStructureTiles();
        const updates = {};
        updates[tiles.door.tx + "_" + tiles.door.ty] = tiles.door.id;
        updates[tiles.base.tx + "_" + tiles.base.ty] = tiles.base.id;
        network.blocksRef.update(updates).catch(() => {});
      }

      function buildSpawnStructureCleanupUpdates(blockMap, keepDoorTx, keepDoorTy) {
        const safeDoorTx = Math.max(0, Math.min(WORLD_W - 1, Math.floor(Number(keepDoorTx) || 0)));
        const safeDoorTy = Math.max(0, Math.min(WORLD_H - 2, Math.floor(Number(keepDoorTy) || 0)));
        const keepDoorKey = safeDoorTx + "_" + safeDoorTy;
        const keepBaseKey = safeDoorTx + "_" + (safeDoorTy + 1);
        const updates = {};
        const data = blockMap && typeof blockMap === "object" ? blockMap : {};
        Object.keys(data).forEach((key) => {
          const id = Math.floor(Number(data[key]));
          if (!Number.isInteger(id)) return;
          if (id === SPAWN_DOOR_ID) {
            if (key !== keepDoorKey) {
              updates[key] = null;
            }
            return;
          }
          if (id !== SPAWN_BASE_ID || key === keepBaseKey) return;
          const tile = parseTileKey(key);
          if (!tile) return;
          if (tile.ty < WORLD_H - 2) {
            updates[key] = null;
          }
        });
        updates[keepDoorKey] = SPAWN_DOOR_ID;
        updates[keepBaseKey] = SPAWN_BASE_ID;
        return updates;
      }

      function cleanupSpawnStructureInWorldData() {
        const tiles = getSpawnStructureTiles();
        for (let ty = 0; ty < WORLD_H; ty++) {
          const row = world[ty];
          if (!Array.isArray(row)) continue;
          for (let tx = 0; tx < WORLD_W; tx++) {
            const id = row[tx];
            if (id === SPAWN_DOOR_ID && (tx !== tiles.door.tx || ty !== tiles.door.ty)) {
              row[tx] = 0;
              clearTileDamage(tx, ty);
              continue;
            }
            if (id === SPAWN_BASE_ID && ty < WORLD_H - 2 && (tx !== tiles.base.tx || ty !== tiles.base.ty)) {
              row[tx] = 0;
              clearTileDamage(tx, ty);
            }
          }
        }
        world[tiles.door.ty][tiles.door.tx] = SPAWN_DOOR_ID;
        world[tiles.base.ty][tiles.base.tx] = SPAWN_BASE_ID;
      }

      function findSafeDoorSpawnPosition() {
        const tiles = getSpawnStructureTiles();
        const doorTx = tiles.door.tx;
        const doorTy = tiles.door.ty;
        const baseX = doorTx * TILE + Math.floor((TILE - PLAYER_W) / 2);
        const baseY = doorTy * TILE + (TILE - PLAYER_H);
        const dxOffsets = [0, -1, 1, -2, 2, -3, 3];
        for (let dy = 0; dy <= 8; dy++) {
          for (let i = 0; i < dxOffsets.length; i++) {
            const tx = doorTx + dxOffsets[i];
            const ty = doorTy - dy;
            if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) continue;
            const x = tx * TILE + Math.floor((TILE - PLAYER_W) / 2);
            const y = ty * TILE + (TILE - PLAYER_H);
            if (!rectCollides(x, y, PLAYER_W, PLAYER_H)) {
              return { x, y };
            }
          }
        }
        return { x: baseX, y: baseY };
      }

      function ensurePlayerSafeSpawn(forceToDoor) {
        if (!inWorld && !forceToDoor) return;
        if (performance.now() < suppressSpawnSafetyUntilMs) return;
        const force = Boolean(forceToDoor);
        if (!force && !rectCollides(player.x, player.y, PLAYER_W, PLAYER_H)) {
          return;
        }
        const safe = findSafeDoorSpawnPosition();
        player.x = clampTeleport(safe.x, 0, WORLD_W * TILE - PLAYER_W - 2);
        player.y = clampTeleport(safe.y, 0, WORLD_H * TILE - PLAYER_H - 2);
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;
      }

      function resetForWorldChange() {
        const remoteSyncCtrl = getRemotePlayerSyncController();
        if (remoteSyncCtrl && typeof remoteSyncCtrl.reset === "function") {
          remoteSyncCtrl.reset();
        } else {
          remotePlayers.clear();
        }
        clearWorldDrops();
        if (particleController && typeof particleController.clear === "function") {
          particleController.clear();
        }
        clearAllTileDamage();
        const ctrl = getVendingController();
        if (ctrl && typeof ctrl.clearAll === "function") ctrl.clearAll();
        const gambleCtrl = getGambleController();
        if (gambleCtrl && typeof gambleCtrl.clearAll === "function") gambleCtrl.clearAll();
        const donationCtrl = getDonationController();
        if (donationCtrl && typeof donationCtrl.clearAll === "function") donationCtrl.clearAll();
        const chestCtrl = getChestController();
        if (chestCtrl && typeof chestCtrl.clearAll === "function") chestCtrl.clearAll();
        const signCtrl = getSignController();
        if (signCtrl && typeof signCtrl.clearAll === "function") signCtrl.clearAll();
        displayItemsByTile.clear();
        mannequinOutfitsByTile.clear();
        doorAccessByTile.clear();
        antiGravityByTile.clear();
        clearTreePlants();
        cameraConfigsByTile.clear();
        cameraLogsByTile.clear();
        closeSignModal();
        closeWorldLockModal();
        closeOwnerTaxModal();
        closeDoorModal();
        closeCameraModal();
        closeWeatherModal();
        closeGambleModal();
        closeDonationModal();
        closeChestModal();
        closeSplicingModal();
        {
          const questCtrl = getQuestWorldController();
          if (questCtrl && typeof questCtrl.closeModal === "function") {
            questCtrl.closeModal();
          }
        }
        closeTradeMenuModal();
        closeTradeRequestModal();
        closeFriendModals();
        updateOnlineCount();
        world = makeWorld(currentWorldId);
        setLocalWorldWeather(localWeatherByWorld.get(currentWorldId) || null);
        if (blockSyncer && typeof blockSyncer.reset === "function") {
          blockSyncer.reset();
        }
        const spawn = getSpawnStructureTiles().door;
        player.x = TILE * spawn.tx;
        player.y = TILE * spawn.ty;
        player.vx = 0;
        player.vy = 0;
        ensurePlayerSafeSpawn(true);
        if (playerSyncController && typeof playerSyncController.reset === "function") {
          playerSyncController.reset();
        }
        airJumpsUsed = 0;
        wasInWaterLastFrame = false;
        lastWaterSplashAtMs = -9999;
      }

      function setInWorldState(nextValue) {
        inWorld = Boolean(nextValue);
        menuScreenEl.classList.toggle("hidden", inWorld);
        if (!inWorld || isMobileUi) {
          isMobileInventoryOpen = false;
        }
        syncMobileOverlayVisibility();
        syncMobilePlayModeClass();
        updateMobileControlsUi();
        applyToolbarPosition();
        chatToggleBtn.classList.toggle("hidden", !inWorld);
        adminToggleBtn.classList.toggle("hidden", !canUseAdminPanel);
        syncQuickAdminButtonVisibility();
        //respawnBtn.classList.toggle("hidden", !inWorld);
        exitWorldBtn.classList.toggle("hidden", !inWorld);
        syncQuickMenuHudVisibility();
        if (inWorld) {
          if (isMobileUi) {
            mobilePlayModeEnabled = true;
          }
          hasRenderedMenuWorldList = false;
          setChatOpen(false);
        } else {
          if (particleController && typeof particleController.clear === "function") {
            particleController.clear();
          }
          wasInWaterLastFrame = false;
          stopInventoryDrag();
          setChatOpen(false);
          closeAchievementsMenu();
          closeTitlesMenu();
          closeVendingModal();
          closeDonationModal();
          closeChestModal();
          closeGambleModal();
          closeSignModal();
          closeWorldLockModal();
          closeOwnerTaxModal();
          closeDoorModal();
          closeCameraModal();
          closeWeatherModal();
          closeSplicingModal();
          closeTradeMenuModal();
          closeTradeRequestModal();
          closeFriendModals();
          if (!hasRenderedMenuWorldList) {
            refreshWorldButtons(null, true);
            hasRenderedMenuWorldList = true;
          }
        }
        if (!canUseAdminPanel) {
          setAdminOpen(false);
        }
        refreshCanvasWrapVisibility();
        setCurrentWorldUI();
        updateOnlineCount();
        // Recompute canvas/panel layout after visibility changes.
        requestAnimationFrame(() => {
          resizeCanvas();
          requestAnimationFrame(() => {
            resizeCanvas();
          });
        });
      }

      function openShopMenuFromUi() {
        const ctrl = getShopController();
        if (!ctrl || typeof ctrl.openModal !== "function") return;
        playSfxEvent("ui", 0.38, "input", "shop ui");
        ctrl.openModal();
      }

      function openFriendsMenuFromUi() {
        const ctrl = getFriendsController();
        if (!ctrl || typeof ctrl.openFriends !== "function") return;
        playSfxEvent("ui", 0.36, "input", "friends ui");
        ctrl.openFriends();
      }

      function setQuickMenuMode(nextMode) {
        const prevMode = gtQuickMenuMode;
        const allowed = inWorld ? String(nextMode || "").trim().toLowerCase() : "";
        const mode = (allowed === "main" || allowed === "social") ? allowed : "";
        gtQuickMenuMode = mode;
        if (gtMainMenuPopupEl) gtMainMenuPopupEl.classList.toggle("hidden", mode !== "main");
        if (gtSocialMenuPopupEl) gtSocialMenuPopupEl.classList.toggle("hidden", mode !== "social");
        if (gtMainMenuBtnEl) gtMainMenuBtnEl.classList.toggle("active", mode === "main");
        if (gtSocialMenuBtnEl) gtSocialMenuBtnEl.classList.toggle("active", mode === "social");
      }

      function toggleQuickMenuMode(mode) {
        const next = gtQuickMenuMode === mode ? "" : mode;
        setQuickMenuMode(next);
      }

      function syncQuickAdminButtonVisibility() {
        if (!gtMenuAdminBtnEl) return;
        const visible = inWorld && canUseAdminPanel;
        gtMenuAdminBtnEl.classList.toggle("hidden", !visible);
      }

      function syncQuickMenuHudVisibility() {
        if (!gtQuickActionsEl) return;
        gtQuickActionsEl.classList.toggle("hidden", !inWorld);
        syncQuickAdminButtonVisibility();
        if (!inWorld) {
          setQuickMenuMode("");
        }
      }

      function formatChatTimestamp(timestamp) {
        if (typeof chatModule.formatChatTimestamp === "function") {
          return chatModule.formatChatTimestamp(timestamp);
        }
        if (!timestamp || typeof timestamp !== "number") return "";
        const d = new Date(timestamp);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return hh + ":" + mm;
      }

      function renderChatMessages() {
        chatMessagesEl.innerHTML = "";
        const ordered = chatMessages
          .slice(-CHAT_MESSAGES_LIMIT)
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        for (const message of ordered) {
          const row = document.createElement("div");
          row.className = "chat-row";
          const time = formatChatTimestamp(message.createdAt);
          const name = (message.name || "Guest").slice(0, 16);
          const sessionTag = String(message.sessionId || "").slice(-4);
          const sessionLabel = sessionTag ? " #" + sessionTag : "";
          const titleId = String(message.titleId || "").trim();
          const fallbackTitle = getTitleDef(titleId);
          const rawTitleName = String(message.titleName || (fallbackTitle && fallbackTitle.name) || "").trim();
          const titleName = formatTitleWithUsername(rawTitleName, name).slice(0, 24);
          const titleColor = String(message.titleColor || (fallbackTitle && fallbackTitle.color) || "#8fb4ff").trim().slice(0, 24);
          const titleStyle = normalizeTitleStyle(
            (message.titleStyle && typeof message.titleStyle === "object")
              ? message.titleStyle
              : (fallbackTitle && fallbackTitle.style)
          );
          const showNameLabel = shouldShowNameAlongsideTitle(titleName, name);
          const prefix = document.createElement("span");
          prefix.textContent = (time ? "[" + time + "] " : "");
          row.appendChild(prefix);
          if (titleName) {
            const titleEl = document.createElement("span");
            titleEl.className = "chat-title";
            const titleView = buildTitleTextView(titleStyle, titleColor || "#8fb4ff");
            for (let i = 0; i < titleView.classes.length; i++) {
              titleEl.classList.add(titleView.classes[i]);
            }
            if (titleView.inlineStyles.length) {
              titleEl.style.cssText = titleView.inlineStyles.join(";");
            }
            titleEl.textContent = titleName + " ";
            row.appendChild(titleEl);
          }
          if (showNameLabel) {
            const nameEl = document.createElement("span");
            nameEl.textContent = name + sessionLabel + ": ";
            row.appendChild(nameEl);
          } else {
            const sepEl = document.createElement("span");
            sepEl.textContent = ": ";
            row.appendChild(sepEl);
          }
          const textEl = document.createElement("span");
          textEl.textContent = (message.text || "");
          row.appendChild(textEl);
          chatMessagesEl.appendChild(row);
        }
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      }

      function ensureChatPanelParent() {
        if (!chatPanelEl || !canvasWrapEl) return;
        if (chatPanelEl.parentElement !== canvasWrapEl) {
          canvasWrapEl.appendChild(chatPanelEl);
        }
      }

      function ensureToolbarPanelParent() {
        if (!toolbarEl || !canvasWrapEl) return;
        if (toolbarEl.parentElement !== canvasWrapEl) {
          canvasWrapEl.appendChild(toolbarEl);
        }
      }

      function ensureChatDragHandle() {
        if (!chatPanelEl) return null;
        if (chatDragHandleEl && chatDragHandleEl.isConnected) return chatDragHandleEl;
        let handle = document.getElementById("chatDragHandle");
        if (!handle) {
          handle = document.createElement("div");
          handle.id = "chatDragHandle";
          handle.className = "chat-drag-handle";
          handle.textContent = "CHAT";
          chatPanelEl.insertBefore(handle, chatPanelEl.firstChild || null);
        } else if (handle.parentElement !== chatPanelEl) {
          chatPanelEl.insertBefore(handle, chatPanelEl.firstChild || null);
        }
        chatDragHandleEl = handle;
        return chatDragHandleEl;
      }

      function loadChatPanelTopPref() {
        let storedTop = CHAT_PANEL_TOP_DEFAULT;
        try {
          const raw = Number(localStorage.getItem(CHAT_PANEL_POS_KEY));
          if (Number.isFinite(raw)) {
            storedTop = raw;
          }
        } catch (error) {
          // ignore localStorage failures
        }
        chatPanelTopPx = storedTop;
      }

      function getChatPanelTopBounds() {
        const wrapHeight = Math.max(120, Math.floor(
          (canvasWrapEl && canvasWrapEl.clientHeight) || (canvas && canvas.height) || 0
        ));
        const panelHeight = Math.max(120, Math.floor((chatPanelEl && chatPanelEl.offsetHeight) || 190));
        const minTop = CHAT_PANEL_TOP_MIN;
        const maxTop = Math.max(minTop, wrapHeight - panelHeight - CHAT_PANEL_BOTTOM_GAP);
        return { minTop, maxTop };
      }

      function applyChatPanelTop(nextTopPx, persist) {
        if (!chatPanelEl) return;
        const bounds = getChatPanelTopBounds();
        const topPx = Math.max(
          bounds.minTop,
          Math.min(bounds.maxTop, Math.round(Number(nextTopPx) || CHAT_PANEL_TOP_DEFAULT))
        );
        chatPanelTopPx = topPx;
        chatPanelEl.style.top = topPx + "px";
        if (persist) {
          try {
            localStorage.setItem(CHAT_PANEL_POS_KEY, String(topPx));
          } catch (error) {
            // ignore localStorage failures
          }
        }
      }

      function setChatDragActive(nextValue) {
        chatDragActive = Boolean(nextValue);
        if (chatPanelEl) {
          chatPanelEl.classList.toggle("chat-panel-dragging", chatDragActive);
        }
      }

      function onChatDragMove(event) {
        if (!chatDragActive) return;
        const clientY = Number(event && event.clientY);
        if (!Number.isFinite(clientY)) return;
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        const nextTop = chatDragStartTopPx + (clientY - chatDragStartY);
        applyChatPanelTop(nextTop, false);
      }

      function onChatDragEnd() {
        if (!chatDragActive) return;
        if (chatDragHandleEl && chatDragPointerId >= 0 && typeof chatDragHandleEl.releasePointerCapture === "function") {
          try {
            chatDragHandleEl.releasePointerCapture(chatDragPointerId);
          } catch (error) {
            // ignore release errors
          }
        }
        chatDragPointerId = -1;
        setChatDragActive(false);
        applyChatPanelTop(chatPanelTopPx, true);
      }

      function bindChatPanelDrag() {
        ensureChatPanelParent();
        const handle = ensureChatDragHandle();
        if (!handle) return;
        handle.style.touchAction = "none";
        eventsModule.on(handle, "pointerdown", (event) => {
          if (!inWorld || !chatPanelEl) return;
          const clientY = Number(event && event.clientY);
          if (!Number.isFinite(clientY)) return;
          if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
          }
          if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
          }
          chatDragPointerId = Number.isFinite(event.pointerId) ? event.pointerId : -1;
          if (chatDragPointerId >= 0 && typeof handle.setPointerCapture === "function") {
            try {
              handle.setPointerCapture(chatDragPointerId);
            } catch (error) {
              // ignore capture errors
            }
          }
          chatDragStartY = clientY;
          chatDragStartTopPx = chatPanelTopPx;
          setChatDragActive(true);
        });
        eventsModule.on(window, "pointermove", onChatDragMove, { passive: false });
        eventsModule.on(window, "pointerup", onChatDragEnd);
        eventsModule.on(window, "pointercancel", onChatDragEnd);
      }

      function loadInventoryPanelOffsetPref() {
        let storedOffset = 0;
        try {
          const raw = Number(localStorage.getItem(INVENTORY_PANEL_OFFSET_KEY));
          if (Number.isFinite(raw) && raw >= 0) {
            storedOffset = raw;
          }
        } catch (error) {
          // ignore localStorage failures
        }
        inventoryPanelOffsetPx = storedOffset;
      }

      function getInventoryPanelOffsetBounds() {
        const panelHeight = Math.max(120, Math.floor((toolbarEl && toolbarEl.offsetHeight) || 260));
        const minOffset = 0;
        const maxOffset = Math.max(0, panelHeight - INVENTORY_PANEL_PEEK_PX);
        return { minOffset, maxOffset };
      }

      function applyInventoryPanelOffset(nextOffsetPx, persist) {
        if (!toolbarEl) return;
        const rawOffset = Math.max(0, Math.round(Number(nextOffsetPx) || 0));
        if (toolbarEl.classList.contains("hidden")) {
          inventoryPanelOffsetPx = rawOffset;
          toolbarEl.style.bottom = INVENTORY_PANEL_BOTTOM_GAP + "px";
          toolbarEl.style.transform = "translateY(" + rawOffset + "px)";
          if (persist) {
            try {
              localStorage.setItem(INVENTORY_PANEL_OFFSET_KEY, String(rawOffset));
            } catch (error) {
              // ignore localStorage failures
            }
          }
          return;
        }
        const bounds = getInventoryPanelOffsetBounds();
        const offset = Math.max(bounds.minOffset, Math.min(bounds.maxOffset, rawOffset));
        inventoryPanelOffsetPx = offset;
        toolbarEl.style.bottom = INVENTORY_PANEL_BOTTOM_GAP + "px";
        toolbarEl.style.transform = "translateY(" + offset + "px)";
        if (persist) {
          try {
            localStorage.setItem(INVENTORY_PANEL_OFFSET_KEY, String(offset));
          } catch (error) {
            // ignore localStorage failures
          }
        }
      }

      function setInventoryPanelDragActive(nextValue) {
        inventoryPanelDragActive = Boolean(nextValue);
        if (toolbarEl) {
          toolbarEl.classList.toggle("inventory-panel-dragging", inventoryPanelDragActive);
        }
      }

      function onInventoryPanelDragMove(event) {
        if (!inventoryPanelDragActive) return;
        const clientY = Number(event && event.clientY);
        if (!Number.isFinite(clientY)) return;
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        const nextOffset = inventoryPanelDragStartOffsetPx + (clientY - inventoryPanelDragStartY);
        applyInventoryPanelOffset(nextOffset, false);
      }

      function onInventoryPanelDragEnd() {
        if (!inventoryPanelDragActive) return;
        if (
          inventoryPanelHandleEl &&
          inventoryPanelDragPointerId >= 0 &&
          typeof inventoryPanelHandleEl.releasePointerCapture === "function"
        ) {
          try {
            inventoryPanelHandleEl.releasePointerCapture(inventoryPanelDragPointerId);
          } catch (error) {
            // ignore release errors
          }
        }
        inventoryPanelDragPointerId = -1;
        setInventoryPanelDragActive(false);
        applyInventoryPanelOffset(inventoryPanelOffsetPx, true);
      }

      function ensureInventoryPanelHandle() {
        if (!toolbarEl) return null;
        let handle = toolbarEl.querySelector("#inventoryPanelHandle");
        if (!(handle instanceof HTMLElement)) {
          handle = document.createElement("div");
          handle.id = "inventoryPanelHandle";
          handle.className = "inventory-panel-handle";
          handle.textContent = "INVENTORY";
          toolbarEl.insertBefore(handle, toolbarEl.firstChild || null);
        }
        if (String(handle.dataset.dragBound || "") !== "1") {
          eventsModule.on(handle, "pointerdown", (event) => {
            if (!inWorld || !toolbarEl || toolbarEl.classList.contains("hidden")) return;
            const clientY = Number(event && event.clientY);
            if (!Number.isFinite(clientY)) return;
            if (event && typeof event.preventDefault === "function") {
              event.preventDefault();
            }
            if (event && typeof event.stopPropagation === "function") {
              event.stopPropagation();
            }
            inventoryPanelDragPointerId = Number.isFinite(event.pointerId) ? event.pointerId : -1;
            if (inventoryPanelDragPointerId >= 0 && typeof handle.setPointerCapture === "function") {
              try {
                handle.setPointerCapture(inventoryPanelDragPointerId);
              } catch (error) {
                // ignore capture errors
              }
            }
            inventoryPanelDragStartY = clientY;
            inventoryPanelDragStartOffsetPx = inventoryPanelOffsetPx;
            setInventoryPanelDragActive(true);
          });
          handle.dataset.dragBound = "1";
        }
        inventoryPanelHandleEl = handle;
        return inventoryPanelHandleEl;
      }

      function bindInventoryPanelDrag() {
        if (inventoryPanelDragBound) return;
        inventoryPanelDragBound = true;
        ensureToolbarPanelParent();
        ensureInventoryPanelHandle();
        eventsModule.on(window, "pointermove", onInventoryPanelDragMove, { passive: false });
        eventsModule.on(window, "pointerup", onInventoryPanelDragEnd);
        eventsModule.on(window, "pointercancel", onInventoryPanelDragEnd);
      }

      function syncMobileOverlayVisibility() {
        const hasPassiveInventoryModalOpen = (() => {
          if (!isMobileUi || !inWorld) return false;
          const ids = ["vendingModal", "donationModal", "chestModal", "tradePanelModal"];
          for (let i = 0; i < ids.length; i++) {
            const el = document.getElementById(ids[i]);
            if (!el || el.classList.contains("hidden")) continue;
            if (el.classList.contains("inventory-passive") || el.classList.contains("trade-modal-passive")) {
              return true;
            }
          }
          return false;
        })();
        document.body.classList.toggle("mobile-passive-dnd", Boolean(hasPassiveInventoryModalOpen));
        const showChatPanel = inWorld && !gameShellEl.classList.contains("hidden") && (!isMobileUi || isChatOpen);
        chatPanelEl.classList.toggle("hidden", !showChatPanel);
        if (showChatPanel) {
          ensureChatPanelParent();
          ensureChatDragHandle();
          applyChatPanelTop(chatPanelTopPx, false);
        }
        const showToolbar = inWorld && (!isMobileUi || isMobileInventoryOpen || hasPassiveInventoryModalOpen);
        toolbarEl.classList.toggle("hidden", !showToolbar);
        if (showToolbar) {
          ensureToolbarPanelParent();
          ensureInventoryPanelHandle();
          applyInventoryPanelOffset(inventoryPanelOffsetPx, false);
        }
        mobileControlsEl.classList.toggle("hidden", !(inWorld && isMobileUi));
      }

      function syncMobilePlayModeClass() {
        document.body.classList.toggle("mobile-world-active", Boolean(inWorld && isMobileUi && mobilePlayModeEnabled));
      }

      function setChatOpen(open) {
        isChatOpen = Boolean(open) && inWorld;
        if (isMobileUi && isChatOpen) {
          isMobileInventoryOpen = false;
        }
        syncMobileOverlayVisibility();
        syncMobilePlayModeClass();
        updateMobileControlsUi();
        if (chatInputRowEl) {
          chatInputRowEl.classList.toggle("hidden", !isChatOpen);
        }
        if (isChatOpen) {
          keys["KeyA"] = false;
          keys["KeyD"] = false;
          keys["ArrowLeft"] = false;
          keys["ArrowRight"] = false;
          keys["KeyW"] = false;
          keys["Space"] = false;
          keys["ArrowUp"] = false;
          touchControls.left = false;
          touchControls.right = false;
          touchControls.jump = false;
          chatInputEl.focus();
        } else {
          chatInputEl.blur();
        }
      }

      function renderLogsMessages() {
        if (!logsMessagesEl) return;
        logsMessagesEl.innerHTML = "";
        for (const message of logsMessages) {
          const row = document.createElement("div");
          row.className = "logs-row";
          const time = formatChatTimestamp(message.createdAt);
          row.textContent = (time ? "[" + time + "] " : "") + (message.text || "");
          logsMessagesEl.appendChild(row);
        }
        logsMessagesEl.scrollTop = logsMessagesEl.scrollHeight;
      }

      function setLogsOpen(open) {
        isLogsOpen = Boolean(open) && false;
      }

      function refreshCanvasWrapVisibility() {
        const showWrap = inWorld;
        canvasWrapEl.classList.toggle("hidden", !showWrap);
        canvas.classList.toggle("hidden", !inWorld);
      }

      function addLogMessage(message) {
        if (!message || !message.text) return;
        logsMessages.push(message);
        if (logsMessages.length > 120) {
          logsMessages.shift();
        }
        renderLogsMessages();
      }

      function clearLogsView() {
        logsMessages.length = 0;
        renderLogsMessages();
      }

      function clearLogsData() {
        if (hasAdminPermission("clear_logs")) {
          proxyAdminRemove("/" + BASE_PATH + "/account-logs").then((out) => {
            if (!out || !out.ok) return;
            clearLogsView();
            logAdminAudit("Admin(panel) cleared account logs.");
            pushAdminAuditEntry("clear_logs", "", "");
          }).catch(() => {});
          return;
        }
        clearLogsView();
      }

      function addClientLog(text, accountIdOverride, usernameOverride, sessionIdOverride) {
        const targetAccountId = accountIdOverride || playerProfileId;
        if (!targetAccountId) return;
        const db = network.db;
        if (!db) {
          return;
        }
        const logRef = db.ref(BASE_PATH + "/account-logs/" + targetAccountId);
        logRef.push({
          text: text.toString().slice(0, 180),
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          sessionId: sessionIdOverride !== undefined ? sessionIdOverride : (playerSessionId || ""),
          sourcePlayerId: playerId,
          username: (usernameOverride || playerName || "").toString().slice(0, 20),
          accountId: targetAccountId
        }).catch(() => {});
      }

      function teardownGlobalRealtimeListeners() {
        if (network.connectedRef && network.handlers.connected) {
          network.connectedRef.off("value", network.handlers.connected);
        }
        if (network.inventoryRef && network.handlers.inventory) {
          network.inventoryRef.off("value", network.handlers.inventory);
        }
        if (network.progressRef && network.handlers.progression) {
          network.progressRef.off("value", network.handlers.progression);
        }
        if (network.achievementsRef && network.handlers.achievements) {
          network.achievementsRef.off("value", network.handlers.achievements);
        }
        if (network.questsRef && network.handlers.quests) {
          network.questsRef.off("value", network.handlers.quests);
        }
        if (network.mySessionRef && network.handlers.mySession) {
          network.mySessionRef.off("value", network.handlers.mySession);
        }
        if (network.myCommandRef && network.handlers.myCommand) {
          network.myCommandRef.off("value", network.handlers.myCommand);
        }
        if (network.myReachRef && network.handlers.myReach) {
          network.myReachRef.off("value", network.handlers.myReach);
        }
        if (network.myFreezeRef && network.handlers.myFreeze) {
          network.myFreezeRef.off("value", network.handlers.myFreeze);
        }
        if (network.myGodModeRef && network.handlers.myGodMode) {
          network.myGodModeRef.off("value", network.handlers.myGodMode);
        }
        if (network.myPrivateAnnouncementRef && network.handlers.myPrivateAnnouncement) {
          network.myPrivateAnnouncementRef.off("value", network.handlers.myPrivateAnnouncement);
        }
        if (network.myPmFeedRef && network.handlers.myPmAdded) {
          network.myPmFeedRef.off("child_added", network.handlers.myPmAdded);
        }
        if (network.myTradeRequestRef && network.handlers.myTradeRequest) {
          network.myTradeRequestRef.off("value", network.handlers.myTradeRequest);
        }
        if (network.myTradeResponseRef && network.handlers.myTradeResponse) {
          network.myTradeResponseRef.off("value", network.handlers.myTradeResponse);
        }
        if (network.myActiveTradeRef && network.handlers.myActiveTrade) {
          network.myActiveTradeRef.off("value", network.handlers.myActiveTrade);
        }
        if (network.myFriendsRef && network.handlers.myFriends) {
          network.myFriendsRef.off("value", network.handlers.myFriends);
        }
        if (network.myFriendRequestsRef && network.handlers.myFriendRequests) {
          network.myFriendRequestsRef.off("value", network.handlers.myFriendRequests);
        }
        if (network.myAdminRoleRef && network.handlers.myAdminRole) {
          network.myAdminRoleRef.off("value", network.handlers.myAdminRole);
        }
        if (network.worldsIndexRef && network.handlers.worldsIndex) {
          network.worldsIndexRef.off("value", network.handlers.worldsIndex);
        }
        if (network.globalPlayersRef && network.handlers.globalPlayers) {
          network.globalPlayersRef.off("value", network.handlers.globalPlayers);
        }
        if (network.accountLogsRootRef && network.handlers.accountLogAdded) {
          network.accountLogsRootRef.off("value", network.handlers.accountLogAdded);
        }
        if (network.antiCheatLogsRef && network.handlers.antiCheatLogAdded) {
          network.antiCheatLogsRef.off("value", network.handlers.antiCheatLogAdded);
        }
        if (network.forceReloadRef && network.handlers.forceReload) {
          network.forceReloadRef.off("value", network.handlers.forceReload);
        }
        if (network.announcementRef && network.handlers.announcement) {
          network.announcementRef.off("value", network.handlers.announcement);
        }
        if (network.myBanRef && network.handlers.myBan) {
          network.myBanRef.off("value", network.handlers.myBan);
        }
        if (network.myChatMuteRef && network.handlers.myChatMute) {
          network.myChatMuteRef.off("value", network.handlers.myChatMute);
        }
        if (network.accountsRef && network.handlers.adminAccounts) {
          network.accountsRef.off("value", network.handlers.adminAccounts);
        }
        if (network.usernamesRef && network.handlers.adminUsernames) {
          network.usernamesRef.off("value", network.handlers.adminUsernames);
        }
        if (network.adminRolesRef && network.handlers.adminRoles) {
          network.adminRolesRef.off("value", network.handlers.adminRoles);
        }
        if (network.adminAuditRef && network.handlers.adminAudit) {
          network.adminAuditRef.off("value", network.handlers.adminAudit);
        }
        if (network.bansRef && network.handlers.adminBans) {
          network.bansRef.off("value", network.handlers.adminBans);
        }
        if (network.chatMutesRef && network.handlers.adminChatMutes) {
          network.chatMutesRef.off("value", network.handlers.adminChatMutes);
        }
        if (network.sessionsRootRef && network.handlers.adminSessions) {
          network.sessionsRootRef.off("value", network.handlers.adminSessions);
        }
        if (network.inventoriesRootRef && network.handlers.adminInventories) {
          network.inventoriesRootRef.off("value", network.handlers.adminInventories);
        }
        adminDataListening = false;
      }

      function syncAdminDataListeners() {
        if (!network.enabled) return;
        if (canUseAdminPanel && adminDataListening) {
          if (hasAdminPermission("view_audit")) {
            if (network.adminAuditRef && network.handlers.adminAudit) {
              network.adminAuditRef.off("value", network.handlers.adminAudit);
              network.adminAuditRef.on("value", network.handlers.adminAudit);
            }
          } else {
            if (network.adminAuditRef && network.handlers.adminAudit) {
              network.adminAuditRef.off("value", network.handlers.adminAudit);
            }
            adminState.audit = [];
            refreshAuditActionFilterOptions();
          }
          if (canViewAntiCheatLogs()) {
            if (network.antiCheatLogsRef && network.handlers.antiCheatLogAdded) {
              network.antiCheatLogsRef.off("value", network.handlers.antiCheatLogAdded);
              network.antiCheatLogsRef.on("value", network.handlers.antiCheatLogAdded);
            }
          } else {
            if (network.antiCheatLogsRef && network.handlers.antiCheatLogAdded) {
              network.antiCheatLogsRef.off("value", network.handlers.antiCheatLogAdded);
            }
            antiCheatMessages.length = 0;
          }
          return;
        }
        if (canUseAdminPanel && !adminDataListening) {
          if (network.accountsRef && network.handlers.adminAccounts) {
            network.accountsRef.on("value", network.handlers.adminAccounts);
          }
          if (network.usernamesRef && network.handlers.adminUsernames) {
            network.usernamesRef.on("value", network.handlers.adminUsernames);
          }
          if (network.bansRef && network.handlers.adminBans) {
            network.bansRef.on("value", network.handlers.adminBans);
          }
          if (network.chatMutesRef && network.handlers.adminChatMutes) {
            network.chatMutesRef.on("value", network.handlers.adminChatMutes);
          }
          if (network.sessionsRootRef && network.handlers.adminSessions) {
            network.sessionsRootRef.on("value", network.handlers.adminSessions);
          }
          if (network.inventoriesRootRef && network.handlers.adminInventories) {
            network.inventoriesRootRef.on("value", network.handlers.adminInventories);
          }
          if (hasAdminPermission("view_audit") && network.adminAuditRef && network.handlers.adminAudit) {
            network.adminAuditRef.on("value", network.handlers.adminAudit);
          }
          if (canViewAntiCheatLogs() && network.antiCheatLogsRef && network.handlers.antiCheatLogAdded) {
            network.antiCheatLogsRef.on("value", network.handlers.antiCheatLogAdded);
          }
          adminDataListening = true;
          return;
        }
        if (!canUseAdminPanel && adminDataListening) {
          if (network.accountsRef && network.handlers.adminAccounts) {
            network.accountsRef.off("value", network.handlers.adminAccounts);
          }
          if (network.usernamesRef && network.handlers.adminUsernames) {
            network.usernamesRef.off("value", network.handlers.adminUsernames);
          }
          if (network.bansRef && network.handlers.adminBans) {
            network.bansRef.off("value", network.handlers.adminBans);
          }
          if (network.chatMutesRef && network.handlers.adminChatMutes) {
            network.chatMutesRef.off("value", network.handlers.adminChatMutes);
          }
          if (network.sessionsRootRef && network.handlers.adminSessions) {
            network.sessionsRootRef.off("value", network.handlers.adminSessions);
          }
          if (network.inventoriesRootRef && network.handlers.adminInventories) {
            network.inventoriesRootRef.off("value", network.handlers.adminInventories);
          }
          if (network.adminAuditRef && network.handlers.adminAudit) {
            network.adminAuditRef.off("value", network.handlers.adminAudit);
          }
          if (network.antiCheatLogsRef && network.handlers.antiCheatLogAdded) {
            network.antiCheatLogsRef.off("value", network.handlers.antiCheatLogAdded);
          }
          adminState.accounts = {};
          adminState.usernames = {};
          adminState.roles = {};
          adminState.audit = [];
          refreshAuditActionFilterOptions();
          adminState.bans = {};
          adminState.chatMutes = {};
          adminState.sessions = {};
          adminState.inventories = {};
          antiCheatMessages.length = 0;
          renderAdminPanel();
          adminDataListening = false;
        }
      }

      function forceLogout(reason) {
        saveInventoryToLocal();
        saveProgressionToLocal();
        saveAchievementsToLocal();
        saveQuestsToLocal();
        if (progressionSaveTimer) {
          clearTimeout(progressionSaveTimer);
          progressionSaveTimer = 0;
        }
        if (achievementsSaveTimer) {
          clearTimeout(achievementsSaveTimer);
          achievementsSaveTimer = 0;
        }
        if (questsSaveTimer) {
          clearTimeout(questsSaveTimer);
          questsSaveTimer = 0;
        }
        if (inventorySaveTimer) {
          clearTimeout(inventorySaveTimer);
          inventorySaveTimer = 0;
        }
        if (inWorld) {
          sendSystemWorldMessage(playerName + " left the world.");
          logCameraEvent(
            "player_leave",
            playerName + " left " + currentWorldId + ".",
            playerProfileId,
            playerName
          );
        }
        detachCurrentWorldListeners();
        teardownGlobalRealtimeListeners();
        if (network.globalPlayerRef) {
          network.globalPlayerRef.remove().catch(() => {});
        }
        releaseAccountSession();
        network.enabled = false;
        setInWorldState(false);
        setAdminOpen(false);
        pendingTeleportSelf = null;
        lastPrivateMessageFrom = null;
        const msgCtrl = getMessagesController();
        if (msgCtrl && typeof msgCtrl.resetSession === "function") {
          msgCtrl.resetSession();
        }
        lastHandledTeleportCommandId = "";
        hasSeenInitialTeleportCommandSnapshot = false;
        lastHandledReachCommandId = "";
        lastHandledFreezeCommandId = "";
        lastHandledGodModeCommandId = "";
        lastHandledPrivateAnnouncementId = "";
        isFrozenByAdmin = false;
        isGodModeByAdmin = false;
        isChatMutedByAdmin = false;
        chatMutedReason = "";
        chatMutedByAdminName = "";
        frozenByAdminBy = "";
        progressionXp = 0;
        progressionLevel = 1;
        progressionXpIntoLevel = 0;
        progressionXpForNext = 100;
        achievementsState = null;
        questsState = null;
        worldIndexMetaById = {};
        worldLockOwnerCache.clear();
        ownedWorldScanInFlight = false;
        danceUntilMs = 0;
        currentAdminRole = "none";
        directAdminRole = "none";
        hasSeenAdminRoleSnapshot = false;
        canUseAdminPanel = false;
        canViewAccountLogs = false;
        const gemsCtrl = getGemsController();
        if (gemsCtrl && typeof gemsCtrl.reset === "function") {
          gemsCtrl.reset();
        }
        clearReachOverrideOnExit(true);
        updateGemsLabel();
        adminSearchQuery = "";
        adminAuditActionFilter = "";
        adminAuditActorFilter = "";
        adminAuditTargetFilter = "";
        adminDashboardTab = "overview";
        if (adminSearchInput) adminSearchInput.value = "";
        if (adminAuditActionFilterEl) adminAuditActionFilterEl.value = "";
        if (adminAuditActorFilterEl) adminAuditActorFilterEl.value = "";
        if (adminAuditTargetFilterEl) adminAuditTargetFilterEl.value = "";
        gameShellEl.classList.add("hidden");
        authScreenEl.classList.remove("hidden");
        setChatOpen(false);
        hideAnnouncementPopup();
        closeAchievementsMenu();
        closeTitlesMenu();
        const shopCtrl = getShopController();
        if (shopCtrl && typeof shopCtrl.closeModal === "function") {
          shopCtrl.closeModal();
        }
        applySavedCredentialsToForm();
        setAuthStatus(reason || "Logged out.", true);
      }

      function sendSystemWorldMessage(text) {
        if (!inWorld) return;
        const safeText = (text || "").toString().slice(0, SYSTEM_CHAT_TEXT_MAX);
        if (!safeText) return;
        if (!network.enabled || !network.chatRef) {
          addChatMessage({
            name: "[System]",
            playerId: "",
            text: safeText,
            createdAt: Date.now()
          });
          return;
        }
        network.chatRef.push({
          name: "[System]",
          playerId: "",
          text: safeText,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        }).catch(() => {
          setNetworkState("System message error", true);
        });
      }

      function addChatMessage(message) {
        if (!message || !message.text) return;
        const name = String(message.name || "");
        const player = String(message.playerId || "");
        const session = String(message.sessionId || "");
        const title = String(message.titleId || "");
        const text = String(message.text || "");
        const createdAt = Number(message.createdAt) || Date.now();
        const finger = [name, player, session, title, text].join("|");
        const nowMs = Date.now();
        const lastAt = Number(recentChatFingerprintAt.get(finger) || 0);
        const createdDiff = Math.abs(createdAt - lastAt);
        const nearDuplicate = lastAt > 0 && (createdDiff <= 2500 || Math.abs(nowMs - lastAt) <= 2500);
        if (nearDuplicate) return;
        recentChatFingerprintAt.set(finger, createdAt || nowMs);
        if (recentChatFingerprintAt.size > 300) {
          const cutoff = nowMs - 15000;
          for (const [k, t] of recentChatFingerprintAt) {
            if (Number(t) < cutoff) {
              recentChatFingerprintAt.delete(k);
            }
          }
        }
        chatMessages.push(message);
        if (chatMessages.length > CHAT_MESSAGES_LIMIT) {
          chatMessages.shift();
        }
        if (message.playerId) {
          overheadChatByPlayer.set(message.playerId, {
            text: (message.text || "").toString().slice(0, 80),
            expiresAt: performance.now() + CHAT_BUBBLE_MS
          });
        }
        renderChatMessages();
      }

      function sendChatMessage() {
        if (!inWorld) return;
        const raw = chatInputEl.value || "";
        const trimmed = raw.trim();
        if (!trimmed) return;
        const lowerTrimmed = trimmed.toLowerCase();
        const pmCommand = lowerTrimmed.startsWith("/pm ")
          || lowerTrimmed.startsWith("/msg ")
          || lowerTrimmed.startsWith("/w ");
        suppressChatOpenUntilMs = performance.now() + 300;
        if (handleAdminChatCommand(trimmed)) {
          if (pmCommand) {
            playSfxEvent("pm_sent", 0.45, "input", "pm sent");
          }
          chatInputEl.value = "";
          setChatOpen(false);
          return;
        }
        if (isChatMutedByAdmin) {
          const byText = chatMutedByAdminName ? (" by @" + chatMutedByAdminName) : "";
          const reasonText = chatMutedReason ? (" Reason: " + chatMutedReason + ".") : "";
          postLocalSystemChat("You are chat muted" + byText + "." + reasonText);
          return;
        }
        const text = trimmed.slice(0, 120);
        if (!text) return;
        playSfxEvent("chat_sent", 0.4, "input", "chat sent");
        const titlePayload = getEquippedTitlePayload();
        if (antiCheatController && typeof antiCheatController.onChatSend === "function") {
          antiCheatController.onChatSend(text);
        }
        if (!network.enabled || !network.chatRef) {
          chatInputEl.value = "";
          addChatMessage({
            name: playerName,
            playerId,
            sessionId: playerSessionId || "",
            titleId: titlePayload.id || "",
            titleName: titlePayload.name || "",
            titleColor: titlePayload.color || "",
            titleStyle: titlePayload.style || normalizeTitleStyle(null),
            text,
            createdAt: Date.now()
          });
          setChatOpen(false);
          return;
        }
        try {
          overheadChatByPlayer.set(playerId, {
            text,
            expiresAt: performance.now() + CHAT_BUBBLE_MS
          });
          chatInputEl.value = "";
          setChatOpen(false);
          network.chatRef.push({
            name: playerName,
            playerId,
            sessionId: playerSessionId || "",
            titleId: titlePayload.id || "",
            titleName: titlePayload.name || "",
            titleColor: titlePayload.color || "",
            titleStyle: titlePayload.style || normalizeTitleStyle(null),
            text,
            createdAt: firebase.database.ServerValue.TIMESTAMP
          }).catch(() => {
            setNetworkState("Chat send error", true);
          });
        } catch (error) {
          console.error(error);
          setNetworkState("Chat send error", true);
        }
      }

      function setCurrentWorldUI() {
        currentWorldLabelEl.textContent = inWorld ? currentWorldId : "menu";
        if (!worldInputEl.value) {
          worldInputEl.value = currentWorldId || "";
        }
      }

      function isSolidTile(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return true;
        const id = world[ty][tx];
        if (id === DOOR_BLOCK_ID) {
          if (!isWorldLocked()) return false;
          const mode = getLocalDoorMode(tx, ty);
          if (mode === "owner" && !isWorldLockOwner() && !isWorldLockAdmin()) return true;
          return false;
        }
        const def = blockDefs[id];
        return Boolean(def && def.solid);
      }

      function isUnbreakableTileId(id) {
        const def = blockDefs[id];
        return Boolean(def && def.unbreakable);
      }

      function getBlockKeyById(id) {
        return (BLOCK_ID_TO_KEY[id] || ("block_" + id)).toString();
      }

      function parseBlockRef(value) {
        if (typeof blockKeysModule.parseBlockRef === "function") {
          return blockKeysModule.parseBlockRef(value, BLOCK_KEY_TO_ID, blockDefs);
        }
        const raw = (value || "").toString().trim().toLowerCase();
        if (!raw) return 0;
        if (BLOCK_KEY_TO_ID[raw] !== undefined) return Number(BLOCK_KEY_TO_ID[raw]);
        const numeric = Number(raw);
        if (Number.isInteger(numeric) && blockDefs[numeric]) return numeric;
        return 0;
      }

      function isLiquidTile(tx, ty) {
        if (typeof physicsModule.isLiquidTile === "function") {
          return physicsModule.isLiquidTile(world, blockDefs, tx, ty, WORLD_W, WORLD_H);
        }
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return false;
        const id = world[ty][tx];
        const def = blockDefs[id];
        return Boolean(def && def.liquid);
      }

      function isOneWayPlatformTile(tx, ty) {
        if (typeof physicsModule.isOneWayPlatformTile === "function") {
          return physicsModule.isOneWayPlatformTile(world, blockDefs, tx, ty, WORLD_W, WORLD_H);
        }
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return false;
        const id = world[ty][tx];
        const def = blockDefs[id];
        return Boolean(def && def.oneWay);
      }

      function isLethalTile(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return false;
        const id = world[ty][tx];
        const def = blockDefs[id];
        return Boolean(def && def.lethal);
      }

      function isDonationBoxBlockId(id) {
        const def = blockDefs[id];
        return Boolean(def && def.donationBox);
      }

      function isChestBlockId(id) {
        const def = blockDefs[id];
        return Boolean(def && def.chestStorage);
      }

      function isGachaBlockId(id) {
        if (!gachaController || typeof gachaController.isGachaBlockId !== "function") return false;
        return Boolean(gachaController.isGachaBlockId(id));
      }

      function applyGachaEffect(effectId, tx, ty) {
        const effect = String(effectId || "").trim().toLowerCase();
        const cx = tx * TILE + TILE * 0.5;
        const cy = ty * TILE + TILE * 0.5;
        if (!particleController) return;
        if (effect === "splash") {
          if (typeof particleController.emitWaterSplash === "function") {
            particleController.emitWaterSplash(cx, cy, 10);
          }
          return;
        }
        if (effect === "seed") {
          if (typeof particleController.emitSeedDrop === "function") {
            particleController.emitSeedDrop(cx, cy);
          }
          return;
        }
        if (effect === "sparkle" || effect === "burst" || !effect) {
          if (typeof particleController.emitBlockBreak === "function") {
            particleController.emitBlockBreak(cx, cy, 16);
          }
        }
      }

      function grantGachaBlockReward(blockId, amount, tx, ty) {
        const id = Math.floor(Number(blockId) || 0);
        const qty = Math.max(0, Math.floor(Number(amount) || 0));
        if (!id || !qty || !INVENTORY_IDS.includes(id)) return 0;
        const current = Math.max(0, Math.floor(Number(inventory[id]) || 0));
        const room = Math.max(0, INVENTORY_ITEM_LIMIT - current);
        const addNow = Math.min(room, qty);
        if (addNow > 0) {
          inventory[id] = current + addNow;
        }
        const spill = qty - addNow;
        if (spill > 0) {
          spawnWorldDropEntry({ type: "block", blockId: id }, spill, tx * TILE, ty * TILE);
        }
        return qty;
      }

      function grantGachaCosmeticReward(cosmeticId, amount) {
        const id = String(cosmeticId || "").trim();
        const qty = Math.max(0, Math.floor(Number(amount) || 0));
        if (!id || !qty || !cosmeticInventory.hasOwnProperty(id)) return 0;
        cosmeticInventory[id] = clampInventoryCount((cosmeticInventory[id] || 0) + qty);
        return qty;
      }

      function grantGachaTitleReward(titleId, amount) {
        const id = String(titleId || "").trim();
        const qty = Math.max(0, Math.floor(Number(amount) || 0));
        if (!id || !qty || !TITLE_LOOKUP[id]) return 0;
        if ((titleInventory[id] || 0) > 0) return 0;
        titleInventory[id] = 1;
        return 1;
      }

      function resolveGachaBreak(blockId, tx, ty) {
        if (!gachaController || typeof gachaController.roll !== "function") return false;
        const result = gachaController.roll(blockId);
        if (!result || !Array.isArray(result.rolls) || !result.rolls.length) return false;
        let changedInventory = false;
        for (let i = 0; i < result.rolls.length; i++) {
          const row = result.rolls[i] || {};
          const kind = String(row.kind || "").trim().toLowerCase();
          const amount = Math.max(0, Math.floor(Number(row.amount) || 0));
          if (kind === "block") {
            const rewardBlockId = parseBlockRef(row.blockKey || "");
            const given = grantGachaBlockReward(rewardBlockId, amount || 1, tx, ty);
            changedInventory = changedInventory || given > 0;
          } else if (kind === "cosmetic") {
            const given = grantGachaCosmeticReward(row.cosmeticId, amount || 1);
            changedInventory = changedInventory || given > 0;
          } else if (kind === "title") {
            const given = grantGachaTitleReward(row.titleId, amount || 1);
            changedInventory = changedInventory || given > 0;
          } else if (kind === "gems") {
            const given = addPlayerGems(amount || 0, true);
            changedInventory = changedInventory || given > 0;
          } else if (kind === "effect") {
            applyGachaEffect(row.effect, tx, ty);
          }
          const text = String(row.text || "").trim();
          if (text) {
            postLocalSystemChat("[Gacha] " + text);
          }
        }
        if (changedInventory) {
          saveInventory();
          refreshToolbar();
          syncPlayer(true);
        }
        //showAnnouncementPopup("Mystery block opened!");
        return true;
      }

      function rectTouchesLethal(x, y, w, h) {
        const left = Math.floor(x / TILE);
        const right = Math.floor((x + w - 1) / TILE);
        const top = Math.floor(y / TILE);
        const bottom = Math.floor((y + h - 1) / TILE);
        for (let ty = top; ty <= bottom; ty++) {
          for (let tx = left; tx <= right; tx++) {
            if (isLethalTile(tx, ty)) return true;
          }
        }
        return false;
      }

      function isStairTileId(id) {
        return STAIR_ROTATION_IDS.includes(id);
      }

      function getRotatedBlockId(id) {
        const idx = STAIR_ROTATION_IDS.indexOf(id);
        if (idx >= 0) return STAIR_ROTATION_IDS[(idx + 1) % STAIR_ROTATION_IDS.length];
        const spikeIdx = SPIKE_ROTATION_IDS.indexOf(id);
        if (spikeIdx >= 0) return SPIKE_ROTATION_IDS[(spikeIdx + 1) % SPIKE_ROTATION_IDS.length];
        return 0;
      }

      function getInventoryDropId(id) {
        if (STAIR_ROTATION_IDS.includes(id)) return STAIR_BASE_ID;
        if (SPIKE_ROTATION_IDS.includes(id)) return SPIKE_BASE_ID;
        return id;
      }

      function isPlantSeedBlockId(id) {
        return PLANT_SEED_ID_SET.has(Number(id));
      }

      function getPlantSeedConfig(seedBlockId) {
        return PLANT_SEED_CONFIG[Number(seedBlockId)] || null;
      }

      function resolvePlantFruitAmount(plant) {
        const rec = plant && typeof plant === "object" ? plant : {};
        const fromRecord = Math.max(0, Math.floor(Number(rec.fruitAmount) || 0));
        if (fromRecord > 0) return Math.max(1, Math.min(5, fromRecord));
        const plantedAt = Math.max(1, Math.floor(Number(rec.plantedAt) || 1));
        const yieldId = Math.max(1, Math.floor(Number(rec.yieldBlockId) || TREE_YIELD_BLOCK_ID));
        const seed = ((plantedAt ^ (yieldId * 2654435761)) >>> 0);
        return 1 + (seed % 5);
      }

      function getTileKey(tx, ty) {
        return String(tx) + "_" + String(ty);
      }

      function getBlockDurability(id) {
        const def = blockDefs[id];
        if (!def) return 1;
        if (def.unbreakable || id === SPAWN_DOOR_ID || id === SPAWN_BASE_ID) return Infinity;
        const configured = Math.floor(Number(def.durability) || 0);
        if (configured > 0) return configured;
        if (isWorldLockBlockId(id)) return 8;
        if (id === VENDING_ID || id === CAMERA_ID || id === WEATHER_MACHINE_ID) return 6;
        if (id === SPAWN_BASE_ID) return Infinity;
        if (def.stair || def.oneWay || def.liquid || id === SIGN_ID) return 2;
        return 3;
      }

      function getEquippedBreakPower() {
        const item = typeof cosmeticsModule.getEquippedItem === "function"
          ? cosmeticsModule.getEquippedItem("swords", equippedCosmetics, COSMETIC_LOOKUP)
          : null;
        if (!item) {
          return { multiplier: 1, instantBreak: false };
        }
        const multiplier = Math.max(1, Number(item && item.breakMultiplier) || 1);
        const instantBreak = Boolean(item && item.instantBreak);
        return { multiplier, instantBreak };
      }

      function clearTileDamage(tx, ty) {
        tileDamageByKey.delete(getTileKey(tx, ty));
      }

      function clearAllTileDamage() {
        tileDamageByKey.clear();
      }

      function getTileDamage(tx, ty) {
        const key = getTileKey(tx, ty);
        const entry = tileDamageByKey.get(key);
        if (!entry) return { hits: 0, updatedAt: 0 };
        return {
          hits: Math.max(0, Math.floor(Number(entry.hits) || 0)),
          updatedAt: Number(entry.updatedAt) || 0
        };
      }

      function setTileDamage(tx, ty, hits) {
        const nextHits = Math.max(0, Math.floor(Number(hits) || 0));
        const key = getTileKey(tx, ty);
        if (nextHits <= 0) {
          tileDamageByKey.delete(key);
          return;
        }
        tileDamageByKey.set(key, {
          hits: nextHits,
          updatedAt: performance.now()
        });
      }

      function tickTileDamageDecay() {
        if (!tileDamageByKey.size) return;
        const now = performance.now();
        tileDamageByKey.forEach((entry, key) => {
          if (!entry) {
            tileDamageByKey.delete(key);
            return;
          }
          const age = now - (Number(entry.updatedAt) || 0);
          if (age < 2400) return;
          const nextHits = Math.max(0, Math.floor(Number(entry.hits) || 0) - 1);
          if (nextHits <= 0) {
            tileDamageByKey.delete(key);
            return;
          }
          tileDamageByKey.set(key, { hits: nextHits, updatedAt: now - 1400 });
        });
      }

      const damageSyncTimers = {};

      function syncTileDamageToNetwork(tx, ty, hits) {
        if (!network.enabled || !inWorld) return;
        
        if (network.playerRef && typeof syncHitsModule.buildPlayerHitPayload === "function") {
          const playerHit = syncHitsModule.buildPlayerHitPayload(tx, ty, hits);
          if (playerHit) {
            network.playerRef.child("lastHit").set(playerHit).catch(() => {});
          }
        }
        
        if (!network.hitsRef) return;
        const key = getTileKey(tx, ty);
        
        // Clear previous timer to bundle rapid hits into a single network call
        if (damageSyncTimers[key]) {
          clearTimeout(damageSyncTimers[key]);
        }
        
        damageSyncTimers[key] = setTimeout(() => {
          delete damageSyncTimers[key];
          
          if (typeof syncHitsModule.writeHit === "function") {
            syncHitsModule.writeHit(network.hitsRef, key, hits, firebase);
            return;
          }
          const safeHits = Math.max(0, Math.floor(Number(hits) || 0));
          if (!safeHits) {
            network.hitsRef.child(key).remove().catch(() => {});
            return;
          }
          network.hitsRef.child(key).set({
            hits: safeHits,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
          }).catch(() => {});
        }, 100); // Waits 100ms after the LAST hit before telling Firebase
      }

      function normalizeDoorAccessRecord(value) {
        if (!value) return null;
        let mode = "public";
        if (typeof value === "string") {
          mode = value.toLowerCase() === "owner" ? "owner" : "public";
        } else if (typeof value === "object") {
          mode = String(value.mode || "public").toLowerCase() === "owner" ? "owner" : "public";
        }
        return {
          mode,
          updatedAt: value && typeof value.updatedAt === "number" ? value.updatedAt : 0
        };
      }

      function setLocalDoorAccess(tx, ty, value) {
        const key = getTileKey(tx, ty);
        const normalized = normalizeDoorAccessRecord(value);
        if (!normalized) {
          doorAccessByTile.delete(key);
          if (doorEditContext && doorEditContext.tx === tx && doorEditContext.ty === ty) {
            closeDoorModal();
          }
          return;
        }
        doorAccessByTile.set(key, normalized);
      }

      function getLocalDoorMode(tx, ty) {
        const entry = doorAccessByTile.get(getTileKey(tx, ty));
        return entry && entry.mode === "owner" ? "owner" : "public";
      }

      function setLocalTreePlant(tx, ty, value) {
        const ctrl = getPlantsController();
        if (!ctrl || typeof ctrl.setLocal !== "function") return;
        ctrl.setLocal(tx, ty, value);
      }

      function getLocalTreePlant(tx, ty) {
        const ctrl = getPlantsController();
        if (!ctrl || typeof ctrl.getLocal !== "function") return null;
        return ctrl.getLocal(tx, ty);
      }

      function saveTreePlant(tx, ty, value) {
        const ctrl = getPlantsController();
        if (!ctrl || typeof ctrl.save !== "function") return;
        ctrl.save(tx, ty, value);
      }

      function clearTreePlants() {
        const ctrl = getPlantsController();
        if (!ctrl || typeof ctrl.clear !== "function") return;
        ctrl.clear();
      }

      function normalizeAntiGravityRecord(value) {
        if (value === undefined || value === null) return null;
        let enabled = true;
        if (typeof value === "boolean") {
          enabled = value;
        } else if (typeof value === "string") {
          const normalized = value.toLowerCase().trim();
          enabled = !(normalized === "0" || normalized === "false" || normalized === "off" || normalized === "disabled");
        } else if (typeof value === "object") {
          if (typeof value.enabled === "boolean") {
            enabled = value.enabled;
          } else if (value.enabled !== undefined && value.enabled !== null) {
            const normalized = String(value.enabled).toLowerCase().trim();
            enabled = !(normalized === "0" || normalized === "false" || normalized === "off" || normalized === "disabled");
          }
        }
        return {
          enabled: Boolean(enabled),
          updatedAt: value && typeof value.updatedAt === "number" ? value.updatedAt : 0
        };
      }

      function setLocalAntiGravityState(tx, ty, value) {
        const key = getTileKey(tx, ty);
        const normalized = normalizeAntiGravityRecord(value);
        if (!normalized) {
          antiGravityByTile.delete(key);
          return;
        }
        antiGravityByTile.set(key, normalized);
      }

      function isAntiGravityEnabledAt(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return false;
        if (world[ty][tx] !== ANTI_GRAV_ID) return false;
        const entry = antiGravityByTile.get(getTileKey(tx, ty));
        if (!entry) return true;
        return entry.enabled !== false;
      }

      function saveAntiGravityState(tx, ty, enabled) {
        if (world[ty][tx] !== ANTI_GRAV_ID) {
          setLocalAntiGravityState(tx, ty, null);
          return;
        }
        const payload = {
          enabled: Boolean(enabled),
          updatedAt: Date.now()
        };
        setLocalAntiGravityState(tx, ty, payload);
        if (network.enabled && network.antiGravRef) {
          network.antiGravRef.child(getTileKey(tx, ty)).set({
            enabled: Boolean(enabled),
            updatedAt: firebase.database.ServerValue.TIMESTAMP
          }).catch(() => {});
        }
      }

      function toggleAntiGravityGenerator(tx, ty) {
        if (!canEditTarget(tx, ty)) return;
        if (world[ty][tx] !== ANTI_GRAV_ID) return;
        if (!canEditCurrentWorld()) {
          notifyWorldLockedDenied();
          return;
        }
        const nextEnabled = !isAntiGravityEnabledAt(tx, ty);
        saveAntiGravityState(tx, ty, nextEnabled);
        postLocalSystemChat("Anti gravity generator " + (nextEnabled ? "enabled." : "disabled."));
      }

      function isPlayerInAntiGravityField(x, y, w, h) {
        const centerTx = Math.floor((x + w / 2) / TILE);
        const centerTy = Math.floor((y + h / 2) / TILE);
        const startX = Math.max(0, centerTx - ANTI_GRAV_RADIUS_TILES);
        const endX = Math.min(WORLD_W - 1, centerTx + ANTI_GRAV_RADIUS_TILES);
        const startY = Math.max(0, centerTy - ANTI_GRAV_RADIUS_TILES);
        const endY = Math.min(WORLD_H - 1, centerTy + ANTI_GRAV_RADIUS_TILES);
        for (let ty = startY; ty <= endY; ty++) {
          for (let tx = startX; tx <= endX; tx++) {
            if (!isAntiGravityEnabledAt(tx, ty)) continue;
            const dx = tx - centerTx;
            const dy = ty - centerTy;
            if ((dx * dx + dy * dy) <= (ANTI_GRAV_RADIUS_TILES * ANTI_GRAV_RADIUS_TILES)) {
              return true;
            }
          }
        }
        return false;
      }

      function buildDefaultCameraConfig() {
        return {
          events: {
            playerJoin: true,
            playerLeave: true,
            vendingPurchase: true
          },
          excludeAdminOwner: false,
          updatedAt: 0
        };
      }

      function normalizeCameraConfig(value) {
        const defaults = buildDefaultCameraConfig();
        if (!value || typeof value !== "object") return defaults;
        const eventsRaw = value.events && typeof value.events === "object" ? value.events : {};
        return {
          events: {
            playerJoin: eventsRaw.playerJoin !== false,
            playerLeave: eventsRaw.playerLeave !== false,
            vendingPurchase: eventsRaw.vendingPurchase !== false
          },
          excludeAdminOwner: Boolean(value.excludeAdminOwner),
          updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0
        };
      }

      function setLocalCameraConfig(tx, ty, value) {
        const key = getTileKey(tx, ty);
        if (!value) {
          cameraConfigsByTile.delete(key);
          cameraLogsByTile.delete(key);
          if (cameraEditContext && cameraEditContext.tx === tx && cameraEditContext.ty === ty) {
            closeCameraModal();
          }
          return;
        }
        cameraConfigsByTile.set(key, normalizeCameraConfig(value));
        if (cameraEditContext && cameraEditContext.tx === tx && cameraEditContext.ty === ty) {
          renderCameraModal();
        }
      }

      function appendLocalCameraLog(tileKey, value) {
        if (!tileKey) return;
        const current = cameraLogsByTile.get(tileKey) || [];
        current.push(value);
        if (current.length > 120) {
          current.splice(0, current.length - 120);
        }
        cameraLogsByTile.set(tileKey, current);
        if (cameraEditContext && getTileKey(cameraEditContext.tx, cameraEditContext.ty) === tileKey) {
          renderCameraModal();
        }
      }

      function closeCameraModal() {
        cameraEditContext = null;
        if (cameraModalEl) cameraModalEl.classList.add("hidden");
      }

      function renderCameraModal() {
        if (!cameraEditContext || !cameraModalEl || !cameraTitleEl || !cameraLogsListEl) return;
        const tx = Number(cameraEditContext.tx);
        const ty = Number(cameraEditContext.ty);
        if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H || world[ty][tx] !== CAMERA_ID) {
          closeCameraModal();
          return;
        }
        const key = getTileKey(tx, ty);
        const config = normalizeCameraConfig(cameraConfigsByTile.get(key) || buildDefaultCameraConfig());
        cameraTitleEl.textContent = "Camera (" + tx + "," + ty + ")";
        if (cameraEventJoinEl) cameraEventJoinEl.checked = config.events.playerJoin !== false;
        if (cameraEventLeaveEl) cameraEventLeaveEl.checked = config.events.playerLeave !== false;
        if (cameraEventVendingEl) cameraEventVendingEl.checked = config.events.vendingPurchase !== false;
        if (cameraFilterStaffEl) cameraFilterStaffEl.checked = Boolean(config.excludeAdminOwner);

        const rows = (cameraLogsByTile.get(key) || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        cameraLogsListEl.innerHTML = rows.length
          ? rows.map((row) => {
            const time = formatChatTimestamp(Number(row.createdAt) || 0);
            const line = (time ? "[" + time + "] " : "") + (row.text || "");
            return "<div class='camera-log-row'>" + escapeHtml(line) + "</div>";
          }).join("")
          : "<div class='camera-log-row'>No logs yet.</div>";
        cameraLogsListEl.scrollTop = cameraLogsListEl.scrollHeight;
      }

      function saveCameraConfig(tx, ty, config) {
        if (!world[ty] || world[ty][tx] !== CAMERA_ID) {
          setLocalCameraConfig(tx, ty, null);
          return;
        }
        const normalized = normalizeCameraConfig(config || {});
        normalized.updatedAt = Date.now();
        setLocalCameraConfig(tx, ty, normalized);
        if (network.enabled && network.camerasRef) {
          network.camerasRef.child(getTileKey(tx, ty)).set({
            events: {
              playerJoin: normalized.events.playerJoin,
              playerLeave: normalized.events.playerLeave,
              vendingPurchase: normalized.events.vendingPurchase
            },
            excludeAdminOwner: normalized.excludeAdminOwner,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
          }).catch(() => {});
        }
      }

      function openCameraModal(tx, ty) {
        if (!cameraModalEl || !cameraTitleEl) return;
        if (!canEditTarget(tx, ty)) return;
        if (world[ty][tx] !== CAMERA_ID) return;
        cameraEditContext = { tx, ty };
        renderCameraModal();
        cameraModalEl.classList.remove("hidden");
      }

      function isAdminOrOwnerActor(accountId, username) {
        const role = getAccountRole(accountId || "", username || "");
        return role === "admin" || role === "manager" || role === "owner";
      }

      function logCameraEvent(eventType, text, actorAccountId, actorName) {
        if (!inWorld) return;
        const safeText = (text || "").toString().replace(/\s+/g, " ").trim().slice(0, 180);
        if (!safeText) return;
        const tileKeys = [];
        for (const [tileKey, configValue] of cameraConfigsByTile.entries()) {
          const config = normalizeCameraConfig(configValue);
          let enabled = false;
          if (eventType === "player_join") enabled = config.events.playerJoin !== false;
          if (eventType === "player_leave") enabled = config.events.playerLeave !== false;
          if (eventType === "vending_purchase") enabled = config.events.vendingPurchase !== false;
          if (!enabled) continue;
          if (config.excludeAdminOwner && isAdminOrOwnerActor(actorAccountId, actorName)) continue;
          tileKeys.push(tileKey);
        }
        if (!tileKeys.length) return;
        const createdAt = Date.now();
        if (!network.enabled || !network.cameraLogsRef) {
          for (const tileKey of tileKeys) {
            appendLocalCameraLog(tileKey, {
              tileKey,
              eventType,
              text: safeText,
              actorAccountId: actorAccountId || "",
              actorName: actorName || "",
              createdAt
            });
          }
          return;
        }
        for (const tileKey of tileKeys) {
          network.cameraLogsRef.push({
            tileKey,
            eventType,
            text: safeText,
            actorAccountId: actorAccountId || "",
            actorName: actorName || "",
            createdAt: firebase.database.ServerValue.TIMESTAMP
          }).catch(() => {});
        }
      }

      function normalizeWeatherRecord(value) {
        if (!value || typeof value !== "object") return null;
        const presetRaw = String(value.presetId || "").trim().toLowerCase();
        const presetId = WEATHER_PRESET_MAP.has(presetRaw) ? presetRaw : "none";
        const imageUrl = String(value.imageUrl || "").trim().slice(0, 420);
        const sourceTxNum = Math.floor(Number(value.sourceTx));
        const sourceTyNum = Math.floor(Number(value.sourceTy));
        const sourceTx = Number.isInteger(sourceTxNum) ? sourceTxNum : -1;
        const sourceTy = Number.isInteger(sourceTyNum) ? sourceTyNum : -1;
        if (presetId === "none" && !imageUrl) return null;
        return {
          presetId,
          imageUrl,
          sourceTx,
          sourceTy,
          updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0
        };
      }

      function getWeatherPresetUrl(presetId) {
        const preset = WEATHER_PRESET_MAP.get(String(presetId || "").trim().toLowerCase());
        return preset ? String(preset.url || "").trim() : "";
      }

      function getActiveWeatherImageUrl() {
        const weather = normalizeWeatherRecord(currentWorldWeather);
        if (!weather) return "";
        if (
          Number.isInteger(weather.sourceTx) &&
          Number.isInteger(weather.sourceTy) &&
          weather.sourceTx >= 0 &&
          weather.sourceTy >= 0 &&
          weather.sourceTx < WORLD_W &&
          weather.sourceTy < WORLD_H &&
          world[weather.sourceTy] &&
          world[weather.sourceTy][weather.sourceTx] !== WEATHER_MACHINE_ID
        ) {
          return "";
        }
        const custom = String(weather.imageUrl || "").trim();
        if (custom) return custom;
        return getWeatherPresetUrl(weather.presetId);
      }

      function setLocalWorldWeather(value) {
        currentWorldWeather = normalizeWeatherRecord(value);
        if (currentWorldId) {
          if (currentWorldWeather) {
            localWeatherByWorld.set(currentWorldId, currentWorldWeather);
          } else {
            localWeatherByWorld.delete(currentWorldId);
          }
        }
        if (weatherEditContext) {
          renderWeatherModal();
        }
      }

      function closeWeatherModal() {
        weatherEditContext = null;
        if (weatherModalEl) weatherModalEl.classList.add("hidden");
      }

      function refreshWeatherPreview() {
        if (!weatherPresetSelectEl || !weatherImageUrlInputEl) return;
        const presetId = String(weatherPresetSelectEl.value || "none").trim().toLowerCase();
        const custom = String(weatherImageUrlInputEl.value || "").trim();
        const resolved = custom || getWeatherPresetUrl(presetId);
        if (weatherResolvedLabelEl) {
          weatherResolvedLabelEl.textContent = resolved ? ("Active image: " + resolved) : "Active image: Default Sky";
        }
        if (weatherPreviewImgEl) {
          if (resolved) {
            weatherPreviewImgEl.src = resolved;
            weatherPreviewImgEl.classList.remove("hidden");
            if (weatherPreviewEmptyEl) weatherPreviewEmptyEl.classList.add("hidden");
          } else {
            weatherPreviewImgEl.classList.add("hidden");
            weatherPreviewImgEl.removeAttribute("src");
            if (weatherPreviewEmptyEl) weatherPreviewEmptyEl.classList.remove("hidden");
          }
        }
      }

      function renderWeatherModal() {
        if (!weatherEditContext || !weatherModalEl || !weatherTitleEl || !weatherPresetSelectEl || !weatherImageUrlInputEl) return;
        const tx = Number(weatherEditContext.tx);
        const ty = Number(weatherEditContext.ty);
        if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H || world[ty][tx] !== WEATHER_MACHINE_ID) {
          closeWeatherModal();
          return;
        }
        weatherTitleEl.textContent = "Weather Machine (" + tx + "," + ty + ")";
        weatherPresetSelectEl.innerHTML = WEATHER_PRESETS.map((preset) => {
          return "<option value=\"" + escapeHtml(preset.id) + "\">" + escapeHtml(preset.name) + "</option>";
        }).join("");
        const record = normalizeWeatherRecord(currentWorldWeather) || { presetId: "none", imageUrl: "" };
        weatherPresetSelectEl.value = WEATHER_PRESET_MAP.has(record.presetId) ? record.presetId : "none";
        weatherImageUrlInputEl.value = String(record.imageUrl || "");
        refreshWeatherPreview();
      }

      function saveWorldWeatherFromMachine(tx, ty, presetIdRaw, imageUrlRaw) {
        if (!world[ty] || world[ty][tx] !== WEATHER_MACHINE_ID) {
          setLocalWorldWeather(null);
          return;
        }
        const presetId = WEATHER_PRESET_MAP.has(String(presetIdRaw || "").trim().toLowerCase())
          ? String(presetIdRaw || "").trim().toLowerCase()
          : "none";
        const imageUrl = String(imageUrlRaw || "").trim().slice(0, 420);
        if (presetId === "none" && !imageUrl) {
          setLocalWorldWeather(null);
          if (network.enabled && network.weatherRef) {
            network.weatherRef.remove().catch(() => {});
          }
          return;
        }
        const payload = {
          presetId,
          imageUrl,
          sourceTx: tx,
          sourceTy: ty,
          updatedAt: Date.now()
        };
        setLocalWorldWeather(payload);
        if (network.enabled && network.weatherRef) {
          network.weatherRef.set({
            presetId,
            imageUrl,
            sourceTx: tx,
            sourceTy: ty,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
          }).catch(() => {});
        }
      }

      function openWeatherModal(tx, ty) {
        if (!weatherModalEl || !weatherTitleEl) return;
        if (!canEditTarget(tx, ty)) return;
        if (world[ty][tx] !== WEATHER_MACHINE_ID) return;
        if (!canEditCurrentWorld()) {
          notifyWorldLockedDenied();
          return;
        }
        weatherEditContext = { tx, ty };
        renderWeatherModal();
        weatherModalEl.classList.remove("hidden");
      }

      function closeDoorModal() {
        doorEditContext = null;
        if (doorModalEl) doorModalEl.classList.add("hidden");
      }

      function saveDoorMode(tx, ty, mode) {
        const safeMode = mode === "owner" ? "owner" : "public";
        if (world[ty][tx] !== DOOR_BLOCK_ID) {
          setLocalDoorAccess(tx, ty, null);
          return;
        }
        if (safeMode === "public") {
          setLocalDoorAccess(tx, ty, null);
          if (network.enabled && network.doorsRef) {
            network.doorsRef.child(getTileKey(tx, ty)).remove().catch(() => {});
          }
          return;
        }
        const payload = {
          mode: "owner",
          updatedAt: Date.now()
        };
        setLocalDoorAccess(tx, ty, payload);
        if (network.enabled && network.doorsRef) {
          network.doorsRef.child(getTileKey(tx, ty)).set({
            mode: "owner",
            updatedAt: firebase.database.ServerValue.TIMESTAMP
          }).catch(() => {});
        }
      }

      function openDoorModal(tx, ty) {
        if (!doorModalEl || !doorTitleEl) return;
        if (!canEditTarget(tx, ty)) return;
        if (world[ty][tx] !== DOOR_BLOCK_ID) return;
        if (!isWorldLocked()) {
          postLocalSystemChat("Door access options are only available in world-locked worlds.");
          return;
        }
        if (!isWorldLockOwner()) {
          notifyWorldLockedDenied();
          return;
        }
        doorEditContext = { tx, ty };
        const mode = getLocalDoorMode(tx, ty);
        doorTitleEl.textContent = "Door (" + tx + "," + ty + ") - " + (mode === "owner" ? "Owner Only" : "Public");
        if (doorPublicBtn) doorPublicBtn.classList.toggle("active", mode === "public");
        if (doorOwnerOnlyBtn) doorOwnerOnlyBtn.classList.toggle("active", mode === "owner");
        doorModalEl.classList.remove("hidden");
      }

      function setLocalSignText(tx, ty, value) {
        const ctrl = getSignController();
        if (!ctrl || typeof ctrl.setLocalText !== "function") return;
        ctrl.setLocalText(tx, ty, value);
      }

      function getLocalSignText(tx, ty) {
        const ctrl = getSignController();
        if (!ctrl || typeof ctrl.getLocalText !== "function") return "";
        return ctrl.getLocalText(tx, ty);
      }

      function normalizeDisplayItemRecord(value) {
        if (!value || typeof value !== "object") return null;
        const typeRaw = String(value.type || "").trim().toLowerCase();
        const type = typeRaw === "cosmetic" ? "cosmetic" : "block";
        const blockId = Math.max(0, Math.floor(Number(value.blockId) || 0));
        const cosmeticId = String(value.cosmeticId || "").trim().slice(0, 64);
        if (type === "block" && !blockId) return null;
        if (type === "cosmetic" && !cosmeticId) return null;
        return {
          type,
          blockId,
          cosmeticId,
          updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0
        };
      }

      function setLocalDisplayItem(tx, ty, value) {
        const key = getTileKey(tx, ty);
        const normalized = normalizeDisplayItemRecord(value);
        if (!normalized) {
          displayItemsByTile.delete(key);
          return;
        }
        displayItemsByTile.set(key, normalized);
      }

      function getLocalDisplayItem(tx, ty) {
        return displayItemsByTile.get(getTileKey(tx, ty)) || null;
      }

      function saveDisplayItem(tx, ty, value) {
        const normalized = normalizeDisplayItemRecord(value);
        setLocalDisplayItem(tx, ty, normalized);
        if (!network.enabled || !network.displaysRef) return;
        const ref = network.displaysRef.child(getTileKey(tx, ty));
        if (!normalized) {
          ref.remove().catch(() => {});
          return;
        }
        ref.set({
          type: normalized.type,
          blockId: normalized.type === "block" ? normalized.blockId : 0,
          cosmeticId: normalized.type === "cosmetic" ? normalized.cosmeticId : "",
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        }).catch(() => {});
      }

      function createEmptyMannequinOutfit() {
        const out = {};
        for (let i = 0; i < COSMETIC_SLOTS.length; i++) {
          out[COSMETIC_SLOTS[i]] = "";
        }
        return out;
      }

      function normalizeMannequinOutfitRecord(value) {
        if (!value || typeof value !== "object") return null;
        const sourceOutfit = value.equippedCosmetics && typeof value.equippedCosmetics === "object"
          ? value.equippedCosmetics
          : (value.cosmetics && typeof value.cosmetics === "object"
            ? value.cosmetics
            : (value.equipped && typeof value.equipped === "object" ? value.equipped : {}));
        const outfit = createEmptyMannequinOutfit();
        for (let i = 0; i < COSMETIC_SLOTS.length; i++) {
          const slot = COSMETIC_SLOTS[i];
          const id = String(sourceOutfit[slot] || "").trim();
          outfit[slot] = id && COSMETIC_LOOKUP[slot] && COSMETIC_LOOKUP[slot][id] ? id : "";
        }
        return {
          ownerAccountId: String(value.ownerAccountId || "").trim().slice(0, 64),
          ownerName: String(value.ownerName || "").trim().slice(0, 20),
          equippedCosmetics: outfit,
          updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0
        };
      }

      function setLocalMannequinOutfit(tx, ty, value) {
        const key = getTileKey(tx, ty);
        const normalized = normalizeMannequinOutfitRecord(value);
        if (!normalized) {
          mannequinOutfitsByTile.delete(key);
          return;
        }
        mannequinOutfitsByTile.set(key, normalized);
      }

      function getLocalMannequinOutfit(tx, ty) {
        return mannequinOutfitsByTile.get(getTileKey(tx, ty)) || null;
      }

      function saveMannequinOutfit(tx, ty, value) {
        const normalized = normalizeMannequinOutfitRecord(value);
        setLocalMannequinOutfit(tx, ty, normalized);
        if (!network.enabled || !network.mannequinsRef) return;
        const ref = network.mannequinsRef.child(getTileKey(tx, ty));
        if (!normalized) {
          ref.remove().catch(() => {});
          return;
        }
        ref.set({
          ownerAccountId: normalized.ownerAccountId,
          ownerName: normalized.ownerName,
          equippedCosmetics: normalized.equippedCosmetics,
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        }).catch(() => {});
      }

      function grantMannequinOutfitToInventory(record) {
        const normalized = normalizeMannequinOutfitRecord(record);
        if (!normalized) return 0;
        const outfit = normalized.equippedCosmetics || {};
        let granted = 0;
        for (let i = 0; i < COSMETIC_SLOTS.length; i++) {
          const slot = COSMETIC_SLOTS[i];
          const cosmeticId = String(outfit[slot] || "").trim();
          if (!cosmeticId) continue;
          if (!COSMETIC_LOOKUP[slot] || !COSMETIC_LOOKUP[slot][cosmeticId]) continue;
          cosmeticInventory[cosmeticId] = clampInventoryCount((cosmeticInventory[cosmeticId] || 0) + 1);
          granted += 1;
        }
        return granted;
      }

      function tryPlaceCosmeticIntoMannequin(tx, ty, entry) {
        const result = { handled: false, blockWorldDrop: false };
        if (!inWorld) return result;
        if (!entry || entry.type !== "cosmetic") return result;
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return result;
        if (world[ty][tx] !== MANNEQUIN_ID) return result;
        result.blockWorldDrop = true;
        if (!canEditTarget(tx, ty)) return result;
        if (!canEditCurrentWorld()) {
          notifyWorldLockedDenied();
          return result;
        }
        if (!isWorldLocked() || !isWorldLockOwner()) {
          notifyOwnerOnlyWorldEdit("mannequins");
          return result;
        }
        const cosmeticId = String(entry.cosmeticId || "").trim();
        if (!cosmeticId || (cosmeticInventory[cosmeticId] || 0) <= 0) return result;
        const cosmeticItem = COSMETIC_ITEMS.find((row) => row && row.id === cosmeticId) || null;
        const slot = cosmeticItem && cosmeticItem.slot ? String(cosmeticItem.slot) : "";
        if (!slot || !COSMETIC_LOOKUP[slot] || !COSMETIC_LOOKUP[slot][cosmeticId]) return result;

        const current = getLocalMannequinOutfit(tx, ty) || {
          ownerAccountId: String(currentWorldLock && currentWorldLock.ownerAccountId || playerProfileId || "").trim().slice(0, 64),
          ownerName: String(currentWorldLock && currentWorldLock.ownerName || playerName || "").trim().slice(0, 20),
          equippedCosmetics: createEmptyMannequinOutfit(),
          updatedAt: Date.now()
        };
        const nextOutfit = createEmptyMannequinOutfit();
        const currentOutfit = current.equippedCosmetics && typeof current.equippedCosmetics === "object"
          ? current.equippedCosmetics
          : {};
        for (let i = 0; i < COSMETIC_SLOTS.length; i++) {
          const currentSlot = COSMETIC_SLOTS[i];
          const currentId = String(currentOutfit[currentSlot] || "").trim();
          nextOutfit[currentSlot] = currentId && COSMETIC_LOOKUP[currentSlot] && COSMETIC_LOOKUP[currentSlot][currentId]
            ? currentId
            : "";
        }
        const previousId = String(nextOutfit[slot] || "").trim();
        if (previousId === cosmeticId) {
          result.handled = true;
          return result;
        }
        if (previousId) {
          cosmeticInventory[previousId] = clampInventoryCount((cosmeticInventory[previousId] || 0) + 1);
        }
        cosmeticInventory[cosmeticId] = Math.max(0, Math.floor(Number(cosmeticInventory[cosmeticId] || 0) - 1));
        if ((cosmeticInventory[cosmeticId] || 0) <= 0) {
          for (let i = 0; i < COSMETIC_SLOTS.length; i++) {
            const equippedSlot = COSMETIC_SLOTS[i];
            if (equippedCosmetics[equippedSlot] === cosmeticId) equippedCosmetics[equippedSlot] = "";
          }
        }
        nextOutfit[slot] = cosmeticId;
        saveMannequinOutfit(tx, ty, {
          ownerAccountId: String(currentWorldLock && currentWorldLock.ownerAccountId || current.ownerAccountId || playerProfileId || "").trim().slice(0, 64),
          ownerName: String(currentWorldLock && currentWorldLock.ownerName || current.ownerName || playerName || "").trim().slice(0, 20),
          equippedCosmetics: nextOutfit,
          updatedAt: Date.now()
        });
        saveInventory();
        refreshToolbar();
        syncPlayer(true);
        result.handled = true;
        return result;
      }

      function grantDisplayItemToInventory(item) {
        const normalized = normalizeDisplayItemRecord(item);
        if (!normalized) return false;
        if (normalized.type === "cosmetic") {
          const cosmeticId = normalized.cosmeticId;
          if (!cosmeticId) return false;
          cosmeticInventory[cosmeticId] = Math.max(0, Math.floor((cosmeticInventory[cosmeticId] || 0) + 1));
          saveInventory();
          refreshToolbar();
          syncPlayer(true);
          return true;
        }
        const blockId = normalized.blockId;
        if (!blockId || !INVENTORY_IDS.includes(blockId)) return false;
        inventory[blockId] = Math.max(0, Math.floor((inventory[blockId] || 0) + 1));
        saveInventory();
        refreshToolbar();
        return true;
      }

      function tryPlaceItemIntoDisplay(tx, ty, entry) {
        if (!inWorld) return false;
        if (!entry || (entry.type !== "block" && entry.type !== "cosmetic")) return false;
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return false;
        if (world[ty][tx] !== DISPLAY_BLOCK_ID) return false;
        if (!canEditTarget(tx, ty)) return false;
        if (!canEditCurrentWorld()) {
          notifyWorldLockedDenied();
          return false;
        }

        const maxAmount = getMaxDroppableAmount(entry);
        if (maxAmount <= 0) return false;

        const existing = getLocalDisplayItem(tx, ty);
        if (existing) {
          grantDisplayItemToInventory(existing);
        }

        if (entry.type === "cosmetic") {
          const cosmeticId = String(entry.cosmeticId || "");
          if (!cosmeticId || (cosmeticInventory[cosmeticId] || 0) <= 0) return false;
          cosmeticInventory[cosmeticId] = Math.max(0, Math.floor((cosmeticInventory[cosmeticId] || 0) - 1));
          if ((cosmeticInventory[cosmeticId] || 0) <= 0) {
            for (let i = 0; i < COSMETIC_SLOTS.length; i++) {
              const slot = COSMETIC_SLOTS[i];
              if (equippedCosmetics[slot] === cosmeticId) equippedCosmetics[slot] = "";
            }
          }
          saveDisplayItem(tx, ty, { type: "cosmetic", cosmeticId, updatedAt: Date.now() });
          saveInventory();
          refreshToolbar();
          syncPlayer(true);
          return true;
        }

        const blockId = Math.max(0, Math.floor(Number(entry.blockId) || 0));
        if (!blockId || !INVENTORY_IDS.includes(blockId) || (inventory[blockId] || 0) <= 0) return false;
        inventory[blockId] = Math.max(0, Math.floor((inventory[blockId] || 0) - 1));
        saveDisplayItem(tx, ty, { type: "block", blockId, updatedAt: Date.now() });
        saveInventory();
        refreshToolbar();
        return true;
      }

      function closeSignModal() {
        const ctrl = getSignController();
        if (!ctrl || typeof ctrl.closeModal !== "function") return;
        ctrl.closeModal();
      }

      function saveSignText(tx, ty, rawText) {
        const ctrl = getSignController();
        if (!ctrl || typeof ctrl.saveText !== "function") return;
        ctrl.saveText(tx, ty, rawText);
      }

      function openSignModal(tx, ty) {
        const ctrl = getSignController();
        if (!ctrl || typeof ctrl.openModal !== "function") return;
        ctrl.openModal(tx, ty);
      }

      function closeSplicingModal() {
        const ctrl = getSplicingController();
        if (!ctrl || typeof ctrl.closeModal !== "function") return;
        ctrl.closeModal();
      }

      function openSplicingModal(tx, ty) {
        const ctrl = getSplicingController();
        if (!ctrl || typeof ctrl.openModal !== "function") return;
        ctrl.openModal(tx, ty);
      }

      function normalizeVendingRecord(value) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.normalizeRecord !== "function") return null;
        return ctrl.normalizeRecord(value);
      }

      function setLocalVendingMachine(tx, ty, value) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.setLocal !== "function") return;
        ctrl.setLocal(tx, ty, value);
      }

      function getLocalVendingMachine(tx, ty) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.getLocal !== "function") return null;
        return ctrl.getLocal(tx, ty);
      }

      function setLocalGambleMachine(tx, ty, value) {
        const ctrl = getGambleController();
        if (!ctrl || typeof ctrl.setLocal !== "function") return;
        ctrl.setLocal(tx, ty, value);
        if (typeof ctrl.isOpen === "function" && ctrl.isOpen() && typeof ctrl.renderOpen === "function") {
          ctrl.renderOpen();
        }
      }

      function getLocalGambleMachine(tx, ty) {
        const ctrl = getGambleController();
        if (!ctrl || typeof ctrl.getLocal !== "function") return null;
        return ctrl.getLocal(tx, ty);
      }

      function canManageVending(vm) {
        return Boolean(vm && playerProfileId && vm.ownerAccountId === playerProfileId);
      }

      function getActiveSellableBlockId() {
        const selectedId = slotOrder[selectedSlot];
        if (typeof selectedId === "number" && INVENTORY_IDS.includes(selectedId) && selectedId !== VENDING_ID) {
          return selectedId;
        }
        return 0;
      }

      function selectVendingBlockForSale(defaultId) {
        const defaultKey = defaultId ? getBlockKeyById(defaultId) : "";
        const text = window.prompt("Sell which block? Enter block key or id (e.g. wood_block).", defaultKey);
        if (!text) return 0;
        const parsed = parseBlockRef(text);
        if (!INVENTORY_IDS.includes(parsed) || parsed === VENDING_ID) return 0;
        return parsed;
      }

      function promptPositiveInt(message, fallback) {
        const raw = window.prompt(message, String(fallback || 1));
        if (!raw) return 0;
        const value = Math.floor(Number(raw));
        if (!Number.isInteger(value) || value <= 0) return 0;
        return value;
      }

      function normalizeWorldLock(value) {
        if (!value || typeof value !== "object") return null;
        const ownerAccountId = (value.ownerAccountId || "").toString();
        if (!ownerAccountId) return null;
        const lockBlockIdRaw = Math.floor(Number(value.lockBlockId));
        const lockBlockId = LOCK_BLOCK_ID_SET.has(lockBlockIdRaw) ? lockBlockIdRaw : WORLD_LOCK_ID;
        const adminsRaw = value.admins && typeof value.admins === "object" ? value.admins : {};
        const admins = {};
        for (const [accountId, entry] of Object.entries(adminsRaw)) {
          const safeAccountId = String(accountId || "").trim();
          if (!safeAccountId || safeAccountId === ownerAccountId) continue;
          const username = entry && typeof entry === "object"
            ? normalizeUsername((entry.username || "").toString())
            : "";
          admins[safeAccountId] = {
            username: username || ""
          };
        }
        const bansRaw = value.bans && typeof value.bans === "object" ? value.bans : {};
        const bans = {};
        for (const [accountId, entry] of Object.entries(bansRaw)) {
          const safeAccountId = String(accountId || "").trim();
          if (!safeAccountId || safeAccountId === ownerAccountId) continue;
          const row = entry && typeof entry === "object" ? entry : {};
          const username = normalizeUsername((row.username || "").toString()) || "";
          const byUsername = normalizeUsername((row.byUsername || "").toString()) || "";
          const expiresAtRaw = Number(row.expiresAt);
          const expiresAt = Number.isFinite(expiresAtRaw) ? Math.max(0, Math.floor(expiresAtRaw)) : 0;
          bans[safeAccountId] = {
            username,
            byAccountId: String(row.byAccountId || "").trim(),
            byUsername,
            createdAt: typeof row.createdAt === "number" ? row.createdAt : 0,
            expiresAt
          };
        }
        return {
          ownerAccountId,
          ownerName: (value.ownerName || "").toString(),
          lockBlockId,
          tx: Number.isInteger(value.tx) ? value.tx : Number(value.tx) || 0,
          ty: Number.isInteger(value.ty) ? value.ty : Number(value.ty) || 0,
          createdAt: typeof value.createdAt === "number" ? value.createdAt : 0,
          admins,
          bans
        };
      }

      function normalizeOwnerTaxRecord(value) {
        if (!value || typeof value !== "object") return null;
        const tx = Math.floor(Number(value.tx));
        const ty = Math.floor(Number(value.ty));
        if (!Number.isInteger(tx) || !Number.isInteger(ty)) return null;
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return null;
        const percentRaw = value.taxPercent !== undefined ? value.taxPercent : value.percent;
        const percent = Math.max(0, Math.min(100, Math.floor(Number(percentRaw) || 0)));
        return {
          tx,
          ty,
          percent,
          ownerAccountId: String(value.ownerAccountId || "").trim(),
          ownerName: String(value.ownerName || "").trim().slice(0, 20),
          earningsLocks: Math.max(0, Math.floor(Number(value.earningsLocks) || 0)),
          updatedAt: Number(value.updatedAt) || 0
        };
      }

      function setLocalWorldTax(value) {
        currentWorldTax = normalizeOwnerTaxRecord(value);
        if (ownerTaxModalEl && !ownerTaxModalEl.classList.contains("hidden")) {
          renderOwnerTaxModal();
        }
      }

      function hasOwnerTaxBlockInWorld(exceptTx, exceptTy) {
        const skipTx = Number.isInteger(exceptTx) ? exceptTx : -1;
        const skipTy = Number.isInteger(exceptTy) ? exceptTy : -1;
        for (let y = 0; y < WORLD_H; y++) {
          const row = world[y];
          if (!row) continue;
          for (let x = 0; x < WORLD_W; x++) {
            if (x === skipTx && y === skipTy) continue;
            if (row[x] === TAX_BLOCK_ID) return true;
          }
        }
        return false;
      }

      function getCurrentWorldTaxPolicy() {
        const lockOwnerAccountId = String(currentWorldLock && currentWorldLock.ownerAccountId || "").trim();
        const lockOwnerName = String(currentWorldLock && currentWorldLock.ownerName || "").trim().slice(0, 20);
        const tax = normalizeOwnerTaxRecord(currentWorldTax);
        const hasTaxBlock = Boolean(
          tax &&
          world[tax.ty] &&
          world[tax.ty][tax.tx] === TAX_BLOCK_ID
        );
        const percent = tax ? Math.max(0, Math.min(100, Math.floor(Number(tax.percent) || 0))) : 0;
        const enabled = Boolean(lockOwnerAccountId && hasTaxBlock && percent > 0);
        return {
          enabled,
          percent,
          ownerAccountId: lockOwnerAccountId,
          ownerName: lockOwnerName,
          tx: tax ? tax.tx : -1,
          ty: tax ? tax.ty : -1,
          earningsLocks: tax ? Math.max(0, Math.floor(Number(tax.earningsLocks) || 0)) : 0
        };
      }

      function addOwnerTaxToLocalBank(amountRaw) {
        const amount = Math.max(0, Math.floor(Number(amountRaw) || 0));
        if (amount <= 0) return true;
        const policy = getCurrentWorldTaxPolicy();
        if (!policy.enabled) return false;
        if (!world[policy.ty] || world[policy.ty][policy.tx] !== TAX_BLOCK_ID) return false;
        const currentTax = normalizeOwnerTaxRecord(currentWorldTax);
        const nextBank = Math.max(0, Math.floor(Number(currentTax && currentTax.earningsLocks) || 0)) + amount;
        setLocalWorldTax({
          tx: policy.tx,
          ty: policy.ty,
          taxPercent: Math.max(0, Math.min(100, Math.floor(Number(policy.percent) || 0))),
          ownerAccountId: String(policy.ownerAccountId || "").trim(),
          ownerName: String(policy.ownerName || "").trim().slice(0, 20),
          earningsLocks: nextBank,
          updatedAt: Date.now()
        });
        return true;
      }

      function saveOwnerTaxConfig(tx, ty, percent) {
        if (!world[ty] || world[ty][tx] !== TAX_BLOCK_ID) {
          postLocalSystemChat("Owner Tax Machine not found.");
          return;
        }
        if (!isWorldLocked()) {
          postLocalSystemChat("Owner tax needs an active world lock.");
          return;
        }
        if (!isWorldLockOwner()) {
          notifyOwnerOnlyWorldEdit("owner tax settings");
          return;
        }
        const safePercent = Math.max(0, Math.min(100, Math.floor(Number(percent) || 0)));
        const currentTax = normalizeOwnerTaxRecord(currentWorldTax);
        const ownerAccountId = String(currentWorldLock && currentWorldLock.ownerAccountId || "").trim();
        const ownerName = String(currentWorldLock && currentWorldLock.ownerName || "").trim().slice(0, 20);
        if (network.enabled && network.ownerTaxRef) {
          network.ownerTaxRef.transaction((currentRaw) => {
            const current = currentRaw && typeof currentRaw === "object" ? currentRaw : {};
            const existing = normalizeOwnerTaxRecord(current) || currentTax;
            const earningsLocks = existing ? Math.max(0, Math.floor(Number(existing.earningsLocks) || 0)) : 0;
            return {
              tx,
              ty,
              taxPercent: safePercent,
              ownerAccountId,
              ownerName,
              earningsLocks,
              updatedAt: (
                typeof firebase !== "undefined" &&
                firebase &&
                firebase.database &&
                firebase.database.ServerValue &&
                firebase.database.ServerValue.TIMESTAMP
              ) ? firebase.database.ServerValue.TIMESTAMP : Date.now()
            };
          }).then((txn) => {
            if (!txn || !txn.committed) {
              postLocalSystemChat("Failed to save owner tax.");
              return;
            }
            setLocalWorldTax(txn.snapshot && typeof txn.snapshot.val === "function" ? txn.snapshot.val() : null);
            postLocalSystemChat("Owner tax set to " + safePercent + "%.");
          }).catch(() => {
            postLocalSystemChat("Failed to save owner tax.");
          });
          return;
        }
        const payload = {
          tx,
          ty,
          taxPercent: safePercent,
          ownerAccountId,
          ownerName,
          earningsLocks: currentTax ? Math.max(0, Math.floor(Number(currentTax.earningsLocks) || 0)) : 0,
          updatedAt: Date.now()
        };
        setLocalWorldTax(payload);
        postLocalSystemChat("Owner tax set to " + safePercent + "%.");
      }

      function collectOwnerTaxEarnings(tx, ty) {
        if (!world[ty] || world[ty][tx] !== TAX_BLOCK_ID) return;
        if (!isWorldLocked()) {
          postLocalSystemChat("Owner tax needs an active world lock.");
          return;
        }
        if (!isWorldLockOwner()) {
          notifyOwnerOnlyWorldEdit("owner tax earnings");
          return;
        }
        const currentTax = normalizeOwnerTaxRecord(currentWorldTax);
        if (!currentTax || currentTax.tx !== tx || currentTax.ty !== ty) {
          postLocalSystemChat("No owner tax data found for this block.");
          return;
        }
        const amount = Math.max(0, Math.floor(Number(currentTax.earningsLocks) || 0));
        if (amount <= 0) {
          postLocalSystemChat("No tax earnings to collect.");
          return;
        }
        const profileId = String(playerProfileId || "");
        if (!network.enabled || !network.ownerTaxRef || !network.db || !profileId) {
          addLockValue(inventory, amount);
          setLocalWorldTax({ ...currentTax, earningsLocks: 0, updatedAt: Date.now() });
          if (typeof saveInventory === "function") saveInventory(false);
          if (typeof refreshToolbar === "function") refreshToolbar(true);
          postLocalSystemChat("Collected " + amount + " WL from owner Tax Machine.");
          return;
        }

        let collected = 0;
        network.ownerTaxRef.transaction((currentRaw) => {
          const current = normalizeOwnerTaxRecord(currentRaw);
          if (!current || current.tx !== tx || current.ty !== ty) return currentRaw;
          collected = Math.max(0, Math.floor(Number(current.earningsLocks) || 0));
          if (collected <= 0) return currentRaw;
          return {
            ...currentRaw,
            tx: current.tx,
            ty: current.ty,
            taxPercent: current.percent,
            earningsLocks: 0,
            ownerAccountId: String(current.ownerAccountId || currentWorldLock && currentWorldLock.ownerAccountId || "").trim(),
            ownerName: String(current.ownerName || currentWorldLock && currentWorldLock.ownerName || "").trim().slice(0, 20),
            updatedAt: (
              typeof firebase !== "undefined" &&
              firebase &&
              firebase.database &&
              firebase.database.ServerValue &&
              firebase.database.ServerValue.TIMESTAMP
            ) ? firebase.database.ServerValue.TIMESTAMP : Date.now()
          };
        }).then((taxTxn) => {
          if (!taxTxn || !taxTxn.committed || collected <= 0) {
            postLocalSystemChat("No tax earnings to collect.");
            return null;
          }
          const raw = taxTxn.snapshot && typeof taxTxn.snapshot.val === "function" ? taxTxn.snapshot.val() : null;
          setLocalWorldTax(raw);
          const invRef = network.db.ref(BASE_PATH + "/player-inventories/" + profileId);
          return invRef.transaction((currentRaw) => {
            const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
            addLockValue(current, collected);
            return current;
          }).then(() => ({ collected })).catch(() => {
            return network.ownerTaxRef.transaction((currentRaw) => {
              const current = normalizeOwnerTaxRecord(currentRaw);
              if (!current || current.tx !== tx || current.ty !== ty) return currentRaw;
              return {
                ...currentRaw,
                tx: current.tx,
                ty: current.ty,
                taxPercent: current.percent,
                earningsLocks: Math.max(0, Math.floor(Number(current.earningsLocks) || 0)) + collected,
                ownerAccountId: String(current.ownerAccountId || currentWorldLock && currentWorldLock.ownerAccountId || "").trim(),
                ownerName: String(current.ownerName || currentWorldLock && currentWorldLock.ownerName || "").trim().slice(0, 20),
                updatedAt: (
                  typeof firebase !== "undefined" &&
                  firebase &&
                  firebase.database &&
                  firebase.database.ServerValue &&
                  firebase.database.ServerValue.TIMESTAMP
                ) ? firebase.database.ServerValue.TIMESTAMP : Date.now()
              };
            }).then((rollbackTxn) => {
              if (rollbackTxn && rollbackTxn.committed) {
                setLocalWorldTax(rollbackTxn.snapshot && typeof rollbackTxn.snapshot.val === "function" ? rollbackTxn.snapshot.val() : null);
              }
              return null;
            }).catch(() => null);
          });
        }).then((done) => {
          if (!done) return;
          if (typeof saveInventory === "function") saveInventory(false);
          if (typeof refreshToolbar === "function") refreshToolbar(true);
          postLocalSystemChat("Collected " + done.collected + " WL from owner Tax Machine.");
        }).catch(() => {
          postLocalSystemChat("Failed to collect owner tax earnings.");
        });
      }

      function closeOwnerTaxModal() {
        ownerTaxEditContext = null;
        if (ownerTaxModalEl) ownerTaxModalEl.classList.add("hidden");
      }

      function renderOwnerTaxModal() {
        if (!ownerTaxModalEl || !ownerTaxTitleEl || !ownerTaxPercentInputEl || !ownerTaxBankLabelEl) return;
        if (!ownerTaxEditContext) {
          closeOwnerTaxModal();
          return;
        }
        const tx = Number(ownerTaxEditContext.tx);
        const ty = Number(ownerTaxEditContext.ty);
        if (!Number.isInteger(tx) || !Number.isInteger(ty)) {
          closeOwnerTaxModal();
          return;
        }
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H || !world[ty] || world[ty][tx] !== TAX_BLOCK_ID) {
          closeOwnerTaxModal();
          return;
        }
        if (!isWorldLocked() || !isWorldLockOwner()) {
          closeOwnerTaxModal();
          return;
        }
        const currentTax = normalizeOwnerTaxRecord(currentWorldTax);
        const currentPercent = currentTax && currentTax.tx === tx && currentTax.ty === ty
          ? currentTax.percent
          : 0;
        const currentBank = currentTax && currentTax.tx === tx && currentTax.ty === ty
          ? Math.max(0, Math.floor(Number(currentTax.earningsLocks) || 0))
          : 0;
        ownerTaxTitleEl.textContent = "Owner Tax Machine (" + tx + "," + ty + ")";
        ownerTaxPercentInputEl.value = String(currentPercent);
        ownerTaxBankLabelEl.textContent = currentBank + " WL";
        if (ownerTaxCollectBtn) ownerTaxCollectBtn.disabled = currentBank <= 0;
      }

      function openOwnerTaxModal(tx, ty) {
        if (!ownerTaxModalEl || !ownerTaxTitleEl) return;
        if (!world[ty] || world[ty][tx] !== TAX_BLOCK_ID) return;
        if (!isWorldLocked()) {
          postLocalSystemChat("Owner tax needs an active world lock.");
          return;
        }
        if (!isWorldLockOwner()) {
          notifyOwnerOnlyWorldEdit("owner tax settings");
          return;
        }
        ownerTaxEditContext = { tx, ty };
        renderOwnerTaxModal();
        ownerTaxModalEl.classList.remove("hidden");
      }

      function getWorldBanStatusForAccount(lock, accountId, nowMs) {
        const now = Number(nowMs) || Date.now();
        const safeAccountId = String(accountId || "").trim();
        if (!lock || !safeAccountId || !lock.bans || !lock.bans[safeAccountId]) return { active: false, permanent: false, remainingMs: 0 };
        const row = lock.bans[safeAccountId] || {};
        const expiresAt = Math.floor(Number(row.expiresAt) || 0);
        if (expiresAt > 0 && expiresAt <= now) return { active: false, permanent: false, remainingMs: 0 };
        if (expiresAt <= 0) return { active: true, permanent: true, remainingMs: Infinity };
        return { active: true, permanent: false, remainingMs: Math.max(0, expiresAt - now) };
      }

      function getCurrentWorldBanStatus() {
        return getWorldBanStatusForAccount(currentWorldLock, playerProfileId, Date.now());
      }

      function ensureNotWorldBanned(lock, worldId) {
        const ban = getWorldBanStatusForAccount(lock, playerProfileId, Date.now());
        if (!ban.active) return true;
        const worldLabel = (worldId || currentWorldId || "this world").toString();
        if (ban.permanent) {
          postLocalSystemChat("You are banned from " + worldLabel + " until the owner unbans you.");
        } else {
          postLocalSystemChat("You are banned from " + worldLabel + " for " + formatRemainingMs(ban.remainingMs) + ".");
        }
        return false;
      }

      function isWorldLocked() {
        return Boolean(currentWorldLock && currentWorldLock.ownerAccountId);
      }

      function isWorldLockOwner() {
        return Boolean(playerProfileId && currentWorldLock && currentWorldLock.ownerAccountId === playerProfileId);
      }

      function isWorldLockBlockId(id) {
        return LOCK_BLOCK_ID_SET.has(Number(id));
      }

      function getCurrentWorldLockBlockId() {
        const id = Math.floor(Number(currentWorldLock && currentWorldLock.lockBlockId));
        return isWorldLockBlockId(id) ? id : WORLD_LOCK_ID;
      }

      function isWorldLockAdmin() {
        if (!playerProfileId || !currentWorldLock || !currentWorldLock.admins) return false;
        if (isWorldLockOwner()) return false;
        return Boolean(currentWorldLock.admins[playerProfileId]);
      }

      function canEditCurrentWorld() {
        const questCtrl = getQuestWorldController();
        const questWorldActive = Boolean(questCtrl && typeof questCtrl.isActive === "function" && questCtrl.isActive());
        if (questWorldActive) {
          return normalizeAdminRole(currentAdminRole) === "owner";
        }
        if (!isWorldLocked()) return true;
        return isWorldLockOwner() || isWorldLockAdmin();
      }

      function notifyWorldLockedDenied() {
        const questCtrl = getQuestWorldController();
        const questWorldActive = Boolean(questCtrl && typeof questCtrl.isActive === "function" && questCtrl.isActive());
        if (questWorldActive && normalizeAdminRole(currentAdminRole) !== "owner") {
          const nowQuest = performance.now();
          if (nowQuest - lastLockDeniedNoticeAt < 900) return;
          lastLockDeniedNoticeAt = nowQuest;
          postLocalSystemChat("Quest world is read-only. Only owner admins can edit it.");
          return;
        }
        const now = performance.now();
        if (now - lastLockDeniedNoticeAt < 900) return;
        lastLockDeniedNoticeAt = now;
        const owner = currentWorldLock && currentWorldLock.ownerName ? currentWorldLock.ownerName : "owner";
        postLocalSystemChat("World is locked by @" + owner + ".");
      }

      function notifyOwnerOnlyWorldEdit(partName) {
        const name = (partName || "this").toString();
        postLocalSystemChat("Only the world owner can edit " + name + ".");
      }

      async function resolveAccountIdByUsername(username) {
        if (!network.enabled || !network.db) return "";
        const normalized = normalizeUsername(username);
        if (!normalized) return "";
        try {
          const snap = await network.db.ref(BASE_PATH + "/usernames/" + normalized).once("value");
          const accountId = (snap && snap.val ? snap.val() : "").toString();
          return accountId || "";
        } catch (error) {
          return "";
        }
      }

      function closeWorldLockModal() {
        worldLockEditContext = null;
        if (worldLockModalEl) worldLockModalEl.classList.add("hidden");
      }

      function getWorldLockAdminsList() {
        if (!currentWorldLock || !currentWorldLock.admins) return [];
        return Object.entries(currentWorldLock.admins)
          .map(([accountId, data]) => {
            const username = normalizeUsername(data && data.username ? data.username : "") || accountId;
            return { accountId, username };
          })
          .sort((a, b) => a.username.localeCompare(b.username));
      }

      function getWorldLockBansList() {
        if (!currentWorldLock || !currentWorldLock.bans) return [];
        const now = Date.now();
        return Object.entries(currentWorldLock.bans)
          .map(([accountId, data]) => {
            const username = normalizeUsername(data && data.username ? data.username : "") || accountId;
            const status = getWorldBanStatusForAccount(currentWorldLock, accountId, now);
            return { accountId, username, status, expiresAt: Math.floor(Number(data && data.expiresAt) || 0) };
          })
          .filter((row) => row.status.active)
          .sort((a, b) => a.username.localeCompare(b.username));
      }

      function renderWorldLockModal() {
        if (!worldLockModalEl || !worldLockTitleEl || !worldLockAdminsEl || !worldLockBansEl) return;
        const owner = (currentWorldLock && currentWorldLock.ownerName ? currentWorldLock.ownerName : "owner").toString();
        worldLockTitleEl.textContent = "World Lock - @" + owner;
        const rows = getWorldLockAdminsList();
        if (!rows.length) {
          worldLockAdminsEl.innerHTML = "<div class='worldlock-admin-empty'>No world admins.</div>";
        } else {
          worldLockAdminsEl.innerHTML = rows.map((row) => {
            return "<div class='worldlock-admin-row'>" +
              "<span class='worldlock-admin-name'>@" + escapeHtml(row.username) + "</span>" +
              "<button type='button' data-worldlock-remove='" + escapeHtml(row.accountId) + "'>Remove</button>" +
              "</div>";
          }).join("");
        }
        const bans = getWorldLockBansList();
        if (!bans.length) {
          worldLockBansEl.innerHTML = "<div class='worldlock-admin-empty'>No world bans.</div>";
        } else {
          worldLockBansEl.innerHTML = bans.map((row) => {
            const statusText = row.status.permanent ? "Perm" : ("1h (" + formatRemainingMs(row.status.remainingMs) + ")");
            return "<div class='worldlock-admin-row'>" +
              "<span class='worldlock-admin-name'>@" + escapeHtml(row.username) + " - " + escapeHtml(statusText) + "</span>" +
              "<button type='button' data-worldlock-unban='" + escapeHtml(row.accountId) + "'>Unban</button>" +
              "</div>";
          }).join("");
        }
      }

      function openWorldLockModal(tx, ty) {
        if (!worldLockModalEl) return;
        if (!isWorldLocked() || !isWorldLockOwner()) {
          notifyWorldLockedDenied();
          return;
        }
        const lockTx = Number(currentWorldLock && currentWorldLock.tx);
        const lockTy = Number(currentWorldLock && currentWorldLock.ty);
        if (!Number.isInteger(lockTx) || !Number.isInteger(lockTy) || tx !== lockTx || ty !== lockTy) return;
        worldLockEditContext = { tx, ty };
        if (worldLockAdminInputEl) worldLockAdminInputEl.value = "";
        if (worldLockBanInputEl) worldLockBanInputEl.value = "";
        renderWorldLockModal();
        worldLockModalEl.classList.remove("hidden");
      }

      function closeTradeMenuModal() {
        const ctrl = getTradeController();
        if (!ctrl || typeof ctrl.closeAll !== "function") return;
        ctrl.closeAll();
      }

      function closeTradeRequestModal() {
        const ctrl = getTradeController();
        if (!ctrl || typeof ctrl.closeRequestModal !== "function") return;
        ctrl.closeRequestModal();
      }

      function showIncomingTradeRequest(req) {
        const ctrl = getTradeController();
        if (!ctrl || typeof ctrl.onTradeRequest !== "function") return;
        ctrl.onTradeRequest(req);
      }

      function respondToTradeRequest(accept) {
        const ctrl = getTradeController();
        if (!ctrl || typeof ctrl.respondToTradeRequest !== "function") return;
        ctrl.respondToTradeRequest(accept);
      }

      function removeWorldAdmin(accountId) {
        if (!network.enabled || !network.lockRef || !isWorldLocked() || !isWorldLockOwner()) return;
        const safeAccountId = (accountId || "").toString().trim();
        if (!safeAccountId || safeAccountId === currentWorldLock.ownerAccountId) return;
        network.lockRef.child("admins").child(safeAccountId).remove()
          .then(() => {
            postLocalSystemChat("Removed world admin.");
          })
          .catch(() => {
            postLocalSystemChat("Failed to remove world admin.");
          });
      }

      async function addWorldAdminByUsername(rawUsername) {
        if (!network.enabled || !network.lockRef || !isWorldLocked() || !isWorldLockOwner()) return;
        const username = normalizeUsername(rawUsername);
        if (!username) {
          postLocalSystemChat("Enter a valid username.");
          return;
        }
        const accountId = await resolveAccountIdByUsername(username);
        if (!accountId) {
          postLocalSystemChat("User not found.");
          return;
        }
        if (accountId === currentWorldLock.ownerAccountId) {
          postLocalSystemChat("Owner already has full access.");
          return;
        }
        network.lockRef.child("admins").child(accountId).set({
          username,
          addedBy: playerProfileId || "",
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
          postLocalSystemChat("Added @" + username + " as world admin.");
          if (worldLockAdminInputEl) worldLockAdminInputEl.value = "";
        }).catch(() => {
          postLocalSystemChat("Failed to add world admin.");
        });
      }

      async function setWorldBanByUsername(rawUsername, durationMs) {
        if (!network.enabled || !network.lockRef || !isWorldLocked() || !isWorldLockOwner()) return;
        const username = normalizeUsername(rawUsername);
        if (!username) {
          postLocalSystemChat("Enter a valid username.");
          return;
        }
        const accountId = await resolveAccountIdByUsername(username);
        if (!accountId) {
          postLocalSystemChat("User not found.");
          return;
        }
        if (accountId === currentWorldLock.ownerAccountId) {
          postLocalSystemChat("You cannot ban the world owner.");
          return;
        }
        const expiresAt = Number(durationMs) > 0 ? (Date.now() + Math.floor(Number(durationMs))) : 0;
        network.lockRef.child("bans").child(accountId).set({
          username,
          byAccountId: playerProfileId || "",
          byUsername: normalizeUsername(playerName || "") || "",
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          expiresAt
        }).then(() => {
          postLocalSystemChat("Banned @" + username + (expiresAt > 0 ? " for 1 hour." : " until unban."));
        }).catch(() => {
          postLocalSystemChat("Failed to ban user.");
        });
      }

      function unbanWorldPlayer(accountId) {
        if (!network.enabled || !network.lockRef || !isWorldLocked() || !isWorldLockOwner()) return;
        const safeAccountId = (accountId || "").toString().trim();
        if (!safeAccountId) return;
        network.lockRef.child("bans").child(safeAccountId).remove()
          .then(() => {
            postLocalSystemChat("Player unbanned from world.");
          })
          .catch(() => {
            postLocalSystemChat("Failed to unban player.");
          });
      }

      function isProtectedSpawnTile(tx, ty) {
        return getProtectedTileRequiredId(tx, ty) > 0;
      }

      function rectCollides(x, y, w, h) {
        if (typeof physicsModule.rectCollides === "function") {
          return physicsModule.rectCollides(world, blockDefs, x, y, w, h, TILE, WORLD_W, WORLD_H, isSolidTile);
        }
        const left = Math.floor(x / TILE);
        const right = Math.floor((x + w - 1) / TILE);
        const top = Math.floor(y / TILE);
        const bottom = Math.floor((y + h - 1) / TILE);

        for (let ty = top; ty <= bottom; ty++) {
          for (let tx = left; tx <= right; tx++) {
            if (isSolidTile(tx, ty)) return true;
          }
        }
        return false;
      }

      function rectTouchesLiquid(x, y, w, h) {
        if (typeof physicsModule.rectTouchesLiquid === "function") {
          return physicsModule.rectTouchesLiquid(world, blockDefs, x, y, w, h, TILE, WORLD_W, WORLD_H);
        }
        const left = Math.floor(x / TILE);
        const right = Math.floor((x + w - 1) / TILE);
        const top = Math.floor(y / TILE);
        const bottom = Math.floor((y + h - 1) / TILE);
        for (let ty = top; ty <= bottom; ty++) {
          for (let tx = left; tx <= right; tx++) {
            if (isLiquidTile(tx, ty)) return true;
          }
        }
        return false;
      }

      function getStairSurfaceY(id, tx, ty, worldX) {
        if (typeof physicsModule.getStairSurfaceY === "function") {
          return physicsModule.getStairSurfaceY(id, tx, ty, worldX, TILE);
        }
        const localX = Math.max(0, Math.min(1, (worldX - tx * TILE) / TILE));
        let localY = localX;
        if (id === 14 || id === 15) localY = 1 - localX;
        return ty * TILE + localY * TILE;
      }

      function snapPlayerToStairSurface() {
        if (typeof physicsModule.snapPlayerToStairSurface === "function") {
          return physicsModule.snapPlayerToStairSurface(player, world, blockDefs, STAIR_ROTATION_IDS, TILE, PLAYER_W, PLAYER_H, WORLD_W, WORLD_H);
        }
        const footLeftX = player.x + 3;
        const footRightX = player.x + PLAYER_W - 3;
        const footCenterX = player.x + PLAYER_W * 0.5;
        const bottomY = player.y + PLAYER_H;
        const checkFeet = [footLeftX, footCenterX, footRightX];
        let targetBottom = Infinity;
        let found = false;
        for (let i = 0; i < checkFeet.length; i++) {
          const fx = checkFeet[i];
          const tx = Math.floor(fx / TILE);
          const baseTy = Math.floor((bottomY - 1) / TILE);
          for (let yOff = -1; yOff <= 1; yOff++) {
            const ty = baseTy + yOff;
            if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) continue;
            const id = world[ty][tx];
            if (!isStairTileId(id)) continue;
            const surfaceY = getStairSurfaceY(id, tx, ty, fx);
            if (bottomY < surfaceY - 6 || bottomY > surfaceY + 8) continue;
            const testY = surfaceY - PLAYER_H;
            if (rectCollides(player.x, testY, PLAYER_W, PLAYER_H)) continue;
            targetBottom = Math.min(targetBottom, surfaceY);
            found = true;
          }
        }
        if (!found) return false;
        player.y = targetBottom - PLAYER_H;
        player.grounded = true;
        if (player.vy > 0) player.vy = 0;
        return true;
      }

      function rectCollidesOneWayPlatformDownward(x, prevY, nextY, w, h) {
        if (typeof physicsModule.rectCollidesOneWayPlatformDownward === "function") {
          return physicsModule.rectCollidesOneWayPlatformDownward(world, blockDefs, x, prevY, nextY, w, h, TILE, WORLD_W, WORLD_H);
        }
        if (nextY <= prevY) return false;
        const left = Math.floor(x / TILE);
        const right = Math.floor((x + w - 1) / TILE);
        const prevBottom = prevY + h;
        const nextBottom = nextY + h;
        const startTy = Math.floor((prevBottom - 1) / TILE);
        const endTy = Math.floor((nextBottom - 1) / TILE);
        for (let ty = startTy; ty <= endTy; ty++) {
          for (let tx = left; tx <= right; tx++) {
            if (!isOneWayPlatformTile(tx, ty)) continue;
            const tileTop = ty * TILE;
            if (prevBottom <= tileTop + 1 && nextBottom >= tileTop + 1) {
              return true;
            }
          }
        }
        return false;
      }

      function updatePlayer() {
        const moveTowards = (value, target, step) => {
          const v = Number(value) || 0;
          const t = Number(target) || 0;
          const s = Math.max(0, Number(step) || 0);
          if (v < t) return Math.min(t, v + s);
          if (v > t) return Math.max(t, v - s);
          return t;
        };
        if (rectCollides(player.x, player.y, PLAYER_W, PLAYER_H)) {
          ensurePlayerSafeSpawn(true);
        }
        const nowMs = performance.now();
        const moveLeft = keys["KeyA"] || keys["ArrowLeft"] || touchControls.left;
        const moveRight = keys["KeyD"] || keys["ArrowRight"] || touchControls.right;
        const jump = keys["KeyW"] || keys["Space"] || keys["ArrowUp"] || touchControls.jump;
        const jumpPressedThisFrame = jump && !wasJumpHeld;
        if (isFrozenByAdmin) {
          player.vx = 0;
          player.vy = 0;
          currentPhysicsLimits = {
            maxMoveSpeedPerTick: Math.max(0.01, Number(MAX_MOVE_SPEED) || 0),
            maxFallSpeedPerTick: Math.max(0.01, Number(MAX_FALL_SPEED) || 0),
            gravityPerTick: Math.max(0.001, Number(GRAVITY) || 0),
            jumpVelocityPerTick: Math.abs(Number(JUMP_VELOCITY) || 0),
            inWater: false,
            inAntiGravity: false
          };
          wasInWaterLastFrame = rectTouchesLiquid(player.x, player.y, PLAYER_W, PLAYER_H);
          wasJumpHeld = jump;
          return;
        }
        const equippedWings = typeof cosmeticsModule.getEquippedItem === "function"
          ? cosmeticsModule.getEquippedItem("wings", equippedCosmetics, COSMETIC_LOOKUP)
          : null;
        const hasWingDoubleJump = Boolean(equippedWings && equippedWings.doubleJump);
        const equippedShoes = typeof cosmeticsModule.getEquippedItem === "function"
          ? cosmeticsModule.getEquippedItem("shoes", equippedCosmetics, COSMETIC_LOOKUP)
          : null;
        const shoeSpeedBoost = Math.max(-0.3, Math.min(1.5, Number(equippedShoes && equippedShoes.speedBoost) || 0));
        const shoeJumpBoost = Math.max(-0.25, Math.min(1.0, Number(equippedShoes && equippedShoes.jumpBoost) || 0));
        const speedMult = Math.max(0.65, 1 + shoeSpeedBoost);
        const jumpVelocityNow = JUMP_VELOCITY * Math.max(0.7, 1 + shoeJumpBoost);
        const inWater = rectTouchesLiquid(player.x, player.y, PLAYER_W, PLAYER_H);
        const inAntiGravity = isPlayerInAntiGravityField(player.x, player.y, PLAYER_W, PLAYER_H);
        const moveAccelBase = inWater ? MOVE_ACCEL * WATER_MOVE_MULT : MOVE_ACCEL;
        const moveAccel = moveAccelBase * (1 + shoeSpeedBoost * 0.65);
        const maxMoveSpeed = (inWater ? MAX_MOVE_SPEED * WATER_MOVE_MULT : MAX_MOVE_SPEED) * speedMult;
        let gravityNow = inWater ? GRAVITY * WATER_GRAVITY_MULT : GRAVITY;
        let maxFallNow = inWater ? MAX_FALL_SPEED * WATER_FALL_MULT : MAX_FALL_SPEED;
        const airFrictionNow = inWater ? Math.min(0.985, AIR_FRICTION * WATER_FRICTION_MULT) : AIR_FRICTION;
        if (inAntiGravity) {
          gravityNow *= ANTI_GRAV_GRAVITY_MULT;
          maxFallNow *= ANTI_GRAV_FALL_MULT;
        }
        currentPhysicsLimits = {
          maxMoveSpeedPerTick: Math.max(0.01, Number(maxMoveSpeed) || 0),
          maxFallSpeedPerTick: Math.max(0.01, Number(maxFallNow) || 0),
          gravityPerTick: Math.max(0.001, Number(gravityNow) || 0),
          jumpVelocityPerTick: Math.abs(Number(jumpVelocityNow) || 0),
          inWater: Boolean(inWater),
          inAntiGravity: Boolean(inAntiGravity)
        };

        const moveDir = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
        if (moveDir !== 0) {
          const accelStep = player.grounded ? moveAccel : (moveAccel * AIR_CONTROL);
          player.vx = moveTowards(player.vx, moveDir * maxMoveSpeed, accelStep);
          player.facing = moveDir > 0 ? 1 : -1;
        } else if (player.grounded) {
          const stopStep = Math.max(0.1, maxMoveSpeed * 0.16);
          player.vx = moveTowards(player.vx, 0, stopStep);
          if (Math.abs(player.vx) < 0.14) {
            player.vx = 0;
          }
        }
        if (jumpPressedThisFrame && player.grounded && (nowMs - lastJumpAtMs) >= JUMP_COOLDOWN_MS) {
          player.vy = jumpVelocityNow;
          player.grounded = false;
          lastJumpAtMs = nowMs;
          airJumpsUsed = 0;
          triggerWingFlapPulse(0.9);
          playSfxEvent("jump", 0.52, "input", "jump");
        } else if (
          jumpPressedThisFrame &&
          !player.grounded &&
          inAntiGravity &&
          (nowMs - lastAirJumpAtMs) >= ANTI_GRAV_AIR_JUMP_COOLDOWN_MS
        ) {
          player.vy = jumpVelocityNow;
          lastAirJumpAtMs = nowMs;
          triggerWingFlapPulse(1.1);
          playSfxEvent("jump", 0.56, "input", "jump");
        } else if (
          jumpPressedThisFrame &&
          !player.grounded &&
          hasWingDoubleJump &&
          airJumpsUsed < 1 &&
          (nowMs - lastAirJumpAtMs) >= 120
        ) {
          player.vy = jumpVelocityNow;
          lastAirJumpAtMs = nowMs;
          airJumpsUsed += 1;
          triggerWingFlapPulse(1.25);
          playSfxEvent("jump", 0.6, "input", "jump");
        }

        player.vx = Math.max(-maxMoveSpeed, Math.min(maxMoveSpeed, player.vx));
        player.vy += gravityNow;
        player.vy = Math.min(player.vy, maxFallNow);

        if (!player.grounded) {
          player.vx *= airFrictionNow;
        } else if (Math.abs(player.vx) < 0.12) {
          player.vx = 0;
        }

        const tryStepUpOnHorizontalMove = (targetX) => {
          if (Math.abs(player.vx) < 0.01) return false;
          const maxStepPx = 10;
          for (let stepUp = 1; stepUp <= maxStepPx; stepUp++) {
            const testY = player.y - stepUp;
            if (testY < 0) break;
            if (rectCollides(targetX, testY, PLAYER_W, PLAYER_H)) continue;
            const supportedBySolid = rectCollides(targetX, testY + 1, PLAYER_W, PLAYER_H);
            const supportedByPlatform = rectCollidesOneWayPlatformDownward(targetX, testY, testY + 1, PLAYER_W, PLAYER_H);
            if (!supportedBySolid && !supportedByPlatform) continue;
            player.x = targetX;
            player.y = testY;
            return true;
          }
          return false;
        };

        let nextX = player.x + player.vx;
        if (!rectCollides(nextX, player.y, PLAYER_W, PLAYER_H)) {
          player.x = nextX;
        } else {
          if (tryStepUpOnHorizontalMove(nextX)) {
            player.grounded = true;
          } else {
          const step = Math.sign(player.vx);
          while (!rectCollides(player.x + step, player.y, PLAYER_W, PLAYER_H)) {
            player.x += step;
          }
          player.vx = 0;
          }
        }

        let nextY = player.y + player.vy;
        if (player.vy > 0) {
          const hitsSolid = rectCollides(player.x, nextY, PLAYER_W, PLAYER_H);
          const hitsPlatform = rectCollidesOneWayPlatformDownward(player.x, player.y, nextY, PLAYER_W, PLAYER_H);
          if (!hitsSolid && !hitsPlatform) {
            player.y = nextY;
            player.grounded = false;
          } else {
            while (true) {
              const testY = player.y + 1;
              if (rectCollides(player.x, testY, PLAYER_W, PLAYER_H)) break;
              if (rectCollidesOneWayPlatformDownward(player.x, player.y, testY, PLAYER_W, PLAYER_H)) break;
              player.y = testY;
            }
            player.grounded = true;
            player.vy = 0;
          }
        } else if (!rectCollides(player.x, nextY, PLAYER_W, PLAYER_H)) {
          player.y = nextY;
          player.grounded = false;
        } else {
          const step = Math.sign(player.vy);
          while (!rectCollides(player.x, player.y + step, PLAYER_W, PLAYER_H)) {
            player.y += step;
          }
          player.vy = 0;
        }

        if (player.grounded) {
          airJumpsUsed = 0;
        }

        if (particleController && typeof particleController.emitWaterSplash === "function") {
          const enteringWater = inWater && !wasInWaterLastFrame;
          const movingInWater = inWater && Math.abs(player.vx) > 1.05 && player.grounded;
          if ((enteringWater || movingInWater) && (nowMs - lastWaterSplashAtMs) >= 170) {
            lastWaterSplashAtMs = nowMs;
            const intensity = enteringWater
              ? Math.max(7, Math.min(14, Math.round(Math.abs(player.vy) * 2.4)))
              : 5;
            particleController.emitWaterSplash(
              player.x + PLAYER_W / 2,
              player.y + PLAYER_H - 2,
              intensity
            );
          }
        }

        // Only snap to stair surface while descending/landing, never during upward jump.
        if (player.vy >= 0) {
          snapPlayerToStairSurface();
        }

        if (!isGodModeByAdmin && rectTouchesLethal(player.x, player.y, PLAYER_W, PLAYER_H)) {
          if ((nowMs - lastSpikeKillAtMs) >= SPIKE_KILL_COOLDOWN_MS) {
            lastSpikeKillAtMs = nowMs;
            respawnPlayerAtDoor();
            postLocalSystemChat("You were killed by spikes.");
          }
          wasJumpHeld = jump;
          return;
        }

        if (player.y > WORLD_H * TILE) {
          player.x = TILE * 8;
          player.y = TILE * 8;
          player.vx = 0;
          player.vy = 0;
        }

        wasInWaterLastFrame = inWater;
        wasJumpHeld = jump;
      }

      function updateCamera(forceSnap) {
        const viewW = getCameraViewWidth();
        const viewH = getCameraViewHeight();
        const targetX = player.x + PLAYER_W / 2 - viewW / 2;
        const targetY = player.y + PLAYER_H / 2 - viewH / 2;

        if (forceSnap) {
          cameraX = targetX;
          cameraY = targetY;
        } else {
          cameraX += (targetX - cameraX) * 0.12;
          cameraY += (targetY - cameraY) * 0.12;
        }

        cameraX = Math.max(0, Math.min(cameraX, WORLD_W * TILE - viewW));
        cameraY = Math.max(0, Math.min(cameraY, WORLD_H * TILE - viewH));
      }

      function openWrenchMenuFromNameIcon(clientX, clientY) {
        const questCtrl = getQuestWorldController();
        const questWorldActive = Boolean(questCtrl && typeof questCtrl.isActive === "function" && questCtrl.isActive());
        if (questWorldActive && normalizeAdminRole(currentAdminRole) !== "owner") {
          return false;
        }
        const ctrl = getDrawController();
        if (ctrl && typeof ctrl.openWrenchMenuFromNameIcon === "function") {
          return Boolean(ctrl.openWrenchMenuFromNameIcon(clientX, clientY));
        }
        return false;
      }

      function wrapChatText(text, maxTextWidth) {
        const ctrl = getDrawController();
        if (ctrl && typeof ctrl.wrapChatText === "function") {
          return ctrl.wrapChatText(text, maxTextWidth);
        }
        return [String(text || "")];
      }

      function render() {
        const ctrl = getDrawController();
        if (ctrl && typeof ctrl.render === "function") {
          ctrl.render();
        }
      }
      function canEditTarget(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return false;

        const centerX = player.x + PLAYER_W / 2;
        const centerY = player.y + PLAYER_H / 2;
        const targetX = tx * TILE + TILE / 2;
        const targetY = ty * TILE + TILE / 2;
        const dx = targetX - centerX;
        const dy = targetY - centerY;
        const dist = Math.hypot(dx, dy);
        return dist <= TILE * getEditReachTiles();
      }

      function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh, minOverlap) {
        const requiredOverlap = Math.max(0, Number(minOverlap) || 0);
        const overlapW = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
        if (overlapW <= requiredOverlap) return false;
        const overlapH = Math.min(ay + ah, by + bh) - Math.max(ay, by);
        return overlapH > requiredOverlap;
      }

      function tileOccupiedByAnyPlayer(tx, ty, opts) {
        const options = opts && typeof opts === "object" ? opts : {};
        const minOverlap = Math.max(0, Number(options.minOverlap) || 0);
        const bx = tx * TILE;
        const by = ty * TILE;
        if (rectsOverlap(bx, by, TILE, TILE, player.x, player.y, PLAYER_W, PLAYER_H, minOverlap)) {
          return true;
        }
        for (const other of remotePlayers.values()) {
          if (!other || typeof other.x !== "number" || typeof other.y !== "number") continue;
          if (rectsOverlap(bx, by, TILE, TILE, other.x, other.y, PLAYER_W, PLAYER_H, minOverlap)) {
            return true;
          }
        }
        return false;
      }

      function getRemotePlayerAtTile(tx, ty) {
        const bx = tx * TILE;
        const by = ty * TILE;
        for (const other of remotePlayers.values()) {
          if (!other || !other.accountId || typeof other.x !== "number" || typeof other.y !== "number") continue;
          if (rectsOverlap(bx, by, TILE, TILE, other.x, other.y, PLAYER_W, PLAYER_H)) {
            return other;
          }
        }
        return null;
      }

      function clearWorldRuntimePlacementData() {
        const vendingCtrl = getVendingController();
        if (vendingCtrl && typeof vendingCtrl.clearAll === "function") vendingCtrl.clearAll();
        const gambleCtrl = getGambleController();
        if (gambleCtrl && typeof gambleCtrl.clearAll === "function") gambleCtrl.clearAll();
        const donationCtrl = getDonationController();
        if (donationCtrl && typeof donationCtrl.clearAll === "function") donationCtrl.clearAll();
        const chestCtrl = getChestController();
        if (chestCtrl && typeof chestCtrl.clearAll === "function") chestCtrl.clearAll();
        const signCtrl = getSignController();
        if (signCtrl && typeof signCtrl.clearAll === "function") signCtrl.clearAll();
        displayItemsByTile.clear();
        mannequinOutfitsByTile.clear();
        doorAccessByTile.clear();
        antiGravityByTile.clear();
        cameraConfigsByTile.clear();
        cameraLogsByTile.clear();
        currentWorldWeather = null;
        currentWorldTax = null;
      }

      function clearCurrentWorldToBedrock(sourceTag) {
        if (!inWorld) {
          postLocalSystemChat("Enter a world first.");
          return false;
        }
        const preserveLockTx = Number(currentWorldLock && currentWorldLock.tx);
        const preserveLockTy = Number(currentWorldLock && currentWorldLock.ty);
        const preserveLock = Number.isInteger(preserveLockTx) && Number.isInteger(preserveLockTy);
        const spawnTiles = getSpawnStructureTiles();
        const updates = {};
        let changed = 0;
        for (let ty = 0; ty < WORLD_H; ty++) {
          for (let tx = 0; tx < WORLD_W; tx++) {
            let nextId = 0;
            if (ty >= WORLD_H - 2) {
              nextId = SPAWN_BASE_ID;
            } else if (tx === spawnTiles.door.tx && ty === spawnTiles.door.ty) {
              nextId = SPAWN_DOOR_ID;
            } else if (tx === spawnTiles.base.tx && ty === spawnTiles.base.ty) {
              nextId = SPAWN_BASE_ID;
            } else if (preserveLock && tx === preserveLockTx && ty === preserveLockTy) {
              nextId = getCurrentWorldLockBlockId();
            }
            if (world[ty][tx] === nextId) continue;
            world[ty][tx] = nextId;
            clearTileDamage(tx, ty);
            updates[tx + "_" + ty] = nextId;
            changed++;
          }
        }
        clearWorldRuntimePlacementData();
        clearWorldDrops();
        closeVendingModal();
        closeDonationModal();
        closeChestModal();
        closeSignModal();
        closeDoorModal();
        closeCameraModal();
        closeWeatherModal();
        closeOwnerTaxModal();
        closeGambleModal();
        closeSplicingModal();
        {
          const questCtrl = getQuestWorldController();
          if (questCtrl && typeof questCtrl.isActive === "function" && questCtrl.isActive() && typeof questCtrl.disableWorld === "function") {
            questCtrl.disableWorld();
          }
        }
        if (network.enabled) {
          const dbOps = [];
          const worldRootPath = "/" + BASE_PATH + "/worlds/" + currentWorldId;
          if (Object.keys(updates).length) {
            dbOps.push(proxyAdminUpdate(worldRootPath + "/blocks", updates));
          }
          dbOps.push(proxyAdminRemove(worldRootPath + "/hits"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/drops"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/vending"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/gamble-machines"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/donation-boxes"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/chests"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/signs"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/displays"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/mannequins"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/doors"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/anti-gravity"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/plants"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/weather"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/owner-tax"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/cameras"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/camera-logs"));
          dbOps.push(proxyAdminRemove(worldRootPath + "/quest-world"));
          Promise.allSettled(dbOps).finally(() => {
            if (network.enabled) syncPlayer(true);
          });
        }
        enforceSpawnStructureInWorldData();
        ensurePlayerSafeSpawn(true);
        logAdminAudit("Admin(" + (sourceTag || "panel") + ") cleared world " + currentWorldId + " to bedrock.");
        pushAdminAuditEntry("clearworld", "", "world=" + currentWorldId + " changed=" + changed);
        postLocalSystemChat("World cleared to bedrock (" + changed + " tiles updated).");
        return true;
      }

      function tryUseSpawnMover(tx, ty) {
        if (!inWorld) return false;
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return false;
        if (!canEditTarget(tx, ty)) return false;
        if (!canEditCurrentWorld()) {
          notifyWorldLockedDenied();
          return false;
        }
        if (ty >= WORLD_H - 2) {
          postLocalSystemChat("Spawn door must be above the bedrock floor.");
          return false;
        }
        if (inventory[SPAWN_MOVER_ID] <= 0) return false;
        if (tileOccupiedByAnyPlayer(tx, ty) || tileOccupiedByAnyPlayer(tx, ty + 1)) {
          postLocalSystemChat("Cannot move spawn onto a player.");
          return false;
        }
        const targetDoorId = world[ty][tx];
        const targetBaseId = world[ty + 1][tx];
        const canUseDoorTile = targetDoorId === 0 || targetDoorId === SPAWN_DOOR_ID;
        const canUseBaseTile = targetBaseId === 0 || targetBaseId === SPAWN_BASE_ID;
        if (!canUseDoorTile || !canUseBaseTile) {
          postLocalSystemChat("Target door tile must be empty (base can be empty/bedrock).");
          return false;
        }

        // Remove every existing spawn door except the new target tile.
        const staleDoorTiles = [];
        for (let scanY = 0; scanY < WORLD_H; scanY++) {
          const row = world[scanY];
          if (!Array.isArray(row)) continue;
          for (let scanX = 0; scanX < WORLD_W; scanX++) {
            if (row[scanX] !== SPAWN_DOOR_ID) continue;
            if (scanX === tx && scanY === ty) continue;
            staleDoorTiles.push({ tx: scanX, ty: scanY });
          }
        }
        for (let i = 0; i < staleDoorTiles.length; i++) {
          const tile = staleDoorTiles[i];
          world[tile.ty][tile.tx] = 0;
          clearTileDamage(tile.tx, tile.ty);
        }

        setSpawnStructureTile(tx, ty);
        const nextTiles = getSpawnStructureTiles();
        cleanupSpawnStructureInWorldData();
        world[nextTiles.door.ty][nextTiles.door.tx] = SPAWN_DOOR_ID;
        world[nextTiles.base.ty][nextTiles.base.tx] = SPAWN_BASE_ID;
        clearTileDamage(nextTiles.door.tx, nextTiles.door.ty);
        clearTileDamage(nextTiles.base.tx, nextTiles.base.ty);
        if (network.enabled && network.blocksRef) {
          const pushCleanup = () => {
            network.blocksRef.once("value").then((snapshot) => {
              const map = snapshot && snapshot.val ? (snapshot.val() || {}) : {};
              const updates = buildSpawnStructureCleanupUpdates(map, nextTiles.door.tx, nextTiles.door.ty);
              return network.blocksRef.update(updates);
            }).catch(() => {
              setNetworkState("Network error", true);
            });
          };
          pushCleanup();
          if (network.spawnMetaRef) {
            network.spawnMetaRef.set({
              tx: nextTiles.door.tx,
              ty: nextTiles.door.ty,
              by: (playerName || "").toString().slice(0, 20),
              updatedAt: firebase.database.ServerValue.TIMESTAMP
            }).catch(() => {});
          }
          setTimeout(() => {
            if (!inWorld || !network.enabled || !network.blocksRef) return;
            pushCleanup();
          }, 420);
        } else {
          for (let i = 0; i < staleDoorTiles.length; i++) {
            const tile = staleDoorTiles[i];
            syncBlock(tile.tx, tile.ty, 0);
          }
          syncBlock(nextTiles.door.tx, nextTiles.door.ty, SPAWN_DOOR_ID);
          syncBlock(nextTiles.base.tx, nextTiles.base.ty, SPAWN_BASE_ID);
        }

        inventory[SPAWN_MOVER_ID] = Math.max(0, Math.floor((inventory[SPAWN_MOVER_ID] || 0) - 1));
        saveInventory();
        refreshToolbar();
        postLocalSystemChat("Spawn moved to " + tx + "," + ty + ".");
        return true;
      }

      function tryPlace(tx, ty, actionStartedAtMs) {
        const actionAtMs = Number.isFinite(actionStartedAtMs) ? Number(actionStartedAtMs) : null;
        const reportAction = (outcome, label) => {
          if (actionAtMs === null) return outcome;
          return reportActionOutcome(actionAtMs, tx, ty, outcome, label);
        };
        const id = slotOrder[selectedSlot];
        if (typeof id !== "number") return reportAction("warn", "invalid item");
        const placeDef = blockDefs[id] || null;
        const blocksPlayers = !placeDef || placeDef.solid !== false;
        if (id === SPAWN_MOVER_ID) {
          return tryUseSpawnMover(tx, ty)
            ? reportAction("success", "spawn moved")
            : reportAction("warn", "cannot move spawn");
        }
        if (!canEditTarget(tx, ty)) return reportAction("warn", "out of reach");
        if (isProtectedSpawnTile(tx, ty)) return reportAction("warn", "protected spawn");
        if (!canEditCurrentWorld()) {
          notifyWorldLockedDenied();
          return reportAction("deny", "world is locked");
        }
        if (inventory[id] <= 0) return reportAction("warn", "not enough items");
        if (world[ty][tx] !== 0) return reportAction("warn", "occupied");
        if (blocksPlayers && tileOccupiedByAnyPlayer(tx, ty, { minOverlap: 0.75 })) return reportAction("warn", "occupied by player");
        if (isPlantSeedBlockId(id)) {
          const supportTy = ty + 1;
          if (supportTy >= WORLD_H || world[supportTy][tx] === 0) {
            postLocalSystemChat("Seeds can only be planted on top of blocks.");
            return reportAction("warn", "seed needs support");
          }
        }
        if (isWorldLocked() && !isWorldLockOwner()) {
          if (isWorldLockBlockId(id)) {
            notifyOwnerOnlyWorldEdit("the world lock");
            return reportAction("deny", "world lock is owner-only");
          }
          if (id === VENDING_ID) {
            notifyOwnerOnlyWorldEdit("vending machines");
            return reportAction("deny", "vending placement is owner-only");
          }
          if (id === TAX_BLOCK_ID) {
            notifyOwnerOnlyWorldEdit("owner Tax Machine");
            return reportAction("deny", "tax machine is owner-only");
          }
        }
        if (id === TAX_BLOCK_ID && hasOwnerTaxBlockInWorld()) {
          postLocalSystemChat("Only one owner Tax Machine is allowed per world.");
          return reportAction("warn", "tax machine already exists");
        }

        const finalizePlace = () => {
          world[ty][tx] = id;
          clearTileDamage(tx, ty);
          inventory[id]--;
          syncBlock(tx, ty, id);
          if (id === VENDING_ID) {
            setLocalVendingMachine(tx, ty, {
              ownerAccountId: playerProfileId || "",
              ownerName: (playerName || "").toString().slice(0, 20),
              sellType: "block",
              sellBlockId: 0,
              sellCosmeticId: "",
              sellQuantity: 1,
              sellBlockKey: "",
              priceLocks: 0,
              stock: 0,
              earningsLocks: 0,
              updatedAt: Date.now()
            });
            seedVendingMachineOwner(tx, ty);
          } else if (id === GAMBLE_ID) {
            const gambleCtrl = getGambleController();
            if (gambleCtrl && typeof gambleCtrl.onPlaced === "function") {
              gambleCtrl.onPlaced(tx, ty);
            }
          } else if (isDonationBoxBlockId(id)) {
            const donationCtrl = getDonationController();
            if (donationCtrl && typeof donationCtrl.onPlaced === "function") {
              donationCtrl.onPlaced(tx, ty);
            } else {
              seedDonationBoxOwner(tx, ty);
            }
          } else if (isChestBlockId(id)) {
            const chestCtrl = getChestController();
            if (chestCtrl && typeof chestCtrl.onPlaced === "function") {
              chestCtrl.onPlaced(tx, ty);
            }
          } else if (id === SIGN_ID) {
            saveSignText(tx, ty, "");
          } else if (id === ANTI_GRAV_ID) {
            saveAntiGravityState(tx, ty, true);
          } else if (id === CAMERA_ID) {
            saveCameraConfig(tx, ty, buildDefaultCameraConfig());
          } else if (id === DISPLAY_BLOCK_ID) {
            saveDisplayItem(tx, ty, null);
          } else if (id === TAX_BLOCK_ID) {
            const payload = {
              tx,
              ty,
              taxPercent: 0,
              ownerAccountId: String(currentWorldLock && currentWorldLock.ownerAccountId || "").trim(),
              ownerName: String(currentWorldLock && currentWorldLock.ownerName || "").trim().slice(0, 20),
              earningsLocks: 0,
              updatedAt: Date.now()
            };
            setLocalWorldTax(payload);
            if (network.enabled && network.ownerTaxRef) {
              network.ownerTaxRef.set({
                ...payload,
                updatedAt: (
                  typeof firebase !== "undefined" &&
                  firebase &&
                  firebase.database &&
                  firebase.database.ServerValue &&
                  firebase.database.ServerValue.TIMESTAMP
                ) ? firebase.database.ServerValue.TIMESTAMP : Date.now()
              }).catch(() => {});
            }
          } else if (id === MANNEQUIN_ID) {
            saveMannequinOutfit(tx, ty, {
              ownerAccountId: String(currentWorldLock && currentWorldLock.ownerAccountId || playerProfileId || "").trim().slice(0, 64),
              ownerName: String(currentWorldLock && currentWorldLock.ownerName || playerName || "").trim().slice(0, 20),
              equippedCosmetics: createEmptyMannequinOutfit(),
              updatedAt: Date.now()
            });
          } else if (isPlantSeedBlockId(id)) {
            const seedCfg = getPlantSeedConfig(id) || {};
            const ctrl = getPlantsController();
            const seedPlant = (ctrl && typeof ctrl.createSeedPlant === "function")
              ? ctrl.createSeedPlant(Date.now(), {
                  yieldBlockId: seedCfg.yieldBlockId || TREE_YIELD_BLOCK_ID,
                  growMs: seedCfg.growMs || TREE_GROW_MS,
                  randomFn: Math.random
                })
              : {
                  type: "tree",
                  plantedAt: Date.now(),
                  growMs: seedCfg.growMs || TREE_GROW_MS,
                  yieldBlockId: seedCfg.yieldBlockId || TREE_YIELD_BLOCK_ID,
                  fruitAmount: 1 + Math.floor(Math.random() * 5)
                };
            if (!seedPlant.fruitAmount || Number(seedPlant.fruitAmount) <= 0) {
              seedPlant.fruitAmount = resolvePlantFruitAmount(seedPlant);
            }
            saveTreePlant(tx, ty, seedPlant);
          }
          saveInventory(false);
          refreshToolbar();
          awardXp(3, "placing blocks");
          const placedDef = blockDefs[id] || {};
          const placedBlockKey = String(placedDef.key || "").trim().toLowerCase();
          applyAchievementEvent("place_block", { count: 1, blockId: id, blockKey: placedBlockKey });
          applyQuestEvent("place_block", { count: 1, blockId: id, blockKey: placedBlockKey });
          applyQuestWorldGameplayEvent("place_block", { count: 1, blockId: id, blockKey: placedBlockKey, tx, ty });
        };

        if (isWorldLockBlockId(id)) {
          if (isWorldLocked()) {
            if (isWorldLockOwner()) {
              postLocalSystemChat("This world already has your lock.");
            } else {
              notifyWorldLockedDenied();
            }
            return reportAction("warn", "world already has your lock");
          }
          const ownerName = (playerName || "player").toString().slice(0, 20);
          if (!network.enabled || !network.lockRef) {
            currentWorldLock = {
              ownerAccountId: playerProfileId || "",
              ownerName,
              lockBlockId: id,
              tx,
              ty,
              createdAt: Date.now()
            };
            finalizePlace();
            postLocalSystemChat("World locked.");
            applyAchievementEvent("world_lock_placed", { worldId: currentWorldId });
            return reportAction("success", "world lock placed");
          }
          network.lockRef.transaction((current) => {
            if (current && current.ownerAccountId) return;
            return {
              ownerAccountId: playerProfileId || "",
              ownerName,
              lockBlockId: id,
              tx,
              ty,
              createdAt: firebase.database.ServerValue.TIMESTAMP
            };
          }).then((result) => {
            if (!result.committed) {
            const existing = normalizeWorldLock(result.snapshot && result.snapshot.val ? result.snapshot.val() : null);
              currentWorldLock = existing;
              notifyWorldLockedDenied();
              if (actionAtMs !== null) {
                reportActionLatencyResult(actionAtMs, tx, ty, "warn", "world already locked");
              }
              return;
            }
            currentWorldLock = normalizeWorldLock(result.snapshot && result.snapshot.val ? result.snapshot.val() : null) || {
              ownerAccountId: playerProfileId || "",
              ownerName,
              lockBlockId: id,
              tx,
              ty,
              createdAt: Date.now()
            };
            finalizePlace();
            postLocalSystemChat("World locked.");
            applyAchievementEvent("world_lock_placed", { worldId: currentWorldId });
            if (actionAtMs !== null) {
              reportActionLatencyResult(actionAtMs, tx, ty, "success", "world lock placed");
            }
          }).catch(() => {
            postLocalSystemChat("Failed to place world lock.");
            if (actionAtMs !== null) {
              reportActionLatencyResult(actionAtMs, tx, ty, "warn", "world lock failed");
            }
          });
          return actionAtMs === null ? "pending" : "pending";
        }

        finalizePlace();
        return reportAction("success", "placed block");
      }

      function tryBreak(tx, ty, actionStartedAtMs) {
        const actionAtMs = Number.isFinite(actionStartedAtMs) ? Number(actionStartedAtMs) : null;
        const reportAction = (outcome, label) => {
          if (actionAtMs === null) return outcome;
          return reportActionOutcome(actionAtMs, tx, ty, outcome, label);
        };
        if (!canEditTarget(tx, ty)) return reportAction("warn", "out of reach");
        const id = world[ty][tx];
        if (id === 0) return reportAction("warn", "nothing to break");
        if (id === SPAWN_DOOR_ID) return reportAction("warn", "protected");
        if (!canEditCurrentWorld()) {
          notifyWorldLockedDenied();
          return reportAction("deny", "world is locked");
        }
        if (isProtectedSpawnTile(tx, ty)) return reportAction("warn", "protected spawn");
        if (isUnbreakableTileId(id)) return reportAction("warn", "unbreakable");
        if (isWorldLocked() && isWorldLockBlockId(id) && !isWorldLockOwner()) {
          notifyWorldLockedDenied();
          return reportAction("deny", "world lock is owner-only");
        }
        if (id === VENDING_ID && isWorldLocked() && !isWorldLockOwner()) {
          notifyOwnerOnlyWorldEdit("vending machines");
          return reportAction("deny", "vending machine owner-only");
        }
        if (id === TAX_BLOCK_ID && isWorldLocked() && !isWorldLockOwner()) {
          notifyOwnerOnlyWorldEdit("owner Tax Machine");
          return reportAction("deny", "tax machine owner-only");
        }
        if (isDonationBoxBlockId(id)) {
          const donationCtrl = getDonationController();
          const box = donationCtrl && typeof donationCtrl.getLocal === "function"
            ? donationCtrl.getLocal(tx, ty)
            : getLocalDonationBox(tx, ty);
          if (box && box.ownerAccountId && box.ownerAccountId !== playerProfileId) {
            postLocalSystemChat("Only the donation box owner can break it.");
            return reportAction("warn", "not donation owner");
          }
          const storedCount = donationCtrl && typeof donationCtrl.getStoredCountAt === "function"
            ? donationCtrl.getStoredCountAt(tx, ty)
            : getDonationStoredCount(box && box.items);
          if (storedCount > 0) {
            postLocalSystemChat("Collect donations before breaking this box.");
            return reportAction("warn", "collect donations first");
          }
        }
        if (isChestBlockId(id)) {
          const chestCtrl = getChestController();
          const chest = chestCtrl && typeof chestCtrl.getLocal === "function" ? chestCtrl.getLocal(tx, ty) : null;
          const canManageChest = isWorldLocked()
            ? isWorldLockOwner()
            : Boolean(chest && chest.ownerAccountId && chest.ownerAccountId === playerProfileId);
          if (!canManageChest) {
            postLocalSystemChat("Only the chest manager can break storage chests.");
            return reportAction("warn", "not chest owner");
          }
          const stored = chestCtrl && typeof chestCtrl.getStoredCountAt === "function"
            ? chestCtrl.getStoredCountAt(tx, ty)
            : 0;
          if (stored > 0) {
            postLocalSystemChat("Collect chest items before breaking it.");
            return reportAction("warn", "collect chest items first");
          }
        }

        const now = performance.now();
        if ((now - lastBlockHitAtMs) < BLOCK_HIT_COOLDOWN_MS) return reportAction("input", "cooldown");
        lastBlockHitAtMs = now;

        if (isPlantSeedBlockId(id)) {
          const plant = getLocalTreePlant(tx, ty);
          const fixedFruitAmount = resolvePlantFruitAmount(plant);
          if (plant && Number(plant.fruitAmount) !== fixedFruitAmount) {
            saveTreePlant(tx, ty, { ...plant, fruitAmount: fixedFruitAmount });
          }
          const ctrl = getPlantsController();
          const baseHarvest = (ctrl && typeof ctrl.getHarvestReward === "function")
            ? ctrl.getHarvestReward(plant, Math.random)
            : null;
          if (!baseHarvest) {
            postLocalSystemChat("Seed is still growing.");
            return reportAction("warn", "seed still growing");
          }
          const rewardsCtrl = getRewardsController();
          const harvestRaw = (rewardsCtrl && typeof rewardsCtrl.getTreeHarvestRewards === "function")
            ? rewardsCtrl.getTreeHarvestRewards(baseHarvest, Math.random)
            : {
                blockId: Math.max(1, Math.floor(Number(baseHarvest.blockId) || TREE_YIELD_BLOCK_ID)),
                amount: Math.max(1, Math.floor(Number(baseHarvest.amount) || 1)),
                gems: 1 + Math.floor(Math.random() * 4)
              };
          const harvest = {
            blockId: Math.max(1, Math.floor(Number(harvestRaw && harvestRaw.blockId) || TREE_YIELD_BLOCK_ID)),
            amount: fixedFruitAmount,
            gems: Math.max(0, Math.floor(Number(harvestRaw && harvestRaw.gems) || 0))
          };
          const rewardBlockId = Math.max(1, Math.floor(Number(harvest.blockId) || TREE_YIELD_BLOCK_ID));
          const rewardAmount = Math.max(1, Math.floor(Number(harvest.amount) || 1));
          const gemReward = Math.max(0, Math.floor(Number(harvest.gems) || 0));
          world[ty][tx] = 0;
          clearTileDamage(tx, ty);
          saveTreePlant(tx, ty, null);
          syncBlock(tx, ty, 0);
          if (particleController && typeof particleController.emitBlockBreak === "function") {
            particleController.emitBlockBreak(tx * TILE + TILE * 0.5, ty * TILE + TILE * 0.5, 11);
          }
          let treeRewardDroppedToWorld = false;
          if (INVENTORY_IDS.includes(rewardBlockId)) {
            treeRewardDroppedToWorld = spawnWorldDropEntry(
              { type: "block", blockId: rewardBlockId },
              rewardAmount,
              tx * TILE,
              ty * TILE
            );
            if (!treeRewardDroppedToWorld) {
              // Fallback to inventory so rewards are never lost.
              inventory[rewardBlockId] = (inventory[rewardBlockId] || 0) + rewardAmount;
            }
          }
          addPlayerGems(gemReward, true);
          saveInventory(false);
          refreshToolbar(true);
          awardXp(15, "harvesting");
          applyAchievementEvent("tree_harvest", { count: 1 });
          applyQuestEvent("tree_harvest", { count: 1 });
          applyQuestWorldGameplayEvent("tree_harvest", { count: 1, tx, ty });
          const harvestedSeedDef = blockDefs[id] || {};
          const harvestedSeedKey = String(harvestedSeedDef.key || "").trim().toLowerCase();
          applyAchievementEvent("break_block", { count: 1, blockId: id, blockKey: harvestedSeedKey });
          applyQuestEvent("break_block", { count: 1, blockId: id, blockKey: harvestedSeedKey });
          applyQuestWorldGameplayEvent("break_block", { count: 1, blockId: id, blockKey: harvestedSeedKey, tx, ty });
          const rewardDef = blockDefs[rewardBlockId];
          const rewardName = rewardDef && rewardDef.name ? rewardDef.name : ("Block " + rewardBlockId);
          if (treeRewardDroppedToWorld) {
            postLocalSystemChat("Harvested seed: dropped " + rewardAmount + " " + rewardName + " and +" + gemReward + " gems.");
          } else {
            postLocalSystemChat("Harvested seed: +" + rewardAmount + " " + rewardName + " and +" + gemReward + " gems.");
          }
          return reportAction("success", "harvested seed");
        }

        const durability = getBlockDurability(id);
        if (!Number.isFinite(durability)) return reportAction("warn", "invalid block");
        const breakPower = getEquippedBreakPower();
        const hitAmount = breakPower.instantBreak
          ? Math.max(1, Math.floor(durability))
          : Math.max(1, Math.floor(breakPower.multiplier));

        if (id === VENDING_ID) {
          const ctrl = getVendingController();
          if (ctrl && typeof ctrl.onBreakWithFist === "function" && ctrl.onBreakWithFist(tx, ty)) {
            return reportAction("success", "vending interacted");
          }
        }

        const damage = getTileDamage(tx, ty);
        const nextHits = Math.max(1, damage.hits + hitAmount);
        if (nextHits < durability) {
          setTileDamage(tx, ty, nextHits);
          syncTileDamageToNetwork(tx, ty, nextHits);
          return reportAction("success", "tile hit");
        }
        clearTileDamage(tx, ty);

        if (id === SIGN_ID) {
          saveSignText(tx, ty, "");
          const signCtrl = getSignController();
          if (signCtrl && typeof signCtrl.isEditingTile === "function" && signCtrl.isEditingTile(tx, ty)) {
            closeSignModal();
          }
        }
        if (id === SPLICER_ID) {
          closeSplicingModal();
        }
        if (id === DOOR_BLOCK_ID) {
          setLocalDoorAccess(tx, ty, null);
          if (network.enabled && network.doorsRef) {
            network.doorsRef.child(getTileKey(tx, ty)).remove().catch(() => {});
          }
        }
        if (id === ANTI_GRAV_ID) {
          setLocalAntiGravityState(tx, ty, null);
          if (network.enabled && network.antiGravRef) {
            network.antiGravRef.child(getTileKey(tx, ty)).remove().catch(() => {});
          }
        }
        if (id === CAMERA_ID) {
          setLocalCameraConfig(tx, ty, null);
          if (network.enabled && network.camerasRef) {
            network.camerasRef.child(getTileKey(tx, ty)).remove().catch(() => {});
          }
        }
        if (id === DISPLAY_BLOCK_ID) {
          const existingDisplay = getLocalDisplayItem(tx, ty);
          if (existingDisplay) {
            grantDisplayItemToInventory(existingDisplay);
          }
          saveDisplayItem(tx, ty, null);
        }
        if (id === MANNEQUIN_ID) {
          const mannequin = getLocalMannequinOutfit(tx, ty);
          const restored = grantMannequinOutfitToInventory(mannequin);
          saveMannequinOutfit(tx, ty, null);
          if (restored > 0) {
            syncPlayer(true);
          }
        }
        if (isDonationBoxBlockId(id)) {
          const donationCtrl = getDonationController();
          if (donationCtrl && typeof donationCtrl.onBroken === "function") {
            donationCtrl.onBroken(tx, ty);
          } else {
            setLocalDonationBox(tx, ty, null);
          }
          if (network.enabled && network.donationRef) {
            network.donationRef.child(getTileKey(tx, ty)).remove().catch(() => {});
          }
        }
        if (isChestBlockId(id)) {
          const chestCtrl = getChestController();
          if (chestCtrl && typeof chestCtrl.onBroken === "function") {
            chestCtrl.onBroken(tx, ty);
          }
          if (network.enabled && network.chestsRef) {
            network.chestsRef.child(getTileKey(tx, ty)).remove().catch(() => {});
          }
        }
        if (id === WEATHER_MACHINE_ID) {
          const active = normalizeWeatherRecord(currentWorldWeather);
          if (active && active.sourceTx === tx && active.sourceTy === ty) {
            setLocalWorldWeather(null);
            if (network.enabled && network.weatherRef) {
              network.weatherRef.remove().catch(() => {});
            }
          }
        }
        if (id === GAMBLE_ID) {
          const gambleCtrl = getGambleController();
          if (gambleCtrl && typeof gambleCtrl.canBreakAt === "function" && !gambleCtrl.canBreakAt(tx, ty)) {
            postLocalSystemChat("Only the machine owner can break this gambling machine.");
            return reportAction("deny", "machine owner-only");
          }
          if (gambleCtrl && typeof gambleCtrl.claimOnBreak === "function") {
            gambleCtrl.claimOnBreak(tx, ty);
          } else {
            setLocalGambleMachine(tx, ty, null);
            if (network.enabled && network.gambleRef) {
              network.gambleRef.child(getTileKey(tx, ty)).remove().catch(() => {});
            }
          }
        }
        if (id === TAX_BLOCK_ID) {
          setLocalWorldTax(null);
          closeOwnerTaxModal();
          if (network.enabled && network.ownerTaxRef) {
            network.ownerTaxRef.remove().catch(() => {});
          }
        }
        if (isPlantSeedBlockId(id)) {
          saveTreePlant(tx, ty, null);
        }
        if (id === QUEST_NPC_ID) {
          const questCtrl = getQuestWorldController();
          if (questCtrl && typeof questCtrl.onNpcBroken === "function") {
            questCtrl.onNpcBroken(tx, ty);
          }
        }

        world[ty][tx] = 0;
        if (particleController && typeof particleController.emitBlockBreak === "function") {
          particleController.emitBlockBreak(tx * TILE + TILE * 0.5, ty * TILE + TILE * 0.5, 12);
        }
        if (isGachaBlockId(id)) {
          resolveGachaBreak(id, tx, ty);
        } else {
          const dropId = getInventoryDropId(id);
          const blockDef = blockDefs[id] || {};
          const alwaysDropToInventory = Boolean(blockDef.alwaysDrop === true);
          if (alwaysDropToInventory && INVENTORY_IDS.includes(dropId)) {
            inventory[dropId] = Math.max(0, Math.floor(Number(inventory[dropId] || 0) + 1));
          } else {
            const shouldReturnBrokenItem = Math.random() < BREAK_RETURN_ITEM_CHANCE;
            if (shouldReturnBrokenItem && INVENTORY_IDS.includes(dropId)) {
              spawnWorldDropEntry(
                { type: "block", blockId: dropId },
                1,
                tx * TILE,
                ty * TILE
              );
            }
          }
          const seedDropId = SEED_DROP_BY_BLOCK_ID[id] || 0;
          if (seedDropId && !isWorldLockBlockId(id) && Math.random() < SEED_DROP_CHANCE) {
            inventory[seedDropId] = (inventory[seedDropId] || 0) + 1;
            if (particleController && typeof particleController.emitSeedDrop === "function") {
              particleController.emitSeedDrop(tx * TILE + TILE * 0.5, ty * TILE + TILE * 0.4);
            }
            const seedDef = blockDefs[seedDropId];
            const seedName = seedDef && seedDef.name ? seedDef.name : "Seed";
            postLocalSystemChat("You found a " + seedName + ".");
          }
        }
        syncBlock(tx, ty, 0);
        if (isWorldLockBlockId(id)) {
          currentWorldLock = null;
          setLocalWorldTax(null);
          if (network.enabled && network.lockRef) {
            network.lockRef.remove().catch(() => {});
          }
          if (network.enabled && network.ownerTaxRef) {
            network.ownerTaxRef.remove().catch(() => {});
          }
          postLocalSystemChat("World unlocked.");
        }
        const farmableXp = farmableRegistry && typeof farmableRegistry.getBreakXp === "function"
          ? farmableRegistry.getBreakXp(id, 5)
          : 5;
        if (farmableRegistry && typeof farmableRegistry.isFarmable === "function" && farmableRegistry.isFarmable(id)) {
          const farmableGems = Math.max(0, Math.floor(Number(
            typeof farmableRegistry.rollGems === "function" ? farmableRegistry.rollGems(id, Math.random) : 0
          ) || 0));
          if (farmableGems > 0) {
            addPlayerGems(farmableGems, true);
          }
        }
        saveInventory(false);
        refreshToolbar(true);
        awardXp(farmableXp, "breaking blocks");
        const brokenDef = blockDefs[id] || {};
        const brokenBlockKey = String(brokenDef.key || "").trim().toLowerCase();
        applyAchievementEvent("break_block", { count: 1, blockId: id, blockKey: brokenBlockKey });
        applyQuestEvent("break_block", { count: 1, blockId: id, blockKey: brokenBlockKey });
        applyQuestWorldGameplayEvent("break_block", { count: 1, blockId: id, blockKey: brokenBlockKey, tx, ty });
        return reportAction("success", "block broken");
      }

      function tryRotate(tx, ty, actionStartedAtMs) {
        const actionAtMs = Number.isFinite(actionStartedAtMs) ? Number(actionStartedAtMs) : null;
        const reportAction = (outcome, label) => {
          if (actionAtMs === null) return outcome;
          return reportActionOutcome(actionAtMs, tx, ty, outcome, label);
        };
        if (!canEditTarget(tx, ty)) return reportAction("warn", "out of reach");
        const id = world[ty][tx];
        if (!id) return reportAction("warn", "empty");
        if (id === SPAWN_DOOR_ID) return reportAction("warn", "protected");
        if (isProtectedSpawnTile(tx, ty)) return reportAction("warn", "protected spawn");
        if (!canEditCurrentWorld()) {
          notifyWorldLockedDenied();
          return reportAction("deny", "world is locked");
        }
        if (isWorldLocked() && isWorldLockBlockId(id) && !isWorldLockOwner()) {
          notifyWorldLockedDenied();
          return reportAction("deny", "world lock is owner-only");
        }
        if (id === VENDING_ID && isWorldLocked() && !isWorldLockOwner()) {
          notifyOwnerOnlyWorldEdit("vending machines");
          return reportAction("deny", "vending machine owner-only");
        }
        const nextId = getRotatedBlockId(id);
        if (!nextId) return reportAction("warn", "cannot rotate");
        world[ty][tx] = nextId;
        clearTileDamage(tx, ty);
        syncBlock(tx, ty, nextId);
        return reportAction("success", "rotated");
      }

      function createOrUpdateVendingMachine(tx, ty, updater) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.createOrUpdateMachine !== "function") return Promise.resolve(null);
        return ctrl.createOrUpdateMachine(tx, ty, updater);
      }

      function seedVendingMachineOwner(tx, ty) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.seedOwner !== "function") return;
        ctrl.seedOwner(tx, ty);
      }

      function configureVendingMachine(tx, ty, vm) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.configureMachine !== "function") return;
        ctrl.configureMachine(tx, ty, vm);
      }

      function collectVendingEarnings(tx, ty, vm) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.collectEarnings !== "function") return;
        ctrl.collectEarnings(tx, ty, vm);
      }

      function removeVendingMachine(tx, ty, vm) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.removeMachine !== "function") return;
        ctrl.removeMachine(tx, ty, vm);
      }

      function buyFromVendingMachine(tx, ty, vm) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.buy !== "function") return;
        ctrl.buy(tx, ty, vm);
      }

      function interactWithVendingMachine(tx, ty) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.interact !== "function") return;
        ctrl.interact(tx, ty);
      }

      function interactWithWrench(tx, ty, actionStartedAtMs) {
        const actionAtMs = Number.isFinite(actionStartedAtMs) ? Number(actionStartedAtMs) : null;
        const reportAction = (outcome, label) => {
          if (actionAtMs === null) return outcome;
          return reportActionOutcome(actionAtMs, tx, ty, outcome, label);
        };
        if (!canEditTarget(tx, ty)) return reportAction("warn", "out of reach");
        const id = world[ty][tx];
        if (!id) return reportAction("warn", "empty");
        const questCtrl = getQuestWorldController();
        const questWorldActive = Boolean(questCtrl && typeof questCtrl.isActive === "function" && questCtrl.isActive());
        const ownerRole = normalizeAdminRole(currentAdminRole) === "owner";
        if (questWorldActive && !ownerRole) {
          if (id === QUEST_NPC_ID && questCtrl && typeof questCtrl.interact === "function") {
            if (questCtrl.interact(tx, ty)) {
              return reportAction("success", "quest interaction");
            }
            return reportAction("warn", "quest interaction unavailable");
          }
          return reportAction("warn", "no interaction");
        }
        if (id === QUEST_NPC_ID && questCtrl && typeof questCtrl.interact === "function") {
          if (questCtrl.interact(tx, ty)) return reportAction("success", "quest interaction");
          return reportAction("warn", "quest interaction unavailable");
        }
        if (isWorldLockBlockId(id)) {
          openWorldLockModal(tx, ty);
          return reportAction("success", "world lock");
        }
        if (id === VENDING_ID) {
          interactWithVendingMachine(tx, ty);
          return reportAction("success", "vending");
        }
        if (id === GAMBLE_ID) {
          openGambleModal(tx, ty);
          return reportAction("success", "gamble");
        }
        if (isDonationBoxBlockId(id)) {
          openDonationModal(tx, ty);
          return reportAction("success", "donation box");
        }
        if (isChestBlockId(id)) {
          openChestModal(tx, ty);
          return reportAction("success", "chest");
        }
        if (id === SPLICER_ID) {
          openSplicingModal(tx, ty);
          return reportAction("success", "splicer");
        }
        if (id === TAX_BLOCK_ID) {
          openOwnerTaxModal(tx, ty);
          return reportAction("success", "owner tax");
        }
        if (id === SIGN_ID) {
          openSignModal(tx, ty);
          return reportAction("success", "sign");
        }
        if (id === ANTI_GRAV_ID) {
          toggleAntiGravityGenerator(tx, ty);
          return reportAction("success", "anti-gravity");
        }
        if (id === DOOR_BLOCK_ID) {
          openDoorModal(tx, ty);
          return reportAction("success", "door");
        }
        if (id === CAMERA_ID) {
          openCameraModal(tx, ty);
          return reportAction("success", "camera");
        }
        if (id === WEATHER_MACHINE_ID) {
          openWeatherModal(tx, ty);
          return reportAction("success", "weather");
        }
        return reportAction("warn", "nothing to interact");
      }

      function useActionAt(tx, ty, actionStartedAtMs) {
        const actionAtMs = Number.isFinite(actionStartedAtMs) ? Number(actionStartedAtMs) : performance.now();
        if (shouldBlockActionForFreeze()) return;
        if (isProtectedSpawnTile(tx, ty)) return;
        const selectedId = slotOrder[selectedSlot];
        if (antiCheatController && typeof antiCheatController.onActionAttempt === "function") {
          antiCheatController.onActionAttempt({
            action: selectedId === TOOL_WRENCH ? "wrench" : (selectedId === TOOL_FIST ? "break" : "place"),
            tx,
            ty
          });
        }
        if (selectedId === TOOL_FIST) {
          const playerCenterTileX = (player.x + PLAYER_W * 0.5) / TILE;
          if (Number.isFinite(playerCenterTileX) && tx !== Math.floor(playerCenterTileX)) {
            player.facing = tx >= playerCenterTileX ? 1 : -1;
          }
          const playerCenterTileY = (player.y + PLAYER_H * 0.5) / TILE;
          if (ty < Math.floor(playerCenterTileY)) {
            lastHitDirectionY = -1;
          } else if (ty > Math.floor(playerCenterTileY)) {
            lastHitDirectionY = 1;
          } else {
            lastHitDirectionY = 0;
          }
          lastHitAtMs = actionAtMs;
        }
        if (selectedId === TOOL_WRENCH) {
          reportActionTap(tx, ty);
          return interactWithWrench(tx, ty, actionAtMs);
        }
        if (selectedId === TOOL_FIST) {
          reportActionTap(tx, ty);
          return tryBreak(tx, ty, actionAtMs);
        }
        reportActionTap(tx, ty);
        return tryPlace(tx, ty, actionAtMs);
      }

      function useSecondaryActionAt(tx, ty, actionStartedAtMs) {
        const actionAtMs = Number.isFinite(actionStartedAtMs) ? Number(actionStartedAtMs) : performance.now();
        if (shouldBlockActionForFreeze()) return;
        if (isProtectedSpawnTile(tx, ty)) return;
        const selectedId = slotOrder[selectedSlot];
        if (antiCheatController && typeof antiCheatController.onActionAttempt === "function") {
          antiCheatController.onActionAttempt({
            action: selectedId === TOOL_WRENCH ? "wrench_secondary" : (selectedId === TOOL_FIST ? "rotate" : "secondary"),
            tx,
            ty
          });
        }
        if (selectedId === TOOL_FIST) {
          lastHitAtMs = actionAtMs;
          reportActionTap(tx, ty);
          return tryRotate(tx, ty, actionAtMs);
        }
        if (selectedId === TOOL_WRENCH) {
          reportActionTap(tx, ty);
          return interactWithWrench(tx, ty, actionAtMs);
        }
      }

      function setNetworkState(label, isWarning) {
        networkStateEl.textContent = label;
        networkStateEl.classList.toggle("danger", Boolean(isWarning));
      }

      function updateOnlineCount() {
        const worldCount = inWorld ? (remotePlayers.size + 1) : 0;
        onlineCountEl.textContent = worldCount + " world online";
        totalOnlineCountEl.textContent = totalOnlinePlayers + " total online";
      }

      function hasFirebaseConfig(config) {
        return Boolean(config && config.apiKey && config.projectId && config.databaseURL);
      }

      function parseTileKey(key) {
        const parts = key.split("_");
        if (parts.length !== 2) return null;

        const tx = Number(parts[0]);
        const ty = Number(parts[1]);
        if (!Number.isInteger(tx) || !Number.isInteger(ty)) return null;
        if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return null;
        return { tx, ty };
      }

      function normalizeDropRecord(id, value) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.normalizeDropRecord !== "function") return null;
        return ctrl.normalizeDropRecord(id, value);
      }

      function getDropLabel(drop) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.getDropLabel !== "function") return "item";
        return ctrl.getDropLabel(drop);
      }

      function addOrUpdateWorldDrop(id, value) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.addOrUpdateWorldDrop !== "function") return;
        ctrl.addOrUpdateWorldDrop(id, value);
      }

      function clearWorldDrops() {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.clearWorldDrops !== "function") {
          worldDrops.clear();
          return;
        }
        ctrl.clearWorldDrops();
      }

      function removeWorldDrop(id) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.removeWorldDrop !== "function") {
          worldDrops.delete(String(id || ""));
          return;
        }
        ctrl.removeWorldDrop(id);
      }

      function getMaxDroppableAmount(entry) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.getMaxDroppableAmount !== "function") return 0;
        return ctrl.getMaxDroppableAmount(entry, getTradeController());
      }

      function isSameDropKind(drop, entry) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.isSameDropKind !== "function") return false;
        return ctrl.isSameDropKind(drop, entry);
      }

      function findNearbyDropStackCandidate(entry, x, y) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.findNearbyDropStackCandidate !== "function") return null;
        return ctrl.findNearbyDropStackCandidate(entry, x, y);
      }

      function applyStackAmountToLocalDrop(dropId, amountDelta) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.applyStackAmountToLocalDrop !== "function") return false;
        return ctrl.applyStackAmountToLocalDrop(dropId, amountDelta);
      }

      function spawnWorldDropEntry(entry, amount, dropX, dropY) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.spawnWorldDropEntry !== "function") return false;
        return ctrl.spawnWorldDropEntry(entry, amount, dropX, dropY);
      }

      function buildAdminDropPayload(entry, amount, dropX, dropY) {
        if (!entry || typeof entry !== "object") return null;
        const qty = Math.max(1, Math.floor(Number(amount) || 1));
        const worldX = Math.max(0, Math.min(Number(dropX) || 0, WORLD_W * TILE - TILE));
        const worldY = Math.max(0, Math.min(Number(dropY) || 0, WORLD_H * TILE - TILE));
        const payload = {
          type: "",
          blockId: 0,
          cosmeticId: "",
          toolId: "",
          amount: qty,
          x: worldX,
          y: worldY,
          ownerAccountId: playerProfileId || "",
          ownerSessionId: playerSessionId || "",
          ownerName: (playerName || "").toString().slice(0, 20),
          createdAt: Date.now()
        };
        if (entry.type === "block") {
          const blockId = Math.max(0, Math.floor(Number(entry.blockId) || 0));
          if (!blockId) return null;
          payload.type = "block";
          payload.blockId = blockId;
          return payload;
        }
        if (entry.type === "cosmetic") {
          const cosmeticId = String(entry.cosmeticId || "").trim().slice(0, 64);
          if (!cosmeticId) return null;
          payload.type = "cosmetic";
          payload.cosmeticId = cosmeticId;
          return payload;
        }
        if (entry.type === "tool") {
          const rawToolId = String(entry.toolId || "").trim().toLowerCase();
          const safeToolId = rawToolId === TOOL_FIST || rawToolId === TOOL_WRENCH ? rawToolId : "";
          if (!safeToolId) return null;
          payload.type = "tool";
          payload.toolId = safeToolId;
          return payload;
        }
        return null;
      }

      function spawnAdminWorldDrops(entry, amount, dropPoints) {
        if (!inWorld || !currentWorldId) return Promise.resolve({ ok: false, written: 0, error: "not_in_world" });
        const points = Array.isArray(dropPoints) ? dropPoints : [];
        if (!points.length) return Promise.resolve({ ok: false, written: 0, error: "no_points" });
        const rootPathNoSlash = BASE_PATH + "/worlds/" + currentWorldId + "/drops";
        const rootPath = "/" + rootPathNoSlash;
        const updates = {};
        let written = 0;
        for (let i = 0; i < points.length; i++) {
          const row = points[i] && typeof points[i] === "object" ? points[i] : {};
          const payload = buildAdminDropPayload(entry, amount, row.x, row.y);
          if (!payload) continue;
          const dropKey = makeAdminPushKey(rootPathNoSlash);
          if (!dropKey) continue;
          updates[dropKey] = payload;
          written++;
        }
        if (!written) return Promise.resolve({ ok: false, written: 0, error: "no_payload" });
        return proxyAdminUpdate(rootPath, updates).then((out) => {
          if (!out || !out.ok) {
            return {
              ok: false,
              written: 0,
              error: (out && out.error) ? String(out.error) : "backend_write_failed"
            };
          }
          return { ok: true, written };
        }).catch((error) => {
          return {
            ok: false,
            written: 0,
            error: String((error && error.message) || "backend_write_failed")
          };
        });
      }

      function dropInventoryEntry(entry, amount, dropX, dropY) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.dropInventoryEntry !== "function") return false;
        const ok = ctrl.dropInventoryEntry(entry, amount, dropX, dropY, getTradeController());
        if (ok) {
          playSfxEvent("drop", 0.5, "warn", "drop");
        }
        return ok;
      }

      function dropSelectedInventoryItem() {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.dropSelectedInventoryItem !== "function") return;
        ctrl.dropSelectedInventoryItem(getTradeController());
        playSfxEvent("drop", 0.5, "warn", "drop");
      }

      function tryPickupWorldDrop(drop) {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.tryPickupWorldDrop !== "function") return;
        ctrl.tryPickupWorldDrop(drop);
      }

      function updateWorldDrops() {
        const ctrl = getDropsController();
        if (!ctrl || typeof ctrl.updateWorldDrops !== "function") return;
        ctrl.updateWorldDrops();
      }

      function pickRandomWorlds(worldIds, count) {
        if (typeof menuModule.pickRandomWorlds === "function") {
          return menuModule.pickRandomWorlds(worldIds, count);
        }
        const pool = worldIds.slice();
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = pool[i];
          pool[i] = pool[j];
          pool[j] = tmp;
        }
        return pool.slice(0, count);
      }

      function getWorldLockOwnerAccountId(worldId) {
        const id = normalizeWorldId(worldId);
        if (!id) return "";
        const meta = worldIndexMetaById && worldIndexMetaById[id];
        const byIndex = (meta && meta.lockOwnerAccountId ? String(meta.lockOwnerAccountId) : "").trim();
        if (byIndex) return byIndex;
        const byCache = (worldLockOwnerCache.get(id) || "").toString().trim();
        return byCache;
      }

      function refreshOwnedWorldCacheByScan(worldIds) {
        if (inWorld || !network.enabled || !network.db || !playerProfileId) return;
        if (ownedWorldScanInFlight) return;
        const ids = Array.isArray(worldIds) ? worldIds.filter(Boolean) : [];
        if (!ids.length) return;
        const missing = ids.filter((id) => !getWorldLockOwnerAccountId(id));
        if (!missing.length) return;
        ownedWorldScanInFlight = true;
        const scanToken = ++ownedWorldScanToken;
        const batch = missing.slice(0, 120);
        Promise.all(batch.map((wid) => {
          return network.db.ref(BASE_PATH + "/worlds/" + wid + "/lock/ownerAccountId").once("value")
            .then((snap) => {
              const ownerId = snap && snap.val ? String(snap.val() || "").trim() : "";
              worldLockOwnerCache.set(wid, ownerId);
            })
            .catch(() => {
              worldLockOwnerCache.set(wid, "");
            });
        })).finally(() => {
          if (scanToken === ownedWorldScanToken) {
            ownedWorldScanInFlight = false;
            if (!inWorld && !hasRenderedMenuWorldList) {
              refreshWorldButtons(null, true);
            }
          }
        });
      }

      function refreshWorldButtons(worldIds, force) {
        if (Array.isArray(worldIds)) {
          knownWorldIds = Array.from(new Set(worldIds.filter(Boolean)));
        }
        if (!inWorld && hasRenderedMenuWorldList && !force && !Array.isArray(worldIds)) {
          return;
        }
        const occupancyWorlds = Array.from(worldOccupancy.keys());
        const unique = Array.from(new Set(knownWorldIds.concat(occupancyWorlds)));
        const ownedWorlds = unique
          .filter((id) => {
            const ownerId = getWorldLockOwnerAccountId(id);
            return ownerId && playerProfileId && ownerId === playerProfileId;
          })
          .sort((a, b) => {
            const ao = worldOccupancy.get(a) || 0;
            const bo = worldOccupancy.get(b) || 0;
            if (bo !== ao) return bo - ao;
            return a.localeCompare(b);
          });
        const othersPool = unique.filter((id) => !ownedWorlds.includes(id));
        const randomWorlds = pickRandomWorlds(othersPool, 8);

        worldButtonsEl.innerHTML = "";
        const renderWorldGroup = (title, ids, owned) => {
          if (!ids.length) return;
          const header = document.createElement("div");
          header.className = "world-group-title" + (owned ? " owned" : "");
          header.textContent = title;
          worldButtonsEl.appendChild(header);
          for (const id of ids) {
            const count = worldOccupancy.get(id) || 0;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "world-chip" + (owned ? " owned" : "");
            button.textContent = count > 0 ? id + " [" + count + "]" : id;
            eventsModule.on(button, "click", () => {
              switchWorld(id, true);
            });
            worldButtonsEl.appendChild(button);
          }
        };
        renderWorldGroup("Your Worlds", ownedWorlds, true);
        renderWorldGroup("Other Worlds", randomWorlds, false);
        refreshOwnedWorldCacheByScan(unique);
      }

      function detachCurrentWorldListeners() {
        if (blockSyncer && typeof blockSyncer.flush === "function") {
          blockSyncer.flush();
        }
        if (network.lockRef && network.handlers.worldLock) {
          network.lockRef.off("value", network.handlers.worldLock);
        }
        if (network.dropFeedRef && network.handlers.dropAdded) {
          network.dropFeedRef.off("child_added", network.handlers.dropAdded);
        }
        if (network.dropsRef && network.handlers.dropChanged) {
          network.dropsRef.off("child_changed", network.handlers.dropChanged);
        }
        if (network.dropsRef && network.handlers.dropRemoved) {
          network.dropsRef.off("child_removed", network.handlers.dropRemoved);
        }
        if (network.hitsRef && network.handlers.hitAdded) {
          network.hitsRef.off("child_added", network.handlers.hitAdded);
        }
        if (network.hitsRef && network.handlers.hitChanged) {
          network.hitsRef.off("child_changed", network.handlers.hitChanged);
        }
        if (network.hitsRef && network.handlers.hitRemoved) {
          network.hitsRef.off("child_removed", network.handlers.hitRemoved);
        }
        if (network.vendingRef && network.handlers.vendingAdded) {
          network.vendingRef.off("child_added", network.handlers.vendingAdded);
        }
        if (network.vendingRef && network.handlers.vendingChanged) {
          network.vendingRef.off("child_changed", network.handlers.vendingChanged);
        }
        if (network.vendingRef && network.handlers.vendingRemoved) {
          network.vendingRef.off("child_removed", network.handlers.vendingRemoved);
        }
        if (network.gambleRef && network.handlers.gambleAdded) {
          network.gambleRef.off("child_added", network.handlers.gambleAdded);
        }
        if (network.gambleRef && network.handlers.gambleChanged) {
          network.gambleRef.off("child_changed", network.handlers.gambleChanged);
        }
        if (network.gambleRef && network.handlers.gambleRemoved) {
          network.gambleRef.off("child_removed", network.handlers.gambleRemoved);
        }
        if (network.donationRef && network.handlers.donationAdded) {
          network.donationRef.off("child_added", network.handlers.donationAdded);
        }
        if (network.donationRef && network.handlers.donationChanged) {
          network.donationRef.off("child_changed", network.handlers.donationChanged);
        }
        if (network.donationRef && network.handlers.donationRemoved) {
          network.donationRef.off("child_removed", network.handlers.donationRemoved);
        }
        if (network.chestsRef && network.handlers.chestAdded) {
          network.chestsRef.off("child_added", network.handlers.chestAdded);
        }
        if (network.chestsRef && network.handlers.chestChanged) {
          network.chestsRef.off("child_changed", network.handlers.chestChanged);
        }
        if (network.chestsRef && network.handlers.chestRemoved) {
          network.chestsRef.off("child_removed", network.handlers.chestRemoved);
        }
        if (network.signsRef && network.handlers.signAdded) {
          network.signsRef.off("child_added", network.handlers.signAdded);
        }
        if (network.signsRef && network.handlers.signChanged) {
          network.signsRef.off("child_changed", network.handlers.signChanged);
        }
        if (network.signsRef && network.handlers.signRemoved) {
          network.signsRef.off("child_removed", network.handlers.signRemoved);
        }
        if (network.displaysRef && network.handlers.displayAdded) {
          network.displaysRef.off("child_added", network.handlers.displayAdded);
        }
        if (network.displaysRef && network.handlers.displayChanged) {
          network.displaysRef.off("child_changed", network.handlers.displayChanged);
        }
        if (network.displaysRef && network.handlers.displayRemoved) {
          network.displaysRef.off("child_removed", network.handlers.displayRemoved);
        }
        if (network.mannequinsRef && network.handlers.mannequinAdded) {
          network.mannequinsRef.off("child_added", network.handlers.mannequinAdded);
        }
        if (network.mannequinsRef && network.handlers.mannequinChanged) {
          network.mannequinsRef.off("child_changed", network.handlers.mannequinChanged);
        }
        if (network.mannequinsRef && network.handlers.mannequinRemoved) {
          network.mannequinsRef.off("child_removed", network.handlers.mannequinRemoved);
        }
        if (network.doorsRef && network.handlers.doorAdded) {
          network.doorsRef.off("child_added", network.handlers.doorAdded);
        }
        if (network.doorsRef && network.handlers.doorChanged) {
          network.doorsRef.off("child_changed", network.handlers.doorChanged);
        }
        if (network.doorsRef && network.handlers.doorRemoved) {
          network.doorsRef.off("child_removed", network.handlers.doorRemoved);
        }
        if (network.antiGravRef && network.handlers.antiGravAdded) {
          network.antiGravRef.off("child_added", network.handlers.antiGravAdded);
        }
        if (network.antiGravRef && network.handlers.antiGravChanged) {
          network.antiGravRef.off("child_changed", network.handlers.antiGravChanged);
        }
        if (network.antiGravRef && network.handlers.antiGravRemoved) {
          network.antiGravRef.off("child_removed", network.handlers.antiGravRemoved);
        }
        if (network.plantsRef && network.handlers.plantAdded) {
          network.plantsRef.off("child_added", network.handlers.plantAdded);
        }
        if (network.plantsRef && network.handlers.plantChanged) {
          network.plantsRef.off("child_changed", network.handlers.plantChanged);
        }
        if (network.plantsRef && network.handlers.plantRemoved) {
          network.plantsRef.off("child_removed", network.handlers.plantRemoved);
        }
        if (network.weatherRef && network.handlers.worldWeather) {
          network.weatherRef.off("value", network.handlers.worldWeather);
        }
        if (network.ownerTaxRef && network.handlers.worldOwnerTax) {
          network.ownerTaxRef.off("value", network.handlers.worldOwnerTax);
        }
        if (network.camerasRef && network.handlers.cameraAdded) {
          network.camerasRef.off("child_added", network.handlers.cameraAdded);
        }
        if (network.camerasRef && network.handlers.cameraChanged) {
          network.camerasRef.off("child_changed", network.handlers.cameraChanged);
        }
        if (network.camerasRef && network.handlers.cameraRemoved) {
          network.camerasRef.off("child_removed", network.handlers.cameraRemoved);
        }
        if (network.cameraLogsFeedRef && network.handlers.cameraLogAdded) {
          network.cameraLogsFeedRef.off("child_added", network.handlers.cameraLogAdded);
        }
        if (typeof syncWorldsModule.detachWorldListeners === "function") {
          syncWorldsModule.detachWorldListeners(network, network.handlers, true);
        } else if (network.playerRef) {
          network.playerRef.remove().catch(() => {});
        }
        if (blockSyncer && typeof blockSyncer.reset === "function") {
          blockSyncer.reset();
        }

        network.playerRef = null;
        network.playersRef = null;
        network.blocksRef = null;
        network.hitsRef = null;
        network.dropsRef = null;
        network.dropFeedRef = null;
        network.vendingRef = null;
        network.gambleRef = null;
        network.donationRef = null;
        network.chestsRef = null;
        network.signsRef = null;
        network.displaysRef = null;
        network.mannequinsRef = null;
        network.doorsRef = null;
        network.antiGravRef = null;
        network.plantsRef = null;
        network.weatherRef = null;
        network.ownerTaxRef = null;
        network.camerasRef = null;
        network.cameraLogsRef = null;
        network.cameraLogsFeedRef = null;
        network.spawnMetaRef = null;
        network.lockRef = null;
        network.chatRef = null;
        network.chatFeedRef = null;
        network.handlers.players = null;
        network.handlers.playerAdded = null;
        network.handlers.playerChanged = null;
        network.handlers.playerRemoved = null;
        network.handlers.blockAdded = null;
        network.handlers.blockChanged = null;
        network.handlers.blockRemoved = null;
        network.handlers.hitAdded = null;
        network.handlers.hitChanged = null;
        network.handlers.hitRemoved = null;
        network.handlers.dropAdded = null;
        network.handlers.dropChanged = null;
        network.handlers.dropRemoved = null;
        network.handlers.vendingAdded = null;
        network.handlers.vendingChanged = null;
        network.handlers.vendingRemoved = null;
        network.handlers.gambleAdded = null;
        network.handlers.gambleChanged = null;
        network.handlers.gambleRemoved = null;
        network.handlers.donationAdded = null;
        network.handlers.donationChanged = null;
        network.handlers.donationRemoved = null;
        network.handlers.chestAdded = null;
        network.handlers.chestChanged = null;
        network.handlers.chestRemoved = null;
        network.handlers.signAdded = null;
        network.handlers.signChanged = null;
        network.handlers.signRemoved = null;
        network.handlers.displayAdded = null;
        network.handlers.displayChanged = null;
        network.handlers.displayRemoved = null;
        network.handlers.mannequinAdded = null;
        network.handlers.mannequinChanged = null;
        network.handlers.mannequinRemoved = null;
        network.handlers.doorAdded = null;
        network.handlers.doorChanged = null;
        network.handlers.doorRemoved = null;
        network.handlers.antiGravAdded = null;
        network.handlers.antiGravChanged = null;
        network.handlers.antiGravRemoved = null;
        network.handlers.plantAdded = null;
        network.handlers.plantChanged = null;
        network.handlers.plantRemoved = null;
        network.handlers.worldWeather = null;
        network.handlers.worldOwnerTax = null;
        network.handlers.cameraAdded = null;
        network.handlers.cameraChanged = null;
        network.handlers.cameraRemoved = null;
        network.handlers.cameraLogAdded = null;
        network.handlers.worldLock = null;
        network.handlers.chatAdded = null;
        currentWorldLock = null;
        const ctrl = getVendingController();
        if (ctrl && typeof ctrl.clearAll === "function") ctrl.clearAll();
        const gambleCtrl = getGambleController();
        if (gambleCtrl && typeof gambleCtrl.clearAll === "function") gambleCtrl.clearAll();
        const donationCtrl = getDonationController();
        if (donationCtrl && typeof donationCtrl.clearAll === "function") donationCtrl.clearAll();
        const chestCtrl = getChestController();
        if (chestCtrl && typeof chestCtrl.clearAll === "function") chestCtrl.clearAll();
        const signCtrl = getSignController();
        if (signCtrl && typeof signCtrl.clearAll === "function") signCtrl.clearAll();
        displayItemsByTile.clear();
        mannequinOutfitsByTile.clear();
        doorAccessByTile.clear();
        antiGravityByTile.clear();
        cameraConfigsByTile.clear();
        cameraLogsByTile.clear();
        currentWorldWeather = null;
        currentWorldTax = null;
        {
          const questCtrl = getQuestWorldController();
          if (questCtrl && typeof questCtrl.onWorldLeave === "function") {
            questCtrl.onWorldLeave();
          }
        }
        clearWorldDrops();
        closeSignModal();
        closeWorldLockModal();
        closeOwnerTaxModal();
        closeDoorModal();
        closeCameraModal();
        closeWeatherModal();
        closeGambleModal();
        closeDonationModal();
        closeChestModal();
        closeSplicingModal();
        closeTradeMenuModal();
        closeTradeRequestModal();
        closeFriendModals();
      }

      function leaveCurrentWorld() {
        sendSystemWorldMessage(playerName + " left the world.");
        logCameraEvent(
          "player_leave",
          playerName + " left " + currentWorldId + ".",
          playerProfileId,
          playerName
        );
        addClientLog("Left world: " + currentWorldId + ".");
        detachCurrentWorldListeners();
        const remoteSyncCtrl = getRemotePlayerSyncController();
        if (remoteSyncCtrl && typeof remoteSyncCtrl.reset === "function") {
          remoteSyncCtrl.reset();
        } else {
          remotePlayers.clear();
        }
        overheadChatByPlayer.clear();
        touchControls.left = false;
        touchControls.right = false;
        touchControls.jump = false;
        clearReachOverrideOnExit(true);
        setInWorldState(false);
        if (antiCheatController && typeof antiCheatController.onWorldSwitch === "function") {
          antiCheatController.onWorldSwitch("menu");
        }
        if (network.enabled && network.globalPlayerRef) {
          syncPlayer(true);
        }
        refreshWorldButtons();
      }

      function respawnPlayerAtDoor() {
        if (!inWorld) return;
        const safe = findSafeDoorSpawnPosition();
        player.x = clampTeleport(safe.x, 0, WORLD_W * TILE - PLAYER_W - 2);
        player.y = clampTeleport(safe.y, 0, WORLD_H * TILE - PLAYER_H - 2);
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;
        airJumpsUsed = 0;
        suppressSpawnSafetyUntilMs = performance.now() + 350;
        if (network.enabled) {
          syncPlayer(true);
        }
      }

      function writeWorldIndexMeta(worldId, createIfMissing) {
        if (!network.worldsIndexRef) return;
        const indexRef = network.worldsIndexRef.child(worldId);

        if (createIfMissing) {
          indexRef.once("value").then((snap) => {
            if (!snap.exists()) {
              indexRef.set({
                id: worldId,
                createdBy: playerName,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
              });
            } else {
              indexRef.child("updatedAt").set(firebase.database.ServerValue.TIMESTAMP);
            }
          }).catch(() => {
            setNetworkState("World index error", true);
          });
          return;
        }

        indexRef.child("updatedAt").set(firebase.database.ServerValue.TIMESTAMP).catch(() => {});
      }

      function syncWorldIndexLockOwner(worldId, lockData) {
        if (!network.worldsIndexRef || !worldId) return;
        const lock = lockData && typeof lockData === "object" ? lockData : null;
        const ownerAccountId = lock && lock.ownerAccountId ? String(lock.ownerAccountId).trim() : "";
        const ownerName = lock && lock.ownerName ? String(lock.ownerName).slice(0, 20) : "";
        const indexRef = network.worldsIndexRef.child(worldId);
        if (ownerAccountId) {
          worldLockOwnerCache.set(worldId, ownerAccountId);
          indexRef.update({
            lockOwnerAccountId: ownerAccountId,
            lockOwnerName: ownerName || "",
            updatedAt: firebase.database.ServerValue.TIMESTAMP
          }).catch(() => {});
          return;
        }
        worldLockOwnerCache.set(worldId, "");
        indexRef.child("lockOwnerAccountId").remove().catch(() => {});
        indexRef.child("lockOwnerName").remove().catch(() => {});
      }

      function switchWorld(nextWorldId, createIfMissing, skipWorldBanCheck) {
        const worldId = normalizeWorldId(nextWorldId);
        if (!worldId) return;
        const requestToken = skipWorldBanCheck ? worldJoinRequestToken : (++worldJoinRequestToken);
        if (network.enabled && !skipWorldBanCheck && playerProfileId) {
          const lockRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/lock");
          lockRef.once("value").then((snapshot) => {
            if (requestToken !== worldJoinRequestToken) return;
            const lock = normalizeWorldLock(snapshot && snapshot.val ? snapshot.val() : null);
            if (!ensureNotWorldBanned(lock, worldId)) return;
            switchWorld(worldId, createIfMissing, true);
          }).catch(() => {
            if (requestToken !== worldJoinRequestToken) return;
            switchWorld(worldId, createIfMissing, true);
          });
          return;
        }
        const wasInWorld = inWorld;
        const previousWorldId = currentWorldId;
        if (antiCheatController && typeof antiCheatController.onWorldSwitch === "function") {
          antiCheatController.onWorldSwitch(worldId);
        }
        let transitionToken = 0;

        if (!network.enabled) {
          transitionToken = beginWorldTransition(worldId);
          setInWorldState(true);
          currentWorldId = worldId;
          resetSpawnStructureTile();
          setCurrentWorldUI();
          resetForWorldChange();
          {
            const questCtrl = getQuestWorldController();
            if (questCtrl && typeof questCtrl.onWorldEnter === "function") {
              questCtrl.onWorldEnter(worldId);
            }
          }
          refreshWorldButtons([worldId]);
          addChatMessage({
            name: "[System]",
            playerId: "",
            sessionId: playerSessionId || "",
            text: "Entered " + worldId + " with 1 player.",
            createdAt: Date.now()
          });
          applyQuestEvent("visit_world", { worldId });
          applyAchievementEvent("visit_world", { worldId });
          finishWorldTransition(transitionToken);
          return;
        }

        if (worldId === currentWorldId && network.playersRef) return;
        transitionToken = beginWorldTransition(worldId);

        if (wasInWorld && previousWorldId && previousWorldId !== worldId) {
          sendSystemWorldMessage(playerName + " left the world.");
          logCameraEvent(
            "player_leave",
            playerName + " left " + previousWorldId + ".",
            playerProfileId,
            playerName
          );
          addClientLog("Switched away from world: " + previousWorldId + ".");
          clearReachOverrideOnExit(true);
        }
        setInWorldState(true);
        detachCurrentWorldListeners();
        currentWorldId = worldId;
        resetSpawnStructureTile();
        setCurrentWorldUI();
        resetForWorldChange();
        writeWorldIndexMeta(worldId, createIfMissing);
        worldChatStartedAt = Date.now();

        const worldRefs = typeof syncWorldsModule.createWorldRefs === "function"
          ? syncWorldsModule.createWorldRefs(network.db, BASE_PATH, worldId)
          : null;
        network.playersRef = worldRefs && worldRefs.playersRef ? worldRefs.playersRef : network.db.ref(BASE_PATH + "/worlds/" + worldId + "/players");
        network.blocksRef = worldRefs && worldRefs.blocksRef ? worldRefs.blocksRef : network.db.ref(BASE_PATH + "/worlds/" + worldId + "/blocks");
        network.hitsRef = typeof syncHitsModule.createWorldHitsRef === "function"
          ? syncHitsModule.createWorldHitsRef(network.db, BASE_PATH, worldId)
          : network.db.ref(BASE_PATH + "/worlds/" + worldId + "/hits");
        network.dropsRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/drops");
        network.dropFeedRef = network.dropsRef.limitToLast(DROP_MAX_PER_WORLD);
        network.vendingRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/vending");
        network.gambleRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/gamble-machines");
        network.donationRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/donation-boxes");
        network.chestsRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/chests");
        network.signsRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/signs");
        network.displaysRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/displays");
        network.mannequinsRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/mannequins");
        network.doorsRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/doors");
        network.antiGravRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/anti-gravity");
        network.plantsRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/plants");
        network.weatherRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/weather");
        network.ownerTaxRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/owner-tax");
        network.camerasRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/cameras");
        network.cameraLogsRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/camera-logs");
        network.cameraLogsFeedRef = network.cameraLogsRef.limitToLast(500);
        network.spawnMetaRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/meta/spawn");
        network.lockRef = network.db.ref(BASE_PATH + "/worlds/" + worldId + "/lock");
        network.chatRef = worldRefs && worldRefs.chatRef ? worldRefs.chatRef : network.db.ref(BASE_PATH + "/worlds/" + worldId + "/chat");
        network.chatFeedRef = typeof syncWorldsModule.createChatFeed === "function"
          ? syncWorldsModule.createChatFeed(network.chatRef, worldChatStartedAt, 100)
          : (worldChatStartedAt > 0
            ? network.chatRef.orderByChild("createdAt").startAt(worldChatStartedAt).limitToLast(100)
            : network.chatRef.limitToLast(100));
        network.playerRef = network.playersRef.child(playerId);
        {
          const questCtrl = getQuestWorldController();
          if (questCtrl && typeof questCtrl.onWorldEnter === "function") {
            questCtrl.onWorldEnter(worldId);
          }
        }
        network.handlers.worldLock = (snapshot) => {
          currentWorldLock = normalizeWorldLock(snapshot.val());
          syncWorldIndexLockOwner(currentWorldId, currentWorldLock);
          if (!isWorldLockOwner() && !ensureNotWorldBanned(currentWorldLock, currentWorldId)) {
            leaveCurrentWorld();
            return;
          }
          if (worldLockModalEl && !worldLockModalEl.classList.contains("hidden")) {
            if (!isWorldLocked() || !isWorldLockOwner()) {
              closeWorldLockModal();
            } else {
              renderWorldLockModal();
            }
          }
        };
        if (network.lockRef && network.handlers.worldLock) {
          network.lockRef.on("value", network.handlers.worldLock);
        }

        const applyBlockValue = (tx, ty, id) => {
          clearTileDamage(tx, ty);
          const requiredId = getProtectedTileRequiredId(tx, ty);
          if (requiredId) {
            world[ty][tx] = requiredId;
            if (id !== requiredId && network.blocksRef) {
              network.blocksRef.child(tx + "_" + ty).set(requiredId).catch(() => {});
            }
            setLocalVendingMachine(tx, ty, null);
            setLocalGambleMachine(tx, ty, null);
            setLocalDonationBox(tx, ty, null);
            {
              const chestCtrl = getChestController();
              if (chestCtrl && typeof chestCtrl.setLocal === "function") {
                chestCtrl.setLocal(tx, ty, null);
              }
            }
            setLocalSignText(tx, ty, null);
            setLocalDisplayItem(tx, ty, null);
            setLocalMannequinOutfit(tx, ty, null);
            setLocalDoorAccess(tx, ty, null);
            setLocalAntiGravityState(tx, ty, null);
            setLocalCameraConfig(tx, ty, null);
            if (currentWorldTax && currentWorldTax.tx === tx && currentWorldTax.ty === ty) {
              setLocalWorldTax(null);
            }
            return;
          }
          world[ty][tx] = id;
          if (id === SPAWN_DOOR_ID) {
            setSpawnStructureTile(tx, ty);
          }
          if (id !== VENDING_ID) {
            setLocalVendingMachine(tx, ty, null);
          }
          if (id !== GAMBLE_ID) {
            setLocalGambleMachine(tx, ty, null);
          }
          if (!isDonationBoxBlockId(id)) {
            setLocalDonationBox(tx, ty, null);
          }
          if (!isChestBlockId(id)) {
            const chestCtrl = getChestController();
            if (chestCtrl && typeof chestCtrl.setLocal === "function") {
              chestCtrl.setLocal(tx, ty, null);
            }
          }
          if (id !== SIGN_ID) {
            setLocalSignText(tx, ty, null);
          }
          if (id !== DISPLAY_BLOCK_ID) {
            setLocalDisplayItem(tx, ty, null);
          }
          if (id !== MANNEQUIN_ID) {
            setLocalMannequinOutfit(tx, ty, null);
          }
          if (id !== DOOR_BLOCK_ID) {
            setLocalDoorAccess(tx, ty, null);
          }
          if (id !== ANTI_GRAV_ID) {
            setLocalAntiGravityState(tx, ty, null);
          }
          if (!isPlantSeedBlockId(id)) {
            setLocalTreePlant(tx, ty, null);
          }
          if (id !== CAMERA_ID) {
            setLocalCameraConfig(tx, ty, null);
          }
          if (id !== TAX_BLOCK_ID && currentWorldTax && currentWorldTax.tx === tx && currentWorldTax.ty === ty) {
            setLocalWorldTax(null);
          }
        };
        const clearBlockValue = (tx, ty) => {
          clearTileDamage(tx, ty);
          const requiredId = getProtectedTileRequiredId(tx, ty);
          if (requiredId) {
            world[ty][tx] = requiredId;
            if (network.blocksRef) {
              network.blocksRef.child(tx + "_" + ty).set(requiredId).catch(() => {});
            }
            setLocalVendingMachine(tx, ty, null);
            setLocalGambleMachine(tx, ty, null);
            setLocalDonationBox(tx, ty, null);
            {
              const chestCtrl = getChestController();
              if (chestCtrl && typeof chestCtrl.setLocal === "function") {
                chestCtrl.setLocal(tx, ty, null);
              }
            }
            setLocalSignText(tx, ty, null);
            setLocalDisplayItem(tx, ty, null);
            setLocalMannequinOutfit(tx, ty, null);
            setLocalDoorAccess(tx, ty, null);
            setLocalAntiGravityState(tx, ty, null);
            setLocalCameraConfig(tx, ty, null);
            if (currentWorldTax && currentWorldTax.tx === tx && currentWorldTax.ty === ty) {
              setLocalWorldTax(null);
            }
            return;
          }
          world[ty][tx] = 0;
          setLocalVendingMachine(tx, ty, null);
          setLocalGambleMachine(tx, ty, null);
          setLocalDonationBox(tx, ty, null);
          {
            const chestCtrl = getChestController();
            if (chestCtrl && typeof chestCtrl.setLocal === "function") {
              chestCtrl.setLocal(tx, ty, null);
            }
          }
          setLocalSignText(tx, ty, null);
          setLocalDisplayItem(tx, ty, null);
          setLocalMannequinOutfit(tx, ty, null);
          setLocalDoorAccess(tx, ty, null);
          setLocalAntiGravityState(tx, ty, null);
          setLocalTreePlant(tx, ty, null);
          setLocalCameraConfig(tx, ty, null);
          if (currentWorldTax && currentWorldTax.tx === tx && currentWorldTax.ty === ty) {
            setLocalWorldTax(null);
          }
        };

        const handlers = typeof syncWorldsModule.buildWorldHandlers === "function"
          ? syncWorldsModule.buildWorldHandlers({
            remotePlayers,
            playerId,
            normalizeRemoteEquippedCosmetics,
            updateOnlineCount,
            onRemotePlayerUpsert: (nextPlayer) => {
              const ctrl = getRemotePlayerSyncController();
              if (ctrl && typeof ctrl.upsert === "function") {
                ctrl.upsert(nextPlayer);
                return;
              }
              if (!nextPlayer || !nextPlayer.id) return;
              remotePlayers.set(nextPlayer.id, nextPlayer);
            },
            onRemotePlayerRemove: (id) => {
              const ctrl = getRemotePlayerSyncController();
              if (ctrl && typeof ctrl.remove === "function") {
                ctrl.remove(id);
                return;
              }
              if (remotePlayers && typeof remotePlayers.delete === "function") {
                remotePlayers.delete(id);
              }
            },
            onRemotePlayersReset: () => {
              const ctrl = getRemotePlayerSyncController();
              if (ctrl && typeof ctrl.reset === "function") {
                ctrl.reset();
                return;
              }
              if (remotePlayers && typeof remotePlayers.clear === "function") {
                remotePlayers.clear();
              }
            },
            parseTileKey,
            applyBlockValue,
            clearBlockValue,
            addChatMessage,
            onPlayerHit: (sourcePlayerId, rawHit) => {
              if (typeof syncHitsModule.consumeRemoteHit === "function") {
                syncHitsModule.consumeRemoteHit(remoteHitTracker, sourcePlayerId, rawHit, (tx, ty, hits) => {
                  if (hits <= 0) {
                    clearTileDamage(tx, ty);
                  } else {
                    setTileDamage(tx, ty, hits);
                  }
                });
                return;
              }
              if (!rawHit || typeof rawHit !== "object") return;
              const tx = Math.floor(Number(rawHit.tx));
              const ty = Math.floor(Number(rawHit.ty));
              const hits = Math.max(0, Math.floor(Number(rawHit.hits) || 0));
              if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
              if (hits <= 0) {
                clearTileDamage(tx, ty);
              } else {
                setTileDamage(tx, ty, hits);
              }
            }
          })
          : null;
        if (!handlers) {
          setNetworkState("Sync module missing", true);
          finishWorldTransition(transitionToken);
          return;
        }
        network.handlers.players = handlers.players;
        network.handlers.playerAdded = handlers.playerAdded;
        network.handlers.playerChanged = handlers.playerChanged;
        network.handlers.playerRemoved = handlers.playerRemoved;
        network.handlers.blockAdded = handlers.blockAdded;
        network.handlers.blockChanged = handlers.blockChanged;
        network.handlers.blockRemoved = handlers.blockRemoved;
        network.handlers.hitAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          const raw = snapshot.val();
          const normalized = typeof syncHitsModule.normalizeHitRecord === "function"
            ? syncHitsModule.normalizeHitRecord(raw)
            : (raw && typeof raw === "object" ? {
              hits: Math.max(0, Math.floor(Number(raw.hits) || 0)),
              updatedAt: Number(raw.updatedAt) || 0
            } : null);
          if (!normalized || !normalized.hits) {
            clearTileDamage(tile.tx, tile.ty);
            return;
          }
          setTileDamage(tile.tx, tile.ty, normalized.hits);
        };
        network.handlers.hitChanged = network.handlers.hitAdded;
        network.handlers.hitRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          clearTileDamage(tile.tx, tile.ty);
        };
        network.handlers.dropAdded = (snapshot) => {
          addOrUpdateWorldDrop(snapshot.key || "", snapshot.val() || {});
        };
        network.handlers.dropChanged = network.handlers.dropAdded;
        network.handlers.dropRemoved = (snapshot) => {
          removeWorldDrop(snapshot.key || "");
        };
        network.handlers.chatAdded = handlers.chatAdded;
        network.handlers.vendingAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalVendingMachine(tile.tx, tile.ty, snapshot.val());
        };
        network.handlers.vendingChanged = network.handlers.vendingAdded;
        network.handlers.vendingRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalVendingMachine(tile.tx, tile.ty, null);
        };
        network.handlers.gambleAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalGambleMachine(tile.tx, tile.ty, snapshot.val());
        };
        network.handlers.gambleChanged = network.handlers.gambleAdded;
        network.handlers.gambleRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalGambleMachine(tile.tx, tile.ty, null);
        };
        network.handlers.donationAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalDonationBox(tile.tx, tile.ty, snapshot.val());
        };
        network.handlers.donationChanged = network.handlers.donationAdded;
        network.handlers.donationRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalDonationBox(tile.tx, tile.ty, null);
        };
        network.handlers.chestAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          const chestCtrl = getChestController();
          if (chestCtrl && typeof chestCtrl.setLocal === "function") {
            chestCtrl.setLocal(tile.tx, tile.ty, snapshot.val());
          }
        };
        network.handlers.chestChanged = network.handlers.chestAdded;
        network.handlers.chestRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          const chestCtrl = getChestController();
          if (chestCtrl && typeof chestCtrl.setLocal === "function") {
            chestCtrl.setLocal(tile.tx, tile.ty, null);
          }
        };
        network.handlers.signAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalSignText(tile.tx, tile.ty, snapshot.val());
        };
        network.handlers.signChanged = network.handlers.signAdded;
        network.handlers.signRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalSignText(tile.tx, tile.ty, null);
        };
        network.handlers.displayAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalDisplayItem(tile.tx, tile.ty, snapshot.val());
        };
        network.handlers.displayChanged = network.handlers.displayAdded;
        network.handlers.displayRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalDisplayItem(tile.tx, tile.ty, null);
        };
        network.handlers.mannequinAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalMannequinOutfit(tile.tx, tile.ty, snapshot.val());
        };
        network.handlers.mannequinChanged = network.handlers.mannequinAdded;
        network.handlers.mannequinRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalMannequinOutfit(tile.tx, tile.ty, null);
        };
        network.handlers.doorAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalDoorAccess(tile.tx, tile.ty, snapshot.val());
        };
        network.handlers.doorChanged = network.handlers.doorAdded;
        network.handlers.doorRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalDoorAccess(tile.tx, tile.ty, null);
        };
        network.handlers.antiGravAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalAntiGravityState(tile.tx, tile.ty, snapshot.val());
        };
        network.handlers.antiGravChanged = network.handlers.antiGravAdded;
        network.handlers.antiGravRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalAntiGravityState(tile.tx, tile.ty, null);
        };
        network.handlers.plantAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalTreePlant(tile.tx, tile.ty, snapshot.val());
        };
        network.handlers.plantChanged = network.handlers.plantAdded;
        network.handlers.plantRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalTreePlant(tile.tx, tile.ty, null);
        };
        network.handlers.worldWeather = (snapshot) => {
          setLocalWorldWeather(snapshot.val());
        };
        network.handlers.worldOwnerTax = (snapshot) => {
          setLocalWorldTax(snapshot.val());
        };
        network.handlers.cameraAdded = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalCameraConfig(tile.tx, tile.ty, snapshot.val());
        };
        network.handlers.cameraChanged = network.handlers.cameraAdded;
        network.handlers.cameraRemoved = (snapshot) => {
          const tile = parseTileKey(snapshot.key || "");
          if (!tile) return;
          setLocalCameraConfig(tile.tx, tile.ty, null);
        };
        network.handlers.cameraLogAdded = (snapshot) => {
          const value = snapshot.val() || {};
          const tileKey = (value.tileKey || "").toString();
          const tile = parseTileKey(tileKey);
          if (!tile) return;
          if (!cameraConfigsByTile.has(tileKey) && (!world[tile.ty] || world[tile.ty][tile.tx] !== CAMERA_ID)) return;
          appendLocalCameraLog(tileKey, {
            tileKey,
            eventType: (value.eventType || "").toString().slice(0, 40),
            text: (value.text || "").toString().slice(0, 180),
            actorAccountId: (value.actorAccountId || "").toString().slice(0, 80),
            actorName: (value.actorName || "").toString().slice(0, 24),
            createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now()
          });
        };
        if (typeof syncWorldsModule.attachWorldListeners === "function") {
          syncWorldsModule.attachWorldListeners(network, network.handlers);
        }
        if (network.vendingRef && network.handlers.vendingAdded) {
          network.vendingRef.on("child_added", network.handlers.vendingAdded);
          network.vendingRef.on("child_changed", network.handlers.vendingChanged);
          network.vendingRef.on("child_removed", network.handlers.vendingRemoved);
        }
        if (network.gambleRef && network.handlers.gambleAdded) {
          network.gambleRef.on("child_added", network.handlers.gambleAdded);
          network.gambleRef.on("child_changed", network.handlers.gambleChanged);
          network.gambleRef.on("child_removed", network.handlers.gambleRemoved);
        }
        if (network.donationRef && network.handlers.donationAdded) {
          network.donationRef.on("child_added", network.handlers.donationAdded);
          network.donationRef.on("child_changed", network.handlers.donationChanged);
          network.donationRef.on("child_removed", network.handlers.donationRemoved);
        }
        if (network.chestsRef && network.handlers.chestAdded) {
          network.chestsRef.on("child_added", network.handlers.chestAdded);
          network.chestsRef.on("child_changed", network.handlers.chestChanged);
          network.chestsRef.on("child_removed", network.handlers.chestRemoved);
        }
        if (network.dropFeedRef && network.handlers.dropAdded) {
          network.dropFeedRef.on("child_added", network.handlers.dropAdded);
          network.dropsRef.on("child_changed", network.handlers.dropChanged);
          network.dropsRef.on("child_removed", network.handlers.dropRemoved);
        }
        if (network.hitsRef && network.handlers.hitAdded) {
          network.hitsRef.on("child_added", network.handlers.hitAdded);
          network.hitsRef.on("child_changed", network.handlers.hitChanged);
          network.hitsRef.on("child_removed", network.handlers.hitRemoved);
        }
        if (network.signsRef && network.handlers.signAdded) {
          network.signsRef.on("child_added", network.handlers.signAdded);
          network.signsRef.on("child_changed", network.handlers.signChanged);
          network.signsRef.on("child_removed", network.handlers.signRemoved);
        }
        if (network.displaysRef && network.handlers.displayAdded) {
          network.displaysRef.on("child_added", network.handlers.displayAdded);
          network.displaysRef.on("child_changed", network.handlers.displayChanged);
          network.displaysRef.on("child_removed", network.handlers.displayRemoved);
        }
        if (network.mannequinsRef && network.handlers.mannequinAdded) {
          network.mannequinsRef.on("child_added", network.handlers.mannequinAdded);
          network.mannequinsRef.on("child_changed", network.handlers.mannequinChanged);
          network.mannequinsRef.on("child_removed", network.handlers.mannequinRemoved);
        }
        if (network.doorsRef && network.handlers.doorAdded) {
          network.doorsRef.on("child_added", network.handlers.doorAdded);
          network.doorsRef.on("child_changed", network.handlers.doorChanged);
          network.doorsRef.on("child_removed", network.handlers.doorRemoved);
        }
        if (network.antiGravRef && network.handlers.antiGravAdded) {
          network.antiGravRef.on("child_added", network.handlers.antiGravAdded);
          network.antiGravRef.on("child_changed", network.handlers.antiGravChanged);
          network.antiGravRef.on("child_removed", network.handlers.antiGravRemoved);
        }
        if (network.plantsRef && network.handlers.plantAdded) {
          network.plantsRef.on("child_added", network.handlers.plantAdded);
          network.plantsRef.on("child_changed", network.handlers.plantChanged);
          network.plantsRef.on("child_removed", network.handlers.plantRemoved);
        }
        if (network.weatherRef && network.handlers.worldWeather) {
          network.weatherRef.on("value", network.handlers.worldWeather);
        }
        if (network.ownerTaxRef && network.handlers.worldOwnerTax) {
          network.ownerTaxRef.on("value", network.handlers.worldOwnerTax);
        }
        if (network.camerasRef && network.handlers.cameraAdded) {
          network.camerasRef.on("child_added", network.handlers.cameraAdded);
          network.camerasRef.on("child_changed", network.handlers.cameraChanged);
          network.camerasRef.on("child_removed", network.handlers.cameraRemoved);
        }
        if (network.cameraLogsFeedRef && network.handlers.cameraLogAdded) {
          network.cameraLogsFeedRef.on("child_added", network.handlers.cameraLogAdded);
        }
        if (network.blocksRef && typeof network.blocksRef.once === "function") {
          const blocksPromise = network.blocksRef.once("value");
          const metaPromise = network.spawnMetaRef && typeof network.spawnMetaRef.once === "function"
            ? network.spawnMetaRef.once("value").catch(() => null)
            : Promise.resolve(null);
          Promise.all([blocksPromise, metaPromise]).then(([blocksSnap, metaSnap]) => {
            if (!inWorld || currentWorldId !== worldId) return;
            const blockMap = blocksSnap && blocksSnap.val ? (blocksSnap.val() || {}) : {};
            const meta = metaSnap && metaSnap.val ? (metaSnap.val() || {}) : {};
            const metaTx = Math.floor(Number(meta.tx));
            const metaTy = Math.floor(Number(meta.ty));
            const hasMetaSpawn = Number.isInteger(metaTx) && Number.isInteger(metaTy)
              && metaTx >= 0 && metaTy >= 0 && metaTx < WORLD_W && metaTy < WORLD_H - 1;
            if (hasMetaSpawn) {
              setSpawnStructureTile(metaTx, metaTy);
            } else {
              const found = applySpawnStructureFromBlockMap(blockMap);
              if (!found) {
                refreshSpawnStructureFromWorld();
              }
            }
            cleanupSpawnStructureInWorldData();
            const tiles = getSpawnStructureTiles();
            const updates = buildSpawnStructureCleanupUpdates(blockMap, tiles.door.tx, tiles.door.ty);
            network.blocksRef.update(updates).catch(() => {});
            if (network.spawnMetaRef) {
              network.spawnMetaRef.set({
                tx: tiles.door.tx,
                ty: tiles.door.ty,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
              }).catch(() => {});
            }
            ensurePlayerSafeSpawn(true);
          }).catch(() => {
            if (!inWorld || currentWorldId !== worldId) return;
            refreshSpawnStructureFromWorld();
            cleanupSpawnStructureInWorldData();
            enforceSpawnStructureInDatabase();
            ensurePlayerSafeSpawn(true);
          });
        } else {
          refreshSpawnStructureFromWorld();
          cleanupSpawnStructureInWorldData();
          enforceSpawnStructureInDatabase();
          ensurePlayerSafeSpawn(true);
        }
        addClientLog("Joined world: " + worldId + ".");
        sendSystemWorldMessage(playerName + " joined the world.");
        setTimeout(() => {
          if (!inWorld || currentWorldId !== worldId) return;
          logCameraEvent(
            "player_join",
            playerName + " entered " + worldId + ".",
            playerProfileId,
            playerName
          );
        }, 140);
        network.playersRef.once("value").then((snapshot) => {
          const players = snapshot.val() || {};
          let count = Object.keys(players).length;
          if (!players[playerId]) count += 1;
          addChatMessage({
            name: "[System]",
            playerId: "",
            sessionId: playerSessionId || "",
            text: "Entered " + worldId + " with " + count + " player" + (count === 1 ? "" : "s") + ".",
            createdAt: Date.now()
          });
        }).catch(() => {});
        applyQuestEvent("visit_world", { worldId });
        applyAchievementEvent("visit_world", { worldId });

        if (network.connected) {
          if (network.globalPlayerRef) {
            network.globalPlayerRef.onDisconnect().remove();
          }
          network.playerRef.onDisconnect().remove();
          syncPlayer(true);
          setNetworkState("Online", false);
        } else {
          setNetworkState("Connecting...", false);
        }

        if (pendingTeleportSelf && pendingTeleportSelf.worldId === currentWorldId) {
          suppressSpawnSafetyUntilMs = performance.now() + 2500;
          player.x = clampTeleport(pendingTeleportSelf.x, 0, WORLD_W * TILE - PLAYER_W - 2);
          player.y = clampTeleport(pendingTeleportSelf.y, 0, WORLD_H * TILE - PLAYER_H - 2);
          player.vx = 0;
          player.vy = 0;
          pendingTeleportSelf = null;
          syncPlayer(true);
        }
        ensurePlayerSafeSpawn(false);
        setTimeout(() => {
          if (!inWorld || currentWorldId !== worldId) return;
          ensurePlayerSafeSpawn(false);
        }, 350);
        setTimeout(() => {
          if (!inWorld || currentWorldId !== worldId) return;
          ensurePlayerSafeSpawn(false);
        }, 1200);
        finishWorldTransition(transitionToken);
      }

      function syncBlock(tx, ty, id) {
        if (!network.enabled || !network.blocksRef) return;
        syncTileDamageToNetwork(tx, ty, 0);
        if (blockSyncer && typeof blockSyncer.enqueue === "function") {
          blockSyncer.enqueue(tx, ty, id);
          return;
        }
        network.blocksRef.child(tx + "_" + ty).set(id).catch(() => {
          setNetworkState("Network error", true);
        });
      }

      function syncPlayer(force) {
        if (!network.enabled) return;
        if (!network.playerRef && !network.globalPlayerRef) return;

        const now = performance.now();
        let writePlayer = inWorld && Boolean(network.playerRef);
        let writeGlobal = Boolean(network.globalPlayerRef);

        // Figure out if we ACTUALLY need to sync before allocating memory
        if (playerSyncController && typeof playerSyncController.compute === "function") {
          const syncDecision = playerSyncController.compute({
            nowMs: now,
            force,
            x: Math.round(player.x),
            y: Math.round(player.y),
            facing: player.facing,
            world: inWorld ? currentWorldId : "menu"
          });
          writePlayer = Boolean(syncDecision.writePlayer);
          writeGlobal = Boolean(syncDecision.writeGlobal) && Boolean(network.globalPlayerRef);
        }

        // OPTIMIZATION: Early exit! Saves 60 heavy object allocations per second.
        if (!writePlayer && !writeGlobal) return;

        const rawPayload = {
          name: playerName,
          accountId: playerProfileId,
          x: Math.round(player.x),
          y: Math.round(player.y),
          facing: player.facing,
          cosmetics: {
            shirts: equippedCosmetics.shirts || "",
            pants: equippedCosmetics.pants || "",
            shoes: equippedCosmetics.shoes || "",
            hats: equippedCosmetics.hats || "",
            wings: equippedCosmetics.wings || "",
            swords: equippedCosmetics.swords || ""
          },
          title: getEquippedTitlePayload(),
          progression: buildProgressionPayload(),
          achievements: getAchievementsSummary(),
          danceUntil: Math.max(0, Math.floor(danceUntilMs)),
          world: inWorld ? currentWorldId : "menu",
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        };
        
        const payload = typeof syncPlayerModule.buildPayload === "function"
          ? syncPlayerModule.buildPayload(rawPayload)
          : rawPayload;

        if (writePlayer && network.playerRef) {
          network.playerRef.update(payload).catch(() => {
            setNetworkState("Network error", true);
          });
        }
        if (writeGlobal && network.globalPlayerRef) {
          network.globalPlayerRef.update(payload).catch(() => {
            setNetworkState("Network error", true);
          });
        }
      }

      function enterWorldFromInput() {
        const id = normalizeWorldId(worldInputEl.value);
        if (!id) return;
        switchWorld(id, true);
      }

      function bindWorldControls() {
        bindChatPanelDrag();
        bindInventoryPanelDrag();
        eventsModule.on(enterWorldBtn, "click", enterWorldFromInput);
        eventsModule.on(chatToggleBtn, "click", () => {
          if (!inWorld) return;
          openShopMenuFromUi();
        });
        if (gtMainMenuBtnEl) {
          eventsModule.on(gtMainMenuBtnEl, "click", () => {
            if (!inWorld) return;
            toggleQuickMenuMode("main");
          });
        }
        if (gtSocialMenuBtnEl) {
          eventsModule.on(gtSocialMenuBtnEl, "click", () => {
            if (!inWorld) return;
            toggleQuickMenuMode("social");
          });
        }
        if (gtShopQuickBtnEl) {
          eventsModule.on(gtShopQuickBtnEl, "click", () => {
            if (!inWorld) return;
            setQuickMenuMode("");
            openShopMenuFromUi();
          });
        }
        if (gtMenuQuitBtnEl) {
          eventsModule.on(gtMenuQuitBtnEl, "click", () => {
            if (!inWorld) return;
            setQuickMenuMode("");
            leaveCurrentWorld();
          });
        }
        if (gtMenuRespawnBtnEl) {
          eventsModule.on(gtMenuRespawnBtnEl, "click", () => {
            if (!inWorld) return;
            setQuickMenuMode("");
            respawnPlayerAtDoor();
          });
        }
        if (gtMenuAdminBtnEl) {
          eventsModule.on(gtMenuAdminBtnEl, "click", () => {
            if (!inWorld || !canUseAdminPanel) return;
            setQuickMenuMode("");
            setAdminOpen(true);
          });
        }
        if (gtMenuAchievementsBtnEl) {
          eventsModule.on(gtMenuAchievementsBtnEl, "click", () => {
            if (!inWorld) return;
            setQuickMenuMode("");
            openAchievementsMenu();
          });
        }
        if (gtMenuTitlesBtnEl) {
          eventsModule.on(gtMenuTitlesBtnEl, "click", () => {
            if (!inWorld) return;
            setQuickMenuMode("");
            openTitlesMenu();
          });
        }
        if (gtMenuResumeBtnEl) {
          eventsModule.on(gtMenuResumeBtnEl, "click", () => {
            setQuickMenuMode("");
          });
        }
        if (gtSocialFriendsBtnEl) {
          eventsModule.on(gtSocialFriendsBtnEl, "click", () => {
            if (!inWorld) return;
            setQuickMenuMode("");
            openFriendsMenuFromUi();
          });
        }
        if (gtSocialQuestsBtnEl) {
          eventsModule.on(gtSocialQuestsBtnEl, "click", () => {
            if (!inWorld) return;
            setQuickMenuMode("");
            openQuestsMenu();
          });
        }
        if (gtSocialResumeBtnEl) {
          eventsModule.on(gtSocialResumeBtnEl, "click", () => {
            setQuickMenuMode("");
          });
        }
        eventsModule.on(window, "pointerdown", (event) => {
          if (!gtQuickMenuMode || !gtQuickActionsEl) return;
          const target = event.target;
          if (target instanceof Node && gtQuickActionsEl.contains(target)) return;
          setQuickMenuMode("");
        }, { capture: true });
        if (shopToggleBtn) {
          eventsModule.on(shopToggleBtn, "click", () => {
            openShopMenuFromUi();
          });
        }
        if (achievementsToggleBtn) {
          eventsModule.on(achievementsToggleBtn, "click", () => {
            openAchievementsMenu();
          });
        }
        if (questsToggleBtn) {
          eventsModule.on(questsToggleBtn, "click", () => {
            openQuestsMenu();
          });
        }
        if (titlesToggleBtn) {
          eventsModule.on(titlesToggleBtn, "click", () => {
            openTitlesMenu();
          });
        }
        if (achievementsCloseBtn) {
          eventsModule.on(achievementsCloseBtn, "click", () => {
            closeAchievementsMenu();
          });
        }
        if (questsCloseBtn) {
          eventsModule.on(questsCloseBtn, "click", () => {
            closeQuestsMenu();
          });
        }
        if (titlesCloseBtn) {
          eventsModule.on(titlesCloseBtn, "click", () => {
            closeTitlesMenu();
          });
        }
        if (achievementsModalEl) {
          eventsModule.on(achievementsModalEl, "click", (event) => {
            if (event.target === achievementsModalEl) {
              closeAchievementsMenu();
            }
          });
        }
        if (achievementsActionsEl) {
          eventsModule.on(achievementsActionsEl, "click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (String(target.dataset.achAct || "") === "close") {
              closeAchievementsMenu();
            }
          });
        }
        if (questsModalEl) {
          eventsModule.on(questsModalEl, "click", (event) => {
            if (event.target === questsModalEl) {
              closeQuestsMenu();
            }
          });
        }
        if (titlesModalEl) {
          eventsModule.on(titlesModalEl, "click", (event) => {
            if (event.target === titlesModalEl) {
              closeTitlesMenu();
            }
          });
        }
        if (questsActionsEl) {
          eventsModule.on(questsActionsEl, "click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (String(target.dataset.questAct || "") === "close") {
              closeQuestsMenu();
            }
          });
        }
        if (titlesActionsEl) {
          eventsModule.on(titlesActionsEl, "click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (String(target.dataset.titleAct || "") === "close") {
              closeTitlesMenu();
            }
          });
        }
        if (titlesBodyEl) {
          eventsModule.on(titlesBodyEl, "click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const titleId = String(target.dataset.titleEquip || "").trim();
            if (!titleId) return;
            equipTitle(titleId);
            renderTitlesMenu();
          });
        }
        eventsModule.on(adminToggleBtn, "click", () => {
          setAdminOpen(!isAdminOpen);
        });
        eventsModule.on(adminCloseBtn, "click", () => {
          setAdminOpen(false);
        });
        if (adminInventoryCloseBtn) {
          eventsModule.on(adminInventoryCloseBtn, "click", () => {
            closeAdminInventoryModal();
          });
        }
        if (adminInventoryModalEl) {
          eventsModule.on(adminInventoryModalEl, "click", (event) => {
            if (event.target === adminInventoryModalEl) {
              closeAdminInventoryModal();
            }
          });
        }
        if (adminInventoryBodyEl) {
          eventsModule.on(adminInventoryBodyEl, "click", handleAdminInventoryModalAction);
          eventsModule.on(adminInventoryBodyEl, "change", handleAdminInventoryModalChange);
        }
        const vendingCtrl = getVendingController();
        if (vendingCtrl && typeof vendingCtrl.bindModalEvents === "function") {
          vendingCtrl.bindModalEvents();
        }
        const donationCtrl = getDonationController();
        if (donationCtrl && typeof donationCtrl.bindModalEvents === "function") {
          donationCtrl.bindModalEvents();
        }
        const chestCtrl = getChestController();
        if (chestCtrl && typeof chestCtrl.bindModalEvents === "function") {
          chestCtrl.bindModalEvents();
        }
        const gambleCtrl = getGambleController();
        if (gambleCtrl && typeof gambleCtrl.bindModalEvents === "function") {
          gambleCtrl.bindModalEvents();
        }
        const splicingCtrl = getSplicingController();
        if (splicingCtrl && typeof splicingCtrl.bindModalEvents === "function") {
          splicingCtrl.bindModalEvents();
        }
        if (signCloseBtn) {
          eventsModule.on(signCloseBtn, "click", () => {
            closeSignModal();
          });
        }
        if (signModalEl) {
          eventsModule.on(signModalEl, "click", (event) => {
            if (event.target === signModalEl) {
              closeSignModal();
            }
          });
        }
        if (signSaveBtn) {
          eventsModule.on(signSaveBtn, "click", () => {
            const signCtrl = getSignController();
            if (!signCtrl || typeof signCtrl.getEditContext !== "function" || !signTextInputEl) return;
            const editCtx = signCtrl.getEditContext();
            if (!editCtx) return;
            const tx = Number(editCtx.tx);
            const ty = Number(editCtx.ty);
            if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
            if (!canEditCurrentWorld()) {
              notifyWorldLockedDenied();
              closeSignModal();
              return;
            }
            if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H || world[ty][tx] !== SIGN_ID) {
              closeSignModal();
              return;
            }
            saveSignText(tx, ty, signTextInputEl.value || "");
            closeSignModal();
            postLocalSystemChat("Sign saved.");
          });
        }
        if (worldLockCloseBtn) {
          eventsModule.on(worldLockCloseBtn, "click", () => {
            closeWorldLockModal();
          });
        }
        if (worldLockModalEl) {
          eventsModule.on(worldLockModalEl, "click", (event) => {
            if (event.target === worldLockModalEl) {
              closeWorldLockModal();
              return;
            }
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const removeAccountId = (target.dataset.worldlockRemove || "").trim();
            if (removeAccountId) {
              removeWorldAdmin(removeAccountId);
              return;
            }
            const unbanAccountId = (target.dataset.worldlockUnban || "").trim();
            if (unbanAccountId) {
              unbanWorldPlayer(unbanAccountId);
            }
          });
        }
        if (worldLockAdminAddBtn) {
          eventsModule.on(worldLockAdminAddBtn, "click", () => {
            if (!worldLockAdminInputEl) return;
            addWorldAdminByUsername(worldLockAdminInputEl.value || "");
          });
        }
        if (worldLockAdminInputEl) {
          eventsModule.on(worldLockAdminInputEl, "keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addWorldAdminByUsername(worldLockAdminInputEl.value || "");
          });
        }
        if (worldLockBan1hBtn) {
          eventsModule.on(worldLockBan1hBtn, "click", () => {
            if (!worldLockBanInputEl) return;
            setWorldBanByUsername(worldLockBanInputEl.value || "", 60 * 60 * 1000);
          });
        }
        if (worldLockBanPermBtn) {
          eventsModule.on(worldLockBanPermBtn, "click", () => {
            if (!worldLockBanInputEl) return;
            setWorldBanByUsername(worldLockBanInputEl.value || "", 0);
          });
        }
        if (worldLockBanInputEl) {
          eventsModule.on(worldLockBanInputEl, "keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            setWorldBanByUsername(worldLockBanInputEl.value || "", 60 * 60 * 1000);
          });
        }
        if (ownerTaxCloseBtn) {
          eventsModule.on(ownerTaxCloseBtn, "click", () => {
            closeOwnerTaxModal();
          });
        }
        if (ownerTaxModalEl) {
          eventsModule.on(ownerTaxModalEl, "click", (event) => {
            if (event.target === ownerTaxModalEl) {
              closeOwnerTaxModal();
            }
          });
        }
        if (ownerTaxSaveBtn) {
          eventsModule.on(ownerTaxSaveBtn, "click", () => {
            if (!ownerTaxEditContext) return;
            const tx = Number(ownerTaxEditContext.tx);
            const ty = Number(ownerTaxEditContext.ty);
            if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
            if (!isWorldLocked() || !isWorldLockOwner()) {
              notifyWorldLockedDenied();
              closeOwnerTaxModal();
              return;
            }
            if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H || world[ty][tx] !== TAX_BLOCK_ID) {
              closeOwnerTaxModal();
              return;
            }
            const raw = ownerTaxPercentInputEl ? ownerTaxPercentInputEl.value : "";
            const parsed = Math.floor(Number(raw));
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
              postLocalSystemChat("Owner tax must be between 0 and 100.");
              return;
            }
            saveOwnerTaxConfig(tx, ty, parsed);
          });
        }
        if (ownerTaxCollectBtn) {
          eventsModule.on(ownerTaxCollectBtn, "click", () => {
            if (!ownerTaxEditContext) return;
            const tx = Number(ownerTaxEditContext.tx);
            const ty = Number(ownerTaxEditContext.ty);
            if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
            collectOwnerTaxEarnings(tx, ty);
          });
        }
        if (ownerTaxPercentInputEl) {
          eventsModule.on(ownerTaxPercentInputEl, "keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (ownerTaxSaveBtn && typeof ownerTaxSaveBtn.click === "function") {
              ownerTaxSaveBtn.click();
            }
          });
        }
        if (doorCloseBtn) {
          eventsModule.on(doorCloseBtn, "click", () => {
            closeDoorModal();
          });
        }
        if (doorModalEl) {
          eventsModule.on(doorModalEl, "click", (event) => {
            if (event.target === doorModalEl) {
              closeDoorModal();
            }
          });
        }
        if (doorPublicBtn) {
          eventsModule.on(doorPublicBtn, "click", () => {
            if (!doorEditContext) return;
            const tx = Number(doorEditContext.tx);
            const ty = Number(doorEditContext.ty);
            if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
            if (!isWorldLocked() || !isWorldLockOwner()) {
              notifyWorldLockedDenied();
              closeDoorModal();
              return;
            }
            if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H || world[ty][tx] !== DOOR_BLOCK_ID) {
              closeDoorModal();
              return;
            }
            saveDoorMode(tx, ty, "public");
            openDoorModal(tx, ty);
            postLocalSystemChat("Door access set to public.");
          });
        }
        if (doorOwnerOnlyBtn) {
          eventsModule.on(doorOwnerOnlyBtn, "click", () => {
            if (!doorEditContext) return;
            const tx = Number(doorEditContext.tx);
            const ty = Number(doorEditContext.ty);
            if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
            if (!isWorldLocked() || !isWorldLockOwner()) {
              notifyWorldLockedDenied();
              closeDoorModal();
              return;
            }
            if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H || world[ty][tx] !== DOOR_BLOCK_ID) {
              closeDoorModal();
              return;
            }
            saveDoorMode(tx, ty, "owner");
            openDoorModal(tx, ty);
            postLocalSystemChat("Door access set to owner only.");
          });
        }
        if (cameraCloseBtn) {
          eventsModule.on(cameraCloseBtn, "click", () => {
            closeCameraModal();
          });
        }
        if (cameraModalEl) {
          eventsModule.on(cameraModalEl, "click", (event) => {
            if (event.target === cameraModalEl) {
              closeCameraModal();
            }
          });
        }
        if (cameraSaveBtn) {
          eventsModule.on(cameraSaveBtn, "click", () => {
            if (!cameraEditContext) return;
            const tx = Number(cameraEditContext.tx);
            const ty = Number(cameraEditContext.ty);
            if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
            if (!canEditCurrentWorld()) {
              notifyWorldLockedDenied();
              closeCameraModal();
              return;
            }
            if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H || world[ty][tx] !== CAMERA_ID) {
              closeCameraModal();
              return;
            }
            saveCameraConfig(tx, ty, {
              events: {
                playerJoin: Boolean(cameraEventJoinEl && cameraEventJoinEl.checked),
                playerLeave: Boolean(cameraEventLeaveEl && cameraEventLeaveEl.checked),
                vendingPurchase: Boolean(cameraEventVendingEl && cameraEventVendingEl.checked)
              },
              excludeAdminOwner: Boolean(cameraFilterStaffEl && cameraFilterStaffEl.checked)
            });
            postLocalSystemChat("Camera settings saved.");
            renderCameraModal();
          });
        }
        if (weatherPreviewImgEl && weatherPreviewEmptyEl) {
          eventsModule.on(weatherPreviewImgEl, "error", () => {
            weatherPreviewImgEl.classList.add("hidden");
            if (weatherPreviewEmptyEl) weatherPreviewEmptyEl.classList.remove("hidden");
          });
          eventsModule.on(weatherPreviewImgEl, "load", () => {
            weatherPreviewImgEl.classList.remove("hidden");
            if (weatherPreviewEmptyEl) weatherPreviewEmptyEl.classList.add("hidden");
          });
        }
        if (weatherCloseBtn) {
          eventsModule.on(weatherCloseBtn, "click", () => {
            closeWeatherModal();
          });
        }
        if (weatherModalEl) {
          eventsModule.on(weatherModalEl, "click", (event) => {
            if (event.target === weatherModalEl) {
              closeWeatherModal();
            }
          });
        }
        if (weatherPresetSelectEl) {
          eventsModule.on(weatherPresetSelectEl, "change", () => {
            refreshWeatherPreview();
          });
        }
        if (weatherImageUrlInputEl) {
          eventsModule.on(weatherImageUrlInputEl, "input", () => {
            refreshWeatherPreview();
          });
        }
        if (weatherSaveBtn) {
          eventsModule.on(weatherSaveBtn, "click", () => {
            if (!weatherEditContext) return;
            const tx = Number(weatherEditContext.tx);
            const ty = Number(weatherEditContext.ty);
            if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
            if (!canEditCurrentWorld()) {
              notifyWorldLockedDenied();
              closeWeatherModal();
              return;
            }
            if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H || world[ty][tx] !== WEATHER_MACHINE_ID) {
              closeWeatherModal();
              return;
            }
            const presetId = weatherPresetSelectEl ? weatherPresetSelectEl.value : "none";
            const imageUrl = weatherImageUrlInputEl ? weatherImageUrlInputEl.value : "";
            saveWorldWeatherFromMachine(tx, ty, presetId, imageUrl);
            postLocalSystemChat("Weather updated.");
            renderWeatherModal();
          });
        }
        if (weatherClearBtn) {
          eventsModule.on(weatherClearBtn, "click", () => {
            if (!weatherEditContext) return;
            const accepted = window.confirm("Clear world weather and return to default sky?");
            if (!accepted) return;
            saveWorldWeatherFromMachine(Number(weatherEditContext.tx), Number(weatherEditContext.ty), "none", "");
            postLocalSystemChat("Weather cleared.");
            renderWeatherModal();
          });
        }
        const tradeCtrl = getTradeController();
        if (tradeCtrl && typeof tradeCtrl.bindUiEvents === "function") {
          tradeCtrl.bindUiEvents();
        }
        const friendCtrl = getFriendsController();
        if (friendCtrl && typeof friendCtrl.bindUiEvents === "function") {
          friendCtrl.bindUiEvents();
        }
        if (adminSearchInput) {
          eventsModule.on(adminSearchInput, "input", () => {
            adminSearchQuery = (adminSearchInput.value || "").trim().toLowerCase();
            renderAdminPanel();
          });
        }
        if (adminAuditActionFilterEl) {
          eventsModule.on(adminAuditActionFilterEl, "change", () => {
            adminAuditActionFilter = (adminAuditActionFilterEl.value || "").trim().toLowerCase();
            renderAdminPanel();
          });
        }
        if (adminAuditActorFilterEl) {
          eventsModule.on(adminAuditActorFilterEl, "input", () => {
            adminAuditActorFilter = (adminAuditActorFilterEl.value || "").trim().toLowerCase();
            renderAdminPanel();
          });
        }
        if (adminAuditTargetFilterEl) {
          eventsModule.on(adminAuditTargetFilterEl, "input", () => {
            adminAuditTargetFilter = (adminAuditTargetFilterEl.value || "").trim().toLowerCase();
            renderAdminPanel();
          });
        }
        if (adminAuditExportBtn) {
          eventsModule.on(adminAuditExportBtn, "click", () => {
            exportAuditTrail();
          });
        }
        if (adminBackupDownloadBtn) {
          eventsModule.on(adminBackupDownloadBtn, "click", () => {
            downloadSelectedBackupJson();
          });
        }
        if (adminBackupUploadBtn) {
          eventsModule.on(adminBackupUploadBtn, "click", () => {
            if (!hasAdminPermission("db_backup")) return;
            if (adminBackupUploadInput) {
              adminBackupUploadInput.click();
            }
          });
        }
        if (adminBackupUploadInput) {
          eventsModule.on(adminBackupUploadInput, "change", () => {
            const files = adminBackupUploadInput.files;
            const file = files && files[0] ? files[0] : null;
            if (!file) return;
            importBackupJsonFile(file);
          });
        }
        if (adminForceReloadBtn) {
          eventsModule.on(adminForceReloadBtn, "click", () => {
            if (!hasAdminPermission("force_reload")) return;
            const accepted = window.confirm("Force reload all currently connected clients?");
            if (!accepted) return;
            triggerForceReloadAll("panel");
          });
        }
        eventsModule.on(adminAccountsEl, "click", handleAdminAction);
        eventsModule.on(adminAccountsEl, "change", handleAdminInputChange);
        eventsModule.on(adminAccountsEl, "input", handleAdminInputChange);
        eventsModule.on(adminAccountsEl, "keydown", handleAdminKeydown);
        eventsModule.on(chatSendBtn, "click", () => {
          sendChatMessage();
        });
        eventsModule.on(chatInputEl, "keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            sendChatMessage();
          }
        });
        eventsModule.on(exitWorldBtn, "click", () => {
          leaveCurrentWorld();
        });
        eventsModule.on(respawnBtn, "click", () => {
          respawnPlayerAtDoor();
        });
        eventsModule.on(logoutBtn, "click", () => {
          forceLogout("Logged out.");
        });
        eventsModule.on(worldInputEl, "keydown", (event) => {
          if (event.key === "Enter") {
            enterWorldFromInput();
          }
        });
      }

      async function initFirebaseMultiplayer() {
        if (!playerProfileId) {
          setNetworkState("Auth required", true);
          return;
        }
        if (!window.firebase) {
          setNetworkState("Offline (set firebase-config.js)", true);
          refreshWorldButtons(null, true);
          totalOnlinePlayers = inWorld ? 1 : 0;
          updateOnlineCount();
          return;
        }

        try {
          hasSeenInitialTeleportCommandSnapshot = false;
          network.db = await getAuthDb();
          network.enabled = true;
          hasSeenAdminRoleSnapshot = false;
          directAdminRole = "none";
          network.connectedRef = network.db.ref(".info/connected");
          network.worldsIndexRef = network.db.ref(BASE_PATH + "/worlds-index");
          network.globalPlayersRef = network.db.ref(BASE_PATH + "/global-players");
          network.globalPlayerRef = network.globalPlayersRef.child(playerId);
          network.mySessionRef = network.db.ref(BASE_PATH + "/account-sessions/" + playerProfileId);
          network.myCommandRef = network.db.ref(BASE_PATH + "/account-commands/" + playerProfileId + "/teleport");
          network.myReachRef = network.db.ref(BASE_PATH + "/account-commands/" + playerProfileId + "/reach");
          network.myFreezeRef = network.db.ref(BASE_PATH + "/account-commands/" + playerProfileId + "/freeze");
          network.myGodModeRef = network.db.ref(BASE_PATH + "/account-commands/" + playerProfileId + "/godmode");
          network.myPrivateAnnouncementRef = network.db.ref(BASE_PATH + "/account-commands/" + playerProfileId + "/announce");
          network.myPmRef = network.db.ref(BASE_PATH + "/account-commands/" + playerProfileId + "/pm");
          network.myPmFeedRef = network.myPmRef.limitToLast(80);
          network.myTradeRequestRef = network.db.ref(BASE_PATH + "/account-commands/" + playerProfileId + "/tradeRequest");
          network.myTradeResponseRef = network.db.ref(BASE_PATH + "/account-commands/" + playerProfileId + "/tradeResponse");
          network.myActiveTradeRef = network.db.ref(BASE_PATH + "/active-trades/" + playerProfileId);
          network.myFriendsRef = network.db.ref(BASE_PATH + "/friends/" + playerProfileId);
          network.myFriendRequestsRef = network.db.ref(BASE_PATH + "/friend-requests/" + playerProfileId);
          network.myAdminRoleRef = network.db.ref(BASE_PATH + "/admin-roles/" + playerProfileId);
          network.inventoryRef = network.db.ref(BASE_PATH + "/player-inventories/" + playerProfileId);
          network.progressRef = network.db.ref(BASE_PATH + "/player-progress/" + playerProfileId);
          network.achievementsRef = network.db.ref(BASE_PATH + "/player-achievements/" + playerProfileId);
          network.questsRef = network.db.ref(BASE_PATH + "/player-quests/" + playerProfileId);
          network.accountLogsRootRef = network.db.ref(BASE_PATH + "/account-logs");
          network.antiCheatLogsRef = network.db.ref(BASE_PATH + "/anti-cheat-logs").limitToLast(320);
          network.forceReloadRef = network.db.ref(BASE_PATH + "/system/force-reload");
          network.announcementRef = network.db.ref(BASE_PATH + "/system/announcement");
          network.myBanRef = network.db.ref(BASE_PATH + "/bans/" + playerProfileId);
          network.myChatMuteRef = network.db.ref(BASE_PATH + "/chat-mutes/" + playerProfileId);
          network.accountsRef = network.db.ref(BASE_PATH + "/accounts");
          network.usernamesRef = network.db.ref(BASE_PATH + "/usernames");
          network.adminRolesRef = network.db.ref(BASE_PATH + "/admin-roles");
          network.adminAuditRef = network.db.ref(BASE_PATH + "/admin-audit").limitToLast(120);
          network.bansRef = network.db.ref(BASE_PATH + "/bans");
          network.chatMutesRef = network.db.ref(BASE_PATH + "/chat-mutes");
          network.sessionsRootRef = network.db.ref(BASE_PATH + "/account-sessions");
          network.inventoriesRootRef = network.db.ref(BASE_PATH + "/player-inventories");
          setNetworkState("Connecting...", false);

          network.handlers.inventory = (snapshot) => {
            processReadTaskLatest("inventory", {
              exists: snapshot.exists(),
              value: snapshot.val() || {}
            }, (processed) => {
              const exists = processed && processed.exists === true;
              const value = processed && processed.value && typeof processed.value === "object" ? processed.value : {};
              if (exists) {
                applyInventoryFromRecord(value);
                saveInventoryToLocal();
              } else {
                saveInventory();
              }
              refreshToolbar();
              if (inWorld) {
                syncPlayer(true);
              }
            });
          };

          network.handlers.progression = (snapshot) => {
            processReadTaskLatest("progression", {
              exists: snapshot.exists(),
              value: snapshot.val() || {}
            }, (processed) => {
              const exists = processed && processed.exists === true;
              const value = processed && processed.value && typeof processed.value === "object" ? processed.value : {};
              if (exists) {
                applyProgressionFromRecord(value, false);
                saveProgressionToLocal();
              } else {
                scheduleProgressionSave(true);
              }
              if (inWorld) {
                syncPlayer(true);
              }
            });
          };

          network.handlers.achievements = (snapshot) => {
            processReadTaskLatest("achievements", {
              exists: snapshot.exists(),
              value: snapshot.val() || {}
            }, (processed) => {
              const exists = processed && processed.exists === true;
              const value = processed && processed.value && typeof processed.value === "object" ? processed.value : {};
              if (exists) {
                achievementsState = normalizeAchievementsState(value);
                saveAchievementsToLocal();
              } else {
                achievementsState = normalizeAchievementsState({});
                scheduleAchievementsSave(true);
              }
              const open = achievementsModalEl && !achievementsModalEl.classList.contains("hidden");
              if (open) renderAchievementsMenu();
              if (inWorld) {
                syncPlayer(true);
              }
            });
          };

          network.handlers.quests = (snapshot) => {
            processReadTaskLatest("quests", {
              exists: snapshot.exists(),
              value: snapshot.val() || {}
            }, (processed) => {
              const exists = processed && processed.exists === true;
              const value = processed && processed.value && typeof processed.value === "object" ? processed.value : {};
              if (exists) {
                questsState = normalizeQuestsState(value);
                saveQuestsToLocal();
              } else {
                questsState = normalizeQuestsState({});
                scheduleQuestsSave(true);
              }
            });
          };

          network.handlers.connected = (snapshot) => {
            const isConnected = snapshot.val() === true;
            network.connected = isConnected;

            if (isConnected) {
              if (network.globalPlayerRef) {
                network.globalPlayerRef.onDisconnect().remove();
              }
              if (network.playerRef) {
                network.playerRef.onDisconnect().remove();
              }
              syncPlayer(true);
              setNetworkState("Online", false);
            } else {
              setNetworkState("Reconnecting...", true);
            }
          };
          network.handlers.mySession = (snapshot) => {
            const value = snapshot.val();
            if (!value || !value.sessionId) {
              forceLogout("You were kicked or your session expired.");
              return;
            }
            if (playerSessionId && value.sessionId !== playerSessionId) {
              forceLogout("This account is active in another client.");
            }
          };
          network.handlers.myCommand = (snapshot) => {
            const value = snapshot.val();
            if (!value || !value.id) {
              if (!hasSeenInitialTeleportCommandSnapshot) {
                hasSeenInitialTeleportCommandSnapshot = true;
              }
              return;
            }
            const commandId = String(value.id || "");
            const issuedAt = Number(value.issuedAt || value.createdAt) || 0;
            if (!hasSeenInitialTeleportCommandSnapshot) {
              hasSeenInitialTeleportCommandSnapshot = true;
              if (!issuedAt || (playerSessionStartedAt > 0 && issuedAt <= playerSessionStartedAt)) {
                lastHandledTeleportCommandId = commandId;
                return;
              }
            }
            if (commandId === lastHandledTeleportCommandId) return;
            if (issuedAt > 0 && playerSessionStartedAt > 0 && issuedAt <= playerSessionStartedAt) {
              lastHandledTeleportCommandId = commandId;
              return;
            }
            lastHandledTeleportCommandId = commandId;
            applySelfTeleport(value.world, value.x, value.y);
          };
          network.handlers.myReach = (snapshot) => {
            const value = snapshot.val();
            if (!value || !value.id) return;
            const commandId = String(value.id || "");
            const issuedAt = Number(value.issuedAt || value.createdAt) || 0;
            if (commandId === lastHandledReachCommandId) return;
            if (issuedAt > 0 && playerSessionStartedAt > 0 && issuedAt <= playerSessionStartedAt) {
              lastHandledReachCommandId = commandId;
              clearOwnReachCommandRecord();
              return;
            }
            lastHandledReachCommandId = commandId;
            const nextReach = normalizeEditReachTiles(value.reachTiles);
            setEditReachTiles(nextReach);
            const by = (value.by || "admin").toString().slice(0, 20);
            postLocalSystemChat("Reach set to " + nextReach.toFixed(1) + " tiles by @" + by + ". Resets when you exit world.");
            clearOwnReachCommandRecord();
          };
          network.handlers.myFreeze = (snapshot) => {
            const value = snapshot.val();
            if (!value || !value.id) return;
            if (value.id === lastHandledFreezeCommandId) return;
            lastHandledFreezeCommandId = value.id;
            const frozen = Boolean(value.frozen);
            const byName = (value.by || "admin").toString().slice(0, 20);
            setFrozenState(frozen, byName);
          };
          network.handlers.myGodMode = (snapshot) => {
            const value = snapshot.val();
            if (!value || !value.id) return;
            if (value.id === lastHandledGodModeCommandId) return;
            lastHandledGodModeCommandId = value.id;
            const enabled = Boolean(value.enabled);
            const byName = (value.by || "admin").toString().slice(0, 20);
            setGodModeState(enabled, byName);
          };
          network.handlers.myPrivateAnnouncement = (snapshot) => {
            const value = snapshot.val() || {};
            const eventId = (value.id || "").toString();
            const text = (value.text || "").toString().trim().slice(0, 180);
            if (!eventId || !text) return;
            const issuedAt = Number(value.issuedAt) || 0;
            if (issuedAt > 0 && playerSessionStartedAt > 0 && issuedAt <= playerSessionStartedAt) return;
            if (eventId === lastHandledPrivateAnnouncementId) return;
            lastHandledPrivateAnnouncementId = eventId;
            const actor = (value.actorUsername || "admin").toString().slice(0, 20);
            showAnnouncementPopup("[Private] @" + actor + ": " + text);
          };
          network.handlers.myPmAdded = (snapshot) => {
            const msgCtrl = getMessagesController();
            if (msgCtrl && typeof msgCtrl.handleIncomingPm === "function") {
              msgCtrl.handleIncomingPm(snapshot);
              const lastFrom = typeof msgCtrl.getLastPrivateMessageFrom === "function"
                ? msgCtrl.getLastPrivateMessageFrom()
                : null;
              lastPrivateMessageFrom = lastFrom && typeof lastFrom === "object" ? lastFrom : null;
              playSfxEvent("pm_received", 0.5, "success", "pm received");
              return;
            }
            const value = snapshot.val() || {};
            const text = (value.text || "").toString().trim().slice(0, 160);
            if (!text) return;
            const createdAt = Number(value.createdAt) || 0;
            if (createdAt > 0 && playerSessionStartedAt > 0 && createdAt <= playerSessionStartedAt) return;
            const fromAccountId = (value.fromAccountId || "").toString();
            const fromUsername = (value.fromUsername || "").toString().slice(0, 20) || fromAccountId || "unknown";
            lastPrivateMessageFrom = {
              accountId: fromAccountId,
              username: fromUsername
            };
            playSfxEvent("pm_received", 0.5, "success", "pm received");
            postLocalSystemChat("[PM] @" + fromUsername + ": " + text);
          };
          network.handlers.myTradeRequest = (snapshot) => {
            const ctrl = getTradeController();
            if (!ctrl || typeof ctrl.onTradeRequest !== "function") return;
            const payload = snapshot.val() || {};
            const decision = resolveTradeDecisionKind(payload);
            if (decision === "accept") {
              playSfxEvent("trade_request_accept", 0.56, "success", "trade request accepted");
            } else if (decision === "decline") {
              playSfxEvent("trade_request_decline", 0.56, "deny", "trade request declined");
            }
            ctrl.onTradeRequest(payload);
          };
          network.handlers.myTradeResponse = (snapshot) => {
            const ctrl = getTradeController();
            if (!ctrl || typeof ctrl.onTradeResponse !== "function") return;
            const payload = snapshot.val() || {};
            const decision = resolveTradeDecisionKind(payload);
            if (decision === "accept") {
              playSfxEvent("trade_accept", 0.56, "success", "trade accepted");
            } else if (decision === "decline") {
              playSfxEvent("trade_decline", 0.56, "deny", "trade declined");
            }
            ctrl.onTradeResponse(payload);
          };
          network.handlers.myActiveTrade = (snapshot) => {
            const ctrl = getTradeController();
            if (!ctrl || typeof ctrl.onActiveTradePointer !== "function") return;
            ctrl.onActiveTradePointer(snapshot.val() || "");
          };
          network.handlers.myFriends = (snapshot) => {
            const ctrl = getFriendsController();
            if (!ctrl || typeof ctrl.setFriendsData !== "function") return;
            const raw = snapshot.val() || {};
            const nextCount = raw && typeof raw === "object" ? Object.keys(raw).length : 0;
            if (hasSeenFriendsSnapshot && nextCount > lastFriendCount) {
              playSfxEvent("friend_request_accepted", 0.54, "success", "friend request accepted");
            }
            hasSeenFriendsSnapshot = true;
            lastFriendCount = nextCount;
            ctrl.setFriendsData(raw);
          };
          network.handlers.myFriendRequests = (snapshot) => {
            const ctrl = getFriendsController();
            if (!ctrl || typeof ctrl.setRequestsData !== "function") return;
            const raw = snapshot.val() || {};
            const nextCount = raw && typeof raw === "object" ? Object.keys(raw).length : 0;
            if (hasSeenFriendRequestsSnapshot && nextCount > lastFriendRequestCount) {
              playSfxEvent("friend_request_received", 0.52, "success", "friend request received");
            }
            hasSeenFriendRequestsSnapshot = true;
            lastFriendRequestCount = nextCount;
            ctrl.setRequestsData(raw);
          };

          network.handlers.worldsIndex = (snapshot) => {
            processReadTaskLatest("worlds_index", {
              value: snapshot.val() || {}
            }, (processed) => {
              const data = processed && processed.value && typeof processed.value === "object"
                ? processed.value
                : {};
              worldIndexMetaById = data;
              const worldIds = Array.isArray(processed && processed.worldIds)
                ? processed.worldIds
                : Object.keys(data);
              refreshWorldButtons(worldIds);
            });
          };

          network.handlers.globalPlayers = (snapshot) => {
            processReadTaskLatest("global_players", {
              value: snapshot.val() || {}
            }, (processed) => {
              const data = processed && processed.value && typeof processed.value === "object"
                ? processed.value
                : {};
              adminState.globalPlayers = data;
              totalOnlinePlayers = Number.isFinite(Number(processed && processed.totalOnline))
                ? Math.max(0, Math.floor(Number(processed.totalOnline)))
                : Object.keys(data).length;

              worldOccupancy.clear();
              if (Array.isArray(processed && processed.occupancy)) {
                processed.occupancy.forEach((row) => {
                  const wid = normalizeWorldId(row && row.worldId);
                  if (!wid) return;
                  const count = Math.max(0, Math.floor(Number(row && row.count) || 0));
                  if (!count) return;
                  worldOccupancy.set(wid, count);
                });
              } else {
                const occupancy = typeof syncWorldsModule.computeWorldOccupancy === "function"
                  ? syncWorldsModule.computeWorldOccupancy(data, normalizeWorldId)
                  : null;
                if (occupancy instanceof Map) {
                  occupancy.forEach((value, key) => {
                    worldOccupancy.set(key, value);
                  });
                }
              }

              if (!inWorld) {
                refreshWorldButtons();
              }
              updateOnlineCount();
              const friendCtrl = getFriendsController();
              if (friendCtrl && typeof friendCtrl.renderOpen === "function") {
                friendCtrl.renderOpen();
              }
            });
          };
          network.handlers.accountLogAdded = (snapshot) => {
            if (!canViewAccountLogs) return;
            processReadTaskLatest("account_logs", {
              value: snapshot.val() || {},
              context: {
                playerProfileId: playerProfileId || "",
                playerSessionId: playerSessionId || "",
                playerId: playerId || ""
              }
            }, (processed) => {
              const rows = Array.isArray(processed && processed.items) ? processed.items : [];
              logsMessages.length = 0;
              rows.forEach((item) => logsMessages.push({
                text: (item && item.text || "").toString().slice(0, 220),
                createdAt: Number(item && item.createdAt) || 0
              }));
              renderLogsMessages();
            });
          };
          network.handlers.antiCheatLogAdded = (snapshot) => {
            if (!canViewAntiCheatLogs()) return;
            processReadTaskLatest("anti_cheat_logs", {
              value: snapshot.val() || {}
            }, (processed) => {
              const rows = Array.isArray(processed && processed.items) ? processed.items : [];
              antiCheatMessages.length = 0;
              rows.forEach((item) => antiCheatMessages.push({
                text: (item && item.text || "").toString().slice(0, 220),
                severity: (item && item.severity || "warn").toString().slice(0, 16) || "warn",
                createdAt: Number(item && item.createdAt) || 0
              }));
              renderAdminPanelFromLiveUpdate();
            });
          };
          network.handlers.myBan = (snapshot) => {
            if (!snapshot.exists()) return;
            const status = getBanStatus(snapshot.val(), Date.now());
            if (status.expired) {
              snapshot.ref.remove().catch(() => {});
              return;
            }
            const reasonText = status.reason ? " Reason: " + status.reason + "." : "";
            if (status.type === "permanent") {
              forceLogout("Your account is permanently banned." + reasonText);
              return;
            }
            forceLogout("Your account is temporarily banned for " + formatRemainingMs(status.remainingMs) + "." + reasonText);
          };
          network.handlers.myChatMute = (snapshot) => {
            const nowMs = Date.now();
            const status = getChatMuteStatus(snapshot && snapshot.val ? snapshot.val() : null, nowMs);
            if (status.expired && snapshot && snapshot.ref && typeof snapshot.ref.remove === "function") {
              snapshot.ref.remove().catch(() => {});
            }
            isChatMutedByAdmin = status.active;
            chatMutedReason = status.reason || "";
            chatMutedByAdminName = status.mutedBy || "";
          };
          network.handlers.forceReload = (snapshot) => {
            const value = snapshot.val() || {};
            const eventId = (value.id || "").toString();
            if (!eventId) return;
            if (eventId === lastHandledForceReloadEventId) return;
            const markerId = loadForceReloadMarker();
            if (markerId && markerId === eventId) {
              lastHandledForceReloadEventId = eventId;
              return;
            }
            const createdAt = Number(value.createdAt) || 0;
            if (createdAt > 0 && playerSessionStartedAt > 0 && createdAt <= playerSessionStartedAt) {
              lastHandledForceReloadEventId = eventId;
              saveForceReloadMarker(eventId);
              return;
            }
            lastHandledForceReloadEventId = eventId;
            saveForceReloadMarker(eventId);
            const assetVersion = (value.assetVersion || "").toString().trim();
            const updateText = "Game updated" + (assetVersion ? " (v=" + assetVersion + ")" : "") + ".";
            saveForceReloadNotice(updateText);
            addClientLog("Global reload requested by @" + ((value.actorUsername || "owner").toString().slice(0, 20)) + ". Hard reloading" + (assetVersion ? " (v=" + assetVersion + ")" : "") + "...");
            showUpdatingOverlay();
            setTimeout(() => {
              hardReloadClient(assetVersion);
            }, 2200);
          };
          network.handlers.announcement = (snapshot) => {
            const value = snapshot.val() || {};
            const eventId = (value.id || "").toString();
            if (!eventId || eventId === lastHandledAnnouncementEventId) return;
            const createdAt = Number(value.createdAt) || 0;
            if (createdAt > 0 && playerSessionStartedAt > 0 && createdAt <= playerSessionStartedAt) {
              lastHandledAnnouncementEventId = eventId;
              return;
            }
            lastHandledAnnouncementEventId = eventId;
            const actor = (value.actorUsername || "admin").toString().slice(0, 20);
            const text = (value.text || "").toString().slice(0, 140);
            if (!text) return;
            showAnnouncementPopup("@" + actor + ": " + text);
          };
          network.handlers.adminAccounts = (snapshot) => {
            processReadTaskLatest("admin_accounts", {
              exists: snapshot.exists(),
              value: snapshot.val() || {}
            }, (processed) => {
              adminState.accounts = processed && processed.value && typeof processed.value === "object"
                ? processed.value
                : {};
              renderAdminPanelFromLiveUpdate();
            });
          };
          network.handlers.adminUsernames = (snapshot) => {
            processReadTaskLatest("admin_usernames", {
              exists: snapshot.exists(),
              value: snapshot.val() || {}
            }, (processed) => {
              adminState.usernames = processed && processed.value && typeof processed.value === "object"
                ? processed.value
                : {};
              renderAdminPanelFromLiveUpdate();
            });
          };
          network.handlers.myAdminRole = (snapshot) => {
            const ownRole = readAdminRoleValue(snapshot && snapshot.val ? snapshot.val() : null);
            directAdminRole = ownRole;
            if (playerProfileId) {
              if (ownRole === "none") {
                delete adminState.roles[playerProfileId];
              } else {
                adminState.roles[playerProfileId] = ownRole;
              }
            }
            refreshAdminCapabilities(hasSeenAdminRoleSnapshot);
            hasSeenAdminRoleSnapshot = true;
            renderAdminPanelFromLiveUpdate();
          };
          network.handlers.adminRoles = (snapshot) => {
            processReadTaskLatest("admin_roles", {
              value: snapshot.val() || {},
              playerProfileId: playerProfileId || "",
              directAdminRole: directAdminRole || "none"
            }, (processed) => {
              adminState.roles = processed && processed.roles && typeof processed.roles === "object"
                ? processed.roles
                : {};
              refreshAdminCapabilities(hasSeenAdminRoleSnapshot);
              hasSeenAdminRoleSnapshot = true;
              renderAdminPanelFromLiveUpdate();
            });
          };
          network.handlers.adminAudit = (snapshot) => {
            processReadTaskLatest("admin_audit", {
              value: snapshot.val() || {}
            }, (processed) => {
              const rows = Array.isArray(processed && processed.entries) ? processed.entries : [];
              adminState.audit = rows.map((row) => {
                const ts = Number(row && row.createdAt) || 0;
                return {
                  id: (row && row.id || "").toString().slice(0, 64),
                  createdAt: ts,
                  time: formatChatTimestamp(ts),
                  actor: (row && row.actor || "system").toString().slice(0, 24),
                  action: (row && row.action || "").toString().slice(0, 24),
                  target: (row && row.target || "").toString().slice(0, 64),
                  details: (row && row.details || "").toString().slice(0, 120)
                };
              });
              if (!isAdminOpen) {
                refreshAuditActionFilterOptions();
              }
              renderAdminPanelFromLiveUpdate();
            });
          };
          network.handlers.adminBans = (snapshot) => {
            processReadTaskLatest("admin_bans", {
              exists: snapshot.exists(),
              value: snapshot.val() || {}
            }, (processed) => {
              adminState.bans = processed && processed.value && typeof processed.value === "object"
                ? processed.value
                : {};
              renderAdminPanelFromLiveUpdate();
            });
          };
          network.handlers.adminChatMutes = (snapshot) => {
            processReadTaskLatest("admin_chat_mutes", {
              exists: snapshot.exists(),
              value: snapshot.val() || {}
            }, (processed) => {
              adminState.chatMutes = processed && processed.value && typeof processed.value === "object"
                ? processed.value
                : {};
              renderAdminPanelFromLiveUpdate();
            });
          };
          network.handlers.adminSessions = (snapshot) => {
            processReadTaskLatest("admin_sessions", {
              exists: snapshot.exists(),
              value: snapshot.val() || {}
            }, (processed) => {
              adminState.sessions = processed && processed.value && typeof processed.value === "object"
                ? processed.value
                : {};
              renderAdminPanelFromLiveUpdate();
            });
          };
          network.handlers.adminInventories = (snapshot) => {
            processReadTaskLatest("admin_inventories", {
              exists: snapshot.exists(),
              value: snapshot.val() || {}
            }, (processed) => {
              adminState.inventories = processed && processed.value && typeof processed.value === "object"
                ? processed.value
                : {};
              renderAdminPanelFromLiveUpdate();
            });
          };

          network.connectedRef.on("value", network.handlers.connected);
          network.inventoryRef.on("value", network.handlers.inventory);
          network.progressRef.on("value", network.handlers.progression);
          network.achievementsRef.on("value", network.handlers.achievements);
          network.questsRef.on("value", network.handlers.quests);
          network.mySessionRef.on("value", network.handlers.mySession);
          network.myCommandRef.on("value", network.handlers.myCommand);
          network.myReachRef.on("value", network.handlers.myReach);
          network.myFreezeRef.on("value", network.handlers.myFreeze);
          network.myGodModeRef.on("value", network.handlers.myGodMode);
          network.myPrivateAnnouncementRef.on("value", network.handlers.myPrivateAnnouncement);
          network.myPmFeedRef.on("child_added", network.handlers.myPmAdded);
          network.myTradeRequestRef.on("value", network.handlers.myTradeRequest);
          network.myTradeResponseRef.on("value", network.handlers.myTradeResponse);
          network.myActiveTradeRef.on("value", network.handlers.myActiveTrade);
          network.myFriendsRef.on("value", network.handlers.myFriends);
          network.myFriendRequestsRef.on("value", network.handlers.myFriendRequests);
          network.myAdminRoleRef.on("value", network.handlers.myAdminRole);
          network.worldsIndexRef.on("value", network.handlers.worldsIndex);
          network.globalPlayersRef.on("value", network.handlers.globalPlayers);
          network.myBanRef.on("value", network.handlers.myBan);
          network.myChatMuteRef.on("value", network.handlers.myChatMute);
          network.forceReloadRef.on("value", network.handlers.forceReload);
          network.announcementRef.on("value", network.handlers.announcement);
          network.adminRolesRef.on("value", network.handlers.adminRoles);
          if (canViewAccountLogs) {
            network.accountLogsRootRef.on("value", network.handlers.accountLogAdded);
          }
          if (canViewAntiCheatLogs()) {
            network.antiCheatLogsRef.on("value", network.handlers.antiCheatLogAdded);
          }
          syncAdminDataListeners();

          eventsModule.on(window, "beforeunload", () => {
            const readCtrl = getReadSyncController();
            if (readCtrl && typeof readCtrl.dispose === "function") {
              readCtrl.dispose();
            }
            saveInventory();
            scheduleProgressionSave(true);
            scheduleAchievementsSave(true);
            scheduleQuestsSave(true);
            if (inWorld) {
              sendSystemWorldMessage(playerName + " left the world.");
            }
            const preserveSessionForNavigation = shouldPreserveSessionOnNavigation();
            if (!preserveSessionForNavigation) {
              releaseAccountSession();
              if (network.globalPlayerRef) {
                network.globalPlayerRef.remove();
              }
              if (network.playerRef) {
                network.playerRef.remove();
              }
            }
          });
        } catch (error) {
          console.error(error);
          setNetworkState("Firebase error", true);
          refreshWorldButtons(null, true);
          updateOnlineCount();
        }
      }

      function getCosmeticName(slot, itemId) {
        if (!itemId) return "None";
        const item = COSMETIC_LOOKUP[slot] && COSMETIC_LOOKUP[slot][itemId];
        return item ? item.name : itemId;
      }

      function equipCosmetic(slot, itemId) {
        if (!COSMETIC_SLOTS.includes(slot)) return;
        const id = String(itemId || "");
        if (id && (!COSMETIC_LOOKUP[slot][id] || (cosmeticInventory[id] || 0) <= 0)) return;
        equippedCosmetics[slot] = equippedCosmetics[slot] === id ? "" : id;
        saveInventory();
        refreshToolbar();
        syncPlayer(true);
      }

      function equipTitle(titleId) {
        const id = String(titleId || "").trim();
        if (id && (!TITLE_LOOKUP[id] || (titleInventory[id] || 0) <= 0)) return;
        equippedTitleId = equippedTitleId === id ? "" : id;
        if (!equippedTitleId && TITLE_DEFAULT_ID && (titleInventory[TITLE_DEFAULT_ID] || 0) > 0) {
          equippedTitleId = TITLE_DEFAULT_ID;
        }
        saveInventory();
        refreshToolbar();
        syncPlayer(true);
      }

      function createInventorySection(title, subtitle) {
        const section = document.createElement("section");
        section.className = "inventory-section";
        const head = document.createElement("div");
        head.className = "inventory-section-head";
        const titleEl = document.createElement("strong");
        titleEl.textContent = title;
        const subtitleEl = document.createElement("span");
        subtitleEl.textContent = subtitle || "";
        head.appendChild(titleEl);
        head.appendChild(subtitleEl);
        const grid = document.createElement("div");
        grid.className = "inventory-grid";
        section.appendChild(head);
        section.appendChild(grid);
        return { section, grid };
      }

      function createIconChip(baseColor, label, extraClass, faIconClass, imageSrc) {
        const icon = document.createElement("div");
        icon.className = "item-icon " + (extraClass || "");
        if (baseColor) icon.style.setProperty("--chip-color", baseColor);
        if (faIconClass) {
          const fallbackIcon = document.createElement("i");
          fallbackIcon.className = "item-icon-fallback-icon " + faIconClass;
          icon.appendChild(fallbackIcon);
        }
        if (imageSrc) {
          const img = document.createElement("img");
          img.className = "item-icon-image";
          img.alt = "";
          img.loading = "lazy";
          img.decoding = "async";
          eventsModule.on(img, "load", () => {
            icon.classList.add("image-ready");
          });
          eventsModule.on(img, "error", () => {
            icon.classList.remove("image-ready");
            img.remove();
          });
          img.src = imageSrc;
          icon.appendChild(img);
          return icon;
        }
        return icon;
      }

      function ensureInventoryDragGhost() {
        if (inventoryDrag.ghostEl) return inventoryDrag.ghostEl;
        const ghost = document.createElement("div");
        ghost.className = "inventory-drag-ghost hidden";
        ghost.innerHTML = "<div class=\"drag-title\"></div><div class=\"drag-qty\"></div>";
        document.body.appendChild(ghost);
        inventoryDrag.ghostEl = ghost;
        return ghost;
      }

      function updateInventoryDragGhost() {
        const ghost = ensureInventoryDragGhost();
        const entry = inventoryDrag.entry || {};
        const titleEl = ghost.querySelector(".drag-title");
        const qtyEl = ghost.querySelector(".drag-qty");
        const label = String(entry.label || getDropLabel(entry) || "Item");
        if (titleEl) titleEl.textContent = label;
        if (qtyEl) qtyEl.textContent = "x" + inventoryDrag.amount + " / " + inventoryDrag.maxAmount;
      }

      function setInventoryDragGhostPosition(clientX, clientY) {
        const ghost = ensureInventoryDragGhost();
        ghost.style.left = Math.round(clientX + 12) + "px";
        ghost.style.top = Math.round(clientY + 12) + "px";
      }

      function stopInventoryDrag() {
        inventoryDrag.active = false;
        inventoryDrag.pointerId = null;
        inventoryDrag.entry = null;
        inventoryDrag.amount = 1;
        inventoryDrag.maxAmount = 1;
        inventoryDrag.moved = false;
        if (inventoryDrag.ghostEl) inventoryDrag.ghostEl.classList.add("hidden");
      }

      function isPointInsideCanvas(clientX, clientY) {
        if (typeof inputUtilsModule.pointInsideElement === "function") {
          return inputUtilsModule.pointInsideElement(canvas, clientX, clientY);
        }
        const rect = canvas.getBoundingClientRect();
        return (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        );
      }

      function startInventoryDrag(entry, event) {
        if (!inWorld || !entry) return;
        const maxAmount = getMaxDroppableAmount(entry);
        if (maxAmount <= 0) return;
        inventoryDrag.active = true;
        inventoryDrag.pointerId = event.pointerId;
        inventoryDrag.startX = Number(event.clientX) || 0;
        inventoryDrag.startY = Number(event.clientY) || 0;
        inventoryDrag.lastX = inventoryDrag.startX;
        inventoryDrag.lastY = inventoryDrag.startY;
        inventoryDrag.moved = false;
        inventoryDrag.entry = { ...entry };
        inventoryDrag.maxAmount = maxAmount;
        inventoryDrag.amount = Math.max(1, Math.min(maxAmount, Math.floor(Number(entry.defaultAmount) || 1)));
        updateInventoryDragGhost();
        setInventoryDragGhostPosition(inventoryDrag.startX, inventoryDrag.startY);
      }

      function onInventoryDragMove(event) {
        if (!inventoryDrag.active) return;
        if (inventoryDrag.pointerId !== null && event.pointerId !== undefined && event.pointerId !== inventoryDrag.pointerId) return;
        const x = Number(event.clientX);
        const y = Number(event.clientY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        inventoryDrag.lastX = x;
        inventoryDrag.lastY = y;
        const dx = x - inventoryDrag.startX;
        const dy = y - inventoryDrag.startY;
        if (!inventoryDrag.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          inventoryDrag.moved = true;
          if (inventoryDrag.ghostEl) inventoryDrag.ghostEl.classList.remove("hidden");
        }
        if (inventoryDrag.moved) {
          setInventoryDragGhostPosition(x, y);
        }
      }

      function onInventoryDragWheel(event) {
        if (!inventoryDrag.active || !inventoryDrag.entry) return;
        event.preventDefault();
        event.stopPropagation();
        if (inventoryDrag.maxAmount <= 1) return;
        const step = event.shiftKey ? 10 : 1;
        if (event.deltaY < 0) {
          inventoryDrag.amount = Math.min(inventoryDrag.maxAmount, inventoryDrag.amount + step);
        } else if (event.deltaY > 0) {
          inventoryDrag.amount = Math.max(1, inventoryDrag.amount - step);
        }
        updateInventoryDragGhost();
      }

      function onInventoryDragEnd(event) {
        if (!inventoryDrag.active) return;
        if (inventoryDrag.pointerId !== null && event.pointerId !== undefined && event.pointerId !== inventoryDrag.pointerId) return;
        const wasDrag = inventoryDrag.moved;
        const endX = Number(event.clientX);
        const endY = Number(event.clientY);
        const chestCtrl = getChestController();
        if (wasDrag && Number.isFinite(endX) && Number.isFinite(endY) && chestCtrl) {
          if (typeof chestCtrl.handleInventoryDragEnd === "function") {
            const chestResult = chestCtrl.handleInventoryDragEnd(
              inventoryDrag.entry,
              inventoryDrag.amount,
              endX,
              endY
            ) || {};
            if (chestResult.handled) {
              suppressInventoryClickUntilMs = performance.now() + 180;
              stopInventoryDrag();
              return;
            }
            if (chestResult.blockWorldDrop) {
              stopInventoryDrag();
              return;
            }
          }
        }
        const donationCtrl = getDonationController();
        if (wasDrag && Number.isFinite(endX) && Number.isFinite(endY) && donationCtrl) {
          if (typeof donationCtrl.handleInventoryDragEnd === "function") {
            const donationResult = donationCtrl.handleInventoryDragEnd(
              inventoryDrag.entry,
              inventoryDrag.amount,
              endX,
              endY
            ) || {};
            if (donationResult.handled) {
              suppressInventoryClickUntilMs = performance.now() + 180;
              stopInventoryDrag();
              return;
            }
            if (donationResult.blockWorldDrop) {
              stopInventoryDrag();
              return;
            }
          }
        }
        const tradeCtrl = getTradeController();
        if (wasDrag && Number.isFinite(endX) && Number.isFinite(endY) && tradeCtrl) {
          if (typeof tradeCtrl.handleInventoryDragEnd === "function") {
            const tradeResult = tradeCtrl.handleInventoryDragEnd(
              inventoryDrag.entry,
              inventoryDrag.amount,
              endX,
              endY
            ) || {};
            if (tradeResult.handled) {
              suppressInventoryClickUntilMs = performance.now() + 180;
              stopInventoryDrag();
              return;
            }
            if (tradeResult.blockWorldDrop) {
              stopInventoryDrag();
              return;
            }
          }
        }
        if (wasDrag && Number.isFinite(endX) && Number.isFinite(endY) && isPointInsideCanvas(endX, endY) && inWorld) {
          const pos = worldFromClient(endX, endY);
          if (pos.tx >= 0 && pos.ty >= 0 && pos.tx < WORLD_W && pos.ty < WORLD_H && world[pos.ty][pos.tx] === DISPLAY_BLOCK_ID) {
            if (tryPlaceItemIntoDisplay(pos.tx, pos.ty, inventoryDrag.entry)) {
              suppressInventoryClickUntilMs = performance.now() + 180;
              stopInventoryDrag();
              return;
            }
          }
          if (pos.tx >= 0 && pos.ty >= 0 && pos.tx < WORLD_W && pos.ty < WORLD_H && world[pos.ty][pos.tx] === MANNEQUIN_ID) {
            const mannequinResult = tryPlaceCosmeticIntoMannequin(pos.tx, pos.ty, inventoryDrag.entry);
            if (mannequinResult && mannequinResult.handled) {
              suppressInventoryClickUntilMs = performance.now() + 180;
              stopInventoryDrag();
              return;
            }
            if (mannequinResult && mannequinResult.blockWorldDrop) {
              stopInventoryDrag();
              return;
            }
          }
          const dropX = Math.max(0, Math.min(pos.tx * TILE, WORLD_W * TILE - TILE));
          const dropY = Math.max(0, Math.min(pos.ty * TILE, WORLD_H * TILE - TILE));
          if (dropInventoryEntry(inventoryDrag.entry, inventoryDrag.amount, dropX, dropY)) {
            suppressInventoryClickUntilMs = performance.now() + 180;
          }
        }
        stopInventoryDrag();
      }

      function createInventorySlot(opts) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "inventory-slot" + (opts.selected ? " selected" : "") + (opts.muted ? " muted" : "") + (opts.variant ? " " + opts.variant : "");
        slot.title = opts.title || "";
        const icon = createIconChip(opts.color, opts.iconLabel, opts.iconClass, opts.faIconClass, opts.imageSrc);
        slot.appendChild(icon);
        if (opts.countText !== undefined && opts.countText !== null) { // Modified condition
          const count = document.createElement("span");
          count.className = "slot-count";
          count.textContent = opts.countText;
          if (opts.countId) count.id = opts.countId; // Add this line to assign an ID
          slot.appendChild(count);
        }
        if (opts.badgeText) {
          const badge = document.createElement("span");
          badge.className = "slot-badge";
          badge.textContent = opts.badgeText;
          slot.appendChild(badge);
        }
        if (typeof opts.getDragEntry === "function") {
          eventsModule.on(slot, "pointerdown", (event) => {
            if (typeof event.button === "number" && event.button !== 0) return;
            startInventoryDrag(opts.getDragEntry(), event);
          });
        }
        if (typeof opts.onClick === "function") {
          eventsModule.on(slot, "click", (event) => {
            if (performance.now() < suppressInventoryClickUntilMs) {
              event.preventDefault();
              return;
            }
            opts.onClick(event);
          });
        }
        if (typeof opts.onDoubleClick === "function") {
          eventsModule.on(slot, "dblclick", (event) => {
            if (performance.now() < suppressInventoryClickUntilMs) {
              event.preventDefault();
              return;
            }
            opts.onDoubleClick(event);
          });
        }
        return slot;
      }




      let lastInventorySignature = "";

      function getInventorySignature() {
        // Creates a quick string to check if we have NEW items (which requires a full DOM rebuild).
        // Use slotOrder for blocks (toolbarEl order) instead of full INVENTORY_IDS for fewer iterations.
        let sig = selectedSlot + ";";
        for (const id of slotOrder) {
          if (id === TOOL_FIST || id === TOOL_WRENCH) sig += id + ",";
          else if ((inventory[id] || 0) > 0) sig += id + ",";
        }
        for (const item of COSMETIC_ITEMS) if (cosmeticInventory[item.id] > 0) sig += item.id + (equippedCosmetics[item.slot] === item.id ? "E" : "") + ",";
        sig += equippedTitleId;
        return sig;
      }

      function fastUpdateToolbarCounts() {
        // Directly updates the text of existing DOM elements without causing layout thrashing
        for (let i = 0; i < slotOrder.length; i++) {
          const id = slotOrder[i];
          if (id === TOOL_FIST || id === TOOL_WRENCH) continue;
          const el = document.getElementById("slot-count-block-" + id);
          if (el) el.textContent = "x" + (inventory[id] || 0);
        }
      }

      function renderToolbarNow() {
        lastToolbarRefresh = performance.now();
        
        // --- OPTIMIZATION: Check if we only need to update the numbers ---
        const currentSig = getInventorySignature();
        if (lastInventorySignature === currentSig && toolbarEl.innerHTML !== "") {
          fastUpdateToolbarCounts();
          applyInventoryPanelOffset(inventoryPanelOffsetPx, false);
          return;
        }
        lastInventorySignature = currentSig;
        // ----------------------------------------------------------------

        toolbarEl.innerHTML = "";
        ensureInventoryPanelHandle();
        const blockSection = createInventorySection("Blocks & Tools", "Click to select (1: Fist, 2: Wrench)");
        const farmableSection = createInventorySection("Farmables", "Separate from normal blocks: higher XP + gem drops");
        let hasFarmableEntries = false;
        const cosmeticEntries = [];
        for (let i = 0; i < slotOrder.length; i++) {
          const id = slotOrder[i];
          const isFist = id === TOOL_FIST;
          const isWrench = id === TOOL_WRENCH;
          const isTool = isFist || isWrench;
          if (!isTool && Math.max(0, Number(inventory[id]) || 0) <= 0) continue;
          const isFarmable = !isTool && FARMABLE_INVENTORY_IDS.includes(id);
          const blockDef = isTool ? null : blockDefs[id];
          const title = isFist ? "Fist" : (isWrench ? "Wrench" : (blockDef && blockDef.name ? blockDef.name : "Block"));
          const slotEl = createInventorySlot({
            selected: i === selectedSlot,
            variant: isFarmable ? "inventory-slot-farmable" : "inventory-slot-block",
            title: (isFarmable ? "[Farmable] " : "") + title + (isTool ? "" : " (x" + (inventory[id] || 0) + ")"),
            color: isFist ? "#c59b81" : (isWrench ? "#90a4ae" : (blockDef && blockDef.color ? blockDef.color : "#999")),
            iconClass: isTool ? "icon-fist" : "icon-block",
            faIconClass: isFist ? "fa-solid fa-hand-fist" : (isWrench ? "fa-solid fa-screwdriver-wrench" : (blockDef && blockDef.faIcon ? blockDef.faIcon : "")),
            imageSrc: !isTool && blockDef && blockDef.imagePath ? blockDef.imagePath : "",
            iconLabel: isFist ? "F" : (isWrench ? "W" : ((blockDef && blockDef.icon) || title.slice(0, 2).toUpperCase())),
            name: title,
            countText: isTool ? "" : "x" + (inventory[id] || 0),
            countId: isTool ? "" : "slot-count-block-" + id, // Injecting ID here
            getDragEntry: isTool ? null : () => ({ type: "block", blockId: id, label: title, defaultAmount: 1 }),
            onClick: () => {
              if (!isTool) {
                const ctrl = getVendingController();
                if (ctrl && typeof ctrl.handleInventoryPick === "function") {
                  if (ctrl.handleInventoryPick({ type: "block", blockId: id })) {
                    return;
                  }
                }
              }
              selectedSlot = i;
              refreshToolbar(true); // Force a full rebuild to show selected state
            },
            onDoubleClick: (!isTool && LOCK_BLOCK_ID_SET.has(id)) ? () => {
              convertLockByDoubleClick(id);
            } : null
          });
          if (isFarmable) {
            farmableSection.grid.appendChild(slotEl);
            hasFarmableEntries = true;
          } else {
            blockSection.grid.appendChild(slotEl);
          }
        }
        toolbarEl.appendChild(blockSection.section);
        if (hasFarmableEntries) {
          toolbarEl.appendChild(farmableSection.section);
        }


        for (const item of COSMETIC_ITEMS) {
          const count = Math.max(0, Number(cosmeticInventory[item.id]) || 0);
          if (count <= 0) continue;
          cosmeticEntries.push({ ...item, count });
        }
        if (cosmeticEntries.length > 0) {
          cosmeticEntries.sort((a, b) => {
            const slotDiff = COSMETIC_SLOTS.indexOf(a.slot) - COSMETIC_SLOTS.indexOf(b.slot);
            if (slotDiff !== 0) return slotDiff;
            return a.name.localeCompare(b.name);
          });
          const equippedCount = COSMETIC_SLOTS.reduce((sum, slot) => sum + (equippedCosmetics[slot] ? 1 : 0), 0);
          const cosmeticSection = createInventorySection("Cosmetics", equippedCount + " equipped");
          for (const item of cosmeticEntries) {
            const equipped = equippedCosmetics[item.slot] === item.id;
            const slotEl = createInventorySlot({
              selected: equipped,
              variant: "inventory-slot-cosmetic",
              title: item.slot + " | " + item.name + " | x" + item.count,
              color: item.color || "#8aa0b5",
              iconClass: "icon-cosmetic icon-" + item.slot,
              faIconClass: item.faIcon || "",
              imageSrc: item.imagePath || "",
              iconLabel: item.icon || item.name.slice(0, 2).toUpperCase(),
              name: item.name,
              countText: "x" + item.count,
              badgeText: equipped ? "E" : "",
              getDragEntry: () => ({
                type: "cosmetic",
                cosmeticId: item.id,
                label: item.name,
                defaultAmount: 1
              }),
              onClick: () => {
                const ctrl = getVendingController();
                if (ctrl && typeof ctrl.handleInventoryPick === "function") {
                  if (ctrl.handleInventoryPick({ type: "cosmetic", cosmeticId: item.id })) {
                    return;
                  }
                }
                equipCosmetic(item.slot, item.id);
              }
            });
            cosmeticSection.grid.appendChild(slotEl);
          }
          toolbarEl.appendChild(cosmeticSection.section);
        }
        const donationCtrl = getDonationController();
        if (donationCtrl && typeof donationCtrl.isOpen === "function" && donationCtrl.isOpen()) {
          if (typeof donationCtrl.renderOpen === "function") donationCtrl.renderOpen();
        }
        const chestCtrl = getChestController();
        if (chestCtrl && typeof chestCtrl.isOpen === "function" && chestCtrl.isOpen()) {
          if (typeof chestCtrl.renderOpen === "function") chestCtrl.renderOpen();
        }
        if (titlesModalEl && !titlesModalEl.classList.contains("hidden")) {
          renderTitlesMenu();
        }
        applyInventoryPanelOffset(inventoryPanelOffsetPx, false);
        updateMobileControlsUi();
      }

      let toolbarRenderTimeout = 0;
      
      function refreshToolbar(immediate) {
        autoConvertWorldLocksInInventory();
        if (immediate) {
          if (toolbarRenderTimeout) {
            clearTimeout(toolbarRenderTimeout);
            toolbarRenderTimeout = 0;
          }
          renderToolbarNow();
          return;
        }
        
        // Batch rapidly incoming requests instead of dropping them
        if (!toolbarRenderTimeout) {
          toolbarRenderTimeout = setTimeout(() => {
            toolbarRenderTimeout = 0;
            renderToolbarNow();
          }, 150); 
        }
      }

      function canvasPointFromClient(clientX, clientY) {
        if (typeof inputUtilsModule.canvasPointFromClient === "function") {
          return inputUtilsModule.canvasPointFromClient(canvas, clientX, clientY);
        }
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        return { x, y };
      }

      function worldFromClient(clientX, clientY) {
        if (typeof inputUtilsModule.worldFromClient === "function") {
          return inputUtilsModule.worldFromClient(
            canvas,
            clientX,
            clientY,
            cameraX,
            cameraY,
            cameraZoom,
            TILE
          );
        }
        const point = canvasPointFromClient(clientX, clientY);
        const zoom = Math.max(0.01, cameraZoom);
        const x = point.x / zoom + cameraX;
        const y = point.y / zoom + cameraY;
        return {
          tx: Math.floor(x / TILE),
          ty: Math.floor(y / TILE)
        };
      }

      function worldFromPointer(event) {
        return worldFromClient(event.clientX, event.clientY);
      }

      function bindHoldButton(button, key) {
        if (!button) return;
        const setOn = (event) => {
          event.preventDefault();
          touchControls[key] = true;
        };
        const setOff = (event) => {
          event.preventDefault();
          touchControls[key] = false;
        };
        eventsModule.on(button, "touchstart", setOn, { passive: false });
        eventsModule.on(button, "touchend", setOff, { passive: false });
        eventsModule.on(button, "touchcancel", setOff, { passive: false });
        eventsModule.on(button, "mousedown", setOn);
        eventsModule.on(button, "mouseup", setOff);
        eventsModule.on(button, "mouseleave", setOff);
      }

      function setMobileTouchActionMode(nextMode) {
        mobileTouchActionMode = nextMode === "secondary" ? "secondary" : "primary";
        updateMobileControlsUi();
      }

      function setSelectedToolSlotById(toolId) {
        const targetIndex = slotOrder.indexOf(toolId);
        if (targetIndex < 0) return;
        if (selectedSlot !== targetIndex) {
          selectedSlot = targetIndex;
          refreshToolbar(true);
        } else {
          updateMobileControlsUi();
        }
      }

      function updateMobileControlsUi() {
        if (mobilePrimaryBtn) mobilePrimaryBtn.classList.toggle("active", mobileTouchActionMode === "primary");
        if (mobileSecondaryBtn) mobileSecondaryBtn.classList.toggle("active", mobileTouchActionMode === "secondary");
        const selectedId = slotOrder[selectedSlot];
        if (mobileFistBtn) mobileFistBtn.classList.toggle("active", selectedId === TOOL_FIST);
        if (mobileWrenchBtn) mobileWrenchBtn.classList.toggle("active", selectedId === TOOL_WRENCH);
        if (mobilePlayModeBtn) mobilePlayModeBtn.classList.toggle("active", mobilePlayModeEnabled);
        if (mobileChatBtn) mobileChatBtn.classList.toggle("active", isChatOpen);
        if (mobileInventoryBtn) mobileInventoryBtn.classList.toggle("active", isMobileInventoryOpen);
      }

      function bindMobileControls() {
        const bindTapButton = (button, onTap) => {
          if (!button || typeof onTap !== "function") return;
          const run = (event) => {
            event.preventDefault();
            onTap();
          };
          eventsModule.on(button, "touchstart", run, { passive: false });
          eventsModule.on(button, "click", run);
        };
        bindHoldButton(mobileLeftBtn, "left");
        bindHoldButton(mobileRightBtn, "right");
        bindHoldButton(mobileJumpBtn, "jump");
        bindTapButton(mobilePrimaryBtn, () => setMobileTouchActionMode("primary"));
        bindTapButton(mobileSecondaryBtn, () => setMobileTouchActionMode("secondary"));
        bindTapButton(mobileFistBtn, () => setSelectedToolSlotById(TOOL_FIST));
        bindTapButton(mobileWrenchBtn, () => setSelectedToolSlotById(TOOL_WRENCH));
        bindTapButton(mobilePlayModeBtn, () => {
          if (!inWorld || !isMobileUi) return;
          mobilePlayModeEnabled = !mobilePlayModeEnabled;
          syncMobilePlayModeClass();
          updateMobileControlsUi();
        });
        bindTapButton(mobileChatBtn, () => {
          if (!inWorld || !isMobileUi) return;
          setChatOpen(!isChatOpen);
        });
        bindTapButton(mobileInventoryBtn, () => {
          if (!inWorld || !isMobileUi) return;
          isMobileInventoryOpen = !isMobileInventoryOpen;
          if (isMobileInventoryOpen) {
            setChatOpen(false);
          } else {
            syncMobileOverlayVisibility();
          }
          updateMobileControlsUi();
        });
        bindTapButton(mobileExitBtn, () => {
          if (!inWorld) return;
          leaveCurrentWorld();
        });
        updateMobileControlsUi();
      }

      function applyToolbarPosition() {
        ensureToolbarPanelParent();
        if (!inWorld) {
          toolbarEl.style.transform = "none";
          return;
        }
        applyInventoryPanelOffset(inventoryPanelOffsetPx, false);
      }

      function clampPanelWidths(leftValue, rightValue) {
        const viewportWidth = Math.max(980, window.innerWidth || 0);
        const centerMin = viewportWidth < 1220 ? 700 : 980;
        const maxByRatio = Math.floor(viewportWidth * DESKTOP_PANEL_MAX_RATIO);
        let left = Math.max(DESKTOP_PANEL_MIN, Math.min(maxByRatio, Math.round(Number(leftValue) || DESKTOP_PANEL_LEFT_DEFAULT)));
        let right = Math.max(DESKTOP_PANEL_MIN, Math.min(maxByRatio, Math.round(Number(rightValue) || DESKTOP_PANEL_RIGHT_DEFAULT)));
        const edgePadding = 40;
        let centerWidth = viewportWidth - left - right - edgePadding;
        if (centerWidth < centerMin) {
          let deficit = centerMin - centerWidth;
          const leftSlack = Math.max(0, left - DESKTOP_PANEL_MIN);
          const rightSlack = Math.max(0, right - DESKTOP_PANEL_MIN);
          const totalSlack = leftSlack + rightSlack;
          if (totalSlack > 0) {
            const leftCut = Math.min(leftSlack, Math.round(deficit * (leftSlack / totalSlack)));
            left -= leftCut;
            deficit -= leftCut;
            const rightCut = Math.min(rightSlack, deficit);
            right -= rightCut;
          }
        }
        return {
          left: Math.max(DESKTOP_PANEL_MIN, left),
          right: Math.max(DESKTOP_PANEL_MIN, right)
        };
      }

      function applyDesktopPanelLayout(leftValue, rightValue, persist) {
        const next = clampPanelWidths(leftValue, rightValue);
        desktopLeftPanelWidth = next.left;
        desktopRightPanelWidth = next.right;
        document.documentElement.style.setProperty("--left-panel-w", desktopLeftPanelWidth + "px");
        document.documentElement.style.setProperty("--right-panel-w", desktopRightPanelWidth + "px");
        if (persist) {
          try {
            localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify({
              left: desktopLeftPanelWidth,
              right: desktopRightPanelWidth
            }));
          } catch (error) {
            // ignore localStorage failures
          }
        }
      }

      function syncDesktopVerticalBounds() {
        const desktopMode = (window.innerWidth || 0) >= 980;
        if (!desktopMode) {
          document.documentElement.style.removeProperty("--desktop-content-top");
          document.documentElement.style.removeProperty("--desktop-content-bottom");
          return;
        }
        let anchorEl = inWorld ? canvasWrapEl : menuScreenEl;
        if (!anchorEl || anchorEl.classList.contains("hidden")) {
          anchorEl = inWorld ? menuScreenEl : canvasWrapEl;
        }
        if (!anchorEl) return;
        const rect = anchorEl.getBoundingClientRect();
        if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom) || rect.height <= 1) return;
        const topPx = Math.max(0, Math.round(rect.top));
        const bottomPx = Math.max(0, Math.round((window.innerHeight || 0) - rect.bottom));
        document.documentElement.style.setProperty("--desktop-content-top", topPx + "px");
        document.documentElement.style.setProperty("--desktop-content-bottom", bottomPx + "px");
      }

      function persistDesktopPanelLayout() {
        try {
          localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify({
            left: desktopLeftPanelWidth,
            right: desktopRightPanelWidth
          }));
        } catch (error) {
          // ignore localStorage failures
        }
      }

      function loadDesktopPanelLayout() {
        // Fixed desktop panel layout requested by user.
        applyDesktopPanelLayout(DESKTOP_PANEL_LEFT_DEFAULT, DESKTOP_PANEL_RIGHT_DEFAULT, false);
        try {
          localStorage.removeItem(LAYOUT_PREFS_KEY);
        } catch (error) {
          // ignore localStorage failures
        }
      }

      function setLayoutResizeHandlesVisible() {
        // Resize handles are disabled for fixed layout mode.
        if (leftPanelResizeHandleEl) leftPanelResizeHandleEl.classList.add("hidden");
        if (rightPanelResizeHandleEl) rightPanelResizeHandleEl.classList.add("hidden");
      }

      function onLayoutResizeMove(event) {
        if (!layoutResizeSide) return;
        const clientX = Number(event.clientX);
        if (!Number.isFinite(clientX)) return;
        const viewportWidth = Math.max(980, window.innerWidth || 0);
        if (layoutResizeSide === "left") {
          const nextLeft = clientX - 12;
          applyDesktopPanelLayout(nextLeft, desktopRightPanelWidth, true);
        } else if (layoutResizeSide === "right") {
          const nextRight = viewportWidth - clientX - 12;
          applyDesktopPanelLayout(desktopLeftPanelWidth, nextRight, true);
        }
        resizeCanvas();
      }

      function onLayoutResizeEnd() {
        if (!layoutResizeSide) return;
        layoutResizeSide = "";
        document.body.classList.remove("layout-resizing");
        persistDesktopPanelLayout();
      }

      function initDesktopLayoutResize() {
        loadDesktopPanelLayout();
        setLayoutResizeHandlesVisible();
        layoutResizeSide = "";
        document.body.classList.remove("layout-resizing");
        resizeCanvas();
      }

      function resizeCanvas() {
        const wrap = canvas.parentElement;
        const rect = wrap.getBoundingClientRect();
        isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
        const hasTouch = (typeof navigator !== "undefined" && (Number(navigator.maxTouchPoints) > 0 || Number(navigator.msMaxTouchPoints) > 0)) || ("ontouchstart" in window);
        const narrowViewport = (window.innerWidth || 0) <= 860;
        isMobileUi = Boolean(narrowViewport && (isCoarsePointer || hasTouch));
        const measuredWidth = Math.floor(rect.width);
        const measuredHeight = Math.floor(rect.height);
        const targetWidth = Math.max(1, measuredWidth || canvas.clientWidth || canvas.width || 1);
        const targetHeight = Math.max(1, measuredHeight || canvas.clientHeight || canvas.height || 1);
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        canvas.style.width = targetWidth + "px";
        canvas.style.height = targetHeight + "px";
        ctx.imageSmoothingEnabled = false;
        ctx.textBaseline = "alphabetic";
        if (!isMobileUi) {
          isMobileInventoryOpen = false;
          mobilePlayModeEnabled = true;
        }
        syncMobileOverlayVisibility();
        syncMobilePlayModeClass();
        updateMobileControlsUi();
        setLayoutResizeHandlesVisible();
        applyDesktopPanelLayout(desktopLeftPanelWidth, desktopRightPanelWidth, false);
        ensureChatPanelParent();
        if (inWorld) {
          applyChatPanelTop(chatPanelTopPx, false);
        }
        syncDesktopVerticalBounds();
        applyToolbarPosition();
      }

      eventsModule.on(window, "resize", resizeCanvas);
      loadChatPanelTopPref();
      loadInventoryPanelOffsetPref();
      resizeCanvas();
      initDesktopLayoutResize();

      eventsModule.on(window, "keydown", (e) => {
        const activeEl = document.activeElement;
        const isTypingContext = Boolean(
          activeEl &&
          (
            activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.tagName === "SELECT" ||
            activeEl.isContentEditable
          )
        );
        if (e.key === "Escape" && gtQuickMenuMode) {
          e.preventDefault();
          setQuickMenuMode("");
          return;
        }
        if (e.key === "Escape" && vendingModalEl && !vendingModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeVendingModal();
          return;
        }
        if (e.key === "Escape" && donationModalEl && !donationModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeDonationModal();
          return;
        }
        if (e.key === "Escape" && chestModalEl && !chestModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeChestModal();
          return;
        }
        if (e.key === "Escape" && gambleModalEl && !gambleModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeGambleModal();
          return;
        }
        const splicingModalEl = document.getElementById("splicingModal");
        if (e.key === "Escape" && splicingModalEl && !splicingModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeSplicingModal();
          return;
        }
        if (e.key === "Escape" && signModalEl && !signModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeSignModal();
          return;
        }
        if (e.key === "Escape" && worldLockModalEl && !worldLockModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeWorldLockModal();
          return;
        }
        if (e.key === "Escape" && ownerTaxModalEl && !ownerTaxModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeOwnerTaxModal();
          return;
        }
        if (e.key === "Escape" && doorModalEl && !doorModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeDoorModal();
          return;
        }
        if (e.key === "Escape" && weatherModalEl && !weatherModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeWeatherModal();
          return;
        }
        if (e.key === "Escape" && tradeMenuModalEl && !tradeMenuModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeTradeMenuModal();
          return;
        }
        if (e.key === "Escape" && tradeRequestModalEl && !tradeRequestModalEl.classList.contains("hidden")) {
          e.preventDefault();
          respondToTradeRequest(false);
          return;
        }
        if (e.key === "Escape" && profileModalEl && !profileModalEl.classList.contains("hidden")) {
          e.preventDefault();
          const friendCtrl = getFriendsController();
          if (friendCtrl && typeof friendCtrl.closeProfile === "function") friendCtrl.closeProfile();
          return;
        }
        if (e.key === "Escape" && friendsModalEl && !friendsModalEl.classList.contains("hidden")) {
          e.preventDefault();
          const friendCtrl = getFriendsController();
          if (friendCtrl && typeof friendCtrl.closeFriends === "function") friendCtrl.closeFriends();
          return;
        }
        if (e.key === "Escape" && achievementsModalEl && !achievementsModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeAchievementsMenu();
          return;
        }
        if (e.key === "Escape" && titlesModalEl && !titlesModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeTitlesMenu();
          return;
        }
        const tradePanelEl = document.getElementById("tradePanelModal");
        if (e.key === "Escape" && tradePanelEl && !tradePanelEl.classList.contains("hidden")) {
          e.preventDefault();
          closeTradeMenuModal();
          return;
        }
        const shopCtrl = getShopController();
        if (e.key === "Escape" && shopCtrl && typeof shopCtrl.isOpen === "function" && shopCtrl.isOpen()) {
          e.preventDefault();
          if (typeof shopCtrl.closeModal === "function") shopCtrl.closeModal();
          return;
        }
        if (e.key === "Escape" && adminInventoryModalEl && !adminInventoryModalEl.classList.contains("hidden")) {
          e.preventDefault();
          closeAdminInventoryModal();
          return;
        }
        if (e.key === "Escape" && isAdminOpen) {
          e.preventDefault();
          setAdminOpen(false);
          return;
        }
        if (inWorld && e.key === "Escape" && isChatOpen) {
          e.preventDefault();
          setChatOpen(false);
          return;
        }
        if (inWorld && !isMobileUi && e.key === "Enter" && !e.shiftKey) {
          if (performance.now() < suppressChatOpenUntilMs) return;
          if (document.activeElement === chatInputEl) return;
          e.preventDefault();
          setChatOpen(true);
          return;
        }
        if (isChatOpen && document.activeElement === chatInputEl) {
          return;
        }
        if (!isTypingContext && e.code.startsWith("Digit")) {
          if (e.code === "Digit1") {
            selectedSlot = 0;
            refreshToolbar();
          } else if (e.code === "Digit2") {
            selectedSlot = 1;
            refreshToolbar();
          }
        }
        if (!isTypingContext && inWorld) {
          if (e.code === "KeyQ") {
            e.preventDefault();
            dropSelectedInventoryItem();
            return;
          }
          if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") {
            e.preventDefault();
            changeCameraZoom(CAMERA_ZOOM_STEP);
            return;
          }
          if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") {
            e.preventDefault();
            changeCameraZoom(-CAMERA_ZOOM_STEP);
            return;
          }
          if (e.key === "0" || e.code === "Numpad0") {
            e.preventDefault();
            setCameraZoom(1, true);
            return;
          }
        }

        if (isTypingContext) {
          return;
        }

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
          e.preventDefault();
        }

        keys[e.code] = true;
      });

      eventsModule.on(window, "keyup", (e) => {
        keys[e.code] = false;
      });

      eventsModule.on(canvas, "mousemove", (e) => {
        mouseWorld = worldFromPointer(e);
      });

      eventsModule.on(canvas, "wheel", (e) => {
        if (!inWorld) return;
        if (e.ctrlKey) return;
        e.preventDefault();
        changeCameraZoom(e.deltaY < 0 ? CAMERA_ZOOM_STEP : -CAMERA_ZOOM_STEP);
      }, { passive: false });

      eventsModule.on(canvas, "mousedown", (e) => {
        if (!inWorld) return;
        const pos = worldFromPointer(e);
        mouseWorld = pos;
        const actionStartedAtMs = performance.now();
        if (e.button === 0) {
          if (openWrenchMenuFromNameIcon(e.clientX, e.clientY)) return;
          isPointerDown = true;
          useActionAt(pos.tx, pos.ty, actionStartedAtMs);
          return;
        }
        if (e.button === 2) {
          useSecondaryActionAt(pos.tx, pos.ty, actionStartedAtMs);
        }
      });

      eventsModule.on(window, "mouseup", () => {
        isPointerDown = false;
      });

      eventsModule.on(canvas, "touchstart", (e) => {
        if (!inWorld) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        if (!touch) return;
        if (openWrenchMenuFromNameIcon(touch.clientX, touch.clientY)) return;
        const mobileSecondary = isMobileUi && mobileTouchActionMode === "secondary";
        isPointerDown = !mobileSecondary;
        const pos = worldFromClient(touch.clientX, touch.clientY);
        mouseWorld = pos;
        const actionStartedAtMs = performance.now();
        if (mobileSecondary) {
          useSecondaryActionAt(pos.tx, pos.ty, actionStartedAtMs);
          mobileLastTouchActionAt = performance.now();
        } else {
          useActionAt(pos.tx, pos.ty, actionStartedAtMs);
          mobileLastTouchActionAt = performance.now();
        }
      }, { passive: false });

      eventsModule.on(canvas, "touchmove", (e) => {
        if (!inWorld) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (!touch) return;
        const pos = worldFromClient(touch.clientX, touch.clientY);
        mouseWorld = pos;
      }, { passive: false });

      eventsModule.on(window, "touchend", () => { isPointerDown = false; });
      eventsModule.on(window, "touchcancel", () => { isPointerDown = false; });

      eventsModule.on(window, "pointermove", onInventoryDragMove, { passive: true });
      eventsModule.on(window, "pointerup", onInventoryDragEnd);
      eventsModule.on(window, "pointercancel", onInventoryDragEnd);
      eventsModule.on(window, "wheel", onInventoryDragWheel, { passive: false, capture: true });

      eventsModule.on(canvas, "contextmenu", (e) => e.preventDefault());
      eventsModule.on(mobileControlsEl, "touchstart", (e) => e.preventDefault(), { passive: false });
      eventsModule.on(mobileControlsEl, "touchmove", (e) => e.preventDefault(), { passive: false });

      function bootstrapGame() {
        loadInventoryFromLocal();
        loadProgressionFromLocal();
        if (!loadAchievementsFromLocal()) {
          achievementsState = normalizeAchievementsState({});
        }
        if (!loadQuestsFromLocal()) {
          questsState = normalizeQuestsState({});
        }
        refreshToolbar();
        //postDailyQuestStatus();
        bindMobileControls();
        setInWorldState(false);
        updateOnlineCount();
        bindWorldControls();
        initFirebaseMultiplayer();

        let lastTickTs = performance.now();
        let tickAccumulatorMs = 0;
        function tick(nowTs) {
          const now = Number(nowTs);
          if (!Number.isFinite(now)) {
            requestAnimationFrame(tick);
            return;
          }
          let deltaMs = now - lastTickTs;
          lastTickTs = now;
          if (!Number.isFinite(deltaMs) || deltaMs < 0) deltaMs = FIXED_FRAME_MS;
          if (deltaMs > 250) deltaMs = FIXED_FRAME_MS;
          tickAccumulatorMs += deltaMs;

          let ticksRun = 0;
          while (tickAccumulatorMs >= FIXED_FRAME_MS && ticksRun < MAX_TICK_CATCHUP) {
            if (inWorld) {
              if (isPointerDown && !isChatOpen && !isAdminOpen) {
                const selectedId = slotOrder[selectedSlot];
                if (selectedId !== TOOL_WRENCH) {
                  const sameTile = lastHoldActionTile && lastHoldActionTile.tx === mouseWorld.tx && lastHoldActionTile.ty === mouseWorld.ty;
                  if (sameTile && (lastTickTs - lastHoldActionAtMs) < BLOCK_HIT_COOLDOWN_MS) {
                    // Throttle: skip useActionAt until cooldown elapsed or tile changed
                  } else {
                    lastHoldActionTile = { tx: mouseWorld.tx, ty: mouseWorld.ty };
                    lastHoldActionAtMs = lastTickTs;
                    useActionAt(mouseWorld.tx, mouseWorld.ty, lastTickTs);
                  }
                }
              }
              updatePlayer();
              if (particleController && typeof particleController.update === "function") {
                particleController.update(FIXED_FRAME_MS / 1000);
              }
              updateCamera();
              tickTileDamageDecay();
              updateWorldDrops();
              syncPlayer(false);
            }
            tickAccumulatorMs -= FIXED_FRAME_MS;
            ticksRun++;
          }
          if (ticksRun > 0) {
            // Run anti-cheat once per rendered frame (not per fixed sub-tick) to avoid tiny dtMs false flags.
            if (antiCheatController && typeof antiCheatController.onFrame === "function") {
              antiCheatController.onFrame();
            }
            if (inWorld) {
              const remoteSyncCtrl = getRemotePlayerSyncController();
              if (remoteSyncCtrl && typeof remoteSyncCtrl.sample === "function") {
                remoteSyncCtrl.sample(now);
              }
            }
            render();
          }
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }

      eventsModule.on(authCreateBtn, "click", () => {
        createAccountAndLogin();
      });
      eventsModule.on(authLoginBtn, "click", () => {
        loginWithAccount();
      });
      eventsModule.on(authPasswordEl, "keydown", (event) => {
        if (event.key === "Enter") {
          loginWithAccount();
        }
      });
      eventsModule.on(authUsernameEl, "keydown", (event) => {
        if (event.key === "Enter") {
          authPasswordEl.focus();
        }
      });
      eventsModule.on(window, "unhandledrejection", (event) => {
        if (!event || !event.reason) return;
        const message = (event.reason && event.reason.message) ? event.reason.message : String(event.reason);
        if (!gameShellEl.classList.contains("hidden")) return;
        setAuthBusy(false);
        setAuthStatus(message || "Unexpected error.", true);
      });
      eventsModule.on(window, "error", (event) => {
        if (!event) return;
        const message = event.message || (event.error && event.error.message) || "";
        if (!message) return;
        if (!gameShellEl.classList.contains("hidden")) return;
        setAuthBusy(false);
        setAuthStatus(message, true);
      });
      eventsModule.on(window, "beforeunload", () => {
        if (remotePlayerSyncController && typeof remotePlayerSyncController.dispose === "function") {
          remotePlayerSyncController.dispose();
        }
        if (!shouldPreserveSessionOnNavigation()) {
          releaseAccountSession();
        }
      });

      function consumePendingAuthHandoffFlag() {
        try {
          const value = String(sessionStorage.getItem("gt_pending_auth_handoff_v1") || "").trim();
          if (value) {
            sessionStorage.removeItem("gt_pending_auth_handoff_v1");
            return true;
          }
        } catch (error) {
          // ignore storage failures
        }
        return false;
      }

      applySavedCredentialsToForm();
      setLocalUpdateNotice(takeForceReloadNotice());
      startPublicMainNoticeListener();
      setAuthStatus("Create or login to continue.", false);
      if (consumePendingAuthHandoffFlag()) {
        setAuthStatus("Finalizing login...", false);
        setAuthBusy(true);
        setTimeout(() => {
          loginWithAccount();
        }, 0);
      }
    })();



