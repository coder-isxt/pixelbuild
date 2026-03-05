window.GTModules = window.GTModules || {};

window.GTModules.drawUtils = (function createDrawUtilsModule() {
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

    const padX = Math.max(0, Math.floor(Number(opts.padX) || 7));
    const padY = Math.max(0, Math.floor(Number(opts.padY) || 5));
    const maxWidth = Math.max(50, Math.floor(Number(opts.maxWidth) || 190));
    const lineHeight = Math.max(10, Math.floor(Number(opts.lineHeight) || 13));
    const viewWidth = Math.max(maxWidth + 8, Number(opts.viewWidth) || 1000);
    const font = String(opts.font || "12px 'Trebuchet MS', sans-serif");
    const fillStyle = String(opts.fillStyle || "rgba(10, 25, 40, 0.92)");
    const strokeStyle = String(opts.strokeStyle || "rgba(255, 255, 255, 0.28)");
    const textStyle = String(opts.textStyle || "#f7fbff");

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = font;

    const maxTextWidth = maxWidth - padX * 2;
    const lines = wrapTextLines(ctx, text, maxTextWidth, 4);
    let widestLine = 0;
    for (let i = 0; i < lines.length; i++) {
      widestLine = Math.max(widestLine, ctx.measureText(lines[i]).width);
    }

    const bubbleW = Math.min(maxWidth, Math.max(36, widestLine + padX * 2));
    const bubbleH = lines.length * lineHeight + padY * 2;
    let bubbleX = centerX - bubbleW / 2;
    let bubbleY = baseY - bubbleH - 2;
    if (bubbleX < 4) bubbleX = 4;
    if (bubbleX + bubbleW > viewWidth - 4) bubbleX = viewWidth - 4 - bubbleW;
    if (bubbleY < 4) bubbleY = 4;

    ctx.fillStyle = fillStyle;
    ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
    ctx.strokeStyle = strokeStyle;
    ctx.strokeRect(bubbleX, bubbleY, bubbleW, bubbleH);
    ctx.fillStyle = textStyle;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bubbleX + padX, bubbleY + padY + 10 + i * lineHeight);
    }
    ctx.restore();
  }

  return {
    wrapTextLines,
    drawOverheadBubble
  };
})();
