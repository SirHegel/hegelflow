import { cache } from "react";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import type {
  AccessLevel,
  ActivityItem,
  BoardColumn,
  BoardData,
  Label,
  Person,
  Sprint,
  TaskCard,
  WorkspaceContext,
} from "@/lib/types";

export const getWorkspaceContext = cache(async (userId: string): Promise<WorkspaceContext | null> => {
  const sql = db();
  const [row] = await sql<WorkspaceContext[]>`
    SELECT
      u.id AS "userId",
      u.username AS "username",
      w.id AS "workspaceId",
      w.name AS "workspaceName",
      w.slug AS "workspaceSlug",
      w.logo_mark AS "workspaceLogo",
      m.id AS "membershipId",
      m.full_name AS "fullName",
      m.work_role AS "workRole",
      m.access_level AS "accessLevel",
      m.avatar_color AS "avatarColor"
    FROM memberships m
    JOIN users u ON u.id = m.user_id
    JOIN workspaces w ON w.id = m.workspace_id
    WHERE u.id = ${userId}
      AND u.status = 'ACTIVE'
      AND m.status = 'ACTIVE'
    ORDER BY m.created_at
    LIMIT 1
  `;
  return row ?? null;
});

export async function getWorkspaceBoards(workspaceId: string, membershipId: string, accessLevel: AccessLevel) {
  const sql = db();
  const canSeeAllBoards = accessLevel === "OWNER" || accessLevel === "ADMIN";
  return sql<{
    id: string;
    name: string;
    slug: string;
    description: string;
    methodology: "KANBAN" | "SCRUM" | "HYBRID";
    color: string;
    openTasks: number;
    completedTasks: number;
  }[]>`
    SELECT
      b.id,
      b.name,
      b.slug,
      COALESCE(b.description, '') AS description,
      b.methodology,
      b.color,
      COUNT(t.id) FILTER (WHERE t.completed_at IS NULL AND t.archived_at IS NULL)::int AS "openTasks",
      COUNT(t.id) FILTER (WHERE t.completed_at IS NOT NULL AND t.archived_at IS NULL)::int AS "completedTasks"
    FROM boards b
    LEFT JOIN tasks t ON t.board_id = b.id
    WHERE b.workspace_id = ${workspaceId}
      AND b.archived_at IS NULL
      AND (
        ${canSeeAllBoards}
        OR
        b.visibility = 'WORKSPACE'
        OR b.created_by = ${membershipId}
        OR EXISTS (
          SELECT 1 FROM board_members bm
          WHERE bm.board_id = b.id AND bm.membership_id = ${membershipId}
        )
      )
    GROUP BY b.id
    ORDER BY b.created_at
  `;
}

