import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createDemoData, sheetFile } from "../server/demo.ts";
import { createPortalServer } from "../server/http.ts";
import { loadLibrary } from "../server/library.ts";

const course = "/api/courses/dirigeables";
const deck = course + "/decks/balises";
const pdf = course + "/documents/navigation";
let root: string;
let dataDir: string;
let distDir: string;
let server: Server;
let origin: string;
let students: Awaited<ReturnType<typeof createDemoData>>;

before(async () => {
  root = await mkdtemp(join(tmpdir(), "ebbinghaus-api-"));
  dataDir = join(root, "private");
  distDir = join(root, "build");
  students = await createDemoData(dataDir);
  await mkdir(join(distDir, "portal"), { recursive: true });
  await writeFile(join(distDir, "index.html"), "<!doctype html><title>Viewer</title>");
  await writeFile(join(distDir, "portal", "index.html"), "<!doctype html><title>Mes cours</title>");
  server = await createPortalServer({ dataDir, distDir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  origin = "http://127.0.0.1:" + address.port;
});

after(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()));
  if (root) await rm(root, { recursive: true, force: true });
});

async function login(index: number): Promise<string> {
  const { email, password } = students[index]!;
  const response = await fetch(origin + "/api/session", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 204);
  const value = response.headers.get("set-cookie");
  assert(value);
  assert.match(value, /;\s*HttpOnly\b/i);
  assert.match(value, /;\s*SameSite=Strict\b/i);
  assert.match(value, /;\s*Path=\/api\b/i);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return value.split(";")[0]!;
}

test("authorization on the catalogue and actual file URLs with two accounts", async () => {
  const alice = await login(0);
  const sam = await login(1);
  assert.notEqual(alice, sam);

  for (const [cookie, expected] of [[alice, "dirigeables"], [sam, "phares"]] as const) {
    const response = await fetch(origin + "/api/courses", { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const result = await response.json() as { courses: { id: string }[] };
    assert.deepEqual(result.courses.map(({ id }) => id), [expected]);
  }

  for (const [cookie, status] of [["", 401], [sam, 404]] as const) {
    for (const [path, method, range] of [
      [course, "GET", ""], [deck, "GET", ""], [pdf, "GET", ""],
      [pdf + "?download=1", "GET", ""], [pdf, "GET", "bytes=0-11"], [pdf, "HEAD", ""],
    ] as const) {
      const headers = new Headers();
      if (cookie) headers.set("Cookie", cookie);
      if (range) headers.set("Range", range);
      const response = await fetch(origin + path, { method, headers });
      assert.equal(response.status, status, method + " " + path);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      assert.equal(response.headers.get("content-disposition"), null);
      assert.equal(response.headers.get("content-range"), null);
      assert.doesNotMatch(await response.text(), /%PDF|amarrage|dirigeables|Fiche de navigation|passwordHash/);
    }
  }

  const reversed = await fetch(origin + "/api/courses/phares", { headers: { Cookie: alice } });
  assert.equal(reversed.status, 404);
  const courseResult = await fetch(origin + course, { headers: { Cookie: alice } });
  assert.equal(courseResult.status, 200);
  const projection = await courseResult.text();
  assert.doesNotMatch(projection, /supports|passwordHash|example\.test|Que signale/);
  assert.match(projection, /navigation/);
  const cards = await fetch(origin + deck, { headers: { Cookie: alice } });
  assert.equal(cards.status, 200);
  assert.match(await cards.text(), /Que signale la balise violette/);
});

test("authorized PDF reads and downloads match prepared bytes, including ranges", async () => {
  const cookie = await login(0);
  const expected = await readFile(join(dataDir, "supports", sheetFile));
  for (const [query, disposition] of [["", "inline"], ["?download=1", "attachment"]] as const) {
    const response = await fetch(origin + pdf + query, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const header = response.headers.get("content-disposition") ?? "";
    assert(header.startsWith(disposition + ";"));
    assert.match(header, /filename\*=UTF-8''[^;]*a%C3%A9rienne\.pdf/i);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  }
  const head = await fetch(origin + pdf, { method: "HEAD", headers: { Cookie: cookie } });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), String(expected.length));
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  const range = await fetch(origin + pdf, { headers: { Cookie: cookie, Range: "bytes=0-11" } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get("content-range"), "bytes 0-11/" + expected.length);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), expected.subarray(0, 12));
  const suffix = await fetch(origin + pdf, { headers: { Cookie: cookie, Range: "bytes=-8" } });
  assert.equal(suffix.status, 206);
  assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), expected.subarray(-8));
  const pastEnd = await fetch(origin + pdf, { headers: { Cookie: cookie, Range: "bytes=100000-" } });
  assert.equal(pastEnd.status, 416);
  assert.equal(pastEnd.headers.get("content-range"), "bytes */" + expected.length);
});

test("sign-out invalidates a captured session cookie; cross-origin sign-out does not", async () => {
  const cookie = await login(0);
  const sessionUrl = origin + "/api/session";
  assert.equal((await fetch(sessionUrl, { headers: { Cookie: cookie } })).status, 204);
  const denied = await fetch(sessionUrl, {
    method: "DELETE", headers: { Cookie: cookie, Origin: "http://example.test" },
  });
  assert.equal(denied.status, 403);
  assert.equal((await fetch(sessionUrl, { headers: { Cookie: cookie } })).status, 204);
  const signedOut = await fetch(sessionUrl, { method: "DELETE", headers: { Cookie: cookie, Origin: origin } });
  assert.equal(signedOut.status, 204);
  assert.match(signedOut.headers.get("set-cookie") ?? "", /Max-Age=0/i);
  assert.equal((await fetch(origin + pdf, { headers: { Cookie: cookie } })).status, 401);
});

test("invalid and cross-origin login requests never receive a session cookie", async () => {
  const { email, password } = students[0]!;
  for (const [from, supplied, expected] of [
    [origin, "wrong-password", 401],
    ["http://example.test", password, 403],
  ] as const) {
    const response = await fetch(origin + "/api/session", {
      method: "POST", headers: { Origin: from, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: supplied }),
    });
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.doesNotMatch(await response.text(), /alice@example\.test|passwordHash/);
  }
});

test("private files and paths are absent from the public file handler", async () => {
  const cookie = await login(0);
  for (const path of [
    "/manifest.json", "/supports/balises.json", "/.portal-data.local/manifest.json",
    "/assets/%2e%2e%2f%2e%2e%2fprivate%2fmanifest.json",
  ]) {
    const response = await fetch(origin + path, { headers: { Cookie: cookie } });
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /passwordHash|balise violette/);
  }
});

test("publication rejects partial decks and files symlinked outside its root", async () => {
  const invalid = join(root, "invalid");
  await createDemoData(invalid);
  const file = join(invalid, "supports", "balises.json");
  await writeFile(file, JSON.stringify([{ question: "Valid", answer: "Valid" }, { question: "Broken" }]));
  await assert.rejects(loadLibrary(invalid));
  await rm(file);
  await symlink(join(dataDir, "supports", "balises.json"), file);
  await assert.rejects(loadLibrary(invalid));
});
