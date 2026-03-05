window.GTModules = window.GTModules || {};

window.GTModules.rewards = (function () {
  function createController(opts) {
    const o = opts || {};

    function getIntValue(getterName, fallback) {
      const source = typeof o[getterName] === "function" ? o[getterName]() : o[getterName];
      const numeric = Number(source);
      if (!Number.isFinite(numeric)) return fallback;
      return Math.floor(numeric);
    }

    function clampInt(value, minValue, maxValue) {
      const n = Number(value);
      const safe = Number.isFinite(n) ? Math.floor(n) : minValue;
      return Math.max(minValue, Math.min(maxValue, safe));
    }

    function rollInt(minValue, maxValue, randomFn) {
      const min = Math.floor(minValue);
      const max = Math.floor(maxValue);
      const low = Math.min(min, max);
      const high = Math.max(min, max);
      const rng = typeof randomFn === "function" ? randomFn : Math.random;
      const raw = Number(rng());
      const r = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999, raw)) : 0;
      return low + Math.floor(r * (high - low + 1));
    }

    function getTreeHarvestRewards(baseReward, randomFn) {
      if (!baseReward || typeof baseReward !== "object") return null;
      const blockId = Math.max(1, Math.floor(Number(baseReward.blockId) || 1));
      const amount = Math.max(1, Math.floor(Number(baseReward.amount) || 1));
      const gemMin = clampInt(getIntValue("getTreeGemMin", 1), 0, 1000);
      const gemMax = clampInt(getIntValue("getTreeGemMax", 4), 0, 1000);
      return {
        blockId,
        amount,
        gems: rollInt(gemMin, gemMax, randomFn)
      };
    }

    return {
      clampInt,
      rollInt,
      getTreeHarvestRewards
    };
  }

  return { createController };
})();
