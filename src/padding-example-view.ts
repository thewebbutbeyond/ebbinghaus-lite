import { BLOCK_SIZE, encode, PADDING_MESSAGE, PADDING_STEPS, toBlocks, unpad, type Block } from "./padding-example.ts";
import { createPlayback } from "./example-playback.ts";
import { article, CHAPTER_TWO_SOURCE, stepCounter } from "./example-ui.ts";
import { el } from "./review-view.ts";

const hex = (byte: number): string => byte.toString(16).padStart(2, "0");
const glyph = (byte: number): string => byte === 32 ? "␣" : byte > 32 && byte < 127 ? String.fromCharCode(byte) : hex(byte);

function blockGrid(blocks: readonly Block[], size: number): HTMLElement {
  const grid = el("div", "padding-blocks");
  blocks.forEach((block, index) => {
    const card = el("section", "padding-block" + (block.bytes.length < size ? " padding-block-short" : ""));
    card.dataset.block = String(index + 1);
    card.dataset.blockPadding = String(block.padding);
    const cells = el("div", "padding-bytes");
    block.bytes.forEach((byte, position) => {
      const isPad = position >= block.bytes.length - block.padding;
      cells.append(el("span", "padding-byte" + (isPad ? " padding-pad" : ""), isPad ? hex(byte) : glyph(byte)));
    });
    for (let n = block.bytes.length; n < size; n++) cells.append(el("span", "padding-byte padding-empty", "·"));
    const note = block.bytes.length < size ? " · " + block.bytes.length + "/" + size + " octets" : block.padding > 0 ? " · " + block.padding + " octets de bourrage" : "";
    card.append(el("h3", "", "Bloc " + (index + 1) + note), cells);
    grid.append(card);
  });
  return grid;
}

