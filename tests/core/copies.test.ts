import { describe, expect, it } from 'vitest';
import { copySeed } from '../../src/core/rng.ts';

describe('copySeed', () => {
  it('the first copy uses the base seed; later copies differ and are stable', () => {
    expect(copySeed(12345, 0)).toBe(12345);
    const seeds = Array.from({ length: 50 }, (_, i) => copySeed(12345, i));
    expect(new Set(seeds).size).toBe(50);
    expect(seeds).toEqual(Array.from({ length: 50 }, (_, i) => copySeed(12345, i)));
    expect(copySeed(1, 3)).not.toBe(copySeed(2, 3));
  });
});
