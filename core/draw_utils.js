window.GTModules = window.GTModules || {};

window.GTModules.drawUtils = (function createDrawUtilsModule() {
  function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(Number(r) || 0, Math.min(w, h) * 0.5));
    if (!radius) {
      ctx.rect(x, y, w, h);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  function resolveBubblePalette(kind) {
    const safe = String(kind || "").trim().toLowerCase();
    if (safe === "system") {
      return {
        top: "rgba(36, 26, 14, 0.94)",
        bottom: "rgba(24, 16, 9, 0.94)",
        border: "rgba(255, 210, 122, 0.78)",
        glow: "rgba(255, 210, 122, 0.24)",
        text: "#fff3d6",
        header: "#ffd892"
      };
    }
    if (safe === "self") {
      return {
        top: "rgba(18, 39, 60, 0.94)",
        bottom: "rgba(12, 29, 46, 0.94)",
        border: "rgba(117, 216, 255, 0.74)",
        glow: "rgba(107, 205, 255, 0.24)",
        text: "#eef9ff",
        header: "#9fe7ff"
      };
    }
    return {
      top: "rgba(15, 31, 50, 0.94)",
      bottom: "rgba(10, 22, 38, 0.94)",
      border: "rgba(164, 208, 245, 0.62)",
      glow: "rgba(134, 194, 242, 0.2)",
      text: "#f2f8ff",
      header: "#a8d8ff"
    };
  }

  function wrapTextLines(ctx, text, maxTextWidth, maxLines) {
    const safeCtx = ctx;
    if (!safeCtx || typeof safeCtx.measureText !== "function") return [String(text || "")];
    const words = String(text || "").split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines = [];
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const nextLine = line + " " + words[i];
      if (safeCtx.measureText(nextLine).width <= maxTextWidth) {
        line = nextLine;
      } else {
        lines.push(line);
        line = words[i];
      }
    }
    lines.push(line);
    const limit = Math.max(1, Math.floor(Number(maxLines) || 4));
    return lines.slice(0, limit);
  }

  function drawOverheadBubble(ctx, options) {
    const opts = options || {};
    if (!ctx) return;
    const centerX = Number(opts.centerX) || 0;
    const baseY = Number(opts.baseY) || 0;
    const text = String(opts.text || "");
    const alpha = Math.max(0, Math.min(1, Number(opts.alpha) || 0));
    if (!text || alpha <= 0) return;

    const padX = Math.max(0, Math.floor(Number(opts.padX) || 8));
    const padY = Math.max(0, Math.floor(Number(opts.padY) || 6));
    const maxWidth = Math.max(50, Math.floor(Number(opts.maxWidth) || 190));
    const lineHeight = Math.max(10, Math.floor(Number(opts.lineHeight) || 13));
    const viewWidth = Math.max(maxWidth + 8, Number(opts.viewWidth) || 1000);
    const font = String(opts.font || "12px 'Trebuchet MS', sans-serif");
    const speaker = String(opts.speaker || "").trim().slice(0, 20);
    const kind = String(opts.kind || "").trim().toLowerCase();
    const palette = resolveBubblePalette(kind);
    const fillStyle = String(opts.fillStyle || palette.bottom);
    const strokeStyle = String(opts.strokeStyle || palette.border);
    const textStyle = String(opts.textStyle || palette.text);
    const headerStyle = String(opts.headerStyle || palette.header);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = font;

    const maxTextWidth = maxWidth - padX * 2;
    const lines = wrapTextLines(ctx, text, maxTextWidth, 3);
    let widestLine = 0;
    for (let i = 0; i < lines.length; i++) {
      widestLine = Math.max(widestLine, ctx.measureText(lines[i]).width);
    }
    let headerHeight = 0;
    let headerTextWidth = 0;
    if (speaker) {
      const oldFont = ctx.font;
      ctx.font = "11px 'Trebuchet MS', sans-serif";
      headerTextWidth = ctx.measureText(speaker).width;
      ctx.font = oldFont;
      headerHeight = 12;
    }
    widestLine = Math.max(widestLine, headerTextWidth);

    const bubbleW = Math.min(maxWidth, Math.max(36, widestLine + padX * 2));
    const bubbleH = headerHeight + lines.length * lineHeight + padY * 2;
    let bubbleX = centerX - bubbleW / 2;
    let bubbleY = baseY - bubbleH - 6;
    if (bubbleX < 4) bubbleX = 4;
    if (bubbleX + bubbleW > viewWidth - 4) bubbleX = viewWidth - 4 - bubbleW;
    if (bubbleY < 4) bubbleY = 4;

    const bubbleR = Math.max(4, Math.min(10, Math.floor(bubbleH / 4)));
    const tailHalf = 5;
    const tailHeight = 6;
    let tailCenterX = Math.max(bubbleX + 10, Math.min(centerX, bubbleX + bubbleW - 10));

    const grad = ctx.createLinearGradient(0, bubbleY, 0, bubbleY + bubbleH);
    grad.addColorStop(0, palette.top);
    grad.addColorStop(1, fillStyle);

    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    roundRectPath(ctx, bubbleX, bubbleY, bubbleW, bubbleH, bubbleR);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    roundRectPath(ctx, bubbleX, bubbleY, bubbleW, bubbleH, bubbleR);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tailCenterX - tailHalf, bubbleY + bubbleH - 0.5);
    ctx.lineTo(tailCenterX, bubbleY + bubbleH + tailHeight);
    ctx.lineTo(tailCenterX + tailHalf, bubbleY + bubbleH - 0.5);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();

    let textTop = bubbleY + padY + 10;
    if (speaker) {
      ctx.font = "11px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = headerStyle;
      ctx.fillText(speaker, bubbleX + padX, bubbleY + padY + 9);
      ctx.font = font;
      textTop += headerHeight;
    }
    ctx.fillStyle = textStyle;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bubbleX + padX, textTop + i * lineHeight);
    }
    ctx.restore();
  }

  return {
    wrapTextLines,
    drawOverheadBubble
  };
})();
