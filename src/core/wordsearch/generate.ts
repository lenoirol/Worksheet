import { MAX_GRID, MIN_GRID } from '../constants.ts';
import { mulberry32, pick, randInt, shuffle, type Rng } from '../rng.ts';
import { fillAlphabet, filterForGrid, type Entry } from '../text.ts';
import { findWord, cellsOf } from './solve.ts';
import { initialAutoSize } from './sizing.ts';
import {
  DIR_VECTORS,
  type Dir,
  type GenerateOptions,
  type Grid,
  type Placement,
  type WordSearchResult,
} from './types.ts';

const CANDIDATES_WANTED = 300;
const DEFAULT_ATTEMPTS = 30;
const DEFAULT_TIME_LIMIT_MS = 8000;
const DEFAULT_OVERLAP_BONUS = 2;
const MAX_DEDUPE_FIXES = 200;

interface Candidate {
  row: number;
  col: number;
  dir: Dir;
  overlap: number;
}

/** Number of overlapping cells with matching letters if placeable, -1 if invalid (or no new cells). */
function fit(grid: Grid, letters: readonly string[], row: number, col: number, dir: Dir, allowOverlap: boolean): number {
  const [dr, dc] = DIR_VECTORS[dir];
  let overlap = 0;
  for (let i = 0; i < letters.length; i++) {
    const cell = (grid[row + dr * i] as string[])[col + dc * i];
    if (cell === '') continue;
    if (!allowOverlap || cell !== letters[i]) return -1;
    overlap++;
  }
  return overlap === letters.length ? -1 : overlap;
}

/** Valid range of the first cell along one axis so the word fits entirely inside the grid. */
function startRange(d: number, len: number, size: number): [number, number] {
  if (d > 0) return [0, size - len];
  if (d < 0) return [len - 1, size - 1];
  return [0, size - 1];
}

function sampleCandidates(
  grid: Grid,
  rows: number,
  cols: number,
  letters: readonly string[],
  dirs: readonly Dir[],
  allowOverlap: boolean,
  rng: Rng,
): Candidate[] {
  const len = letters.length;
  const found: Candidate[] = [];
  const budget = CANDIDATES_WANTED * 4;
  for (let t = 0; t < budget && found.length < CANDIDATES_WANTED; t++) {
    const dir = pick(rng, dirs);
    const [dr, dc] = DIR_VECTORS[dir];
    const [r0, r1] = startRange(dr, len, rows);
    const [c0, c1] = startRange(dc, len, cols);
    if (r1 < r0 || c1 < c0) continue;
    const row = r0 + randInt(rng, r1 - r0 + 1);
    const col = c0 + randInt(rng, c1 - c0 + 1);
    const overlap = fit(grid, letters, row, col, dir, allowOverlap);
    if (overlap >= 0) found.push({ row, col, dir, overlap });
  }
  if (found.length > 0) return found;
  // Grid is nearly full: scan everything so no free spot is missed.
  for (const dir of dirs) {
    const [dr, dc] = DIR_VECTORS[dir];
    const [r0, r1] = startRange(dr, len, rows);
    const [c0, c1] = startRange(dc, len, cols);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const overlap = fit(grid, letters, row, col, dir, allowOverlap);
        if (overlap >= 0) found.push({ row, col, dir, overlap });
      }
    }
  }
  return found;
}

function chooseWeighted(rng: Rng, cands: readonly Candidate[], bonus: number): Candidate {
  let total = 0;
  for (const c of cands) total += 1 + bonus * c.overlap;
  let x = rng() * total;
  for (const c of cands) {
    x -= 1 + bonus * c.overlap;
    if (x < 0) return c;
  }
  return cands[cands.length - 1] as Candidate;
}

interface Attempt {
  grid: Grid;
  placements: Placement[];
  failed: Entry[];
}

function attemptPlace(entries: readonly Entry[], rows: number, cols: number, o: GenerateOptions, rng: Rng): Attempt {
  const grid: Grid = Array.from({ length: rows }, () => Array<string>(cols).fill(''));
  const order = shuffle(rng, entries.map((_, i) => i)).sort(
    (a, b) => (entries[b] as Entry).letters.length - (entries[a] as Entry).letters.length,
  );
  const placements: Placement[] = [];
  const failed: Entry[] = [];
  for (const idx of order) {
    const entry = entries[idx] as Entry;
    const cands = sampleCandidates(grid, rows, cols, entry.letters, o.dirs, o.allowOverlap, rng);
    if (cands.length === 0) {
      failed.push(entry);
      continue;
    }
    const c = chooseWeighted(rng, cands, o.overlapBonus ?? DEFAULT_OVERLAP_BONUS);
    const [dr, dc] = DIR_VECTORS[c.dir];
    entry.letters.forEach((ch, i) => {
      (grid[c.row + dr * i] as string[])[c.col + dc * i] = ch;
    });
    placements.push({ entryIndex: idx, entry, row: c.row, col: c.col, dir: c.dir });
  }
  placements.sort((a, b) => a.entryIndex - b.entryIndex);
  failed.sort((a, b) => entries.indexOf(a) - entries.indexOf(b));
  return { grid, placements, failed };
}

