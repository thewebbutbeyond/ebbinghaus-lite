import { phishingScenario, PHISHING_STEPS } from "./phishing-example.ts";
import { createPlayback } from "./example-playback.ts";
import { actor, article, exchange, stepCounter } from "./example-ui.ts";
import { el } from "./review-view.ts";

export function createPhishingView(signal: AbortSignal, title: string): HTMLElement {
  const history = phishingScenario();
  let cursor = 0;
  const page = el("section", "portal-page example-view phishing-view");
  page.append(el("h1", "", title));
  const phases = el("ol", "example-phases");
  const names = ["Identification de la cible", "Préparation de l’appât", "Envoi du message", "Tromperie et collecte"];
  phases.setAttribute("aria-label", "Les quatre étapes du cours");
  names.forEach((name, index) => phases.append(el("li", "", (index + 1) + ". " + name)));
  const scene = el("div", "panel example-stage");
  const counter = stepCounter();
  const controls = createPlayback(signal, {
    prefix: "phishing",
    position: () => ({ first: cursor === 0, last: cursor === PHISHING_STEPS }),
    next: () => { cursor = Math.min(PHISHING_STEPS, cursor + 1); render(); },
    previous: () => { cursor = Math.max(0, cursor - 1); render(); },
    reset: () => { cursor = 0; render(); },
  });
  const clock = el("div", "example-clock");
  clock.append(counter, controls.status);
  const titles = ["Avant le message", "L’attaquant identifie sa cible", "L’attaquant prépare l’appât",
    "La victime reçoit le message", "La victime ouvre le faux site", "La victime envoie les identifiants fictifs"];

  function render(): void {
    const state = history[cursor]!;
    counter.value = "Étape " + cursor + "/" + PHISHING_STEPS;
    [...phases.children].forEach((item, index) => {
      if (index + 1 === state.courseStep) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    scene.replaceChildren(el("h2", "", titles[cursor]));
    if (cursor === 1) scene.append(exchange("Informations sur la cible", "Attaquant", state.attacker.email!));
    if (cursor === 2) scene.append(exchange("Attaquant", "Faux site", "Préparation d’une page de connexion trompeuse", true));
    if (cursor === 3) scene.append(exchange("Attaquant", "Victime", "Message adressé à " + state.victim.email, true));
    if (cursor === 4) scene.append(exchange("Victime", "Faux site", state.bait!.destination, true));
    if (cursor === 5) scene.append(exchange("Victime", "Attaquant", state.attacker.login + " / " + state.attacker.password, true));

    if (state.bait) {
      const browser = el("section", "example-browser");
      browser.dataset.phishingDisplay = state.siteOpen ? "site" : "message";
      browser.append(el("p", "example-browser-bar", state.siteOpen ? state.bait.destination : state.delivered ? "Boîte de réception de la victime" : "Message préparé par l’attaquant"));
      const body = el("div", "example-browser-body");
      if (state.siteOpen) {
        body.append(el("h3", "", "Connexion au campus"),
          el("p", "example-stage-caption", "Représentation fictive, sans formulaire réel."));
        const fields = el("dl", "example-mail-fields");
        for (const [label, value] of [["Identifiant fictif", state.victim.login], ["Mot de passe fictif", state.victim.password]]) {
          fields.append(el("dt", "", label), el("dd", "example-address", value));
        }
        body.append(fields, el("p", "", cursor === 4 ? "Ces identifiants n’ont pas encore été envoyés." : "Les identifiants ont été transmis à l’attaquant."));
      } else {
        body.append(el("h3", "", state.bait.subject));
        const fields = el("div", "example-mail-fields");
        for (const [label, value] of [["Nom affiché", state.bait.senderName], ["Adresse de l’expéditeur", state.bait.senderEmail], ["Destinataire", state.victim.email]]) {
          const field = el("p");
          field.append(el("strong", "", label), el("span", "", value));
          fields.append(field);
        }
        const destination = el("p", "example-mail-fields");
        destination.append(el("strong", "", "Destination réelle du lien"), el("span", "example-address", state.bait.destination));
        body.append(fields, el("p", "", state.bait.text), el("p", "example-fake-link", state.bait.displayedUrl), destination);
      }
      browser.append(body);
      scene.append(browser);
    }
    const actors = el("div", "example-actors");
    actors.append(
      actor("victim", "Victime", "browser", [["Utilisateur", state.victim.name],
        ["Message", state.delivered ? "Reçu" : "Pas encore reçu"], ["Page visitée", state.siteOpen ? state.bait!.destination : null]]),
      actor("fake-site", "Faux site", "server", [["Adresse", state.bait?.destination ?? null],
        ["Contrôlé par", state.bait ? "L’attaquant" : null], ["Identifiants reçus", state.attacker.login ? "Oui" : "Non"]]),
      actor("attacker", "Attaquant", "person", [["Nom connu", state.attacker.name], ["Adresse connue", state.attacker.email],
        ["Identifiant collecté", state.attacker.login], ["Mot de passe collecté", state.attacker.password]], cursor === 5),
    );
    scene.append(actors);
    controls.update();
  }

  page.append(phases, scene, clock, controls.element, article("phishing", "Comprendre le phishing", [
    ["Identifier une cible", "Le phishing exploite la confiance d’une personne pour lui faire révéler des informations sensibles. Dans cet exemple, l’attaquant connaît d’abord le nom et l’adresse de sa cible. Ces informations lui permettent de lui adresser un message ; elles ne lui donnent pas encore son identifiant ni son mot de passe."],
    ["Préparer un appât crédible", "L’attaquant prétend représenter le service informatique d’un campus fictif et annonce une suspension d’accès. Le nom affiché et le prétexte donnent une apparence familière au message. Le texte du lien évoque le campus, mais sa destination réelle est une autre adresse, contrôlée par l’attaquant. Ce message précis est notre illustration des étapes du cours."],
    ["Envoyer le message", "L’appât est envoyé à la victime. Le message reçu expose un nom d’expéditeur, une adresse et un lien. Le nom affiché ne prouve pas qui envoie le message ; le texte du lien ne prouve pas non plus où il mène. La scène laisse ces informations visibles pour suivre le chemin proposé à la victime."],
    ["Tromper puis collecter", "La victime ouvre le lien et découvre une imitation de page de connexion. Ouvrir cette page et lui transmettre un mot de passe sont deux événements distincts : dans le scénario, l’attaquant ne dispose des identifiants qu’après leur envoi. La dernière étape met à jour les informations détenues par l’attaquant à partir des valeurs fictives présentées par la victime."],
    ["Ce que montre le transfert", "Les informations ne sont pas envoyées au service que la victime croit contacter, mais au faux site. Le cours cite aussi les coordonnées bancaires et d’autres données sensibles comme cibles possibles ; notre exemple se limite aux identifiants. Le mécanisme central est la tromperie d’une personne, pas la découverte de son mot de passe par un calcul."],
  ], "Tous les acteurs, domaines .test et identifiants sont fictifs. Les adresses restent du texte et aucun formulaire ne collecte de données. La scène suit uniquement les informations du scénario : elle ne simule pas les autres traces possibles d’une navigation réelle, ni les protections citées dans le cours.", "Chapitre 1 · Phishing · diapositive 6, p. 20 du PDF"));
  render();
  return page;
}
