/**
 * Where the windows go on the house drawing, one per bed, for a house of any size.
 * Drawn on the 400-wide elevation: walls run x 40–360, the porch and door take the
 * middle of the ground floor (x 144–256), the upstairs wall is clear from 52 to 348.
 *
 * Six beds give back the original drawing exactly: two downstairs, two pairs upstairs.
 */
export type Win = { x: number; y: number; w: number; h: number };

type Segment = [from: number, to: number];

/** Shares `count` windows across the segments, left and right in turn, and centres each group. */
function spread(count: number, segments: Segment[], maxW: number, gap: number, cy: number, maxH: number): Win[] {
  const per = segments.map(() => 0);
  for (let i = 0; i < count; i++) per[i % segments.length]++;
  return segments.flatMap(([from, to], s) => {
    const m = per[s];
    if (!m) return [];
    const width = to - from;
    const w = Math.max(6, Math.min(maxW, (width - (m - 1) * gap) / m));
    const h = Math.min(maxH, w * 1.2);
    const total = m * w + (m - 1) * gap;
    const start = from + (width - total) / 2;
    return Array.from({ length: m }, (_, i) => ({ x: start + i * (w + gap), y: cy - h / 2, w, h }));
  });
}

const GROUND: Segment[] = [
  [46, 138],
  [262, 354],
];

export function windowsFor(n: number): Win[] {
  if (n <= 0) return [];
  const ground = n <= 2 ? n : n <= 10 ? 2 : 4;
  const up = n - ground;
  const below = spread(ground, GROUND, ground > 2 ? 34 : 50, 10, 243, 58);
  let above: Win[] = [];
  if (up > 8) {
    // two rows upstairs; the lower one keeps clear of the porch roof in the middle
    const top = Math.ceil(up / 2);
    above = [
      ...spread(top, [[52, 348]], 32, 8, 124, 30),
      ...spread(up - top, [
        [46, 146],
        [254, 354],
      ], 32, 8, 166, 30),
    ];
  } else if (up > 0) {
    const pairs = up <= 4 && up % 2 === 0;
    above = spread(up, pairs ? [[58, 152], [248, 342]] : [[52, 348]], 40, pairs ? 14 : 12, 152, 48);
  }
  return [...below, ...above];
}

/** "Bed 3" → "3", so a label fits over a small window. */
export const shortLabel = (label: string) => label.replace(/^bed\s*/i, "");
