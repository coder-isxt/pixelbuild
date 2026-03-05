window.GTModules = window.GTModules || {};

window.GTModules.questWorld = (function createQuestWorldModule() {
  const DEFAULT_PATH_ID = "hero_reward_path";

  function createController(options) {
    const opts = options || {};
    const worldConfigById = new Map();
    const playerQuestStateByWorld = new Map();
    const questPathsById = new Map();
    let activeWorldId = "";
    let questWorldRef = null;
    let questWorldHandler = null;
    let questPathsRef = null;
    let questPathsHandler = null;
    let questPlayerStateRef = null;
    let questPlayerStateHandler = null;
    let modalCtx = null;
    let domBound = false;

    function get(name, fallback) {
      const value = opts[name];
      if (typeof value === "function") return value();
      return value === undefined ? fallback : value;
    }

    function call(name) {
      const fn = opts[name];
      if (typeof fn !== "function") return undefined;
      const args = Array.prototype.slice.call(arguments, 1);
      return fn.apply(null, args);
    }

    function esc(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normalizeWorldId(value) {
      if (typeof opts.normalizeWorldId === "function") {
        return String(opts.normalizeWorldId(value) || "");
      }
      return String(value || "").trim().toUpperCase().slice(0, 24);
    }

    function normalizePathId(value) {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_")
        .slice(0, 48);
    }

    function normalizeQuestId(value, fallbackId) {
      const safeFallback = String(fallbackId || "quest").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 64) || "quest";
      const normalized = String(value || safeFallback).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 64);
      return normalized || safeFallback;
    }

    function getCurrentWorldId() {
      return normalizeWorldId(get("getCurrentWorldId", ""));
    }

    function getNetwork() {
      const network = get("getNetwork", null);
      return network && typeof network === "object" ? network : null;
    }

    function getQuestNpcId() {
      const id = Math.floor(Number(get("getQuestNpcId", 0)) || 0);
      return id > 0 ? id : 53;
    }

    function getWorld() {
      const world = get("getWorld", null);
      return Array.isArray(world) ? world : null;
    }

    function getWorldSize() {
      const value = get("getWorldSize", null) || {};
      return {
        w: Math.max(1, Math.floor(Number(value.w) || 0)),
        h: Math.max(1, Math.floor(Number(value.h) || 0))
      };
    }

    function getBasePath() {
      return String(get("getBasePath", "growtopia-test") || "growtopia-test").trim().replace(/^\/+|\/+$/g, "");
    }

    function getQuestWorldPath(worldId) {
      const safeWorldId = normalizeWorldId(worldId);
      const basePath = getBasePath();
      if (!basePath || !safeWorldId) return "";
      return "/" + basePath + "/worlds/" + safeWorldId + "/quest-world";
    }

    function getQuestPathPath(pathId) {
      const safePathId = normalizePathId(pathId);
      const basePath = getBasePath();
      if (!basePath || !safePathId) return "";
      return "/" + basePath + "/quest-paths/" + safePathId;
    }

    function writeAdminSet(path, value) {
      const writer = typeof opts.writeAdminSet === "function" ? opts.writeAdminSet : null;
      if (writer && path) {
        return Promise.resolve(writer(path, value)).then((out) => {
          if (!out || !out.ok) throw new Error("backend write failed");
          return out;
        });
      }
      return Promise.reject(new Error("write unavailable"));
    }

    function writeAdminRemove(path) {
      const writer = typeof opts.writeAdminRemove === "function" ? opts.writeAdminRemove : null;
      if (writer && path) {
        return Promise.resolve(writer(path)).then((out) => {
          if (!out || !out.ok) throw new Error("backend remove failed");
          return out;
        });
      }
      return Promise.reject(new Error("remove unavailable"));
    }

    function getQuestWorldRef(worldId) {
      const network = getNetwork();
      const safeWorldId = normalizeWorldId(worldId);
      if (!network || !network.enabled || !network.db || !safeWorldId) return null;
      const basePath = getBasePath();
      return network.db.ref(basePath + "/worlds/" + safeWorldId + "/quest-world");
    }

    function getQuestPathsRef() {
      const network = getNetwork();
      if (!network || !network.enabled || !network.db) return null;
      const basePath = getBasePath();
      return network.db.ref(basePath + "/quest-paths");
    }

    function getQuestPathRef(pathId) {
      const safePathId = normalizePathId(pathId);
      const pathsRef = getQuestPathsRef();
      if (!pathsRef || !safePathId) return null;
      return pathsRef.child(safePathId);
    }

    function getQuestPlayerStateRef(worldId) {
      const network = getNetwork();
      const safeWorldId = normalizeWorldId(worldId);
      const playerId = String(get("getPlayerProfileId", "") || "").trim().slice(0, 64);
      if (!network || !network.enabled || !network.db || !safeWorldId || !playerId) return null;
      const basePath = getBasePath();
      return network.db.ref(basePath + "/player-quest-world-state/" + playerId + "/" + safeWorldId);
    }

    function getQuestPlayerStatePath(worldId) {
      const safeWorldId = normalizeWorldId(worldId);
      const playerId = String(get("getPlayerProfileId", "") || "").trim().slice(0, 64);
      const basePath = getBasePath();
      if (!basePath || !safeWorldId || !playerId) return "";
      return "/" + basePath + "/player-quest-world-state/" + playerId + "/" + safeWorldId;
    }

    function getServerTimestampOrNow() {
      const firebaseRef = get("getFirebase", null);
      if (
        firebaseRef &&
        firebaseRef.database &&
        firebaseRef.database.ServerValue &&
        firebaseRef.database.ServerValue.TIMESTAMP
      ) {
        return firebaseRef.database.ServerValue.TIMESTAMP;
      }
      return Date.now();
    }

    function getBlockDefs() {
      const defs = get("getBlockDefs", null);
      return defs && typeof defs === "object" ? defs : {};
    }

    function getBlockNameById(blockId) {
      const id = Math.floor(Number(blockId) || 0);
      const defs = getBlockDefs();
      const def = defs[id];
      if (def && def.name) return String(def.name);
      return "Block " + id;
    }

    function parseBlockRef(value) {
      const parser = opts.parseBlockRef;
      if (typeof parser === "function") {
        const parsed = Math.floor(Number(parser(value)) || 0);
        if (parsed > 0) return parsed;
      }
      const fallback = Math.floor(Number(value) || 0);
      return fallback > 0 ? fallback : 0;
    }

    function normalizeBlockKey(value) {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 64);
    }

    function normalizeCosmeticId(value) {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 64);
    }

    function getInventoryObject() {
      const inv = get("getInventory", null);
      return inv && typeof inv === "object" ? inv : null;
    }

    function getCosmeticInventoryObject() {
      const inv = get("getCosmeticInventory", null);
      return inv && typeof inv === "object" ? inv : null;
    }

    function getCosmeticItems() {
      const rows = get("getCosmeticItems", null);
      return Array.isArray(rows) ? rows : [];
    }

    function getCosmeticNameById(cosmeticId) {
      const safeId = normalizeCosmeticId(cosmeticId);
      if (!safeId) return "Cosmetic";
      const rows = getCosmeticItems();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        if (normalizeCosmeticId(row.id) !== safeId) continue;
        const name = String(row.name || "").trim();
        return name || safeId;
      }
      return safeId;
    }

    function getInventoryBlockCount(blockId) {
      const inv = getInventoryObject();
      const id = Math.floor(Number(blockId) || 0);
      if (!inv || !id) return 0;
      return Math.max(0, Math.floor(Number(inv[id]) || 0));
    }

    function getInventoryCosmeticCount(cosmeticId) {
      const inv = getCosmeticInventoryObject();
      const safeId = normalizeCosmeticId(cosmeticId);
      if (!inv || !safeId) return 0;
      return Math.max(0, Math.floor(Number(inv[safeId]) || 0));
    }

    function consumeInventoryBlock(blockId, amount) {
      const inv = getInventoryObject();
      const id = Math.floor(Number(blockId) || 0);
      const need = Math.max(1, Math.floor(Number(amount) || 0));
      if (!inv || !id || !need) return false;
      const have = getInventoryBlockCount(id);
      if (have < need) return false;
      inv[id] = Math.max(0, have - need);
      call("saveInventory", false);
      call("refreshToolbar", true);
      return true;
    }

    function consumeInventoryCosmetic(cosmeticId, amount) {
      const inv = getCosmeticInventoryObject();
      const safeId = normalizeCosmeticId(cosmeticId);
      const need = Math.max(1, Math.floor(Number(amount) || 0));
      if (!inv || !safeId || !need) return false;
      const have = getInventoryCosmeticCount(safeId);
      if (have < need) return false;
      inv[safeId] = Math.max(0, have - need);
      call("saveInventory", false);
      call("refreshToolbar", true);
      return true;
    }

    function buildDefaultQuestPaths() {
      const heroQuestList = [
        {
          id: "hero_path_01_wood",
          title: "Bring me 50 wood blocks",
          description: "Gather wood and bring 50 blocks to me.",
          rewardText: "Reward: 1x Mystery Block",
          objective: {
            type: "bring_block",
            blockId: 4,
            amount: 50
          },
          reward: {
            blockKey: "mystery_block",
            blockAmount: 1
          }
        },
        {
          id: "hero_path_02_stone",
          title: "Bring me 80 stone blocks",
          description: "Great, now bring sturdy stone for the next ritual.",
          rewardText: "Reward: 1x Sun Shirt",
          objective: {
            type: "bring_block",
            blockId: 3,
            amount: 80
          },
          reward: {
            cosmeticId: "sun_shirt",
            cosmeticAmount: 1
          }
        },
        {
          id: "hero_path_03_brick",
          title: "Bring me 120 brick blocks",
          description: "Final step. Deliver 120 bricks and claim your title.",
          rewardText: "Reward: title {username} of Legend",
          objective: {
            type: "bring_block",
            blockId: 6,
            amount: 120
          },
          reward: {
            titleId: "legendary",
            titleAmount: 1
          }
        }
      ];
      const legendWingsQuests = [
        {
          id: "legend_wing_01",
          title: "Bring me 5 Weather Machine",
          description: "Gather Weather Machine and bring 5 blocks to me.",
          rewardText: "Reward: 1x Mystery Block",
          objective: {
            type: "bring_block",
            blockId: 21,
            amount: 5
          },
          reward: {
            blockKey: "mystery_block",
            blockAmount: 1
          }
        },
        {
          id: "legend_wing_02",
          title: "Bring me 120 Mannequins",
          description: "We need the mannequins",
          rewardText: "Reward: 1x Sun Shirt",
          objective: {
            type: "bring_block",
            blockId: 54,
            amount: 120
          },
          reward: {
            cosmeticId: "sun_shirt",
            cosmeticAmount: 1
          }
        },
        {
          id: "hero_path_03_brick",
          title: "Bring me 120 brick blocks",
          description: "Final step. Deliver 120 bricks and claim your title.",
          rewardText: "Reward: title {username} of Legend",
          objective: {
            type: "bring_block",
            blockId: 6,
            amount: 120
          },
          reward: {
            titleId: "legendary",
            titleAmount: 1
          }
        }
      ];
      const builderBreakerQuestList = [
        {
          id: "builder_path_01_break_any",
          title: "Break 40 blocks",
          description: "Show me your mining skills. Break any 40 blocks.",
          rewardText: "Reward: 50 gems",
          objective: {
            type: "break_block",
            blockId: 0,
            amount: 40
          },
          reward: {
            gems: 50
          }
        },
        {
          id: "builder_path_02_place_any",
          title: "Place 35 blocks",
          description: "Now prove your builder spirit. Place any 35 blocks.",
          rewardText: "Reward: 60 gems",
          objective: {
            type: "place_block",
            blockId: 0,
            amount: 35
          },
          reward: {
            gems: 60
          }
        },
        {
          id: "builder_path_03_place_wood",
          title: "Place 20 wood blocks",
          description: "Finish by placing 20 wood blocks.",
          rewardText: "Reward: 1x Sun Shirt",
          objective: {
            type: "place_block",
            blockId: 4,
            amount: 20
          },
          reward: {
            cosmeticId: "sun_shirt",
            cosmeticAmount: 1
          }
        }
      ];
      const eventQuestList = [
        {
          id: "events_path_01_harvest",
          title: "Harvest 5 trees",
          description: "Collect ripe trees to prove your farming skill.",
          rewardText: "Reward: 40 gems",
          objective: {
            type: "tree_harvest",
            amount: 5
          },
          reward: {
            gems: 40
          }
        },
        {
          id: "events_path_02_gems",
          title: "Earn 250 gems",
          description: "Earn gems from normal gameplay.",
          rewardText: "Reward: 70 gems",
          objective: {
            type: "gems_earned",
            amount: 250
          },
          reward: {
            gems: 70
          }
        },
        {
          id: "events_path_03_trades",
          title: "Complete 2 trades",
          description: "Trade with other players to finish this path.",
          rewardText: "Reward: title traveler",
          objective: {
            type: "trade_complete",
            amount: 2
          },
          reward: {
            titleId: "traveler",
            titleAmount: 1
          }
        }
      ];
      return [
        {
          id: DEFAULT_PATH_ID,
          name: "Hero Reward Path",
          quests: heroQuestList
        },
        {
          id: "starter_path",
          name: "Starter Path",
          quests: heroQuestList
        },
        {
          id: "builder_breaker_path",
          name: "Builder Breaker Path",
          quests: builderBreakerQuestList
        },
        {
          id: "event_mastery_path",
          name: "Event Mastery Path",
          quests: eventQuestList
        }
      ];
    }
    function normalizeQuestObjective(value) {
      const row = value && typeof value === "object" ? value : {};
      const rawType = String(row.type || row.kind || row.objectiveType || "").trim().toLowerCase();
      let type = "";
      if (rawType === "bring_block" || rawType === "bringblock" || rawType === "fetch_block") {
        type = "bring_block";
      } else if (rawType === "bring_cosmetic" || rawType === "bringcosmetic" || rawType === "fetch_cosmetic" || rawType === "bring_item" || rawType === "bringitem" || rawType === "fetch_item") {
        type = "bring_cosmetic";
      } else if (rawType === "break_block" || rawType === "breakblock" || rawType === "mine_block") {
        type = "break_block";
      } else if (rawType === "place_block" || rawType === "placeblock" || rawType === "build_block") {
        type = "place_block";
      } else if (rawType === "tree_harvest" || rawType === "harvest_tree" || rawType === "harvest") {
        type = "tree_harvest";
      } else if (rawType === "gems_earned" || rawType === "earn_gems" || rawType === "gems") {
        type = "gems_earned";
      } else if (rawType === "trade_complete" || rawType === "trade" || rawType === "complete_trade") {
        type = "trade_complete";
      }
      if (!type) return null;
      let blockId = 0;
      let blockKey = "";
      let cosmeticId = "";
      if (type === "bring_block" || type === "break_block" || type === "place_block") {
        blockKey = normalizeBlockKey(row.blockKey || row.block || row.item || "");
        blockId = Math.floor(Number(row.blockId) || 0);
        if (!blockId && blockKey) blockId = parseBlockRef(blockKey);
      }
      if (type === "bring_cosmetic") {
        cosmeticId = normalizeCosmeticId(row.cosmeticId || row.itemId || row.cosmetic || row.item || row.id || "");
      }
      const amount = Math.max(1, Math.floor(Number(row.amount || row.count) || 1));
      if (type === "bring_block" && !blockId) return null;
      if (type === "bring_cosmetic" && !cosmeticId) return null;
      return {
        type,
        blockId,
        blockKey,
        cosmeticId,
        amount
      };
    }

    function normalizeQuestRewardType(value) {
      const raw = String(value || "").trim().toLowerCase();
      if (raw === "gems" || raw === "gem") return "gems";
      if (raw === "block" || raw === "item_block" || raw === "seed" || raw === "farmable") return "block";
      if (raw === "cosmetic" || raw === "item" || raw === "wearable") return "cosmetic";
      if (raw === "title") return "title";
      if (raw === "tool") return "tool";
      return "";
    }

    function normalizeQuestRewardGrants(value) {
      const row = value && typeof value === "object" ? value : {};
      const out = [];
      const addGrant = (entry) => {
        const g = entry && typeof entry === "object" ? entry : {};
        const type = normalizeQuestRewardType(g.type || g.kind || "");
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
          const blockKey = normalizeBlockKey(g.blockKey || g.block || g.id || g.item || "");
          if (!blockId && blockKey) blockId = parseBlockRef(blockKey);
          if (!blockId && !blockKey) return;
          out.push({ type: "block", blockId, blockKey, amount });
          return;
        }
        if (type === "cosmetic") {
          const id = String(g.id || g.cosmeticId || g.itemId || "").trim().toLowerCase().slice(0, 64);
          if (!id) return;
          out.push({ type: "cosmetic", id, amount });
          return;
        }
        if (type === "title") {
          const id = String(g.id || g.titleId || g.title || "").trim().toLowerCase().slice(0, 64);
          if (!id) return;
          out.push({ type: "title", id, amount });
          return;
        }
        if (type === "tool") {
          const id = String(g.id || g.toolId || g.tool || "").trim().toLowerCase().slice(0, 32);
          if (!id) return;
          out.push({ type: "tool", id, amount });
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
          addGrant({ type: kind, id: value, blockKey: value, amount });
          return;
        }
        addGrant({ type: "block", blockKey: ref, amount });
      });

      const merged = {};
      for (let i = 0; i < out.length; i++) {
        const g = out[i];
        const ident = g.type === "block"
          ? (String(g.blockId || "") + "|" + String(g.blockKey || ""))
          : String(g.id || "");
        const key = g.type + ":" + ident;
        if (!merged[key]) {
          merged[key] = { ...g };
        } else {
          merged[key].amount = Math.max(0, Math.floor(Number(merged[key].amount) || 0)) + Math.max(0, Math.floor(Number(g.amount) || 0));
        }
      }
      return Object.values(merged).filter((g) => Math.max(0, Math.floor(Number(g.amount) || 0)) > 0);
    }

    function normalizeQuestReward(value) {
      const grants = normalizeQuestRewardGrants(value);
      if (!grants.length) return null;
      return { grants };
    }

    function describeQuestReward(reward) {
      const grants = normalizeQuestRewardGrants(reward);
      const parts = [];
      for (let i = 0; i < grants.length; i++) {
        const g = grants[i];
        if (!g || !g.type) continue;
        if (g.type === "gems") {
          parts.push(Math.max(0, Math.floor(Number(g.amount) || 0)) + " gems");
          continue;
        }
        if (g.type === "block") {
          const blockId = Math.max(0, Math.floor(Number(g.blockId) || 0));
          const amount = Math.max(1, Math.floor(Number(g.amount) || 1));
          const label = blockId > 0 ? getBlockNameById(blockId) : (String(g.blockKey || "block").replace(/_/g, " "));
          parts.push(amount + "x " + label);
          continue;
        }
        if (g.type === "cosmetic") {
          parts.push(Math.max(1, Math.floor(Number(g.amount) || 1)) + "x " + String(g.id || "cosmetic"));
          continue;
        }
        if (g.type === "title") {
          parts.push("title " + String(g.id || "title"));
          continue;
        }
        if (g.type === "tool") {
          parts.push(Math.max(1, Math.floor(Number(g.amount) || 1)) + "x " + String(g.id || "tool"));
        }
      }
      return parts.join(", ");
    }

    function normalizeQuestRow(value, index) {
      const row = value && typeof value === "object" ? value : {};
      const fallbackId = "quest_" + Math.max(1, index + 1);
      const objective = normalizeQuestObjective(row.objective || row.requirement || {});
      const reward = normalizeQuestReward(row.reward || row.rewards || {});
      const id = normalizeQuestId(row.id, fallbackId);
      const title = String(row.title || row.name || id).trim().slice(0, 80) || id;
      const description = String(row.description || "Quest objective placeholder.").trim().slice(0, 320) || "Quest objective placeholder.";
      const rewardTextRaw = typeof row.rewardText === "string"
        ? row.rewardText
        : (typeof row.reward === "string" ? row.reward : "");
      const rewardText = String(rewardTextRaw || describeQuestReward(reward) || "Reward placeholder").trim().slice(0, 180) || "Reward placeholder";
      return { id, title, description, rewardText, objective, reward };
    }

    function normalizeQuestList(value, fallbackToDefaults) {
      const src = Array.isArray(value) ? value : [];
      const out = [];
      const used = new Set();
      for (let i = 0; i < src.length; i++) {
        const row = normalizeQuestRow(src[i], i);
        if (!row.id || used.has(row.id)) continue;
        used.add(row.id);
        out.push(row);
      }
      if (!out.length && fallbackToDefaults) {
        const defaults = buildDefaultQuestPaths();
        const defaultRows = defaults[0] && defaults[0].quests ? defaults[0].quests : [];
        for (let i = 0; i < defaultRows.length; i++) {
          const row = normalizeQuestRow(defaultRows[i], i);
          if (!row.id || used.has(row.id)) continue;
          used.add(row.id);
          out.push(row);
        }
      }
      return out;
    }

    function normalizeQuestPath(value, fallbackId, fallbackName) {
      const row = value && typeof value === "object" ? value : {};
      const id = normalizePathId(row.id || fallbackId || DEFAULT_PATH_ID) || DEFAULT_PATH_ID;
      const name = String(row.name || row.title || fallbackName || id).trim().slice(0, 80) || id;
      return {
        id,
        name,
        quests: normalizeQuestList(row.quests, false),
        updatedAt: Number(row.updatedAt) || 0,
        updatedByName: String(row.updatedByName || "").trim().slice(0, 20),
        updatedByAccountId: String(row.updatedByAccountId || "").trim().slice(0, 64)
      };
    }

    function resetQuestPathsToDefaults() {
      questPathsById.clear();
      const defaults = buildDefaultQuestPaths();
      for (let i = 0; i < defaults.length; i++) {
        const normalized = normalizeQuestPath(defaults[i], defaults[i] && defaults[i].id, defaults[i] && defaults[i].name);
        if (!normalized.id) continue;
        questPathsById.set(normalized.id, normalized);
      }
    }

    function applyQuestPathsSnapshot(value) {
      const src = value && typeof value === "object" ? value : {};
      const next = new Map();
      const defaults = buildDefaultQuestPaths();
      for (let i = 0; i < defaults.length; i++) {
        const normalizedDefault = normalizeQuestPath(defaults[i], defaults[i] && defaults[i].id, defaults[i] && defaults[i].name);
        if (!normalizedDefault.id) continue;
        next.set(normalizedDefault.id, normalizedDefault);
      }
      const keys = Object.keys(src);
      for (let i = 0; i < keys.length; i++) {
        const key = normalizePathId(keys[i]);
        if (!key) continue;
        const normalized = normalizeQuestPath(src[keys[i]], key, key);
        if (!normalized.id) continue;
        next.set(normalized.id, normalized);
      }
      questPathsById.clear();
      next.forEach((row, id) => questPathsById.set(id, row));
      if (modalCtx) renderModal();
    }

    function listQuestPaths() {
      const rows = Array.from(questPathsById.values());
      rows.sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        questsCount: Array.isArray(row.quests) ? row.quests.length : 0
      }));
    }

    function getQuestPathById(pathId) {
      const id = normalizePathId(pathId);
      if (!id) return null;
      return questPathsById.get(id) || null;
    }

    function normalizeWorldConfig(value) {
      if (!value || typeof value !== "object") return null;
      const enabled = value.enabled !== false;
      if (!enabled) return null;
      const tx = Math.floor(Number(value.npcTx) || 0);
      const ty = Math.floor(Number(value.npcTy) || 0);
      return {
        enabled: true,
        npcTx: tx,
        npcTy: ty,
        questPathId: normalizePathId(value.questPathId || value.pathId || ""),
        quests: normalizeQuestList(value.quests, false),
        updatedAt: Number(value.updatedAt) || 0,
        updatedByName: String(value.updatedByName || "").trim().slice(0, 20),
        updatedByAccountId: String(value.updatedByAccountId || "").trim().slice(0, 64)
      };
    }

    function buildWorldConfigPayload(config) {
      const row = config && typeof config === "object" ? config : {};
      const payload = {
        enabled: true,
        npcTx: Math.max(0, Math.floor(Number(row.npcTx) || 0)),
        npcTy: Math.max(0, Math.floor(Number(row.npcTy) || 0)),
        questPathId: normalizePathId(row.questPathId || ""),
        updatedAt: getServerTimestampOrNow(),
        updatedByName: String(get("getPlayerName", "") || "").slice(0, 20),
        updatedByAccountId: String(get("getPlayerProfileId", "") || "").slice(0, 64)
      };
      const legacyQuests = normalizeQuestList(row.quests, false);
      if (!payload.questPathId && legacyQuests.length) {
        payload.quests = legacyQuests;
      }
      return payload;
    }

    function buildQuestPathPayload(pathRow) {
      const normalized = normalizeQuestPath(pathRow, pathRow && pathRow.id, pathRow && pathRow.name);
      return {
        id: normalized.id,
        name: normalized.name,
        quests: normalized.quests,
        updatedAt: getServerTimestampOrNow(),
        updatedByName: String(get("getPlayerName", "") || "").slice(0, 20),
        updatedByAccountId: String(get("getPlayerProfileId", "") || "").slice(0, 64)
      };
    }

    function normalizeQuestStateIdMap(value) {
      const src = value && typeof value === "object" ? value : {};
      const out = {};
      const keys = Object.keys(src);
      for (let i = 0; i < keys.length; i++) {
        const qid = normalizeQuestId(keys[i], keys[i]);
        if (!qid) continue;
        if (!src[keys[i]]) continue;
        out[qid] = true;
      }
      return out;
    }

    function normalizeTrackedQuestId(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      return normalizeQuestId(raw, "");
    }

    function normalizeQuestProgressMap(value) {
      const src = value && typeof value === "object" ? value : {};
      const out = {};
      const keys = Object.keys(src);
      for (let i = 0; i < keys.length; i++) {
        const qid = normalizeQuestId(keys[i], keys[i]);
        if (!qid) continue;
        const amount = Math.max(0, Math.floor(Number(src[keys[i]]) || 0));
        if (!amount) continue;
        out[qid] = amount;
      }
      return out;
    }

    function getOrCreatePlayerQuestState(worldId) {
      const safeWorldId = normalizeWorldId(worldId);
      if (!safeWorldId) {
        return {
          accepted: {},
          claimed: {},
          trackedId: "",
          activeQuestId: "",
          nextQuestIndex: 0,
          pathId: "",
          objectiveProgress: {}
        };
      }
      const existing = playerQuestStateByWorld.get(safeWorldId);
      if (existing && typeof existing === "object") {
        if (!existing.accepted || typeof existing.accepted !== "object") existing.accepted = {};
        if (!existing.claimed || typeof existing.claimed !== "object") existing.claimed = {};
        if (typeof existing.trackedId !== "string") existing.trackedId = "";
        if (typeof existing.activeQuestId !== "string") existing.activeQuestId = "";
        if (!Number.isFinite(existing.nextQuestIndex)) existing.nextQuestIndex = 0;
        if (typeof existing.pathId !== "string") existing.pathId = "";
        if (!existing.objectiveProgress || typeof existing.objectiveProgress !== "object") existing.objectiveProgress = {};
        return existing;
      }
      const created = {
        accepted: {},
        claimed: {},
        trackedId: "",
        activeQuestId: "",
        nextQuestIndex: 0,
        pathId: "",
        objectiveProgress: {}
      };
      playerQuestStateByWorld.set(safeWorldId, created);
      return created;
    }

    function applyRemotePlayerQuestState(worldId, raw) {
      const safeWorldId = normalizeWorldId(worldId);
      if (!safeWorldId) return;
      const incoming = raw && typeof raw === "object" ? raw : {};
      const state = getOrCreatePlayerQuestState(safeWorldId);
      state.accepted = normalizeQuestStateIdMap(incoming.accepted);
      state.claimed = normalizeQuestStateIdMap(incoming.claimed);
      state.trackedId = normalizeTrackedQuestId(incoming.trackedId);
      state.activeQuestId = normalizeTrackedQuestId(incoming.activeQuestId);
      state.nextQuestIndex = Math.max(0, Math.floor(Number(incoming.nextQuestIndex) || 0));
      state.pathId = normalizePathId(incoming.pathId || state.pathId || "");
      state.objectiveProgress = normalizeQuestProgressMap(incoming.objectiveProgress);
      playerQuestStateByWorld.set(safeWorldId, state);
    }

    function buildPlayerQuestStatePayload(worldId) {
      const safeWorldId = normalizeWorldId(worldId);
      if (!safeWorldId) return null;
      const state = getOrCreatePlayerQuestState(safeWorldId);
      return {
        accepted: normalizeQuestStateIdMap(state.accepted),
        claimed: normalizeQuestStateIdMap(state.claimed),
        trackedId: normalizeTrackedQuestId(state.trackedId),
        activeQuestId: normalizeTrackedQuestId(state.activeQuestId),
        nextQuestIndex: Math.max(0, Math.floor(Number(state.nextQuestIndex) || 0)),
        pathId: normalizePathId(state.pathId || ""),
        objectiveProgress: normalizeQuestProgressMap(state.objectiveProgress),
        updatedAt: getServerTimestampOrNow()
      };
    }

    function persistPlayerQuestState(worldId, useAdminBackend) {
      const safeWorldId = normalizeWorldId(worldId);
      if (!safeWorldId) return;
      const payload = buildPlayerQuestStatePayload(safeWorldId);
      if (!payload) return;
      if (useAdminBackend) {
        const path = getQuestPlayerStatePath(safeWorldId);
        if (path) {
          writeAdminSet(path, payload).catch(() => {});
          return;
        }
      }
      const ref = getQuestPlayerStateRef(safeWorldId);
      if (!ref) return;
      ref.set(payload).catch(() => {});
    }

    function computeNextQuestIndex(rows, claimedMap) {
      const list = Array.isArray(rows) ? rows : [];
      const claimed = claimedMap && typeof claimedMap === "object" ? claimedMap : {};
      let index = 0;
      while (index < list.length) {
        const row = list[index] || {};
        const qid = String(row.id || "");
        if (!qid || !claimed[qid]) break;
        index++;
      }
      return Math.max(0, Math.min(list.length, index));
    }

    function getQuestChainRuntime(config, state) {
      const rows = resolveQuestListForConfig(config);
      const total = rows.length;
      const pathId = normalizePathId((config && config.questPathId) || "") || DEFAULT_PATH_ID;

      if (state.pathId !== pathId) {
        state.pathId = pathId;
        state.accepted = {};
        state.claimed = {};
        state.trackedId = "";
        state.activeQuestId = "";
        state.nextQuestIndex = 0;
        state.objectiveProgress = {};
      }

      const nextIndex = computeNextQuestIndex(rows, state.claimed);
      state.nextQuestIndex = nextIndex;

      const completed = nextIndex >= total;
      const currentQuest = completed ? null : (rows[nextIndex] || null);
      const currentQuestId = currentQuest ? String(currentQuest.id || "") : "";
      if (completed || !currentQuestId) {
        state.activeQuestId = "";
        state.trackedId = "";
      } else {
        if (state.accepted[currentQuestId] && !state.activeQuestId) {
          state.activeQuestId = currentQuestId;
        }
        if (state.activeQuestId && state.activeQuestId !== currentQuestId) {
          state.activeQuestId = "";
        }
        if (state.trackedId && state.trackedId !== currentQuestId) {
          state.trackedId = "";
        }
      }

      return {
        rows,
        total,
        nextIndex,
        completed,
        currentQuest,
        currentQuestId
      };
    }

    function setLocalWorldConfig(worldId, value) {
      const safeWorldId = normalizeWorldId(worldId);
      if (!safeWorldId) return;
      const normalized = normalizeWorldConfig(value);
      if (!normalized) {
        worldConfigById.delete(safeWorldId);
      } else {
        worldConfigById.set(safeWorldId, normalized);
      }
      if (safeWorldId === activeWorldId) {
        if (!normalized && modalCtx) {
          closeModal();
        } else if (modalCtx) {
          renderModal();
        }
      }
    }

    function getCurrentConfig() {
      if (!activeWorldId) return null;
      return worldConfigById.get(activeWorldId) || null;
    }

    function getCurrentQuestPathId() {
      const config = getCurrentConfig();
      if (!config) return "";
      const pathId = normalizePathId(config.questPathId || "");
      if (pathId) return pathId;
      return "";
    }

    function resolveQuestPathForConfig(config) {
      if (!config) return null;
      const pathId = normalizePathId(config.questPathId || "");
      if (!pathId) return null;
      return getQuestPathById(pathId);
    }

    function resolveQuestListForConfig(config) {
      const path = resolveQuestPathForConfig(config);
      if (path && Array.isArray(path.quests)) {
        return normalizeQuestList(path.quests, false);
      }
      if (Array.isArray(config && config.quests) && config.quests.length) {
        return normalizeQuestList(config.quests, false);
      }
      const fallbackPath = getQuestPathById(DEFAULT_PATH_ID);
      if (fallbackPath && Array.isArray(fallbackPath.quests) && fallbackPath.quests.length) {
        return normalizeQuestList(fallbackPath.quests, false);
      }
      return normalizeQuestList([], true);
    }

    function isActive() {
      return Boolean(getCurrentConfig());
    }

    function isQuestNpcTile(tx, ty) {
      const config = getCurrentConfig();
      if (!config) return false;
      const safeTx = Math.floor(Number(tx) || 0);
      const safeTy = Math.floor(Number(ty) || 0);
      if (safeTx !== config.npcTx || safeTy !== config.npcTy) return false;
      const world = getWorld();
      const questNpcId = getQuestNpcId();
      return Boolean(world && world[safeTy] && world[safeTy][safeTx] === questNpcId);
    }

    function getModalEls() {
      const modal = document.getElementById("questWorldModal");
      const title = document.getElementById("questWorldTitle");
      const body = document.getElementById("questWorldBody");
      const close = document.getElementById("questWorldCloseBtn");
      return { modal, title, body, close };
    }

    function ensureModalDom() {
      const existing = getModalEls();
      if (existing.modal && existing.title && existing.body && existing.close) {
        return existing;
      }
      const host = document.getElementById("gameShell") || document.body;
      if (!host) return existing;
      const wrap = document.createElement("div");
      wrap.innerHTML =
        '<div id="questWorldModal" class="vending-modal hidden">' +
          '<div class="vending-card sign-card">' +
            '<div class="vending-header">' +
              '<strong id="questWorldTitle">Quest Menu</strong>' +
              '<button id="questWorldCloseBtn" type="button">Close</button>' +
            "</div>" +
            '<div id="questWorldBody" class="vending-body"></div>' +
          "</div>" +
        "</div>";
      if (wrap.firstElementChild) host.appendChild(wrap.firstElementChild);
      return getModalEls();
    }

    function closeModal() {
      modalCtx = null;
      const els = ensureModalDom();
      if (els.modal) els.modal.classList.add("hidden");
    }

    function getQuestRowById(config, questId) {
      if (!config) return null;
      const rows = resolveQuestListForConfig(config);
      const safeId = String(questId || "").trim().toLowerCase();
      if (!safeId) return null;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || String(row.id || "").toLowerCase() !== safeId) continue;
        return row;
      }
      return null;
    }
    function getQuestObjectiveLabel(quest) {
      const objective = quest && quest.objective && typeof quest.objective === "object" ? quest.objective : null;
      if (!objective) return "";
      if (objective.type === "bring_block") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const blockId = Math.floor(Number(objective.blockId) || 0);
        return "Bring " + amount + "x " + getBlockNameById(blockId);
      }
      if (objective.type === "bring_cosmetic") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const cosmeticId = normalizeCosmeticId(objective.cosmeticId || "");
        return "Bring " + amount + "x " + getCosmeticNameById(cosmeticId);
      }
      if (objective.type === "break_block") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const blockId = Math.floor(Number(objective.blockId) || 0);
        const blockKey = normalizeBlockKey(objective.blockKey || "");
        if (blockId > 0) return "Break " + amount + "x " + getBlockNameById(blockId);
        if (blockKey) return "Break " + amount + "x " + blockKey.replace(/_/g, " ");
        return "Break " + amount + " blocks";
      }
      if (objective.type === "place_block") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const blockId = Math.floor(Number(objective.blockId) || 0);
        const blockKey = normalizeBlockKey(objective.blockKey || "");
        if (blockId > 0) return "Place " + amount + "x " + getBlockNameById(blockId);
        if (blockKey) return "Place " + amount + "x " + blockKey.replace(/_/g, " ");
        return "Place " + amount + " blocks";
      }
      if (objective.type === "tree_harvest") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        return "Harvest " + amount + " trees";
      }
      if (objective.type === "gems_earned") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        return "Earn " + amount + " gems";
      }
      if (objective.type === "trade_complete") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        return "Complete " + amount + " trades";
      }
      return "";
    }

    function getQuestObjectiveProgressCount(quest) {
      const state = getOrCreatePlayerQuestState(activeWorldId);
      const objective = quest && quest.objective && typeof quest.objective === "object" ? quest.objective : null;
      if (!objective) return 0;
      if (objective.type === "bring_block") {
        const blockId = Math.floor(Number(objective.blockId) || 0);
        return getInventoryBlockCount(blockId);
      }
      if (objective.type === "bring_cosmetic") {
        const cosmeticId = normalizeCosmeticId(objective.cosmeticId || "");
        return getInventoryCosmeticCount(cosmeticId);
      }
      if (objective.type === "break_block" || objective.type === "place_block") {
        const qid = normalizeQuestId(quest && quest.id, "");
        if (!qid) return 0;
        return Math.max(0, Math.floor(Number(state.objectiveProgress && state.objectiveProgress[qid]) || 0));
      }
      if (objective.type === "tree_harvest" || objective.type === "gems_earned" || objective.type === "trade_complete") {
        const qid = normalizeQuestId(quest && quest.id, "");
        if (!qid) return 0;
        return Math.max(0, Math.floor(Number(state.objectiveProgress && state.objectiveProgress[qid]) || 0));
      }
      return 0;
    }

    function getQuestObjectiveProgressLabel(quest) {
      const objective = quest && quest.objective && typeof quest.objective === "object" ? quest.objective : null;
      if (!objective) return "";
      if (objective.type === "bring_block") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const blockId = Math.floor(Number(objective.blockId) || 0);
        const have = getQuestObjectiveProgressCount(quest);
        return "Progress: " + have + "/" + amount + " " + getBlockNameById(blockId);
      }
      if (objective.type === "bring_cosmetic") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const cosmeticId = normalizeCosmeticId(objective.cosmeticId || "");
        const have = getQuestObjectiveProgressCount(quest);
        return "Progress: " + have + "/" + amount + " " + getCosmeticNameById(cosmeticId);
      }
      if (objective.type === "break_block" || objective.type === "place_block") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const have = getQuestObjectiveProgressCount(quest);
        const blockId = Math.floor(Number(objective.blockId) || 0);
        const blockKey = normalizeBlockKey(objective.blockKey || "");
        const blockText = blockId > 0
          ? (" " + getBlockNameById(blockId))
          : (blockKey ? (" " + blockKey.replace(/_/g, " ")) : "");
        const actionText = objective.type === "break_block" ? "broken" : "placed";
        return "Progress: " + have + "/" + amount + blockText + " " + actionText;
      }
      if (objective.type === "tree_harvest") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const have = getQuestObjectiveProgressCount(quest);
        return "Progress: " + have + "/" + amount + " trees harvested";
      }
      if (objective.type === "gems_earned") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const have = getQuestObjectiveProgressCount(quest);
        return "Progress: " + have + "/" + amount + " gems earned";
      }
      if (objective.type === "trade_complete") {
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const have = getQuestObjectiveProgressCount(quest);
        return "Progress: " + have + "/" + amount + " trades completed";
      }
      return "";
    }

    function isOwnerRole() {
      return Boolean(call("hasOwnerRole"));
    }

    function renderOwnerControls() {
      return "";
    }

    function renderModal() {
      const els = ensureModalDom();
      if (!els.modal || !els.title || !els.body) return;
      if (!modalCtx) {
        els.modal.classList.add("hidden");
        return;
      }
      const config = getCurrentConfig();
      if (!config || !isQuestNpcTile(modalCtx.tx, modalCtx.ty)) {
        closeModal();
        return;
      }
      const state = getOrCreatePlayerQuestState(activeWorldId);
      const chain = getQuestChainRuntime(config, state);
      const currentPath = resolveQuestPathForConfig(config);
      const progressLine = chain.total
        ? (chain.completed ? "Path completed (" + chain.total + "/" + chain.total + ")." : ("Quest " + (chain.nextIndex + 1) + "/" + chain.total + "."))
        : "No quests configured.";
      const pathLine = currentPath
        ? (
            '<div class="vending-section">' +
              '<div class="vending-section-title">Quest Path</div>' +
              '<div class="sign-hint">' + esc(currentPath.name) + " (" + esc(currentPath.id) + ")</div>" +
              '<div class="sign-hint">' + esc(progressLine) + "</div>" +
            "</div>"
          )
        : (
            '<div class="vending-section">' +
              '<div class="vending-section-title">Quest Path</div>' +
              '<div class="sign-hint">' + esc(progressLine) + "</div>" +
            "</div>"
          );

      let listHtml = "";
      if (!chain.total) {
        listHtml =
          '<div class="vending-section">' +
            '<div class="vending-section-title">No quests configured</div>' +
            '<div class="sign-hint">Ask an owner admin to configure quest path data.</div>' +
          "</div>";
      } else if (chain.completed || !chain.currentQuest) {
        listHtml =
          '<div class="vending-section">' +
            '<div class="vending-section-title">Quest Path Complete</div>' +
            '<div class="sign-hint">You completed this quest chain.</div>' +
          "</div>";
      } else {
        const quest = chain.currentQuest;
        const qid = String(quest.id || "");
        const accepted = Boolean(state.accepted[qid]) && state.activeQuestId === qid;
        const tracked = state.trackedId === qid;
        const status = accepted ? (tracked ? "Accepted + Tracking" : "Accepted") : "Not accepted";
        const objectiveLabel = getQuestObjectiveLabel(quest);
        const progressLabel = getQuestObjectiveProgressLabel(quest);
        listHtml =
          '<div class="vending-section">' +
            '<div class="vending-section-title">' + esc(quest.title || qid) + "</div>" +
            '<div class="sign-hint">' + esc(quest.description || "Quest objective placeholder.") + "</div>" +
            (objectiveLabel ? ('<div class="sign-hint"><strong>Objective:</strong> ' + esc(objectiveLabel) + "</div>") : "") +
            (progressLabel ? ('<div class="sign-hint">' + esc(progressLabel) + "</div>") : "") +
            '<div class="sign-hint"><strong>' + esc(quest.rewardText || "Reward placeholder") + "</strong></div>" +
            '<div class="sign-hint">Status: ' + esc(status) + "</div>" +
            '<div class="vending-actions">' +
              '<button type="button" data-quest-act="accept" data-quest-id="' + esc(qid) + '"' + (accepted ? " disabled" : "") + '>Accept Quest</button>' +
              '<button type="button" data-quest-act="track" data-quest-id="' + esc(qid) + '"' + ((!accepted || tracked) ? " disabled" : "") + '>Track Quest</button>' +
              '<button type="button" data-quest-act="claim" data-quest-id="' + esc(qid) + '"' + (!accepted ? " disabled" : "") + '>Claim Reward</button>' +
            "</div>" +
          "</div>";
      }
      els.title.textContent = "Quest Menu (" + modalCtx.tx + "," + modalCtx.ty + ")";
      els.body.innerHTML = pathLine + listHtml + renderOwnerControls(config);
      els.modal.classList.remove("hidden");
    }

    function acceptQuest(questId) {
      const config = getCurrentConfig();
      if (!config) return false;
      const state = getOrCreatePlayerQuestState(activeWorldId);
      const chain = getQuestChainRuntime(config, state);
      if (chain.completed || !chain.currentQuest) {
        call("postLocalSystemChat", "This quest path is already completed.");
        return true;
      }
      const qid = String(chain.currentQuestId || "");
      if (!qid) return false;
      if (String(questId || "").trim().toLowerCase() !== qid.toLowerCase()) {
        call("postLocalSystemChat", "Complete quests in order. Only the current chain quest can be accepted.");
        return true;
      }
      if (state.accepted[qid] && state.activeQuestId === qid) {
        call("postLocalSystemChat", "Quest already accepted: " + (chain.currentQuest.title || qid) + ".");
        return true;
      }
      state.activeQuestId = qid;
      state.accepted[qid] = true;
      state.trackedId = qid;
      persistPlayerQuestState(activeWorldId);
      call("postLocalSystemChat", "Accepted quest: " + (chain.currentQuest.title || qid) + ".");
      renderModal();
      return true;
    }

    function trackQuest(questId) {
      const config = getCurrentConfig();
      if (!config) return false;
      const state = getOrCreatePlayerQuestState(activeWorldId);
      const chain = getQuestChainRuntime(config, state);
      if (chain.completed || !chain.currentQuest) {
        call("postLocalSystemChat", "This quest path is already completed.");
        return true;
      }
      const qid = String(chain.currentQuestId || "");
      if (!qid) return false;
      if (String(questId || "").trim().toLowerCase() !== qid.toLowerCase()) {
        call("postLocalSystemChat", "Only the current chain quest can be tracked.");
        return true;
      }
      if (!(state.accepted[qid] && state.activeQuestId === qid)) {
        call("postLocalSystemChat", "Accept the current quest first.");
        return true;
      }
      state.trackedId = qid;
      persistPlayerQuestState(activeWorldId);
      call("postLocalSystemChat", "Tracking quest: " + (chain.currentQuest.title || qid) + ".");
      renderModal();
      return true;
    }

    function fulfillQuestObjective(quest) {
      const objective = quest && quest.objective && typeof quest.objective === "object" ? quest.objective : null;
      if (!objective) return { ok: true, consumeMessage: "" };
      if (objective.type === "bring_block") {
        const blockId = Math.floor(Number(objective.blockId) || 0);
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const have = getInventoryBlockCount(blockId);
        const blockName = getBlockNameById(blockId);
        if (have < amount) {
          return {
            ok: false,
            message: "Bring " + amount + "x " + blockName + " first (" + have + "/" + amount + ")."
          };
        }
        if (!consumeInventoryBlock(blockId, amount)) {
          return {
            ok: false,
            message: "Failed to consume required items for this quest."
          };
        }
        return {
          ok: true,
          consumeMessage: "Turned in " + amount + "x " + blockName + "."
        };
      }
      if (objective.type === "bring_cosmetic") {
        const cosmeticId = normalizeCosmeticId(objective.cosmeticId || "");
        const amount = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const have = getInventoryCosmeticCount(cosmeticId);
        const cosmeticName = getCosmeticNameById(cosmeticId);
        if (have < amount) {
          return {
            ok: false,
            message: "Bring " + amount + "x " + cosmeticName + " first (" + have + "/" + amount + ")."
          };
        }
        if (!consumeInventoryCosmetic(cosmeticId, amount)) {
          return {
            ok: false,
            message: "Failed to consume required cosmetic items for this quest."
          };
        }
        return {
          ok: true,
          consumeMessage: "Turned in " + amount + "x " + cosmeticName + "."
        };
      }
      if (
        objective.type === "break_block" ||
        objective.type === "place_block" ||
        objective.type === "tree_harvest" ||
        objective.type === "gems_earned" ||
        objective.type === "trade_complete"
      ) {
        const qid = normalizeQuestId(quest && quest.id, "");
        if (!qid) {
          return {
            ok: false,
            message: "Invalid quest objective state."
          };
        }
        const needed = Math.max(1, Math.floor(Number(objective.amount) || 1));
        const state = getOrCreatePlayerQuestState(activeWorldId);
        const progress = Math.max(0, Math.floor(Number(state.objectiveProgress && state.objectiveProgress[qid]) || 0));
        if (progress < needed) {
          let actionText = "Complete";
          if (objective.type === "break_block") actionText = "Break";
          else if (objective.type === "place_block") actionText = "Place";
          else if (objective.type === "tree_harvest") actionText = "Harvest";
          else if (objective.type === "gems_earned") actionText = "Earn";
          else if (objective.type === "trade_complete") actionText = "Complete";
          const blockId = Math.floor(Number(objective.blockId) || 0);
          const blockKey = normalizeBlockKey(objective.blockKey || "");
          let blockText = "";
          if (objective.type === "break_block" || objective.type === "place_block") {
            blockText = blockId > 0
              ? (" " + getBlockNameById(blockId))
              : (blockKey ? (" " + blockKey.replace(/_/g, " ")) : " blocks");
          } else if (objective.type === "tree_harvest") {
            blockText = " trees";
          } else if (objective.type === "gems_earned") {
            blockText = " gems";
          } else if (objective.type === "trade_complete") {
            blockText = " trades";
          }
          return {
            ok: false,
            message: actionText + blockText + " first (" + progress + "/" + needed + ")."
          };
        }
        return { ok: true, consumeMessage: "" };
      }
      return { ok: true, consumeMessage: "" };
    }

    function grantQuestReward(quest) {
      const reward = quest && quest.reward && typeof quest.reward === "object" ? quest.reward : null;
      if (!reward) {
        return {
          ok: true,
          rewardText: String(quest && quest.rewardText || "").trim()
        };
      }
      const tx = modalCtx && Number.isFinite(Number(modalCtx.tx)) ? Math.floor(Number(modalCtx.tx)) : 0;
      const ty = modalCtx && Number.isFinite(Number(modalCtx.ty)) ? Math.floor(Number(modalCtx.ty)) : 0;
      const result = call("grantQuestReward", reward, {
        questId: String(quest && quest.id || ""),
        worldId: activeWorldId,
        tx,
        ty
      });
      if (result && typeof result === "object" && result.ok === false) {
        return {
          ok: false,
          message: String(result.message || "Failed to grant quest reward.")
        };
      }
      const rewardText = result && typeof result === "object" && typeof result.rewardText === "string"
        ? String(result.rewardText).trim()
        : describeQuestReward(reward);
      return {
        ok: true,
        rewardText: rewardText || String(quest && quest.rewardText || "").trim()
      };
    }

    function claimQuest(questId) {
      const config = getCurrentConfig();
      if (!config) return false;
      const state = getOrCreatePlayerQuestState(activeWorldId);
      const chain = getQuestChainRuntime(config, state);
      if (chain.completed || !chain.currentQuest) {
        call("postLocalSystemChat", "This quest path is already completed.");
        return true;
      }
      const quest = chain.currentQuest;
      const qid = String(chain.currentQuestId || "");
      if (!qid) return false;
      if (String(questId || "").trim().toLowerCase() !== qid.toLowerCase()) {
        call("postLocalSystemChat", "Only the current chain quest can be claimed.");
        return true;
      }
      if (!(state.accepted[qid] && state.activeQuestId === qid)) {
        call("postLocalSystemChat", "Accept the quest first.");
        return true;
      }
      if (state.claimed[qid]) {
        call("postLocalSystemChat", "Quest reward already claimed.");
        return true;
      }
      const objectiveResult = fulfillQuestObjective(quest);
      if (!objectiveResult.ok) {
        call("postLocalSystemChat", objectiveResult.message || "Quest objective is not completed yet.");
        renderModal();
        return true;
      }
      const rewardResult = grantQuestReward(quest);
      if (!rewardResult.ok) {
        call("postLocalSystemChat", rewardResult.message || "Failed to grant quest reward.");
        renderModal();
        return true;
      }
      state.claimed[qid] = true;
      if (objectiveResult.consumeMessage) {
        call("postLocalSystemChat", objectiveResult.consumeMessage);
      }
      if (state.objectiveProgress && typeof state.objectiveProgress === "object") {
        delete state.objectiveProgress[qid];
      }
      state.accepted[qid] = false;
      state.activeQuestId = "";
      state.trackedId = "";

      const afterChain = getQuestChainRuntime(config, state);
      persistPlayerQuestState(activeWorldId);
      const rewardSuffix = rewardResult.rewardText ? (" -> " + rewardResult.rewardText) : "";
      call("postLocalSystemChat", "Claimed reward for " + (quest.title || qid) + rewardSuffix + ".");
      if (afterChain.completed) {
        call("postLocalSystemChat", "Quest path complete. You earned the final chain reward.");
      } else if (afterChain.currentQuest) {
        call("postLocalSystemChat", "Next quest unlocked: " + (afterChain.currentQuest.title || afterChain.currentQuestId) + ".");
      }
      renderModal();
      return true;
    }
    function upsertPath(pathId, nextRow) {
      const safePathId = normalizePathId(pathId);
      if (!safePathId) return null;
      const existing = getQuestPathById(safePathId);
      const merged = normalizeQuestPath({
        ...(existing || {}),
        ...(nextRow || {}),
        id: safePathId
      }, safePathId, (existing && existing.name) || safePathId);
      questPathsById.set(safePathId, merged);
      const path = getQuestPathPath(safePathId);
      if (path) {
        const payload = buildQuestPathPayload(merged);
        writeAdminSet(path, payload).catch(() => {});
      }
      return merged;
    }

    function ensurePath(pathId) {
      const safePathId = normalizePathId(pathId);
      if (!safePathId) return null;
      const existing = getQuestPathById(safePathId);
      if (existing) return existing;
      const name = safePathId
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      return upsertPath(safePathId, { id: safePathId, name: name || safePathId, quests: [] });
    }

    function setWorldQuestPath(pathId) {
      const worldId = getCurrentWorldId();
      if (!worldId) return { ok: false, reason: "no_world" };
      const config = getCurrentConfig();
      if (!config) return { ok: false, reason: "quest_world_not_enabled" };
      const safePathId = normalizePathId(pathId);
      if (!safePathId) return { ok: false, reason: "invalid_path" };
      const ensured = ensurePath(safePathId);
      if (!ensured) return { ok: false, reason: "invalid_path" };
      const next = normalizeWorldConfig({
        ...config,
        questPathId: safePathId,
        updatedAt: Date.now(),
        updatedByName: String(get("getPlayerName", "") || "").slice(0, 20),
        updatedByAccountId: String(get("getPlayerProfileId", "") || "").slice(0, 64)
      });
      setLocalWorldConfig(worldId, next);
      const path = getQuestWorldPath(worldId);
      if (path && next) {
        writeAdminSet(path, buildWorldConfigPayload(next)).catch(() => {});
      }
      const state = getOrCreatePlayerQuestState(worldId);
      state.pathId = safePathId;
      state.accepted = {};
      state.claimed = {};
      state.activeQuestId = "";
      state.trackedId = "";
      state.nextQuestIndex = 0;
      state.objectiveProgress = {};
      persistPlayerQuestState(worldId, true);
      if (modalCtx) renderModal();
      return { ok: true, worldId, pathId: safePathId };
    }

    function addFetchQuestToPath(pathId, blockRef, amount, title, description, rewardText) {
      const rawPathId = String(pathId || "").trim().toLowerCase();
      let safePathId = normalizePathId(rawPathId);
      if (!safePathId || safePathId === "current") {
        safePathId = getCurrentQuestPathId() || DEFAULT_PATH_ID;
      }
      if (!safePathId) return { ok: false, reason: "invalid_path" };
      const blockId = parseBlockRef(blockRef);
      if (!blockId) return { ok: false, reason: "invalid_block" };
      const safeAmount = Math.max(1, Math.floor(Number(amount) || 0));
      if (!safeAmount) return { ok: false, reason: "invalid_amount" };

      const path = ensurePath(safePathId);
      if (!path) return { ok: false, reason: "invalid_path" };
      const nextQuests = Array.isArray(path.quests) ? path.quests.slice() : [];
      const safeTitle = String(title || "").trim() || ("Bring me " + safeAmount + " " + getBlockNameById(blockId) + " blocks");
      const safeDescription = String(description || "").trim() || ("Bring " + safeAmount + "x " + getBlockNameById(blockId) + " to this quest NPC.");
      const safeRewardText = String(rewardText || "").trim() || "Reward placeholder";
      const questIdSeed = "bring_" + blockId + "_" + safeAmount + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      const row = normalizeQuestRow({
        id: questIdSeed,
        title: safeTitle,
        description: safeDescription,
        rewardText: safeRewardText,
        objective: {
          type: "bring_block",
          blockId,
          amount: safeAmount
        }
      }, nextQuests.length);
      nextQuests.push(row);
      const updatedPath = upsertPath(safePathId, {
        ...path,
        quests: nextQuests
      });
      if (!updatedPath) return { ok: false, reason: "save_failed" };
      if (modalCtx) renderModal();
      return {
        ok: true,
        pathId: safePathId,
        quest: row
      };
    }

    function addFetchCosmeticQuestToPath(pathId, cosmeticRef, amount, title, description, rewardText) {
      const rawPathId = String(pathId || "").trim().toLowerCase();
      let safePathId = normalizePathId(rawPathId);
      if (!safePathId || safePathId === "current") {
        safePathId = getCurrentQuestPathId() || DEFAULT_PATH_ID;
      }
      if (!safePathId) return { ok: false, reason: "invalid_path" };
      const cosmeticId = normalizeCosmeticId(cosmeticRef);
      if (!cosmeticId) return { ok: false, reason: "invalid_cosmetic" };
      const safeAmount = Math.max(1, Math.floor(Number(amount) || 0));
      if (!safeAmount) return { ok: false, reason: "invalid_amount" };
      const knownCosmetics = getCosmeticItems();
      if (knownCosmetics.length) {
        const exists = knownCosmetics.some((row) => row && normalizeCosmeticId(row.id) === cosmeticId);
        if (!exists) return { ok: false, reason: "invalid_cosmetic" };
      }

      const path = ensurePath(safePathId);
      if (!path) return { ok: false, reason: "invalid_path" };
      const nextQuests = Array.isArray(path.quests) ? path.quests.slice() : [];
      const cosmeticName = getCosmeticNameById(cosmeticId);
      const safeTitle = String(title || "").trim() || ("Bring me " + safeAmount + " " + cosmeticName);
      const safeDescription = String(description || "").trim() || ("Bring " + safeAmount + "x " + cosmeticName + " to this quest NPC.");
      const safeRewardText = String(rewardText || "").trim() || "Reward placeholder";
      const questIdSeed = "bring_cosmetic_" + cosmeticId + "_" + safeAmount + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      const row = normalizeQuestRow({
        id: questIdSeed,
        title: safeTitle,
        description: safeDescription,
        rewardText: safeRewardText,
        objective: {
          type: "bring_cosmetic",
          cosmeticId,
          amount: safeAmount
        }
      }, nextQuests.length);
      nextQuests.push(row);
      const updatedPath = upsertPath(safePathId, {
        ...path,
        quests: nextQuests
      });
      if (!updatedPath) return { ok: false, reason: "save_failed" };
      if (modalCtx) renderModal();
      return {
        ok: true,
        pathId: safePathId,
        quest: row
      };
    }

    function addObjectiveQuestToPath(pathId, objectiveType, blockRef, amount, title, description, rewardText) {
      const rawPathId = String(pathId || "").trim().toLowerCase();
      let safePathId = normalizePathId(rawPathId);
      if (!safePathId || safePathId === "current") {
        safePathId = getCurrentQuestPathId() || DEFAULT_PATH_ID;
      }
      if (!safePathId) return { ok: false, reason: "invalid_path" };
      const safeType = String(objectiveType || "").trim().toLowerCase();
      if (safeType !== "break_block" && safeType !== "place_block") {
        return { ok: false, reason: "invalid_type" };
      }
      const safeAmount = Math.max(1, Math.floor(Number(amount) || 0));
      if (!safeAmount) return { ok: false, reason: "invalid_amount" };

      const rawBlockRef = String(blockRef || "").trim();
      const safeBlockKey = normalizeBlockKey(rawBlockRef);
      const useAnyBlock = !rawBlockRef || rawBlockRef.toLowerCase() === "any" || rawBlockRef === "*";
      let blockId = useAnyBlock ? 0 : parseBlockRef(rawBlockRef);
      if (!useAnyBlock && !blockId) return { ok: false, reason: "invalid_block" };
      if (blockId < 0) blockId = 0;

      const path = ensurePath(safePathId);
      if (!path) return { ok: false, reason: "invalid_path" };
      const nextQuests = Array.isArray(path.quests) ? path.quests.slice() : [];
      const actionWord = safeType === "break_block" ? "Break" : "Place";
      const blockLabel = blockId > 0 ? getBlockNameById(blockId) : "blocks";
      const safeTitle = String(title || "").trim() || (actionWord + " " + safeAmount + " " + blockLabel);
      const safeDescription = String(description || "").trim() || (actionWord + " " + safeAmount + "x " + blockLabel + " to complete this quest.");
      const safeRewardText = String(rewardText || "").trim() || "Reward placeholder";
      const questIdSeed = (safeType === "break_block" ? "break" : "place") + "_" + (blockId || "any") + "_" + safeAmount + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      const row = normalizeQuestRow({
        id: questIdSeed,
        title: safeTitle,
        description: safeDescription,
        rewardText: safeRewardText,
        objective: {
          type: safeType,
          blockId,
          blockKey: useAnyBlock ? "" : safeBlockKey,
          amount: safeAmount
        }
      }, nextQuests.length);
      nextQuests.push(row);
      const updatedPath = upsertPath(safePathId, {
        ...path,
        quests: nextQuests
      });
      if (!updatedPath) return { ok: false, reason: "save_failed" };
      if (modalCtx) renderModal();
      return {
        ok: true,
        pathId: safePathId,
        quest: row
      };
    }

    function addBreakQuestToPath(pathId, blockRef, amount, title, description, rewardText) {
      return addObjectiveQuestToPath(pathId, "break_block", blockRef, amount, title, description, rewardText);
    }

    function addPlaceQuestToPath(pathId, blockRef, amount, title, description, rewardText) {
      return addObjectiveQuestToPath(pathId, "place_block", blockRef, amount, title, description, rewardText);
    }

    function onGameplayEvent(eventType, payload) {
      const type = String(eventType || "").trim().toLowerCase();
      if (
        type !== "break_block" &&
        type !== "place_block" &&
        type !== "tree_harvest" &&
        type !== "gems_earned" &&
        type !== "trade_complete"
      ) {
        return false;
      }
      const config = getCurrentConfig();
      if (!config) return false;
      const state = getOrCreatePlayerQuestState(activeWorldId);
      const chain = getQuestChainRuntime(config, state);
      if (chain.completed || !chain.currentQuest) return false;
      const qid = String(chain.currentQuestId || "");
      if (!qid) return false;
      if (!(state.accepted[qid] && state.activeQuestId === qid)) return false;
      const objective = chain.currentQuest.objective && typeof chain.currentQuest.objective === "object"
        ? chain.currentQuest.objective
        : null;
      if (!objective || objective.type !== type) return false;
      const details = payload && typeof payload === "object" ? payload : {};
      const wantedBlockId = Math.max(0, Math.floor(Number(objective.blockId) || 0));
      const wantedBlockKey = normalizeBlockKey(objective.blockKey || "");
      if (type === "break_block" || type === "place_block") {
        const eventBlockId = Math.max(0, Math.floor(Number(details.blockId) || 0));
        const eventBlockKey = normalizeBlockKey(details.blockKey || "");
        if (wantedBlockId > 0 && eventBlockId !== wantedBlockId) return false;
        if (wantedBlockKey && eventBlockKey !== wantedBlockKey) return false;
      }
      let delta = Math.max(1, Math.floor(Number(details.count) || 1));
      if (type === "gems_earned") {
        delta = Math.max(0, Math.floor(Number(details.amount) || 0));
        if (!delta) return false;
      }
      const current = Math.max(0, Math.floor(Number(state.objectiveProgress && state.objectiveProgress[qid]) || 0));
      const target = Math.max(1, Math.floor(Number(objective.amount) || 1));
      const next = Math.min(target, current + delta);
      if (next === current) return false;
      state.objectiveProgress[qid] = next;
      persistPlayerQuestState(activeWorldId);
      if (modalCtx) renderModal();
      return true;
    }

    function handleOwnerSetPathFromModal() {
      if (!isOwnerRole()) return;
      const typedInput = document.getElementById("questWorldPathInput");
      const selectInput = document.getElementById("questWorldPathSelect");
      const typed = typedInput ? String(typedInput.value || "").trim() : "";
      const selected = selectInput ? String(selectInput.value || "").trim() : "";
      const nextPathId = normalizePathId(typed || selected);
      if (!nextPathId) {
        call("postLocalSystemChat", "Invalid quest path id.");
        return;
      }
      const result = setWorldQuestPath(nextPathId);
      if (!result || !result.ok) {
        call("postLocalSystemChat", "Failed to set quest path.");
        return;
      }
      call("postLocalSystemChat", "Quest path set to " + result.pathId + " for this world.");
      renderModal();
    }

    function handleOwnerAddFetchFromModal() {
      if (!isOwnerRole()) return;
      const pathInput = document.getElementById("questWorldFetchPathInput");
      const blockInput = document.getElementById("questWorldFetchBlockInput");
      const amountInput = document.getElementById("questWorldFetchAmountInput");
      const titleInput = document.getElementById("questWorldFetchTitleInput");
      const descInput = document.getElementById("questWorldFetchDescriptionInput");
      const rewardInput = document.getElementById("questWorldFetchRewardInput");
      const pathId = pathInput ? String(pathInput.value || "").trim() : "current";
      const blockRef = blockInput ? String(blockInput.value || "").trim() : "";
      const amount = amountInput ? Number(amountInput.value) : 0;
      const title = titleInput ? String(titleInput.value || "").trim() : "";
      const description = descInput ? String(descInput.value || "").trim() : "";
      const rewardText = rewardInput ? String(rewardInput.value || "").trim() : "";
      const result = addFetchQuestToPath(pathId, blockRef, amount, title, description, rewardText);
      if (!result || !result.ok) {
        call("postLocalSystemChat", "Failed to add fetch quest. Check path, block, and amount.");
        return;
      }
      const currentPath = getCurrentQuestPathId();
      if (currentPath === result.pathId) {
        renderModal();
      }
      call("postLocalSystemChat", "Added fetch quest to path " + result.pathId + ": " + (result.quest && result.quest.title ? result.quest.title : "quest") + ".");
    }

    function bindModalEvents() {
      if (domBound) return;
      const els = ensureModalDom();
      if (!els.modal || !els.body || !els.close) return;
      domBound = true;
      els.close.addEventListener("click", closeModal);
      els.modal.addEventListener("click", (event) => {
        if (!event || !event.target) return;
        if (event.target === els.modal) closeModal();
      });
      els.body.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const act = String(target.dataset.questAct || "");
        const questId = String(target.dataset.questId || "");
        if (act && questId) {
          if (act === "accept") {
            acceptQuest(questId);
            return;
          }
          if (act === "track") {
            trackQuest(questId);
            return;
          }
          if (act === "claim") {
            claimQuest(questId);
            return;
          }
        }
        const adminAct = String(target.dataset.questAdminAct || "");
        if (!adminAct) return;
        if (adminAct === "set-path") {
          handleOwnerSetPathFromModal();
          return;
        }
        if (adminAct === "add-fetch") {
          handleOwnerAddFetchFromModal();
        }
      });
    }
    function detachWorldConfigListener() {
      if (questWorldRef && questWorldHandler) {
        questWorldRef.off("value", questWorldHandler);
      }
      questWorldRef = null;
      questWorldHandler = null;
    }

    function detachQuestPathsListener() {
      if (questPathsRef && questPathsHandler) {
        questPathsRef.off("value", questPathsHandler);
      }
      questPathsRef = null;
      questPathsHandler = null;
    }

    function detachPlayerQuestStateListener() {
      if (questPlayerStateRef && questPlayerStateHandler) {
        questPlayerStateRef.off("value", questPlayerStateHandler);
      }
      questPlayerStateRef = null;
      questPlayerStateHandler = null;
    }

    function attachQuestPathsListener() {
      if (questPathsRef && questPathsHandler) return;
      const ref = getQuestPathsRef();
      if (!ref) return;
      questPathsRef = ref;
      questPathsHandler = (snapshot) => {
        const raw = snapshot && typeof snapshot.val === "function" ? snapshot.val() : null;
        applyQuestPathsSnapshot(raw);
      };
      ref.on("value", questPathsHandler);
    }

    function attachWorldConfigListener(worldId) {
      detachWorldConfigListener();
      const safeWorldId = normalizeWorldId(worldId);
      if (!safeWorldId) return;
      const ref = getQuestWorldRef(safeWorldId);
      if (!ref) return;
      questWorldRef = ref;
      questWorldHandler = (snapshot) => {
        const raw = snapshot && typeof snapshot.val === "function" ? snapshot.val() : null;
        setLocalWorldConfig(safeWorldId, raw);
      };
      ref.on("value", questWorldHandler);
    }

    function attachPlayerQuestStateListener(worldId) {
      detachPlayerQuestStateListener();
      const safeWorldId = normalizeWorldId(worldId);
      if (!safeWorldId) return;
      const ref = getQuestPlayerStateRef(safeWorldId);
      if (!ref) return;
      questPlayerStateRef = ref;
      questPlayerStateHandler = (snapshot) => {
        const raw = snapshot && typeof snapshot.val === "function" ? snapshot.val() : null;
        applyRemotePlayerQuestState(safeWorldId, raw || {});
        if (modalCtx) renderModal();
      };
      ref.on("value", questPlayerStateHandler);
    }

    function onWorldEnter(worldId) {
      activeWorldId = normalizeWorldId(worldId);
      bindModalEvents();
      closeModal();
      attachQuestPathsListener();
      attachWorldConfigListener(activeWorldId);
      attachPlayerQuestStateListener(activeWorldId);
    }

    function onWorldLeave() {
      closeModal();
      detachWorldConfigListener();
      detachPlayerQuestStateListener();
      activeWorldId = "";
    }

    function enableWorld(tx, ty) {
      const worldId = getCurrentWorldId();
      const world = getWorld();
      const size = getWorldSize();
      if (!worldId || !world) return { ok: false, reason: "no_world" };
      const safeTx = Math.floor(Number(tx) || 0);
      const safeTy = Math.floor(Number(ty) || 0);
      if (safeTx < 0 || safeTy < 0 || safeTx >= size.w || safeTy >= size.h) {
        return { ok: false, reason: "out_of_bounds" };
      }
      const questNpcId = getQuestNpcId();
      const previous = worldConfigById.get(worldId);
      if (previous && Number.isInteger(previous.npcTx) && Number.isInteger(previous.npcTy)) {
        const oldTx = Math.floor(Number(previous.npcTx) || 0);
        const oldTy = Math.floor(Number(previous.npcTy) || 0);
        if ((oldTx !== safeTx || oldTy !== safeTy) && world[oldTy] && world[oldTy][oldTx] === questNpcId) {
          world[oldTy][oldTx] = 0;
          call("clearTileDamage", oldTx, oldTy);
          call("syncBlock", oldTx, oldTy, 0);
        }
      }
      if (!world[safeTy]) return { ok: false, reason: "invalid_row" };
      world[safeTy][safeTx] = questNpcId;
      call("clearTileDamage", safeTx, safeTy);
      call("syncBlock", safeTx, safeTy, questNpcId);

      let nextPathId = normalizePathId(previous && previous.questPathId);
      const hasLegacyInline = Boolean(previous && Array.isArray(previous.quests) && previous.quests.length);
      if (!nextPathId && !hasLegacyInline) {
        nextPathId = DEFAULT_PATH_ID;
        ensurePath(nextPathId);
      }

      const payload = normalizeWorldConfig({
        enabled: true,
        npcTx: safeTx,
        npcTy: safeTy,
        questPathId: nextPathId,
        quests: hasLegacyInline ? previous.quests : [],
        updatedAt: Date.now(),
        updatedByName: String(get("getPlayerName", "") || "").slice(0, 20),
        updatedByAccountId: String(get("getPlayerProfileId", "") || "").slice(0, 64)
      });
      setLocalWorldConfig(worldId, payload);
      const path = getQuestWorldPath(worldId);
      if (path && payload) {
        writeAdminSet(path, buildWorldConfigPayload(payload)).catch(() => {});
      }
      call("respawnPlayerAtDoor");
      return { ok: true, tx: safeTx, ty: safeTy, worldId };
    }

    function disableWorld() {
      const worldId = getCurrentWorldId();
      const world = getWorld();
      if (!worldId) return { ok: false, reason: "no_world" };
      const questNpcId = getQuestNpcId();
      let removedCount = 0;
      if (Array.isArray(world)) {
        for (let ty = 0; ty < world.length; ty++) {
          const row = world[ty];
          if (!Array.isArray(row)) continue;
          for (let tx = 0; tx < row.length; tx++) {
            if (row[tx] !== questNpcId) continue;
            row[tx] = 0;
            removedCount += 1;
            call("clearTileDamage", tx, ty);
            call("syncBlock", tx, ty, 0);
          }
        }
      }
      setLocalWorldConfig(worldId, null);
      const path = getQuestWorldPath(worldId);
      if (path) writeAdminRemove(path).catch(() => {});
      closeModal();
      return { ok: true, worldId, removedNpcTiles: removedCount };
    }

    function onNpcBroken(tx, ty) {
      const config = getCurrentConfig();
      if (!config) return false;
      const safeTx = Math.floor(Number(tx) || 0);
      const safeTy = Math.floor(Number(ty) || 0);
      if (safeTx !== config.npcTx || safeTy !== config.npcTy) return false;
      const worldId = getCurrentWorldId();
      if (!worldId) return false;
      setLocalWorldConfig(worldId, null);
      const path = getQuestWorldPath(worldId);
      if (path) writeAdminRemove(path).catch(() => {});
      closeModal();
      return true;
    }

    function interact(tx, ty) {
      const safeTx = Math.floor(Number(tx) || 0);
      const safeTy = Math.floor(Number(ty) || 0);
      if (!isQuestNpcTile(safeTx, safeTy)) return false;
      bindModalEvents();
      modalCtx = { tx: safeTx, ty: safeTy };
      renderModal();
      return true;
    }

    function clearAll() {
      closeModal();
      detachWorldConfigListener();
      detachQuestPathsListener();
      detachPlayerQuestStateListener();
      activeWorldId = "";
      worldConfigById.clear();
      playerQuestStateByWorld.clear();
      resetQuestPathsToDefaults();
    }

    resetQuestPathsToDefaults();

    return {
      bindModalEvents,
      onWorldEnter,
      onWorldLeave,
      onGameplayEvent,
      getCurrentConfig,
      getCurrentQuestPathId,
      isActive,
      isQuestNpcTile,
      enableWorld,
      disableWorld,
      setWorldQuestPath,
      addFetchQuestToPath,
      addFetchCosmeticQuestToPath,
      addBreakQuestToPath,
      addPlaceQuestToPath,
      listQuestPaths,
      onNpcBroken,
      interact,
      closeModal,
      clearAll
    };
  }

  return {
    createController
  };
})();
