import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getActivity, getReportData, getSettingsData, getWorkspaceBoards } from "@/lib/data";
import { prepareDatabaseConnection } from "@/lib/database-url";
import { db } from "@/lib/db";
import { createTask, moveTask, updateTask } from "@/lib/domain/tasks";
import type { WorkspaceContext } from "@/lib/types";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL es obligatorio para las pruebas de integración.");

const connection = prepareDatabaseConnection(databaseUrl);
const fixtureSql = postgres(connection.url, {
  max: 1,
  prepare: false,
  ssl: connection.ssl,
});

const ids: Record<string, string> = {};
let ownerContext!: WorkspaceContext;
let memberContext!: WorkspaceContext;

function taskInput(boardId: string, columnId: string, title: string, storyPoints = 3) {
  return {
    boardId,
    columnId,
    sprintId: null,
    title,
    description: "Prueba de integración aislada.",
    taskType: "TASK" as const,
    priority: "MEDIUM" as const,
    storyPoints,
    estimateMinutes: null,
    startDate: null,
    dueDate: null,
    parentTaskId: null,
    assigneeIds: [],
    labelIds: [],
  };
}

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  const [ownerUser, memberUser, outsiderUser] = await Promise.all([
    fixtureSql<{ id: string }[]>`
      INSERT INTO users (username, display_name, status)
      VALUES (${`audit-owner-${suffix}`}, 'Audit Owner', 'ACTIVE') RETURNING id
    `,
    fixtureSql<{ id: string }[]>`
      INSERT INTO users (username, display_name, status)
      VALUES (${`audit-member-${suffix}`}, 'Audit Member', 'ACTIVE') RETURNING id
    `,
    fixtureSql<{ id: string }[]>`
      INSERT INTO users (username, display_name, status)
      VALUES (${`audit-outsider-${suffix}`}, 'Audit Outsider', 'ACTIVE') RETURNING id
    `,
  ]);

  ids.ownerUser = ownerUser[0]!.id;
  ids.memberUser = memberUser[0]!.id;
  ids.outsiderUser = outsiderUser[0]!.id;

  const [workspace] = await fixtureSql<{ id: string }[]>`
    INSERT INTO workspaces (name, slug)
    VALUES ('Audit Workspace', ${`audit-${suffix}`}) RETURNING id
  `;
  const [otherWorkspace] = await fixtureSql<{ id: string }[]>`
    INSERT INTO workspaces (name, slug)
    VALUES ('Other Workspace', ${`audit-other-${suffix}`}) RETURNING id
  `;
  ids.workspace = workspace!.id;
  ids.otherWorkspace = otherWorkspace!.id;

  const [owner] = await fixtureSql<{ id: string }[]>`
    INSERT INTO memberships (
      workspace_id, user_id, profile_slug, full_name, work_role, access_level, status
    ) VALUES (
      ${ids.workspace}, ${ids.ownerUser}, 'audit-owner', 'Audit Owner', 'CEO', 'OWNER', 'ACTIVE'
    ) RETURNING id
  `;
  const [member] = await fixtureSql<{ id: string }[]>`
    INSERT INTO memberships (
      workspace_id, user_id, profile_slug, full_name, work_role, access_level, status
    ) VALUES (
      ${ids.workspace}, ${ids.memberUser}, 'audit-member', 'Audit Member', 'Developer', 'MEMBER', 'ACTIVE'
    ) RETURNING id
  `;
  const [outsider] = await fixtureSql<{ id: string }[]>`
    INSERT INTO memberships (
      workspace_id, user_id, profile_slug, full_name, work_role, access_level, status
    ) VALUES (
      ${ids.otherWorkspace}, ${ids.outsiderUser}, 'audit-outsider', 'Audit Outsider', 'Developer', 'OWNER', 'ACTIVE'
    ) RETURNING id
  `;
  ids.owner = owner!.id;
  ids.member = member!.id;
  ids.outsider = outsider!.id;

  const [publicBoard] = await fixtureSql<{ id: string }[]>`
    INSERT INTO boards (workspace_id, name, slug, visibility, created_by, next_task_number)
    VALUES (${ids.workspace}, 'Public Audit Board', ${`public-${suffix}`}, 'WORKSPACE', ${ids.owner}, 1)
    RETURNING id
  `;
  const [privateBoard] = await fixtureSql<{ id: string }[]>`
    INSERT INTO boards (workspace_id, name, slug, visibility, created_by, next_task_number)
    VALUES (${ids.workspace}, 'Private Audit Board', ${`private-${suffix}`}, 'PRIVATE', ${ids.owner}, 1)
    RETURNING id
  `;
  const [otherBoard] = await fixtureSql<{ id: string }[]>`
    INSERT INTO boards (workspace_id, name, slug, visibility, created_by, next_task_number)
    VALUES (${ids.otherWorkspace}, 'Other Audit Board', ${`other-${suffix}`}, 'PRIVATE', ${ids.outsider}, 1)
    RETURNING id
  `;
  ids.publicBoard = publicBoard!.id;
  ids.privateBoard = privateBoard!.id;
  ids.otherBoard = otherBoard!.id;

  await fixtureSql`
    INSERT INTO board_members (board_id, membership_id, access_level)
    VALUES
      (${ids.publicBoard}, ${ids.owner}, 'ADMIN'),
      (${ids.privateBoard}, ${ids.owner}, 'ADMIN'),
      (${ids.otherBoard}, ${ids.outsider}, 'ADMIN')
  `;

  const columns = await fixtureSql<{ id: string; boardId: string; category: string }[]>`
    INSERT INTO board_columns (board_id, name, category, position, wip_limit, color)
    VALUES
      (${ids.publicBoard}, 'Backlog', 'BACKLOG', 1000, NULL, '#64748b'),
      (${ids.publicBoard}, 'En curso', 'IN_PROGRESS', 2000, 1, '#f59e0b'),
      (${ids.privateBoard}, 'Backlog', 'BACKLOG', 1000, NULL, '#64748b'),
      (${ids.otherBoard}, 'Backlog', 'BACKLOG', 1000, NULL, '#64748b')
    RETURNING id, board_id AS "boardId", category
  `;
  ids.publicBacklog = columns.find((row) => row.boardId === ids.publicBoard && row.category === "BACKLOG")!.id;
  ids.publicProgress = columns.find((row) => row.boardId === ids.publicBoard && row.category === "IN_PROGRESS")!.id;
  ids.privateBacklog = columns.find((row) => row.boardId === ids.privateBoard)!.id;
  ids.otherBacklog = columns.find((row) => row.boardId === ids.otherBoard)!.id;

  const [completedSprint] = await fixtureSql<{ id: string }[]>`
    INSERT INTO sprints (workspace_id, name, status, start_date, end_date, completed_at)
    VALUES (${ids.workspace}, 'Audit Sprint', 'COMPLETED', CURRENT_DATE - 14, CURRENT_DATE - 1, NOW())
    RETURNING id
  `;
  ids.completedSprint = completedSprint!.id;

  const [publicReportTask] = await fixtureSql<{ id: string }[]>`
    INSERT INTO tasks (
      board_id, column_id, sprint_id, task_number, title, story_points,
      position, completed_at, reporter_id
    ) VALUES (
      ${ids.publicBoard}, ${ids.publicBacklog}, ${ids.completedSprint}, 50,
      'Visible report task', 3, 50_000, NOW(), ${ids.owner}
    ) RETURNING id
  `;
  const [privateReportTask] = await fixtureSql<{ id: string }[]>`
    INSERT INTO tasks (
      board_id, column_id, sprint_id, task_number, title, story_points,
      position, completed_at, reporter_id
    ) VALUES (
      ${ids.privateBoard}, ${ids.privateBacklog}, ${ids.completedSprint}, 51,
      'Private report task', 8, 51_000, NOW(), ${ids.owner}
    ) RETURNING id
  `;
  ids.publicReportTask = publicReportTask!.id;
  ids.privateReportTask = privateReportTask!.id;

  await fixtureSql`
    INSERT INTO task_transitions (
      task_id, to_column_id, to_sprint_id, actor_id, event_type, story_points_at_event
    ) VALUES
      (${ids.publicReportTask}, ${ids.publicBacklog}, ${ids.completedSprint}, ${ids.owner}, 'CREATED', 3),
      (${ids.privateReportTask}, ${ids.privateBacklog}, ${ids.completedSprint}, ${ids.owner}, 'CREATED', 8)
  `;

  const [rule] = await fixtureSql<{ id: string }[]>`
    INSERT INTO automation_rules (
      workspace_id, board_id, name, trigger_type, action_type
    ) VALUES (
      ${ids.workspace}, ${ids.publicBoard}, 'Private automation metadata', 'TASK_MOVED', 'SET_COMPLETED_AT'
    ) RETURNING id
  `;
  ids.rule = rule!.id;
  await fixtureSql`
    INSERT INTO activity_log (
      workspace_id, board_id, actor_id, entity_type, entity_id, action, summary
    ) VALUES (
      ${ids.workspace}, ${ids.publicBoard}, ${ids.owner}, 'automation_rule', ${ids.rule},
      'automation.enabled', 'Sensitive automation name'
    )
  `;

  await fixtureSql`
    INSERT INTO saved_views (workspace_id, owner_id, name, view_type, is_shared)
    VALUES
      (${ids.workspace}, ${ids.owner}, 'Owner private view', 'TABLE', FALSE),
      (${ids.workspace}, ${ids.member}, 'Member private view', 'TABLE', FALSE),
      (${ids.workspace}, ${ids.member}, 'Member shared view', 'TABLE', TRUE)
  `;

  ownerContext = {
    userId: ids.ownerUser,
    username: `audit-owner-${suffix}`,
    workspaceId: ids.workspace,
    workspaceName: "Audit Workspace",
    workspaceSlug: `audit-${suffix}`,
    workspaceLogo: "HF",
    membershipId: ids.owner,
    fullName: "Audit Owner",
    workRole: "CEO",
    accessLevel: "OWNER",
    avatarColor: "#6d5dfc",
  };
  memberContext = {
    ...ownerContext,
    userId: ids.memberUser,
    username: `audit-member-${suffix}`,
    membershipId: ids.member,
    fullName: "Audit Member",
    workRole: "Developer",
    accessLevel: "MEMBER",
  };
});

