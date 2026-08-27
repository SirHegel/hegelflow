import {
  closestCorners,
  pointerWithin,
  rectIntersection,
  type Collision,
  type CollisionDetection,
} from "@dnd-kit/core";

function preferTaskCollisions(collisions: Collision[]): Collision[] {
  const taskCollisions = collisions.filter(
    (collision) => collision.data?.droppableContainer.data.current?.type === "task",
  );

  return taskCollisions.length ? taskCollisions : collisions;
}

export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length) return preferTaskCollisions(pointerCollisions);

  const intersections = rectIntersection(args);
  if (intersections.length) return preferTaskCollisions(intersections);

  return closestCorners({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => container.id !== args.active.id,
    ),
  });
};
