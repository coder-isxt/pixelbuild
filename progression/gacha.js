window.GTModules = window.GTModules || {};

window.GTModules.gacha = (function createGachaModule() {
  // Add/modify gacha blocks and outcomes here.
  // `weight` controls probability relative to siblings.
  // `amount` can be a number or [min,max].
  const GACHA_BLOCKS = [
    {
      key: "mystery_block",
      name: "Mystery Block",
      rolls: 1,
      outcomes: [
        { id: "trash_dirt", weight: 30, kind: "block", blockKey: "dirt_block", amount: [1, 3], rarity: "trash", text: "Trash drop: Dirt." },
        { id: "trash_sand", weight: 20, kind: "block", blockKey: "sand_block", amount: [1, 3], rarity: "trash", text: "Trash drop: Sand." },
        { id: "trash_stone", weight: 14, kind: "block", blockKey: "stone_block", amount: [1, 2], rarity: "trash", text: "Trash drop: Stone." },
        { id: "common_gems", weight: 18, kind: "gems", amount: [8, 35], rarity: "common", text: "You got some gems." },
        { id: "sparkle_only", weight: 8, kind: "effect", effect: "sparkle", rarity: "common", text: "Mystery energy sparkles." },
        { id: "rare_world_lock", weight: 5, kind: "block", blockKey: "world_lock", amount: 1, rarity: "rare", text: "Rare drop: World Lock!" },
        { id: "rare_wing", weight: 4, kind: "cosmetic", cosmeticId: "angel_white", amount: 1, rarity: "rare", text: "Rare drop: Angel Wings!" },
        { id: "ultra_title", weight: 1, kind: "title", titleId: "legend", amount: 1, rarity: "legendary", text: "Legendary drop: Legend title!" },
        { id: "jackpot_gems", weight: 1, kind: "gems", amount: [120, 420], rarity: "epic", text: "Jackpot gems!" }
      ]
    }
  ];

  function toInt(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeAmount(amount, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    if (Array.isArray(amount) && amount.length >= 2) {
      const min = Math.max(0, toInt(amount[0], 0));
      const max = Math.max(min, toInt(amount[1], min));
      return min + Math.floor(random() * (max - min + 1));
    }
    return Math.max(0, toInt(amount, 0));
  }

  function pickWeighted(outcomes, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    const list = Array.isArray(outcomes) ? outcomes : [];
    let total = 0;
    for (let i = 0; i < list.length; i++) {
      total += Math.max(0, Number(list[i] && list[i].weight) || 0);
    }
    if (total <= 0) return null;
    let hit = random() * total;
    for (let i = 0; i < list.length; i++) {
      const row = list[i] || {};
      const w = Math.max(0, Number(row.weight) || 0);
      if (w <= 0) continue;
      hit -= w;
      if (hit <= 0) return row;
    }
    return list[list.length - 1] || null;
  }

  function createController(options) {
    const opts = options || {};
    const getBlockIdByKey = typeof opts.getBlockIdByKey === "function"
      ? opts.getBlockIdByKey
      : () => 0;
    const random = typeof opts.random === "function" ? opts.random : Math.random;
    const byBlockId = {};

    for (let i = 0; i < GACHA_BLOCKS.length; i++) {
      const row = GACHA_BLOCKS[i] || {};
      const blockKey = String(row.key || "").trim().toLowerCase();
      if (!blockKey) continue;
      const blockId = Math.floor(Number(getBlockIdByKey(blockKey)) || 0);
      if (!blockId) continue;
      byBlockId[blockId] = {
        key: blockKey,
        name: String(row.name || blockKey),
        rolls: Math.max(1, toInt(row.rolls, 1)),
        outcomes: Array.isArray(row.outcomes) ? row.outcomes.slice() : []
      };
    }

    function getConfigForBlockId(blockId) {
      const id = Math.floor(Number(blockId) || 0);
      return id > 0 ? (byBlockId[id] || null) : null;
    }

    function isGachaBlockId(blockId) {
      return Boolean(getConfigForBlockId(blockId));
    }

    function roll(blockId) {
      const config = getConfigForBlockId(blockId);
      if (!config) return null;
      const resolved = [];
      const rollCount = Math.max(1, toInt(config.rolls, 1));
      for (let i = 0; i < rollCount; i++) {
        const selected = pickWeighted(config.outcomes, random);
        if (!selected) continue;
        const amount = normalizeAmount(selected.amount, random);
        resolved.push({
          id: String(selected.id || ""),
          kind: String(selected.kind || ""),
          rarity: String(selected.rarity || "common"),
          blockKey: String(selected.blockKey || ""),
          cosmeticId: String(selected.cosmeticId || ""),
          titleId: String(selected.titleId || ""),
          effect: String(selected.effect || ""),
          text: String(selected.text || "").slice(0, 120),
          amount
        });
      }
      return {
        blockId: Math.floor(Number(blockId) || 0),
        blockName: config.name,
        rolls: resolved
      };
    }

    return {
      isGachaBlockId,
      getConfigForBlockId,
      roll
    };
  }

  return {
    getCatalog() {
      return GACHA_BLOCKS.map((row) => ({ ...row, outcomes: Array.isArray(row.outcomes) ? row.outcomes.slice() : [] }));
    },
    createController
  };
})();
