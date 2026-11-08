import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

export function archivePassword(): string {
  if (!process.env.ARCHIVE_PASSWORD && existsSync(".env.archive.local")) loadEnvFile(".env.archive.local");
  const password = process.env.ARCHIVE_PASSWORD;
  if (!password || password.length < 16) {
    throw new Error("Set ARCHIVE_PASSWORD (16+ characters) in the environment or ignored .env.archive.local");
  }
  return password;
}
