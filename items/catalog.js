window.GTModules = window.GTModules || {};

window.GTModules.itemCatalog = (function createItemCatalogModule() {
  const BLOCK_ASSET_BASE = "./assets/blocks";
  const COSMETIC_ASSET_BASE = "./assets/cosmetics";
  const COSMETIC_SLOTS = ["shirts", "pants", "shoes", "hats", "wings", "swords"];

  // Single source of truth for gameplay item definitions.
  const DATA = {
    blocks: [
      { id: 0, key: "air", name: "Air", color: "transparent", solid: false, icon: "A", faIcon: "fa-regular fa-circle" },
      { id: 1, key: "grass_block", name: "Grass", color: "#4caf50", solid: true, durability: 1, icon: "GR", faIcon: "fa-solid fa-seedling", image: "terrain/grass.png" },
      { id: 2, key: "dirt_block", name: "Dirt", color: "#8b5a2b", solid: true, durability: 1, icon: "DI", faIcon: "fa-solid fa-mound", image: "terrain/dirt.png" },
      { id: 3, key: "stone_block", name: "Stone", color: "#818a93", solid: true, durability: 4, icon: "ST", faIcon: "fa-solid fa-cube", image: "terrain/stone.png" },
      { id: 4, key: "wood_block", name: "Wood", color: "#a87038", solid: true, durability: 2, icon: "WO", faIcon: "fa-solid fa-tree", image: "terrain/wood.png" },
      { id: 5, key: "sand_block", name: "Sand", color: "#dfc883", solid: true, durability: 1, icon: "SA", faIcon: "fa-regular fa-hourglass-half", image: "terrain/sand.png" },
      { id: 6, key: "brick_block", name: "Brick", color: "#bb5644", solid: true, durability: 5, icon: "BR", faIcon: "fa-solid fa-border-all", image: "terrain/brick.png" },
      { id: 7, key: "spawn_door", name: "Door", color: "#57c2ff", solid: false, unbreakable: true, icon: "DR", faIcon: "fa-solid fa-door-open", image: "special/spawndoor.png" },
      { id: 8, key: "bedrock", name: "Bedrock", color: "#4e5a68", solid: true, unbreakable: true, icon: "BD", faIcon: "fa-solid fa-mountain", image: "special/bedrock.png" },
      { id: 9, key: "world_lock", name: "World Lock", color: "#ffd166", solid: true, durability: 10, worldLock: true, lockValue: 1, lockAutoConvert: true, alwaysDrop: true, icon: "WL", faIcon: "fa-solid fa-lock", image: "special/world_lock.png" },
      { id: 10, key: "door_block", name: "Door Block", color: "#5fc2ff", solid: false, durability: 2, alwaysDrop: true, icon: "DB", faIcon: "fa-solid fa-door-open", image: "special/door.png" },
      { id: 11, key: "water_block", name: "Water", color: "rgba(72, 174, 255, 0.7)", solid: false, durability: 1, liquid: true, icon: "WA", faIcon: "fa-solid fa-water", image: "special/water.png" },
      { id: 12, key: "platform_block", name: "Platform", color: "#7a5a3f", solid: false, durability: 2, oneWay: true, icon: "PF", faIcon: "fa-solid fa-grip-lines", image: "special/platform.png" },
      { id: 13, key: "stair_block", name: "Stairs", color: "#b28457", solid: false, durability: 2, stair: true, rotatable: true, icon: "S1", faIcon: "fa-solid fa-stairs", image: "special/stairs.png" },
      { id: 14, key: "stair_block_r1", name: "Stair NE", color: "#b28457", solid: false, durability: 2, stair: true, rotatable: true, icon: "S2", faIcon: "fa-solid fa-stairs", image: "special/stair_block_r1.png" },
      { id: 15, key: "stair_block_r2", name: "Stair SE", color: "#b28457", solid: false, durability: 2, stair: true, rotatable: true, icon: "S3", faIcon: "fa-solid fa-stairs", image: "special/stair_block_r2.png" },
      { id: 16, key: "stair_block_r3", name: "Stair SW", color: "#b28457", solid: false, durability: 2, stair: true, rotatable: true, icon: "S4", faIcon: "fa-solid fa-stairs", image: "special/stair_block_r3.png" },
      { id: 17, key: "vending_machine", name: "Vending Machine", color: "#4d6b8b", solid: false, durability: 7, alwaysDrop: true, icon: "VM", faIcon: "fa-solid fa-store", image: "special/vending.png" },
      { id: 18, key: "sign_block", name: "Sign", color: "#b98a58", solid: false, durability: 2, alwaysDrop: true, icon: "SG", faIcon: "fa-solid fa-signs-post", image: "special/sign_block.png" },
      { id: 19, key: "anti_gravity_generator", name: "Anti Gravity Generator", color: "#6de9ff", solid: false, durability: 7, alwaysDrop: true, icon: "AG", faIcon: "fa-solid fa-meteor" },
      { id: 20, key: "camera_block", name: "Camera", color: "#8eb7d6", solid: true, durability: 6, alwaysDrop: true, icon: "CM", faIcon: "fa-solid fa-video", image: "special/camera.png" },
      { id: 21, key: "weather_machine", name: "Weather Machine", color: "#7aa8d9", solid: false, durability: 6, alwaysDrop: true, icon: "WM", faIcon: "fa-solid fa-cloud-sun-rain", image: "special/weather_machine.png" },
      { id: 22, key: "display_block", name: "Display Block", color: "#314154", solid: true, durability: 4, alwaysDrop: true, icon: "DP", faIcon: "fa-regular fa-square" },
      { id: 23, key: "wood_plank", name: "Wooden Plank", color: "#b4bcc5", solid: true, durability: 2, icon: "WP", faIcon: "fa-regular fa-square", image: "special/plank.png" },
      { id: 24, key: "obsidian_lock", name: "Obsidian Lock", color: "#5f4b7d", solid: true, durability: 14, worldLock: true, lockValue: 100, lockAutoConvert: true, alwaysDrop: true, icon: "OL", faIcon: "fa-solid fa-gem", image: "special/obsidian_lock.png" },
      { id: 51, key: "splicing_machine", name: "Splicing Machine", color: "#7a5b38", solid: true, durability: 8, alwaysDrop: true, icon: "SMX", faIcon: "fa-solid fa-microscope" },
      { id: 52, key: "owner_tax_block", name: "Owner Tax Block", color: "#cc8f2f", solid: true, durability: 7, alwaysDrop: true, icon: "TX", faIcon: "fa-solid fa-percent" },
      { id: 53, key: "quest_npc", name: "Quest Interaction Block", color: "#6b77c9", solid: false, unbreakable: true, durability: 3, obtainable: false, icon: "QN", faIcon: "fa-solid fa-scroll" },
      { id: 54, key: "mannequin_block", name: "Mannequin Block", color: "#8f7f71", solid: false, durability: 4, alwaysDrop: true, icon: "MN", faIcon: "fa-solid fa-user" },
      { id: 32, key: "gamble_machine", name: "Gambling Machine", color: "#7b5db7", solid: true, durability: 8, seedable: false, alwaysDrop: true, icon: "GM", faIcon: "fa-solid fa-dice", image: "special/roulette.png" },
      { id: 42, key: "emerald_lock", name: "Emerald Lock", color: "#3dbd70", solid: true, durability: 20, worldLock: true, lockValue: 10000, lockAutoConvert: true, alwaysDrop: true, icon: "EL", faIcon: "fa-solid fa-gem", image: "special/emerald_lock.png" },
      { id: 50, key: "ruby_lock", name: "Ruby Lock", color: "#e0115f", solid: true, durability: 25, worldLock: true, lockValue: 1000000, lockAutoConvert: true, alwaysDrop: true, icon: "RL", faIcon: "fa-solid fa-gem", image: "special/ruby_lock.png" },
      { id: 33, key: "spike_block", name: "Spikes NW", color: "#8d9aae", solid: false, durability: 2, lethal: true, rotatable: true, icon: "SP", faIcon: "fa-solid fa-triangle-exclamation", image: "special/spike.png" },
      { id: 37, key: "spike_block_r1", name: "Spikes NE", color: "#8d9aae", solid: false, durability: 2, lethal: true, rotatable: true, icon: "SP", faIcon: "fa-solid fa-triangle-exclamation", image: "special/spike.png" },
      { id: 38, key: "spike_block_r2", name: "Spikes SE", color: "#8d9aae", solid: false, durability: 2, lethal: true, rotatable: true, icon: "SP", faIcon: "fa-solid fa-triangle-exclamation", image: "special/spike.png" },
      { id: 39, key: "spike_block_r3", name: "Spikes SW", color: "#8d9aae", solid: false, durability: 2, lethal: true, rotatable: true, icon: "SP", faIcon: "fa-solid fa-triangle-exclamation", image: "special/spike.png" },
      { id: 40, key: "spawn_mover", name: "Spawn Mover", color: "#79c6ff", solid: false, durability: 4, seedable: false, icon: "SM", faIcon: "fa-solid fa-location-crosshairs", image: "special/spawn_mover.png" },
      { id: 41, key: "mystery_block", name: "Mystery Block", color: "#a46cff", solid: true, durability: 6, icon: "MB", faIcon: "fa-solid fa-dice", image: "special/mystery_block.png" },
      { id: 34, key: "donation_box", name: "Donation Box", color: "#8f6d4f", solid: true, durability: 7, donationBox: true, alwaysDrop: true, icon: "DN", faIcon: "fa-solid fa-box-open", image: "special/donation_block.png" },
      { id: 36, key: "storage_chest", name: "Storage Chest", color: "#7f5f3e", solid: true, durability: 7, chestStorage: true, alwaysDrop: true, icon: "CH", faIcon: "fa-solid fa-box-archive", image: "special/chest.png" },
      { id: 35, key: "leaf_block", name: "Leaf Block", color: "#467f3e", solid: true, durability: 1, icon: "CH", faIcon: "fa-solid fa-box-archive", image: "special/leaf.png" }
    ],
    titles: [
      { id: "newcomer", name: "Newcomer", color: "#8fb4ff", defaultUnlocked: true },
      { id: "builder", name: "Builder", color: "#63d39b" },
      { id: "trader", name: "Trader", color: "#ffd166" },
      { id: "guardian", name: "Guardian", color: "#f28482" },
      { id: "legend", name: "Legend", color: "#c084fc", style: { bold: true, glow: true, glowColor: "#c084fc" } },
      { id: "secret", name: "MAID", color: "#700d9e", style: { rainbow: true, bold: true, glow: true } },
      { id: "aurora", name: "Aurora", color: "#6cf9e0", style: { gradient: true, gradientShift: true, gradientColors: ["#6cf9e0", "#70a8ff", "#c084fc"], gradientAngle: 92 } },
      { id: "nova", name: "Nova", color: "#ffd166", style: { gradient: true, glow: true, glowColor: "#ffd166", gradientShift: true, gradientColors: ["#ffd166", "#ff7a7a", "#c084fc"], gradientAngle: 24, bold: true } },
      { id: "prism", name: "Prism", color: "#ff6fd8", style: { rainbow: true, glow: true, glowColor: "#ff6fd8", bold: true } },
      { id: "novice", name: "Novice", color: "#84f4fc" },
      { id: "big", name: "BIG", color: "#ff6e6e", style: { bold: true } },
      { id: "legendary", name: "{username} of Legend", color: "#ffee57", style: { glow: true, glowColor: "#ffaf03" } },
      { id: "is_hero", name: "{username} is Hero", color: "#7b57ff", style: { rainbow: true, bold: true, glow: true, glowColor: "#5b03ff" } }
    ],
    cosmetics: {
      shirts: [
        { id: "cloth_tunic", name: "Cloth Tunic", color: "#f2b880", icon: "TU", faIcon: "fa-solid fa-shirt", rarity: "common", image: "clothes/cloth_tunic.png" },
        { id: "hoodie_blue", name: "Blue Hoodie", color: "#5f8cff", icon: "HD", faIcon: "fa-solid fa-shirt", rarity: "rare", image: "clothes/hoodie_blue.png" },
        { id: "armor_iron", name: "Iron Armor", color: "#a9b5c2", icon: "AR", faIcon: "fa-solid fa-shield-halved", rarity: "epic", image: "clothes/armor_iron.png" },
        { id: "oop_shirt", name: "OOP Shirt", color: "#ffffff", icon: "OOP", faIcon: "fa-solid fa-shield-halved", rarity: "rare", image: "clothes/oop_shirt.png" },
        { id: "oop_shirt_red", name: "Red OOP Shirt", color: "#ffffff", icon: "ROOP", faIcon: "fa-solid fa-shield-halved", rarity: "epic", image: "clothes/oop_shirt_red.png" },
        { id: "sun_shirt", name: "Sun Shirt", color: "#ffffff", icon: "SS", faIcon: "fa-solid fa-shield-halved", rarity: "epic", image: "clothes/sun_shirt.png" },
        { id: "red_outline_shirt", name: "Red Outline Shirt", color: "#ffffff", icon: "ROS", faIcon: "fa-solid fa-shield-halved", rarity: "epic", image: "clothes/red_outline_shirt.png" }
      ],
      pants: [
        { id: "cloth_pants", name: "Cloth Pants", color: "#7e92a3", icon: "PT", faIcon: "fa-solid fa-user", rarity: "common", image: "pants/cloth_pants.png" },
        { id: "test", name: "test Pants", color: "#7e92a3", icon: "PT", faIcon: "fa-solid fa-user", rarity: "common", image: "pants/test.png" },
        { id: "red_outline_pants", name: "Red Outline Pants", color: "#7e92a3", icon: "ROP", faIcon: "fa-solid fa-user", rarity: "common", image: "pants/red_outline_pants.png" }
      ],
      shoes: [
        { id: "cloth_slippers", name: "Cloth Slippers", color: "#b48a6b", icon: "SH", faIcon: "fa-solid fa-shoe-prints", rarity: "common", speedBoost: 0.04, jumpBoost: 0.03, image: "shoes/cloth_slippers.png" },
        { id: "swift_sneakers", name: "Swift Sneakers", color: "#86d8ff", icon: "SS", faIcon: "fa-solid fa-shoe-prints", rarity: "rare", speedBoost: 0.12, jumpBoost: 0.05, image: "shoes/swift_sneakers.png" },
        { id: "jump_boots", name: "Jump Boots", color: "#ffe08a", icon: "JB", faIcon: "fa-solid fa-shoe-prints", rarity: "epic", speedBoost: 0.05, jumpBoost: 0.16, image: "shoes/jump_boots.png" }
      ],
      hats: [
        { id: "duck", name: "Duck", color: "#d3a947", icon: "DT", faIcon: "fa-solid fa-hat-cowboy-side", rarity: "common", image: "hats/duck.png" },
        { id: "basic_cap", name: "Basic Cap", color: "#d7c7a3", icon: "HT", faIcon: "fa-solid fa-hat-cowboy-side", rarity: "common", image: "hats/la.png" },
        { id: "silinter", name: "Silinter", color: "#d7c7a3", icon: "HT", faIcon: "fa-solid fa-hat-cowboy-side", rarity: "common", image: "hats/silinter.png" },
        { id: "chinese", name: "Chinese", color: "#0e0d0c", icon: "CH", faIcon: "fa-solid fa-hat-cowboy-side", rarity: "rare", image: "hats/chinese.png" },
        { id: "flatcap", name: "Flatcap", color: "#0e0d0c", icon: "FC", faIcon: "fa-solid fa-hat-cowboy-side", rarity: "rare", image: "hats/flatcap.png" },
        { id: "red_outline_flatcap", name: "Red Outline Flatcap", color: "#0e0d0c", icon: "FC", faIcon: "fa-solid fa-hat-cowboy-side", rarity: "rare", image: "hats/red_outline_flatcap.png" }
      ],
      wings: [
        { id: "angel_white", name: "Angel Wings", color: "#ecf3ff", icon: "AW", faIcon: "fa-solid fa-dove", rarity: "rare", doubleJump: true, image: "wings/angel_white.png", offsetX: 3, offsetY: 0 },
        { id: "bat_dark", name: "Bat Wings", color: "#48505f", icon: "BW", faIcon: "fa-solid fa-feather-pointed", rarity: "rare", doubleJump: true, image: "wings/bat_dark.png", offsetX: 3, offsetY: 0 },
        { id: "leaf_green", name: "Leaf Wings", color: "#5ebd79", icon: "LW", faIcon: "fa-solid fa-leaf", rarity: "rare", doubleJump: true, image: "wings/leaf_green.png", offsetX: 3, offsetY: 0 },
        { id: "black_outline_wings", name: "Black Outline Wings", color: "#ffffff", icon: "BOW", faIcon: "fa-solid fa-leaf", rarity: "epic", doubleJump: true, image: "wings/black_outline_wings.png", offsetX: 2, offsetY: -3 },
        { id: "golden_evil_wings", name: "Golden Evil Wings", color: "#ffffff", icon: "GEW", faIcon: "fa-solid fa-leaf", rarity: "epic", doubleJump: true, image: "wings/golden_evil.png", offsetX: 5, offsetY: 0 },
        { id: "pink_baby_angels", name: "Pink Baby Angel Wings", color: "#ffffff", icon: "PBAW", faIcon: "fa-solid fa-leaf", rarity: "epic", doubleJump: true, image: "wings/pink_baby_angels.png", offsetX: 5, offsetY: 0 },
        { id: "admin_wings", name: "Admin Wings", color: "#ffffff", icon: "AW", faIcon: "fa-solid fa-leaf", rarity: "mythic", doubleJump: true, image: "wings/admin_wings.png", offsetX: 4, offsetY: -2 },
        { id: "golden_angel_wings", name: "Golden Angel Wings", color: "#e7b852", icon: "GAW", faIcon: "fa-solid fa-leaf", rarity: "legendary", doubleJump: true, image: "wings/golden_angel.png", offsetX: 4, offsetY: -3 },
        { id: "void_wings", name: "Void Wings", color: "#0c0c0c", icon: "VW", faIcon: "fa-solid fa-leaf", rarity: "mythic", doubleJump: true, image: "wings/void_wings.png", offsetX: 3, offsetY: -2 },
        { id: "legend_wings", name: "Legend Wings", color: "#ebf380", icon: "LW", faIcon: "fa-solid fa-leaf", rarity: "legendary", doubleJump: true, image: "wings/legend_wings.png", offsetX: 2, offsetY: -2 }
      ],
      swords: [
        { id: "wood_blade", name: "Wood Blade", color: "#9a6a3f", icon: "WB", faIcon: "fa-solid fa-sword", rarity: "common", image: "swords/wood_blade.png", breakMultiplier: 1.05 },
        { id: "iron_sword", name: "Iron Sword", color: "#c7d2dc", icon: "IS", faIcon: "fa-solid fa-sword", rarity: "rare", image: "swords/iron_sword.png", breakMultiplier: 1.2 },
        { id: "flame_saber", name: "Flame Saber", color: "#ff7e57", icon: "FS", faIcon: "fa-solid fa-wand-sparkles", rarity: "epic", image: "swords/flame_saber.png", breakMultiplier: 1.35 },
        { id: "blue_dagger", name: "Blue Dagger", color: "#ffffff", icon: "BD", faIcon: "fa-solid fa-wand-sparkles", rarity: "epic", image: "swords/dagger.png", breakMultiplier: 1.15 },
        { id: "admin_pickaxe", name: "Admin Pickaxe", color: "#9be7ff", icon: "AP", faIcon: "fa-solid fa-hammer", rarity: "mythic", image: "swords/admin_pickaxe.png", breakMultiplier: 999, instantBreak: true },
        { id: "red_outline_pickaxe", name: "Red Outline Pickaxe", color: "#ffffff", icon: "BD", faIcon: "fa-solid fa-wand-sparkles", rarity: "legendary", image: "swords/red_outline_pickaxe.png", breakMultiplier: 1.45 }
      ]
    }
  };

  function isPlainObject(value) {
    if (!value || typeof value !== "object") return false;
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function deepClone(value) {
    if (Array.isArray(value)) {
      const out = [];
      for (let i = 0; i < value.length; i++) out.push(deepClone(value[i]));
      return out;
    }
    if (isPlainObject(value)) {
      const out = {};
      const keys = Object.keys(value);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        out[key] = deepClone(value[key]);
      }
      return out;
    }
    return value;
  }

  function getBlocks() {
    return deepClone(DATA.blocks);
  }

  function getTitles() {
    return deepClone(DATA.titles);
  }

  function getCosmeticSlots() {
    return COSMETIC_SLOTS.slice();
  }

  function getCosmeticSlot(slot) {
    const safeSlot = String(slot || "").trim();
    const src = DATA.cosmetics[safeSlot];
    return Array.isArray(src) ? deepClone(src) : [];
  }

  function getCosmeticsBySlot() {
    const out = {};
    for (let i = 0; i < COSMETIC_SLOTS.length; i++) {
      const slot = COSMETIC_SLOTS[i];
      out[slot] = getCosmeticSlot(slot);
    }
    return out;
  }

  function getCosmeticsFlat() {
    const bySlot = getCosmeticsBySlot();
    const out = [];
    for (let i = 0; i < COSMETIC_SLOTS.length; i++) {
      const slot = COSMETIC_SLOTS[i];
      const rows = Array.isArray(bySlot[slot]) ? bySlot[slot] : [];
      for (let j = 0; j < rows.length; j++) out.push(rows[j]);
    }
    return out;
  }

  function getAll() {
    return {
      blockAssetBasePath: BLOCK_ASSET_BASE,
      cosmeticAssetBasePath: COSMETIC_ASSET_BASE,
      blocks: getBlocks(),
      titles: getTitles(),
      cosmetics: getCosmeticsBySlot()
    };
  }

  function publishLegacyGlobals() {
    const bySlot = getCosmeticsBySlot();
    window.GTCosmeticCatalog = window.GTCosmeticCatalog || {};
    for (let i = 0; i < COSMETIC_SLOTS.length; i++) {
      const slot = COSMETIC_SLOTS[i];
      window.GTCosmeticCatalog[slot] = Array.isArray(bySlot[slot]) ? bySlot[slot] : [];
    }
    window.GTItemCatalog = getAll();
  }

  publishLegacyGlobals();

  return {
    getBlockAssetBasePath() {
      return BLOCK_ASSET_BASE;
    },
    getCosmeticAssetBasePath() {
      return COSMETIC_ASSET_BASE;
    },
    getBlocks,
    getTitles,
    getCosmeticSlots,
    getCosmeticSlot,
    getCosmeticsBySlot,
    getCosmeticsFlat,
    getAll,
    refreshLegacyGlobals: publishLegacyGlobals
  };
})();
