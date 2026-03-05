window.GTModules = window.GTModules || {};
window.GTModules.physics = {
  isLiquidTile(world, blockDefs, tx, ty, worldW, worldH) {
    if (tx < 0 || ty < 0 || tx >= worldW || ty >= worldH) return false;
    const id = world[ty][tx];
    const def = blockDefs[id];
    return Boolean(def && def.liquid);
  },

  isOneWayPlatformTile(world, blockDefs, tx, ty, worldW, worldH) {
    if (tx < 0 || ty < 0 || tx >= worldW || ty >= worldH) return false;
    const id = world[ty][tx];
    const def = blockDefs[id];
    return Boolean(def && def.oneWay);
  },

  rectCollides(world, blockDefs, x, y, w, h, tileSize, worldW, worldH, isSolidTileFn) {
    const left = Math.floor(x / tileSize);
    const right = Math.floor((x + w - 1) / tileSize);
    const top = Math.floor(y / tileSize);
    const bottom = Math.floor((y + h - 1) / tileSize);
    const hasOverride = typeof isSolidTileFn === "function";
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (tx < 0 || ty < 0 || tx >= worldW || ty >= worldH) return true;
        if (hasOverride) {
          if (isSolidTileFn(tx, ty)) return true;
          continue;
        }
        const id = world[ty][tx];
        const def = blockDefs[id];
        if (def && def.solid) return true;
      }
    }
    return false;
  },

  rectTouchesLiquid(world, blockDefs, x, y, w, h, tileSize, worldW, worldH) {
    const left = Math.floor(x / tileSize);
    const right = Math.floor((x + w - 1) / tileSize);
    const top = Math.floor(y / tileSize);
    const bottom = Math.floor((y + h - 1) / tileSize);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (this.isLiquidTile(world, blockDefs, tx, ty, worldW, worldH)) return true;
      }
    }
    return false;
  },

  rectCollidesOneWayPlatformDownward(world, blockDefs, x, prevY, nextY, w, h, tileSize, worldW, worldH) {
    if (nextY <= prevY) return false;
    const left = Math.floor(x / tileSize);
    const right = Math.floor((x + w - 1) / tileSize);
    const prevBottom = prevY + h;
    const nextBottom = nextY + h;
    const startTy = Math.floor((prevBottom - 1) / tileSize);
    const endTy = Math.floor((nextBottom - 1) / tileSize);
    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (!this.isOneWayPlatformTile(world, blockDefs, tx, ty, worldW, worldH)) continue;
        const tileTop = ty * tileSize;
        if (prevBottom <= tileTop + 5 && nextBottom >= tileTop + 1) return true;
      }
    }
    return false;
  },

  getStairSurfaceY(id, tx, ty, worldX, tileSize) {
    const localX = Math.max(0, Math.min(1, (worldX - tx * tileSize) / tileSize));
    // 13/16 share one diagonal, 14/15 share the opposite diagonal.
    let localY = localX;
    if (id === 14 || id === 15) localY = 1 - localX;
    return ty * tileSize + localY * tileSize;
  },

  snapPlayerToStairSurface(player, world, blockDefs, stairIds, tileSize, playerW, playerH, worldW, worldH) {
    const footLeftX = player.x + 3;
    const footRightX = player.x + playerW - 3;
    const footCenterX = player.x + playerW * 0.5;
    const bottomY = player.y + playerH;
    const checkFeet = [footLeftX, footCenterX, footRightX];
    let targetBottom = Infinity;
    let found = false;
    for (let i = 0; i < checkFeet.length; i++) {
      const fx = checkFeet[i];
      const tx = Math.floor(fx / tileSize);
      const baseTy = Math.floor((bottomY - 1) / tileSize);
      for (let yOff = -1; yOff <= 1; yOff++) {
        const ty = baseTy + yOff;
        if (tx < 0 || ty < 0 || tx >= worldW || ty >= worldH) continue;
        const id = world[ty][tx];
        if (!stairIds.includes(id)) continue;
        const surfaceY = this.getStairSurfaceY(id, tx, ty, fx, tileSize);
        if (bottomY < surfaceY - 6 || bottomY > surfaceY + 12) continue;
        const testY = surfaceY - playerH;
        // Never snap onto stair if resulting player box would intersect solids.
        if (this.rectCollides(world, blockDefs, player.x, testY, playerW, playerH, tileSize, worldW, worldH)) continue;
        // Pick the highest surface (smallest y) to avoid embedding in stairs.
        targetBottom = Math.min(targetBottom, surfaceY);
        found = true;
      }
    }
    if (!found) return false;
    // If we are already grounded on something higher (smaller y) than the stair surface,
    // do not snap down. This prevents being pulled through platforms when walking off stairs.
    if (player.grounded && targetBottom > bottomY + 0.01) return false;

    player.y = targetBottom - playerH;
    player.grounded = true;
    if (player.vy > 0) player.vy = 0;
    return true;
  }
};
