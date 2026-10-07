/**
 * Pure rendering for Liquid Glass surfaces: a signed distance field built from rounded rectangles joined with a smooth
 * minimum (so nearby shapes fuse with a liquid neck), and the images derived from it: outline mask, specular rim,
 * inner glow, hairline, layered shadows and a refraction displacement map. Images are built from pixel arrays and
 * encoded as PNG directly (no <canvas> read-back, which privacy-focused browsers randomize).
 */
import { encodePng } from './png.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export interface Spec {
  band: number;
  amp: number;
  mag: number;
  blur: number;
  chroma: boolean;
}

export const SHADOW_PAD = 72;
const LIGHT = normalize(-0.55, -0.83);
export const MAX_PIXELS = 700_000;

function normalize(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

function sdRound(px: number, py: number, m: Rect): number {
  const qx = Math.abs(px - (m.x + m.w / 2)) - (m.w / 2 - m.r);
  const qy = Math.abs(py - (m.y + m.h / 2)) - (m.h / 2 - m.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - m.r;
}

/** Polynomial smooth minimum: where two shapes come within k px of each other a liquid neck forms. */
function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function field(px: number, py: number, ms: readonly Rect[], k: number): number {
  let d = sdRound(px, py, ms[0] as Rect);
  for (let i = 1; i < ms.length; i++) d = smin(d, sdRound(px, py, ms[i] as Rect), k);
  return d;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface Images {
  W: number;
  H: number;
  maskPx: Uint8Array;
  mask: string;
  rim: string;
  inner: string;
  edge: string;
  shadow: string;
  map: { url: string; w: number; h: number; px: Uint8Array; scale: number } | null;
}

/** In-place box blur of a float image (one axis at a time, running sums). */
function boxBlur(src: Float32Array, w: number, h: number, radius: number): void {
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(Math.max(w, h));
  const inv = 1 / (2 * r + 1);
  const pass = (len: number, count: number, at: (line: number, i: number) => number) => {
    for (let line = 0; line < count; line++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[at(line, Math.min(len - 1, Math.max(0, i)))] as number;
      for (let i = 0; i < len; i++) {
        tmp[i] = sum * inv;
        sum += (src[at(line, Math.min(len - 1, i + r + 1))] as number) - (src[at(line, Math.max(0, i - r))] as number);
      }
      for (let i = 0; i < len; i++) src[at(line, i)] = tmp[i] as number;
    }
  };
  pass(w, h, (line, i) => line * w + i);
  pass(h, w, (line, i) => i * w + line);
}

/** Approximate Gaussian blur: three box blurs. */
function gaussian(src: Float32Array, w: number, h: number, sigma: number): void {
  const r = Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2;
  for (let i = 0; i < 3; i++) boxBlur(src, w, h, r);
}

/** Displacement map (smaller than the shape; the filter stretches it): inward bend at the rim, magnification inside. */
function buildMap(w: number, h: number, ms: readonly Rect[], k: number, spec: Spec): NonNullable<Images['map']> {
  const eps = 0.75;
  const sm = Math.min(Math.min(window.devicePixelRatio || 1, 2), 720 / Math.max(w, h));
  const MW = Math.max(2, Math.ceil(w * sm));
  const MH = Math.max(2, Math.ceil(h * sm));
  const dx = new Float32Array(MW * MH);
  const dy = new Float32Array(MW * MH);
  let maxD = 1;
  const lens = 1 - 1 / spec.mag;
  for (let j = 0; j < MH; j++) {
    for (let i = 0; i < MW; i++) {
      const x = (i + 0.5) / sm;
      const y = (j + 0.5) / sm;
      const F = field(x, y, ms, k);
      if (F >= 0) continue;
      const gx = field(x + eps, y, ms, k) - field(x - eps, y, ms, k);
      const gy = field(x, y + eps, ms, k) - field(x, y - eps, ms, k);
      const [nx, ny] = normalize(gx, gy);
      const e = -F;
      const rimD = e < spec.band ? spec.amp * (1 - e / spec.band) ** 1.6 : 0;
      let near = ms[0] as Rect;
      let best = Infinity;
      for (const m of ms) {
        const d = sdRound(x, y, m);
        if (d < best) {
          best = d;
          near = m;
        }
      }
      const vx = -nx * rimD - (x - (near.x + near.w / 2)) * lens;
      const vy = -ny * rimD - (y - (near.y + near.h / 2)) * lens;
      const idx = j * MW + i;
      dx[idx] = vx;
      dy[idx] = vy;
      maxD = Math.max(maxD, Math.abs(vx), Math.abs(vy));
    }
  }
  const mapPx = new Uint8Array(MW * MH * 4);
  for (let n = 0; n < MW * MH; n++) {
    const o = n * 4;
    mapPx[o] = Math.round(127.5 + (127.5 * (dx[n] as number)) / maxD);
    mapPx[o + 1] = Math.round(127.5 + (127.5 * (dy[n] as number)) / maxD);
    mapPx[o + 2] = 128;
    mapPx[o + 3] = 255;
  }
  return { url: encodePng(MW, MH, mapPx), w: MW, h: MH, px: mapPx, scale: 2 * maxD };
}

/** `lite` skips the displacement map (used for animation frames, where the map would be stale anyway). */
export function render(w: number, h: number, ms: readonly Rect[], k: number, s: number, spec: Spec, lite = false): Images {
  const W = Math.max(2, Math.ceil(w * s));
  const H = Math.max(2, Math.ceil(h * s));
  const mask = new Uint8Array(W * H * 4);
  const rim = new Uint8Array(W * H * 4);
  const inner = new Uint8Array(W * H * 4);
  const edge = new Uint8Array(W * H * 4);
  const maskA = new Float32Array(W * H);
  const eps = 0.75;

  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5) / s;
      const y = (j + 0.5) / s;
      const F = field(x, y, ms, k);
      const n = j * W + i;
      const o = n * 4;
      const a = clamp01(0.5 - F * s);
      maskA[n] = a;
      mask[o + 3] = Math.round(a * 255);
      if (F > 1.6 || F < -14) continue;

      const gx = field(x + eps, y, ms, k) - field(x - eps, y, ms, k);
      const gy = field(x, y + eps, ms, k) - field(x, y - eps, ms, k);
      const [nx, ny] = normalize(gx, gy); // outward normal
      const facing = nx * LIGHT[0] + ny * LIGHT[1]; // +1 when the edge faces the light
      const e = -F; // depth inside the glass

      if (e >= 0) {
        const ring = clamp01(1 - Math.abs(e - 0.9) / 1.5);
        const light = 0.22 + 0.78 * Math.max(facing, 0) ** 2 + 0.5 * Math.max(-facing, 0) ** 3;
        rim[o + 3] = Math.round(clamp01(ring * light) * 255);
        const glow = Math.exp(-e / 8) * (0.3 + 0.7 * Math.max(facing, 0)) * 0.55 + Math.exp(-e / 2.4) * 0.25;
        inner[o + 3] = Math.round(clamp01(glow) * 255);
      }
      if (F > -0.4 && F < 1.6) edge[o + 3] = Math.round(clamp01(1 - Math.abs(F - 0.5) / 1.1) * 255);
    }
  }

  // Layered shadows (wide and soft, medium, tight contact) follow the fused outline. They are blurred at 1x and
  // only exist outside the glass, otherwise they would darken the translucent glass from underneath.
  const pad = SHADOW_PAD;
  const SW = Math.ceil(w + 2 * pad);
  const SH = Math.ceil(h + 2 * pad);
  const shadow = new Float32Array(SW * SH).fill(1); // holds the running product of (1 - alpha)
  const layer = new Float32Array(SW * SH);
  for (const [blur, dy, alpha] of [[20, 8, 0.24], [7, 3, 0.2], [1.4, 0.7, 0.25]] as const) {
    layer.fill(0);
    for (let y = 0; y < h; y++) {
      const ty = Math.round(pad + dy + y);
      if (ty < 0 || ty >= SH) continue;
      for (let x = 0; x < w; x++) {
        const mi = Math.min(H - 1, Math.floor(y * s)) * W + Math.min(W - 1, Math.floor(x * s));
        layer[ty * SW + pad + x] = maskA[mi] as number;
      }
    }
    gaussian(layer, SW, SH, blur / 2);
    for (let n = 0; n < layer.length; n++) shadow[n] = (shadow[n] as number) * (1 - (layer[n] as number) * alpha);
  }
  const shadowPx = new Uint8Array(SW * SH * 4);
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const n = y * SW + x;
      let a = 1 - (shadow[n] as number);
      const ix = x - pad;
      const iy = y - pad;
      if (ix >= 0 && iy >= 0 && ix < w && iy < h) {
        a *= 1 - (maskA[Math.min(H - 1, Math.floor(iy * s)) * W + Math.min(W - 1, Math.floor(ix * s))] as number);
      }
      shadowPx[n * 4 + 3] = Math.round(clamp01(a) * 255);
    }
  }

  const map = lite ? null : buildMap(w, h, ms, k, spec);

  return {
    W,
    H,
    maskPx: mask,
    mask: encodePng(W, H, mask),
    rim: encodePng(W, H, rim),
    inner: encodePng(W, H, inner),
    edge: encodePng(W, H, edge),
    shadow: encodePng(SW, SH, shadowPx),
    map,
  };
}

export function filterXml(id: string, href: string, scale: number, w: number, h: number, chroma: boolean): string {
  const map = `<feImage href="${href}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`;
  const dm = (k: number, out: string) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(scale * k).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="${out}"/>`;
  const ch = (m: string, from: string, out: string) => `<feColorMatrix in="${from}" type="matrix" values="${m}" result="${out}"/>`;
  const body = chroma
    ? dm(0.985, 'dr') + ch('1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0', 'dr', 'r') +
      dm(1, 'dg') + ch('0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0', 'dg', 'g') +
      dm(1.015, 'db') + ch('0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0', 'db', 'b') +
      '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>'
    : dm(1, 'out');
  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">${map}${body}</filter>`;
}

