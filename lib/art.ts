import * as pieces from './art/mod.ts';
import { TEMPLATE_TEXT } from './theme.ts';

const ART_WIDTH = 22;
const ART_HEIGHT = 18;

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

const ART_PIECES: Record<string, string> = {
  castle: pieces.castle,
  village: pieces.village,
  forest: pieces.forest,
  mountain: pieces.mountain,
  figure: pieces.figure,
  action_scene: pieces.action_scene,
  symbolic: pieces.symbolic,
  danger: pieces.danger,
  ruins: pieces.ruins,
  water: pieces.water,
};

const LOCATION_KEYWORDS: Record<string, string> = {
  forest: 'forest',
  grove: 'forest',
  thicket: 'forest',
  woods: 'forest',
  tree: 'forest',
  mountain: 'mountain',
  ridge: 'mountain',
  cliff: 'mountain',
  hill: 'mountain',
  foothills: 'mountain',
  river: 'water',
  lake: 'water',
  waterfall: 'water',
  bay: 'water',
  fjord: 'water',
  pond: 'water',
  rapids: 'water',
  coastal: 'water',
  ford: 'water',
  village: 'village',
  steading: 'village',
  camp: 'village',
  hovel: 'village',
  settlement: 'village',
  ruin: 'ruins',
  cairn: 'ruins',
  grave: 'ruins',
  mine: 'ruins',
  hovel: 'ruins',
  fortress: 'castle',
  fort: 'castle',
  wall: 'castle',
  outpost: 'castle',
  hideout: 'castle',
  lair: 'castle',
};

const ACTION_KEYWORDS: Record<string, string> = {
  clash: 'action_scene',
  assault: 'action_scene',
  attack: 'action_scene',
  raid: 'action_scene',
  defeat: 'action_scene',
  battle: 'action_scene',
  combat: 'action_scene',
  strike: 'action_scene',
  charge: 'action_scene',
  fight: 'action_scene',
  scheme: 'symbolic',
  manipulate: 'symbolic',
  deceive: 'symbolic',
  trick: 'symbolic',
  lie: 'symbolic',
  investigate: 'symbolic',
  inspect: 'symbolic',
  examine: 'symbolic',
  search: 'symbolic',
  uncover: 'symbolic',
  reveal: 'symbolic',
  learn: 'symbolic',
  discover: 'symbolic',
  find: 'symbolic',
  locate: 'symbolic',
  explore: 'symbolic',
};

const TOPIC_KEYWORDS: Record<string, string> = {
  hope: 'symbolic',
  faith: 'symbolic',
  spirit: 'symbolic',
  destiny: 'symbolic',
  fate: 'symbolic',
  honor: 'symbolic',
  duty: 'symbolic',
  law: 'symbolic',
  bond: 'symbolic',
  love: 'symbolic',
  fear: 'danger',
  danger: 'danger',
  death: 'danger',
  corruption: 'danger',
  ruin: 'danger',
  destruction: 'danger',
  war: 'danger',
  blood: 'danger',
  revenge: 'danger',
  vengeance: 'danger',
  hate: 'danger',
  enemy: 'danger',
  threat: 'danger',
  peril: 'danger',
  warning: 'danger',
  curse: 'danger',
};

const OBJECTIVE_KEYWORDS: Record<string, string> = {
  threat: 'castle',
  secure: 'castle',
  protect: 'castle',
  defend: 'castle',
  guard: 'castle',
  fortify: 'castle',
  siege: 'castle',
  escort: 'village',
  safety: 'village',
  rescue: 'village',
  save: 'village',
  shelter: 'village',
  refuge: 'village',
  truth: 'symbolic',
  learn: 'symbolic',
  discover: 'symbolic',
  reveal: 'symbolic',
  knowledge: 'symbolic',
  restore: 'ruins',
  rebuild: 'ruins',
  repair: 'ruins',
  fix: 'ruins',
  broken: 'ruins',
  recover: 'symbolic',
  valuable: 'symbolic',
  treasure: 'symbolic',
  prize: 'symbolic',
};

const JOB_KEYWORDS: Record<string, string> = {
  blacksmith: 'figure',
  armorer: 'figure',
  smith: 'figure',
  craftsman: 'figure',
  artisan: 'figure',
  builder: 'figure',
  mason: 'figure',
  carpenter: 'figure',
  healer: 'figure',
  physician: 'figure',
  medic: 'figure',
  doctor: 'figure',
  hunter: 'figure',
  ranger: 'figure',
  scout: 'figure',
  tracker: 'figure',
  guardian: 'figure',
  sentinel: 'figure',
  warden: 'figure',
  protector: 'figure',
  warrior: 'figure',
  fighter: 'figure',
  soldier: 'figure',
  knight: 'figure',
  mage: 'symbolic',
  wizard: 'symbolic',
  sorcerer: 'symbolic',
  priest: 'symbolic',
  cleric: 'symbolic',
  scholar: 'symbolic',
  sage: 'symbolic',
  merchant: 'village',
  trader: 'village',
  shopkeeper: 'village',
  innkeeper: 'village',
  farmer: 'village',
  peasant: 'village',
  villager: 'village',
  villager: 'village',
};

