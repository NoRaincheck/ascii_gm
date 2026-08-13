import { random, randomInt, shuffle } from './rng.ts';
import { generateText } from './text_generator.ts';

export type Layout = 'portrait' | 'landscape';

export interface OracleEntry {
  title: string;
  aliases: string[];
  results: Record<string, string>;
}

let _oracles: OracleEntry[] = [];

export function loadOracles(jsonPath?: string): OracleEntry[] {
  if (_oracles.length > 0) return _oracles;
  if (jsonPath) {
    _oracles = JSON.parse(Deno.readTextFileSync(jsonPath));
  } else {
    _oracles = JSON.parse(Deno.readTextFileSync('ironsworn_oracles.json'));
  }
  return _oracles;
}

export function setOracles(data: OracleEntry[]): void {
  _oracles = data;
}

export function getOracles(): OracleEntry[] {
  return _oracles;
}

function getItems(key: string): string[] {
  const oracle = _oracles.filter((x) => x.title === key);
  if (oracle.length === 0) return [];
  const oracleValues = Object.values(oracle[0].results);
  const filtered = oracleValues.filter((x) => !x.startsWith('Roll '));
  return shuffle(filtered);
}

function diceRange(num: number, pad = 0, start = 1): string[] {
  return Array.from({ length: num }, (_, i) => String(i + start).padStart(pad, '0'));
}

function splitList(aList: string[], size: number): string[][] {
  const chunkSize = Math.floor(aList.length / size);
  const result: string[][] = [];
  for (let i = 0; i < aList.length && result.length < size; i += chunkSize) {
    result.push(aList.slice(i, i + chunkSize));
  }
  return result;
}

// Shared event fields (action/detail/topic) — identical for both layouts
function buildEventFields(genData: Record<string, unknown>): void {
  genData['action'] = getItems('Action').filter((x) => x.length <= 6).map((x) => x.padEnd(6, ' '));
  genData['detail'] = getItems('Location Descriptors').filter((x) => x.length <= 6).map((x) => x.padEnd(6, ' '));
  genData['topic'] = getItems('Theme').filter((x) => x.length <= 6).map((x) => x.padEnd(6, ' '));
}

// Shared quest fields (objective/adversaries) — same content, different padding
function buildQuestFields(genData: Record<string, unknown>, padLen: number): void {
  const items = [
    'Remove a threat',
    'Learn the truth',
    'Recover valuable',
    'Escort to safety',
    'Restore broken',
    'Save ally peril',
  ];
  genData['objective'] = items.map((x) => x.padEnd(padLen, ' '));
  genData['adversaries'] = [
    'Powerful entity',
    'Outlaws',
    'Guardians',
    'Local inhabitant',
    'Enemy horde',
    'A villain',
  ].map((x) => x.padEnd(padLen, ' '));
}

// Shared focus generation (action × topic pairing)
function buildFocus(genData: Record<string, unknown>, padLen: number): void {
  const actionFocus = ['Seek', 'Oppose', 'Communicate', 'Move', 'Harm', 'Create', 'Reveal',
    'Command', 'Take', 'Protect', 'Assist', 'Transform', 'Deceive'];
  const topicFocus = ['Current Need', 'Allies', 'Community', 'History', 'Future Plans',
    'Enemies', 'Knowledge', 'Rumors', 'A Plot Arc', 'Recent Events', 'Equipment',
    'A Faction', 'The PCs'];
  genData['focus'] = shuffle(actionFocus)
    .map((a, i) => `${a}, ${shuffle(topicFocus)[i]}`)
    .filter((x) => x.length <= padLen)
    .map((x) => x.padEnd(padLen, ' '));
}

// Shared name generation (zipped first/last/middle)
function buildName(genData: Record<string, unknown>, padLen: number): void {
  const names = getItems('Ironlander Names');
  const chunks = splitList(names, 3);
  genData['name'] = Array.from(
    { length: chunks[0]?.length ?? 0 },
    (_, i) => chunks.map((c) => c[i]).join(', '),
  ).filter((x) => x.length <= padLen).map((x) => x.padEnd(padLen, ' '));
}

// Shared job generation (role + descriptor pairing)
function buildJob(genData: Record<string, unknown>, padLen: number): void {
  const roles = getItems('NPC Role');
  const descriptors = getItems('NPC Descriptors');
  genData['job'] = roles.map((r, i) => `${r}, ${descriptors[i % descriptors.length]}`)
    .filter((x) => x.length <= padLen)
    .map((x) => x.padEnd(padLen, ' '));
}

// Shared goal generation
function buildGoal(genData: Record<string, unknown>, padLen: number): void {
  genData['goal'] = getItems('Goals').filter((x) => x.length <= padLen).map((x) => x.padEnd(padLen, ' '));
}

