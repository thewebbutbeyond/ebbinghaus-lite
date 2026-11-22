export type Block = Readonly<{ bytes: readonly number[]; padding: number }>;

export const PADDING_STEPS = 3;
export const BLOCK_SIZE = 16;
export const PADDING_MESSAGE = "Rendez-vous demain à 9 h devant la bibliothèque. Apporte le rapport final, la clé USB et tes notes de cryptographie. Ne transfère ce message à personne. Merci !";

export const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

export function pad(bytes: Uint8Array, size = BLOCK_SIZE): Uint8Array {
  const count = size - (bytes.length % size);
  const padded = new Uint8Array(bytes.length + count);
  padded.set(bytes);
  padded.fill(count, bytes.length);
  return padded;
}

export function unpad(bytes: Uint8Array, size = BLOCK_SIZE): Uint8Array | null {
  const count = bytes.at(-1);
  if (count === undefined || bytes.length % size !== 0 || count < 1 || count > size) return null;
  if (bytes.subarray(bytes.length - count).some(byte => byte !== count)) return null;
  return bytes.slice(0, bytes.length - count);
}

export function toBlocks(bytes: Uint8Array, size = BLOCK_SIZE, withPadding = true): readonly Block[] {
  const data = withPadding ? pad(bytes, size) : bytes;
  const padding = data.length - bytes.length;
  const blocks: Block[] = [];
  for (let start = 0; start < data.length; start += size) {
    const end = Math.min(start + size, data.length);
    blocks.push({ bytes: [...data.subarray(start, end)], padding: Math.max(0, end - Math.max(start, data.length - padding)) });
  }
  return blocks;
}
