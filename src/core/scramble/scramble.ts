import { randInt, shuffle, type Rng } from '../rng.ts';
import { toLetters, type Entry } from '../text.ts';

export type FirstLetterMode = 'free' | 'keep' | 'change';
export type HintMode = { kind: 'none' } | { kind: 'first' } | { kind: 'firstLast' } | { kind: 'random'; count: number };

export interface ScrambleOptions {
  firstLetter: FirstLetterMode;
  hint: HintMode;
}

export interface ScrambledEntry {
  /** Scrambled version, one array of letters per word (word boundaries are kept). */
  tokens: string[][];
  /** Answer, in the same structure as `tokens`. */
  answer: string[][];
  /** `hints[i][j]` is true if letter j of word i is pre-filled in its slot. */
  hints: boolean[][];
  /** True if it cannot be scrambled into something different from the original (e.g. "AA"). */
  unchanged: boolean;
}

const MAX_RETRIES = 50;
const sameArray = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Scrambles one word. Returns a new array; equal to the original if no other arrangement exists. */
export function scrambleWord(rng: Rng, letters: readonly string[], firstLetter: FirstLetterMode): string[] {
  const n = letters.length;
  if (n < 2) return letters.slice();
  const first = letters[0] as string;

  if (firstLetter === 'change') {
    const others = Array.from(new Set(letters.filter((ch) => ch !== first)));
    if (others.length === 0) return letters.slice();
    const head = others[randInt(rng, others.length)] as string;
    const rest = letters.slice();
    rest.splice(rest.indexOf(head), 1);
    return [head, ...shuffle(rng, rest)];
  }

  const keep = firstLetter === 'keep';
  const movable = keep ? letters.slice(1) : letters.slice();
  if (new Set(movable).size < 2) return letters.slice();
  let out = letters.slice();
  for (let t = 0; t < MAX_RETRIES; t++) {
    const shuffled = shuffle(rng, movable);
    out = keep ? [first, ...shuffled] : shuffled;
    if (!sameArray(out, letters)) return out;
  }
  // Very rare: if MAX_RETRIES attempts still match, swap the first two different letters.
  const i = movable.findIndex((ch) => ch !== movable[0]);
  const fallback = movable.slice();
  [fallback[0], fallback[i]] = [fallback[i] as string, fallback[0] as string];
  return keep ? [first, ...fallback] : fallback;
}

function makeHints(rng: Rng, tokens: readonly (readonly string[])[], mode: HintMode): boolean[][] {
  const hints = tokens.map((t) => t.map(() => false));
  if (mode.kind === 'none') return hints;
  if (mode.kind === 'random') {
    const slots = tokens.flatMap((t, i) => t.map((_, j) => [i, j] as const));
    for (const [i, j] of shuffle(rng, slots).slice(0, Math.max(0, mode.count))) (hints[i] as boolean[])[j] = true;
    return hints;
  }
  hints.forEach((h) => {
    if (h.length === 0) return;
    h[0] = true;
    if (mode.kind === 'firstLast') h[h.length - 1] = true;
  });
  return hints;
}

/** Splits the original into words (on whitespace), each word being an array of letters. */
export function wordsOf(display: string): string[][] {
  return display
    .split(/\s+/)
    .map((w) => toLetters(w))
    .filter((w) => w.length > 0);
}

export function scrambleEntry(rng: Rng, entry: Entry, o: ScrambleOptions): ScrambledEntry {
  const answer = wordsOf(entry.display);
  const tokens = answer.map((w) => scrambleWord(rng, w, o.firstLetter));
  const unchanged = tokens.every((t, i) => sameArray(t, answer[i] as string[]));
  return { tokens, answer, hints: makeHints(rng, answer, o.hint), unchanged };
}

export function scrambleAll(rng: Rng, entries: readonly Entry[], o: ScrambleOptions): ScrambledEntry[] {
  return entries.map((e) => scrambleEntry(rng, e, o));
}
