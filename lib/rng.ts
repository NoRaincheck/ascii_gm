let _seed: number | null = null;
let _state: number = 0;

function mulberry32(state: number): number {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function setSeed(seed: number): void {
  _seed = seed;
  _state = seed;
}

export function getSeed(): number | null {
  return _seed;
}

export function random(): number {
  if (_seed !== null) {
    _state = (_state + 0x6d2b79f5) | 0;
    return mulberry32(_state);
  }
  return Math.random();
}

export function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}
