import { icon } from "./icons.ts";
import { validateDeck } from "./import.ts";
import { action, el, renderReview, reviewAction } from "./review-view.ts";
import { restart, type Session } from "./session.ts";

type Named = Readonly<{ id: string; title: string }>;
type Paper = Named & { subject?: { id: string }; correction?: { id: string } };
type Course = Named & { decks: Named[]; sheets: Named[]; papers: Paper[] };
type Route = { kind: "dashboard" } | { kind: "course"; courseId: string } |
  { kind: "deck"; courseId: string; deckId: string } | { kind: "missing" };

const main = document.querySelector<HTMLElement>("#portal-main")!;
const view = document.querySelector<HTMLElement>("#portal-view")!;
const notice = document.querySelector<HTMLElement>("#portal-notice")!;
const back = document.querySelector<HTMLAnchorElement>("#portal-back")!;
const logout = document.querySelector<HTMLButtonElement>("#portal-logout")!;
const restartDialog = document.querySelector<HTMLDialogElement>("#portal-restart")!;
const tabs = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("ebbinghaus-portal-auth");
let navigation = new AbortController();
let deck: Exclude<Session, { kind: "empty" }> | null = null;
let authenticated = false;
let signingOut = false;

function currentRoute(): Route {
  const path = location.hash.slice(1);
  if (!path || path === "/") return { kind: "dashboard" };
  const match = /^\/cours\/([A-Za-z0-9_-]+)(?:\/paquet\/([A-Za-z0-9_-]+))?$/.exec(path);
  if (!match?.[1]) return { kind: "missing" };
  return match[2]
    ? { kind: "deck", courseId: match[1], deckId: match[2] }
    : { kind: "course", courseId: match[1] };
}

function courseLink(id: string): string {
  return "#/cours/" + encodeURIComponent(id);
}

function courseApi(id: string): string {
  return "/api/courses/" + encodeURIComponent(id);
}

function link(label: string, href: string, classes = "button button-outline"): HTMLAnchorElement {
  const element = el("a", classes, label);
  element.href = href;
  return element;
}

function message(text = ""): void {
  notice.textContent = text;
  notice.dataset.tone = text ? "error" : "";
}

function screen(title: string, centered = false): HTMLElement {
  const element = el("section", "portal-page");
  element.append(el("h1", centered ? "portal-centered-heading" : "", title));
  return element;
}

function showBack(label: string, href: string): void {
  back.querySelector("span")!.textContent = label;
  back.href = href;
  back.hidden = false;
}

function replace(element: HTMLElement, focus = false): void {
  view.replaceChildren(element);
  if (focus) main.focus();
}

function setAuthenticated(value: boolean): void {
  authenticated = value;
  logout.hidden = !value;
}

function clearView(): void {
  navigation.abort();
  navigation = new AbortController();
  deck = null;
  back.hidden = true;
  if (restartDialog.open) restartDialog.close();
  view.replaceChildren();
  message();
}

function goToLogin(): void {
  clearView();
  setAuthenticated(false);
  history.replaceState(null, "", location.pathname);
  showLogin(true);
}

function request(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, cache: "no-store", credentials: "same-origin" });
}

function showLogin(focus = false): void {
  setAuthenticated(false);
  const page = screen("Connexion", true);
  const form = el("form", "panel portal-login");
  const email = el("input");
  email.type = "email";
  email.name = "email";
  email.required = true;
  email.autocomplete = "username";
  const password = el("input");
  password.type = "password";
  password.name = "password";
  password.required = true;
  password.autocomplete = "current-password";
  const emailLabel = el("label", "", "Adresse e-mail");
  const passwordLabel = el("label", "", "Mot de passe");
  emailLabel.append(email);
  passwordLabel.append(password);
  const submit = el("button", "button button-primary", "Se connecter");
  submit.type = "submit";
  form.append(emailLabel, passwordLabel, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    message();
    const signal = navigation.signal;
    const body = JSON.stringify({ email: email.value, password: password.value });
    password.value = "";
    try {
      const result = await request("/api/session", {
        method: "POST", headers: { "Content-Type": "application/json" }, body, signal,
      });
      if (signal.aborted) return;
      if (result.ok) {
        tabs?.postMessage("signed-in");
        await openRoute(true);
      }
      else if (result.status === 401) {
        message("Adresse e-mail ou mot de passe incorrect.");
        password.focus();
      } else message("Connexion impossible. Réessaie.");
    } catch {
      if (!signal.aborted) message("Connexion impossible. Réessaie.");
    } finally {
      submit.disabled = false;
    }
  });
  page.append(form);
  replace(page, focus);
}

