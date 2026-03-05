window.GTModules = window.GTModules || {};

window.DISCORD_WEBHOOK_ENDPOINT = window.DISCORD_WEBHOOK_ENDPOINT || "https://growtopia.isxtgg.workers.dev/webhook";
window.DISCORD_LOCAL_WEBHOOK_STORAGE = window.DISCORD_LOCAL_WEBHOOK_STORAGE || "growtopia_local_discord_webhook_v1";

window.GTModules.discord = (function createDiscordModule() {
  let webhookUrlPromise = null;
  const DISCORD_WEBHOOK_RE = /^https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+/i;

  function isLocalRuntime() {
    const host = (window.location && window.location.hostname || "").toLowerCase();
    const protocol = (window.location && window.location.protocol || "").toLowerCase();
    return protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function getLocalWebhookFromPrompt() {
    const key = window.DISCORD_LOCAL_WEBHOOK_STORAGE || window.ANTICHEAT_LOCAL_WEBHOOK_STORAGE || "growtopia_local_discord_webhook_v1";
    try {
      const cached = localStorage.getItem(key);
      if (cached && cached.trim()) return cached.trim();
    } catch (error) {
      // ignore localStorage errors
    }
    const entered = window.prompt("Enter Discord webhook URL (local run):");
    const safe = (entered || "").trim();
    if (!safe) return "";
    try {
      localStorage.setItem(key, safe);
    } catch (error) {
      // ignore localStorage errors
    }
    return safe;
  }

  async function getWebhookUrl(forceRefresh) {
    if (!forceRefresh && webhookUrlPromise) return webhookUrlPromise;
    webhookUrlPromise = (async () => {
      if (isLocalRuntime()) {
        return getLocalWebhookFromPrompt();
      }
      const endpoint = String(window.DISCORD_WEBHOOK_ENDPOINT || window.ANTICHEAT_WEBHOOK_ENDPOINT || "").trim();
      if (!endpoint) return "";
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error("Webhook endpoint blocked: " + res.status);
      return (await res.text()).trim();
    })().catch(() => {
      webhookUrlPromise = null;
      return "";
    });
    return webhookUrlPromise;
  }

  function looksLikeDiscordWebhookUrl(value) {
    return DISCORD_WEBHOOK_RE.test(String(value || "").trim());
  }

  function parseWebhookUrlFromBody(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    if (looksLikeDiscordWebhookUrl(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const candidates = [
          parsed.key,
          parsed.webhookUrl,
          parsed.url,
          parsed.webhook,
          parsed.data && parsed.data.key,
          parsed.data && parsed.data.webhookUrl,
          parsed.data && parsed.data.url
        ];
        for (let i = 0; i < candidates.length; i++) {
          const value = String(candidates[i] || "").trim();
          if (looksLikeDiscordWebhookUrl(value)) return value;
        }
      }
    } catch (error) {
      // body is plain text, ignore parse error
    }
    return "";
  }

  async function resolveDiscordWebhookUrl(rawUrl) {
    const initial = String(rawUrl || "").trim();
    if (!initial) return "";
    if (looksLikeDiscordWebhookUrl(initial)) return initial;
    const parsedFromInitial = parseWebhookUrlFromBody(initial);
    if (parsedFromInitial) return parsedFromInitial;
    try {
      const res = await fetch(initial, { cache: "no-store" });
      if (!res.ok) return "";
      const body = await res.text();
      return parseWebhookUrlFromBody(body);
    } catch (error) {
      return "";
    }
  }

  function toContent(payload) {
    if (payload && typeof payload === "object" && typeof payload.content === "string") {
      return payload.content;
    }
    return String(payload || "").trim();
  }

  function toEmbeds(payload) {
    if (!payload || typeof payload !== "object") return [];
    if (Array.isArray(payload.embeds)) return payload.embeds.filter((x) => x && typeof x === "object");
    if (payload.embed && typeof payload.embed === "object") return [payload.embed];
    return [];
  }

  function sanitizeEmbed(embed) {
    if (!embed || typeof embed !== "object") return null;
    const out = { ...embed };
    if (typeof out.title === "string" && out.title.length > 256) out.title = out.title.slice(0, 256);
    if (typeof out.description === "string" && out.description.length > 4096) out.description = out.description.slice(0, 4096);
    if (Array.isArray(out.fields)) {
      out.fields = out.fields.slice(0, 25).map((f) => {
        const row = f && typeof f === "object" ? { ...f } : {};
        row.name = String(row.name || "").slice(0, 256);
        row.value = String(row.value || "").slice(0, 1024);
        row.inline = Boolean(row.inline);
        return row;
      });
    }
    return out;
  }

  async function send(payload, options) {
    const opts = options || {};
    const contentRaw = toContent(payload);
    const content = contentRaw.length > 1900 ? (contentRaw.slice(0, 1897) + "...") : contentRaw;
    const embedsRaw = toEmbeds(payload);
    const embeds = embedsRaw.map(sanitizeEmbed).filter(Boolean).slice(0, 10);
    if (!content && !embeds.length) return false;

    const explicitWebhookUrl = String(opts.webhookUrl || "").trim();
    const unresolved = explicitWebhookUrl || (await getWebhookUrl(Boolean(opts.forceRefresh)));
    const url = await resolveDiscordWebhookUrl(unresolved);
    if (!url) return false;

    const body = {};
    if (content) body.content = content;
    if (embeds.length) body.embeds = embeds;
    if (typeof opts.username === "string" && opts.username.trim()) body.username = opts.username.trim().slice(0, 80);
    if (typeof opts.avatarUrl === "string" && opts.avatarUrl.trim()) body.avatar_url = opts.avatarUrl.trim();
    try {
      const directRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (directRes && directRes.ok) return true;
    } catch (error) {
      // try no-cors fallback below
    }

    // Browser CORS for Discord webhooks is often restrictive.
    // `no-cors` gives an opaque response, but still sends the request.
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      return true;
    } catch (error) {
      // ignore
    }

    return false;
  }

  async function sendEmbed(embed, options) {
    const payload = { embeds: Array.isArray(embed) ? embed : [embed] };
    return send(payload, options);
  }

  return {
    isLocalRuntime,
    getWebhookUrl,
    send,
    sendEmbed
  };
})();



/*

window.GTModules.discord.sendEmbed({
  title: "Anti-Cheat",
  description: "Speed anomaly detected",
  color: 0xff5555,
  fields: [
    { name: "User", value: "@isxt", inline: true },
    { name: "World", value: "buywings", inline: true }
  ],
  timestamp: new Date().toISOString()
});

*/
