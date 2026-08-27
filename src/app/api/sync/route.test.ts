import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentSession } from "@/lib/auth";
import { getWorkspaceContext, getWorkspaceRevision } from "@/lib/data";
import { GET } from "@/app/api/sync/route";

vi.mock("@/lib/auth", () => ({ getCurrentSession: vi.fn() }));
vi.mock("@/lib/data", () => ({
  getWorkspaceContext: vi.fn(),
  getWorkspaceRevision: vi.fn(),
}));

const currentSessionMock = vi.mocked(getCurrentSession);
const workspaceContextMock = vi.mocked(getWorkspaceContext);
const workspaceRevisionMock = vi.mocked(getWorkspaceRevision);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/sync", () => {
  it("returns 401 without an authenticated session", async () => {
    currentSessionMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
    expect(workspaceContextMock).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
  });

  it("returns 403 when the user has no active workspace", async () => {
    currentSessionMock.mockResolvedValue({ user: { id: "user-id" } } as never);
    workspaceContextMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "WORKSPACE_REQUIRED" });
    expect(workspaceRevisionMock).not.toHaveBeenCalled();
  });

  it("returns the visible workspace revision without cache", async () => {
    currentSessionMock.mockResolvedValue({ user: { id: "user-id" } } as never);
    workspaceContextMock.mockResolvedValue({
      workspaceId: "workspace-id",
      membershipId: "membership-id",
      accessLevel: "MEMBER",
    } as never);
    workspaceRevisionMock.mockResolvedValue("4:2026-08-27 12:00:00+00");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ revision: "4:2026-08-27 12:00:00+00" });
    expect(workspaceRevisionMock).toHaveBeenCalledWith(
      "workspace-id",
      "membership-id",
      "MEMBER",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  });
});
