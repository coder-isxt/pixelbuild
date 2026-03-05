window.GTModules = window.GTModules || {};

window.ANTICHEAT_WEBHOOK_ENDPOINT = window.ANTICHEAT_WEBHOOK_ENDPOINT || "https://growtopia.isxtgg.workers.dev/webhook";
window.ANTICHEAT_LOCAL_WEBHOOK_STORAGE = window.ANTICHEAT_LOCAL_WEBHOOK_STORAGE || "growtopia_local_ac_webhook_v1";

window.GTModules.anticheat = (function createAntiCheatModule() {
  const modules = window.GTModules || {};
  const discordModule = modules.discord || {};
  const RULE_INFO = {
    non_finite_state: {
      title: "Invalid Physics State",
      reason: "Player state contains NaN/Infinity values."
    },
    teleport_like_move: {
      title: "Teleport-like Movement",
      reason: "Position changed too far in a single frame."
    },
    speed_anomaly: {
      title: "Speed Anomaly",
      reason: "Movement speed exceeded configured limit."
    },
    action_rate: {
      title: "Action Spam",
      reason: "Too many action attempts in a short window."
    },
    reach_anomaly: {
      title: "Reach Anomaly",
      reason: "Action target was farther than allowed reach."
    },
    chat_rate: {
      title: "Chat Spam",
      reason: "Too many chat messages in a short window."
    },
    storage_plaintext: {
      title: "Storage Tamper (Plaintext)",
      reason: "Protected local data appears as plaintext."
    },
    storage_corrupt: {
      title: "Storage Tamper (Corrupt)",
      reason: "Protected local data cannot be decrypted/parsed."
    }
  };

  function createController(options) {
    const opts = options || {};
    const lastRuleAt = new Map();
    const actionTimes = [];
    const chatTimes = [];
    let lastPos = null;
    let worldIdAtLastPos = "";
    let movementGraceUntilMs = 0;
    let lastCountedActionAtMs = 0;
    let lastStorageCheckAtMs = 0;

    const SETTINGS = window.GT_SETTINGS || {};
    const MAX_SPEED_PX_S = Math.max(160, Number(SETTINGS.AC_MAX_SPEED_PX_S) || 4600);
    const TELEPORT_PX = Math.max(120, Number(SETTINGS.AC_TELEPORT_PX) || 420);
    const MAX_ACTIONS_PER_2S = Math.max(8, Number(SETTINGS.AC_MAX_ACTIONS_PER_2S) || 30);
    const MAX_CHAT_PER_10S = Math.max(4, Number(SETTINGS.AC_MAX_CHAT_PER_10S) || 10);
    const ALERT_COOLDOWN_MS = Math.max(3000, Number(SETTINGS.AC_ALERT_COOLDOWN_MS) || 15000);
    const ACTION_RATE_DEBOUNCE_MS = Math.max(20, Number(SETTINGS.AC_ACTION_DEBOUNCE_MS) || 60);
    const MOVEMENT_GRACE_MS = Math.max(1200, Number(SETTINGS.AC_MOVEMENT_GRACE_MS) || 2600);
    const STORAGE_CHECK_EVERY_MS = Math.max(1000, Number(SETTINGS.AC_STORAGE_CHECK_EVERY_MS) || 2500);
    let lastWebhookFailNoticeAt = 0;

    function get(k, fallback) {
      const fn = opts[k];
      if (typeof fn === "function") {
        try {
          const value = fn();
          return value === undefined ? fallback : value;
        } catch (error) {
          return fallback;
        }
      }
      return fn === undefined ? fallback : fn;
    }

    function postLocal(text) {
      const fn = opts.postLocalSystemChat;
      if (typeof fn === "function") fn(String(text || "").slice(0, 160));
    }

    function formatNum(value, digits) {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      const d = Number.isFinite(Number(digits)) ? Math.max(0, Math.min(4, Number(digits))) : 0;
      return n.toFixed(d).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    }

    function getRuleInfo(rule) {
      return RULE_INFO[String(rule || "").trim()] || { title: String(rule || "Unknown Rule"), reason: "Rule triggered." };
    }

    function buildReadableDetail(rule, details) {
      const data = details && typeof details === "object" ? details : {};
      if (rule === "non_finite_state") {
        return "Invalid values in physics state (x/y/vx/vy).";
      }
      if (rule === "teleport_like_move") {
        return "Moved " + formatNum(data.dist) + "px in " + formatNum(data.dtMs) + "ms (teleport threshold exceeded).";
      }
      if (rule === "speed_anomaly") {
        return "Speed " + formatNum(data.speed) + "px/s for " + formatNum(data.dist) + "px in " + formatNum(data.dtMs) + "ms (too fast).";
      }
      if (rule === "action_rate") {
        return "Action rate " + formatNum(data.actionsIn2s) + " in 2s (spam threshold exceeded).";
      }
      if (rule === "reach_anomaly") {
        return "Action at " + formatNum(data.distTiles, 2) + " tiles while allowed reach is " + formatNum(data.reachTiles, 2) + ".";
      }
      if (rule === "chat_rate") {
        return "Chat rate " + formatNum(data.messagesIn10s) + " in 10s (spam threshold exceeded).";
      }
      const raw = typeof details === "string" ? details : JSON.stringify(details || {});
      return raw.slice(0, 180);
    }

    function buildRawDataShort(details) {
      if (!details || typeof details !== "object") return "";
      const parts = [];
      const keys = Object.keys(details).slice(0, 7);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        let v = details[k];
        if (typeof v === "number") v = formatNum(v, Math.abs(v) < 10 ? 2 : 0);
        parts.push(k + "=" + String(v));
      }
      return parts.join(" | ").slice(0, 260);
    }

    function getDynamicMotionCaps() {
      const tileSize = Math.max(1, Number(get("getTileSize", 32)) || 32);
      const tickRate = Math.max(20, Number(get("getTickRate", 60)) || 60);
      const fallbackMovePerTick = Math.max(0.01, Number(SETTINGS.MAX_MOVE_SPEED) || 3.7);
      const fallbackFallPerTick = Math.max(0.01, Number(SETTINGS.MAX_FALL_SPEED) || 10);
      const fallbackJumpPerTick = Math.max(0.01, Math.abs(Number(SETTINGS.JUMP_VELOCITY) || 5));
      const fallbackGravityPerTick = Math.max(0.001, Number(SETTINGS.GRAVITY) || 0.32);
      const limits = get("getPhysicsLimits", null) || {};
      const movePerTick = Math.max(0.01, Number(limits.maxMoveSpeedPerTick) || fallbackMovePerTick);
      const fallPerTick = Math.max(0.01, Number(limits.maxFallSpeedPerTick) || fallbackFallPerTick);
      const jumpPerTick = Math.max(0.01, Math.abs(Number(limits.jumpVelocityPerTick) || fallbackJumpPerTick));
      const gravityPerTick = Math.max(0.001, Number(limits.gravityPerTick) || fallbackGravityPerTick);
      const maxVerticalPerTick = Math.max(fallPerTick, jumpPerTick);
      const maxVectorPerTick = Math.hypot(movePerTick, maxVerticalPerTick);
      const maxVectorPxS = maxVectorPerTick * tickRate;
      const maxHorizontalPxS = movePerTick * tickRate;
      return {
        tileSize,
        tickRate,
        gravityPerTick,
        maxHorizontalPxS,
        maxVectorPxS,
        dynamicTeleportPxBase: Math.max(
          TELEPORT_PX,
          tileSize * 4,
          maxVectorPxS * 0.20 // about 200ms worth of max movement
        )
      };
    }

    function shouldReport(ruleKey) {
      const now = Date.now();
      const last = Number(lastRuleAt.get(ruleKey) || 0);
      if ((now - last) < ALERT_COOLDOWN_MS) return false;
      lastRuleAt.set(ruleKey, now);
      return true;
    }

    async function sendWebhook(rule, severity, details) {
      const username = String(get("getPlayerName", "unknown") || "unknown");
      const accountId = String(get("getPlayerProfileId", "") || "");
      const sessionId = String(get("getPlayerSessionId", "") || "");
      const worldId = String(get("getCurrentWorldId", "") || "");
      const timestamp = new Date().toISOString();
      const info = getRuleInfo(rule);
      const detailText = buildReadableDetail(rule, details);
      const rawData = buildRawDataShort(details);
      const safeSeverity = String(severity || "warn").toLowerCase();
      const severityLabel = safeSeverity === "critical" ? "CRITICAL" : (safeSeverity === "warn" ? "WARN" : safeSeverity.toUpperCase());
      const color = safeSeverity === "critical" ? 0xe74c3c : (safeSeverity === "warn" ? 0xf39c12 : 0x3498db);
      let content = [
        "**Anti-Cheat Alert**",
        "Type: `" + info.title + "`",
        "Rule: `" + rule + "`",
        "Severity: `" + severityLabel + "`",
        "User: @" + username,
        accountId ? ("Account: `" + accountId + "`") : "",
        sessionId ? ("Session: `" + sessionId + "`") : "",
        worldId ? ("World: `" + worldId + "`") : "",
        "Time: `" + timestamp + "`",
        "Reason: " + info.reason,
        "Detected: " + detailText,
        rawData ? ("Raw: " + rawData) : ""
      ].filter(Boolean).join("\n");
      if (content.length > 1900) {
        content = content.slice(0, 1897) + "...";
      }
      const embed = {
        title: "Anti-Cheat: " + info.title,
        color,
        description: [
          "**Rule**: `" + rule + "`",
          "**Severity**: `" + severityLabel + "`",
          "**Reason**: " + info.reason,
          "**Detected**: " + detailText
        ].join("\n"),
        fields: [
          { name: "User", value: "@" + username, inline: true },
          { name: "World", value: worldId || "menu", inline: true },
          { name: "Session", value: sessionId || "-", inline: false }
        ],
        timestamp
      };
      if (accountId) {
        embed.fields.push({ name: "Account", value: "`" + accountId + "`", inline: false });
      }
      if (rawData) {
        embed.fields.push({ name: "Raw Data", value: rawData.slice(0, 1024), inline: false });
      }
      if (embed.fields.length > 25) {
        embed.fields.length = 25;
      }
      if (discordModule && typeof discordModule.send === "function") {
        if (typeof discordModule.sendEmbed === "function") {
          const okEmbed = await discordModule.sendEmbed(embed, { username: "PixelBuild AC" });
          if (okEmbed) return true;
        }
        return discordModule.send({ content, embeds: [embed] }, { username: "PixelBuild AC" });
      }
      return false;
    }

    function report(rule, severity, details) {
      if (!shouldReport(rule)) return;
      const info = getRuleInfo(rule);
      const detailText = buildReadableDetail(rule, details);
      const rawShort = buildRawDataShort(details);
      const detailsForLog = (info.title + ": " + detailText + (rawShort ? (" | " + rawShort) : "")).slice(0, 760);
      const appendLogEntry = opts.appendLogEntry;
      if (typeof appendLogEntry === "function") {
        appendLogEntry({
          rule: String(rule || "unknown").slice(0, 48),
          severity: String(severity || "warn").toLowerCase().slice(0, 16),
          details: detailsForLog
        });
      }
      sendWebhook(rule, severity || "warn", details || {}).then((ok) => {
        if (ok) return;
        const now = Date.now();
        if ((now - lastWebhookFailNoticeAt) > 60000) {
          lastWebhookFailNoticeAt = now;
          postLocal("Anti-cheat webhook send failed.");
        }
      }).catch(() => {});
    }

    function getStorageKeys() {
      const fn = opts.getWatchedStorageKeys;
      if (typeof fn !== "function") return [];
      const keys = fn();
      if (!Array.isArray(keys)) return [];
      return keys.map((k) => String(k || "").trim()).filter(Boolean);
    }

    function checkLocalStorageIntegrity(nowMs) {
      if ((nowMs - lastStorageCheckAtMs) < STORAGE_CHECK_EVERY_MS) return;
      lastStorageCheckAtMs = nowMs;
      const secure = window.GTModules && window.GTModules.secureStorage;
      if (!secure) return;
      const canRead = typeof secure.loadJson === "function";
      if (!canRead) return;
      const keys = getStorageKeys();
      if (!keys.length) return;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        let raw = "";
        try {
          raw = localStorage.getItem(key) || "";
        } catch (error) {
          continue;
        }
        if (!raw) continue;
        const looksEncrypted = raw.startsWith("enc1:");
        if (!looksEncrypted) {
          report("storage_plaintext", "warn", { key, hint: "value is not encrypted" });
          continue;
        }
        if (typeof secure.isReady === "function" && !secure.isReady()) {
          continue;
        }
        let parsed = null;
        try {
          parsed = secure.loadJson(key);
        } catch (error) {
          parsed = null;
        }
        if (!parsed || typeof parsed !== "object") {
          report("storage_corrupt", "critical", { key, hint: "encrypted payload cannot be read" });
        }
      }
    }

    function onSessionStart() {
      actionTimes.length = 0;
      chatTimes.length = 0;
      lastPos = null;
      worldIdAtLastPos = "";
      movementGraceUntilMs = performance.now() + MOVEMENT_GRACE_MS;
      lastCountedActionAtMs = 0;
      lastStorageCheckAtMs = 0;
    }

    function onWorldSwitch(nextWorldId) {
      actionTimes.length = 0;
      lastPos = null;
      worldIdAtLastPos = String(nextWorldId || "");
      movementGraceUntilMs = performance.now() + MOVEMENT_GRACE_MS;
    }

    function onFrame() {
      const inWorld = Boolean(get("getInWorld", false));
      const player = get("getPlayer", null);
      if (!inWorld || !player) {
        lastPos = null;
        return;
      }
      const x = Number(player.x);
      const y = Number(player.y);
      const vx = Number(player.vx);
      const vy = Number(player.vy);
      const now = performance.now();
      const worldId = String(get("getCurrentWorldId", "") || "");
      checkLocalStorageIntegrity(now);

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(vx) || !Number.isFinite(vy)) {
        report("non_finite_state", "critical", { x, y, vx, vy });
        return;
      }

      if (!lastPos || worldIdAtLastPos !== worldId) {
        lastPos = { x, y, t: now };
        worldIdAtLastPos = worldId;
        return;
      }

      if (now < movementGraceUntilMs) {
        lastPos = { x, y, t: now };
        return;
      }

      // Clamp dt to avoid false flags when onFrame is called multiple times in quick succession
      // (e.g. fixed-tick catchup loops) or when the timer resolution is very fine.
      const dtMs = Math.max(16, now - lastPos.t);
      const dx = x - lastPos.x;
      const dy = y - lastPos.y;
      const dist = Math.hypot(dx, dy);
      const speed = dist / (dtMs / 1000);

      const caps = getDynamicMotionCaps();
      const speedCapPxS = Math.max(120, Math.min(MAX_SPEED_PX_S, caps.maxVectorPxS * 1.45));
      const horizontalSpeedCapPxS = Math.max(120, caps.maxHorizontalPxS * 1.45);
      const dynamicTeleportPx = Math.max(caps.dynamicTeleportPxBase, speedCapPxS * (dtMs / 1000) * 2.8);
      const horizontalSpeed = Math.abs(dx) / (dtMs / 1000);

      if (dist > dynamicTeleportPx) {
        report("teleport_like_move", "warn", {
          dist: Math.round(dist),
          dtMs: Math.round(dtMs),
          x: Math.round(x),
          y: Math.round(y),
          capPx: Math.round(dynamicTeleportPx),
          speedCapPxS: Math.round(speedCapPxS)
        });
      } else if (speed > speedCapPxS || horizontalSpeed > horizontalSpeedCapPxS) {
        report("speed_anomaly", "warn", {
          speed: Math.round(speed),
          horizontalSpeed: Math.round(horizontalSpeed),
          dist: Math.round(dist),
          dtMs: Math.round(dtMs),
          speedCapPxS: Math.round(speedCapPxS),
          horizontalCapPxS: Math.round(horizontalSpeedCapPxS),
          gravityPerTick: Number(caps.gravityPerTick.toFixed(4)),
          vx,
          vy
        });
      }

      lastPos = { x, y, t: now };
    }

    function onActionAttempt(payload) {
      const now = performance.now();
      if ((now - lastCountedActionAtMs) >= ACTION_RATE_DEBOUNCE_MS) {
        lastCountedActionAtMs = now;
        actionTimes.push(now);
        while (actionTimes.length && (now - actionTimes[0]) > 2000) actionTimes.shift();
        if (actionTimes.length > MAX_ACTIONS_PER_2S) {
          report("action_rate", "warn", { actionsIn2s: actionTimes.length });
        }
      }

      const data = payload || {};
      const tx = Number(data.tx);
      const ty = Number(data.ty);
      if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;
      const tileSize = Math.max(1, Number(get("getTileSize", 32)) || 32);
      const reachTiles = Math.max(1, Number(get("getEditReachTiles", 5)) || 5);
      const player = get("getPlayer", null);
      const playerRect = get("getPlayerRect", { w: 20, h: 28 }) || { w: 20, h: 28 };
      if (!player) return;
      const centerX = Number(player.x || 0) + (Number(playerRect.w) || 20) * 0.5;
      const centerY = Number(player.y || 0) + (Number(playerRect.h) || 28) * 0.5;
      const targetX = tx * tileSize + tileSize * 0.5;
      const targetY = ty * tileSize + tileSize * 0.5;
      const distTiles = Math.hypot(targetX - centerX, targetY - centerY) / tileSize;
      if (distTiles > (reachTiles + 3.5)) {
        report("reach_anomaly", "warn", {
          distTiles: Number(distTiles.toFixed(2)),
          reachTiles: Number(reachTiles.toFixed(2)),
          tx,
          ty,
          action: String(data.action || "use")
        });
      }
    }

    function onChatSend(text) {
      const now = performance.now();
      chatTimes.push(now);
      while (chatTimes.length && (now - chatTimes[0]) > 10000) chatTimes.shift();
      if (chatTimes.length > MAX_CHAT_PER_10S) {
        report("chat_rate", "warn", { messagesIn10s: chatTimes.length, preview: String(text || "").slice(0, 80) });
      }
    }

    return {
      onSessionStart,
      onWorldSwitch,
      onFrame,
      onActionAttempt,
      onChatSend,
      report,
      postLocal
    };
  }

  return {
    createController
  };
})();
