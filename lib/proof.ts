import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type Secret = "QLOO_API_KEY" | "GEMINI_API_KEY";
function digest(value: string, secret: Secret) {
  const key = process.env[secret];
  if (!key) throw new Error("Missing server configuration.");
  return createHmac("sha256", key).update(value).digest();
}

export function seal(payload: unknown, purpose: string, secret: Secret) {
  const encoded = Buffer.from(JSON.stringify({ purpose, expires: Date.now() + 30 * 60_000, payload })).toString("base64url");
  return `${encoded}.${digest(encoded, secret).toString("base64url")}`;
}

export function unseal(value: string, purpose: string, secret: Secret): unknown {
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra) throw new Error("Invalid receipt.");
  const actual = Buffer.from(signature, "base64url");
  const expected = digest(encoded, secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid receipt.");
  const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
  if (data.purpose !== purpose || typeof data.expires !== "number" || data.expires < Date.now()) throw new Error("Receipt expired.");
  return data.payload;
}
