window.GTModules = window.GTModules || {};

window.GTModules.blocks = (function createBlocksModule() {
  function getCatalogModule() {
    return (window.GTModules && window.GTModules.itemCatalog) || {};
  }

  function getBlockAssetBasePath() {
    const catalog = getCatalogModule();
    if (typeof catalog.getBlockAssetBasePath === "function") {
      return String(catalog.getBlockAssetBasePath() || "./assets/blocks");
    }
    return "./assets/blocks";
  }

  function resolveImagePath(image) {
    const raw = String(image || "").trim();
    if (!raw) return "";
    if (/^(https?:)?\/\//.test(raw) || raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) {
      return raw;
    }
    return getBlockAssetBasePath().replace(/\/+$/, "") + "/" + raw.replace(/^\/+/, "");
  }

  function getBlockList() {
    const catalog = getCatalogModule();
    if (typeof catalog.getBlocks === "function") {
      const rows = catalog.getBlocks();
      return Array.isArray(rows) ? rows : [];
    }
    const fallback = window.GTItemCatalog && Array.isArray(window.GTItemCatalog.blocks)
      ? window.GTItemCatalog.blocks
      : [];
    return fallback.map((entry) => ({ ...(entry || {}) }));
  }

  function buildDefsFromList(list) {
    const defs = {};
    const src = Array.isArray(list) ? list : [];
    for (let i = 0; i < src.length; i++) {
      const row = src[i] || {};
      const id = Math.floor(Number(row.id));
      if (!Number.isInteger(id) || id < 0) continue;
      defs[id] = {
        ...row,
        id,
        imagePath: resolveImagePath(row.image || row.imagePath)
      };
    }
    return defs;
  }

  return {
    getBlockAssetBasePath,
    getBlockList,
    getBlockDefs() {
      return buildDefsFromList(getBlockList());
    },
    hashWorldSeed(worldId) {
      let h = 2166136261;
      for (let i = 0; i < worldId.length; i++) {
        h ^= worldId.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
      }
      return h >>> 0;
    }
  };
})();
