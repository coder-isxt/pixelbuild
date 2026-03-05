window.GTModules = window.GTModules || {};

window.GTModules.sign = (function createSignModule() {
  function createController(options) {
    const opts = options || {};
    const signTexts = new Map();
    let signEditContext = null;

    function get(k, fallback) {
      const fn = opts[k];
      if (typeof fn === "function") return fn();
      return fn === undefined ? fallback : fn;
    }

    function getTileKey(tx, ty) {
      if (typeof opts.getTileKey === "function") return opts.getTileKey(tx, ty);
      return String(tx) + "_" + String(ty);
    }

    function normalizeText(value) {
      return (value || "").toString().replace(/\s+/g, " ").trim().slice(0, 120);
    }

    function setLocalText(tx, ty, value) {
      const key = getTileKey(tx, ty);
      const text = normalizeText(value && value.text);
      if (!text) {
        signTexts.delete(key);
        if (signEditContext && signEditContext.tx === tx && signEditContext.ty === ty) {
          closeModal();
        }
        return;
      }
      signTexts.set(key, {
        text,
        updatedAt: Number(value && value.updatedAt) || Date.now()
      });
    }

    function getLocalText(tx, ty) {
      const entry = signTexts.get(getTileKey(tx, ty));
      return entry && entry.text ? entry.text : "";
    }

    function closeModal() {
      signEditContext = null;
      const els = get("getSignModalElements", null) || {};
      if (els.modal) els.modal.classList.add("hidden");
    }

    function saveText(tx, ty, rawText) {
      const text = normalizeText(rawText);
      const network = get("getNetwork", null) || {};
      const signsRef = network && network.signsRef ? network.signsRef : null;
      const firebaseRef = get("getFirebase", null);
      if (!text) {
        setLocalText(tx, ty, null);
        if (network.enabled && signsRef) {
          signsRef.child(getTileKey(tx, ty)).remove().catch(() => {});
        }
        return;
      }
      setLocalText(tx, ty, { text, updatedAt: Date.now() });
      if (network.enabled && signsRef) {
        signsRef.child(getTileKey(tx, ty)).set({
          text,
          updatedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        }).catch(() => {});
      }
    }

    function openModal(tx, ty) {
      const els = get("getSignModalElements", null) || {};
      if (!els.modal || !els.input || !els.title) return;
      const canEditTarget = opts.canEditTarget || (() => true);
      if (!canEditTarget(tx, ty)) return;
      const world = get("getWorld", null);
      const signId = Number(get("getSignId", 0)) || 0;
      if (!world || !world[ty] || world[ty][tx] !== signId) return;
      const canEditCurrentWorld = opts.canEditCurrentWorld || (() => true);
      if (!canEditCurrentWorld()) {
        if (typeof opts.notifyWorldLockedDenied === "function") {
          opts.notifyWorldLockedDenied();
        }
        return;
      }
      signEditContext = { tx, ty };
      els.title.textContent = "Sign (" + tx + "," + ty + ")";
      els.input.value = getLocalText(tx, ty);
      els.modal.classList.remove("hidden");
      els.input.focus();
    }

    function drawTopText(ctx) {
      const canvas = get("getCanvas", null);
      const player = get("getPlayer", null);
      const playerRect = get("getPlayerRect", null) || {};
      const tileSize = Number(get("getTileSize", 32)) || 32;
      const world = get("getWorld", null);
      const signId = Number(get("getSignId", 0)) || 0;
      const worldSize = get("getWorldSize", null) || {};
      const worldW = Number(worldSize.w) || 0;
      const worldH = Number(worldSize.h) || 0;
      const camera = get("getCamera", null) || {};
      const cameraZoom = Number(get("getCameraZoom", 1)) || 1;
      const wrapChatText = opts.wrapChatText || ((text) => [String(text || "")]);
      if (!ctx || !canvas || !player || !world) return;

      const pw = Number(playerRect.w) || 22;
      const ph = Number(playerRect.h) || 30;
      const tx = Math.floor((player.x + pw / 2) / tileSize);
      const ty = Math.floor((player.y + ph / 2) / tileSize);
      if (tx < 0 || ty < 0 || tx >= worldW || ty >= worldH) return;
      if (!world[ty] || world[ty][tx] !== signId) return;
      const text = getLocalText(tx, ty);
      if (!text) return;

      const cameraX = Number(camera.x) || 0;
      const cameraY = Number(camera.y) || 0;
      const tileScreenX = (tx * tileSize - cameraX) * cameraZoom;
      const tileScreenY = (ty * tileSize - cameraY) * cameraZoom;
      const tileScreenSize = tileSize * cameraZoom;
      if (tileScreenX + tileScreenSize < -8 || tileScreenY + tileScreenSize < -8 || tileScreenX > canvas.width + 8 || tileScreenY > canvas.height + 8) {
        return;
      }

      ctx.save();
      ctx.font = "17px 'Trebuchet MS', sans-serif";
      const padX = 8;
      const padY = 6;
      const maxW = Math.min(300, canvas.width - 24);
      const lines = wrapChatText(text, maxW - padX * 2).slice(0, 4);
      let widest = 0;
      for (let i = 0; i < lines.length; i++) {
        widest = Math.max(widest, ctx.measureText(lines[i]).width);
      }
      const bubbleW = Math.min(maxW, Math.max(70, widest + padX * 2));
      const lineH = 20;
      const bubbleH = lines.length * lineH + padY * 2;
      let x = tileScreenX + (tileScreenSize - bubbleW) * 0.5;
      let y = tileScreenY - bubbleH - 6;
      if (x < 4) x = 4;
      if (x + bubbleW > canvas.width - 4) x = canvas.width - 4 - bubbleW;
      if (y < 4) y = 4;
      ctx.fillStyle = "rgba(12, 24, 35, 0.9)";
      ctx.fillRect(x, y, bubbleW, bubbleH);
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.strokeRect(x, y, bubbleW, bubbleH);
      ctx.fillStyle = "#f4f9ff";
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x + padX, y + padY + 14 + i * lineH);
      }
      ctx.restore();
    }

    function clearAll() {
      signTexts.clear();
      closeModal();
    }

    function getEditContext() {
      return signEditContext ? { tx: signEditContext.tx, ty: signEditContext.ty } : null;
    }

    function isEditingTile(tx, ty) {
      return Boolean(signEditContext && signEditContext.tx === tx && signEditContext.ty === ty);
    }

    return {
      setLocalText,
      getLocalText,
      closeModal,
      saveText,
      openModal,
      drawTopText,
      clearAll,
      getEditContext,
      isEditingTile
    };
  }

  return {
    createController
  };
})();
