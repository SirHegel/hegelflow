import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { db } from "@/lib/db";

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_BLOCK_SECONDS = 15 * 60;
const LOGIN_MAX_ATTEMPTS = 5;
const MAX_JSON_BODY_BYTES = 8 * 1024;
const LOGIN_ATTEMPT_RETENTION_SECONDS = 24 * 60 * 60;
const LOGIN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let lastLoginAttemptCleanupAt = 0;

export const CSRF_HEADER_NAME = "x-csrf-protection";
export const CSRF_HEADER_VALUE = "1";

export class RequestSecurityError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 413 | 415,
  ) {
    super(message);
    this.name = "RequestSecurityError";
  }
}

export type LoginRateLimitDecision =
  | { allowed: true; keyHashes: string[] }
  | { allowed: false; retryAfterSeconds: number };

type LoginAttemptRow = {
  attempts: number;
  blockedUntil: Date | null;
};

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function normalizeUsername(username: string): string {
  return username.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function getClientIp(request: Request): string | null {
  const candidates = [
    firstHeaderValue(request.headers.get("x-real-ip")),
    firstHeaderValue(request.headers.get("x-forwarded-for")),
  ];

  for (const candidate of candidates) {
    if (candidate && isIP(candidate)) return candidate;
  }

  return null;
}

export function getSafeUserAgent(request: Request): string | null {
  const userAgent = request.headers.get("user-agent")?.trim();
  return userAgent ? userAgent.slice(0, 512) : null;
}

function addOrigin(target: Set<string>, candidate: string | null | undefined) {
  if (!candidate) return;

  try {
    const url = new URL(candidate);
    if (url.protocol === "https:" || url.protocol === "http:") {
      target.add(url.origin);
    }
  } catch {
    // Una URL mal formada nunca se considera un origen permitido.
  }
}

function allowedOriginsFor(request: Request): Set<string> {
  const allowed = new Set<string>();
  const requestUrl = new URL(request.url);
  addOrigin(allowed, requestUrl.origin);
  addOrigin(allowed, process.env.APP_URL);

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost ?? firstHeaderValue(request.headers.get("host"));
  const forwardedProtocol = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : requestUrl.protocol.slice(0, -1);

  if (host && !/[\s/\\]/.test(host)) {
    addOrigin(allowed, `${protocol}://${host}`);
  }

  return allowed;
}

export function assertMutationRequest(request: Request): void {
  if (request.method !== "POST") {
    throw new RequestSecurityError("Método no permitido.", 403);
  }

  const originHeader = request.headers.get("origin");
  if (!originHeader || originHeader === "null") {
    throw new RequestSecurityError("No se pudo validar el origen de la solicitud.", 403);
  }

  let origin: string;
  try {
    origin = new URL(originHeader).origin;
  } catch {
    throw new RequestSecurityError("El origen de la solicitud no es válido.", 403);
  }

  if (!allowedOriginsFor(request).has(origin)) {
    throw new RequestSecurityError("La solicitud proviene de un origen no permitido.", 403);
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new RequestSecurityError("La solicitud entre sitios fue bloqueada.", 403);
  }

  if (request.headers.get(CSRF_HEADER_NAME) !== CSRF_HEADER_VALUE) {
    throw new RequestSecurityError("No se pudo validar la protección CSRF.", 403);
  }

  const contentType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestSecurityError("El contenido debe enviarse como JSON.", 415);
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const size = Number(declaredLength);
    if (Number.isFinite(size) && size > maxBytes) {
      throw new RequestSecurityError("La solicitud es demasiado grande.", 413);
    }
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new RequestSecurityError("La solicitud es demasiado grande.", 413);
  }

  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new RequestSecurityError("El cuerpo de la solicitud no contiene JSON válido.", 400);
  }
}

function loginRateLimitKeys(username: string, ipAddress: string | null): string[] {
  // La IP se consume primero: cuando queda bloqueada, nombres de usuario
  // aleatorios no pueden provocar un crecimiento ilimitado de la tabla.
  const keys = ipAddress ? [sha256(`login:ip:${ipAddress}`)] : [];
  keys.push(sha256(`login:usuario:${normalizeUsername(username)}`));
  return keys;
}

async function cleanupExpiredLoginAttempts(): Promise<void> {
  const now = Date.now();
  if (now - lastLoginAttemptCleanupAt < LOGIN_CLEANUP_INTERVAL_MS) return;

  await db()`
    DELETE FROM login_attempts
    WHERE updated_at < NOW() - (${LOGIN_ATTEMPT_RETENTION_SECONDS}::integer * INTERVAL '1 second')
  `;
  lastLoginAttemptCleanupAt = now;
}

async function retryAfterFor(keyHash: string): Promise<number> {
  const [row] = await db()<Pick<LoginAttemptRow, "blockedUntil">[]>`
    SELECT blocked_until AS "blockedUntil"
    FROM login_attempts
    WHERE key_hash = ${keyHash}
    LIMIT 1
  `;

  if (!row?.blockedUntil) return LOGIN_BLOCK_SECONDS;
  return Math.max(1, Math.ceil((row.blockedUntil.getTime() - Date.now()) / 1000));
}

export async function consumeLoginRateLimit(
  username: string,
  ipAddress: string | null,
): Promise<LoginRateLimitDecision> {
  await cleanupExpiredLoginAttempts();
  const keyHashes = loginRateLimitKeys(username, ipAddress);

  for (const keyHash of keyHashes) {
    const [attempt] = await db()<LoginAttemptRow[]>`
      INSERT INTO login_attempts (
        key_hash, attempts, window_started_at, blocked_until, updated_at
      )
      VALUES (${keyHash}, 1, NOW(), NULL, NOW())
      ON CONFLICT (key_hash) DO UPDATE SET
        attempts = CASE
          WHEN login_attempts.window_started_at <= NOW() - (${LOGIN_WINDOW_SECONDS}::integer * INTERVAL '1 second')
            THEN 1
          ELSE login_attempts.attempts + 1
        END,
        window_started_at = CASE
          WHEN login_attempts.window_started_at <= NOW() - (${LOGIN_WINDOW_SECONDS}::integer * INTERVAL '1 second')
            THEN NOW()
          ELSE login_attempts.window_started_at
        END,
        blocked_until = CASE
          WHEN login_attempts.window_started_at <= NOW() - (${LOGIN_WINDOW_SECONDS}::integer * INTERVAL '1 second')
            THEN NULL
          WHEN login_attempts.attempts + 1 >= ${LOGIN_MAX_ATTEMPTS}
            THEN NOW() + (${LOGIN_BLOCK_SECONDS}::integer * INTERVAL '1 second')
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE login_attempts.blocked_until IS NULL
         OR login_attempts.blocked_until <= NOW()
      RETURNING attempts, blocked_until AS "blockedUntil"
    `;

    // La quinta solicitud se evalúa y deja el bloqueo preparado; la siguiente
    // no actualiza ninguna fila y queda rechazada de forma atómica.
    if (!attempt) {
      return {
        allowed: false,
        retryAfterSeconds: await retryAfterFor(keyHash),
      };
    }
  }

  return { allowed: true, keyHashes };
}

export async function clearLoginRateLimit(keyHashes: readonly string[]): Promise<void> {
  for (const keyHash of keyHashes) {
    await db()`DELETE FROM login_attempts WHERE key_hash = ${keyHash}`;
  }
}

export function sessionIpHash(ipAddress: string | null): string | null {
  return ipAddress ? sha256(`sesion:ip:${ipAddress}`) : null;
}
