import type { DrawOp, Page } from '../layout/drawops.ts';
import { fontStack, PT_MM } from '../layout/page.ts';
import { capsulePath } from './shapes.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => String(Math.round(v * 1000) / 1000);

function renderOp(op: DrawOp): string {
  switch (op.t) {
    case 'text':
      return (
        `<text x="${n(op.x)}" y="${n(op.y)}" font-size="${n(op.size * PT_MM)}" font-weight="${op.weight}" ` +
        `text-anchor="${op.anchor}" font-family="${esc(fontStack(op.font))}" fill="${op.color}">${esc(op.s)}</text>`
      );
    case 'line':
      return `<line x1="${n(op.x1)}" y1="${n(op.y1)}" x2="${n(op.x2)}" y2="${n(op.y2)}" stroke="${op.color}" stroke-width="${n(op.w)}"/>`;
    case 'rect':
      return (
        `<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}"` +
        (op.r ? ` rx="${n(op.r)}"` : '') +
        ` fill="${op.fill ?? 'none'}"` +
        (op.stroke ? ` stroke="${op.stroke}" stroke-width="${n(op.sw ?? 0.2)}" stroke-linejoin="round"` : '') +
        '/>'
      );
    case 'capsule':
      return `<path d="${capsulePath(op.x1, op.y1, op.x2, op.y2, op.thickness)}" fill="none" stroke="${op.stroke}" stroke-width="${n(op.sw)}"/>`;
    case 'dot':
      return `<circle cx="${n(op.x)}" cy="${n(op.y)}" r="${n(op.r)}" fill="${op.fill}"/>`;
  }
}

/** A page as an SVG string; size in mm, viewBox in mm. */
export function renderSvg(page: Page): string {
  const { widthMm: w, heightMm: h } = page;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}mm" height="${n(h)}mm" viewBox="0 0 ${n(w)} ${n(h)}" ` +
    `text-rendering="geometricPrecision"><rect width="${n(w)}" height="${n(h)}" fill="#fff"/>` +
    page.ops.map(renderOp).join('') +
    '</svg>'
  );
}
