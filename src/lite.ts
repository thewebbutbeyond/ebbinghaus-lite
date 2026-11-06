/// <reference types="vite/client" />
import { icon } from "./icons.ts";
import { parseDeck } from "./import.ts";
import { catalog, type Course, type Resource } from "./lite-catalog.ts";
import { action, el, renderReview, reviewAction } from "./review-view.ts";
import { restart, type Session } from "./session.ts";

type Named = Readonly<{ id: string; title: string }>;
type Crumb = Readonly<{ title: string; href: string }>;
type Route = { kind: "landing" } | { kind: "list"; crumbs: Crumb[]; entries: readonly Named[] } |
  { kind: "course"; crumbs: Crumb[]; course: Course } |
  { kind: "deck"; crumbs: Crumb[]; resource: Resource } |
  { kind: "missing"; crumbs: Crumb[] };

const main = document.querySelector<HTMLElement>("#portal-main")!;
const view = document.querySelector<HTMLElement>("#lite-view")!;
const landing = document.querySelector<HTMLElement>("#lite-landing")!;
const back = document.querySelector<HTMLAnchorElement>("#lite-back")!;
const breadcrumbs = document.querySelector<HTMLElement>("#lite-breadcrumbs")!;
const restartDialog = document.querySelector<HTMLDialogElement>("#lite-restart")!;
const home: Crumb = { title: "Institutions", href: "#/" };
const courseDate = new Intl.DateTimeFormat("fr-BE", { dateStyle: "long", timeZone: "UTC" });
const institutions = catalog.flatMap((institution) => {
  const departments = institution.departments.flatMap((department) => {
    const courses = department.courses.filter((course) =>
      course.decks.length || course.sheets.length || course.corrections.length);
    return courses.length ? [{ ...department, courses }] : [];
  });
  return departments.length ? [{ ...institution, departments }] : [];
});

let navigation = new AbortController();
let deck: Exclude<Session, { kind: "empty" }> | null = null;

