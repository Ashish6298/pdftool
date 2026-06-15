import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import Toolbar from '../components/toolbar/Toolbar';
import LeftSidebar from '../components/sidebar/LeftSidebar';
import RightSidebar from '../components/sidebar/RightSidebar';
import EditorCanvas from '../components/editor/EditorCanvas';
import { Loader2, AlertTriangle, Home } from 'lucide-react';

export default function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    activeProject,
    selectProject,
    isLoading,
    error,
    analysis
  } = useProjectStore();

  useEffect(() => {
    if (projectId) {
      selectProject(projectId);
    }
  }, [projectId, selectProject]);

  if (isLoading) {
    return (
      <div className="flex-1 bg-slate-50 text-slate-800 flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-brand-600 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-700">Loading document workspace...</p>
        <p className="text-xs text-slate-400 mt-1">Analyzing layout structure & checking safe regions</p>
      </div>
    );
  }

  if (error || !activeProject) {
    return (
      <div className="flex-1 bg-slate-50 text-slate-800 flex flex-col items-center justify-center min-h-screen p-6">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-md w-full text-center space-y-4 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Failed to Load Project</h2>
          <p className="text-sm text-slate-500">
            {error || 'The requested project could not be found or loaded.'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 bg-slate-850 hover:bg-slate-850/90 text-white rounded-lg flex items-center justify-center space-x-2 text-sm font-semibold transition-all shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  const isScanned = analysis?.isScanned || false;

  return (
    <div className="flex-1 bg-slate-50 text-slate-800 min-h-screen flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar />

      {/* Scanned Warning Banner */}
      {isScanned && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-6 py-2.5 flex items-center space-x-3 text-xs">
          <AlertTriangle className="w-4.5 h-4.5 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Warning:</strong> Scanned document detected. Original selectable text coordinates are missing, so layout protection features are inactive. Please upload digital/selectable PDFs for optimal protection.
          </span>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Pages & suggestions */}
        <LeftSidebar />

        {/* Center Canvas */}
        <EditorCanvas projectId={activeProject.id} />

        {/* Right Sidebar: properties */}
        <RightSidebar />
      </div>
    </div>
  );
}
