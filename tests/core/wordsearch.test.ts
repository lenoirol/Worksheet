import { describe, expect, it } from 'vitest';
import { mulberry32, pick, randInt } from '../../src/core/rng.ts';
import { fillAlphabet, parseEntries, type Entry } from '../../src/core/text.ts';
import { generateWordSearch } from '../../src/core/wordsearch/generate.ts';
import { cellsOf, findWord } from '../../src/core/wordsearch/solve.ts';
import { initialAutoSize } from '../../src/core/wordsearch/sizing.ts';
import { ALL_DIRS, DIR_PRESETS, DIR_VECTORS, type Dir, type GenerateOptions } from '../../src/core/wordsearch/types.ts';
import { WORDS_A, WORDS_B } from '../fixtures/samples.ts';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomEntries(rng: () => number, count: number, minLen: number, maxLen: number): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  while (out.length < count) {
    const len = minLen + randInt(rng, maxLen - minLen + 1);
    const w = Array.from({ length: len }, () => AZ[randInt(rng, 26)] as string).join('');
    if (seen.has(w)) continue;
    seen.add(w);
    out.push({ display: w, letters: Array.from(w) });
  }
  return out;
}

const base = (over: Partial<GenerateOptions> = {}): GenerateOptions => ({
  size: { mode: 'auto' },
  dirs: ALL_DIRS,
  allowOverlap: true,
  fillMode: 'uniform',
  seed: 1,
  ...over,
});

describe('Word Search: correctness', () => {
  it('200 random word sets: positions, directions, sizes and filler letters are all valid', () => {
    const rng = mulberry32(12345);
    for (let k = 0; k < 200; k++) {
      const rows = 12 + randInt(rng, 19);
      const cols = 12 + randInt(rng, 19);
      const dirs = ALL_DIRS.filter(() => rng() < 0.6);
      const dirSet: readonly Dir[] = dirs.length ? dirs : ['E'];
      const entries = randomEntries(rng, 5 + randInt(rng, 25), 3, 9);
      const fillMode = rng() < 0.5 ? 'uniform' : 'fromWords';
      const res = generateWordSearch(entries, base({ size: { mode: 'manual', rows, cols }, dirs: dirSet, seed: k, fillMode, allowOverlap: rng() < 0.7 }));

      expect(res.rows).toBe(rows);
      expect(res.cols).toBe(cols);
      expect(res.grid).toHaveLength(rows);
      const allowed = new Set(fillMode === 'uniform' ? AZ : res.placements.flatMap((p) => p.entry.letters));
      for (const row of res.grid) {
        expect(row).toHaveLength(cols);
        for (const ch of row) expect(allowed.has(ch)).toBe(true);
      }
      for (const p of res.placements) {
        expect(dirSet).toContain(p.dir);
        const cells = cellsOf(p, p.entry.letters.length);
        cells.forEach(([r, c], i) => expect((res.grid[r] as string[])[c]).toBe(p.entry.letters[i]));
        expect(findWord(res.grid, p.entry.letters, dirSet)).toContainEqual({ row: p.row, col: p.col, dir: p.dir });
      }
      expect(res.placements.length + res.failed.length).toBe(entries.length);
    }
  });

  it('no extra occurrences involving filler cells', () => {
    const rng = mulberry32(99);
    for (let k = 0; k < 20; k++) {
      const entries = randomEntries(rng, 12, 2, 4);
      const res = generateWordSearch(entries, base({ size: { mode: 'manual', rows: 14, cols: 14 }, seed: k }));
      const wordCells = new Set(res.placements.flatMap((p) => cellsOf(p, p.entry.letters.length).map(([r, c]) => `${r},${c}`)));
      for (const p of res.placements) {
        for (const occ of findWord(res.grid, p.entry.letters, ALL_DIRS)) {
          const cells = cellsOf(occ, p.entry.letters.length);
          expect(cells.every(([r, c]) => wordCells.has(`${r},${c}`)), p.entry.display).toBe(true);
        }
      }
    }
  });

  it('same seed and input give an identical grid; a different seed differs', () => {
    const { entries } = parseEntries(WORDS_A.join('\n'));
    const a = generateWordSearch(entries, base({ seed: 42 }));
    const b = generateWordSearch(entries, base({ seed: 42 }));
    const c = generateWordSearch(entries, base({ seed: 43 }));
    expect(b.grid).toEqual(a.grid);
    expect(b.placements.map((p) => [p.row, p.col, p.dir])).toEqual(a.placements.map((p) => [p.row, p.col, p.dir]));
    expect(c.grid).not.toEqual(a.grid);
  });

  it('Easy preset: no word runs backward or diagonally', () => {
    const { entries } = parseEntries(WORDS_A.join('\n'));
    for (let seed = 0; seed < 10; seed++) {
      const res = generateWordSearch(entries, base({ dirs: DIR_PRESETS.easy, seed }));
      for (const p of res.placements) {
        const [dr, dc] = DIR_VECTORS[p.dir];
        expect(dr >= 0 && dc >= 0 && dr + dc === 1).toBe(true);
      }
    }
  });

  it('overlap off: words share no cells', () => {
    const { entries } = parseEntries(WORDS_A.join('\n'));
    const res = generateWordSearch(entries, base({ allowOverlap: false, size: { mode: 'manual', rows: 25, cols: 25 } }));
    const seen = new Set<string>();
    for (const p of res.placements) {
      for (const [r, c] of cellsOf(p, p.entry.letters.length)) {
        expect(seen.has(`${r},${c}`)).toBe(false);
        seen.add(`${r},${c}`);
      }
    }
  });

  it('non-square grid; too-long words are reported with a reason', () => {
    const { entries } = parseEntries('Halloween\nCat\nX');
    const res = generateWordSearch(entries, base({ size: { mode: 'manual', rows: 5, cols: 8 } }));
    expect(res.rows).toBe(5);
    expect(res.cols).toBe(8);
    expect(res.issues.map((i) => i.kind).sort()).toEqual(['tooLong', 'tooShort']);
    expect(res.placements.map((p) => p.entry.display)).toEqual(['Cat']);
  });

  it('words that cannot be placed land in failed; the grid is still generated', () => {
    const { entries } = parseEntries('ABCDE\nFGHIK\nLMNOP\nQRSTU\nVWXYZ\nBCDEF');
    const res = generateWordSearch(entries, base({ size: { mode: 'manual', rows: 5, cols: 5 }, dirs: ['E'], allowOverlap: false }));
    expect(res.failed.length).toBeGreaterThan(0);
    expect(res.grid).toHaveLength(5);
  });

  it('accented input is reduced to A-Z letters', () => {
    const { entries } = parseEntries('Caf\u00e9\nMünster');
    const res = generateWordSearch(entries, base());
    expect(res.failed).toHaveLength(0);
    const alphabet = new Set(fillAlphabet());
    for (const row of res.grid) for (const ch of row) expect(alphabet.has(ch)).toBe(true);
    expect((res.placements[0] as (typeof res.placements)[number]).entry.letters.join('')).toBe('CAFE');
  });
});

