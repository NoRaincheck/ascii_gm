import {
  colorizeCard,
  FIELD_CATEGORY,
  type ThemeName,
  getTerminalPalette,
  TEMPLATE_TEXT,
} from './theme.ts';

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

const GAP = '    ';

export function printCard(cardText: string, theme: ThemeName = 'macchiato', artText?: string): void {
  if (!artText) {
    const output = colorizeCard(cardText, undefined, theme);
    console.log(output);
    return;
  }

  const cardLines = cardText.split('\n');
  const artLines = artText.split('\n');

  const maxLines = Math.max(cardLines.length, artLines.length);
  const output: string[] = [];

  for (let i = 0; i < maxLines; i++) {
    const cardLine = cardLines[i] ?? '';
    const artLine = artLines[i] ?? '';

    const colorizedCard = colorizeCardLine(cardLine, i, cardLines, theme);
    const colorizedArt = colorizeArtLine(artLine);

    output.push(colorizedCard + GAP + colorizedArt);
  }

  console.log(output.join('\n'));
}

function colorizeCardLine(
  line: string,
  lineIdx: number,
  cardLines: string[],
  theme: ThemeName,
): string {
  const RESET = '\x1b[0m';
  const palette = getTerminalPalette(theme);
  const templateLines = TEMPLATE_TEXT.split('\n');
  const templLine = templateLines[lineIdx] ?? '';

  const parts: string[] = [];
  let currentColor = '';
  let currentText = '';

  for (let ci = 0; ci < line.length; ci++) {
    const char = line[ci];
    const baseChar = templLine[ci] ?? char;
    let colorCode = '';

    if (char !== baseChar) {
      const fieldName = getFieldName(lineIdx, ci);
      if (fieldName) {
        const cat = resolveCategory(lineIdx, ci, fieldName, cardLines);
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

  return parts.join('');
}

function colorizeArtLine(line: string): string {
  const RESET = '\x1b[0m';
  const ART_COLOR = '\x1b[38;2;108;112;134m';

  if (!line.trim()) return line;

  return `${ART_COLOR}${line}${RESET}`;
}

function getFieldName(lineIdx: number, colIdx: number): string | null {
  for (const [line, col, width, fieldName] of FIELD_POSITIONS) {
    if (line === lineIdx && colIdx >= col && colIdx < col + width) {
      return fieldName;
    }
  }
  return null;
}

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

  return 'neutral';
}
