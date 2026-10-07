import { useEffect, useMemo, useRef, useState } from 'react';
import { parseEntries, type Entry, type Issue } from '../core/text.ts';
import type { WordSearchResult } from '../core/wordsearch/types.ts';
import type { LayoutWarning, Page } from '../layout/drawops.ts';
import { canvasMeasure, type Measure } from '../layout/measure.ts';
import { GeneratorClient, type Progress } from './generatorClient.ts';
import { generateOptions, layoutFor, scrambleItemsFor } from './pipeline.ts';
import type { AppState } from './state.ts';

const DEBOUNCE_MS = 200;

export interface PuzzleView {
  pages: Page[];
  issues: Issue[];
  warnings: LayoutWarning[];
  unchanged: string[];
  hasClues: boolean;
  entries: Entry[];
  measure: Measure;
  wordCount: number;
  busy: boolean;
  progress: Progress | null;
  error: string | null;
}

export function usePuzzle(s: AppState): PuzzleView {
  const measure = useMemo<Measure>(() => canvasMeasure(), []);
  const parsed = useMemo(() => parseEntries(s.text), [s.text]);

  const client = useRef<GeneratorClient | null>(null);
  const [ws, setWs] = useState<WordSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsKey = JSON.stringify([s.sizeMode, s.rows, s.cols, s.dirs, s.allowOverlap, s.fillMode, s.seed]);
  useEffect(() => {
    if (s.tab !== 'ws') return;
    client.current ??= new GeneratorClient();
    const c = client.current;
    if (parsed.entries.length === 0) {
      c.cancel();
      setWs(null);
      setBusy(false);
      return;
    }
    let live = true;
    setBusy(true);
    const timer = setTimeout(() => {
      c.run(
        parsed.entries,
        generateOptions(s, s.seed),
        (p) => live && setProgress(p),
      ).then(
        (r) => {
          if (!live) return;
          setWs(r);
          setBusy(false);
          setProgress(null);
          setError(null);
        },
        (e: Error) => {
          if (!live) return;
          setError(e.message);
          setBusy(false);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
      c.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tab, parsed.entries, wsKey]);

  const scrambleItems = useMemo(() => scrambleItemsFor(parsed.entries, s, s.seed), [parsed.entries, s.seed, s.firstLetter, s.hintKind, s.hintCount]);

  const layoutKey = JSON.stringify([s.title, s.showName, s.nameLabel, s.footer, s.paper, s.scope, s.listMode, s.listColumns, s.scrambleClues, s.frame, s.cellLines, s.boldLetters]);
  const laid = useMemo(() => {
    return layoutFor(s, s.tab === 'ws' && parsed.entries.length ? ws : null, s.tab === 'scramble' ? scrambleItems : [], measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, s.tab, ws, scrambleItems, parsed.entries.length, layoutKey]);

  const issues: Issue[] = [...parsed.issues];
  if (s.tab === 'ws' && ws) {
    issues.push(...ws.issues);
    if (ws.failed.length) issues.push({ kind: 'unplaced', words: ws.failed.map((e) => e.display) });
  }
  const unchanged = s.tab === 'scramble' ? scrambleItems.filter((i) => i.scrambled.unchanged).map((i) => i.display) : [];

  return {
    pages: laid.pages,
    issues,
    warnings: laid.warnings,
    unchanged,
    hasClues: parsed.entries.some((e) => e.clue),
    entries: parsed.entries,
    measure,
    wordCount: parsed.entries.length,
    busy,
    progress,
    error,
  };
}
