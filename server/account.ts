import { randomBytes } from "node:crypto";
import { hashPassword } from "./library.ts";

export async function createCredentials(): Promise<{ password: string; passwordHash: string }> {
  const password = randomBytes(18).toString("base64url");
  return { password, passwordHash: await hashPassword(password) };
}

if (import.meta.main) {
  const { password, passwordHash } = await createCredentials();
  console.log("Mot de passe à communiquer en privé :", password);
  console.log("passwordHash à ajouter au manifeste :", passwordHash);
}
