import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildVectorPdf } from '../../src/export/pdfVector.ts';
import type { Page } from '../../src/layout/drawops.ts';

const page = (n: number): Page => ({
  widthMm: 210,
  heightMm: 297,
  ops: [
    { t: 'text', x: 105, y: 27, s: `Halloween ${n}`, size: 26, weight: 700, anchor: 'middle', font: 'Helvetica', color: '#000' },
    { t: 'text', x: 20, y: 60, s: 'Orange', size: 16, weight: 400, anchor: 'start', font: 'Helvetica', color: '#000' },
    { t: 'text', x: 190, y: 60, s: 'Sunday', size: 16, weight: 400, anchor: 'end', font: 'Helvetica', color: '#000' },
    { t: 'line', x1: 20, y1: 70, x2: 100, y2: 70, w: 0.3, color: '#000' },
    { t: 'rect', x: 20, y: 80, w: 100, h: 100, stroke: '#000', sw: 0.5 },
    { t: 'capsule', x1: 30, y1: 100, x2: 90, y2: 120, thickness: 8, stroke: '#000', sw: 0.3 },
    { t: 'dot', x: 30, y: 100, r: 0.8, fill: '#000' },
  ],
});

describe('PDF vector', () => {
  it('has the right page count and page size, is vector (no images), and uses a standard font', async () => {
    const bytes = await buildVectorPdf([page(1), page(2), page(3)], 'Test');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo((210 / 25.4) * 72, 1);
    expect(height).toBeCloseTo((297 / 25.4) * 72, 1);
    const raw = Buffer.from(bytes).toString('latin1');
    expect(raw).not.toMatch(/\/Subtype\s*\/Image/);
    // Standard fonts are referenced by name, not embedded.
    expect(raw).toMatch(/\/Helvetica/);
    expect(raw).not.toMatch(/\/FontFile/);
    expect(bytes.length).toBeLessThan(400_000);
  });
});
