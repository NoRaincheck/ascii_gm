import { generateText } from './text_generator.ts';
import { buildGenData } from './oracle_data.ts';
import { generateArt } from './art.ts';

let _genData: Record<string, unknown> | null = null;

export function getGenData(): Record<string, unknown> {
  if (!_genData) {
    _genData = buildGenData();
  }
  return _genData;
}

export function resetGenData(): void {
  _genData = null;
}

export function generateCard(): string {
  const genData = getGenData();
  return generateText('card', genData) ?? '';
}

export { generateArt };
