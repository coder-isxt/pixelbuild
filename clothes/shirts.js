(function syncShirtsFromCatalog() {
  const catalog = (window.GTModules && window.GTModules.itemCatalog) || {};
  const rows = typeof catalog.getCosmeticSlot === "function"
    ? catalog.getCosmeticSlot("shirts")
    : [];
  window.GTCosmeticCatalog = window.GTCosmeticCatalog || {};
  window.GTCosmeticCatalog.shirts = Array.isArray(rows) ? rows : [];
})();
