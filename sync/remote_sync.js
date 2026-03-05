window.GTModules = window.GTModules || {};

window.GTModules.remoteSync = (function createRemoteSyncModule() {
  function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function sanitizeFacing(value) {
    const facing = Number(value);
    return facing < 0 ? -1 : 1;
  }

  function sanitizeRemotePlayer(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const id = String(source.id || "").trim();
    if (!id) return null;
    return {
      id,
      accountId: String(source.accountId || ""),
      x: toNumber(source.x, 0),
      y: toNumber(source.y, 0),
      facing: sanitizeFacing(source.facing),
      name: String(source.name || "Player").slice(0, 16),
      cosmetics: source.cosmetics && typeof source.cosmetics === "object" ? source.cosmetics : {},
      title: source.title && typeof source.title === "object" ? source.title : {},
      danceUntil: Math.max(0, Math.floor(toNumber(source.danceUntil, 0)))
    };
  }

  function createController(options) {
    const opts = options || {};
    const remotePlayers = opts.remotePlayers;
    const interpolationDelayMs = Math.max(16, Math.floor(toNumber(opts.interpolationDelayMs, 85)));
    const maxExtrapolationMs = Math.max(0, Math.floor(toNumber(opts.maxExtrapolationMs, 0)));
    const snapDistancePx = Math.max(16, toNumber(opts.snapDistancePx, 140));
    const workerPath = String(opts.workerPath || "").trim();

    let worker = null;
    let workerActive = false;
    let workerUnavailable = false;
    let samplePending = false;

    function directUpsert(player) {
      if (!remotePlayers || typeof remotePlayers.set !== "function") return;
      const prev = remotePlayers.get(player.id);
      if (prev && typeof prev === "object") {
        remotePlayers.set(player.id, { ...prev, ...player });
      } else {
        remotePlayers.set(player.id, { ...player });
      }
    }

    function directRemove(id) {
      if (!remotePlayers || typeof remotePlayers.delete !== "function") return;
      remotePlayers.delete(id);
    }

    function directClear() {
      if (!remotePlayers || typeof remotePlayers.clear !== "function") return;
      remotePlayers.clear();
    }

    function applyWorkerSample(players) {
      if (!remotePlayers || typeof remotePlayers.set !== "function") return;
      const list = Array.isArray(players) ? players : [];
      const seen = new Set();
      for (let i = 0; i < list.length; i++) {
        const next = sanitizeRemotePlayer(list[i]);
        if (!next) continue;
        seen.add(next.id);
        directUpsert(next);
      }
      if (typeof remotePlayers.keys === "function") {
        for (const id of remotePlayers.keys()) {
          if (!seen.has(id)) {
            remotePlayers.delete(id);
          }
        }
      }
    }

    function stopWorker() {
      samplePending = false;
      workerActive = false;
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        try {
          worker.terminate();
        } catch (error) {
          // ignore terminate errors
        }
      }
      worker = null;
    }

    function startWorker() {
      if (workerActive || workerUnavailable) return workerActive;
      if (!workerPath || typeof Worker !== "function") {
        workerUnavailable = true;
        return false;
      }
      try {
        worker = new Worker(workerPath);
      } catch (error) {
        workerUnavailable = true;
        worker = null;
        return false;
      }
      worker.onmessage = (event) => {
        const msg = event && event.data && typeof event.data === "object" ? event.data : {};
        const type = String(msg.type || "");
        if (type !== "sample") return;
        samplePending = false;
        const payload = msg.payload && typeof msg.payload === "object" ? msg.payload : {};
        applyWorkerSample(payload.players);
      };
      worker.onerror = () => {
        stopWorker();
        workerUnavailable = true;
      };
      worker.postMessage({
        type: "config",
        payload: {
          interpolationDelayMs,
          maxExtrapolationMs,
          snapDistancePx
        }
      });
      workerActive = true;
      return true;
    }

    startWorker();

    function upsert(rawPlayer) {
      const player = sanitizeRemotePlayer(rawPlayer);
      if (!player) return;
      if (!workerActive) {
        directUpsert(player);
        return;
      }
      if (!remotePlayers || typeof remotePlayers.has !== "function" || !remotePlayers.has(player.id)) {
        directUpsert(player);
      }
      worker.postMessage({
        type: "upsert",
        payload: {
          ...player,
          receivedAtMs: performance.now()
        }
      });
    }

    function remove(playerId) {
      const id = String(playerId || "").trim();
      if (!id) return;
      directRemove(id);
      if (!workerActive) return;
      worker.postMessage({
        type: "remove",
        payload: { id }
      });
    }

    function reset() {
      directClear();
      if (!workerActive) return;
      samplePending = false;
      worker.postMessage({
        type: "clear",
        payload: {}
      });
    }

    function sample(nowMs) {
      if (!workerActive || samplePending) return;
      samplePending = true;
      worker.postMessage({
        type: "sample",
        payload: {
          nowMs: Math.max(0, toNumber(nowMs, performance.now()))
        }
      });
    }

    function dispose() {
      if (worker) {
        try {
          worker.postMessage({ type: "dispose", payload: {} });
        } catch (error) {
          // ignore post errors
        }
      }
      stopWorker();
    }

    return {
      upsert,
      remove,
      reset,
      sample,
      dispose,
      isWorkerActive: function isWorkerActive() {
        return workerActive;
      }
    };
  }

  return {
    createController
  };
})();
