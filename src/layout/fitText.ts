import type { Measure } from './measure.ts';

/** Shrinks text (down to `minPt`) to fit `maxW` mm; if still too long, truncates and appends "…". */
export function fitText(measure: Measure, text: string, pt: number, maxW: number, font: string, minPt: number): { text: string; pt: number } {
  let size = pt;
  while (size > minPt && measure(text, size, 400, font) > maxW) size -= 0.5;
  if (measure(text, size, 400, font) <= maxW) return { text, pt: size };
  const chars = Array.from(text);
  while (chars.length > 1 && measure(chars.join('') + '…', size, 400, font) > maxW) chars.pop();
  return { text: chars.join('').trimEnd() + '…', pt: size };
}
