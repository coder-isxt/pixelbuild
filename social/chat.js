window.GTModules = window.GTModules || {};
window.GTModules.chat = {
  formatChatTimestamp(timestamp) {
    if (!timestamp || typeof timestamp !== "number") return "";
    const d = new Date(timestamp);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  }
};
