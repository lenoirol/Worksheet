const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** Capsule as an SVG path: two semicircles joined by two straight segments. */
export function capsulePath(x1: number, y1: number, x2: number, y2: number, thickness: number): string {
  const r = thickness / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * r;
  const ny = ((x2 - x1) / len) * r;
  return (
    `M${n(x1 + nx)} ${n(y1 + ny)}L${n(x2 + nx)} ${n(y2 + ny)}` +
    `A${n(r)} ${n(r)} 0 0 0 ${n(x2 - nx)} ${n(y2 - ny)}` +
    `L${n(x1 - nx)} ${n(y1 - ny)}A${n(r)} ${n(r)} 0 0 0 ${n(x1 + nx)} ${n(y1 + ny)}Z`
  );
}
