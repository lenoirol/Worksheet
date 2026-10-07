/** Glass optics are rebuilt only when geometry changes. Movement belongs to composited CSS layers. */
import { createCompositor, type Compositor } from './gl.ts';
import { filterXml, MAX_PIXELS, render, SHADOW_PAD, type Rect, type Spec } from './liquidRender.ts';
import { createScene, type Scene } from './scene.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const url = (u: string) => `url(${u})`;

interface Shared {
  refract: boolean;
  scene: Scene;
  compositor: () => Compositor | null;
}

class Blob {
  readonly host: HTMLElement;
  readonly id: number;
  private root = document.createElement('div');
  private shadow = document.createElement('div');
  private glass = document.createElement('div');
  private inner = document.createElement('div');
  private rim = document.createElement('div');
  private edge = document.createElement('div');
  private signature = '';
  private filterId: string;
  private panel: boolean;
  private selector: string;
  private shared: Shared;

  constructor(host: HTMLElement, selector: string, shared: Shared, id: number) {
    this.host = host;
    this.selector = selector;
    this.shared = shared;
    this.id = id;
    this.panel = host.dataset.blobSpec === 'panel';
    this.filterId = `lq-${id}`;
    this.root.className = 'gblob';
    this.shadow.className = 'gblob-shadow';
    this.glass.className = 'gblob-glass';
    this.inner.className = 'gblob-inner';
    this.rim.className = 'gblob-rim';
    this.edge.className = 'gblob-edge';
    this.root.append(this.shadow, this.glass, this.inner, this.rim, this.edge);
    host.prepend(this.root);
  }

  private rect(el: HTMLElement): Rect {
    let x = 0;
    let y = 0;
    let n: HTMLElement | null = el;
    while (n && n !== this.host) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent as HTMLElement | null;
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    return { x, y, w, h, r: Math.min(r, w / 2, h / 2) };
  }

  update(): void {
    const members = this.selector === 'self' ? [this.host] :
      Array.from(this.host.querySelectorAll<HTMLElement>(this.selector));
    const rects = members.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0).map(el => this.rect(el));
    // Compact forms deliberately use a solid content surface rather than a full-screen glass pane.
    if (!rects.length || !this.host.offsetWidth || (this.host.matches('.sidebar') && window.innerWidth <= 860)) {
      this.root.style.display = 'none';
      this.host.classList.remove('blob-on');
      this.signature = '';
      this.shared.compositor()?.removeBlob(this.id);
      return;
    }
    const bx = Math.min(...rects.map(r => r.x));
    const by = Math.min(...rects.map(r => r.y));
    const bw = Math.max(...rects.map(r => r.x + r.w)) - bx;
    const bh = Math.max(...rects.map(r => r.y + r.h)) - by;
    const local = rects.map(r => ({ ...r, x: r.x - bx, y: r.y - by }));
    Object.assign(this.root.style, { display: 'block', left: `${bx}px`, top: `${by}px`, width: `${bw}px`, height: `${bh}px` });
    const sig = JSON.stringify(local);
    if (sig === this.signature) { this.adapt(); return; }
    this.signature = sig;
    const band = this.panel ? 18 : Math.min(Math.min(bw, bh) * 0.3, 14);
    const spec: Spec = { band, amp: this.panel ? 7 : band * 0.55, mag: 1, blur: this.panel ? 20 : 5, chroma: !this.panel };
    const scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / (bw * bh)));
    const img = render(bw, bh, local, Number(this.host.dataset.blobK ?? 16), scale, spec);
    const mask = (el: HTMLElement, src: string) => {
      el.style.maskImage = url(src);
      el.style.setProperty('-webkit-mask-image', url(src));
    };
    mask(this.glass, img.mask);
    mask(this.inner, img.inner);
    mask(this.rim, img.rim);
    mask(this.edge, img.edge);
    const pad = SHADOW_PAD;
    Object.assign(this.shadow.style, { left: `${-pad}px`, top: `${-pad}px`, width: `${bw + 2 * pad}px`, height: `${bh + 2 * pad}px` });
    mask(this.shadow, img.shadow);

    // Nested popovers need the actual DOM underneath; the flat WebGL scene cannot represent form controls.
    const compositor = this.host.closest('.sidebar') && !this.host.matches('.sidebar') ? null : this.shared.compositor();
    if (compositor) {
      this.glass.classList.add('gl');
      compositor.setBlob(this.id, { root: this.root, maskW: img.W, maskH: img.H, maskPx: img.maskPx, map: img.map,
        blur: parseFloat(getComputedStyle(this.root).getPropertyValue(this.panel ? '--blob-blur-panel' : '--blob-blur-small')) || spec.blur, chroma: spec.chroma });
    } else {
      let bf = `blur(var(--blob-blur-${this.panel ? 'panel' : 'small'})) saturate(125%) brightness(var(--glass-bright))`;
      if (this.shared.refract && img.map) {
        const defs = document.getElementById('lg-defs');
        if (defs) {
          defs.querySelector(`#${this.filterId}`)?.remove();
          const holder = document.createElementNS(SVG_NS, 'svg');
          holder.innerHTML = filterXml(this.filterId, img.map.url, img.map.scale, bw, bh, spec.chroma);
          if (holder.firstElementChild) defs.append(holder.firstElementChild);
          bf = `${url(`#${this.filterId}`)} ${bf}`;
        }
      }
      this.glass.style.setProperty('backdrop-filter', bf);
      this.glass.style.setProperty('-webkit-backdrop-filter', bf);
    }
    this.host.classList.add('blob-on');
    this.adapt();
  }

  refresh(): void {
    // CSS variables update the SVG path automatically; WebGL uniforms/textures need an explicit update.
    if (this.glass.classList.contains('gl')) this.signature = '';
    this.update();
  }

  adapt(): void {
    if (!this.host.hasAttribute('data-adapt') || this.root.style.display === 'none') return;
    const r = this.root.getBoundingClientRect();
    const L = this.shared.scene.luminance(r.left, r.top, r.width, r.height);
    let next = this.host.dataset.tone;
    if (L > 0.64) next = 'light';
    else if (L < 0.42) next = 'dark';
    else if (!next) next = L > 0.53 ? 'light' : 'dark';
    if (next && next !== this.host.dataset.tone) this.host.dataset.tone = next;
  }

  setPointer(x: number, y: number): void {
    const r = this.root.getBoundingClientRect();
    this.root.style.setProperty('--mx', `${x - r.left}px`);
    this.root.style.setProperty('--my', `${y - r.top}px`);
  }

  destroy(): void {
    this.shared.compositor()?.removeBlob(this.id);
    this.root.remove();
    document.getElementById('lg-defs')?.querySelector(`#${this.filterId}`)?.remove();
  }
}

