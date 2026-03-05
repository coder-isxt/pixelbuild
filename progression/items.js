window.GTModules = window.GTModules || {};

window.GTModules.items = (function createItemsModule() {
  function getItemCatalogModule() {
    return (window.GTModules && window.GTModules.itemCatalog) || {};
  }

  function normalizeCosmeticSlots(source) {
    const src = source && typeof source === "object" ? source : {};
    return {
      shirts: Array.isArray(src.shirts) ? src.shirts.slice() : [],
      pants: Array.isArray(src.pants) ? src.pants.slice() : [],
      shoes: Array.isArray(src.shoes) ? src.shoes.slice() : [],
      hats: Array.isArray(src.hats) ? src.hats.slice() : [],
      wings: Array.isArray(src.wings) ? src.wings.slice() : [],
      swords: Array.isArray(src.swords) ? src.swords.slice() : []
    };
  }

  function getLegacyCosmeticCatalog() {
    return normalizeCosmeticSlots(window.GTCosmeticCatalog || {});
  }

  return {
    getUnifiedCatalog() {
      const catalog = getItemCatalogModule();
      if (typeof catalog.getAll === "function") {
        const data = catalog.getAll();
        return data && typeof data === "object"
          ? data
          : {
              blockAssetBasePath: "./assets/blocks",
              cosmeticAssetBasePath: "./assets/cosmetics",
              blocks: [],
              titles: [],
              cosmetics: getLegacyCosmeticCatalog()
            };
      }
      return {
        blockAssetBasePath: "./assets/blocks",
        cosmeticAssetBasePath: "./assets/cosmetics",
        blocks: [],
        titles: [],
        cosmetics: getLegacyCosmeticCatalog()
      };
    },
    getBlockCatalog() {
      const catalog = getItemCatalogModule();
      if (typeof catalog.getBlocks === "function") {
        const rows = catalog.getBlocks();
        return Array.isArray(rows) ? rows.slice() : [];
      }
      const all = this.getUnifiedCatalog();
      return Array.isArray(all.blocks) ? all.blocks.slice() : [];
    },
    getBlockAssetBasePath() {
      const catalog = getItemCatalogModule();
      if (typeof catalog.getBlockAssetBasePath === "function") {
        return catalog.getBlockAssetBasePath() || "./assets/blocks";
      }
      const all = this.getUnifiedCatalog();
      return all.blockAssetBasePath || "./assets/blocks";
    },
    getCosmeticAssetBasePath() {
      const catalog = getItemCatalogModule();
      if (typeof catalog.getCosmeticAssetBasePath === "function") {
        return catalog.getCosmeticAssetBasePath() || "./assets/cosmetics";
      }
      const all = this.getUnifiedCatalog();
      return all.cosmeticAssetBasePath || "./assets/cosmetics";
    },
    getCosmeticCatalog() {
      const catalog = getItemCatalogModule();
      if (typeof catalog.getCosmeticsBySlot === "function") {
        return normalizeCosmeticSlots(catalog.getCosmeticsBySlot());
      }
      return getLegacyCosmeticCatalog();
    },
    getCosmeticItemsBySlot() {
      return this.getCosmeticCatalog();
    },
    getCosmeticItemsFlat() {
      const catalog = this.getCosmeticCatalog();
      return []
        .concat(catalog.shirts || [])
        .concat(catalog.pants || [])
        .concat(catalog.shoes || [])
        .concat(catalog.hats || [])
        .concat(catalog.wings || [])
        .concat(catalog.swords || []);
    },
    getTitleCatalog() {
      const catalog = getItemCatalogModule();
      if (typeof catalog.getTitles === "function") {
        const rows = catalog.getTitles();
        return Array.isArray(rows) ? rows.slice() : [];
      }
      const titlesModule = (window.GTModules && window.GTModules.titles) || {};
      if (!titlesModule || typeof titlesModule.getCatalog !== "function") return [];
      const list = titlesModule.getCatalog();
      return Array.isArray(list) ? list.slice() : [];
    }
  };
})();
