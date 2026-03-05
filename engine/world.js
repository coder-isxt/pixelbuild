window.GTModules = window.GTModules || {};

window.GTModules.world = {
  hashWorldSeed(worldId) {
    const text = String(worldId || "");
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0) || 1;
  },
  getSpawnStructureTiles(spawnX, spawnY, doorId, baseId) {
    return {
      door: { tx: spawnX, ty: spawnY, id: doorId },
      base: { tx: spawnX, ty: spawnY + 1, id: baseId }
    };
  },
  applySpawnStructureToGrid(grid, width, height, spawnX, spawnY, doorId, baseId) {
    if (!Array.isArray(grid) || !grid.length) return;
    const tiles = this.getSpawnStructureTiles(spawnX, spawnY, doorId, baseId);
    const door = tiles.door;
    const base = tiles.base;
    if (door.ty >= 0 && door.ty < height && door.tx >= 0 && door.tx < width) {
      grid[door.ty][door.tx] = door.id;
    }
    if (base.ty >= 0 && base.ty < height && base.tx >= 0 && base.tx < width) {
      grid[base.ty][base.tx] = base.id;
    }
  },
  createWorld(worldId, width, height, hashFn, spawnX, spawnY, doorId, baseId) {
    const w = Array.from({ length: height }, () => Array(width).fill(0));
    const seedFn = typeof hashFn === "function" ? hashFn : this.hashWorldSeed.bind(this);
    const seed = seedFn(worldId);
    const baseGround = 17;

    const topSolidY = (grid, x) => {
      for (let y = 0; y < height; y++) {
        if (grid[y][x] !== 0) return y;
      }
      return height - 1;
    };
    const chance = (value) => {
      const n = Math.sin(value * 12.9898) * 43758.5453;
      return n - Math.floor(n);
    };

    for (let x = 0; x < width; x++) {
      const n1 = Math.sin((x + seed * 0.001) * 0.19) * 2;
      const n2 = Math.sin((x + seed * 0.003) * 0.06) * 3;
      const noise = Math.floor(n1 + n2);
      const groundY = baseGround + noise;

      for (let y = groundY; y < height; y++) {
        if (y === groundY) w[y][x] = 1;
        else if (y < groundY + 3) w[y][x] = 2;
        else w[y][x] = 3;
      }
    }

    for (let x = 10; x < width - 10; x += 7) {
      const gy = topSolidY(w, x);
      if (chance((x + seed) * 1.117) > 0.3 && gy > 3) {
        w[gy - 1][x] = 4;
      }
    }

    for (let x = 18; x < width - 12; x += 12) {
      const gy = topSolidY(w, x);
      if (chance((x + seed) * 2.41) > 0.5) {
        for (let dx = 0; dx < 3; dx++) {
          w[gy][x + dx] = 5;
        }
      }
    }

    // Absolute world bottom is always two bedrock layers.
    const bottomY = height - 1;
    const bottomY2 = height - 2;
    for (let x = 0; x < width; x++) {
      if (bottomY2 >= 0) w[bottomY2][x] = baseId;
      if (bottomY >= 0) w[bottomY][x] = baseId;
    }

    this.applySpawnStructureToGrid(w, width, height, spawnX, spawnY, doorId, baseId);
    return w;
  }
};
