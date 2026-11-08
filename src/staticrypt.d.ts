declare module "staticrypt/lib/cryptoEngine.js" {
  export function generateRandomSalt(): string;
  export function hashPassword(password: string, salt: string): Promise<string>;
}

declare module "staticrypt/lib/codec.js" {
  export function init(engine: typeof import("staticrypt/lib/cryptoEngine.js")): {
    encode(message: string, password: string, salt: string): Promise<string>;
    decode(message: string, key: string, salt: string, backwardCompatibleAttempt?: number):
      Promise<{ success: true; decoded: string } | { success: false; message: string }>;
  };
}
