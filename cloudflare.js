// Worker.js — Cloudflare Worker authoritative write gateway for Firebase RTDB
// - Client reads RTDB directly
// - ALL writes go through POST /packet
//
// Required env vars (Worker secrets/vars):
// - GCP_CLIENT_EMAIL  (from service account JSON: client_email)
// - GCP_PRIVATE_KEY   (from service account JSON: private_key)  <-- keep newlines!
// - GCP_PROJECT_ID    (from service account JSON: project_id)    (optional but kept)
// - FIREBASE_DB_URL   (e.g. https://xxxxx-default-rtdb.europe-west1.firebasedatabase.app)
// - ALLOWED_ORIGIN    (single origin or comma-separated)
//
// Optional env vars used by your existing endpoints:
// - MY_API_KEY
// - WEBHOOK
// - ENCRYPTION_KEY
// - DB_ROOT_PATH    (default: "growtopia-test")

// -----------------------------
// Your original helper functions
// -----------------------------
const ALLOWED_ORIGIN_FALLBACK = "https://game.pixelbuild.gamer.gd";

const CORS_HEADERS_BASE = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function text(data, status = 200, extraHeaders = {}) {
  return new Response(data, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function parseAllowedOrigins(env) {
  const raw = String(env.ALLOWED_ORIGIN || "").trim();
  const base = raw || ALLOWED_ORIGIN_FALLBACK;
  return base
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function getCorsHeaders(env, origin) {
  const allowed = parseAllowedOrigins(env);
  if (allowed.includes(origin)) {
    return {
      ...CORS_HEADERS_BASE,
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
    };
  }
  return {};
}

function isAllowedRequest(env, request) {
  const origin = request.headers.get("Origin") || "";
  const referer = request.headers.get("Referer") || "";
  const allowed = parseAllowedOrigins(env);

  // Origin is best signal for fetch(); Referer is a fallback
  return allowed.includes(origin) || allowed.some(o => referer.startsWith(o));
}

// Simple router helper
function route(method, pathname, handler) {
  return { method, pathname, handler };
}

// -----------------------------
// Packet + RTDB authoritative layer
// (kept aligned with your uploaded worker behavior)
// -----------------------------
const OAUTH_SCOPE = "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email";
const OAUTH_AUDIENCE = "https://oauth2.googleapis.com/token";
const TOKEN_REFRESH_SAFETY_MS = 60_000;

let cachedOAuthToken = "";
let cachedOAuthTokenExpMs = 0;

// minimal utils
function nowMs() { return Date.now(); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function asNonEmptyString(v, maxLen = 9999) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.slice(0, maxLen);
}

function normalizeDbRootPath(env) {
  const raw = String((env && env.DB_ROOT_PATH) || "growtopia-test").trim();
  const clean = raw.replace(/^\/+|\/+$/g, "");
  return "/" + clean;
}

function isPathAllowedForWrite(env, path) {
  const root = normalizeDbRootPath(env);
  return path === root || path.startsWith(root + "/");
}

async function readJsonBodyStrict(request) {
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.toLowerCase().includes("application/json")) {
    throw new Error("Content-Type must be application/json");
  }
  const body = await request.json();
  if (!body || typeof body !== "object") throw new Error("JSON body must be an object");
  return body;
}

function errorResponse(requestId, corsHeaders, status, code, message, details) {
  return json(
    {
      ok: false,
      requestId,
      error: {
        code: String(code || "ERROR"),
        message: String(message || "Request failed"),
        details: details === undefined ? undefined : details,
      },
    },
    status,
    corsHeaders
  );
}

function jsonResponse(payload, status, corsHeaders) {
  return json(payload, status, corsHeaders);
}

function base64urlEncodeBytes(bytes) {
  let bin = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlEncodeFromString(str) {
  return base64urlEncodeBytes(new TextEncoder().encode(str));
}

async function signJwtRs256(unsigned, privateKeyPem) {
  // Cloudflare Workers WebCrypto can import PKCS8 PEM
  const pem = String(privateKeyPem || "").trim();
  const pemBody = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const pkcs8 = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  return base64urlEncodeBytes(new Uint8Array(sig));
}

async function getGoogleAccessToken(env) {
  const t = nowMs();
  if (cachedOAuthToken && t < (cachedOAuthTokenExpMs - TOKEN_REFRESH_SAFETY_MS)) {
    return cachedOAuthToken;
  }

  const clientEmail = asNonEmptyString(env.GCP_CLIENT_EMAIL, 200);
  const privateKey = asNonEmptyString(env.GCP_PRIVATE_KEY, 8000).replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Missing service account credentials");

  const iat = Math.floor(t / 1000);
  const exp = iat + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const claim = { iss: clientEmail, scope: OAUTH_SCOPE, aud: OAUTH_AUDIENCE, iat, exp };

  const unsigned =
    base64urlEncodeFromString(JSON.stringify(header)) + "." +
    base64urlEncodeFromString(JSON.stringify(claim));
  const signature = await signJwtRs256(unsigned, privateKey);
  const assertion = unsigned + "." + signature;

  const body = new URLSearchParams();
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.set("assertion", assertion);

  const tokenRes = await fetch(OAUTH_AUDIENCE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) throw new Error("Failed to fetch OAuth token");

  cachedOAuthToken = String(tokenJson.access_token);
  cachedOAuthTokenExpMs = t + clamp(Number(tokenJson.expires_in || 3600), 60, 3600) * 1000;
  return cachedOAuthToken;
}

function buildRtdbUrl(env, path) {
  const base = String(env.FIREBASE_DB_URL || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("Missing FIREBASE_DB_URL");
  return `${base}${path}.json`;
}

async function rtdbRequest(env, accessToken, method, path, body) {
  const res = await fetch(buildRtdbUrl(env, path), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await res.text();
  let parsed = null;
  if (txt) {
    try { parsed = JSON.parse(txt); } catch { parsed = txt; }
  }
  return { ok: res.ok, status: res.status, data: parsed };
}

async function rtdbPatch(env, accessToken, path, obj) {
  const out = await rtdbRequest(env, accessToken, "PATCH", path, obj);
  if (!out.ok) throw new Error(`RTDB PATCH failed ${out.status}`);
  return out.data;
}

async function rtdbGet(env, accessToken, path) {
  const out = await rtdbRequest(env, accessToken, "GET", path, undefined);
  if (!out.ok) throw new Error(`RTDB GET failed ${out.status}`);
  return out.data;
}

async function rtdbPut(env, accessToken, path, obj) {
  const out = await rtdbRequest(env, accessToken, "PUT", path, obj);
  if (!out.ok) throw new Error(`RTDB PUT failed ${out.status}`);
  return out.data;
}

async function rtdbDelete(env, accessToken, path) {
  const out = await rtdbRequest(env, accessToken, "DELETE", path, undefined);
  if (!out.ok) throw new Error(`RTDB DELETE failed ${out.status}`);
  return out.data;
}

// Minimal DB_WRITE validator (you can harden this per-path)
function validateDbWritePacket(packet, env) {
  const data = packet && packet.data;
  const op = String(data && data.op || "").trim();
  const path = String(data && data.path || "").trim();

  if (!op || !path || !path.startsWith("/")) {
    return { ok: false, status: 400, code: "BAD_DB_WRITE", message: "Missing op/path" };
  }
  if (!["get", "set", "update", "remove", "increment", "transaction"].includes(op)) {
    return { ok: false, status: 400, code: "BAD_DB_WRITE", message: "Invalid op" };
  }

  // Basic path safety
  if (path.includes("..") || path.includes("//") || path.length > 512) {
    return { ok: false, status: 400, code: "BAD_DB_WRITE", message: "Invalid path" };
  }

  if (!isPathAllowedForWrite(env, path)) {
    return { ok: false, status: 403, code: "BAD_DB_WRITE", message: "Path not allowed" };
  }

  return { ok: true, op, path };
}

async function handleDbWritePacket(env, accessToken, packet) {
  const v = validateDbWritePacket(packet, env);
  if (!v.ok) return v;

  const { op, path } = v;
  const value = packet.data && Object.prototype.hasOwnProperty.call(packet.data, "value")
    ? packet.data.value
    : undefined;

  // IMPORTANT:
  // In RTDB REST API:
  // - PUT replaces
  // - PATCH merges
  // - DELETE removes
  if (op === "get") {
    const current = await rtdbGet(env, accessToken, path);
    return { ok: true, status: 200, result: { op, path, value: current } };
  }
  if (op === "set") {
    await rtdbPut(env, accessToken, path, value);
    return { ok: true, status: 200, result: { op, path } };
  }
  if (op === "update") {
    if (!value || typeof value !== "object") {
      return { ok: false, status: 400, code: "BAD_DB_WRITE", message: "update requires object value" };
    }
    await rtdbPatch(env, accessToken, path, value);
    return { ok: true, status: 200, result: { op, path } };
  }
  if (op === "remove") {
    await rtdbDelete(env, accessToken, path);
    return { ok: true, status: 200, result: { op, path } };
  }
  if (op === "increment") {
    const delta = Number(packet && packet.data && packet.data.delta);
    if (!Number.isFinite(delta)) {
      return { ok: false, status: 400, code: "BAD_DB_WRITE", message: "increment requires numeric delta" };
    }
    const rawCurrent = await rtdbGet(env, accessToken, path);
    const current = Number.isFinite(Number(rawCurrent)) ? Number(rawCurrent) : 0;
    let next = current + delta;
    const minRaw = Number(packet && packet.data && packet.data.min);
    const maxRaw = Number(packet && packet.data && packet.data.max);
    if (Number.isFinite(minRaw)) next = Math.max(minRaw, next);
    if (Number.isFinite(maxRaw)) next = Math.min(maxRaw, next);
    if (packet && packet.data && packet.data.integer === true) next = Math.floor(next);
    if (!Number.isFinite(next)) next = 0;
    await rtdbPut(env, accessToken, path, next);
    return { ok: true, status: 200, result: { op, path, previous: current, next } };
  }

  // If you need transaction semantics, implement a read-modify-write with conflict checks.
  return { ok: false, status: 501, code: "TX_UNSUPPORTED", message: "transaction not supported in worker example" };
}

// Packet dispatcher (MOVE / PLACE_BLOCK etc can be added later; DB_WRITE is enough for your proxy)
async function processPacketRequest(env, request, requestId, corsHeaders) {
  let packet;
  try {
    packet = await readJsonBodyStrict(request);
  } catch (err) {
    return errorResponse(requestId, corsHeaders, 400, "BAD_JSON", String(err?.message || "Invalid JSON"));
  }

  const type = asNonEmptyString(packet.type, 64);
  if (!type) return errorResponse(requestId, corsHeaders, 400, "BAD_PACKET", "Missing type");

  let accessToken = "";
  try {
    accessToken = await getGoogleAccessToken(env);
  } catch (err) {
    return errorResponse(requestId, corsHeaders, 500, "OAUTH_FAILED", "Failed to acquire Firebase write token", { reason: String(err?.message || err) });
  }

  // Default to DB_WRITE for your proxy
  let handlerOut;
  try {
    if (type === "DB_WRITE" || (packet?.data?.op && packet?.data?.path)) {
      handlerOut = await handleDbWritePacket(env, accessToken, packet);
    } else {
      handlerOut = { ok: true, status: 200, result: { type, accepted: true, noop: true } };
    }
  } catch (err) {
    return errorResponse(requestId, corsHeaders, 500, "HANDLER_EXCEPTION", "Authoritative handler failed", { reason: String(err?.message || err) });
  }

  if (!handlerOut?.ok) {
    const rejectionCode =
      handlerOut && typeof handlerOut === "object" && "code" in handlerOut
        ? String(handlerOut.code || "PACKET_REJECTED")
        : "PACKET_REJECTED";
    const rejectionMessage =
      handlerOut && typeof handlerOut === "object" && "message" in handlerOut
        ? String(handlerOut.message || "Packet rejected")
        : "Packet rejected";
    const rejectionDetails =
      handlerOut && typeof handlerOut === "object" && "details" in handlerOut
        ? handlerOut.details
        : undefined;
    return errorResponse(
      requestId,
      corsHeaders,
      Number(handlerOut.status) || 400,
      rejectionCode,
      rejectionMessage,
      rejectionDetails
    );
  }

  const safeResult =
    handlerOut && typeof handlerOut === "object" && "result" in handlerOut && handlerOut.result && typeof handlerOut.result === "object"
      ? handlerOut.result
      : {};

  return jsonResponse(
    {
      ok: true,
      requestId,
      acceptedType: type,
      result: safeResult,
      serverTimeMs: nowMs(),
    },
    200,
    corsHeaders
  );
}

// Optional session API (claim/release). You can expand it later.
// For now it just acknowledges to match client expectations.
async function processSessionRequest(env, request, requestId, corsHeaders) {
  let body;
  try {
    body = await readJsonBodyStrict(request);
  } catch (err) {
    return errorResponse(requestId, corsHeaders, 400, "BAD_JSON", String(err?.message || "Invalid JSON"));
  }
  const action = String(body.action || "").trim().toLowerCase();
  const accountId = asNonEmptyString(body.accountId, 64);
  const username = asNonEmptyString(body.username, 24) || "";
  const sessionId = asNonEmptyString(body.sessionId, 128) || "";

  if (!accountId) return errorResponse(requestId, corsHeaders, 400, "BAD_SESSION_REQUEST", "Missing accountId");
  if (action !== "claim" && action !== "release") {
    return errorResponse(requestId, corsHeaders, 400, "BAD_SESSION_REQUEST", "action must be claim|release");
  }

  // If you want strict “one session at a time”, store in RTDB under /growtopia-test/account-sessions/{accountId}
  // (Your project already has similar logic client-side; move it here when you’re ready.)

  return jsonResponse(
    { ok: true, requestId, action, accountId, username, sessionId: sessionId || ("s_" + Math.random().toString(36).slice(2, 12)) },
    200,
    corsHeaders
  );
}

// -----------------------------
// Router
// -----------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = getCorsHeaders(env, origin);
    const requestId = crypto.randomUUID();

    // Preflight
    if (request.method === "OPTIONS") {
      // Only succeed for allowed origins
      if (!parseAllowedOrigins(env).includes(origin)) return text("Forbidden", 403);
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Basic security gate (site-only)
    if (!isAllowedRequest(env, request)) {
      return text("Forbidden", 403, corsHeaders);
    }

    const routes = [
      route("POST", "/packet", () => processPacketRequest(env, request, requestId, corsHeaders)),
      route("POST", "/session", () => processSessionRequest(env, request, requestId, corsHeaders)),

      route("GET", "/apikey", () => {
        const key = env.MY_API_KEY;
        if (!key) return json({ ok: false, error: "Missing MY_API_KEY env var" }, 500, corsHeaders);
        return json({ ok: true, key }, 200, corsHeaders);
      }),

      route("GET", "/webhook", () => {
        const key = env.WEBHOOK;
        if (!key) return json({ ok: false, error: "Missing WEBHOOK env var" }, 500, corsHeaders);
        return json({ ok: true, key }, 200, corsHeaders);
      }),

      route("GET", "/encryptionkey", () => {
        const key = env.ENCRYPTION_KEY;
        if (!key) return json({ ok: false, error: "Missing ENCRYPTION_KEY env var" }, 500, corsHeaders);
        return json({ ok: true, key }, 200, corsHeaders);
      }),
    ];

    const match = routes.find(r => r.method === request.method && r.pathname === url.pathname);
    if (!match) return json({ ok: false, error: "Not found" }, 404, corsHeaders);

    try {
      return await match.handler();
    } catch (e) {
      return json(
        { ok: false, error: "Internal error", message: String(e?.message || e) },
        500,
        corsHeaders
      );
    }
  },
};
