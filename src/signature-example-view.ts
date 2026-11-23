import { cipherDigest, digest, FORGED_MESSAGE, PRIVATE_KEY, PUBLIC_KEY, SIGNATURE_STEPS, SIGNED_MESSAGE, uncipherSignature } from "./signature-example.ts";
import { createPlayback } from "./example-playback.ts";
import { article, CHAPTER_TWO_SOURCE, exchange, stepCounter } from "./example-ui.ts";
import { el } from "./review-view.ts";

type Values = Readonly<{ hash: string; signature: string; forgedHash: string }>;
const short = (hex: string): string => hex.slice(0, 16) + "…";

function party(name: string, actor: string, ...keys: string[]): HTMLElement {
  const card = el("section", "key-party");
  card.dataset.actor = actor;
  card.append(el("h3", "", name), ...keys.map(key => el("span", "key-chip" + (key.startsWith("🔒") ? " key-chip-none" : ""), key)));
  return card;
}

function hashLine(label: string, hash: string): HTMLElement {
  const row = el("div", "will-hash");
  row.append(el("span", "", label), el("code", "", hash));
  return row;
}

function check(received: string | null, signature: string, computed: string): HTMLElement {
  const unciphered = uncipherSignature(signature);
  const valid = computed === unciphered;
  const box = el("div", "will-comparison");
  const verdict = el("p", "will-verdict will-verdict-" + (valid ? "intact" : "altered"), valid ? "Empreintes identiques : signature valide, le message vient bien d’Alice" : "Empreintes différentes : signature refusée");
  verdict.dataset.signatureValid = String(valid);
  if (received !== null) box.append(el("blockquote", "will-text", received));
  box.append(hashLine("Signature déchiffrée avec la clé publique d’Alice", unciphered), hashLine("SHA-256 du message reçu", computed), verdict);
  return box;
}

