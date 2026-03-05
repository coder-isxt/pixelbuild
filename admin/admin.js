window.GTModules = window.GTModules || {};
window.GTModules.admin = {
  resolveRoleConfig(roleConfig) {
    if (roleConfig && typeof roleConfig === "object") return roleConfig;
    const globalCfg = globalThis.adminRoleConfig;
    if (globalCfg && typeof globalCfg === "object") return globalCfg;
    return {};
  },
  createRoleConfig(settings) {
    const base = this.resolveRoleConfig();
    const cfg = settings && typeof settings === "object" ? settings : {};
    return {
      roleRank: cfg.ADMIN_ROLE_RANK && typeof cfg.ADMIN_ROLE_RANK === "object"
        ? cfg.ADMIN_ROLE_RANK
        : (base.roleRank && typeof base.roleRank === "object" ? base.roleRank : {}),
      permissions: cfg.ADMIN_PERMISSIONS && typeof cfg.ADMIN_PERMISSIONS === "object"
        ? cfg.ADMIN_PERMISSIONS
        : (base.permissions && typeof base.permissions === "object" ? base.permissions : {}),
      commandCooldownsMs: cfg.ADMIN_COMMAND_COOLDOWNS_MS && typeof cfg.ADMIN_COMMAND_COOLDOWNS_MS === "object"
        ? cfg.ADMIN_COMMAND_COOLDOWNS_MS
        : (base.commandCooldownsMs && typeof base.commandCooldownsMs === "object" ? base.commandCooldownsMs : {}),
      roleByUsername: cfg.ADMIN_ROLE_BY_USERNAME && typeof cfg.ADMIN_ROLE_BY_USERNAME === "object"
        ? cfg.ADMIN_ROLE_BY_USERNAME
        : (base.roleByUsername && typeof base.roleByUsername === "object" ? base.roleByUsername : {}),
      adminUsernames: Array.isArray(cfg.ADMIN_USERNAMES)
        ? cfg.ADMIN_USERNAMES
        : (Array.isArray(base.adminUsernames) ? base.adminUsernames : [])
    };
  },
  normalizeAdminRole(role, roleConfig) {
    const cfg = this.resolveRoleConfig(roleConfig);
    const roleRank = cfg.roleRank && typeof cfg.roleRank === "object" ? cfg.roleRank : {};
    const value = String(role || "").trim().toLowerCase();
    return roleRank[value] !== undefined ? value : "none";
  },
  getRoleRank(role, roleConfig) {
    const cfg = this.resolveRoleConfig(roleConfig);
    const roleRank = cfg.roleRank && typeof cfg.roleRank === "object" ? cfg.roleRank : {};
    const normalized = this.normalizeAdminRole(role, cfg);
    return Number(roleRank[normalized]) || 0;
  },
  hasAdminPermission(role, permissionKey, roleConfig) {
    const cfg = this.resolveRoleConfig(roleConfig);
    const permissions = cfg.permissions && typeof cfg.permissions === "object" ? cfg.permissions : {};
    const normalized = this.normalizeAdminRole(role, cfg);
    const list = Array.isArray(permissions[normalized]) ? permissions[normalized] : [];
    const key = String(permissionKey || "").trim();
    if (!key) return false;
    if (list.includes(key)) return true;
    const alias = {
      give_block: ["givex"],
      give_item: ["giveitem", "givex"],
      give_title: ["givex"],
      remove_title: ["givex"],
      reach: ["tp"],
      summon: ["bring"],
      announce: ["announce_user"],
      announce_user: ["announcep"]
    };
    const fallback = Array.isArray(alias[key]) ? alias[key] : [];
    return fallback.some((alt) => list.includes(alt));
  },
  getConfiguredRoleForUsername(username, roleConfig) {
    const cfg = this.resolveRoleConfig(roleConfig);
    const normalized = String(username || "").trim().toLowerCase();
    if (!normalized) return "none";
    const roleByUsername = cfg.roleByUsername && typeof cfg.roleByUsername === "object" ? cfg.roleByUsername : {};
    if (roleByUsername[normalized]) {
      return this.normalizeAdminRole(roleByUsername[normalized], cfg);
    }
    const adminUsernames = Array.isArray(cfg.adminUsernames) ? cfg.adminUsernames : [];
    if (adminUsernames.includes(normalized)) return "owner";
    return "none";
  },
  getCommandCooldownMs(role, commandKey, roleConfig) {
    const cfg = this.resolveRoleConfig(roleConfig);
    const map = cfg.commandCooldownsMs && typeof cfg.commandCooldownsMs === "object"
      ? cfg.commandCooldownsMs
      : {};
    const normalized = this.normalizeAdminRole(role, cfg);
    const roleMap = map[normalized] && typeof map[normalized] === "object" ? map[normalized] : {};
    return Number(roleMap[commandKey]) || 0;
  },
  parseDurationToMs(input) {
    const value = String(input || "").trim().toLowerCase();
    const match = value.match(/^(\d+)\s*([smhd])$/);
    if (!match) return 0;
    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const unitMs = unit === "s" ? 1000 : unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000;
    return amount * unitMs;
  },
  formatRemainingMs(ms) {
    const safe = Math.max(0, Math.floor(ms));
    if (safe < 60000) return Math.ceil(safe / 1000) + "s";
    if (safe < 3600000) return Math.ceil(safe / 60000) + "m";
    if (safe < 86400000) return Math.ceil(safe / 3600000) + "h";
    return Math.ceil(safe / 86400000) + "d";
  },
  getAuditLevel(action) {
    const key = String(action || "").toLowerCase();
    if (!key) return "info";
    if (key === "permban" || key === "tempban") return "critical";
    if (key === "kick" || key === "resetinv" || key === "clear_logs" || key === "clearaudit" || key === "freeze") return "warn";
    if (key === "unban") return "success";
    if (key === "setrole" || key === "givex" || key === "giveitem" || key === "spawnd" || key === "givetitle" || key === "removetitle" || key === "tp" || key === "reach" || key === "summon" || key === "bring" || key === "unfreeze" || key === "godmode" || key === "clearworld" || key === "announce_user" || key === "announce" || key === "db_backup" || key === "db_restore" || key === "db_export_json" || key === "db_import_json") return "accent";
    return "info";
  },
  getLogLevel(text) {
    const t = String(text || "").toLowerCase();
    if (!t) return "info";
    if (t.includes("error") || t.includes("failed") || t.includes("denied")) return "critical";
    if (t.includes("banned") || t.includes("kicked") || t.includes("expired")) return "warn";
    if (t.includes("created") || t.includes("joined") || t.includes("logged in") || t.includes("authenticated")) return "success";
    if (t.includes("session") || t.includes("world")) return "accent";
    return "info";
  }
};