export function createPaddingView(signal: AbortSignal, title: string): HTMLElement {
  let cursor = 0;
  const message = encode(PADDING_MESSAGE);
  const raw = toBlocks(message, BLOCK_SIZE, false);
  const padded = toBlocks(message);
  const count = padded.at(-1)!.padding;
  const recovered = unpad(Uint8Array.from(padded.flatMap(block => block.bytes)));
  const page = el("section", "portal-page example-view padding-view");
  page.append(el("h1", "", title));
  const scene = el("div", "panel example-stage");
  const counter = stepCounter();
  const controls = createPlayback(signal, {
    prefix: "padding",
    position: () => ({ first: cursor === 0, last: cursor === PADDING_STEPS, disabled: false }),
    next: () => { cursor = Math.min(PADDING_STEPS, cursor + 1); render(); },
    previous: () => { cursor = Math.max(0, cursor - 1); render(); },
    reset: () => { cursor = 0; render(); },
  });
  const clock = el("div", "example-clock");
  clock.append(counter, controls.status);
  const titles = ["Le message d’entrée", "Le message est découpé en blocs de " + BLOCK_SIZE + " octets",
    "Le dernier bloc est complété par du bourrage", "À l’arrivée, le bourrage est retiré"];

  function render(): void {
    counter.value = "Étape " + cursor + "/" + PADDING_STEPS;
    scene.replaceChildren(el("h2", "", titles[cursor]));
    if (cursor === 0) scene.append(el("blockquote", "will-text", PADDING_MESSAGE),
      el("p", "example-stage-caption", message.length + " octets. L’algorithme ne traite que " + BLOCK_SIZE + " octets à la fois : il faut diviser pour régner."));
    if (cursor === 1) scene.append(blockGrid(raw, BLOCK_SIZE),
      el("p", "example-stage-caption", (raw.length - 1) + " blocs pleins. Il reste " + raw.at(-1)!.bytes.length + " octets : le bloc " + raw.length + " est incomplet."));
    if (cursor === 2) scene.append(blockGrid(padded, BLOCK_SIZE),
      el("p", "example-stage-caption", count + " octets de bourrage, chacun de valeur " + count + " (" + hex(count) + " en hexadécimal). Les " + padded.length + " blocs font maintenant exactement " + BLOCK_SIZE + " octets."));
    if (cursor === 3) {
      const same = recovered !== null && new TextDecoder().decode(recovered) === PADDING_MESSAGE;
      const verdict = el("p", "will-verdict will-verdict-" + (same ? "intact" : "altered"), same ? "Message retrouvé : identique à l’original" : "Bourrage invalide");
      verdict.dataset.paddingRecovered = String(same);
      scene.append(blockGrid(padded.slice(-1), BLOCK_SIZE),
        el("p", "example-stage-caption", "Le récepteur lit le dernier octet : " + hex(count) + ", soit " + count + ". Il retire les " + count + " derniers octets et retrouve les " + message.length + " octets du message."),
        verdict);
    }
    controls.update();
  }

  const lab = el("section", "panel will-lab");
  lab.setAttribute("aria-labelledby", "padding-lab-title");
  const labTitle = el("h2", "", "À vous : découpez votre message");
  labTitle.id = "padding-lab-title";
  const input = el("textarea", "will-input");
  input.id = "padding-input";
  input.rows = 3;
  input.value = "Bonjour Bob";
  const label = el("label", "", "Message à découper");
  label.htmlFor = input.id;
  const select = el("select", "will-input");
  select.id = "padding-size";
  for (const size of [8, 16, 32]) {
    const option = el("option", "", size + " octets");
    option.value = String(size);
    option.selected = size === BLOCK_SIZE;
    select.append(option);
  }
  const sizeLabel = el("label", "", "Taille de bloc");
  sizeLabel.htmlFor = select.id;
  const summary = el("p", "will-verdict");
  summary.setAttribute("role", "status");
  const output = el("div");
  lab.append(labTitle, el("p", "example-stage-caption", "Essayez un message de 15, 16 puis 17 lettres, ou ajoutez un « é »."), label, input, sizeLabel, select, summary, output);
  function update(): void {
    const size = Number(select.value);
    const bytes = encode(input.value);
    const blocks = toBlocks(bytes, size);
    const extra = blocks.at(-1)!.padding;
    summary.dataset.paddingBlocks = String(blocks.length);
    summary.dataset.paddingBytes = String(extra);
    summary.textContent = bytes.length + " octets → " + blocks.length + " bloc" + (blocks.length > 1 ? "s" : "") + " de " + size + " octets, dont " + extra + " octets de bourrage"
      + (extra === size ? " : le message tombait juste, un bloc entier de bourrage est ajouté." : ".");
    output.replaceChildren(blockGrid(blocks, size));
  }
  input.addEventListener("input", update, { signal });
  select.addEventListener("change", update, { signal });

  page.append(scene, clock, controls.element, lab, article("padding", "Comprendre les blocs et le bourrage", [
    ["Pourquoi découper", "Aucun algorithme ne peut traiter d’un coup une entrée arbitrairement longue : elle ne tiendrait pas en mémoire sécurisée, et beaucoup d’algorithmes ont une entrée de taille fixe. Les fonctions de hachage et les chiffrements par bloc découpent donc le message en blocs de même taille, ici 16 octets comme pour AES."],
    ["Pourquoi bourrer", "Le dernier bloc est rarement plein. Le bourrage le complète pour que chaque bloc ait exactement la taille attendue par l’algorithme."],
    ["Comment retirer le bourrage", "Cet exemple utilise le bourrage PKCS#7 : il manque n octets, on ajoute n octets valant chacun n. À l’arrivée, on lit le dernier octet et on retire autant d’octets. Quand le message remplit exactement le dernier bloc, on ajoute un bloc entier de bourrage : le dernier octet indique ainsi toujours la longueur du bourrage, même si le message lui-même se termine par 01."],
    ["Des octets, pas des lettres", "Les blocs comptent des octets. En UTF-8, « à » ou « é » occupent deux octets ; ils apparaissent ici en hexadécimal, comme les octets de bourrage. Une espace est notée ␣."],
  ], "Données fictives. PKCS#7 est un schéma de bourrage parmi d’autres ; les fonctions de hachage comme SHA-256 ajoutent aussi la longueur du message dans leur bourrage. Tout est calculé dans votre navigateur.", "Chapitre 2 · Blocs et bourrage · p. 9 à 17 du PDF", CHAPTER_TWO_SOURCE));

  render();
  update();
  return page;
}
