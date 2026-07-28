import { random, randomInt } from './rng.ts';
import { generateText } from './text_generator.ts';

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

function randomShuffle<T>(val: T[]): T[] {
  const arr = [...val];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getItems(key: string): string[] {
  const oracle = _oracles.filter((x) => x.title === key);
  if (oracle.length === 0) return [];
  const oracleValues = Object.values(oracle[0].results);
  const filtered = oracleValues.filter((x) => !x.startsWith('Roll '));
  return randomShuffle(filtered);
}

function diceRange(num: number): string[] {
  return Array.from({ length: num }, (_, i) => String(i + 1));
}

function splitList(aList: string[], size: number): string[][] {
  const chunkSize = Math.floor(aList.length / size);
  const result: string[][] = [];
  for (let i = 0; i < aList.length && result.length < size; i += chunkSize) {
    result.push(aList.slice(i, i + chunkSize));
  }
  return result;
}

export function buildGenData(): Record<string, unknown> {
  const genData: Record<string, unknown> = {};

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
  genData['d12'] = diceRange(12).map((x) => x.padStart(2, '0'));
  genData['d20'] = diceRange(20).map((x) => x.padStart(2, '0'));
  genData['d00'] = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));

  genData['action'] = getItems('Action')
    .filter((x) => x.length <= 6)
    .map((x) => x.padEnd(6, ' '));
  genData['detail'] = getItems('Location Descriptors')
    .filter((x) => x.length <= 6)
    .map((x) => x.padEnd(6, ' '));
  genData['topic'] = getItems('Theme')
    .filter((x) => x.length <= 6)
    .map((x) => x.padEnd(6, ' '));

  genData['objective'] = [
    'Remove a threat',
    'Learn the truth',
    'Recover valuable',
    'Escort to safety',
    'Restore broken',
    'Save ally peril',
  ].map((x) => x.padEnd(17, ' '));

  genData['adversaries'] = [
    'Powerful entity',
    'Outlaws',
    'Guardians',
    'Local inhabitant',
    'Enemy horde',
    'A villain',
  ].map((x) => x.padEnd(17, ' '));

  const actionFocus = [
    'Seek',
    'Oppose',
    'Communicate',
    'Move',
    'Harm',
    'Create',
    'Reveal',
    'Command',
    'Take',
    'Protect',
    'Assist',
    'Transform',
    'Deceive',
  ];

  const topicFocus = [
    'Current Need',
    'Allies',
    'Community',
    'History',
    'Future Plans',
    'Enemies',
    'Knowledge',
    'Rumors',
    'A Plot Arc',
    'Recent Events',
    'Equipment',
    'A Faction',
    'The PCs',
  ];

  const shuffledActions = randomShuffle(actionFocus);
  const shuffledTopics = randomShuffle(topicFocus);
  genData['focus'] = shuffledActions
    .map((a, i) => `${a}, ${shuffledTopics[i]}`)
    .filter((x) => x.length <= 17)
    .map((x) => x.padEnd(17, ' '));

  const names = getItems('Ironlander Names');
  const nameChunks = splitList(names, 3);
  const zippedNames: string[] = [];
  for (let i = 0; i < nameChunks[0]?.length; i++) {
    zippedNames.push(nameChunks.map((chunk) => chunk[i]).join(', '));
  }
  genData['name'] = zippedNames
    .filter((x) => x.length <= 17)
    .map((x) => x.padEnd(17, ' '));

  const roles = getItems('NPC Role');
  const descriptors = getItems('NPC Descriptors');
  genData['job'] = roles
    .map((r, i) => `${r}, ${descriptors[i % descriptors.length]}`)
    .filter((x) => x.length <= 17)
    .map((x) => x.padEnd(17, ' '));

  genData['goal'] = getItems('Goals')
    .filter((x) => x.length <= 17)
    .map((x) => x.padEnd(17, ' '));

  genData['virtue'] = [
    'Ambitious',
    'Courageous',
    'Disciplined',
    'Honorable',
    'Serene',
    'Merciful',
    'Humble',
    'Tolerant',
    'Gregarious',
    'Cautious',
  ].map((x) => x.padEnd(17, ' '));

  genData['vice'] = [
    'Aggressive',
    'Bitter',
    'Craven',
    'Deceitful',
    'Greedy',
    'Vengeful',
    'Lazy',
    'Nervous',
    'Rude',
    'Vain',
  ].map((x) => x.padEnd(17, ' '));

  genData['card'] = [
    [
      '┌────────────────────┐',
      '│low:{low_odds}  d4 {d4}  d12 {d12}│',
      '├───:{even_odds}  d6 {d6}  d20 {d20}│',
      '│hi :{hi_odds}  d8 {d8}  d00 {d00}│',
      '│                    │',
      '│{action} {detail} {topic}│',
      '│                    │',
      '│OB:{objective}│',
      '│AD:{adversaries}│',
      '│EV:{focus}│',
      '│                    │',
      '│NM:{name}│',
      '│JB:{job}│',
      '│GL:{goal}│',
      '│                    │',
      '│VT:{virtue}│',
      '│VC:{vice}│',
      '└────────────────────┘',
    ].join('\n'),
  ];

  return genData;
}
