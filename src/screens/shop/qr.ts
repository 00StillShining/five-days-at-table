// A minimal, from-scratch QR Code (ISO/IEC 18004) encoder for the
// send-to-phone hero (PLAN §6.8/§6.10: "generate in-code — a minimal QR
// byte-mode implementation is acceptable"). No new npm dependency — this
// file implements data encoding, Reed-Solomon error correction, module
// placement and masking directly, byte mode only (our payload is always the
// ASCII `#/list?t=<lz-string>` URL — src/engine/tripCodec.ts).
//
// Numeric constants below (per-version total codeword counts, and the
// error-correction-codewords/block-count tables for levels L and M) are the
// ISO/IEC 18004 standard's own fixed tables — every conformant QR encoder
// embeds the same numbers; only the code around them is original here.
// Levels Q/H are omitted (unused: we only ever pick between L and M, see
// `pickVersionAndLevel`), which is why the tables below carry two columns
// (L, M) rather than the spec's four.
//
// Verified independently: encoded output was rendered to a bitmap and
// decoded with a from-scratch third-party decoder (jsQR, dev-only, not a
// project dependency) across payload sizes from 1 byte up to the absolute
// maximum this encoder supports (2 953 bytes, version 40 / level L), and
// matched the original input in every case. See this task's final report
// for the full method.

export type EcLevel = "L" | "M";

export interface QrMatrix {
  version: number; // 1-40
  size: number; // modules per side
  ecLevel: EcLevel;
  /** size*size, row-major, 1 = dark module, 0 = light. */
  modules: Uint8Array;
}

// ---- ISO/IEC 18004 fixed tables, versions 1-40 ---------------------------

/** Total codewords (data + EC) per version. Index 0 unused (versions are 1-based). */
const TOTAL_CODEWORDS: readonly number[] = [
  0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085, 1156, 1258,
  1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706,
];

/** [blocksL, blocksM] per version (index = version - 1). */
const EC_BLOCKS: readonly (readonly [number, number])[] = [
  [1, 1], [1, 1], [1, 1], [1, 2], [1, 2], [2, 4], [2, 4], [2, 4], [2, 5], [4, 5], [4, 5], [4, 8], [4, 9], [4, 9],
  [6, 10], [6, 10], [6, 11], [6, 13], [7, 14], [8, 16], [8, 17], [9, 17], [9, 18], [10, 20], [12, 21], [12, 23],
  [12, 25], [13, 26], [14, 28], [15, 29], [16, 31], [17, 33], [18, 35], [19, 37], [19, 38], [20, 40], [21, 43],
  [22, 45], [24, 47], [25, 49],
];

/** [ecTotalCodewordsL, ecTotalCodewordsM] per version (index = version - 1). */
const EC_CODEWORDS: readonly (readonly [number, number])[] = [
  [7, 10], [10, 16], [15, 26], [20, 36], [26, 48], [36, 64], [40, 72], [48, 88], [60, 110], [72, 130], [80, 150],
  [96, 176], [104, 198], [120, 216], [132, 240], [144, 280], [168, 308], [180, 338], [196, 364], [224, 416],
  [224, 442], [252, 476], [270, 504], [300, 560], [312, 588], [336, 644], [360, 700], [390, 728], [420, 784],
  [450, 812], [480, 868], [510, 924], [540, 980], [570, 1036], [570, 1064], [600, 1120], [630, 1204], [660, 1260],
  [720, 1316], [750, 1372],
];

const LEVEL_NAMES: readonly EcLevel[] = ["L", "M"];
const LEVEL_FORMAT_BIT: Record<EcLevel, number> = { L: 1, M: 0 }; // format-info EC-level indicator bits

// ---- GF(256) arithmetic (field generator 0x11D, the QR spec's field) ----

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function polyMul(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] ^= gfMul(a[i], b[j]);
  }
  return out;
}

function generatorPolynomial(degree: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) poly = polyMul(poly, new Uint8Array([1, GF_EXP[i]]));
  return poly;
}

