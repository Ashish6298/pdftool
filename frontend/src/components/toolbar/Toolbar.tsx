import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore, ToolMode } from '../../store/projectStore';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Save,
  MousePointer,
  Type,
  CheckSquare,
  FileSignature,
  Calendar,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';

export default function Toolbar() {
  const navigate = useNavigate();
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const {
    activeProject,
    toolMode,
    setToolMode,
    zoom,
    setZoom,
    undo,
    redo,
    undoStack,
    redoStack,
    saveDraft,
    exportPDF,
    isSaving,
    hasUnsavedChanges,
    saveError,
    showProtectedZones,
    toggleProtectedZones,
  } = useProjectStore();

  const handleSave = async () => {
    try {
      await saveDraft();
      setSaveConfirmed(true);
      window.setTimeout(() => setSaveConfirmed(false), 2000);
    } catch {
      setSaveConfirmed(false);
    }
  };

  const handleExport = async () => {
    const previewWindow = window.open('', '_blank');
    try {
      const exportFile = await exportPDF();
      const previewUrl = `/preview/${exportFile.id}?filename=${encodeURIComponent(exportFile.filename)}`;
      if (previewWindow) {
        previewWindow.location.href = previewUrl;
      } else {
        window.open(previewUrl, '_blank');
      }
    } catch (err) {
      previewWindow?.close();
      alert('Export failed. Please check overlays and try again.');
    }
  };

  const tools: { mode: ToolMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'SELECT', label: 'Select Object', icon: <MousePointer className="w-4 h-4" /> },
    { mode: 'ADD_TEXT', label: 'Add Text Overlay', icon: <Type className="w-4 h-4" /> },
    { mode: 'ADD_CHECKBOX', label: 'Add Checkbox', icon: <CheckSquare className="w-4 h-4" /> },
    { mode: 'ADD_SIGNATURE', label: 'Signature Overlay', icon: <FileSignature className="w-4 h-4" /> },
    { mode: 'ADD_DATE', label: 'Date Selector', icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between text-slate-800 shadow-sm z-10">
      {/* Left Area: Title and navigation */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-sm font-semibold max-w-[200px] truncate text-slate-800" title={activeProject?.name}>
            {activeProject?.name}
          </h2>
          <div className="flex items-center space-x-1.5 mt-0.5">
            {saveError ? (
              <span className="text-[10px] text-red-600 font-medium" title={saveError}>Save failed</span>
            ) : isSaving ? (
              <span className="text-[10px] text-slate-400 animate-pulse font-medium">Saving draft...</span>
            ) : hasUnsavedChanges ? (
              <span className="text-[10px] text-amber-600 font-medium">Unsaved changes</span>
            ) : (
              <span className="text-[10px] text-brand-600 flex items-center space-x-1 font-medium">
                <span className="w-1.5 h-1.5 bg-brand-500 rounded-full"></span>
                <span>{saveConfirmed ? 'Saved successfully' : 'All changes saved'}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle Area: Editor Tools */}
      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
        {tools.map((tool) => (
          <button
            key={tool.mode}
            onClick={() => setToolMode(tool.mode)}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-2 text-xs font-semibold transition-all ${
              toolMode === tool.mode
                ? 'bg-white text-brand-700 shadow-sm border border-slate-200/50'
                : 'text-slate-505 hover:text-slate-850 hover:bg-white/40'
            }`}
            title={tool.label}
          >
            {tool.icon}
            <span className="hidden md:inline">{tool.mode === 'SELECT' ? 'Select' : tool.mode.replace('ADD_', '')}</span>
          </button>
        ))}
      </div>

      {/* Right Area: Scaling, Undo/Redo & Actions */}
      <div className="flex items-center space-x-3">
        {/* Toggle Protected Zones */}
        <button
          onClick={toggleProtectedZones}
          className={`p-2 rounded-lg border transition-colors flex items-center space-x-1.5 text-xs font-semibold ${
            showProtectedZones
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
          title="Show Protected Zones"
        >
          {showProtectedZones ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          <span className="hidden lg:inline">Protected zones</span>
        </button>

        <div className="h-5 w-px bg-slate-200"></div>

        {/* Undo / Redo */}
        <div className="flex items-center space-x-0.5">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-all"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-all"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200"></div>

        {/* Zoom */}
        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
          <button
            onClick={() => setZoom(zoom - 0.1)}
            className="p-1.5 hover:bg-white text-slate-500 hover:text-slate-800 rounded-md transition-all"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono font-semibold px-2 text-slate-700 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(zoom + 0.1)}
            className="p-1.5 hover:bg-white text-slate-500 hover:text-slate-800 rounded-md transition-all"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Save & Export */}
        <button
          onClick={handleSave}
          disabled={isSaving || !hasUnsavedChanges}
          className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 hover:text-slate-850 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Save Draft"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </button>

        <button
          onClick={handleExport}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>Export PDF</span>
        </button>
      </div>
    </div>
  );
}