export async function getDashboardData(workspaceId: string, membershipId: string, accessLevel: AccessLevel) {
  const sql = db();
  const canSeeAllBoards = accessLevel === "OWNER" || accessLevel === "ADMIN";
  const [metrics] = await sql<{
    totalOpen: number;
    inProgress: number;
    completedThisWeek: number;
    overdue: number;
    sprintPoints: number;
    completedSprintPoints: number;
  }[]>`
    SELECT
      COUNT(t.id) FILTER (
        WHERE t.completed_at IS NULL AND t.archived_at IS NULL
      )::int AS "totalOpen",
      COUNT(t.id) FILTER (
        WHERE c.category IN ('IN_PROGRESS', 'REVIEW') AND t.archived_at IS NULL
      )::int AS "inProgress",
      COUNT(t.id) FILTER (
        WHERE t.completed_at >= DATE_TRUNC('week', NOW()) AND t.archived_at IS NULL
      )::int AS "completedThisWeek",
      COUNT(t.id) FILTER (
        WHERE t.due_date < CURRENT_DATE AND t.completed_at IS NULL AND t.archived_at IS NULL
      )::int AS overdue,
      COALESCE(SUM(t.story_points) FILTER (
        WHERE s.status = 'ACTIVE' AND t.archived_at IS NULL
      ), 0)::int AS "sprintPoints",
      COALESCE(SUM(t.story_points) FILTER (
        WHERE s.status = 'ACTIVE' AND t.completed_at IS NOT NULL AND t.archived_at IS NULL
      ), 0)::int AS "completedSprintPoints"
    FROM boards b
    LEFT JOIN tasks t ON t.board_id = b.id
    LEFT JOIN board_columns c ON c.id = t.column_id
    LEFT JOIN sprints s ON s.id = t.sprint_id
    WHERE b.workspace_id = ${workspaceId}
      AND b.archived_at IS NULL
      AND (
        ${canSeeAllBoards}
        OR
        b.visibility = 'WORKSPACE'
        OR b.created_by = ${membershipId}
        OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.membership_id = ${membershipId})
      )
  `;

  const [activeSprint] = await sql<{
    id: string;
    name: string;
    goal: string | null;
    startDate: string | null;
    endDate: string | null;
    daysRemaining: number;
  }[]>`
    SELECT
      id,
      name,
      goal,
      start_date::text AS "startDate",
      end_date::text AS "endDate",
      GREATEST((end_date - CURRENT_DATE), 0)::int AS "daysRemaining"
    FROM sprints s
    WHERE s.workspace_id = ${workspaceId}
      AND s.status = 'ACTIVE'
      AND (
        s.board_id IS NULL
        OR EXISTS (
          SELECT 1 FROM boards b
          WHERE b.id = s.board_id
            AND b.archived_at IS NULL
            AND (
              ${canSeeAllBoards}
              OR
              b.visibility = 'WORKSPACE'
              OR b.created_by = ${membershipId}
              OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.membership_id = ${membershipId})
            )
        )
      )
    LIMIT 1
  `;

  const workload = await sql<{
    id: string;
    fullName: string;
    workRole: string;
    avatarColor: string;
    capacityPoints: number;
    assignedPoints: number;
    taskCount: number;
  }[]>`
    SELECT
      m.id,
      m.full_name AS "fullName",
      m.work_role AS "workRole",
      m.avatar_color AS "avatarColor",
      m.capacity_points AS "capacityPoints",
      COALESCE(SUM(t.story_points) FILTER (
        WHERE t.completed_at IS NULL AND t.archived_at IS NULL
      ), 0)::int AS "assignedPoints",
      COUNT(t.id) FILTER (
        WHERE t.completed_at IS NULL AND t.archived_at IS NULL
      )::int AS "taskCount"
    FROM memberships m
    LEFT JOIN task_assignees ta ON ta.membership_id = m.id
    LEFT JOIN tasks t ON t.id = ta.task_id AND EXISTS (
      SELECT 1 FROM boards b
      WHERE b.id = t.board_id
        AND b.archived_at IS NULL
        AND (
          ${canSeeAllBoards}
          OR
          b.visibility = 'WORKSPACE'
          OR b.created_by = ${membershipId}
          OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.membership_id = ${membershipId})
        )
    )
    WHERE m.workspace_id = ${workspaceId} AND m.status = 'ACTIVE'
    GROUP BY m.id
    ORDER BY m.full_name
  `;

  const dueSoon = await sql<{
    id: string;
    key: string;
    title: string;
    dueDate: string;
    priority: string;
    boardId: string;
    assigneeName: string | null;
  }[]>`
    SELECT
      t.id,
      CONCAT(UPPER(LEFT(b.slug, 3)), '-', t.task_number) AS key,
      t.title,
      t.due_date::text AS "dueDate",
      t.priority,
      b.id AS "boardId",
      MIN(m.full_name) AS "assigneeName"
    FROM tasks t
    JOIN boards b ON b.id = t.board_id
    LEFT JOIN task_assignees ta ON ta.task_id = t.id
    LEFT JOIN memberships m ON m.id = ta.membership_id
    WHERE b.workspace_id = ${workspaceId}
      AND b.archived_at IS NULL
      AND (
        ${canSeeAllBoards}
        OR
        b.visibility = 'WORKSPACE'
        OR b.created_by = ${membershipId}
        OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.membership_id = ${membershipId})
      )
      AND t.due_date IS NOT NULL
      AND t.completed_at IS NULL
      AND t.archived_at IS NULL
    GROUP BY t.id, b.id
    ORDER BY t.due_date
    LIMIT 6
  `;

  return {
    metrics: metrics ?? {
      totalOpen: 0,
      inProgress: 0,
      completedThisWeek: 0,
      overdue: 0,
      sprintPoints: 0,
      completedSprintPoints: 0,
    },
    activeSprint: activeSprint ?? null,
    workload,
    dueSoon,
    boards: await getWorkspaceBoards(workspaceId, membershipId, accessLevel),
  };
}

