"use strict";

function cleanObject(value) {
  return value && typeof value === "object" ? value : {};
}

function cleanString(value, maxLen) {
  return String(value || "").slice(0, maxLen || 1024);
}

function normalizeWorldId(value) {
  return cleanString(value, 24).trim().toUpperCase();
}

function normalizeAdminRole(value) {
  const role = cleanString(value, 24).trim().toLowerCase();
  if (role === "moderator" || role === "admin" || role === "manager" || role === "owner") return role;
  return "none";
}

function readAdminRoleValue(rawRole) {
  if (rawRole === undefined || rawRole === null) return "none";
  if (typeof rawRole === "string") return normalizeAdminRole(rawRole);
  if (typeof rawRole === "object") {
    const row = cleanObject(rawRole);
    const candidate = row.role !== undefined
      ? row.role
      : (row.value !== undefined
        ? row.value
        : (row.name !== undefined ? row.name : ""));
    return normalizeAdminRole(candidate);
  }
  return normalizeAdminRole(rawRole);
}

function processSnapshotValue(payload) {
  const row = cleanObject(payload);
  return {
    exists: row.exists === true,
    value: cleanObject(row.value)
  };
}

function processWorldsIndex(payload) {
  const row = cleanObject(payload);
  const data = cleanObject(row.value);
  const worldIds = Object.keys(data).sort((a, b) => {
    const av = data[a] && typeof data[a] === "object" && Number.isFinite(Number(data[a].updatedAt))
      ? Number(data[a].updatedAt)
      : 0;
    const bv = data[b] && typeof data[b] === "object" && Number.isFinite(Number(data[b].updatedAt))
      ? Number(data[b].updatedAt)
      : 0;
    return bv - av;
  });
  return {
    value: data,
    worldIds
  };
}

function processGlobalPlayers(payload) {
  const row = cleanObject(payload);
  const data = cleanObject(row.value);
  const occupancy = {};
  Object.keys(data).forEach((id) => {
    const player = cleanObject(data[id]);
    const wid = normalizeWorldId(player.world);
    if (!wid) return;
    occupancy[wid] = (occupancy[wid] || 0) + 1;
  });
  const occupancyList = Object.keys(occupancy).map((worldId) => ({
    worldId,
    count: Math.max(0, Math.floor(Number(occupancy[worldId]) || 0))
  }));
  return {
    value: data,
    totalOnline: Object.keys(data).length,
    occupancy: occupancyList
  };
}

function processAdminRoles(payload) {
  const row = cleanObject(payload);
  const raw = cleanObject(row.value);
  const playerProfileId = cleanString(row.playerProfileId, 64).trim();
  const directAdminRole = normalizeAdminRole(row.directAdminRole);
  const nextRoles = {};
  Object.keys(raw).forEach((accountId) => {
    const safeAccountId = cleanString(accountId, 64).trim();
    if (!safeAccountId) return;
    const role = readAdminRoleValue(raw[accountId]);
    if (role === "none") return;
    nextRoles[safeAccountId] = role;
  });
  if (playerProfileId && directAdminRole !== "none") {
    nextRoles[playerProfileId] = directAdminRole;
  }
  return { roles: nextRoles };
}

function processAdminAudit(payload) {
  const row = cleanObject(payload);
  const data = cleanObject(row.value);
  const entries = Object.keys(data).map((id) => {
    const value = cleanObject(data[id]);
    const ts = Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : 0;
    const actor = cleanString(value.actorUsername || value.actorAccountId || "system", 24);
    const action = cleanString(value.action || "", 24);
    const targetRaw = cleanString(value.targetUsername || value.targetAccountId || "", 64);
    return {
      id: cleanString(id, 64),
      createdAt: ts,
      actor: actor ? ("@" + actor) : "system",
      action,
      target: targetRaw ? ("@" + targetRaw) : "",
      details: cleanString(value.details || "", 120)
    };
  }).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return { entries };
}

