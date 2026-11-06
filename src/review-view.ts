import { rate, reveal, start, undo, type Session } from "./session.ts";
import { icon, type IconName } from "./icons.ts";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function action(label: string, name: string, style = "button-outline", symbol?: IconName): HTMLButtonElement {
  const button = el("button", `button ${style}`);
  button.type = "button";
  button.dataset.action = name;
  if (symbol) button.append(icon(symbol));
  if (label) button.append(el("span", "action-label", label));
  return button;
}

export function countLabel(count: number): string {
  return `${count} carte${count === 1 ? "" : "s"}`;
}

function deckHeading(session: Exclude<Session, { kind: "empty" }>): HTMLElement {
  const heading = el("div", "deck-heading");
  heading.append(el("p", "filename", session.name));
  return heading;
}

export function renderReview(
  session: Exclude<Session, { kind: "empty" }>,
  mode: "standalone" | "portal",
): HTMLElement {
  const portal = mode === "portal";
  const section = el("section", `screen screen-${session.kind}`);
  if (session.kind === "ready") {
    const panel = el("div", "panel ready-panel");
    panel.append(el("h1", "filename", session.name), el("p", "card-count", countLabel(session.cards.length)));
    panel.append(el("p", "shuffle-question", "Veux-tu mélanger ton paquet ?"));
    const buttons = el("div", "choice-actions");
    buttons.append(action("Oui", "shuffle", "button-primary"), action("Non", "ordered"));
    panel.append(buttons);
    section.append(panel);
  } else if (session.kind === "complete") {
    section.append(deckHeading(session));
    const panel = el("div", "panel complete-panel");
    panel.append(el("h1", "", "Paquet terminé"));
    const buttons = el("div", "choice-actions");
    buttons.append(action("Recommencer", "restart", "button-primary", "restart"));
    if (!portal) buttons.append(action("Importer un paquet", "import", "button-outline", "upload"));
    panel.append(buttons);
    section.append(panel);
    if (session.undo) section.append(action("Annuler", "undo", "button-text", "undo"));
  } else {
    const card = session.cards[session.queue[0]!]!;
    const top = el("div", "review-top");
    top.append(deckHeading(session));
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
    if (!portal) secondary.append(action("Accueil", "home", "button-text", "home"));
    if (session.undo) secondary.append(action("Annuler", "undo", "button-text", "undo"));
    secondary.append(action("Recommencer", "restart", "button-text", "restart"));
    section.append(secondary);
  }
  return section;
}

export function reviewAction(session: Session, name: string): { session: Session; focus: string } | null {
  switch (name) {
    case "ordered": return { session: start(session), focus: "reveal" };
    case "shuffle": return { session: start(session, true), focus: "reveal" };
    case "reveal": return { session: reveal(session), focus: "answer" };
    case "known": return {
      session: rate(session, "known"),
      focus: session.kind === "answer" && session.queue.length === 1 ? "restart" : "reveal",
    };
    case "again": return { session: rate(session, "again"), focus: "reveal" };
    case "undo": return { session: undo(session), focus: "answer" };
    default: return null;
  }
}
