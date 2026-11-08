type Named = Readonly<{ id: string; title: string }>;
export type Resource = Named & Readonly<{ path: string }>;
export type Deck = Resource & Readonly<{ scope: "course" | "chapter" }>;
export type Correction = Resource & (Readonly<{ kind: "chapter" }> | Readonly<{ kind: "bilan" | "examen"; month: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 }>);
export type Simulation = Readonly<{ id: "ddos" | "session-volee" | "scytale" | "phishing"; title: string }>;
export type Course = Named & Readonly<{
  updatedOn: string;
  decks: readonly Deck[];
  sheets: readonly Resource[];
  corrections: readonly Correction[];
  simulations?: readonly Simulation[];
}>;
export type Department = Named & Readonly<{ archive: string; courses: readonly Course[] }>;
export type Institution = Named & Readonly<{ departments: readonly Department[] }>;

function resource(folder: "algo" | "secu", id: string, title: string, filename: string): Resource {
  return { id, title, path: "cours/" + folder + "/" + filename };
}

const algorithmiqueTitle = "Algorithmique I";
const cybersecurityTitle = "Introduction à la cybersécurité";
export const methodSheetTitle = "Formulaire et méthodes";

const algorithmique: Course = {
  id: "algorithmique-i",
  title: algorithmiqueTitle,
  updatedOn: "2026-11-08",
  decks: [],
  sheets: [resource("algo", "fiche-methode", algorithmiqueTitle + " · " + methodSheetTitle, "Formulaire-Methodes-Chapitres-1-7.pdf")],
  corrections: [
    { ...resource("algo", "chapitre-1", "Chapitre 1 · Introduction", "Corrige-Chapitre-1.pdf"), kind: "chapter" },
    { ...resource("algo", "chapitre-2", "Chapitre 2 · Algorithmes linéaires", "Corrige-Chapitre-2.pdf"), kind: "chapter" },
    { ...resource("algo", "chapitre-3", "Chapitre 3 · Alternatives", "Corrige-Chapitre-3.pdf"), kind: "chapter" },
    { ...resource("algo", "chapitre-4", "Chapitre 4 · Modularisation", "Corrige-Chapitre-4.pdf"), kind: "chapter" },
    { ...resource("algo", "chapitre-5", "Chapitre 5 · Itérations", "Corrige-Chapitre-5.pdf"), kind: "chapter" },
    { ...resource("algo", "chapitre-6", "Chapitre 6 · Variables structurées", "Corrige-Chapitre-6.pdf"), kind: "chapter" },
    { ...resource("algo", "chapitre-7", "Chapitre 7 · Tableaux", "Corrige-Chapitre-7.pdf"), kind: "chapter" },
    { ...resource("algo", "bilan-2023", "Bilan · novembre 2023", "Corrige-Bilan-2023.pdf"), kind: "bilan", month: 11 },
    { ...resource("algo", "bilan-2024", "Bilan · novembre 2024", "Corrige-Bilan-2024.pdf"), kind: "bilan", month: 11 },
    { ...resource("algo", "bilan-2025", "Bilan · novembre 2025", "Corrige-Bilan-2025.pdf"), kind: "bilan", month: 11 },
  ],
};

const cybersecurite: Course = {
  id: "introduction-a-la-cybersecurite",
  title: cybersecurityTitle,
  updatedOn: "2026-11-08",
  simulations: [
    { id: "phishing", title: "Chapitre 1 • Phishing" },
    { id: "ddos", title: "Chapitre 1 • DDoS" },
    { id: "session-volee", title: "Chapitre 1 • Cookie de session volé" },
    { id: "scytale", title: "Chapitre 1 • Scytale" },
  ],
  decks: [
    { ...resource("secu", "revision-complete", cybersecurityTitle + " · Flashcards", "05-revision-complete.json"), scope: "course" },
    { ...resource("secu", "introduction", "Chapitre 0 · Introduction", "00-introduction.json"), scope: "chapter" },
    { ...resource("secu", "objectifs-et-principes", "Chapitre 1 · Objectifs et principes", "01-objectifs-et-principes.json"), scope: "chapter" },
    { ...resource("secu", "outils-cryptographiques", "Chapitre 2 · Outils cryptographiques", "02-outils-cryptographiques.json"), scope: "chapter" },
    { ...resource("secu", "echange-de-cles", "Chapitre 3 · Échange de clés", "03-echange-de-cles.json"), scope: "chapter" },
    { ...resource("secu", "authentification", "Chapitre 4 · Authentification", "04-authentification.json"), scope: "chapter" },
    { ...resource("secu", "securite-reseau", "Chapitre 5 · Sécurité réseau", "05-securite-reseau.json"), scope: "chapter" },
  ],
  sheets: [resource("secu", "fiche-methode", cybersecurityTitle + " · " + methodSheetTitle, "Fiche-Methodes-Cybersecurite.pdf")],
  corrections: [
    { ...resource("secu", "2024-01-26", "Examen · janvier 2024", "Corrige-Examen-2024-01-26.pdf"), kind: "examen", month: 1 },
    { ...resource("secu", "2025-01-24-b", "Examen · janvier 2025 · Série B", "Corrige-Examen-2025-01-24-b.pdf"), kind: "examen", month: 1 },
    { ...resource("secu", "2025-06-13", "Examen · juin 2025 · Série A", "Corrige-Examen-2025-06-13.pdf"), kind: "examen", month: 6 },
    { ...resource("secu", "2025-09-03", "Examen · septembre 2025 · Série A", "Corrige-Examen-2025-09-03.pdf"), kind: "examen", month: 9 },
    { ...resource("secu", "2026-01-23-a", "Examen · janvier 2026 · Série A", "Corrige-Examen-2026-01-23-a.pdf"), kind: "examen", month: 1 },
  ],
};

export const catalog: readonly Institution[] = [{
  id: "he2b",
  title: "HE2B",
  departments: [{ id: "esi", title: "ESI", archive: "he2b-esi", courses: [algorithmique, cybersecurite] }],
}];
