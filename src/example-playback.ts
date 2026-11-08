import { action, el } from "./review-view.ts";
import { icon } from "./icons.ts";
import "./examples.css";

type PlaybackActions = Readonly<{
  prefix: string;
  position: () => Readonly<{ first: boolean; last: boolean; disabled?: boolean }>;
  next: () => void;
  previous: () => void;
  reset: () => void;
}>;

export function createPlayback(signal: AbortSignal, actions: PlaybackActions) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const { prefix } = actions;
  const element = el("div", "example-toolbar " + prefix + "-toolbar");
  const group = el("div", "example-playback " + prefix + "-playback");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Lecture de l'exemple");
  const previous = action("Précédent", prefix + "-previous", "button-outline", "stepBack");
  const play = action("Lire", prefix + "-play", "button-primary", "play");
  const next = action("Suivant", prefix + "-next", "button-outline", "stepForward");
  const reset = action("Recommencer", prefix + "-reset", "button-outline", "stop");
  for (const button of [previous, play, reset, next]) {
    const label = button.querySelector(".action-label")!.textContent!;
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  const status = el("span", "example-status " + prefix + "-status");
  status.setAttribute("role", "status");
  group.append(previous, play, reset, next);
  element.append(group);

  function update(): void {
    const position = actions.position();
    if ((position.last || position.disabled || signal.aborted) && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    const label = timer === undefined ? "Lire" : "Pause";
    if (play.querySelector(".action-label")!.textContent !== label) {
      play.querySelector(".action-label")!.textContent = label;
      play.querySelector("svg")!.replaceWith(icon(timer === undefined ? "play" : "pause"));
      play.setAttribute("aria-label", label);
      play.title = label;
    }
    previous.disabled = position.first || !!position.disabled || signal.aborted;
    play.disabled = next.disabled = position.last || !!position.disabled || signal.aborted;
    reset.disabled = signal.aborted;
    const message = position.last ? "Terminé" : timer === undefined ? "En pause" : "Lecture";
    if (status.textContent !== message) status.textContent = message;
  }

  function pause(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    update();
  }

  play.addEventListener("click", () => {
    if (timer !== undefined) pause();
    else if (!signal.aborted && !document.hidden && !actions.position().last && !actions.position().disabled) {
      timer = setInterval(() => {
        if (document.hidden || signal.aborted) { pause(); return; }
        actions.next();
        update();
      }, 1000);
      update();
    }
  }, { signal });
  for (const [button, change] of [[previous, actions.previous], [next, actions.next], [reset, actions.reset]] as const) {
    button.addEventListener("click", () => { pause(); change(); update(); }, { signal });
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); }, { signal });
  signal.addEventListener("abort", pause, { once: true });
  update();
  return { element, group, status, pause, update };
}
