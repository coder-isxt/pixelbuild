window.GTModules = window.GTModules || {};

window.GTModules.particles = (function createParticlesModule() {
  function createController(config) {
    const cfg = config || {};
    const maxParticles = Math.max(80, Math.floor(Number(cfg.maxParticles) || 320));
    const list = [];

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function clampAlpha(v) {
      return Math.max(0, Math.min(1, Number(v) || 0));
    }

    function pushMany(items) {
      if (!Array.isArray(items) || !items.length) return;
      for (let i = 0; i < items.length; i++) {
        list.push(items[i]);
      }
      if (list.length <= maxParticles) return;
      list.splice(0, list.length - maxParticles);
    }

    function makeParticle(x, y, vx, vy, life, size, color, gravity, drag) {
      return {
        x: Number(x) || 0,
        y: Number(y) || 0,
        vx: Number(vx) || 0,
        vy: Number(vy) || 0,
        life: Math.max(0.04, Number(life) || 0.5),
        age: 0,
        size: Math.max(0.7, Number(size) || 2),
        color: String(color || "#ffffff"),
        gravity: Number.isFinite(Number(gravity)) ? Number(gravity) : 0.22,
        drag: Math.max(0.7, Math.min(1, Number(drag) || 0.985))
      };
    }

    function easeInOutCubic(t) {
      const v = Math.max(0, Math.min(1, Number(t) || 0));
      return v < 0.5 ? (4 * v * v * v) : (1 - Math.pow(-2 * v + 2, 3) / 2);
    }

    function emitBlockBreak(x, y, count) {
      const n = Math.max(6, Math.min(22, Math.floor(Number(count) || 12)));
      const items = [];
      for (let i = 0; i < n; i++) {
        const angle = rand(-Math.PI, 0);
        const speed = rand(0.4, 2.3);
        items.push(makeParticle(
          x + rand(-5, 5),
          y + rand(-5, 5),
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - rand(0.2, 1.0),
          rand(0.22, 0.55),
          rand(1.2, 2.8),
          i % 2 ? "#c9a37a" : "#d8bc98",
          0.28,
          0.965
        ));
      }
      pushMany(items);
    }

    function emitWaterSplash(x, y, intensity) {
      const n = Math.max(4, Math.min(18, Math.floor(Number(intensity) || 8)));
      const items = [];
      for (let i = 0; i < n; i++) {
        const angle = rand(-2.8, -0.35);
        const speed = rand(0.5, 2.1);
        items.push(makeParticle(
          x + rand(-8, 8),
          y + rand(-2, 4),
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - rand(0, 0.9),
          rand(0.2, 0.5),
          rand(1.1, 2.4),
          i % 2 ? "rgba(96, 204, 255, 0.95)" : "rgba(167, 233, 255, 0.95)",
          0.2,
          0.968
        ));
      }
      pushMany(items);
    }

    function emitWingFlap(x, y, facing, strength) {
      const dir = Number(facing) >= 0 ? 1 : -1;
      const power = Math.max(0.6, Math.min(2.2, Number(strength) || 1));
      const n = Math.max(5, Math.min(20, Math.floor(8 * power)));
      const items = [];
      for (let i = 0; i < n; i++) {
        items.push(makeParticle(
          x + rand(-8, 8) - dir * rand(5, 15),
          y + rand(-6, 6),
          -dir * rand(0.5, 2.0),
          rand(-0.5, 0.5) - power * 0.2,
          rand(0.5, 1.5),
          rand(1.2, 2.5),
          "rgba(255, 255, 255, 0.6)",
          0.08,
          0.95
        ));
      }
      pushMany(items);
    }

    function emitSeedDrop(x, y) {
      const items = [];
      for (let i = 0; i < 8; i++) {
        const angle = rand(-2.6, -0.55);
        const speed = rand(0.4, 1.4);
        items.push(makeParticle(
          x + rand(-4, 4),
          y + rand(-4, 4),
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - rand(0, 0.5),
          rand(0.22, 0.46),
          rand(1.0, 2.0),
          i % 2 ? "rgba(176, 255, 137, 0.95)" : "rgba(107, 201, 91, 0.95)",
          0.18,
          0.972
        ));
      }
      pushMany(items);
    }

    function emitPickup(x, y, toX, toY, amount, kind) {
      const fromX = Number(x) || 0;
      const fromY = Number(y) || 0;
      const targetX = Number(toX) || fromX;
      const targetY = Number(toY) || fromY;
      const qty = Math.max(1, Math.floor(Number(amount) || 1));
      const n = Math.max(5, Math.min(24, Math.floor(5 + Math.log2(qty + 1) * 4)));
      const baseColor = String(kind || "").toLowerCase() === "cosmetic"
        ? "rgba(234, 198, 255, 0.95)"
        : (String(kind || "").toLowerCase() === "tool"
          ? "rgba(255, 216, 152, 0.95)"
          : "rgba(187, 245, 255, 0.95)");
      const accentColor = String(kind || "").toLowerCase() === "cosmetic"
        ? "rgba(255, 244, 255, 0.92)"
        : (String(kind || "").toLowerCase() === "tool"
          ? "rgba(255, 244, 210, 0.92)"
          : "rgba(233, 253, 255, 0.92)");
      const items = [];
      for (let i = 0; i < n; i++) {
        const startX = fromX + rand(-4.5, 4.5);
        const startY = fromY + rand(-4.5, 4.5);
        const wobbleX = rand(-9, 9);
        const wobbleY = rand(-7, 7);
        const life = rand(0.34, 0.62);
        const particle = makeParticle(
          startX,
          startY,
          0,
          0,
          life,
          rand(1.0, 2.3),
          i % 2 ? baseColor : accentColor,
          0,
          1
        );
        particle.pickupTween = {
          sx: startX,
          sy: startY,
          tx: targetX + rand(-2.5, 2.5),
          ty: targetY + rand(-2.5, 2.5),
          cx: (startX + targetX) * 0.5 + wobbleX,
          cy: (startY + targetY) * 0.5 + wobbleY
        };
        items.push(particle);
      }
      pushMany(items);
    }

    function update(dtSeconds) {
      const dt = Math.max(0.001, Math.min(0.06, Number(dtSeconds) || 0.016));
      if (!list.length) return;
      let w = 0;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) continue;
        if (p.pickupTween) {
          const tw = p.pickupTween;
          const t = Math.max(0, Math.min(1, p.age / p.life));
          const e = easeInOutCubic(t);
          // Quadratic bezier tween to pull particles toward the inventory target.
          const inv = 1 - e;
          p.x = (inv * inv * tw.sx) + (2 * inv * e * tw.cx) + (e * e * tw.tx);
          p.y = (inv * inv * tw.sy) + (2 * inv * e * tw.cy) + (e * e * tw.ty);
          list[w++] = p;
          continue;
        }
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.vy += p.gravity * dt * 60;
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        list[w++] = p;
      }
      list.length = w;
    }

    function draw(ctx, cameraX, cameraY) {
      if (!ctx || !list.length) return;
      const camX = Number(cameraX) || 0;
      const camY = Number(cameraY) || 0;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const t = 1 - (p.age / p.life);
        const a = clampAlpha(t * t * (2 - t));
        if (a <= 0.01) continue;
        const x = p.x - camX;
        const y = p.y - camY;
        const s = Math.max(0.6, p.size * (0.5 + t * 0.7));
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
      }
      ctx.globalAlpha = 1;
    }

    function clear() {
      list.length = 0;
    }

    return {
      emitBlockBreak,
      emitWaterSplash,
      emitWingFlap,
      emitSeedDrop,
      emitPickup,
      update,
      draw,
      clear
    };
  }

  return { createController };
})();
