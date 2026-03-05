(function syncSwordsFromCatalog() {
  const catalog = (window.GTModules && window.GTModules.itemCatalog) || {};
  const rows = typeof catalog.getCosmeticSlot === "function"
    ? catalog.getCosmeticSlot("swords")
    : [];
  window.GTCosmeticCatalog = window.GTCosmeticCatalog || {};
  window.GTCosmeticCatalog.swords = Array.isArray(rows) ? rows : [];
})();
