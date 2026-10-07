/**
 * Liquid Glass refraction.
 *
 * Every element with class `lens` gets its own SVG filter, sized to the element, that bends the
 * backdrop like a thick glass lens: content near the rim is pulled inward and strongly distorted,
 * the middle is optionally magnified, and each color channel bends slightly differently
 * (chromatic dispersion). The filter is applied through `backdrop-filter: url(#...)`, which only
 * Chromium supports; other browsers never get the `lens-on` class and keep the plain blur.
 */
import { encodePng } from './png.ts';

interface Spec {
  /** Width of the bending rim, px. */
  band: number;
  /** Inward displacement at the very edge, px. */
  amp: number;
  /** Magnification of the middle (1 = none). */
  mag: number;
  /** Split the channels (three displacement passes instead of one). */
  chroma: boolean;
  blur: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_MAP = 640;

function specFor(el: Element, w: number, h: number): Spec {
  const small = Math.min(w, h);
  if (el.classList.contains('lens-thumb')) {
    const band = small * 0.22;
    // Displacement maps sample whole pixels, so any magnification turns text into stair-steps. The middle of the thumb
    // is therefore an exact copy of the backdrop (crisp label); only the rim bends, without a channel split.
    return { band, amp: band * 0.45, mag: 1, chroma: false, blur: 0.75 };
  }
  if (el.classList.contains('lens-panel')) return { band: 28, amp: 26, mag: 1, chroma: false, blur: 14 };
  const band = Math.min(small * 0.42, 22);
  return { band, amp: band * 0.8, mag: 1.05, chroma: true, blur: 3 };
}

/** Displacement map for a rounded rectangle; returns the PNG, and the scale that decodes it back to px. */
function buildMap(w: number, h: number, r: number, spec: Spec): { href: string; scale: number } {
  const s = Math.min(Math.min(window.devicePixelRatio || 1, 2), MAX_MAP / Math.max(w, h));
  const mw = Math.max(2, Math.ceil(w * s));
  const mh = Math.max(2, Math.ceil(h * s));
  const dx = new Float32Array(mw * mh);
  const dy = new Float32Array(mw * mh);
  const hx = w / 2;
  const hy = h / 2;
  const rr = Math.min(r, hx, hy);
  let maxD = 1;
  for (let j = 0; j < mh; j++) {
    for (let i = 0; i < mw; i++) {
      const px = (i + 0.5) / s - hx;
      const py = (j + 0.5) / s - hy;
      const qx = Math.abs(px) - (hx - rr);
      const qy = Math.abs(py) - (hy - rr);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
      const edge = -outside; // distance inside the outline
      if (edge < 0) continue;
      let nx: number;
      let ny: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        nx = (Math.sign(px) * qx) / len;
        ny = (Math.sign(py) * qy) / len;
      } else if (qx > qy) {
        nx = Math.sign(px);
        ny = 0;
      } else {
        nx = 0;
        ny = Math.sign(py);
      }
      // Rim: pull the backdrop inward. Middle: magnify around the center.
      const rim = edge < spec.band ? spec.amp * (1 - edge / spec.band) ** 1.6 : 0;
      const lens = 1 - 1 / spec.mag;
      const vx = -nx * rim - px * lens;
      const vy = -ny * rim - py * lens;
      const k = j * mw + i;
      dx[k] = vx;
      dy[k] = vy;
      maxD = Math.max(maxD, Math.abs(vx), Math.abs(vy));
    }
  }
  const px = new Uint8Array(mw * mh * 4);
  for (let k = 0; k < mw * mh; k++) {
    const o = k * 4;
    px[o] = Math.round(127.5 + (127.5 * (dx[k] as number)) / maxD);
    px[o + 1] = Math.round(127.5 + (127.5 * (dy[k] as number)) / maxD);
    px[o + 2] = 128;
    px[o + 3] = 255;
  }
  return { href: encodePng(mw, mh, px), scale: 2 * maxD };
}

