window.GTModules = window.GTModules || {};

window.GTModules.syncHits = (function createSyncHitsModule() {
  function createWorldHitsRef(db, basePath, worldId) {
    if (!db || !basePath || !worldId) return null;
    return db.ref(String(basePath) + "/worlds/" + String(worldId) + "/hits");
  }

  function normalizeHitRecord(value) {
    if (!value || typeof value !== "object") return null;
    const hits = Math.max(0, Math.floor(Number(value.hits) || 0));
    const updatedAt = Number(value.updatedAt) || 0;
    if (hits <= 0) return null;
    return {
      hits,
      updatedAt
    };
  }

  function buildHitPayload(hits) {
    const safeHits = Math.max(0, Math.floor(Number(hits) || 0));
    if (safeHits <= 0) return null;
    return {
      hits: safeHits,
      updatedAt: (typeof firebase !== "undefined" && firebase.database && firebase.database.ServerValue)
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now()
    };
  }

  function writeHit(hitsRef, tileKey, hits, firebaseRef) {
    if (!hitsRef || !tileKey) return;
    const payload = buildHitPayload(hits);
    if (!payload) {
      hitsRef.child(String(tileKey)).remove().catch(() => {});
      return;
    }
    if (firebaseRef && firebaseRef.database && firebaseRef.database.ServerValue) {
      payload.updatedAt = firebaseRef.database.ServerValue.TIMESTAMP;
    }
    hitsRef.child(String(tileKey)).set(payload).catch(() => {});
  }

  function buildPlayerHitPayload(tx, ty, hits) {
    const safeTx = Math.floor(Number(tx));
    const safeTy = Math.floor(Number(ty));
    const safeHits = Math.max(0, Math.floor(Number(hits) || 0));
    if (!Number.isInteger(safeTx) || !Number.isInteger(safeTy)) return null;
    return {
      eventId: Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
      tx: safeTx,
      ty: safeTy,
      hits: safeHits,
      at: Date.now()
    };
  }

  function createRemoteHitTracker() {
    return new Map();
  }

  function consumeRemoteHit(tracker, sourcePlayerId, rawHit, onApply) {
    if (!(tracker instanceof Map)) return;
    if (!sourcePlayerId || !rawHit || typeof rawHit !== "object") return;
    const eventId = String(rawHit.eventId || "").trim();
    if (!eventId) return;
    const last = tracker.get(String(sourcePlayerId)) || "";
    if (last === eventId) return;
    tracker.set(String(sourcePlayerId), eventId);
    const tx = Math.floor(Number(rawHit.tx));
    const ty = Math.floor(Number(rawHit.ty));
    const hits = Math.max(0, Math.floor(Number(rawHit.hits) || 0));
    if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
    if (typeof onApply === "function") onApply(tx, ty, hits);
  }

  return {
    createWorldHitsRef,
    normalizeHitRecord,
    buildHitPayload,
    writeHit,
    buildPlayerHitPayload,
    createRemoteHitTracker,
    consumeRemoteHit
  };
})();
