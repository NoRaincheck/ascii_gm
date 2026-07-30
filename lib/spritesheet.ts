import { getFieldColor, getPalette, getPngColors, type Rgb, TEMPLATE_TEXT, type ThemeName } from './theme.ts';

const GLYPH_W = 8;
const GLYPH_H = 16;
const CELL_X = 9;
const CELL_Y = 17;

let glyphData: ImageData[] | null = null;

const CHAR_MAP: Record<string, number> = {};
for (let i = 32; i <= 126; i++) {
  CHAR_MAP[String.fromCharCode(i)] = i;
}

// Box drawing - single line
CHAR_MAP['\u2500'] = 196; // ─
CHAR_MAP['\u2502'] = 179; // │
CHAR_MAP['\u250c'] = 218; // ┌
CHAR_MAP['\u2510'] = 191; // ┐
CHAR_MAP['\u2514'] = 192; // └
CHAR_MAP['\u2518'] = 217; // ┘
CHAR_MAP['\u251c'] = 195; // ├
CHAR_MAP['\u2524'] = 180; // ┤
CHAR_MAP['\u252c'] = 194; // ┬
CHAR_MAP['\u2534'] = 193; // ┴
CHAR_MAP['\u253c'] = 197; // ┼

// Box drawing - double line
CHAR_MAP['\u2550'] = 205; // ═
CHAR_MAP['\u2551'] = 186; // ║
CHAR_MAP['\u2554'] = 201; // ╔
CHAR_MAP['\u2557'] = 187; // ╗
CHAR_MAP['\u255a'] = 200; // ╚
CHAR_MAP['\u255d'] = 188; // ╝
CHAR_MAP['\u2560'] = 204; // ╠
CHAR_MAP['\u2563'] = 185; // ╣
CHAR_MAP['\u2566'] = 203; // ╦
CHAR_MAP['\u2569'] = 202; // ╩
CHAR_MAP['\u256c'] = 206; // ╬

// Box drawing - mixed single/double
CHAR_MAP['\u2552'] = 198; // ╒
CHAR_MAP['\u2555'] = 199; // ╕
CHAR_MAP['\u2558'] = 207; // ╘
CHAR_MAP['\u255b'] = 208; // ╛
CHAR_MAP['\u255e'] = 209; // ╞
CHAR_MAP['\u2561'] = 210; // ╟
CHAR_MAP['\u2562'] = 211; // ╡
CHAR_MAP['\u2564'] = 213; // ╤
CHAR_MAP['\u2565'] = 214; // ╥
CHAR_MAP['\u2567'] = 215; // ╧
CHAR_MAP['\u2568'] = 216; // ╨
CHAR_MAP['\u256a'] = 219; // ╪
CHAR_MAP['\u256b'] = 220; // ╫
CHAR_MAP['\u256d'] = 221; // ╭
CHAR_MAP['\u256e'] = 222; // ╮
CHAR_MAP['\u256f'] = 223; // ╯
CHAR_MAP['\u2570'] = 224; // ╰
CHAR_MAP['\u2571'] = 225; // ╱
CHAR_MAP['\u2572'] = 226; // ╲
CHAR_MAP['\u2573'] = 227; // ╳

// Block elements
CHAR_MAP['\u2580'] = 176; // ▀
CHAR_MAP['\u2584'] = 177; // ▄
CHAR_MAP['\u2588'] = 178; // █
CHAR_MAP['\u258c'] = 177; // ▌
CHAR_MAP['\u2590'] = 178; // ▐
CHAR_MAP['\u2591'] = 176; // ░
CHAR_MAP['\u2592'] = 177; // ▒
CHAR_MAP['\u2593'] = 178; // ▓

