window.GTModules = window.GTModules || {};

window.GTModules.progression = (function createProgressionModule() {
  const DEFAULT_LEVEL = 1;
  const DEFAULT_XP = 0;
  const MAX_LEVEL = 150;
  const BASE_XP_PER_LEVEL = 110;
  const XP_GROWTH_PER_LEVEL = 60;
  const TITLE_UNLOCKS = {
    3: ["novice"],
    10: ["big"],
  };

  function toInt(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }

  function xpNeededForLevel(level) {
    const lv = Math.max(DEFAULT_LEVEL, toInt(level, DEFAULT_LEVEL));
    if (lv >= MAX_LEVEL) return 0;
    return BASE_XP_PER_LEVEL + ((lv - 1) * XP_GROWTH_PER_LEVEL);
  }

  function normalizeProgress(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const xp = Math.max(0, toInt(src.xp, DEFAULT_XP));
    const info = getProgressInfoFromXp(xp);
    return {
      xp,
      level: info.level,
      xpIntoLevel: info.xpIntoLevel,
      xpForNext: info.xpForNext
    };
  }

  function getProgressInfoFromXp(totalXp) {
    let xp = Math.max(0, toInt(totalXp, DEFAULT_XP));
    let level = DEFAULT_LEVEL;
    while (level < MAX_LEVEL) {
      const need = xpNeededForLevel(level);
      if (need <= 0 || xp < need) {
        return {
          level,
          xpIntoLevel: xp,
          xpForNext: need > 0 ? need : 0
        };
      }
      xp -= need;
      level += 1;
    }
    return {
      level: MAX_LEVEL,
      xpIntoLevel: 0,
      xpForNext: 0
    };
  }

  function gainXp(progress, deltaXp) {
    const before = normalizeProgress(progress);
    const add = Math.max(0, toInt(deltaXp, 0));
    const nextTotal = before.xp + add;
    const after = normalizeProgress({ xp: nextTotal });
    return {
      before,
      after,
      leveledUp: after.level > before.level
    };
  }

  function getTitleUnlockIdsForLevel(level) {
    const lv = Math.max(DEFAULT_LEVEL, toInt(level, DEFAULT_LEVEL));
    const out = [];
    Object.keys(TITLE_UNLOCKS).forEach((key) => {
      const req = toInt(key, 0);
      if (req > 0 && lv >= req) {
        const ids = Array.isArray(TITLE_UNLOCKS[key]) ? TITLE_UNLOCKS[key] : [];
        for (let i = 0; i < ids.length; i++) {
          const id = String(ids[i] || "").trim();
          if (!id || out.includes(id)) continue;
          out.push(id);
        }
      }
    });
    return out;
  }

  return {
    DEFAULT_LEVEL,
    DEFAULT_XP,
    MAX_LEVEL,
    xpNeededForLevel,
    normalizeProgress,
    getProgressInfoFromXp,
    gainXp,
    getTitleUnlockIdsForLevel
  };
})();
