import { zipSync } from 'fflate';
import type { Page } from '../layout/drawops.ts';
import { renderCanvas } from '../render/canvas.ts';
import { DESKTOP_MAX_PIXELS, effectiveDpi, IOS_MAX_PIXELS, isIOS } from './pixels.ts';

export async function pageToPng(page: Page, dpi: number): Promise<{ blob: Blob; dpi: number }> {
  const used = effectiveDpi(page, dpi, isIOS() ? IOS_MAX_PIXELS : DESKTOP_MAX_PIXELS);
  const canvas = document.createElement('canvas');
  renderCanvas(page, used, canvas);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  canvas.width = canvas.height = 0; // release memory early, important on iOS
  if (!blob) throw new Error('Could not create PNG image');
  return { blob, dpi: used };
}

/** One page returns a PNG; several pages are bundled into a zip. */
export async function pagesToPngFile(pages: readonly Page[], dpi: number, baseName: string): Promise<{ blob: Blob; filename: string; dpi: number }> {
  const files: Record<string, Uint8Array> = {};
  let used = dpi;
  for (const [i, page] of pages.entries()) {
    const r = await pageToPng(page, dpi);
    used = r.dpi;
    if (pages.length === 1) return { blob: r.blob, filename: `${baseName}.png`, dpi: used };
    files[`${baseName}-${i + 1}.png`] = new Uint8Array(await r.blob.arrayBuffer());
  }
  const zip = zipSync(files, { level: 0 });
  return { blob: new Blob([zip as BlobPart], { type: 'application/zip' }), filename: `${baseName}.zip`, dpi: used };
}
