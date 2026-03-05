window.GTModules = window.GTModules || {};
window.GTModules.blockKeys = {
  buildMaps(blockDefs) {
    const idToKey = {};
    const keyToId = {};
    const defs = blockDefs || {};
    Object.keys(defs).forEach((idRaw) => {
      const id = Number(idRaw);
      const def = defs[id];
      if (!def) return;
      const key = (def.key || ("block_" + id)).toString().trim().toLowerCase();
      idToKey[id] = key;
      keyToId[key] = id;
    });
    return { idToKey, keyToId };
  },

  parseBlockRef(value, keyToId, blockDefs) {
    const raw = (value || "").toString().trim().toLowerCase();
    if (!raw) return 0;
    if (keyToId && keyToId[raw] !== undefined) {
      return Number(keyToId[raw]);
    }
    const numeric = Number(raw);
    if (Number.isInteger(numeric) && blockDefs && blockDefs[numeric]) {
      return numeric;
    }
    return 0;
  }
};
