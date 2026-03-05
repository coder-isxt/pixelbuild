window.GTModules = window.GTModules || {};

window.GTModules.farmables = (function createFarmablesModule() {
  const BLOCK_ASSET_BASE = "./assets/blocks";
  const FARMABLE_LIST = [
    { id: 43, key: "star", name: "Star", color: "#d0ce5f", solid: true, farmable: true, durability: 3, seedGrowMs: 45000, icon: "S", faIcon: "fa-solid fa-seedling", image: "farmables/star.png" },
  ];
  const DEFAULT_FARMABLES = [
    { key: "star", xp: 10, gemMin: 3, gemMax: 12 },
  ];

  function toInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.floor(n);
  }

  function clampInt(value, minValue, maxValue) {
    return Math.max(minValue, Math.min(maxValue, toInt(value, minValue)));
  }

  function rollInt(minValue, maxValue, randomFn) {
    const low = Math.min(minValue, maxValue);
    const high = Math.max(minValue, maxValue);
    const rng = typeof randomFn === "function" ? randomFn : Math.random;
    const raw = Number(rng());
    const r = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999, raw)) : 0;
    return low + Math.floor(r * (high - low + 1));
  }

  function resolveImagePath(image) {
    const raw = String(image || "").trim();
    if (!raw) return "";
    if (/^(https?:)?\/\//.test(raw) || raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) {
      return raw;
    }
    return BLOCK_ASSET_BASE.replace(/\/+$/, "") + "/" + raw.replace(/^\/+/, "");
  }

  function buildDefsFromList(list) {
    const defs = {};
    const src = Array.isArray(list) ? list : [];
    for (let i = 0; i < src.length; i++) {
      const row = src[i] || {};
      const id = Math.floor(Number(row.id));
      if (!Number.isInteger(id) || id < 0) continue;
      defs[id] = {
        ...row,
        id,
        imagePath: resolveImagePath(row.image || row.imagePath)
      };
    }
    return defs;
  }

  function normalizeBlockDefs(blockDefs) {
    const out = {};
    const src = blockDefs && typeof blockDefs === "object" ? blockDefs : {};
    const keys = Object.keys(src);
    for (let i = 0; i < keys.length; i++) {
      const id = toInt(keys[i], -1);
      if (!Number.isInteger(id) || id < 0) continue;
      const row = src[keys[i]] || {};
      out[id] = { ...row, id };
    }
    return out;
  }

  function buildKeyToIdMap(blockDefs) {
    const out = {};
    const ids = Object.keys(blockDefs);
    for (let i = 0; i < ids.length; i++) {
      const id = toInt(ids[i], -1);
      if (!Number.isInteger(id) || id <= 0) continue;
      const def = blockDefs[id] || {};
      const key = String(def.key || "").trim().toLowerCase();
      if (!key) continue;
      out[key] = id;
    }
    return out;
  }

  function createRegistry(blockDefs, options) {
    const defs = normalizeBlockDefs(blockDefs);
    const keyToId = buildKeyToIdMap(defs);
    const opts = options && typeof options === "object" ? options : {};
    const rows = Array.isArray(opts.farmables) && opts.farmables.length ? opts.farmables : DEFAULT_FARMABLES;
    const byId = {};
    const ids = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const key = String(row.key || "").trim().toLowerCase();
      const id = Number.isInteger(row.id) ? toInt(row.id, 0) : (keyToId[key] || 0);
      if (!id || !defs[id]) continue;
      const xp = clampInt(row.xp, 6, 300);
      const gemMin = clampInt(row.gemMin, 0, 9999);
      const gemMax = clampInt(row.gemMax, gemMin, 9999);
      byId[id] = {
        id,
        key: String(defs[id].key || key || ("block_" + id)),
        xp,
        gemMin,
        gemMax
      };
    }

    const allIds = Object.keys(defs).map((id) => toInt(id, -1)).filter((id) => Number.isInteger(id) && id > 0);
    for (let i = 0; i < allIds.length; i++) {
      const id = allIds[i];
      if (byId[id]) continue;
      const def = defs[id] || {};
      if (!def || def.farmable !== true) continue;
      const xp = clampInt(def.farmXp, 6, 300);
      const gemMin = clampInt(def.farmGemMin, 0, 9999);
      const gemMax = clampInt(def.farmGemMax, gemMin, 9999);
      byId[id] = {
        id,
        key: String(def.key || ("block_" + id)),
        xp,
        gemMin,
        gemMax
      };
    }

    const mappedIds = Object.keys(byId).map((id) => toInt(id, -1)).filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
    for (let i = 0; i < mappedIds.length; i++) ids.push(mappedIds[i]);
    const idSet = new Set(ids);

    return {
      ids,
      byId,
      isFarmable(id) {
        return idSet.has(toInt(id, -1));
      },
      getById(id) {
        const safeId = toInt(id, -1);
        return byId[safeId] || null;
      },
      rollGems(id, randomFn) {
        const row = this.getById(id);
        if (!row) return 0;
        return rollInt(row.gemMin, row.gemMax, randomFn);
      },
      getBreakXp(id, fallbackXp) {
        const row = this.getById(id);
        if (!row) return clampInt(fallbackXp, 1, 9999);
        return row.xp;
      }
    };
  }

  return {
    getFarmableList() {
      return FARMABLE_LIST.map((entry) => ({ ...entry }));
    },
    getFarmableDefs() {
      return buildDefsFromList(FARMABLE_LIST);
    },
    createRegistry
  };
})();
