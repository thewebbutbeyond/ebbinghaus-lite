export type Card = Readonly<{ question: string; answer: string }>;

export type ImportResult =
  | { ok: true; cards: readonly Card[]; ignored: number }
  | { ok: false; message: string };

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_CARDS = 10_000;
export const MAX_TEXT_LENGTH = 50_000;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCardText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_TEXT_LENGTH;
}

export function validateDeck(value: unknown): ImportResult {
  if (!Array.isArray(value)) {
    return { ok: false, message: "Le fichier JSON doit contenir un tableau de cartes avec les champs question et answer." };
  }
  if (value.length > MAX_CARDS) {
    return { ok: false, message: "Ce paquet dépasse la limite de 10 000 entrées. Sépare-le en plusieurs paquets." };
  }
  const cards: Card[] = [];
  for (const entry of value) {
    if (isRecord(entry) && isCardText(entry.question) && isCardText(entry.answer)) {
      cards.push({ question: entry.question, answer: entry.answer });
    }
  }
  if (cards.length === 0) {
    return { ok: false, message: "Aucune carte utilisable. Chaque carte doit avoir une question et une réponse non vides (question et answer)." };
  }
  return { ok: true, cards, ignored: value.length - cards.length };
}

export function parseDeck(text: string): ImportResult {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return { ok: false, message: "Ce fichier JSON est invalide. Vérifie son contenu, puis réessaie." };
  }
  return validateDeck(value);
}

export async function readDeck(file: Pick<File, "size" | "text">): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: "Ce fichier JSON dépasse la limite de 5 Mio. Choisis un paquet plus petit." };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, message: "Impossible de lire ce paquet. Sélectionne-le à nouveau ou essaie un autre paquet." };
  }
  return parseDeck(text);
}
