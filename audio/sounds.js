window.GTModules = window.GTModules || {};

window.GTModules.sounds = (function createSoundsModule() {
  const BASE_PATH_DEFAULT = "./sounds";
  const EXTENSIONS_DEFAULT = ["mp3", "ogg", "wav", "m4a"];

  function createController(options) {
    const opts = options || {};
    const registry = new Map();
    const activeById = new Map();
    const preloadPromises = new Map();
    const pendingPlays = [];
    let muted = false;
    let masterVolume = 1;
    let unlocked = false;

    function get(k, fallback) {
      const v = opts[k];
      if (typeof v === "function") {
        try {
          const out = v();
          return out === undefined ? fallback : out;
        } catch (error) {
          return fallback;
        }
      }
      return v === undefined ? fallback : v;
    }

    function clamp01(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(1, n));
    }

    function normalizeId(id) {
      return String(id || "").trim().toLowerCase();
    }

    function getBasePath() {
      return String(get("basePath", window.GT_SOUNDS_BASE_PATH || BASE_PATH_DEFAULT) || BASE_PATH_DEFAULT).replace(/\/+$/, "");
    }

    function getExtensions() {
      const list = get("extensions", window.GT_SOUNDS_EXTENSIONS || EXTENSIONS_DEFAULT);
      return Array.isArray(list) && list.length ? list.slice() : EXTENSIONS_DEFAULT.slice();
    }

    function buildCandidates(id, fileName) {
      const base = getBasePath();
      const raw = String(fileName || "").trim();
      if (raw) {
        if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("/")) {
          return [raw];
        }
        return [base + "/" + raw.replace(/^\/+/, "")];
      }
      const exts = getExtensions();
      const out = [];
      for (let i = 0; i < exts.length; i++) {
        out.push(base + "/" + id + "." + String(exts[i]).replace(/^\./, ""));
      }
      return out;
    }

    function ensureUnlockBinding() {
      if (ensureUnlockBinding.bound) return;
      ensureUnlockBinding.bound = true;
      const unlock = () => {
        unlocked = true;
        flushPendingPlays();
      };
      window.addEventListener("pointerdown", unlock, { passive: true, once: true });
      window.addEventListener("touchstart", unlock, { passive: true, once: true });
      window.addEventListener("keydown", unlock, { passive: true, once: true });
    }
    ensureUnlockBinding.bound = false;

    function register(id, config) {
      const soundId = normalizeId(id);
      if (!soundId) return false;
      const row = (config && typeof config === "object") ? config : {};
      const candidates = buildCandidates(soundId, row.file);
      registry.set(soundId, {
        id: soundId,
        candidates,
        volume: clamp01(row.volume === undefined ? 1 : row.volume),
        loop: Boolean(row.loop)
      });
      return true;
    }

    function registerMany(defs) {
      const src = defs && typeof defs === "object" ? defs : {};
      const keys = Object.keys(src);
      for (let i = 0; i < keys.length; i++) {
        const id = keys[i];
        const def = src[id];
        if (typeof def === "string") {
          register(id, { file: def });
        } else {
          register(id, def || {});
        }
      }
    }

    function resolveSource(soundId) {
      const row = registry.get(soundId);
      if (!row) return "";
      const candidates = Array.isArray(row.candidates) ? row.candidates : [];
      return candidates.length ? candidates[0] : "";
    }

    function createAudio(soundId) {
      const row = registry.get(soundId);
      if (!row) return null;
      const src = resolveSource(soundId);
      if (!src) return null;
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.loop = Boolean(row.loop);
      audio.volume = clamp01(row.volume * masterVolume);
      return audio;
    }

    function preload(ids) {
      const list = Array.isArray(ids) ? ids : Array.from(registry.keys());
      const tasks = [];
      for (let i = 0; i < list.length; i++) {
        const soundId = normalizeId(list[i]);
        if (!soundId || !registry.has(soundId)) continue;
        if (preloadPromises.has(soundId)) {
          tasks.push(preloadPromises.get(soundId));
          continue;
        }
        const task = new Promise((resolve) => {
          const audio = createAudio(soundId);
          if (!audio) {
            resolve(false);
            return;
          }
          const done = () => resolve(true);
          const fail = () => resolve(false);
          audio.addEventListener("canplaythrough", done, { once: true });
          audio.addEventListener("error", fail, { once: true });
          try {
            audio.load();
          } catch (error) {
            resolve(false);
          }
        });
        preloadPromises.set(soundId, task);
        tasks.push(task);
      }
      return Promise.all(tasks).then(() => true);
    }

    function stop(id) {
      const soundId = normalizeId(id);
      if (!soundId) return;
      const list = activeById.get(soundId) || [];
      for (let i = 0; i < list.length; i++) {
        const audio = list[i];
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (error) {
          // ignore
        }
      }
      activeById.set(soundId, []);
    }

    function stopAll() {
      const keys = Array.from(activeById.keys());
      for (let i = 0; i < keys.length; i++) stop(keys[i]);
    }

    function performPlay(soundId, options) {
      const row = registry.get(soundId);
      if (!row) return null;
      const optsPlay = options && typeof options === "object" ? options : {};
      const audio = createAudio(soundId);
      if (!audio) return null;
      audio.loop = optsPlay.loop === undefined ? row.loop : Boolean(optsPlay.loop);
      const vol = clamp01(optsPlay.volume === undefined ? row.volume : optsPlay.volume);
      audio.volume = clamp01(vol * masterVolume);
      const list = activeById.get(soundId) || [];
      list.push(audio);
      activeById.set(soundId, list);
      const clear = () => {
        const nowList = activeById.get(soundId) || [];
        const idx = nowList.indexOf(audio);
        if (idx >= 0) nowList.splice(idx, 1);
        activeById.set(soundId, nowList);
      };
      audio.addEventListener("ended", clear, { once: true });
      audio.addEventListener("error", clear, { once: true });
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.then(() => {
          unlocked = true;
        }).catch((error) => {
          clear();
          const queueOnBlocked = Boolean(optsPlay && optsPlay.__queueOnBlocked);
          const blocked = Boolean(error && (error.name === "NotAllowedError" || error.name === "AbortError"));
          if (queueOnBlocked && blocked) {
            pendingPlays.push({
              id: soundId,
              options: {
                ...(optsPlay || {}),
                __queueOnBlocked: false
              }
            });
          }
        });
      } else {
        unlocked = true;
      }
      return audio;
    }

    function flushPendingPlays() {
      if (!unlocked || muted || !pendingPlays.length) return;
      const queued = pendingPlays.splice(0, pendingPlays.length);
      for (let i = 0; i < queued.length; i++) {
        const req = queued[i];
        if (!req || !req.id) continue;
        performPlay(req.id, req.options || null);
      }
    }

    function play(id, options) {
      const soundId = normalizeId(id);
      if (!soundId || muted) return null;
      if (!registry.has(soundId)) {
        register(soundId, {});
      }
      const row = registry.get(soundId);
      if (!row) return null;
      ensureUnlockBinding();
      if (!unlocked) {
        return performPlay(soundId, {
          ...(options && typeof options === "object" ? options : {}),
          __queueOnBlocked: true
        });
      }
      return performPlay(soundId, options);
    }

    function setMuted(nextMuted) {
      muted = Boolean(nextMuted);
      if (muted) stopAll();
      if (!muted) flushPendingPlays();
    }

    function setMasterVolume(value) {
      masterVolume = clamp01(value);
    }

    function initFromWindowDefs() {
      const defs = window.GT_SOUND_DEFS;
      if (defs && typeof defs === "object") {
        registerMany(defs);
      }
      const autoPreload = window.GT_SOUND_PRELOAD;
      if (autoPreload === false) {
        return;
      }
      if (autoPreload === true || autoPreload === undefined) {
        preload();
      } else if (Array.isArray(autoPreload)) {
        preload(autoPreload);
      }
    }

    initFromWindowDefs();

    return {
      register,
      registerMany,
      preload,
      play,
      stop,
      stopAll,
      setMuted,
      setMasterVolume,
      isMuted: () => muted,
      getMasterVolume: () => masterVolume,
      getRegisteredIds: () => Array.from(registry.keys())
    };
  }

  const defaultController = createController({});
  const globalFacade = {
    play(id, options) {
      return defaultController.play(id, options);
    },
    preload(ids) {
      return defaultController.preload(ids);
    },
    stop(id) {
      return defaultController.stop(id);
    },
    stopAll() {
      return defaultController.stopAll();
    },
    mute() {
      return defaultController.setMuted(true);
    },
    unmute() {
      return defaultController.setMuted(false);
    },
    setMuted(nextMuted) {
      return defaultController.setMuted(nextMuted);
    },
    setVolume(value) {
      return defaultController.setMasterVolume(value);
    }
  };
  window.sound = globalFacade;

  return {
    createController,
    default: defaultController,
    facade: globalFacade
  };
})();
