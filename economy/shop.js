window.GTModules = window.GTModules || {};

window.GTModules.shop = (function createShopModule() {
  // Easy to modify: add/remove entries here.
  const SHOP_CATALOG = [
    {
      id: "starter_grass_pack",
      category: "Blocks",
      name: "Starter Grass Pack",
      description: "Great for early building.",
      priceGems: 25,
      grants: { blocks: { 1: 40 } },
      image: "./assets/blocks/terrain/grass.png"
    },
    {
      id: "builder_mix_pack",
      category: "Blocks",
      name: "Builder Mix Pack",
      description: "Dirt, stone and wood bundle.",
      priceGems: 60,
      grants: { blocks: { 2: 35, 3: 25, 4: 25 } },
      image: "./assets/blocks/terrain/dirt.png"
    },
    {
      id: "seed_bundle",
      category: "Seeds",
      name: "Seed Bundle",
      description: "Assorted seeds for farming.",
      priceGems: 100,
      grants: { blocks: { 24: 8, 25: 5, 26: 5, 27: 5, 28: 5, 29: 5 } },
      image: "./assets/blocks/special/tree_seed.png"
    },
    {
      id: "door_lock_seed_set",
      category: "Seeds",
      name: "Door + Lock Seeds",
      description: "Rare seeds for utility items.",
      priceGems: 500,
      grants: { blocks: { 30: 3, 31: 4 } },
      image: "./assets/blocks/special/lock_seed.png"
    },
    {
      id: "sun_shirt_basic",
      category: "Cosmetics",
      name: "Sun Shirt",
      description: "Piece of clothing for sun",
      priceGems: 60,
      grants: { cosmetics: { cloth_tunic: 1 } },
      image: "./assets/cosmetics/clothes/sun_shirt.png"
    },
    {
      id: "basic_gacha_pack",
      category: "Gacha",
      name: "Mystery Block",
      description: "A beginner friendly mystery blocks",
      priceGems: 50,
      grants: { blocks: { 41: 2 } },
      image: "./assets/blocks/special/mystery.png"
    }
  ];

  function createController(options) {
    const opts = options || {};
    let selectedCategory = "All";
    let searchQuery = "";
    let sortMode = "featured";
    let modalEl = null;
    let cardEl = null;
    let titleEl = null;
    let gemsEl = null;
    let metaEl = null;
    let categoriesEl = null;
    let gridEl = null;
    let searchInputEl = null;
    let sortSelectEl = null;
    let closeBtnEl = null;
    let styleInjected = false;

    function get(k, d) {
      const v = opts[k];
      if (typeof v === "function") {
        try {
          const r = v();
          return r === undefined ? d : r;
        } catch (e) {
          return d;
        }
      }
      return v === undefined ? d : v;
    }

    function esc(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function getCatalog() {
      const source = Array.isArray(get("getCatalog", null)) ? get("getCatalog", null) : SHOP_CATALOG;
      return source.map((row) => normalizeEntry(row)).filter(Boolean);
    }

    function normalizeEntry(raw) {
      if (!raw || typeof raw !== "object") return null;
      const id = String(raw.id || "").trim().slice(0, 64);
      if (!id) return null;
      const price = Math.max(1, Math.floor(Number(raw.priceGems) || 0));
      if (!price) return null;
      const blocks = {};
      const cosmetics = {};
      const grants = raw.grants && typeof raw.grants === "object" ? raw.grants : {};
      const blockGrants = grants.blocks && typeof grants.blocks === "object" ? grants.blocks : {};
      const cosmeticGrants = grants.cosmetics && typeof grants.cosmetics === "object" ? grants.cosmetics : {};
      Object.keys(blockGrants).forEach((k) => {
        const idNum = Math.floor(Number(k));
        const qty = Math.max(0, Math.floor(Number(blockGrants[k]) || 0));
        if (idNum > 0 && qty > 0) blocks[idNum] = qty;
      });
      Object.keys(cosmeticGrants).forEach((k) => {
        const idText = String(k || "").trim();
        const qty = Math.max(0, Math.floor(Number(cosmeticGrants[k]) || 0));
        if (idText && qty > 0) cosmetics[idText] = qty;
      });
      return {
        id,
        category: String(raw.category || "General").trim().slice(0, 24) || "General",
        name: String(raw.name || id).trim().slice(0, 48) || id,
        description: String(raw.description || "").trim().slice(0, 160),
        priceGems: price,
        sortWeight: Math.max(0, Math.floor(Number(raw.sortWeight) || 0)),
        grants: { blocks, cosmetics },
        image: String(raw.image || "").trim()
      };
    }

    function getItemLimit() {
      return Math.max(1, Math.floor(Number(get("getInventoryItemLimit", 300)) || 300));
    }

    function getPlayerGems() {
      return Math.max(0, Math.floor(Number(get("getPlayerGems", 0)) || 0));
    }

    function getInventory() {
      return get("getInventory", {}) || {};
    }

    function getCosmeticInventory() {
      return get("getCosmeticInventory", {}) || {};
    }

    function post(text) {
      const fn = opts.postLocalSystemChat;
      if (typeof fn === "function") fn(String(text || "").slice(0, 220));
    }

    function ensureDom() {
      if (modalEl && cardEl) return;
      modalEl = document.createElement("div");
      modalEl.id = "shopModal";
      modalEl.className = "vending-modal shop-modal hidden";
      modalEl.innerHTML =
        "<div class='vending-card trade-card shop-card'>" +
          "<div class='shop-header'>" +
            "<div class='shop-title-wrap'>" +
              "<strong id='shopTitle'>Gem Shop</strong>" +
              "<span class='shop-subtitle'>Spend gems on blocks, seeds and cosmetics.</span>" +
            "</div>" +
            "<button id='shopCloseBtn' type='button'>Close</button>" +
          "</div>" +
          "<div class='shop-toolbar'>" +
            "<label class='shop-tool shop-search'>" +
              "<span>Search</span>" +
              "<input id='shopSearchInput' type='text' maxlength='48' placeholder='Search items or rewards'>" +
            "</label>" +
            "<label class='shop-tool shop-sort'>" +
              "<span>Sort</span>" +
              "<select id='shopSortSelect'>" +
                "<option value='featured'>Featured</option>" +
                "<option value='price_low'>Price: Low to High</option>" +
                "<option value='price_high'>Price: High to Low</option>" +
                "<option value='name_az'>Name: A-Z</option>" +
                "<option value='name_za'>Name: Z-A</option>" +
              "</select>" +
            "</label>" +
            "<div class='shop-balance'>" +
              "<span>Balance</span>" +
              "<strong id='shopGemsLabel'>0 gems</strong>" +
            "</div>" +
          "</div>" +
          "<div id='shopMeta' class='shop-meta'></div>" +
          "<div class='shop-content'>" +
            "<div id='shopCategories' class='shop-categories'></div>" +
            "<div id='shopGrid' class='shop-grid'></div>" +
          "</div>" +
        "</div>";
      document.body.appendChild(modalEl);
      cardEl = modalEl.querySelector(".shop-card");
      titleEl = modalEl.querySelector("#shopTitle");
      gemsEl = modalEl.querySelector("#shopGemsLabel");
      metaEl = modalEl.querySelector("#shopMeta");
      categoriesEl = modalEl.querySelector("#shopCategories");
      gridEl = modalEl.querySelector("#shopGrid");
      searchInputEl = modalEl.querySelector("#shopSearchInput");
      sortSelectEl = modalEl.querySelector("#shopSortSelect");
      closeBtnEl = modalEl.querySelector("#shopCloseBtn");
      if (closeBtnEl) closeBtnEl.addEventListener("click", closeModal);
      modalEl.addEventListener("click", (event) => {
        if (event.target === modalEl) closeModal();
      });
      if (gridEl) gridEl.addEventListener("click", onGridClick);
      if (categoriesEl) categoriesEl.addEventListener("click", onCategoryClick);
      if (searchInputEl) searchInputEl.addEventListener("input", onSearchInput);
      if (sortSelectEl) sortSelectEl.addEventListener("change", onSortChange);
      injectStyles();
    }

    function injectStyles() {
      if (styleInjected) return;
      styleInjected = true;
      // Shop visuals are handled by styles.css so all menus share one theme system.
    }

    function buildGrantRows(entry) {
      const defs = get("getBlockDefs", {}) || {};
      const cosmetics = Array.isArray(get("getCosmeticItems", [])) ? get("getCosmeticItems", []) : [];
      const cosById = {};
      cosmetics.forEach((c) => { if (c && c.id) cosById[c.id] = c; });
      const parts = [];
      Object.keys(entry.grants.blocks).forEach((k) => {
        const id = Number(k);
        const qty = entry.grants.blocks[id];
        const def = defs[id];
        const name = def && def.name ? def.name : ("Block " + id);
        parts.push(name + " x" + qty);
      });
      Object.keys(entry.grants.cosmetics).forEach((id) => {
        const qty = entry.grants.cosmetics[id];
        const item = cosById[id];
        const name = item && item.name ? item.name : id;
        parts.push(name + " x" + qty);
      });
      return parts;
    }

    function formatGrants(entry) {
      const rows = buildGrantRows(entry);
      return rows.join(" | ") || "No rewards configured";
    }

    function getPurchaseState(entry) {
      const gems = getPlayerGems();
      if (gems < entry.priceGems) {
        return {
          allowed: false,
          code: "gems",
          reason: "Need " + (entry.priceGems - gems) + " more gems"
        };
      }
      const inv = getInventory();
      const cosInv = getCosmeticInventory();
      const limit = getItemLimit();
      for (const key of Object.keys(entry.grants.blocks)) {
        const id = Number(key);
        const qty = Math.max(0, Math.floor(Number(entry.grants.blocks[id]) || 0));
        if (!qty) continue;
        const current = Math.max(0, Math.floor(Number(inv[id]) || 0));
        if (current + qty > limit) {
          return {
            allowed: false,
            code: "limit",
            reason: "Inventory limit reached"
          };
        }
      }
      for (const id of Object.keys(entry.grants.cosmetics)) {
        const qty = Math.max(0, Math.floor(Number(entry.grants.cosmetics[id]) || 0));
        if (!qty) continue;
        const current = Math.max(0, Math.floor(Number(cosInv[id]) || 0));
        if (current + qty > limit) {
          return {
            allowed: false,
            code: "limit",
            reason: "Inventory limit reached"
          };
        }
      }
      return {
        allowed: true,
        code: "ok",
        reason: "Ready to buy"
      };
    }

    function canBuy(entry) {
      return getPurchaseState(entry).allowed;
    }

    function buildCategoryInfo(entries) {
      const counts = {};
      entries.forEach((e) => {
        const cat = e.category || "General";
        counts[cat] = (counts[cat] || 0) + 1;
      });
      const list = Object.keys(counts).sort((a, b) => a.localeCompare(b));
      list.unshift("All");
      if (!selectedCategory) selectedCategory = "All";
      if (selectedCategory !== "All" && !counts[selectedCategory]) selectedCategory = "All";
      return { list, counts };
    }

    function sortEntries(entries) {
      const rows = entries.slice();
      if (sortMode === "price_low") {
        rows.sort((a, b) => (a.priceGems - b.priceGems) || a.name.localeCompare(b.name));
        return rows;
      }
      if (sortMode === "price_high") {
        rows.sort((a, b) => (b.priceGems - a.priceGems) || a.name.localeCompare(b.name));
        return rows;
      }
      if (sortMode === "name_az") {
        rows.sort((a, b) => a.name.localeCompare(b.name));
        return rows;
      }
      if (sortMode === "name_za") {
        rows.sort((a, b) => b.name.localeCompare(a.name));
        return rows;
      }
      rows.sort((a, b) => {
        const byWeight = b.sortWeight - a.sortWeight;
        if (byWeight) return byWeight;
        return (a.priceGems - b.priceGems) || a.name.localeCompare(b.name);
      });
      return rows;
    }

    function matchesSearch(entry, query) {
      if (!query) return true;
      const haystack = (
        entry.name + " " +
        entry.description + " " +
        entry.category + " " +
        formatGrants(entry)
      ).toLowerCase();
      return haystack.includes(query);
    }

    function render() {
      ensureDom();
      const entries = getCatalog();
      const categoryInfo = buildCategoryInfo(entries);
      const categories = categoryInfo.list;
      const counts = categoryInfo.counts;

      if (titleEl) titleEl.textContent = "Gem Shop";
      if (gemsEl) gemsEl.textContent = getPlayerGems() + " gems";
      if (searchInputEl && searchInputEl.value !== searchQuery) {
        searchInputEl.value = searchQuery;
      }
      if (sortSelectEl && sortSelectEl.value !== sortMode) {
        sortSelectEl.value = sortMode;
      }

      if (categoriesEl) {
        categoriesEl.innerHTML = categories.map((cat) => {
          const active = cat === selectedCategory ? " active" : "";
          const count = cat === "All" ? entries.length : (counts[cat] || 0);
          return (
            "<button type='button' class='shop-cat-btn" + active + "' data-shop-category='" + esc(cat) + "'>" +
              "<span class='shop-cat-name'>" + esc(cat) + "</span>" +
              "<span class='shop-cat-count'>" + count + "</span>" +
            "</button>"
          );
        }).join("");
      }

      const byCategory = selectedCategory === "All"
        ? entries
        : entries.filter((e) => e.category === selectedCategory);
      const query = String(searchQuery || "").trim().toLowerCase();
      const searched = byCategory.filter((e) => matchesSearch(e, query));
      const filtered = sortEntries(searched);

      if (metaEl) {
        const label = selectedCategory === "All" ? "all categories" : selectedCategory;
        const searchText = query ? (" | search: \"" + esc(searchQuery.trim()) + "\"") : "";
        metaEl.innerHTML = (
          "<strong>" + filtered.length + "</strong> item" + (filtered.length === 1 ? "" : "s") +
          " shown in <strong>" + esc(label) + "</strong>" + searchText
        );
      }

      if (gridEl) {
        if (!filtered.length) {
          gridEl.innerHTML =
            "<div class='shop-empty'>" +
              "<h4>No matching items</h4>" +
              "<p>Try another category or clear search filters.</p>" +
            "</div>";
        } else {
          gridEl.innerHTML = filtered.map((entry) => {
            const purchaseState = getPurchaseState(entry);
            const allowed = purchaseState.allowed;
            const availabilityClass = purchaseState.code === "ok"
              ? "ok"
              : (purchaseState.code === "gems" ? "warn" : "lock");
            const imageHtml = entry.image
              ? (
                "<div class='shop-item-image'>" +
                  "<img src='" + esc(entry.image) + "' alt='" + esc(entry.name) + "' loading='lazy'>" +
                "</div>"
              )
              : (
                "<div class='shop-item-image shop-item-image-placeholder'>" +
                  "<span>No image</span>" +
                "</div>"
              );
            const grantRows = buildGrantRows(entry);
            const grantsHtml = grantRows.length
              ? (
                "<ul class='shop-grants-list'>" +
                  grantRows.map((row) => "<li>" + esc(row) + "</li>").join("") +
                "</ul>"
              )
              : "<div class='shop-grants-empty'>No rewards configured</div>";
            return (
              "<article class='shop-item" + (allowed ? "" : " locked") + "'>" +
                "<div class='shop-item-top'>" +
                  imageHtml +
                  "<div class='shop-item-head'>" +
                    "<span class='shop-item-category'>" + esc(entry.category) + "</span>" +
                    "<h4>" + esc(entry.name) + "</h4>" +
                    "<p>" + esc(entry.description || "No description.") + "</p>" +
                  "</div>" +
                "</div>" +
                "<div class='shop-grants-title'>Includes</div>" +
                grantsHtml +
                "<div class='shop-buy-row'>" +
                  "<div class='shop-price-wrap'>" +
                    "<span class='shop-price'>" + entry.priceGems + "</span>" +
                    "<span class='shop-price-unit'>gems</span>" +
                  "</div>" +
                  "<div class='shop-availability " + availabilityClass + "'>" + esc(purchaseState.reason) + "</div>" +
                  "<button type='button' class='shop-buy' data-shop-buy='" + esc(entry.id) + "'" + (allowed ? "" : " disabled") + ">Buy</button>" +
                "</div>" +
              "</article>"
            );
          }).join("");
        }
      }
    }

    function findEntryById(id) {
      const list = getCatalog();
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    }

    function performPurchase(entry) {
      if (!entry) return;
      const purchaseState = getPurchaseState(entry);
      if (!purchaseState.allowed) {
        post("Cannot buy this item. " + purchaseState.reason + ".");
        render();
        return;
      }
      const spendFn = opts.spendPlayerGems;
      if (typeof spendFn !== "function" || !spendFn(entry.priceGems)) {
        post("Not enough gems.");
        render();
        return;
      }
      const inv = getInventory();
      const cosInv = getCosmeticInventory();
      Object.keys(entry.grants.blocks).forEach((key) => {
        const id = Number(key);
        const qty = Math.max(0, Math.floor(Number(entry.grants.blocks[id]) || 0));
        if (!qty) return;
        inv[id] = Math.max(0, Math.floor(Number(inv[id]) || 0)) + qty;
      });
      Object.keys(entry.grants.cosmetics).forEach((id) => {
        const qty = Math.max(0, Math.floor(Number(entry.grants.cosmetics[id]) || 0));
        if (!qty) return;
        cosInv[id] = Math.max(0, Math.floor(Number(cosInv[id]) || 0)) + qty;
      });
      const save = opts.saveInventory;
      if (typeof save === "function") save();
      const refresh = opts.refreshToolbar;
      if (typeof refresh === "function") refresh();
      post("Purchased " + entry.name + " for " + entry.priceGems + " gems.");
      if (typeof opts.showAnnouncementPopup === "function") {
        opts.showAnnouncementPopup("Purchased: " + entry.name);
      }
      render();
    }

    function onGridClick(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const actionEl = target.closest("[data-shop-buy]");
      if (!(actionEl instanceof HTMLElement)) return;
      const id = String(actionEl.dataset.shopBuy || "").trim();
      if (!id) return;
      const entry = findEntryById(id);
      performPurchase(entry);
    }

    function onCategoryClick(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const actionEl = target.closest("[data-shop-category]");
      if (!(actionEl instanceof HTMLElement)) return;
      const cat = String(actionEl.dataset.shopCategory || "").trim();
      if (!cat) return;
      selectedCategory = cat;
      render();
    }

    function onSearchInput(event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      searchQuery = String(target.value || "").slice(0, 48);
      render();
    }

    function onSortChange(event) {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      sortMode = String(target.value || "featured").trim();
      render();
    }

    function openModal() {
      ensureDom();
      render();
      if (modalEl) modalEl.classList.remove("hidden");
    }

    function closeModal() {
      if (modalEl) modalEl.classList.add("hidden");
    }

    function isOpen() {
      return Boolean(modalEl && !modalEl.classList.contains("hidden"));
    }

    return {
      openModal,
      closeModal,
      isOpen,
      render,
      getCatalog
    };
  }

  return { createController };
})();