const ADVERSARY_KEYWORDS: Record<string, string> = {
  entity: 'danger',
  powerful: 'danger',
  horde: 'danger',
  swarm: 'danger',
  army: 'danger',
  villain: 'danger',
  enemy: 'danger',
  foe: 'danger',
  beast: 'danger',
  monster: 'danger',
  creature: 'danger',
  beast: 'danger',
  undead: 'danger',
  spirit: 'danger',
  ghost: 'danger',
  demon: 'danger',
  dragon: 'danger',
  wyrm: 'danger',
  serpent: 'danger',
  outlaws: 'danger',
  bandits: 'danger',
  brigands: 'danger',
  raiders: 'danger',
  marauders: 'danger',
  guardians: 'castle',
  sentinels: 'castle',
  watchers: 'castle',
  protectors: 'castle',
  defenders: 'castle',
  inhabitant: 'village',
  local: 'village',
  resident: 'village',
  dweller: 'village',
};

function mapFieldToArt(fieldName: string, value: string): string | null {
  const lowerValue = value.toLowerCase().trim();

  let keywordMap: Record<string, string>;

  switch (fieldName) {
    case 'action':
      keywordMap = ACTION_KEYWORDS;
      break;
    case 'detail':
      keywordMap = LOCATION_KEYWORDS;
      break;
    case 'topic':
      keywordMap = TOPIC_KEYWORDS;
      break;
    case 'objective':
      keywordMap = OBJECTIVE_KEYWORDS;
      break;
    case 'job':
      keywordMap = JOB_KEYWORDS;
      break;
    case 'adversaries':
      keywordMap = ADVERSARY_KEYWORDS;
      break;
    default:
      return null;
  }

  for (const [keyword, artId] of Object.entries(keywordMap)) {
    if (lowerValue.includes(keyword)) {
      return artId;
    }
  }

  return null;
}

function parseFieldValue(cardText: string, fieldName: string): string {
  const templateLines = TEMPLATE_TEXT.split('\n');
  const cardLines = cardText.split('\n');

  for (const [line, col, width, name] of FIELD_POSITIONS) {
    if (name === fieldName) {
      const cardLine = cardLines[line] ?? '';
      const value = cardLine.substring(col, col + width);
      return value.trim();
    }
  }

  return '';
}

function parseArtLines(artText: string): string[] {
  const lines = artText.split('\n');
  while (lines.length < ART_HEIGHT) {
    lines.push(' '.repeat(ART_WIDTH));
  }
  return lines.slice(0, ART_HEIGHT).map((l) => l.padEnd(ART_WIDTH, ' ').substring(0, ART_WIDTH));
}

function composeArt(artPieces: { id: string; category: string }[]): string {
  const grid: string[][] = [];
  for (let y = 0; y < ART_HEIGHT; y++) {
    grid.push(new Array(ART_WIDTH).fill(' '));
  }

  const priority = ['water', 'forest', 'mountain', 'ruins', 'village', 'castle', 'action_scene', 'symbolic', 'figure', 'danger'];

  const sorted = artPieces.sort((a, b) => {
    const ai = priority.indexOf(a.id);
    const bi = priority.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const { id } of sorted) {
    const artText = ART_PIECES[id];
    if (!artText) continue;

    const artLines = parseArtLines(artText);

    for (let y = 0; y < ART_HEIGHT; y++) {
      for (let x = 0; x < ART_WIDTH; x++) {
        const ch = artLines[y][x];
        if (ch !== ' ') {
          grid[y][x] = ch;
        }
      }
    }
  }

  return grid.map((line) => line.join('')).join('\n');
}

export function generateArt(cardText: string): string {
  const fields = ['detail', 'topic', 'action', 'objective', 'job', 'adversaries'];
  const artPieces: { id: string; category: string }[] = [];

  for (const field of fields) {
    const value = parseFieldValue(cardText, field);
    if (!value) continue;

    const artId = mapFieldToArt(field, value);
    if (artId && ART_PIECES[artId]) {
      artPieces.push({ id: artId, category: field });
    }
  }

  if (artPieces.length === 0) {
    return Array(ART_HEIGHT).fill(' '.repeat(ART_WIDTH)).join('\n');
  }

  return composeArt(artPieces);
}
