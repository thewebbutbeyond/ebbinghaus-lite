import { decrypt, encrypt, EVE_GUESS, SHARED_KEY_MESSAGE, SHARED_KEY_STEPS, SHARED_SECRET, toHex } from "./shared-key-example.ts";
import { createPlayback } from "./example-playback.ts";
import { article, CHAPTER_TWO_SOURCE, stepCounter } from "./example-ui.ts";
import { el } from "./review-view.ts";

function party(name: string, actor: string, key: string | null, ...extra: HTMLElement[]): HTMLElement {
  const card = el("section", "key-party");
  card.dataset.actor = actor;
  card.append(el("h3", "", name), el("span", "key-chip" + (key ? "" : " key-chip-none"), key ? "🔑 " + key : "aucune clé"), ...extra);
  return card;
}

export function createSharedKeyView(signal: AbortSignal, title: string): HTMLElement {
  let cursor = 0;
  let cipher: Uint8Array<ArrayBuffer> = new Uint8Array();
  let bob: string | null = null;
  let eve: string | null = null;
  const page = el("section", "portal-page example-view shared-key-view");
  page.append(el("h1", "", title));
  const scene = el("div", "panel example-stage");
  const counter = stepCounter();
  const controls = createPlayback(signal, {
    prefix: "shared-key",
    position: () => ({ first: cursor === 0, last: cursor === SHARED_KEY_STEPS, disabled: false }),
    next: () => { cursor = Math.min(SHARED_KEY_STEPS, cursor + 1); render(); },
    previous: () => { cursor = Math.max(0, cursor - 1); render(); },
    reset: () => { cursor = 0; render(); },
  });
  const clock = el("div", "example-clock");
  clock.append(counter, controls.status);
  const titles = ["Alice et Bob partagent une clé secrète", "Alice chiffre son message avec la clé",
    "Le texte chiffré traverse le réseau : l’intercepteur le voit", "L’intercepteur essaie de déchiffrer sans la clé",
    "Bob déchiffre avec la même clé"];
  const cipherBox = (): HTMLElement => { const box = el("p", "cipher-text", toHex(cipher)); box.dataset.cipher = ""; return box; };

  function render(): void {
    counter.value = "Étape " + cursor + "/" + SHARED_KEY_STEPS;
    scene.replaceChildren(el("h2", "", titles[cursor]));
    const parties = el("div", "key-parties");
    const eveCard = party("Intercepteur", "eve", null);
    parties.append(party("Alice", "alice", SHARED_SECRET), eveCard, party("Bob", "bob", SHARED_SECRET));
    scene.append(parties);
    if (cursor === 0) scene.append(el("p", "example-stage-caption", "La clé a été convenue à l’avance, par un canal sûr. C’est la même clé des deux côtés : le chiffrement est symétrique."));
    if (cursor >= 1) scene.append(el("blockquote", "will-text", SHARED_KEY_MESSAGE), el("p", "example-stage-caption", "Message clair + clé → AES-GCM →"), cipherBox());
    if (cursor === 1) scene.append(el("p", "example-stage-caption", cipher.length + " octets chiffrés, dont 16 octets d’étiquette d’authentification."));
    if (cursor === 2) {
      eveCard.dataset.eveSees = "cipher";
      eveCard.append(el("p", "example-stage-caption", "Il ne voit que des octets illisibles."));
      scene.append(el("p", "example-stage-caption", "Le réseau n’est pas sûr : tout ce qui y passe peut être copié. Seul le texte chiffré y circule, jamais la clé."));
    }
    if (cursor === 3) {
      const verdict = el("p", "will-verdict will-verdict-altered", "Clé « " + EVE_GUESS + " » : déchiffrement refusé");
      verdict.dataset.eveResult = eve === null ? "failed" : "read";
      scene.append(verdict, el("p", "example-stage-caption", "Sans la bonne clé, AES-GCM refuse de rendre quoi que ce soit."));
    }
    if (cursor === 4) {
      const same = bob === SHARED_KEY_MESSAGE;
      const verdict = el("p", "will-verdict will-verdict-" + (same ? "intact" : "altered"), same ? "Message retrouvé : " + bob : "Échec du déchiffrement");
      verdict.dataset.bobRecovered = String(same);
      scene.append(verdict);
    }
    controls.update();
  }

  const lab = el("section", "panel will-lab");
  lab.setAttribute("aria-labelledby", "shared-key-lab-title");
  const labTitle = el("h2", "", "À vous : chiffrez, puis essayez une clé");
  labTitle.id = "shared-key-lab-title";
  const input = el("textarea", "will-input");
  input.id = "shared-key-input";
  input.rows = 3;
  input.value = "Bonjour Bob";
  const label = el("label", "", "Message d’Alice");
  label.htmlFor = input.id;
  const guess = el("input", "will-input");
  guess.id = "shared-key-guess";
  guess.value = EVE_GUESS;
  const guessLabel = el("label", "", "Clé essayée pour déchiffrer");
  guessLabel.htmlFor = guess.id;
  const output = el("p", "cipher-text");
  const result = el("p", "will-verdict");
  result.setAttribute("role", "status");
  lab.append(labTitle, el("p", "example-stage-caption", "Alice chiffre avec la clé « " + SHARED_SECRET + " ». Essayez d’autres clés, puis la bonne."), label, input, output, guessLabel, guess, result);
  let run = 0;
  async function update(): Promise<void> {
    const id = ++run;
    const data = await encrypt(SHARED_SECRET, input.value);
    const plain = await decrypt(guess.value, data);
    if (id !== run) return;
    output.textContent = toHex(data);
    output.dataset.cipherLength = String(data.length);
    result.dataset.labDecrypted = String(plain !== null);
    result.className = "will-verdict will-verdict-" + (plain !== null ? "intact" : "altered");
    result.textContent = plain !== null ? "Bonne clé : « " + plain + " »" : "Mauvaise clé : déchiffrement refusé";
  }
  input.addEventListener("input", () => void update(), { signal });
  guess.addEventListener("input", () => void update(), { signal });

  page.append(scene, clock, controls.element, lab, article("shared-key", "Comprendre la clé symétrique partagée", [
    ["Une seule clé, deux personnes", "En chiffrement symétrique, la même clé sert à chiffrer et à déchiffrer. Alice et Bob doivent donc la posséder tous les deux, et personne d’autre."],
    ["Ce que voit l’intercepteur", "Sur le réseau ne circule que le texte chiffré. Sans la clé, il est illisible : la confidentialité repose entièrement sur le secret de la clé, pas sur celui de l’algorithme."],
    ["Le vrai problème : partager la clé", "Il faut convenir de la clé avant de communiquer, par un canal sûr. Avec beaucoup de correspondants, il faut une clé par paire. C’est ce problème que résout la cryptographie asymétrique."],
  ], "Données fictives. La clé est dérivée du mot secret par SHA-256 et le message chiffré par AES-GCM, dans votre navigateur. Le nonce est fixe pour que l’exemple soit reproductible ; un vrai système en tire un nouveau à chaque message.", "Chapitre 2 · Clé symétrique partagée · p. 6 et 48 à 49 du PDF", CHAPTER_TWO_SOURCE));

  void (async () => {
    cipher = await encrypt(SHARED_SECRET, SHARED_KEY_MESSAGE);
    bob = await decrypt(SHARED_SECRET, cipher);
    eve = await decrypt(EVE_GUESS, cipher);
    render();
  })();
  render();
  void update();
  return page;
}
