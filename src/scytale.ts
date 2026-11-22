export const MAX_MESSAGE_LENGTH = 80;
export const DEFAULT_MESSAGE = "RENDEZVOUS A MIDI";
export const DEFAULT_SPACING = 3;
export const DEFAULT_FACES = 4;
export const MIN_TURN = 3;
export const MAX_TURN = 8;
const FILLER = "QWXKZJYPHGBFVLCTMNSDRAEOIU";
export type Cell = Readonly<{ index: number; value: string; message: boolean }>;

export function characters(message: string): string[] {
  return Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(message), part => part.segment);
}

function check(value: number): void {
  if (!Number.isInteger(value) || value < MIN_TURN || value > MAX_TURN) throw new RangeError("Invalid scytale setting");
}

/** Strip carrying one message character every `spacing` cells, the others being filler letters. */
export function strip(message: string, spacing: number): Cell[] {
  check(spacing);
  const letters = characters(message);
  if (letters.length > MAX_MESSAGE_LENGTH) throw new RangeError("Scytale message too long");
  return Array.from({ length: letters.length * spacing }, (_, index) => index % spacing === 0
    ? { index, value: letters[index / spacing]!, message: true }
    : { index, value: FILLER[(index * 7 + Math.floor(index / spacing) * 3) % FILLER.length]!, message: false });
}

/** Cells that land on the front face of a stick with `faces` faces once the strip is wound around it. */
export function frontFace(cells: readonly Cell[], faces: number): Cell[] {
  check(faces);
  return cells.filter(cell => cell.index % faces === 0);
}
