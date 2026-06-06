#!/usr/bin/env node
// Applies the AI App Builder migration to your Neon database.
//
// Usage (from the dashboard/ directory):
//   NEON_DATABASE_URL="postgresql://..." node scripts/run-builder-migration.js
//
// Or export it first:
//   export NEON_DATABASE_URL="postgresql://..."
//   node scripts/run-builder-migration.js

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('❌  NEON_DATABASE_URL is not set.');
  console.error('    Usage: NEON_DATABASE_URL="postgresql://..." node scripts/run-builder-migration.js');
  process.exit(1);
}

const sql = neon(connectionString);

async function run() {
  console.log('🔌  Connecting to Neon…\n');

  const steps = [
    {
      name: 'builder_projects table',
      query: sql`
        CREATE TABLE IF NOT EXISTS builder_projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          clerk_user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `,
    },
    {
      name: 'builder_project_files table',
      query: sql`
        CREATE TABLE IF NOT EXISTS builder_project_files (
          id SERIAL PRIMARY KEY,
          project_id UUID REFERENCES builder_projects(id) ON DELETE CASCADE,
          file_path TEXT NOT NULL,
          content TEXT NOT NULL,
          language TEXT NOT NULL DEFAULT 'typescript',
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(project_id, file_path)
        )
      `,
    },
    {
      name: 'builder_conversations table',
      query: sql`
        CREATE TABLE IF NOT EXISTS builder_conversations (
          id SERIAL PRIMARY KEY,
          project_id UUID REFERENCES builder_projects(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `,
    },
    {
      name: 'idx_builder_projects_user index',
      query: sql`CREATE INDEX IF NOT EXISTS idx_builder_projects_user ON builder_projects(clerk_user_id)`,
    },
    {
      name: 'idx_builder_project_files_project index',
      query: sql`CREATE INDEX IF NOT EXISTS idx_builder_project_files_project ON builder_project_files(project_id)`,
    },
    {
      name: 'idx_builder_conversations_project index',
      query: sql`CREATE INDEX IF NOT EXISTS idx_builder_conversations_project ON builder_conversations(project_id)`,
    },
    {
      name: 'update_builder_project_updated_at function',
      query: sql`
        CREATE OR REPLACE FUNCTION update_builder_project_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `,
    },
    {
      name: 'trg_builder_projects_updated_at trigger',
      query: sql`
        CREATE OR REPLACE TRIGGER trg_builder_projects_updated_at
          BEFORE UPDATE ON builder_projects
          FOR EACH ROW EXECUTE FUNCTION update_builder_project_updated_at()
      `,
    },
  ];

  for (const step of steps) {
    process.stdout.write(`  Creating ${step.name}… `);
    await step.query;
    console.log('✓');
  }

  // Verify
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('builder_projects', 'builder_project_files', 'builder_conversations')
    ORDER BY table_name
  `;

  console.log(`\n✅  Done — ${tables.length}/3 tables confirmed in Neon:`);
  for (const row of tables) {
    console.log(`   • ${row.table_name}`);
  }

  if (tables.length < 3) {
    console.error('\n⚠️  Not all tables were created. Check the error output above.');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('\n❌  Migration failed:', err.message);
  process.exit(1);
});
