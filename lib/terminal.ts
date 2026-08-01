import { colorizeCard, type ThemeName } from './theme.ts';
import type { Layout } from './oracle_data.ts';

export function printCard(
  cardText: string,
  theme: ThemeName = 'macchiato',
  layout: Layout = 'portrait',
): void {
  const output = colorizeCard(cardText, undefined, theme, layout);
  console.log(output);
}
