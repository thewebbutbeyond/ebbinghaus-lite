import { sessionScenario, SESSION_DEMO, SESSION_STEPS } from "./session-example.ts";
import { createPlayback } from "./example-playback.ts";
import { actor, article, exchange, stepCounter } from "./example-ui.ts";
import { el } from "./review-view.ts";

export function createSessionView(signal: AbortSignal, title: string): HTMLElement {
  const history = sessionScenario();
  let cursor = 0;
  const page = el("section", "portal-page example-view session-view");
  page.append(el("h1", "", title));
  const scene = el("div", "panel example-stage");
  const counter = stepCounter();
  const controls = createPlayback(signal, {
    prefix: "session",
    position: () => ({ first: cursor === 0, last: cursor === SESSION_STEPS }),
    next: () => { cursor = Math.min(SESSION_STEPS, cursor + 1); render(); },
    previous: () => { cursor = Math.max(0, cursor - 1); render(); },
    reset: () => { cursor = 0; render(); },
  });
  const clock = el("div", "example-clock");
  clock.append(counter, controls.status);
  const titles = ["Avant la connexion", "L’utilisateur s’authentifie", "Le serveur crée une session",
    "Le navigateur présente son cookie", "L’attaquant copie l’identifiant", "L’attaquant réutilise l’identifiant", "Le serveur retrouve la session"];
  function render(): void {
    const state = history[cursor]!;
    counter.value = "Étape " + cursor + "/" + SESSION_STEPS;
    scene.replaceChildren(el("h2", "", titles[cursor]));
    if (cursor === 0) scene.append(el("p", "example-stage-caption", "Aucune session n’a encore été créée."));
    else {
      const [from, to, payload] = cursor === 1 ? ["Utilisateur", "Serveur", SESSION_DEMO.login + " / " + SESSION_DEMO.password]
        : cursor === 2 ? ["Serveur", "Utilisateur", "Identifiant de session : " + state.userToken]
          : cursor === 3 ? ["Utilisateur", "Serveur", "Cookie : " + state.request!.token]
            : cursor === 4 ? ["Utilisateur", "Attaquant", "Copie du cookie : " + state.attackerToken]
              : cursor === 5 ? ["Attaquant", "Serveur", "Cookie : " + state.request!.token]
                : ["Serveur", "Attaquant", "Accès au compte de " + state.attackerIdentity];
      scene.append(exchange(from!, to!, payload!, cursor >= 4));
    }
    const actors = el("div", "example-actors");
    actors.append(
      actor("user", "Utilisateur", "browser", [["Utilisateur", SESSION_DEMO.identity],
        ["Cookie de session", state.userToken], ["Compte accessible", state.userIdentity]]),
      actor("server", "Serveur", "server", [["Authentification initiale", state.authenticated ? "Acceptée" : "Non effectuée"],
        ["Table des sessions", state.sessions.length ? state.sessions.map(s => s.id + " : " + s.identity).join("\n") : null]]),
      actor("attacker", "Attaquant", "person", [["Cookie copié", state.attackerToken],
        ["Mot de passe de la victime", null], ["Compte accessible", state.attackerIdentity]], cursor >= 4),
    );
    scene.append(actors);
    if (cursor === 4) scene.append(el("p", "example-stage-caption", "Le vol est supposé possible dans cet exemple. L’identifiant est copié, pas retiré au navigateur de la victime."));
    if (cursor === 6) scene.append(el("p", "example-stage-caption", "La même session est reconnue : l’attaquant obtient l’accès sans connaître le mot de passe."));
    controls.update();
  }
  page.append(scene, clock, controls.element, article("session", "Comprendre le détournement de session", [
    ["Pourquoi une session ?", "HTTP est sans état : une requête ne suffit pas, à elle seule, à rappeler les échanges précédents. Une application peut donc conserver une session côté serveur pour retrouver l’utilisateur après sa connexion. Dans cet exemple, cette session est associée au compte d’Alice."],
    ["Ce que contient le cookie", "Après l’authentification, le navigateur reçoit un identifiant de session. Il le renvoie dans un cookie lors des requêtes suivantes. Le serveur utilise cet identifiant pour retrouver la session d’Alice. Le cookie montré ici ne contient ni son mot de passe ni l’ensemble des informations de son compte : il sert de référence vers la session."],
    ["Ce qui est volé", "L’attaquant récupère une copie de cet identifiant alors que la session est encore valide. La victime peut continuer à utiliser son propre cookie. Il n’est pas nécessaire que l’attaquant connaisse son mot de passe : c’est désormais l’identifiant de session qu’il peut présenter."],
    ["Pourquoi le serveur accorde l’accès", "La requête de l’attaquant porte la même valeur que celle de la victime. Dans le modèle, le serveur consulte sa table : cette valeur correspond à Alice. Il traite donc la requête dans le contexte de son compte. L’identité associée au jeton est retrouvée par le calcul, indépendamment du nom donné à l’émetteur dans la scène."],
    ["Trois notions distinctes dans le cours", "Le détournement de session présenté ici consiste à voler un identifiant existant. La fixation consiste à imposer à la victime un identifiant déjà connu de l’attaquant. La falsification consiste à fabriquer un cookie contenant des informations utiles à l’attaque. Ce sont des mécanismes différents ; seul le premier est déroulé dans cet exemple."],
  ], "Données fictives. Le vol du cookie est une hypothèse du scénario, pas un exploit exécuté. La table et les échanges sont calculés en mémoire : aucun vrai cookie n’est lu et aucun serveur n’est contacté. Les protections détaillées ne font pas partie de cet exemple du chapitre 1.", "Chapitre 1 · Cookies de session volés · diapositive 24, p. 53 du PDF"));
  render();
  return page;
}