function readRoute(): Route {
  const crumbs = [home];
  const { hash } = location;
  if (!hash) return { kind: "landing" };
  if (hash === home.href) return { kind: "list", crumbs, entries: institutions };
  const missing = (): Route => ({ kind: "missing", crumbs: [...crumbs, { title: "Page introuvable", href: hash }] });
  if (!/^#\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/.test(hash)) return missing();
  const parts = hash.slice(2).split("/");
  const add = (entry: Named, depth: number) => crumbs.push({
    title: entry.title, href: "#/" + parts.slice(0, depth).join("/"),
  });
  const institution = institutions.find(({ id }) => id === parts[0]);
  if (!institution) return missing();
  add(institution, 1);
  if (parts.length === 1) return { kind: "list", crumbs, entries: institution.departments };
  const department = institution.departments.find(({ id }) => id === parts[1]);
  if (!department) return missing();
  add(department, 2);
  if (parts.length === 2) return { kind: "list", crumbs, entries: department.courses };
  const course = department.courses.find(({ id }) => id === parts[2]);
  if (!course) return missing();
  add(course, 3);
  if (parts.length === 3) return { kind: "course", crumbs, course };
  if (parts.length !== 5 || parts[3] !== "paquets") return missing();
  const resource = course.decks.find(({ id }) => id === parts[4]);
  if (!resource) return missing();
  add(resource, 5);
  return { kind: "deck", crumbs, resource };
}

function link(label: string, href: string, classes = ""): HTMLAnchorElement {
  const element = el("a", classes, label);
  element.href = href;
  return element;
}

function navigationControls(route: Exclude<Route, { kind: "landing" }>): void {
  const parent = route.crumbs.at(-2);
  back.hidden = !parent;
  breadcrumbs.hidden = !parent;
  if (!parent) {
    breadcrumbs.replaceChildren();
    return;
  }
  back.href = parent.href;
  back.querySelector("span")!.textContent = route.kind === "deck" ? "Retour au cours" : parent.title;
  const list = el("ol");
  for (const [index, crumb] of route.crumbs.entries()) {
    const item = el("li");
    if (index) {
      const separator = el("span", "", "/");
      separator.setAttribute("aria-hidden", "true");
      item.append(separator);
    }
    if (index === route.crumbs.length - 1) {
      const current = el("span", "", crumb.title);
      current.setAttribute("aria-current", "page");
      item.append(current);
    } else item.append(link(crumb.title, crumb.href));
    list.append(item);
  }
  breadcrumbs.replaceChildren(list);
}

function screen(title: string, centered = false): HTMLElement {
  const page = el("section", "portal-page");
  page.append(el("h1", centered ? "portal-centered-heading" : "", title));
  return page;
}

function show(content: HTMLElement, focus = false): void {
  view.replaceChildren(content);
  if (focus) main.focus();
}

function resourceUrl(resource: Resource): string {
  return import.meta.env.BASE_URL + resource.path;
}

function row(title: string, href: string, resource?: Resource): HTMLLIElement {
  const item = el("li", "panel portal-item");
  const layout = el("div", "portal-resource-row " + (resource ? "lite-document-row" : "lite-navigation-row"));
  const label = resource ? "Ouvrir dans un nouvel onglet" : "Ouvrir";
  const open = link(resource ? label : "", href, "button button-small button-outline");
  open.setAttribute("aria-label", label + " — " + title);
  open.append(icon(resource ? "arrowUpRight" : "chevronRight"));
  layout.append(el("span", "portal-resource-name", title));
  if (resource) {
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    const download = link("", href, "button button-small button-outline portal-download");
    download.setAttribute("aria-label", "Télécharger — " + title);
    download.download = resource.path.split("/").at(-1)!;
    download.title = "Télécharger";
    download.append(icon("download"));
    const actions = el("div", "portal-document-actions");
    actions.append(open, download);
    layout.append(actions);
  } else {
    open.classList.add("lite-chevron");
    open.title = label;
    layout.append(open);
  }
  item.append(layout);
  return item;
}

function showCourse(course: Course, href: string, focus: boolean): void {
  const page = screen(course.title);
  const updated = el("p", "lite-course-updated", "Dernière mise à jour : ");
  const date = el("time", "", courseDate.format(new Date(course.updatedOn)));
  date.dateTime = course.updatedOn;
  updated.append(date);
  page.append(updated);
  for (const [label, resources, isDeck] of [
    ["Flashcards", course.decks, true],
    ["Formulaire et méthode", course.sheets, false],
    ["Corrigés", course.corrections, false],
  ] as const) {
    if (!resources.length) continue;
    const section = el("section", "portal-section");
    const list = el("ul", "portal-list");
    for (const entry of resources) {
      const item = isDeck ? row(entry.title, href + "/paquets/" + entry.id)
        : row(entry.title, resourceUrl(entry), entry);
      list.append(item);
    }
    section.append(el("h2", "", label), list);
    page.append(section);
  }
  show(page, focus);
}

function showDeck(focus?: string): void {
  if (!deck) return;
  show(renderReview(deck, "portal"));
  if (focus === "answer") view.querySelector<HTMLElement>("#revealed-answer")?.focus();
  else if (focus) view.querySelector<HTMLButtonElement>('button[data-action="' + focus + '"]')?.focus();
}

async function openRoute(focus = false): Promise<void> {
  navigation.abort();
  navigation = new AbortController();
  const { signal } = navigation;
  deck = null;
  if (restartDialog.open) restartDialog.close();
  const route = readRoute();
  const isLanding = route.kind === "landing";
  main.classList.toggle("lite-landing-page", isLanding);
  landing.hidden = !isLanding;
  view.hidden = isLanding;
  if (isLanding) {
    document.title = "ebbinghaus lite";
    back.hidden = breadcrumbs.hidden = true;
    breadcrumbs.replaceChildren();
    view.replaceChildren();
    if (focus) main.focus();
    return;
  }
  const current = route.crumbs.at(-1)!;
  document.title = current.title + " · ebbinghaus lite";
  navigationControls(route);
  if (route.kind === "list") {
    const page = screen(current.title, true);
    const list = el("ul", "portal-list");
    const prefix = current.href === home.href ? current.href : current.href + "/";
    for (const entry of route.entries) {
      list.append(row(entry.title, prefix + entry.id));
    }
    if (list.childElementCount) page.append(list);
    else page.append(el("p", "", "Aucun cours publié."));
    show(page, focus);
  } else if (route.kind === "course") {
    showCourse(route.course, current.href, focus);
  } else if (route.kind === "missing") {
    show(screen(current.title), focus);
  } else {
    const loading = el("p", "portal-page", "Chargement du paquet…");
    loading.setAttribute("role", "status");
    show(loading, focus);
    try {
      const response = await fetch(resourceUrl(route.resource), { signal });
      if (!response.ok) throw new Error("Published deck unavailable");
      const result = parseDeck(await response.text());
      if (signal.aborted) return;
      if (!result.ok || result.ignored) throw new Error("Invalid published deck");
      deck = { kind: "ready", name: current.title, cards: result.cards };
      showDeck(focus && document.activeElement === main ? "shuffle" : undefined);
    } catch {
      if (signal.aborted) return;
      const page = screen("Impossible de charger le paquet");
      const retry = action("Réessayer", "retry");
      retry.addEventListener("click", () => void openRoute(true));
      page.append(retry);
      show(page, focus);
    }
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
document.querySelector("#lite-restart-cancel")!.addEventListener("click", () => restartDialog.close());
document.querySelector("#lite-restart-confirm")!.addEventListener("click", () => {
  restartDialog.close();
  if (!deck) return;
  const session = restart(deck);
  if (session.kind !== "empty") deck = session;
  showDeck("shuffle");
});
document.querySelector("#lite-brand-icon")!.append(icon("brain"));
back.prepend(icon("arrowLeft"));
document.querySelector("#lite-skip")!.addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
});
window.addEventListener("hashchange", () => void openRoute(true));
void openRoute();
