window.GT_SETTINGS = {
  BASE_PATH: "growtopia-test",
  LOG_VIEWER_USERNAMES: ["isxt"],
  ADMIN_USERNAMES: ["isxt"],
  ADMIN_ROLE_BY_USERNAME: {
    isxt: "owner"
  },
  ADMIN_COMMAND_COOLDOWNS_MS: {
    owner: {},
    manager: { tempban: 2000, permban: 2000, unban: 1000, kick: 700, givex: 600, giveitem: 600, tp: 300, bring: 700, summon: 700, setrole: 2000 },
    admin: { kick: 900, givex: 900, giveitem: 900, tp: 400, bring: 900, summon: 900 },
    moderator: { kick: 1200, tp: 600, bring: 1200, summon: 1200 },
    none: {}
  },
  TILE_SIZE: 32,
  WORLD_WIDTH_TILES: 140,
  WORLD_HEIGHT_TILES: 30,
  PLAYER_WIDTH: 22,
  PLAYER_HEIGHT: 30,

  GRAVITY: 0.13,        // low gravity (Mars-like)
  MAX_FALL_SPEED: 3.95,  // slow falling cap

  MOVE_ACCEL: 0.27,     // responsive movement
  MAX_MOVE_SPEED: 2.38, // faster running

  FRICTION_GROUND: 0.89, 
  FRICTION_AIR: 0.985,

  AIR_CONTROL: 0.48,    // good air steering

  JUMP_VELOCITY: -4.9, // floaty jump arc
  JUMP_COOLDOWN_MS: 160,

  // Anti-cheat thresholds (tuned for these movement settings)
  AC_MAX_SPEED_PX_S: 900,
  AC_TELEPORT_PX: 720,
  AC_MAX_ACTIONS_PER_2S: 50,
  AC_MAX_CHAT_PER_10S: 20,
  AC_ALERT_COOLDOWN_MS: 15000,

  // Optional: explicit animated water frames (4 images)
  WATER_FRAME_PATHS: [
     "./assets/blocks/special/VESI_1.png",
     "./assets/blocks/special/VESI_2.png",
     "./assets/blocks/special/VESI_3.png",
     "./assets/blocks/special/VESI_4.png"
  ],
  WATER_FRAME_MS: 210,

  // Anti-gravity generator tuning
  ANTI_GRAV_RADIUS_TILES: 60,
  ANTI_GRAV_GRAVITY_MULT: 0.29,
  ANTI_GRAV_FALL_MULT: 0.47,
  ANTI_GRAV_AIR_JUMP_COOLDOWN_MS: 140,
  // Camera zoom settings (mouse wheel / +/- / 0 reset)
  CAMERA_ZOOM_MIN: 0.7,
  CAMERA_ZOOM_MAX: 2.2,
  CAMERA_ZOOM_STEP: 0.12,
  // Weather machine presets.
  // Edit/add URLs here to control selectable weather backgrounds.
  WEATHER_PRESET_IMAGES: [
    { id: "none", name: "Default Sky", url: "" },
    { id: "day", name: "Day", url: "./assets/weather/day.png" },
    { id: "void", name: "Void", url: "./assets/weather/black_hole.png" },
    { id: "night", name: "Night", url: "./assets/weather/night.png" }
  ],
  // Optional per-seed grow speed overrides (milliseconds).
  // Keys can be numeric block ids (e.g. 43) or block keys (e.g. "star").
  SEED_GROW_MS_BY_BLOCK: {
    // 43: 45000,
    // star: 45000
  },

  PLAYER_SYNC_MIN_MS: 50,
  GLOBAL_SYNC_MIN_MS: 250
};

// Firebase App Check (compat) configuration.
// Set this to your reCAPTCHA v3 site key from Firebase App Check setup.
window.FIREBASE_APP_CHECK_SITE_KEY = "6LdzFnQsAAAAAEvzL6ZBuv6DjnEb_GCiqlGbyF56";
window.FIREBASE_APP_CHECK_AUTO_REFRESH = true;
// For local development only (optional):
// - set allow localhost to true if your localhost domain is allowed in App Check.
// - set debug token to true or a token string when testing debug mode.
window.FIREBASE_APP_CHECK_ALLOW_LOCALHOST = false;
window.FIREBASE_APP_CHECK_DEBUG_TOKEN = "";

// Cloudflare Worker endpoint that returns the Discord webhook URL for anti-cheat alerts.
window.ANTICHEAT_WEBHOOK_ENDPOINT = "https://growtopia.isxtgg.workers.dev/webhook";
// Cloudflare Worker endpoint that returns the local-storage encryption key.
window.ENCRYPTION_KEY_ENDPOINT = "https://growtopia.isxtgg.workers.dev/encryptionkey";
// Cloudflare Worker endpoint used for authoritative admin command writes.
window.CLOUDFLARE_PACKET_ENDPOINT = "https://growtopia.isxtgg.workers.dev/packet";
