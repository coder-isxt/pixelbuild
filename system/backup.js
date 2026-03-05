window.GTModules = window.GTModules || {};

window.GTModules.backup = (function createBackupModule() {
  const BACKUPS_KEY = "backups";

  function safeClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return {};
    }
  }

  function normalizeId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
  }

  function buildBackupId() {
    return "bk_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeBasePath(value) {
    return String(value || "").trim().replace(/^\/+|\/+$/g, "");
  }

  function buildAbsolutePath(basePath, path) {
    const base = normalizeBasePath(basePath);
    const tail = String(path || "").trim().replace(/^\/+|\/+$/g, "");
    if (!base) return "";
    if (!tail) return "/" + base;
    return "/" + base + "/" + tail;
  }

  function toErrorMessage(out, fallback) {
    if (out && out.error) return String(out.error);
    if (out && Number.isFinite(Number(out.status)) && Number(out.status) > 0) {
      return "Backend request failed (" + Number(out.status) + ").";
    }
    return String(fallback || "Backend request failed.");
  }

  function getGatewayController(opts) {
    const options = opts || {};
    const gateway = options.gateway || null;
    if (!gateway || typeof gateway !== "object") return null;
    if (typeof gateway.writeSet !== "function") return null;
    if (typeof gateway.writeUpdate !== "function") return null;
    return gateway;
  }

  function gatewayWriteSet(gateway, path, value) {
    return gateway.writeSet(path, value).then((out) => {
      if (!out || !out.ok) {
        throw new Error(toErrorMessage(out, "Failed to write backup data."));
      }
      return out;
    });
  }

  function gatewayWriteUpdate(gateway, path, value) {
    return gateway.writeUpdate(path, value).then((out) => {
      if (!out || !out.ok) {
        throw new Error(toErrorMessage(out, "Failed to update backup data."));
      }
      return out;
    });
  }

  function removeBackupsNode(rootData) {
    const src = rootData && typeof rootData === "object" ? rootData : {};
    const next = safeClone(src);
    if (next && typeof next === "object") {
      delete next[BACKUPS_KEY];
    }
    return next;
  }

  function parseBackupEntry(id, raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    const keys = value.rootKeys && typeof value.rootKeys === "object" ? Object.keys(value.rootKeys) : [];
    const altKeys = Array.isArray(value.rootKeys) ? value.rootKeys : [];
    return {
      id: normalizeId(id),
      createdAt: Number(value.createdAt) || 0,
      createdByAccountId: String(value.createdByAccountId || ""),
      createdByUsername: String(value.createdByUsername || ""),
      rootKeyCount: Math.max(0, keys.length || altKeys.length),
      note: String(value.note || "")
    };
  }

  function loadBackupRecord(opts) {
    const options = opts || {};
    const db = options.db || null;
    const basePath = normalizeBasePath(options.basePath);
    const backupId = normalizeId(options.backupId);
    if (!db || !basePath || !backupId) return Promise.resolve(null);
    return db.ref(basePath + "/" + BACKUPS_KEY + "/" + backupId).once("value").then((snapshot) => {
      const value = snapshot && typeof snapshot.val === "function" ? (snapshot.val() || null) : null;
      if (!value || typeof value !== "object") return null;
      return {
        id: backupId,
        value: safeClone(value)
      };
    });
  }

  function listBackups(opts) {
    const options = opts || {};
    const db = options.db || null;
    const basePath = normalizeBasePath(options.basePath);
    const limit = Math.max(1, Math.min(200, Number(options.limit) || 60));
    if (!db || !basePath) return Promise.resolve([]);
    const ref = db.ref(basePath + "/" + BACKUPS_KEY).limitToLast(limit);
    return ref.once("value").then((snapshot) => {
      const data = snapshot && typeof snapshot.val === "function" ? (snapshot.val() || {}) : {};
      const rows = Object.keys(data).map((id) => parseBackupEntry(id, data[id])).filter((row) => row.id);
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return rows;
    });
  }

  function createBackup(opts) {
    const options = opts || {};
    const gateway = getGatewayController(options);
    const db = options.db || null;
    const firebase = options.firebase || null;
    const basePath = normalizeBasePath(options.basePath);
    const createdByAccountId = String(options.createdByAccountId || "").slice(0, 96);
    const createdByUsername = String(options.createdByUsername || "").slice(0, 24);
    if (!db || !basePath) return Promise.reject(new Error("db/basePath unavailable"));
    const rootRef = db.ref(basePath);
    const backupsRef = db.ref(basePath + "/" + BACKUPS_KEY);
    return rootRef.once("value").then((snapshot) => {
      const rootData = snapshot && typeof snapshot.val === "function" ? (snapshot.val() || {}) : {};
      const data = removeBackupsNode(rootData);
      const backupId = buildBackupId();
      const rootKeys = Object.keys(data || {});
      const payload = {
        id: backupId,
        createdByAccountId,
        createdByUsername,
        createdAt: gateway
          ? Date.now()
          : (firebase && firebase.database && firebase.database.ServerValue
          ? firebase.database.ServerValue.TIMESTAMP
          : Date.now()),
        schemaVersion: 1,
        rootKeys,
        data
      };
      if (gateway) {
        const backupPath = buildAbsolutePath(basePath, BACKUPS_KEY + "/" + backupId);
        return gatewayWriteSet(gateway, backupPath, payload).then(() => ({
          id: backupId,
          rootKeyCount: rootKeys.length
        }));
      }
      return backupsRef.child(backupId).set(payload).then(() => {
        return {
          id: backupId,
          rootKeyCount: rootKeys.length
        };
      });
    });
  }

  function restoreBackup(opts) {
    const options = opts || {};
    const gateway = getGatewayController(options);
    const db = options.db || null;
    const firebase = options.firebase || null;
    const basePath = normalizeBasePath(options.basePath);
    const backupId = normalizeId(options.backupId);
    if (!db || !basePath || !backupId) return Promise.reject(new Error("db/basePath/backupId unavailable"));
    const rootRef = db.ref(basePath);
    const backupRef = db.ref(basePath + "/" + BACKUPS_KEY + "/" + backupId);
    return Promise.all([backupRef.once("value"), rootRef.once("value")]).then(([backupSnap, currentSnap]) => {
      const backupValue = backupSnap && typeof backupSnap.val === "function" ? (backupSnap.val() || {}) : {};
      const backupData = backupValue.data && typeof backupValue.data === "object" ? backupValue.data : null;
      if (!backupData) {
        throw new Error("Backup not found or invalid");
      }
      const currentRoot = currentSnap && typeof currentSnap.val === "function" ? (currentSnap.val() || {}) : {};
      const updates = {};
      Object.keys(currentRoot || {}).forEach((key) => {
        if (key === BACKUPS_KEY) return;
        updates[key] = null;
      });
      Object.keys(backupData).forEach((key) => {
        if (key === BACKUPS_KEY) return;
        updates[key] = backupData[key];
      });
      updates[BACKUPS_KEY + "/" + backupId + "/lastRestoredAt"] = gateway
        ? Date.now()
        : (firebase && firebase.database && firebase.database.ServerValue
          ? firebase.database.ServerValue.TIMESTAMP
          : Date.now());
      if (gateway) {
        const rootPath = buildAbsolutePath(basePath, "");
        return gatewayWriteUpdate(gateway, rootPath, updates).then(() => ({
          id: backupId,
          rootKeyCount: Object.keys(backupData || {}).length
        }));
      }
      return rootRef.update(updates).then(() => {
        return {
          id: backupId,
          rootKeyCount: Object.keys(backupData || {}).length
        };
      });
    });
  }

  function exportBackupJson(opts) {
    const options = opts || {};
    const backupId = normalizeId(options.backupId);
    return loadBackupRecord({
      db: options.db,
      basePath: options.basePath,
      backupId
    }).then((row) => {
      if (!row || !row.value) {
        throw new Error("Backup not found");
      }
      const payload = {
        format: "gt-backup-v1",
        exportedAt: Date.now(),
        backupId: row.id,
        backup: row.value
      };
      return safeClone(payload);
    });
  }

  function importBackupJson(opts) {
    const options = opts || {};
    const gateway = getGatewayController(options);
    const db = options.db || null;
    const firebase = options.firebase || null;
    const basePath = normalizeBasePath(options.basePath);
    const createdByAccountId = String(options.createdByAccountId || "").slice(0, 96);
    const createdByUsername = String(options.createdByUsername || "").slice(0, 24);
    const source = options.json && typeof options.json === "object" ? safeClone(options.json) : null;
    if (!basePath || !source) return Promise.reject(new Error("Invalid import payload"));

    const explicit = source.backup && typeof source.backup === "object" ? source.backup : null;
    const embeddedData = explicit && explicit.data && typeof explicit.data === "object" ? explicit.data : null;
    const rawData = embeddedData || source.data || source;
    if (!rawData || typeof rawData !== "object") {
      return Promise.reject(new Error("Import payload missing object data"));
    }
    const data = removeBackupsNode(rawData);
    const backupId = "imp_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    const rootKeys = Object.keys(data || {});
    const payload = {
      id: backupId,
      createdByAccountId,
      createdByUsername,
      createdAt: gateway
        ? Date.now()
        : (firebase && firebase.database && firebase.database.ServerValue
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now()),
      schemaVersion: 1,
      imported: true,
      importedFromBackupId: explicit && explicit.id ? String(explicit.id) : "",
      importedFormat: String(source.format || "").slice(0, 48),
      rootKeys,
      data
    };
    if (gateway) {
      const path = buildAbsolutePath(basePath, BACKUPS_KEY + "/" + backupId);
      return gatewayWriteSet(gateway, path, payload).then(() => ({
        id: backupId,
        rootKeyCount: rootKeys.length
      }));
    }
    if (!db) return Promise.reject(new Error("db/basePath unavailable"));
    return db.ref(basePath + "/" + BACKUPS_KEY + "/" + backupId).set(payload).then(() => ({
      id: backupId,
      rootKeyCount: rootKeys.length
    }));
  }

  return {
    BACKUPS_KEY,
    listBackups,
    createBackup,
    restoreBackup,
    exportBackupJson,
    importBackupJson
  };
})();
