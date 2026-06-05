import { useState } from 'react';

interface Props {
  files: Record<string, string>;
}

function getLanguageLabel(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'TS', tsx: 'TSX', js: 'JS', jsx: 'JSX',
    css: 'CSS', sql: 'SQL', json: 'JSON', md: 'MD', html: 'HTML',
  };
  return map[ext || ''] || ext?.toUpperCase() || 'TXT';
}

function getFileIcon(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'tsx' || ext === 'jsx') return '⚛';
  if (ext === 'ts' || ext === 'js') return '{}';
  if (ext === 'css') return '🎨';
  if (ext === 'sql') return '🗄';
  if (ext === 'json') return '{}';
  if (ext === 'md') return '📄';
  return '📄';
}

function groupFilesByDir(files: Record<string, string>): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const path of Object.keys(files)) {
    const parts = path.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(path);
  }
  return groups;
}

export default function CodeViewer({ files }: Props) {
  const [selectedFile, setSelectedFile] = useState<string>('');

  const fileList = Object.keys(files);
  const activeFile = selectedFile && files[selectedFile] ? selectedFile : fileList[0] || '';
  const activeContent = files[activeFile] || '';
  const groups = groupFilesByDir(files);

  if (!fileList.length) {
    return (
      <div className="flex flex-col h-full bg-[#111] items-center justify-center text-gray-600">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <p className="text-sm">Generated code will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#111] overflow-hidden">
      {/* Active file tab */}
      {activeFile && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-[#141414] min-h-[36px]">
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {getLanguageLabel(activeFile)}
          </span>
          <span className="text-xs text-white/70 font-mono truncate">{activeFile}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(activeContent);
            }}
            title="Copy to clipboard"
            className="ml-auto p-1 rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* File tree */}
        <div className="w-44 shrink-0 border-r border-white/10 overflow-y-auto bg-[#0d0d0d] py-2">
          {Array.from(groups.entries()).map(([dir, paths]) => (
            <div key={dir}>
              {dir && (
                <div className="px-3 py-1 text-[10px] text-white/30 uppercase tracking-wider font-medium">
                  {dir}
                </div>
              )}
              {paths.map((path) => {
                const fileName = path.split('/').pop() || path;
                const isActive = path === activeFile;
                return (
                  <button
                    key={path}
                    onClick={() => setSelectedFile(path)}
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-1.5 text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                    title={path}
                  >
                    <span className="text-[10px] shrink-0 opacity-60">{getFileIcon(path)}</span>
                    <span className="truncate">{fileName}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Code content */}
        <div className="flex-1 overflow-auto">
          <pre className="p-4 text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
            {activeContent}
          </pre>
        </div>
      </div>
    </div>
  );
}