/** Reed-Solomon remainder (the block's EC codewords) via synthetic division
 * by the generator polynomial — the standard single-pass LFSR-style method
 * (equivalent to, but simpler than, general polynomial long division since
 * the generator's leading coefficient is always 1). */
function reedSolomonRemainder(dataBlock: Uint8Array, degree: number): Uint8Array {
  const gen = generatorPolynomial(degree);
  const scratch = new Uint8Array(dataBlock.length + degree);
  scratch.set(dataBlock);
  for (let i = 0; i < dataBlock.length; i++) {
    const coeff = scratch[i];
    if (coeff === 0) continue;
    for (let j = 0; j < gen.length; j++) scratch[i + j] ^= gfMul(gen[j], coeff);
  }
  return scratch.slice(dataBlock.length);
}

// ---- capacity + version/level selection ----------------------------------

function dataCodewordsCount(version: number, levelIdx: 0 | 1): number {
  return TOTAL_CODEWORDS[version] - EC_CODEWORDS[version - 1][levelIdx];
}

function charCountBits(version: number): number {
  return version < 10 ? 8 : 16; // byte mode
}

function byteCapacity(version: number, levelIdx: 0 | 1): number {
  const dataBits = dataCodewordsCount(version, levelIdx) * 8;
  const usable = dataBits - 4 /* mode indicator */ - charCountBits(version);
  return Math.floor(usable / 8);
}

/** Smallest version that fits `byteLen`, preferring level M over L (better
 * error correction); falls back to L only when M can't hold it at any
 * version up to 40. Returns null when even version 40 / level L can't hold
 * it — the absolute hard limit of a single QR symbol (2 953 bytes, byte
 * mode). Callers must handle null (src/screens/shop's send-to-phone key
 * falls back to the always-present short-URL + clipboard + textarea path). */
function pickVersionAndLevel(byteLen: number): { version: number; levelIdx: 0 | 1 } | null {
  for (const levelIdx of [1, 0] as const) {
    for (let version = 1; version <= 40; version++) {
      if (byteLen <= byteCapacity(version, levelIdx)) return { version, levelIdx };
    }
  }
  return null;
}

// ---- bit writer ------------------------------------------------------------

class BitWriter {
  private bits: number[] = [];
  push(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  get length(): number {
    return this.bits.length;
  }
  toBytes(): Uint8Array {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    for (let i = 0; i < this.bits.length; i++) {
      if (this.bits[i]) out[i >> 3] |= 0x80 >> (i & 7);
    }
    return out;
  }
}

/** Mode indicator (byte mode, 0100) + character count + data bytes +
 * terminator + bit padding + alternating 0xEC/0x11 pad codewords, sized
 * exactly to this version/level's data-codeword capacity. */
function buildDataCodewords(bytes: Uint8Array, version: number, levelIdx: 0 | 1): Uint8Array {
  const dataCwCount = dataCodewordsCount(version, levelIdx);
  const totalBits = dataCwCount * 8;
  const bw = new BitWriter();
  bw.push(0b0100, 4);
  bw.push(bytes.length, charCountBits(version));
  for (const b of bytes) bw.push(b, 8);
  bw.push(0, Math.min(4, Math.max(0, totalBits - bw.length)));
  while (bw.length % 8 !== 0) bw.push(0, 1);

  const written = bw.toBytes();
  const out = new Uint8Array(dataCwCount);
  out.set(written.subarray(0, Math.min(written.length, dataCwCount)));
  for (let i = written.length, pad = 0; i < dataCwCount; i++, pad++) out[i] = pad % 2 === 0 ? 0xec : 0x11;
  return out;
}

/** Splits data codewords into the spec's block groups, Reed-Solomon-encodes
 * each block, and interleaves data then EC codewords across all blocks —
 * the standard "codewords, versions >= 5-ish get multiple blocks" step. */
function buildFinalCodewords(dataCw: Uint8Array, version: number, levelIdx: 0 | 1): Uint8Array {
  const totalCw = TOTAL_CODEWORDS[version];
  const ecTotal = EC_CODEWORDS[version - 1][levelIdx];
  const numBlocks = EC_BLOCKS[version - 1][levelIdx];
  const dataTotal = totalCw - ecTotal;

  const group2Count = totalCw % numBlocks;
  const group1Count = numBlocks - group2Count;
  const dataCwGroup1 = Math.floor(dataTotal / numBlocks);
  const dataCwGroup2 = dataCwGroup1 + 1;
  const ecCwPerBlock = Math.floor(totalCw / numBlocks) - dataCwGroup1;

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  let maxLen = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = b < group1Count ? dataCwGroup1 : dataCwGroup2;
    const block = dataCw.subarray(offset, offset + len);
    dataBlocks.push(block);
    ecBlocks.push(reedSolomonRemainder(block, ecCwPerBlock));
    offset += len;
    maxLen = Math.max(maxLen, len);
  }