function showDashboard(courses: Named[], focus: boolean): void {
  const page = screen("Mes cours", true);
  if (courses.length === 0) page.append(el("p", "", "Aucun cours ne t’a encore été attribué."));
  else {
    const list = el("ul", "portal-list");
    for (const course of courses) {
      list.append(openRow(course.title, courseLink(course.id)));
    }
    page.append(list);
  }
  replace(page, focus);
}

function section(label: string): { block: HTMLElement; list: HTMLUListElement } {
  const block = el("section", "portal-section");
  const list = el("ul", "portal-list");
  block.append(el("h2", "", label), list);
  return { block, list };
}

function openRow(label: string, href: string): HTMLLIElement {
  const item = el("li", "panel portal-item");
  const row = el("div", "portal-resource-row");
  const open = link("Ouvrir", href, "button button-small button-outline");
  open.setAttribute("aria-label", "Ouvrir — " + label);
  row.append(el("span", "portal-resource-name", label), open);
  item.append(row);
  return item;
}

function documentRow(courseId: string, id: string, label: string): HTMLElement {
  const url = courseApi(courseId) + "/documents/" + encodeURIComponent(id);
  const row = el("div", "portal-resource-row");
  const actions = el("div", "portal-document-actions");
  const open = link("Ouvrir", url, "button button-small button-outline");
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  open.setAttribute("aria-label", "Ouvrir — " + label);
  const download = link("", url + "?download=1", "button button-small button-outline portal-download");
  download.setAttribute("aria-label", "Télécharger — " + label);
  download.title = "Télécharger";
  download.append(icon("download"));
  actions.append(open, download);
  row.append(el("span", "portal-resource-name", label), actions);
  return row;
}

function showCourse(course: Course, focus: boolean): void {
  showBack("Mes cours", "#/");
  const page = screen(course.title);
  if (course.decks.length) {
    const { block, list } = section("Flashcards");
    for (const entry of course.decks) {
      list.append(openRow(entry.title, courseLink(course.id) + "/paquet/" + encodeURIComponent(entry.id)));
    }
    page.append(block);
  }
  if (course.sheets.length) {
    const { block, list } = section("Fiches méthode");
    for (const entry of course.sheets) {
      const item = el("li", "panel portal-item");
      item.append(documentRow(course.id, entry.id, entry.title));
      list.append(item);
    }
    page.append(block);
  }
  if (course.papers.length) {
    const { block, list } = section("Sujets et corrigés");
    for (const paper of course.papers) {
      const item = el("li", "panel portal-item");
      item.append(el("h3", "", paper.title));
      if (paper.subject) item.append(documentRow(course.id, paper.subject.id, "Sujet"));
      if (paper.correction) item.append(documentRow(course.id, paper.correction.id, "Corrigé"));
      list.append(item);
    }
    page.append(block);
  }
  if (!course.decks.length && !course.sheets.length && !course.papers.length) {
    page.append(el("p", "", "Aucune ressource publiée pour ce cours."));
  }
  replace(page, focus);
}

function showDeck(focus?: string): void {
  if (!deck) return;
  replace(renderReview(deck, "portal"));
  if (focus === "answer") view.querySelector<HTMLElement>("#revealed-answer")?.focus();
  else if (focus) view.querySelector<HTMLButtonElement>('[data-action="' + focus + '"]')?.focus();
}

