import { randomBytes } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";
import { idPattern, inside, loadLibrary, verifyPassword } from "./library.ts";
import { isRecord } from "../src/import.ts";

const cookieName = "ebbinghaus_portal";
const sessionSeconds = 8 * 60 * 60;
const loginBodyLimit = 4096;
const types = {
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  txt: "text/plain; charset=utf-8",
} as const;

function json(response: ServerResponse, status: number, data: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function status(response: ServerResponse, code: number): void {
  response.writeHead(code);
  response.end();
}

async function readAssets(root: string) {
  const files = new Map<string, { bytes: Buffer; type: string }>();
  async function add(url: string, filename: string, type: string) {
    const path = await realpath(join(root, filename));
    if (!inside(root, path)) throw new Error("Fichier du build en dehors de son dossier.");
    files.set(url, { bytes: await readFile(path), type });
  }
  await add("/", "index.html", types.html);
  await add("/portal/", "portal/index.html", types.html);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === "LUCIDE-LICENSE.txt") {
      await add("/LUCIDE-LICENSE.txt", entry.name, types.txt);
    }
    if (!entry.isDirectory() || entry.name !== "assets") continue;
    for (const asset of await readdir(join(root, "assets"), { withFileTypes: true })) {
      const match = /^[A-Za-z0-9_-]+\.(js|css)$/.exec(asset.name);
      if (asset.isFile() && match) {
        const name = "assets/" + asset.name;
        await add("/" + name, name, match[1] === "js" ? types.js : types.css);
      }
    }
  }
  return files;
}

function sessionToken(request: IncomingMessage): string | undefined {
  return request.headers.cookie?.match(/(?:^|;\s*)ebbinghaus_portal=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
}

function setCookie(response: ServerResponse, token: string, seconds: number): void {
  response.setHeader("Set-Cookie",
    cookieName + "=" + token + "; Path=/api; HttpOnly; SameSite=Strict; Max-Age=" + seconds);
}

async function credentials(request: IncomingMessage): Promise<{ email: string; password: string } | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) return null;
  const parts: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const part: Buffer = chunk;
    bytes += part.length;
    if (bytes > loginBodyLimit) {
      request.resume();
      return null;
    }
    parts.push(part);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (isRecord(body) && typeof body.email === "string" && body.email.length <= 254 &&
        typeof body.password === "string" && body.password.length <= 1024) {
      return { email: body.email.trim().toLowerCase(), password: body.password };
    }
  } catch {
    return null;
  }
  return null;
}

function documentResponse(request: IncomingMessage, response: ServerResponse, bytes: Buffer, name: string, download: boolean): void {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const utf8 = encodeURIComponent(name).replace(/['()*]/g, (character) =>
    "%" + character.charCodeAt(0).toString(16).toUpperCase());
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition",
    (download ? "attachment" : "inline") + '; filename="' + ascii + '"; filename*=UTF-8\'\'' + utf8);
  response.setHeader("Accept-Ranges", "bytes");

  const match = request.method === "GET" && /^bytes=(\d*)-(\d*)$/i.exec(request.headers.range ?? "");
  if (match && (match[1] || match[2])) {
    const start = match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(bytes.length - 1, Number(match[2])) : bytes.length - 1;
    if (start > end || start >= bytes.length) {
      response.setHeader("Content-Range", "bytes */" + bytes.length);
      status(response, 416);
      return;
    }
    response.writeHead(206, {
      "Content-Length": end - start + 1,
      "Content-Range": "bytes " + start + "-" + end + "/" + bytes.length,
    });
    response.end(bytes.subarray(start, end + 1));
    return;
  }
  response.writeHead(200, { "Content-Length": bytes.length });
  response.end(request.method === "HEAD" ? undefined : bytes);
}