function filterXml(id: string, href: string, scale: number, chroma: boolean, w: number, h: number): string {
  // Percentages in feImage resolve against the (zero-size) host <svg>, so the map gets explicit pixel bounds.
  const map = `<feImage href="${href}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`;
  const dm = (k: number, out: string) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(scale * k).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="${out}"/>`;
  const ch = (m: string, from: string, out: string) => `<feColorMatrix in="${from}" type="matrix" values="${m}" result="${out}"/>`;
  const body = chroma
    ? dm(0.985, 'dr') + ch('1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0', 'dr', 'r') +
      dm(1, 'dg') + ch('0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0', 'dg', 'g') +
      dm(1.03, 'db') + ch('0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0', 'db', 'b') +
      '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>'
    : dm(1, 'out');
  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">${map}${body}</filter>`;
}

const created = new Map<Element, string>();
let counter = 0;

function defs(): SVGDefsElement | null {
  return document.getElementById('lg-defs') as SVGDefsElement | null;
}

function setFilter(id: string, xml: string): void {
  const d = defs();
  if (!d) return;
  d.querySelector(`#${id}`)?.remove();
  const holder = document.createElementNS(SVG_NS, 'svg');
  holder.innerHTML = xml;
  const f = holder.firstElementChild;
  if (f) d.append(f);
}

function update(el: HTMLElement): void {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w < 8 || h < 8) {
    el.classList.remove('lens-on');
    return;
  }
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const spec = specFor(el, w, h);
  const id = created.get(el) ?? `lg-${++counter}`;
  const { href, scale } = buildMap(w, h, Math.min(radius, Math.min(w, h) / 2), spec);
  if (!href) return;
  setFilter(id, filterXml(id, href, scale, spec.chroma, w, h));
  created.set(el, id);
  el.style.setProperty('--lens-filter', `url(#${id})`);
  el.style.setProperty('--lens-blur', `${spec.blur}px`);
  el.classList.add('lens-on');
}

/** Fixed-size controls (switch knob, slider thumb) use a static filter referenced from CSS. */
function registerStatic(id: string, w: number, h: number, spec: Spec): void {
  const { href, scale } = buildMap(w, h, h / 2, spec);
  if (href) setFilter(id, filterXml(id, href, scale, spec.chroma, w, h));
}

export function installLiquidGlass(): void {
  if (!CSS.supports('backdrop-filter', 'url(#x)')) return;
  registerStatic('lg-knob', 50, 28, { band: 10, amp: 9, mag: 1.3, chroma: true, blur: 0 });
  registerStatic('lg-slider', 46, 30, { band: 11, amp: 10, mag: 1.3, chroma: true, blur: 0 });

  const pending = new Set<HTMLElement>();
  let frame = 0;
  const flush = () => {
    frame = 0;
    for (const el of pending) {
      if (el.isConnected) update(el);
      else {
        const id = created.get(el);
        if (id) defs()?.querySelector(`#${id}`)?.remove();
        created.delete(el);
        ro.unobserve(el);
        delete el.dataset.lensWatched;
      }
    }
    pending.clear();
  };
  const schedule = (el: HTMLElement) => {
    pending.add(el);
    if (!frame) frame = window.setTimeout(flush, 0);
  };

  const ro = new ResizeObserver((entries) => entries.forEach((e) => schedule(e.target as HTMLElement)));
  const watch = (el: HTMLElement) => {
    if (created.has(el) || el.dataset.lensWatched) return;
    el.dataset.lensWatched = '1';
    ro.observe(el);
    schedule(el);
  };
  const scan = (root: ParentNode) => root.querySelectorAll<HTMLElement>('.lens').forEach(watch);

  scan(document);
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          if (n.classList.contains('lens')) watch(n);
          scan(n);
        }
      });
      r.removedNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          if (n.classList.contains('lens')) schedule(n);
          n.querySelectorAll<HTMLElement>('.lens').forEach(schedule);
        }
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}
