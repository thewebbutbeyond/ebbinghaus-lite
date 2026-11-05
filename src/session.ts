import type { Card, ImportResult } from "./import.ts";

type Deck = Readonly<{ cards: readonly Card[]; name: string }>;
type Queue = readonly number[];

export type Candidate = Deck & { ignored: number };
export type ReadySession = Deck & { kind: "ready" };
export type Session =
  | { kind: "empty" }
  | ReadySession
  | (Deck & { kind: "question" | "answer"; queue: Queue; undo: Queue | null })
  | (Deck & { kind: "complete"; undo: Queue | null });

export function acceptImport(candidate: Candidate): ReadySession {
  return { kind: "ready", cards: candidate.cards, name: candidate.name };
}

export function offerImport(session: Session, result: ImportResult, name: string): {
  session: Session;
  pending: Candidate | null;
} {
  if (!result.ok) return { session, pending: null };
  const candidate: Candidate = { cards: result.cards, name, ignored: result.ignored };
  if (session.kind !== "empty" && session.kind !== "complete") {
    return { session, pending: candidate };
  }
  return { session: acceptImport(candidate), pending: null };
}

export function start(session: Session, shuffle = false, random = Math.random): Session {
  if (session.kind !== "ready") return session;
  const queue = session.cards.map((_, index) => index);
  if (shuffle) {
    for (let index = queue.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [queue[index], queue[other]] = [queue[other]!, queue[index]!];
    }
  }
  return { kind: "question", cards: session.cards, name: session.name, queue, undo: null };
}

export function reveal(session: Session): Session {
  return session.kind === "question" ? { ...session, kind: "answer" } : session;
}

export function rate(session: Session, rating: "known" | "again"): Session {
  if (session.kind !== "answer") return session;
  const queue = rating === "known"
    ? session.queue.slice(1)
    : [...session.queue.slice(1), session.queue[0]!];
  const deck = { cards: session.cards, name: session.name, undo: session.queue };
  return queue.length === 0
    ? { ...deck, kind: "complete" }
    : { ...deck, kind: "question", queue };
}

export function undo(session: Session): Session {
  if (session.kind === "empty" || session.kind === "ready" || session.undo === null) return session;
  return { kind: "answer", cards: session.cards, name: session.name, queue: session.undo, undo: null };
}

export function restart(session: Session): Session {
  if (session.kind === "empty") return session;
  return { kind: "ready", cards: session.cards, name: session.name };
}
