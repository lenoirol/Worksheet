import type { DrawOp, Page } from './drawops.ts';
import type { Measure } from './measure.ts';

export const PT_MM = 25.4 / 72;
export const FONT_FAMILY = 'Helvetica';

/** CSS font stack: Helvetica, falling back to the metric-compatible Arial where Helvetica is missing. */
export const fontStack = (name: string): string => `"${name}", "Helvetica Neue", Arial, "Liberation Sans", sans-serif`;
export const INK = '#000';

export type PaperId = 'A4' | 'Letter' | 'A3';
export type Orientation = 'portrait' | 'landscape';
export interface Paper {
  id: PaperId;
  orientation: Orientation;
}

const PAPER_MM: Record<PaperId, readonly [number, number]> = {
  A4: [210, 297],
  Letter: [215.9, 279.4],
  A3: [297, 420],
};

export function paperSize(p: Paper): { widthMm: number; heightMm: number } {
  const [w, h] = PAPER_MM[p.id];
  return p.orientation === 'portrait' ? { widthMm: w, heightMm: h } : { widthMm: h, heightMm: w };
}

export function emptyPage(p: Paper): Page {
  return { ...paperSize(p), ops: [] };
}

// Measurements derived from the 3 sample PDFs (see reference/NOTES.md).
export const SIDE_MARGIN_MM = 12.7;
export const NAME_PT = 8.04;
export const NAME_BASELINE_MM = 15.5;
export const NAME_TOTAL_WIDTH_MM = 61;
export const TITLE_BASELINE_MM = 27.2;
export const FOOTER_PT = 8.04;
export const FOOTER_BASELINE_FROM_BOTTOM_MM = 13.3;

export interface ChromeOptions {
  title: string;
  showName: boolean;
  nameLabel: string;
  footer: string;
  font: string;
}

function text(x: number, y: number, s: string, size: number, weight: 400 | 700, anchor: 'start' | 'middle' | 'end', font: string): DrawOp {
  return { t: 'text', x, y, s, size, weight, anchor, font, color: INK };
}

/** Name line, title and footer. Returns the bottom edge of the page header (mm from top). */
export function chromeOps(page: Page, o: ChromeOptions, titlePt: number, measure: Measure): { headerBottom: number } {
  const { widthMm: W, heightMm: H } = page;
  let headerBottom = SIDE_MARGIN_MM;

  if (o.showName) {
    const right = W - SIDE_MARGIN_MM;
    const label = o.nameLabel;
    const labelW = measure(label, NAME_PT, 400, o.font);
    const left = right - NAME_TOTAL_WIDTH_MM;
    page.ops.push(text(left, NAME_BASELINE_MM, label, NAME_PT, 400, 'start', o.font));
    const y = NAME_BASELINE_MM + 0.35;
    page.ops.push({ t: 'line', x1: left + labelW + 1.5, y1: y, x2: right, y2: y, w: 0.15, color: INK });
    headerBottom = NAME_BASELINE_MM + 6.5;
  }

  if (o.title) {
    const maxW = W - 2 * SIDE_MARGIN_MM;
    let size = titlePt;
    while (size > 12 && measure(o.title, size, 700, o.font) > maxW) size -= 0.5;
    page.ops.push(text(W / 2, TITLE_BASELINE_MM, o.title, size, 700, 'middle', o.font));
    headerBottom = TITLE_BASELINE_MM + 6.5;
  }

  if (o.footer) {
    page.ops.push(text(W / 2, H - FOOTER_BASELINE_FROM_BOTTOM_MM, o.footer, FOOTER_PT, 400, 'middle', o.font));
  }
  return { headerBottom };
}
