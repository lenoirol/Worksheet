import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Dev only: the dev/preview page sends PNG captures of the SVG, which are written to reference/shots/. */
const saveShots = (): Plugin => ({
  name: 'save-shots',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__save', (req, res) => {
      const q = new URL(req.url ?? '', 'http://x').searchParams;
      const name = q.get('name') ?? 'shot';
      const dir = q.get('dir') === 'icons' ? 'public/icons' : 'reference/shots';
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        mkdirSync(dir, { recursive: true });
        writeFileSync(`${dir}/${name.replace(/[^\w-]/g, '_')}.${q.get('ext') === 'pdf' ? 'pdf' : 'png'}`, Buffer.from(Buffer.concat(chunks).toString(), 'base64'));
        res.end('ok');
      });
    });
  },
});

/** On build: generates sw.js with the list of files to precache (source, icons). */
const offlineSw = (): Plugin => ({
  name: 'offline-sw',
  apply: 'build',
  generateBundle(_, bundle) {
    const files = ['./', ...Object.keys(bundle), 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
    const template = readFileSync('scripts/sw.template.js', 'utf8');
    const version = createHash('sha1').update(template + files.join('|') + Object.values(bundle).map((b) => ('code' in b ? b.code : b.fileName)).join('')).digest('hex').slice(0, 10);
    const source = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files));
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), saveShots(), offlineSw()],
  test: { include: ['tests/**/*.test.ts'] },
});
