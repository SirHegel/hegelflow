import {
  closestCorners,
  type Active,
  type ClientRect,
  type CollisionDetection,
  type DroppableContainer,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { kanbanCollisionDetection } from "./kanban-collision";

type CollisionArguments = Parameters<CollisionDetection>[0];

const movingTaskId = "moving-task";
const emptyColumnId = "column:empty";
const targetTaskId = "target-task";

function rect(left: number, top: number, width: number, height: number): ClientRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function droppable(
  id: UniqueIdentifier,
  type: "column" | "task",
  measuredRect: ClientRect,
): DroppableContainer {
  return {
    id,
    key: id,
    data: { current: { type } },
    disabled: false,
    node: { current: null },
    rect: { current: measuredRect },
  };
}

function collisionArguments({
  pointerCoordinates = { x: 456, y: 175 },
  populated = false,
}: {
  pointerCoordinates?: CollisionArguments["pointerCoordinates"];
  populated?: boolean;
} = {}): CollisionArguments {
  const sourceTaskRect = rect(0, 100, 280, 150);
  const collisionRect = rect(316, 100, 280, 150);
  const targetColumnRect = rect(306, 90, 300, 800);
  const targetTaskRect = rect(316, 100, 280, 150);
  const active: Active = {
    id: movingTaskId,
    data: { current: { type: "task" } },
    rect: { current: { initial: sourceTaskRect, translated: collisionRect } },
  };
  const droppableRects = new Map<UniqueIdentifier, ClientRect>([
    [movingTaskId, sourceTaskRect],
    [emptyColumnId, targetColumnRect],
  ]);
  const droppableContainers = [
    droppable(movingTaskId, "task", sourceTaskRect),
    droppable(emptyColumnId, "column", targetColumnRect),
  ];

  if (populated) {
    droppableRects.set(targetTaskId, targetTaskRect);
    droppableContainers.push(droppable(targetTaskId, "task", targetTaskRect));
  }

  return {
    active,
    collisionRect,
    droppableRects,
    droppableContainers,
    pointerCoordinates,
  };
}

describe("kanbanCollisionDetection", () => {
  it("elige una columna vacía bajo el puntero aunque closestCorners prefiera la tarea original", () => {
    const args = collisionArguments();

    expect(closestCorners(args)[0]?.id).toBe(movingTaskId);
    expect(kanbanCollisionDetection(args)[0]?.id).toBe(emptyColumnId);
  });

  it("usa la intersección para una columna vacía cuando el sensor no aporta puntero", () => {
    const args = collisionArguments({ pointerCoordinates: null });

    expect(kanbanCollisionDetection(args)[0]?.id).toBe(emptyColumnId);
  });

  it("prefiere la tarjeta destino sobre su columna cuando la columna está poblada", () => {
    const args = collisionArguments({ populated: true });

    expect(kanbanCollisionDetection(args)[0]?.id).toBe(targetTaskId);
  });
});
