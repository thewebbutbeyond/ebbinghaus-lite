import { isRecord, validateDeck } from "./import.ts";
import type { Session } from "./session.ts";

export const STORAGE_KEY = "ebbinghaus-viewer.session.v1";

function validQueue(value: unknown, count: number): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.length <= count &&
    new Set(value).size === value.length &&
    value.every((index: unknown) => Number.isInteger(index) && typeof index === "number" && index >= 0 && index < count);
}

export function decodeSession(text: string): Session | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.session)) return null;
  const session = value.session;
  if (session.kind === "empty") return { kind: "empty" };
  if (typeof session.name !== "string" || session.name.length === 0) return null;
  const deck = validateDeck(session.cards);
  if (!deck.ok || deck.ignored > 0) return null;
  const base = { cards: deck.cards, name: session.name };
  if (session.kind === "ready") return { ...base, kind: "ready" };
  const previous = session.undo;
  if (previous !== null && !validQueue(previous, deck.cards.length)) return null;
  if (session.kind === "complete") return { ...base, kind: "complete", undo: previous };
  if ((session.kind === "question" || session.kind === "answer") && validQueue(session.queue, deck.cards.length)) {
    return { ...base, kind: session.kind, queue: session.queue, undo: previous };
  }
  return null;
}

export function restoreSession(read: () => string | null): { session: Session; warning: string | null } {
  let text: string | null;
  try {
    text = read();
  } catch {
    return { session: { kind: "empty" }, warning: "La sauvegarde est indisponible. Tu peux réviser, mais une actualisation peut perdre ta progression." };
  }
  if (text === null) return { session: { kind: "empty" }, warning: null };
  const session = decodeSession(text);
  return session
    ? { session, warning: null }
    : { session: { kind: "empty" }, warning: "La session sauvegardée est illisible. Réimporte ton paquet pour recommencer." };
}

export function saveSession(session: Session, write: (text: string) => void): boolean {
  try {
    write(JSON.stringify({ version: 1, session }));
    return true;
  } catch {
    return false;
  }
}