function processAccountLogs(payload) {
  const row = cleanObject(payload);
  const byAccount = cleanObject(row.value);
  const context = cleanObject(row.context);
  const playerProfileId = cleanString(context.playerProfileId, 64).trim();
  const playerSessionId = cleanString(context.playerSessionId, 128).trim();
  const playerId = cleanString(context.playerId, 64).trim();
  const flattened = [];

  Object.keys(byAccount).forEach((accountId) => {
    if (playerProfileId && accountId === playerProfileId) return;
    const accountLogs = cleanObject(byAccount[accountId]);
    Object.keys(accountLogs).forEach((logId) => {
      const value = cleanObject(accountLogs[logId]);
      const sourceSessionId = cleanString(value.sessionId, 128);
      const sourcePlayerId = cleanString(value.sourcePlayerId, 64);
      const sourceAccountId = cleanString(value.accountId, 64);
      if (sourceSessionId && playerSessionId && sourceSessionId === playerSessionId) return;
      if (sourcePlayerId && playerId && sourcePlayerId === playerId) return;
      if (sourceAccountId && playerProfileId && sourceAccountId === playerProfileId) return;
      const uname = cleanString(value.username || accountId, 24);
      flattened.push({
        text: "@" + uname + ": " + cleanString(value.text || "", 180),
        createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : 0
      });
    });
  });

  flattened.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return { items: flattened.slice(-200) };
}

function processAntiCheatLogs(payload) {
  const row = cleanObject(payload);
  const data = cleanObject(row.value);
  const flattened = [];
  Object.keys(data).forEach((id) => {
    const value = cleanObject(data[id]);
    const rule = cleanString(value.rule || "unknown", 48);
    const sev = cleanString(value.severity || "warn", 16).toLowerCase();
    const uname = cleanString(value.username || value.accountId || "unknown", 24);
    const worldId = cleanString(value.world || "", 24);
    let detailRaw = value.details;
    if (detailRaw && typeof detailRaw === "object") {
      try {
        detailRaw = JSON.stringify(detailRaw);
      } catch (error) {
        detailRaw = String(detailRaw);
      }
    }
    const detail = cleanString(detailRaw == null ? "" : detailRaw, 220);
    const text = "@" + uname + " | " + rule + (worldId ? (" | " + worldId) : "") + (detail ? (" | " + detail) : "");
    flattened.push({
      text,
      severity: sev || "warn",
      createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : 0
    });
  });
  flattened.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return { items: flattened.slice(-220) };
}

function runTask(task, payload) {
  if (task === "inventory") return processSnapshotValue(payload);
  if (task === "progression") return processSnapshotValue(payload);
  if (task === "achievements") return processSnapshotValue(payload);
  if (task === "quests") return processSnapshotValue(payload);
  if (task === "admin_accounts") return processSnapshotValue(payload);
  if (task === "admin_usernames") return processSnapshotValue(payload);
  if (task === "admin_bans") return processSnapshotValue(payload);
  if (task === "admin_sessions") return processSnapshotValue(payload);
  if (task === "admin_inventories") return processSnapshotValue(payload);
  if (task === "worlds_index") return processWorldsIndex(payload);
  if (task === "global_players") return processGlobalPlayers(payload);
  if (task === "admin_roles") return processAdminRoles(payload);
  if (task === "admin_audit") return processAdminAudit(payload);
  if (task === "account_logs") return processAccountLogs(payload);
  if (task === "anti_cheat_logs") return processAntiCheatLogs(payload);
  return cleanObject(payload);
}

self.onmessage = function onMessage(event) {
  const msg = event && event.data && typeof event.data === "object" ? event.data : {};
  const type = cleanString(msg.type, 32);
  if (type === "dispose") {
    self.close();
    return;
  }
  if (type !== "process") return;
  const id = Math.floor(Number(msg.id) || 0);
  const task = cleanString(msg.task, 64);
  const payload = cleanObject(msg.payload);
  if (!id || !task) return;
  try {
    const result = runTask(task, payload);
    self.postMessage({
      id,
      ok: true,
      result: cleanObject(result)
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: cleanString(error && error.message || "Read worker task failed.", 220)
    });
  }
};
