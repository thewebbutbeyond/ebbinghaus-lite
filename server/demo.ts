import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCredentials } from "./account.ts";

export const demoTitle = "Navigation des dirigeables";
export const otherTitle = "Architecture des phares";
export const deckTitle = "Balises et amarrage";
export const sheetTitle = "Fiche de navigation";
export const sheetFile = "Fiche de navigation aérienne.pdf";

// A small real PDF with two pages and distinct bytes per resource, built without
// shipping any course PDF or adding a PDF generation dependency to the viewer.
function twoPagePdf(label: string): Buffer {
  const stream = (text: string) => {
    const content = "BT /F1 20 Tf 50 720 Td (" + text + ") Tj ET\n";
    return "<< /Length " + Buffer.byteLength(content) + " >>\nstream\n" + content + "endstream";
  };
  const page = (index: number) =>
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents " + index + " 0 R >>";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    page(6), page(7),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    stream(label + " - page 1"), stream(label + " - page 2"),
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = ["0000000000 65535 f \n"];
  for (const [index, object] of objects.entries()) {
    offsets.push(String(Buffer.byteLength(pdf)).padStart(10, "0") + " 00000 n \n");
    pdf += (index + 1) + " 0 obj\n" + object + "\nendobj\n";
  }
  const xref = Buffer.byteLength(pdf);
  pdf += "xref\n0 " + offsets.length + "\n" + offsets.join("") +
    "trailer\n<< /Size " + offsets.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return Buffer.from(pdf);
}

export async function createDemoData(dir: string) {
  await mkdir(dir, { mode: 0o700 });
  const documents = join(dir, "supports");
  await mkdir(documents, { mode: 0o700 });
  const students = await Promise.all([
    { id: "alice", email: "alice@example.test" },
    { id: "sam", email: "sam@example.test" },
  ].map(async (account) => ({ ...account, ...await createCredentials() })));
  const manifest = {
    accounts: students.map(({ id, email, passwordHash }) => ({ id, email, passwordHash })),
    assignments: [
      { accountId: "alice", courseId: "dirigeables" },
      { accountId: "sam", courseId: "phares" },
    ],
    courses: [
      {
        id: "dirigeables", title: demoTitle,
        decks: [{ id: "balises", title: deckTitle, file: "supports/balises.json" }],
        sheets: [{ id: "navigation", title: sheetTitle, file: "supports/" + sheetFile }],
        papers: [
          {
            id: "exercice", title: "Exercice 1",
            subject: { id: "sujet", file: "supports/Sujet 1.pdf" },
            correction: { id: "corrige", file: "supports/Corrigé 1.pdf" },
          },
          { id: "atelier", title: "Atelier", correction: { id: "atelier-corrige", file: "supports/Corrigé atelier.pdf" } },
        ],
      },
      { id: "phares", title: otherTitle },
    ],
  };
  const save = (path: string, content: string | Buffer) => writeFile(path, content, { mode: 0o600, flag: "wx" });
  await Promise.all([
    save(join(documents, "balises.json"), JSON.stringify([
      { question: "Que signale la balise violette ?", answer: "Une aire d’amarrage libre." },
      { question: "Quand vérifier le câble ?", answer: "Avant chaque départ." },
    ], null, 2)),
    save(join(documents, sheetFile), twoPagePdf("Fiche de navigation fictive")),
    save(join(documents, "Sujet 1.pdf"), twoPagePdf("Sujet 1 : prepare le trajet")),
    save(join(documents, "Corrigé 1.pdf"), twoPagePdf("Corrige 1 : trajet propose")),
    save(join(documents, "Corrigé atelier.pdf"), twoPagePdf("Corrige de l'atelier")),
  ]);
  await save(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return students.map(({ id, email, password }) => ({ id, email, password }));
}

if (import.meta.main) {
  try {
    const dir = fileURLToPath(new URL("../.portal-data.local/", import.meta.url));
    const students = await createDemoData(dir);
    for (const { email, password } of students) console.log(email + " : " + password);
  } catch (error) {
    console.error(error instanceof Error && "code" in error && error.code === "EEXIST"
      ? "Le dossier .portal-data.local existe déjà. Aucun fichier n’a été remplacé."
      : error);
    process.exitCode = 1;
  }
}
