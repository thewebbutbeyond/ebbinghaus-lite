type Named = Readonly<{ id: string; title: string }>;
export type Resource = Named & Readonly<{ path: string }>;
export type Course = Named & Readonly<{
  updatedOn: string;
  decks: readonly Resource[];
  sheets: readonly Resource[];
  corrections: readonly Resource[];
}>;
export type Department = Named & Readonly<{ courses: readonly Course[] }>;
export type Institution = Named & Readonly<{ departments: readonly Department[] }>;

function resource(folder: "algo" | "secu", id: string, title: string, filename: string): Resource {
  return { id, title, path: "cours/" + folder + "/" + filename };
}

const algorithmiqueTitle = "Algorithmique I";
const cybersecurityTitle = "Introduction à la cybersécurité";

const algorithmique: Course = {
  id: "algorithmique-i",
  title: algorithmiqueTitle,
  updatedOn: "2026-11-06",
  decks: [],
  sheets: [resource("algo", "fiche-methode", algorithmiqueTitle + " · Formulaires et méthodes", "Formulaire-Methodes-Chapitres-1-7.pdf")],
  corrections: [
    resource("algo", "chapitre-1", "Chapitre 1 · Introduction", "Corrige-Chapitre-1.pdf"),
    resource("algo", "chapitre-2", "Chapitre 2 · Algorithmes linéaires", "Corrige-Chapitre-2.pdf"),
    resource("algo", "chapitre-3", "Chapitre 3 · Alternatives", "Corrige-Chapitre-3.pdf"),
    resource("algo", "chapitre-4", "Chapitre 4 · Modularisation", "Corrige-Chapitre-4.pdf"),
    resource("algo", "chapitre-5", "Chapitre 5 · Itérations", "Corrige-Chapitre-5.pdf"),
    resource("algo", "chapitre-6", "Chapitre 6 · Variables structurées", "Corrige-Chapitre-6.pdf"),
    resource("algo", "chapitre-7", "Chapitre 7 · Tableaux", "Corrige-Chapitre-7.pdf"),
    resource("algo", "bilan-2023", "Bilan · novembre 2023", "Corrige-Bilan-2023.pdf"),
    resource("algo", "bilan-2024", "Bilan · novembre 2024", "Corrige-Bilan-2024.pdf"),
    resource("algo", "bilan-2025", "Bilan · novembre 2025", "Corrige-Bilan-2025.pdf"),
  ],
};

const cybersecurite: Course = {
  id: "introduction-a-la-cybersecurite",
  title: cybersecurityTitle,
  updatedOn: "2026-11-06",
  decks: [
    resource("secu", "revision-complete", cybersecurityTitle + " · Flashcards", "05-revision-complete.json"),
    resource("secu", "introduction", "0 · Introduction", "00-introduction.json"),
    resource("secu", "objectifs-et-principes", "1 · Objectifs et principes", "01-objectifs-et-principes.json"),
    resource("secu", "outils-cryptographiques", "2 · Outils cryptographiques", "02-outils-cryptographiques.json"),
    resource("secu", "echange-de-cles", "3 · Échange de clés", "03-echange-de-cles.json"),
    resource("secu", "authentification", "4 · Authentification", "04-authentification.json"),
    resource("secu", "securite-reseau", "5 · Sécurité réseau", "05-securite-reseau.json"),
  ],
  sheets: [resource("secu", "fiche-methode", cybersecurityTitle + " · Formulaires et méthodes", "Fiche-Methodes-Cybersecurite.pdf")],
  corrections: [
    resource("secu", "2024-01-26", "Examen · janvier 2024", "Corrige-Examen-2024-01-26.pdf"),
    resource("secu", "2025-01-24-b", "Examen · janvier 2025 · Série B", "Corrige-Examen-2025-01-24-b.pdf"),
    resource("secu", "2025-06-13", "Examen · juin 2025 · Série A", "Corrige-Examen-2025-06-13.pdf"),
    resource("secu", "2025-09-03", "Examen · septembre 2025 · Série A", "Corrige-Examen-2025-09-03.pdf"),
    resource("secu", "2026-01-23-a", "Examen · janvier 2026 · Série A", "Corrige-Examen-2026-01-23-a.pdf"),
  ],
};

export const catalog: readonly Institution[] = [{
  id: "he2b",
  title: "HE2B",
  departments: [{ id: "esi", title: "ESI", courses: [algorithmique, cybersecurite] }],
}];
