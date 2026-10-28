/** MINOS local sidecar authentication. Never send bridge secrets to the browser. */
import { timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const minosEnabled = () => Boolean(process.env.MINOS_PI_BRIDGE_SECRET);
export const minosCookieName = () => process.env.MINOS_PI_COOKIE_NAME || "minos_pi";
let bridgeToken = "";
const tokenFile = () => join(process.env.PI_CODING_AGENT_DIR!, 'minos-bridge-token');
export function getBridgeToken(): string {
  if (!bridgeToken && minosEnabled()) { try { bridgeToken = readFileSync(tokenFile(), 'utf8'); } catch { /* not connected */ } }
  return bridgeToken;
}
export function rememberBridgeToken(token: string) {
  bridgeToken = token;
  // Next proxy and route bundles may be distinct workers. Keep only the local
  // opaque capability in the private agent dir, never browser JS or sessions.
  if (minosEnabled()) writeFileSync(tokenFile(), token, { mode: 0o600 });
}
export async function verifyMinosCredential(credential: { ticket?: string; token?: string }) {
  const response = await fetch(`${process.env.MINOS_API_BASE_URL || "http://127.0.0.1:8000"}/api/pi-web/verify`, {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...credential, bridgeSecret: process.env.MINOS_PI_BRIDGE_SECRET }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const result = await response.json();
  if (!result.token || result.userId !== process.env.MINOS_PI_USER_ID) return null;
  rememberBridgeToken(result.token);
  return result as { token: string; userId: string; expiresAt: number; workspace: string };
}
export function isInternalSidecarRequest(value: string | null): boolean {
  const expected = process.env.MINOS_PI_BRIDGE_SECRET;
  if (!expected || !value) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
