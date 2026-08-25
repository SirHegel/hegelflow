import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { accessLevelSchema } from "@/lib/permissions";
import {
  generateOpaqueToken,
  normalizeUsername,
  sessionIpHash,
  sha256,
} from "@/lib/security";
import type { AccessLevel } from "@/lib/types";

export const SESSION_COOKIE_NAME = "__Host-hegelflow-session";
export const SESSION_DURATION_SECONDS = 12 * 60 * 60;

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DUMMY_PASSWORD_HASH = bcrypt.hash(
  randomBytes(32).toString("base64url"),
  12,
);

type CredentialRow = {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string | null;
  status: "ACTIVE" | "INVITED" | "DISABLED";
};

type SessionRow = {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  locale: string;
  timezone: string;
  expiresAt: Date;
};

type MembershipRow = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  profileSlug: string;
  fullName: string;
  workRole: string;
  accessLevel: string;
  avatarColor: string;
};

export type AuthenticatedUser = {
  id: string;
  username: string;
  displayName: string;
};

export type SessionMembership = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  profileSlug: string;
  fullName: string;
  workRole: string;
  accessLevel: AccessLevel;
  avatarColor: string;
};

export type AuthSession = {
  id: string;
  expiresAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarColor: string;
    locale: string;
    timezone: string;
  };
  memberships: SessionMembership[];
};

export type CreatedSession = {
  token: string;
  expiresAt: Date;
};

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Debes iniciar sesión para continuar.");
    this.name = "AuthenticationRequiredError";
  }
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    priority: "high" as const,
  };
}

export function expiredSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high" as const,
  };
}

export async function authenticateCredentials(
  username: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const normalizedUsername = normalizeUsername(username);
  const [user] = await db()<CredentialRow[]>`
    SELECT
      id,
      username,
      display_name AS "displayName",
      password_hash AS "passwordHash",
      status
    FROM users
    WHERE LOWER(username) = ${normalizedUsername}
    LIMIT 1
  `;

  // Se espera el hash señuelo también cuando el usuario existe para que el
  // primer arranque del proceso no abra una diferencia temporal observable.
  const dummyPasswordHash = await DUMMY_PASSWORD_HASH;
  const passwordHash = user?.passwordHash ?? dummyPasswordHash;
  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (
    !user
    || !user.passwordHash
    || user.status !== "ACTIVE"
    || !passwordMatches
  ) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
}

export async function createSession(
  userId: string,
  context: { ipAddress: string | null; userAgent: string | null },
): Promise<CreatedSession> {
  const token = generateOpaqueToken();
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  const ipHash = sessionIpHash(context.ipAddress);

  await db().begin(async (transaction) => {
    await transaction`DELETE FROM sessions WHERE expires_at <= NOW()`;

    // Conserva como máximo diez sesiones por cuenta antes de crear la nueva.
    await transaction`
      DELETE FROM sessions
      WHERE user_id = ${userId}
        AND id IN (
          SELECT id
          FROM sessions
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          OFFSET 9
        )
    `;

    await transaction`
      INSERT INTO sessions (
        user_id, token_hash, user_agent, ip_hash, expires_at
      )
      VALUES (
        ${userId}, ${tokenHash}, ${context.userAgent}, ${ipHash}, ${expiresAt}
      )
    `;

    await transaction`
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = ${userId}
    `;
  });

  return { token, expiresAt };
}

export async function getSessionByToken(token: string | null | undefined): Promise<AuthSession | null> {
  if (!token || !SESSION_TOKEN_PATTERN.test(token)) return null;

  const tokenHash = sha256(token);
  const [session] = await db()<SessionRow[]>`
    SELECT
      s.id AS "sessionId",
      s.user_id AS "userId",
      s.expires_at AS "expiresAt",
      u.username,
      u.display_name AS "displayName",
      u.avatar_color AS "avatarColor",
      u.locale,
      u.timezone
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > NOW()
      AND u.status = 'ACTIVE'
    LIMIT 1
  `;

  if (!session) return null;

  const membershipRows = await db()<MembershipRow[]>`
    SELECT
      m.id,
      m.workspace_id AS "workspaceId",
      w.name AS "workspaceName",
      w.slug AS "workspaceSlug",
      m.profile_slug AS "profileSlug",
      m.full_name AS "fullName",
      m.work_role AS "workRole",
      m.access_level AS "accessLevel",
      m.avatar_color AS "avatarColor"
    FROM memberships m
    JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ${session.userId}
      AND m.status = 'ACTIVE'
    ORDER BY m.created_at
  `;

  const memberships = membershipRows.flatMap((membership) => {
    const accessLevel = accessLevelSchema.safeParse(membership.accessLevel);
    if (!accessLevel.success) return [];

    return [{
      ...membership,
      accessLevel: accessLevel.data,
    }];
  });

  return {
    id: session.sessionId,
    expiresAt: session.expiresAt,
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      avatarColor: session.avatarColor,
      locale: session.locale,
      timezone: session.timezone,
    },
    memberships,
  };
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return getSessionByToken(token);
}

export async function requireCurrentSession(): Promise<AuthSession> {
  const session = await getCurrentSession();
  if (!session) throw new AuthenticationRequiredError();
  return session;
}

export async function revokeSession(token: string | null | undefined): Promise<void> {
  if (!token || !SESSION_TOKEN_PATTERN.test(token)) return;
  await db()`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db()`DELETE FROM sessions WHERE user_id = ${userId}`;
}
