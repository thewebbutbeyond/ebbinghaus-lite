export const MAX_MESSAGE_LENGTH = 80;
export const DEFAULT_MESSAGE = "RENDEZVOUS A MIDI";
export const DEFAULT_ROWS = 3;
export type Cell = Readonly<{ id: number; value: string | null }>;
export type Grid = readonly (readonly (Cell | null)[])[];
export type Encoded = Readonly<{ message: string; rows: number; columns: number; grid: Grid; tape: readonly Cell[] }>;
export type Decoded = Readonly<{ rows: number; columns: number; grid: Grid; message: string }>;

export function characters(message: string): string[] {
  return Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(message), part => part.segment);
}

function checkRows(rows: number): void {
  if (!Number.isInteger(rows) || rows < 2 || rows > 8) throw new RangeError("Invalid scytale row count");
}

export function encode(message: string, rows: number): Encoded {
  checkRows(rows);
  const letters = characters(message);
  if (letters.length > MAX_MESSAGE_LENGTH) throw new RangeError("Scytale message too long");
  const columns = Math.ceil(letters.length / rows);
  const grid: Cell[][] = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
    const id = row * columns + column;
    return { id, value: letters[id] ?? null };
  }));
  const tape: Cell[] = [];
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) tape.push(grid[row]![column]!);
  }
  return { message, rows, columns, grid, tape };
}

export function decode(tape: readonly Cell[], rows: number): Decoded {
  checkRows(rows);
  const columns = Math.ceil(tape.length / rows);
  const grid = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) =>
    tape[column * rows + row] ?? null));
  const message = grid.flat().map(cell => cell?.value ?? "").join("");
  return { rows, columns, grid, message };
}
