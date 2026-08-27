import { describe, expect, it } from "vitest";
import {
  canManageAccessLevel,
  hasPermission,
  PermissionDeniedError,
  requirePermission,
} from "@/lib/permissions";

describe("RBAC", () => {
  it("deniega escritura al observador", () => {
    expect(hasPermission("VIEWER", "task.read")).toBe(true);
    expect(hasPermission("VIEWER", "task.move")).toBe(false);
    expect(() => requirePermission("VIEWER", "task.move")).toThrow(PermissionDeniedError);
  });

  it("permite al miembro trabajar pero no administrar", () => {
    expect(hasPermission("MEMBER", "task.create")).toBe(true);
    expect(hasPermission("MEMBER", "sprint.manage")).toBe(false);
    expect(hasPermission("MEMBER", "audit.read")).toBe(false);
  });

  it("reserva gobierno y exportación al propietario", () => {
    expect(hasPermission("ADMIN", "data.export")).toBe(false);
    expect(hasPermission("OWNER", "data.export")).toBe(true);
    expect(hasPermission("OWNER", "workspace.delete")).toBe(true);
  });

  it("reserva la administración de credenciales al propietario", () => {
    expect(hasPermission("OWNER", "account.manage")).toBe(true);
    expect(hasPermission("ADMIN", "account.manage")).toBe(false);
    expect(hasPermission("MEMBER", "account.manage")).toBe(false);
    expect(hasPermission("VIEWER", "account.manage")).toBe(false);
  });

  it("impide escalamiento de roles por administradores", () => {
    expect(canManageAccessLevel("ADMIN", "MEMBER")).toBe(true);
    expect(canManageAccessLevel("ADMIN", "ADMIN")).toBe(false);
    expect(canManageAccessLevel("ADMIN", "OWNER")).toBe(false);
    expect(canManageAccessLevel("OWNER", "ADMIN")).toBe(true);
    expect(canManageAccessLevel("OWNER", "OWNER")).toBe(false);
    expect(canManageAccessLevel("MEMBER", "OWNER")).toBe(false);
    expect(canManageAccessLevel("VIEWER", "OWNER")).toBe(false);
  });
});
