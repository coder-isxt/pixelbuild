(function syncWingsFromCatalog() {
  const catalog = (window.GTModules && window.GTModules.itemCatalog) || {};
  const rows = typeof catalog.getCosmeticSlot === "function"
    ? catalog.getCosmeticSlot("wings")
    : [];
  window.GTCosmeticCatalog = window.GTCosmeticCatalog || {};
  window.GTCosmeticCatalog.wings = Array.isArray(rows) ? rows : [];
})();
