window.GTModules = window.GTModules || {};

window.GTModules.syncBlocks = (function createSyncBlocksModule() {
  function createBatchSync(options) {
    const opts = options || {};
    const getRef = typeof opts.getRef === "function" ? opts.getRef : () => null;
    const onError = typeof opts.onError === "function" ? opts.onError : () => {};
    const flushDelayMs = Math.max(0, Number(opts.flushDelayMs) || 16);

    const queue = new Map();
    let timer = 0;

    function clearTimer() {
      if (!timer) return;
      clearTimeout(timer);
      timer = 0;
    }

    function flush() {
      clearTimer();
      if (!queue.size) return;
      const ref = getRef();
      if (!ref) {
        queue.clear();
        return;
      }
      const updates = {};
      queue.forEach((id, key) => {
        updates[key] = id;
      });
      queue.clear();
      ref.update(updates).catch(() => {
        onError();
      });
    }

    function schedule() {
      if (timer) return;
      timer = setTimeout(flush, flushDelayMs);
    }

    function enqueue(tx, ty, id) {
      const key = String(tx) + "_" + String(ty);
      queue.set(key, Number(id) || 0);
      schedule();
    }

    function reset() {
      clearTimer();
      queue.clear();
    }

    return {
      enqueue,
      flush,
      reset
    };
  }

  return {
    createBatchSync
  };
})();