export async function getBoardData(
  boardId: string,
  workspaceId: string,
  membershipId: string,
  accessLevel: AccessLevel,
): Promise<BoardData | null> {
  const sql = db();
  const canSeeAllBoards = accessLevel === "OWNER" || accessLevel === "ADMIN";
  const [board] = await sql<BoardData["board"][]>`
    SELECT
      id,
      name,
      slug,
      COALESCE(description, '') AS description,
      methodology,
      color
    FROM boards
    WHERE id = ${boardId}
      AND workspace_id = ${workspaceId}
      AND archived_at IS NULL
      AND (
        ${canSeeAllBoards}
        OR
        visibility = 'WORKSPACE'
        OR created_by = ${membershipId}
        OR EXISTS (
          SELECT 1 FROM board_members bm
          WHERE bm.board_id = boards.id AND bm.membership_id = ${membershipId}
        )
      )
    LIMIT 1
  `;
  if (!board) return null;

  const [columns, tasks, members, labels, sprints] = await Promise.all([
    sql<BoardColumn[]>`
      SELECT
        id,
        name,
        category,
        position::float8 AS position,
        wip_limit AS "wipLimit",
        color
      FROM board_columns
      WHERE board_id = ${boardId}
      ORDER BY position
    `,
    sql<TaskCard[]>`
      SELECT
        t.id,
        t.board_id AS "boardId",
        t.column_id AS "columnId",
        t.sprint_id AS "sprintId",
        CONCAT(UPPER(LEFT(b.slug, 3)), '-', t.task_number) AS key,
        t.task_number AS "taskNumber",
        t.title,
        t.description,
        t.task_type AS "taskType",
        t.priority,
        t.position::float8 AS position,
        t.story_points AS "storyPoints",
        t.estimate_minutes AS "estimateMinutes",
        t.start_date::text AS "startDate",
        t.due_date::text AS "dueDate",
        t.completed_at::text AS "completedAt",
        t.created_at::text AS "createdAt",
        t.updated_at::text AS "updatedAt",
        t.version,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', m.id,
            'fullName', m.full_name,
            'workRole', m.work_role,
            'accessLevel', m.access_level,
            'avatarColor', m.avatar_color,
            'status', m.status,
            'capacityPoints', m.capacity_points
          ) ORDER BY m.full_name)
          FROM task_assignees ta
          JOIN memberships m ON m.id = ta.membership_id
          WHERE ta.task_id = t.id
        ), '[]'::jsonb) AS assignees,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', l.id, 'name', l.name, 'color', l.color
          ) ORDER BY l.name)
          FROM task_labels tl
          JOIN labels l ON l.id = tl.label_id
          WHERE tl.task_id = t.id
        ), '[]'::jsonb) AS labels,
        (SELECT COUNT(*)::int FROM checklist_items ci JOIN checklists cl ON cl.id = ci.checklist_id WHERE cl.task_id = t.id) AS "checklistTotal",
        (SELECT COUNT(*)::int FROM checklist_items ci JOIN checklists cl ON cl.id = ci.checklist_id WHERE cl.task_id = t.id AND ci.is_complete) AS "checklistDone",
        (SELECT COUNT(*)::int FROM comments co WHERE co.task_id = t.id AND co.deleted_at IS NULL) AS "commentCount",
        (SELECT COUNT(*)::int FROM task_dependencies td JOIN tasks blocker ON blocker.id = td.depends_on_task_id WHERE td.task_id = t.id AND blocker.completed_at IS NULL) AS "blockerCount"
      FROM tasks t
      JOIN boards b ON b.id = t.board_id
      WHERE t.board_id = ${boardId} AND t.archived_at IS NULL
      ORDER BY t.column_id, t.position, t.created_at
    `,
    sql<Person[]>`
      SELECT
        id,
        full_name AS "fullName",
        work_role AS "workRole",
        access_level AS "accessLevel",
        avatar_color AS "avatarColor",
        status,
        capacity_points AS "capacityPoints",
        (user_id IS NOT NULL) AS "hasAccount"
      FROM memberships
      WHERE workspace_id = ${workspaceId} AND status <> 'DISABLED'
      ORDER BY full_name
    `,
    sql<Label[]>`
      SELECT id, name, color
      FROM labels
      WHERE workspace_id = ${workspaceId}
      ORDER BY name
    `,
    sql<Sprint[]>`
      SELECT
        id,
        name,
        goal,
        status,
        start_date::text AS "startDate",
        end_date::text AS "endDate",
        completed_at::text AS "completedAt"
      FROM sprints
      WHERE workspace_id = ${workspaceId}
        AND (board_id = ${boardId} OR board_id IS NULL)
      ORDER BY
        CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PLANNED' THEN 1 ELSE 2 END,
        start_date DESC NULLS LAST
    `,
  ]);

  return { board, columns, tasks, members, labels, sprints };
}

