window.GTModules = window.GTModules || {};

window.GTModules.db = (function createDbModule() {
  let appCheckActivated = false;

  function isLocalRuntime() {
    const host = (window.location && window.location.hostname || "").toLowerCase();
    const protocol = (window.location && window.location.protocol || "").toLowerCase();
    return protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function activateAppCheckIfConfigured(firebaseRef) {
    if (appCheckActivated) return;
    if (!firebaseRef || typeof firebaseRef.appCheck !== "function") return;

    const siteKey = String(window.FIREBASE_APP_CHECK_SITE_KEY || "").trim();
    if (!siteKey) return;

    const autoRefresh = window.FIREBASE_APP_CHECK_AUTO_REFRESH !== false;
    const allowLocal = Boolean(window.FIREBASE_APP_CHECK_ALLOW_LOCALHOST);
    if (!allowLocal && isLocalRuntime()) return;

    const debugToken = window.FIREBASE_APP_CHECK_DEBUG_TOKEN;
    if (debugToken !== undefined && debugToken !== null && debugToken !== "") {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }

    try {
      firebaseRef.appCheck().activate(siteKey, autoRefresh);
      appCheckActivated = true;
    } catch (error) {
      // keep DB flow resilient even if App Check setup fails
    }
  }

  function hasFirebaseConfig(config) {
    return Boolean(config && config.apiKey && config.projectId && config.databaseURL);
  }

  async function getOrInitAuthDb(options) {
    const opts = options || {};
    const network = opts.network || {};
    const firebaseRef = opts.firebaseRef || window.firebase;
    const firebaseConfig = opts.firebaseConfig || window.FIREBASE_CONFIG;
    const getFirebaseApiKey = typeof opts.getFirebaseApiKey === "function"
      ? opts.getFirebaseApiKey
      : (typeof window.getFirebaseApiKey === "function" ? window.getFirebaseApiKey : null);

    if (!firebaseRef) {
      throw new Error("Firebase SDK not loaded.");
    }
    if (firebaseConfig && !firebaseConfig.apiKey && typeof getFirebaseApiKey === "function") {
      try {
        firebaseConfig.apiKey = await getFirebaseApiKey();
      } catch (error) {
        throw new Error("Failed to fetch Firebase API key at runtime." + (error && error.message ? error.message : ""));
      }
    }
    if (!hasFirebaseConfig(firebaseConfig)) {
      throw new Error("Set firebase-config.js first.");
    }
    if (!firebaseRef.apps.length) {
      firebaseRef.initializeApp(firebaseConfig);
    }
    activateAppCheckIfConfigured(firebaseRef);
    if (!network.authDb) {
      network.authDb = firebaseRef.database();
    }
    return network.authDb;
  }

  function buildWorldRefs(options) {
    const opts = options || {};
    const network = opts.network || {};
    const db = opts.db || network.db;
    const basePath = String(opts.basePath || "growtopia-test");
    const worldId = String(opts.worldId || "");
    const dropMaxPerWorld = Math.max(1, Math.floor(Number(opts.dropMaxPerWorld) || 220));
    const worldChatStartedAt = Math.max(0, Math.floor(Number(opts.worldChatStartedAt) || 0));
    const playerId = String(opts.playerId || "");
    const syncWorldsModule = opts.syncWorldsModule || {};
    const syncHitsModule = opts.syncHitsModule || {};
    if (!db || !worldId) return network;

    const worldRefs = typeof syncWorldsModule.createWorldRefs === "function"
      ? syncWorldsModule.createWorldRefs(db, basePath, worldId)
      : null;

    network.playersRef = worldRefs && worldRefs.playersRef ? worldRefs.playersRef : db.ref(basePath + "/worlds/" + worldId + "/players");
    network.blocksRef = worldRefs && worldRefs.blocksRef ? worldRefs.blocksRef : db.ref(basePath + "/worlds/" + worldId + "/blocks");
    network.hitsRef = typeof syncHitsModule.createWorldHitsRef === "function"
      ? syncHitsModule.createWorldHitsRef(db, basePath, worldId)
      : db.ref(basePath + "/worlds/" + worldId + "/hits");
    network.dropsRef = db.ref(basePath + "/worlds/" + worldId + "/drops");
    network.dropFeedRef = network.dropsRef.limitToLast(dropMaxPerWorld);
    network.vendingRef = db.ref(basePath + "/worlds/" + worldId + "/vending");
    network.signsRef = db.ref(basePath + "/worlds/" + worldId + "/signs");
    network.displaysRef = db.ref(basePath + "/worlds/" + worldId + "/displays");
    network.doorsRef = db.ref(basePath + "/worlds/" + worldId + "/doors");
    network.antiGravRef = db.ref(basePath + "/worlds/" + worldId + "/anti-gravity");
    network.plantsRef = db.ref(basePath + "/worlds/" + worldId + "/plants");
    network.weatherRef = db.ref(basePath + "/worlds/" + worldId + "/weather");
    network.camerasRef = db.ref(basePath + "/worlds/" + worldId + "/cameras");
    network.cameraLogsRef = db.ref(basePath + "/worlds/" + worldId + "/camera-logs");
    network.cameraLogsFeedRef = network.cameraLogsRef.limitToLast(500);
    network.lockRef = db.ref(basePath + "/worlds/" + worldId + "/lock");
    network.chatRef = worldRefs && worldRefs.chatRef ? worldRefs.chatRef : db.ref(basePath + "/worlds/" + worldId + "/chat");
    network.chatFeedRef = typeof syncWorldsModule.createChatFeed === "function"
      ? syncWorldsModule.createChatFeed(network.chatRef, worldChatStartedAt, 100)
      : (worldChatStartedAt > 0
        ? network.chatRef.orderByChild("createdAt").startAt(worldChatStartedAt).limitToLast(100)
        : network.chatRef.limitToLast(100));
    if (network.playersRef && playerId) {
      network.playerRef = network.playersRef.child(playerId);
    }
    return network;
  }

  function attachWorldRuntimeListeners(options) {
    const opts = options || {};
    const network = opts.network || {};
    const handlers = opts.handlers || network.handlers || {};
    const syncWorldsModule = opts.syncWorldsModule || {};

    if (typeof syncWorldsModule.attachWorldListeners === "function") {
      syncWorldsModule.attachWorldListeners(network, handlers);
    }
    if (network.vendingRef && handlers.vendingAdded) {
      network.vendingRef.on("child_added", handlers.vendingAdded);
      network.vendingRef.on("child_changed", handlers.vendingChanged);
      network.vendingRef.on("child_removed", handlers.vendingRemoved);
    }
    if (network.dropFeedRef && handlers.dropAdded) {
      network.dropFeedRef.on("child_added", handlers.dropAdded);
      network.dropsRef.on("child_changed", handlers.dropChanged);
      network.dropsRef.on("child_removed", handlers.dropRemoved);
    }
    if (network.hitsRef && handlers.hitAdded) {
      network.hitsRef.on("child_added", handlers.hitAdded);
      network.hitsRef.on("child_changed", handlers.hitChanged);
      network.hitsRef.on("child_removed", handlers.hitRemoved);
    }
    if (network.signsRef && handlers.signAdded) {
      network.signsRef.on("child_added", handlers.signAdded);
      network.signsRef.on("child_changed", handlers.signChanged);
      network.signsRef.on("child_removed", handlers.signRemoved);
    }
    if (network.displaysRef && handlers.displayAdded) {
      network.displaysRef.on("child_added", handlers.displayAdded);
      network.displaysRef.on("child_changed", handlers.displayChanged);
      network.displaysRef.on("child_removed", handlers.displayRemoved);
    }
    if (network.doorsRef && handlers.doorAdded) {
      network.doorsRef.on("child_added", handlers.doorAdded);
      network.doorsRef.on("child_changed", handlers.doorChanged);
      network.doorsRef.on("child_removed", handlers.doorRemoved);
    }
    if (network.antiGravRef && handlers.antiGravAdded) {
      network.antiGravRef.on("child_added", handlers.antiGravAdded);
      network.antiGravRef.on("child_changed", handlers.antiGravChanged);
      network.antiGravRef.on("child_removed", handlers.antiGravRemoved);
    }
    if (network.plantsRef && handlers.plantAdded) {
      network.plantsRef.on("child_added", handlers.plantAdded);
      network.plantsRef.on("child_changed", handlers.plantChanged);
      network.plantsRef.on("child_removed", handlers.plantRemoved);
    }
    if (network.weatherRef && handlers.worldWeather) {
      network.weatherRef.on("value", handlers.worldWeather);
    }
    if (network.camerasRef && handlers.cameraAdded) {
      network.camerasRef.on("child_added", handlers.cameraAdded);
      network.camerasRef.on("child_changed", handlers.cameraChanged);
      network.camerasRef.on("child_removed", handlers.cameraRemoved);
    }
    if (network.cameraLogsFeedRef && handlers.cameraLogAdded) {
      network.cameraLogsFeedRef.on("child_added", handlers.cameraLogAdded);
    }
    if (network.lockRef && handlers.worldLock) {
      network.lockRef.on("value", handlers.worldLock);
    }
  }

  function detachWorldRuntimeListeners(options) {
    const opts = options || {};
    const network = opts.network || {};
    const handlers = opts.handlers || network.handlers || {};
    const syncWorldsModule = opts.syncWorldsModule || {};

    if (network.lockRef && handlers.worldLock) network.lockRef.off("value", handlers.worldLock);
    if (network.dropFeedRef && handlers.dropAdded) network.dropFeedRef.off("child_added", handlers.dropAdded);
    if (network.dropsRef && handlers.dropChanged) network.dropsRef.off("child_changed", handlers.dropChanged);
    if (network.dropsRef && handlers.dropRemoved) network.dropsRef.off("child_removed", handlers.dropRemoved);
    if (network.hitsRef && handlers.hitAdded) network.hitsRef.off("child_added", handlers.hitAdded);
    if (network.hitsRef && handlers.hitChanged) network.hitsRef.off("child_changed", handlers.hitChanged);
    if (network.hitsRef && handlers.hitRemoved) network.hitsRef.off("child_removed", handlers.hitRemoved);
    if (network.vendingRef && handlers.vendingAdded) network.vendingRef.off("child_added", handlers.vendingAdded);
    if (network.vendingRef && handlers.vendingChanged) network.vendingRef.off("child_changed", handlers.vendingChanged);
    if (network.vendingRef && handlers.vendingRemoved) network.vendingRef.off("child_removed", handlers.vendingRemoved);
    if (network.signsRef && handlers.signAdded) network.signsRef.off("child_added", handlers.signAdded);
    if (network.signsRef && handlers.signChanged) network.signsRef.off("child_changed", handlers.signChanged);
    if (network.signsRef && handlers.signRemoved) network.signsRef.off("child_removed", handlers.signRemoved);
    if (network.displaysRef && handlers.displayAdded) network.displaysRef.off("child_added", handlers.displayAdded);
    if (network.displaysRef && handlers.displayChanged) network.displaysRef.off("child_changed", handlers.displayChanged);
    if (network.displaysRef && handlers.displayRemoved) network.displaysRef.off("child_removed", handlers.displayRemoved);
    if (network.doorsRef && handlers.doorAdded) network.doorsRef.off("child_added", handlers.doorAdded);
    if (network.doorsRef && handlers.doorChanged) network.doorsRef.off("child_changed", handlers.doorChanged);
    if (network.doorsRef && handlers.doorRemoved) network.doorsRef.off("child_removed", handlers.doorRemoved);
    if (network.antiGravRef && handlers.antiGravAdded) network.antiGravRef.off("child_added", handlers.antiGravAdded);
    if (network.antiGravRef && handlers.antiGravChanged) network.antiGravRef.off("child_changed", handlers.antiGravChanged);
    if (network.antiGravRef && handlers.antiGravRemoved) network.antiGravRef.off("child_removed", handlers.antiGravRemoved);
    if (network.plantsRef && handlers.plantAdded) network.plantsRef.off("child_added", handlers.plantAdded);
    if (network.plantsRef && handlers.plantChanged) network.plantsRef.off("child_changed", handlers.plantChanged);
    if (network.plantsRef && handlers.plantRemoved) network.plantsRef.off("child_removed", handlers.plantRemoved);
    if (network.weatherRef && handlers.worldWeather) network.weatherRef.off("value", handlers.worldWeather);
    if (network.camerasRef && handlers.cameraAdded) network.camerasRef.off("child_added", handlers.cameraAdded);
    if (network.camerasRef && handlers.cameraChanged) network.camerasRef.off("child_changed", handlers.cameraChanged);
    if (network.camerasRef && handlers.cameraRemoved) network.camerasRef.off("child_removed", handlers.cameraRemoved);
    if (network.cameraLogsFeedRef && handlers.cameraLogAdded) network.cameraLogsFeedRef.off("child_added", handlers.cameraLogAdded);

    if (typeof syncWorldsModule.detachWorldListeners === "function") {
      syncWorldsModule.detachWorldListeners(network, handlers, true);
    } else if (network.playerRef) {
      network.playerRef.remove().catch(() => {});
    }
  }

  function clearWorldNetworkRefsAndHandlers(options) {
    const opts = options || {};
    const network = opts.network || {};
    network.playerRef = null;
    network.playersRef = null;
    network.blocksRef = null;
    network.hitsRef = null;
    network.dropsRef = null;
    network.dropFeedRef = null;
    network.vendingRef = null;
    network.signsRef = null;
    network.displaysRef = null;
    network.doorsRef = null;
    network.antiGravRef = null;
    network.plantsRef = null;
    network.weatherRef = null;
    network.camerasRef = null;
    network.cameraLogsRef = null;
    network.cameraLogsFeedRef = null;
    network.lockRef = null;
    network.chatRef = null;
    network.chatFeedRef = null;

    if (!network.handlers || typeof network.handlers !== "object") return;
    const keys = [
      "players", "playerAdded", "playerChanged", "playerRemoved",
      "blockAdded", "blockChanged", "blockRemoved",
      "hitAdded", "hitChanged", "hitRemoved",
      "dropAdded", "dropChanged", "dropRemoved",
      "vendingAdded", "vendingChanged", "vendingRemoved",
      "signAdded", "signChanged", "signRemoved",
      "displayAdded", "displayChanged", "displayRemoved",
      "doorAdded", "doorChanged", "doorRemoved",
      "antiGravAdded", "antiGravChanged", "antiGravRemoved",
      "plantAdded", "plantChanged", "plantRemoved",
      "worldWeather", "cameraAdded", "cameraChanged", "cameraRemoved",
      "cameraLogAdded", "worldLock", "chatAdded"
    ];
    for (const key of keys) network.handlers[key] = null;
  }

  return {
    hasFirebaseConfig,
    getOrInitAuthDb,
    buildWorldRefs,
    attachWorldRuntimeListeners,
    detachWorldRuntimeListeners,
    clearWorldNetworkRefsAndHandlers
  };
})();
