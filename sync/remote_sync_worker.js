"use strict";

const DEFAULT_INTERPOLATION_DELAY_MS = 90;
const DEFAULT_MAX_EXTRAPOLATION_MS = 0;
const DEFAULT_SNAP_DISTANCE_PX = 140;

const state = {
  players: new Map(),
  interpolationDelayMs: DEFAULT_INTERPOLATION_DELAY_MS,
  maxExtrapolationMs: DEFAULT_MAX_EXTRAPOLATION_MS,
  snapDistancePx: DEFAULT_SNAP_DISTANCE_PX
};

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sanitizeFacing(value) {
  const facing = Number(value);
  return facing < 0 ? -1 : 1;
}

function sanitizePlayerPayload(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const id = String(source.id || "").trim();
  if (!id) return null;
  return {
    id,
    accountId: String(source.accountId || ""),
    x: toNumber(source.x, 0),
    y: toNumber(source.y, 0),
    facing: sanitizeFacing(source.facing),
    name: String(source.name || "Player").slice(0, 16),
    cosmetics: source.cosmetics && typeof source.cosmetics === "object" ? source.cosmetics : {},
    title: source.title && typeof source.title === "object" ? source.title : {},
    danceUntil: Math.max(0, Math.floor(toNumber(source.danceUntil, 0))),
    receivedAtMs: Math.max(0, toNumber(source.receivedAtMs, performance.now()))
  };
}

function samplePlayer(entry, nowMs) {
  const fromTime = Math.max(0, toNumber(entry.fromTimeMs, nowMs));
  const toTime = Math.max(fromTime, toNumber(entry.toTimeMs, fromTime));
  const span = Math.max(1, toTime - fromTime);

  if (nowMs <= toTime) {
    const t = clamp((nowMs - fromTime) / span, 0, 1);
    return {
      x: lerp(entry.fromX, entry.toX, t),
      y: lerp(entry.fromY, entry.toY, t)
    };
  }

  const velocityX = (entry.toX - entry.fromX) / span;
  const extraMs = clamp(nowMs - toTime, 0, state.maxExtrapolationMs);
  return {
    x: entry.toX + velocityX * extraMs,
    // Avoid vertical overshoot into tiles while falling/landing.
    y: entry.toY
  };
}

function upsertPlayer(raw) {
  const input = sanitizePlayerPayload(raw);
  if (!input) return;

  const nowMs = input.receivedAtMs;
  const current = state.players.get(input.id);
  if (!current) {
    state.players.set(input.id, {
      id: input.id,
      accountId: input.accountId,
      facing: input.facing,
      name: input.name,
      cosmetics: input.cosmetics,
      title: input.title,
      danceUntil: input.danceUntil,
      fromX: input.x,
      fromY: input.y,
      toX: input.x,
      toY: input.y,
      fromTimeMs: nowMs,
      toTimeMs: nowMs
    });
    return;
  }

  const sampled = samplePlayer(current, nowMs);
  const deltaX = Math.abs(input.x - sampled.x);
  const deltaY = Math.abs(input.y - sampled.y);
  const dist = Math.hypot(deltaX, deltaY);
  const shouldSnap = dist >= state.snapDistancePx || deltaY >= 42;
  const nextFromX = shouldSnap ? input.x : sampled.x;
  const nextFromY = shouldSnap ? input.y : sampled.y;
  const dynamicDelay = deltaY >= 20
    ? Math.min(state.interpolationDelayMs, 28)
    : state.interpolationDelayMs;
  const nextToTime = shouldSnap ? nowMs : (nowMs + dynamicDelay);

  current.accountId = input.accountId;
  current.facing = input.facing;
  current.name = input.name;
  current.cosmetics = input.cosmetics;
  current.title = input.title;
  current.danceUntil = input.danceUntil;
  current.fromX = nextFromX;
  current.fromY = nextFromY;
  current.toX = input.x;
  current.toY = input.y;
  current.fromTimeMs = nowMs;
  current.toTimeMs = nextToTime;
}

function sampleAll(nowMs) {
  const out = [];
  state.players.forEach((entry) => {
    const sampled = samplePlayer(entry, nowMs);
    out.push({
      id: entry.id,
      accountId: entry.accountId,
      x: sampled.x,
      y: sampled.y,
      facing: entry.facing,
      name: entry.name,
      cosmetics: entry.cosmetics,
      title: entry.title,
      danceUntil: entry.danceUntil
    });
  });
  return out;
}

function applyConfig(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  state.interpolationDelayMs = Math.max(16, Math.floor(toNumber(input.interpolationDelayMs, state.interpolationDelayMs)));
  state.maxExtrapolationMs = Math.max(0, Math.floor(toNumber(input.maxExtrapolationMs, state.maxExtrapolationMs)));
  state.snapDistancePx = Math.max(16, toNumber(input.snapDistancePx, state.snapDistancePx));
}

self.onmessage = function onMessage(event) {
  const msg = event && event.data && typeof event.data === "object" ? event.data : {};
  const type = String(msg.type || "");
  const payload = msg.payload && typeof msg.payload === "object" ? msg.payload : {};

  if (type === "config") {
    applyConfig(payload);
    return;
  }
  if (type === "upsert") {
    upsertPlayer(payload);
    return;
  }
  if (type === "remove") {
    const id = String(payload.id || "").trim();
    if (id) state.players.delete(id);
    return;
  }
  if (type === "clear") {
    state.players.clear();
    return;
  }
  if (type === "sample") {
    const nowMs = Math.max(0, toNumber(payload.nowMs, performance.now()));
    self.postMessage({
      type: "sample",
      payload: {
        players: sampleAll(nowMs)
      }
    });
    return;
  }
  if (type === "dispose") {
    state.players.clear();
    self.close();
  }
};