describe('Word Search: size and performance', () => {
  it('auto size: sample A within 16–24, sample B within 9–13', () => {
    for (const [words, lo, hi] of [[WORDS_A, 16, 24], [WORDS_B, 9, 13]] as const) {
      const { entries } = parseEntries(words.join('\n'));
      expect(initialAutoSize(entries)).toBeGreaterThanOrEqual(lo);
      for (let seed = 0; seed < 20; seed++) {
        const res = generateWordSearch(entries, base({ seed, dirs: words === WORDS_B ? DIR_PRESETS.easy : ALL_DIRS }));
        expect(res.failed).toHaveLength(0);
        expect(res.rows).toBe(res.cols);
        expect(res.rows).toBeGreaterThanOrEqual(lo);
        expect(res.rows).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('64×64 with 150 words: places at least 98% in under 2 seconds', () => {
    const entries = randomEntries(mulberry32(7), 150, 4, 12);
    const t0 = performance.now();
    const res = generateWordSearch(entries, base({ size: { mode: 'manual', rows: 64, cols: 64 } }));
    const ms = performance.now() - t0;
    expect(res.placements.length / 150).toBeGreaterThanOrEqual(0.98);
    expect(ms).toBeLessThan(2000);
  });

  it('32×32 places all words; 100×100 with 300 words in under 8 seconds', () => {
    const e32 = randomEntries(mulberry32(3), 60, 4, 10);
    expect(generateWordSearch(e32, base({ size: { mode: 'manual', rows: 32, cols: 32 } })).failed).toHaveLength(0);
    const e100 = randomEntries(mulberry32(4), 300, 4, 14);
    const t0 = performance.now();
    const res = generateWordSearch(e100, base({ size: { mode: 'manual', rows: 100, cols: 100 } }));
    expect(performance.now() - t0).toBeLessThan(8000);
    expect(res.placements.length).toBeGreaterThanOrEqual(294);
  });

  it('seeded random choice works with pick', () => {
    expect(pick(mulberry32(1), ['a'])).toBe('a');
  });
});
