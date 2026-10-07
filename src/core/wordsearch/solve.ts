import { DIR_VECTORS, type Dir, type Grid, type Occurrence } from './types.ts';

/** Every occurrence of `letters` in the grid along the allowed directions. */
export function findWord(grid: Grid, letters: readonly string[], dirs: readonly Dir[]): Occurrence[] {
  const out: Occurrence[] = [];
  const rows = grid.length;
  const cols = rows ? (grid[0] as string[]).length : 0;
  const n = letters.length;
  if (n === 0) return out;
  for (let r = 0; r < rows; r++) {
    const row = grid[r] as string[];
    for (let c = 0; c < cols; c++) {
      if (row[c] !== letters[0]) continue;
      for (const dir of dirs) {
        const [dr, dc] = DIR_VECTORS[dir];
        const er = r + dr * (n - 1);
        const ec = c + dc * (n - 1);
        if (er < 0 || er >= rows || ec < 0 || ec >= cols) continue;
        let i = 1;
        while (i < n && (grid[r + dr * i] as string[])[c + dc * i] === letters[i]) i++;
        if (i === n) out.push({ row: r, col: c, dir });
      }
    }
  }
  return out;
}

/** The (row, col) cells an occurrence passes through. */
export function cellsOf(occ: Occurrence, length: number): [number, number][] {
  const [dr, dc] = DIR_VECTORS[occ.dir];
  return Array.from({ length }, (_, i) => [occ.row + dr * i, occ.col + dc * i] as [number, number]);
}
