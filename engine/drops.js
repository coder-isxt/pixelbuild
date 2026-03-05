window.GTModules = window.GTModules || {};

window.GTModules.drops = (function createDropsModule() {
  function createController(options) {
    const opts = options || {};
    let fallbackLastDropAtMs = 0;
    let fallbackLastInventoryFullHintAt = 0;
    const fallbackWorldDrops = new Map();

    function read(name, fallback) {
      const value = opts[name];
      if (typeof value === "function") return value();
      return value === undefined ? fallback : value;
    }

    function call(name) {
      const fn = opts[name];
      if (typeof fn !== "function") return undefined;
      const args = Array.prototype.slice.call(arguments, 1);
      return fn.apply(null, args);
    }

    function getWorldDrops() {
      const map = read("getWorldDrops", null);
      return map instanceof Map ? map : fallbackWorldDrops;
    }

    function getNetwork() {
      return read("getNetwork", {}) || {};
    }

    function getFirebase() {
      return read("getFirebase", null);
    }

    function nowMs() {
      return Date.now();
    }

    function nowPerfMs() {
      if (typeof performance !== "undefined" && performance && typeof performance.now === "function") {
        return performance.now();
      }
      return nowMs();
    }

    function getServerTimestampValue() {
      const firebaseRef = getFirebase();
      if (firebaseRef && firebaseRef.database && firebaseRef.database.ServerValue) {
        return firebaseRef.database.ServerValue.TIMESTAMP;
      }
      return nowMs();
    }

    function getLastDropAtMs() {
      if (typeof opts.getLastDropAtMs === "function") return Number(opts.getLastDropAtMs()) || 0;
      return fallbackLastDropAtMs;
    }

    function setLastDropAtMs(value) {
      if (typeof opts.setLastDropAtMs === "function") {
        opts.setLastDropAtMs(Number(value) || 0);
        return;
      }
      fallbackLastDropAtMs = Number(value) || 0;
    }

    function getLastInventoryFullHintAt() {
      if (typeof opts.getLastInventoryFullHintAt === "function") return Number(opts.getLastInventoryFullHintAt()) || 0;
      return fallbackLastInventoryFullHintAt;
    }

    function setLastInventoryFullHintAt(value) {
      if (typeof opts.setLastInventoryFullHintAt === "function") {
        opts.setLastInventoryFullHintAt(Number(value) || 0);
        return;
      }
      fallbackLastInventoryFullHintAt = Number(value) || 0;
    }

    function normalizeDropRecord(id, value) {
      if (!id || !value || typeof value !== "object") return null;
      const toolFist = String(read("getToolFist", "fist"));
      const toolWrench = String(read("getToolWrench", "wrench"));
      const typeRaw = String(value.type || "").trim().toLowerCase();
      const type = (typeRaw === "cosmetic" || typeRaw === "tool") ? typeRaw : "block";
      const blockId = Math.max(0, Math.floor(Number(value.blockId) || 0));
      const cosmeticId = String(value.cosmeticId || "").trim().slice(0, 64);
      const toolIdRaw = String(value.toolId || "").trim().toLowerCase();
      const toolId = (toolIdRaw === toolFist || toolIdRaw === toolWrench) ? toolIdRaw : "";
      const amount = Math.max(1, Math.floor(Number(value.amount) || 1));
      if (type === "block" && !blockId) return null;
      if (type === "cosmetic" && !cosmeticId) return null;
      if (type === "tool" && !toolId) return null;

      const tile = Math.max(1, Number(read("getTileSize", 32)) || 32);
      const worldW = Math.max(1, Number(read("getWorldWidthTiles", 140)) || 140);
      const worldH = Math.max(1, Number(read("getWorldHeightTiles", 30)) || 30);
      const x = Number(value.x);
      const y = Number(value.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

      return {
        id: String(id),
        type,
        blockId,
        cosmeticId,
        toolId,
        amount,
        x: Math.max(0, Math.min(x, worldW * tile - tile)),
        y: Math.max(0, Math.min(y, worldH * tile - tile)),
        ownerAccountId: String(value.ownerAccountId || ""),
        ownerSessionId: String(value.ownerSessionId || ""),
        ownerName: String(value.ownerName || "").slice(0, 20),
        createdAt: typeof value.createdAt === "number" ? value.createdAt : nowMs(),
        noPickupUntil: 0
      };
    }

    function getDropLabel(drop) {
      if (!drop) return "item";
      const toolFist = String(read("getToolFist", "fist"));
      const toolWrench = String(read("getToolWrench", "wrench"));
      if (drop.type === "tool") {
        if (drop.toolId === toolWrench) return "Wrench";
        if (drop.toolId === toolFist) return "Fist";
        return "Tool";
      }
      if (drop.type === "cosmetic") {
        const cosmetics = Array.isArray(read("getCosmeticItems", [])) ? read("getCosmeticItems", []) : [];
        for (let i = 0; i < cosmetics.length; i++) {
          const item = cosmetics[i];
          if (item && item.id === drop.cosmeticId) return item.name || drop.cosmeticId;
        }
        return drop.cosmeticId || "cosmetic";
      }
      const defs = read("getBlockDefs", {}) || {};
      const def = defs[drop.blockId];
      return def && def.name ? def.name : ("Block " + drop.blockId);
    }

    function addOrUpdateWorldDrop(id, value) {
      const drops = getWorldDrops();
      const normalized = normalizeDropRecord(id, value);
      if (!normalized) {
        drops.delete(String(id || ""));
        return;
      }
      const ownSessionId = String(read("getPlayerSessionId", "") || "");
      if (normalized.ownerSessionId && ownSessionId && normalized.ownerSessionId === ownSessionId) {
        normalized.noPickupUntil = nowPerfMs() + 550;
      }
      drops.set(normalized.id, normalized);
    }

    function clearWorldDrops() {
      getWorldDrops().clear();
    }

    function removeWorldDrop(id) {
      getWorldDrops().delete(String(id || ""));
    }

    function getMaxDroppableAmount(entry, tradeCtrl) {
      if (!entry || !entry.type) return 0;
      if (tradeCtrl && typeof tradeCtrl.getDragEntryMax === "function") {
        const maxFromTrade = Math.max(0, Math.floor(Number(tradeCtrl.getDragEntryMax(entry)) || 0));
        if (maxFromTrade > 0) return maxFromTrade;
      }
      if (entry.type === "block") {
        const blockId = Math.max(0, Math.floor(Number(entry.blockId) || 0));
        const inventoryIds = Array.isArray(read("getInventoryIds", [])) ? read("getInventoryIds", []) : [];
        if (!blockId || !inventoryIds.includes(blockId)) return 0;
        const inventory = read("getInventory", {}) || {};
        return Math.max(0, Math.floor(Number(inventory[blockId]) || 0));
      }
      if (entry.type === "cosmetic") {
        const cosmeticId = String(entry.cosmeticId || "");
        const cosmeticInventory = read("getCosmeticInventory", {}) || {};
        return Math.max(0, Math.floor(Number(cosmeticInventory[cosmeticId]) || 0));
      }
      return 0;
    }

    function isSameDropKind(drop, entry) {
      if (!drop || !entry) return false;
      if (drop.type !== entry.type) return false;
      if (drop.type === "block") {
        return Math.floor(Number(drop.blockId) || 0) === Math.floor(Number(entry.blockId) || 0);
      }
      if (drop.type === "cosmetic") {
        return String(drop.cosmeticId || "") === String(entry.cosmeticId || "");
      }
      if (drop.type === "tool") {
        return String(drop.toolId || "") === String(entry.toolId || "");
      }
      return false;
    }

    function findNearbyDropStackCandidate(entry, x, y) {
      const drops = getWorldDrops();
      if (!entry || !drops.size) return null;
      const tile = Math.max(1, Number(read("getTileSize", 32)) || 32);
      const tx = Math.floor(x / tile);
      const ty = Math.floor(y / tile);
      for (const drop of drops.values()) {
        if (!drop || !drop.id) continue;
        if (!isSameDropKind(drop, entry)) continue;
        const dtx = Math.floor(Number(drop.x || 0) / tile);
        const dty = Math.floor(Number(drop.y || 0) / tile);
        if (dtx === tx && dty === ty) return drop;
      }
      return null;
    }

    function applyStackAmountToLocalDrop(dropId, amountDelta) {
      const drops = getWorldDrops();
      const key = String(dropId || "");
      if (!key || !drops.has(key)) return false;
      const existing = drops.get(key);
      if (!existing) return false;
      const nextAmount = Math.max(
        1,
        Math.floor(Number(existing.amount) || 1) + Math.max(1, Math.floor(Number(amountDelta) || 1))
      );
      drops.set(key, { ...existing, amount: nextAmount });
      return true;
    }

    function pushDropPayload(payload) {
      const network = getNetwork();
      if (!network.enabled || !network.dropsRef) {
        const localId = "local_" + nowMs().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
        addOrUpdateWorldDrop(localId, payload);
        return true;
      }
      network.dropsRef.push({
        ...payload,
        createdAt: getServerTimestampValue()
      }).catch(() => {});
      return true;
    }

    function writeStackedRemote(entry, stackTarget, qty, payload) {
      const network = getNetwork();
      if (!network.enabled || !network.dropsRef || String(stackTarget.id).startsWith("local_")) {
        return applyStackAmountToLocalDrop(stackTarget.id, qty);
      }
      network.dropsRef.child(stackTarget.id).transaction((current) => {
        if (!current || typeof current !== "object") return current;
        const currentType = String(current.type || "").trim().toLowerCase();
        const safeType = currentType === "cosmetic" || currentType === "tool" ? currentType : "block";
        if (safeType !== entry.type) return current;
        if (safeType === "block") {
          if (Math.floor(Number(current.blockId) || 0) !== Math.floor(Number(entry.blockId) || 0)) return current;
        } else if (safeType === "cosmetic") {
          if (String(current.cosmeticId || "") !== String(entry.cosmeticId || "")) return current;
        } else if (safeType === "tool") {
          if (String(current.toolId || "") !== String(entry.toolId || "")) return current;
        }
        const currentAmount = Math.max(1, Math.floor(Number(current.amount) || 1));
        return {
          ...current,
          amount: currentAmount + qty,
          updatedAt: getServerTimestampValue()
        };
      }).then((result) => {
        if (result && result.committed) return;
        pushDropPayload(payload);
      }).catch(() => {
        pushDropPayload(payload);
      });
      return true;
    }

    function spawnWorldDropEntry(entry, amount, dropX, dropY) {
      if (!read("getInWorld", false) || !entry) return false;
      const qty = Math.max(1, Math.floor(Number(amount) || 1));
      const tile = Math.max(1, Number(read("getTileSize", 32)) || 32);
      const worldW = Math.max(1, Number(read("getWorldWidthTiles", 140)) || 140);
      const worldH = Math.max(1, Number(read("getWorldHeightTiles", 30)) || 30);
      const player = read("getPlayer", {}) || {};
      const playerW = Math.max(1, Number(read("getPlayerWidth", 22)) || 22);
      const playerH = Math.max(1, Number(read("getPlayerHeight", 30)) || 30);
      const worldX = Number.isFinite(dropX) ? dropX : (Number(player.x || 0) + (playerW / 2) - (tile / 2));
      const worldY = Number.isFinite(dropY) ? dropY : (Number(player.y || 0) + playerH - tile);
      const clampedX = Math.max(0, Math.min(worldX, worldW * tile - tile));
      const clampedY = Math.max(0, Math.min(worldY, worldH * tile - tile));

      const payload = {
        type: entry.type,
        blockId: 0,
        cosmeticId: "",
        toolId: "",
        amount: qty,
        x: clampedX,
        y: clampedY,
        ownerAccountId: read("getPlayerProfileId", "") || "",
        ownerSessionId: read("getPlayerSessionId", "") || "",
        ownerName: String(read("getPlayerName", "") || "").slice(0, 20),
        createdAt: nowMs()
      };

      if (entry.type === "block") {
        payload.blockId = Math.max(0, Math.floor(Number(entry.blockId) || 0));
      } else if (entry.type === "cosmetic") {
        payload.cosmeticId = String(entry.cosmeticId || "").trim().slice(0, 64);
      } else if (entry.type === "tool") {
        payload.toolId = String(entry.toolId || "").trim();
      } else {
        return false;
      }

      const stackTarget = findNearbyDropStackCandidate(entry, clampedX, clampedY);
      if (stackTarget) {
        return writeStackedRemote(entry, stackTarget, qty, payload);
      }
      return pushDropPayload(payload);
    }

    function dropInventoryEntry(entry, amount, dropX, dropY, tradeCtrl) {
      if (!read("getInWorld", false) || !entry) return false;
      const now = nowPerfMs();
      if (now - getLastDropAtMs() < 120) return false;

      const maxAmount = getMaxDroppableAmount(entry, tradeCtrl);
      if (maxAmount <= 0) return false;
      const qty = Math.max(1, Math.min(maxAmount, Math.floor(Number(amount) || 1)));

      const tile = Math.max(1, Number(read("getTileSize", 32)) || 32);
      const worldW = Math.max(1, Number(read("getWorldWidthTiles", 140)) || 140);
      const worldH = Math.max(1, Number(read("getWorldHeightTiles", 30)) || 30);
      const player = read("getPlayer", {}) || {};
      const playerW = Math.max(1, Number(read("getPlayerWidth", 22)) || 22);
      const playerH = Math.max(1, Number(read("getPlayerHeight", 30)) || 30);
      const defaultDropX = Number(player.x || 0) + (playerW / 2) - (tile / 2);
      const defaultDropY = Number(player.y || 0) + playerH - tile;
      const worldX = Number.isFinite(dropX) ? dropX : defaultDropX;
      const worldY = Number.isFinite(dropY) ? dropY : defaultDropY;
      const clampedX = Math.max(0, Math.min(worldX, worldW * tile - tile));
      const clampedY = Math.max(0, Math.min(worldY, worldH * tile - tile));

      const payload = {
        type: entry.type,
        blockId: 0,
        cosmeticId: "",
        toolId: "",
        amount: qty,
        x: clampedX,
        y: clampedY,
        ownerAccountId: read("getPlayerProfileId", "") || "",
        ownerSessionId: read("getPlayerSessionId", "") || "",
        ownerName: String(read("getPlayerName", "") || "").slice(0, 20),
        createdAt: nowMs()
      };

      const inventory = read("getInventory", {}) || {};
      const cosmeticInventory = read("getCosmeticInventory", {}) || {};
      const equippedCosmetics = read("getEquippedCosmetics", {}) || {};
      const cosmeticSlots = Array.isArray(read("getCosmeticSlots", [])) ? read("getCosmeticSlots", []) : [];

      let changedInventory = false;
      if (entry.type === "block") {
        const blockId = Math.max(0, Math.floor(Number(entry.blockId) || 0));
        payload.blockId = blockId;
        inventory[blockId] = Math.max(0, Math.floor((inventory[blockId] || 0) - qty));
        changedInventory = true;
      } else if (entry.type === "cosmetic") {
        const cosmeticId = String(entry.cosmeticId || "").trim().slice(0, 64);
        payload.cosmeticId = cosmeticId;
        cosmeticInventory[cosmeticId] = Math.max(0, Math.floor((cosmeticInventory[cosmeticId] || 0) - qty));
        if ((cosmeticInventory[cosmeticId] || 0) <= 0) {
          for (let i = 0; i < cosmeticSlots.length; i++) {
            const slot = cosmeticSlots[i];
            if (equippedCosmetics[slot] === cosmeticId) equippedCosmetics[slot] = "";
          }
        }
        changedInventory = true;
      } else if (entry.type === "tool") {
        payload.toolId = String(entry.toolId || "").trim();
      } else {
        return false;
      }

      setLastDropAtMs(now);
      if (changedInventory) {
        call("saveInventory");
        call("refreshToolbar");
        if (entry.type === "cosmetic") call("syncPlayer", true);
      }

      const stackTarget = findNearbyDropStackCandidate(entry, clampedX, clampedY);
      if (stackTarget) {
        if (writeStackedRemote(entry, stackTarget, qty, payload)) return true;
      }

      return pushDropPayload(payload);
    }

    function dropSelectedInventoryItem(tradeCtrl) {
      if (!read("getInWorld", false)) return;
      const slotOrder = Array.isArray(read("getSlotOrder", [])) ? read("getSlotOrder", []) : [];
      const selectedSlot = Math.max(0, Math.floor(Number(read("getSelectedSlot", 0)) || 0));
      const selectedId = slotOrder[selectedSlot];
      const toolFist = read("getToolFist", "fist");
      const toolWrench = read("getToolWrench", "wrench");
      if (selectedId === toolFist || selectedId === toolWrench) return;
      if (typeof selectedId !== "number") return;
      dropInventoryEntry({ type: "block", blockId: selectedId }, 1, undefined, undefined, tradeCtrl);
    }

    function tryPickupWorldDrop(drop) {
      if (!drop || !drop.id) return;
      if (drop.noPickupUntil && nowPerfMs() < drop.noPickupUntil) return;

      const player = read("getPlayer", {}) || {};
      const playerW = Math.max(1, Number(read("getPlayerWidth", 22)) || 22);
      const playerH = Math.max(1, Number(read("getPlayerHeight", 30)) || 30);
      const tile = Math.max(1, Number(read("getTileSize", 32)) || 32);
      const radius = Math.max(1, Number(read("getDropPickupRadius", 26)) || 26);
      const px = Number(player.x || 0) + playerW / 2;
      const py = Number(player.y || 0) + playerH / 2;
      const dx = (Number(drop.x || 0) + tile / 2) - px;
      const dy = (Number(drop.y || 0) + tile / 2) - py;
      if ((dx * dx + dy * dy) > (radius * radius)) return;

      const inventoryLimit = Math.max(1, Math.floor(Number(read("getInventoryItemLimit", 300)) || 300));
      const inventory = read("getInventory", {}) || {};
      const cosmeticInventory = read("getCosmeticInventory", {}) || {};
      if (drop.type === "block") {
        const current = Math.max(0, Math.floor(Number(inventory[drop.blockId]) || 0));
        const incoming = Math.max(1, Math.floor(Number(drop.amount) || 1));
        if (current >= inventoryLimit || (current + incoming) > inventoryLimit) {
          const now = nowPerfMs();
          drop.noPickupUntil = now + 320;
          if ((now - getLastInventoryFullHintAt()) > 900) {
            setLastInventoryFullHintAt(now);
            call("postLocalSystemChat", "Inventory full for " + getDropLabel(drop) + " (max " + inventoryLimit + ").");
          }
          return;
        }
      } else if (drop.type === "cosmetic") {
        const current = Math.max(0, Math.floor(Number(cosmeticInventory[drop.cosmeticId]) || 0));
        const incoming = Math.max(1, Math.floor(Number(drop.amount) || 1));
        if (current >= inventoryLimit || (current + incoming) > inventoryLimit) {
          const now = nowPerfMs();
          drop.noPickupUntil = now + 320;
          if ((now - getLastInventoryFullHintAt()) > 900) {
            setLastInventoryFullHintAt(now);
            call("postLocalSystemChat", "Inventory full for " + getDropLabel(drop) + " (max " + inventoryLimit + ").");
          }
          return;
        }
      }

      const cameraX = Number(read("getCameraX", 0)) || 0;
      const cameraY = Number(read("getCameraY", 0)) || 0;
      const viewW = Math.max(1, Number(call("getCameraViewWidth") || 1));
      const viewH = Math.max(1, Number(call("getCameraViewHeight") || 1));
      const pickupTargetWorld = {
        x: cameraX + Math.max(24, viewW - 18),
        y: cameraY + Math.max(22, Math.min(viewH - 22, 56))
      };

      const clampInventoryCount = typeof opts.clampInventoryCount === "function"
        ? opts.clampInventoryCount
        : (n) => Math.max(0, Math.floor(Number(n) || 0));

      const applyPickup = () => {
        const particles = read("getParticleController", null);
        if (particles && typeof particles.emitPickup === "function") {
          particles.emitPickup(
            Number(drop.x || 0) + tile * 0.5,
            Number(drop.y || 0) + tile * 0.5,
            pickupTargetWorld.x,
            pickupTargetWorld.y,
            Number(drop.amount || 1),
            drop.type
          );
        }
        if (drop.type === "cosmetic") {
          cosmeticInventory[drop.cosmeticId] = clampInventoryCount((cosmeticInventory[drop.cosmeticId] || 0) + drop.amount);
        } else if (drop.type === "block") {
          inventory[drop.blockId] = clampInventoryCount((inventory[drop.blockId] || 0) + drop.amount);
        }
        if (drop.type !== "tool") {
          call("schedulePickupInventoryFlush");
        }
        call("postLocalSystemChat", "Picked up " + drop.amount + "x " + getDropLabel(drop) + ".");
      };

      const network = getNetwork();
      if (!network.enabled || !network.dropsRef) {
        removeWorldDrop(drop.id);
        applyPickup();
        return;
      }

      drop.noPickupUntil = nowPerfMs() + 280;
      const ref = network.dropsRef.child(drop.id);
      ref.transaction((current) => {
        if (!current) return current;
        return null;
      }).then((result) => {
        if (!result.committed) return;
        removeWorldDrop(drop.id);
        applyPickup();
      }).catch(() => {});
    }

    function updateWorldDrops() {
      if (!read("getInWorld", false)) return;
      const drops = getWorldDrops();
      if (!drops.size) return;
      const maxPerWorld = Math.max(1, Math.floor(Number(read("getDropMaxPerWorld", 220)) || 220));
      if (drops.size > maxPerWorld) {
        const ids = Array.from(drops.keys());
        ids.sort();
        const removeCount = drops.size - maxPerWorld;
        for (let i = 0; i < removeCount; i++) {
          drops.delete(ids[i]);
        }
      }
      const entries = Array.from(drops.values());
      for (let i = 0; i < entries.length; i++) {
        tryPickupWorldDrop(entries[i]);
      }
    }

    return {
      normalizeDropRecord,
      getDropLabel,
      addOrUpdateWorldDrop,
      clearWorldDrops,
      removeWorldDrop,
      getMaxDroppableAmount,
      isSameDropKind,
      findNearbyDropStackCandidate,
      applyStackAmountToLocalDrop,
      spawnWorldDropEntry,
      dropInventoryEntry,
      dropSelectedInventoryItem,
      tryPickupWorldDrop,
      updateWorldDrops
    };
  }

  return {
    createController
  };
})();
