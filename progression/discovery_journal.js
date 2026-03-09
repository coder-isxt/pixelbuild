window.GTModules = window.GTModules || {};

window.GTModules.discoveryJournal = (function createDiscoveryJournalModule() {
  const MAX_ID_LENGTH = 48;
  const MAX_LABEL_LENGTH = 64;

  const WORLD_TYPES = [
    { id: "starter", label: "Starter Worlds", test: /^(start|default|menu|spawn)/ },
    { id: "trade", label: "Trade Worlds", test: /(trade|shop|market|vend|buy|sell)/ },
    { id: "farm", label: "Farm Worlds", test: /(farm|tree|seed|grow|harvest|crop)/ },
    { id: "casino", label: "Casino Worlds", test: /(casino|gamble|slots|blackjack|mines|tower|plinko)/ },
    { id: "quest", label: "Quest Worlds", test: /(quest|wizard|legend|ring|carnival|story)/ },
    { id: "parkour", label: "Parkour Worlds", test: /(parkour|jump|obby|maze)/ }
  ];

  const RARE_FIND_TYPES = [
    { id: "fish", label: "Rare Fish" },
    { id: "crop", label: "Rare Crop" },
    { id: "relic", label: "Rare Relic" }
  ];

  const RARE_FIND_SET = new Set(RARE_FIND_TYPES.map((row) => row.id));
  const SEASONAL_KEYWORD_RE = /(winter|spring|summer|autumn|fall|halloween|xmas|christmas|event|season)/i;
  const LORE_KEYWORD_RE = /(lore|glyph|rune|sigil|symbol|ancient)/i;

  function toInt(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, MAX_ID_LENGTH);
  }

  function normalizeLabel(value, fallback) {
    const text = String(value || "").trim().slice(0, MAX_LABEL_LENGTH);
    return text || String(fallback || "").trim().slice(0, MAX_LABEL_LENGTH);
  }

  function createFreshState() {
    return {
      worldTypes: {},
      rareFinds: {},
      loreSymbols: {},
      seasonalEvents: {},
      stats: {
        worldTypes: 0,
        rareFinds: 0,
        loreSymbols: 0,
        seasonalEvents: 0,
        total: 0
      },
      updatedAt: 0
    };
  }

  function normalizeWorldTypesMap(value) {
    const source = value && typeof value === "object" ? value : {};
    const out = {};
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
      const id = normalizeId(keys[i]);
      if (!id) continue;
      const row = source[keys[i]] || {};
      out[id] = {
        firstAt: Math.max(0, toInt(row.firstAt, 0)),
        worldId: normalizeId(row.worldId || row.world || "")
      };
    }
    return out;
  }

  function normalizeRareFindsMap(value) {
    const source = value && typeof value === "object" ? value : {};
    const out = {};
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
      const findType = normalizeId(keys[i]);
      if (!findType || !RARE_FIND_SET.has(findType)) continue;
      const row = source[keys[i]] || {};
      out[findType] = {
        key: normalizeId(row.key || ""),
        label: normalizeLabel(row.label || "", findType),
        firstAt: Math.max(0, toInt(row.firstAt, 0)),
        worldId: normalizeId(row.worldId || "")
      };
    }
    return out;
  }

  function normalizeLoreMap(value) {
    const source = value && typeof value === "object" ? value : {};
    const out = {};
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
      const symbolId = normalizeId(keys[i]);
      if (!symbolId) continue;
      const row = source[keys[i]] || {};
      out[symbolId] = {
        label: normalizeLabel(row.label || row.name || "", symbolId),
        worldId: normalizeId(row.worldId || ""),
        foundAt: Math.max(0, toInt(row.foundAt || row.firstAt, 0))
      };
    }
    return out;
  }

  function normalizeSeasonalMap(value) {
    const source = value && typeof value === "object" ? value : {};
    const out = {};
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
      const eventId = normalizeId(keys[i]);
      if (!eventId) continue;
      const row = source[keys[i]] || {};
      out[eventId] = {
        label: normalizeLabel(row.label || row.name || "", eventId),
        completedAt: Math.max(0, toInt(row.completedAt || row.firstAt, 0))
      };
    }
    return out;
  }

  function updateStats(state) {
    const safe = state && typeof state === "object" ? state : createFreshState();
    safe.stats.worldTypes = Object.keys(safe.worldTypes || {}).length;
    safe.stats.rareFinds = Object.keys(safe.rareFinds || {}).length;
    safe.stats.loreSymbols = Object.keys(safe.loreSymbols || {}).length;
    safe.stats.seasonalEvents = Object.keys(safe.seasonalEvents || {}).length;
    safe.stats.total =
      safe.stats.worldTypes +
      safe.stats.rareFinds +
      safe.stats.loreSymbols +
      safe.stats.seasonalEvents;
    return safe;
  }

  function normalizeState(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const out = createFreshState();
    out.worldTypes = normalizeWorldTypesMap(source.worldTypes);
    out.rareFinds = normalizeRareFindsMap(source.rareFinds);
    out.loreSymbols = normalizeLoreMap(source.loreSymbols);
    out.seasonalEvents = normalizeSeasonalMap(source.seasonalEvents);
    out.updatedAt = Math.max(0, toInt(source.updatedAt, 0));
    return updateStats(out);
  }

  function buildPayload(state) {
    return normalizeState(state || {});
  }

  function classifyWorldType(worldId) {
    const id = normalizeId(worldId);
    if (!id) return "";
    for (let i = 0; i < WORLD_TYPES.length; i++) {
      if (WORLD_TYPES[i].test.test(id)) return WORLD_TYPES[i].id;
    }
    return "starter";
  }

  function findTypeLabel(findType, fallback) {
    const safe = normalizeId(findType);
    for (let i = 0; i < RARE_FIND_TYPES.length; i++) {
      if (RARE_FIND_TYPES[i].id === safe) return RARE_FIND_TYPES[i].label;
    }
    return normalizeLabel(fallback || safe || "Rare Find", "Rare Find");
  }

  function applyEvent(currentState, eventType, payload) {
    const state = normalizeState(currentState || {});
    const type = String(eventType || "").trim().toLowerCase();
    const info = payload && typeof payload === "object" ? payload : {};
    const unlockedNow = [];
    let changed = false;
    const nowTs = Date.now();

    if (type === "visit_world") {
      const worldId = normalizeId(info.worldId);
      const worldType = classifyWorldType(worldId);
      if (worldType && !state.worldTypes[worldType]) {
        state.worldTypes[worldType] = {
          firstAt: nowTs,
          worldId
        };
        unlockedNow.push({
          kind: "world_type",
          id: worldType,
          label: worldType.replace(/_/g, " ")
        });
        changed = true;
      }
    } else if (type === "rare_find") {
      const findType = normalizeId(info.findType);
      const key = normalizeId(info.key || info.itemId || info.blockKey || "");
      if (findType && key && RARE_FIND_SET.has(findType) && !state.rareFinds[findType]) {
        state.rareFinds[findType] = {
          key,
          label: normalizeLabel(info.label || key, findTypeLabel(findType, key)),
          firstAt: nowTs,
          worldId: normalizeId(info.worldId || "")
        };
        unlockedNow.push({
          kind: "rare_find",
          id: findType,
          label: findTypeLabel(findType, key)
        });
        changed = true;
      }
    } else if (type === "lore_symbol") {
      const symbolId = normalizeId(info.symbolId || info.key || "");
      if (symbolId && !state.loreSymbols[symbolId]) {
        state.loreSymbols[symbolId] = {
          label: normalizeLabel(info.label || symbolId, symbolId),
          worldId: normalizeId(info.worldId || ""),
          foundAt: nowTs
        };
        unlockedNow.push({
          kind: "lore_symbol",
          id: symbolId,
          label: normalizeLabel(info.label || symbolId, symbolId)
        });
        changed = true;
      }
    } else if (type === "seasonal_complete") {
      const eventId = normalizeId(info.eventId || info.questId || "");
      if (eventId && !state.seasonalEvents[eventId]) {
        state.seasonalEvents[eventId] = {
          label: normalizeLabel(info.label || info.questLabel || eventId, eventId),
          completedAt: nowTs
        };
        unlockedNow.push({
          kind: "seasonal_event",
          id: eventId,
          label: normalizeLabel(info.label || info.questLabel || eventId, eventId)
        });
        changed = true;
      }
    } else if (type === "quest_complete") {
      const questId = normalizeId(info.questId || "");
      if (questId && SEASONAL_KEYWORD_RE.test(questId) && !state.seasonalEvents[questId]) {
        state.seasonalEvents[questId] = {
          label: normalizeLabel(info.label || info.questLabel || questId, questId),
          completedAt: nowTs
        };
        unlockedNow.push({
          kind: "seasonal_event",
          id: questId,
          label: normalizeLabel(info.label || info.questLabel || questId, questId)
        });
        changed = true;
      }
    } else if (type === "tree_harvest") {
      const key = normalizeId(info.blockKey || info.seedKey || info.cropKey || "harvest");
      if (key && !state.rareFinds.crop) {
        state.rareFinds.crop = {
          key,
          label: normalizeLabel(info.label || key, "Rare Crop"),
          firstAt: nowTs,
          worldId: normalizeId(info.worldId || "")
        };
        unlockedNow.push({
          kind: "rare_find",
          id: "crop",
          label: "Rare Crop"
        });
        changed = true;
      }
    } else if (type === "break_block") {
      const blockKey = normalizeId(info.blockKey || "");
      if (blockKey && LORE_KEYWORD_RE.test(blockKey) && !state.loreSymbols[blockKey]) {
        state.loreSymbols[blockKey] = {
          label: normalizeLabel(info.label || blockKey, blockKey),
          worldId: normalizeId(info.worldId || ""),
          foundAt: nowTs
        };
        unlockedNow.push({
          kind: "lore_symbol",
          id: blockKey,
          label: normalizeLabel(info.label || blockKey, blockKey)
        });
        changed = true;
      }
      if (blockKey && /fish|koi|shark|salmon|tuna/.test(blockKey) && !state.rareFinds.fish) {
        state.rareFinds.fish = {
          key: blockKey,
          label: normalizeLabel(info.label || blockKey, "Rare Fish"),
          firstAt: nowTs,
          worldId: normalizeId(info.worldId || "")
        };
        unlockedNow.push({
          kind: "rare_find",
          id: "fish",
          label: "Rare Fish"
        });
        changed = true;
      }
      if (blockKey && /relic|artifact|ancient/.test(blockKey) && !state.rareFinds.relic) {
        state.rareFinds.relic = {
          key: blockKey,
          label: normalizeLabel(info.label || blockKey, "Rare Relic"),
          firstAt: nowTs,
          worldId: normalizeId(info.worldId || "")
        };
        unlockedNow.push({
          kind: "rare_find",
          id: "relic",
          label: "Rare Relic"
        });
        changed = true;
      }
    }

    if (!changed) {
      return { state, changed: false, unlockedNow };
    }
    state.updatedAt = nowTs;
    updateStats(state);
    return { state, changed: true, unlockedNow };
  }

  function summarize(state) {
    const safe = normalizeState(state || {});
    return {
      worldTypes: safe.stats.worldTypes,
      rareFinds: safe.stats.rareFinds,
      loreSymbols: safe.stats.loreSymbols,
      seasonalEvents: safe.stats.seasonalEvents,
      total: safe.stats.total
    };
  }

  function getCatalog() {
    return {
      worldTypes: WORLD_TYPES.map((row) => ({ id: row.id, label: row.label })),
      rareFindTypes: RARE_FIND_TYPES.map((row) => ({ ...row }))
    };
  }

  return {
    normalizeState,
    buildPayload,
    applyEvent,
    summarize,
    classifyWorldType,
    getCatalog
  };
})();
