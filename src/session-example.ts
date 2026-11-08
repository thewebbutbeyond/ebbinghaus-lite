export type Session = Readonly<{ id: string; identity: string }>;
export type SessionRequest = Readonly<{ sender: "user" | "attacker"; token: string | null }>;
export type SessionState = Readonly<{
  step: number;
  authenticated: boolean;
  sessions: readonly Session[];
  userToken: string | null;
  attackerToken: string | null;
  request: SessionRequest | null;
  userIdentity: string | null;
  attackerIdentity: string | null;
}>;

export const SESSION_STEPS = 6;
export const SESSION_DEMO = Object.freeze({ identity: "Alice", login: "alice-demo", password: "mot-de-passe-fictif", token: "session-demo-7K4Q" });

export function sessionIdentity(sessions: readonly Session[], token: string | null): string | null {
  return token === null ? null : sessions.find(session => session.id === token)?.identity ?? null;
}

export function initialSession(): SessionState {
  return { step: 0, authenticated: false, sessions: [], userToken: null,
    attackerToken: null, request: null, userIdentity: null, attackerIdentity: null };
}

export function nextSession(state: SessionState): SessionState {
  switch (state.step) {
    case 0: return { ...state, step: 1, authenticated: true };
    case 1: return { ...state, step: 2,
      sessions: state.authenticated ? [{ id: SESSION_DEMO.token, identity: SESSION_DEMO.identity }] : [],
      userToken: state.authenticated ? SESSION_DEMO.token : null };
    case 2: return { ...state, step: 3, request: { sender: "user", token: state.userToken },
      userIdentity: sessionIdentity(state.sessions, state.userToken) };
    case 3: return { ...state, step: 4, attackerToken: state.userToken };
    case 4: return { ...state, step: 5, request: { sender: "attacker", token: state.attackerToken } };
    case 5: return { ...state, step: 6,
      attackerIdentity: sessionIdentity(state.sessions, state.request?.sender === "attacker" ? state.request.token : null) };
    default: return state;
  }
}

export function sessionScenario(): readonly SessionState[] {
  const states = [initialSession()];
  while (states.at(-1)!.step < SESSION_STEPS) states.push(nextSession(states.at(-1)!));
  return states;
}
