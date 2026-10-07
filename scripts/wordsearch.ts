// Usage: node scripts/wordsearch.ts [--file words.txt] [--rows N --cols N] [--dirs easy|medium|hard] [--seed N] [--fill uniform|fromWords]
// Without --file, reads the word list (one word per line) from stdin. Without --rows/--cols, the grid size is chosen automatically.
import { readFileSync } from 'node:fs';
import { randomSeed } from '../src/core/rng.ts';
import { parseEntries } from '../src/core/text.ts';
import { generateWordSearch } from '../src/core/wordsearch/generate.ts';
import { DIR_PRESETS } from '../src/core/wordsearch/types.ts';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const text = readFileSync(opt('file') ?? 0, 'utf8');
const { entries, issues } = parseEntries(text);
const rows = Number(opt('rows') ?? 0);
const cols = Number(opt('cols') ?? rows);
const preset = (opt('dirs') ?? 'hard') as keyof typeof DIR_PRESETS;
const seed = Number(opt('seed') ?? randomSeed());

const t0 = Date.now();
const res = generateWordSearch(entries, {
  size: rows ? { mode: 'manual', rows, cols } : { mode: 'auto' },
  dirs: DIR_PRESETS[preset],
  allowOverlap: true,
  fillMode: (opt('fill') ?? 'uniform') as 'uniform' | 'fromWords',
  seed,
});

console.log(res.grid.map((r) => r.join(' ')).join('\n'));
console.log(`\n${res.rows}x${res.cols}, seed ${seed}, ${res.placements.length}/${entries.length} words, ${Date.now() - t0} ms`);
if (res.failed.length) console.log(`Could not place: ${res.failed.map((e) => e.display).join(', ')}`);
for (const i of [...issues, ...res.issues]) console.log('Note:', JSON.stringify(i));
