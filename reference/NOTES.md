# Survey notes on the 3 sample PDFs (Phase 0)

Source: rendered with `sips` (images in `reference/img/`) and **reading the PDF content streams directly**, so the numbers below are real (pt), not estimates. Conversion: 1 pt = 0.3528 mm. "From top" coordinates = 792 − the PDF's y.

## Common to all 3 samples

- **Paper size: US Letter 612 × 792 pt (215.9 × 279.4 mm), portrait**. Not A4. SPEC section 7 assumes A4.
- **Font: Helvetica** (regular text) and **Helvetica-Bold** (titles). Not Noto Sans. White background, black text, no color.
- **Name line**: a single text string `Name ` + 38 underscores, Helvetica 8.04 pt, baseline 43.9 pt from top (15.5 mm), right edge about 576 pt (right margin ≈ 35 pt = 12.4 mm), i.e. right-aligned. Not a drawn line.
- **Title**: Helvetica-Bold, centered on the page. Word search 26.04 pt (baseline 77.8 pt from top); Scramble 24 pt (baseline 75.8 pt from top).
- **Footer**: Helvetica 8.04 pt, centered, baseline 37.8 pt from the bottom (13.3 mm). The original text is the vendor's promotional line; we leave it blank.
- Left margin of the word list: 36.04 pt (12.7 mm).

## Word Search

- **Grid**: the outer frame is a solid rectangle, **with no cell lines**. Round line ends (cap/join round). Stroke width ≈ 0.1 × grid font size (1.56 pt in sample A, 2.52 pt in sample B).
- **Square** cells, grid **horizontally centered** on the page. Uppercase Helvetica regular letters, **centered in the cell** in both directions (baseline = cell center − 0.36 × font size).
- **Sample A (20×20)**: cell 23.52 pt (8.30 mm), frame width 470.4 pt (166 mm), left edge 70.84 pt, frame top 93.7 pt from top (33.1 mm), frame bottom 227.9 pt from bottom. Grid font size **15.96 pt** (= 0.68 × cell).
- **Sample B (10×10)**: cell 43.68 pt (15.4 mm), frame 436.8 pt (154 mm), left edge 87.64 pt, frame top 102.7 pt from top (36.2 mm), frame bottom 252.5 pt from bottom. Grid font size **26.04 pt** (= 0.60 × cell).
- Conclusion: the grid size is not fixed relative to the width. Sample A takes 76.9% of the page width, sample B 71.4%. The vendor's formula has not been derived yet; see "Proposal" below.
- Vertical proportions: title → grid → list → footer, with no frame around the list.

### Word list

- Helvetica regular, keeping the user's original capitalization, 4 columns filled row by row, left-aligned.
- **Sample A**: 15.96 pt, row pitch 31.56 pt (≈ 1.98 × font size), first row baseline 195.94 pt from bottom, last row 69.7 pt from bottom. Column x = 36.04 / 179.92 / 323.8 / 467.68 (pitch 143.88 pt).
- **Sample B**: 24.96 pt, row pitch 57.96 pt (≈ 2.32 × font size), column x = 36.04 / 188.2 / 340.36 / 492.52 (pitch 152.16 pt). First row baseline 202.5 pt, last row 86.6 pt from bottom.
- The list font size in sample B (24.96) is larger than in sample A (15.96): the vendor picks the size by word count. In sample B the list takes much more height than SPEC section 7 assumes (12 pt).

## Word Scramble

- Row font size: **15.96 pt**; rows evenly spaced 31.92 pt (11.26 mm); 20 rows, row 1 baseline at 684.22 pt from bottom (107.8 pt from top), row 20 at 77.74 pt from bottom. The last row is 40 pt from the footer, so the page is filled evenly.
- **Numbering**: `n.` form, **right-aligned** at x = 129.4 pt (`9.` starts at 116.08, `10.` at 107.2); the scrambled text starts at x = 133.84 pt (4.4 pt after the number).
- **Underscores**: the Helvetica `_` character at **18.96 pt**, placed one character at a time at x = 297.16 + 15.84 × k (pitch 15.84 pt = 5.6 mm), on the same baseline as the text. One underscore per letter.
- **Word boundary**: exactly **one empty slot** is left (pitch 31.68 pt instead of 15.84), confirmed on row 9 "JACK O LANTERN": 4 underscores, gap, 1 underscore, gap, 7 underscores.
- Observation: the scramble column (x ≈ 134) and the underscore column (x ≈ 297) are fixed; the longest row "JKAC O TNAENLR" ends at ≈ 215 pt so there is still space before x = 297.
- Confirmed defect: row 11 `TREAT` is identical to the original word (as in SPEC section 3.8).

## Differences between SPEC and the samples (needs a decision)

1. **Paper size**: the samples are Letter, SPEC defaults to A4. Keep A4 per SPEC (Letter remains an option) or switch the default to Letter to match the samples?
2. **Font**: the samples use Helvetica, SPEC uses Noto Sans (needed for Vietnamese). Helvetica does not cover Vietnamese fully. Proposal: keep Noto Sans as the default (shapes close to Helvetica), accepting slightly different letterforms.
3. **Name font size**: SPEC says 11 pt, the samples use 8.04 pt. Proposal: follow the samples (8 pt).
4. **Word list font size**: SPEC starts at 12 pt, the samples use 16 pt (many words) to 25 pt (few words). Proposal: size scales with word count as in the samples.
5. **Letter-to-cell ratio**: SPEC 0.60 × cell, sample A 0.68, sample B 0.60. Proposal: 0.66 for dense grids, decreasing as cells get larger (interpolated from the two samples).
6. **Scramble**: SPEC says at most 14 mm/row; the sample is 11.26 mm with 20 entries. Compute the row pitch to fill the space between title and footer, at most 14 mm.
7. **Underscore pitch**: use 15.84 pt (5.6 mm) as in the samples, shrinking if the underscore row is longer than the remaining space.
8. **Footer** is only 8 pt, smaller than every SPEC value. Follow the samples.

## Proposed starting layout formulas (to be verified visually in Phase 2)

- The grid area lies between the title (bottom ≈ 90 pt from top) and the list; horizontal grid margin ≥ 70 pt (≈ 25 mm) on each side.
- `cell = min(area_width / cols, area_height / rows)`; letters = 0.60–0.68 × cell; frame stroke = 0.1 × font size.
- 4-column list from the left margin of 36 pt, column pitch = (page width − 36 − right margin) / 4; row pitch = 2 × font size.

## Decisions made (after the Phase 0 report)

1. Default paper size: **A4 portrait** (Letter remains an option).
2. Font: originally **Product Sans** supplied by the user (Regular, Italic, Bold, Bold Italic, .otf), placed in `src/assets/fonts/`, replacing Noto Sans/Atkinson in SPEC section 7. Superseded: the product is now English-only and uses Helvetica / standard PDF fonts.
3. Other font sizes and ratios differ from SPEC: follow the proposals above (Name 8 pt, list scales with word count, grid letters 0.60–0.68 × cell, scramble underscore pitch 15.84 pt).
