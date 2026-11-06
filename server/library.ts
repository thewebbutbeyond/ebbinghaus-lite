import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { isRecord, MAX_FILE_BYTES, parseDeck, type Card } from "../src/import.ts";

type Named = Readonly<{ id: string; title: string }>;
type Document = Readonly<{ id: string; filename: string; bytes: Buffer }>;
type Deck = Named & { cards: readonly Card[] };
type Paper = Named & { subject?: { id: string }; correction?: { id: string } };
type Course = {
  summary: Named & { decks: Named[]; sheets: Named[]; papers: Paper[] };
  decks: ReadonlyMap<string, Deck>;
  documents: ReadonlyMap<string, Document>;
};
type Account = Readonly<{ id: string; passwordHash: string }>;
type Library = {
  accounts: ReadonlyMap<string, Account>;
  courses: ReadonlyMap<string, Course>;
  assignments: ReadonlyMap<string, ReadonlySet<string>>;
};

export const idPattern = /^[A-Za-z0-9_-]+$/;
const passwordPattern = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/;
const derive = promisify(scrypt);
const dummyHash = "scrypt:" + "0".repeat(32) + ":" + "0".repeat(128);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 64) as Buffer;
  return "scrypt:" + salt.toString("hex") + ":" + hash.toString("hex");
}

export async function verifyPassword(password: string, encoded: string | undefined): Promise<boolean> {
  const match = passwordPattern.exec(encoded ?? dummyHash);
  if (!match?.[1] || !match[2]) return false;
  const computed = await derive(password, Buffer.from(match[1], "hex"), 64) as Buffer;
  return timingSafeEqual(computed, Buffer.from(match[2], "hex")) && encoded !== undefined;
}

export function inside(root: string, path: string): boolean {
  const child = relative(root, path);
  return child !== ".." && !child.startsWith(".." + sep) && !isAbsolute(child);
}

function invalid(label: string): never {
  throw new Error("Bibliothèque invalide : " + label);
}

function record(value: unknown, label: string): Record<string, unknown> {
  return isRecord(value) ? value : invalid(label);
}

function array(value: unknown, label: string, optional = false): unknown[] {
  if (optional && value === undefined) return [];
  return Array.isArray(value) ? value : invalid(label);
}

function text(value: unknown, label: string): string {
  return typeof value === "string" && value.trim() ? value : invalid(label);
}

function id(value: unknown, label: string): string {
  return typeof value === "string" && idPattern.test(value) ? value : invalid(label);
}

function named(value: Record<string, unknown>, label: string): Named {
  return { id: id(value.id, label + ".id"), title: text(value.title, label + ".title") };
}

async function privateFile(root: string, value: unknown, label: string): Promise<string> {
  const file = text(value, label);
  if (/[\\\u0000-\u001f\u007f]/.test(file) || file.split("/").some((part) => !part || part === "." || part === "..")) invalid(label);
  try {
    const path = await realpath(resolve(root, file));
    if (!inside(root, path) || !(await stat(path)).isFile()) invalid(label);
    return path;
  } catch {
    return invalid(label + " : fichier introuvable ou en dehors du dossier privé.");
  }
}

async function loadCourse(root: string, entry: unknown): Promise<Course> {
  const value = record(entry, "cours");
  const course = named(value, "cours");
  const label = "cours " + course.id;
  const summary: Course["summary"] = { ...course, decks: [], sheets: [], papers: [] };
  const decks = new Map<string, Deck>();
  const documents = new Map<string, Document>();

  for (const entry of array(value.decks, label + ".decks", true)) {
    const item = record(entry, label + ".decks");
    const name = named(item, label + ".decks");
    const field = label + ", paquet " + name.id;
    if (decks.has(name.id)) invalid(field + " : identifiant en double.");
    const path = await privateFile(root, item.file, field);
    if ((await stat(path)).size > MAX_FILE_BYTES) invalid(field + " : fichier trop volumineux.");
    const parsed = parseDeck(await readFile(path, "utf8"));
    if (!parsed.ok || parsed.ignored !== 0) invalid(field + " : chaque carte doit être valide.");
    decks.set(name.id, { ...name, cards: parsed.cards });
    summary.decks.push(name);
  }

  async function pdf(item: Record<string, unknown>, kind: string): Promise<{ id: string }> {
    const documentId = id(item.id, label + "." + kind + ".id");
    const field = label + ", PDF " + documentId;
    if (documents.has(documentId)) invalid(field + " : identifiant en double.");
    const path = await privateFile(root, item.file, field);
    const filename = basename(text(item.file, field));
    const bytes = await readFile(path);
    if (!/\.pdf$/i.test(filename) || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      invalid(field + " : fichier PDF attendu.");
    }
    documents.set(documentId, { id: documentId, filename, bytes });
    return { id: documentId };
  }

  for (const entry of array(value.sheets, label + ".sheets", true)) {
    const item = record(entry, label + ".sheets");
    const name = named(item, label + ".sheets");
    await pdf(item, "sheets");
    summary.sheets.push(name);
  }
  const paperIds = new Set<string>();
  for (const entry of array(value.papers, label + ".papers", true)) {
    const item = record(entry, label + ".papers");
    const name: Paper = named(item, label + ".papers");
    if (paperIds.has(name.id)) invalid(label + ", sujet/corrigé " + name.id + " : identifiant en double.");
    paperIds.add(name.id);
    if (item.subject !== undefined) name.subject = await pdf(record(item.subject, label + ".subject"), "subject");
    if (item.correction !== undefined) name.correction = await pdf(record(item.correction, label + ".correction"), "correction");
    if (!name.subject && !name.correction) invalid(label + ", sujet/corrigé " + name.id + " : aucun PDF.");
    summary.papers.push(name);
  }
  return { summary, decks, documents };
}

export async function loadLibrary(dataDir: string): Promise<Library> {
  const root = await realpath(dataDir);
  let input: unknown;
  try {
    input = JSON.parse(await readFile(await privateFile(root, "manifest.json", "manifest.json"), "utf8"));
  } catch {
    return invalid("manifest.json illisible. Prépare la bibliothèque avant de démarrer le portail.");
  }
  const manifest = record(input, "manifest.json");
  const accounts = new Map<string, Account>();
  const assignments = new Map<string, Set<string>>();
  for (const entry of array(manifest.accounts, "accounts")) {
    const value = record(entry, "accounts");
    const accountId = id(value.id, "accounts.id");
    const email = text(value.email, "accounts.email").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) invalid("accounts.email");
    const passwordHash = text(value.passwordHash, "accounts.passwordHash");
    if (!passwordPattern.test(passwordHash)) invalid("accounts.passwordHash");
    if (accounts.has(email) || assignments.has(accountId)) invalid("compte en double.");
    accounts.set(email, { id: accountId, passwordHash });
    assignments.set(accountId, new Set());
  }

  const courses = new Map<string, Course>();
  for (const entry of array(manifest.courses, "courses")) {
    const course = await loadCourse(root, entry);
    if (courses.has(course.summary.id)) invalid("cours en double : " + course.summary.id);
    courses.set(course.summary.id, course);
  }

  for (const entry of array(manifest.assignments, "assignments")) {
    const value = record(entry, "assignments");
    const account = assignments.get(id(value.accountId, "assignments.accountId"));
    const courseId = id(value.courseId, "assignments.courseId");
    if (!account || !courses.has(courseId) || account.has(courseId)) invalid("attribution invalide ou en double.");
    account.add(courseId);
  }
  return { accounts, courses, assignments };
}
