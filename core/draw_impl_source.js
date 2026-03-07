window.GTModules = window.GTModules || {};

window.GTModules.drawImplSource = `
      const fallbackBlockTextureCache = new Map();
      const fallbackColorProbeCanvas = (typeof document !== "undefined" && document && typeof document.createElement === "function")
        ? document.createElement("canvas")
        : null;
      const fallbackColorProbeCtx = fallbackColorProbeCanvas && typeof fallbackColorProbeCanvas.getContext === "function"
        ? fallbackColorProbeCanvas.getContext("2d")
        : null;

function drawBackground() {
        const viewW = getCameraViewWidth();
        const viewH = getCameraViewHeight();
        const weatherImageUrl = getActiveWeatherImageUrl();
        if (weatherImageUrl) {
          const weatherImg = getBlockImageByPath(weatherImageUrl);
          if (weatherImg) {
            const sx = weatherImg.naturalWidth || weatherImg.width || 1;
            const sy = weatherImg.naturalHeight || weatherImg.height || 1;
            const scale = Math.max(viewW / sx, viewH / sy);
            const drawW = sx * scale;
            const drawH = sy * scale;
            const drawX = (viewW - drawW) * 0.5;
            const drawY = (viewH - drawH) * 0.5;
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(weatherImg, drawX, drawY, drawW, drawH);
            ctx.fillStyle = "rgba(11, 24, 38, 0.1)";
            ctx.fillRect(0, 0, viewW, viewH);
            ctx.restore();
            return;
          }
        }
        const t = performance.now() * 0.00008;
        const cloudShift = Math.sin(t) * 30;

        ctx.fillStyle = "#8fd9ff";
        ctx.fillRect(0, 0, viewW, viewH);

        ctx.fillStyle = "rgba(255,255,255,0.55)";
        for (let i = 0; i < 8; i++) {
          const x = ((i * 180 + cloudShift * (i % 2 ? 1 : -1)) % (viewW + 220)) - 110;
          const y = 40 + (i % 3) * 48;
          ctx.beginPath();
          ctx.ellipse(x, y, 55, 20, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "#78c16a";
        ctx.fillRect(0, viewH - 46, viewW, 46);
      }

      function drawAllDamageOverlays() {
        if (tileDamageByKey.size === 0) return;
        
        const viewW = getCameraViewWidth();
        const viewH = getCameraViewHeight();
        const startX = Math.floor(cameraX / TILE);
        const endX = Math.ceil((cameraX + viewW) / TILE);
        const startY = Math.floor(cameraY / TILE);
        const endY = Math.ceil((cameraY + viewH) / TILE);

        tileDamageByKey.forEach((damage, key) => {
          if (!damage || !damage.hits) return;
          const parts = key.split("_");
          const tx = parseInt(parts[0], 10);
          const ty = parseInt(parts[1], 10);
          
          if (tx < startX || tx > endX || ty < startY || ty > endY) return;
          
          const id = world[ty] && world[ty][tx];
          if (!id) return;
          const durability = getBlockDurability(id);
          if (!Number.isFinite(durability) || durability <= 1) return;
          
          const ratio = Math.max(0, Math.min(1, damage.hits / durability));
          if (ratio <= 0) return;
          
          const x = tx * TILE - cameraX;
          const y = ty * TILE - cameraY;
          const stage = Math.max(1, Math.min(4, Math.ceil(ratio * 4)));
          const alpha = 0.22 + stage * 0.14;
          const crackColor = "rgba(245, 251, 255, " + alpha.toFixed(3) + ")";
          const seed = ((tx * 73856093) ^ (ty * 19349663) ^ (id * 83492791)) >>> 0;
          
          ctx.save();
          ctx.strokeStyle = crackColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          const lineCount = 2 + stage * 2;
          for (let i = 0; i < lineCount; i++) {
            const a = ((seed + i * 137) % 1000) / 1000;
            const b = ((seed + i * 241 + 71) % 1000) / 1000;
            const c = ((seed + i * 389 + 19) % 1000) / 1000;
            const d = ((seed + i * 521 + 43) % 1000) / 1000;
            const x1 = x + 1 + a * (TILE - 2);
            const y1 = y + 1 + b * (TILE - 2);
            const x2 = x + 1 + c * (TILE - 2);
            const y2 = y + 1 + d * (TILE - 2);
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
          ctx.stroke();
          ctx.restore();
        });
      }

      function clampRgbByte(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(255, Math.round(n)));
      }

      function colorToRgb(rawColor, fallbackHex) {
        const fallback = String(fallbackHex || "#6f86a7");
        if (fallbackColorProbeCtx) {
          try {
            fallbackColorProbeCtx.fillStyle = fallback;
            fallbackColorProbeCtx.fillStyle = String(rawColor || fallback);
            const normalized = String(fallbackColorProbeCtx.fillStyle || fallback).trim().toLowerCase();
            let match = normalized.match(/^#([0-9a-f]{3})$/i);
            if (match) {
              const h = match[1];
              return {
                r: parseInt(h[0] + h[0], 16),
                g: parseInt(h[1] + h[1], 16),
                b: parseInt(h[2] + h[2], 16)
              };
            }
            match = normalized.match(/^#([0-9a-f]{6})$/i);
            if (match) {
              const h = match[1];
              return {
                r: parseInt(h.slice(0, 2), 16),
                g: parseInt(h.slice(2, 4), 16),
                b: parseInt(h.slice(4, 6), 16)
              };
            }
            match = normalized.match(/^rgb\\(\\s*([0-9]+),\\s*([0-9]+),\\s*([0-9]+)\\s*\\)$/i);
            if (match) {
              return {
                r: clampRgbByte(match[1]),
                g: clampRgbByte(match[2]),
                b: clampRgbByte(match[3])
              };
            }
          } catch (error) {
            // ignore color parsing failures
          }
        }
        return { r: 111, g: 134, b: 167 };
      }

      function mixRgb(a, b, t) {
        const blend = Math.max(0, Math.min(1, Number(t) || 0));
        return {
          r: clampRgbByte((a.r || 0) + ((b.r || 0) - (a.r || 0)) * blend),
          g: clampRgbByte((a.g || 0) + ((b.g || 0) - (a.g || 0)) * blend),
          b: clampRgbByte((a.b || 0) + ((b.b || 0) - (a.b || 0)) * blend)
        };
      }

      function shiftRgb(rgb, amount) {
        const base = {
          r: clampRgbByte(rgb && rgb.r),
          g: clampRgbByte(rgb && rgb.g),
          b: clampRgbByte(rgb && rgb.b)
        };
        const factor = Math.max(-1, Math.min(1, Number(amount) || 0));
        if (factor >= 0) {
          return mixRgb(base, { r: 255, g: 255, b: 255 }, factor);
        }
        return mixRgb(base, { r: 0, g: 0, b: 0 }, -factor);
      }

      function rgbToCss(rgb, alpha) {
        const r = clampRgbByte(rgb && rgb.r);
        const g = clampRgbByte(rgb && rgb.g);
        const b = clampRgbByte(rgb && rgb.b);
        if (alpha === undefined) return "rgb(" + r + "," + g + "," + b + ")";
        const a = Math.max(0, Math.min(1, Number(alpha) || 0));
        return "rgba(" + r + "," + g + "," + b + "," + a + ")";
      }

      function hashTextSeed(value) {
        const text = String(value || "");
        let hash = 2166136261 >>> 0;
        for (let i = 0; i < text.length; i++) {
          hash ^= text.charCodeAt(i);
          hash = Math.imul(hash, 16777619) >>> 0;
        }
        return hash >>> 0;
      }

      function createSeededRand(seed) {
        let state = (Number(seed) >>> 0) || 1;
        return function nextRand() {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          return state / 4294967296;
        };
      }

      function resolveFallbackBlockMaterial(def, id) {
        if (def && def.liquid) return "water";
        const text = (String((def && (def.key || def.name)) || "") + " " + String(id || "")).toLowerCase();
        if (/wood|plank|log|bamboo|board|timber|branch/.test(text)) return "wood";
        if (/metal|steel|iron|copper|bronze|machine|circuit|lock|vending|camera|generator/.test(text)) return "metal";
        if (/sand|dirt|soil|mud|clay|gravel|ash/.test(text)) return "earth";
        if (/grass|leaf|moss|vine|bush|plant|tree|seed/.test(text)) return "organic";
        if (/ice|snow|frost|crystal|glass/.test(text)) return "ice";
        return "stone";
      }

      function getFallbackMaterialBaseColor(material) {
        if (material === "wood") return "#8a6645";
        if (material === "metal") return "#6d819e";
        if (material === "earth") return "#7f6750";
        if (material === "organic") return "#5f8663";
        if (material === "ice") return "#8bb2d0";
        if (material === "water") return "#4d89cf";
        return "#7386a1";
      }

      function drawMaterialPattern(patternCtx, material, baseRgb, tileSize, seedText) {
        const rand = createSeededRand(hashTextSeed(seedText));
        const size = Math.max(8, Math.floor(Number(tileSize) || 32));
        if (material === "wood") {
          for (let y = 3; y < size; y += 4) {
            const wobble = (rand() - 0.5) * 2;
            patternCtx.fillStyle = rgbToCss(shiftRgb(baseRgb, -0.14 + rand() * 0.12), 0.42);
            patternCtx.fillRect(1, Math.floor(y + wobble), size - 2, 1);
          }
          for (let i = 0; i < 3; i++) {
            const cx = 5 + rand() * (size - 10);
            const cy = 5 + rand() * (size - 10);
            const rx = 2 + rand() * 4;
            const ry = 1.5 + rand() * 3;
            patternCtx.strokeStyle = rgbToCss(shiftRgb(baseRgb, -0.2), 0.45);
            patternCtx.beginPath();
            patternCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            patternCtx.stroke();
          }
          return;
        }
        if (material === "metal") {
          for (let i = -size; i < size * 2; i += 5) {
            patternCtx.strokeStyle = rgbToCss(shiftRgb(baseRgb, 0.18), 0.16);
            patternCtx.beginPath();
            patternCtx.moveTo(i, 0);
            patternCtx.lineTo(i + size, size);
            patternCtx.stroke();
          }
          const rivet = Math.max(1, Math.floor(size * 0.08));
          const points = [
            [Math.max(2, rivet + 1), Math.max(2, rivet + 1)],
            [size - Math.max(2, rivet + 1), Math.max(2, rivet + 1)],
            [Math.max(2, rivet + 1), size - Math.max(2, rivet + 1)],
            [size - Math.max(2, rivet + 1), size - Math.max(2, rivet + 1)]
          ];
          for (let i = 0; i < points.length; i++) {
            patternCtx.fillStyle = rgbToCss(shiftRgb(baseRgb, 0.28), 0.6);
            patternCtx.beginPath();
            patternCtx.arc(points[i][0], points[i][1], rivet, 0, Math.PI * 2);
            patternCtx.fill();
          }
          return;
        }
        if (material === "earth") {
          for (let i = 0; i < 18; i++) {
            const px = 1 + rand() * (size - 2);
            const py = 1 + rand() * (size - 2);
            const rad = 0.7 + rand() * 1.4;
            patternCtx.fillStyle = rgbToCss(shiftRgb(baseRgb, -0.24 + rand() * 0.18), 0.42);
            patternCtx.beginPath();
            patternCtx.arc(px, py, rad, 0, Math.PI * 2);
            patternCtx.fill();
          }
          return;
        }
        if (material === "organic") {
          for (let i = 0; i < 10; i++) {
            const px = 1 + rand() * (size - 2);
            const py = 1 + rand() * (size - 2);
            const rw = 1.4 + rand() * 3.1;
            const rh = 1.1 + rand() * 2.5;
            patternCtx.fillStyle = rgbToCss(shiftRgb(baseRgb, -0.12 + rand() * 0.2), 0.35);
            patternCtx.beginPath();
            patternCtx.ellipse(px, py, rw, rh, rand() * Math.PI, 0, Math.PI * 2);
            patternCtx.fill();
          }
          patternCtx.strokeStyle = rgbToCss(shiftRgb(baseRgb, 0.25), 0.2);
          for (let i = 0; i < 4; i++) {
            const y = Math.floor(3 + i * ((size - 6) / 3));
            patternCtx.beginPath();
            patternCtx.moveTo(2, y);
            patternCtx.lineTo(size - 2, y + (rand() - 0.5) * 2);
            patternCtx.stroke();
          }
          return;
        }
        if (material === "ice") {
          for (let i = 0; i < 8; i++) {
            const sx = 1 + rand() * (size - 2);
            const sy = 1 + rand() * (size - 2);
            const ex = sx + (rand() - 0.5) * (size * 0.6);
            const ey = sy + (rand() - 0.5) * (size * 0.6);
            patternCtx.strokeStyle = rgbToCss(shiftRgb(baseRgb, 0.45), 0.32);
            patternCtx.beginPath();
            patternCtx.moveTo(sx, sy);
            patternCtx.lineTo(ex, ey);
            patternCtx.stroke();
          }
          patternCtx.fillStyle = rgbToCss(shiftRgb(baseRgb, 0.5), 0.14);
          patternCtx.fillRect(2, 2, size - 4, Math.max(2, Math.floor(size * 0.22)));
          return;
        }
        if (material === "water") {
          for (let i = 0; i < 4; i++) {
            const y = 3 + i * Math.max(3, Math.floor(size * 0.18));
            patternCtx.fillStyle = rgbToCss(shiftRgb(baseRgb, 0.25), 0.2 + i * 0.03);
            patternCtx.fillRect(1, y, size - 2, 1);
          }
          return;
        }
        for (let i = 0; i < 14; i++) {
          const px = 1 + rand() * (size - 3);
          const py = 1 + rand() * (size - 3);
          const w = 1 + Math.floor(rand() * 3);
          const h = 1 + Math.floor(rand() * 3);
          patternCtx.fillStyle = rgbToCss(shiftRgb(baseRgb, -0.2 + rand() * 0.3), 0.36);
          patternCtx.fillRect(Math.floor(px), Math.floor(py), w, h);
        }
      }

      function getFallbackBlockTexture(def, id, tileSize) {
        const size = Math.max(8, Math.floor(Number(tileSize) || TILE || 32));
        const material = resolveFallbackBlockMaterial(def, id);
        const baseHex = getFallbackMaterialBaseColor(material);
        const baseRgb = colorToRgb(def && def.color, baseHex);
        const key = String(id || 0) + "|" + size + "|" + material + "|" + baseRgb.r + "," + baseRgb.g + "," + baseRgb.b;
        if (fallbackBlockTextureCache.has(key)) {
          return fallbackBlockTextureCache.get(key);
        }
        if (!(typeof document !== "undefined" && document && typeof document.createElement === "function")) {
          return null;
        }
        const texture = document.createElement("canvas");
        texture.width = size;
        texture.height = size;
        const textureCtx = texture.getContext("2d");
        if (!textureCtx) return null;
        textureCtx.imageSmoothingEnabled = false;
        const topRgb = shiftRgb(baseRgb, 0.16);
        const bottomRgb = shiftRgb(baseRgb, -0.21);
        const grad = textureCtx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, rgbToCss(topRgb));
        grad.addColorStop(1, rgbToCss(bottomRgb));
        textureCtx.fillStyle = grad;
        textureCtx.fillRect(0, 0, size, size);
        drawMaterialPattern(textureCtx, material, baseRgb, size, key);
        textureCtx.fillStyle = "rgba(245, 253, 255, 0.08)";
        textureCtx.fillRect(1, 1, size - 2, Math.max(2, Math.floor(size * 0.18)));
        textureCtx.fillStyle = "rgba(6, 12, 24, 0.18)";
        textureCtx.fillRect(0, size - Math.max(2, Math.floor(size * 0.16)), size, Math.max(2, Math.floor(size * 0.16)));
        textureCtx.strokeStyle = rgbToCss(shiftRgb(baseRgb, -0.5), 0.75);
        textureCtx.lineWidth = 1;
        textureCtx.strokeRect(0.5, 0.5, size - 1, size - 1);
        textureCtx.strokeStyle = rgbToCss(shiftRgb(baseRgb, 0.18), 0.22);
        textureCtx.strokeRect(1.5, 1.5, size - 3, size - 3);
        fallbackBlockTextureCache.set(key, texture);
        return texture;
      }

      function drawFallbackBlockTile(def, id, x, y, tx, ty) {
        const texture = getFallbackBlockTexture(def, id, TILE);
        if (texture) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(texture, x, y, TILE, TILE);
          ctx.restore();
        } else {
          ctx.fillStyle = (def && def.color) ? def.color : "#7b8ea8";
          ctx.fillRect(x, y, TILE, TILE);
        }
        if (def && def.liquid) {
          const wave = Math.sin((performance.now() * 0.01) + tx * 0.7 + ty * 0.4) * 1.6;
          ctx.fillStyle = "rgba(210, 245, 255, 0.28)";
          ctx.fillRect(x + 1, y + 3 + wave, TILE - 2, 4);
          ctx.fillStyle = "rgba(18, 84, 170, 0.2)";
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        }
      }

      function drawFallbackBlockInWorld(def, id, x, y) {
        const size = TILE * 0.65;
        const offset = (TILE - size) / 2;
        const texture = getFallbackBlockTexture(def, id, TILE);
        if (texture) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(texture, x + offset, y + offset, size, size);
          ctx.strokeStyle = "rgba(255,255,255,0.22)";
          ctx.strokeRect(x + offset + 0.5, y + offset + 0.5, size - 1, size - 1);
          ctx.restore();
          return;
        }
        ctx.save();
        ctx.fillStyle = def && def.color ? def.color : "#8b9cb4";
        ctx.fillRect(x + offset, y + offset, size, size);
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.strokeRect(x + offset + 0.5, y + offset + 0.5, size - 1, size - 1);
        ctx.restore();
      }

      function drawWorld() {
        const viewW = getCameraViewWidth();
        const viewH = getCameraViewHeight();
        const startX = Math.floor(cameraX / TILE);
        const endX = Math.ceil((cameraX + viewW) / TILE);
        const startY = Math.floor(cameraY / TILE);
        const endY = Math.ceil((cameraY + viewH) / TILE);

        // const //drawBlockDamageOverlay = (tx, ty, id, x, y) => {
        //   if (!id) return;
        //   const durability = getBlockDurability(id);
        //   if (!Number.isFinite(durability) || durability <= 1) return;
        //   const damage = getTileDamage(tx, ty);
        //   if (!damage.hits) return;
        //   const ratio = Math.max(0, Math.min(1, damage.hits / durability));
        //   if (ratio <= 0) return;
        //   const stage = Math.max(1, Math.min(4, Math.ceil(ratio * 4)));
        //   const alpha = 0.22 + stage * 0.14;
        //   const crackColor = "rgba(245, 251, 255, " + alpha.toFixed(3) + ")";
        //   const seed = ((tx * 73856093) ^ (ty * 19349663) ^ (id * 83492791)) >>> 0;
        //   ctx.save();
        //   ctx.strokeStyle = crackColor;
        //   ctx.lineWidth = 1;
        //   ctx.beginPath();
        //   const lineCount = 2 + stage * 2;
        //   for (let i = 0; i < lineCount; i++) {
        //     const a = ((seed + i * 137) % 1000) / 1000;
        //     const b = ((seed + i * 241 + 71) % 1000) / 1000;
        //     const c = ((seed + i * 389 + 19) % 1000) / 1000;
        //     const d = ((seed + i * 521 + 43) % 1000) / 1000;
        //     const x1 = x + 1 + a * (TILE - 2);
        //     const y1 = y + 1 + b * (TILE - 2);
        //     const x2 = x + 1 + c * (TILE - 2);
        //     const y2 = y + 1 + d * (TILE - 2);
        //     ctx.moveTo(x1, y1);
        //     ctx.lineTo(x2, y2);
        //   }
        //   ctx.stroke();
        //   ctx.restore();
        // };

        for (let ty = startY; ty <= endY; ty++) {
          if (ty < 0 || ty >= WORLD_H) continue;
          for (let tx = startX; tx <= endX; tx++) {
            if (tx < 0 || tx >= WORLD_W) continue;
            const id = world[ty][tx];
            if (!id) continue;

            const x = tx * TILE - cameraX;
            const y = ty * TILE - cameraY;
            const def = blockDefs[id];
            if (!def) continue;

            if (id === PLATFORM_ID) {
              if (drawBlockImage(def, x, y)) {
                //drawBlockDamageOverlay(tx, ty, id, x, y);
                continue;
              }
              ctx.fillStyle = "#6d4f35";
              ctx.fillRect(x, y + 2, TILE, 6);
              ctx.fillStyle = "rgba(255, 238, 202, 0.25)";
              ctx.fillRect(x + 1, y + 2, TILE - 2, 2);
              //drawBlockDamageOverlay(tx, ty, id, x, y);
              continue;
            }

            if (STAIR_ROTATION_IDS.includes(id)) {
              if (drawStairImage(id, def, x, y)) {
                //drawBlockDamageOverlay(tx, ty, id, x, y);
                continue;
              }
              ctx.fillStyle = def.color;
              ctx.beginPath();
              if (id === 13) {
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + TILE);
                ctx.lineTo(x + TILE, y + TILE);
              } else if (id === 14) {
                ctx.moveTo(x, y);
                ctx.lineTo(x + TILE, y);
                ctx.lineTo(x, y + TILE);
              } else if (id === 15) {
                ctx.moveTo(x, y + TILE);
                ctx.lineTo(x + TILE, y + TILE);
                ctx.lineTo(x + TILE, y);
              } else {
                ctx.moveTo(x, y);
                ctx.lineTo(x + TILE, y);
                ctx.lineTo(x + TILE, y + TILE);
              }
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = "rgba(255,255,255,0.11)";
              ctx.fillRect(x + 2, y + 2, TILE - 4, 4);
              //drawBlockDamageOverlay(tx, ty, id, x, y);
              continue;
            }

            if (SPIKE_ROTATION_IDS.includes(id)) {
              if (drawSpikeImage(id, def, x, y)) {
                //drawBlockDamageOverlay(tx, ty, id, x, y);
                continue;
              }
              ctx.fillStyle = def.color || "#8d9aae";
              const spikeIdx = SPIKE_ROTATION_IDS.indexOf(id);
              const spikeAngle = spikeIdx >= 0 ? (spikeIdx * Math.PI / 2) : 0;
              ctx.save();
              ctx.translate(x + TILE * 0.5, y + TILE * 0.5);
              if (spikeAngle !== 0) ctx.rotate(spikeAngle);
              ctx.beginPath();
              ctx.moveTo(-TILE * 0.5, TILE * 0.5);
              ctx.lineTo(-TILE * 0.5, -TILE * 0.5);
              ctx.lineTo(TILE * 0.5, TILE * 0.5);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
              //drawBlockDamageOverlay(tx, ty, id, x, y);
              continue;
            }

            if (isPlantSeedBlockId(id)) {
              drawTreePlant(tx, ty, x, y);
              //drawBlockDamageOverlay(tx, ty, id, x, y);
              continue;
            }

            if (id === DISPLAY_BLOCK_ID) {
              ctx.fillStyle = def.color || "#314154";
              ctx.fillRect(x, y, TILE, TILE);
              ctx.strokeStyle = "rgba(255,255,255,0.95)";
              ctx.lineWidth = 1;
              ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
              ctx.strokeStyle = "rgba(255,255,255,0.45)";
              ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);

              const displayItem = getLocalDisplayItem(tx, ty);
              if (displayItem) {
                if (displayItem.type === "cosmetic") {
                  let drawnCosmetic = false;
                  for (let i = 0; i < COSMETIC_ITEMS.length; i++) {
                    const item = COSMETIC_ITEMS[i];
                    if (!item || item.id !== displayItem.cosmeticId) continue;
                    drawnCosmetic = drawCosmeticSprite(item, x + 4, y + 4, TILE - 8, TILE - 8, 1);
                    if (!drawnCosmetic) {
                      ctx.fillStyle = item.color || "#9bb4ff";
                      ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
                    }
                    break;
                  }
                } else {
                  const displayDef = blockDefs[displayItem.blockId];
                  const displayImg = getBlockImage(displayDef);
                  if (displayImg) {
                    ctx.save();
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(displayImg, x + 4, y + 4, TILE - 8, TILE - 8);
                    ctx.restore();
                  } else {
                    ctx.fillStyle = (displayDef && displayDef.color) ? displayDef.color : "#cfd8e5";
                    ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
                  }
                }
              }
              //drawBlockDamageOverlay(tx, ty, id, x, y);
              continue;
            }

            if (id === MANNEQUIN_BLOCK_ID) {
              const mannequinImageDrawn = drawBlockImage(def, x, y);
              if (!mannequinImageDrawn) {
                ctx.fillStyle = "rgba(25, 32, 41, 0.45)";
                ctx.fillRect(x + 7, y + TILE - 5, TILE - 14, 3);
                ctx.fillStyle = "rgba(246, 238, 228, 0.35)";
                ctx.fillRect(x + 9, y + 5, TILE - 18, TILE - 13);
              }
              const mannequin = typeof getLocalMannequinOutfit === "function"
                ? getLocalMannequinOutfit(tx, ty)
                : null;
              const outfit = mannequin && mannequin.equippedCosmetics && typeof mannequin.equippedCosmetics === "object"
                ? mannequin.equippedCosmetics
                : {};
              const mannequinPx = x + Math.round((TILE - PLAYER_W) / 2);
              const mannequinPy = y + Math.max(0, TILE - PLAYER_H - 1);
              const mannequinFacing = 1;
              const mannequinPose = {
                bodyBob: 0,
                bodyTilt: 0,
                wingFlap: 0,
                wingOpen: 0.2,
                swordSwing: 0,
                eyeYOffset: 0,
                eyeHeight: 3,
                armSwing: 0,
                legSwing: 0,
                hitStrength: 0,
                hitMode: "",
                hitDirectionY: 0
              };
              ctx.save();
              ctx.globalAlpha = 0.96;
              drawWings(mannequinPx, mannequinPy, String(outfit.wings || ""), mannequinFacing, 0, 0.2);
              drawHumanoid(
                mannequinPx,
                mannequinPy,
                mannequinFacing,
                "#4d5868",
                "#b98a78",
                "#0d0d0d",
                String(outfit.shirts || ""),
                String(outfit.pants || ""),
                String(outfit.shoes || ""),
                String(outfit.hats || ""),
                mannequinPose,
                0.75,
                0
              );
              drawSword(mannequinPx, mannequinPy, String(outfit.swords || ""), mannequinFacing, 0, 0, 0);
              ctx.restore();
              //drawBlockDamageOverlay(tx, ty, id, x, y);
              continue;
            }

            if (id === SIGN_ID && drawBlockImage(def, x, y)) {
              //drawBlockDamageOverlay(tx, ty, id, x, y);
              continue;
            }

            if (id === VENDING_ID) {
              if (drawBlockImage(def, x, y)) {
                //drawBlockDamageOverlay(tx, ty, id, x, y);
                drawVendingWorldLabel(tx, ty, x, y);
                continue;
              }
              ctx.fillStyle = "#4d6b8b";
              ctx.fillRect(x, y, TILE, TILE);
              ctx.fillStyle = "rgba(255,255,255,0.12)";
              ctx.fillRect(x + 3, y + 3, TILE - 6, 8);
              ctx.fillStyle = "#9cd8ff";
              ctx.fillRect(x + 6, y + 14, TILE - 12, 10);
              ctx.fillStyle = "#ffd166";
              ctx.fillRect(x + TILE - 10, y + 6, 4, 4);
              //drawBlockDamageOverlay(tx, ty, id, x, y);
              drawVendingWorldLabel(tx, ty, x, y);
              continue;
            }

            if (id === WATER_ID && drawAnimatedWater(def, x, y, tx, ty)) {
              //drawBlockDamageOverlay(tx, ty, id, x, y);
              continue;
            }

            if (drawBlockImage(def, x, y)) {
              //drawBlockDamageOverlay(tx, ty, id, x, y);
              continue;
            }

            drawFallbackBlockTile(def, id, x, y, tx, ty);
            //drawBlockDamageOverlay(tx, ty, id, x, y);
          }
        }
      }

      function drawBlockImageInWorld(def, x, y)
      {
        const DROP_RENDER_SCALE = 0.65;
        const img = getBlockImage(def);
        if (!img) return false;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const size = TILE * DROP_RENDER_SCALE;
        const offset = (TILE - size) / 2;
        ctx.drawImage(img, x + offset, y + offset, size, size);
        ctx.restore();
        return true;
      }

      function drawWorldDrops() {
        if (!worldDrops.size) return;
        const viewW = getCameraViewWidth();
        const viewH = getCameraViewHeight();
        const now = performance.now();
        
        worldDrops.forEach((drop) => {
          if (!drop) return;
          const x = drop.x - cameraX;
          const y = drop.y - cameraY + Math.sin((now + drop.id.length * 91) * 0.005) * 1.5;
          if (x < -TILE || y < -TILE || x > viewW + TILE || y > viewH + TILE) return;
          if (drop.type === "tool") {
            ctx.save();
            ctx.fillStyle = drop.toolId === TOOL_WRENCH ? "#89a4b4" : "#c59b81";
            ctx.fillRect(x, y, TILE, TILE);
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
            ctx.fillStyle = "rgba(12,20,30,0.8)";
            ctx.font = "bold 11px 'Trebuchet MS', sans-serif";
            ctx.fillText(drop.toolId === TOOL_WRENCH ? "W" : "F", x + 7, y + 12);
            ctx.restore();
          } else if (drop.type === "block") {
            const def = blockDefs[drop.blockId];

            if (def && drawBlockImageInWorld(def, x, y)) {
              // draw count badge
            } else {
              drawFallbackBlockInWorld(def, drop.blockId, x, y);
            }
          } else {
            let drawn = false;
            for (let i = 0; i < COSMETIC_ITEMS.length; i++) {
              const item = COSMETIC_ITEMS[i];
              if (!item || item.id !== drop.cosmeticId) continue;
              drawn = drawCosmeticSprite(item, x + 2, y + 2, TILE - 4, TILE - 4, 1);
              if (!drawn) {
                ctx.save();
                ctx.fillStyle = item.color || "#9bb4ff";
                const size = TILE * 0.65;
                const offset = (TILE - size) / 2;

                ctx.fillRect(x + offset, y + offset, size, size);
                ctx.restore();
              }
              break;
            }
          }
          if (drop.amount > 1) {
            ctx.save();
            ctx.font = "11px 'Trebuchet MS', sans-serif";
            const label = "x" + drop.amount;
            const labelW = ctx.measureText(label).width + 8;
            ctx.fillStyle = "rgba(8, 22, 34, 0.85)";
            ctx.fillRect(x + TILE - labelW - 1, y + TILE - 14, labelW, 13);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
            ctx.strokeRect(x + TILE - labelW - 1, y + TILE - 14, labelW, 13);
            ctx.fillStyle = "#f7fbff";
            ctx.fillText(label, x + TILE - labelW + 3, y + TILE - 4);
            ctx.restore();
          }
        });
      }

      function drawSignTopText() {
        const ctrl = getSignController();
        if (!ctrl || typeof ctrl.drawTopText !== "function") return;
        ctrl.drawTopText(ctx);
      }

      function getCosmeticImage(item) {
        if (!item || !item.imagePath) return null;
        const key = String(item.imagePath);
        if (!cosmeticImageCache.has(key)) {
          const img = new Image();
          img.decoding = "async";
          img.src = key;
          cosmeticImageCache.set(key, img);
        }
        const img = cosmeticImageCache.get(key);
        if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;
        return img;
      }

      function getBlockImage(def) {
        if (!def || !def.imagePath) return null;
        const key = String(def.imagePath);
        if (!blockImageCache.has(key)) {
          const img = new Image();
          img.decoding = "async";
          img.src = key;
          blockImageCache.set(key, img);
        }
        const img = blockImageCache.get(key);
        if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;
        return img;
      }

      function getBlockImageByPath(path) {
        const key = String(path || "").trim();
        if (!key) return null;
        if (!blockImageCache.has(key)) {
          const img = new Image();
          img.decoding = "async";
          img.src = key;
          blockImageCache.set(key, img);
        }
        const img = blockImageCache.get(key);
        if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;
        return img;
      }

      function buildWaterFramePaths(def) {
        if (!def || !def.imagePath) return [];
        const explicit = Array.isArray(SETTINGS.WATER_FRAME_PATHS)
          ? SETTINGS.WATER_FRAME_PATHS.map((x) => String(x || "").trim()).filter(Boolean)
          : [];
        if (explicit.length >= 4) {
          return explicit.slice(0, 4);
        }
        const base = String(def.imagePath).trim();
        const extIdx = base.lastIndexOf(".");
        const hasExt = extIdx > 0;
        const stem = hasExt ? base.slice(0, extIdx) : base;
        const ext = hasExt ? base.slice(extIdx) : "";
        const underscored = [1, 2, 3, 4].map((i) => stem + "_" + i + ext);
        const numbered = [1, 2, 3, 4].map((i) => stem + i + ext);
        const candidates = [];
        for (const p of underscored.concat(numbered)) {
          if (!candidates.includes(p) && p !== base) candidates.push(p);
        }
        return candidates.slice(0, 8);
      }

      function getWaterFrameImages(def) {
        if (!waterFramePathCache.length) {
          const paths = buildWaterFramePaths(def);
          for (const p of paths) waterFramePathCache.push(p);
        }
        const ready = [];
        for (const p of waterFramePathCache) {
          const img = getBlockImageByPath(p);
          if (img) ready.push(img);
          if (ready.length >= 4) break;
        }
        return ready;
      }

      function drawAnimatedWater(def, x, y, tx, ty) {
        const frames = getWaterFrameImages(def);
        if (!frames.length) return false;
        if (frames.length === 1) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(frames[0], x, y, TILE, TILE);
          ctx.restore();
          return true;
        }
        const now = performance.now();
        const phaseOffset = ((tx * 31 + ty * 17) % 997) / 997;
        const animPos = ((now / WATER_FRAME_MS) + phaseOffset) % frames.length;
        const i0 = Math.floor(animPos) % frames.length;
        const i1 = (i0 + 1) % frames.length;
        const blend = animPos - Math.floor(animPos);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1 - blend;
        ctx.drawImage(frames[i0], x, y, TILE, TILE);
        ctx.globalAlpha = blend;
        ctx.drawImage(frames[i1], x, y, TILE, TILE);
        ctx.restore();
        return true;
      }

      function getVendingWorldLabel(tx, ty) {
        const ctrl = getVendingController();
        if (!ctrl || typeof ctrl.getLocal !== "function") return "";
        const vm = ctrl.getLocal(tx, ty);
        if (!vm) return "";
        const qty = Math.max(1, Math.floor(Number(vm.sellQuantity) || 1));
        const price = Math.max(0, Math.floor(Number(vm.priceLocks) || 0));
        let itemName = "";
        if (String(vm.sellType || "") === "cosmetic") {
          const cosmeticId = String(vm.sellCosmeticId || "").trim();
          let cosmeticItem = null;
          if (cosmeticId) {
            for (let i = 0; i < COSMETIC_ITEMS.length; i++) {
              const item = COSMETIC_ITEMS[i];
              if (item && item.id === cosmeticId) {
                cosmeticItem = item;
                break;
              }
            }
          }
          itemName = cosmeticItem && cosmeticItem.name ? cosmeticItem.name : cosmeticId;
        } else {
          const blockId = Math.max(0, Math.floor(Number(vm.sellBlockId) || 0));
          const itemDef = blockDefs[blockId];
          itemName = itemDef && itemDef.name ? itemDef.name : "";
        }
        if (!itemName || price <= 0) return "Unconfigured";
        return itemName + " x" + qty + " / " + price + " WL";
      }

      function drawVendingWorldLabel(tx, ty, x, y) {
        const label = getVendingWorldLabel(tx, ty);
        if (!label) return;
        const playerTx = Math.floor((player.x + PLAYER_W / 2) / TILE);
        const playerTy = Math.floor((player.y + PLAYER_H / 2) / TILE);
        if (playerTx !== tx || playerTy !== ty) return;
        ctx.save();
        ctx.font = "10px 'Trebuchet MS', sans-serif";
        const maxWidth = 138;
        const lines = wrapChatText(label, maxWidth - 8).slice(0, 2);
        let textW = 0;
        for (let i = 0; i < lines.length; i++) {
          textW = Math.max(textW, ctx.measureText(lines[i]).width);
        }
        const bubbleW = Math.max(52, Math.min(maxWidth, Math.ceil(textW) + 8));
        const bubbleH = lines.length * 12 + 6;
        let bx = x + Math.floor((TILE - bubbleW) / 2);
        const by = y - bubbleH - 4;
        const viewW = getCameraViewWidth();
        if (bx < 4) bx = 4;
        if (bx + bubbleW > viewW - 4) bx = viewW - 4 - bubbleW;
        ctx.fillStyle = "rgba(8, 22, 34, 0.86)";
        ctx.fillRect(bx, by, bubbleW, bubbleH);
        ctx.strokeStyle = "rgba(255,255,255,0.26)";
        ctx.strokeRect(bx + 0.5, by + 0.5, bubbleW - 1, bubbleH - 1);
        ctx.fillStyle = "#f4fbff";
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], bx + 4, by + 11 + i * 12);
        }
        ctx.restore();
      }

      function drawBlockImage(def, x, y) {
        const img = getBlockImage(def);
        if (!img) return false;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x, y, TILE, TILE);
        ctx.restore();
        return true;
      }

      function drawStairImage(id, def, x, y) {
        const baseDef = blockDefs[STAIR_BASE_ID] || def;
        const img = getBlockImage(baseDef) || getBlockImage(def);
        if (!img) return false;
        // Base orientation is NW (id 13). Rotated stairs mirror this texture.
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(x + TILE * 0.5, y + TILE * 0.5);
        if (id === 14) {
          ctx.scale(-1, 1);
        } else if (id === 15) {
          ctx.scale(-1, -1);
        } else if (id === 16) {
          ctx.scale(1, -1);
        }
        ctx.drawImage(img, -TILE * 0.5, -TILE * 0.5, TILE, TILE);
        ctx.restore();
        return true;
      }

      function drawSpikeImage(id, def, x, y) {
        const baseDef = blockDefs[SPIKE_BASE_ID] || def;
        const img = getBlockImage(baseDef) || getBlockImage(def);
        if (!img) return false;
        const idx = SPIKE_ROTATION_IDS.indexOf(id);
        const angle = idx >= 0 ? (idx * Math.PI / 2) : 0;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(x + TILE * 0.5, y + TILE * 0.5);
        if (angle !== 0) ctx.rotate(angle);
        ctx.drawImage(img, -TILE * 0.5, -TILE * 0.5, TILE, TILE);
        ctx.restore();
        return true;
      }

      function drawTreePlant(tx, ty, x, y) {
        const ctrl = getPlantsController();
        if (!ctrl || typeof ctrl.drawTree !== "function") return;
        ctrl.drawTree(ctx, tx, ty, x, y, TILE);
        const plant = getLocalTreePlant(tx, ty);
        if (!plant || typeof ctrl.getGrowthState !== "function") return;
        const growth = ctrl.getGrowthState(plant);
        if (!growth) return;
        const fruitCount = resolvePlantFruitAmount(plant);
        const fruitBlockId = Math.max(1, Math.floor(Number(plant.yieldBlockId) || TREE_YIELD_BLOCK_ID));
        const fruitDef = blockDefs[fruitBlockId] || null;
        if (growth.mature) {
          const cols = 3;
          const rows = Math.ceil(fruitCount / cols);
          const cell = 8;
          const gap = 2;
          const gridW = cols * cell + (cols - 1) * gap;
          const gridH = rows * cell + (rows - 1) * gap;
          const label = "x" + fruitCount;
          ctx.save();
          ctx.font = "bold 11px 'Trebuchet MS', sans-serif";
          const labelW = Math.ceil(ctx.measureText(label).width);
          const boxW = Math.max(gridW + 8, labelW + 10);
          const boxH = gridH + 22;
          let bx = x + Math.floor((TILE - boxW) / 2);
          const by = y - boxH - 8;
          const viewW = getCameraViewWidth();
          if (bx < 4) bx = 4;
          if (bx + boxW > viewW - 4) bx = viewW - 4 - boxW;
          ctx.fillStyle = "rgba(8, 22, 34, 0.9)";
          ctx.fillRect(bx, by, boxW, boxH);
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);
          ctx.fillStyle = "#f7fbff";
          ctx.fillText(label, bx + Math.floor((boxW - labelW) / 2), by + 11);
          const gx = bx + Math.floor((boxW - gridW) / 2);
          const gy = by + 14;
          for (let i = 0; i < fruitCount; i++) {
            const cx = i % cols;
            const cy = Math.floor(i / cols);
            const px = gx + cx * (cell + gap);
            const py = gy + cy * (cell + gap);
            ctx.fillStyle = fruitDef && fruitDef.color ? fruitDef.color : "#67c95a";
            ctx.fillRect(px, py, cell, cell);
            ctx.strokeStyle = "rgba(255,255,255,0.35)";
            ctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
          }
          ctx.restore();
          return;
        }
        const playerTx = Math.floor((player.x + PLAYER_W / 2) / TILE);
        const playerTy = Math.floor((player.y + PLAYER_H / 2) / TILE);
        if (playerTx !== tx || playerTy !== ty) return;
        const growMs = Math.max(1, Math.floor(Number(plant.growMs) || TREE_GROW_MS));
        const plantedAt = Math.max(0, Math.floor(Number(plant.plantedAt) || 0));
        const remainingMs = Math.max(0, (plantedAt + growMs) - Date.now());
        const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
        const label = "Grow: " + remainingSec + "s";
        ctx.save();
        ctx.font = "11px 'Trebuchet MS', sans-serif";
        const w = Math.ceil(ctx.measureText(label).width) + 10;
        const h = 15;
        let bx = x + Math.floor((TILE - w) / 2);
        const by = y - h - 4;
        const viewW = getCameraViewWidth();
        if (bx < 4) bx = 4;
        if (bx + w > viewW - 4) bx = viewW - 4 - w;
        ctx.fillStyle = "rgba(8, 22, 34, 0.88)";
        ctx.fillRect(bx, by, w, h);
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
        ctx.fillStyle = "#f7fbff";
        ctx.fillText(label, bx + 5, by + 11);
        ctx.restore();
      }

      function drawCosmeticSprite(item, x, y, w, h, facing, opts) {
        const img = getCosmeticImage(item);
        if (!img) return false;
        const options = opts && typeof opts === "object" ? opts : {};
        const mode = options.mode === "fill" ? "fill" : "contain";
        const alignX = Math.max(0, Math.min(1, Number(options.alignX)));
        const alignY = Math.max(0, Math.min(1, Number(options.alignY)));
        const useAlignX = Number.isFinite(alignX) ? alignX : 0.5;
        const useAlignY = Number.isFinite(alignY) ? alignY : 0.5;
        let drawX = x;
        let drawY = y;
        let drawW = w;
        let drawH = h;
        if (mode === "contain") {
          const iw = Math.max(1, img.naturalWidth || 1);
          const ih = Math.max(1, img.naturalHeight || 1);
          const scale = Math.min(w / iw, h / ih);
          drawW = Math.max(1, iw * scale);
          drawH = Math.max(1, ih * scale);
          drawX = x + (w - drawW) * useAlignX;
          drawY = y + (h - drawH) * useAlignY;
        }
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const shadowColor = String(options.shadowColor || "").trim();
        const shadowBlur = Math.max(0, Number(options.shadowBlur) || 0);
        const shadowOffsetY = Number(options.shadowOffsetY) || 0;
        if (shadowBlur > 0 && shadowColor) {
          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = shadowBlur;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = shadowOffsetY;
        }
        if (facing === -1) {
          const pivot = drawX + drawW / 2;
          ctx.translate(pivot, 0);
          ctx.scale(-1, 1);
          ctx.translate(-pivot, 0);
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();
        return true;
      }


      // COSMETICS
      function getCosmeticRender(slot, item) {
        const slotDefaults = {
          shirts: { x: 4, y: 12, w: 14, h: 10, mode: "contain", alignX: 0.5, alignY: 0.5, mirror: false },
          pants: { x: 5, y: 21, w: 12, h: 8, mode: "contain", alignX: 0.5, alignY: 0.5, mirror: false },
          shoes: { y: 26, w: 6, h: 4, leftX: 5, rightX: 13, mode: "contain", alignX: 0.5, alignY: 1, mirror: true },
          hats: { x: 1, y: -8, w: 20, h: 10, mode: "contain", alignX: 0.5, alignY: 1, mirror: true },
          // Golden Angel style baseline offsets for every wing by default.
          wings: { offsetX: 4, offsetY: -3, wingH: 19, mode: "contain", alignX: 0.5, alignY: 0.5, mirror: true }
        };
        const base = slotDefaults[slot] && typeof slotDefaults[slot] === "object" ? slotDefaults[slot] : {};
        const custom = item && item.render && typeof item.render === "object" ? item.render : {};
        return {
          ...base,
          ...custom
        };
      }

      function getCosmeticShadowColor(item, fallbackColor) {
        const fx = item && item.fx && typeof item.fx === "object" ? item.fx : null;
        if (fx && typeof fx.glowColor === "string" && fx.glowColor.trim()) {
          return fx.glowColor.trim();
        }
        if (typeof fallbackColor === "string" && fallbackColor.trim()) return fallbackColor.trim();
        return "rgba(8, 18, 28, 0.32)";
      }

      function drawSlotCosmetic(slot, item, px, py, facing) {
        if (!item) return false;
        const render = getCosmeticRender(slot, item);
        const x = px + (Number(render.x) || 0);
        const y = py + (Number(render.y) || 0);
        const w = Math.max(1, Number(render.w) || 1);
        const h = Math.max(1, Number(render.h) || 1);
        const mirror = render.mirror !== false;
        const drawFacing = mirror ? (facing === -1 ? -1 : 1) : 1;
        const shadowColor = getCosmeticShadowColor(item);
        return drawCosmeticSprite(item, x, y, w, h, drawFacing, {
          mode: render.mode === "fill" ? "fill" : "contain",
          alignX: Number.isFinite(Number(render.alignX)) ? Number(render.alignX) : 0.5,
          alignY: Number.isFinite(Number(render.alignY)) ? Number(render.alignY) : 0.5,
          shadowColor,
          shadowBlur: 2,
          shadowOffsetY: 0.4
        });
      }

      function drawWings(px, py, wingsId, facing, wingFlap, wingOpen) {
        if (!wingsId) return;
        const item = COSMETIC_LOOKUP.wings[wingsId];
        if (!item) return;
        const render = getCosmeticRender("wings", item);
        const flap = Number(wingFlap) || 0;
        const open = Math.max(0, Math.min(1, Number(wingOpen) || 0));
        const upStroke = Math.max(0, -flap);
        const downStroke = Math.max(0, flap);
        const flapStroke = (downStroke * 1.2) - (upStroke * 0.8);
        const wingImg = getCosmeticImage(item);
        if (wingImg) {
          const centerX = px + PLAYER_W / 2;
          const centerY = py + 17.5;
          const baseAngle = 0.2 + open * 0.34;
          const wingH = Math.max(8, Number(render.wingH) || Number(render.h) || 19);
          const wingW = Math.max(10, Math.round(wingH * (wingImg.naturalWidth / Math.max(1, wingImg.naturalHeight))));
          const useOffsetX = Number.isFinite(Number(render.offsetX)) ? Number(render.offsetX) : 4;
          const useOffsetY = Number.isFinite(Number(render.offsetY)) ? Number(render.offsetY) : -3;
          const shadowColor = getCosmeticShadowColor(item, "rgba(12, 24, 40, 0.34)");
          const drawWingSide = (sideSign) => {
            const angle = (sideSign * baseAngle) - (sideSign * flapStroke * 1.2);
            ctx.save();
            ctx.translate(centerX + sideSign * (1.5 + useOffsetX), centerY + useOffsetY);
            ctx.rotate(angle);
            if (sideSign < 0) ctx.scale(-1, 1);
            ctx.imageSmoothingEnabled = false;
            ctx.shadowColor = shadowColor;
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0.6;
            // Wing sprite attach point is left edge of image.
            ctx.drawImage(wingImg, 0, -wingH / 2, wingW, wingH);
            ctx.restore();
          };
          drawWingSide(-1);
          drawWingSide(1);
          return;
        }
        ctx.fillStyle = item.color;
        const centerX = px + PLAYER_W / 2;
        const centerY = py + 17.5;
        const forwardSign = facing === 1 ? 1 : -1;
        const drawWing = (sideSign) => {
          const dir = sideSign * forwardSign;
          const base = (0.24 + open * 0.34) * sideSign;
          const angle = base - (sideSign * flapStroke);
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(16 * dir, -7);
          ctx.lineTo(23 * dir, 2);
          ctx.lineTo(17 * dir, 11);
          ctx.lineTo(4 * dir, 9);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        };
        drawWing(-1);
        drawWing(1);
      }

      function drawShirt(px, py, shirtId) {
        if (!shirtId) return;
        const item = COSMETIC_LOOKUP.shirts && COSMETIC_LOOKUP.shirts[shirtId];
        if (!item) return;
        if (drawSlotCosmetic("shirts", item, px, py, 1)) {
          return;
        }
        ctx.fillStyle = item.color;
        ctx.fillRect(px + 5, py + 12, PLAYER_W - 10, 10);
      }

      function drawPants(px, py, pantsId) {
        if (!pantsId) return;
        const item = COSMETIC_LOOKUP.pants && COSMETIC_LOOKUP.pants[pantsId];
        if (!item) return;
        if (drawSlotCosmetic("pants", item, px, py, 1)) {
          return;
        }
        ctx.fillStyle = item.color || "#7e92a3";
        ctx.fillRect(px + 6, py + 22, 4, 7);
        ctx.fillRect(px + PLAYER_W - 10, py + 22, 4, 7);
      }

      function drawShoes(px, py, shoesId, facing) {
        if (!shoesId) return;
        const item = COSMETIC_LOOKUP.shoes && COSMETIC_LOOKUP.shoes[shoesId];
        if (!item) return;
        const render = getCosmeticRender("shoes", item);
        const leftX = px + (Number(render.leftX) || 5);
        const rightX = px + (Number(render.rightX) || 11);
        const shoeY = py + (Number(render.y) || 26);
        const shoeW = Math.max(1, Number(render.w) || 6);
        const shoeH = Math.max(1, Number(render.h) || 4);
        const facingSign = render.mirror === false ? 1 : (facing === -1 ? -1 : 1);
        const sharedOpts = {
          mode: render.mode === "fill" ? "fill" : "contain",
          alignX: Number.isFinite(Number(render.alignX)) ? Number(render.alignX) : 0.5,
          alignY: Number.isFinite(Number(render.alignY)) ? Number(render.alignY) : 1,
          shadowColor: getCosmeticShadowColor(item),
          shadowBlur: 2,
          shadowOffsetY: 0.4
        };
        const drewLeft = drawCosmeticSprite(item, leftX, shoeY, shoeW, shoeH, facingSign, sharedOpts);
        const drewRight = drawCosmeticSprite(item, rightX, shoeY, shoeW, shoeH, facingSign, sharedOpts);
        if (drewLeft || drewRight) return;
        ctx.fillStyle = item.color || "#5f5f6a";
        ctx.fillRect(leftX + 1, shoeY + 1, shoeW - 1, shoeH - 1);
        ctx.fillRect(rightX + 1, shoeY + 1, shoeW - 1, shoeH - 1);
      }

      function drawHat(px, py, hatId, facing) {
        if (!hatId) return;
        const item = COSMETIC_LOOKUP.hats && COSMETIC_LOOKUP.hats[hatId];
        if (!item) return;
        if (drawSlotCosmetic("hats", item, px, py, facing)) {
          return;
        }
        ctx.fillStyle = item.color || "#d7c7a3";
        ctx.fillRect(px + 3, py - 2, PLAYER_W - 6, 2);
      }

      function drawSword(px, py, swordId, facing, swordSwing, hitDirectionY, hitStrength) {
        if (!swordId) return;
        const item = COSMETIC_LOOKUP.swords[swordId];
        if (!item) return;
        
        const pivotX = facing === 1 ? (px + 2 + 1) : (px + PLAYER_W - 5 + 1);
        const pivotY = py + 13 + 1;
        let handX, handY, angle;

        if (Number(hitStrength) > 0) {
          const targetRotation = facing * (-Math.PI / 2 + (Number(hitDirectionY) || 0) * Math.PI / 4);
          const rotation = targetRotation * Number(hitStrength);
          handX = pivotX - Math.sin(rotation) * 7;
          handY = pivotY + Math.cos(rotation) * 7;
          angle = (Number(hitDirectionY) || 0) * (Math.PI / 4) * Number(hitStrength);
        } else {
          const facingSign = facing === 1 ? 1 : -1;
          const swing = (Number(swordSwing) || 0) * facingSign;
          const armSwing = Math.max(-4, Math.min(4, swing * 0.18));
          handX = facing === 1 ? (px + 3) : (px + PLAYER_W - 3);
          handY = py + 20 + armSwing;
          const baseAngle = 0;
          const slash = Math.max(-1.2, Math.min(1.2, swing * 0.12));
          angle = baseAngle + slash;
        }
        
        const bladeW = 12;
        const bladeH = 8;

        ctx.save();
        ctx.translate(handX, handY);
        if (facing === -1) ctx.scale(-1, 1);
        ctx.rotate(angle);
        const img = getCosmeticImage(item);
        if (img) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, -bladeH / 2, bladeW, bladeH);
          ctx.restore();
          return;
        }
        ctx.fillStyle = item.color;
        ctx.fillRect(0, -1.5, 9, 3);
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillRect(6, -1, 4, 2);
        ctx.restore();
      }
      // CHARACTER
      function drawHumanoid(px, py, facing, bodyColor, skinColor, eyeColor, shirtId, pantsId, shoesId, hatId, pose, lookX, lookY) {
        function fillChamferRect(x, y, w, h, color) {
          const rx = Math.round(x);
          const ry = Math.round(y);
          const rw = Math.max(2, Math.round(w));
          const rh = Math.max(2, Math.round(h));
          ctx.fillStyle = color;
          if (rw <= 3 || rh <= 3) {
            ctx.fillRect(rx, ry, rw, rh);
            return;
          }
          ctx.fillRect(rx + 1, ry, rw - 2, 1);
          ctx.fillRect(rx, ry + 1, rw, rh - 2);
          ctx.fillRect(rx + 1, ry + rh - 1, rw - 2, 1);
        }

        const armSwing = Number(pose && pose.armSwing) || 0;
        const legSwing = Number(pose && pose.legSwing) || 0;
        const hitStrength = Math.max(0, Math.min(1, Number(pose && pose.hitStrength) || 0));
        const hitMode = String(pose && pose.hitMode || "");
        const hitDirectionY = Number(pose && pose.hitDirectionY) || 0;
        const attackWithLeftArm = hitMode === "sword" ? (facing === 1) : (facing === -1);
        const attackWithRightArm = !attackWithLeftArm;
        let leftArmY = py + 13 + Math.round(-armSwing * 0.6);
        let rightArmY = py + 13 + Math.round(armSwing * 0.6);
        if (hitStrength > 0) {
          // Keep the non-attacking hand stable during attack frames.
          if (!attackWithLeftArm) leftArmY = py + 13;
          if (!attackWithRightArm) rightArmY = py + 13;
        }
        const leftLegY = py + 23 + Math.round(-legSwing * 0.75);
        const rightLegY = py + 23 + Math.round(legSwing * 0.75);
        const faceTilt = facing === 1 ? 1 : -1;

        // Growtopia-like blocky proportions.
        const headX = px + 2;
        const headY = py;
        const headW = PLAYER_W - 4;
        const headH = 12;
        const torsoX = px + 5;
        const torsoY = py + 12;
        const torsoW = PLAYER_W - 10;
        const torsoH = 8;

        fillChamferRect(headX, headY, headW, headH, skinColor);
        fillChamferRect(torsoX, torsoY, torsoW, torsoH, skinColor);
        let leftArmX = px + 2;
        let rightArmX = px + PLAYER_W - 5;
        if (hitStrength > 0) {
          const forward = Math.round((hitMode === "fist" ? 4 : 2) * hitStrength) * (facing === 1 ? 1 : -1);
          if (attackWithLeftArm) leftArmX += forward;
          if (attackWithRightArm) rightArmX += forward;
        }

        const drawArmRect = (x, y, isAttackArm) => {
          if (hitStrength > 0 && isAttackArm) {
            const pivotX = x + 1.5;
            const pivotY = y + 1;
            const targetRotation = facing * (-Math.PI / 2 + (hitDirectionY * Math.PI / 4));
            const rotation = targetRotation * hitStrength;
            ctx.save();
            ctx.translate(pivotX, pivotY);
            ctx.rotate(rotation);
            ctx.translate(-pivotX, -pivotY);
            fillChamferRect(x, y, 3, 8, skinColor);
            if (hitMode === "fist" && hitStrength > 0.05) {
              const fistY = y + 5;
              const fistX = facing === 1 ? (x + 2) : (x - 2);
              fillChamferRect(fistX, fistY, 3, 3, skinColor);
            }
            ctx.restore();
          } else {
            fillChamferRect(x, y, 3, 8, skinColor);
          }
        };

        drawArmRect(leftArmX, leftArmY, attackWithLeftArm);
        drawArmRect(rightArmX, rightArmY, attackWithRightArm);

        fillChamferRect(px + 6, leftLegY, 4, 7, skinColor);
        fillChamferRect(px + PLAYER_W - 10, rightLegY, 4, 7, skinColor);

        drawShirt(px, py, shirtId);
        drawPants(px, py, pantsId);
        drawShoes(px, py, shoesId, facing);
        drawHat(px, py, hatId, facing);
        if (hitStrength > 0) {
          if (attackWithLeftArm) drawArmRect(leftArmX, leftArmY, true);
          if (attackWithRightArm) drawArmRect(rightArmX, rightArmY, true);
        }

        ctx.fillStyle = "rgba(0,0,0,0.14)";
        ctx.fillRect(headX + 1, headY + 1, headW - 2, 1);
        ctx.fillRect(torsoX + 1, torsoY - 1, torsoW - 2, 1);
        ctx.fillRect(torsoX + 1, torsoY + torsoH, torsoW - 2, 1);

        // Eyes are offset by facing direction (no mouse-follow wobble).
        const faceOffset = faceTilt > 0 ? 1 : -1;
        const leftEyeX = px + 5 + faceOffset;
        const rightEyeX = px + PLAYER_W - 11 + faceOffset;
        const eyeY = py + 3;
        ctx.fillStyle = "#f3f6ff";
        ctx.fillRect(leftEyeX, eyeY, 5, 4);
        ctx.fillRect(rightEyeX, eyeY, 5, 4);

        ctx.fillStyle = eyeColor;
        const pupilOffset = faceTilt > 0 ? 1 : 0;
        ctx.fillRect(leftEyeX + 1 + pupilOffset, eyeY + 1, 2, 2);
        ctx.fillRect(rightEyeX + 1 + pupilOffset, eyeY + 1, 2, 2);

        const mouthX = px + 8 + faceOffset;
        const mouthY = py + 9;
        ctx.fillStyle = "rgba(85, 52, 43, 0.95)";
        ctx.fillRect(mouthX, mouthY, 5, 1);
        ctx.fillRect(mouthX + 1, mouthY + 1, 3, 1);

        const noseX = faceTilt > 0 ? px + 13 : px + 6;
        ctx.fillStyle = "rgba(124, 84, 66, 0.9)";
        ctx.fillRect(noseX, py + 7, 2, 2);

        // Small head shading for pixel depth similar to GT style.
        ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
        if (faceTilt > 0) {
          ctx.fillRect(headX + headW - 1, headY + 1, 1, headH - 2);
        } else {
          ctx.fillRect(headX, headY + 1, 1, headH - 2);
        }

        return {};
      }

      function getLocalLookVector() {
        return {
          x: player.facing === -1 ? -0.75 : 0.75,
          y: 0
        };
      }

      function getRemoteLookVector(other) {
        return {
          x: (other && other.facing === -1) ? -0.75 : 0.75,
          y: 0
        };
      }

      function normalizeAdminRoleForRender(roleRaw) {
        if (typeof normalizeAdminRole === "function") {
          return normalizeAdminRole(roleRaw);
        }
        const safeRole = String(roleRaw || "").trim().toLowerCase();
        return safeRole && safeRole !== "none" ? safeRole : "none";
      }

      function getDisplayNameWithAdminPrefix(rawName, roleRaw) {
        const baseName = String(rawName || "Player").slice(0, 20);
        if (!baseName) return "Player";
        const safeRole = normalizeAdminRoleForRender(roleRaw);
        if (safeRole !== "none" && baseName.charAt(0) !== "@") {
          return "@" + baseName;
        }
        return baseName;
      }

      function drawPlayer() {
        localPlayerWrenchHitbox.length = 0;
        const nowMs = performance.now();
        const px = Math.round(player.x - cameraX);
        const py = Math.round(player.y - cameraY);
        const cosmetics = equippedCosmetics;
        const localMotion = typeof animationsModule.sampleLocal === "function"
          ? animationsModule.sampleLocal(player, nowMs)
          : { speed: Math.abs(player.vx), vy: player.vy, grounded: player.grounded };
        const pose = typeof animationsModule.buildPose === "function"
          ? animationsModule.buildPose(localMotion, nowMs, playerId)
          : { bodyBob: 0, bodyTilt: 0, wingFlap: 0, wingOpen: 0.24, swordSwing: 0, eyeYOffset: 0, eyeHeight: 3 };
        if (danceUntilMs > Date.now()) {
          const danceT = nowMs * 0.015;
          pose.bodyBob = (Number(pose.bodyBob) || 0) + Math.sin(danceT * 1.6) * 1.6;
          pose.bodyTilt = (Number(pose.bodyTilt) || 0) + Math.sin(danceT) * 0.18;
          pose.armSwing = (Number(pose.armSwing) || 0) + Math.sin(danceT * 2.3) * 3.6;
          pose.legSwing = (Number(pose.legSwing) || 0) + Math.cos(danceT * 2.3) * 2.8;
        }
        const hitT = Math.max(0, Math.min(1, 1 - ((nowMs - lastHitAtMs) / HIT_ANIM_MS)));
        if (hitT > 0) {
          const hitEase = hitT * hitT * (3 - 2 * hitT);
          const facingSign = player.facing === 1 ? 1 : -1;
          pose.bodyTilt = (Number(pose.bodyTilt) || 0) + facingSign * (0.07 * hitEase);
          pose.hitDirectionY = lastHitDirectionY;
          if (cosmetics.swords) {
            pose.hitMode = "sword";
            pose.hitStrength = hitEase;
            pose.armSwing = (Number(pose.armSwing) || 0) + facingSign * (1.1 * hitEase);
            pose.swordSwing = (Number(pose.swordSwing) || 0) + facingSign * (8.2 * hitEase);
          } else {
            pose.hitMode = "fist";
            pose.hitStrength = hitEase;
            pose.armSwing = (Number(pose.armSwing) || 0) + facingSign * (3.1 * hitEase);
            pose.swordSwing = 0;
          }
        } else {
          pose.hitMode = "";
          pose.hitStrength = 0;
        }
        // Pixel-snap body baseline to avoid subpixel jitter and slight ground clipping.
        const basePy = Math.round(py + (pose.bodyBob || 0) - 1);
        const localWingFlap = (pose.wingFlap || 0) + getWingFlapPulse(nowMs);
        const localWingOpen = Math.max(0, Math.min(1, Number(pose.wingOpen) || 0.24));

        drawWings(px, basePy, cosmetics.wings, player.facing, localWingFlap, localWingOpen);

        ctx.save();
        ctx.translate(px + PLAYER_W / 2, basePy + PLAYER_H / 2);
        ctx.rotate(Number(pose.bodyTilt) || 0);
        ctx.translate(-(px + PLAYER_W / 2), -(basePy + PLAYER_H / 2));

        const localLook = getLocalLookVector();
        drawHumanoid(px, basePy, player.facing, "#263238", "#b98a78", "#0d0d0d", cosmetics.shirts, cosmetics.pants, cosmetics.shoes, cosmetics.hats, pose, localLook.x, localLook.y);

        drawSword(px, basePy, cosmetics.swords, player.facing, pose.swordSwing || 0, pose.hitDirectionY, pose.hitStrength);
        ctx.restore();
        const titleDef = getEquippedTitleDef();
        const baseNameText = String(playerName || "Player").slice(0, 20);
        const localRole = typeof getAccountRole === "function"
          ? getAccountRole(playerProfileId || "", baseNameText)
          : currentAdminRole;
        const nameText = getDisplayNameWithAdminPrefix(baseNameText, localRole);
        const nameY = basePy - 8;
        ctx.font = PLAYER_NAME_FONT;
        const localTitleName = titleDef ? formatTitleWithUsername(titleDef.name, nameText) : "";
        const showLocalName = shouldShowNameAlongsideTitle(localTitleName, nameText)
          && shouldShowNameAlongsideTitle(localTitleName, baseNameText);
        const titleText = localTitleName ? (localTitleName + " ") : "";
        const localTitleStyle = normalizeTitleStyle(titleDef && titleDef.style);
        const titleWidth = titleText ? ctx.measureText(titleText).width : 0;
        const nameWidth = showLocalName ? ctx.measureText(nameText).width : 0;
        const totalWidth = titleWidth + nameWidth;
        let cursorX = Math.round(px + PLAYER_W / 2 - totalWidth / 2);
        if (titleDef) {
          const localGradientColors = Array.isArray(localTitleStyle.gradientColors) ? localTitleStyle.gradientColors : [];
          const localGradientColor = localGradientColors.length
            ? localGradientColors[Math.floor((nowMs * 0.006) % localGradientColors.length)]
            : (titleDef.color || "#8fb4ff");
          const titleColor = localTitleStyle.rainbow
            ? getRainbowTitleColor(nowMs)
            : (localTitleStyle.gradient ? localGradientColor : (titleDef.color || "#8fb4ff"));
          ctx.fillStyle = titleColor;
          if (localTitleStyle.bold) {
            ctx.font = "bold " + PLAYER_NAME_FONT;
          }
          if (localTitleStyle.glow) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = localTitleStyle.glowColor || titleColor;
          }
          ctx.fillText(titleText, cursorX, nameY);
          ctx.shadowBlur = 0;
          ctx.shadowColor = "transparent";
          ctx.font = PLAYER_NAME_FONT;
          cursorX += titleWidth;
        }
        if (showLocalName) {
          ctx.fillStyle = "#f3fbff";
          ctx.fillText(nameText, cursorX, nameY);
        }
        if (slotOrder[selectedSlot] === TOOL_WRENCH) {
          const textWidth = (cursorX - (Math.round(px + PLAYER_W / 2 - totalWidth / 2))) + nameWidth;
          const iconSize = 22 / cameraZoom;
          const iconX = Math.round(px + PLAYER_W / 2 - totalWidth / 2) + textWidth + (6 / cameraZoom);
          const iconY = nameY - (4 / cameraZoom) - (iconSize / 2);
          drawNameWrenchIcon(iconX, iconY, iconSize);
          localPlayerWrenchHitbox.push({
            x: iconX,
            y: iconY,
            w: iconSize,
            h: iconSize,
            accountId: playerProfileId || "local",
            name: nameText
          });
        }
      }

      function drawRemotePlayers() {
        const nowMs = performance.now();
        const nowEpoch = Date.now();
        const viewW = getCameraViewWidth();
        const viewH = getCameraViewHeight();
        const keepIds = [];
        playerWrenchHitboxes.length = 0;
        const wrenchSelected = slotOrder[selectedSlot] === TOOL_WRENCH;
        const visiblePlayers = [];
        remotePlayers.forEach((other) => {
          const otherId = (other.id || "").toString();
          keepIds.push(otherId);
          const px = Math.round(other.x - cameraX);
          const py = Math.round(other.y - cameraY);
          if (px < -40 || py < -40 || px > viewW + 40 || py > viewH + 40) return;
          const distance = Math.sqrt(px * px + py * py);
          visiblePlayers.push({ other, otherId, px, py, distance });
        });
        // Sort by distance and limit to 30 closest
        visiblePlayers.sort((a, b) => a.distance - b.distance);
        visiblePlayers.slice(0, 30).forEach(({ other, otherId, px, py }) => {
          const cosmetics = other.cosmetics || {};
          const remoteMotion = typeof animationsModule.sampleRemote === "function"
            ? animationsModule.sampleRemote(remoteAnimationTracker, otherId, other.x, other.y, nowMs)
            : { speed: 0, vy: 0, grounded: true };
          const pose = typeof animationsModule.buildPose === "function"
            ? animationsModule.buildPose(remoteMotion, nowMs, otherId)
            : { bodyBob: 0, bodyTilt: 0, wingFlap: 0, wingOpen: 0.24, swordSwing: 0, eyeYOffset: 0, eyeHeight: 3 };
          if ((Number(other.danceUntil) || 0) > nowEpoch) {
            const danceT = nowMs * 0.015;
            pose.bodyBob = (Number(pose.bodyBob) || 0) + Math.sin(danceT * 1.6) * 1.6;
            pose.bodyTilt = (Number(pose.bodyTilt) || 0) + Math.sin(danceT) * 0.18;
            pose.armSwing = (Number(pose.armSwing) || 0) + Math.sin(danceT * 2.3) * 3.6;
            pose.legSwing = (Number(pose.legSwing) || 0) + Math.cos(danceT * 2.3) * 2.8;
          }
          const basePy = Math.round(py + (pose.bodyBob || 0) - 1);

          drawWings(px, basePy, cosmetics.wings || "", other.facing || 1, pose.wingFlap || 0, pose.wingOpen || 0.24);

          ctx.save();
          ctx.translate(px + PLAYER_W / 2, basePy + PLAYER_H / 2);
          ctx.rotate(Number(pose.bodyTilt) || 0);
          ctx.translate(-(px + PLAYER_W / 2), -(basePy + PLAYER_H / 2));

          const remoteLook = getRemoteLookVector(other);
          drawHumanoid(px, basePy, other.facing || 1, "#2a75bb", "#b98a78", "#102338", cosmetics.shirts || "", cosmetics.pants || "", cosmetics.shoes || "", cosmetics.hats || "", pose, remoteLook.x, remoteLook.y);

          drawSword(px, basePy, cosmetics.swords || "", other.facing || 1, pose.swordSwing || 0, 0, 0);
          ctx.restore();

          const baseNameText = String(other.name || "Player").slice(0, 20);
          const remoteRole = typeof getAccountRole === "function"
            ? getAccountRole(other.accountId || "", baseNameText)
            : "none";
          const nameText = getDisplayNameWithAdminPrefix(baseNameText, remoteRole);
          const titleRaw = other && other.title && typeof other.title === "object" ? other.title : {};
          const fallbackTitle = getTitleDef(titleRaw.id || "");
          const rawRemoteTitle = String(titleRaw.name || (fallbackTitle && fallbackTitle.name) || "");
          const titleName = formatTitleWithUsername(rawRemoteTitle, nameText).slice(0, 24);
          const titleColor = String(titleRaw.color || (fallbackTitle && fallbackTitle.color) || "#8fb4ff").slice(0, 24);
          const remoteTitleStyle = normalizeTitleStyle(
            (titleRaw.style && typeof titleRaw.style === "object")
              ? titleRaw.style
              : (fallbackTitle && fallbackTitle.style)
          );
          const showRemoteName = shouldShowNameAlongsideTitle(titleName, nameText)
            && shouldShowNameAlongsideTitle(titleName, baseNameText);
          const nameY = basePy - 8;
          ctx.font = PLAYER_NAME_FONT;
          const titleText = titleName ? (titleName + " ") : "";
          const titleWidth = titleText ? ctx.measureText(titleText).width : 0;
          const nameWidth = showRemoteName ? ctx.measureText(nameText).width : 0;
          const totalWidth = titleWidth + nameWidth;
          const nameX = Math.round(px + PLAYER_W / 2 - totalWidth / 2);
          let cursorX = nameX;
          if (titleName) {
            const remoteGradientColors = Array.isArray(remoteTitleStyle.gradientColors) ? remoteTitleStyle.gradientColors : [];
            const remoteGradientColor = remoteGradientColors.length
              ? remoteGradientColors[Math.floor((nowMs * 0.006) % remoteGradientColors.length)]
              : (titleColor || "#8fb4ff");
            const styledColor = remoteTitleStyle.rainbow
              ? getRainbowTitleColor(nowMs)
              : (remoteTitleStyle.gradient ? remoteGradientColor : (titleColor || "#8fb4ff"));
            ctx.fillStyle = styledColor;
            if (remoteTitleStyle.bold) {
              ctx.font = "bold " + PLAYER_NAME_FONT;
            }
            if (remoteTitleStyle.glow) {
              ctx.shadowBlur = 10;
              ctx.shadowColor = remoteTitleStyle.glowColor || styledColor;
            }
            ctx.fillText(titleText, cursorX, nameY);
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            ctx.font = PLAYER_NAME_FONT;
            cursorX += titleWidth;
          }
          if (showRemoteName) {
            ctx.fillStyle = "#f3fbff";
            ctx.fillText(nameText, cursorX, nameY);
          }
          if (wrenchSelected && other.accountId) {
            const textWidth = (cursorX - nameX) + nameWidth;
            const iconSize = 22 / cameraZoom;
            const iconX = Math.round(nameX + textWidth + (6 / cameraZoom));
            const iconY = nameY - (4 / cameraZoom) - (iconSize / 2);
            drawNameWrenchIcon(iconX, iconY, iconSize);
            playerWrenchHitboxes.push({
              x: iconX,
              y: iconY,
              w: iconSize,
              h: iconSize,
              accountId: String(other.accountId || ""),
              name: nameText
            });
          }
        });
        if (typeof animationsModule.pruneTracker === "function") {
          animationsModule.pruneTracker(remoteAnimationTracker, keepIds);
        }
      }

      function drawNameWrenchIcon(x, y, size) {
        ctx.save();
        const r = size / 2;
        const badgeGradient = ctx.createRadialGradient(
          x + r * 0.78,
          y + r * 0.75,
          Math.max(1, r * 0.18),
          x + r,
          y + r,
          r
        );
        badgeGradient.addColorStop(0, "rgba(152, 239, 255, 0.98)");
        badgeGradient.addColorStop(0.58, "rgba(95, 149, 255, 0.96)");
        badgeGradient.addColorStop(1, "rgba(34, 76, 137, 0.98)");
        ctx.fillStyle = badgeGradient;
        ctx.shadowBlur = Math.max(4, size * 0.42);
        ctx.shadowColor = "rgba(96, 204, 255, 0.55)";
        ctx.beginPath();
        ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(6, 26, 52, 0.94)";
        ctx.lineWidth = Math.max(1, size * 0.08);
        ctx.stroke();
        ctx.strokeStyle = "rgba(230, 251, 255, 0.96)";
        ctx.lineWidth = Math.max(1.5, size * 0.12);
        const pad = size * 0.25;
        ctx.beginPath();
        ctx.moveTo(x + pad, y + size - pad);
        ctx.lineTo(x + size - pad, y + pad);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + size - pad, y + pad, size * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(8, 24, 48, 0.9)";
        ctx.lineWidth = Math.max(1, size * 0.06);
        ctx.beginPath();
        ctx.arc(x + r, y + r, r - Math.max(1, size * 0.08), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      function hitWrenchNameIcon(worldX, worldY) {
        if (!inWorld) return null;
        for (let i = localPlayerWrenchHitbox.length - 1; i >= 0; i--) {
          const hit = localPlayerWrenchHitbox[i];
          if (worldX >= hit.x && worldX <= hit.x + hit.w && worldY >= hit.y && worldY <= hit.y + hit.h) {
            return hit;
          }
        }
        for (let i = playerWrenchHitboxes.length - 1; i >= 0; i--) {
          const hit = playerWrenchHitboxes[i];
          if (worldX >= hit.x && worldX <= hit.x + hit.w && worldY >= hit.y && worldY <= hit.y + hit.h) {
            return hit;
          }
        }
        return null;
      }

      function openWrenchMenuFromNameIcon(clientX, clientY) {
        if (slotOrder[selectedSlot] !== TOOL_WRENCH) return false;
        const point = canvasPointFromClient(clientX, clientY);
        const hit = hitWrenchNameIcon(point.x / Math.max(0.01, cameraZoom), point.y / Math.max(0.01, cameraZoom));
        if (!hit || !hit.accountId) return false;
        const targetAccountId = hit.accountId === "local" ? (playerProfileId || "") : hit.accountId;
        if (!targetAccountId) return false;
        const friendCtrl = getFriendsController();
        if (!friendCtrl || typeof friendCtrl.openProfileByAccount !== "function") return false;
        return Boolean(friendCtrl.openProfileByAccount(targetAccountId, hit.name));
      }

      function wrapChatText(text, maxTextWidth) {
        if (typeof drawUtilsModule.wrapTextLines === "function") {
          return drawUtilsModule.wrapTextLines(ctx, text, maxTextWidth, 4);
        }
        const words = (text || "").split(/\s+/).filter(Boolean);
        if (!words.length) return [""];
        const lines = [];
        let line = words[0];
        for (let i = 1; i < words.length; i++) {
          const nextLine = line + " " + words[i];
          if (ctx.measureText(nextLine).width <= maxTextWidth) {
            line = nextLine;
          } else {
            lines.push(line);
            line = words[i];
          }
        }
        lines.push(line);
        return lines.slice(0, 4);
      }

      function drawAllOverheadChats() {
        const localPx = player.x - cameraX;
        const localPy = player.y - cameraY;
        drawOverheadChat(playerId, localPx + PLAYER_W / 2, localPy - 10);
        remotePlayers.forEach((other) => {
          const px = other.x - cameraX;
          const py = other.y - cameraY;
          drawOverheadChat(other.id || "", px + PLAYER_W / 2, py - 28);
        });
      }

      function drawOverheadChat(sourcePlayerId, centerX, baseY) {
        if (!sourcePlayerId) return;
        const entry = overheadChatByPlayer.get(sourcePlayerId);
        if (!entry) return;

        const now = performance.now();
        const remaining = entry.expiresAt - now;
        if (remaining <= 0) {
          overheadChatByPlayer.delete(sourcePlayerId);
          return;
        }

        let alpha = 1;
        const fadeStart = CHAT_BUBBLE_FADE_MS;
        if (remaining <= fadeStart) {
          const t = Math.max(0, Math.min(1, remaining / fadeStart));
          // Smooth fade-out (ease-out cubic) during final 1.5s.
          alpha = t * t * (3 - 2 * t);
        }
        const text = entry.text;
        if (typeof drawUtilsModule.drawOverheadBubble === "function") {
          drawUtilsModule.drawOverheadBubble(ctx, {
            centerX,
            baseY,
            text,
            alpha,
            maxWidth: CHAT_BUBBLE_MAX_WIDTH,
            lineHeight: CHAT_BUBBLE_LINE_HEIGHT,
            viewWidth: getCameraViewWidth(),
            font: "12px 'Trebuchet MS', sans-serif"
          });
          return;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = "12px 'Trebuchet MS', sans-serif";
        const padX = 7;
        const padY = 5;
        const maxTextWidth = CHAT_BUBBLE_MAX_WIDTH - padX * 2;
        const lines = wrapChatText(text, maxTextWidth);
        let widestLine = 0;
        for (const line of lines) {
          widestLine = Math.max(widestLine, ctx.measureText(line).width);
        }
        const bubbleW = Math.min(CHAT_BUBBLE_MAX_WIDTH, Math.max(36, widestLine + padX * 2));
        const bubbleH = lines.length * CHAT_BUBBLE_LINE_HEIGHT + padY * 2;
        let bubbleX = centerX - bubbleW / 2;
        let bubbleY = baseY - bubbleH - 2;
        if (bubbleX < 4) bubbleX = 4;
        const viewW = getCameraViewWidth();
        if (bubbleX + bubbleW > viewW - 4) bubbleX = viewW - 4 - bubbleW;
        if (bubbleY < 4) bubbleY = 4;
        ctx.fillStyle = "rgba(10, 25, 40, 0.92)";
        ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
        ctx.strokeRect(bubbleX, bubbleY, bubbleW, bubbleH);
        ctx.fillStyle = "#f7fbff";
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], bubbleX + padX, bubbleY + padY + 10 + i * CHAT_BUBBLE_LINE_HEIGHT);
        }
        ctx.restore();
      }

      function drawCrosshair() {
        const selectedId = slotOrder[selectedSlot];
        if (selectedId === TOOL_FIST || selectedId === TOOL_WRENCH) return;
        if (typeof selectedId !== "number") return;

        const reachTiles = Math.max(1, getEditReachTiles());
        const centerTx = Math.floor((player.x + PLAYER_W / 2) / TILE);
        const centerTy = Math.floor((player.y + PLAYER_H / 2) / TILE);
        const minTx = Math.max(0, centerTx - Math.ceil(reachTiles));
        const maxTx = Math.min(WORLD_W - 1, centerTx + Math.ceil(reachTiles));
        const minTy = Math.max(0, centerTy - Math.ceil(reachTiles));
        const maxTy = Math.min(WORLD_H - 1, centerTy + Math.ceil(reachTiles));

        ctx.save();
        ctx.strokeStyle = "rgba(255, 209, 102, 0.26)";
        ctx.lineWidth = 1;
        for (let ty = minTy; ty <= maxTy; ty++) {
          for (let tx = minTx; tx <= maxTx; tx++) {
            if (!canEditTarget(tx, ty)) continue;
            const x = tx * TILE - cameraX;
            const y = ty * TILE - cameraY;
            ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          }
        }
        ctx.restore();
      }

      function drawInfo() {
        const tx = Math.floor((player.x + PLAYER_W / 2) / TILE);
        const ty = Math.floor((player.y + PLAYER_H / 2) / TILE);
        const selectedId = slotOrder[selectedSlot];
        const usingFist = selectedId === TOOL_FIST;
        const usingWrench = selectedId === TOOL_WRENCH;
        const usingTool = usingFist || usingWrench;
        const itemName = usingFist ? "Fist" : (usingWrench ? "Wrench" : blockDefs[selectedId].name);
        const countText = usingTool ? "infinite" : String(inventory[selectedId]);
        let cosmeticOwned = 0;
        for (const item of COSMETIC_ITEMS) {
          cosmeticOwned += Math.max(0, Number(cosmeticInventory[item.id]) || 0);
        }

        ctx.fillStyle = "rgba(9, 25, 41, 0.7)";
        ctx.fillRect(12, 12, 390, 62);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.strokeRect(12, 12, 390, 62);

        ctx.fillStyle = "#f7fbff";
        ctx.font = "bold 15px 'Trebuchet MS', sans-serif";
        ctx.fillText("World: " + currentWorldId + " | Selected: " + itemName + " (" + countText + ")", 24, 36);
        ctx.font = "14px 'Trebuchet MS', sans-serif";
        ctx.fillText("Player Tile: " + tx + ", " + ty + " | Cosmetic items: " + cosmeticOwned, 24, 56);
      }

      function render() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(cameraZoom, 0, 0, cameraZoom, 0, 0);
        drawBackground();
        drawWorld();
        drawAllDamageOverlays(); // ADDED HERE
        if (particleController && typeof particleController.draw === "function") {
          particleController.draw(ctx, cameraX, cameraY);
        }
        drawWorldDrops();
        drawRemotePlayers();
        drawPlayer();
        drawAllOverheadChats();
        drawCrosshair();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        drawSignTopText();
      }
`;
