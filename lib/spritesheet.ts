import { getFieldColor, getPalette, getPngColors, getTemplateText, type Rgb, type ThemeName } from './theme.ts';
import type { Layout } from './oracle_data.ts';

const GLYPH_W = 8;
const GLYPH_H = 16;
const CELL_X = 9;
const CELL_Y = 17;

let glyphData: ImageData[] | null = null;

const CHAR_MAP: Record<string, number> = {};
for (let i = 32; i <= 126; i++) {
  CHAR_MAP[String.fromCharCode(i)] = i;
}
CHAR_MAP['\u2500'] = 196;
CHAR_MAP['\u2502'] = 179;
CHAR_MAP['\u250c'] = 218;
CHAR_MAP['\u2510'] = 191;
CHAR_MAP['\u2514'] = 192;
CHAR_MAP['\u2518'] = 217;
CHAR_MAP['\u251c'] = 195;
CHAR_MAP['\u2524'] = 180;
CHAR_MAP['\u252c'] = 194;
CHAR_MAP['\u2534'] = 193;

export function getGlyphIndex(ch: string): number | undefined {
  return CHAR_MAP[ch];
}

export function parseSpritesheet(imageSource: CanvasImageSource, ctx: CanvasRenderingContext2D): ImageData[] {
  const size = imageSource as { width: number; height: number };
  const cols = Math.floor(size.width / CELL_X);
  const rows = Math.ceil(size.height / CELL_Y);
  const glyphs: ImageData[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.drawImage(
        imageSource,
        col * CELL_X + 1,
        row * CELL_Y,
        GLYPH_W,
        GLYPH_H,
        0,
        0,
        GLYPH_W,
        GLYPH_H,
      );
      const data = ctx.getImageData(0, 0, GLYPH_W, GLYPH_H);
      glyphs.push(data);
    }
  }

  glyphData = glyphs;
  return glyphs;
}

export function isLoaded(): boolean {
  return glyphData !== null;
}

export function renderCardToCanvas(
  ctx: CanvasRenderingContext2D,
  cardText: string,
  theme: ThemeName = 'macchiato',
  imageMode: boolean = true,
  layout: Layout = 'portrait',
): void {
  if (!glyphData && imageMode) {
    throw new Error('Spritesheet not loaded. Call parseSpritesheet first.');
  }

  const { text, bg, highlightText } = getPngColors(theme);
  const palette = getPalette(theme);

  const cardLines = cardText.split('\n');
  const templateLines = getTemplateText(layout).split('\n');

  if (cardLines.length !== templateLines.length) {
    throw new Error(
      `Card line count (${cardLines.length}) does not match ${layout} template (${templateLines.length}).`,
    );
  }

  const charWidth = GLYPH_W;
  const charHeight = GLYPH_H;

  const numCharsWide = Math.max(...cardLines.map((l) => l.length));
  const numCharsHigh = cardLines.length;

  const canvasWidth = numCharsWide * charWidth;
  const canvasHeight = numCharsHigh * charHeight;

  ctx.canvas.width = canvasWidth;
  ctx.canvas.height = canvasHeight;

  if (imageMode) {
    renderImageMode(
      ctx,
      cardLines,
      templateLines,
      palette,
      text,
      bg,
      highlightText,
      charWidth,
      charHeight,
      theme,
      layout,
    );
  } else {
    renderCanvasMode(
      ctx,
      cardLines,
      templateLines,
      palette,
      text,
      bg,
      highlightText,
      charWidth,
      charHeight,
      theme,
      layout,
    );
  }
}

function renderImageMode(
  ctx: CanvasRenderingContext2D,
  cardLines: string[],
  templateLines: string[],
  palette: Record<string, Rgb>,
  textColor: Rgb,
  bgColor: Rgb,
  highlightTextColor: Rgb,
  charWidth: number,
  charHeight: number,
  theme: ThemeName,
  layout: Layout,
): void {
  const imageData = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
  fillBg(imageData, bgColor);

  for (let li = 0; li < cardLines.length; li++) {
    const cardLine = cardLines[li];
    const templLine = templateLines[li] ?? '';

    for (let ci = 0; ci < cardLine.length; ci++) {
      const ch = cardLine[ci];
      const baseChar = templLine[ci] ?? ch;
      const isHighlight = ch !== baseChar;

      const glyphIndex = CHAR_MAP[ch];
      if (glyphIndex === undefined || !glyphData || glyphIndex >= glyphData.length) continue;

      const glyph = glyphData[glyphIndex];

      let fg: Rgb;
      let bg: Rgb;

      if (isHighlight) {
        const fieldColor = getFieldColor(li, ci, cardLines, palette, theme, layout);
        if (fieldColor) {
          fg = highlightTextColor;
          bg = fieldColor;
        } else {
          fg = textColor;
          bg = bgColor;
        }
      } else {
        fg = textColor;
        bg = bgColor;
      }

      const dx = ci * charWidth;
      const dy = li * charHeight;

      for (let py = 0; py < charHeight; py++) {
        for (let px = 0; px < charWidth; px++) {
          const si = (py * charWidth + px) * 4;
          const di = ((dy + py) * ctx.canvas.width + (dx + px)) * 4;
          const glyphPixel = glyph.data[si];
          if (glyphPixel > 127) {
            imageData.data[di] = fg[0];
            imageData.data[di + 1] = fg[1];
            imageData.data[di + 2] = fg[2];
            imageData.data[di + 3] = 255;
          } else {
            imageData.data[di] = bg[0];
            imageData.data[di + 1] = bg[1];
            imageData.data[di + 2] = bg[2];
            imageData.data[di + 3] = 255;
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function renderCanvasMode(
  ctx: CanvasRenderingContext2D,
  cardLines: string[],
  templateLines: string[],
  palette: Record<string, Rgb>,
  textColor: Rgb,
  bgColor: Rgb,
  highlightTextColor: Rgb,
  charWidth: number,
  charHeight: number,
  theme: ThemeName,
  layout: Layout,
): void {
  ctx.fillStyle = rgbToCss(bgColor);
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const fontSize = Math.min(charWidth, charHeight) + 4;
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = 'top';

  for (let li = 0; li < cardLines.length; li++) {
    const cardLine = cardLines[li];
    const templLine = templateLines[li] ?? '';

    for (let ci = 0; ci < cardLine.length; ci++) {
      const ch = cardLine[ci];
      const baseChar = templLine[ci] ?? ch;
      const isHighlight = ch !== baseChar;

      const x = ci * charWidth;
      const y = li * charHeight;

      if (isHighlight) {
        const fieldColor = getFieldColor(li, ci, cardLines, palette, theme, layout);
        if (fieldColor) {
          ctx.fillStyle = rgbToCss(fieldColor);
          ctx.fillRect(x, y, charWidth, charHeight);
          ctx.fillStyle = rgbToCss(highlightTextColor);
        } else {
          ctx.fillStyle = rgbToCss(textColor);
        }
      } else {
        ctx.fillStyle = rgbToCss(textColor);
      }

      ctx.fillText(ch, x, y);
    }
  }
}

function fillBg(imageData: ImageData, bgColor: Rgb): void {
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = bgColor[0];
    imageData.data[i + 1] = bgColor[1];
    imageData.data[i + 2] = bgColor[2];
    imageData.data[i + 3] = 255;
  }
}

function rgbToCss([r, g, b]: Rgb): string {
  return `rgb(${r},${g},${b})`;
}
