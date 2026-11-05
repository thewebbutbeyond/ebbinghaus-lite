import { readDeck } from "./import.ts";
import { acceptImport, offerImport, rate, restart, reveal, start, undo, type Candidate, type Session } from "./session.ts";
import { restoreSession, saveSession, STORAGE_KEY } from "./storage.ts";
import { icon, type IconName } from "./icons.ts";

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing interface element: ${id}`);
  return element as T;
}

const view = required("view");
const notice = required("notice");
const fileInput = required<HTMLInputElement>("file-input");
const importButton = required<HTMLButtonElement>("import-button");
const dialog = required<HTMLDialogElement>("replace-dialog");
const homeDialog = required<HTMLDialogElement>("home-dialog");
const restartDialog = required<HTMLDialogElement>("restart-dialog");
const homeButton = required<HTMLButtonElement>("home-button");
const storageNote = required("storage-note");
const restored = restoreSession(() => sessionStorage.getItem(STORAGE_KEY));
let session: Session = restored.session;
let pending: Candidate | null = null;
let reading = false;
let importTrigger: HTMLButtonElement | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function action(label: string, name: string, style = "button-outline", symbol?: IconName): HTMLButtonElement {
  const button = el("button", `button ${style}`);
  button.type = "button";
  button.dataset.action = name;
  if (symbol) button.append(icon(symbol));
  if (label) button.append(el("span", "action-label", label));
  return button;
}

function countLabel(count: number): string {
  return `${count} carte${count === 1 ? "" : "s"}`;
}

function importedMessage(candidate: Candidate): string {
  return candidate.ignored > 0
    ? `${countLabel(candidate.ignored)} ignorée${candidate.ignored === 1 ? "" : "s"} : contenu incomplet ou invalide.`
    : "";
}

function showNotice(message: string, tone = "success"): void {
  notice.dataset.tone = tone;
  notice.setAttribute("role", tone === "error" ? "alert" : "status");
  notice.textContent = message;
}

function warnStorage(message: string): void {
  storageNote.textContent = message;
  storageNote.hidden = false;
}

function setSession(next: Session, focus?: string): void {
  session = next;
  if (!saveSession(session, (text) => sessionStorage.setItem(STORAGE_KEY, text))) {
    warnStorage("La progression ne peut pas être sauvegardée. Tu peux continuer à réviser, mais une actualisation peut perdre ta progression.");
  }
  render(focus);
}

function deckHeading(): HTMLElement {
  const heading = el("div", "deck-heading");
  if (session.kind === "empty") return heading;
  heading.append(el("p", "filename", session.name));
  return heading;
}

function render(focus?: string): void {
  importButton.hidden = session.kind === "empty" || session.kind === "complete";
  const section = el("section", `screen screen-${session.kind}`);
  if (session.kind === "empty") {
    section.append(el("h1", "home-title", "Ebbinghaus Viewer"),
      el("p", "home-intro", "Importe tes flashcards pour les réviser."),
      action("Importer tes cartes", "import", "button-primary", "upload"));
  } else if (session.kind === "ready") {
    const panel = el("div", "panel ready-panel");
    panel.append(el("h1", "filename", session.name), el("p", "card-count", countLabel(session.cards.length)));
    panel.append(el("p", "shuffle-question", "Veux-tu mélanger ton paquet ?"));
    const buttons = el("div", "choice-actions");
    buttons.append(action("Oui", "shuffle", "button-primary"), action("Non", "ordered"));
    panel.append(buttons);
    section.append(panel);
  } else if (session.kind === "complete") {
    section.append(deckHeading());
    const panel = el("div", "panel complete-panel");
    panel.append(el("h1", "", "Paquet terminé"));
    const buttons = el("div", "choice-actions");
    buttons.append(action("Recommencer", "restart", "button-primary", "restart"), action("Importer un paquet", "import", "button-outline", "upload"));
    panel.append(buttons);
    section.append(panel);
    if (session.undo) section.append(action("Annuler", "undo", "button-text", "undo"));
  } else {
    const card = session.cards[session.queue[0]!]!;
    const top = el("div", "review-top");
    top.append(deckHeading());
    const counter = el("p", "remaining", `${countLabel(session.queue.length)} restante${session.queue.length === 1 ? "" : "s"}`);
    counter.setAttribute("role", "status");
    top.append(counter);
    section.append(top);
    if (session.kind === "question") {
      section.append(el("h1", "sr-only", "Ta question"));
      const cardButton = action("", "reveal", "flashcard card-button");
      cardButton.append(el("span", "eyebrow", "QUESTION"), el("span", "card-text question-text", card.question),
        el("span", "reveal-hint", "Révéler la réponse"));
      section.append(cardButton);
    } else {
      section.append(el("h1", "sr-only", "Ta réponse"));
      const panel = el("div", "flashcard answer-card");
      panel.append(el("p", "eyebrow", "QUESTION"), el("p", "card-text answer-question", card.question));
      const answer = el("div", "answer-section");
      answer.id = "revealed-answer";
      answer.tabIndex = -1;
      answer.setAttribute("role", "region");
      answer.setAttribute("aria-label", "Réponse");
      answer.append(el("p", "eyebrow", "RÉPONSE"), el("p", "card-text answer-text", card.answer));
      panel.append(answer);
      const buttons = el("div", "rating-actions");
      buttons.setAttribute("aria-label", "Évaluer ta réponse");
      buttons.append(action("J’ai trouvé", "known", "button-success"), action("À revoir", "again", "button-danger"));
      section.append(panel, buttons);
    }
    const secondary = el("nav", "secondary-actions");
    secondary.setAttribute("aria-label", "Navigation du paquet");
    secondary.append(action("Accueil", "home", "button-text", "home"));
    if (session.undo) secondary.append(action("Annuler", "undo", "button-text", "undo"));
    secondary.append(action("Recommencer", "restart", "button-text", "restart"));
    section.append(secondary);
  }
  view.replaceChildren(section);
  setReading(reading);
  if (focus === "answer") required("revealed-answer").focus();
  else if (focus) view.querySelector<HTMLButtonElement>(`[data-action="${focus}"]`)?.focus();
}

function setReading(value: boolean): void {
  reading = value;
  homeButton.disabled = value;
  for (const button of view.querySelectorAll<HTMLButtonElement>('[data-action="home"], [data-action="restart"]')) button.disabled = value;
  importButton.disabled = value;
  importButton.querySelector(".action-label")!.textContent = value ? "Lecture du paquet…" : "Importer un paquet";
  for (const button of view.querySelectorAll<HTMLButtonElement>('[data-action="import"]')) {
    button.disabled = value;
    button.querySelector(".action-label")!.textContent = value ? "Lecture du paquet…" : session.kind === "empty" ? "Importer tes cartes" : "Importer un paquet";
  }
}

function importFile(trigger: HTMLButtonElement): void {
  if (!reading) {
    importTrigger = trigger;
    fileInput.click();
  }
}

view.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-action]") : null;
  if (!button || button.disabled) return;
  switch (button.dataset.action) {
    case "import": importFile(button); break;
    case "home": requestHome(); break;
    case "ordered": showNotice(""); setSession(start(session), "reveal"); break;
    case "shuffle": showNotice(""); setSession(start(session, true), "reveal"); break;
    case "reveal": setSession(reveal(session), "answer"); break;
    case "known": setSession(rate(session, "known"), session.kind === "answer" && session.queue.length === 1 ? "restart" : "reveal"); break;
    case "again": setSession(rate(session, "again"), "reveal"); break;
    case "undo": setSession(undo(session), "answer"); break;
    case "restart":
      if (!reading && session.kind !== "empty") restartDialog.showModal();
      break;
  }
});

importButton.addEventListener("click", () => importFile(importButton));
fileInput.addEventListener("cancel", () => { importTrigger = null; });
homeButton.addEventListener("click", requestHome);

function requestHome(): void {
  if (reading || session.kind === "empty") return;
  if (session.kind === "complete") returnHome();
  else homeDialog.showModal();
}

function returnHome(): void {
  showNotice("");
  setSession({ kind: "empty" }, "import");
}

required("cancel-home").addEventListener("click", () => homeDialog.close());
required("confirm-home").addEventListener("click", () => {
  homeDialog.close();
  returnHome();
});
required("cancel-restart").addEventListener("click", () => restartDialog.close());
required("confirm-restart").addEventListener("click", () => {
  restartDialog.close();
  showNotice("");
  setSession(restart(session), "shuffle");
});
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  const trigger = importTrigger;
  importTrigger = null;
  if (!file) return;
  setReading(true);
  const result = await readDeck(file);
  setReading(false);
  if (trigger?.isConnected && !trigger.disabled && document.activeElement === document.body) trigger.focus();
  if (!result.ok) {
    showNotice(`${result.message}${session.kind === "empty" ? "" : " Ton paquet est conservé."}`, "error");
    return;
  }
  const proposal = offerImport(session, result, file.name);
  if (proposal.pending) {
    pending = proposal.pending;
    required("replace-summary").textContent = `${file.name} — ${countLabel(pending.cards.length)}${pending.ignored ? `. ${importedMessage(pending)}` : ""}`;
    dialog.showModal();
  } else {
    showNotice(importedMessage({ cards: result.cards, name: file.name, ignored: result.ignored }), result.ignored ? "warning" : "success");
    setSession(proposal.session, "shuffle");
  }
});

required("cancel-replace").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => { pending = null; });
required("confirm-replace").addEventListener("click", () => {
  const candidate = pending;
  if (!candidate) return;
  dialog.close();
  pending = null;
  showNotice(importedMessage(candidate), candidate.ignored ? "warning" : "success");
  setSession(acceptImport(candidate), "shuffle");
});

required("brand-icon").append(icon("brain"));
importButton.prepend(icon("upload"));
if (restored.warning) warnStorage(restored.warning);
render();