// Shapes and symbols
CHAR_MAP['\u25a0'] = 254; // ■
CHAR_MAP['\u25a1'] = 254; // □
CHAR_MAP['\u25b2'] = 30;  // ▲
CHAR_MAP['\u25bc'] = 31;  // ▼
CHAR_MAP['\u25c4'] = 17;  // ◄
CHAR_MAP['\u25ba'] = 16;  // ►
CHAR_MAP['\u25ac'] = 22;  // ▬
CHAR_MAP['\u25cb'] = 9;   // ○
CHAR_MAP['\u25cf'] = 9;   // ●
CHAR_MAP['\u25d8'] = 8;   // ◘
CHAR_MAP['\u25d9'] = 10;  // ◙
CHAR_MAP['\u263a'] = 1;   // ☺
CHAR_MAP['\u263b'] = 2;   // ☻
CHAR_MAP['\u2660'] = 6;   // ♠
CHAR_MAP['\u2663'] = 5;   // ♣
CHAR_MAP['\u2665'] = 3;   // ♥
CHAR_MAP['\u2666'] = 4;   // ♦
CHAR_MAP['\u266a'] = 13;  // ♪
CHAR_MAP['\u266b'] = 14;  // ♫
CHAR_MAP['\u263c'] = 15;  // ☼
CHAR_MAP['\u2190'] = 27;  // ←
CHAR_MAP['\u2191'] = 24;  // ↑
CHAR_MAP['\u2192'] = 26;  // →
CHAR_MAP['\u2193'] = 25;  // ↓
CHAR_MAP['\u2194'] = 29;  // ↔
CHAR_MAP['\u2195'] = 18;  // ↕
CHAR_MAP['\u21a8'] = 23;  // ↨
CHAR_MAP['\u203c'] = 19;  // ‼
CHAR_MAP['\u00b6'] = 20;  // ¶
CHAR_MAP['\u00a7'] = 21;  // §
CHAR_MAP['\u221f'] = 28;  // ∟
CHAR_MAP['\u2261'] = 240; // ≡
CHAR_MAP['\u00b1'] = 241; // ±
CHAR_MAP['\u2264'] = 243; // ≤
CHAR_MAP['\u2265'] = 242; // ≥
CHAR_MAP['\u00d7'] = 249; // ×
CHAR_MAP['\u00f7'] = 246; // ÷
CHAR_MAP['\u221e'] = 244; // ∞
CHAR_MAP['\u2234'] = 245; // ∴
CHAR_MAP['\u223c'] = 247; // ∼
CHAR_MAP['\u2248'] = 247; // ≈
CHAR_MAP['\u2260'] = 226; // ≠
CHAR_MAP['\u00b2'] = 253; // ²
CHAR_MAP['\u00b3'] = 252; // ³
CHAR_MAP['\u00b9'] = 251; // ¹
CHAR_MAP['\u00bc'] = 171; // ¼
CHAR_MAP['\u00bd'] = 172; // ½
CHAR_MAP['\u00be'] = 173; // ¾
CHAR_MAP['\u2581'] = 228; // ▁
CHAR_MAP['\u2582'] = 229; // ▂
CHAR_MAP['\u2583'] = 230; // ▃
CHAR_MAP['\u2585'] = 231; // ▅
CHAR_MAP['\u2586'] = 232; // ▆
CHAR_MAP['\u2587'] = 233; // ▇
CHAR_MAP['\u2589'] = 234; // ▉
CHAR_MAP['\u258a'] = 235; // ▊
CHAR_MAP['\u258b'] = 236; // ▋
CHAR_MAP['\u258d'] = 237; // ▍
CHAR_MAP['\u258e'] = 238; // ▎
CHAR_MAP['\u258f'] = 239; // ▏
CHAR_MAP['\u2594'] = 248; // ▔
CHAR_MAP['\u2595'] = 248; // ▕
CHAR_MAP['\u2596'] = 248; // ▖
CHAR_MAP['\u2597'] = 248; // ▗
CHAR_MAP['\u2598'] = 248; // ▘
CHAR_MAP['\u2599'] = 248; // ▙
CHAR_MAP['\u259a'] = 248; // ▚
CHAR_MAP['\u259b'] = 248; // ▛
CHAR_MAP['\u259c'] = 248; // ▜
CHAR_MAP['\u259d'] = 248; // ▝
CHAR_MAP['\u259e'] = 248; // ▞
CHAR_MAP['\u259f'] = 248; // ▟

export function getGlyphIndex(ch: string): number | undefined {
  return CHAR_MAP[ch];
}

