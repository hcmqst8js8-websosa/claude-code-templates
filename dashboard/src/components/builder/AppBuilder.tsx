import { useState, useCallback, useEffect } from 'react';
import ChatPanel from './ChatPanel';
import CodeViewer from './CodeViewer';
import LivePreview from './LivePreview';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  projectId: string;
  projectName: string;
  initialMessages?: Message[];
  initialFiles?: Record<string, string>;
}

type ActivePanel = 'code' | 'preview';

export default function AppBuilder({ projectId, projectName: initialProjectName }: Props) {
  const [projectName, setProjectName] = useState(initialProjectName);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>('code');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  // Get auth token from Clerk global
  const getToken = useCallback(async (): Promise<string | null> => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 10; i++) {
      try {
        const clerk = (window as any).Clerk;
        if (clerk?.session) return await clerk.session.getToken();
      } catch {}
      await wait(300);
    }
    return null;
  }, []);

  // Load project data on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getToken();
      try {
        const res = await fetch(`/api/builder/projects/${projectId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        if (res.status === 404) {
          window.location.href = '/builder';
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setProjectName(data.project.name);
        setMessages((data.messages || []).map((m: any) => ({ role: m.role, content: m.content })));
        const fileMap: Record<string, string> = {};
        for (const f of data.files || []) fileMap[f.file_path] = f.content;
        setFiles(fileMap);
      } catch (err) {
        console.error('Load project error:', err);
      } finally {
        if (!cancelled) setIsLoadingProject(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, getToken]);

  const parseFilesFromText = useCallback((text: string): Record<string, string> => {
    const match = text.match(/<files>\s*([\s\S]*?)\s*<\/files>/);
    if (!match) return {};
    try {
      return JSON.parse(match[1]);
    } catch {
      return {};
    }
  }, []);

  const handleSend = useCallback(async (content: string) => {
    const userMessage: Message = { role: 'user', content };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsStreaming(true);
    setStreamingText('');

    const token = await getToken();

    try {
      const res = await fetch('/api/builder/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: updatedMessages, projectId }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              accumulated += data.text;
              setStreamingText(accumulated);

              // Incrementally update files as they appear
              const parsedFiles = parseFilesFromText(accumulated);
              if (Object.keys(parsedFiles).length > 0) {
                setFiles((prev) => ({ ...prev, ...parsedFiles }));
              }
            } else if (data.type === 'done') {
              break;
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      const finalFiles = parseFilesFromText(accumulated);
      if (Object.keys(finalFiles).length > 0) {
        setFiles((prev) => ({ ...prev, ...finalFiles }));
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }]);
    } catch (error) {
      console.error('Generation error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, generation failed. Please try again.' },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingText('');
    }
  }, [messages, projectId, getToken, parseFilesFromText]);

  const handleExport = useCallback(async () => {
    if (isExporting || !Object.keys(files).length) return;
    setIsExporting(true);
    const token = await getToken();

    try {
      const res = await fetch('/api/builder/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/[^a-zA-Z0-9-_]/g, '-')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, files, projectId, projectName, getToken]);

  const hasFiles = Object.keys(files).length > 0;

  if (isLoadingProject) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-[#111] shrink-0">
        <a
          href="/builder"
          className="text-white/40 hover:text-white/80 transition-colors"
          title="Back to projects"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <span className="text-sm font-medium text-white/80 truncate max-w-[200px]">{projectName}</span>

        {/* Panel toggle */}
        <div className="flex gap-1 ml-auto bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setActivePanel('code')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activePanel === 'code' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            Code
          </button>
          <button
            onClick={() => setActivePanel('preview')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activePanel === 'preview' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            Preview
          </button>
        </div>

        {/* Export button */}
        {hasFiles && (
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-medium transition-colors"
          >
            {isExporting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Exporting…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </>
            )}
          </button>
        )}
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat panel — always visible */}
        <div className="w-[320px] shrink-0 border-r border-white/10 flex flex-col overflow-hidden">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            streamingText={streamingText}
            onSend={handleSend}
          />
        </div>

        {/* Right panel — code or preview */}
        <div className="flex-1 overflow-hidden">
          {activePanel === 'code' ? (
            <CodeViewer files={files} />
          ) : (
            <LivePreview files={files} />
          )}
        </div>
      </div>
    </div>
  );
}
