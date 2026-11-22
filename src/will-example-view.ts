import { compareHashes, sha256Hex, willScenario, WILL_STEPS, WILL_TEXT, type WillState } from "./will-example.ts";
import { createPlayback } from "./example-playback.ts";
import { actor, article, CHAPTER_TWO_SOURCE, exchange, stepCounter } from "./example-ui.ts";
import { el } from "./review-view.ts";

const short = (hash: string | null): string | null => hash === null ? null : hash.slice(0, 16) + "…";
const verdictText = (verdict: "intact" | "altered" | null): string =>
  verdict === "intact" ? "Empreintes identiques : testament intact" : verdict === "altered" ? "Empreintes différentes : testament modifié" : "En attente";

function hashLine(label: string, hash: string | null): HTMLElement {
  const row = el("div", "will-hash");
  row.append(el("span", "", label), el("code", "", hash ?? "Aucune"));
  return row;
}

export function createWillView(signal: AbortSignal, title: string): HTMLElement {
  let history: readonly WillState[] | null = null;
  let cursor = 0;
  const page = el("section", "portal-page example-view will-view");
  page.append(el("h1", "", title));
  const scene = el("div", "panel example-stage");
  const counter = stepCounter();
  const controls = createPlayback(signal, {
    prefix: "will",
    position: () => ({ first: cursor === 0, last: cursor === WILL_STEPS, disabled: history === null }),
    next: () => { cursor = Math.min(WILL_STEPS, cursor + 1); render(); },
    previous: () => { cursor = Math.max(0, cursor - 1); render(); },
    reset: () => { cursor = 0; render(); },
  });
  const clock = el("div", "example-clock");
  clock.append(counter, controls.status);
  const titles = ["Avant le dépôt", "Le père rédige son testament", "Le père calcule l’empreinte du testament",
    "Le testament et son empreinte sont confiés à deux notaires", "George modifie le testament chez le notaire A",
    "À la lecture, le testament est haché à nouveau", "Les deux empreintes sont comparées"];

  function render(): void {
    counter.value = "Étape " + cursor + "/" + WILL_STEPS;
    if (history === null) { scene.replaceChildren(el("p", "example-stage-caption", "Calcul des empreintes…")); controls.update(); return; }
    const state = history[cursor]!;
    scene.replaceChildren(el("h2", "", titles[cursor]));
    if (cursor === 0) scene.append(el("p", "example-stage-caption", "Rien n’a encore été écrit ni déposé."));
    if (cursor === 1) scene.append(el("blockquote", "will-text", state.draft!));
    if (cursor === 2) scene.append(exchange("Testament", "SHA-256", "Empreinte : " + short(state.fatherHash)));
    if (cursor === 3) scene.append(exchange("Père", "Notaire A", "Le testament complet"), exchange("Père", "Notaire B", "Seulement l’empreinte : " + short(state.notaryB)));
    if (cursor === 4) scene.append(exchange("George", "Notaire A", "« ne recevra rien » → « recevra tout »", true), el("blockquote", "will-text", state.notaryA!));
    if (cursor === 5) scene.append(exchange("Notaire A", "SHA-256", "Empreinte du testament lu : " + short(state.readingHash)));
    if (cursor === 6) {
      const comparison = el("div", "will-comparison");
      comparison.append(hashLine("Gardée par le notaire B", state.notaryB), hashLine("Calculée à la lecture", state.readingHash));
      const verdict = el("p", "will-verdict will-verdict-" + state.verdict, verdictText(state.verdict));
      verdict.dataset.willVerdict = state.verdict ?? "";
      scene.append(comparison, verdict, el("p", "example-stage-caption", "Le texte n’a changé que de quelques mots, mais toute l’empreinte est différente : la falsification est détectée."));
    }
    const actors = el("div", "example-actors will-actors");
    actors.append(
      actor("father", "Père", "person", [["Testament rédigé", state.draft === null ? null : "Oui"], ["Empreinte calculée", short(state.fatherHash)]]),
      actor("notary-a", "Notaire A", "person", [["Testament gardé", state.notaryA === null ? null : state.notaryA === WILL_TEXT.original ? "Original" : "Modifié"]], cursor === 4),
      actor("notary-b", "Notaire B", "person", [["Empreinte gardée", short(state.notaryB)], ["Texte du testament", null]]),
      actor("george", "George", "person", [["A modifié le testament", cursor >= 4 ? "Oui" : null]], cursor === 4),
    );
    scene.append(actors);
    controls.update();
  }

  const lab = el("section", "panel will-lab");
  lab.setAttribute("aria-labelledby", "will-lab-title");
  const labTitle = el("h2", "", "À vous : modifiez le testament");
  labTitle.id = "will-lab-title";
  const input = el("textarea", "will-input");
  input.id = "will-input";
  input.rows = 3;
  input.value = WILL_TEXT.altered;
  const label = el("label", "", "Testament présenté à la lecture");
  label.htmlFor = input.id;
  const kept = hashLine("Empreinte gardée par le notaire B", null);
  const live = hashLine("Empreinte du texte ci-dessus", null);
  const liveVerdict = el("p", "will-verdict", "En attente");
  liveVerdict.setAttribute("role", "status");
  liveVerdict.dataset.willLive = "";
  lab.append(labTitle, el("p", "example-stage-caption", "Changez une lettre, un espace ou un mot, puis revenez au texte original."), label, input, kept, live, liveVerdict);
  let request = 0;
  let original: string | null = null;
  async function check(): Promise<void> {
    const ticket = ++request;
    const hash = await sha256Hex(input.value);
    if (ticket !== request || signal.aborted) return;
    live.querySelector("code")!.textContent = hash;
    const verdict = compareHashes(hash, original);
    liveVerdict.className = "will-verdict will-verdict-" + verdict;
    liveVerdict.textContent = verdictText(verdict);
    liveVerdict.dataset.willLive = verdict ?? "";
  }
  input.addEventListener("input", () => { void check(); }, { signal });

  page.append(scene, clock, controls.element, lab, article("will", "Comprendre l’empreinte du testament", [
    ["Ce que garde chaque notaire", "Le notaire A conserve le testament complet. Le notaire B ne reçoit que son empreinte SHA-256 : 64 chiffres hexadécimaux, soit 256 bits, quelle que soit la longueur du texte."],
    ["Pourquoi la modification se voit", "Une fonction de hachage est déterministe : le même texte donne toujours la même empreinte. À la lecture, on hache le testament présenté et on compare avec l’empreinte du notaire B. Changer quelques mots suffit à produire une empreinte entièrement différente."],
    ["Pourquoi le notaire B ne peut pas lire le testament", "Le hachage est une fonction à sens unique. L’empreinte permet de vérifier un texte qu’on lui présente, mais retrouver le texte à partir de l’empreinte seule est irréalisable en pratique. Le notaire B peut donc garder l’empreinte sans connaître le contenu du testament."],
    ["Pourquoi deux notaires", "La vérification fonctionne parce que George a accès au testament chez le notaire A, mais pas à l’empreinte gardée par le notaire B. Pour réussir sa fraude, il devrait corrompre les deux."],
  ], "Données fictives. Les empreintes sont calculées dans votre navigateur avec SHA-256 ; aucun texte n’est envoyé.", "Chapitre 2 · Testament du milliardaire · p. 5 du PDF", CHAPTER_TWO_SOURCE));

  render();
  void willScenario().then(states => {
    if (signal.aborted) return;
    history = states;
    original = states[WILL_STEPS]!.notaryB;
    kept.querySelector("code")!.textContent = original;
    render();
    void check();
  });
  return page;
}
