import { fontStack, PT_MM } from './page.ts';

/** Measures string width, returns mm. */
export type Measure = (text: string, sizePt: number, weight: 400 | 700, font: string) => number;

/** Rough estimate, no DOM needed: used in tests. */
export const approxMeasure: Measure = (text, sizePt, weight) =>
  Array.from(text).length * sizePt * PT_MM * (weight === 700 ? 0.58 : 0.54);

/** Measures with a real canvas. Used in the browser and in workers. */
export function canvasMeasure(): Measure {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d') as OffscreenCanvasRenderingContext2D;
  const cache = new Map<string, number>();
  return (text, sizePt, weight, font) => {
    const key = `${weight}|${font}|${text}`;
    let unit = cache.get(key);
    if (unit === undefined) {
      ctx.font = `${weight} 100px ${fontStack(font)}`;
      unit = ctx.measureText(text).width / 100;
      cache.set(key, unit);
    }
    return unit * sizePt * PT_MM;
  };
}
