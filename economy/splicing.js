window.GTModules = window.GTModules || {};

window.GTModules.splicing = (function createSplicingModule() {
  function createController(options) {
    const opts = options || {};
    let modalCtx = null;
    let domBound = false;

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

    function hashSeed(seedId, seedName) {
      const input = String(seedId || 0) + "|" + String(seedName || "");
      let h = 2166136261 >>> 0;
      for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h >>> 0;
    }

    function getBlockDefs() {
      const defs = read("getBlockDefs", {});
      return defs && typeof defs === "object" ? defs : {};
    }

    function getInventory() {
      const inv = read("getInventory", {});
      return inv && typeof inv === "object" ? inv : {};
    }

    function getSeedInventoryIds() {
      const ids = read("getSeedInventoryIds", []);
      if (!Array.isArray(ids)) return [];
      return ids
        .map((id) => Math.floor(Number(id)))
        .filter((id) => Number.isInteger(id) && id > 0)
        .sort((a, b) => a - b);
    }

    function getBlockName(blockId) {
      const defs = getBlockDefs();
      const row = defs[Math.floor(Number(blockId) || 0)];
      if (row && row.name) return String(row.name);
      return "Block " + Math.floor(Number(blockId) || 0);
    }

    function getOwnedCount(blockId) {
      const inv = getInventory();
      return Math.max(0, Math.floor(Number(inv[Math.floor(Number(blockId) || 0)]) || 0));
    }

    function getCatalystPool(seedIds) {
      const defs = getBlockDefs();
      const inventoryIds = Array.isArray(read("getInventoryIds", [])) ? read("getInventoryIds", []) : [];
      const preferred = [3, 4, 5, 6, 23, 35, 41];
      const out = preferred.filter((id) => inventoryIds.includes(id) && defs[id]);
      if (out.length) return out;
      const fallback = inventoryIds
        .map((id) => Math.floor(Number(id) || 0))
        .filter((id) => Number.isInteger(id) && id > 0 && !seedIds.includes(id));
      return fallback.length ? fallback : [3];
    }

    function buildRecipe(targetSeedId) {
      const seedIds = getSeedInventoryIds();
      const targetId = Math.floor(Number(targetSeedId) || 0);
      const targetIndex = seedIds.indexOf(targetId);
      if (targetIndex < 0 || !seedIds.length) return null;

      const targetName = getBlockName(targetId);
      const hash = hashSeed(targetId, targetName);
      const listLen = seedIds.length;
      const nextIndex = (start, taken) => {
        let idx = ((start % listLen) + listLen) % listLen;
        for (let i = 0; i < listLen; i++) {
          const candidate = seedIds[idx];
          if (!taken.has(candidate) && candidate !== targetId) return idx;
          idx = (idx + 1) % listLen;
        }
        return targetIndex;
      };
      const taken = new Set();
      const parentAIdx = nextIndex(targetIndex + 1 + (hash % Math.max(1, listLen - 1)), taken);
      const parentA = seedIds[parentAIdx];
      taken.add(parentA);
      const parentBIdx = nextIndex(targetIndex + 3 + ((hash >>> 4) % Math.max(1, listLen - 1)), taken);
      const parentB = seedIds[parentBIdx];
      taken.add(parentB);

      const catalystPool = getCatalystPool(seedIds);
      const catalystId = catalystPool[hash % catalystPool.length] || catalystPool[0] || 3;

      const ingredients = [];
      if (parentA && parentA !== targetId) {
        ingredients.push({ blockId: parentA, amount: 2 + (hash % 3) });
      }
      if (parentB && parentB !== targetId && parentB !== parentA) {
        ingredients.push({ blockId: parentB, amount: 1 + ((hash >>> 2) % 2) });
      }
      ingredients.push({ blockId: catalystId, amount: 1 + ((hash >>> 8) % 2) });

      return {
        targetSeedId: targetId,
        outputAmount: 1 + ((hash >>> 11) % 2),
        ingredients
      };
    }

    function hasIngredients(recipe) {
      if (!recipe || !Array.isArray(recipe.ingredients)) return false;
      for (let i = 0; i < recipe.ingredients.length; i++) {
        const row = recipe.ingredients[i] || {};
        const have = getOwnedCount(row.blockId);
        if (have < Math.max(1, Math.floor(Number(row.amount) || 1))) {
          return false;
        }
      }
      return true;
    }

    function getModalEls() {
      const modal = document.getElementById("splicingModal");
      const title = document.getElementById("splicingTitle");
      const body = document.getElementById("splicingBody");
      const actions = document.getElementById("splicingActions");
      const close = document.getElementById("splicingCloseBtn");
      return { modal, title, body, actions, close };
    }

    function ensureModalDom() {
      const existing = getModalEls();
      if (existing.modal && existing.title && existing.body && existing.actions && existing.close) {
        return existing;
      }
      const host = document.getElementById("gameShell") || document.body;
      if (!host) return existing;
      const wrap = document.createElement("div");
      wrap.innerHTML =
        '<div id="splicingModal" class="vending-modal hidden">' +
          '<div class="vending-card sign-card">' +
            '<div class="vending-header">' +
              '<strong id="splicingTitle">Splicing Machine</strong>' +
              '<button id="splicingCloseBtn" type="button">Close</button>' +
            '</div>' +
            '<div id="splicingBody" class="vending-body"></div>' +
            '<div id="splicingActions" class="vending-actions"></div>' +
          '</div>' +
        '</div>';
      if (wrap.firstElementChild) host.appendChild(wrap.firstElementChild);
      return getModalEls();
    }

    function closeModal() {
      modalCtx = null;
      const els = ensureModalDom();
      if (els.modal) els.modal.classList.add("hidden");
    }

    function renderModal() {
      const els = ensureModalDom();
      if (!els.modal || !els.title || !els.body || !els.actions) return;
      if (!modalCtx) {
        els.modal.classList.add("hidden");
        return;
      }
      const tx = Math.floor(Number(modalCtx.tx) || 0);
      const ty = Math.floor(Number(modalCtx.ty) || 0);
      const seedIds = getSeedInventoryIds();
      if (!seedIds.length) {
        els.title.textContent = "Splicing Machine (" + tx + "," + ty + ")";
        els.body.innerHTML =
          '<div class="vending-section">' +
            '<div class="vending-section-title">No Seeds Found</div>' +
            '<div class="sign-hint">No seed recipes are available yet.</div>' +
          '</div>';
        els.actions.innerHTML = "";
        els.modal.classList.remove("hidden");
        return;
      }

      const selectedSeedId = seedIds.includes(modalCtx.targetSeedId) ? modalCtx.targetSeedId : seedIds[0];
      modalCtx.targetSeedId = selectedSeedId;
      const recipe = buildRecipe(selectedSeedId);
      const canCraft = hasIngredients(recipe);
      const seedOptions = seedIds
        .map((seedId) => {
          const selected = seedId === selectedSeedId ? ' selected' : "";
          return '<option value="' + seedId + '"' + selected + '>' + esc(getBlockName(seedId)) + "</option>";
        })
        .join("");
      const ingredientsHtml = recipe && Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map((row) => {
          const need = Math.max(1, Math.floor(Number(row.amount) || 1));
          const have = getOwnedCount(row.blockId);
          const ok = have >= need;
          const color = ok ? "#8ff0a4" : "#ff9aa2";
          return (
            '<div class="vending-stat">' +
              "<span>" + esc(getBlockName(row.blockId)) + "</span>" +
              '<strong style="color:' + color + ';">' + have + " / " + need + "</strong>" +
            "</div>"
          );
        }).join("")
        : "";

      els.title.textContent = "Splicing Machine (" + tx + "," + ty + ")";
      els.body.innerHTML =
        '<div class="vending-section">' +
          '<div class="vending-section-title">Create Seed</div>' +
          '<div class="vending-field-grid">' +
            '<label class="vending-field"><span>Target Seed</span><select data-splice-input="targetSeed">' + seedOptions + "</select></label>" +
          "</div>" +
          '<div class="sign-hint">Unique recipe generated by machine pattern. Output: <strong>' + (recipe ? recipe.outputAmount : 0) + "x " + esc(getBlockName(selectedSeedId)) + "</strong></div>" +
        "</div>" +
        '<div class="vending-section">' +
          '<div class="vending-section-title">Required Ingredients</div>' +
          '<div class="vending-stat-grid">' + ingredientsHtml + "</div>" +
        "</div>";
      els.actions.innerHTML =
        '<button data-splice-act="craft"' + (canCraft ? "" : " disabled") + ">Splice Seed</button>";
      els.modal.classList.remove("hidden");
    }

    function craftSelectedSeed() {
      if (!modalCtx) return false;
      const tx = Math.floor(Number(modalCtx.tx) || 0);
      const ty = Math.floor(Number(modalCtx.ty) || 0);
      const world = read("getWorld", null);
      const splicerId = Math.floor(Number(read("getSplicerId", 0)) || 0);
      if (!world || !world[ty] || world[ty][tx] !== splicerId) {
        closeModal();
        return false;
      }
      const recipe = buildRecipe(modalCtx.targetSeedId);
      if (!recipe || !hasIngredients(recipe)) {
        call("postLocalSystemChat", "Missing ingredients for splicing.");
        renderModal();
        return false;
      }

      const inventory = getInventory();
      for (let i = 0; i < recipe.ingredients.length; i++) {
        const row = recipe.ingredients[i] || {};
        const blockId = Math.max(1, Math.floor(Number(row.blockId) || 0));
        const amount = Math.max(1, Math.floor(Number(row.amount) || 1));
        inventory[blockId] = Math.max(0, Math.floor((inventory[blockId] || 0) - amount));
      }

      const outputId = Math.max(1, Math.floor(Number(recipe.targetSeedId) || 0));
      const outputAmount = Math.max(1, Math.floor(Number(recipe.outputAmount) || 1));
      const inventoryLimit = Math.max(1, Math.floor(Number(read("getInventoryItemLimit", 300)) || 300));
      const current = Math.max(0, Math.floor(Number(inventory[outputId]) || 0));
      const addNow = Math.max(0, Math.min(outputAmount, inventoryLimit - current));
      if (addNow > 0) {
        inventory[outputId] = current + addNow;
      }
      const spill = outputAmount - addNow;
      if (spill > 0) {
        call("spawnWorldDropEntry", { type: "block", blockId: outputId }, spill, tx * Math.max(1, Number(read("getTileSize", 32)) || 32), ty * Math.max(1, Number(read("getTileSize", 32)) || 32));
      }

      call("saveInventory", false);
      call("refreshToolbar", true);
      call("postLocalSystemChat", "Spliced " + outputAmount + "x " + getBlockName(outputId) + ".");
      renderModal();
      return true;
    }

    function openModal(tx, ty) {
      const world = read("getWorld", null);
      const splicerId = Math.floor(Number(read("getSplicerId", 0)) || 0);
      const safeTx = Math.floor(Number(tx) || 0);
      const safeTy = Math.floor(Number(ty) || 0);
      if (!world || !world[safeTy] || world[safeTy][safeTx] !== splicerId) return;
      const seedIds = getSeedInventoryIds();
      modalCtx = {
        tx: safeTx,
        ty: safeTy,
        targetSeedId: seedIds[0] || 0
      };
      renderModal();
    }

    function bindModalEvents() {
      if (domBound) return;
      const els = ensureModalDom();
      if (!els.modal || !els.close || !els.body || !els.actions) return;
      domBound = true;
      els.close.addEventListener("click", closeModal);
      els.modal.addEventListener("click", (event) => {
        if (!event || !event.target) return;
        if (event.target === els.modal) {
          closeModal();
        }
      });
      els.body.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.dataset.spliceInput !== "targetSeed") return;
        if (!modalCtx) return;
        modalCtx.targetSeedId = Math.max(1, Math.floor(Number(target.value) || 0));
        renderModal();
      });
      els.actions.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.spliceAct !== "craft") return;
        craftSelectedSeed();
      });
    }

    function clearAll() {
      closeModal();
    }

    return {
      openModal,
      closeModal,
      renderModal,
      bindModalEvents,
      clearAll
    };
  }

  return {
    createController
  };
})();
