window.GTModules = window.GTModules || {};

window.GTModules.inventory = (function createInventoryModule() {
  function createController(options) {
    const opts = options || {};

    function get(k, fallback) {
      const fn = opts[k];
      if (typeof fn === "function") return fn();
      return fn === undefined ? fallback : fn;
    }

    function getStorageKey() {
      const accountId = String(get("getPlayerProfileId", "guest") || "guest");
      return "growtopia_inventory_" + accountId;
    }

    function clampCount(value) {
      const itemLimit = Math.max(1, Math.floor(Number(get("getInventoryItemLimit", 300)) || 300));
      const n = Number(value);
      const safe = Number.isFinite(n) ? Math.floor(n) : 0;
      return Math.max(0, Math.min(itemLimit, safe));
    }

    function clampAll() {
      const inventory = get("getInventory", {});
      const inventoryIds = Array.isArray(get("getInventoryIds", [])) ? get("getInventoryIds", []) : [];
      const cosmeticInventory = get("getCosmeticInventory", {});
      const cosmeticItems = Array.isArray(get("getCosmeticItems", [])) ? get("getCosmeticItems", []) : [];
      for (const id of inventoryIds) {
        inventory[id] = clampCount(inventory[id]);
      }
      for (const item of cosmeticItems) {
        if (!item || !item.id) continue;
        cosmeticInventory[item.id] = clampCount(cosmeticInventory[item.id]);
      }
    }

    function applyFromRecord(record) {
      const payload = record || {};
      const inventory = get("getInventory", {});
      const inventoryIds = Array.isArray(get("getInventoryIds", [])) ? get("getInventoryIds", []) : [];
      const cosmeticInventory = get("getCosmeticInventory", {});
      const cosmeticItems = Array.isArray(get("getCosmeticItems", [])) ? get("getCosmeticItems", []) : [];
      const cosmeticLookup = get("getCosmeticLookup", {}) || {};
      const cosmeticSlots = Array.isArray(get("getCosmeticSlots", [])) ? get("getCosmeticSlots", []) : [];
      const equippedCosmetics = get("getEquippedCosmetics", {});

      for (const id of inventoryIds) {
        inventory[id] = clampCount(Number(payload && payload[id]));
      }
      const itemRecord = payload && payload.cosmeticItems || {};
      const legacyOwned = payload && payload.owned || {};
      for (const item of cosmeticItems) {
        if (!item || !item.id) continue;
        const nestedValue = Number(itemRecord[item.id]);
        const topLevelValue = Number(payload && payload[item.id]);
        const legacyHasOwned = Array.isArray(legacyOwned[item.slot]) && legacyOwned[item.slot].includes(item.id);
        let finalValue = 0;
        if (Number.isFinite(nestedValue)) finalValue = clampCount(nestedValue);
        if (!finalValue && Number.isFinite(topLevelValue)) finalValue = clampCount(topLevelValue);
        if (!finalValue && legacyHasOwned) finalValue = 1;
        cosmeticInventory[item.id] = clampCount(finalValue);
      }

      const equippedRecord = payload && payload.equippedCosmetics || payload && payload.equipped || {};
      for (const slot of cosmeticSlots) {
        const id = String(equippedRecord[slot] || "");
        const slotLookup = cosmeticLookup[slot] || {};
        equippedCosmetics[slot] = id && slotLookup[id] && (cosmeticInventory[id] || 0) > 0 ? id : "";
      }
      // Backward compatibility: old save field "clothes" -> "shirts".
      if (cosmeticSlots.includes("shirts") && !equippedCosmetics.shirts) {
        const legacyId = String(equippedRecord.clothes || "");
        const shirtLookup = cosmeticLookup.shirts || {};
        if (legacyId && shirtLookup[legacyId] && (cosmeticInventory[legacyId] || 0) > 0) {
          equippedCosmetics.shirts = legacyId;
        }
      }

      const onRecordApplied = opts.onRecordApplied;
      if (typeof onRecordApplied === "function") onRecordApplied(payload);
    }

    function buildPayload() {
      clampAll();
      const inventory = get("getInventory", {});
      const inventoryIds = Array.isArray(get("getInventoryIds", [])) ? get("getInventoryIds", []) : [];
      const cosmeticInventory = get("getCosmeticInventory", {});
      const cosmeticItems = Array.isArray(get("getCosmeticItems", [])) ? get("getCosmeticItems", []) : [];
      const equippedCosmetics = get("getEquippedCosmetics", {}) || {};
      const cosmeticSlots = Array.isArray(get("getCosmeticSlots", [])) ? get("getCosmeticSlots", []) : [];
      const payload = {};
      for (const id of inventoryIds) payload[id] = clampCount(inventory[id]);
      const itemPayload = {};
      for (const item of cosmeticItems) {
        if (!item || !item.id) continue;
        itemPayload[item.id] = clampCount(cosmeticInventory[item.id]);
      }
      payload.cosmeticItems = itemPayload;
      payload.equippedCosmetics = {};
      for (const slot of cosmeticSlots) {
        payload.equippedCosmetics[slot] = String(equippedCosmetics[slot] || "");
      }

      const writeExtra = opts.writeExtraToPayload;
      if (typeof writeExtra === "function") {
        writeExtra(payload);
      }
      return payload;
    }

    function loadFromLocal() {
      const secure = window.GTModules && window.GTModules.secureStorage;
      if (secure && typeof secure.loadJson === "function") {
        const parsed = secure.loadJson(getStorageKey());
        if (!parsed || typeof parsed !== "object") return false;
        applyFromRecord(parsed);
        return true;
      }
      try {
        const raw = localStorage.getItem(getStorageKey());
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        applyFromRecord(parsed);
        return true;
      } catch (error) {
        return false;
      }
    }

    function saveToLocal() {
      const secure = window.GTModules && window.GTModules.secureStorage;
      if (secure && typeof secure.saveJson === "function") {
        secure.saveJson(getStorageKey(), buildPayload());
        return;
      }
      try {
        localStorage.setItem(getStorageKey(), JSON.stringify(buildPayload()));
      } catch (error) {
        // ignore localStorage failures
      }
    }

    function saveToNetwork() {
      const network = get("getNetwork", {});
      clampAll();
      saveToLocal();
      if (!network || !network.enabled || !network.inventoryRef) return;
      network.inventoryRef.set(buildPayload()).catch(() => {
        const onError = opts.onSaveError;
        if (typeof onError === "function") onError();
      });
    }

    function reloadFromServer() {
      const network = get("getNetwork", {});
      if (!network || !network.enabled || !network.inventoryRef) return;
      network.inventoryRef.once("value").then((snapshot) => {
        if (!snapshot.exists()) return;
        applyFromRecord(snapshot.val() || {});
        saveToLocal();
        const onReload = opts.onReloadFromServer;
        if (typeof onReload === "function") onReload();
      }).catch(() => {});
    }

    return {
      getStorageKey,
      clampCount,
      clampAll,
      applyFromRecord,
      buildPayload,
      loadFromLocal,
      saveToLocal,
      saveToNetwork,
      reloadFromServer
    };
  }

  return {
    createController
  };
})();