export function parseSpritesheet(imageSource: CanvasImageSource, ctx: CanvasRenderingContext2D): ImageData[] {
  const cols = Math.floor(imageSource.width as number / CELL_X);
  const rows = Math.ceil((imageSource.height as number) / CELL_Y);
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
  artText?: string,
): void {
  if (!glyphData && imageMode) {
    throw new Error('Spritesheet not loaded. Call parseSpritesheet first.');
  }

  const { text, bg, highlightText } = getPngColors(theme);
  const palette = getPalette(theme);

  const cardLines = cardText.split('\n');
  const templateLines = TEMPLATE_TEXT.split('\n');

  const charWidth = GLYPH_W;
  const charHeight = GLYPH_H;

  const numCharsWide = Math.max(...cardLines.map((l) => l.length));
  const numCharsHigh = cardLines.length;

  const canvasWidth = numCharsWide * charWidth;
  const canvasHeight = numCharsHigh * charHeight;

  ctx.canvas.width = canvasWidth;
  ctx.canvas.height = canvasHeight;

  if (artText && imageMode) {
    renderImageMode(ctx, cardLines, templateLines, palette, text, bg, highlightText, charWidth, charHeight, artText, palette.neutral);
  } else if (imageMode) {
    renderImageMode(ctx, cardLines, templateLines, palette, text, bg, highlightText, charWidth, charHeight);
  } else {
    renderCanvasMode(ctx, cardLines, templateLines, palette, text, bg, highlightText, charWidth, charHeight);
  }
}

function boxBlur(data: Uint8ClampedArray, width: number, height: number, radius: number): void {
  const copy = new Uint8ClampedArray(data);
  const kernelSize = (2 * radius + 1) * (2 * radius + 1);

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            sum += copy[((y + dy) * width + (x + dx)) * 4 + c];
          }
        }
        data[(y * width + x) * 4 + c] = sum / kernelSize;
      }
    }
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
  artText?: string,
  artColor?: Rgb,
): void {
  const imageData = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
  fillBg(imageData, bgColor);

  const hasArt = !!(artText && artColor);

  if (hasArt) {
    const artBuffer = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
    const artLines = artText.split('\n');
    for (let li = 0; li < artLines.length; li++) {
      const artLine = artLines[li];
      for (let ci = 0; ci < artLine.length; ci++) {
        const ch = artLine[ci];
        if (ch === ' ') continue;

        const glyphIndex = CHAR_MAP[ch];
        if (glyphIndex === undefined || !glyphData || glyphIndex >= glyphData.length) continue;

        const glyph = glyphData[glyphIndex];
        const dx = ci * charWidth;
        const dy = li * charHeight;

        for (let py = 0; py < charHeight; py++) {
          for (let px = 0; px < charWidth; px++) {
            const si = (py * charWidth + px) * 4;
            const di = ((dy + py) * ctx.canvas.width + (dx + px)) * 4;
            const glyphPixel = glyph.data[si];
            if (glyphPixel > 127) {
              artBuffer.data[di] = artColor[0];
              artBuffer.data[di + 1] = artColor[1];
              artBuffer.data[di + 2] = artColor[2];
              artBuffer.data[di + 3] = 180;
            }
          }
        }
      }
    }

    boxBlur(artBuffer.data, ctx.canvas.width, ctx.canvas.height, 3);

    const len = imageData.data.length;
    for (let i = 0; i < len; i += 4) {
      const srcA = artBuffer.data[i + 3] / 255;
      if (srcA > 0) {
        const invA = 1 - srcA;
        imageData.data[i] = artBuffer.data[i] * srcA + imageData.data[i] * invA;
        imageData.data[i + 1] = artBuffer.data[i + 1] * srcA + imageData.data[i + 1] * invA;
        imageData.data[i + 2] = artBuffer.data[i + 2] * srcA + imageData.data[i + 2] * invA;
      }
    }
  }

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
        const fieldColor = getFieldColor(li, ci, cardLines, palette);
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
          } else if (!hasArt || isHighlight) {
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
        const fieldColor = getFieldColor(li, ci, cardLines, palette);
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
