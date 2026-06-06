import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../../../lib/api/cors';
import { authenticateRequest } from '../../../../lib/api/auth';
import { getNeonClient } from '../../../../lib/api/neon';

export const OPTIONS: APIRoute = async () => corsResponse();

export const GET: APIRoute = async ({ request, params }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

  const { id } = params;
  const sql = getNeonClient();

  try {
    const projects = await sql`
      SELECT id, name, description, created_at, updated_at
      FROM builder_projects
      WHERE id = ${id!} AND clerk_user_id = ${userId}
    `;

    if (!projects.length) return jsonResponse({ error: 'Project not found' }, 404);

    const files = await sql`
      SELECT file_path, content, language, updated_at
      FROM builder_project_files
      WHERE project_id = ${id!}
      ORDER BY file_path ASC
    `;

    const messages = await sql`
      SELECT role, content, created_at
      FROM builder_conversations
      WHERE project_id = ${id!}
      ORDER BY created_at ASC
    `;

    return jsonResponse({ project: projects[0], files, messages });
  } catch (error) {
    console.error('Builder project GET error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};

export const PUT: APIRoute = async ({ request, params }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

  const { id } = params;
  const sql = getNeonClient();

  try {
    const { name, description } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return jsonResponse({ error: 'Project name is required' }, 400);
    }

    const rows = await sql`
      UPDATE builder_projects
      SET name = ${name.trim()}, description = ${description?.trim() || null}
      WHERE id = ${id!} AND clerk_user_id = ${userId}
      RETURNING id, name, description, created_at, updated_at
    `;

    if (!rows.length) return jsonResponse({ error: 'Project not found' }, 404);
    return jsonResponse({ project: rows[0] });
  } catch (error) {
    console.error('Builder project PUT error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

  const { id } = params;
  const sql = getNeonClient();

  try {
    const rows = await sql`
      DELETE FROM builder_projects
      WHERE id = ${id!} AND clerk_user_id = ${userId}
      RETURNING id
    `;

    if (!rows.length) return jsonResponse({ error: 'Project not found' }, 404);
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Builder project DELETE error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
