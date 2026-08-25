export type AccessLevel = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskType = "EPIC" | "STORY" | "TASK" | "BUG";
export type ColumnCategory = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type WorkspaceContext = {
  userId: string;
  username: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  workspaceLogo: string;
  membershipId: string;
  fullName: string;
  workRole: string;
  accessLevel: AccessLevel;
  avatarColor: string;
};

export type Person = {
  id: string;
  fullName: string;
  workRole: string;
  accessLevel: AccessLevel;
  avatarColor: string;
  status: "ACTIVE" | "INVITED" | "DISABLED";
  capacityPoints: number;
  hasAccount?: boolean;
};

export type Label = {
  id: string;
  name: string;
  color: string;
};

export type TaskCard = {
  id: string;
  boardId: string;
  columnId: string;
  sprintId: string | null;
  key: string;
  taskNumber: number;
  title: string;
  description: string;
  taskType: TaskType;
  priority: TaskPriority;
  position: number;
  storyPoints: number | null;
  estimateMinutes: number | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  assignees: Person[];
  labels: Label[];
  checklistTotal: number;
  checklistDone: number;
  commentCount: number;
  blockerCount: number;
};

export type BoardColumn = {
  id: string;
  name: string;
  category: ColumnCategory;
  position: number;
  wipLimit: number | null;
  color: string;
};

export type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
};

export type BoardData = {
  board: {
    id: string;
    name: string;
    description: string;
    methodology: "KANBAN" | "SCRUM" | "HYBRID";
    color: string;
    slug: string;
  };
  columns: BoardColumn[];
  tasks: TaskCard[];
  members: Person[];
  labels: Label[];
  sprints: Sprint[];
};

export type ActivityItem = {
  id: string;
  action: string;
  summary: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actorName: string | null;
  actorColor: string | null;
};

