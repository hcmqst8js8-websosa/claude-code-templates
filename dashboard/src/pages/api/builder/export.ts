import type { APIRoute } from 'astro';
import { corsResponse } from '../../../lib/api/cors';
import { authenticateRequest } from '../../../lib/api/auth';
import { getNeonClient } from '../../../lib/api/neon';
import JSZip from 'jszip';

export const OPTIONS: APIRoute = async () => corsResponse();

export const POST: APIRoute = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'projectId is required' }), { status: 400 });
    }

    const sql = getNeonClient();

    const projects = await sql`
      SELECT id, name FROM builder_projects
      WHERE id = ${projectId} AND clerk_user_id = ${userId}
    `;

    if (!projects.length) {
      return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 });
    }

    const files = await sql`
      SELECT file_path, content FROM builder_project_files
      WHERE project_id = ${projectId}
      ORDER BY file_path ASC
    `;

    const zip = new JSZip();
    const projectName = (projects[0] as any).name as string;
    const folder = zip.folder(projectName.replace(/[^a-zA-Z0-9-_]/g, '-'))!;

    // Add generated files
    for (const file of files as Array<{ file_path: string; content: string }>) {
      folder.file(file.file_path, file.content);
    }

    // Add scaffold files if not already present
    const existingPaths = new Set((files as Array<{ file_path: string }>).map((f) => f.file_path));

    if (!existingPaths.has('index.html')) {
      folder.file('index.html', INDEX_HTML);
    }

    if (!existingPaths.has('vite.config.ts')) {
      folder.file('vite.config.ts', VITE_CONFIG);
    }

    if (!existingPaths.has('tsconfig.json')) {
      folder.file('tsconfig.json', TSCONFIG);
    }

    if (!existingPaths.has('tailwind.config.js')) {
      folder.file('tailwind.config.js', TAILWIND_CONFIG);
    }

    if (!existingPaths.has('postcss.config.js')) {
      folder.file('postcss.config.js', POSTCSS_CONFIG);
    }

    if (!existingPaths.has('src/index.css')) {
      folder.file('src/index.css', INDEX_CSS);
    }

    if (!existingPaths.has('src/main.tsx')) {
      folder.file('src/main.tsx', MAIN_TSX);
    }

    if (!existingPaths.has('.env.example')) {
      folder.file('.env.example', ENV_EXAMPLE);
    }

    folder.file('.gitignore', GITIGNORE);

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${projectName.replace(/[^a-zA-Z0-9-_]/g, '-')}.zip"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ error: 'Export failed' }), { status: 500 });
  }
};

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
`;

const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
`;

const POSTCSS_CONFIG = `export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
`;

const INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;

const MAIN_TSX = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

const ENV_EXAMPLE = `VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
`;

const GITIGNORE = `node_modules
dist
.env
.env.local
`;
