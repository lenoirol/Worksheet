import { describe, expect, it } from 'vitest';
import { fillAlphabet, filterForGrid, parseEntries, toLetters } from '../../src/core/text.ts';

describe('text', () => {
  it('strips accents: "Caf\u00e9 Münster" becomes CAFEMUNSTER', () => {
    expect(toLetters('Caf\u00e9 Münster').join('')).toBe('CAFEMUNSTER');
  });

  it('drops non-letter characters', () => {
    expect(toLetters("Jack O'Lantern-2").join('')).toBe('JACKOLANTERN');
  });

  it('normalizes input: trims extra spaces, blank lines and duplicates; splits clues', () => {
    const { entries, issues } = parseEntries('  Cat  \n\ncat\nJack   O Lantern | pumpkin\nBat\tflying\n');
    expect(entries.map((e) => e.display)).toEqual(['Cat', 'Jack O Lantern', 'Bat']);
    expect(entries[1]?.clue).toBe('pumpkin');
    expect(entries[2]?.clue).toBe('flying');
    expect(issues).toEqual([{ kind: 'duplicates', count: 1 }]);
  });

  it('drops words that are too short or longer than both sides', () => {
    const { entries } = parseEntries('A\nHi\nABCDEFGHIJKL');
    const { usable, issues } = filterForGrid(entries, 8, 10);
    expect(usable.map((e) => e.display)).toEqual(['Hi']);
    expect(issues.map((i) => i.kind)).toEqual(['tooShort', 'tooLong']);
  });

  it('filler alphabet is A-Z', () => {
    expect(fillAlphabet().join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });
});

describe('word count limit', () => {
  it('keeps only the first 50 entries and reports how many were dropped', () => {
    const text = Array.from({ length: 53 }, (_, i) => `word${'abcdefghijklmnopqrstuvwxyz'[i % 26]}${'abcdefghijklmnopqrstuvwxyz'[(i / 26) | 0]}`).join('\n');
    const { entries, issues } = parseEntries(text);
    expect(entries).toHaveLength(50);
    expect(issues).toContainEqual({ kind: 'overLimit', count: 3 });
  });
});
