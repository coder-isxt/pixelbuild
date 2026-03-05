window.GTModules = window.GTModules || {};

window.GTModules.cosmetics = (function createCosmeticsModule() {
  const DEFAULT_SLOTS = ["shirts", "pants", "shoes", "hats", "wings", "swords"];
  const DEFAULT_RENDER_SETTINGS = {
    shirts: { x: 4, y: 12, w: 14, h: 10, mode: "contain", alignX: 0.5, alignY: 0.5, mirror: false },
    pants: { x: 5, y: 21, w: 12, h: 8, mode: "contain", alignX: 0.5, alignY: 0.5, mirror: false },
    shoes: { y: 26, w: 6, h: 4, leftX: 5, rightX: 13, mode: "contain", alignX: 0.5, alignY: 1, mirror: true },
    hats: { x: 1, y: -8, w: 20, h: 10, mode: "contain", alignX: 0.5, alignY: 1, mirror: true },
    // Golden Angel Wings defaults used as baseline for all wings.
    wings: { offsetX: 4, offsetY: -3, wingH: 19, mode: "contain", alignX: 0.5, alignY: 0.5, mirror: true },
    swords: { mode: "contain", alignX: 0.5, alignY: 0.5, mirror: true }
  };

  function normalizeNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function normalizeRender(slot, item) {
    const src = item && typeof item === "object" ? item : {};
    const base = DEFAULT_RENDER_SETTINGS[slot] && typeof DEFAULT_RENDER_SETTINGS[slot] === "object"
      ? DEFAULT_RENDER_SETTINGS[slot]
      : {};
    const provided = src.render && typeof src.render === "object" ? src.render : {};
    const merged = {
      ...base,
      ...provided
    };
    // Backward compatibility for older wing offsets.
    if (slot === "wings") {
      if (Number.isFinite(Number(src.offsetX))) merged.offsetX = Number(src.offsetX);
      if (Number.isFinite(Number(src.offsetY))) merged.offsetY = Number(src.offsetY);
    }
    return {
      x: normalizeNumber(merged.x, normalizeNumber(base.x, 0, -64, 64), -64, 64),
      y: normalizeNumber(merged.y, normalizeNumber(base.y, 0, -64, 64), -64, 64),
      w: normalizeNumber(merged.w, normalizeNumber(base.w, 0, 0, 128), 0, 128),
      h: normalizeNumber(merged.h, normalizeNumber(base.h, 0, 0, 128), 0, 128),
      leftX: normalizeNumber(merged.leftX, normalizeNumber(base.leftX, 0, -64, 64), -64, 64),
      rightX: normalizeNumber(merged.rightX, normalizeNumber(base.rightX, 0, -64, 64), -64, 64),
      offsetX: normalizeNumber(merged.offsetX, normalizeNumber(base.offsetX, 0, -64, 64), -64, 64),
      offsetY: normalizeNumber(merged.offsetY, normalizeNumber(base.offsetY, 0, -64, 64), -64, 64),
      wingH: normalizeNumber(merged.wingH, normalizeNumber(base.wingH, 19, 2, 128), 2, 128),
      mode: String(merged.mode || base.mode || "contain") === "fill" ? "fill" : "contain",
      alignX: normalizeNumber(merged.alignX, normalizeNumber(base.alignX, 0.5, 0, 1), 0, 1),
      alignY: normalizeNumber(merged.alignY, normalizeNumber(base.alignY, 0.5, 0, 1), 0, 1),
      mirror: merged.mirror !== false
    };
  }

  function normalizeStats(slot, item) {
    const src = item && typeof item === "object" ? item : {};
    const stats = src.stats && typeof src.stats === "object" ? src.stats : {};
    const speedBoost = normalizeNumber(
      Number.isFinite(Number(stats.speedBoost)) ? stats.speedBoost : src.speedBoost,
      0,
      -0.3,
      1.5
    );
    const jumpBoost = normalizeNumber(
      Number.isFinite(Number(stats.jumpBoost)) ? stats.jumpBoost : src.jumpBoost,
      0,
      -0.25,
      1
    );
    const breakMultiplier = normalizeNumber(
      Number.isFinite(Number(stats.breakMultiplier)) ? stats.breakMultiplier : src.breakMultiplier,
      1,
      1,
      999
    );
    const instantBreak = Boolean(
      (Object.prototype.hasOwnProperty.call(stats, "instantBreak") ? stats.instantBreak : src.instantBreak)
    );
    const doubleJump = slot === "wings"
      ? true
      : Boolean(Object.prototype.hasOwnProperty.call(stats, "doubleJump") ? stats.doubleJump : src.doubleJump);
    return {
      speedBoost,
      jumpBoost,
      breakMultiplier,
      instantBreak,
      doubleJump
    };
  }

  function resolveImagePath(basePath, imagePath) {
    const raw = String(imagePath || "").trim();
    if (!raw) return "";
    if (/^(https?:)?\/\//.test(raw) || raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) {
      return raw;
    }
    const base = String(basePath || "./assets/cosmetics").replace(/\/+$/, "");
    return base + "/" + raw.replace(/^\/+/, "");
  }

  function buildCatalog(itemsModule) {
    const mod = itemsModule || {};
    const catalog = typeof mod.getCosmeticItemsBySlot === "function"
      ? mod.getCosmeticItemsBySlot()
      : { shirts: [], pants: [], shoes: [], hats: [], wings: [], swords: [] };
    const assetBase = typeof mod.getCosmeticAssetBasePath === "function"
      ? (mod.getCosmeticAssetBasePath() || "./assets/cosmetics")
      : "./assets/cosmetics";
    const slots = DEFAULT_SLOTS.slice();
    const lookup = {};
    const items = [];
    const itemById = {};

    for (const slot of slots) {
      const map = {};
      const slotItems = Array.isArray(catalog[slot]) ? catalog[slot] : [];
      for (const item of slotItems) {
        const stats = normalizeStats(slot, item);
        const render = normalizeRender(slot, item);
        const fx = (item && typeof item.fx === "object") ? { ...item.fx } : {};
        const normalized = {
          slot,
          ...(item && typeof item === "object" ? item : {}),
          imagePath: resolveImagePath(assetBase, item && item.image),
          stats,
          render,
          fx,
          // Backward-compatible flattened fields used by existing gameplay code.
          speedBoost: stats.speedBoost,
          jumpBoost: stats.jumpBoost,
          breakMultiplier: stats.breakMultiplier,
          instantBreak: stats.instantBreak,
          doubleJump: stats.doubleJump
        };
        const id = String(normalized.id || "");
        if (!id) continue;
        map[id] = normalized;
        items.push(normalized);
        itemById[id] = normalized;
      }
      lookup[slot] = map;
    }

    return { slots, catalog, assetBase, lookup, items, itemById };
  }

  function createInventoryState(items, slots) {
    const outItems = {};
    const list = Array.isArray(items) ? items : [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || !item.id) continue;
      outItems[item.id] = 0;
    }
    const outEquipped = {};
    const safeSlots = Array.isArray(slots) ? slots : DEFAULT_SLOTS;
    for (let i = 0; i < safeSlots.length; i++) {
      outEquipped[safeSlots[i]] = "";
    }
    return {
      cosmeticInventory: outItems,
      equippedCosmetics: outEquipped
    };
  }

  function clampInventory(cosmeticInventory, items, clampCountFn) {
    const inv = cosmeticInventory && typeof cosmeticInventory === "object" ? cosmeticInventory : {};
    const list = Array.isArray(items) ? items : [];
    const clamp = typeof clampCountFn === "function" ? clampCountFn : ((v) => Math.max(0, Math.floor(Number(v) || 0)));
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || !item.id) continue;
      inv[item.id] = clamp(inv[item.id]);
    }
  }

  function applyFromRecord(args) {
    const cfg = args || {};
    const record = cfg.record || {};
    const cosmeticInventory = cfg.cosmeticInventory || {};
    const equippedCosmetics = cfg.equippedCosmetics || {};
    const items = Array.isArray(cfg.items) ? cfg.items : [];
    const lookup = cfg.lookup && typeof cfg.lookup === "object" ? cfg.lookup : {};
    const slots = Array.isArray(cfg.slots) ? cfg.slots : DEFAULT_SLOTS;
    const clamp = typeof cfg.clampCount === "function" ? cfg.clampCount : ((v) => Math.max(0, Math.floor(Number(v) || 0)));

    const itemRecord = record && record.cosmeticItems || {};
    const legacyOwned = record && record.owned || {};
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || !item.id) continue;
      const nestedValue = Number(itemRecord[item.id]);
      const topLevelValue = Number(record && record[item.id]);
      const legacyHasOwned = Array.isArray(legacyOwned[item.slot]) && legacyOwned[item.slot].includes(item.id);
      let finalValue = 0;
      if (Number.isFinite(nestedValue)) finalValue = clamp(nestedValue);
      if (!finalValue && Number.isFinite(topLevelValue)) finalValue = clamp(topLevelValue);
      if (!finalValue && legacyHasOwned) finalValue = 1;
      cosmeticInventory[item.id] = clamp(finalValue);
    }

    const equippedRecord = record && record.equippedCosmetics || record && record.equipped || {};
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const id = String(equippedRecord[slot] || "");
      equippedCosmetics[slot] = id && lookup[slot] && lookup[slot][id] && (cosmeticInventory[id] || 0) > 0 ? id : "";
    }
    // Backward compatibility for old "clothes" slot -> shirts.
    if (!equippedCosmetics.shirts) {
      const legacyShirtId = String(equippedRecord.clothes || "");
      if (legacyShirtId && lookup.shirts && lookup.shirts[legacyShirtId] && (cosmeticInventory[legacyShirtId] || 0) > 0) {
        equippedCosmetics.shirts = legacyShirtId;
      }
    }
  }

  function normalizeRemoteEquipped(raw, slots, lookup) {
    const out = {};
    const safeSlots = Array.isArray(slots) ? slots : DEFAULT_SLOTS;
    const map = lookup && typeof lookup === "object" ? lookup : {};
    for (let i = 0; i < safeSlots.length; i++) {
      const slot = safeSlots[i];
      const id = String(raw && raw[slot] || "");
      out[slot] = id && map[slot] && map[slot][id] ? id : "";
    }
    if (!out.shirts) {
      const legacyShirtId = String(raw && raw.clothes || "");
      if (legacyShirtId && map.shirts && map.shirts[legacyShirtId]) {
        out.shirts = legacyShirtId;
      }
    }
    return out;
  }

  function writePayload(payload, cosmeticInventory, equippedCosmetics, items, slots, clampCountFn) {
    const out = payload && typeof payload === "object" ? payload : {};
    const inv = cosmeticInventory && typeof cosmeticInventory === "object" ? cosmeticInventory : {};
    const equipped = equippedCosmetics && typeof equippedCosmetics === "object" ? equippedCosmetics : {};
    const list = Array.isArray(items) ? items : [];
    const safeSlots = Array.isArray(slots) ? slots : DEFAULT_SLOTS;
    const clamp = typeof clampCountFn === "function" ? clampCountFn : ((v) => Math.max(0, Math.floor(Number(v) || 0)));

    const itemPayload = {};
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || !item.id) continue;
      itemPayload[item.id] = clamp(inv[item.id]);
    }
    out.cosmeticItems = itemPayload;
    out.equippedCosmetics = {};
    for (let i = 0; i < safeSlots.length; i++) {
      const slot = safeSlots[i];
      out.equippedCosmetics[slot] = String(equipped[slot] || "");
    }
    return out;
  }

  function getEquippedItem(slot, equippedCosmetics, lookup) {
    const safeSlot = String(slot || "");
    const equipped = equippedCosmetics && typeof equippedCosmetics === "object" ? equippedCosmetics : {};
    const map = lookup && typeof lookup === "object" ? lookup : {};
    const id = String(equipped[safeSlot] || "");
    return id && map[safeSlot] && map[safeSlot][id] ? map[safeSlot][id] : null;
  }

  return {
    DEFAULT_SLOTS,
    buildCatalog,
    createInventoryState,
    clampInventory,
    applyFromRecord,
    normalizeRemoteEquipped,
    writePayload,
    getEquippedItem
  };
})();
