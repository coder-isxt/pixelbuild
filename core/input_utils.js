window.GTModules = window.GTModules || {};

window.GTModules.inputUtils = (function createInputUtilsModule() {
  function canvasPointFromClient(canvas, clientX, clientY) {
    if (!canvas || typeof canvas.getBoundingClientRect !== "function") {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = (canvas.width || 1) / Math.max(1, rect.width || 1);
    const scaleY = (canvas.height || 1) / Math.max(1, rect.height || 1);
    return {
      x: (Number(clientX) - rect.left) * scaleX,
      y: (Number(clientY) - rect.top) * scaleY
    };
  }

  function worldFromClient(canvas, clientX, clientY, cameraX, cameraY, zoom, tileSize) {
    const point = canvasPointFromClient(canvas, clientX, clientY);
    const safeZoom = Math.max(0.01, Number(zoom) || 1);
    const safeTile = Math.max(1, Math.floor(Number(tileSize) || 32));
    const worldX = point.x / safeZoom + (Number(cameraX) || 0);
    const worldY = point.y / safeZoom + (Number(cameraY) || 0);
    return {
      tx: Math.floor(worldX / safeTile),
      ty: Math.floor(worldY / safeTile)
    };
  }

  function pointInsideElement(element, clientX, clientY) {
    if (!element || typeof element.getBoundingClientRect !== "function") return false;
    const rect = element.getBoundingClientRect();
    const x = Number(clientX);
    const y = Number(clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  return {
    canvasPointFromClient,
    worldFromClient,
    pointInsideElement
  };
})();
