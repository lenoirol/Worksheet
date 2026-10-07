import { flushSync } from 'react-dom';

/** Runs a state update inside a View Transition when the browser supports it and motion is allowed. */
export function withViewTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}
