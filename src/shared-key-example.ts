export const SHARED_KEY_STEPS = 4;
export const SHARED_SECRET = "tournesol-bleu-42";
export const EVE_GUESS = "motdepasse123";
export const SHARED_KEY_MESSAGE = "Bob, rendez-vous jeudi à 18 h au café de la gare. Apporte les plans. Alice";

const NONCE = new Uint8Array(12);
const bytes = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

export const toHex = (data: Uint8Array): string => [...data].map(byte => byte.toString(16).padStart(2, "0")).join("");

async function keyFrom(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", bytes(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encrypt(secret: string, text: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: NONCE }, await keyFrom(secret), bytes(text)));
}

export async function decrypt(secret: string, data: Uint8Array<ArrayBuffer>): Promise<string | null> {
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: NONCE }, await keyFrom(secret), data));
  } catch {
    return null;
  }
}
