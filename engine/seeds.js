window.GTModules = window.GTModules || {};

window.GTModules.seeds = (function createSeedsModule() {
  const LEGACY_BY_YIELD_ID = {
    1: { seedId: 25, seedKey: "grass_seed", label: "Grass Seed" },
    2: { seedId: 26, seedKey: "dirt_seed", label: "Dirt Seed" },
    3: { seedId: 27, seedKey: "stone_seed", label: "Stone Seed" },
    4: { seedId: 24, seedKey: "tree_seed", label: "Tree Seed" },
    5: { seedId: 28, seedKey: "sand_seed", label: "Sand Seed" },
    6: { seedId: 29, seedKey: "brick_seed", label: "Brick Seed" },
    9: { seedId: 30, seedKey: "lock_seed", label: "Lock Seed" },
    10: { seedId: 31, seedKey: "door_seed", label: "Door Seed" },
    23: { seedId: 32, seedKey: "plank_seed", label: "Plank Seed" }
  };
  const DYNAMIC_SEED_ID_START = 200;
  const DEFAULT_GROW_MS = 120000;

  function normalizeBlockDefs(blockDefs) {
    const out = {};
    const src = blockDefs && typeof blockDefs === "object" ? blockDefs : {};
    const ids = Object.keys(src);
    for (let i = 0; i < ids.length; i++) {
      const id = Math.floor(Number(ids[i]));
      if (!Number.isInteger(id) || id < 0) continue;
      const row = src[ids[i]] || {};
      out[id] = { ...row, id };
    }
    return out;
  }

  function defaultSeedable(def) {
    if (!def || typeof def !== "object") return false;
    if (def.id <= 0) return false;
    if (def.unbreakable) return false;
    if (def.worldLock === true) return false;
    if (def.seedable === false) return false;
    const key = String(def.key || "").toLowerCase();
    if (!key || key === "air" || key.endsWith("_seed")) return false;
    return true;
  }

  function makeSeedKey(def) {
    const key = String(def.key || "").toLowerCase();
    const stripped = key.replace(/_block$/g, "");
    return (stripped || ("block_" + String(def.id))) + "_seed";
  }

  function nextSeedId(usedIds, cursor) {
    let id = Math.max(DYNAMIC_SEED_ID_START, Math.floor(Number(cursor) || DYNAMIC_SEED_ID_START));
    while (usedIds.has(id)) id++;
    usedIds.add(id);
    return id;
  }

  function normalizeGrowMs(value, fallbackMs) {
    const parsed = Math.floor(Number(value));
    if (Number.isFinite(parsed) && parsed >= 5000) return parsed;
    return Math.max(5000, Math.floor(Number(fallbackMs) || DEFAULT_GROW_MS));
  }

  function resolveSeedGrowMs(yieldId, def, growMsByYieldId, fallbackGrowMs) {
    const sourceDef = def && typeof def === "object" ? def : {};
    const overrides = growMsByYieldId && typeof growMsByYieldId === "object" ? growMsByYieldId : null;
    let candidate;
    if (overrides) {
      if (overrides[yieldId] !== undefined) {
        candidate = overrides[yieldId];
      } else {
        const key = String(sourceDef.key || "").trim().toLowerCase();
        if (key && overrides[key] !== undefined) {
          candidate = overrides[key];
        }
      }
    }
    if (candidate === undefined && sourceDef.seedGrowMs !== undefined) {
      candidate = sourceDef.seedGrowMs;
    }
    return normalizeGrowMs(candidate, fallbackGrowMs);
  }

  function createSeedRegistry(blockDefs, options) {
    const opts = options && typeof options === "object" ? options : {};
    const growMs = normalizeGrowMs(opts.growMs, DEFAULT_GROW_MS);
    const growMsByYieldId = opts.growMsByYieldId && typeof opts.growMsByYieldId === "object"
      ? opts.growMsByYieldId
      : null;
    const forcedIds = new Set(
      (Array.isArray(opts.forceSeedForBlockIds) ? opts.forceSeedForBlockIds : [])
        .map((id) => Math.floor(Number(id)))
        .filter((id) => Number.isInteger(id) && id > 0)
    );
    const source = normalizeBlockDefs(blockDefs);
    const defs = {};
    const config = {};
    const usedIds = new Set(Object.keys(source).map((id) => Math.floor(Number(id))).filter((id) => Number.isInteger(id) && id >= 0));
    let dynamicSeedIdCursor = DYNAMIC_SEED_ID_START;
    const sourceIds = Object.keys(source).map((id) => Math.floor(Number(id))).filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);

    for (let i = 0; i < sourceIds.length; i++) {
      const yieldId = sourceIds[i];
      const def = source[yieldId];
      const forced = forcedIds.has(yieldId);
      if (!forced && !defaultSeedable(def)) continue;

      const legacy = LEGACY_BY_YIELD_ID[yieldId] || null;
      const canUseLegacyId = Boolean(legacy) && !usedIds.has(legacy.seedId);
      const seedId = canUseLegacyId ? legacy.seedId : nextSeedId(usedIds, dynamicSeedIdCursor);
      if (canUseLegacyId) {
        usedIds.add(seedId);
      } else {
        dynamicSeedIdCursor = seedId + 1;
      }

      const label = String((legacy && legacy.label) || def.seedLabel || (def.name ? (def.name + " Seed") : "Seed")).trim().slice(0, 40);
      const seedKey = String((legacy && legacy.seedKey) || def.seedKey || makeSeedKey(def)).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40) || ("seed_" + String(seedId));
      const imagePath = String(def.seedImagePath || ("./assets/blocks/seeds/" + seedKey + ".png")).trim();
      defs[seedId] = {
        id: seedId,
        key: seedKey,
        name: label,
        color: String(def.seedColor || def.color || "#6fbf52"),
        solid: false,
        icon: "SE",
        faIcon: "fa-solid fa-seedling",
        imagePath,
        seedable: false,
        generatedSeed: true,
        seedForBlockId: yieldId
      };
      config[seedId] = {
        yieldBlockId: yieldId,
        dropFromBlockId: yieldId,
        growMs: resolveSeedGrowMs(yieldId, def, growMsByYieldId, growMs),
        label
      };
    }

    return { defs, config };
  }

  return {
    createSeedRegistry
  };
})();
