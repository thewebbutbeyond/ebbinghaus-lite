import type { Snapshot } from "./ddos.ts";

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function label(parent: SVGElement, x: number, y: number, value: string, className = ""): void {
  const node = svg("text", { x, y, class: className });
  node.textContent = value;
  parent.append(node);
}

function computer(parent: SVGElement, x: number, y: number): void {
  const group = svg("g", { class: "ddos-device", transform: `translate(${x} ${y})` });
  group.append(svg("rect", { width: 38, height: 27, rx: 3 }),
    svg("path", { d: "M19 27v7m-9 0h18" }));
  parent.append(group);
}

function arrow(parent: SVGElement, points: readonly (readonly [number, number])[], className: string): void {
  const last = points.at(-1)!;
  const before = points.at(-2)!;
  const angle = Math.atan2(last[1] - before[1], last[0] - before[0]) * 180 / Math.PI;
  const group = svg("g", { class: "ddos-arrow " + className });
  group.append(svg("polyline", { points: points.map(point => point.join(",")).join(" ") }),
    svg("path", { class: "ddos-arrowhead", d: "M-8-4 0 0-8 4Z",
      transform: `translate(${last[0]} ${last[1]}) rotate(${angle})` }));
  parent.append(group);
}

export function renderDdosScene(state: Snapshot): SVGSVGElement {
  const normal = state.queue.filter(request => request.kind === "normal").length;
  const attack = state.queue.length - normal;
  const active = state.settings.attack && state.settings.bots > 0;
  const scene = svg("svg", { class: "ddos-scene", viewBox: "0 0 400 330", role: "img",
    "aria-labelledby": "ddos-scene-title", "aria-describedby": "ddos-scene-description" });
  const title = svg("title", { id: "ddos-scene-title" });
  title.textContent = "DDoS : des clients et des machines compromises vers un serveur";
  const description = svg("desc", { id: "ddos-scene-description" });
  description.textContent = `Temps : ${state.time} s. Attaque ${state.settings.attack ? "active" : "arrêtée"}, ` +
    `${state.settings.bots} machines compromises à ${state.settings.rate} req/s chacune. ` +
    `Dernière seconde : ${state.arrived.normal} arrivées normales, ${state.arrived.attack} d'attaque, ` +
    `${state.processed.normal + state.processed.attack} traitées, ${state.dropped.normal + state.dropped.attack} rejetées. ` +
    `${state.queue.length} requêtes en attente : ${normal} normales et ${attack} d'attaque. ` +
    `Capacité : ${state.settings.capacity} req/s. Les symboles représentent des groupes.`;
  scene.append(title, description);

  const clients = svg("g", { class: "ddos-normal" });
  label(clients, 18, 44, "Clients");
  computer(clients, 24, 78);
  scene.append(clients);
  arrow(scene, [[70, 96], [210, 96]], "ddos-normal" + (state.arrived.normal ? "" : " ddos-inactive"));
  label(scene, 102, 79, `${state.arrived.normal} req`, "ddos-flow-label ddos-normal");

  const attacker = svg("g", { class: active ? "ddos-attack" : "ddos-muted" });
  attacker.append(svg("circle", { cx: 43, cy: 216, r: 9 }),
    svg("path", { d: "M25 247v-7a18 18 0 0 1 36 0v7Z" }));
  label(attacker, 12, 282, "Attaquant", "ddos-actor-label");
  scene.append(attacker);

  const bots = svg("g", { class: active ? "ddos-attack" : "ddos-muted" });
  // Fixed group emblem; the labelled number, not the icon count, is the model input.
  if (state.settings.bots > 0) computer(bots, 145, 209);
  if (state.settings.bots > 1) computer(bots, 155, 219);
  label(bots, 136, 282, `${state.settings.bots} machine${state.settings.bots === 1 ? "" : "s"}`, "ddos-actor-label");
  scene.append(bots);
  if (active) {
    arrow(scene, [[67, 237], [139, 237]], "ddos-attack ddos-command");
    label(scene, 77, 223, "Ordre", "ddos-small ddos-attack");
    arrow(scene, [[180, 208], [180, 185], [210, 165]], "ddos-attack");
  }
  label(scene, 116, 177, `${state.arrived.attack} req`, "ddos-flow-label ddos-attack");

  const buffer = svg("g", { class: "ddos-buffer" });
  label(buffer, 216, 44, "Attente");
  buffer.append(svg("rect", { x: 216, y: 68, width: 82, height: 126, rx: 8 }));
  label(buffer, 257, 110, String(state.queue.length), "ddos-buffer-count");
  const normalCount = svg("g", { class: "ddos-normal" });
  normalCount.append(svg("circle", { cx: 236, cy: 140, r: 5, class: "ddos-origin-mark" }));
  label(normalCount, 251, 147, String(normal), "ddos-flow-label");
  const attackCount = svg("g", { class: "ddos-attack" });
  attackCount.append(svg("path", { d: "M236 165 241 170 236 175 231 170Z", class: "ddos-origin-mark" }));
  label(attackCount, 251, 177, String(attack), "ddos-flow-label");
  buffer.append(normalCount, attackCount);
  scene.append(buffer);

  arrow(scene, [[304, 119], [330, 119]], "ddos-service");
  const server = svg("g", { class: "ddos-device ddos-server" });
  label(server, 314, 44, "Serveur");
  for (let row = 0; row < 3; row++) {
    server.append(svg("rect", { x: 336, y: 89 + row * 17, width: 43, height: 14, rx: 3 }),
      svg("circle", { cx: 343, cy: 96 + row * 17, r: 2 }));
  }
  label(server, 314, 174, `${state.settings.capacity} req/s`, "ddos-flow-label");
  scene.append(server);
  label(scene, 18, 318, state.queue.length ? "Des requêtes attendent une réponse." : "Le serveur répond sans attente.", "ddos-small");
  return scene;
}
