import type { Entry } from '../core/text.ts';
import type { GenerateOptions, WordSearchResult } from '../core/wordsearch/types.ts';
import type { WorkerMessage } from '../workers/generator.worker.ts';

export type Progress = { rows: number; cols: number; placed: number; total: number };

/** Runs the grid generator in a Web Worker; calling `run` again or `cancel` aborts the current run. */
export class GeneratorClient {
  private worker: Worker | null = null;

  cancel(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  run(entries: Entry[], options: Omit<GenerateOptions, 'onProgress'>, onProgress: (p: Progress) => void): Promise<WordSearchResult> {
    this.cancel();
    const worker = new Worker(new URL('../workers/generator.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    return new Promise((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const m = e.data;
        if (m.type === 'progress') onProgress(m);
        else if (m.type === 'done') {
          this.cancel();
          resolve(m.result);
        } else reject(new Error(m.message));
      };
      worker.onerror = (e) => reject(new Error(e.message));
      worker.postMessage({ entries, options });
    });
  }
}
