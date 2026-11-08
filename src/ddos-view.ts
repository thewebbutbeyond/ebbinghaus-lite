import { advance, configure, createTimeline, current, MAX_TIME, previous, type Settings, type Tally } from "./ddos.ts";
import { renderDdosScene } from "./ddos-scene.ts";
import { icon } from "./icons.ts";
import { action, el } from "./review-view.ts";
import "./ddos.css";

export function createDdosView(signal: AbortSignal): HTMLElement {
  let timeline = createTimeline();
  let timer: ReturnType<typeof setInterval> | undefined;
  const page = el("section", "portal-page ddos-view");
  page.append(el("h1", "", "DDoS"), el("p", "ddos-intro",
    "Une attaque peut saturer le serveur et retarder les requêtes normales."));

  const stage = el("div", "panel ddos-stage");
  const scene = el("div", "ddos-scene-container");
  const legend = el("div", "ddos-legend");
  legend.append(el("span", "ddos-normal-key", "Trafic normal"), el("span", "ddos-attack-key", "Trafic d'attaque"));
  stage.append(scene, legend);

  const transport = el("div", "ddos-toolbar");
  const playback = el("div", "ddos-playback");
  playback.setAttribute("role", "group");
  playback.setAttribute("aria-label", "Lecture de l'exemple");
  const play = action("Lire", "ddos-play", "button-primary", "play");
  const back = action("Précédent", "ddos-previous", "button-outline", "arrowLeft");
  const forward = action("Suivant", "ddos-next");
  forward.append(icon("arrowRight"));
  const reset = action("Recommencer", "ddos-reset", "button-outline", "stop");
  const attack = action("Lancer l'attaque", "ddos-attack", "button-outline ddos-attack-action", "swords");
  playback.append(back, play, forward, reset);
  transport.append(playback, attack);

  const clock = el("div", "ddos-clock");
  const time = el("output");
  time.dataset.ddosTime = "";
  time.setAttribute("aria-label", "Temps simulé");
  time.setAttribute("aria-live", "off");
  const status = el("span", "ddos-status");
  status.setAttribute("role", "status");
  clock.append(el("span", "", "Temps simulé : "), time, status);

  const settings = el("div", "panel ddos-settings");
  const inputs = new Map<keyof Omit<Settings, "attack">, { input: HTMLInputElement; output: HTMLOutputElement }>();
  for (const [key, label, min, max, unit] of [
    ["bots", "Machines compromises", 0, 12, ""],
    ["rate", "Débit par machine", 1, 8, " req/s"],
    ["capacity", "Capacité du serveur", 1, 32, " req/s"],
  ] as const) {
    const group = el("div", "ddos-setting");
    const top = el("div", "ddos-setting-label");
    const text = el("label", "", label);
    const input = el("input");
    input.id = "ddos-" + key;
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    text.htmlFor = input.id;
    const output = el("output");
    output.setAttribute("for", input.id);
    output.dataset.unit = unit;
    output.setAttribute("aria-live", "off");
    top.append(text, output);
    group.append(top, input);
    settings.append(group);
    inputs.set(key, { input, output });
    input.addEventListener("input", () => {
      pause();
      timeline = configure(timeline, { [key]: input.valueAsNumber });
      render();
    }, { signal });
  }
  const pending = el("p", "ddos-pending", "Réglages appliqués au prochain pas.");
  pending.setAttribute("role", "status");

  const table = el("table", "ddos-metrics");
  table.append(el("caption", "", "Dernière seconde"));
  const head = el("thead");
  const header = el("tr");
  for (const title of ["Requêtes", "Normales", "Attaque", "Total"]) {
    const cell = el("th", "", title);
    cell.scope = "col";
    header.append(cell);
  }
  head.append(header);
  const body = el("tbody");
  const cells = new Map<string, HTMLTableCellElement[]>();
  for (const [metric, title] of [["arrived", "Arrivées"], ["processed", "Traitées"],
    ["queue", "En attente"], ["dropped", "Rejetées"]] as const) {
    const row = el("tr");
    row.dataset.metric = metric;
    const heading = el("th", "", title);
    heading.scope = "row";
    row.append(heading);
    const values = ["normal", "attack", "total"].map(kind => {
      const cell = el("td");
      cell.dataset.kind = kind;
      row.append(cell);
      return cell;
    });
    cells.set(metric, values);
    body.append(row);
  }
  table.append(head, body);

  const article = el("article", "ddos-article");
  article.setAttribute("aria-labelledby", "ddos-explanation-title");
  const title = el("h2", "", "Comprendre l'attaque DDoS");
  title.id = "ddos-explanation-title";
  article.append(title, el("p", "",
    "Un déni de service distribué (DDoS) vise la disponibilité : le service " +
    "peut devenir lent ou inaccessible pour ses utilisateurs."));
  for (const [heading, text] of [
    ["Quand le serveur suit le rythme",
      "Avec les réglages initiaux, les clients envoient 4 requêtes par seconde. " +
      "Le serveur peut en traiter 8 : il absorbe ce trafic sans accumuler d'attente."],
    ["Des machines compromises multiplient le trafic",
      "L'attaquant commande plusieurs machines compromises. Elles envoient des " +
      "requêtes vers le même serveur : l'attaque est distribuée. Ici, 6 machines " +
      "à 2 requêtes par seconde ajoutent 12 requêtes au trafic normal."],
    ["La disponibilité se dégrade",
      "Le serveur reçoit alors 16 requêtes par seconde pour une capacité de 8. " +
      "Au premier pas d'attaque, 8 requêtes restent en attente. Si ce rythme " +
      "continue, la file grossit et les requêtes normales attendent aussi. " +
      "Le problème porte sur l'accès au service, sans qu'il soit nécessaire " +
      "de lire ou de modifier les données."],
    ["L'arrêt de l'attaque ne vide pas la file",
      "Les requêtes déjà reçues restent à traiter. Avec 8 requêtes en attente, " +
      "4 nouvelles requêtes normales et une capacité de 8, il en reste 4 après " +
      "une seconde, puis aucune à la suivante. Le serveur retrouve un rythme " +
      "qu'il peut soutenir."],
  ] as const) {
    const section = el("section");
    section.append(el("h3", "", heading), el("p", "", text));
    if (heading === "Des machines compromises multiplient le trafic") {
      section.append(el("p", "ddos-equation", "4 + 6 × 2 = 16 requêtes/s"));
    }
    article.append(section);
  }
  article.append(el("p", "ddos-assumptions",
    "Pour un réglage donné, la capacité est fixe et les requêtes sont traitées " +
    "dans l'ordre d'arrivée. La file est limitée à 200 requêtes ; les suivantes " +
    "sont rejetées. Les couleurs distinguent les origines pour l'explication : " +
    "un serveur réel ne reconnaît pas automatiquement une attaque."));
  const reference = el("p", "ddos-reference");
  const source = el("a", "", "Chapitre 1 · Déni de service");
  source.href = "https://gitlab.com/computer-security3/sec1/-/blob/959f789db9fef7649b6b61cb8f812a2909091d41/Ch.%201%20-%20Introduction/slides.tex";
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  reference.append(source);
  article.append(reference);
  page.append(stage, clock, transport, settings, pending, table, article);

  function updateTransport(): void {
    const end = current(timeline).time >= MAX_TIME;
    const label = timer === undefined ? "Lire" : "Pause";
    if (play.querySelector(".action-label")!.textContent !== label) {
      play.querySelector(".action-label")!.textContent = label;
      play.querySelector("svg")!.replaceWith(icon(timer === undefined ? "play" : "pause"));
    }
    play.disabled = forward.disabled = end;
    attack.disabled = end;
    for (const { input } of inputs.values()) input.disabled = end;
    back.disabled = timeline.cursor === 0;
    const text = end ? "Terminé" : timer === undefined ? "En pause" : "Lecture";
    if (status.textContent !== text) status.textContent = text;
  }

  function pause(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    updateTransport();
  }

  function render(): void {
    const state = current(timeline);
    time.value = state.time + " s";
    scene.replaceChildren(renderDdosScene(state));
    for (const [key, { input, output }] of inputs) {
      input.value = String(timeline.settings[key]);
      output.value = input.value + output.dataset.unit;
      input.setAttribute("aria-valuetext", output.value);
    }
    attack.querySelector(".action-label")!.textContent = timeline.settings.attack ? "Arrêter l'attaque" : "Lancer l'attaque";
    attack.setAttribute("aria-pressed", String(timeline.settings.attack));
    pending.hidden = (Object.keys(timeline.settings) as (keyof Settings)[])
      .every(key => timeline.settings[key] === state.settings[key]);
    const queued: Tally = {
      normal: state.queue.filter(request => request.kind === "normal").length,
      attack: state.queue.filter(request => request.kind === "attack").length,
    };
    for (const [key, value] of [["arrived", state.arrived], ["processed", state.processed],
      ["queue", queued], ["dropped", state.dropped]] as const) {
      const targets = cells.get(key)!;
      [value.normal, value.attack, value.normal + value.attack].forEach((n, i) => {
        targets[i]!.textContent = String(n);
      });
    }
    updateTransport();
  }

  play.addEventListener("click", () => {
    if (timer !== undefined) pause();
    else if (!signal.aborted && !document.hidden && current(timeline).time < MAX_TIME) {
      timer = setInterval(() => {
        timeline = advance(timeline);
        if (current(timeline).time >= MAX_TIME) pause();
        render();
      }, 1000);
      updateTransport();
    }
  }, { signal });
  for (const [button, transition] of [[back, previous], [forward, advance]] as const) {
    button.addEventListener("click", () => {
      pause();
      timeline = transition(timeline);
      render();
    }, { signal });
  }
  reset.addEventListener("click", () => {
    pause();
    timeline = createTimeline();
    render();
  }, { signal });
  attack.addEventListener("click", () => {
    pause();
    timeline = configure(timeline, { attack: !timeline.settings.attack });
    render();
  }, { signal });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); }, { signal });
  signal.addEventListener("abort", pause, { once: true });
  render();
  return page;
}
