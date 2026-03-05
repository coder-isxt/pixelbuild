window.GTModules = window.GTModules || {};

window.GTModules.quests = (function createQuestsModule() {
  const DAILY_QUESTS = [
    {
      id: "break_100_blocks",
      label: "Break 100 blocks",
      target: 100,
      event: "break_block",
      rewards: { gems: 90 }
    },
    {
      id: "place_60_blocks",
      label: "Place 60 blocks",
      target: 60,
      event: "place_block",
      rewards: { gems: 70 }
    }
  ];

  const OTHER_QUESTS = [
    {
      id: "break_500_blocks_total",
      label: "Break 500 blocks",
      target: 500,
      event: "break_block",
      category: "other",
      rewards: { cosmeticId: "sun_shirt", cosmeticAmount: 1, gems: 200 }
    },
    {
      id: "place_400_blocks_total",
      label: "Place 400 blocks",
      target: 400,
      event: "place_block",
      category: "other",
      rewards: { gems: 180 }
    },
    {
      id: "visit_25_worlds_total",
      label: "Visit 25 unique worlds",
      target: 25,
      event: "visit_world",
      uniqueWorldVisit: true,
      category: "other",
      rewards: { titleId: "traveler", titleAmount: 1, gems: 120 }
    },
    {
      id: "earn_10000_gems_total",
      label: "Earn 10,000 gems",
      target: 10000,
      event: "gems_earned",
      category: "other",
      rewards: { gems: 350 }
    },
    {
      id: "harvest_120_trees_total",
      label: "Harvest 120 trees",
      target: 120,
      event: "tree_harvest",
      category: "other",
      rewards: { gems: 220 }
    }
  ];

  const ALL_QUESTS = DAILY_QUESTS
    .map((q) => ({ ...q, category: "daily" }))
    .concat(OTHER_QUESTS.map((q) => ({ ...q, category: "other" })));

  function toInt(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeWorldId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, 24);
  }

  function dayKeyFromTs(ts) {
    const date = new Date(Number(ts) || Date.now());
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function normalizeWorldMap(value) {
    const src = value && typeof value === "object" ? value : {};
    const out = {};
    const keys = Object.keys(src);
    for (let i = 0; i < keys.length; i++) {
      const id = normalizeWorldId(keys[i]);
      if (!id) continue;
      if (!src[keys[i]]) continue;
      out[id] = true;
    }
    return out;
  }

  function normalizeBlockKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 64);
  }

  function buildFresh(dayKey) {
    const key = String(dayKey || dayKeyFromTs(Date.now()));
    const quests = {};
    const globalQuests = {};
    for (let i = 0; i < DAILY_QUESTS.length; i++) {
      const def = DAILY_QUESTS[i];
      quests[def.id] = { progress: 0, completed: false, rewarded: false };
    }
    for (let i = 0; i < OTHER_QUESTS.length; i++) {
      const def = OTHER_QUESTS[i];
      globalQuests[def.id] = { progress: 0, completed: false, rewarded: false };
    }
    return {
      dayKey: key,
      quests,
      globalQuests,
      visitedWorldsDaily: {},
      visitedWorldsTotal: {},
      updatedAt: 0
    };
  }

  function normalizeQuestRow(def, row) {
    const data = row && typeof row === "object" ? row : {};
    const target = Math.max(1, Number(def && def.target) || 1);
    const progress = Math.max(0, Math.min(target, toInt(data.progress, 0)));
    return {
      progress,
      completed: Boolean(data.completed) || progress >= target,
      rewarded: Boolean(data.rewarded)
    };
  }

  function recalcUniqueVisitQuestProgress(state) {
    const safe = state && typeof state === "object" ? state : buildFresh(dayKeyFromTs(Date.now()));
    for (let i = 0; i < ALL_QUESTS.length; i++) {
      const def = ALL_QUESTS[i];
      if (!def.uniqueWorldVisit || def.event !== "visit_world") continue;
      const row = def.category === "other" ? safe.globalQuests[def.id] : safe.quests[def.id];
      if (!row) continue;
      const map = def.category === "other" ? safe.visitedWorldsTotal : safe.visitedWorldsDaily;
      const count = Math.max(0, Object.keys(map).length);
      const next = Math.min(Math.max(1, Number(def.target) || 1), count);
      row.progress = Math.max(row.progress, next);
      if (row.progress >= def.target) row.completed = true;
    }
    return safe;
  }

  function normalizeState(raw, nowTs) {
    const today = dayKeyFromTs(nowTs);
    const src = raw && typeof raw === "object" ? raw : {};
    const srcDay = String(src.dayKey || "");
    const base = srcDay === today ? src : buildFresh(today);
    const out = buildFresh(today);

    out.visitedWorldsTotal = normalizeWorldMap(src.visitedWorldsTotal);

    if (srcDay === today) {
      out.visitedWorldsDaily = normalizeWorldMap(base.visitedWorldsDaily || base.visitedWorlds);
      const srcQuests = base.quests && typeof base.quests === "object" ? base.quests : {};
      for (let i = 0; i < DAILY_QUESTS.length; i++) {
        const def = DAILY_QUESTS[i];
        out.quests[def.id] = normalizeQuestRow(def, srcQuests[def.id]);
      }
    }

    const srcGlobal = src.globalQuests && typeof src.globalQuests === "object" ? src.globalQuests : {};
    for (let i = 0; i < OTHER_QUESTS.length; i++) {
      const def = OTHER_QUESTS[i];
      out.globalQuests[def.id] = normalizeQuestRow(def, srcGlobal[def.id]);
    }

    out.updatedAt = toInt(base.updatedAt, 0);
    return recalcUniqueVisitQuestProgress(out);
  }

  function buildPayload(state) {
    return normalizeState(state || {}, Date.now());
  }

  function getDeltaByEvent(type, details) {
    if (type === "gems_earned") return Math.max(0, toInt(details.amount, 0));
    if (type === "trade_complete") return Math.max(1, toInt(details.count, 1));
    if (type === "tree_harvest") return Math.max(1, toInt(details.count, 1));
    if (type === "break_block") return Math.max(1, toInt(details.count, 1));
    if (type === "place_block") return Math.max(1, toInt(details.count, 1));
    return Math.max(1, toInt(details.count, 1));
  }

  function applyEvent(currentState, eventType, payload) {
    const type = String(eventType || "");
    const details = payload && typeof payload === "object" ? payload : {};
    const state = normalizeState(currentState || {}, Date.now());
    const completedNow = [];
    let changed = false;

    for (let i = 0; i < ALL_QUESTS.length; i++) {
      const def = ALL_QUESTS[i];
      const row = def.category === "other" ? state.globalQuests[def.id] : state.quests[def.id];
      if (!row || row.completed) continue;
      if (def.event !== type) continue;

      if (type === "break_block" || type === "place_block") {
        const wantedBlockId = Math.max(0, Math.floor(Number(def.blockId) || 0));
        const eventBlockId = Math.max(0, Math.floor(Number(details.blockId) || 0));
        const wantedBlockKey = normalizeBlockKey(def.blockKey || def.block || def.item || "");
        const eventBlockKey = normalizeBlockKey(details.blockKey || "");
        if (wantedBlockId > 0 && eventBlockId !== wantedBlockId) continue;
        if (wantedBlockKey && eventBlockKey !== wantedBlockKey) continue;
      }

      if (type === "visit_world" && def.uniqueWorldVisit) {
        const worldId = normalizeWorldId(details.worldId);
        if (!worldId) continue;
        const map = def.category === "other" ? state.visitedWorldsTotal : state.visitedWorldsDaily;
        if (!map[worldId]) {
          map[worldId] = true;
          changed = true;
        }
        const count = Math.min(def.target, Object.keys(map).length);
        if (count !== row.progress) {
          row.progress = count;
          changed = true;
        }
      } else {
        const delta = getDeltaByEvent(type, details);
        if (delta <= 0) continue;
        const next = Math.min(def.target, row.progress + delta);
        if (next !== row.progress) {
          row.progress = next;
          changed = true;
        }
      }

      if (row.progress >= def.target && !row.completed) {
        row.completed = true;
        completedNow.push(def.id);
        changed = true;
      }
    }

    if (changed) {
      state.updatedAt = Date.now();
    }
    return { state, changed, completedNow };
  }

  function markRewarded(currentState, questId) {
    const state = normalizeState(currentState || {}, Date.now());
    const id = String(questId || "");
    if (!id) return { state, changed: false };
    let row = null;
    if (state.quests[id]) row = state.quests[id];
    else if (state.globalQuests[id]) row = state.globalQuests[id];
    if (!row) return { state, changed: false };
    if (row.rewarded) return { state, changed: false };
    row.rewarded = true;
    state.updatedAt = Date.now();
    return { state, changed: true };
  }

  function getQuestById(id) {
    const qid = String(id || "");
    for (let i = 0; i < ALL_QUESTS.length; i++) {
      if (ALL_QUESTS[i].id === qid) return ALL_QUESTS[i];
    }
    return null;
  }

  function getCatalog() {
    return ALL_QUESTS.map((q) => ({ ...q, rewards: { ...(q.rewards || {}) } }));
  }

  return {
    dayKeyFromTs,
    normalizeState,
    buildPayload,
    applyEvent,
    markRewarded,
    getQuestById,
    getCatalog
  };
})();
