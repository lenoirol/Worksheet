import { describe, expect, it } from 'vitest';
import { MAX_GRID, MIN_GRID } from '../../src/core/constants.ts';

describe('constants', () => {
  it('grid bounds', () => {
    expect(MIN_GRID).toBe(5);
    expect(MAX_GRID).toBe(100);
  });
});
