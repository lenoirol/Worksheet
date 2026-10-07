import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/core/rng.ts';
import { scrambleEntry, scrambleWord, type ScrambleOptions } from '../../src/core/scramble/scramble.ts';
import { parseEntries } from '../../src/core/text.ts';
import { WORDS_A } from '../fixtures/samples.ts';

const opts = (o: Partial<ScrambleOptions> = {}): ScrambleOptions => ({ firstLetter: 'free', hint: { kind: 'none' }, ...o });
const sorted = (a: readonly string[]) => a.slice().sort().join('');

describe('Scramble', () => {
  const { entries } = parseEntries(WORDS_A.join('\n'));

  it('same letters, word boundaries kept, differs from the original (200 seeds)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      for (const e of entries) {
        const s = scrambleEntry(rng, e, opts());
        const words = e.display.split(' ');
        expect(s.tokens).toHaveLength(words.length);
        s.tokens.forEach((t, i) => {
          expect(sorted(t)).toBe(sorted(s.answer[i] as string[]));
          if (t.length > 1) expect(t.join('')).not.toBe((s.answer[i] as string[]).join(''));
        });
        expect(s.unchanged).toBe(false);
      }
    }
  });

  it('"TREAT" never scrambles to itself', () => {
    for (let seed = 0; seed < 500; seed++) expect(scrambleWord(mulberry32(seed), Array.from('TREAT'), 'free').join('')).not.toBe('TREAT');
  });

  it('a word that cannot be scrambled differently stays as is and reports unchanged', () => {
    const e = parseEntries('AA\nOO').entries;
    for (const x of e) expect(scrambleEntry(mulberry32(1), x, opts()).unchanged).toBe(true);
    expect(scrambleWord(mulberry32(1), ['A'], 'free')).toEqual(['A']);
  });

  it('first-letter mode: keep / force change', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const e of entries) {
        const keep = scrambleEntry(mulberry32(seed), e, opts({ firstLetter: 'keep' }));
        const change = scrambleEntry(mulberry32(seed), e, opts({ firstLetter: 'change' }));
        keep.tokens.forEach((t, i) => {
          const orig = keep.answer[i] as string[];
          expect(t[0]).toBe(orig[0]);
          expect(sorted(t)).toBe(sorted(orig));
          if (new Set(orig.slice(1)).size > 1) expect(t.join('')).not.toBe(orig.join(''));
        });
        change.tokens.forEach((t, i) => {
          const orig = change.answer[i] as string[];
          expect(sorted(t)).toBe(sorted(orig));
          if (new Set(orig).size > 1) expect(t[0]).not.toBe(orig[0]);
        });
      }
    }
  });

  it('hint letters: none / first / first and last / k random letters', () => {
    const e = parseEntries('Jack O Lantern').entries[0]!;
    const count = (h: boolean[][]) => h.flat().filter(Boolean).length;
    const none = scrambleEntry(mulberry32(1), e, opts());
    expect(count(none.hints)).toBe(0);
    const first = scrambleEntry(mulberry32(1), e, opts({ hint: { kind: 'first' } }));
    expect(first.hints.map((h) => h[0])).toEqual([true, true, true]);
    expect(count(first.hints)).toBe(3);
    const fl = scrambleEntry(mulberry32(1), e, opts({ hint: { kind: 'firstLast' } }));
    expect(fl.hints[0]).toEqual([true, false, false, true]);
    expect(fl.hints[1]).toEqual([true]);
    expect(count(fl.hints)).toBe(2 + 1 + 2);
    const rnd = scrambleEntry(mulberry32(1), e, opts({ hint: { kind: 'random', count: 4 } }));
    expect(count(rnd.hints)).toBe(4);
  });

  it('same seed gives the same result', () => {
    const a = scrambleEntry(mulberry32(5), entries[8]!, opts());
    const b = scrambleEntry(mulberry32(5), entries[8]!, opts());
    expect(b).toEqual(a);
  });
});
