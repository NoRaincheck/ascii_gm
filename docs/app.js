// lib/rng.ts
var _seed = null;
var _state = 0;
function mulberry32(state) {
  state |= 0;
  state = state + 1831565813 | 0;
  let t = Math.imul(state ^ state >>> 15, 1 | state);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function random() {
  if (_seed !== null) {
    _state = _state + 1831565813 | 0;
    return mulberry32(_state);
  }
  return Math.random();
}

// lib/text_generator.ts
function keyRange(key) {
  const m00 = key.match(/^(\d+)-00$/);
  if (m00) return [parseInt(m00[1]), 100];
  const mr = key.match(/^(\d+)-(\d+)$/);
  if (mr) return [parseInt(mr[1]), parseInt(mr[2])];
  if (key === "00") return [100, 100];
  return [parseInt(key), parseInt(key)];
}
function scaleTable(table) {
  let max = 0;
  for (const key of Object.keys(table)) {
    const r = keyRange(key);
    max = Math.max(max, r[1]);
  }
  return max;
}
function selectFromArray(arr) {
  return arr[Math.floor(random() * arr.length)];
}
function selectFromTable(table) {
  const len = scaleTable(table);
  if (!len) return "";
  const idx = Math.floor(random() * len) + 1;
  for (const key of Object.keys(table)) {
    const r = keyRange(key);
    if (idx >= r[0] && idx <= r[1]) return table[key];
  }
  return "";
}
function selectFrom(input) {
  if (Array.isArray(input)) return selectFromArray(input);
  return selectFromTable(input);
}
function expandTokens(string, genData) {
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
function generateText(inputType, genData) {
  const list = genData[inputType];
  if (list) {
    const string = selectFrom(list);
    if (string) return expandTokens(string, genData);
  }
  return null;
}

// lib/oracle_data.ts
var _oracles = [];
function setOracles(data) {
  _oracles = data;
}
function randomShuffle(val) {
  const arr = [...val];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function getItems(key) {
  const oracle = _oracles.filter((x) => x.title === key);
  if (oracle.length === 0) return [];
  const oracleValues = Object.values(oracle[0].results);
  const filtered = oracleValues.filter((x) => !x.startsWith("Roll "));
  return randomShuffle(filtered);
}
function diceRange(num) {
  return Array.from({ length: num }, (_, i) => String(i + 1));
}
function splitList(aList, size) {
  const chunkSize = Math.floor(aList.length / size);
  const result = [];
  for (let i = 0; i < aList.length && result.length < size; i += chunkSize) {
    result.push(aList.slice(i, i + chunkSize));
  }
  return result;
}
function buildGenData(layout = "portrait") {
  if (layout === "landscape") return buildLandscapeGenData();
  return buildPortraitGenData();
}
function buildPortraitGenData() {
  const genData = {};
  genData["low_odds"] = ["{low_odd}{odds_modifier}"];
  genData["even_odds"] = ["{even_odd}{odds_modifier}"];
  genData["hi_odds"] = ["{hi_odd}{odds_modifier}"];
  genData["odds_modifier"] = { "1": "?", "2-5": " ", "6": "!" };
  genData["low_odd"] = { "1-4": "N", "5-6": "Y" };
  genData["even_odd"] = { "1-3": "N", "4-6": "Y" };
  genData["hi_odd"] = { "1-2": "N", "3-6": "Y" };
  genData["d4"] = diceRange(4);
  genData["d6"] = diceRange(6);
  genData["d8"] = diceRange(8);
  genData["d12"] = diceRange(12).map((x) => x.padStart(2, "0"));
  genData["d20"] = diceRange(20).map((x) => x.padStart(2, "0"));
  genData["d00"] = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, "0"));
  genData["action"] = getItems("Action").filter((x) => x.length <= 6).map((x) => x.padEnd(6, " "));
  genData["detail"] = getItems("Location Descriptors").filter((x) => x.length <= 6).map((x) => x.padEnd(6, " "));
  genData["topic"] = getItems("Theme").filter((x) => x.length <= 6).map((x) => x.padEnd(6, " "));
  genData["objective"] = [
    "Remove a threat",
    "Learn the truth",
    "Recover valuable",
    "Escort to safety",
    "Restore broken",
    "Save ally peril"
  ].map((x) => x.padEnd(17, " "));
  genData["adversaries"] = [
    "Powerful entity",
    "Outlaws",
    "Guardians",
    "Local inhabitant",
    "Enemy horde",
    "A villain"
  ].map((x) => x.padEnd(17, " "));
  const actionFocus = [
    "Seek",
    "Oppose",
    "Communicate",
    "Move",
    "Harm",
    "Create",
    "Reveal",
    "Command",
    "Take",
    "Protect",
    "Assist",
    "Transform",
    "Deceive"
  ];
  const topicFocus = [
    "Current Need",
    "Allies",
    "Community",
    "History",
    "Future Plans",
    "Enemies",
    "Knowledge",
    "Rumors",
    "A Plot Arc",
    "Recent Events",
    "Equipment",
    "A Faction",
    "The PCs"
  ];
  const shuffledActions = randomShuffle(actionFocus);
  const shuffledTopics = randomShuffle(topicFocus);
  genData["focus"] = shuffledActions.map((a, i) => `${a}, ${shuffledTopics[i]}`).filter((x) => x.length <= 17).map((x) => x.padEnd(17, " "));
  const names = getItems("Ironlander Names");
  const nameChunks = splitList(names, 3);
  const zippedNames = [];
  for (let i = 0; i < nameChunks[0]?.length; i++) {
    zippedNames.push(nameChunks.map((chunk) => chunk[i]).join(", "));
  }
  genData["name"] = zippedNames.filter((x) => x.length <= 17).map((x) => x.padEnd(17, " "));
  const roles = getItems("NPC Role");
  const descriptors = getItems("NPC Descriptors");
  genData["job"] = roles.map((r, i) => `${r}, ${descriptors[i % descriptors.length]}`).filter((x) => x.length <= 17).map((x) => x.padEnd(17, " "));
  genData["goal"] = getItems("Goals").filter((x) => x.length <= 17).map((x) => x.padEnd(17, " "));
  genData["virtue"] = [
    "Ambitious",
    "Courageous",
    "Disciplined",
    "Honorable",
    "Serene",
    "Merciful",
    "Humble",
    "Tolerant",
    "Gregarious",
    "Cautious"
  ].map((x) => x.padEnd(17, " "));
  genData["vice"] = [
    "Aggressive",
    "Bitter",
    "Craven",
    "Deceitful",
    "Greedy",
    "Vengeful",
    "Lazy",
    "Nervous",
    "Rude",
    "Vain"
  ].map((x) => x.padEnd(17, " "));
  genData["card"] = [
    [
      "\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
      "\u2502low:{low_odds}  d4 {d4}  d12 {d12}\u2502",
      "\u251C\u2500\u2500\u2500:{even_odds}  d6 {d6}  d20 {d20}\u2502",
      "\u2502hi :{hi_odds}  d8 {d8}  d00 {d00}\u2502",
      "\u2502                    \u2502",
      "\u2502{action} {detail} {topic}\u2502",
      "\u2502                    \u2502",
      "\u2502OB:{objective}\u2502",
      "\u2502AD:{adversaries}\u2502",
      "\u2502EV:{focus}\u2502",
      "\u2502                    \u2502",
      "\u2502NM:{name}\u2502",
      "\u2502JB:{job}\u2502",
      "\u2502GL:{goal}\u2502",
      "\u2502                    \u2502",
      "\u2502VT:{virtue}\u2502",
      "\u2502VC:{vice}\u2502",
      "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518"
    ].join("\n")
  ];
  return genData;
}
function buildLandscapeGenData() {
  const genData = {};
  genData["d4"] = diceRange(4).map((x) => x.padStart(2, "0"));
  genData["d6"] = diceRange(6).map((x) => x.padStart(2, "0"));
  genData["d8"] = diceRange(8).map((x) => x.padStart(2, "0"));
  genData["d10"] = diceRange(10).map((x) => x.padStart(2, "0"));
  genData["d12"] = diceRange(12).map((x) => x.padStart(2, "0"));
  genData["d20"] = diceRange(20).map((x) => x.padStart(2, "0"));
  genData["d100"] = Array.from({ length: 100 }, (_, i) => String(i + 1).padStart(3, " "));
  genData["action"] = getItems("Action").filter((x) => x.length <= 6).map((x) => x.padEnd(6, " "));
  genData["detail"] = getItems("Location Descriptors").filter((x) => x.length <= 6).map((x) => x.padEnd(6, " "));
  genData["topic"] = getItems("Theme").filter((x) => x.length <= 6).map((x) => x.padEnd(6, " "));
  genData["objective"] = [
    "Remove a threat",
    "Learn the truth",
    "Recover valuable",
    "Escort to safety",
    "Restore broken",
    "Save ally peril"
  ].map((x) => x.padEnd(22, " "));
  genData["adversaries"] = [
    "Powerful entity",
    "Outlaws",
    "Guardians",
    "Local inhabitant",
    "Enemy horde",
    "A villain"
  ].map((x) => x.padEnd(22, " "));
  genData["name"] = getItems("Ironlander Names").filter((x) => x.length <= 6).map((x) => x.padEnd(6, " "));
  genData["job"] = getItems("NPC Role").filter((x) => x.length <= 7).map((x) => x.padEnd(7, " "));
  genData["virtue"] = [
    "Honest",
    "Loyal",
    "Brave",
    "Calm",
    "Wise",
    "Bold",
    "Just",
    "Serene",
    "Humble",
    "Kind",
    "Fierce",
    "Quick",
    "Clever",
    "Noble",
    "Steady",
    "Keen"
  ].map((x) => x.padEnd(6, " "));
  genData["vice"] = [
    "Greedy",
    "Lazy",
    "Rude",
    "Vain",
    "Bitter",
    "Craven",
    "Coward",
    "Proud",
    "Harsh",
    "Moody",
    "Cruel",
    "Fickle",
    "Sly",
    "Grim",
    "Wild",
    "Mean"
  ].map((x) => x.padEnd(6, " "));
  genData["card"] = [
    [
      "\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
      "\u2502 D4 :{d4} D6 :{d6} D8 :{d8} D10:{d10}\u2502",
      "\u2502  D12 :{d12} D20 :{d20} D100:{d100}  \u2502",
      "\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524",
      "\u2502EVT:  {action}  {detail}  {topic}\u2502",
      "\u2502QST:  {objective}\u2502",
      "\u2502FOE:  {adversaries}\u2502",
      "\u2502NAME: {name}   JOB: {job} \u2502",
      "\u2502VIRT: {virtue}   VICE: {vice} \u2502",
      "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518"
    ].join("\n")
  ];
  return genData;
}

// lib/card.ts
var _genData = /* @__PURE__ */ new Map();
function getGenData(layout = "portrait") {
  if (!_genData.has(layout)) {
    _genData.set(layout, buildGenData(layout));
  }
  return _genData.get(layout);
}
function generateCard(layout = "portrait") {
  const genData = getGenData(layout);
  return generateText("card", genData) ?? "";
}

// lib/theme.ts
var MACCHIATO_COLORS = {
  crust: [24, 23, 38],
  base: [36, 39, 58],
  overlay0: [108, 112, 134],
  text: [202, 211, 245],
  blue: [138, 173, 244],
  rosewater: [245, 169, 185],
  peach: [245, 194, 117]
};
var LATTE_COLORS = {
  crust: [220, 213, 197],
  base: [239, 232, 218],
  overlay0: [156, 150, 136],
  text: [76, 79, 105],
  blue: [30, 102, 245],
  rosewater: [220, 138, 120],
  peach: [254, 128, 25]
};
function getColors(theme) {
  return theme === "macchiato" ? MACCHIATO_COLORS : LATTE_COLORS;
}
function getPalette(theme = "macchiato") {
  const c = getColors(theme);
  return {
    positive: c.blue,
    negative: c.rosewater,
    neutral: c.overlay0,
    peach: c.peach
  };
}
function getPngColors(theme = "macchiato") {
  const c = getColors(theme);
  return { text: c.text, bg: c.base, highlightText: c.crust };
}
var FIELD_CATEGORY = {
  low_odds: "yesno",
  even_odds: "yesno",
  hi_odds: "yesno",
  d4: "neutral",
  d6: "neutral",
  d8: "neutral",
  d12: "neutral",
  d20: "neutral",
  d00: "neutral",
  action: "neutral",
  detail: "neutral",
  topic: "neutral",
  objective: "positive",
  adversaries: "negative",
  focus: "neutral",
  name: "neutral",
  job: "negative",
  goal: "positive",
  virtue: "positive",
  vice: "negative"
};
var FIELD_POSITIONS = [
  [1, 5, 2, "low_odds"],
  [1, 12, 1, "d4"],
  [1, 19, 2, "d12"],
  [2, 5, 2, "even_odds"],
  [2, 12, 1, "d6"],
  [2, 19, 2, "d20"],
  [3, 5, 2, "hi_odds"],
  [3, 12, 1, "d8"],
  [3, 19, 2, "d00"],
  [5, 1, 6, "action"],
  [5, 8, 6, "detail"],
  [5, 15, 6, "topic"],
  [7, 4, 17, "objective"],
  [8, 4, 17, "adversaries"],
  [9, 4, 17, "focus"],
  [11, 4, 17, "name"],
  [12, 4, 17, "job"],
  [13, 4, 17, "goal"],
  [15, 4, 17, "virtue"],
  [16, 4, 17, "vice"]
];
var LANDSCAPE_FIELD_CATEGORY = {
  d4: "neutral",
  d6: "neutral",
  d8: "neutral",
  d10: "neutral",
  d12: "neutral",
  d20: "neutral",
  d100: "neutral",
  action: "neutral",
  detail: "neutral",
  topic: "neutral",
  objective: "positive",
  adversaries: "negative",
  name: "neutral",
  job: "negative",
  virtue: "positive",
  vice: "negative"
};
var LANDSCAPE_FIELD_POSITIONS = [
  [1, 6, 2, "d4"],
  [1, 13, 2, "d6"],
  [1, 20, 2, "d8"],
  [1, 27, 2, "d10"],
  [2, 8, 2, "d12"],
  [2, 16, 2, "d20"],
  [2, 24, 3, "d100"],
  [4, 7, 6, "action"],
  [4, 15, 6, "detail"],
  [4, 23, 6, "topic"],
  [5, 7, 22, "objective"],
  [6, 7, 22, "adversaries"],
  [7, 7, 6, "name"],
  [7, 21, 7, "job"],
  [8, 7, 6, "virtue"],
  [8, 22, 6, "vice"]
];
function getFieldPositions(layout) {
  return layout === "landscape" ? LANDSCAPE_FIELD_POSITIONS : FIELD_POSITIONS;
}
function getFieldCategory(layout) {
  return layout === "landscape" ? LANDSCAPE_FIELD_CATEGORY : FIELD_CATEGORY;
}
function buildPositionMap(positions) {
  const map = /* @__PURE__ */ new Map();
  for (const [line, col, length, fieldName] of positions) {
    for (let i = 0; i < length; i++) {
      map.set(`${line},${col + i}`, fieldName);
    }
  }
  return map;
}
var POSITION_MAP = buildPositionMap(FIELD_POSITIONS);
var POSITION_MAPS = /* @__PURE__ */ new Map();
function getPositionMap(layout) {
  if (layout === "portrait") return POSITION_MAP;
  if (!POSITION_MAPS.has(layout)) {
    POSITION_MAPS.set(layout, buildPositionMap(getFieldPositions(layout)));
  }
  return POSITION_MAPS.get(layout);
}
function buildYesnoPrimaries(positions, category) {
  const primaries = /* @__PURE__ */ new Map();
  for (const [line, col, length, fieldName] of positions) {
    if (category[fieldName] === "yesno") {
      for (let i = 0; i < length; i++) {
        primaries.set(`${line},${col + i}`, [line, col]);
      }
    }
  }
  return primaries;
}
var YESNO_PRIMARIES = buildYesnoPrimaries(FIELD_POSITIONS, FIELD_CATEGORY);
var YESNO_PRIMARIES_MAPS = /* @__PURE__ */ new Map();
function getYesnoPrimaries(layout) {
  if (layout === "portrait") return YESNO_PRIMARIES;
  if (!YESNO_PRIMARIES_MAPS.has(layout)) {
    YESNO_PRIMARIES_MAPS.set(layout, buildYesnoPrimaries(getFieldPositions(layout), getFieldCategory(layout)));
  }
  return YESNO_PRIMARIES_MAPS.get(layout);
}
var DICE_MAX = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d00: 99,
  d100: 100
};
var DICE_SPANS = /* @__PURE__ */ new Map();
function getDiceSpans(layout) {
  if (!DICE_SPANS.has(layout)) {
    const map = /* @__PURE__ */ new Map();
    for (const [line, col, length, fieldName] of getFieldPositions(layout)) {
      if (DICE_MAX[fieldName] !== void 0) {
        map.set(fieldName, [line, col, length]);
      }
    }
    DICE_SPANS.set(layout, map);
  }
  return DICE_SPANS.get(layout);
}
function resolveDiceCategory(fieldName, cardLines, layout) {
  const span = getDiceSpans(layout).get(fieldName);
  if (!span) return null;
  const [line, col, length] = span;
  const value = parseInt(cardLines[line]?.slice(col, col + length) ?? "", 10);
  if (Number.isNaN(value)) return null;
  const threshold = Math.ceil(DICE_MAX[fieldName] / 2);
  return value >= threshold ? "positive" : "peach";
}
function resolveCategory(lineIdx, colIdx, fieldName, cardLines, layout) {
  const cat = getFieldCategory(layout)[fieldName] ?? "neutral";
  const diceCat = resolveDiceCategory(fieldName, cardLines, layout);
  if (diceCat) return diceCat;
  if (cat !== "yesno") return cat;
  const char = cardLines[lineIdx]?.[colIdx] ?? "";
  if (char === "Y" || char === "N") return char === "Y" ? "positive" : "negative";
  const primary = getYesnoPrimaries(layout).get(`${lineIdx},${colIdx}`);
  if (primary) {
    const [pl, pc] = primary;
    const firstChar = cardLines[pl]?.[pc] ?? "";
    return firstChar === "Y" ? "positive" : "negative";
  }
  return "neutral";
}
function getFieldColor(lineIdx, colIdx, cardLines, palette, theme = "macchiato", layout = "portrait") {
  if (!palette) palette = getPalette(theme);
  const fieldName = getPositionMap(layout).get(`${lineIdx},${colIdx}`);
  if (!fieldName) return null;
  const cat = resolveCategory(lineIdx, colIdx, fieldName, cardLines, layout);
  return palette[cat] ?? palette.neutral;
}
var TEMPLATE_TEXT = "\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502low:@@  d4 @  d12 @@\u2502\n\u251C\u2500\u2500\u2500:@@  d6 @  d20 @@\u2502\n\u2502hi :@@  d8 @  d00 @@\u2502\n\u2502                    \u2502\n\u2502@@@@@@ @@@@@@ @@@@@@\u2502\n\u2502                    \u2502\n\u2502OB:@@@@@@@@@@@@@@@@@\u2502\n\u2502AD:@@@@@@@@@@@@@@@@@\u2502\n\u2502EV:@@@@@@@@@@@@@@@@@\u2502\n\u2502                    \u2502\n\u2502NM:@@@@@@@@@@@@@@@@@\u2502\n\u2502JB:@@@@@@@@@@@@@@@@@\u2502\n\u2502GL:@@@@@@@@@@@@@@@@@\u2502\n\u2502                    \u2502\n\u2502VT:@@@@@@@@@@@@@@@@@\u2502\n\u2502VC:@@@@@@@@@@@@@@@@@\u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518";
var LANDSCAPE_TEMPLATE_TEXT = "\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502 D4 :@@ D6 :@@ D8 :@@ D10:@@\u2502\n\u2502  D12 :@@ D20 :@@ D100:@@@  \u2502\n\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n\u2502EVT:  @@@@@@  @@@@@@  @@@@@@\u2502\n\u2502QST:  @@@@@@@@@@@@@@@@@@@@@@\u2502\n\u2502FOE:  @@@@@@@@@@@@@@@@@@@@@@\u2502\n\u2502NAME: @@@@@@   JOB: @@@@@@@ \u2502\n\u2502VIRT: @@@@@@   VICE: @@@@@@ \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518";
function getTemplateText(layout = "portrait") {
  return layout === "landscape" ? LANDSCAPE_TEMPLATE_TEXT : TEMPLATE_TEXT;
}

