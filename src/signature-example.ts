import { sha256Hex } from "./will-example.ts";

export const SIGNATURE_STEPS = 6;
export const SIGNED_MESSAGE = "Hello Bob !";
export const FORGED_MESSAGE = "Hello Bob ! Verse 500 € sur le compte BE00 0000 0000 0000.";

// Fictitious 1024-bit RSA demo key, fixed so every run shows the same values. Never use it for anything real.
const N = 0xd3f6ef3add8c66cb913191e518c94f4b51e2c889eb60373622dea0fb5bebba7898ea1c383a4be63a385352a02481166bcf475800083344f2962c73e5282313959f816e75ede40a39228199609161c2081a78544d9fb36c3995f4a8b47c42b9c7412cac115028b179f55a0391246b7521c321501e827a9bdee4d4d15b84eba46bn;
const D = 0xa16c2f284f4cfb8410210610c8dd96abafc2dc225cc4bb8758eadf024e30a9a3ea20703949fc3f6b1b36297898144ef4efb84f8646b874cba21e5c6caa327c585569bee2bb819b9439da69c6d727507f56476da53a88ac72bd59081211592f262a85fea046467a1d88135454cf713b4fb2a268fab0fb792e0714b8eb9c0ae761n;
const E = 65537n;
export const PUBLIC_KEY = "e = 65537, n = " + N.toString(16).slice(0, 8) + "…";
export const PRIVATE_KEY = "d = " + D.toString(16).slice(0, 8) + "…";

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  base %= modulus;
  for (; exponent > 0n; exponent >>= 1n, base = base * base % modulus) if (exponent & 1n) result = result * base % modulus;
  return result;
}

export const digest = sha256Hex;
export const cipherDigest = (hash: string): string => modPow(BigInt("0x" + hash), D, N).toString(16).padStart(256, "0");
export const uncipherSignature = (signature: string): string => modPow(BigInt("0x" + signature), E, N).toString(16).padStart(64, "0");
export async function sign(message: string): Promise<string> { return cipherDigest(await digest(message)); }
export async function verify(message: string, signature: string): Promise<boolean> { return await digest(message) === uncipherSignature(signature); }
