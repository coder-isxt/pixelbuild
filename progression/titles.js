window.GTModules = window.GTModules || {};

window.GTModules.titles = (function createTitlesModule() {
  function getCatalog() {
    const catalog = (window.GTModules && window.GTModules.itemCatalog) || {};
    if (typeof catalog.getTitles === "function") {
      const rows = catalog.getTitles();
      return Array.isArray(rows) ? rows : [];
    }
    const fallback = window.GTItemCatalog && Array.isArray(window.GTItemCatalog.titles)
      ? window.GTItemCatalog.titles
      : [];
    return fallback.map((entry) => ({ ...(entry || {}) }));
  }

  return {
    getCatalog
  };
})();
