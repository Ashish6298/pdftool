import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { FileUp, FileText, Trash2, Edit3, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export default function Dashboard() {
  const { projects, isLoading, fetchProjects, uploadProject, deleteProject } = useProjectStore();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF documents are supported.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const project = await uploadProject(file);
      setUploading(false);
      navigate(`/editor/${project.id}`);
    } catch (err: any) {
      setUploading(false);
      setUploadError(err.response?.data?.message || err.message || 'File upload failed. Please try again.');
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-1 bg-slate-50 text-slate-800 min-h-screen">
      {/* Light Premium Header */}
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-650 text-white p-2 rounded-xl shadow-lg shadow-brand-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-600 to-indigo-650 bg-clip-text text-transparent">
                AnnotatePDF
              </h1>
              <p className="text-xs text-slate-500">Secure PDF Annotation & Fill System</p>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono">v1.0.0</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload Box */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Upload Digital PDF</h2>
            <p className="text-sm text-slate-550 leading-relaxed">
              Only selectable, digital PDF documents are supported. Scanned pages will be flagged automatically.
            </p>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                dragActive
                  ? 'border-brand-500 bg-brand-50/50'
                  : 'border-slate-250 hover:border-slate-350 bg-slate-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="application/pdf"
                onChange={handleFileChange}
                disabled={uploading}
              />
              {uploading ? (
                <div className="flex flex-col items-center space-y-3">
                  <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
                  <p className="text-sm font-medium text-slate-700">Uploading & Analyzing...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3 text-center">
                  <div className="p-3 bg-slate-100 rounded-full border border-slate-200">
                    <FileUp className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-brand-600 hover:underline">Click to upload</span>
                    <p className="text-xs text-slate-400 mt-1">or drag & drop PDF document</p>
                  </div>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-650 text-xs p-3 rounded-lg">
                {uploadError}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Projects list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[450px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-800">Recent PDF Projects</h2>
              <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                {projects.length} Total
              </span>
            </div>

            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                <p className="text-sm text-slate-500">Loading document workspace...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="p-4 bg-slate-50 rounded-full border border-slate-200 mb-4 text-slate-400">
                  <FileText className="w-12 h-12" />
                </div>
                <h3 className="text-slate-700 font-semibold mb-1">No Documents Uploaded Yet</h3>
                <p className="text-sm text-slate-450 max-w-sm leading-relaxed">
                  Upload a PDF to start filling, signing, and annotating in blank spaces.
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/60 rounded-xl transition-all duration-150 group"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-brand-650 group-hover:text-brand-700">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors duration-150">
                          {project.name}
                        </h4>
                        <div className="flex items-center space-x-3 text-xs text-slate-500">
                          <span>
                            {project.uploadedFile ? formatBytes(project.uploadedFile.fileSize) : ''}
                          </span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          <span>{project._count?.overlays || 0} overlays</span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          <span>
                            {new Date(project.updatedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigate(`/editor/${project.id}`)}
                        className="p-2.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-2 text-sm font-medium transition-all"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit</span>
                        <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this project? All version drafts and outputs will be removed.')) {
                            await deleteProject(project.id);
                          }
                        }}
                        className="p-2.5 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-transparent hover:border-red-200 rounded-lg transition-all"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
