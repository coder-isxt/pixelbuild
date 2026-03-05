window.GTModules = window.GTModules || {};

window.GTModules.stringUtils = {
  normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  },
  escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }
};

