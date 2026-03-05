(function syncHatsFromCatalog() {
  const catalog = (window.GTModules && window.GTModules.itemCatalog) || {};
  const rows = typeof catalog.getCosmeticSlot === "function"
    ? catalog.getCosmeticSlot("hats")
    : [];
  window.GTCosmeticCatalog = window.GTCosmeticCatalog || {};
  window.GTCosmeticCatalog.hats = Array.isArray(rows) ? rows : [];
})();
