import { generateText } from './text_generator.ts';
import { buildGenData, type Layout } from './oracle_data.ts';

const _genData = new Map<Layout, Record<string, unknown>>();

export function getGenData(layout: Layout = 'portrait'): Record<string, unknown> {
  if (!_genData.has(layout)) {
    _genData.set(layout, buildGenData(layout));
  }
  return _genData.get(layout)!;
}

export function resetGenData(): void {
  _genData.clear();
}

export function generateCard(layout: Layout = 'portrait'): string {
  const genData = getGenData(layout);
  return generateText('card', genData) ?? '';
}
