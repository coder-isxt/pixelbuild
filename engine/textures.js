window.GTModules = window.GTModules || {};

window.GTModules.textures = (function createTexturesModule() {
  const DEFAULT_BLOCK_TEXTURES = {
    17: "./assets/blocks/special/vending.png",
    20: "./assets/blocks/special/camera.png",
    21: "./assets/blocks/special/weather_machine.png",
    23: "./assets/blocks/special/plank.png",
    36: "./assets/blocks/special/chest.png",
  };

  function applyDefaultBlockTextures(blockDefs) {
    const defs = blockDefs || {};
    Object.keys(DEFAULT_BLOCK_TEXTURES).forEach((idRaw) => {
      const id = Number(idRaw);
      const def = defs[id];
      if (!def) return;
      const existing = String(def.imagePath || "").trim();
      if (existing) return;
      def.imagePath = DEFAULT_BLOCK_TEXTURES[id];
    });
    return defs;
  }

  return {
    applyDefaultBlockTextures
  };
})();
