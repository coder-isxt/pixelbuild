window.GTModules = window.GTModules || {};

window.GTModules.gems = (function () {
  function createController(opts) {
    const o = opts || {};
    let gems = 0;

    function getMaxGems() {
      const raw = Number(typeof o.getMaxGems === "function" ? o.getMaxGems() : o.maxGems);
      if (!Number.isFinite(raw) || raw <= 0) return 999999999;
      return Math.max(1, Math.floor(raw));
    }

    function clamp(value) {
      const n = Number(value);
      const safe = Number.isFinite(n) ? Math.floor(n) : 0;
      return Math.max(0, Math.min(getMaxGems(), safe));
    }

    function set(value) {
      gems = clamp(value);
      return gems;
    }

    function get() {
      return gems;
    }

    function reset() {
      gems = 0;
      return gems;
    }

    function add(amount) {
      gems = clamp(gems + Number(amount || 0));
      return gems;
    }

    function readFromRecord(record) {
      return set(record && record.gems);
    }

    function writeToPayload(payload) {
      const out = payload && typeof payload === "object" ? payload : {};
      out.gems = get();
      return out;
    }

    function formatLabel() {
      return get() + " gems";
    }

    return {
      clamp,
      set,
      get,
      reset,
      add,
      readFromRecord,
      writeToPayload,
      formatLabel
    };
  }

  return { createController };
})();