afterAll(async () => {
  await db().end();
  await fixtureSql.end();
});

describe("PostgreSQL domain integration", () => {
  it("applies PRIVATE board ACLs to reads and writes", async () => {
    const memberBoards = await getWorkspaceBoards(ids.workspace, ids.member, "MEMBER");
    const ownerBoards = await getWorkspaceBoards(ids.workspace, ids.owner, "OWNER");

    expect(memberBoards.map((board) => board.id)).toContain(ids.publicBoard);
    expect(memberBoards.map((board) => board.id)).not.toContain(ids.privateBoard);
    expect(ownerBoards.map((board) => board.id)).toContain(ids.privateBoard);

    await expect(
      createTask(memberContext, taskInput(ids.privateBoard, ids.privateBacklog, "Denied private task")),
    ).rejects.toMatchObject({ status: 403, code: "PRIVATE_BOARD_ACCESS_DENIED" });
  });

  it("keeps a task edit and sprint assignment atomic", async () => {
    const task = await createTask(
      ownerContext,
      taskInput(ids.publicBoard, ids.publicBacklog, "Atomic original"),
    );
    const invalidSprint = randomUUID();

    await expect(
      updateTask(ownerContext, {
        taskId: task.id,
        expectedVersion: task.version,
        title: "Must roll back",
        sprintId: invalidSprint,
      }),
    ).rejects.toMatchObject({ status: 422, code: "INVALID_SPRINT" });

    const [persisted] = await fixtureSql<{ title: string; sprintId: string | null; version: number }[]>`
      SELECT title, sprint_id AS "sprintId", version FROM tasks WHERE id = ${task.id}
    `;
    expect(persisted).toEqual({ title: "Atomic original", sprintId: null, version: task.version });
  });

  it("enforces WIP and optimistic versions transactionally", async () => {
    await createTask(
      ownerContext,
      taskInput(ids.publicBoard, ids.publicProgress, "WIP occupant"),
    );
    const candidate = await createTask(
      ownerContext,
      taskInput(ids.publicBoard, ids.publicBacklog, "WIP candidate"),
    );

    await expect(
      moveTask(ownerContext, {
        taskId: candidate.id,
        toColumnId: ids.publicProgress,
        expectedVersion: candidate.version,
      }),
    ).rejects.toMatchObject({ status: 409, code: "WIP_LIMIT_REACHED" });

    const updated = await updateTask(ownerContext, {
      taskId: candidate.id,
      expectedVersion: candidate.version,
      title: "Version two",
    });
    await expect(
      updateTask(ownerContext, {
        taskId: candidate.id,
        expectedVersion: candidate.version,
        title: "Stale overwrite",
      }),
    ).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
    expect(updated.version).toBe(candidate.version + 1);
  });

  it("does not leak private sprint scope or automation metadata", async () => {
    const report = await getReportData(ids.workspace, ids.member, "MEMBER");
    const sprint = report.velocity.find((row) => row.name === "Audit Sprint");
    expect(sprint).toEqual({ name: "Audit Sprint", committed: 3, completed: 3 });

    const memberActivity = await getActivity(ids.workspace, ids.member, "MEMBER", 200);
    const ownerActivity = await getActivity(ids.workspace, ids.owner, "OWNER", 200);
    expect(memberActivity.some((event) => event.entityType === "automation_rule")).toBe(false);
    expect(ownerActivity.some((event) => event.entityType === "automation_rule")).toBe(true);

    const memberSettings = await getSettingsData(ids.workspace, ids.member, "MEMBER");
    const ownerSettings = await getSettingsData(ids.workspace, ids.owner, "OWNER");
    expect(memberSettings.rules).toEqual([]);
    expect(ownerSettings.savedViews.map((view) => view.name)).toEqual(
      expect.arrayContaining(["Owner private view", "Member shared view"]),
    );
    expect(ownerSettings.savedViews.map((view) => view.name)).not.toContain("Member private view");
  });

  it("rejects cross-workspace links at the database boundary", async () => {
    await expect(fixtureSql`
      INSERT INTO tasks (
        board_id, column_id, task_number, title, position, reporter_id
      ) VALUES (
        ${ids.publicBoard}, ${ids.otherBacklog}, 999, 'Cross-scope task', 999000, ${ids.owner}
      )
    `).rejects.toMatchObject({ code: "23514" });

    await expect(fixtureSql`
      INSERT INTO sprints (workspace_id, board_id, name, status)
      VALUES (${ids.workspace}, ${ids.otherBoard}, 'Cross-scope sprint', 'PLANNED')
    `).rejects.toMatchObject({ code: "23514" });

    await expect(fixtureSql`
      INSERT INTO automation_rules (workspace_id, board_id, name, trigger_type, action_type)
      VALUES (${ids.workspace}, ${ids.otherBoard}, 'Cross-scope rule', 'TASK_MOVED', 'SET_FIELD')
    `).rejects.toMatchObject({ code: "23514" });

    await expect(fixtureSql`
      INSERT INTO saved_views (workspace_id, owner_id, name, view_type)
      VALUES (${ids.workspace}, ${ids.outsider}, 'Cross-scope view', 'TABLE')
    `).rejects.toMatchObject({ code: "23514" });

    await expect(fixtureSql`
      INSERT INTO activity_log (workspace_id, board_id, actor_id, entity_type, action, summary)
      VALUES (${ids.workspace}, ${ids.otherBoard}, ${ids.owner}, 'board', 'invalid', 'Invalid scope')
    `).rejects.toMatchObject({ code: "23514" });
  });

  it("keeps task transitions append-only", async () => {
    const snapshots = await fixtureSql<{ workspaceId: string; boardId: string }[]>`
      SELECT workspace_id AS "workspaceId", board_id AS "boardId"
      FROM task_transitions
      WHERE task_id = ${ids.publicReportTask}
    `;
    expect(snapshots).not.toHaveLength(0);
    expect(snapshots).toEqual(
      expect.arrayContaining([{ workspaceId: ids.workspace, boardId: ids.publicBoard }]),
    );

    await expect(fixtureSql`
      UPDATE task_transitions
      SET metadata = '{"tampered":true}'::jsonb
      WHERE task_id = ${ids.publicReportTask}
    `).rejects.toThrow(/append-only/);
  });
});
