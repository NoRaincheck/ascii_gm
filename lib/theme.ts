export type Rgb = [number, number, number];
export type ThemeName = 'macchiato' | 'latte';

const MACCHIATO_COLORS: Record<string, Rgb> = {
  crust: [24, 23, 38],
  base: [36, 39, 58],
  overlay0: [108, 112, 134],
  text: [202, 211, 245],
  blue: [138, 173, 244],
  rosewater: [245, 169, 185],
};

const LATTE_COLORS: Record<string, Rgb> = {
  crust: [220, 213, 197],
  base: [239, 232, 218],
  overlay0: [156, 150, 136],
  text: [76, 79, 105],
  blue: [30, 102, 245],
  rosewater: [220, 138, 120],
};

function getColors(theme: ThemeName): Record<string, Rgb> {
  return theme === 'macchiato' ? MACCHIATO_COLORS : LATTE_COLORS;
}

export function getPalette(theme: ThemeName = 'macchiato'): Record<string, Rgb> {
  const c = getColors(theme);
  return {
    positive: c.blue,
    negative: c.rosewater,
    neutral: c.overlay0,
  };
}

export function getTerminalPalette(theme: ThemeName = 'macchiato'): Record<string, string> {
  const c = getColors(theme);
  const neutral = theme === 'macchiato' ? c.crust : c.overlay0;
  return {
    positive: ansiRgb(c.blue),
    negative: ansiRgb(c.rosewater),
    neutral: ansiRgb(neutral),
  };
}

export function getPngColors(theme: ThemeName = 'macchiato'): {
  text: Rgb;
  bg: Rgb;
  highlightText: Rgb;
} {
  const c = getColors(theme);
  return { text: c.text, bg: c.base, highlightText: c.crust };
}

function ansiRgb([r, g, b]: Rgb): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

const RESET = '\x1b[0m';

export const FIELD_CATEGORY: Record<string, string> = {
  low_odds: 'yesno',
  even_odds: 'yesno',
  hi_odds: 'yesno',
  d4: 'neutral',
  d6: 'neutral',
  d8: 'neutral',
  d12: 'neutral',
  d20: 'neutral',
  d00: 'neutral',
  action: 'neutral',
  detail: 'neutral',
  topic: 'neutral',
  objective: 'positive',
  adversaries: 'negative',
  focus: 'neutral',
  name: 'neutral',
  job: 'negative',
  goal: 'positive',
  virtue: 'positive',
  vice: 'negative',
};

const FIELD_POSITIONS: [number, number, number, string][] = [
  [1, 5, 2, 'low_odds'],
  [1, 12, 1, 'd4'],
  [1, 19, 2, 'd12'],
  [2, 5, 2, 'even_odds'],
  [2, 12, 1, 'd6'],
  [2, 19, 2, 'd20'],
  [3, 5, 2, 'hi_odds'],
  [3, 12, 1, 'd8'],
  [3, 19, 2, 'd00'],
  [5, 1, 6, 'action'],
  [5, 8, 6, 'detail'],
  [5, 15, 6, 'topic'],
  [7, 4, 17, 'objective'],
  [8, 4, 17, 'adversaries'],
  [9, 4, 17, 'focus'],
  [11, 4, 17, 'name'],
  [12, 4, 17, 'job'],
  [13, 4, 17, 'goal'],
  [15, 4, 17, 'virtue'],
  [16, 4, 17, 'vice'],
];

function buildPositionMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [line, col, length, fieldName] of FIELD_POSITIONS) {
    for (let i = 0; i < length; i++) {
      map.set(`${line},${col + i}`, fieldName);
    }
  }
  return map;
}

const POSITION_MAP = buildPositionMap();

function buildYesnoPrimaries(): Map<string, [number, number]> {
  const primaries = new Map<string, [number, number]>();
  for (const [line, col, length, fieldName] of FIELD_POSITIONS) {
    if (FIELD_CATEGORY[fieldName] === 'yesno') {
      for (let i = 0; i < length; i++) {
        primaries.set(`${line},${col + i}`, [line, col]);
      }
    }
  }
  return primaries;
}

