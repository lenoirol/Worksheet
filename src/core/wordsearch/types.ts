import type { Entry, Issue } from '../text.ts';

export type Dir = 'E' | 'W' | 'S' | 'N' | 'SE' | 'NW' | 'NE' | 'SW';

/** [dRow, dCol] of each direction; rows increase downward, columns increase to the right. */
export const DIR_VECTORS: Readonly<Record<Dir, readonly [number, number]>> = {
  E: [0, 1],
  W: [0, -1],
  S: [1, 0],
  N: [-1, 0],
  SE: [1, 1],
  NW: [-1, -1],
  NE: [-1, 1],
  SW: [1, -1],
};

export const ALL_DIRS: readonly Dir[] = ['E', 'W', 'S', 'N', 'SE', 'NW', 'NE', 'SW'];

export const DIR_PRESETS = {
  easy: ['E', 'S'],
  medium: ['E', 'S', 'SE'],
  hard: ALL_DIRS,
} as const satisfies Record<string, readonly Dir[]>;

export type Grid = string[][];

export interface Occurrence {
  row: number;
  col: number;
  dir: Dir;
}

/** Placed position of an entry: (row, col) is the first letter's cell, numbered from 0. */
export interface Placement extends Occurrence {
  entryIndex: number;
  entry: Entry;
}

export type SizeSpec = { mode: 'auto' } | { mode: 'manual'; rows: number; cols: number };

export interface GenerateOptions {
  size: SizeSpec;
  dirs: readonly Dir[];
  allowOverlap: boolean;
  fillMode: 'uniform' | 'fromWords';
  seed: number;
  maxAttempts?: number;
  timeLimitMs?: number;
  overlapBonus?: number;
  onProgress?: (info: { rows: number; cols: number; attempt: number; placed: number; total: number }) => void;
}

export interface WordSearchResult {
  rows: number;
  cols: number;
  grid: Grid;
  placements: Placement[];
  /** Passed validation but could not be placed in the grid. */
  failed: Entry[];
  /** Rejected before grid generation (too short, too long). */
  issues: Issue[];
  seed: number;
}
