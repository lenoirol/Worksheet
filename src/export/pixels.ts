import type { Page } from '../layout/drawops.ts';

export const IOS_MAX_PIXELS = 16_700_000;
export const DESKTOP_MAX_PIXELS = 100_000_000;
const MAX_SIDE = 16_384;

export const pixelSize = (page: Page, dpi: number) => ({
  width: Math.round((page.widthMm / 25.4) * dpi),
  height: Math.round((page.heightMm / 25.4) * dpi),
});

/** Actual DPI used: reduced if the image exceeds the canvas pixel limit or longest side. */
export function effectiveDpi(page: Page, dpi: number, maxPixels: number): number {
  let d = dpi;
  while (d > 50) {
    const { width, height } = pixelSize(page, d);
    if (width * height <= maxPixels && Math.max(width, height) <= MAX_SIDE) break;
    d = Math.floor(d * 0.97);
  }
  return d;
}

export const isIOS = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
