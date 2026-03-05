window.GTModules = window.GTModules || {};

window.GTModules.authStorage = {
  saveCredentials(key, username, password) {
    const storage = window.GTModules && window.GTModules.secureStorage;
    const payload = {
      username: String(username || "").slice(0, 24),
      password: String(password || "").slice(0, 64)
    };
    if (storage && typeof storage.saveJson === "function") {
      storage.saveJson(String(key || ""), payload);
      return;
    }
    try {
      localStorage.setItem(String(key || ""), JSON.stringify(payload));
    } catch (error) {
      // ignore localStorage failures
    }
  },
  loadCredentials(key) {
    const storage = window.GTModules && window.GTModules.secureStorage;
    if (storage && typeof storage.loadJson === "function") {
      const parsed = storage.loadJson(String(key || ""));
      if (!parsed || typeof parsed !== "object") return { username: "", password: "" };
      return {
        username: (parsed.username || "").toString(),
        password: (parsed.password || "").toString()
      };
    }
    try {
      const raw = localStorage.getItem(String(key || ""));
      if (!raw) return { username: "", password: "" };
      const parsed = JSON.parse(raw);
      return {
        username: (parsed && parsed.username || "").toString(),
        password: (parsed && parsed.password || "").toString()
      };
    } catch (error) {
      return { username: "", password: "" };
    }
  }
};
