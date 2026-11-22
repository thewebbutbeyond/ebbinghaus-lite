import { characters, frontFace, strip, DEFAULT_FACES, DEFAULT_MESSAGE, DEFAULT_SPACING, MAX_MESSAGE_LENGTH, MAX_TURN, MIN_TURN, type Cell } from "./scytale.ts";
import { createPlayback } from "./example-playback.ts";
import { article, stepCounter } from "./example-ui.ts";
import { el } from "./review-view.ts";

const SVG = "http://www.w3.org/2000/svg";
const SHAPES: Record<number, string> = { 3: "triangle", 4: "carré", 5: "pentagone", 6: "hexagone", 7: "heptagone", 8: "octogone" };

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

const show = (value: string) => value === " " ? "␠" : value;

export function createScytaleView(signal: AbortSignal, title: string): HTMLElement {
  let cells: Cell[] = strip(DEFAULT_MESSAGE, DEFAULT_SPACING);
  let cursor = 0;
  let invalid = false;
  const lastStep = 3;
  const page = el("section", "portal-page example-view scytale-view");
  page.append(el("h1", "", title));
  const settings = el("div", "panel scytale-settings");
  const messageLabel = el("label", "", "Message");
  const message = el("textarea");
  message.id = "scytale-message";
  message.rows = 2;
  message.value = DEFAULT_MESSAGE;
  messageLabel.htmlFor = message.id;
  const error = el("p", "scytale-error");
  error.id = "scytale-error";
  error.setAttribute("aria-live", "polite");
  message.setAttribute("aria-describedby", error.id);
  const messageGroup = el("div", "scytale-message-group");
  messageGroup.append(messageLabel, message, error);
  settings.append(messageGroup);

  function slider(id: string, label: string, value: number): [HTMLInputElement, HTMLElement, HTMLElement] {
    const group = el("div", "scytale-setting");
    const caption = el("label", "", label);
    const input = el("input");
    input.type = "range";
    input.id = id;
    input.min = String(MIN_TURN);
    input.max = String(MAX_TURN);
    input.value = String(value);
    caption.htmlFor = id;
    const valueText = el("span", "scytale-setting-value");
    const row = el("div", "scytale-slider");
    row.append(input, valueText);
    group.append(caption, row);
    settings.append(group);
    return [input, valueText, row];
  }
  const [spacing, spacingText] = slider("scytale-spacing", "Languette : une lettre du message toutes les…", DEFAULT_SPACING);
  const [faces, facesText, facesRow] = slider("scytale-faces", "Bâton : nombre de faces", DEFAULT_FACES);
  const section = svg("svg", { viewBox: "-22 -22 44 44", width: 36, height: 36, class: "scytale-section", "aria-hidden": "true" });
  facesRow.append(section);

  const scene = el("div", "panel example-stage");
  const counter = stepCounter();
  const controls = createPlayback(signal, {
    prefix: "scytale",
    position: () => ({ first: cursor === 0, last: cursor === lastStep, disabled: invalid }),
    next: () => { cursor = Math.min(lastStep, cursor + 1); render(); },
    previous: () => { cursor = Math.max(0, cursor - 1); render(); },
    reset: () => {
      message.value = DEFAULT_MESSAGE;
      spacing.value = String(DEFAULT_SPACING);
      faces.value = String(DEFAULT_FACES);
      cursor = 0;
      recompute();
    },
  });
  const clock = el("div", "example-clock");
  clock.append(counter, controls.status);
  const titles = ["Alice écrit sur une face de son bâton", "La languette déroulée", "Enroulée autour du bâton du destinataire", "Le bon bâton pour la bonne languette"];

  function stick(front: readonly Cell[], n: number): HTMLElement {
    const band = 34, height = 40 + n * 8, skew = height * 0.22;
    const width = Math.max(1, front.length) * band + skew + 24;
    const drawing = svg("svg", { viewBox: `0 0 ${width} ${height + 12}`, width, height: height + 12, class: "scytale-stick" });
    drawing.setAttribute("role", "img");
    drawing.setAttribute("aria-label", "Face avant du bâton : " + front.map(cell => cell.value).join(""));
    drawing.append(svg("rect", { x: 2, y: 2, width: width - 4, height: height + 8, rx: 8, class: "scytale-wood" }));
    front.forEach((cell, i) => {
      const x = 12 + i * band;
      drawing.append(svg("path", { d: `M${x} 6 L${x + band - 2} 6 L${x + band - 2 + skew} ${height + 6} L${x + skew} ${height + 6}Z`, class: "scytale-band" }));
      const text = svg("text", { x: x + band / 2 + skew / 2, y: height / 2 + 12, "text-anchor": "middle", class: "scytale-letter" });
      text.textContent = show(cell.value);
      drawing.append(text);
    });
    const scroll = el("div", "scytale-scroll");
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", "Bâton");
    scroll.append(drawing);
    return scroll;
  }

  function render(): void {
    const k = Number(spacing.value), n = Number(faces.value);
    spacingText.textContent = k + " cases";
    facesText.textContent = n + " faces · " + SHAPES[n];
    const points = Array.from({ length: n }, (_, i) => {
      const angle = -Math.PI / 2 + 2 * Math.PI * i / n;
      return (18 * Math.cos(angle)).toFixed(1) + "," + (18 * Math.sin(angle)).toFixed(1);
    }).join(" ");
    section.replaceChildren(svg("polygon", { points, class: "scytale-wood" }));
    counter.value = "Étape " + cursor + "/" + lastStep;
    scene.replaceChildren(el("h2", "", titles[cursor]));
    const front = frontFace(cells, n);
    const onFace = new Set(front.map(cell => cell.index));
    if (cursor === 0) {
      scene.append(el("h3", "", "Bâton d’Alice · " + k + " faces, une lettre par tour"), stick(frontFace(cells, k), k));
    } else {
      const tape = el("div", "scytale-tape");
      tape.dataset.scytalePart = "tape";
      for (const cell of cells) {
        const box = el("span", "scytale-cell", show(cell.value));
        if (cursor >= 2 && onFace.has(cell.index)) box.dataset.front = "true";
        tape.append(box);
      }
      scene.append(el("h3", "", "La languette déroulée · ce que voit l’intercepteur"), tape);
    }
    if (cursor >= 2) {
      scene.append(el("h3", "", "Bâton du destinataire · " + n + " faces, la languette fait " + front.length + " tours"), stick(front, n));
    }
    if (cursor === lastStep) {
      const read = front.map(cell => cell.value).join("");
      const ok = read === characters(message.value).join("");
      const result = el("output", "scytale-result", read);
      result.setAttribute("aria-label", "Lecture sur la face avant");
      result.dataset.match = String(ok);
      const verdict = el("p", "will-verdict " + (ok ? "will-verdict-intact" : "will-verdict-altered"),
        ok ? "Le bâton correspond à la languette : le message se lit."
          : (n < k ? "Bâton trop fin" : "Bâton trop épais") + " pour cette languette : la face avant ne montre que du charabia.");
      scene.append(result, verdict);
    }
    scene.append(el("p", "example-stage-caption", "␠ représente un espace. En surbrillance sur la languette : les cases qui tombent sur la face avant du bâton."));
    controls.update();
  }

  function recompute(): void {
    controls.pause();
    if (characters(message.value).length > MAX_MESSAGE_LENGTH) {
      invalid = true;
      error.textContent = "Le message peut contenir jusqu’à 80 caractères.";
      message.setAttribute("aria-invalid", "true");
      controls.update();
      return;
    }
    invalid = false;
    error.textContent = "";
    message.removeAttribute("aria-invalid");
    cells = strip(message.value, Number(spacing.value));
    render();
  }

  message.addEventListener("input", () => { cursor = 0; recompute(); }, { signal });
  spacing.addEventListener("input", recompute, { signal });
  faces.addEventListener("input", () => { controls.pause(); render(); }, { signal });
  page.append(settings, scene, clock, controls.element, article("scytale", "Comprendre la scytale", [
    ["Une languette et un bâton", "La photographie du cours montre une languette de cuir enroulée autour d’un bâton. Le message est écrit le long du bâton, sur une seule face : une lettre par tour de languette. Une fois déroulée, la languette montre ces lettres séparées par celles des autres faces, ici des lettres de remplissage."],
    ["Deux réglages qui doivent correspondre", "Sur la languette, les lettres du message sont espacées d’un nombre fixe de cases. Autour du bâton, la languette revient sur la même face après autant de cases que le bâton a de faces : trois pour une section en triangle, quatre pour un carré. Le message ne réapparaît que si ces deux nombres sont égaux. Un bâton trop fin ou trop épais mélange les lettres du message et le remplissage."],
    ["Une transposition", "Les lettres du message ne sont pas remplacées par d’autres : elles changent seulement de place sur la languette. C’est une transposition. Le secret partagé entre l’expéditeur et le destinataire est la forme du bâton."],
    ["Plusieurs messages par bâton", "Chaque face du bâton peut porter son propre message. Les lettres de remplissage de cet exemple pourraient donc être remplacées par d’autres messages, chacun lisible sur sa face."],
    ["Une illustration historique", "Le cours présente la scytale parmi les exemples historiques de cryptographie. Quelqu’un qui possède la languette peut essayer tous les bâtons jusqu’à trouver le bon : ce procédé ne protège pas les communications actuelles."],
  ], "Le dessin plat du bâton, ses faces et les lettres de remplissage sont notre transposition pédagogique de la photographie du cours. Le modèle conserve les caractères, les accents et les espaces. Tout le calcul est effectué dans le navigateur.", "Chapitre 1 · Exemples historiques et scytale · diapositives 35–36, p. 64–65 du PDF"));
  render();
  return page;
}
