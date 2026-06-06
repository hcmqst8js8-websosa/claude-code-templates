import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  files: Record<string, string>;
}

function buildPreviewHtml(appTsx: string): string {
  // Strip TypeScript-specific syntax for Babel browser transpilation
  const cleaned = appTsx
    .replace(/^import\s+.*?from\s+['"].*?['"]\s*;?\s*$/gm, '') // remove imports
    .replace(/^export\s+default\s+/m, '') // remove export default
    .replace(/:\s*\w+(\[\])?(\s*\|\s*\w+(\[\])?)*(?=[,)\s={}])/g, '') // strip type annotations
    .replace(/<\w+>(?=\()/g, '') // strip generic type params on function calls
    .trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    // Mock Supabase client for preview
    window.supabaseClient = {
      from: (table) => ({
        select: async (cols) => ({ data: [], error: null }),
        insert: async (rows) => ({ data: rows, error: null }),
        update: async (row) => ({ data: row, error: null }),
        delete: async () => ({ data: null, error: null }),
        eq: function() { return this; },
        order: function() { return this; },
        limit: function() { return this; },
      }),
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ data: {}, error: null }),
        signOut: async () => ({ error: null }),
      },
    };
    // Override createClient to return mock
    window.supabase = { createClient: () => window.supabaseClient };
  </script>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useCallback, useRef, useMemo } = React;

    ${cleaned}

    const AppComponent = typeof App !== 'undefined' ? App : () => React.createElement('div', {className: 'p-8 text-center text-gray-500'}, 'App component not found');

    ReactDOM.createRoot(document.getElementById('root')).render(
      React.createElement(AppComponent)
    );
  </script>
</body>
</html>`;
}

export default function LivePreview({ files }: Props) {
  const [activeTab, setActiveTab] = useState<'preview' | 'schema'>('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const appTsx = files['src/App.tsx'] || '';
  const sqlContent = files['migrations/001_initial.sql'] || '';
  const hasContent = Object.keys(files).length > 0;

  const previewHtml = useMemo(() => {
    if (!appTsx) return '';
    return buildPreviewHtml(appTsx);
  }, [appTsx]);

  const refreshPreview = () => {
    if (iframeRef.current && previewHtml) {
      iframeRef.current.srcdoc = previewHtml;
    }
  };

  if (!hasContent) {
    return (
      <div className="flex flex-col h-full bg-[#0d0d0d] items-center justify-center text-gray-500">
        <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">Describe your app to see a live preview</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 bg-[#141414]">
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'preview'
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          Preview
        </button>
        {sqlContent && (
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === 'schema'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            DB Schema
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-white/30 bg-white/5 px-2 py-1 rounded">Sandbox</span>
          <button
            onClick={refreshPreview}
            title="Refresh preview"
            className="p-1.5 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' ? (
          <iframe
            ref={iframeRef}
            srcDoc={previewHtml}
            sandbox="allow-scripts"
            className="w-full h-full border-0 bg-white"
            title="App preview"
          />
        ) : (
          <div className="h-full overflow-auto p-4">
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
              {sqlContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
