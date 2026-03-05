window.GTModules = window.GTModules || {};
window.GTModules.trade = (function () {
  function createController(opts) {
    opts = opts || {};
    let bound = false;
    let menuCtx = null;
    let reqCtx = null;
    let tradeId = "";
    let tradeData = null;
    let tradeRef = null;
    let tradeHandler = null;
    let lastReqId = "";
    let lastRespId = "";
    let lastCompletedTradeId = "";
    let pendingPick = null;

    const g = (k, d) => {
      const v = opts[k];
      if (typeof v === "function") {
        try { const r = v(); return r === undefined ? d : r; } catch (e) { return d; }
      }
      return v === undefined ? d : v;
    };
    const post = (t) => { if (typeof opts.postLocalSystemChat === "function") opts.postLocalSystemChat(t); };
    const popup = (t, ms) => { if (typeof opts.showAnnouncementPopup === "function") opts.showAnnouncementPopup(t, ms); };
    const id = (p) => (p || "id") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const me = () => String(g("getPlayerProfileId", "") || "");
    const meName = () => String(g("getPlayerName", "player") || "player").slice(0, 20);
    const db = () => { const n = g("getNetwork", null); return n && n.db ? n.db : null; };
    const base = () => String(g("getBasePath", "growtopia-test"));
    const path = (p) => base() + "/" + p.replace(/^\/+/, "");
    const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#039;");
    const closeQuick = () => { menuCtx = null; const m = g("getTradeMenuModalEl", null); if (m) m.classList.add("hidden"); };
    const closeReq = () => { reqCtx = null; const m = g("getTradeRequestModalEl", null); if (m) m.classList.add("hidden"); };
    const closePanel = () => {
      const m = g("getTradePanelModalEl", null);
      if (!m) return;
      m.classList.remove("trade-modal-passive");
      m.classList.add("hidden");
    };
    const closeAll = () => { closeQuick(); closeReq(); closePanel(); };
    const isMember = (t) => t && (t.initiator?.accountId === me() || t.target?.accountId === me());
    const otherId = (t) => (t && t.initiator?.accountId === me()) ? t.target?.accountId : t?.initiator?.accountId;
    const otherName = (t) => (t && t.initiator?.accountId === me()) ? (t.target?.name || "Player") : (t?.initiator?.name || "Player");
    const invIds = () => Array.isArray(g("getInventoryIds", [])) ? g("getInventoryIds", []) : [];
    const cosItems = () => Array.isArray(g("getCosmeticItems", [])) ? g("getCosmeticItems", []) : [];
    const cosSlots = () => Array.isArray(g("getCosmeticSlots", [])) ? g("getCosmeticSlots", []) : [];
    const inv = () => g("getInventory", {}) || {};
    const cos = () => g("getCosmeticInventory", {}) || {};
    const normOffer = (x) => {
      const o = x && typeof x === "object" ? x : {};
      const blocks = {}, cosmetics = {};
      Object.entries(o.blocks || {}).forEach(([k, v]) => { const q = Math.max(0, Math.floor(Number(v) || 0)); if (q) blocks[String(k)] = q; });
      Object.entries(o.cosmetics || {}).forEach(([k, v]) => { const q = Math.max(0, Math.floor(Number(v) || 0)); if (q) cosmetics[String(k)] = q; });
      return { blocks, cosmetics };
    };
    const normTrade = (x) => {
      if (!x || typeof x !== "object") return null;
      const a = String(x.initiator?.accountId || ""), b = String(x.target?.accountId || "");
      if (!a || !b) return null;
      const offers = x.offers || {}, acc = x.acceptedBy || {}, conf = x.confirmedBy || {};
      return {
        id: String(x.id || ""), status: String(x.status || "pending"),
        initiator: { accountId: a, name: String(x.initiator?.name || a).slice(0, 20) },
        target: { accountId: b, name: String(x.target?.name || b).slice(0, 20) },
        offers: { [a]: normOffer(offers[a]), [b]: normOffer(offers[b]) },
        acceptedBy: { [a]: !!acc[a], [b]: !!acc[b] },
        confirmedBy: { [a]: !!conf[a], [b]: !!conf[b] },
        reason: String(x.reason || "").slice(0, 120)
      };
    };
    const getBlockName = (bid) => {
      const defs = g("getBlockDefs", {}) || {};
      const d = defs[Number(bid)];
      if (d && d.name) return d.name;
      const fn = opts.getBlockKeyById;
      return typeof fn === "function" ? (fn(Number(bid)) || ("Block " + bid)) : ("Block " + bid);
    };
    const getCosName = (cid) => {
      const f = cosItems().find((i) => i && i.id === cid);
      return f && f.name ? f.name : cid;
    };
    const normInvRec = (rec) => {
      const src = rec && typeof rec === "object" ? rec : {};
      const out = { ...src }, csrc = src.cosmeticItems || {}, eqsrc = src.equippedCosmetics || src.equipped || {};
      invIds().forEach((i) => { out[i] = Math.max(0, Math.floor(Number(src[i]) || 0)); });
      const c = {}; cosItems().forEach((it) => { c[it.id] = Math.max(0, Math.floor(Number(csrc[it.id]) || 0)); }); out.cosmeticItems = c;
      const eq = {}; cosSlots().forEach((s) => { const x = String(eqsrc[s] || ""); eq[s] = x && (c[x] || 0) > 0 ? x : ""; }); out.equippedCosmetics = eq;
      return out;
    };
    const pointInsideEl = (el, clientX, clientY) => {
      if (!el) return false;
      const x = Number(clientX);
      const y = Number(clientY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    function findRemoteAt(tx, ty) {
      const rmap = g("getRemotePlayers", null), size = Number(g("getTileSize", 32)) || 32, rect = g("getPlayerRect", { w: 22, h: 30 });
      if (!rmap || typeof rmap.values !== "function" || typeof opts.rectsOverlap !== "function") return null;
      const bx = tx * size, by = ty * size;
      for (const p of rmap.values()) if (p && typeof p.x === "number" && typeof p.y === "number" && opts.rectsOverlap(bx, by, size, size, p.x, p.y, rect.w, rect.h)) return p;
      return null;
    }

    function handleWrenchAt(tx, ty) {
      if (tradeData && tradeId) { renderPanel(); return true; }
      const p = findRemoteAt(tx, ty);
      if (!p) return false;
      return handleWrenchPlayer(p);
    }

    function handleWrenchPlayer(playerData) {
      if (tradeData && tradeId) { renderPanel(); return true; }
      const accountId = String(playerData && playerData.accountId || "");
      if (!accountId) return false;
      if (accountId === me()) {
        const friendCtrl = g("getFriendsController", null);
        if (friendCtrl && typeof friendCtrl.openProfile === "function") {
          friendCtrl.openProfile(playerData);
          return true;
        }
        return false;
      }
      menuCtx = { accountId, name: String(playerData && playerData.name || "Player").slice(0, 20) };
      const m = g("getTradeMenuModalEl", null), t = g("getTradeMenuTitleEl", null);
      if (t) t.textContent = "@" + menuCtx.name;
      if (m) m.classList.remove("hidden");
      return true;
    }

    function startRequest() {
      if (!menuCtx) return;
      if (!db() || !me()) return;
      if (!menuCtx.accountId || menuCtx.accountId === me()) { post("Invalid trade target."); return; }
      if (tradeId) { post("Finish current trade first."); return; }
      const targetName = String(menuCtx.name || "Player").slice(0, 20);
      db().ref(path("account-commands/" + menuCtx.accountId + "/tradeRequest")).set({
        id: id("tr"), fromAccountId: me(), fromName: meName(), fromWorld: String(g("getCurrentWorldId", "") || ""), createdAt: Date.now()
      }).then(() => post("Trade request sent to @" + targetName + ".")).catch(() => post("Failed to send trade request."));
      closeQuick();
    }

    function onTradeRequest(v) {
      const req = v && typeof v === "object" ? v : {};
      const rid = String(req.id || ""), from = String(req.fromAccountId || "");
      if (!rid || !from || from === me() || rid === lastReqId) return;
      const start = Number(g("getPlayerSessionStartedAt", 0)) || 0, created = Number(req.createdAt) || 0;
      if (start > 0 && created > 0 && created <= start) return;
      lastReqId = rid;
      reqCtx = { id: rid, fromAccountId: from, fromName: String(req.fromName || "Player").slice(0, 20) };
      const m = g("getTradeRequestModalEl", null), t = g("getTradeRequestTextEl", null);
      if (t) t.textContent = "@" + reqCtx.fromName + " wants to trade with you.";
      if (m) m.classList.remove("hidden");
    }

    function respondToTradeRequest(accept) {
      if (!reqCtx || !db() || !me()) return;
      const from = reqCtx.fromAccountId, updates = {};
      if (!accept) {
        updates[path("account-commands/" + from + "/tradeResponse")] = { id: id("trr"), accepted: false, byAccountId: me(), byName: meName(), createdAt: Date.now() };
      } else {
        if (tradeId) { post("Finish current trade first."); return; }
        const tid = id("trade");
        updates[path("trades/" + tid)] = {
          id: tid, status: "active", worldId: String(g("getCurrentWorldId", "") || ""), createdAt: Date.now(), updatedAt: Date.now(),
          initiator: { accountId: from, name: reqCtx.fromName || from }, target: { accountId: me(), name: meName() },
          offers: { [from]: { blocks: {}, cosmetics: {} }, [me()]: { blocks: {}, cosmetics: {} } },
          acceptedBy: { [from]: false, [me()]: false }, confirmedBy: { [from]: false, [me()]: false }
        };
        updates[path("active-trades/" + from)] = tid;
        updates[path("active-trades/" + me())] = tid;
        updates[path("account-commands/" + from + "/tradeResponse")] = { id: id("trr"), accepted: true, tradeId: tid, byAccountId: me(), byName: meName(), createdAt: Date.now() };
      }
      updates[path("account-commands/" + me() + "/tradeRequest")] = null;
      db().ref().update(updates).catch(() => post("Trade response failed."));
      closeReq();
    }

    function onTradeResponse(v) {
      const r = v && typeof v === "object" ? v : {}, rid = String(r.id || "");
      if (!rid || rid === lastRespId) return;
      lastRespId = rid;
      const by = String(r.byName || "player").slice(0, 20), ok = !!r.accepted;
      post("@" + by + (ok ? " accepted your trade request." : " declined your trade request."));
      popup("Trade: @" + by + (ok ? " accepted" : " declined") + " your request.", 2200);
      const n = g("getNetwork", null); if (n && n.myTradeResponseRef) n.myTradeResponseRef.remove().catch(() => {});
    }

    function applyOfferDelta(type, itemId, delta) {
      if (!tradeId || !tradeData || !db()) return;
      const mine = me(), other = otherId(tradeData); if (!mine || !other) return;
      db().ref(path("trades/" + tradeId)).transaction((raw) => {
        const t = normTrade(raw); if (!t || t.status !== "active" || !isMember(t)) return raw;
        const offer = normOffer((raw.offers || {})[mine]); const box = type === "cosmetic" ? offer.cosmetics : offer.blocks;
        const cur = Math.max(0, Math.floor(Number(box[itemId]) || 0)); const next = Math.max(0, cur + delta);
        const max = type === "cosmetic" ? Math.max(0, Math.floor(Number(cos()[itemId]) || 0)) : Math.max(0, Math.floor(Number(inv()[Number(itemId)]) || 0));
        if (delta > 0 && next > max) return;
        if (next <= 0) delete box[itemId]; else box[itemId] = next;
        const out = { ...(raw || {}) };
        out.offers = { ...(raw.offers || {}), [mine]: offer };
        out.acceptedBy = { ...(raw.acceptedBy || {}), [mine]: false, [other]: false };
        out.confirmedBy = { ...(raw.confirmedBy || {}), [mine]: false, [other]: false };
        out.updatedAt = Date.now();
        return out;
      }).catch(() => {});
    }

    function toggleAccept() {
      if (!tradeId || !tradeData || !db()) return;
      const mine = me();
      db().ref(path("trades/" + tradeId)).transaction((raw) => {
        const t = normTrade(raw);
        if (!t || t.status !== "active" || !isMember(t)) return raw;
        const a = t.initiator.accountId;
        const b = t.target.accountId;
        const acceptedBy = { ...(raw.acceptedBy || {}) };
        acceptedBy[mine] = !Boolean(acceptedBy[mine]);
        return {
          ...(raw || {}),
          acceptedBy,
          confirmedBy: { ...(raw.confirmedBy || {}), [a]: false, [b]: false },
          updatedAt: Date.now()
        };
      }).catch(() => {});
    }

    function cancelTrade() {
      if (!tradeId || !tradeData || !db()) return;
      const t = tradeData;
      const u = {};
      u[path("trades/" + tradeId + "/status")] = "cancelled";
      u[path("trades/" + tradeId + "/cancelledBy")] = me();
      u[path("trades/" + tradeId + "/updatedAt")] = Date.now();
      u[path("active-trades/" + t.initiator.accountId)] = null;
      u[path("active-trades/" + t.target.accountId)] = null;
      db().ref().update(u).catch(() => {});
    }

    function confirmTrade() {
      if (!tradeId || !tradeData || !db()) return;
      const mine = me();
      db().ref(path("trades/" + tradeId + "/confirmedBy/" + mine)).set(true).then(() => tryFinalize()).catch(() => {});
    }

    function tryFinalize() {
      if (!tradeId || !db()) return;
      const ref = db().ref(path("trades/" + tradeId));
      ref.transaction((raw) => {
        const t = normTrade(raw); if (!t || t.status !== "active") return raw;
        const a = t.initiator.accountId, b = t.target.accountId;
        if (!t.acceptedBy[a] || !t.acceptedBy[b] || !t.confirmedBy[a] || !t.confirmedBy[b]) return raw;
        return { ...(raw || {}), status: "processing", updatedAt: Date.now(), processingBy: me() };
      }).then((r) => {
        if (!r.committed) return;
        const t = normTrade(r.snapshot.val()); if (!t) return;
        const a = t.initiator.accountId, b = t.target.accountId;
        Promise.all([db().ref(path("player-inventories/" + a)).once("value"), db().ref(path("player-inventories/" + b)).once("value")]).then(([as, bs]) => {
          const aInv = normInvRec(as.exists() ? as.val() : {}), bInv = normInvRec(bs.exists() ? bs.val() : {});
          const ao = normOffer(t.offers[a]), bo = normOffer(t.offers[b]);
          const errs = [];
          const mv = (from, to, typ, idv, qv) => {
            const q = Math.max(0, Math.floor(Number(qv) || 0)); if (!q) return;
            if (typ === "block") { const k = Number(idv), h = Math.max(0, Math.floor(Number(from[k]) || 0)); if (h < q) { errs.push("missing block"); return; } from[k] = h - q; to[k] = Math.max(0, Math.floor(Number(to[k]) || 0)) + q; return; }
            const h = Math.max(0, Math.floor(Number(from.cosmeticItems[idv]) || 0)); if (h < q) { errs.push("missing cosmetic"); return; } from.cosmeticItems[idv] = h - q; to.cosmeticItems[idv] = Math.max(0, Math.floor(Number(to.cosmeticItems[idv]) || 0)) + q;
          };
          Object.entries(ao.blocks).forEach(([k, q]) => mv(aInv, bInv, "block", k, q));
          Object.entries(ao.cosmetics).forEach(([k, q]) => mv(aInv, bInv, "cosmetic", k, q));
          Object.entries(bo.blocks).forEach(([k, q]) => mv(bInv, aInv, "block", k, q));
          Object.entries(bo.cosmetics).forEach(([k, q]) => mv(bInv, aInv, "cosmetic", k, q));
          cosSlots().forEach((s) => {
            const ae = String(aInv.equippedCosmetics[s] || ""); if (ae && (aInv.cosmeticItems[ae] || 0) <= 0) aInv.equippedCosmetics[s] = "";
            const be = String(bInv.equippedCosmetics[s] || ""); if (be && (bInv.cosmeticItems[be] || 0) <= 0) bInv.equippedCosmetics[s] = "";
          });
          const u = {};
          if (errs.length) {
            u[path("trades/" + tradeId + "/status")] = "failed";
            u[path("trades/" + tradeId + "/reason")] = "Insufficient items.";
          } else {
            u[path("player-inventories/" + a)] = aInv;
            u[path("player-inventories/" + b)] = bInv;
            u[path("trades/" + tradeId + "/status")] = "completed";
            u[path("trades/" + tradeId + "/completedAt")] = Date.now();
          }
          u[path("trades/" + tradeId + "/updatedAt")] = Date.now();
          u[path("active-trades/" + a)] = null;
          u[path("active-trades/" + b)] = null;
          db().ref().update(u).then(() => {
            if (!errs.length) { post("Trade completed."); popup("Trade completed successfully.", 2400); }
          }).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
    }

    function getAvailableEntries(mineOffer) {
      const entries = [];
      invIds().forEach((bid) => {
        const key = String(Number(bid));
        const have = Math.max(0, Math.floor(Number(inv()[bid]) || 0));
        const inOffer = Math.max(0, Math.floor(Number((mineOffer.blocks || {})[key]) || 0));
        const free = have - inOffer;
        if (free <= 0) return;
        entries.push({
          type: "block",
          itemId: key,
          label: getBlockName(key),
          qty: free
        });
      });
      cosItems().forEach((it) => {
        const itemId = String(it.id || "");
        if (!itemId) return;
        const have = Math.max(0, Math.floor(Number(cos()[itemId]) || 0));
        const inOffer = Math.max(0, Math.floor(Number((mineOffer.cosmetics || {})[itemId]) || 0));
        const free = have - inOffer;
        if (free <= 0) return;
        entries.push({
          type: "cosmetic",
          itemId,
          label: it.name || itemId,
          qty: free
        });
      });
      return entries;
    }

    function inventoryEntriesHtml(mineOffer) {
      const entries = getAvailableEntries(mineOffer);
      if (!entries.length) {
        return "<div class='trade-offer-empty'>No available items to add.</div>";
      }
      return entries.map((entry) => {
        return "<button class='trade-inventory-item' data-trade-act='pick' data-type='" + esc(entry.type) + "' data-item-id='" + esc(entry.itemId) + "' data-max='" + entry.qty + "'>" +
          "<span>" + esc(entry.label) + "</span>" +
          "<strong>x" + entry.qty + "</strong>" +
          "</button>";
      }).join("");
    }

    function offerRowsHtml(offer, mine) {
      const r = [];
      Object.entries(offer.blocks || {}).forEach(([k, q]) => r.push(
        "<div class='trade-offer-row" + (mine ? " mine" : "") + "' data-mine='" + (mine ? "1" : "0") + "' data-type='block' data-item-id='" + esc(k) + "' data-qty='" + Math.max(0, Math.floor(Number(q) || 0)) + "'>" +
        "<span>" + esc(getBlockName(k) + " x" + q) + "</span>" +
        (mine ? "<button data-trade-act='remove' data-type='block' data-item-id='" + esc(k) + "'>-</button>" : "") +
        "</div>"
      ));
      Object.entries(offer.cosmetics || {}).forEach(([k, q]) => r.push(
        "<div class='trade-offer-row" + (mine ? " mine" : "") + "' data-mine='" + (mine ? "1" : "0") + "' data-type='cosmetic' data-item-id='" + esc(k) + "' data-qty='" + Math.max(0, Math.floor(Number(q) || 0)) + "'>" +
        "<span>" + esc(getCosName(k) + " x" + q) + "</span>" +
        (mine ? "<button data-trade-act='remove' data-type='cosmetic' data-item-id='" + esc(k) + "'>-</button>" : "") +
        "</div>"
      ));
      return r.join("") || "<div class='trade-offer-empty'>No items offered.</div>";
    }

    function renderPanel() {
      if (!tradeData || !isMember(tradeData)) { closePanel(); return; }
      const modal = g("getTradePanelModalEl", null), title = g("getTradePanelTitleEl", null), body = g("getTradePanelBodyEl", null), actions = g("getTradePanelActionsEl", null);
      if (!modal || !title || !body || !actions) return;
      const mine = me(), oid = otherId(tradeData), oname = otherName(tradeData);
      const myOffer = normOffer(tradeData.offers[mine]), his = normOffer(tradeData.offers[oid]);
      const aMe = !!tradeData.acceptedBy[mine], aHe = !!tradeData.acceptedBy[oid], bothA = aMe && aHe, cMe = !!tradeData.confirmedBy[mine];
      title.textContent = "Trade with @" + oname;
      const tradeNote = "<div class='trade-offer-empty'>Drag items from your inventory panel into \"Your Offer\". Drag offered items back to inventory to remove them.</div>";
      body.innerHTML = "<div class='trade-status'><span class='trade-chip " + (aMe ? "ready" : "wait") + "'>You: " + (aMe ? "Ready" : "Waiting") + "</span><span class='trade-chip " + (aHe ? "ready" : "wait") + "'>@" + esc(oname) + ": " + (aHe ? "Ready" : "Waiting") + "</span></div>" +
        "<div class='trade-offer'><div class='trade-offer-title'>Inventory</div>" + tradeNote + "</div>" +
        "<div class='trade-top'><div class='trade-offer'><div class='trade-offer-title'>Your Offer</div><div class='trade-offer-list' data-trade-drop='my-offer'>" + offerRowsHtml(myOffer, true) + "</div></div><div class='trade-offer'><div class='trade-offer-title'>@" + esc(oname) + " Offer</div><div class='trade-offer-list'>" + offerRowsHtml(his, false) + "</div></div></div>";
      actions.innerHTML = "<button data-trade-act='accept'>" + (aMe ? "Unaccept" : "Accept") + "</button><button data-trade-act='confirm' " + (bothA ? "" : "disabled") + ">" + (cMe ? "Confirmed" : "Confirm (Both)") + "</button><button data-trade-act='cancel'>Cancel Trade</button>";
      modal.classList.add("trade-modal-passive");
      modal.classList.remove("hidden");
    }

    function onActiveTradePointer(v) {
      const tid = String(v || "").trim();
      if (!tid) {
        if (tradeRef && tradeHandler) tradeRef.off("value", tradeHandler);
        tradeRef = null; tradeHandler = null; tradeId = ""; tradeData = null; closePanel(); return;
      }
      if (tid === tradeId && tradeRef) return;
      if (tradeRef && tradeHandler) tradeRef.off("value", tradeHandler);
      tradeId = tid; tradeRef = db() ? db().ref(path("trades/" + tid)) : null;
      if (!tradeRef) return;
      tradeHandler = (s) => {
        tradeData = normTrade(s.val());
        if (!tradeData || !isMember(tradeData)) { closePanel(); return; }
        const st = String(tradeData.status || "").toLowerCase();
        if (st === "cancelled") { post("Trade cancelled."); popup("Trade cancelled.", 2000); closePanel(); return; }
        if (st === "completed") {
          post("Trade completed.");
          if (tradeId && tradeId !== lastCompletedTradeId && typeof opts.onTradeCompleted === "function") {
            lastCompletedTradeId = tradeId;
            try {
              opts.onTradeCompleted({
                tradeId,
                otherAccountId: otherId(tradeData) || "",
                otherName: otherName(tradeData) || ""
              });
            } catch (error) {
              // ignore quest hook errors
            }
          }
          closePanel();
          return;
        }
        if (st === "failed") { post("Trade failed: " + (tradeData.reason || "unknown")); closePanel(); return; }
        renderPanel();
      };
      tradeRef.on("value", tradeHandler);
    }

    function bindUiEvents() {
      if (bound) return;
      bound = true;
      const qm = g("getTradeMenuModalEl", null), qclose = g("getTradeMenuCloseBtnEl", null), qstart = g("getTradeStartBtnEl", null), qcancel = g("getTradeCancelBtnEl", null);
      if (qclose) qclose.addEventListener("click", closeQuick);
      if (qcancel) qcancel.addEventListener("click", closeQuick);
      if (qstart) qstart.addEventListener("click", startRequest);
      if (qm) qm.addEventListener("click", (e) => { if (e.target === qm) closeQuick(); });
      const rm = g("getTradeRequestModalEl", null), racc = g("getTradeAcceptBtnEl", null), rdec = g("getTradeDeclineBtnEl", null);
      if (racc) racc.addEventListener("click", () => respondToTradeRequest(true));
      if (rdec) rdec.addEventListener("click", () => respondToTradeRequest(false));
      if (rm) rm.addEventListener("click", (e) => { if (e.target === rm) respondToTradeRequest(false); });
      const pm = g("getTradePanelModalEl", null), pclose = g("getTradePanelCloseBtnEl", null), pbody = g("getTradePanelBodyEl", null), pacts = g("getTradePanelActionsEl", null);
      if (pclose) pclose.addEventListener("click", () => { if (tradeData) cancelTrade(); else closePanel(); });
      if (pm) pm.addEventListener("click", (e) => { if (e.target === pm && tradeData) cancelTrade(); });
      if (pbody) {
        pbody.addEventListener("pointerdown", (e) => {
          const t = e.target; if (!(t instanceof HTMLElement)) return;
          const row = t.closest(".trade-offer-row");
          if (!(row instanceof HTMLElement)) return;
          if (!row.dataset.mine || row.dataset.mine !== "1") return;
          if (t.closest("button")) return;
          if (typeof opts.startInventoryDragFromTrade !== "function") return;
          const type = String(row.dataset.type || "") === "cosmetic" ? "cosmetic" : "block";
          const itemId = String(row.dataset.itemId || "");
          const qty = Math.max(1, Math.floor(Number(row.dataset.qty) || 1));
          if (!itemId || qty <= 0) return;
          e.preventDefault();
          const entry = {
            type,
            source: "trade_offer",
            label: type === "cosmetic" ? getCosName(itemId) : getBlockName(itemId),
            maxAmount: qty,
            defaultAmount: 1
          };
          if (type === "cosmetic") entry.cosmeticId = itemId;
          else entry.blockId = Number(itemId);
          opts.startInventoryDragFromTrade(entry, e);
        });
        pbody.addEventListener("click", (e) => {
          const t = e.target; if (!(t instanceof HTMLElement)) return;
          const act = String(t.dataset.tradeAct || "");
          if (act === "remove") {
            applyOfferDelta(String(t.dataset.type || "block") === "cosmetic" ? "cosmetic" : "block", String(t.dataset.itemId || ""), -1);
          }
        });
      }
      if (pacts) {
        pacts.addEventListener("click", (e) => {
          const t = e.target; if (!(t instanceof HTMLElement)) return;
          const act = String(t.dataset.tradeAct || "");
          if (act === "accept") toggleAccept();
          if (act === "confirm") confirmTrade();
          if (act === "cancel") cancelTrade();
        });
      }
    }
    function isTradePanelOpen() {
      const modal = g("getTradePanelModalEl", null);
      return Boolean(tradeData && tradeId && modal && !modal.classList.contains("hidden"));
    }
    function handleInventoryDragDrop(entry, amount, clientX, clientY) {
      if (!isTradePanelOpen()) return false;
      if (!entry || entry.source === "trade_offer") return false;
      const type = String(entry.type || "");
      if (type !== "block" && type !== "cosmetic") return false;
      const body = g("getTradePanelBodyEl", null);
      if (!body) return false;
      const dropZone = body.querySelector("[data-trade-drop='my-offer']");
      if (!(dropZone instanceof HTMLElement)) return false;
      if (!pointInsideEl(dropZone, clientX, clientY)) return false;
      const qty = Math.max(1, Math.floor(Number(amount) || 1));
      const itemId = type === "cosmetic"
        ? String(entry.cosmeticId || "")
        : String(Math.max(0, Math.floor(Number(entry.blockId) || 0)));
      if (!itemId) return false;
      pendingPick = null;
      applyOfferDelta(type, itemId, qty);
      return true;
    }
    function handleOfferDragBack(entry, amount, clientX, clientY) {
      if (!isTradePanelOpen()) return false;
      if (!entry || entry.source !== "trade_offer") return false;
      const toolbarEl = g("getToolbarEl", null);
      if (!toolbarEl || !pointInsideEl(toolbarEl, clientX, clientY)) return false;
      const type = String(entry.type || "");
      if (type !== "block" && type !== "cosmetic") return false;
      const itemId = type === "cosmetic"
        ? String(entry.cosmeticId || "")
        : String(Math.max(0, Math.floor(Number(entry.blockId) || 0)));
      if (!itemId) return false;
      const qty = Math.max(1, Math.floor(Number(amount) || 1));
      pendingPick = null;
      applyOfferDelta(type, itemId, -qty);
      return true;
    }
    function getDragEntryMax(entry) {
      if (!entry || entry.source !== "trade_offer") return 0;
      return Math.max(0, Math.floor(Number(entry.maxAmount) || 0));
    }
    function handleInventoryDragEnd(entry, amount, clientX, clientY) {
      if (!isTradePanelOpen()) return { handled: false, blockWorldDrop: false };
      if (!entry) return { handled: false, blockWorldDrop: false };
      if (entry.source === "trade_offer") {
        const movedBack = handleOfferDragBack(entry, amount, clientX, clientY);
        return { handled: movedBack, blockWorldDrop: true };
      }
      const offered = handleInventoryDragDrop(entry, amount, clientX, clientY);
      return { handled: offered, blockWorldDrop: false };
    }

    return {
      bindUiEvents,
      closeAll,
      closeRequestModal: closeReq,
      handleWrenchAt,
      handleWrenchPlayer,
      onTradeRequest,
      onTradeResponse,
      onActiveTradePointer,
      respondToTradeRequest,
      isTradePanelOpen,
      getDragEntryMax,
      handleInventoryDragEnd
    };
  }

  return { createController };
})();
