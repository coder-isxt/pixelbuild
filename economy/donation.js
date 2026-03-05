window.GTModules = window.GTModules || {};

window.GTModules.donation = (function createDonationModule() {
  function createController(options) {
    const opts = options || {};
    const boxesByTile = new Map();
    const pendingByTile = new Map();
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

    function getTileKey(tx, ty) {
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
        if (qty <= 0) continue;
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
      const key = getTileKey(tx, ty);
      if (!value) {
        boxesByTile.delete(key);
        pendingByTile.delete(key);
        return;
      }
      boxesByTile.set(key, normalizeRecord(value));
    }

    function getLocal(tx, ty) {
      return boxesByTile.get(getTileKey(tx, ty)) || null;
    }

    function clearAll() {
      boxesByTile.clear();
      pendingByTile.clear();
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
      const box = getLocal(tx, ty);
      return getStoredCount(box && box.items);
    }

    function isOwner(box) {
      const pid = String(get("getPlayerProfileId", "") || "");
      return Boolean(box && box.ownerAccountId && pid && box.ownerAccountId === pid);
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

    function getPendingForTile(tx, ty) {
      const key = getTileKey(tx, ty);
      return pendingByTile.get(key) || {};
    }

    function setPendingForTile(tx, ty, next) {
      const key = getTileKey(tx, ty);
      const normalized = normalizeItems(next);
      if (!Object.keys(normalized).length) {
        pendingByTile.delete(key);
        return;
      }
      pendingByTile.set(key, normalized);
    }

    function getModalEls() {
      return {
        modal: get("getDonationModalEl", null),
        title: get("getDonationTitleEl", null),
        body: get("getDonationBodyEl", null),
        actions: get("getDonationActionsEl", null),
        closeBtn: get("getDonationCloseBtnEl", null)
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

    function buildPendingRows(pending) {
      const rows = [];
      for (const [token, qtyRaw] of Object.entries(pending || {})) {
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

    function buildOwnInventoryRows() {
      const rows = [];
      const inventoryIds = Array.isArray(get("getInventoryIds", [])) ? get("getInventoryIds", []) : [];
      const inventory = get("getInventory", {}) || {};
      for (let i = 0; i < inventoryIds.length; i++) {
        const blockId = Math.max(0, Math.floor(Number(inventoryIds[i]) || 0));
        if (!blockId) continue;
        const qty = Math.max(0, Math.floor(Number(inventory[blockId]) || 0));
        if (!qty) continue;
        rows.push(
          "<div class='admin-inventory-row'><span class='admin-inventory-item'>" +
          esc(getBlockName(blockId)) +
          "</span><span class='admin-inventory-qty'>x" +
          qty +
          "</span></div>"
        );
      }
      const cosmetics = Array.isArray(get("getCosmeticItems", [])) ? get("getCosmeticItems", []) : [];
      const cosmeticInventory = get("getCosmeticInventory", {}) || {};
      for (let i = 0; i < cosmetics.length; i++) {
        const item = cosmetics[i];
        if (!item || !item.id) continue;
        const qty = Math.max(0, Math.floor(Number(cosmeticInventory[item.id]) || 0));
        if (!qty) continue;
        rows.push(
          "<div class='admin-inventory-row'><span class='admin-inventory-item'>" +
          esc(item.name || item.id) +
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
      const box = getLocal(tx, ty) || normalizeRecord({});
      const ownerName = box.ownerName || (box.ownerAccountId ? box.ownerAccountId.slice(0, 20) : "none");
      const ownerView = isOwner(box);
      const storedRows = buildStoredRows(box.items);
      const totalStored = getStoredCount(box.items);

      let bodyHtml =
        "<div class='vending-section'>" +
          "<div class='vending-stat-grid'>" +
            "<div class='vending-stat'><span>Owner</span><strong>@" + esc(ownerName) + "</strong></div>" +
            "<div class='vending-stat'><span>Stored</span><strong>" + totalStored + " items</strong></div>" +
          "</div>" +
        "</div>" +
        "<div class='vending-section'>" +
          "<div class='vending-section-title'>Stored Items</div>" +
          (storedRows || "<div class='vending-empty'>No donations yet.</div>") +
        "</div>";

      if (ownerView) {
        bodyHtml += "<div class='vending-auto-stock-note'>Only you can collect from your donation box.</div>";
        els.actions.innerHTML =
          "<button data-donation-act='collect'" + (totalStored > 0 ? "" : " disabled") + ">Collect All</button>" +
          "<button data-donation-act='close'>Close</button>";
      } else {
        const pending = getPendingForTile(tx, ty);
        const pendingRows = buildPendingRows(pending);
        bodyHtml +=
          "<div class='vending-section'>" +
            "<div class='vending-section-title'>Your Donation</div>" +
            "<div class='vending-auto-stock-note'>Drag items from the inventory panel into this box.</div>" +
            "<div class='trade-offer donation-drop-zone' data-donation-drop='basket'>" +
              (pendingRows || "<div class='trade-offer-empty'>Drop items here.</div>") +
            "</div>" +
          "</div>";
        els.actions.innerHTML =
          "<button data-donation-act='donate'" + (Object.keys(pending).length ? "" : " disabled") + ">Donate</button>" +
          "<button data-donation-act='clear'>Clear Offer</button>" +
          "<button data-donation-act='close'>Close</button>";
      }

      els.title.textContent = "Donation Box (" + tx + "," + ty + ")";
      els.body.innerHTML = bodyHtml;
      els.modal.classList.add("inventory-passive");
      els.modal.classList.remove("hidden");
    }

    function getDonationRefForTile(tx, ty) {
      const network = get("getNetwork", null);
      const worldId = String(get("getCurrentWorldId", "") || "");
      const basePath = String(get("getBasePath", "") || "");
      if (!network || !network.enabled || !network.db) return null;
      return network.db.ref(basePath + "/worlds/" + worldId + "/donation-boxes/" + getTileKey(tx, ty));
    }

    function seedOwner(tx, ty) {
      const ref = getDonationRefForTile(tx, ty);
      if (!ref) return;
      const firebaseRef = get("getFirebase", null);
      const profileId = String(get("getPlayerProfileId", "") || "");
      if (!profileId) return;
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

    function getAvailableForToken(token) {
      const parsed = parseItemToken(token);
      if (!parsed) return 0;
      if (parsed.type === "cosmetic") {
        const cosmeticInventory = get("getCosmeticInventory", {}) || {};
        return Math.max(0, Math.floor(Number(cosmeticInventory[parsed.cosmeticId]) || 0));
      }
      const inventory = get("getInventory", {}) || {};
      return Math.max(0, Math.floor(Number(inventory[parsed.blockId]) || 0));
    }

    function addPendingDonation(entry, amount) {
      if (!editCtx) return false;
      const tx = editCtx.tx;
      const ty = editCtx.ty;
      const box = getLocal(tx, ty);
      if (!box || isOwner(box)) return false;
      const type = String(entry && entry.type || "");
      if (type !== "block" && type !== "cosmetic") return false;

      let token = "";
      if (type === "cosmetic") {
        const cosmeticId = String(entry.cosmeticId || "");
        if (!cosmeticId) return false;
        token = "c:" + cosmeticId;
      } else {
        const blockId = Math.max(0, Math.floor(Number(entry.blockId) || 0));
        if (!blockId) return false;
        token = "b:" + blockId;
      }

      const pending = { ...getPendingForTile(tx, ty) };
      const currentPending = Math.max(0, Math.floor(Number(pending[token]) || 0));
      const available = getAvailableForToken(token);
      const free = Math.max(0, available - currentPending);
      if (free <= 0) return false;
      const qty = Math.max(1, Math.min(free, Math.floor(Number(amount) || 1)));
      pending[token] = currentPending + qty;
      setPendingForTile(tx, ty, pending);
      return true;
    }

    function clearPending(tx, ty) {
      setPendingForTile(tx, ty, {});
    }

    function consumePendingIntoInventoryDelta(tx, ty) {
      const pending = getPendingForTile(tx, ty);
      const out = {};
      for (const [token, wantedRaw] of Object.entries(pending)) {
        const wanted = Math.max(0, Math.floor(Number(wantedRaw) || 0));
        if (!wanted) continue;
        const available = getAvailableForToken(token);
        const qty = Math.max(0, Math.min(wanted, available));
        if (!qty) continue;
        out[token] = qty;
      }
      return out;
    }

    function applySpend(tokensToSpend) {
      const inventory = get("getInventory", {}) || {};
      const cosmeticInventory = get("getCosmeticInventory", {}) || {};
      const clampInventoryCount = opts.clampInventoryCount || ((value) => Math.max(0, Math.floor(Number(value) || 0)));
      for (const [token, qtyRaw] of Object.entries(tokensToSpend || {})) {
        const qty = Math.max(0, Math.floor(Number(qtyRaw) || 0));
        if (!qty) continue;
        const parsed = parseItemToken(token);
        if (!parsed) continue;
        if (parsed.type === "cosmetic") {
          const current = Math.max(0, Math.floor(Number(cosmeticInventory[parsed.cosmeticId]) || 0));
          cosmeticInventory[parsed.cosmeticId] = Math.max(0, current - qty);
        } else {
          const current = clampInventoryCount(inventory[parsed.blockId]);
          inventory[parsed.blockId] = clampInventoryCount(current - qty);
        }
      }
    }

    function donatePending(tx, ty) {
      const post = opts.postLocalSystemChat || (() => {});
      const network = get("getNetwork", null);
      if (!network || !network.enabled || !network.donationRef) return;
      const box = getLocal(tx, ty);
      if (!box || isOwner(box)) {
        post("Only non-owners donate through this menu.");
        return;
      }

      const spend = consumePendingIntoInventoryDelta(tx, ty);
      if (!Object.keys(spend).length) {
        post("No donation items selected.");
        return;
      }

      const key = getTileKey(tx, ty);
      const playerProfileId = String(get("getPlayerProfileId", "") || "");
      const playerName = String(get("getPlayerName", "") || "").slice(0, 20);
      const firebaseRef = get("getFirebase", null);
      network.donationRef.child(key).transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw);
        const ownerAccountId = current.ownerAccountId || playerProfileId;
        const ownerName = current.ownerName || playerName;
        const items = { ...(current.items || {}) };
        for (const [token, qtyRaw] of Object.entries(spend)) {
          const qty = Math.max(0, Math.floor(Number(qtyRaw) || 0));
          if (!qty) continue;
          items[token] = Math.max(0, Math.floor(Number(items[token]) || 0)) + qty;
        }
        return {
          ownerAccountId,
          ownerName,
          items,
          updatedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        };
      }).then((result) => {
        if (!result.committed) {
          post("Donation failed.");
          return;
        }
        applySpend(spend);
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar();
        clearPending(tx, ty);
        renderModal();
        post("Donation sent.");
      }).catch(() => {
        post("Donation failed.");
      });
    }

    function collectAll(tx, ty) {
      const post = opts.postLocalSystemChat || (() => {});
      const network = get("getNetwork", null);
      if (!network || !network.enabled || !network.donationRef) return;
      const key = getTileKey(tx, ty);
      const playerProfileId = String(get("getPlayerProfileId", "") || "");
      const playerName = String(get("getPlayerName", "") || "").slice(0, 20);
      const firebaseRef = get("getFirebase", null);
      let collected = {};
      network.donationRef.child(key).transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw);
        if (!current.ownerAccountId || current.ownerAccountId !== playerProfileId) return currentRaw;
        collected = { ...(current.items || {}) };
        return {
          ownerAccountId: current.ownerAccountId,
          ownerName: current.ownerName || playerName,
          items: {},
          updatedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        };
      }).then((result) => {
        if (!result.committed) {
          post("Only the donation box owner can collect.");
          return;
        }
        const inventory = get("getInventory", {}) || {};
        const cosmeticInventory = get("getCosmeticInventory", {}) || {};
        const clampInventoryCount = opts.clampInventoryCount || ((value) => Math.max(0, Math.floor(Number(value) || 0)));
        let total = 0;
        let overflow = 0;
        for (const [token, qtyRaw] of Object.entries(collected || {})) {
          const qty = Math.max(0, Math.floor(Number(qtyRaw) || 0));
          if (!qty) continue;
          const parsed = parseItemToken(token);
          if (!parsed) continue;
          if (parsed.type === "cosmetic") {
            cosmeticInventory[parsed.cosmeticId] = Math.max(0, Math.floor(Number(cosmeticInventory[parsed.cosmeticId]) || 0)) + qty;
            total += qty;
            continue;
          }
          const current = clampInventoryCount(inventory[parsed.blockId]);
          const next = clampInventoryCount(current + qty);
          const added = Math.max(0, next - current);
          inventory[parsed.blockId] = next;
          total += added;
          overflow += Math.max(0, qty - added);
        }
        if (total <= 0) {
          post("No donations to collect.");
          return;
        }
        if (typeof opts.saveInventory === "function") opts.saveInventory();
        if (typeof opts.refreshToolbar === "function") opts.refreshToolbar();
        renderModal();
        if (overflow > 0) {
          post("Collected " + total + " item(s). " + overflow + " could not fit (inventory cap).");
        } else {
          post("Collected " + total + " item(s).");
        }
      }).catch(() => {
        post("Failed to collect donations.");
      });
    }

    function handleActionClick(event) {
      const target = event && event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = String(target.dataset.donationAct || "").trim();
      if (!action || !editCtx) return;
      const tx = editCtx.tx;
      const ty = editCtx.ty;
      if (action === "close") {
        closeModal();
        return;
      }
      if (action === "clear") {
        clearPending(tx, ty);
        renderModal();
        return;
      }
      if (action === "donate") {
        donatePending(tx, ty);
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
      const modal = get("getDonationModalEl", null);
      return Boolean(editCtx && modal && !modal.classList.contains("hidden"));
    }

    function renderOpen() {
      if (isOpen()) renderModal();
    }

    function onBroken(tx, ty) {
      setLocal(tx, ty, null);
      if (editCtx && editCtx.tx === tx && editCtx.ty === ty) {
        closeModal();
      }
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

    function handleInventoryDragEnd(entry, amount, clientX, clientY) {
      if (!isOpen()) return { handled: false, blockWorldDrop: false };
      if (!entry || entry.source === "trade_offer") return { handled: false, blockWorldDrop: false };
      if (!editCtx) return { handled: false, blockWorldDrop: false };
      const box = getLocal(editCtx.tx, editCtx.ty);
      if (!box || isOwner(box)) return { handled: false, blockWorldDrop: false };

      const body = get("getDonationBodyEl", null);
      if (!(body instanceof HTMLElement)) return { handled: false, blockWorldDrop: false };
      const zone = body.querySelector("[data-donation-drop='basket']");
      const x = Number(clientX);
      const y = Number(clientY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { handled: false, blockWorldDrop: false };
      const zoneRect = zone instanceof HTMLElement ? zone.getBoundingClientRect() : null;
      const bodyRect = body.getBoundingClientRect();
      const insideZone = Boolean(zoneRect && x >= zoneRect.left && x <= zoneRect.right && y >= zoneRect.top && y <= zoneRect.bottom);
      const insideBody = x >= bodyRect.left && x <= bodyRect.right && y >= bodyRect.top && y <= bodyRect.bottom;
      const inside = insideZone || insideBody;
      if (!inside) return { handled: false, blockWorldDrop: false };

      const added = addPendingDonation(entry, amount);
      if (!added) return { handled: false, blockWorldDrop: true };
      renderModal();
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
      seedOwner,
      closeModal,
      openModal,
      isOpen,
      renderOpen,
      onBroken,
      onPlaced,
      handleInventoryDragEnd
    };
  }

  return { createController };
})();
