import { characters, decode, encode, DEFAULT_MESSAGE, DEFAULT_ROWS, MAX_MESSAGE_LENGTH, type Cell } from "./scytale.ts";
import { createPlayback } from "./example-playback.ts";
import { article, stepCounter } from "./example-ui.ts";
import { el } from "./review-view.ts";

export function createScytaleView(signal: AbortSignal, title: string): HTMLElement {
  let encoded = encode(DEFAULT_MESSAGE, DEFAULT_ROWS);
  let readingRows = DEFAULT_ROWS;
  let cursor = 0;
  let selected: number | null = null;
  let invalid = false;
  const lastStep = 4;
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
  const selects = ["Gabarit d’écriture", "Gabarit de lecture"].map((title, index) => {
    const group = el("div", "scytale-setting");
    const label = el("label", "", title);
    const select = el("select");
    select.id = "scytale-" + (index ? "reading" : "writing");
    label.htmlFor = select.id;
    for (let n = 2; n <= 8; n++) {
      const option = el("option", "", n + " caractères par tour");
      option.value = String(n);
      select.append(option);
    }
    select.value = String(DEFAULT_ROWS);
    group.append(label, select);
    settings.append(group);
    return select;
  });
  const writing = selects[0]!;
  const reading = selects[1]!;
  const scene = el("div", "panel example-stage");
  const counter = stepCounter();
  const controls = createPlayback(signal, {
    prefix: "scytale",
    position: () => ({ first: cursor === 0, last: cursor === lastStep, disabled: invalid }),
    next: () => { cursor = Math.min(lastStep, cursor + 1); render(); },
    previous: () => { cursor = Math.max(0, cursor - 1); render(); },
    reset: () => {
      message.value = DEFAULT_MESSAGE;
      writing.value = reading.value = String(DEFAULT_ROWS);
      readingRows = DEFAULT_ROWS;
      recompute();
    },
  });
  const clock = el("div", "example-clock");
  clock.append(counter, controls.status);
  const titles = ["Le message à écrire", "La bande enroulée", "La bande déroulée", "Un gabarit pour relire", "Le message reconstitué"];

  function cell(value: Cell | null): HTMLElement {
    if (value === null || value.value === null) {
      const empty = el("span", "scytale-cell scytale-padding");
      empty.dataset.padding = value === null ? "empty" : "original";
      empty.setAttribute("role", "img");
      empty.setAttribute("aria-label", value === null ? "Emplacement vide" : "Case de remplissage");
      return empty;
    }
    const button = el("button", "scytale-cell", value.value === " " ? "␠" : value.value);
    button.type = "button";
    button.dataset.cellId = String(value.id);
    const label = value.value === " " ? "espace" : value.value;
    button.setAttribute("aria-label", "Caractère " + (value.id + 1) + " : " + label);
    button.title = "Caractère " + (value.id + 1) + " : " + label;
    button.setAttribute("aria-pressed", String(selected === value.id));
    return button;
  }

  function representation(title: string, part: string, rows: readonly (readonly (Cell | null)[])[], rod = false): HTMLElement {
    const section = el("section", "scytale-representation");
    section.dataset.scytalePart = part;
    section.append(el("h3", "", title));
    const scroll = el("div", "scytale-scroll" + (rod ? " scytale-rod" : ""));
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", "Représentation · " + title);
    const grid = el("div", "scytale-grid");
    for (const row of rows) {
      const line = el("div", "scytale-row");
      for (const item of row) line.append(cell(item));
      grid.append(line);
    }
    scroll.append(grid);
    section.append(scroll);
    return section;
  }

  function render(): void {
    counter.value = "Étape " + cursor + "/" + lastStep;
    scene.replaceChildren(el("h2", "", titles[cursor]));
    const original = encoded.grid.flat().filter((c): c is Cell => c !== null && c.value !== null);
    scene.append(representation("Message", "message", [original]));
    if (cursor >= 1) scene.append(representation("Sur le bâton · " + encoded.rows + " caractères par tour", "writing", encoded.grid, true));
    if (cursor >= 2) scene.append(representation("Bande déroulée", "tape", [encoded.tape]));
    if (cursor >= 3) {
      const decoded = decode(encoded.tape, readingRows);
      scene.append(representation("Relecture · " + readingRows + " caractères par tour", "reading", decoded.grid, true));
      if (cursor === 4) {
        const result = el("output", "scytale-result", decoded.message);
        result.setAttribute("aria-label", "Message reconstitué");
        scene.append(result);
      }
    }
    const legend = el("p", "example-stage-caption", "␠ représente un espace ; les cases hachurées sont du remplissage. Sélectionne un caractère pour le retrouver sur les différentes représentations.");
    scene.append(legend);
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
    encoded = encode(message.value, Number(writing.value));
    cursor = 0;
    selected = null;
    render();
  }

  message.addEventListener("input", recompute, { signal });
  writing.addEventListener("change", recompute, { signal });
  reading.addEventListener("change", () => {
    controls.pause();
    readingRows = Number(reading.value);
    render();
  }, { signal });
  scene.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-cell-id]") : null;
    if (!button) return;
    const part = button.closest<HTMLElement>("[data-scytale-part]")!.dataset.scytalePart;
    const id = Number(button.dataset.cellId);
    selected = selected === id ? null : id;
    render();
    scene.querySelector<HTMLButtonElement>('[data-scytale-part="' + part + '"] button[data-cell-id="' + id + '"]')?.focus({ preventScroll: true });
  }, { signal });
  page.append(settings, scene, clock, controls.element, article("scytale", "Comprendre la scytale", [
    ["Écrire sur une bande enroulée", "La photographie du cours montre une bande enroulée autour d’un bâton. Le message est écrit le long du bâton, sur plusieurs tours de bande. Lorsque la bande est retirée, les lettres se suivent dans un ordre différent de celui dans lequel le message se lit sur le bâton."],
    ["Dérouler change l’ordre, pas les lettres", "Dans notre représentation 2D, les lettres du message remplissent les lignes. Dérouler la bande revient à parcourir les colonnes, de haut en bas puis de gauche à droite. Avec ABCDEF sur deux lignes, la première contient ABC et la seconde DEF : la bande porte alors ADBECF. Il s’agit d’une transposition, pas d’un remplacement des lettres par d’autres lettres."],
    ["Retrouver le bon agencement", "Pour relire, on répartit la bande selon un gabarit de lecture, puis on lit les lignes. Avec le même gabarit qu’à l’écriture, chaque caractère retrouve sa place et le message initial réapparaît. Un autre gabarit donne généralement un autre ordre ; il ne garantit pas que tout message devient illisible. Un texte très court ou répétitif peut donner un résultat identique."],
    ["Ce que représente le gabarit", "Le réglage indique un nombre de caractères par tour. C’est une convention discrète pour rendre manipulable l’agencement autour du bâton ; ce n’est pas un diamètre mesuré en centimètres. Les cases de remplissage complètent le rectangle sans ajouter de lettres au message. Les vrais espaces restent des caractères du message."],
    ["Une illustration historique", "Le cours présente la scytale parmi les exemples historiques de cryptographie. L’exemple aide à comprendre comment l’organisation d’un support transforme l’ordre de lecture. Il ne présente pas ce procédé ancien comme une protection adaptée aux communications actuelles."],
  ], "Le dessin et l’ordre de parcours sont notre transposition pédagogique de la photographie du cours. Le modèle conserve les caractères, les accents et les espaces, sans normalisation cachée. Tout le calcul est effectué dans le navigateur.", "Chapitre 1 · Exemples historiques et scytale · diapositives 35–36, p. 64–65 du PDF"));
  render();
  return page;
}
