import { z } from "zod";
import type { AccessLevel } from "@/lib/types";

export const accessLevelSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

export const permissionSchema = z.enum([
  "workspace.read",
  "workspace.update",
  "workspace.delete",
  "member.read",
  "member.invite",
  "member.update",
  "member.changeRole",
  "board.read",
  "board.create",
  "board.update",
  "board.archive",
  "task.read",
  "task.create",
  "task.update",
  "task.move",
  "task.assign",
  "task.archive",
  "comment.create",
  "comment.moderate",
  "attachment.create",
  "sprint.read",
  "sprint.manage",
  "automation.read",
  "automation.manage",
  "savedView.manage",
  "audit.read",
  "data.export",
  "integration.manage",
]);

export type Permission = z.infer<typeof permissionSchema>;

const viewerPermissions = [
  "workspace.read",
  "member.read",
  "board.read",
  "task.read",
  "sprint.read",
] as const satisfies readonly Permission[];

const memberPermissions = [
  ...viewerPermissions,
  "task.create",
  "task.update",
  "task.move",
  "task.assign",
  "comment.create",
  "attachment.create",
  "savedView.manage",
] as const satisfies readonly Permission[];

const adminPermissions = [
  ...memberPermissions,
  "workspace.update",
  "member.invite",
  "member.update",
  "board.create",
  "board.update",
  "board.archive",
  "task.archive",
  "comment.moderate",
  "sprint.manage",
  "automation.read",
  "automation.manage",
] as const satisfies readonly Permission[];

const rolePermissions: Record<AccessLevel, ReadonlySet<Permission>> = {
  VIEWER: new Set(viewerPermissions),
  MEMBER: new Set(memberPermissions),
  ADMIN: new Set(adminPermissions),
  OWNER: new Set(permissionSchema.options),
};

const accessRank: Record<AccessLevel, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export class PermissionDeniedError extends Error {
  constructor(readonly permission: Permission) {
    super("No tienes permiso para realizar esta acción.");
    this.name = "PermissionDeniedError";
  }
}

export type AuthorizedMembership = {
  workspaceId: string;
  accessLevel: AccessLevel;
};

export function hasPermission(
  accessLevel: AccessLevel,
  permission: Permission,
): boolean {
  return rolePermissions[accessLevel]?.has(permission) ?? false;
}

export function requirePermission(
  accessLevel: AccessLevel,
  permission: Permission,
): void {
  if (!hasPermission(accessLevel, permission)) {
    throw new PermissionDeniedError(permission);
  }
}

export function hasWorkspacePermission(
  memberships: readonly AuthorizedMembership[],
  workspaceId: string,
  permission: Permission,
): boolean {
  const membership = memberships.find((item) => item.workspaceId === workspaceId);
  return membership ? hasPermission(membership.accessLevel, permission) : false;
}

export function canManageAccessLevel(
  actor: AccessLevel,
  target: AccessLevel,
): boolean {
  if (actor === "OWNER") return target !== "OWNER";
  if (actor === "ADMIN") return accessRank[target] < accessRank.ADMIN;
  return false;
}

export function permissionsFor(accessLevel: AccessLevel): readonly Permission[] {
  return [...rolePermissions[accessLevel]];
}