export async function createPortalServer({ dataDir, distDir }: { dataDir: string; distDir: string }): Promise<Server> {
  const [dataRoot, buildRoot] = await Promise.all([realpath(dataDir), realpath(distDir)]);
  if (inside(buildRoot, dataRoot) || inside(dataRoot, buildRoot)) {
    throw new Error("Le dossier des supports doit être distinct du build.");
  }
  const [library, assets] = await Promise.all([loadLibrary(dataRoot), readAssets(buildRoot)]);
  const sessions = new Map<string, { accountId: string; expires: number }>();

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    const host = "127.0.0.1:" + request.socket.localPort;
    const origin = "http://" + host;
    if (request.headers.host !== host || !request.url?.startsWith("/") || request.url.startsWith("//")) {
      status(response, 400);
      return;
    }
    const url = new URL(request.url, origin);
    if (url.origin !== origin) {
      status(response, 400);
      return;
    }
    const method = request.method;
    const path = url.pathname;
    if (!path.startsWith("/api/")) {
      if (method !== "GET" && method !== "HEAD") {
        status(response, 404);
        return;
      }
      if (path === "/portal") {
        response.setHeader("Location", "/portal/");
        status(response, 308);
        return;
      }
      const asset = assets.get(path);
      if (!asset) {
        status(response, 404);
        return;
      }
      if (path === "/portal/") {
        response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
      }
      response.writeHead(200, { "Content-Type": asset.type, "Content-Length": asset.bytes.length });
      response.end(method === "HEAD" ? undefined : asset.bytes);
      return;
    }

    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    const token = sessionToken(request);
    const stored = token ? sessions.get(token) : undefined;
    const session = stored && stored.expires > Date.now() ? stored : undefined;
    if (stored && !session && token) sessions.delete(token);

    if (path === "/api/session" && (method === "POST" || method === "DELETE")) {
      if (request.headers.origin !== origin) {
        status(response, 403);
        return;
      }
      if (method === "DELETE") {
        if (token) sessions.delete(token);
        setCookie(response, "", 0);
        status(response, 204);
        return;
      }
      const login = await credentials(request);
      if (!login) {
        status(response, 400);
        return;
      }
      const account = library.accounts.get(login.email);
      if (!await verifyPassword(login.password, account?.passwordHash) || !account) {
        status(response, 401);
        return;
      }
      for (const [key, value] of sessions) if (value.expires <= Date.now()) sessions.delete(key);
      if (token) sessions.delete(token);
      const newToken = randomBytes(32).toString("base64url");
      sessions.set(newToken, { accountId: account.id, expires: Date.now() + sessionSeconds * 1000 });
      setCookie(response, newToken, sessionSeconds);
      status(response, 204);
      return;
    }

    if (!session) {
      status(response, 401);
      return;
    }
    if (path === "/api/session" && method === "GET") {
      status(response, 204);
      return;
    }
    const assigned = library.assignments.get(session.accountId);
    if (path === "/api/courses" && method === "GET") {
      const courses = [...library.courses.values()].filter((course) => assigned?.has(course.summary.id));
      json(response, 200, { courses: courses.map(({ summary: { id, title } }) => ({ id, title })) });
      return;
    }
    const [, , collection, courseId, resource, resourceId, ...extra] = path.split("/");
    const course = courseId && idPattern.test(courseId) && assigned?.has(courseId) && library.courses.get(courseId);
    if (collection !== "courses" || !course || extra.length) {
      status(response, 404);
      return;
    }
    if (resource === undefined && method === "GET") {
      json(response, 200, course.summary);
      return;
    }
    if (resource === "decks" && resourceId && method === "GET") {
      const deck = course.decks.get(resourceId);
      if (deck) {
        json(response, 200, deck);
        return;
      }
    }
    if (resource === "documents" && resourceId && (method === "GET" || method === "HEAD")) {
      const document = course.documents.get(resourceId);
      if (document) {
        documentResponse(request, response, document.bytes, document.filename, url.searchParams.get("download") === "1");
        return;
      }
    }
    status(response, 404);
  }

  return createServer({ requestTimeout: 15_000 }, (request, response) => {
    void handle(request, response).catch(() => {
      if (!response.headersSent) {
        response.removeHeader("Content-Type");
        response.removeHeader("Content-Disposition");
        response.removeHeader("Accept-Ranges");
        status(response, 500);
      } else response.destroy();
    });
  });
}
