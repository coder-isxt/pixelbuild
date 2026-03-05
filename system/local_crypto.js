window.GTModules = window.GTModules || {};

(function initSecureStorageModule() {
  const ENDPOINT_DEFAULT = "https://growtopia.isxtgg.workers.dev/encryptionkey";
  const PREFIX = "enc1:";
  const pendingWrites = new Map();
  let keyString = "";
  let keyBytes = null;
  let keyPromise = null;

  function utf8Encode(text) {
    return new TextEncoder().encode(String(text || ""));
  }

  function utf8Decode(bytes) {
    return new TextDecoder().decode(bytes);
  }

  function toBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function fromBase64(input) {
    const bin = atob(String(input || ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
    return out;
  }

  function hashSeed(bytes) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function makeMask(length, seed) {
    const out = new Uint8Array(length);
    let x = (seed >>> 0) || 0x6d2b79f5;
    for (let i = 0; i < length; i++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      out[i] = x & 255;
    }
    return out;
  }

  function buildSeedBytes(nonce) {
    const merged = new Uint8Array((keyBytes ? keyBytes.length : 0) + nonce.length);
    if (keyBytes && keyBytes.length) merged.set(keyBytes, 0);
    merged.set(nonce, keyBytes ? keyBytes.length : 0);
    return merged;
  }

  function getRandomBytes(size) {
    const out = new Uint8Array(size);
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      window.crypto.getRandomValues(out);
      return out;
    }
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.floor(Math.random() * 256) & 255;
    }
    return out;
  }

  function encryptText(plainText) {
    if (!keyBytes || !keyBytes.length) return "";
    const plain = utf8Encode(plainText);
    const nonce = getRandomBytes(12);
    const seed = hashSeed(buildSeedBytes(nonce));
    const mask = makeMask(plain.length, seed);
    const cipher = new Uint8Array(plain.length + nonce.length);
    cipher.set(nonce, 0);
    for (let i = 0; i < plain.length; i++) {
      cipher[nonce.length + i] = plain[i] ^ mask[i];
    }
    return PREFIX + toBase64(cipher);
  }

  function decryptText(payload) {
    if (!payload || typeof payload !== "string") return "";
    if (!payload.startsWith(PREFIX)) return payload;
    if (!keyBytes || !keyBytes.length) return "";
    const packed = fromBase64(payload.slice(PREFIX.length));
    if (!packed || packed.length < 12) return "";
    const nonce = packed.slice(0, 12);
    const body = packed.slice(12);
    const seed = hashSeed(buildSeedBytes(nonce));
    const mask = makeMask(body.length, seed);
    const plain = new Uint8Array(body.length);
    for (let i = 0; i < body.length; i++) {
      plain[i] = body[i] ^ mask[i];
    }
    return utf8Decode(plain);
  }

  function setRuntimeKey(rawKey) {
    const safe = String(rawKey || "").trim();
    if (!safe) return false;
    keyString = safe;
    keyBytes = utf8Encode(safe);
    return true;
  }

  function getEndpoint() {
    return window.ENCRYPTION_KEY_ENDPOINT || ENDPOINT_DEFAULT;
  }

  async function fetchKeyFromWorker() {
    const res = await fetch(getEndpoint(), {
      cache: "no-store",
      headers: { Accept: "application/json, text/plain;q=0.9" }
    });
    if (!res.ok) throw new Error("Encryption key blocked: " + res.status);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const data = await res.json();
      if (!data || data.ok !== true || typeof data.key !== "string") {
        throw new Error((data && data.error) ? String(data.error) : "Invalid encryption key response.");
      }
      return data.key;
    }
    return await res.text();
  }

  function flushPendingWrites() {
    if (!keyBytes || !pendingWrites.size) return;
    pendingWrites.forEach((value, key) => {
      try {
        const encrypted = encryptText(JSON.stringify(value));
        if (!encrypted) return;
        localStorage.setItem(key, encrypted);
      } catch (error) {
        // ignore
      }
    });
    pendingWrites.clear();
  }

  function isLocalRuntime() {
    const host = (window.location && window.location.hostname || "").toLowerCase();
    const protocol = (window.location && window.location.protocol || "").toLowerCase();
    return protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  async function ensureKey() {
    if (keyBytes && keyBytes.length) return keyString;
    if (keyPromise) return keyPromise;
    keyPromise = (async () => {
      try {
        const workerKey = await fetchKeyFromWorker();
        if (!setRuntimeKey(workerKey)) throw new Error("Empty encryption key.");
      } catch (error) {
        if (isLocalRuntime()) {
          const entered = window.prompt("Enter local encryption key:");
          if (!setRuntimeKey(entered)) throw new Error("Missing local encryption key.");
        } else {
          throw error;
        }
      }
      flushPendingWrites();
      return keyString;
    })().catch((error) => {
      keyPromise = null;
      throw error;
    });
    return keyPromise;
  }

  function saveJson(storageKey, value) {
    const key = String(storageKey || "");
    if (!key) return;
    if (keyBytes && keyBytes.length) {
      try {
        const encrypted = encryptText(JSON.stringify(value));
        if (!encrypted) return;
        localStorage.setItem(key, encrypted);
      } catch (error) {
        // ignore
      }
      return;
    }
    pendingWrites.set(key, value);
    ensureKey().catch(() => {});
  }

  function loadJson(storageKey) {
    const key = String(storageKey || "");
    if (!key) return null;
    let raw = "";
    try {
      raw = localStorage.getItem(key) || "";
    } catch (error) {
      return null;
    }
    if (!raw) return null;
    try {
      if (raw.startsWith(PREFIX)) {
        if (!keyBytes || !keyBytes.length) return null;
        const opened = decryptText(raw);
        if (!opened) return null;
        return JSON.parse(opened);
      }
      const parsed = JSON.parse(raw);
      // Legacy plaintext migration: re-save encrypted once key is ready.
      if (keyBytes && keyBytes.length && parsed && typeof parsed === "object") {
        try {
          saveJson(key, parsed);
        } catch (error) {
          // ignore migration failures
        }
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function loadJsonAsync(storageKey) {
    return ensureKey()
      .then(() => loadJson(storageKey))
      .catch(() => loadJson(storageKey));
  }

  window.GTModules.secureStorage = {
    init: ensureKey,
    saveJson,
    loadJson,
    loadJsonAsync,
    isReady: function isReady() {
      return Boolean(keyBytes && keyBytes.length);
    }
  };

  ensureKey().catch(() => {});
})();
