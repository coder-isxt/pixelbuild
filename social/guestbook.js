window.GTModules = window.GTModules || {};

window.GTModules.guestbook = (function createGuestbookModule() {
  const MAX_MESSAGE_LENGTH = 120;
  const MAX_NAME_LENGTH = 20;
  const MAX_WORLD_LENGTH = 24;

  const STAMPS = [
    { id: "hello", label: "Hello" },
    { id: "thanks", label: "Thanks" },
    { id: "wow", label: "Wow" },
    { id: "gg", label: "GG" },
    { id: "welcome", label: "Welcome" }
  ];

  const STICKERS = [
    { id: "star", label: "Star" },
    { id: "heart", label: "Heart" },
    { id: "leaf", label: "Leaf" },
    { id: "spark", label: "Spark" },
    { id: "gem", label: "Gem" }
  ];

  const STAMP_ID_SET = new Set(STAMPS.map((row) => row.id));
  const STICKER_ID_SET = new Set(STICKERS.map((row) => row.id));

  function toInt(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeWorldId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, MAX_WORLD_LENGTH);
  }

  function normalizeMessage(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH);
  }

  function normalizeChoice(value, validSet) {
    const id = String(value || "").trim().toLowerCase().slice(0, 24);
    if (!id) return "";
    return validSet.has(id) ? id : "";
  }

  function normalizeEntry(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    return {
      id: String(src.id || "").trim().slice(0, 64),
      worldId: normalizeWorldId(src.worldId),
      accountId: String(src.accountId || "").trim().slice(0, 64),
      playerId: String(src.playerId || "").trim().slice(0, 32),
      name: String(src.name || "Guest").trim().slice(0, MAX_NAME_LENGTH) || "Guest",
      text: normalizeMessage(src.text),
      stampId: normalizeChoice(src.stampId, STAMP_ID_SET),
      stickerId: normalizeChoice(src.stickerId, STICKER_ID_SET),
      createdAt: Math.max(0, toInt(src.createdAt, Date.now()))
    };
  }

  function normalizeEntriesSnapshot(raw, maxEntries) {
    const limit = Math.max(1, Math.min(500, toInt(maxEntries, 120)));
    const rows = [];
    const source = raw && typeof raw === "object" ? raw : {};
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
      const key = String(keys[i] || "").trim();
      if (!key) continue;
      const row = normalizeEntry({ ...(source[key] || {}), id: key });
      if (!row.text) continue;
      rows.push(row);
    }
    rows.sort((a, b) => {
      const diff = (b.createdAt || 0) - (a.createdAt || 0);
      if (diff !== 0) return diff;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
    return rows.slice(0, limit);
  }

  function buildEntryInput(options) {
    const opts = options && typeof options === "object" ? options : {};
    const text = normalizeMessage(opts.text);
    if (!text) {
      return { ok: false, error: "Message is empty." };
    }
    const worldId = normalizeWorldId(opts.worldId);
    if (!worldId) {
      return { ok: false, error: "Invalid world id." };
    }
    const payload = {
      worldId,
      accountId: String(opts.accountId || "").trim().slice(0, 64),
      playerId: String(opts.playerId || "").trim().slice(0, 32),
      name: String(opts.name || "Guest").trim().slice(0, MAX_NAME_LENGTH) || "Guest",
      text,
      stampId: normalizeChoice(opts.stampId, STAMP_ID_SET),
      stickerId: normalizeChoice(opts.stickerId, STICKER_ID_SET),
      createdAt: Math.max(0, toInt(opts.createdAt, Date.now()))
    };
    return { ok: true, payload };
  }

  function getStampById(id) {
    const safe = normalizeChoice(id, STAMP_ID_SET);
    if (!safe) return null;
    for (let i = 0; i < STAMPS.length; i++) {
      if (STAMPS[i].id === safe) return { ...STAMPS[i] };
    }
    return null;
  }

  function getStickerById(id) {
    const safe = normalizeChoice(id, STICKER_ID_SET);
    if (!safe) return null;
    for (let i = 0; i < STICKERS.length; i++) {
      if (STICKERS[i].id === safe) return { ...STICKERS[i] };
    }
    return null;
  }

  function getStampCatalog() {
    return STAMPS.map((row) => ({ ...row }));
  }

  function getStickerCatalog() {
    return STICKERS.map((row) => ({ ...row }));
  }

  return {
    normalizeWorldId,
    normalizeMessage,
    normalizeEntry,
    normalizeEntriesSnapshot,
    buildEntryInput,
    getStampById,
    getStickerById,
    getStampCatalog,
    getStickerCatalog
  };
})();
