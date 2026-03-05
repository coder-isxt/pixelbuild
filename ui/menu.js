window.GTModules = window.GTModules || {};
window.GTModules.menu = {
  pickRandomWorlds(worldIds, count) {
    const pool = worldIds.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, count);
  }
};