export async function getBacklogData(workspaceId: string, membershipId: string, accessLevel: AccessLevel) {
  const boards = await getWorkspaceBoards(workspaceId, membershipId, accessLevel);
  if (!boards[0]) return { board: null, tasks: [], sprints: [], members: [] };
  const data = await getBoardData(boards[0].id, workspaceId, membershipId, accessLevel);
  if (!data) return { board: null, tasks: [], sprints: [], members: [] };
  return {
    board: data.board,
    tasks: data.tasks,
    sprints: data.sprints,
    members: data.members,
  };
}

export async function getActivity(
  workspaceId: string,
  membershipId: string,
  accessLevel: AccessLevel,
  limit = 50,
): Promise<ActivityItem[]> {
  const sql = db();
  const canSeeAllBoards = accessLevel === "OWNER" || accessLevel === "ADMIN";
  const canReadAutomations = hasPermission(accessLevel, "automation.read");
  return sql<ActivityItem[]>`
    SELECT
      a.id,
      a.action,
      a.summary,
      a.entity_type AS "entityType",
      a.entity_id AS "entityId",
      a.created_at::text AS "createdAt",
      m.full_name AS "actorName",
      m.avatar_color AS "actorColor"
    FROM activity_log a
    LEFT JOIN memberships m ON m.id = a.actor_id
    WHERE a.workspace_id = ${workspaceId}
      AND (a.entity_type <> 'automation_rule' OR ${canReadAutomations})
      AND (
        a.board_id IS NULL
        OR ${canSeeAllBoards}
        OR EXISTS (
          SELECT 1
          FROM boards b
          WHERE b.id = a.board_id
            AND b.workspace_id = ${workspaceId}
            AND (
              b.visibility = 'WORKSPACE'
              OR b.created_by = ${membershipId}
              OR EXISTS (
                SELECT 1
                FROM board_members bm
                WHERE bm.board_id = b.id
                  AND bm.membership_id = ${membershipId}
              )
            )
        )
      )
    ORDER BY a.created_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 200)}
  `;
}