const YESNO_PRIMARIES = buildYesnoPrimaries();

function resolveCategory(
  lineIdx: number,
  colIdx: number,
  fieldName: string,
  cardLines: string[],
): string {
  const cat = FIELD_CATEGORY[fieldName] ?? 'neutral';
  if (cat !== 'yesno') return cat;
  const char = cardLines[lineIdx]?.[colIdx] ?? '';
  if (char === 'Y' || char === 'N') return char === 'Y' ? 'positive' : 'negative';
  const primary = YESNO_PRIMARIES.get(`${lineIdx},${colIdx}`);
  if (primary) {
    const [pl, pc] = primary;
    const firstChar = cardLines[pl]?.[pc] ?? '';
    return firstChar === 'Y' ? 'positive' : 'negative';
  }
  return 'neutral';
}

export function getFieldColor(
  lineIdx: number,
  colIdx: number,
  cardLines: string[],
  palette?: Record<string, Rgb>,
  theme: ThemeName = 'macchiato',
): Rgb | null {
  if (!palette) palette = getPalette(theme);
  const fieldName = POSITION_MAP.get(`${lineIdx},${colIdx}`);
  if (!fieldName) return null;
  const cat = resolveCategory(lineIdx, colIdx, fieldName, cardLines);
  return palette[cat] ?? palette.neutral;
}

export const TEMPLATE_TEXT = '┌────────────────────┐\n' +
  '│low:@@  d4 @  d12 @@│\n' +
  '├───:@@  d6 @  d20 @@│\n' +
  '│hi :@@  d8 @  d00 @@│\n' +
  '│                    │\n' +
  '│@@@@@@ @@@@@@ @@@@@@│\n' +
  '│                    │\n' +
  '│OB:@@@@@@@@@@@@@@@@@│\n' +
  '│AD:@@@@@@@@@@@@@@@@@│\n' +
  '│EV:@@@@@@@@@@@@@@@@@│\n' +
  '│                    │\n' +
  '│NM:@@@@@@@@@@@@@@@@@│\n' +
  '│JB:@@@@@@@@@@@@@@@@@│\n' +
  '│GL:@@@@@@@@@@@@@@@@@│\n' +
  '│                    │\n' +
  '│VT:@@@@@@@@@@@@@@@@@│\n' +
  '│VC:@@@@@@@@@@@@@@@@@│\n' +
  '└────────────────────┘';

export function colorizeCard(
  cardText: string,
  palette?: Record<string, string>,
  theme: ThemeName = 'macchiato',
): string {
  if (!palette) palette = getTerminalPalette(theme);
  const cardLines = cardText.split('\n');
  const templateLines = TEMPLATE_TEXT.split('\n');
  const parts: string[] = [];

  for (let li = 0; li < cardLines.length; li++) {
    const cardLine = cardLines[li];
    const templLine = templateLines[li] ?? '';
    let currentColor = '';
    let currentText = '';

    for (let ci = 0; ci < cardLine.length; ci++) {
      const char = cardLine[ci];
      const baseChar = templLine[ci] ?? char;
      let colorCode = '';

      if (char !== baseChar) {
        const fieldName = POSITION_MAP.get(`${li},${ci}`);
        if (fieldName) {
          const cat = resolveCategory(li, ci, fieldName, cardLines);
          colorCode = palette[cat] ?? palette.neutral;
        }
      }

      if (colorCode === currentColor) {
        currentText += char;
      } else {
        if (currentText) {
          parts.push(currentColor ? `${currentColor}${currentText}${RESET}` : currentText);
        }
        currentColor = colorCode;
        currentText = char;
      }
    }

    if (currentText) {
      parts.push(currentColor ? `${currentColor}${currentText}${RESET}` : currentText);
    }
    parts.push('\n');
  }

  return parts.join('');
}
