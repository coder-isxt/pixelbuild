(function syncPantsFromCatalog() {
  const catalog = (window.GTModules && window.GTModules.itemCatalog) || {};
  const rows = typeof catalog.getCosmeticSlot === "function"
    ? catalog.getCosmeticSlot("pants")
    : [];
  window.GTCosmeticCatalog = window.GTCosmeticCatalog || {};
  window.GTCosmeticCatalog.pants = Array.isArray(rows) ? rows : [];
})();