export function installLiquidBlobs(): void {
  const refract = CSS.supports('backdrop-filter', 'url(#x)');
  const forceGl = new URLSearchParams(location.search).has('gl');
  const useGl = !refract || forceGl;
  const scene = createScene(useGl ? 0.5 : 1 / 6);
  let compositor: Compositor | null = null;
  let compositorTried = false;
  const shared: Shared = {
    refract: refract && !forceGl, scene,
    compositor: () => {
      if (!useGl) return null;
      if (!compositorTried) {
        const win = document.querySelector<HTMLElement>('.window');
        if (!win) return null;
        compositorTried = true;
        compositor = createCompositor(scene, win, win.querySelector('.sidebar'));
      }
      return compositor;
    },
  };
  const blobs = new Map<HTMLElement, Blob>();
  const observers = new Map<HTMLElement, MutationObserver>();
  const watched = new Map<HTMLElement, Set<HTMLElement>>();
  const dirty = new Set<Blob>();
  let counter = 0;
  let frame = 0;
  const schedule = (b: Blob) => {
    dirty.add(b);
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      for (const item of dirty) if (item.host.isConnected) item.update();
      dirty.clear();
    });
  };
  const ro = new ResizeObserver(entries => {
    for (const entry of entries) {
      const host = (entry.target as HTMLElement).closest<HTMLElement>('[data-blob]');
      const b = host && blobs.get(host);
      if (b) schedule(b);
    }
  });
  const observeMembers = (host: HTMLElement) => {
    const sel = host.dataset.blob;
    const next = new Set(sel && sel !== 'self' ? host.querySelectorAll<HTMLElement>(sel) : [host]);
    for (const el of watched.get(host) ?? []) if (!next.has(el)) ro.unobserve(el);
    for (const el of next) ro.observe(el);
    watched.set(host, next);
  };
  const attach = (host: HTMLElement) => {
    if (blobs.has(host)) return;
    const b = new Blob(host, host.dataset.blob ?? 'self', shared, ++counter);
    blobs.set(host, b);
    observeMembers(host);
    const observer = new MutationObserver(records => {
      if (records.every(r => r.target instanceof HTMLElement && r.target.closest('.gblob'))) return;
      observeMembers(host);
      schedule(b);
    });
    observer.observe(host, { childList: true, subtree: true });
    observers.set(host, observer);
    schedule(b);
  };
  const scan = (root: ParentNode) => root.querySelectorAll<HTMLElement>('[data-blob]').forEach(attach);
  const clean = () => {
    for (const [host, b] of blobs) if (!host.isConnected) {
      observers.get(host)?.disconnect();
      observers.delete(host);
      for (const el of watched.get(host) ?? []) ro.unobserve(el);
      watched.delete(host);
      dirty.delete(b);
      b.destroy();
      blobs.delete(host);
    }
  };
  let toneFrame = 0;
  const refreshTones = () => {
    if (toneFrame) return;
    toneFrame = requestAnimationFrame(() => {
      toneFrame = 0;
      scene.update();
      for (const b of blobs.values()) b.adapt();
    });
  };
  const refreshMaterial = () => {
    scene.update();
    for (const b of blobs.values()) b.refresh();
  };
  scan(document);
  new MutationObserver(records => {
    for (const r of records) r.addedNodes.forEach(n => {
      if (!(n instanceof HTMLElement) || n.classList.contains('gblob')) return;
      if (n.matches('[data-blob]')) attach(n);
      scan(n);
    });
    clean();
    refreshTones();
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('scroll', refreshTones, { capture: true, passive: true });
  window.addEventListener('resize', () => { for (const b of blobs.values()) schedule(b); refreshTones(); });
  window.addEventListener('lg-refresh', refreshTones);
  new MutationObserver(refreshMaterial).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-glass'] });
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const host = (e.target as Element | null)?.closest<HTMLElement>('[data-blob]');
    const b = host && blobs.get(host);
    if (b) b.setPointer(e.clientX, e.clientY);
  }, { passive: true });
}
