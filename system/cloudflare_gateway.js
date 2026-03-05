window.GTModules = window.GTModules || {};

window.GTModules.cloudflareGateway = (function createCloudflareGatewayModule() {
  const PACKET_ENDPOINT_DEFAULT = "https://growtopia.isxtgg.workers.dev/packet";
  const DEFAULT_TIMEOUT_MS = 9000;

  function getPacketEndpoint(options) {
    const opts = options || {};
    const explicit = String(opts.endpoint || "").trim();
    if (explicit) return explicit;
    const globalEndpoint = String(window.CLOUDFLARE_PACKET_ENDPOINT || "").trim();
    if (globalEndpoint) return globalEndpoint;
    return PACKET_ENDPOINT_DEFAULT;
  }

  async function sendPacket(packet, options) {
    const opts = options || {};
    const endpoint = getPacketEndpoint(opts);
    if (!endpoint) {
      return { ok: false, status: 0, error: "Missing Cloudflare packet endpoint." };
    }
    const timeoutMs = Math.max(1000, Math.floor(Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS));
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let timeoutId = 0;
    if (controller) {
      timeoutId = setTimeout(() => {
        try {
          controller.abort();
        } catch (error) {
          // ignore
        }
      }, timeoutMs);
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(packet || {}),
        signal: controller ? controller.signal : undefined
      });
      const parsed = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = parsed && parsed.error && parsed.error.message
          ? String(parsed.error.message)
          : ("Cloudflare request failed (" + res.status + ").");
        return { ok: false, status: res.status, error: msg, data: parsed };
      }
      if (!parsed || parsed.ok !== true) {
        return {
          ok: false,
          status: res.status,
          error: "Invalid Cloudflare response.",
          data: parsed
        };
      }
      return {
        ok: true,
        status: res.status,
        requestId: String(parsed.requestId || ""),
        result: parsed.result && typeof parsed.result === "object" ? parsed.result : {}
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: String(error && error.message || "Cloudflare request failed.")
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  function normalizePath(basePath, path) {
    const rawPath = String(path || "").trim();
    if (!rawPath) return "";
    if (rawPath.startsWith("/")) return rawPath;
    const base = String(basePath || "").trim().replace(/^\/+|\/+$/g, "");
    if (!base) return "/" + rawPath.replace(/^\/+/, "");
    return "/" + base + "/" + rawPath.replace(/^\/+/, "");
  }

  function createController(options) {
    const opts = options || {};
    const basePath = String(opts.basePath || "").trim().replace(/^\/+|\/+$/g, "");
    const endpoint = getPacketEndpoint(opts);
    const timeoutMs = Math.max(1000, Math.floor(Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS));

    function writePacket(op, path, value, extra) {
      const normalizedPath = normalizePath(basePath, path);
      if (!normalizedPath) {
        return Promise.resolve({ ok: false, status: 0, error: "Missing path." });
      }
      const data = { op, path: normalizedPath };
      if (value !== undefined) data.value = value;
      const extraData = extra && typeof extra === "object" ? extra : {};
      const keys = Object.keys(extraData);
      for (let i = 0; i < keys.length; i++) {
        data[keys[i]] = extraData[keys[i]];
      }
      return sendPacket(
        { type: "DB_WRITE", data },
        { endpoint, timeoutMs }
      );
    }

    return {
      getEndpoint: () => endpoint,
      readGet: (path) => writePacket("get", path),
      writeSet: (path, value) => writePacket("set", path, value),
      writeUpdate: (path, value) => writePacket("update", path, value),
      writeRemove: (path) => writePacket("remove", path),
      writeIncrement: (path, delta, incOptions) => {
        const cfg = incOptions && typeof incOptions === "object" ? incOptions : {};
        return writePacket("increment", path, undefined, {
          delta: Number(delta) || 0,
          min: Number.isFinite(Number(cfg.min)) ? Number(cfg.min) : undefined,
          max: Number.isFinite(Number(cfg.max)) ? Number(cfg.max) : undefined,
          integer: cfg.integer === true
        });
      },
      sendPacket: (packet) => sendPacket(packet, { endpoint, timeoutMs })
    };
  }

  return {
    createController,
    sendPacket
  };
})();
