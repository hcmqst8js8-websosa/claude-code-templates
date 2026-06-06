import { useState, useEffect, useCallback } from 'react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const tryGet = async () => {
      try {
        const clerk = (window as any).Clerk;
        if (clerk?.session) {
          const token = await clerk.session.getToken();
          resolve(token);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    // Wait for Clerk to be ready
    if ((window as any).Clerk?.session) {
      tryGet();
    } else {
      setTimeout(tryGet, 500);
    }
  });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) {
      setIsSignedIn(false);
      setLoading(false);
      return;
    }
    setIsSignedIn(true);

    try {
      const res = await fetch('/api/builder/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Fetch projects error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    const token = await getToken();

    try {
      const res = await fetch('/api/builder/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      });

      if (res.ok) {
        const data = await res.json();
        window.location.href = `/builder/${data.project.id}`;
      }
    } catch (error) {
      console.error('Create project error:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    setDeletingId(id);
    const token = await getToken();

    try {
      await fetch(`/api/builder/projects/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Delete project error:', error);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-white/60 mb-4">Sign in to create and manage your projects.</p>
        <button
          onClick={() => (window as any).Clerk?.openSignIn()}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">App Builder</h1>
          <p className="text-sm text-white/50 mt-0.5">Describe an app and AI generates it</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setNewName(''); setNewDesc(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Projects grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/20 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-white font-medium mb-1">No projects yet</p>
          <p className="text-white/40 text-sm mb-4">Create your first AI-generated app</p>
          <button
            onClick={() => { setShowModal(true); setNewName(''); setNewDesc(''); }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all cursor-pointer"
              onClick={() => { window.location.href = `/builder/${project.id}`; }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                  disabled={deletingId === project.id}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Delete project"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <h3 className="mt-3 font-medium text-white text-sm truncate">{project.name}</h3>
              {project.description && (
                <p className="mt-1 text-xs text-white/50 line-clamp-2">{project.description}</p>
              )}
              <p className="mt-3 text-[11px] text-white/30">{timeAgo(project.updated_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* New project modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/15 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-white mb-4">New Project</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Project name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="My Todo App"
                  autoFocus
                  className="w-full bg-white/8 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/60 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Description (optional)</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="A task management app with Supabase"
                  className="w-full bg-white/8 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/60 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-white/8 hover:bg-white/12 text-white/70 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
