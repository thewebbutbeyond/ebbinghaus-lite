export type DemoAccount = Readonly<{ name: string; email: string; login: string; password: string }>;
export type PhishingMessage = Readonly<{ senderName: string; senderEmail: string; subject: string; text: string; displayedUrl: string; destination: string }>;
export type Knowledge = Readonly<{ name: string | null; email: string | null; login: string | null; password: string | null }>;
export type PhishingState = Readonly<{
  step: number;
  courseStep: number;
  victim: DemoAccount;
  attacker: Knowledge;
  bait: PhishingMessage | null;
  delivered: boolean;
  siteOpen: boolean;
}>;

export const PHISHING_STEPS = 5;
export const PHISHING_DEMO: DemoAccount = Object.freeze({ name: "Alice", email: "alice@campus-demo.test", login: "alice-demo", password: "mot-de-passe-fictif" });

export function initialPhishing(): PhishingState {
  return { step: 0, courseStep: 0, victim: PHISHING_DEMO,
    attacker: { name: null, email: null, login: null, password: null },
    bait: null, delivered: false, siteOpen: false };
}

export function collectPhishingData(state: PhishingState): PhishingState {
  if (!state.siteOpen || !state.delivered) return state;
  return { ...state, attacker: { ...state.attacker,
    login: state.victim.login, password: state.victim.password } };
}

export function nextPhishing(state: PhishingState): PhishingState {
  switch (state.step) {
    case 0: return { ...state, step: 1, courseStep: 1,
      attacker: { ...state.attacker, name: state.victim.name, email: state.victim.email } };
    case 1: return { ...state, step: 2, courseStep: 2, bait: {
      senderName: "Service informatique du campus", senderEmail: "assistance@campus-assistance.test",
      subject: "Ton accès au campus va être suspendu",
      text: "Confirme ton compte aujourd’hui pour conserver ton accès.",
      displayedUrl: "campus-demo.test/compte", destination: "https://campus-assistance.test/connexion",
    } };
    case 2: return { ...state, step: 3, courseStep: 3, delivered: state.bait !== null };
    case 3: return { ...state, step: 4, courseStep: 4, siteOpen: state.delivered && state.bait !== null };
    case 4: return { ...collectPhishingData(state), step: 5, courseStep: 4 };
    default: return state;
  }
}

export function phishingScenario(): readonly PhishingState[] {
  const states = [initialPhishing()];
  while (states.at(-1)!.step < PHISHING_STEPS) states.push(nextPhishing(states.at(-1)!));
  return states;
}
