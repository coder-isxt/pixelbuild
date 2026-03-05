window.GTModules = window.GTModules || {};

window.GTModules.events = (function createEventsModule() {
  function on(target, type, listener, options) {
    if (!target || typeof target.addEventListener !== "function") return false;
    target.addEventListener(type, listener, options);
    return true;
  }

  return {
    on
  };
})();
