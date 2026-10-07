import { pageBitmap } from './pageStore.ts';

/**
 * A flat picture of everything that sits behind the glass: the wallpaper and the preview sheets.
 * Two uses: measuring how bright the backdrop is (adaptive tint), and feeding the WebGL refraction used in
 * browsers without SVG backdrop filters.
 */
export interface Scene {
  canvas: HTMLCanvasElement;
  scale: number;
  update(): void;
  /** Mean luminance (0 dark, 1 bright) of a window rectangle. */
  luminance(x: number, y: number, w: number, h: number): number;
}

function rgbaParts(css: string): [number, number, number, number] {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return [128, 128, 128, 1];
  const p = (m[1] as string).split(/[ ,/]+/).filter(Boolean).map(Number);
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
}

export function createScene(scale: number): Scene {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const content = document.createElement('canvas');
  const contentCtx = content.getContext('2d') as CanvasRenderingContext2D;
  const probe = document.createElement('canvas');
  probe.width = probe.height = 4;
  const pg = probe.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

  const update = () => {
    const w = Math.max(1, Math.ceil(window.innerWidth * scale));
    const h = Math.max(1, Math.ceil(window.innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      content.width = w;
      content.height = h;
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const win = document.querySelector('.window');
    ctx.fillStyle = win ? getComputedStyle(win).backgroundColor : '#f2f2f7';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    document.querySelectorAll<HTMLElement>('.wallpaper i').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const [cr, cg, cb] = rgbaParts(cs.backgroundColor);
      const op = parseFloat(cs.opacity) || 0.5;
      const radius = (Math.max(r.width, r.height) / 2) * 1.15;
      const g = ctx.createRadialGradient(r.left + r.width / 2, r.top + r.height / 2, 0, r.left + r.width / 2, r.top + r.height / 2, radius);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${op})`);
      g.addColorStop(0.6, `rgba(${cr},${cg},${cb},${op * 0.55})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(r.left - radius * 0.2, r.top - radius * 0.2, r.width + radius * 0.4, r.height + radius * 0.4);
    });

    contentCtx.setTransform(scale, 0, 0, scale, 0, 0);
    contentCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    document.querySelectorAll<HTMLElement>('.sheet-view').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return;
      const bmp = pageBitmap(Number(el.dataset.pageIndex ?? -1), r.width * scale);
      contentCtx.fillStyle = '#fff';
      contentCtx.fillRect(r.left, r.top, r.width, r.height);
      if (bmp) contentCtx.drawImage(bmp, r.left, r.top, r.width, r.height);
    });
    // Match the content's scroll-edge mask, so tone selection sees the same backdrop as the user.
    const main = document.querySelector('.content');
    const maskImage = main ? getComputedStyle(main).maskImage : 'none';
    if (maskImage !== 'none') {
      contentCtx.globalCompositeOperation = 'destination-in';
      // Use the measured container's compact fade stops.
      const height = window.innerHeight;
      const fade = contentCtx.createLinearGradient(0, 0, 0, height);
      const safeTop = main ? Math.max(0, parseFloat(getComputedStyle(main).paddingTop) - 86) : 0;
      fade.addColorStop(0, 'transparent');
      fade.addColorStop(Math.min(0.4, (76 + safeTop) / height), '#000');
      fade.addColorStop(Math.max(0.4, (height - 110) / height), '#000');
      fade.addColorStop(Math.max(0.4, (height - 20) / height), 'transparent');
      contentCtx.fillStyle = fade;
      contentCtx.fillRect(0, 0, window.innerWidth, height);
      contentCtx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(content, 0, 0, window.innerWidth, window.innerHeight);
  };

  const luminance = (x: number, y: number, w: number, h: number) => {
    const sx = Math.max(0, Math.floor(x * scale));
    const sy = Math.max(0, Math.floor(y * scale));
    const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(w * scale)));
    const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(h * scale)));
    if (sx >= canvas.width || sy >= canvas.height) return 0.5;
    pg.clearRect(0, 0, 4, 4);
    pg.drawImage(canvas, sx, sy, sw, sh, 0, 0, 4, 4);
    const d = pg.getImageData(0, 0, 4, 4).data;
    let sum = 0;
    for (let i = 0; i < 16; i++) sum += (0.2126 * (d[i * 4] as number) + 0.7152 * (d[i * 4 + 1] as number) + 0.0722 * (d[i * 4 + 2] as number)) / 255;
    return sum / 16;
  };

  return { canvas, scale, update, luminance };
}
