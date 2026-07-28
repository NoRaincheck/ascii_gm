import { colorizeCard, type ThemeName } from './theme.ts';

export function printCard(cardText: string, theme: ThemeName = 'macchiato'): void {
  const output = colorizeCard(cardText, undefined, theme);
  console.log(output);
}