  const out = new Uint8Array(totalCw);
  let idx = 0;
  for (let i = 0; i < maxLen; i++) {
    for (let b = 0; b < numBlocks; b++) if (i < dataBlocks[b].length) out[idx++] = dataBlocks[b][i];
  }
  for (let i = 0; i < ecCwPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) out[idx++] = ecBlocks[b][i];
  }
  return out;
}

// ---- module matrix ---------------------------------------------------------

interface Matrix {
  size: number;
  data: Uint8Array;
  reserved: Uint8Array; // function patterns — excluded from data placement + masking
}

function makeMatrix(size: number): Matrix {
  return { size, data: new Uint8Array(size * size), reserved: new Uint8Array(size * size) };
}
function setModule(m: Matrix, r: number, c: number, dark: boolean, reserved = false): void {
  if (r < 0 || c < 0 || r >= m.size || c >= m.size) return;
  m.data[r * m.size + c] = dark ? 1 : 0;
  if (reserved) m.reserved[r * m.size + c] = 1;
}
function getModule(m: Matrix, r: number, c: number): number {
  return m.data[r * m.size + c];
}
function isReserved(m: Matrix, r: number, c: number): boolean {
  return m.reserved[r * m.size + c] === 1;
}

function placeFinderPatterns(m: Matrix): void {
  const corners: [number, number][] = [
    [0, 0],
    [m.size - 7, 0],
    [0, m.size - 7],
  ];
  for (const [pr, pc] of corners) {
    for (let r = -1; r <= 7; r++) {
      const rr = pr + r;
      if (rr < 0 || rr >= m.size) continue;
      for (let c = -1; c <= 7; c++) {
        const cc = pc + c;
        if (cc < 0 || cc >= m.size) continue;
        const dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setModule(m, rr, cc, dark, true);
      }
    }
  }
}

function placeTimingPatterns(m: Matrix): void {
  for (let i = 8; i < m.size - 8; i++) {
    const dark = i % 2 === 0;
    setModule(m, i, 6, dark, true);
    setModule(m, 6, i, dark, true);
  }
}

function alignmentCenters(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = size === 145 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const coords = [size - 7];
  for (let i = 1; i < count - 1; i++) coords.push(coords[i - 1] - step);
  coords.push(6);
  return coords.reverse();
}

function placeAlignmentPatterns(m: Matrix, version: number): void {
  const coords = alignmentCenters(version);
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Skip the three positions that overlap a finder pattern.
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      const pr = coords[i];
      const pc = coords[j];
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const dark = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
          setModule(m, pr + r, pc + c, dark, true);
        }
      }
    }
  }
}

// BCH generator polynomials for format info (15,5) and version info (18,6).
const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
const G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);

function bchDigitCount(value: number): number {
  let digits = 0;
  while (value !== 0) {
    digits++;
    value >>>= 1;
  }
  return digits;
}

function formatInfoBits(level: EcLevel, mask: number): number {
  const data = (LEVEL_FORMAT_BIT[level] << 3) | mask;
  let d = data << 10;
  const g15Digits = bchDigitCount(G15);
  while (bchDigitCount(d) - g15Digits >= 0) d ^= G15 << (bchDigitCount(d) - g15Digits);
  return ((data << 10) | d) ^ G15_MASK;
}

