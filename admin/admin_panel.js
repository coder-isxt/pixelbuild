window.GTModules = window.GTModules || {};

window.GTModules.adminPanel = (function createAdminPanelModule() {
  function createController(options) {
    const opts = options || {};
    let lastBackupRefreshAt = 0;
    let backupRefreshPromise = null;

    function nowMs() {
      return Date.now();
    }

    function read(name, fallback) {
      const value = opts[name];
      if (typeof value === "function") return value();
      return value === undefined ? fallback : value;
    }

    function call(name) {
      const fn = opts[name];
      if (typeof fn !== "function") return undefined;
      const args = Array.prototype.slice.call(arguments, 1);
      return fn.apply(null, args);
    }

    function cleanText(value, maxLen) {
      return String(value || "").trim().slice(0, maxLen || 0x7fffffff);
    }

    function cleanBackupId(value) {
      return String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
    }

    function getNetwork() {
      return read("getNetwork", {}) || {};
    }

    function getBackupModule() {
      return read("getBackupModule", {}) || {};
    }

    function getFirebase() {
      return read("getFirebase", null);
    }

    function getGatewayController() {
      const gateway = read("getGatewayController", null);
      return gateway && typeof gateway === "object" ? gateway : null;
    }

    function getBasePath() {
      return cleanText(read("getBasePath", ""), 120);
    }

    function hasAdminPermission(key) {
      if (typeof opts.hasAdminPermission === "function") {
        return Boolean(opts.hasAdminPermission(key));
      }
      return false;
    }

    function postLocalSystemChat(text) {
      call("postLocalSystemChat", cleanText(text, 220));
    }

    function isAdminOpen() {
      return Boolean(read("getIsAdminOpen", false));
    }

    function getAdminState() {
      const value = read("getAdminState", {});
      return value && typeof value === "object" ? value : {};
    }

    function getBackupList() {
      const value = read("getAdminBackupList", []);
      return Array.isArray(value) ? value : [];
    }

    function setBackupList(rows) {
      call("setAdminBackupList", Array.isArray(rows) ? rows : []);
    }

    function getStoredSelectedBackupId() {
      return cleanBackupId(read("getAdminBackupSelectedId", ""));
    }

    function setStoredSelectedBackupId(value) {
      call("setAdminBackupSelectedId", cleanBackupId(value));
    }

    function setBackupLoading(value) {
      call("setAdminBackupLoading", Boolean(value));
    }

    function getBackupLoading() {
      return Boolean(read("getAdminBackupLoading", false));
    }

    function getEscapeHtml() {
      if (typeof opts.escapeHtml === "function") return opts.escapeHtml;
      return function fallbackEscapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll("\"", "&quot;")
          .replaceAll("'", "&#039;");
      };
    }

    function parseBackupRows(rows) {
      const list = Array.isArray(rows) ? rows : [];
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const row = list[i] && typeof list[i] === "object" ? list[i] : {};
        const id = cleanBackupId(row.id);
        if (!id) continue;
        out.push({
          id,
          createdAt: Number(row.createdAt) || 0,
          createdByAccountId: cleanText(row.createdByAccountId, 96),
          createdByUsername: cleanText(row.createdByUsername, 24),
          rootKeyCount: Math.max(0, Math.floor(Number(row.rootKeyCount) || 0)),
          note: cleanText(row.note, 80)
        });
      }
      out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return out;
    }

    function ensureSelectedBackupId(candidate) {
      const preferred = cleanBackupId(candidate);
      const rows = getBackupList();
      const firstId = rows.length ? cleanBackupId(rows[0].id) : "";
      const hasPreferred = preferred && rows.some((row) => cleanBackupId(row.id) === preferred);
      const next = hasPreferred ? preferred : firstId;
      setStoredSelectedBackupId(next);
      return next;
    }

    function formatBackupLabel(row) {
      const item = row && typeof row === "object" ? row : {};
      const id = cleanBackupId(item.id);
      if (!id) return "";
      const createdAt = Number(item.createdAt) || 0;
      if (!createdAt) return id;
      return id + " | " + new Date(createdAt).toLocaleString();
    }

    function getSelectedBackupId() {
      const rootEl = read("getAdminAccountsEl", null);
      if (rootEl && typeof rootEl.querySelector === "function") {
        const selectEl = rootEl.querySelector(".admin-console-backup");
        if (selectEl instanceof HTMLSelectElement) {
          const fromUi = cleanBackupId(selectEl.value);
          if (fromUi) {
            setStoredSelectedBackupId(fromUi);
            return fromUi;
          }
        }
      }
      const stored = getStoredSelectedBackupId();
      if (stored) return stored;
      return ensureSelectedBackupId("");
    }

    function getAdminBackupOptionsMarkup() {
      const rows = getBackupList();
      if (!rows.length) return "<option value=''>No backups found</option>";
      const esc = getEscapeHtml();
      const selectedId = getSelectedBackupId();
      const options = rows.map((row) => {
        const id = cleanBackupId(row.id);
        if (!id) return "";
        const selectedAttr = selectedId && selectedId === id ? " selected" : "";
        return "<option value='" + esc(id) + "'" + selectedAttr + ">" + esc(formatBackupLabel(row)) + "</option>";
      }).join("");
      return options || "<option value=''>No backups found</option>";
    }

    function refreshAdminBackups(force) {
      if (!hasAdminPermission("db_restore")) {
        setBackupList([]);
        setStoredSelectedBackupId("");
        return Promise.resolve([]);
      }
      const now = nowMs();
      if (!force && backupRefreshPromise) return backupRefreshPromise;
      if (!force && (now - lastBackupRefreshAt) < 7000) {
        return Promise.resolve(getBackupList());
      }
      const network = getNetwork();
      const backup = getBackupModule();
      const basePath = getBasePath();
      if (!network.db || !basePath || typeof backup.listBackups !== "function") {
        setBackupList([]);
        setStoredSelectedBackupId("");
        return Promise.resolve([]);
      }
      setBackupLoading(true);
      const selectedBefore = getStoredSelectedBackupId();
      backupRefreshPromise = backup.listBackups({
        db: network.db,
        basePath,
        limit: 80
      }).then((rows) => {
        const list = parseBackupRows(rows);
        setBackupList(list);
        ensureSelectedBackupId(selectedBefore);
        lastBackupRefreshAt = nowMs();
        if (isAdminOpen()) {
          call("renderAdminPanel");
        }
        return list;
      }).catch(() => {
        postLocalSystemChat("Failed to load backups.");
        return [];
      }).finally(() => {
        setBackupLoading(false);
        backupRefreshPromise = null;
      });
      return backupRefreshPromise;
    }

    function runDatabaseBackup(sourceTag) {
      if (!hasAdminPermission("db_backup")) {
        postLocalSystemChat("Permission denied.");
        return;
      }
      if (getBackupLoading()) {
        postLocalSystemChat("Backup operation already in progress.");
        return;
      }
      const network = getNetwork();
      const gateway = getGatewayController();
      const backup = getBackupModule();
      const basePath = getBasePath();
      if (!network.db || !gateway || !basePath || typeof backup.createBackup !== "function") {
        postLocalSystemChat("Cloudflare backend unavailable.");
        return;
      }
      const source = cleanText(sourceTag || "panel", 16) || "panel";
      setBackupLoading(true);
      backup.createBackup({
        db: network.db,
        gateway,
        firebase: getFirebase(),
        basePath,
        createdByAccountId: cleanText(read("getPlayerProfileId", ""), 96),
        createdByUsername: cleanText(read("getPlayerName", ""), 20)
      }).then((result) => {
        const backupId = cleanBackupId(result && result.id);
        const keyCount = Math.max(0, Math.floor(Number(result && result.rootKeyCount) || 0));
        if (backupId) setStoredSelectedBackupId(backupId);
        call("logAdminAudit", "Admin(" + source + ") created database backup " + (backupId || "(unknown)") + ".");
        call("pushAdminAuditEntry", "db_backup", "", "backup=" + (backupId || "unknown") + " keys=" + keyCount);
        postLocalSystemChat("Backup created: " + (backupId || "unknown") + ".");
        return refreshAdminBackups(true);
      }).catch(() => {
        postLocalSystemChat("Failed to create backup.");
      }).finally(() => {
        setBackupLoading(false);
      });
    }

    function runDatabaseRestore(backupId, sourceTag) {
      if (!hasAdminPermission("db_restore")) {
        postLocalSystemChat("Permission denied.");
        return;
      }
      if (getBackupLoading()) {
        postLocalSystemChat("Backup operation already in progress.");
        return;
      }
      const id = cleanBackupId(backupId || getSelectedBackupId());
      if (!id) {
        postLocalSystemChat("Select a backup first.");
        return;
      }
      const accepted = typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm("Restore backup " + id + "? This overwrites current database data.")
        : true;
      if (!accepted) return;
      const network = getNetwork();
      const gateway = getGatewayController();
      const backup = getBackupModule();
      const basePath = getBasePath();
      if (!network.db || !gateway || !basePath || typeof backup.restoreBackup !== "function") {
        postLocalSystemChat("Cloudflare backend unavailable.");
        return;
      }
      const source = cleanText(sourceTag || "panel", 16) || "panel";
      setBackupLoading(true);
      backup.restoreBackup({
        db: network.db,
        gateway,
        firebase: getFirebase(),
        basePath,
        backupId: id
      }).then((result) => {
        const rootKeyCount = Math.max(0, Math.floor(Number(result && result.rootKeyCount) || 0));
        call("logAdminAudit", "Admin(" + source + ") restored backup " + id + ".");
        call("pushAdminAuditEntry", "db_restore", "", "backup=" + id + " keys=" + rootKeyCount);
        postLocalSystemChat("Backup restored: " + id + ".");
        return refreshAdminBackups(true);
      }).catch((error) => {
        const message = error && error.message ? error.message : "Failed to restore backup.";
        postLocalSystemChat(message);
      }).finally(() => {
        setBackupLoading(false);
      });
    }

    function downloadJsonFile(filename, payload) {
      const text = JSON.stringify(payload || {}, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cleanText(filename || "export.json", 120).replace(/[\\/:*?"<>|]+/g, "_");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
    }

    function downloadSelectedBackupJson() {
      if (!hasAdminPermission("db_restore")) {
        postLocalSystemChat("Permission denied.");
        return;
      }
      const backupId = cleanBackupId(getSelectedBackupId());
      if (!backupId) {
        postLocalSystemChat("Select a backup first.");
        return;
      }
      const network = getNetwork();
      const backup = getBackupModule();
      const basePath = getBasePath();
      if (!network.db || !basePath || typeof backup.exportBackupJson !== "function") {
        postLocalSystemChat("Export module unavailable.");
        return;
      }
      backup.exportBackupJson({
        db: network.db,
        basePath,
        backupId
      }).then((payload) => {
        downloadJsonFile("growtopia-backup-" + backupId + ".json", payload || {});
        call("logAdminAudit", "Admin(panel) exported backup JSON " + backupId + ".");
        call("pushAdminAuditEntry", "db_export_json", "", "backup=" + backupId);
        postLocalSystemChat("Backup JSON downloaded.");
      }).catch((error) => {
        const message = error && error.message ? error.message : "Failed to export backup JSON.";
        postLocalSystemChat(message);
      });
    }

    function readFileText(file) {
      if (!file) return Promise.reject(new Error("No file selected."));
      if (typeof file.text === "function") {
        return file.text();
      }
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
      });
    }

    function resetUploadInputValue() {
      const input = read("getAdminBackupUploadInput", null);
      if (input && "value" in input) {
        input.value = "";
      }
    }

    function importBackupJsonFile(file) {
      if (!hasAdminPermission("db_backup")) {
        postLocalSystemChat("Permission denied.");
        resetUploadInputValue();
        return;
      }
      if (!file) {
        resetUploadInputValue();
        return;
      }
      if (getBackupLoading()) {
        postLocalSystemChat("Backup operation already in progress.");
        resetUploadInputValue();
        return;
      }
      const maxBytes = 8 * 1024 * 1024;
      if (Number(file.size) > maxBytes) {
        postLocalSystemChat("JSON file too large (max 8MB).");
        resetUploadInputValue();
        return;
      }
      const network = getNetwork();
      const gateway = getGatewayController();
      const backup = getBackupModule();
      const basePath = getBasePath();
      if (!network.db || !gateway || !basePath || typeof backup.importBackupJson !== "function") {
        postLocalSystemChat("Cloudflare backend unavailable.");
        resetUploadInputValue();
        return;
      }
      setBackupLoading(true);
      readFileText(file).then((text) => {
        let payload = null;
        try {
          payload = JSON.parse(String(text || "{}"));
        } catch (error) {
          throw new Error("Invalid JSON file.");
        }
        return backup.importBackupJson({
          db: network.db,
          gateway,
          firebase: getFirebase(),
          basePath,
          createdByAccountId: cleanText(read("getPlayerProfileId", ""), 96),
          createdByUsername: cleanText(read("getPlayerName", ""), 20),
          json: payload
        });
      }).then((result) => {
        const backupId = cleanBackupId(result && result.id);
        const keyCount = Math.max(0, Math.floor(Number(result && result.rootKeyCount) || 0));
        if (backupId) setStoredSelectedBackupId(backupId);
        call("logAdminAudit", "Admin(panel) imported backup JSON as " + (backupId || "(unknown)") + ".");
        call("pushAdminAuditEntry", "db_import_json", "", "backup=" + (backupId || "unknown") + " keys=" + keyCount);
        postLocalSystemChat("Backup JSON imported: " + (backupId || "unknown") + ".");
        return refreshAdminBackups(true);
      }).catch((error) => {
        const message = error && error.message ? error.message : "Failed to import backup JSON.";
        postLocalSystemChat(message);
      }).finally(() => {
        setBackupLoading(false);
        resetUploadInputValue();
      });
    }

    function getAuditActionFilterValue() {
      return cleanText(read("getAdminAuditActionFilter", ""), 48).toLowerCase();
    }

    function getAuditActorFilterValue() {
      return cleanText(read("getAdminAuditActorFilter", ""), 48).toLowerCase();
    }

    function getAuditTargetFilterValue() {
      return cleanText(read("getAdminAuditTargetFilter", ""), 48).toLowerCase();
    }

    function getFilteredAuditEntries() {
      const adminState = getAdminState();
      const entries = Array.isArray(adminState.audit) ? adminState.audit : [];
      const actionFilter = getAuditActionFilterValue();
      const actorFilter = getAuditActorFilterValue();
      const targetFilter = getAuditTargetFilterValue();
      return entries.filter((entryRaw) => {
        const entry = entryRaw && typeof entryRaw === "object" ? entryRaw : {};
        const action = cleanText(entry.action, 64).toLowerCase();
        const actor = cleanText(entry.actor, 64).toLowerCase();
        const target = cleanText(entry.target, 64).toLowerCase();
        if (actionFilter && action !== actionFilter) return false;
        if (actorFilter && !actor.includes(actorFilter)) return false;
        if (targetFilter && !target.includes(targetFilter)) return false;
        return true;
      });
    }

    function refreshAuditActionFilterOptions() {
      const filterEl = read("getAdminAuditActionFilterEl", null);
      if (!(filterEl instanceof HTMLSelectElement)) return;
      const entries = Array.isArray(getAdminState().audit) ? getAdminState().audit : [];
      const actions = new Set();
      for (let i = 0; i < entries.length; i++) {
        const row = entries[i] && typeof entries[i] === "object" ? entries[i] : {};
        const action = cleanText(row.action, 64).toLowerCase();
        if (action) actions.add(action);
      }
      const sorted = Array.from(actions);
      sorted.sort();
      const previous = getAuditActionFilterValue();
      filterEl.innerHTML = "";
      const allOpt = document.createElement("option");
      allOpt.value = "";
      allOpt.textContent = "All actions";
      filterEl.appendChild(allOpt);
      for (let i = 0; i < sorted.length; i++) {
        const opt = document.createElement("option");
        opt.value = sorted[i];
        opt.textContent = sorted[i];
        filterEl.appendChild(opt);
      }
      const next = previous && sorted.includes(previous) ? previous : "";
      filterEl.value = next;
      call("setAdminAuditActionFilter", next);
    }

    function exportAuditTrail() {
      if (!hasAdminPermission("view_audit")) {
        postLocalSystemChat("Permission denied.");
        return;
      }
      const entries = getFilteredAuditEntries();
      if (!entries.length) {
        postLocalSystemChat("No audit rows to export.");
        return;
      }
      const payload = {
        format: "gt-admin-audit-v1",
        exportedAt: nowMs(),
        exportedByAccountId: cleanText(read("getPlayerProfileId", ""), 96),
        exportedByUsername: cleanText(read("getPlayerName", ""), 20),
        filters: {
          action: getAuditActionFilterValue(),
          actor: getAuditActorFilterValue(),
          target: getAuditTargetFilterValue()
        },
        count: entries.length,
        entries: entries.map((entryRaw) => {
          const entry = entryRaw && typeof entryRaw === "object" ? entryRaw : {};
          return {
            id: cleanText(entry.id, 64),
            createdAt: Number(entry.createdAt) || 0,
            time: cleanText(entry.time, 24),
            actor: cleanText(entry.actor, 48),
            action: cleanText(entry.action, 48),
            target: cleanText(entry.target, 64),
            details: cleanText(entry.details, 200)
          };
        })
      };
      const stamp = new Date().toISOString().replace(/[^\d]/g, "").slice(0, 14);
      downloadJsonFile("growtopia-audit-" + stamp + ".json", payload);
      call("logAdminAudit", "Admin(panel) exported audit trail (" + entries.length + " rows).");
      call("pushAdminAuditEntry", "db_export_json", "", "audit_rows=" + entries.length);
      postLocalSystemChat("Audit exported (" + entries.length + " rows).");
    }

    return {
      getAdminBackupOptionsMarkup,
      refreshAdminBackups,
      runDatabaseBackup,
      runDatabaseRestore,
      getSelectedBackupId,
      downloadSelectedBackupJson,
      importBackupJsonFile,
      refreshAuditActionFilterOptions,
      exportAuditTrail
    };
  }

  return {
    createController
  };
})();
