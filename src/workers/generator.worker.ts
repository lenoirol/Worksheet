import { generateWordSearch } from '../core/wordsearch/generate.ts';
import type { Entry } from '../core/text.ts';
import type { GenerateOptions, WordSearchResult } from '../core/wordsearch/types.ts';

export type WorkerRequest = { entries: Entry[]; options: Omit<GenerateOptions, 'onProgress'> };
export type WorkerMessage =
  | { type: 'progress'; rows: number; cols: number; attempt: number; placed: number; total: number }
  | { type: 'done'; result: WordSearchResult }
  | { type: 'error'; message: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  try {
    const result = generateWordSearch(e.data.entries, {
      ...e.data.options,
      onProgress: (info) => self.postMessage({ type: 'progress', ...info } satisfies WorkerMessage),
    });
    self.postMessage({ type: 'done', result } satisfies WorkerMessage);
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) } satisfies WorkerMessage);
  }
};