function versionInfoBits(version: number): number {
  let d = version << 12;
  const g18Digits = bchDigitCount(G18);
  while (bchDigitCount(d) - g18Digits >= 0) d ^= G18 << (bchDigitCount(d) - g18Digits);
  return (version << 12) | d;
}

function placeFormatInfo(m: Matrix, level: EcLevel, mask: number): void {
  const size = m.size;
  const bits = formatInfoBits(level, mask);
  for (let i = 0; i < 15; i++) {
    const dark = ((bits >> i) & 1) === 1;
    if (i < 6) setModule(m, i, 8, dark, true);
    else if (i < 8) setModule(m, i + 1, 8, dark, true);
    else setModule(m, size - 15 + i, 8, dark, true);

    if (i < 8) setModule(m, 8, size - i - 1, dark, true);
    else if (i < 9) setModule(m, 8, 15 - i, dark, true);
    else setModule(m, 8, 14 - i, dark, true);
  }
  setModule(m, size - 8, 8, true, true); // the fixed dark module
}

function placeVersionInfo(m: Matrix, version: number): void {
  if (version < 7) return;
  const size = m.size;
  const bits = versionInfoBits(version);
  for (let i = 0; i < 18; i++) {
    const row = Math.floor(i / 3);
    const col = (i % 3) + size - 11;
    const dark = ((bits >> i) & 1) === 1;
    setModule(m, row, col, dark, true);
    setModule(m, col, row, dark, true);
  }
}

/** Zigzag placement, two columns at a time from the bottom-right, skipping
 * the vertical timing column and any reserved (function-pattern) cell. */
function placeData(m: Matrix, data: Uint8Array): void {
  let dir = -1;
  let row = m.size - 1;
  let bitIndex = 7;
  let byteIndex = 0;
  for (let col = m.size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (!isReserved(m, row, cc)) {
          const dark = byteIndex < data.length ? ((data[byteIndex] >>> bitIndex) & 1) === 1 : false;
          setModule(m, row, cc, dark);
          bitIndex--;
          if (bitIndex === -1) {
            byteIndex++;
            bitIndex = 7;
          }
        }
      }
      row += dir;
      if (row < 0 || row >= m.size) {
        row -= dir;
        dir = -dir;
        break;
      }
    }
  }
}

function maskAt(pattern: number, i: number, j: number): boolean {
  switch (pattern) {
    case 0:
      return (i + j) % 2 === 0;
    case 1:
      return i % 2 === 0;
    case 2:
      return j % 3 === 0;
    case 3:
      return (i + j) % 3 === 0;
    case 4:
      return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5:
      return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6:
      return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    case 7:
      return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
    default:
      throw new Error(`bad mask pattern: ${pattern}`);
  }
}

function applyMask(m: Matrix, pattern: number): void {
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (isReserved(m, r, c)) continue;
      const idx = r * m.size + c;
      m.data[idx] ^= maskAt(pattern, r, c) ? 1 : 0;
    }
  }
}

