import * as cryptoEngine from "staticrypt/lib/cryptoEngine.js";
import { init } from "staticrypt/lib/codec.js";
import { parseDeck } from "./import.ts";

export type ArchiveFile = Readonly<{ type: "application/pdf" | "application/json"; base64: string }>;
export type ArchiveContents = Readonly<{ version: 1; id: string; files: Readonly<Record<string, ArchiveFile>> }>;
export type EncryptedArchive = Readonly<{ version: 1; id: string; salt: string; data: string }>;
const codec = init(cryptoEngine);
const resourcePath = /^cours\/[a-z0-9-]+\/[A-Za-z0-9-]+\.(pdf|json)$/;
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ArchivePasswordError extends Error {}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseEncryptedArchive(value: unknown, id: string): EncryptedArchive {
  if (!object(value) || value.version !== 1 || value.id !== id || !idPattern.test(id) ||
      typeof value.salt !== "string" || !/^[a-f0-9]{32}$/.test(value.salt) ||
      typeof value.data !== "string" || value.data.length > 16_000_000 ||
      !/^[a-f0-9]+$/.test(value.data) || value.data.length < 128 || (value.data.length - 96) % 32 !== 0) {
    throw new Error("Invalid encrypted archive");
  }
  return { version: 1, id, salt: value.salt, data: value.data };
}

export function fileBytes(file: ArchiveFile): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
}

export function parseArchiveContents(value: unknown, id: string): ArchiveContents {
  if (!object(value) || value.version !== 1 || value.id !== id || !idPattern.test(id) ||
      !object(value.files) || !Object.keys(value.files).length) throw new Error("Invalid archive contents");
  const files: Record<string, ArchiveFile> = {};
  for (const [path, file] of Object.entries(value.files)) {
    const expectedType = path.endsWith(".pdf") ? "application/pdf" : "application/json";
    if (!resourcePath.test(path) || !object(file) || typeof file.base64 !== "string" ||
        !file.base64.length || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64) ||
        file.type !== expectedType) {
      throw new Error("Invalid archive resource");
    }
    const entry: ArchiveFile = { type: expectedType, base64: file.base64 };
    const bytes = fileBytes(entry);
    const text = new TextDecoder().decode(bytes);
    if (file.type === "application/pdf") {
      if (!text.startsWith("%PDF-")) throw new Error("Invalid archive PDF");
    } else {
      const deck = parseDeck(text);
      if (!deck.ok || deck.ignored) throw new Error("Invalid archive deck");
    }
    files[path] = entry;
  }
  return { version: 1, id, files };
}

export const deriveArchiveKey = cryptoEngine.hashPassword;

export async function encryptArchive(contents: ArchiveContents, password: string): Promise<EncryptedArchive> {
  parseArchiveContents(contents, contents.id);
  if (password.length < 16) throw new Error("Use an archive password of at least 16 characters");
  const salt = cryptoEngine.generateRandomSalt();
  return { version: 1, id: contents.id, salt, data: await codec.encode(JSON.stringify(contents), password, salt) };
}

export async function decryptArchive(archive: EncryptedArchive, key: string): Promise<ArchiveContents> {
  parseEncryptedArchive(archive, archive.id);
  if (!/^[a-f0-9]{64}$/.test(key)) throw new ArchivePasswordError();
  // New archives use only the current StatiCrypt format, with no legacy key fallback.
  const result = await codec.decode(archive.data, key, archive.salt, 2);
  if (!result.success) throw new ArchivePasswordError();
  return parseArchiveContents(JSON.parse(result.decoded), archive.id);
}
