import { hash, verify } from "@node-rs/argon2";
import { verifyPassword as verifyLegacyPassword } from "better-auth/crypto";

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

export function assertStrongPassword(password: string) {
  if (!passwordPattern.test(password)) {
    throw new Error(
      "Password must contain uppercase, lowercase, number, and special characters",
    );
  }
}

export async function hashPassword(password: string) {
  assertStrongPassword(password);
  return hash(password, {
    algorithm: 2,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 4,
    outputLen: 32,
  });
}

export async function verifyPassword(data: { hash: string; password: string }) {
  if (data.hash.startsWith("$argon2")) {
    return verify(data.hash, data.password);
  }
  return verifyLegacyPassword(data);
}