// Card templates — single source of truth
export const PORTRAIT_TEMPLATE =
  '┌────────────────────┐\n' +
  '│low:{low_odds}  d4 {d4}  d12 {d12}│\n' +
  '├───:{even_odds}  d6 {d6}  d20 {d20}│\n' +
  '│hi :{hi_odds}  d8 {d8}  d00 {d00}│\n' +
  '│                    │\n' +
  '│{action} {detail} {topic}│\n' +
  '│                    │\n' +
  '│OB:{objective}│\n' +
  '│AD:{adversaries}│\n' +
  '│EV:{focus}│\n' +
  '│                    │\n' +
  '│NM:{name}│\n' +
  '│JB:{job}│\n' +
  '│GL:{goal}│\n' +
  '│                    │\n' +
  '│VT:{virtue}│\n' +
  '│VC:{vice}│\n' +
  '└────────────────────┘';

export const LANDSCAPE_TEMPLATE =
  '┌────────────────────────────┐\n' +
  '│ D4 :{d4} D6 :{d6} D8 :{d8} D10:{d10}│\n' +
  '│  D12 :{d12} D20 :{d20} D100:{d100}  │\n' +
  '├────────────────────────────┤\n' +
  '│EVT:  {action}  {detail}  {topic}│\n' +
  '│QST:  {objective}│\n' +
  '│FOE:  {adversaries}│\n' +
  '│NAME: {name}   JOB: {job} │\n' +
  '│VIRT: {virtue}   VICE: {vice} │\n' +
  '└────────────────────────────┘';

export function buildGenData(layout: Layout = 'portrait'): Record<string, unknown> {
  const genData: Record<string, unknown> = {};

  // Shared: event fields + quest fields + name + job + goal
  buildEventFields(genData);
  buildQuestFields(genData, layout === 'portrait' ? 17 : 22);

  if (layout === 'portrait') {
    // Portrait-specific: odds/dice + focus + virtue/vice
    genData['low_odds'] = ['{low_odd}{odds_modifier}'];
    genData['even_odds'] = ['{even_odd}{odds_modifier}'];
    genData['hi_odds'] = ['{hi_odd}{odds_modifier}'];
    genData['odds_modifier'] = { '1': '?', '2-5': ' ', '6': '!' };
    genData['low_odd'] = { '1-4': 'N', '5-6': 'Y' };
    genData['even_odd'] = { '1-3': 'N', '4-6': 'Y' };
    genData['hi_odd'] = { '1-2': 'N', '3-6': 'Y' };

    genData['d4'] = diceRange(4);
    genData['d6'] = diceRange(6);
    genData['d8'] = diceRange(8);
    genData['d12'] = diceRange(12, 2);
    genData['d20'] = diceRange(20, 2);
    genData['d00'] = diceRange(100, 2, 0);

    buildFocus(genData, 17);
    buildName(genData, 17);
    buildJob(genData, 17);
    buildGoal(genData, 17);
    genData['virtue'] = ['Ambitious', 'Courageous', 'Disciplined', 'Honorable', 'Serene',
      'Merciful', 'Humble', 'Tolerant', 'Gregarious', 'Cautious'].map((x) => x.padEnd(17, ' '));
    genData['vice'] = ['Aggressive', 'Bitter', 'Craven', 'Deceitful', 'Greedy',
      'Vengeful', 'Lazy', 'Nervous', 'Rude', 'Vain'].map((x) => x.padEnd(17, ' '));
    genData['card'] = [PORTRAIT_TEMPLATE];
  } else {
    // Landscape-specific: dice + virtue/vice
    genData['d4'] = diceRange(4, 2);
    genData['d6'] = diceRange(6, 2);
    genData['d8'] = diceRange(8, 2);
    genData['d10'] = diceRange(10, 2);
    genData['d12'] = diceRange(12, 2);
    genData['d20'] = diceRange(20, 2);
    genData['d100'] = diceRange(100, 3, 1);

    buildName(genData, 6);
    buildJob(genData, 7);
    genData['virtue'] = ['Honest', 'Loyal', 'Brave', 'Calm', 'Wise', 'Bold', 'Just',
      'Serene', 'Humble', 'Kind', 'Fierce', 'Quick', 'Clever', 'Noble', 'Steady', 'Keen']
      .map((x) => x.padEnd(6, ' '));
    genData['vice'] = ['Greedy', 'Lazy', 'Rude', 'Vain', 'Bitter', 'Craven', 'Coward',
      'Proud', 'Harsh', 'Moody', 'Cruel', 'Fickle', 'Sly', 'Grim', 'Wild', 'Mean']
      .map((x) => x.padEnd(6, ' '));
    genData['card'] = [LANDSCAPE_TEMPLATE];
  }

  return genData;
}
