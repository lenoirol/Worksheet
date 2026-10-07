export const WORDS_A = [
  'Halloween', 'Orange', 'Black', 'Cat', 'Witch', 'Warlock', 'Ghost', 'Goblin', 'Jack O Lantern', 'Trick',
  'Treat', 'Costume', 'Candy', 'Monster', 'Vampire', 'Werewolf', 'Mummy', 'Bat', 'Cauldron', 'Broom',
];

export const WORDS_B = ['Orange', 'Black', 'Cat', 'Witch', 'Ghost', 'Trick', 'Treat', 'Candy', 'Bat', 'Broom'];

export const GRID_B = [
  'FVDVANZEAT', 'VVLFYBROOM', 'BTYPETRICK', 'LRJHQRWSHC', 'AEXCATDGEA',
  'CAJPGHOSTN', 'KTBATBWAFD', 'SHQLWITCHY', 'KQAAORANGE', 'UWCMCAEJEX',
];

/** Correct positions for sample B: [word, row, col (from 1), direction]. */
export const PLACEMENTS_B: [string, number, number, 'E' | 'S'][] = [
  ['BROOM', 2, 6, 'E'], ['TRICK', 3, 6, 'E'], ['CAT', 5, 4, 'E'], ['GHOST', 6, 5, 'E'], ['BAT', 7, 3, 'E'],
  ['WITCH', 8, 5, 'E'], ['ORANGE', 9, 5, 'E'], ['BLACK', 3, 1, 'S'], ['TREAT', 3, 2, 'S'], ['CANDY', 4, 10, 'S'],
];

export const GRID_A = [
  'QAMUMMYEXZFBPLVDFTAC', 'NUJEPZGPBNHCTIWBLFEG', 'KNYQYPVQQZUJTYXLESEP', 'TODAKYFMHWKGRLXWSJRN',
  'KIWJZNNLWISNEXAEAQYR', 'HKCOLRAWABSEAQXCCTPK', 'LLZVOBLACKEQTXKMNGAI', 'HBMQJPPJIOEIZOORGOOL',
  'ACAULDRONMYILRSHABDY', 'ROILHKCVUWYAAWOSALVM', 'GHVFLUATWSNNJSBQMIZM', 'MNVHJMSYITGSTKQWTNEO',
  'DJPYPOGNEEWOLLAHDEVN', 'IXTICKYRPGCTVXWDJMCS', 'YYRYDZNJITRUOXBJGORT', 'XELULZZSEOROYRWZYRVE',
  'JSBZWYYDNACIOCJSZYCR', 'CDOCNXRZOJYOCJHTVQAH', 'IAWEYEIGMFMDFKOAQBYJ', 'OAFLOWEREWKOFFABEKAU',
];

export const toGrid = (rows: string[]): string[][] => rows.map((r) => Array.from(r));
