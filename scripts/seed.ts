import bcrypt from "bcryptjs";
import postgres from "postgres";
import { prepareDatabaseConnection } from "../src/lib/database-url";

const databaseUrl = process.env.DATABASE_URL;
const configuredAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const adminUsername = process.env.BOOTSTRAP_ADMIN_USERNAME ?? "SirHegel";

if (!databaseUrl) throw new Error("DATABASE_URL es obligatorio.");
if (!configuredAdminPassword || configuredAdminPassword.length < 12) {
  throw new Error("BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 12 caracteres.");
}
const adminPassword: string = configuredAdminPassword;

const connection = prepareDatabaseConnection(databaseUrl);
const sql = postgres(connection.url, {
  max: 1,
  prepare: false,
  ssl: connection.ssl,
});

async function main() {
try {
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await sql.begin(async (tx) => {
    const [admin] = await tx<{ id: string }[]>`
      INSERT INTO users (username, display_name, password_hash, status, avatar_color)
      VALUES (${adminUsername}, 'Jhon Alvarez', ${passwordHash}, 'ACTIVE', '#6d5dfc')
      ON CONFLICT ((LOWER(username))) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          password_hash = EXCLUDED.password_hash,
          status = 'ACTIVE'
      RETURNING id
    `;

    const [workspace] = await tx<{ id: string }[]>`
      INSERT INTO workspaces (name, slug, description, logo_mark)
      VALUES ('HegelFlow Personal', 'hegelflow-personal', 'Gestión personal de producto, operaciones y colaboradores.', 'HF')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;

    const [jhon] = await tx<{ id: string }[]>`
      INSERT INTO memberships (
        workspace_id, user_id, profile_slug, full_name, work_role,
        access_level, status, avatar_color, capacity_points
      ) VALUES (
        ${workspace.id}, ${admin.id}, 'jhon-alvarez', 'Jhon Alvarez', 'CEO',
        'OWNER', 'ACTIVE', '#6d5dfc', 24
      )
      ON CONFLICT (workspace_id, profile_slug) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          full_name = EXCLUDED.full_name,
          work_role = EXCLUDED.work_role,
          access_level = EXCLUDED.access_level
      RETURNING id
    `;

    const [steven] = await tx<{ id: string }[]>`
      INSERT INTO memberships (
        workspace_id, profile_slug, full_name, work_role,
        access_level, status, avatar_color, capacity_points
      ) VALUES (
        ${workspace.id}, 'steven-vallejo', 'Steven Vallejo', 'Desarrollador',
        'MEMBER', 'ACTIVE', '#0ea5a4', 30
      )
      ON CONFLICT (workspace_id, profile_slug) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          work_role = EXCLUDED.work_role,
          access_level = EXCLUDED.access_level
      RETURNING id
    `;

    const [board] = await tx<{ id: string }[]>`
      INSERT INTO boards (
        workspace_id, name, slug, description, methodology, color, created_by, next_task_number
      ) VALUES (
        ${workspace.id}, 'Producto y Operaciones', 'producto-operaciones',
        'Flujo híbrido Scrum + Kanban para priorizar, ejecutar y medir el trabajo.',
        'HYBRID', '#6d5dfc', ${jhon.id}, 7
      )
      ON CONFLICT (workspace_id, slug) DO UPDATE SET description = EXCLUDED.description
      RETURNING id
    `;

    await tx`
      INSERT INTO board_members (board_id, membership_id, access_level)
      VALUES
        (${board.id}, ${jhon.id}, 'ADMIN'),
        (${board.id}, ${steven.id}, 'MEMBER')
      ON CONFLICT (board_id, membership_id) DO UPDATE
      SET access_level = EXCLUDED.access_level
    `;

    const columnSpecs = [
      ['backlog', 'Backlog', 'BACKLOG', 1000, null, '#64748b'],
      ['todo', 'Por hacer', 'TODO', 2000, 8, '#3b82f6'],
      ['progress', 'En curso', 'IN_PROGRESS', 3000, 4, '#f59e0b'],
      ['review', 'En revisión', 'REVIEW', 4000, 3, '#a855f7'],
      ['done', 'Hecho', 'DONE', 5000, null, '#10b981'],
    ] as const;

    const columnIds: Record<string, string> = {};
    for (const [key, name, category, position, wipLimit, color] of columnSpecs) {
      const [column] = await tx<{ id: string }[]>`
        INSERT INTO board_columns (board_id, name, category, position, wip_limit, color)
        VALUES (${board.id}, ${name}, ${category}, ${position}, ${wipLimit}, ${color})
        ON CONFLICT (board_id, name) DO UPDATE
        SET category = EXCLUDED.category,
            position = EXCLUDED.position,
            wip_limit = EXCLUDED.wip_limit,
            color = EXCLUDED.color
        RETURNING id
      `;
      columnIds[key] = column.id;
    }

    const sprintStart = new Date();
    const sprintEnd = new Date(sprintStart);
    sprintEnd.setDate(sprintEnd.getDate() + 13);
    const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

    const [sprint] = await tx<{ id: string }[]>`
      INSERT INTO sprints (workspace_id, board_id, name, goal, status, start_date, end_date)
      SELECT ${workspace.id}, ${board.id}, 'Sprint 1',
        'Poner en marcha el sistema de gestión y hacer visible el flujo de trabajo.',
        'ACTIVE', ${dateOnly(sprintStart)}, ${dateOnly(sprintEnd)}
      WHERE NOT EXISTS (
        SELECT 1 FROM sprints
        WHERE workspace_id = ${workspace.id}
          AND board_id = ${board.id}
          AND status = 'ACTIVE'
      )
      RETURNING id
    `;
    const activeSprint = sprint ?? (await tx<{ id: string }[]>`
      SELECT id
      FROM sprints
      WHERE workspace_id = ${workspace.id}
        AND board_id = ${board.id}
        AND status = 'ACTIVE'
      LIMIT 1
    `)[0];

    const labelSpecs = [
      ['Producto', '#6d5dfc'],
      ['Operaciones', '#0ea5a4'],
      ['Urgente', '#ef4444'],
      ['Mejora', '#3b82f6'],
    ] as const;
    const labelIds: Record<string, string> = {};
    for (const [name, color] of labelSpecs) {
      const [label] = await tx<{ id: string }[]>`
        INSERT INTO labels (workspace_id, name, color)
        VALUES (${workspace.id}, ${name}, ${color})
        ON CONFLICT (workspace_id, name) DO UPDATE SET color = EXCLUDED.color
        RETURNING id
      `;
      labelIds[name] = label.id;
    }

    const taskSpecs = [
      [1, columnIds.progress, 'Definir objetivos del trimestre', 'Alinear resultados clave, responsables y métricas.', 'STORY', 'HIGH', 8, jhon.id, labelIds.Producto, -1, 5],
      [2, columnIds.todo, 'Configurar flujo de desarrollo', 'Documentar ramas, revisiones, despliegues y criterios de terminado.', 'TASK', 'HIGH', 5, steven.id, labelIds.Mejora, 1, 7],
      [3, columnIds.review, 'Validar permisos del equipo', 'Comprobar acceso por rol y principio de mínimo privilegio.', 'TASK', 'URGENT', 3, jhon.id, labelIds.Urgente, -2, 1],
      [4, columnIds.backlog, 'Automatizar informe semanal', 'Enviar resumen de avance, bloqueos y capacidad.', 'STORY', 'MEDIUM', 5, steven.id, labelIds.Operaciones, null, 10],
      [5, columnIds.done, 'Crear espacio de trabajo inicial', 'Estructura base del equipo y primer tablero.', 'TASK', 'MEDIUM', 3, jhon.id, labelIds.Producto, -7, -2],
      [6, columnIds.todo, 'Levantar inventario de procesos', 'Registrar procesos recurrentes y su responsable actual.', 'EPIC', 'MEDIUM', 13, jhon.id, labelIds.Operaciones, null, 14],
    ] as const;

    const offsetDate = (offset: number | null) => {
      if (offset === null) return null;
      const value = new Date();
      value.setDate(value.getDate() + offset);
      return dateOnly(value);
    };

    for (const [taskNumber, columnId, title, description, type, priority, points, assigneeId, labelId, startOffset, dueOffset] of taskSpecs) {
      const [task] = await tx<{ id: string }[]>`
        INSERT INTO tasks (
          board_id, column_id, sprint_id, task_number, title, description,
          task_type, priority, position, story_points, start_date, due_date,
          reporter_id, completed_at
        ) VALUES (
          ${board.id}, ${columnId}, ${taskNumber <= 3 ? activeSprint?.id ?? null : null},
          ${taskNumber}, ${title}, ${description}, ${type}, ${priority},
          ${taskNumber * 1000}, ${points}, ${offsetDate(startOffset)}, ${offsetDate(dueOffset)}, ${jhon.id},
          ${taskNumber === 5 ? new Date() : null}
        )
        ON CONFLICT (board_id, task_number) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          start_date = EXCLUDED.start_date,
          due_date = EXCLUDED.due_date
        RETURNING id
      `;
      await tx`
        INSERT INTO task_assignees (task_id, membership_id)
        VALUES (${task.id}, ${assigneeId})
        ON CONFLICT DO NOTHING
      `;
      await tx`
        INSERT INTO task_labels (task_id, label_id)
        VALUES (${task.id}, ${labelId})
        ON CONFLICT DO NOTHING
      `;
      await tx`
        INSERT INTO task_transitions (
          task_id, to_column_id, to_sprint_id, actor_id,
          event_type, story_points_at_event
        )
        SELECT ${task.id}, ${columnId}, ${taskNumber <= 3 ? activeSprint?.id ?? null : null},
          ${jhon.id}, 'CREATED', ${points}
        WHERE NOT EXISTS (
          SELECT 1 FROM task_transitions
          WHERE task_id = ${task.id} AND event_type = 'CREATED'
        )
      `;
      if (taskNumber === 5) {
        await tx`
          INSERT INTO task_transitions (
            task_id, from_column_id, to_column_id, actor_id,
            event_type, story_points_at_event
          )
          SELECT ${task.id}, ${columnIds.progress}, ${columnIds.done}, ${jhon.id}, 'COMPLETED', ${points}
          WHERE NOT EXISTS (
            SELECT 1 FROM task_transitions
            WHERE task_id = ${task.id} AND event_type = 'COMPLETED'
          )
        `;
      }

      if (taskNumber === 2) {
        const [checklist] = await tx<{ id: string }[]>`
          INSERT INTO checklists (task_id, title)
          SELECT ${task.id}, 'Criterios de terminado'
          WHERE NOT EXISTS (SELECT 1 FROM checklists WHERE task_id = ${task.id})
          RETURNING id
        `;
        const currentChecklist = checklist ?? (await tx<{ id: string }[]>`
          SELECT id FROM checklists WHERE task_id = ${task.id} LIMIT 1
        `)[0];
        if (currentChecklist) {
          for (const [content, complete, position] of [
            ['Definir estrategia de ramas', true, 1000],
            ['Exigir revisión antes de merge', true, 2000],
            ['Documentar rollback de producción', false, 3000],
          ] as const) {
            await tx`
              INSERT INTO checklist_items (checklist_id, content, is_complete, position, completed_by, completed_at)
              SELECT ${currentChecklist.id}, ${content}, ${complete}, ${position},
                ${complete ? steven.id : null}, ${complete ? new Date() : null}
              WHERE NOT EXISTS (
                SELECT 1 FROM checklist_items
                WHERE checklist_id = ${currentChecklist.id} AND content = ${content}
              )
            `;
          }
        }
      }

      if (taskNumber === 3) {
        await tx`
          INSERT INTO comments (task_id, author_id, body)
          SELECT ${task.id}, ${jhon.id}, 'Revisar especialmente que un miembro no pueda elevar su propio rol.'
          WHERE NOT EXISTS (SELECT 1 FROM comments WHERE task_id = ${task.id})
        `;
      }
    }

    await tx`
      INSERT INTO custom_fields (workspace_id, name, field_type, options, position)
      VALUES
        (${workspace.id}, 'Impacto', 'SELECT', '["Bajo","Medio","Alto"]'::jsonb, 1000),
        (${workspace.id}, 'Área', 'SELECT', '["Producto","Tecnología","Operaciones"]'::jsonb, 2000)
      ON CONFLICT (workspace_id, name) DO NOTHING
    `;

    await tx`
      INSERT INTO saved_views (workspace_id, owner_id, name, view_type, filters, is_shared)
      SELECT ${workspace.id}, ${jhon.id}, 'Trabajo prioritario', 'TABLE',
        '{"priorities":["URGENT","HIGH"],"archived":false}'::jsonb, TRUE
      WHERE NOT EXISTS (
        SELECT 1 FROM saved_views WHERE workspace_id = ${workspace.id} AND name = 'Trabajo prioritario'
      )
    `;

    await tx`
      INSERT INTO automation_rules (
        workspace_id, board_id, name, trigger_type, trigger_config,
        action_type, action_config, is_enabled
      )
      SELECT ${workspace.id}, ${board.id}, 'Marcar fecha al completar',
        'TASK_MOVED', '{"toCategory":"DONE"}'::jsonb,
        'SET_COMPLETED_AT', '{}'::jsonb, TRUE
      WHERE NOT EXISTS (
        SELECT 1 FROM automation_rules
        WHERE workspace_id = ${workspace.id} AND name = 'Marcar fecha al completar'
      )
    `;

    await tx`
      INSERT INTO activity_log (workspace_id, board_id, actor_id, entity_type, entity_id, action, summary)
      SELECT ${workspace.id}, NULL, ${jhon.id}, 'workspace', ${workspace.id}, 'workspace.seeded',
        'Se configuró el espacio inicial de HegelFlow.'
      WHERE NOT EXISTS (
        SELECT 1 FROM activity_log
        WHERE workspace_id = ${workspace.id} AND action = 'workspace.seeded'
      )
    `;
  });

  console.info("Datos iniciales configurados de forma segura.");
} finally {
  await sql.end();
}
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "La carga inicial falló.");
  process.exitCode = 1;
});