export function createSignatureView(signal: AbortSignal, title: string): HTMLElement {
  let values: Values | null = null;
  let cursor = 0;
  const page = el("section", "portal-page example-view signature-view");
  page.append(el("h1", "", title));
  const scene = el("div", "panel example-stage");
  const counter = stepCounter();
  const controls = createPlayback(signal, {
    prefix: "signature",
    position: () => ({ first: cursor === 0, last: cursor === SIGNATURE_STEPS, disabled: values === null }),
    next: () => { cursor = Math.min(SIGNATURE_STEPS, cursor + 1); render(); },
    previous: () => { cursor = Math.max(0, cursor - 1); render(); },
    reset: () => { cursor = 0; render(); },
  });
  const clock = el("div", "example-clock");
  clock.append(counter, controls.status);
  const titles = ["Les clés d’Alice", "Schéma simple : Alice signe son message", "Schéma détaillé : Alice hache d’abord son message",
    "Alice chiffre l’empreinte avec sa clé privée", "Le message et sa signature partent vers Bob", "Bob vérifie la signature",
    "L’intercepteur modifie le message en gardant la signature"];

  function render(): void {
    counter.value = "Étape " + cursor + "/" + SIGNATURE_STEPS;
    if (values === null) { scene.replaceChildren(el("p", "example-stage-caption", "Calcul de la signature…")); controls.update(); return; }
    const { hash, signature, forgedHash } = values;
    scene.replaceChildren(el("h2", "", titles[cursor]));
    const parties = el("div", "key-parties");
    parties.append(party("Alice", "alice", "🔑 privée : " + PRIVATE_KEY, "🔑 publique : " + PUBLIC_KEY),
      party("Bob", "bob", "🔑 publique d’Alice"), party("Intercepteur (attaquant)", "eve", "🔑 publique d’Alice", "🔒 pas de clé privée"));
    scene.append(parties);
    if (cursor === 0) scene.append(el("p", "example-stage-caption", "Alice garde sa clé privée pour elle. Sa clé publique est connue de tous, y compris de l’intercepteur : elle sert seulement à vérifier."));
    if (cursor === 1) scene.append(el("blockquote", "will-text", SIGNED_MESSAGE), exchange("Message + clé privée d’Alice", "Signer", "Signature numérique"), exchange("Bob", "Authentifier", "Signature + clé publique d’Alice"),
      el("p", "example-stage-caption", "Vu de loin, signer est une boîte noire. Les étapes suivantes l’ouvrent : un message peut être très long, alors qu’une signature doit rester courte et difficile à falsifier."));
    if (cursor === 2) scene.append(exchange("« " + SIGNED_MESSAGE + " »", "SHA-256", "Empreinte : " + short(hash)), hashLine("Empreinte du message (256 bits, quelle que soit sa longueur)", hash));
    if (cursor === 3) {
      const box = el("p", "cipher-text", signature);
      box.dataset.signature = "";
      scene.append(exchange("Empreinte", "Chiffrer avec la clé privée", "Signature : " + short(signature)), box,
        el("p", "example-stage-caption", "On chiffre l’empreinte, pas le message : une petite valeur de 256 bits, faisable avec la cryptographie à clé publique."));
    }
    if (cursor === 4) scene.append(exchange("Alice", "Bob", "« " + SIGNED_MESSAGE + " » + signature " + short(signature)),
      el("p", "example-stage-caption", "Le message n’est pas chiffré : tout le monde peut le lire. La signature ne cache rien, elle prouve l’origine et l’intégrité."));
    if (cursor === 5) scene.append(check(SIGNED_MESSAGE, signature, hash),
      el("p", "example-stage-caption", "Bob sait que le message n’a pas été modifié et qu’il a été signé avec la clé privée qui correspond à la clé publique d’Alice."));
    if (cursor === 6) scene.append(exchange("Intercepteur", "Bob", "Message modifié + signature d’Alice inchangée", true), check(FORGED_MESSAGE, signature, forgedHash),
      el("p", "example-stage-caption", "Pour fabriquer une signature qui corresponde au nouveau message, il faudrait la clé privée d’Alice. La clé publique et les signatures interceptées ne permettent pas de la retrouver."));
    controls.update();
  }

  const lab = el("section", "panel will-lab");
  lab.setAttribute("aria-labelledby", "signature-lab-title");
  const labTitle = el("h2", "", "À vous : modifiez le message reçu par Bob");
  labTitle.id = "signature-lab-title";
  const input = el("textarea", "will-input");
  input.id = "signature-input";
  input.rows = 2;
  input.value = SIGNED_MESSAGE;
  const label = el("label", "", "Message reçu par Bob (la signature reste celle d’Alice)");
  label.htmlFor = input.id;
  const result = el("div", "signature-lab-result");
  result.setAttribute("role", "status");
  lab.append(labTitle, el("p", "example-stage-caption", "Changez une lettre ou un espace, puis revenez à « " + SIGNED_MESSAGE + " »."), label, input, result);
  let request = 0;
  async function update(): Promise<void> {
    const ticket = ++request;
    const computed = await digest(input.value);
    if (ticket !== request || signal.aborted || values === null) return;
    result.replaceChildren(check(null, values.signature, computed));
  }
  input.addEventListener("input", () => void update(), { signal });

  page.append(scene, clock, controls.element, lab, article("signature", "Comprendre la signature numérique", [
    ["Ce qu’apporte une signature", "Quand une signature est valide, on sait deux choses : le message n’a pas été modifié, et il a été envoyé par le détenteur de la clé privée. C’est la non-répudiation : Alice ne peut pas nier l’avoir signé."],
    ["Deux clés différentes", "Alice signe avec sa clé privée, qu’elle seule possède. Tout le monde vérifie avec sa clé publique. Retrouver la clé privée à partir de la clé publique ou de signatures interceptées est irréalisable en pratique."],
    ["Pourquoi hacher d’abord", "Un message peut être arbitrairement long, mais la signature doit rester courte. On signe donc l’empreinte SHA-256 du message : 256 bits, une taille que le chiffrement à clé publique traite facilement. Changer un seul caractère change l’empreinte, donc la vérification échoue."],
    ["Avec OpenSSL", "Créer la paire de clés : openssl genpkey -algorithm RSA -out private-key.pem, puis openssl rsa -pubout -in private-key.pem -out public-key.pem. Signer : openssl dgst -sha256 -sign private-key.pem -out file1.signature file1.txt. Vérifier : openssl dgst -sha256 -verify public-key.pem -signature file1.signature file1.txt, qui répond « Verified OK » ou « Verification failure »."],
  ], "Données fictives. RSA réel, calculé dans votre navigateur avec une clé de démonstration fixe de 1024 bits, pour que l’exemple soit reproductible. L’empreinte est chiffrée telle quelle ; un vrai système ajoute un remplissage normalisé (PKCS#1 ou PSS) et une clé plus longue.", "Chapitre 2 · Signature : du schéma simple au schéma détaillé · p. 7 et 74 à 80 du PDF", CHAPTER_TWO_SOURCE));

  render();
  void Promise.all([digest(SIGNED_MESSAGE), digest(FORGED_MESSAGE)]).then(([hash, forgedHash]) => {
    if (signal.aborted) return;
    values = { hash, signature: cipherDigest(hash), forgedHash };
    render();
    void update();
  });
  return page;
}
