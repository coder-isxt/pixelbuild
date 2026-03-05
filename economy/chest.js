window.GTModules = window.GTModules || {};

window.GTModules.chest = (function createChestModule() {
  function createController(options) {
    const opts = options || {};
    const chestsByTile = new Map();
    let editCtx = null;
    let modalBound = false;

    function get(k, fallback) {
      const fn = opts[k];
      if (typeof fn === "function") return fn();
      return fallback;
    }

    function esc(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function tileKey(tx, ty) {
      return String(tx) + "_" + String(ty);
    }

    function parseItemToken(rawToken) {
      const token = String(rawToken || "").trim();
      if (!token) return null;
      if (token.startsWith("c:")) {
        const cosmeticId = token.slice(2).trim();
        if (!cosmeticId) return null;
        return { token: "c:" + cosmeticId, type: "cosmetic", blockId: 0, cosmeticId };
      }
      if (token.startsWith("b:")) {
        const blockId = Math.max(0, Math.floor(Number(token.slice(2)) || 0));
        if (!blockId) return null;
        return { token: "b:" + blockId, type: "block", blockId, cosmeticId: "" };
      }
      const legacyBlockId = Math.max(0, Math.floor(Number(token) || 0));
      if (legacyBlockId) {
        return { token: "b:" + legacyBlockId, type: "block", blockId: legacyBlockId, cosmeticId: "" };
      }
      return null;
    }

    function normalizeItems(rawItems) {
      const source = rawItems && typeof rawItems === "object" ? rawItems : {};
      const out = {};
      for (const [key, value] of Object.entries(source)) {
        const parsed = parseItemToken(key);
        if (!parsed) continue;
        const qty = Math.max(0, Math.floor(Number(value) || 0));
        if (!qty) continue;
        out[parsed.token] = (out[parsed.token] || 0) + qty;
      }
      return out;
    }

    function normalizeRecord(value) {
      const raw = value && typeof value === "object" ? value : {};
      return {
        ownerAccountId: String(raw.ownerAccountId || ""),
        ownerName: String(raw.ownerName || "").slice(0, 20),
        items: normalizeItems(raw.items),
        updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0
      };
    }

    function setLocal(tx, ty, value) {
      const key = tileKey(tx, ty);
      if (!value) {
        chestsByTile.delete(key);
        return;
      }
      chestsByTile.set(key, normalizeRecord(value));
    }

    function getLocal(tx, ty) {
      return chestsByTile.get(tileKey(tx, ty)) || null;
    }

    function clearAll() {
      chestsByTile.clear();
      closeModal();
    }

    function getStoredCount(items) {
      const list = items && typeof items === "object" ? items : {};
      let total = 0;
      for (const qty of Object.values(list)) {
        total += Math.max(0, Math.floor(Number(qty) || 0));
      }
      return total;
    }

    function getStoredCountAt(tx, ty) {
      const chest = getLocal(tx, ty);
      return getStoredCount(chest && chest.items);
    }

    function canManageAt(tx, ty) {
      const worldLocked = typeof opts.isWorldLocked === "function" ? Boolean(opts.isWorldLocked()) : false;
      if (worldLocked) {
        if (typeof opts.canManageAt !== "function") return false;
        return Boolean(opts.canManageAt(tx, ty));
      }
      const chest = getLocal(tx, ty);
      const pid = String(get("getPlayerProfileId", "") || "");
      return Boolean(chest && chest.ownerAccountId && pid && chest.ownerAccountId === pid);
    }

    function getBlockName(blockId) {
      const defs = get("getBlockDefs", {}) || {};
      const id = Math.max(0, Math.floor(Number(blockId) || 0));
      const def = defs[id];
      if (def && def.name) return def.name;
      return "Block " + id;
    }

    function getCosmeticName(cosmeticId) {
      const items = Array.isArray(get("getCosmeticItems", [])) ? get("getCosmeticItems", []) : [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.id === cosmeticId) return item.name || cosmeticId;
      }
      return cosmeticId || "Cosmetic";
    }

    function getItemLabelByToken(token) {
      const parsed = parseItemToken(token);
      if (!parsed) return "Item";
      if (parsed.type === "cosmetic") return getCosmeticName(parsed.cosmeticId);
      return getBlockName(parsed.blockId);
    }

    function getModalEls() {
      return {
        modal: get("getChestModalEl", null),
        title: get("getChestTitleEl", null),
        body: get("getChestBodyEl", null),
        actions: get("getChestActionsEl", null),
        closeBtn: get("getChestCloseBtnEl", null)
      };
    }

    function closeModal() {
      editCtx = null;
      const els = getModalEls();
      if (els.modal) {
        els.modal.classList.add("hidden");
        els.modal.classList.remove("inventory-passive");
      }
    }

    function buildStoredRows(items) {
      const rows = [];
      for (const [token, qtyRaw] of Object.entries(items || {})) {
        const qty = Math.max(0, Math.floor(Number(qtyRaw) || 0));
        if (!qty) continue;
        rows.push(
          "<div class='admin-inventory-row'><span class='admin-inventory-item'>" +
          esc(getItemLabelByToken(token)) +
          "</span><span class='admin-inventory-qty'>x" +
          qty +
          "</span></div>"
        );
      }
      return rows.join("");
    }

    function renderModal() {
      if (!editCtx) return;
      const els = getModalEls();
      if (!els.modal || !els.title || !els.body || !els.actions) return;

      const tx = editCtx.tx;
      const ty = editCtx.ty;
      const chest = getLocal(tx, ty) || normalizeRecord({});
      const canManage = canManageAt(tx, ty);
      const storedRows = buildStoredRows(chest.items);
      const totalStored = getStoredCount(chest.items);
      const ownerLabel = chest.ownerName || (chest.ownerAccountId ? chest.ownerAccountId.slice(0, 20) : "world owner");

      let bodyHtml =
        "<div class='vending-section'>" +
          "<div class='vending-stat-grid'>" +
            "<div class='vending-stat'><span>Manager</span><strong>@" + esc(ownerLabel) + "</strong></div>" +
            "<div class='vending-stat'><span>Stored</span><strong>" + totalStored + " items</strong></div>" +
          "</div>" +
        "</div>" +
        "<div class='vending-section'>" +
          "<div class='vending-section-title'>Storage</div>" +
          "<div class='trade-offer chest-drop-zone' data-chest-drop='storage'>" +
            (storedRows || "<div class='trade-offer-empty'>Chest is empty.</div>") +
          "</div>" +
        "</div>";

      if (canManage) {
        bodyHtml += "<div class='vending-auto-stock-note'>Drag items from inventory into chest to store them.</div>";
        els.actions.innerHTML =
          "<button data-chest-act='collect'" + (totalStored > 0 ? "" : " disabled") + ">Collect All</button>" +
          "<button data-chest-act='close'>Close</button>";
      } else {
        bodyHtml += "<div class='vending-auto-stock-note'>Only the world owner can manage this chest.</div>";
        els.actions.innerHTML = "<button data-chest-act='close'>Close</button>";
      }

      els.title.textContent = "Storage Chest (" + tx + "," + ty + ")";
      els.body.innerHTML = bodyHtml;
      els.modal.classList.add("inventory-passive");
      els.modal.classList.remove("hidden");
    }

    function getChestRefAt(tx, ty) {
      const network = get("getNetwork", null);
      const worldId = String(get("getCurrentWorldId", "") || "");
      const basePath = String(get("getBasePath", "") || "");
      if (!network || !network.enabled || !network.db) return null;
      return network.db.ref(basePath + "/worlds/" + worldId + "/chests/" + tileKey(tx, ty));
    }

    function seedOwner(tx, ty) {
      const ref = getChestRefAt(tx, ty);
      if (!ref) return;
      const firebaseRef = get("getFirebase", null);
      const profileId = String(get("getPlayerProfileId", "") || "");
      const profileName = String(get("getPlayerName", "") || "").slice(0, 20);
      ref.transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw);
        if (current.ownerAccountId) return currentRaw;
        return {
          ownerAccountId: profileId,
          ownerName: profileName,
          items: {},
          updatedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        };
      }).catch(() => {});
    }

    function spendFromInventoryByToken(token, qty) {
      const amount = Math.max(0, Math.floor(Number(qty) || 0));
      if (!amount) return false;
      const parsed = parseItemToken(token);
      if (!parsed) return false;
      if (parsed.type === "cosmetic") {
        const cosmeticInventory = get("getCosmeticInventory", {}) || {};
        const current = Math.max(0, Math.floor(Number(cosmeticInventory[parsed.cosmeticId]) || 0));
        if (current < amount) return false;
        cosmeticInventory[parsed.cosmeticId] = current - amount;
        return true;
      }
      const inventory = get("getInventory", {}) || {};
      const clampInventoryCount = opts.clampInventoryCount || ((value) => Math.max(0, Math.floor(Number(value) || 0)));
      const current = clampInventoryCount(inventory[parsed.blockId]);
      if (current < amount) return false;
      inventory[parsed.blockId] = clampInventoryCount(current - amount);
      return true;
    }

    function grantToInventoryByToken(token, qty) {
      const amount = Math.max(0, Math.floor(Number(qty) || 0));
      if (!amount) return { added: 0, overflow: 0 };
      const parsed = parseItemToken(token);
      if (!parsed) return { added: 0, overflow: amount };
      if (parsed.type === "cosmetic") {
        const cosmeticInventory = get("getCosmeticInventory", {}) || {};
        cosmeticInventory[parsed.cosmeticId] = Math.max(0, Math.floor(Number(cosmeticInventory[parsed.cosmeticId]) || 0)) + amount;
        return { added: amount, overflow: 0 };
      }
      const inventory = get("getInventory", {}) || {};
      const clampInventoryCount = opts.clampInventoryCount || ((value) => Math.max(0, Math.floor(Number(value) || 0)));
      const current = clampInventoryCount(inventory[parsed.blockId]);
      const next = clampInventoryCount(current + amount);
      const added = Math.max(0, next - current);
      inventory[parsed.blockId] = next;
      return { added, overflow: Math.max(0, amount - added) };
    }

    function storeToken(tx, ty, token, qty) {
      const post = opts.postLocalSystemChat || (() => {});
      if (!canManageAt(tx, ty)) {
        post("Only the world owner can manage chests.");
        return;
      }
      const network = get("getNetwork", null);
      if (!network || !network.enabled || !network.chestsRef) return;
      const amount = Math.max(1, Math.floor(Number(qty) || 1));
      if (!spendFromInventoryByToken(token, amount)) {
        post("You do not have enough items.");
        return;
      }
      const firebaseRef = get("getFirebase", null);
      const profileId = String(get("getPlayerProfileId", "") || "");
      const profileName = String(get("getPlayerName", "") || "").slice(0, 20);
      network.chestsRef.child(tileKey(tx, ty)).transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw);
        const items = { ...(current.items || {}) };
        items[token] = Math.max(0, Math.floor(Number(items[token]) || 0)) + amount;
        return {
          ownerAccountId: current.ownerAccountId || profileId,
          ownerName: current.ownerName || profileName,
          items,
          updatedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        };
      }).then((result) => {
        if (!result.committed) {
          // rollback spend
          grantToInventoryByToken(token, amount);
          if (typeof opts.saveInventory === "function") opts.saveInventory();
          if (typeof opts.refreshToolbar === "function") opts.refreshToolbar();
          post("Failed to store item.");
          return;
        }
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar();
        renderModal();
      }).catch(() => {
        grantToInventoryByToken(token, amount);
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar();
        post("Failed to store item.");
      });
    }

    function collectAll(tx, ty) {
      const post = opts.postLocalSystemChat || (() => {});
      if (!canManageAt(tx, ty)) {
        post("Only the world owner can manage chests.");
        return;
      }
      const network = get("getNetwork", null);
      if (!network || !network.enabled || !network.chestsRef) return;
      const firebaseRef = get("getFirebase", null);
      const profileId = String(get("getPlayerProfileId", "") || "");
      const profileName = String(get("getPlayerName", "") || "").slice(0, 20);
      let moved = {};
      network.chestsRef.child(tileKey(tx, ty)).transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw);
        moved = { ...(current.items || {}) };
        return {
          ownerAccountId: current.ownerAccountId || profileId,
          ownerName: current.ownerName || profileName,
          items: {},
          updatedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        };
      }).then((result) => {
        if (!result.committed) {
          post("Failed to collect from chest.");
          return;
        }
        let total = 0;
        let overflow = 0;
        for (const [token, qty] of Object.entries(moved || {})) {
          const outcome = grantToInventoryByToken(token, qty);
          total += Math.max(0, Math.floor(Number(outcome.added) || 0));
          overflow += Math.max(0, Math.floor(Number(outcome.overflow) || 0));
        }
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar();
        renderModal();
        if (total <= 0) {
          post("No items to collect.");
          return;
        }
        if (overflow > 0) {
          post("Collected " + total + " item(s). " + overflow + " could not fit (inventory cap).");
          return;
        }
        post("Collected " + total + " item(s).");
      }).catch(() => {
        post("Failed to collect from chest.");
      });
    }

    function handleActionClick(event) {
      const target = event && event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = String(target.dataset.chestAct || "").trim();
      if (!action || !editCtx) return;
      const tx = editCtx.tx;
      const ty = editCtx.ty;
      if (action === "close") {
        closeModal();
        return;
      }
      if (action === "collect") {
        collectAll(tx, ty);
      }
    }

    function bindModalEvents() {
      if (modalBound) return;
      modalBound = true;
      const els = getModalEls();
      if (els.closeBtn) {
        els.closeBtn.addEventListener("click", () => closeModal());
      }
      if (els.modal) {
        els.modal.addEventListener("click", (event) => {
          if (event.target === els.modal) closeModal();
        });
      }
      if (els.actions) {
        els.actions.addEventListener("click", handleActionClick);
      }
    }

    function openModal(tx, ty) {
      if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
      if (!getLocal(tx, ty)) {
        setLocal(tx, ty, { ownerAccountId: "", ownerName: "", items: {}, updatedAt: 0 });
      }
      seedOwner(tx, ty);
      editCtx = { tx, ty };
      renderModal();
    }

    function isOpen() {
      const modal = get("getChestModalEl", null);
      return Boolean(editCtx && modal && !modal.classList.contains("hidden"));
    }

    function renderOpen() {
      if (isOpen()) renderModal();
    }

    function onPlaced(tx, ty) {
      setLocal(tx, ty, {
        ownerAccountId: String(get("getPlayerProfileId", "") || ""),
        ownerName: String(get("getPlayerName", "") || "").slice(0, 20),
        items: {},
        updatedAt: Date.now()
      });
      seedOwner(tx, ty);
    }

    function onBroken(tx, ty) {
      setLocal(tx, ty, null);
      if (editCtx && editCtx.tx === tx && editCtx.ty === ty) {
        closeModal();
      }
    }

    function handleInventoryDragEnd(entry, amount, clientX, clientY) {
      if (!isOpen() || !editCtx) return { handled: false, blockWorldDrop: false };
      const tx = editCtx.tx;
      const ty = editCtx.ty;

      const body = get("getChestBodyEl", null);
      if (!(body instanceof HTMLElement)) return { handled: false, blockWorldDrop: false };
      const zone = body.querySelector("[data-chest-drop='storage']");

      const x = Number(clientX);
      const y = Number(clientY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { handled: false, blockWorldDrop: false };
      const zoneRect = zone instanceof HTMLElement ? zone.getBoundingClientRect() : null;
      const bodyRect = body.getBoundingClientRect();
      const insideZone = Boolean(zoneRect && x >= zoneRect.left && x <= zoneRect.right && y >= zoneRect.top && y <= zoneRect.bottom);
      const insideBody = x >= bodyRect.left && x <= bodyRect.right && y >= bodyRect.top && y <= bodyRect.bottom;
      const inside = insideZone || insideBody;
      if (!inside) return { handled: false, blockWorldDrop: false };
      if (!canManageAt(tx, ty)) {
        const post = opts.postLocalSystemChat || (() => {});
        post("Only the world owner can manage this chest.");
        return { handled: false, blockWorldDrop: true };
      }

      const type = String(entry && entry.type || "");
      if (type !== "block" && type !== "cosmetic") return { handled: false, blockWorldDrop: true };
      const qty = Math.max(1, Math.floor(Number(amount) || 1));
      if (type === "cosmetic") {
        const cosmeticId = String(entry.cosmeticId || "");
        if (!cosmeticId) return { handled: false, blockWorldDrop: true };
        storeToken(tx, ty, "c:" + cosmeticId, qty);
        return { handled: true, blockWorldDrop: true };
      }
      const blockId = Math.max(0, Math.floor(Number(entry.blockId) || 0));
      if (!blockId) return { handled: false, blockWorldDrop: true };
      storeToken(tx, ty, "b:" + blockId, qty);
      return { handled: true, blockWorldDrop: true };
    }

    return {
      bindModalEvents,
      normalizeRecord,
      setLocal,
      getLocal,
      clearAll,
      getStoredCount,
      getStoredCountAt,
      closeModal,
      openModal,
      isOpen,
      renderOpen,
      onPlaced,
      onBroken,
      handleInventoryDragEnd
    };
  }

  return { createController };
})();
