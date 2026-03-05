window.GTModules = window.GTModules || {};

window.GTModules.readSync = (function createReadSyncModule() {
  function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function createController(options) {
    const opts = options || {};
    const workerPath = String(opts.workerPath || "").trim();
    const timeoutMs = Math.max(300, Math.floor(toNumber(opts.timeoutMs, 1400)));

    let worker = null;
    let workerActive = false;
    let workerUnavailable = false;
    let nextId = 1;
    const pending = new Map();

    function rejectPending(reason) {
      pending.forEach((entry) => {
        clearTimeout(entry.timer);
        try {
          entry.reject(new Error(reason || "Read worker unavailable."));
        } catch (error) {
          // ignore reject errors
        }
      });
      pending.clear();
    }

    function stopWorker(reason) {
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
      rejectPending(reason || "Read worker stopped.");
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
        worker = null;
        workerUnavailable = true;
        return false;
      }
      worker.onmessage = (event) => {
        const msg = event && event.data && typeof event.data === "object" ? event.data : {};
        const id = Math.floor(Number(msg.id) || 0);
        if (!id || !pending.has(id)) return;
        const entry = pending.get(id);
        pending.delete(id);
        clearTimeout(entry.timer);
        if (msg.ok === false) {
          entry.reject(new Error(String(msg.error || "Read worker task failed.")));
          return;
        }
        entry.resolve(msg.result && typeof msg.result === "object" ? msg.result : {});
      };
      worker.onerror = () => {
        workerUnavailable = true;
        stopWorker("Read worker crashed.");
      };
      workerActive = true;
      return true;
    }

    startWorker();

    function process(task, payload) {
      const safeTask = String(task || "").trim();
      const safePayload = payload && typeof payload === "object" ? payload : {};
      if (!safeTask) return Promise.resolve(safePayload);
      if (!workerActive) return Promise.resolve(safePayload);
      if (!worker) return Promise.resolve(safePayload);
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!pending.has(id)) return;
          pending.delete(id);
          reject(new Error("Read worker timed out."));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        try {
          worker.postMessage({
            type: "process",
            id,
            task: safeTask,
            payload: safePayload
          });
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(error instanceof Error ? error : new Error("Failed to post read task."));
        }
      });
    }

    function dispose() {
      if (worker) {
        try {
          worker.postMessage({ type: "dispose" });
        } catch (error) {
          // ignore post errors
        }
      }
      stopWorker("Read worker disposed.");
    }

    return {
      process,
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
