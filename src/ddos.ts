export type Settings = Readonly<{ bots: number; rate: number; capacity: number; attack: boolean }>;
export type Tally = Readonly<{ normal: number; attack: number }>;
export type Request = Readonly<{ kind: "normal" | "attack"; source: number; at: number }>;
export type Snapshot = Readonly<{
  time: number;
  settings: Settings;
  queue: readonly Request[];
  arrived: Tally;
  processed: Tally;
  dropped: Tally;
  totals: Readonly<{ arrived: Tally; processed: Tally; dropped: Tally }>;
}>;
export type Timeline = Readonly<{ history: readonly Snapshot[]; cursor: number; settings: Settings }>;

export const DEFAULT_SETTINGS: Settings = Object.freeze({ bots: 6, rate: 2, capacity: 8, attack: false });
export const MAX_TIME = 120;
export const QUEUE_LIMIT = 200;

const zero: Tally = Object.freeze({ normal: 0, attack: 0 });
const add = (a: Tally, b: Tally): Tally => ({ normal: a.normal + b.normal, attack: a.attack + b.attack });
function tally(requests: readonly Request[]): Tally {
  const normal = requests.filter(request => request.kind === "normal").length;
  return { normal, attack: requests.length - normal };
}

export function createTimeline(): Timeline {
  const initial: Snapshot = {
    time: 0, settings: DEFAULT_SETTINGS, queue: [], arrived: zero, processed: zero, dropped: zero,
    totals: { arrived: zero, processed: zero, dropped: zero },
  };
  return { history: [initial], cursor: 0, settings: DEFAULT_SETTINGS };
}

export function current(timeline: Timeline): Snapshot {
  return timeline.history[timeline.cursor]!;
}

export function configure(timeline: Timeline, patch: Partial<Settings>): Timeline {
  const settings = { ...timeline.settings, ...patch };
  for (const [value, min, max] of [[settings.bots, 0, 12], [settings.rate, 1, 8],
    [settings.capacity, 1, 32]] as const) {
    if (!Number.isInteger(value) || value < min || value > max) throw new RangeError("Invalid DDoS settings");
  }
  if (typeof settings.attack !== "boolean") throw new RangeError("Invalid DDoS attack setting");
  if ((Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[])
    .every(key => settings[key] === timeline.settings[key])) return timeline;
  return { history: timeline.history.slice(0, timeline.cursor + 1), cursor: timeline.cursor, settings };
}

export function previous(timeline: Timeline): Timeline {
  if (timeline.cursor === 0) return timeline;
  const cursor = timeline.cursor - 1;
  return { history: timeline.history, cursor, settings: timeline.history[cursor]!.settings };
}

export function advance(timeline: Timeline): Timeline {
  const before = current(timeline);
  if (before.time >= MAX_TIME) return timeline;
  const cursor = timeline.cursor + 1;
  const recorded = timeline.history[cursor];
  if (recorded) return { history: timeline.history, cursor, settings: recorded.settings };

  const { settings } = timeline;
  const time = before.time + 1;
  const arrivals: Request[] = [];
  const activeRate = settings.attack ? settings.rate : 0;
  for (let round = 0; round < Math.max(4, activeRate); round++) {
    if (round < 4) arrivals.push({ kind: "normal", source: round, at: time });
    if (round < activeRate) {
      for (let source = 0; source < settings.bots; source++) {
        arrivals.push({ kind: "attack", source, at: time });
      }
    }
  }
  const available = [...before.queue, ...arrivals];
  const waiting = available.slice(settings.capacity);
  const arrived = tally(arrivals);
  const processed = tally(available.slice(0, settings.capacity));
  const dropped = tally(waiting.slice(QUEUE_LIMIT));
  const snapshot: Snapshot = {
    time, settings, queue: waiting.slice(0, QUEUE_LIMIT), arrived, processed, dropped,
    totals: {
      arrived: add(before.totals.arrived, arrived),
      processed: add(before.totals.processed, processed),
      dropped: add(before.totals.dropped, dropped),
    },
  };
  return { history: [...timeline.history, snapshot], cursor, settings };
}
