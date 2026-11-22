export type Verdict = "intact" | "altered";
export type WillState = Readonly<{
  step: number;
  draft: string | null;
  fatherHash: string | null;
  notaryA: string | null;
  notaryB: string | null;
  readingHash: string | null;
  verdict: Verdict | null;
}>;
export type Hash = (text: string) => Promise<string>;

export const WILL_STEPS = 6;
export const WILL_TEXT = Object.freeze({
  original: "À ma mort, ma fortune sera partagée à parts égales entre mes trois fils. Toutefois, George ne recevra rien.",
  altered: "À ma mort, ma fortune sera partagée à parts égales entre mes trois fils. Toutefois, George recevra tout.",
});

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function compareHashes(computed: string | null, kept: string | null): Verdict | null {
  return computed === null || kept === null ? null : computed === kept ? "intact" : "altered";
}

export function initialWill(): WillState {
  return { step: 0, draft: null, fatherHash: null, notaryA: null, notaryB: null, readingHash: null, verdict: null };
}

export async function nextWill(state: WillState, hash: Hash = sha256Hex): Promise<WillState> {
  switch (state.step) {
    case 0: return { ...state, step: 1, draft: WILL_TEXT.original };
    case 1: return { ...state, step: 2, fatherHash: state.draft === null ? null : await hash(state.draft) };
    case 2: return { ...state, step: 3, notaryA: state.draft, notaryB: state.fatherHash };
    case 3: return { ...state, step: 4, notaryA: state.notaryA === null ? null : WILL_TEXT.altered };
    case 4: return { ...state, step: 5, readingHash: state.notaryA === null ? null : await hash(state.notaryA) };
    case 5: return { ...state, step: 6, verdict: compareHashes(state.readingHash, state.notaryB) };
    default: return state;
  }
}

export async function willScenario(hash: Hash = sha256Hex): Promise<readonly WillState[]> {
  const states = [initialWill()];
  while (states.at(-1)!.step < WILL_STEPS) states.push(await nextWill(states.at(-1)!, hash));
  return states;
}
