window.GTModules = window.GTModules || {};

window.GTModules.vending = (function createVendingModule() {
  function createController(options) {
    const opts = options || {};
    const machines = new Map();
    let modalCtx = null;
    let pendingInventoryPick = null;
    const pendingListingByTile = new Map();

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

    function parseItemToken(tokenRaw) {
      const token = String(tokenRaw || "").trim();
      if (!token) return null;
      if (token.startsWith("b:")) {
        const id = Math.floor(Number(token.slice(2)) || 0);
        if (!id) return null;
        return { type: "block", blockId: id, cosmeticId: "", token: "b:" + id };
      }
      if (token.startsWith("c:")) {
        const cosmeticId = token.slice(2).trim();
        if (!cosmeticId) return null;
        return { type: "cosmetic", blockId: 0, cosmeticId, token: "c:" + cosmeticId };
      }
      return null;
    }

    function getCosmeticItemMap() {
      const out = {};
      const items = Array.isArray(get("getCosmeticItems", [])) ? get("getCosmeticItems", []) : [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || !item.id) continue;
        out[item.id] = item;
      }
      return out;
    }

    function normalizeRecord(value) {
      if (!value || typeof value !== "object") return null;
      const ownerAccountId = (value.ownerAccountId || "").toString();
      if (!ownerAccountId) return null;
      const rawType = String(value.sellType || "").toLowerCase();
      const sellBlockId = Math.max(0, Math.floor(Number(value.sellBlockId) || 0));
      const sellCosmeticId = String(value.sellCosmeticId || "").trim();
      const sellType = rawType === "cosmetic"
        ? "cosmetic"
        : (sellCosmeticId ? "cosmetic" : "block");
      const sellQuantity = Math.max(1, Math.floor(Number(value.sellQuantity) || 1));
      const getBlockKeyById = opts.getBlockKeyById || ((id) => "block_" + id);
      return {
        ownerAccountId,
        ownerName: (value.ownerName || "").toString().slice(0, 20),
        sellType,
        sellBlockId: sellType === "block" ? sellBlockId : 0,
        sellCosmeticId: sellType === "cosmetic" ? sellCosmeticId : "",
        sellQuantity,
        sellBlockKey: (value.sellBlockKey || getBlockKeyById(sellBlockId)).toString(),
        priceLocks: Math.max(0, Math.floor(Number(value.priceLocks) || 0)),
        stock: Math.max(0, Math.floor(Number(value.stock) || 0)),
        earningsLocks: Math.max(0, Math.floor(Number(value.earningsLocks) || 0)),
        updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0
      };
    }

    function setLocal(tx, ty, value) {
      const key = getTileKey(tx, ty);
      const normalized = normalizeRecord(value);
      if (!normalized) {
        machines.delete(key);
        return;
      }
      machines.set(key, normalized);
    }

    function getLocal(tx, ty) {
      return machines.get(getTileKey(tx, ty)) || null;
    }

    function canManage(vm) {
      const pid = get("getPlayerProfileId", "");
      return Boolean(vm && pid && vm.ownerAccountId === pid);
    }

    function getCurrencyIds() {
      const worldLockId = Math.max(0, Math.floor(Number(get("getWorldLockId", 0)) || 0));
      const obsidianLockId = Math.max(0, Math.floor(Number(get("getObsidianLockId", 0)) || 0));
      return { worldLockId, obsidianLockId };
    }

    function getTotalLocksFromInventory(inv) {
      const fn = get("getTotalLockValue", null);
      if (typeof fn === "function") {
        return Math.max(0, Math.floor(Number(fn(inv)) || 0));
      }
      const { worldLockId, obsidianLockId } = getCurrencyIds();
      const wl = Math.max(0, Math.floor(Number(inv && inv[worldLockId]) || 0));
      const ob = Math.max(0, Math.floor(Number(inv && inv[obsidianLockId]) || 0));
      return wl + (ob * 100);
    }

    function setCanonicalLocksToInventory(inv, totalLocks) {
      const fn = get("distributeLockValueToInventory", null);
      if (typeof fn === "function") {
        fn(inv, totalLocks);
        return;
      }
      const { worldLockId, obsidianLockId } = getCurrencyIds();
      const total = Math.max(0, Math.floor(Number(totalLocks) || 0));
      const nextOb = Math.floor(total / 100);
      const nextWl = total % 100;
      inv[worldLockId] = nextWl;
      if (obsidianLockId > 0) inv[obsidianLockId] = nextOb;
    }

    function addLocksToLocalInventory(inv, amount) {
      const fn = get("addLockValue", null);
      if (typeof fn === "function") {
        fn(inv, amount);
        return;
      }
      const total = getTotalLocksFromInventory(inv) + Math.max(0, Math.floor(Number(amount) || 0));
      setCanonicalLocksToInventory(inv, total);
    }

    function spendLocksFromLocalInventory(inv, amount) {
      const fn = get("spendLockValue", null);
      if (typeof fn === "function") {
        return Boolean(fn(inv, amount));
      }
      const cost = Math.max(0, Math.floor(Number(amount) || 0));
      const total = getTotalLocksFromInventory(inv);
      if (total < cost) return false;
      setCanonicalLocksToInventory(inv, total - cost);
      return true;
    }

    function getListingIdentity(vm) {
      if (!vm) return null;
      if (vm.sellType === "cosmetic") {
        const id = String(vm.sellCosmeticId || "");
        if (!id) return null;
        return "c:" + id;
      }
      const id = Math.max(0, Math.floor(Number(vm.sellBlockId) || 0));
      if (!id) return null;
      return "b:" + id;
    }

    function getListingLabel(vm) {
      if (!vm) return "none";
      const getBlockKeyById = opts.getBlockKeyById || ((id) => "block_" + id);
      if (vm.sellType === "cosmetic") {
        const cmap = getCosmeticItemMap();
        const cid = String(vm.sellCosmeticId || "");
        const item = cmap[cid];
        return item ? item.name : (cid || "none");
      }
      const id = Math.max(0, Math.floor(Number(vm.sellBlockId) || 0));
      return id ? getBlockKeyById(id) : "none";
    }

    function getModalEls() {
      return {
        modal: get("getVendingModalEl", null),
        title: get("getVendingTitleEl", null),
        body: get("getVendingBodyEl", null),
        actions: get("getVendingActionsEl", null)
      };
    }

    function closeModal() {
      modalCtx = null;
      const els = getModalEls();
      if (els.modal) els.modal.classList.add("hidden");
    }

    function renderModal(tx, ty, vm) {
      const els = getModalEls();
      if (!els.modal || !els.title || !els.body || !els.actions) return;
      const owner = vm.ownerName || "owner";
      const bundleQty = Math.max(1, Math.floor(Number(vm.sellQuantity) || 1));
      const canManageMachine = canManage(vm) || (!vm.ownerAccountId && get("getPlayerProfileId", ""));
      const listingLabel = getListingLabel(vm);
      const tileKey = getTileKey(tx, ty);
      const selectedToken = pendingListingByTile.get(tileKey) || getListingIdentity(vm) || "";
      const selectedParsed = parseItemToken(selectedToken);
      const selectedLabel = selectedParsed
        ? (selectedParsed.type === "cosmetic"
          ? getListingLabel({ sellType: "cosmetic", sellCosmeticId: selectedParsed.cosmeticId })
          : getListingLabel({ sellType: "block", sellBlockId: selectedParsed.blockId }))
        : "None selected";
      const buyBundleMax = Math.max(0, Math.floor((vm.stock || 0) / bundleQty));
      const canBuy = Boolean(selectedToken && vm.stock >= bundleQty && vm.priceLocks > 0);
      els.title.textContent = "Vending Machine (" + tx + "," + ty + ")";

      let bodyHtml =
        '<div class="vending-section">' +
        '<div class="vending-section-title">Machine</div>' +
        '<div class="vending-stat-grid">' +
        '<div class="vending-stat"><span>Owner</span><strong>@' + esc(owner) + '</strong></div>' +
        '<div class="vending-stat"><span>Listing</span><strong>' + esc(listingLabel) + '</strong></div>' +
        '<div class="vending-stat"><span>Offer</span><strong>' + bundleQty + ' for ' + (vm.priceLocks || 0) + ' WL</strong></div>' +
        '<div class="vending-stat"><span>Stock</span><strong>' + (vm.stock || 0) + ' (' + buyBundleMax + ' buys)</strong></div>' +
        '<div class="vending-stat"><span>Earnings</span><strong>' + (vm.earningsLocks || 0) + ' WL</strong></div>' +
        '</div>' +
        '</div>';

      if (canManageMachine) {
        bodyHtml +=
          '<div class="vending-owner-layout">' +
          '<div class="vending-section vending-owner-main">' +
          '<div class="vending-edit-title">Edit Listing</div>' +
          '<input type="hidden" data-vending-input="item" value="' + esc(selectedToken) + '">' +
          '<div class="vending-select-row">' +
          '<button type="button" class="vending-pick-trigger" data-vending-act="pickitem">Select From Inventory</button>' +
          '<div class="vending-selected-label">' + esc(selectedLabel) + '</div>' +
          '</div>' +
          '<div class="vending-field-grid">' +
          '<label class="vending-field"><span>Quantity</span><input data-vending-input="packQty" type="number" min="1" step="1" value="' + bundleQty + '"></label>' +
          '<label class="vending-field"><span>Price (WL)</span><input data-vending-input="price" type="number" min="1" step="1" value="' + Math.max(1, vm.priceLocks || 1) + '"></label>' +
          '</div>' +
          '<div class="vending-auto-stock-note">Stock auto-fills from all owned amount of selected item.</div>' +
          '</div>' +
          '<div class="vending-section vending-owner-buy">' +
          '<div class="vending-section-title">Buy</div>' +
          '<div class="vending-field-grid">' +
          '<label class="vending-field"><span>Buy Amount</span><input data-vending-input="buyAmount" type="number" min="1" step="1" value="1"></label>' +
          '</div>' +
          '<div class="vending-owner-buy-actions">' +
          '<button data-vending-act="buy"' + (canBuy ? "" : " disabled") + '>Buy</button>' +
          '</div>' +
          '</div>' +
          '</div>';
      } else {
        bodyHtml +=
          '<div class="vending-section">' +
          '<div class="vending-section-title">Buy</div>' +
          '<div class="vending-field-grid">' +
          '<label class="vending-field"><span>Buy Amount</span><input data-vending-input="buyAmount" type="number" min="1" step="1" value="1"></label>' +
          '</div>' +
          '</div>';
      }

      els.body.innerHTML = bodyHtml;

      const buyDisabled = canBuy ? "" : " disabled";
      if (canManageMachine) {
        els.actions.innerHTML =
          '<button data-vending-act="configure">Save Listing</button>' +
          '<button data-vending-act="collect">Collect Earnings</button>' +
          '<button data-vending-act="clear">Clear Machine</button>';
      } else {
        els.actions.innerHTML = '<button data-vending-act="buy"' + buyDisabled + '>Buy</button>';
      }

      modalCtx = { tx, ty };
      els.modal.classList.remove("hidden");
    }

    function createOrUpdateMachine(tx, ty, updater) {
      const key = getTileKey(tx, ty);
      const network = get("getNetwork", null);
      const basePath = get("getBasePath", "");
      const worldId = get("getCurrentWorldId", "");
      const playerProfileId = get("getPlayerProfileId", "");
      const playerName = (get("getPlayerName", "") || "").toString().slice(0, 20);
      const firebaseRef = get("getFirebase", null);
      if (!network || !network.enabled || !network.db) {
        const current = getLocal(tx, ty) || {
          ownerAccountId: playerProfileId || "",
          ownerName: playerName,
          sellType: "block",
          sellBlockId: 0,
          sellCosmeticId: "",
          sellQuantity: 1,
          sellBlockKey: "",
          priceLocks: 0,
          stock: 0,
          earningsLocks: 0,
          updatedAt: Date.now()
        };
        const next = updater(current);
        setLocal(tx, ty, next);
        return Promise.resolve(next);
      }
      const base = String(basePath) + "/worlds/" + String(worldId) + "/vending/" + key;
      return network.db.ref(base).transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw) || {
          ownerAccountId: playerProfileId || "",
          ownerName: playerName,
          sellType: "block",
          sellBlockId: 0,
          sellCosmeticId: "",
          sellQuantity: 1,
          sellBlockKey: "",
          priceLocks: 0,
          stock: 0,
          earningsLocks: 0,
          updatedAt: 0
        };
        const next = updater(current);
        if (!next) return currentRaw;
        return {
          ...next,
          updatedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        };
      }).then((result) => {
        if (!result.committed) return null;
        const value = result.snapshot && typeof result.snapshot.val === "function" ? result.snapshot.val() : null;
        setLocal(tx, ty, value);
        return normalizeRecord(value);
      });
    }

    function seedOwner(tx, ty) {
      const network = get("getNetwork", null);
      const firebaseRef = get("getFirebase", null);
      if (!network || !network.enabled || !network.db) return;
      const pid = get("getPlayerProfileId", "");
      if (!pid) return;
      const worldId = get("getCurrentWorldId", "");
      const basePath = get("getBasePath", "");
      const key = getTileKey(tx, ty);
      const name = (get("getPlayerName", "") || "").toString().slice(0, 20);
      network.db.ref(basePath + "/worlds/" + worldId + "/vending/" + key).transaction((currentRaw) => {
        const current = normalizeRecord(currentRaw);
        if (current && current.ownerAccountId) return currentRaw;
        return {
          ownerAccountId: pid,
          ownerName: name,
          sellType: "block",
          sellBlockId: 0,
          sellCosmeticId: "",
          sellQuantity: 1,
          sellBlockKey: "",
          priceLocks: 0,
          stock: 0,
          earningsLocks: 0,
          updatedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        };
      }).catch(() => {});
    }

    function configureMachine(tx, ty, vm) {
      const post = opts.postLocalSystemChat || (() => {});
      if (!canManage(vm)) {
        post("Only the vending owner can configure this machine.");
        return;
      }
      const els = getModalEls();
      const itemInput = els.body ? els.body.querySelector('[data-vending-input="item"]') : null;
      const packQtyInput = els.body ? els.body.querySelector('[data-vending-input="packQty"]') : null;
      const priceInput = els.body ? els.body.querySelector('[data-vending-input="price"]') : null;
      if (!itemInput || !packQtyInput || !priceInput) {
        post("Listing controls are missing.");
        return;
      }

      const selected = parseItemToken(itemInput.value);
      if (!selected) {
        post("Select an item to list.");
        return;
      }

      const inventory = get("getInventory", {});
      const cosmeticInv = get("getCosmeticInventory", {});
      const inventoryIds = get("getInventoryIds", []);
      const cosmetics = Array.isArray(get("getCosmeticItems", [])) ? get("getCosmeticItems", []) : [];
      const cosmeticSet = new Set(cosmetics.map((it) => it && it.id).filter(Boolean));
      const getBlockKeyById = opts.getBlockKeyById || ((id) => "block_" + id);

      if (selected.type === "block" && !inventoryIds.includes(selected.blockId)) {
        post("Invalid block selection.");
        return;
      }
      if (selected.type === "cosmetic" && !cosmeticSet.has(selected.cosmeticId)) {
        post("Invalid cosmetic selection.");
        return;
      }

      const previousToken = getListingIdentity(vm) || "";
      const sameListing = previousToken === selected.token;
      const currentStockForListing = sameListing ? Math.max(0, Math.floor(Number(vm.stock) || 0)) : 0;
      const ownedNow = selected.type === "block"
        ? Math.max(0, Math.floor(Number(inventory[selected.blockId]) || 0))
        : Math.max(0, Math.floor(Number(cosmeticInv[selected.cosmeticId]) || 0));
      const desiredStock = currentStockForListing + ownedNow;
      const delta = desiredStock - currentStockForListing;

      const sellQuantity = Math.max(1, Math.floor(Number(packQtyInput.value) || 0));
      const priceLocks = Math.max(1, Math.floor(Number(priceInput.value) || 0));

      createOrUpdateMachine(tx, ty, (current) => ({
        ownerAccountId: current.ownerAccountId || (get("getPlayerProfileId", "") || ""),
        ownerName: current.ownerName || (get("getPlayerName", "") || "").toString().slice(0, 20),
        sellType: selected.type,
        sellBlockId: selected.type === "block" ? selected.blockId : 0,
        sellCosmeticId: selected.type === "cosmetic" ? selected.cosmeticId : "",
        sellQuantity,
        sellBlockKey: selected.type === "block" ? getBlockKeyById(selected.blockId) : "",
        priceLocks,
        stock: desiredStock,
        earningsLocks: current.earningsLocks || 0
      })).then(() => {
        if (!sameListing && vm && vm.stock > 0) {
          if (vm.sellType === "cosmetic" && vm.sellCosmeticId) {
            cosmeticInv[vm.sellCosmeticId] = Math.max(0, Math.floor((cosmeticInv[vm.sellCosmeticId] || 0) + vm.stock));
          } else if (vm.sellBlockId) {
            inventory[vm.sellBlockId] = Math.max(0, Math.floor((inventory[vm.sellBlockId] || 0) + vm.stock));
          }
        }
        if (selected.type === "cosmetic") {
          cosmeticInv[selected.cosmeticId] = Math.max(0, Math.floor((cosmeticInv[selected.cosmeticId] || 0) - delta));
        } else {
          inventory[selected.blockId] = Math.max(0, Math.floor((inventory[selected.blockId] || 0) - delta));
        }
        (opts.saveInventory || (() => {}))();
        (opts.refreshToolbar || (() => {}))();
        pendingListingByTile.delete(getTileKey(tx, ty));
        post("Vending listing updated.");
      }).catch(() => {
        post("Failed to update vending machine.");
      });
    }

    function handleInventoryPick(selection) {
      if (!pendingInventoryPick) return false;
      if (!selection || typeof selection !== "object") return false;
      const inv = get("getInventory", {});
      const cosmeticInv = get("getCosmeticInventory", {});
      let token = "";
      if (selection.type === "block") {
        const id = Math.max(0, Math.floor(Number(selection.blockId) || 0));
        if (!id) return false;
        if ((Number(inv[id]) || 0) <= 0) return false;
        token = "b:" + id;
      } else if (selection.type === "cosmetic") {
        const cosmeticId = String(selection.cosmeticId || "").trim();
        if (!cosmeticId) return false;
        if ((Number(cosmeticInv[cosmeticId]) || 0) <= 0) return false;
        token = "c:" + cosmeticId;
      } else {
        return false;
      }
      const tx = pendingInventoryPick.tx;
      const ty = pendingInventoryPick.ty;
      pendingInventoryPick = null;
      pendingListingByTile.set(getTileKey(tx, ty), token);
      const vm = getLocal(tx, ty) || {
        ownerAccountId: "",
        ownerName: "",
        sellType: "block",
        sellBlockId: 0,
        sellCosmeticId: "",
        sellQuantity: 1,
        sellBlockKey: "",
        priceLocks: 0,
        stock: 0,
        earningsLocks: 0
      };
      renderModal(tx, ty, vm);
      const currentVm = getLocal(tx, ty) || vm;
      if (canManage(currentVm)) {
        configureMachine(tx, ty, currentVm);
      }
      const post = opts.postLocalSystemChat || (() => {});
      post("Listing item selected from inventory.");
      return true;
    }

    function collectEarnings(tx, ty, vm) {
      const post = opts.postLocalSystemChat || (() => {});
      if (!canManage(vm)) {
        post("Only the vending owner can collect earnings.");
        return;
      }
      const earnings = Math.max(0, Math.floor(vm.earningsLocks || 0));
      if (earnings <= 0) {
        post("No earnings to collect.");
        return;
      }
      const inventory = get("getInventory", {});
      createOrUpdateMachine(tx, ty, (current) => ({ ...current, earningsLocks: 0 })).then(() => {
        addLocksToLocalInventory(inventory, earnings);
        (opts.saveInventory || (() => {}))();
        (opts.refreshToolbar || (() => {}))();
        post("Collected " + earnings + " World Locks from vending.");
      }).catch(() => {
        post("Failed to collect vending earnings.");
      });
    }

    function clearMachine(tx, ty, vm) {
      const post = opts.postLocalSystemChat || (() => {});
      if (!canManage(vm)) {
        post("Only the vending owner can clear this machine.");
        return;
      }
      const stock = Math.max(0, Math.floor(vm.stock || 0));
      const earnings = Math.max(0, Math.floor(vm.earningsLocks || 0));
      if (stock <= 0 && earnings <= 0) {
        post("Machine is already empty.");
        return;
      }
      const listingLabel = getListingLabel(vm);
      const parts = [];
      if (stock > 0) parts.push(stock + "x " + listingLabel);
      if (earnings > 0) parts.push(earnings + " WL");
      if (!window.confirm("Clear machine and claim " + parts.join(" + ") + "?")) return;

      const inventory = get("getInventory", {});
      const cosmeticInv = get("getCosmeticInventory", {});
      let claimedStock = 0;
      let claimedEarnings = 0;
      let claimedType = "block";
      let claimedBlockId = 0;
      let claimedCosmeticId = "";
      createOrUpdateMachine(tx, ty, (current) => {
        claimedStock = Math.max(0, Math.floor(Number(current && current.stock) || 0));
        claimedEarnings = Math.max(0, Math.floor(Number(current && current.earningsLocks) || 0));
        claimedType = current && current.sellType === "cosmetic" ? "cosmetic" : "block";
        claimedBlockId = Math.max(0, Math.floor(Number(current && current.sellBlockId) || 0));
        claimedCosmeticId = String(current && current.sellCosmeticId || "");
        return { ...current, stock: 0, earningsLocks: 0 };
      }).then(() => {
        if (claimedEarnings > 0) {
          addLocksToLocalInventory(inventory, claimedEarnings);
        }
        if (claimedStock > 0) {
          if (claimedType === "cosmetic" && claimedCosmeticId) {
            cosmeticInv[claimedCosmeticId] = Math.max(0, Math.floor((cosmeticInv[claimedCosmeticId] || 0) + claimedStock));
          } else if (claimedBlockId > 0) {
            inventory[claimedBlockId] = Math.max(0, Math.floor((inventory[claimedBlockId] || 0) + claimedStock));
          }
        }
        (opts.saveInventory || (() => {}))();
        (opts.refreshToolbar || (() => {}))();
        const resultParts = [];
        if (claimedStock > 0) resultParts.push("returned " + claimedStock + "x " + listingLabel);
        if (claimedEarnings > 0) resultParts.push("collected " + claimedEarnings + " WL");
        post(resultParts.length ? ("Machine cleared: " + resultParts.join(", ") + ".") : "Machine cleared.");
      }).catch(() => {
        post("Failed to clear machine.");
      });
    }

    function removeMachine(tx, ty, vm) {
      const post = opts.postLocalSystemChat || (() => {});
      if (!canManage(vm)) {
        post("Only the vending owner can remove this machine.");
        return;
      }
      if ((vm.stock || 0) > 0 || (vm.earningsLocks || 0) > 0) {
        post("Empty stock and collect earnings before removing.");
        return;
      }
      const world = get("getWorld", null);
      if (world && world[ty]) world[ty][tx] = 0;
      const inv = get("getInventory", {});
      const vendingId = get("getVendingId", 0);
      inv[vendingId] = Math.max(0, Math.floor((inv[vendingId] || 0) + 1));
      (opts.syncBlock || (() => {}))(tx, ty, 0);
      (opts.saveInventory || (() => {}))();
      (opts.refreshToolbar || (() => {}))();
      machines.delete(getTileKey(tx, ty));
      const network = get("getNetwork", null);
      if (network && network.enabled && network.vendingRef) {
        network.vendingRef.child(getTileKey(tx, ty)).remove().catch(() => {});
      }
      post("Vending machine removed.");
      closeModal();
    }

    function buy(tx, ty, vm) {
      const post = opts.postLocalSystemChat || (() => {});
      const emitPurchase = (details) => {
        if (typeof opts.onVendingPurchase !== "function") return;
        try {
          opts.onVendingPurchase(details || {});
        } catch (error) {
          // keep vending flow resilient even if telemetry callback fails
        }
      };
      const token = getListingIdentity(vm);
      const selected = parseItemToken(token);
      const sellQuantity = Math.max(1, Math.floor(Number(vm && vm.sellQuantity) || 1));
      const stock = Math.max(0, Math.floor(vm && vm.stock || 0));
      const price = Math.max(0, Math.floor(vm && vm.priceLocks || 0));
      const els = getModalEls();
      const buyAmountInput = els.body ? els.body.querySelector('[data-vending-input="buyAmount"]') : null;
      const buyAmount = Math.max(1, Math.floor(Number(buyAmountInput ? buyAmountInput.value : 1) || 1));
      const totalItems = sellQuantity * buyAmount;
      const totalPrice = price * buyAmount;
      const inv = get("getInventory", {});
      const cosmeticInv = get("getCosmeticInventory", {});
      const getBlockKeyById = opts.getBlockKeyById || ((id) => "block_" + id);
      const cmap = getCosmeticItemMap();

      if (!selected || stock < sellQuantity || price <= 0) {
        post("Machine is out of stock.");
        return;
      }
      if (stock < totalItems) {
        post("Not enough stock for that amount.");
        return;
      }
      if (getTotalLocksFromInventory(inv) < totalPrice) {
        post("Not enough World Locks. Need " + totalPrice + ".");
        return;
      }

      const itemLabel = selected.type === "cosmetic"
        ? ((cmap[selected.cosmeticId] && cmap[selected.cosmeticId].name) || selected.cosmeticId)
        : getBlockKeyById(selected.blockId);

      if (!window.confirm("Buy " + totalItems + "x " + itemLabel + " for " + totalPrice + " World Locks?")) return;

      const network = get("getNetwork", null);
      const basePath = get("getBasePath", "");
      const profileId = get("getPlayerProfileId", "");

      if (!network || !network.enabled || !network.db || !network.vendingRef) {
        if (!spendLocksFromLocalInventory(inv, totalPrice)) {
          post("Not enough World Locks.");
          return;
        }
        if (selected.type === "cosmetic") {
          cosmeticInv[selected.cosmeticId] = Math.max(0, Math.floor((cosmeticInv[selected.cosmeticId] || 0) + totalItems));
        } else {
          inv[selected.blockId] = Math.max(0, Math.floor((inv[selected.blockId] || 0) + totalItems));
        }
        (opts.saveInventory || (() => {}))();
        (opts.refreshToolbar || (() => {}))();
        emitPurchase({
          tx,
          ty,
          itemLabel,
          totalItems,
          totalPrice,
          buyerAccountId: profileId || "",
          buyerName: (get("getPlayerName", "") || "").toString().slice(0, 20)
        });
        post("Purchased from vending.");
        return;
      }

      const key = getTileKey(tx, ty);
      const buyerInventoryRef = network.db.ref(basePath + "/player-inventories/" + profileId);
      const machineRef = network.vendingRef.child(key);
      const grantPath = selected.type === "cosmetic"
        ? basePath + "/player-inventories/" + profileId + "/cosmeticItems/" + selected.cosmeticId
        : basePath + "/player-inventories/" + profileId + "/" + selected.blockId;

      buyerInventoryRef.transaction((currentRaw) => {
        const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
        const available = getTotalLocksFromInventory(current);
        if (available < totalPrice) return;
        setCanonicalLocksToInventory(current, available - totalPrice);
        return current;
      }).then((lockResult) => {
        if (!lockResult.committed) {
          post("Not enough World Locks.");
          return Promise.resolve(false);
        }
        return machineRef.transaction((currentRaw) => {
          const current = normalizeRecord(currentRaw);
          if (!current) return currentRaw;
          const currentToken = getListingIdentity(current);
          if (
            currentToken !== token ||
            current.stock < totalItems ||
            current.priceLocks !== price ||
            Math.max(1, Math.floor(Number(current.sellQuantity) || 1)) !== sellQuantity
          ) return;
          return {
            ...current,
            stock: current.stock - totalItems,
            earningsLocks: (current.earningsLocks || 0) + totalPrice,
            updatedAt: Date.now()
          };
        }).then((vmResult) => {
          if (!vmResult.committed) {
            buyerInventoryRef.transaction((currentRaw) => {
              const current = currentRaw && typeof currentRaw === "object" ? { ...currentRaw } : {};
              addLocksToLocalInventory(current, totalPrice);
              return current;
            }).catch(() => {});
            post("Purchase failed (stock changed).");
            return false;
          }
          return network.db.ref(grantPath).transaction((current) => {
            return Math.max(0, Math.floor(Number(current) || 0) + totalItems);
          }).then((grantResult) => {
            if (!grantResult.committed) {
              post("Purchase failed.");
              return false;
            }
            emitPurchase({
              tx,
              ty,
              itemLabel,
              totalItems,
              totalPrice,
              buyerAccountId: profileId || "",
              buyerName: (get("getPlayerName", "") || "").toString().slice(0, 20)
            });
            post("Purchased " + totalItems + "x " + itemLabel + ".");
            return true;
          });
        });
      }).catch(() => {
        post("Purchase failed.");
      });
    }

    function onBreakWithFist(tx, ty) {
      const world = get("getWorld", null);
      const vendingId = get("getVendingId", 0);
      if (!world || !world[ty] || world[ty][tx] !== vendingId) return false;
      const vm = getLocal(tx, ty);
      if (vm && ((vm.stock || 0) > 0 || (vm.earningsLocks || 0) > 0)) {
        const post = opts.postLocalSystemChat || (() => {});
        post("Empty this vending first (stock/earnings) before breaking it.");
        return true;
      }
      const inv = get("getInventory", {});
      world[ty][tx] = 0;
      inv[vendingId] = Math.max(0, Math.floor((inv[vendingId] || 0) + 1));
      (opts.syncBlock || (() => {}))(tx, ty, 0);
      (opts.saveInventory || (() => {}))();
      (opts.refreshToolbar || (() => {}))();
      const network = get("getNetwork", null);
      if (network && network.enabled && network.vendingRef) {
        network.vendingRef.child(getTileKey(tx, ty)).remove().catch(() => {});
      }
      machines.delete(getTileKey(tx, ty));
      closeModal();
      return true;
    }

    function interact(tx, ty) {
      const world = get("getWorld", null);
      const vendingId = get("getVendingId", 0);
      const canEditTarget = opts.canEditTarget || (() => true);
      if (!world || !world[ty] || world[ty][tx] !== vendingId) return;
      if (!canEditTarget(tx, ty)) return;
      let vm = getLocal(tx, ty) || {
        ownerAccountId: "",
        ownerName: "",
        sellType: "block",
        sellBlockId: 0,
        sellCosmeticId: "",
        sellQuantity: 1,
        sellBlockKey: "",
        priceLocks: 0,
        stock: 0,
        earningsLocks: 0
      };
      const pid = get("getPlayerProfileId", "");
      if (!vm.ownerAccountId && pid) {
        seedOwner(tx, ty);
        vm = { ...vm, ownerAccountId: pid, ownerName: (get("getPlayerName", "") || "").toString().slice(0, 20) };
      }
      renderModal(tx, ty, vm);
    }

    function bindModalEvents() {
      const els = getModalEls();
      const closeBtn = get("getVendingCloseBtnEl", null);
      if (closeBtn && !closeBtn.dataset.vendingBound) {
        closeBtn.dataset.vendingBound = "1";
        closeBtn.addEventListener("click", closeModal);
      }
      if (els.modal && !els.modal.dataset.vendingBound) {
        els.modal.dataset.vendingBound = "1";
        els.modal.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (target === els.modal) {
            closeModal();
            return;
          }

          const action = target.dataset.vendingAct;
          if (!action || !modalCtx) return;
          const tx = Number(modalCtx.tx);
          const ty = Number(modalCtx.ty);
          const vm = getLocal(tx, ty) || {
            ownerAccountId: "",
            ownerName: "",
            sellType: "block",
            sellBlockId: 0,
            sellCosmeticId: "",
            sellQuantity: 1,
            sellBlockKey: "",
            priceLocks: 0,
            stock: 0,
            earningsLocks: 0
          };
          if (action === "pickitem") {
            pendingInventoryPick = { tx, ty };
            const post = opts.postLocalSystemChat || (() => {});
            closeModal();
            post("Vending picker active: click an inventory item/cosmetic to select listing.");
            return;
          }
          if (action === "configure") configureMachine(tx, ty, vm);
          if (action === "collect") collectEarnings(tx, ty, vm);
          if (action === "clear") clearMachine(tx, ty, vm);
          if (action === "remove") removeMachine(tx, ty, vm);
          if (action === "buy") buy(tx, ty, vm);
          setTimeout(() => {
            const next = getLocal(tx, ty) || vm;
            renderModal(tx, ty, next);
          }, 120);
        });
      }
    }

    function clearAll() {
      machines.clear();
      pendingInventoryPick = null;
      pendingListingByTile.clear();
      closeModal();
    }

    return {
      normalizeRecord,
      setLocal,
      getLocal,
      createOrUpdateMachine,
      seedOwner,
      configureMachine,
      collectEarnings,
      clearMachine,
      removeMachine,
      buy,
      handleInventoryPick,
      closeModal,
      renderModal,
      interact,
      bindModalEvents,
      clearAll,
      onBreakWithFist
    };
  }

  return {
    createController
  };
})();
