import { el } from "./review-view.ts";
import { icon } from "./icons.ts";

export const CHAPTER_ONE_SOURCE = "https://gitlab.com/computer-security3/sec1/-/blob/959f789db9fef7649b6b61cb8f812a2909091d41/Ch.%201%20-%20Introduction/slides.tex";

export function stepCounter(): HTMLOutputElement {
  const output = el("output");
  output.dataset.exampleStep = "";
  output.setAttribute("aria-label", "Étape de l’exemple");
  return output;
}

export function article(id: string, title: string, sections: readonly (readonly [string, string])[], limits: string, reference: string): HTMLElement {
  const content = el("article", "example-article");
  content.setAttribute("aria-labelledby", id + "-explanation");
  const heading = el("h2", "", title);
  heading.id = id + "-explanation";
  content.append(heading);
  for (const [title, text] of sections) {
    const section = el("section");
    section.append(el("h3", "", title), el("p", "", text));
    content.append(section);
  }
  content.append(el("p", "example-assumptions", limits));
  const source = el("a", "", reference);
  source.href = CHAPTER_ONE_SOURCE;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  const paragraph = el("p", "example-reference");
  paragraph.append(source);
  content.append(paragraph);
  return content;
}

function actorIcon(kind: "browser" | "server" | "person"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "example-actor-icon");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", kind === "browser" ? "M3 5h18v12H3ZM12 17v4m-5 0h10M3 9h18"
    : kind === "server" ? "M4 3h16v6H4Zm0 6h16v6H4Zm0 6h16v6H4ZM7 6h.01M7 12h.01M7 18h.01"
      : "M9 7a3 3 0 1 0 6 0 3 3 0 1 0-6 0M5 21v-3a7 7 0 0 1 14 0v3");
  svg.append(path);
  return svg;
}

export function actor(id: string, title: string, kind: "browser" | "server" | "person", fields: readonly (readonly [string, string | null])[], emphasis = false): HTMLElement {
  const card = el("section", "example-actor" + (emphasis ? " example-actor-emphasis" : ""));
  card.dataset.actor = id;
  const header = el("div", "example-actor-heading");
  header.append(actorIcon(kind), el("h3", "", title));
  const values = el("dl");
  for (const [label, value] of fields) {
    const field = el("div");
    field.append(el("dt", "", label), el("dd", value === null ? "example-unknown" : "", value ?? "Aucun"));
    values.append(field);
  }
  card.append(header, values);
  return card;
}

export function exchange(from: string, to: string, payload: string, hostile = false): HTMLElement {
  const flow = el("div", "example-transfer" + (hostile ? " example-transfer-hostile" : ""));
  flow.setAttribute("role", "img");
  flow.setAttribute("aria-label", from + " vers " + to + " : " + payload);
  const direction = el("div", "example-direction");
  const arrow = icon("arrowRight");
  arrow.classList.add("example-flow-arrow");
  direction.append(el("span", "", from), arrow, el("span", "", to));
  flow.append(direction, el("p", "example-payload", payload));
  return flow;
}
