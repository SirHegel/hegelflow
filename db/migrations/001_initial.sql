CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  email VARCHAR(255),
  password_hash TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED')),
  avatar_color VARCHAR(20) NOT NULL DEFAULT '#6d5dfc',
  locale VARCHAR(10) NOT NULL DEFAULT 'es',
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX users_username_lower_unique ON users (LOWER(username));
CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email)) WHERE email IS NOT NULL;

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  user_agent TEXT,
  ip_hash CHAR(64),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE login_attempts (
  key_hash CHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  logo_mark VARCHAR(8) NOT NULL DEFAULT 'HF',
  settings JSONB NOT NULL DEFAULT '{"weekStartsOn":1,"workingDays":[1,2,3,4,5]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_slug VARCHAR(80) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255),
  work_role VARCHAR(120) NOT NULL,
  access_level VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (access_level IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED')),
  avatar_color VARCHAR(20) NOT NULL DEFAULT '#6d5dfc',
  capacity_points INTEGER NOT NULL DEFAULT 20 CHECK (capacity_points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, profile_slug)
);
CREATE UNIQUE INDEX memberships_workspace_user_unique ON memberships(workspace_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX memberships_workspace_idx ON memberships(workspace_id, status);

CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  description TEXT,
  methodology VARCHAR(20) NOT NULL DEFAULT 'HYBRID' CHECK (methodology IN ('KANBAN', 'SCRUM', 'HYBRID')),
  visibility VARCHAR(20) NOT NULL DEFAULT 'WORKSPACE' CHECK (visibility IN ('WORKSPACE', 'PRIVATE')),
  color VARCHAR(20) NOT NULL DEFAULT '#6d5dfc',
  next_task_number INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES memberships(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
);
CREATE INDEX boards_workspace_idx ON boards(workspace_id, archived_at);

CREATE TABLE board_members (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  access_level VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (access_level IN ('ADMIN', 'MEMBER', 'OBSERVER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(board_id, membership_id)
);
CREATE INDEX board_members_membership_idx ON board_members(membership_id, board_id);

CREATE TABLE board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE')),
  position NUMERIC(12,4) NOT NULL,
  wip_limit INTEGER CHECK (wip_limit IS NULL OR wip_limit > 0),
  color VARCHAR(20) NOT NULL DEFAULT '#94a3b8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(board_id, name)
);
CREATE UNIQUE INDEX board_columns_name_ci_unique ON board_columns(board_id, LOWER(name));
CREATE INDEX board_columns_order_idx ON board_columns(board_id, position);

CREATE TABLE sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  goal TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  start_date DATE,
  end_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
CREATE UNIQUE INDEX sprints_one_active_per_board ON sprints(board_id) WHERE status = 'ACTIVE' AND board_id IS NOT NULL;
CREATE UNIQUE INDEX sprints_one_active_workspace_wide ON sprints(workspace_id) WHERE status = 'ACTIVE' AND board_id IS NULL;
CREATE INDEX sprints_workspace_status_idx ON sprints(workspace_id, status, start_date);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES board_columns(id) ON DELETE RESTRICT,
  sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  task_number INTEGER NOT NULL,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  task_type VARCHAR(20) NOT NULL DEFAULT 'TASK' CHECK (task_type IN ('EPIC', 'STORY', 'TASK', 'BUG')),
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  position NUMERIC(16,4) NOT NULL DEFAULT 1000,
  story_points INTEGER CHECK (story_points IS NULL OR story_points >= 0),
  estimate_minutes INTEGER CHECK (estimate_minutes IS NULL OR estimate_minutes >= 0),
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  reporter_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date),
  UNIQUE(board_id, task_number)
);
CREATE INDEX tasks_board_column_position_idx ON tasks(board_id, column_id, position) WHERE archived_at IS NULL;
CREATE INDEX tasks_sprint_idx ON tasks(sprint_id) WHERE archived_at IS NULL;
CREATE INDEX tasks_due_date_idx ON tasks(due_date) WHERE archived_at IS NULL;
CREATE INDEX tasks_search_idx ON tasks USING GIN (to_tsvector('spanish', title || ' ' || description));

CREATE TABLE task_assignees (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(task_id, membership_id)
);
CREATE INDEX task_assignees_member_idx ON task_assignees(membership_id);

-- Append-only movement history. This is the source of truth for burndown,
-- cycle time, scope changes and forensic audits; rows are never updated.
CREATE TABLE task_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  board_id UUID NOT NULL,
  from_column_id UUID,
  to_column_id UUID,
  from_sprint_id UUID,
  to_sprint_id UUID,
  actor_id UUID,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('CREATED', 'MOVED', 'SPRINT_CHANGED', 'ESTIMATE_CHANGED', 'COMPLETED', 'REOPENED', 'ARCHIVED')),
  previous_story_points INTEGER CHECK (previous_story_points IS NULL OR previous_story_points >= 0),
  story_points_at_event INTEGER CHECK (story_points_at_event IS NULL OR story_points_at_event >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX task_transitions_task_idx ON task_transitions(task_id, occurred_at);
CREATE INDEX task_transitions_workspace_idx ON task_transitions(workspace_id, occurred_at);
CREATE INDEX task_transitions_board_idx ON task_transitions(board_id, occurred_at);
CREATE INDEX task_transitions_sprint_idx ON task_transitions(to_sprint_id, occurred_at);

CREATE OR REPLACE FUNCTION prevent_task_transition_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'task_transitions is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_transitions_no_update
BEFORE UPDATE OR DELETE ON task_transitions
FOR EACH ROW EXECUTE FUNCTION prevent_task_transition_mutation();

CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE task_labels (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY(task_id, label_id)
);

CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL DEFAULT 'Checklist',
  position NUMERIC(12,4) NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  content VARCHAR(400) NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  position NUMERIC(12,4) NOT NULL DEFAULT 1000,
  completed_by UUID REFERENCES memberships(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (LENGTH(body) BETWEEN 1 AND 10000),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES memberships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX comments_task_idx ON comments(task_id, created_at);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES memberships(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  mime_type VARCHAR(120),
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE task_dependencies (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(task_id, depends_on_task_id),
  CHECK(task_id <> depends_on_task_id)
);

CREATE TABLE custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'SELECT')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  position NUMERIC(12,4) NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE custom_field_values (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(task_id, custom_field_id)
);

CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  trigger_type VARCHAR(40) NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_type VARCHAR(40) NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  view_type VARCHAR(20) NOT NULL CHECK (view_type IN ('BOARD', 'TABLE', 'CALENDAR', 'TIMELINE', 'WORKLOAD')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT,
  href TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX notifications_member_idx ON notifications(membership_id, read_at, created_at DESC);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  board_id UUID,
  actor_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID,
  action VARCHAR(60) NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX activity_workspace_idx ON activity_log(workspace_id, created_at DESC);
CREATE INDEX activity_board_idx ON activity_log(board_id, created_at DESC) WHERE board_id IS NOT NULL;
CREATE INDEX activity_entity_idx ON activity_log(entity_type, entity_id, created_at DESC);

-- Security events are deliberately separate from user-facing activity and are
-- append-only. They must never contain credentials, cookies or connection URLs.
CREATE TABLE security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  user_id UUID,
  membership_id UUID,
  session_id UUID,
  action VARCHAR(80) NOT NULL,
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED')),
  request_id VARCHAR(160) NOT NULL,
  ip_hash CHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX security_audit_workspace_idx ON security_audit_events(workspace_id, created_at DESC);
CREATE INDEX security_audit_user_idx ON security_audit_events(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_security_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'security_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_audit_no_update
BEFORE UPDATE OR DELETE ON security_audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_security_audit_mutation();

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION assert_activity_scope()
RETURNS TRIGGER AS $$
DECLARE
  board_workspace UUID;
  actor_workspace UUID;
BEGIN
  IF NEW.board_id IS NOT NULL THEN
    SELECT workspace_id INTO board_workspace FROM boards WHERE id = NEW.board_id;
    IF board_workspace IS NULL OR board_workspace IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'activity board belongs to another workspace' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.actor_id IS NOT NULL THEN
    SELECT workspace_id INTO actor_workspace FROM memberships WHERE id = NEW.actor_id;
    IF actor_workspace IS NULL OR actor_workspace IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'activity actor belongs to another workspace' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_scope_guard
BEFORE INSERT OR UPDATE OF workspace_id, board_id, actor_id ON activity_log
FOR EACH ROW EXECUTE FUNCTION assert_activity_scope();

-- Defense in depth for tenant isolation. Application checks remain mandatory,
-- while these triggers reject accidental cross-workspace associations at DB level.
CREATE OR REPLACE FUNCTION assert_board_scope()
RETURNS TRIGGER AS $$
DECLARE
  creator_workspace UUID;
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    SELECT workspace_id INTO creator_workspace FROM memberships WHERE id = NEW.created_by;
    IF creator_workspace IS NULL OR creator_workspace IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'board creator belongs to another workspace' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boards_scope_guard
BEFORE INSERT OR UPDATE OF workspace_id, created_by ON boards
FOR EACH ROW EXECUTE FUNCTION assert_board_scope();

CREATE OR REPLACE FUNCTION assert_sprint_scope()
RETURNS TRIGGER AS $$
DECLARE
  board_workspace UUID;
BEGIN
  IF NEW.board_id IS NOT NULL THEN
    SELECT workspace_id INTO board_workspace FROM boards WHERE id = NEW.board_id;
    IF board_workspace IS NULL OR board_workspace IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'sprint board belongs to another workspace' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sprints_scope_guard
BEFORE INSERT OR UPDATE OF workspace_id, board_id ON sprints
FOR EACH ROW EXECUTE FUNCTION assert_sprint_scope();

CREATE OR REPLACE FUNCTION assert_task_transition_scope()
RETURNS TRIGGER AS $$
DECLARE
  task_workspace UUID;
  task_board UUID;
  related_workspace UUID;
  related_board UUID;
BEGIN
  SELECT b.workspace_id, t.board_id
    INTO task_workspace, task_board
  FROM tasks t
  JOIN boards b ON b.id = t.board_id
  WHERE t.id = NEW.task_id;
  IF task_workspace IS NULL OR task_board IS NULL THEN
    RAISE EXCEPTION 'transition task does not exist' USING ERRCODE = '23514';
  END IF;

  IF NEW.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM task_workspace THEN
    RAISE EXCEPTION 'transition workspace does not match task' USING ERRCODE = '23514';
  END IF;
  IF NEW.board_id IS NOT NULL AND NEW.board_id IS DISTINCT FROM task_board THEN
    RAISE EXCEPTION 'transition board does not match task' USING ERRCODE = '23514';
  END IF;
  NEW.workspace_id := task_workspace;
  NEW.board_id := task_board;

  IF NEW.from_column_id IS NOT NULL THEN
    SELECT board_id INTO related_board FROM board_columns WHERE id = NEW.from_column_id;
    IF related_board IS NULL OR related_board IS DISTINCT FROM task_board THEN
      RAISE EXCEPTION 'transition source column belongs to another board' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.to_column_id IS NOT NULL THEN
    SELECT board_id INTO related_board FROM board_columns WHERE id = NEW.to_column_id;
    IF related_board IS NULL OR related_board IS DISTINCT FROM task_board THEN
      RAISE EXCEPTION 'transition target column belongs to another board' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.from_sprint_id IS NOT NULL THEN
    SELECT workspace_id, board_id INTO related_workspace, related_board
    FROM sprints WHERE id = NEW.from_sprint_id;
    IF related_workspace IS NULL
      OR related_workspace IS DISTINCT FROM task_workspace
      OR (related_board IS NOT NULL AND related_board IS DISTINCT FROM task_board) THEN
      RAISE EXCEPTION 'transition source sprint belongs to another scope' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.to_sprint_id IS NOT NULL THEN
    SELECT workspace_id, board_id INTO related_workspace, related_board
    FROM sprints WHERE id = NEW.to_sprint_id;
    IF related_workspace IS NULL
      OR related_workspace IS DISTINCT FROM task_workspace
      OR (related_board IS NOT NULL AND related_board IS DISTINCT FROM task_board) THEN
      RAISE EXCEPTION 'transition target sprint belongs to another scope' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.actor_id IS NOT NULL THEN
    SELECT workspace_id INTO related_workspace FROM memberships WHERE id = NEW.actor_id;
    IF related_workspace IS NULL OR related_workspace IS DISTINCT FROM task_workspace THEN
      RAISE EXCEPTION 'transition actor belongs to another workspace' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_transitions_scope_guard
BEFORE INSERT ON task_transitions
FOR EACH ROW EXECUTE FUNCTION assert_task_transition_scope();

CREATE OR REPLACE FUNCTION assert_task_scope()
RETURNS TRIGGER AS $$
DECLARE
  task_workspace UUID;
  related_workspace UUID;
  related_board UUID;
BEGIN
  SELECT workspace_id INTO task_workspace FROM boards WHERE id = NEW.board_id;
  IF task_workspace IS NULL THEN
    RAISE EXCEPTION 'task board does not exist' USING ERRCODE = '23514';
  END IF;

  SELECT board_id INTO related_board FROM board_columns WHERE id = NEW.column_id;
  IF related_board IS DISTINCT FROM NEW.board_id THEN
    RAISE EXCEPTION 'task column belongs to another board' USING ERRCODE = '23514';
  END IF;

  IF NEW.sprint_id IS NOT NULL THEN
    SELECT workspace_id, board_id INTO related_workspace, related_board FROM sprints WHERE id = NEW.sprint_id;
    IF related_workspace IS DISTINCT FROM task_workspace OR (related_board IS NOT NULL AND related_board IS DISTINCT FROM NEW.board_id) THEN
      RAISE EXCEPTION 'task sprint belongs to another scope' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.parent_task_id IS NOT NULL THEN
    SELECT board_id INTO related_board FROM tasks WHERE id = NEW.parent_task_id;
    IF related_board IS DISTINCT FROM NEW.board_id THEN
      RAISE EXCEPTION 'parent task belongs to another board' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.reporter_id IS NOT NULL THEN
    SELECT workspace_id INTO related_workspace FROM memberships WHERE id = NEW.reporter_id;
    IF related_workspace IS NULL OR related_workspace IS DISTINCT FROM task_workspace THEN
      RAISE EXCEPTION 'task reporter belongs to another workspace' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_scope_guard
BEFORE INSERT OR UPDATE OF board_id, column_id, sprint_id, parent_task_id, reporter_id ON tasks
FOR EACH ROW EXECUTE FUNCTION assert_task_scope();

CREATE OR REPLACE FUNCTION assert_board_member_scope()
RETURNS TRIGGER AS $$
DECLARE
  board_workspace UUID;
  member_workspace UUID;
BEGIN
  SELECT workspace_id INTO board_workspace FROM boards WHERE id = NEW.board_id;
  SELECT workspace_id INTO member_workspace FROM memberships WHERE id = NEW.membership_id;
  IF board_workspace IS NULL OR member_workspace IS NULL OR board_workspace IS DISTINCT FROM member_workspace THEN
    RAISE EXCEPTION 'board member belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER board_members_scope_guard
BEFORE INSERT OR UPDATE ON board_members
FOR EACH ROW EXECUTE FUNCTION assert_board_member_scope();

CREATE OR REPLACE FUNCTION assert_task_assignee_scope()
RETURNS TRIGGER AS $$
DECLARE
  task_workspace UUID;
  member_workspace UUID;
BEGIN
  SELECT b.workspace_id INTO task_workspace FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = NEW.task_id;
  SELECT workspace_id INTO member_workspace FROM memberships WHERE id = NEW.membership_id;
  IF task_workspace IS NULL OR member_workspace IS NULL OR task_workspace IS DISTINCT FROM member_workspace THEN
    RAISE EXCEPTION 'task assignee belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_assignees_scope_guard
BEFORE INSERT OR UPDATE ON task_assignees
FOR EACH ROW EXECUTE FUNCTION assert_task_assignee_scope();

CREATE OR REPLACE FUNCTION assert_task_label_scope()
RETURNS TRIGGER AS $$
DECLARE
  task_workspace UUID;
  label_workspace UUID;
BEGIN
  SELECT b.workspace_id INTO task_workspace FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = NEW.task_id;
  SELECT workspace_id INTO label_workspace FROM labels WHERE id = NEW.label_id;
  IF task_workspace IS NULL OR label_workspace IS NULL OR task_workspace IS DISTINCT FROM label_workspace THEN
    RAISE EXCEPTION 'task label belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_labels_scope_guard
BEFORE INSERT OR UPDATE ON task_labels
FOR EACH ROW EXECUTE FUNCTION assert_task_label_scope();

CREATE OR REPLACE FUNCTION assert_task_dependency_scope()
RETURNS TRIGGER AS $$
DECLARE
  task_workspace UUID;
  dependency_workspace UUID;
BEGIN
  SELECT b.workspace_id INTO task_workspace FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = NEW.task_id;
  SELECT b.workspace_id INTO dependency_workspace FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = NEW.depends_on_task_id;
  IF task_workspace IS NULL OR dependency_workspace IS NULL OR task_workspace IS DISTINCT FROM dependency_workspace THEN
    RAISE EXCEPTION 'dependency belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_dependencies_scope_guard
BEFORE INSERT OR UPDATE ON task_dependencies
FOR EACH ROW EXECUTE FUNCTION assert_task_dependency_scope();

CREATE OR REPLACE FUNCTION assert_custom_field_value_scope()
RETURNS TRIGGER AS $$
DECLARE
  task_workspace UUID;
  field_workspace UUID;
BEGIN
  SELECT b.workspace_id INTO task_workspace FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = NEW.task_id;
  SELECT workspace_id INTO field_workspace FROM custom_fields WHERE id = NEW.custom_field_id;
  IF task_workspace IS NULL OR field_workspace IS NULL OR task_workspace IS DISTINCT FROM field_workspace THEN
    RAISE EXCEPTION 'custom field belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_field_values_scope_guard
BEFORE INSERT OR UPDATE ON custom_field_values
FOR EACH ROW EXECUTE FUNCTION assert_custom_field_value_scope();

CREATE OR REPLACE FUNCTION assert_checklist_item_scope()
RETURNS TRIGGER AS $$
DECLARE
  task_workspace UUID;
  member_workspace UUID;
BEGIN
  IF NEW.completed_by IS NULL THEN RETURN NEW; END IF;
  SELECT b.workspace_id INTO task_workspace
  FROM checklists cl
  JOIN tasks t ON t.id = cl.task_id
  JOIN boards b ON b.id = t.board_id
  WHERE cl.id = NEW.checklist_id;
  SELECT workspace_id INTO member_workspace FROM memberships WHERE id = NEW.completed_by;
  IF task_workspace IS NULL OR member_workspace IS NULL OR task_workspace IS DISTINCT FROM member_workspace THEN
    RAISE EXCEPTION 'checklist completer belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER checklist_items_scope_guard
BEFORE INSERT OR UPDATE OF checklist_id, completed_by ON checklist_items
FOR EACH ROW EXECUTE FUNCTION assert_checklist_item_scope();

CREATE OR REPLACE FUNCTION assert_automation_rule_scope()
RETURNS TRIGGER AS $$
DECLARE
  board_workspace UUID;
BEGIN
  IF NEW.board_id IS NOT NULL THEN
    SELECT workspace_id INTO board_workspace FROM boards WHERE id = NEW.board_id;
    IF board_workspace IS NULL OR board_workspace IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'automation board belongs to another workspace' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_rules_scope_guard
BEFORE INSERT OR UPDATE OF workspace_id, board_id ON automation_rules
FOR EACH ROW EXECUTE FUNCTION assert_automation_rule_scope();

CREATE OR REPLACE FUNCTION assert_saved_view_scope()
RETURNS TRIGGER AS $$
DECLARE
  owner_workspace UUID;
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    SELECT workspace_id INTO owner_workspace FROM memberships WHERE id = NEW.owner_id;
    IF owner_workspace IS NULL OR owner_workspace IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'saved view owner belongs to another workspace' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saved_views_scope_guard
BEFORE INSERT OR UPDATE OF workspace_id, owner_id ON saved_views
FOR EACH ROW EXECUTE FUNCTION assert_saved_view_scope();

CREATE OR REPLACE FUNCTION assert_comment_scope()
RETURNS TRIGGER AS $$
DECLARE
  task_workspace UUID;
  author_workspace UUID;
  deleter_workspace UUID;
BEGIN
  SELECT b.workspace_id INTO task_workspace FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = NEW.task_id;
  IF task_workspace IS NULL THEN
    RAISE EXCEPTION 'comment task is invalid' USING ERRCODE = '23514';
  END IF;
  IF NEW.author_id IS NOT NULL THEN
    SELECT workspace_id INTO author_workspace FROM memberships WHERE id = NEW.author_id;
  END IF;
  IF NEW.author_id IS NOT NULL AND (author_workspace IS NULL OR task_workspace IS DISTINCT FROM author_workspace) THEN
    RAISE EXCEPTION 'comment author belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  IF NEW.deleted_by IS NOT NULL THEN
    SELECT workspace_id INTO deleter_workspace FROM memberships WHERE id = NEW.deleted_by;
  END IF;
  IF NEW.deleted_by IS NOT NULL AND (deleter_workspace IS NULL OR task_workspace IS DISTINCT FROM deleter_workspace) THEN
    RAISE EXCEPTION 'comment deleter belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_scope_guard
BEFORE INSERT OR UPDATE OF task_id, author_id, deleted_by ON comments
FOR EACH ROW EXECUTE FUNCTION assert_comment_scope();

CREATE OR REPLACE FUNCTION assert_attachment_scope()
RETURNS TRIGGER AS $$
DECLARE
  task_workspace UUID;
  member_workspace UUID;
BEGIN
  IF NEW.uploaded_by IS NULL THEN RETURN NEW; END IF;
  SELECT b.workspace_id INTO task_workspace FROM tasks t JOIN boards b ON b.id = t.board_id WHERE t.id = NEW.task_id;
  SELECT workspace_id INTO member_workspace FROM memberships WHERE id = NEW.uploaded_by;
  IF task_workspace IS NULL OR member_workspace IS NULL OR task_workspace IS DISTINCT FROM member_workspace THEN
    RAISE EXCEPTION 'attachment author belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attachments_scope_guard
BEFORE INSERT OR UPDATE OF task_id, uploaded_by ON attachments
FOR EACH ROW EXECUTE FUNCTION assert_attachment_scope();

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER boards_updated_at BEFORE UPDATE ON boards FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER board_columns_updated_at BEFORE UPDATE ON board_columns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sprints_updated_at BEFORE UPDATE ON sprints FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER checklist_items_updated_at BEFORE UPDATE ON checklist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER automation_rules_updated_at BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();