export async function getTeamData(workspaceId: string, membershipId: string, accessLevel: AccessLevel) {
  const sql = db();
  const canSeeAllBoards = accessLevel === "OWNER" || accessLevel === "ADMIN";
  return sql<{
    id: string;
    fullName: string;
    workRole: string;
    accessLevel: string;
    status: string;
    avatarColor: string;
    capacityPoints: number;
    hasAccount: boolean;
    openTasks: number;
    activePoints: number;
    completedTasks: number;
  }[]>`
    SELECT
      m.id,
      m.full_name AS "fullName",
      m.work_role AS "workRole",
      m.access_level AS "accessLevel",
      m.status,
      m.avatar_color AS "avatarColor",
      m.capacity_points AS "capacityPoints",
      (m.user_id IS NOT NULL) AS "hasAccount",
      COUNT(t.id) FILTER (WHERE t.completed_at IS NULL AND t.archived_at IS NULL)::int AS "openTasks",
      COALESCE(SUM(t.story_points) FILTER (WHERE t.completed_at IS NULL AND t.archived_at IS NULL), 0)::int AS "activePoints",
      COUNT(t.id) FILTER (WHERE t.completed_at IS NOT NULL AND t.archived_at IS NULL)::int AS "completedTasks"
    FROM memberships m
    LEFT JOIN task_assignees ta ON ta.membership_id = m.id
    LEFT JOIN tasks t ON t.id = ta.task_id AND EXISTS (
      SELECT 1 FROM boards b
      WHERE b.id = t.board_id
        AND b.archived_at IS NULL
        AND (
          ${canSeeAllBoards}
          OR
          b.visibility = 'WORKSPACE'
          OR b.created_by = ${membershipId}
          OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.membership_id = ${membershipId})
        )
    )
    WHERE m.workspace_id = ${workspaceId}
    GROUP BY m.id
    ORDER BY
      CASE m.access_level WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,
      m.full_name
  `;
}

