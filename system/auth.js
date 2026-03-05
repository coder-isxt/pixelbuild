window.GTModules = window.GTModules || {};

window.GTModules.auth = (function createAuthModule() {
  function validateCredentials(username, password) {
    if (!/^[a-z0-9_]{3,20}$/.test(String(username || ""))) {
      return "Username must be 3-20 chars: a-z, 0-9, _.";
    }
    const pass = String(password || "");
    if (pass.length < 4 || pass.length > 64) {
      return "Password must be 4-64 characters.";
    }
    return "";
  }

  function sha256HexJs(text) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    function utf8Bytes(str) {
      const out = [];
      for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code < 0x80) {
          out.push(code);
        } else if (code < 0x800) {
          out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else if (code >= 0xd800 && code <= 0xdbff) {
          i++;
          const low = str.charCodeAt(i);
          const cp = ((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
          out.push(
            0xf0 | (cp >> 18),
            0x80 | ((cp >> 12) & 0x3f),
            0x80 | ((cp >> 6) & 0x3f),
            0x80 | (cp & 0x3f)
          );
        } else {
          out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
      }
      return out;
    }
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const bytes = utf8Bytes(String(text || ""));
    const bitLenHi = Math.floor((bytes.length * 8) / 0x100000000);
    const bitLenLo = (bytes.length * 8) >>> 0;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    bytes.push((bitLenHi >>> 24) & 0xff, (bitLenHi >>> 16) & 0xff, (bitLenHi >>> 8) & 0xff, bitLenHi & 0xff);
    bytes.push((bitLenLo >>> 24) & 0xff, (bitLenLo >>> 16) & 0xff, (bitLenLo >>> 8) & 0xff, bitLenLo & 0xff);
    const w = new Array(64);
    for (let i = 0; i < bytes.length; i += 64) {
      for (let t = 0; t < 16; t++) {
        const j = i + t * 4;
        w[t] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
      }
      for (let t = 16; t < 64; t++) {
        const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (((w[t - 16] + s0) >>> 0) + ((w[t - 7] + s1) >>> 0)) >>> 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let t = 0; t < 64; t++) {
        const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (((((hh + S1) >>> 0) + ch) >>> 0) + ((k[t] + w[t]) >>> 0)) >>> 0;
        const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return h.map((n) => n.toString(16).padStart(8, "0")).join("");
  }

  async function sha256Hex(text) {
    const subtle = (globalThis.crypto && globalThis.crypto.subtle) ? globalThis.crypto.subtle : null;
    if (subtle) {
      const bytes = new TextEncoder().encode(String(text || ""));
      const hash = await subtle.digest("SHA-256", bytes);
      const array = Array.from(new Uint8Array(hash));
      return array.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256HexJs(text);
  }

  function createController(options) {
    const opts = options || {};
    const dbModule = (window.GTModules && window.GTModules.db) || null;

    function get(k, fallback) {
      const fn = opts[k];
      if (typeof fn === "function") return fn();
      return fn === undefined ? fallback : fn;
    }

    async function getAuthDb() {
      if (dbModule && typeof dbModule.getOrInitAuthDb === "function") {
        return dbModule.getOrInitAuthDb({
          network: get("getNetwork", {}),
          firebaseRef: get("getFirebase", null),
          firebaseConfig: window.FIREBASE_CONFIG,
          getFirebaseApiKey: window.getFirebaseApiKey
        });
      }
      throw new Error("DB module missing.");
    }

    async function reserveAccountSession(db, accountId, username) {
      const basePath = String(get("getBasePath", "growtopia-test"));
      const firebaseRef = get("getFirebase", null);
      const sessionRef = db.ref(basePath + "/account-sessions/" + accountId);
      const sessionId = "s_" + Math.random().toString(36).slice(2, 12);
      const startedAtLocal = Date.now();
      const result = await sessionRef.transaction((current) => {
        if (current && current.sessionId) return;
        return {
          sessionId,
          username,
          startedAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        };
      });
      if (!result.committed) {
        const addClientLog = opts.addClientLog;
        if (typeof addClientLog === "function") {
          addClientLog("Session denied for @" + username + " (already active).");
        }
        throw new Error("This account is already active in another client.");
      }
      await sessionRef.onDisconnect().remove();
      const setSession = opts.setSession;
      if (typeof setSession === "function") {
        setSession(sessionRef, sessionId, startedAtLocal);
      }
      const onChatSessionReset = opts.onChatSessionReset;
      if (typeof onChatSessionReset === "function") onChatSessionReset();
      const addClientLog = opts.addClientLog;
      if (typeof addClientLog === "function") {
        addClientLog("Session created for @" + username + " (" + sessionId + ").", accountId, username, sessionId);
      }
    }

    function releaseAccountSession() {
      const session = typeof opts.getSession === "function" ? (opts.getSession() || {}) : {};
      if (session.ref) {
        session.ref.remove().catch(() => {});
        const currentName = String(get("getPlayerName", "") || "");
        const addClientLog = opts.addClientLog;
        if (currentName && typeof addClientLog === "function") {
          addClientLog("Session released for @" + currentName + ".");
        }
      }
      const setSession = opts.setSession;
      if (typeof setSession === "function") setSession(null, "", 0);
    }

    async function createAccountAndLogin() {
      const getInput = opts.getCredentialsInput;
      const normalizeUsername = opts.normalizeUsername || ((x) => String(x || "").trim().toLowerCase());
      const setAuthBusy = opts.setAuthBusy || (() => {});
      const setAuthStatus = opts.setAuthStatus || (() => {});
      const onAuthSuccess = opts.onAuthSuccess || (() => {});
      const saveCredentials = opts.saveCredentials || (() => {});
      const addClientLog = opts.addClientLog || (() => {});
      const basePath = String(get("getBasePath", "growtopia-test"));
      if (typeof getInput !== "function") return;

      const input = getInput() || {};
      const username = normalizeUsername(input.username);
      const password = String(input.password || "");
      const validation = validateCredentials(username, password);
      if (validation) {
        setAuthStatus(validation, true);
        return;
      }
      setAuthBusy(true);
      setAuthStatus("Creating account...", false);
      try {
        const db = await getAuthDb();
        if (typeof opts.onDbReady === "function") opts.onDbReady(db);
        const usernameRef = db.ref(basePath + "/usernames/" + username);
        const accountId = "acc_" + Math.random().toString(36).slice(2, 12);
        const reserve = await usernameRef.transaction((current) => {
          if (current) return;
          return accountId;
        });
        if (!reserve.committed) {
          throw new Error("Username already exists.");
        }
        const passwordHash = await sha256Hex(password);
        const firebaseRef = get("getFirebase", null);
        await db.ref(basePath + "/accounts/" + accountId).set({
          username,
          passwordHash,
          createdAt: firebaseRef && firebaseRef.database ? firebaseRef.database.ServerValue.TIMESTAMP : Date.now()
        });
        addClientLog("Account created: @" + username + " (" + accountId + ").", accountId, username, "");
        await reserveAccountSession(db, accountId, username);
        saveCredentials(username, password);
        onAuthSuccess(accountId, username);
        setAuthStatus("Account created.", false);
      } catch (error) {
        setAuthStatus((error && error.message) || "Account creation failed.", true);
      } finally {
        setAuthBusy(false);
      }
    }

    async function loginWithAccount() {
      const getInput = opts.getCredentialsInput;
      const normalizeUsername = opts.normalizeUsername || ((x) => String(x || "").trim().toLowerCase());
      const setAuthBusy = opts.setAuthBusy || (() => {});
      const setAuthStatus = opts.setAuthStatus || (() => {});
      const onAuthSuccess = opts.onAuthSuccess || (() => {});
      const saveCredentials = opts.saveCredentials || (() => {});
      const addClientLog = opts.addClientLog || (() => {});
      const getBanStatus = opts.getBanStatus || (() => ({ active: false, expired: false, type: "temporary", reason: "", remainingMs: 0 }));
      const formatRemainingMs = opts.formatRemainingMs || ((ms) => Math.ceil(Math.max(0, ms) / 1000) + "s");
      const basePath = String(get("getBasePath", "growtopia-test"));
      if (typeof getInput !== "function") return;

      const input = getInput() || {};
      const username = normalizeUsername(input.username);
      const password = String(input.password || "");
      const validation = validateCredentials(username, password);
      if (validation) {
        setAuthStatus(validation, true);
        return;
      }
      setAuthBusy(true);
      setAuthStatus("Logging in...", false);
      try {
        const db = await getAuthDb();
        if (typeof opts.onDbReady === "function") opts.onDbReady(db);
        const usernameSnap = await db.ref(basePath + "/usernames/" + username).once("value");
        const accountId = usernameSnap.val();
        if (!accountId) throw new Error("Account not found.");
        const accountSnap = await db.ref(basePath + "/accounts/" + accountId).once("value");
        const account = accountSnap.val() || {};
        const passwordHash = await sha256Hex(password);
        if (account.passwordHash !== passwordHash) {
          addClientLog("Login failed for @" + username + " (invalid password).", accountId, username, "");
          throw new Error("Invalid password.");
        }
        const banSnap = await db.ref(basePath + "/bans/" + accountId).once("value");
        if (banSnap.exists()) {
          const banValue = banSnap.val();
          const status = getBanStatus(banValue, Date.now());
          if (status.expired) {
            await db.ref(basePath + "/bans/" + accountId).remove();
          } else if (status.active) {
            addClientLog("Login blocked for @" + username + " (banned).", accountId, username, "");
            const reasonText = status.reason ? " Reason: " + status.reason + "." : "";
            if (status.type === "permanent") {
              throw new Error("This account is permanently banned." + reasonText);
            }
            throw new Error("This account is temporarily banned for " + formatRemainingMs(status.remainingMs) + "." + reasonText);
          }
        }
        await reserveAccountSession(db, accountId, username);
        saveCredentials(username, password);
        onAuthSuccess(accountId, username);
        addClientLog("Login success: @" + username + ".");
        setAuthStatus("Logged in.", false);
      } catch (error) {
        setAuthStatus((error && error.message) || "Login failed.", true);
      } finally {
        setAuthBusy(false);
      }
    }

    return {
      validateCredentials,
      sha256Hex,
      sha256HexJs,
      getAuthDb,
      reserveAccountSession,
      releaseAccountSession,
      createAccountAndLogin,
      loginWithAccount
    };
  }

  return {
    validateCredentials,
    sha256HexJs,
    sha256Hex,
    createController
  };
})();

