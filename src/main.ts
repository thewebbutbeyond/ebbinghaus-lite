import { readDeck } from "./import.ts";
import { acceptImport, offerImport, restart, type Candidate, type Session } from "./session.ts";
import { restoreSession, saveSession, STORAGE_KEY } from "./storage.ts";
import { icon } from "./icons.ts";
import { action, countLabel, el, renderReview, reviewAction } from "./review-view.ts";

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

function render(focus?: string): void {
  importButton.hidden = session.kind === "empty" || session.kind === "complete";
  let section: HTMLElement;
  if (session.kind === "empty") {
    section = el("section", "screen screen-empty");
    section.append(el("h1", "home-title", "Ebbinghaus Viewer"),
      el("p", "home-intro", "Importe tes flashcards pour les réviser."),
      action("Importer tes cartes", "import", "button-primary", "upload"));
  } else section = renderReview(session, "standalone");
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
    case "restart":
      if (!reading && session.kind !== "empty") restartDialog.showModal();
      break;
    default: {
      const name = button.dataset.action;
      const next = name && reviewAction(session, name);
      if (next) {
        if (name === "ordered" || name === "shuffle") showNotice("");
        setSession(next.session, next.focus);
      }
    }
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