export async function getReportData(workspaceId: string, membershipId: string, accessLevel: AccessLevel) {
  const sql = db();
  const canSeeAllBoards = accessLevel === "OWNER" || accessLevel === "ADMIN";
  const [statusBreakdown, velocity, priorityBreakdown, cycleTime, burndown] = await Promise.all([
    sql<{ name: string; value: number; color: string }[]>`
      SELECT c.name, COUNT(t.id)::int AS value, c.color
      FROM board_columns c
      JOIN boards b ON b.id = c.board_id
      LEFT JOIN tasks t ON t.column_id = c.id AND t.archived_at IS NULL
      WHERE b.workspace_id = ${workspaceId}
        AND b.archived_at IS NULL
        AND (
          ${canSeeAllBoards}
          OR
          b.visibility = 'WORKSPACE'
          OR b.created_by = ${membershipId}
          OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.membership_id = ${membershipId})
        )
      GROUP BY c.id
      ORDER BY c.position
    `,
    sql<{ name: string; committed: number; completed: number }[]>`
      SELECT
        s.name,
        COALESCE(SUM(initial_scope.story_points), 0)::int AS committed,
        COALESCE(SUM(t.story_points) FILTER (WHERE t.completed_at IS NOT NULL), 0)::int AS completed
      FROM sprints s
      LEFT JOIN tasks t ON t.sprint_id = s.id
        AND t.archived_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM boards tb
          WHERE tb.id = t.board_id
            AND tb.workspace_id = ${workspaceId}
            AND tb.archived_at IS NULL
            AND (
              ${canSeeAllBoards}
              OR tb.visibility = 'WORKSPACE'
              OR tb.created_by = ${membershipId}
              OR EXISTS (
                SELECT 1 FROM board_members bm
                WHERE bm.board_id = tb.id AND bm.membership_id = ${membershipId}
              )
            )
        )
      LEFT JOIN LATERAL (
        SELECT tr.story_points_at_event AS story_points
        FROM task_transitions tr
        WHERE tr.task_id = t.id AND tr.to_sprint_id = s.id
        ORDER BY tr.occurred_at
        LIMIT 1
      ) initial_scope ON TRUE
      LEFT JOIN boards sb ON sb.id = s.board_id
      WHERE s.workspace_id = ${workspaceId}
        AND s.status = 'COMPLETED'
        AND (
          s.board_id IS NULL
          OR (
            sb.archived_at IS NULL
            AND (
              ${canSeeAllBoards}
              OR
              sb.visibility = 'WORKSPACE'
              OR sb.created_by = ${membershipId}
              OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = sb.id AND bm.membership_id = ${membershipId})
            )
          )
        )
      GROUP BY s.id
      ORDER BY s.end_date DESC
      LIMIT 8
    `,
    sql<{ name: string; value: number }[]>`
      SELECT t.priority AS name, COUNT(*)::int AS value
      FROM tasks t
      JOIN boards b ON b.id = t.board_id
      WHERE b.workspace_id = ${workspaceId}
        AND t.archived_at IS NULL
        AND (
          ${canSeeAllBoards}
          OR
          b.visibility = 'WORKSPACE'
          OR b.created_by = ${membershipId}
          OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.membership_id = ${membershipId})
        )
      GROUP BY t.priority
      ORDER BY CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END
    `,
    sql<{ averageDays: number; p85Days: number }[]>`
      WITH cycle AS (
        SELECT
          t.id,
          EXTRACT(EPOCH FROM (t.completed_at - MIN(tr.occurred_at))) / 86400 AS days
        FROM tasks t
        JOIN boards b ON b.id = t.board_id
        JOIN task_transitions tr ON tr.task_id = t.id
        JOIN board_columns c ON c.id = tr.to_column_id
        WHERE b.workspace_id = ${workspaceId}
          AND (
            ${canSeeAllBoards}
            OR
            b.visibility = 'WORKSPACE'
            OR b.created_by = ${membershipId}
            OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.membership_id = ${membershipId})
          )
          AND t.completed_at IS NOT NULL
          AND c.category = 'IN_PROGRESS'
        GROUP BY t.id
      )
      SELECT
        COALESCE(ROUND(AVG(days)::numeric, 1), 0)::float8 AS "averageDays",
        COALESCE(ROUND(PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY days)::numeric, 1), 0)::float8 AS "p85Days"
      FROM cycle
    `,
    sql<{ day: string; ideal: number; remaining: number }[]>`
      WITH active AS (
        SELECT s.id, s.start_date, s.end_date
        FROM sprints s
        LEFT JOIN boards b ON b.id = s.board_id
        WHERE s.workspace_id = ${workspaceId}
          AND s.status = 'ACTIVE'
          AND (
            s.board_id IS NULL
            OR (
              b.archived_at IS NULL
              AND (
                ${canSeeAllBoards}
                OR
                b.visibility = 'WORKSPACE'
                OR b.created_by = ${membershipId}
                OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.membership_id = ${membershipId})
              )
            )
          )
        ORDER BY (s.board_id IS NULL) DESC, s.start_date DESC NULLS LAST, s.id
        LIMIT 1
      ), scope AS (
        SELECT a.*, COALESCE(SUM(t.story_points), 0)::float8 AS points
        FROM active a
        LEFT JOIN tasks t ON t.sprint_id = a.id
          AND t.archived_at IS NULL
          AND EXISTS (
            SELECT 1
            FROM boards tb
            WHERE tb.id = t.board_id
              AND tb.workspace_id = ${workspaceId}
              AND tb.archived_at IS NULL
              AND (
                ${canSeeAllBoards}
                OR tb.visibility = 'WORKSPACE'
                OR tb.created_by = ${membershipId}
                OR EXISTS (
                  SELECT 1 FROM board_members bm
                  WHERE bm.board_id = tb.id AND bm.membership_id = ${membershipId}
                )
              )
          )
        GROUP BY a.id, a.start_date, a.end_date
      ), days AS (
        SELECT s.*, day::date
        FROM scope s, LATERAL generate_series(s.start_date, s.end_date, interval '1 day') day
      )
      SELECT
        d.day::text AS day,
        ROUND((d.points * GREATEST((d.end_date - d.day), 0) / GREATEST((d.end_date - d.start_date), 1))::numeric, 1)::float8 AS ideal,
        GREATEST(d.points - COALESCE((
          SELECT SUM(t.story_points)
          FROM tasks t
          JOIN boards tb ON tb.id = t.board_id
          WHERE t.sprint_id = d.id
            AND t.completed_at IS NOT NULL
            AND t.completed_at::date <= d.day
            AND t.archived_at IS NULL
            AND tb.workspace_id = ${workspaceId}
            AND tb.archived_at IS NULL
            AND (
              ${canSeeAllBoards}
              OR tb.visibility = 'WORKSPACE'
              OR tb.created_by = ${membershipId}
              OR EXISTS (
                SELECT 1 FROM board_members bm
                WHERE bm.board_id = tb.id AND bm.membership_id = ${membershipId}
              )
            )
        ), 0), 0)::float8 AS remaining
      FROM days d
      ORDER BY d.day
    `,
  ]);

  return {
    statusBreakdown,
    velocity: [...velocity].reverse(),
    priorityBreakdown,
    cycleTime: cycleTime[0] ?? { averageDays: 0, p85Days: 0 },
    burndown,
  };
}

