import type { DrawOp, Page } from '../layout/drawops.ts';
import { fontStack, PT_MM } from '../layout/page.ts';

type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function capsule(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, thickness: number): void {
  const r = thickness / 2;
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2);
  ctx.arc(x1, y1, r, a + Math.PI / 2, a - Math.PI / 2);
  ctx.closePath();
}

function drawOp(ctx: Ctx, op: DrawOp): void {
  switch (op.t) {
    case 'text':
      ctx.font = `${op.weight} ${op.size * PT_MM}px ${fontStack(op.font)}`;
      ctx.textAlign = op.anchor === 'middle' ? 'center' : op.anchor === 'end' ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = op.color;
      ctx.fillText(op.s, op.x, op.y);
      return;
    case 'line':
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.w;
      ctx.beginPath();
      ctx.moveTo(op.x1, op.y1);
      ctx.lineTo(op.x2, op.y2);
      ctx.stroke();
      return;
    case 'rect':
      if (op.fill) {
        ctx.fillStyle = op.fill;
        ctx.fillRect(op.x, op.y, op.w, op.h);
      }
      if (op.stroke) {
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = op.sw ?? 0.2;
        ctx.lineJoin = 'round';
        ctx.strokeRect(op.x, op.y, op.w, op.h);
      }
      return;
    case 'capsule':
      capsule(ctx, op.x1, op.y1, op.x2, op.y2, op.thickness);
      ctx.strokeStyle = op.stroke;
      ctx.lineWidth = op.sw;
      ctx.stroke();
      return;
    case 'dot':
      ctx.fillStyle = op.fill;
      ctx.beginPath();
      ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
      ctx.fill();
  }
}

/** Draws a page onto a canvas at `dpi`. */
export function renderCanvas(page: Page, dpi: number, canvas: HTMLCanvasElement | OffscreenCanvas): void {
  const scale = dpi / 25.4;
  canvas.width = Math.round(page.widthMm * scale);
  canvas.height = Math.round(page.heightMm * scale);
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.setTransform(canvas.width / page.widthMm, 0, 0, canvas.height / page.heightMm, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, page.widthMm, page.heightMm);
  for (const op of page.ops) drawOp(ctx, op);
}
