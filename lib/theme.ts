import type { Layout } from './oracle_data.ts';

export type Rgb = [number, number, number];
export type ThemeName = 'macchiato' | 'latte';

const MACCHIATO_COLORS: Record<string, Rgb> = {
  crust: [24, 23, 38],
  base: [36, 39, 58],
  overlay0: [108, 112, 134],
  text: [202, 211, 245],
  blue: [138, 173, 244],
  rosewater: [245, 169, 185],
  peach: [245, 194, 117],
};

const LATTE_COLORS: Record<string, Rgb> = {
  crust: [220, 213, 197],
  base: [239, 232, 218],
  overlay0: [156, 150, 136],
  text: [76, 79, 105],
  blue: [30, 102, 245],
  rosewater: [220, 138, 120],
  peach: [254, 128, 25],
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
    peach: c.peach,
  };
}

export function getTerminalPalette(theme: ThemeName = 'macchiato'): Record<string, string> {
  const c = getColors(theme);
  const neutral = theme === 'macchiato' ? c.crust : c.overlay0;
  return {
    positive: ansiRgb(c.blue),
    negative: ansiRgb(c.rosewater),
    neutral: ansiRgb(neutral),
    peach: ansiRgb(c.peach),
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

export const LANDSCAPE_FIELD_CATEGORY: Record<string, string> = {
  d4: 'neutral',
  d6: 'neutral',
  d8: 'neutral',
  d10: 'neutral',
  d12: 'neutral',
  d20: 'neutral',
  d100: 'neutral',
  action: 'neutral',
  detail: 'neutral',
  topic: 'neutral',
  objective: 'positive',
  adversaries: 'negative',
  name: 'neutral',
  job: 'negative',
  virtue: 'positive',
  vice: 'negative',
};

const LANDSCAPE_FIELD_POSITIONS: [number, number, number, string][] = [
  [1, 6, 2, 'd4'],
  [1, 13, 2, 'd6'],
  [1, 20, 2, 'd8'],
  [1, 27, 2, 'd10'],
  [2, 8, 2, 'd12'],
  [2, 16, 2, 'd20'],
  [2, 24, 3, 'd100'],
  [4, 7, 6, 'action'],
  [4, 15, 6, 'detail'],
  [4, 23, 6, 'topic'],
  [5, 7, 22, 'objective'],
  [6, 7, 22, 'adversaries'],
  [7, 7, 6, 'name'],
  [7, 21, 7, 'job'],
  [8, 7, 6, 'virtue'],
  [8, 22, 6, 'vice'],
];

function getFieldPositions(layout: Layout): [number, number, number, string][] {
  return layout === 'landscape' ? LANDSCAPE_FIELD_POSITIONS : FIELD_POSITIONS;
}

function getFieldCategory(layout: Layout): Record<string, string> {
  return layout === 'landscape' ? LANDSCAPE_FIELD_CATEGORY : FIELD_CATEGORY;
}

function buildPositionMap(positions: [number, number, number, string][]): Map<string, string> {
  const map = new Map<string, string>();
  for (const [line, col, length, fieldName] of positions) {
    for (let i = 0; i < length; i++) {
      map.set(`${line},${col + i}`, fieldName);
    }
  }
  return map;
}

const POSITION_MAP = buildPositionMap(FIELD_POSITIONS);

const POSITION_MAPS = new Map<Layout, Map<string, string>>();

function getPositionMap(layout: Layout): Map<string, string> {
  if (layout === 'portrait') return POSITION_MAP;
  if (!POSITION_MAPS.has(layout)) {
    POSITION_MAPS.set(layout, buildPositionMap(getFieldPositions(layout)));
  }
  return POSITION_MAPS.get(layout)!;
}

function buildYesnoPrimaries(
  positions: [number, number, number, string][],
  category: Record<string, string>,
): Map<string, [number, number]> {
  const primaries = new Map<string, [number, number]>();
  for (const [line, col, length, fieldName] of positions) {
    if (category[fieldName] === 'yesno') {
      for (let i = 0; i < length; i++) {
        primaries.set(`${line},${col + i}`, [line, col]);
      }
    }
  }
  return primaries;
}

const YESNO_PRIMARIES = buildYesnoPrimaries(FIELD_POSITIONS, FIELD_CATEGORY);

const YESNO_PRIMARIES_MAPS = new Map<Layout, Map<string, [number, number]>>();

function getYesnoPrimaries(layout: Layout): Map<string, [number, number]> {
  if (layout === 'portrait') return YESNO_PRIMARIES;
  if (!YESNO_PRIMARIES_MAPS.has(layout)) {
    YESNO_PRIMARIES_MAPS.set(layout, buildYesnoPrimaries(getFieldPositions(layout), getFieldCategory(layout)));
  }
  return YESNO_PRIMARIES_MAPS.get(layout)!;
}

const DICE_MAX: Record<string, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d00: 99,
  d100: 100,
};

const DICE_SPANS = new Map<Layout, Map<string, [number, number, number]>>();

function getDiceSpans(layout: Layout): Map<string, [number, number, number]> {
  if (!DICE_SPANS.has(layout)) {
    const map = new Map<string, [number, number, number]>();
    for (const [line, col, length, fieldName] of getFieldPositions(layout)) {
      if (DICE_MAX[fieldName] !== undefined) {
        map.set(fieldName, [line, col, length]);
      }
    }
    DICE_SPANS.set(layout, map);
  }
  return DICE_SPANS.get(layout)!;
}

function resolveDiceCategory(fieldName: string, cardLines: string[], layout: Layout): string | null {
  const span = getDiceSpans(layout).get(fieldName);
  if (!span) return null;
  const [line, col, length] = span;
  const value = parseInt(cardLines[line]?.slice(col, col + length) ?? '', 10);
  if (Number.isNaN(value)) return null;
  const threshold = Math.ceil(DICE_MAX[fieldName] / 2);
  return value >= threshold ? 'positive' : 'peach';
}

function resolveCategory(
  lineIdx: number,
  colIdx: number,
  fieldName: string,
  cardLines: string[],
  layout: Layout,
): string {
  const cat = getFieldCategory(layout)[fieldName] ?? 'neutral';
  const diceCat = resolveDiceCategory(fieldName, cardLines, layout);
  if (diceCat) return diceCat;
  if (cat !== 'yesno') return cat;
  const char = cardLines[lineIdx]?.[colIdx] ?? '';
  if (char === 'Y' || char === 'N') return char === 'Y' ? 'positive' : 'negative';
  const primary = getYesnoPrimaries(layout).get(`${lineIdx},${colIdx}`);
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
  layout: Layout = 'portrait',
): Rgb | null {
  if (!palette) palette = getPalette(theme);
  const fieldName = getPositionMap(layout).get(`${lineIdx},${colIdx}`);
  if (!fieldName) return null;
  const cat = resolveCategory(lineIdx, colIdx, fieldName, cardLines, layout);
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

export const LANDSCAPE_TEMPLATE_TEXT = '┌────────────────────────────┐\n' +
  '│ D4 :@@ D6 :@@ D8 :@@ D10:@@│\n' +
  '│  D12 :@@ D20 :@@ D100:@@@  │\n' +
  '├────────────────────────────┤\n' +
  '│EVT:  @@@@@@  @@@@@@  @@@@@@│\n' +
  '│QST:  @@@@@@@@@@@@@@@@@@@@@@│\n' +
  '│FOE:  @@@@@@@@@@@@@@@@@@@@@@│\n' +
  '│NAME: @@@@@@   JOB: @@@@@@@ │\n' +
  '│VIRT: @@@@@@   VICE: @@@@@@ │\n' +
  '└────────────────────────────┘';

export function getTemplateText(layout: Layout = 'portrait'): string {
  return layout === 'landscape' ? LANDSCAPE_TEMPLATE_TEXT : TEMPLATE_TEXT;
}

export function colorizeCard(
  cardText: string,
  palette?: Record<string, string>,
  theme: ThemeName = 'macchiato',
  layout: Layout = 'portrait',
): string {
  if (!palette) palette = getTerminalPalette(theme);
  const cardLines = cardText.split('\n');
  const templateLines = getTemplateText(layout).split('\n');
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
        const fieldName = getPositionMap(layout).get(`${li},${ci}`);
        if (fieldName) {
          const cat = resolveCategory(li, ci, fieldName, cardLines, layout);
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
