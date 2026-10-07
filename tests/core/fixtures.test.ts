import { describe, expect, it } from 'vitest';
import { parseEntries } from '../../src/core/text.ts';
import { findWord } from '../../src/core/wordsearch/solve.ts';
import { ALL_DIRS } from '../../src/core/wordsearch/types.ts';
import { GRID_A, GRID_B, PLACEMENTS_B, WORDS_A, WORDS_B, toGrid } from '../fixtures/samples.ts';

describe('sample fixtures', () => {
  it('sample B: finds all 10 words at the listed positions', () => {
    const grid = toGrid(GRID_B);
    for (const [word, row, col, dir] of PLACEMENTS_B) {
      const found = findWord(grid, Array.from(word), ['E', 'S']);
      expect(found, word).toContainEqual({ row: row - 1, col: col - 1, dir });
    }
  });

  it('sample A: finds all 20 words in at least one position', () => {
    const grid = toGrid(GRID_A);
    const { entries } = parseEntries(WORDS_A.join('\n'));
    expect(entries).toHaveLength(20);
    for (const e of entries) expect(findWord(grid, e.letters, ALL_DIRS).length, e.display).toBeGreaterThan(0);
  });

  it('the sample B word list is contained in sample A', () => {
    for (const w of WORDS_B) expect(WORDS_A).toContain(w);
  });
});