// lib/spritesheet.ts
var GLYPH_W = 8;
var GLYPH_H = 16;
var CELL_X = 9;
var CELL_Y = 17;
var glyphData = null;
var CHAR_MAP = {};
for (let i = 32; i <= 126; i++) {
  CHAR_MAP[String.fromCharCode(i)] = i;
}
CHAR_MAP["\u2500"] = 196;
CHAR_MAP["\u2502"] = 179;
CHAR_MAP["\u250C"] = 218;
CHAR_MAP["\u2510"] = 191;
CHAR_MAP["\u2514"] = 192;
CHAR_MAP["\u2518"] = 217;
CHAR_MAP["\u251C"] = 195;
CHAR_MAP["\u2524"] = 180;
CHAR_MAP["\u252C"] = 194;
CHAR_MAP["\u2534"] = 193;
function parseSpritesheet(imageSource, ctx) {
  const cols = Math.floor(imageSource.width / CELL_X);
  const rows = Math.ceil(imageSource.height / CELL_Y);
  const glyphs = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.drawImage(
        imageSource,
        col * CELL_X + 1,
        row * CELL_Y,
        GLYPH_W,
        GLYPH_H,
        0,
        0,
        GLYPH_W,
        GLYPH_H
      );
      const data = ctx.getImageData(0, 0, GLYPH_W, GLYPH_H);
      glyphs.push(data);
    }
  }
  glyphData = glyphs;
  return glyphs;
}
function renderCardToCanvas(ctx, cardText, theme = "macchiato", imageMode2 = true, layout = "portrait") {
  if (!glyphData && imageMode2) {
    throw new Error("Spritesheet not loaded. Call parseSpritesheet first.");
  }
  const { text, bg, highlightText } = getPngColors(theme);
  const palette = getPalette(theme);
  const cardLines = cardText.split("\n");
  const templateLines = getTemplateText(layout).split("\n");
  if (cardLines.length !== templateLines.length) {
    throw new Error(
      `Card line count (${cardLines.length}) does not match ${layout} template (${templateLines.length}).`
    );
  }
  const charWidth = GLYPH_W;
  const charHeight = GLYPH_H;
  const numCharsWide = Math.max(...cardLines.map((l) => l.length));
  const numCharsHigh = cardLines.length;
  const canvasWidth = numCharsWide * charWidth;
  const canvasHeight = numCharsHigh * charHeight;
  ctx.canvas.width = canvasWidth;
  ctx.canvas.height = canvasHeight;
  if (imageMode2) {
    renderImageMode(
      ctx,
      cardLines,
      templateLines,
      palette,
      text,
      bg,
      highlightText,
      charWidth,
      charHeight,
      theme,
      layout
    );
  } else {
    renderCanvasMode(
      ctx,
      cardLines,
      templateLines,
      palette,
      text,
      bg,
      highlightText,
      charWidth,
      charHeight,
      theme,
      layout
    );
  }
}
function renderImageMode(ctx, cardLines, templateLines, palette, textColor, bgColor, highlightTextColor, charWidth, charHeight, theme, layout) {
  const imageData = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
  fillBg(imageData, bgColor);
  for (let li = 0; li < cardLines.length; li++) {
    const cardLine = cardLines[li];
    const templLine = templateLines[li] ?? "";
    for (let ci = 0; ci < cardLine.length; ci++) {
      const ch = cardLine[ci];
      const baseChar = templLine[ci] ?? ch;
      const isHighlight = ch !== baseChar;
      const glyphIndex = CHAR_MAP[ch];
      if (glyphIndex === void 0 || !glyphData || glyphIndex >= glyphData.length) continue;
      const glyph = glyphData[glyphIndex];
      let fg;
      let bg;
      if (isHighlight) {
        const fieldColor = getFieldColor(li, ci, cardLines, palette, theme, layout);
        if (fieldColor) {
          fg = highlightTextColor;
          bg = fieldColor;
        } else {
          fg = textColor;
          bg = bgColor;
        }
      } else {
        fg = textColor;
        bg = bgColor;
      }
      const dx = ci * charWidth;
      const dy = li * charHeight;
      for (let py = 0; py < charHeight; py++) {
        for (let px = 0; px < charWidth; px++) {
          const si = (py * charWidth + px) * 4;
          const di = ((dy + py) * ctx.canvas.width + (dx + px)) * 4;
          const glyphPixel = glyph.data[si];
          if (glyphPixel > 127) {
            imageData.data[di] = fg[0];
            imageData.data[di + 1] = fg[1];
            imageData.data[di + 2] = fg[2];
            imageData.data[di + 3] = 255;
          } else {
            imageData.data[di] = bg[0];
            imageData.data[di + 1] = bg[1];
            imageData.data[di + 2] = bg[2];
            imageData.data[di + 3] = 255;
          }
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
function renderCanvasMode(ctx, cardLines, templateLines, palette, textColor, bgColor, highlightTextColor, charWidth, charHeight, theme, layout) {
  ctx.fillStyle = rgbToCss(bgColor);
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const fontSize = Math.min(charWidth, charHeight) + 4;
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = "top";
  for (let li = 0; li < cardLines.length; li++) {
    const cardLine = cardLines[li];
    const templLine = templateLines[li] ?? "";
    for (let ci = 0; ci < cardLine.length; ci++) {
      const ch = cardLine[ci];
      const baseChar = templLine[ci] ?? ch;
      const isHighlight = ch !== baseChar;
      const x = ci * charWidth;
      const y = li * charHeight;
      if (isHighlight) {
        const fieldColor = getFieldColor(li, ci, cardLines, palette, theme, layout);
        if (fieldColor) {
          ctx.fillStyle = rgbToCss(fieldColor);
          ctx.fillRect(x, y, charWidth, charHeight);
          ctx.fillStyle = rgbToCss(highlightTextColor);
        } else {
          ctx.fillStyle = rgbToCss(textColor);
        }
      } else {
        ctx.fillStyle = rgbToCss(textColor);
      }
      ctx.fillText(ch, x, y);
    }
  }
}
function fillBg(imageData, bgColor) {
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = bgColor[0];
    imageData.data[i + 1] = bgColor[1];
    imageData.data[i + 2] = bgColor[2];
    imageData.data[i + 3] = 255;
  }
}
function rgbToCss([r, g, b]) {
  return `rgb(${r},${g},${b})`;
}

// www/app.js
var cardContainer = document.getElementById("card-container");
var generateBtn = document.getElementById("generate-btn");
var themeSelect = document.getElementById("theme-select");
var layoutSelect = document.getElementById("layout-select");
var modeToggle = document.getElementById("mode-toggle");
var modeLabel = document.getElementById("mode-label");
var currentCard = "";
var imageMode = true;
var spritesheetLoaded = false;
var cards = [];
async function init() {
  await loadOraclesJSON();
  await loadSpritesheet();
  newCard();
  generateBtn.addEventListener("click", newCard);
  themeSelect.addEventListener("change", renderAllCards);
  layoutSelect.addEventListener("change", renderAllCards);
  modeToggle.addEventListener("click", toggleMode);
  document.addEventListener("keydown", handleKeyDown);
}
async function loadOraclesJSON() {
  const resp = await fetch("ironsworn_oracles.json");
  const data = await resp.json();
  setOracles(data);
}
async function loadSpritesheet() {
  const img = new Image();
  img.src = "spritesheet.png";
  await img.decode();
  const offscreen = document.createElement("canvas");
  offscreen.width = img.width;
  offscreen.height = img.height;
  const octx = offscreen.getContext("2d");
  octx.drawImage(img, 0, 0);
  parseSpritesheet(img, octx);
  spritesheetLoaded = true;
}
function newCard() {
  currentCard = generateCard(layoutSelect.value);
  cards.push({ cardText: currentCard, theme: themeSelect.value, layout: layoutSelect.value });
  renderAllCards();
}
function renderAllCards() {
  cardContainer.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "card-grid";
  cardContainer.appendChild(grid);
  for (const cardData of cards) {
    const canvas = document.createElement("canvas");
    canvas.className = "card-canvas";
    const ctx = canvas.getContext("2d");
    renderCardToCanvas(ctx, cardData.cardText, cardData.theme, imageMode, cardData.layout);
    grid.appendChild(canvas);
  }
}
function toggleMode() {
  imageMode = !imageMode;
  modeLabel.textContent = imageMode ? "Image Mode" : "Canvas Mode";
  modeToggle.textContent = imageMode ? "Switch to Canvas Mode" : "Switch to Image Mode";
  renderAllCards();
}
function handleKeyDown(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
  switch (e.key) {
    case "Enter":
    case "ArrowLeft":
    case "ArrowRight":
      e.preventDefault();
      newCard();
      break;
    case "ArrowUp":
      e.preventDefault();
      cycleTheme();
      break;
    case "ArrowDown":
      e.preventDefault();
      cycleTheme();
      break;
  }
}
function cycleTheme() {
  const themes = ["macchiato", "latte"];
  const currentIdx = themes.indexOf(themeSelect.value);
  const nextIdx = themeSelect.value === "macchiato" ? 1 : 0;
  themeSelect.value = themes[nextIdx];
  renderAllCards();
}
init();
