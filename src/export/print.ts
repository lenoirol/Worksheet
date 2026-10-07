import type { Page } from '../layout/drawops.ts';
import { renderSvg } from '../render/svg.ts';

const ROOT_ID = 'print-root';
const STYLE_ID = 'print-style';

export function buildPrintCss(page: Page): string {
  const w = `${page.widthMm}mm`;
  const h = `${page.heightMm}mm`;
  return `@page { size: ${w} ${h}; margin: 0 }
#${ROOT_ID} { display: none }
@media print {
  html, body { margin: 0; padding: 0; background: #fff }
  body > :not(#${ROOT_ID}) { display: none !important }
  #${ROOT_ID} { display: block }
  .sheet { width: ${w}; height: ${h}; break-after: page; overflow: hidden }
  .sheet:last-child { break-after: auto }
  .sheet svg { display: block; width: ${w}; height: ${h} }
}`;
}

export function buildPrintHtml(pages: readonly Page[]): string {
  return pages.map((p) => `<div class="sheet">${renderSvg(p)}</div>`).join('');
}

/** Inserts the pages into #print-root then calls window.print(). Cleans up after printing. */
export function printPages(pages: readonly Page[]): void {
  const first = pages[0];
  if (!first) return;
  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildPrintCss(first);
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML = buildPrintHtml(pages);
  document.head.append(style);
  document.body.append(root);
  const cleanup = () => {
    root.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
