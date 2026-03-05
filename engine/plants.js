window.GTModules = window.GTModules || {};

window.GTModules.plants = (function () {
  function createController(opts) {
    const o = opts || {};
    const plantsByTile = new Map();
    const g = (k, d) => {
      const v = o[k];
      if (typeof v === "function") {
        try {
          const r = v();
          return r === undefined ? d : r;
        } catch (e) {
          return d;
        }
      }
      return v === undefined ? d : v;
    };
    const tileKey = (tx, ty) => String(tx) + "_" + String(ty);
    const treeGrowMsDefault = Math.max(5000, Number(g("getTreeGrowMs", 120000)) || 120000);
    const treeYieldBlockIdDefault = Math.max(1, Math.floor(Number(g("getTreeYieldBlockId", 4)) || 4));
    const treeStageCount = Math.max(2, Math.floor(Number(g("getTreeStageCount", 4)) || 4));

    function normalize(value) {
      if (!value || typeof value !== "object") return null;
      const growMs = Math.max(5000, Math.floor(Number(value.growMs) || treeGrowMsDefault));
      const plantedAt = Math.max(0, Math.floor(Number(value.plantedAt) || 0));
      const yieldBlockId = Math.floor(Number(value.yieldBlockId) || treeYieldBlockIdDefault);
      const fruitAmountRaw = Math.floor(Number(value.fruitAmount) || 0);
      if (!plantedAt) return null;
      return {
        type: "tree",
        plantedAt,
        growMs,
        yieldBlockId: yieldBlockId > 0 ? yieldBlockId : treeYieldBlockIdDefault,
        fruitAmount: fruitAmountRaw > 0 ? Math.max(1, Math.min(5, fruitAmountRaw)) : 0
      };
    }

    function getDeterministicFruitAmount(rec) {
      const plantedAt = Math.max(1, Math.floor(Number(rec && rec.plantedAt) || 1));
      const yieldId = Math.max(1, Math.floor(Number(rec && rec.yieldBlockId) || treeYieldBlockIdDefault));
      const seed = ((plantedAt ^ (yieldId * 2654435761)) >>> 0);
      return 1 + (seed % 5);
    }

    function getFruitAmount(plant) {
      const rec = normalize(plant);
      if (!rec) return 1;
      const fromRecord = Math.max(0, Math.floor(Number(rec.fruitAmount) || 0));
      if (fromRecord > 0) return Math.max(1, Math.min(5, fromRecord));
      return getDeterministicFruitAmount(rec);
    }

    function setLocal(tx, ty, value) {
      const key = tileKey(tx, ty);
      const normalized = normalize(value);
      if (!normalized) {
        plantsByTile.delete(key);
        return;
      }
      plantsByTile.set(key, normalized);
    }

    function getLocal(tx, ty) {
      return plantsByTile.get(tileKey(tx, ty)) || null;
    }

    function save(tx, ty, value) {
      const key = tileKey(tx, ty);
      const normalized = normalize(value);
      const network = g("getNetwork", null);
      const plantsRef = network && network.plantsRef ? network.plantsRef : null;
      if (!normalized) {
        plantsByTile.delete(key);
        if (plantsRef) {
          plantsRef.child(key).remove().catch(() => {});
        }
        return;
      }
      plantsByTile.set(key, normalized);
      if (plantsRef) {
        plantsRef.child(key).set(normalized).catch(() => {});
      }
    }

    function clear() {
      plantsByTile.clear();
    }

    function getGrowthState(plant) {
      const rec = normalize(plant);
      if (!rec) return { stage: 0, mature: false, progress: 0 };
      const growMs = Math.max(1, Number(rec.growMs) || treeGrowMsDefault);
      const elapsed = Math.max(0, Date.now() - rec.plantedAt);
      const progress = Math.max(0, Math.min(1, elapsed / growMs));
      const mature = progress >= 0.999;
      const stage = mature
        ? (treeStageCount - 1)
        : Math.max(0, Math.min(treeStageCount - 2, Math.floor(progress * (treeStageCount - 1))));
      return { stage, mature, progress };
    }

    function createSeedPlant(nowMs, opts) {
      const config = opts && typeof opts === "object" ? opts : {};
      const plantedAt = Math.max(0, Math.floor(Number(nowMs) || Date.now()));
      const growMs = Math.max(5000, Math.floor(Number(config.growMs) || treeGrowMsDefault));
      const yieldBlockId = Math.max(1, Math.floor(Number(config.yieldBlockId) || treeYieldBlockIdDefault));
      const randomFn = typeof config.randomFn === "function" ? config.randomFn : Math.random;
      const raw = Number(randomFn());
      const r = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999, raw)) : 0;
      const fruitAmount = 1 + Math.floor(r * 5);
      return {
        type: "tree",
        plantedAt,
        growMs,
        yieldBlockId,
        fruitAmount
      };
    }

    function getHarvestReward(plant, randomFn) {
      const rec = normalize(plant);
      if (!rec) return null;
      const growth = getGrowthState(rec);
      if (!growth.mature) return null;
      return {
        blockId: Math.max(1, Math.floor(Number(rec.yieldBlockId) || treeYieldBlockIdDefault)),
        amount: Math.max(1, Math.min(5, getFruitAmount(rec)))
      };
    }

    function hashColorSeed(seed) {
      let h = Math.max(1, Math.floor(Number(seed) || 1)) >>> 0;
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      return h >>> 0;
    }

    function hsl(h, s, l) {
      return "hsl(" + Math.floor(h) + "," + Math.floor(s) + "%," + Math.floor(l) + "%)";
    }

    function getTreeStyle(plant) {
      const rec = normalize(plant) || {};
      const yieldId = Math.max(1, Math.floor(Number(rec.yieldBlockId) || treeYieldBlockIdDefault));
      const defs = g("getBlockDefs", null);
      const def = defs && typeof defs === "object" ? defs[yieldId] : null;
      const seed = hashColorSeed(yieldId);
      const hueBase = seed % 360;
      const variant = seed % 5;
      const trunkHue = (20 + (seed % 24)) % 360;
      const trunk = hsl(trunkHue, 42, 30);
      const leaf = hsl((hueBase + 86) % 360, 52, 46);
      const leafAlt = hsl((hueBase + 102) % 360, 48, 56);
      const fruit = hsl((hueBase + 18) % 360, 72, 56);
      const blockColor = String((def && def.color) || "").trim();
      return {
        variant,
        trunk,
        leaf,
        leafAlt,
        fruit,
        blockColor: blockColor && blockColor !== "transparent" ? blockColor : ""
      };
    }

    function drawTree(ctx, tx, ty, x, y, tileSize) {
      if (!ctx) return;
      const plant = getLocal(tx, ty);
      const growth = getGrowthState(plant);
      const stage = growth.stage;
      const TILE = Number(tileSize) || 32;
      const style = getTreeStyle(plant);
      ctx.save();
      if (stage <= 0) {
        ctx.fillStyle = style.trunk;
        ctx.fillRect(x + TILE / 2 - 2, y + TILE - 7, 4, 4);
        ctx.fillStyle = style.leaf;
        ctx.fillRect(x + TILE / 2 - 2, y + TILE - 10, 4, 3);
      } else if (stage === 1) {
        ctx.fillStyle = style.trunk;
        ctx.fillRect(x + TILE / 2 - 2, y + TILE - 12, 4, 9);
        ctx.fillStyle = style.leaf;
        if (style.variant % 2 === 0) {
          ctx.fillRect(x + TILE / 2 - 5, y + TILE - 17, 10, 6);
        } else {
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE - 14, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (stage === 2) {
        ctx.fillStyle = style.trunk;
        ctx.fillRect(x + TILE / 2 - 3, y + TILE - 19, 6, 16);
        ctx.fillStyle = style.leaf;
        if (style.variant === 2) {
          ctx.fillRect(x + TILE / 2 - 10, y + TILE - 31, 20, 10);
          ctx.fillStyle = style.leafAlt;
          ctx.fillRect(x + TILE / 2 - 7, y + TILE - 24, 14, 7);
        } else {
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE - 21, 10, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = style.trunk;
        ctx.fillRect(x + TILE / 2 - 3, y + TILE - 24, 6, 21);
        ctx.fillStyle = style.leaf;
        if (style.variant === 0) {
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE - 30, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = style.leafAlt;
          ctx.beginPath();
          ctx.arc(x + TILE / 2 - 4, y + TILE - 34, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (style.variant === 1) {
          ctx.fillRect(x + TILE / 2 - 13, y + TILE - 38, 26, 10);
          ctx.fillStyle = style.leafAlt;
          ctx.fillRect(x + TILE / 2 - 10, y + TILE - 29, 20, 8);
        } else if (style.variant === 2) {
          ctx.beginPath();
          ctx.moveTo(x + TILE / 2, y + TILE - 40);
          ctx.lineTo(x + TILE / 2 - 13, y + TILE - 20);
          ctx.lineTo(x + TILE / 2 + 13, y + TILE - 20);
          ctx.closePath();
          ctx.fill();
        } else if (style.variant === 3) {
          ctx.beginPath();
          ctx.arc(x + TILE / 2 - 6, y + TILE - 30, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + TILE / 2 + 6, y + TILE - 30, 10, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(x + TILE / 2 - 8, y + TILE - 38, 16, 18);
          ctx.fillStyle = style.leafAlt;
          ctx.fillRect(x + TILE / 2 - 12, y + TILE - 30, 24, 10);
        }
        ctx.fillStyle = style.blockColor || style.fruit;
        ctx.fillRect(x + TILE / 2 - 2, y + TILE - 29, 4, 4);
      }
      ctx.restore();
    }

    return {
      normalize,
      setLocal,
      getLocal,
      save,
      clear,
      getGrowthState,
      createSeedPlant,
      getFruitAmount,
      getHarvestReward,
      drawTree
    };
  }

  return { createController };
})();
