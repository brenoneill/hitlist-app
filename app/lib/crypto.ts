import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const keyB64 = process.env.SETTINGS_ENCRYPTION_KEY;
if (!keyB64) {
  throw new Error("SETTINGS_ENCRYPTION_KEY is not set — add it to .env.local");
}
const key = Buffer.from(keyB64, "base64");
if (key.length !== 32) {
  throw new Error("SETTINGS_ENCRYPTION_KEY must decode to 32 bytes");
}

/** AES-256-GCM; output packs iv + auth tag + ciphertext into one base64 string. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64",
  );
}

export function decrypt(packed: string): string {
  const buf = Buffer.from(packed, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
