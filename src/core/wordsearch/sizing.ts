import { MAX_GRID } from '../constants.ts';
import type { Entry } from '../text.ts';

const TARGET_DENSITY = 0.4;
const MIN_AUTO = 8;

/** Starting side of the square grid for auto mode. */
export function initialAutoSize(entries: readonly Entry[]): number {
  const total = entries.reduce((s, e) => s + e.letters.length, 0);
  const longest = entries.reduce((m, e) => Math.max(m, e.letters.length), 0);
  const n = Math.max(longest + 1, Math.ceil(Math.sqrt(total / TARGET_DENSITY)));
  return Math.min(MAX_GRID, Math.max(MIN_AUTO, n));
}
