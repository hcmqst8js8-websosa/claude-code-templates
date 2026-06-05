-- AI App Builder tables

CREATE TABLE IF NOT EXISTS builder_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS builder_project_files (
  id SERIAL PRIMARY KEY,
  project_id UUID REFERENCES builder_projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'typescript',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, file_path)
);

CREATE TABLE IF NOT EXISTS builder_conversations (
  id SERIAL PRIMARY KEY,
  project_id UUID REFERENCES builder_projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_projects_user ON builder_projects(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_builder_project_files_project ON builder_project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_builder_conversations_project ON builder_conversations(project_id);

CREATE OR REPLACE FUNCTION update_builder_project_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_builder_projects_updated_at
  BEFORE UPDATE ON builder_projects
  FOR EACH ROW EXECUTE FUNCTION update_builder_project_updated_at();
