import type { Page } from '../layout/drawops.ts';
import { renderCanvas } from '../render/canvas.ts';

/**
 * Keeps the pages that are on screen so the glass "scene" (what sits behind the glass) can draw the real
 * sheets, not just white rectangles. Bitmaps are cached per page and width.
 */
let pages: readonly Page[] = [];
const cache = new Map<Page, { width: number; canvas: HTMLCanvasElement }>();

export function setPages(next: readonly Page[]): void {
  pages = next;
  for (const key of cache.keys()) if (!next.includes(key)) cache.delete(key);
}

/** A bitmap of page `index` about `pixelWidth` px wide, or null if there is no such page. */
export function pageBitmap(index: number, pixelWidth: number): HTMLCanvasElement | null {
  const page = pages[index];
  if (!page) return null;
  const width = Math.max(64, Math.round(pixelWidth));
  const hit = cache.get(page);
  if (hit && Math.abs(hit.width - width) < 24) return hit.canvas;
  const canvas = hit?.canvas ?? document.createElement('canvas');
  renderCanvas(page, (width / page.widthMm) * 25.4, canvas);
  cache.set(page, { width, canvas });
  return canvas;
}
