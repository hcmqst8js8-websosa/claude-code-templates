import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { corsResponse } from '../../../lib/api/cors';
import { authenticateRequest } from '../../../lib/api/auth';
import { getNeonClient } from '../../../lib/api/neon';

export const OPTIONS: APIRoute = async () => corsResponse();

const SYSTEM_PROMPT = `You are an expert full-stack developer specializing in React, TypeScript, Tailwind CSS, and Supabase. When the user describes an app, generate a complete, working full-stack application.

Always respond in two parts:
1. A brief conversational explanation (2-4 sentences) of what you're building and key design decisions.
2. A <files> block containing ALL generated files as a JSON object.

The <files> block format:
<files>
{
  "src/App.tsx": "// full file content here",
  "src/lib/supabase.ts": "// supabase client",
  "src/components/ComponentName.tsx": "// component content",
  "migrations/001_initial.sql": "-- SQL content",
  "package.json": "{ ... }"
}
</files>

ALWAYS include these files:
- src/App.tsx — main React component, fully styled with Tailwind CSS classes
- src/lib/supabase.ts — Supabase client using import.meta.env.VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- migrations/001_initial.sql — CREATE TABLE statements for all data
- package.json — with dependencies: react@18, react-dom@18, @supabase/supabase-js@2, tailwindcss@3, vite, typescript, @types/react, @types/react-dom, autoprefixer, postcss

Rules:
- Use React 18 with functional components and hooks
- Use TypeScript with strict mode
- Use Tailwind CSS v3 with a dark or modern color scheme
- Use Supabase JS v2 for all database operations
- Make the UI fully functional with real CRUD operations
- Include proper loading states, error handling, and empty states
- Keep src/App.tsx self-contained enough for preview (import components inline if needed for preview)
- Write clean, production-quality code

For subsequent messages (when files already exist), modify only the files that need changing and return them in the <files> block. Include unchanged files only if they reference changed ones.`;

export const POST: APIRoute = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { messages, projectId } = await request.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'Messages are required' }), { status: 400 });
  }

  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  let fullText = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        });

        for await (const event of claudeStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const text = event.delta.text;
            fullText += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`)
            );
          }
        }

        // Parse <files> block and persist to DB
        if (projectId) {
          await persistFilesAndMessage(projectId, messages, fullText);
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      } catch (error) {
        console.error('Generate stream error:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Generation failed' })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

async function persistFilesAndMessage(
  projectId: string,
  messages: { role: string; content: string }[],
  assistantText: string
) {
  try {
    const sql = getNeonClient();

    // Save user message (last one in the array)
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      await sql`
        INSERT INTO builder_conversations (project_id, role, content)
        VALUES (${projectId}, 'user', ${lastUserMsg.content})
      `;
    }

    // Save assistant message
    await sql`
      INSERT INTO builder_conversations (project_id, role, content)
      VALUES (${projectId}, 'assistant', ${assistantText})
    `;

    // Parse files from <files>...</files> block
    const filesMatch = assistantText.match(/<files>\s*([\s\S]*?)\s*<\/files>/);
    if (!filesMatch) return;

    let files: Record<string, string>;
    try {
      files = JSON.parse(filesMatch[1]);
    } catch {
      return;
    }

    // Upsert each file
    for (const [filePath, content] of Object.entries(files)) {
      const language = detectLanguage(filePath);
      await sql`
        INSERT INTO builder_project_files (project_id, file_path, content, language)
        VALUES (${projectId}, ${filePath}, ${content}, ${language})
        ON CONFLICT (project_id, file_path)
        DO UPDATE SET content = EXCLUDED.content, language = EXCLUDED.language, updated_at = NOW()
      `;
    }

    // Update project updated_at
    await sql`
      UPDATE builder_projects SET updated_at = NOW() WHERE id = ${projectId}
    `;
  } catch (error) {
    console.error('Persist files error:', error);
  }
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    css: 'css',
    sql: 'sql',
    json: 'json',
    md: 'markdown',
    html: 'html',
    env: 'bash',
  };
  return map[ext || ''] || 'text';
}
