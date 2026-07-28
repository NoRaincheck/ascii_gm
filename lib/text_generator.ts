import { random, randomInt } from "./rng.ts";

export function keyRange(key: string): [number, number] {
  const m00 = key.match(/^(\d+)-00$/);
  if (m00) return [parseInt(m00[1]), 100];
  const mr = key.match(/^(\d+)-(\d+)$/);
  if (mr) return [parseInt(mr[1]), parseInt(mr[2])];
  if (key === "00") return [100, 100];
  return [parseInt(key), parseInt(key)];
}

function scaleTable(table: Record<string, unknown>): number {
  let max = 0;
  for (const key of Object.keys(table)) {
    const r = keyRange(key);
    max = Math.max(max, r[1]);
  }
  return max;
}

function selectFromArray<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

function selectFromTable(table: Record<string, unknown>): unknown {
  const len = scaleTable(table);
  if (!len) return "";
  const idx = Math.floor(random() * len) + 1;
  for (const key of Object.keys(table)) {
    const r = keyRange(key);
    if (idx >= r[0] && idx <= r[1]) return table[key];
  }
  return "";
}

function selectFrom(input: unknown): unknown {
  if (Array.isArray(input)) return selectFromArray(input);
  return selectFromTable(input as Record<string, unknown>);
}

function expandTokens(string: string, genData: Record<string, unknown>): string {
  let result = string;
  let match = result.match(/{(\w+)}/);
  while (match) {
    const token = match[1];
    const repl = generateText(token, genData);
    result = result.replace(`{${token}}`, repl ?? token);
    match = result.match(/{(\w+)}/);
  }
  return result;
}

export function generateText(inputType: string, genData: Record<string, unknown>): string | null {
  const list = genData[inputType];
  if (list) {
    const string = selectFrom(list);
    if (string) return expandTokens(string as string, genData);
  }
  return null;
}

export function generateList(inputType: string, n: number, genData: Record<string, unknown>): (string | null)[] {
  const results: (string | null)[] = [];
  for (let i = 0; i < n; i++) {
    results.push(generateText(inputType, genData));
  }
  return results;
}