function bestAttempt(entries: readonly Entry[], rows: number, cols: number, o: GenerateOptions, rng: Rng, deadline: number): Attempt {
  const maxAttempts = o.maxAttempts ?? DEFAULT_ATTEMPTS;
  let best: Attempt | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const a = attemptPlace(entries, rows, cols, o, rng);
    if (!best || a.failed.length < best.failed.length) best = a;
    o.onProgress?.({ rows, cols, attempt, placed: best.placements.length, total: entries.length });
    if (best.failed.length === 0 || Date.now() > deadline) break;
  }
  return best as Attempt;
}

function makeFiller(o: GenerateOptions, placed: readonly Placement[]): string[] {
  if (o.fillMode === 'fromWords') {
    // Multiset of letters in the word list: letters that appear more often are picked more often.
    const pool = placed.flatMap((p) => p.entry.letters);
    if (pool.length > 0) return pool;
  }
  return fillAlphabet();
}

function fillEmpty(grid: Grid, alphabet: readonly string[], rng: Rng): void {
  for (const row of grid) {
    for (let c = 0; c < row.length; c++) if (row[c] === '') row[c] = pick(rng, alphabet);
  }
}

/**
 * Changes filler letters in empty cells so each word appears only where it was placed
 * (an occurrence lying entirely within cells of placed words is accepted).
 */
function removeExtraOccurrences(grid: Grid, placements: readonly Placement[], alphabet: readonly string[], dirs: readonly Dir[], rng: Rng): void {
  const isWordCell = grid.map((row) => row.map(() => false));
  for (const p of placements) for (const [r, c] of cellsOf(p, p.entry.letters.length)) (isWordCell[r] as boolean[])[c] = true;
  let fixes = 0;
  while (fixes < MAX_DEDUPE_FIXES) {
    let changed = false;
    for (const p of placements) {
      for (const occ of findWord(grid, p.entry.letters, dirs)) {
        const filler = cellsOf(occ, p.entry.letters.length).filter(([r, c]) => !(isWordCell[r] as boolean[])[c]);
        if (filler.length === 0) continue;
        const [r, c] = pick(rng, filler);
        const row = grid[r] as string[];
        const options = alphabet.filter((ch) => ch !== row[c]);
        if (options.length === 0) continue;
        row[c] = pick(rng, options);
        changed = true;
        if (++fixes >= MAX_DEDUPE_FIXES) return;
      }
    }
    if (!changed) return;
  }
}

/** Generates a Word Search grid. The same seed and input give the same grid. */
export function generateWordSearch(input: readonly Entry[], o: GenerateOptions): WordSearchResult {
  const rng = mulberry32(o.seed);
  const deadline = Date.now() + (o.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS);
  const manual = o.size.mode === 'manual' ? o.size : null;
  const rows0 = manual ? clampSize(manual.rows) : MAX_GRID;
  const cols0 = manual ? clampSize(manual.cols) : MAX_GRID;
  const { usable, issues } = filterForGrid(input, rows0, cols0);

  let rows = rows0;
  let cols = cols0;
  let attempt: Attempt;
  if (manual) {
    attempt = bestAttempt(usable, rows, cols, o, rng, deadline);
  } else {
    rows = cols = initialAutoSize(usable);
    attempt = bestAttempt(usable, rows, cols, o, rng, deadline);
    while (attempt.failed.length > 0 && rows < MAX_GRID && Date.now() < deadline) {
      rows = cols = rows + 1;
      attempt = bestAttempt(usable, rows, cols, o, rng, deadline);
    }
  }

  const alphabet = makeFiller(o, attempt.placements);
  fillEmpty(attempt.grid, alphabet, rng);
  removeExtraOccurrences(attempt.grid, attempt.placements, alphabet, o.dirs, rng);
  return {
    rows,
    cols,
    grid: attempt.grid,
    placements: attempt.placements,
    failed: attempt.failed,
    issues,
    seed: o.seed,
  };
}

function clampSize(n: number): number {
  return Math.min(MAX_GRID, Math.max(MIN_GRID, Math.round(n)));
}