function showUnavailable(focus: boolean): void {
  showBack("Mes cours", "#/");
  replace(screen("Ressource indisponible"), focus);
}

async function openRoute(focus = false): Promise<void> {
  if (signingOut) return;
  clearView();
  const { signal } = navigation;
  const route = currentRoute();
  const url = route.kind === "dashboard" ? "/api/courses"
    : route.kind === "course" ? courseApi(route.courseId)
    : route.kind === "deck" ? courseApi(route.courseId) + "/decks/" + encodeURIComponent(route.deckId)
    : "/api/session";
  replace(el("p", "portal-page", "Chargement…"));
  try {
    const response = await request(url, { signal });
    if (signal.aborted) return;
    if (response.status === 401) {
      showLogin(focus);
      return;
    }
    if (response.status === 404 || (route.kind === "missing" && response.ok)) {
      setAuthenticated(true);
      showUnavailable(focus);
      return;
    }
    if (!response.ok) throw new Error("Request failed");
    const value: unknown = await response.json();
    if (signal.aborted) return;
    setAuthenticated(true);
    if (route.kind === "dashboard") showDashboard((value as { courses: Named[] }).courses, focus);
    else if (route.kind === "course") showCourse(value as Course, focus);
    else if (route.kind === "deck") {
      const entry = value as Named & { cards: unknown };
      const valid = validateDeck(entry.cards);
      if (!valid.ok || valid.ignored) throw new Error("Invalid published deck");
      deck = { kind: "ready", name: entry.title, cards: valid.cards };
      showBack("Retour au cours", courseLink(route.courseId));
      showDeck(focus ? "shuffle" : undefined);
    }
  } catch {
    if (signal.aborted) return;
    const page = screen("Chargement impossible");
    const retry = action("Réessayer", "retry");
    retry.addEventListener("click", () => void openRoute(true));
    page.append(retry);
    replace(page, focus);
  }
}

view.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-action]") : null;
  if (!deck || !button?.dataset.action) return;
  const name = button.dataset.action;
  if (name === "restart") restartDialog.showModal();
  else {
    const next = reviewAction(deck, name);
    if (!next || next.session.kind === "empty") return;
    deck = next.session;
    showDeck(next.focus);
  }
});

document.querySelector("#portal-restart-cancel")!.addEventListener("click", () => restartDialog.close());
document.querySelector("#portal-restart-confirm")!.addEventListener("click", () => {
  restartDialog.close();
  if (!deck) return;
  const session = restart(deck);
  if (session.kind !== "empty") deck = session;
  showDeck("shuffle");
});

logout.addEventListener("click", async () => {
  if (signingOut) return;
  signingOut = true;
  clearView();
  logout.disabled = true;
  replace(el("p", "portal-page", "Déconnexion…"));
  try {
    const response = await request("/api/session", { method: "DELETE" });
    if (!response.ok) throw new Error("Sign-out failed");
    tabs?.postMessage("signed-out");
    goToLogin();
  } catch {
    replace(screen("Déconnexion impossible"), true);
    message("Réessaie avec « Se déconnecter ».");
  } finally {
    logout.disabled = false;
    signingOut = false;
  }
});

document.querySelector("#portal-brand-icon")!.append(icon("brain"));
back.prepend(icon("arrowLeft"));
logout.prepend(icon("logout"));
document.querySelector("#portal-skip")!.addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
});
tabs?.addEventListener("message", (event) => {
  if (event.data === "signed-out") goToLogin();
  else if (event.data === "signed-in") void openRoute();
});
window.addEventListener("hashchange", () => void openRoute(true));
window.addEventListener("pagehide", clearView);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) void openRoute();
});
window.addEventListener("focus", async () => {
  if (!authenticated || signingOut) return;
  const { signal } = navigation;
  try {
    const response = await request("/api/session", { signal });
    if (!signal.aborted && response.status === 401) goToLogin();
  } catch {
    // A network error does not establish that the session has ended.
  }
});
void openRoute();
