import { copySeed, mulberry32 } from '../core/rng.ts';
import { scrambleAll } from '../core/scramble/scramble.ts';
import type { Entry } from '../core/text.ts';
import type { GenerateOptions, WordSearchResult } from '../core/wordsearch/types.ts';
import type { LayoutWarning, Page } from '../layout/drawops.ts';
import { layoutScramble, type ScrambleItem } from '../layout/layoutScramble.ts';
import { layoutWordSearch } from '../layout/layoutWordSearch.ts';
import type { Measure } from '../layout/measure.ts';
import { FONT_FAMILY } from '../layout/page.ts';
import type { GeneratorClient } from './generatorClient.ts';
import type { AppState } from './state.ts';

const ANSWER_SUFFIX = 'Answer';

export function generateOptions(s: AppState, seed: number): Omit<GenerateOptions, 'onProgress'> {
  return {
    size: s.sizeMode === 'auto' ? { mode: 'auto' } : { mode: 'manual', rows: s.rows, cols: s.cols },
    dirs: s.dirs.length ? s.dirs : ['E'],
    allowOverlap: s.allowOverlap,
    fillMode: s.fillMode,
    seed,
  };
}

export function scrambleItemsFor(entries: readonly Entry[], s: AppState, seed: number): ScrambleItem[] {
  const usable = entries.filter((e) => e.letters.length > 0);
  const scr = scrambleAll(mulberry32(seed), usable, {
    firstLetter: s.firstLetter,
    hint: s.hintKind === 'random' ? { kind: 'random', count: s.hintCount } : { kind: s.hintKind },
  });
  return usable.map((e, i) => ({ display: e.display, ...(e.clue ? { clue: e.clue } : {}), scrambled: scr[i]! }));
}

export function layoutFor(s: AppState, ws: WordSearchResult | null, items: readonly ScrambleItem[], measure: Measure): { pages: Page[]; warnings: LayoutWarning[] } {
  const common = { paper: s.paper, title: s.title, showName: s.showName, nameLabel: s.nameLabel, footer: s.footer, font: FONT_FAMILY, answerSuffix: ANSWER_SUFFIX };
  if (s.tab === 'ws') {
    if (!ws) return { pages: [], warnings: [] };
    return layoutWordSearch(
      { grid: ws.grid, placements: ws.placements },
      { ...common, listMode: s.listMode, listColumns: s.listColumns, style: { frame: s.frame, cellLines: s.cellLines, boldLetters: s.boldLetters } },
      measure,
      s.scope,
    );
  }
  if (items.length === 0) return { pages: [], warnings: [] };
  return layoutScramble(items, { ...common, showClues: s.scrambleClues }, measure, s.scope);
}

/** Builds every page of `s.copies` copies, one seed each (copy 1 matches the preview). */
export async function buildAllPages(
  s: AppState,
  entries: readonly Entry[],
  measure: Measure,
  client: GeneratorClient,
  onProgress: (done: number, total: number) => void,
): Promise<Page[]> {
  const pages: Page[] = [];
  for (let i = 0; i < s.copies; i++) {
    onProgress(i, s.copies);
    const seed = copySeed(s.seed, i);
    const ws = s.tab === 'ws' ? await client.run([...entries], generateOptions(s, seed), () => {}) : null;
    pages.push(...layoutFor(s, ws, s.tab === 'scramble' ? scrambleItemsFor(entries, s, seed) : [], measure).pages);
  }
  onProgress(s.copies, s.copies);
  return pages;
}
