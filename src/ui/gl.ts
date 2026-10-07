import type { Scene } from './scene.ts';

/**
 * WebGL glass compositor, used where SVG backdrop filters are unavailable (Safari, Firefox).
 *
 * It draws every glass blob into one overlay canvas that sits between the content layer and the floating UI.
 * The refracted picture comes from the flat "scene" (wallpaper + sheets), sampled through the same displacement
 * map the SVG path uses, with a small blur, per-channel offsets (chromatic dispersion), saturation and brightness.
 * The blob's own DOM layers (tint, rim, hairline, shadow) stay on top of it.
 */
export interface GlBlob {
  root: HTMLElement;
  maskW: number;
  maskH: number;
  maskPx: Uint8Array;
  map: { w: number; h: number; px: Uint8Array; scale: number } | null;
  blur: number;
  chroma: boolean;
}

export interface Compositor {
  setBlob(id: number, blob: GlBlob): void;
  removeBlob(id: number): void;
}

interface Entry {
  blob: GlBlob;
  mask: WebGLTexture;
  map: WebGLTexture | null;
}

const VERT = `
precision highp float;
attribute vec2 aUV;
uniform vec4 uRect;
uniform vec2 uWin;
varying vec2 vUV;
void main() {
  vec2 p = uRect.xy + aUV * uRect.zw;
  vec2 ndc = vec2(p.x / uWin.x * 2.0 - 1.0, 1.0 - p.y / uWin.y * 2.0);
  vUV = aUV;
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uScene;
uniform sampler2D uMask;
uniform sampler2D uMap;
uniform vec2 uWin;
uniform vec4 uRect;
uniform float uMapScale;
uniform float uHasMap;
uniform float uBlur;
uniform float uChroma;
uniform float uSat;
uniform float uBright;
varying vec2 vUV;
void main() {
  float a = texture2D(uMask, vUV).a;
  if (a < 0.003) discard;
  vec2 pos = uRect.xy + vUV * uRect.zw;
  vec2 d = vec2(0.0);
  if (uHasMap > 0.5) d = (texture2D(uMap, vUV).rg - 0.5) * uMapScale;
  float kr = mix(1.0, 0.985, uChroma);
  float kb = mix(1.0, 1.015, uChroma);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float ang = fi * 2.39996;
    float r = sqrt((fi + 0.5) / 12.0) * uBlur;
    vec2 o = vec2(cos(ang), sin(ang)) * r;
    col += vec3(
      texture2D(uScene, (pos + d * kr + o) / uWin).r,
      texture2D(uScene, (pos + d + o) / uWin).g,
      texture2D(uScene, (pos + d * kb + o) / uWin).b);
  }
  col /= 12.0;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat) * uBright;
  gl_FragColor = vec4(col * a, a);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
}

function texture(gl: WebGLRenderingContext, w: number, h: number, px: Uint8Array | null): WebGLTexture {
  const t = gl.createTexture() as WebGLTexture;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function createCompositor(scene: Scene, host: HTMLElement, before: Element | null): Compositor | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl-glass';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const aUV = gl.getAttribLocation(prog, 'aUV');
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = { scene: U('uScene'), mask: U('uMask'), map: U('uMap'), win: U('uWin'), rect: U('uRect'), mapScale: U('uMapScale'), hasMap: U('uHasMap'), blur: U('uBlur'), chroma: U('uChroma'), sat: U('uSat'), bright: U('uBright') };
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  host.insertBefore(canvas, before);

  const entries = new Map<number, Entry>();
  const sceneTex = gl.createTexture() as WebGLTexture;
  gl.bindTexture(gl.TEXTURE_2D, sceneTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let pendingFrame = 0;
  const reduceTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const frame = () => {
    pendingFrame = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(window.innerWidth * dpr);
    const H = Math.round(window.innerHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (entries.size === 0 || reduceTransparency.matches || document.hidden) return;

    scene.update();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene.canvas);
    gl.uniform1i(u.scene, 0);
    gl.uniform2f(u.win, window.innerWidth, window.innerHeight);

    for (const e of entries.values()) {
      const r = e.blob.root.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || e.blob.root.style.display === 'none' || !e.blob.root.getClientRects().length) continue;
      gl.uniform4f(u.rect, r.left, r.top, r.width, r.height);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, e.mask);
      gl.uniform1i(u.mask, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, e.map ?? e.mask);
      gl.uniform1i(u.map, 2);
      gl.uniform1f(u.hasMap, e.map ? 1 : 0);
      gl.uniform1f(u.mapScale, e.blob.map?.scale ?? 0);
      gl.uniform1f(u.blur, e.blob.blur);
      gl.uniform1f(u.chroma, e.blob.chroma ? 1 : 0);
      gl.uniform1f(u.sat, 1.25);
      gl.uniform1f(u.bright, Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--glass-bright')) || 1.05);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
  // Static glass consumes no animation frames or texture uploads while the page is idle.
  const schedule = () => {
    if (!pendingFrame) pendingFrame = requestAnimationFrame(frame);
  };
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('lg-refresh', schedule);
  document.addEventListener('visibilitychange', schedule);
  reduceTransparency.addEventListener('change', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-glass'] });

  return {
    setBlob(id, blob) {
      const old = entries.get(id);
      if (old) {
        gl.deleteTexture(old.mask);
        if (old.map) gl.deleteTexture(old.map);
      }
      gl.activeTexture(gl.TEXTURE1);
      const mask = texture(gl, blob.maskW, blob.maskH, blob.maskPx);
      const map = blob.map ? texture(gl, blob.map.w, blob.map.h, blob.map.px) : null;
      entries.set(id, { blob, mask, map });
      schedule();
    },
    removeBlob(id) {
      const old = entries.get(id);
      if (!old) return;
      gl.deleteTexture(old.mask);
      if (old.map) gl.deleteTexture(old.map);
      entries.delete(id);
      schedule();
    },
  };
}
