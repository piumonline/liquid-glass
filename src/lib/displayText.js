/**
 * Display-text helpers.
 *
 * Large type behind the glass makes refraction legible, so the playground
 * can render a headline in the middle of the stage.
 *
 * The SVG engine refracts the real DOM, so it just needs the text laid out
 * on screen. The WebGL shader can only sample a texture, so for that engine
 * the text has to be rasterised into the backdrop image. Both paths share
 * the same line-breaking routine so the two engines line up exactly.
 */

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, Arial, sans-serif';
const WEIGHT = 800;
const MAX_LINES = 3;

/** A shared 1x1 canvas is enough context for measuring text. */
let measureCtx = null;
function measuringContext() {
  if (!measureCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    measureCtx = c.getContext('2d');
  }
  return measureCtx;
}

function fontSpec(fontSize) {
  return `${WEIGHT} ${fontSize}px ${FONT_STACK}`;
}

/**
 * Greedy word wrap, so the DOM and the rasterised backdrop break in the same
 * place. Returns at most `MAX_LINES` lines.
 */
export function fitLines(text, fontSize, maxWidth) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const ctx = measuringContext();
  ctx.font = fontSpec(fontSize);

  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length >= MAX_LINES) break;
    }
  }
  if (line && lines.length < MAX_LINES) lines.push(line);

  return lines.slice(0, MAX_LINES);
}

/**
 * Draw the backdrop image plus the display text into a single canvas and
 * return it as a data URL — the same `center/cover` framing the CSS uses.
 *
 * Rejects if the image cannot be read cross-origin, so the caller can fall
 * back to the plain image URL.
 */
export function composeBackdrop({
  imageUrl,
  lines,
  fontSize,
  width,
  height,
  scale = 1,
  color = 'rgba(255, 255, 255, 0.94)',
}) {
  return new Promise((resolve, reject) => {
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => reject(new Error('Backdrop image timed out.')), 12000);

    img.onload = () => {
      clearTimeout(timer);

      // Same maths as CSS `background: center/cover`.
      const fit = Math.max(w / img.width, h / img.height);
      const dw = img.width * fit;
      const dh = img.height * fit;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

      if (lines?.length) {
        const size = fontSize * scale;
        const lineHeight = size * 0.92;

        ctx.font = fontSpec(size);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;

        const firstBaseline = h / 2 - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, i) => ctx.fillText(line, w / 2, firstBaseline + i * lineHeight));
      }

      try {
        // JPEG, not PNG: this is a photograph and PNG data URLs get enormous.
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        reject(new Error('Backdrop could not be rasterised (image blocks cross-origin reads).'));
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Backdrop image failed to load.'));
    };

    img.src = imageUrl;
  });
}
