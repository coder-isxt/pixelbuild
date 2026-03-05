window.GTModules = window.GTModules || {};

window.GTModules.syncWorlds = (function createSyncWorldsModule() {
  function createWorldRefs(db, basePath, worldId) {
    const worldPath = String(basePath || "") + "/worlds/" + String(worldId || "");
    const playersRef = db.ref(worldPath + "/players");
    const blocksRef = db.ref(worldPath + "/blocks");
    const chatRef = db.ref(worldPath + "/chat");
    return {
      worldPath,
      playersRef,
      blocksRef,
      chatRef
    };
  }

  function createChatFeed(chatRef, startedAtMs, limit) {
    const safeLimit = Math.max(20, Math.min(300, Number(limit) || 100));
    const since = Number(startedAtMs) || 0;
    if (since > 0) {
      return chatRef.orderByChild("createdAt").startAt(since).limitToLast(safeLimit);
    }
    return chatRef.limitToLast(safeLimit);
  }

  function computeWorldOccupancy(globalPlayersRaw, normalizeWorldId) {
    const occupancy = new Map();
    const source = globalPlayersRaw || {};
    Object.keys(source).forEach((id) => {
      const player = source[id];
      if (!player || !player.world) return;
      const wid = typeof normalizeWorldId === "function"
        ? normalizeWorldId(player.world)
        : String(player.world || "").toLowerCase().trim();
      if (!wid) return;
      occupancy.set(wid, (occupancy.get(wid) || 0) + 1);
    });
    return occupancy;
  }

  function attachWorldListeners(network, handlers) {
    if (!network || !handlers) return;
    if (network.playersRef && handlers.playerAdded && handlers.playerChanged && handlers.playerRemoved) {
      network.playersRef.on("child_added", handlers.playerAdded);
      network.playersRef.on("child_changed", handlers.playerChanged);
      network.playersRef.on("child_removed", handlers.playerRemoved);
    } else if (network.playersRef && handlers.players) {
      network.playersRef.on("value", handlers.players);
    }
    if (network.blocksRef && handlers.blockAdded) {
      network.blocksRef.on("child_added", handlers.blockAdded);
    }
    if (network.blocksRef && handlers.blockChanged) {
      network.blocksRef.on("child_changed", handlers.blockChanged);
    }
    if (network.blocksRef && handlers.blockRemoved) {
      network.blocksRef.on("child_removed", handlers.blockRemoved);
    }
    if (network.chatFeedRef && handlers.chatAdded) {
      network.chatFeedRef.on("child_added", handlers.chatAdded);
    }
  }

  function detachWorldListeners(network, handlers, removePlayerRef) {
    if (!network) return;
    const h = handlers || {};
    if (network.playersRef && h.playerAdded) {
      network.playersRef.off("child_added", h.playerAdded);
    }
    if (network.playersRef && h.playerChanged) {
      network.playersRef.off("child_changed", h.playerChanged);
    }
    if (network.playersRef && h.playerRemoved) {
      network.playersRef.off("child_removed", h.playerRemoved);
    }
    if (network.playersRef && h.players) {
      network.playersRef.off("value", h.players);
    }
    if (network.blocksRef && h.blockAdded) {
      network.blocksRef.off("child_added", h.blockAdded);
    }
    if (network.blocksRef && h.blockChanged) {
      network.blocksRef.off("child_changed", h.blockChanged);
    }
    if (network.blocksRef && h.blockRemoved) {
      network.blocksRef.off("child_removed", h.blockRemoved);
    }
    if (network.chatFeedRef && h.chatAdded) {
      network.chatFeedRef.off("child_added", h.chatAdded);
    }
    if (removePlayerRef && network.playerRef) {
      network.playerRef.remove().catch(() => {});
    }
  }

  function buildWorldHandlers(options) {
    const opts = options || {};
    const remotePlayers = opts.remotePlayers;
    const playerId = String(opts.playerId || "");
    const normalizeCosmetics = typeof opts.normalizeRemoteEquippedCosmetics === "function"
      ? opts.normalizeRemoteEquippedCosmetics
      : (v) => v || {};
    const updateOnlineCount = typeof opts.updateOnlineCount === "function" ? opts.updateOnlineCount : () => {};
    const onRemotePlayerUpsert = typeof opts.onRemotePlayerUpsert === "function" ? opts.onRemotePlayerUpsert : null;
    const onRemotePlayerRemove = typeof opts.onRemotePlayerRemove === "function" ? opts.onRemotePlayerRemove : null;
    const onRemotePlayersReset = typeof opts.onRemotePlayersReset === "function" ? opts.onRemotePlayersReset : null;
    const parseTileKey = typeof opts.parseTileKey === "function" ? opts.parseTileKey : () => null;
    const applyBlockValue = typeof opts.applyBlockValue === "function" ? opts.applyBlockValue : () => {};
    const clearBlockValue = typeof opts.clearBlockValue === "function" ? opts.clearBlockValue : () => {};
    const addChatMessage = typeof opts.addChatMessage === "function" ? opts.addChatMessage : () => {};
    const onPlayerHit = typeof opts.onPlayerHit === "function" ? opts.onPlayerHit : () => {};
    const normalizeGradientColors = (raw) => {
      const src = Array.isArray(raw) ? raw : (typeof raw === "string" ? raw.split(/[|,]/g) : []);
      const out = [];
      for (let i = 0; i < src.length; i++) {
        const color = String(src[i] || "").trim().slice(0, 24);
        if (!color) continue;
        out.push(color);
        if (out.length >= 6) break;
      }
      if (!out.length) {
        out.push("#8fb4ff", "#f7fbff");
      } else if (out.length === 1) {
        out.push("#f7fbff");
      }
      return out;
    };
    const normalizeTitleStyle = (rawStyle) => {
      const style = rawStyle && typeof rawStyle === "object" ? rawStyle : {};
      const angle = Number(style.gradientAngle);
      return {
        bold: Boolean(style.bold),
        glow: Boolean(style.glow),
        rainbow: Boolean(style.rainbow),
        glowColor: String(style.glowColor || "").slice(0, 24),
        gradient: Boolean(style.gradient),
        gradientShift: style.gradientShift !== false,
        gradientAngle: Number.isFinite(angle) ? Math.max(-360, Math.min(360, angle)) : 90,
        gradientColors: normalizeGradientColors(style.gradientColors || style.colors)
      };
    };
    const normalizeTitle = (value) => {
      const raw = value && typeof value === "object" ? value : {};
      const rawStyle = raw.style && typeof raw.style === "object" ? raw.style : {};
      return {
        id: String(raw.id || "").slice(0, 32),
        name: String(raw.name || "").slice(0, 24),
        color: String(raw.color || "").slice(0, 24),
        style: normalizeTitleStyle(rawStyle)
      };
    };
    const normalizeRemotePlayer = (id, p) => ({
        id,
        accountId: (p.accountId || "").toString(),
        x: p.x,
        y: p.y,
        facing: p.facing || 1,
        name: (p.name || "Player").toString().slice(0, 16),
        cosmetics: normalizeCosmetics(p.cosmetics || {}),
        title: normalizeTitle(p.title),
        danceUntil: Math.max(0, Math.floor(Number(p.danceUntil) || 0))
      });
    const setRemotePlayer = (id, p) => {
      const normalized = normalizeRemotePlayer(id, p);
      if (onRemotePlayerUpsert) {
        onRemotePlayerUpsert(normalized);
        return;
      }
      if (!remotePlayers || typeof remotePlayers.set !== "function") return;
      remotePlayers.set(id, normalized);
    };
    const applyPlayerSnapshot = (snapshot) => {
      const id = String(snapshot && snapshot.key || "");
      if (!id || id === playerId) return;
      const p = snapshot && typeof snapshot.val === "function" ? snapshot.val() : null;
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") {
        if (onRemotePlayerRemove) {
          onRemotePlayerRemove(id);
        } else if (remotePlayers && typeof remotePlayers.delete === "function") {
          remotePlayers.delete(id);
        }
        updateOnlineCount();
        return;
      }
      setRemotePlayer(id, p);
      onPlayerHit(id, p.lastHit || null);
      updateOnlineCount();
    };

    const handlers = {};
    handlers.playerAdded = applyPlayerSnapshot;
    handlers.playerChanged = applyPlayerSnapshot;
    handlers.playerRemoved = (snapshot) => {
      const id = String(snapshot && snapshot.key || "");
      if (!id || id === playerId) return;
      if (onRemotePlayerRemove) {
        onRemotePlayerRemove(id);
      } else if (remotePlayers && typeof remotePlayers.delete === "function") {
        remotePlayers.delete(id);
      }
      updateOnlineCount();
    };
    handlers.players = (snapshot) => {
      if (onRemotePlayersReset) {
        onRemotePlayersReset();
      } else if (remotePlayers && typeof remotePlayers.clear === "function") {
        remotePlayers.clear();
      }
      const players = snapshot.val() || {};
      Object.keys(players).forEach((id) => {
        if (id === playerId) return;
        const p = players[id];
        if (!p || typeof p.x !== "number" || typeof p.y !== "number") return;
        setRemotePlayer(id, p);
        onPlayerHit(id, p.lastHit || null);
      });
      updateOnlineCount();
    };

    handlers.blockAdded = (snapshot) => {
      const tile = parseTileKey(snapshot.key || "");
      if (!tile) return;
      const id = Number(snapshot.val()) || 0;
      applyBlockValue(tile.tx, tile.ty, id);
    };
    handlers.blockChanged = handlers.blockAdded;
    handlers.blockRemoved = (snapshot) => {
      const tile = parseTileKey(snapshot.key || "");
      if (!tile) return;
      clearBlockValue(tile.tx, tile.ty);
    };
    handlers.chatAdded = (snapshot) => {
      const value = snapshot.val() || {};
      const rawTitleStyle = value.titleStyle && typeof value.titleStyle === "object" ? value.titleStyle : {};
      addChatMessage({
        name: (value.name || "Guest").toString().slice(0, 16),
        playerId: (value.playerId || "").toString(),
        sessionId: (value.sessionId || "").toString(),
        titleId: (value.titleId || "").toString().slice(0, 32),
        titleName: (value.titleName || "").toString().slice(0, 24),
        titleColor: (value.titleColor || "").toString().slice(0, 24),
        titleStyle: normalizeTitleStyle(rawTitleStyle),
        text: (value.text || "").toString().slice(0, 120),
        createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now()
      });
    };
    return handlers;
  }

  return {
    createWorldRefs,
    createChatFeed,
    computeWorldOccupancy,
    attachWorldListeners,
    detachWorldListeners,
    buildWorldHandlers
  };
})();
