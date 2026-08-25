import { describe, expect, it } from "vitest";

import {
  closeSprintSchema,
  createBoardSchema,
  createTaskSchema,
  DomainError,
  moveTaskSchema,
  parseDomainInput,
  rethrowDatabaseError,
  slugify,
  updateTaskSchema,
} from "./validators";

const ids = {
  board: "00000000-0000-4000-8000-000000000001",
  column: "00000000-0000-4000-8000-000000000002",
  task: "00000000-0000-4000-8000-000000000003",
  sprint: "00000000-0000-4000-8000-000000000004",
  otherSprint: "00000000-0000-4000-8000-000000000005",
};

describe("validadores de dominio", () => {
  it("normaliza slugs con acentos sin introducir caracteres inseguros", () => {
    expect(slugify("  Planeación Ágil / Q3  ")).toBe("planeacion-agil-q3");
  });

  it("aplica valores seguros por defecto al crear una tarea", () => {
    const task = parseDomainInput(createTaskSchema, {
      boardId: ids.board,
      columnId: ids.column,
      title: "Preparar entrega",
    });

    expect(task).toMatchObject({
      description: "",
      taskType: "TASK",
      priority: "MEDIUM",
      sprintId: null,
      storyPoints: null,
      assigneeIds: [],
      labelIds: [],
    });
  });

  it("rechaza un rango de fechas invertido", () => {
    expect(() =>
      parseDomainInput(createTaskSchema, {
        boardId: ids.board,
        columnId: ids.column,
        title: "Fechas inválidas",
        startDate: "2026-08-30",
        dueDate: "2026-08-20",
      }),
    ).toThrowError(DomainError);
  });

  it("rechaza el año cero antes de llegar a PostgreSQL", () => {
    const parsed = createTaskSchema.safeParse({
      boardId: ids.board,
      columnId: ids.column,
      title: "Fecha inválida",
      dueDate: "0000-01-01",
    });
    expect(parsed.success).toBe(false);
  });

  it("limita posiciones al rango y escala de NUMERIC(12,4)", () => {
    const outOfRange = createBoardSchema.safeParse({
      name: "Producto",
      columns: [{ name: "Pendiente", category: "TODO", position: 100_000_000 }],
    });
    const excessiveScale = createBoardSchema.safeParse({
      name: "Producto",
      columns: [{ name: "Pendiente", category: "TODO", position: 1.00001 }],
    });
    expect(outOfRange.success).toBe(false);
    expect(excessiveScale.success).toBe(false);
  });

  it("rechaza una posición directa combinada con anclas", () => {
    const parsed = moveTaskSchema.safeParse({
      taskId: ids.task,
      toColumnId: ids.column,
      expectedVersion: 1,
      position: 2_000,
      beforeTaskId: ids.board,
    });
    expect(parsed.success).toBe(false);
  });

  it("acepta una reasignación de sprint como edición atómica de tarea", () => {
    const parsed = updateTaskSchema.safeParse({
      taskId: ids.task,
      expectedVersion: 1,
      sprintId: ids.sprint,
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza columnas duplicadas sin distinguir mayúsculas", () => {
    const parsed = createBoardSchema.safeParse({
      name: "Producto",
      columns: [
        { name: "Revisión", category: "REVIEW" },
        { name: "REVISIÓN", category: "DONE" },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("exige destino al trasladar pendientes a otro sprint", () => {
    const missing = closeSprintSchema.safeParse({
      sprintId: ids.sprint,
      incompleteDestination: "SPRINT",
    });
    const valid = closeSprintSchema.safeParse({
      sprintId: ids.sprint,
      incompleteDestination: "SPRINT",
      targetSprintId: ids.otherSprint,
    });

    expect(missing.success).toBe(false);
    expect(valid.success).toBe(true);
  });
});

describe("errores de dominio", () => {
  it("conserva status y código estables para la capa HTTP", () => {
    const error = new DomainError(409, "VERSION_CONFLICT", "Conflicto de versión.");
    expect(error).toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
  });

  it("convierte deadlocks en un conflicto reintentable", () => {
    expect.assertions(1);
    try {
      rethrowDatabaseError({ code: "40P01" });
    } catch (error) {
      expect(error).toMatchObject({ status: 409, code: "TRANSACTION_RETRY_REQUIRED" });
    }
  });
});
