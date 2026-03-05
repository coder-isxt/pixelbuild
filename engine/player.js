window.GTModules = window.GTModules || {};
window.GTModules.player = {
  clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }
};
