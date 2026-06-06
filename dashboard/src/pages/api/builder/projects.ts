import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../../lib/api/cors';
import { authenticateRequest } from '../../../lib/api/auth';
import { getNeonClient } from '../../../lib/api/neon';

export const OPTIONS: APIRoute = async () => corsResponse();

export const GET: APIRoute = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

  const sql = getNeonClient();

  try {
    const projects = await sql`
      SELECT id, name, description, created_at, updated_at
      FROM builder_projects
      WHERE clerk_user_id = ${userId}
      ORDER BY updated_at DESC
    `;
    return jsonResponse({ projects });
  } catch (error) {
    console.error('Builder projects GET error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

  const sql = getNeonClient();

  try {
    const { name, description } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return jsonResponse({ error: 'Project name is required' }, 400);
    }
    if (name.length > 100) {
      return jsonResponse({ error: 'Project name too long (max 100 characters)' }, 400);
    }

    const rows = await sql`
      INSERT INTO builder_projects (clerk_user_id, name, description)
      VALUES (${userId}, ${name.trim()}, ${description?.trim() || null})
      RETURNING id, name, description, created_at, updated_at
    `;

    return jsonResponse({ project: rows[0] }, 201);
  } catch (error) {
    console.error('Builder projects POST error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