export async function getSettingsData(
  workspaceId: string,
  membershipId: string,
  accessLevel: AccessLevel,
) {
  const sql = db();
  const canSeeAllBoards = accessLevel === "OWNER" || accessLevel === "ADMIN";
  const canReadAutomations = hasPermission(accessLevel, "automation.read");
  const [rules, customFields, savedViews] = await Promise.all([
    sql<{
      id: string;
      name: string;
      triggerType: string;
      actionType: string;
      isEnabled: boolean;
      runCount: number;
      lastRunAt: string | null;
    }[]>`
      SELECT
        ar.id,
        ar.name,
        ar.trigger_type AS "triggerType",
        ar.action_type AS "actionType",
        ar.is_enabled AS "isEnabled",
        ar.run_count AS "runCount",
        ar.last_run_at::text AS "lastRunAt"
      FROM automation_rules ar
      LEFT JOIN boards b ON b.id = ar.board_id
      WHERE ar.workspace_id = ${workspaceId}
        AND ${canReadAutomations}
        AND (
          ar.board_id IS NULL
          OR ${canSeeAllBoards}
          OR (
            b.workspace_id = ${workspaceId}
            AND b.archived_at IS NULL
            AND (
              b.visibility = 'WORKSPACE'
              OR b.created_by = ${membershipId}
              OR EXISTS (
                SELECT 1
                FROM board_members bm
                WHERE bm.board_id = b.id
                  AND bm.membership_id = ${membershipId}
              )
            )
          )
        )
      ORDER BY ar.created_at
    `,
    sql<{
      id: string;
      name: string;
      fieldType: string;
      isRequired: boolean;
    }[]>`
      SELECT id, name, field_type AS "fieldType", is_required AS "isRequired"
      FROM custom_fields
      WHERE workspace_id = ${workspaceId}
      ORDER BY position
    `,
    sql<{
      id: string;
      name: string;
      viewType: string;
      isShared: boolean;
    }[]>`
      SELECT id, name, view_type AS "viewType", is_shared AS "isShared"
      FROM saved_views
      WHERE workspace_id = ${workspaceId}
        AND (
          owner_id = ${membershipId}
          OR is_shared
        )
      ORDER BY created_at DESC
    `,
  ]);
  return { rules, customFields, savedViews };
}
