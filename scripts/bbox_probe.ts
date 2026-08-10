// Pure-TypeScript PNG decoder (RGBA) to compute alpha bounding boxes.

class PngDecodeError extends Error {}

interface Chunk {
  type: string;
  data: Uint8Array;
}

function readChunks(bytes: Uint8Array): { ihdr: Chunk; idat: Uint8Array } {
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) throw new PngDecodeError('not a PNG');
  let off = 8;
  let ihdr: Chunk | null = null;
  const idatParts: Uint8Array[] = [];
  while (off + 8 <= bytes.length) {
    const len = bytes[off] * 0x1000000 + bytes[off + 1] * 0x10000 + bytes[off + 2] * 0x100 + bytes[off + 3];
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    const data = bytes.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { type, data };
    else if (type === 'IDAT') idatParts.push(data);
    off += 12 + len;
  }
  if (!ihdr) throw new PngDecodeError('missing IHDR');
  return { ihdr, idat: concat(idatParts) };
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([data]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function decodePng(path: string): Promise<{ width: number; height: number; rgba: Uint8Array }> {
  const bytes = await Deno.readFile(path);
  const { ihdr, idat } = readChunks(bytes);
  const dv = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);
  const width = dv.getUint32(0);
  const height = dv.getUint32(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2 && colorType !== 0 && colorType !== 3)) {
    throw new PngDecodeError(`unsupported png bitDepth=${bitDepth} colorType=${colorType}`);
  }
  const raw = await inflate(idat);
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : 1;
  const stride = width * bpp;
  const rgba = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      switch (filter) {
        case 0:
          break;
        case 1:
          v = (v + a) & 0xff;
          break;
        case 2:
          v = (v + b) & 0xff;
          break;
        case 3:
          v = (v + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default:
          throw new PngDecodeError('bad filter');
      }
      cur[x] = v;
    }
    for (let x = 0; x < width; x++) {
      const src = x * bpp;
      let r = 255, g = 255, b = 255, a = 255;
      if (colorType === 6) {
        r = cur[src];
        g = cur[src + 1];
        b = cur[src + 2];
        a = cur[src + 3];
      } else if (colorType === 2) {
        r = cur[src];
        g = cur[src + 1];
        b = cur[src + 2];
      } else if (colorType === 3) { /* palette: treat opaque */ }
      const d = (y * width + x) * 4;
      rgba[d] = r;
      rgba[d + 1] = g;
      rgba[d + 2] = b;
      rgba[d + 3] = a;
    }
    prev.set(cur);
    p += stride;
  }
  return { width, height, rgba };
}

async function bbox(path: string, label: string, fx: number, fy: number, fw: number, fh: number) {
  const { width, height, rgba } = await decodePng(path);
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let y = fy; y < fy + fh; y++) {
    for (let x = fx; x < fx + fw; x++) {
      if (rgba[(y * width + x) * 4 + 3] > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cx = (minX + maxX) / 2;
  console.log(
    `${label}: frame=${fw}x${fh} content=(${minX - fx},${minY - fy})-(${maxX - fx},${maxY - fy}) size=${
      maxX - minX + 1
    }x${maxY - minY + 1} centerBottomInFrame=(${Math.round(cx - fx)},${maxY - fy})`,
  );
}

for (let f = 0; f < 4; f++) {
  await bbox('assets/Resources/Trees/Tree.png', `tree-frame${f}`, f * 192, 0, 192, 192);
}
await bbox('assets/Factions/Knights/Buildings/House/House_Blue.png', 'house', 0, 0, 128, 192);
await bbox('assets/Factions/Knights/Buildings/Tower/Tower_Blue.png', 'tower', 0, 0, 128, 256);
await bbox('assets/Factions/Knights/Buildings/Castle/Castle_Blue.png', 'castle', 0, 0, 320, 256);
