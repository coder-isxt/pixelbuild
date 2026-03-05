window.GTModules = window.GTModules || {};

window.GTModules.draw = (function createDrawModule() {
  function createController(options) {
    const opts = options || {};
    const scopeBacking = {};
    const scope = new Proxy(scopeBacking, {
      has() {
        return true;
      },
      get(target, prop) {
        if (prop === Symbol.unscopables) return undefined;
        if (Object.prototype.hasOwnProperty.call(target, prop)) {
          return target[prop];
        }
        return globalThis[prop];
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    });

    function syncScope() {
      if (typeof opts.sync === "function") {
        opts.sync(scopeBacking);
      }
    }

    const DRAW_IMPL = (window.GTModules && typeof window.GTModules.drawImplSource === "string")
      ? window.GTModules.drawImplSource
      : "";
    if (!DRAW_IMPL) {
      throw new Error("draw_impl_source.js missing: GTModules.drawImplSource");
    }

    const setupInScope = new Function(
      "scope",
      "with (scope) {\n" + DRAW_IMPL + "\n" +
      "scope.__render = render;\n" +
      "scope.__openWrenchMenuFromNameIcon = openWrenchMenuFromNameIcon;\n" +
      "scope.__wrapChatText = wrapChatText;\n" +
      "}"
    );

    syncScope();
    setupInScope(scopeBacking);

    let renderFn = typeof scopeBacking.__render === "function"
      ? scopeBacking.__render
      : function noopRender() {};
    let openWrenchMenuFromNameIconFn = typeof scopeBacking.__openWrenchMenuFromNameIcon === "function"
      ? scopeBacking.__openWrenchMenuFromNameIcon
      : function noopWrench() { return false; };
    let wrapChatTextFn = typeof scopeBacking.__wrapChatText === "function"
      ? scopeBacking.__wrapChatText
      : function fallbackWrap(text) { return [String(text || "")]; };

    return {
      render: function renderFrame() {
        syncScope();
        return renderFn();
      },
      openWrenchMenuFromNameIcon: function openWrench(clientX, clientY) {
        syncScope();
        return Boolean(openWrenchMenuFromNameIconFn(clientX, clientY));
      },
      wrapChatText: function wrapText(text, maxTextWidth) {
        syncScope();
        return wrapChatTextFn(text, maxTextWidth);
      }
    };
  }

  return {
    createController
  };
})();













