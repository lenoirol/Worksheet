import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildPdf } from '../../src/export/pdf.ts';
import { effectiveDpi, IOS_MAX_PIXELS, pixelSize } from '../../src/export/pixels.ts';
import { buildPrintCss, buildPrintHtml } from '../../src/export/print.ts';
import type { Page } from '../../src/layout/drawops.ts';

const a4: Page = { widthMm: 210, heightMm: 297, ops: [] };
const a3: Page = { widthMm: 297, heightMm: 420, ops: [] };
const PNG_1X1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

describe('file export', () => {
  it('A4 PNG at 300 DPI is exactly 2480×3508 px', () => {
    expect(pixelSize(a4, 300)).toEqual({ width: 2480, height: 3508 });
    expect(effectiveDpi(a4, 300, IOS_MAX_PIXELS)).toBe(300);
  });

  it('lowers DPI automatically when exceeding the iOS pixel limit', () => {
    const dpi = effectiveDpi(a3, 300, IOS_MAX_PIXELS);
    const { width, height } = pixelSize(a3, dpi);
    expect(dpi).toBeLessThan(300);
    expect(width * height).toBeLessThanOrEqual(IOS_MAX_PIXELS);
  });

  it('PDF has as many pages as selected, at the right paper size', async () => {
    for (const n of [1, 2, 5]) {
      const bytes = await buildPdf(Array.from({ length: n }, () => ({ png: PNG_1X1, widthMm: 210, heightMm: 297 })), 't');
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(n);
      const { width, height } = doc.getPage(0).getSize();
      expect(width).toBeCloseTo((210 / 25.4) * 72, 1);
      expect(height).toBeCloseTo((297 / 25.4) * 72, 1);
    }
  });

  it('print: one SVG per sheet, @page matches paper size, everything outside #print-root hidden', () => {
    const html = buildPrintHtml([a4, a4, a4]);
    expect(html.match(/<div class="sheet"><svg/g)).toHaveLength(3);
    expect(html.match(/<svg/g)).toHaveLength(3);
    const css = buildPrintCss(a4);
    expect(css).toContain('@page { size: 210mm 297mm; margin: 0 }');
    expect(css).toContain('body > :not(#print-root) { display: none !important }');
    expect(css).toContain('break-after: page');
  });
});

describe('no data stored in the browser', () => {
  it('source code does not use localStorage, sessionStorage, IndexedDB or cookies', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name)) files.push(p);
      }
    };
    walk('src');
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
  });
});