// Penalty scoring (ISO/IEC 18004 §8.8.2, rules N1-N4) — used only to pick the
// least-penalized of the 8 mask patterns; not a correctness requirement (any
// mask paired with its correct format-info bits decodes fine), but the
// standard practice for real-world scan reliability.
function penaltyN1(m: Matrix): number {
  const size = m.size;
  let points = 0;
  for (let row = 0; row < size; row++) {
    let sameCol = 0;
    let sameRow = 0;
    let lastCol = -1;
    let lastRow = -1;
    for (let col = 0; col < size; col++) {
      let v = getModule(m, row, col);
      if (v === lastCol) sameCol++;
      else {
        if (sameCol >= 5) points += 3 + (sameCol - 5);
        lastCol = v;
        sameCol = 1;
      }
      v = getModule(m, col, row);
      if (v === lastRow) sameRow++;
      else {
        if (sameRow >= 5) points += 3 + (sameRow - 5);
        lastRow = v;
        sameRow = 1;
      }
    }
    if (sameCol >= 5) points += 3 + (sameCol - 5);
    if (sameRow >= 5) points += 3 + (sameRow - 5);
  }
  return points;
}
function penaltyN2(m: Matrix): number {
  let points = 0;
  for (let r = 0; r < m.size - 1; r++) {
    for (let c = 0; c < m.size - 1; c++) {
      const s = getModule(m, r, c) + getModule(m, r, c + 1) + getModule(m, r + 1, c) + getModule(m, r + 1, c + 1);
      if (s === 4 || s === 0) points++;
    }
  }
  return points * 3;
}
function penaltyN3(m: Matrix): number {
  const size = m.size;
  let points = 0;
  for (let row = 0; row < size; row++) {
    let bitsCol = 0;
    let bitsRow = 0;
    for (let col = 0; col < size; col++) {
      bitsCol = ((bitsCol << 1) & 0x7ff) | getModule(m, row, col);
      if (col >= 10 && (bitsCol === 0x5d0 || bitsCol === 0x05d)) points++;
      bitsRow = ((bitsRow << 1) & 0x7ff) | getModule(m, col, row);
      if (col >= 10 && (bitsRow === 0x5d0 || bitsRow === 0x05d)) points++;
    }
  }
  return points * 40;
}
function penaltyN4(m: Matrix): number {
  let dark = 0;
  for (let i = 0; i < m.data.length; i++) dark += m.data[i];
  const k = Math.abs(Math.ceil(((dark * 100) / m.data.length) / 5) - 10);
  return k * 10;
}

function pickBestMask(m: Matrix, level: EcLevel): number {
  let best = 0;
  let bestPenalty = Infinity;
  for (let pattern = 0; pattern < 8; pattern++) {
    placeFormatInfo(m, level, pattern);
    applyMask(m, pattern);
    const penalty = penaltyN1(m) + penaltyN2(m) + penaltyN3(m) + penaltyN4(m);
    applyMask(m, pattern); // undo — XOR is its own inverse
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = pattern;
    }
  }
  return best;
}

/** Encodes `text` (UTF-8 byte mode) as a QR symbol. Returns null only when
 * the text exceeds the absolute maximum a single QR code can hold
 * (2 953 bytes — version 40, level L). */
export function encodeQr(text: string): QrMatrix | null {
  const bytes = new TextEncoder().encode(text);
  const picked = pickVersionAndLevel(bytes.length);
  if (!picked) return null;
  const { version, levelIdx } = picked;
  const level = LEVEL_NAMES[levelIdx];

  const dataCw = buildDataCodewords(bytes, version, levelIdx);
  const finalCw = buildFinalCodewords(dataCw, version, levelIdx);

  const size = version * 4 + 17;
  const matrix = makeMatrix(size);
  placeFinderPatterns(matrix);
  placeTimingPatterns(matrix);
  placeAlignmentPatterns(matrix, version);
  placeFormatInfo(matrix, level, 0); // reserve the area (real bits written after masking)
  placeVersionInfo(matrix, version);
  placeData(matrix, finalCw);

  const mask = pickBestMask(matrix, level);
  applyMask(matrix, mask);
  placeFormatInfo(matrix, level, mask);

  return { version, size, ecLevel: level, modules: matrix.data };
}

/** Single-path SVG geometry for a QR matrix (one `<path>` rather than
 * size*size `<rect>` elements — up to ~31k modules at version 40, which
 * would otherwise bloat the DOM). Unit-square-per-module in a `size x size`
 * viewBox; the caller scales it up with CSS/width/height to the required
 * ≥256px physical render size. */
export function qrToSvgPath(matrix: QrMatrix): string {
  const parts: string[] = [];
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (matrix.modules[r * matrix.size + c]) parts.push(`M${c} ${r}h1v1h-1Z`);
    }
  }
  return parts.join("");
}
