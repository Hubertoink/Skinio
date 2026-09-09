type Sample = { rgb: number[]; weight: number };
/** Weighted median cut; extracts actual colors, no invented filler entries. */
export function extractPalette(
  pixels: ArrayLike<number>,
  limit: number,
): string[] {
  if (![64, 128, 256].includes(limit) || pixels.length % 4)
    throw new Error("Ungültige Palettenextraktion.");
  const bins = new Map<number, { sums: number[]; weight: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const key =
      ((pixels[i] >> 3) << 10) |
      ((pixels[i + 1] >> 3) << 5) |
      (pixels[i + 2] >> 3);
    const bin = bins.get(key) ?? { sums: [0, 0, 0], weight: 0 };
    for (let c = 0; c < 3; c++) bin.sums[c] += pixels[i + c];
    bin.weight++;
    bins.set(key, bin);
  }
  if (!bins.size) throw new Error("Das Bild enthält keine deckenden Farben.");
  const samples: Sample[] = [...bins.values()].map((b) => ({
    rgb: b.sums.map((n) => n / b.weight),
    weight: b.weight,
  }));
  const boxes = [samples];
  const extent = (box: Sample[]) =>
    [0, 1, 2].map(
      (c) =>
        Math.max(...box.map((s) => s.rgb[c])) -
        Math.min(...box.map((s) => s.rgb[c])),
    );
  while (boxes.length < limit) {
    let selected = -1,
      score = -1,
      axis = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const ranges = extent(box),
        longest = Math.max(...ranges),
        candidate = longest * Math.sqrt(box.reduce((n, s) => n + s.weight, 0));
      if (candidate > score) {
        selected = i;
        score = candidate;
        axis = ranges.indexOf(longest);
      }
    });
    if (selected < 0) break;
    const box = boxes[selected].sort((a, b) => a.rgb[axis] - b.rgb[axis]);
    const half = box.reduce((n, s) => n + s.weight, 0) / 2;
    let weight = 0,
      split = 1;
    for (let i = 0; i < box.length - 1; i++) {
      weight += box[i].weight;
      split = i + 1;
      if (weight >= half) break;
    }
    boxes.splice(selected, 1, box.slice(0, split), box.slice(split));
  }
  return [
    ...new Set(
      boxes.map((box) => {
        const total = box.reduce((n, s) => n + s.weight, 0);
        return (
          "#" +
          [0, 1, 2]
            .map((c) =>
              Math.round(
                box.reduce((n, s) => n + s.rgb[c] * s.weight, 0) / total,
              )
                .toString(16)
                .padStart(2, "0"),
            )
            .join("")
        );
      }),
    ),
  ];
}
