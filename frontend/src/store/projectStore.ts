import { create } from 'zustand';
import { ExportFile, OverlayField, Project, PageAnalysis, OverlayType } from '../types';
import { ProjectService } from '../services/api';

export type ToolMode = 'SELECT' | 'ADD_TEXT' | 'ADD_NOTE' | 'ADD_SIGNATURE' | 'ADD_CHECKBOX' | 'ADD_DATE' | 'ADD_STAMP';

interface HistoryState {
  overlays: OverlayField[];
}

interface ProjectStore {
  projects: Project[];
  activeProject: Project | null;
  overlays: OverlayField[];
  selectedOverlayId: string | null;
  
  // Editor Viewport States
  currentPage: number;
  zoom: number; // e.g. 1.0, 1.5, 0.75
  toolMode: ToolMode;
  showProtectedZones: boolean;
  
  // PDF layout analysis details
  analysis: {
    pages: PageAnalysis[];
    isScanned: boolean;
  } | null;

  // Statuses
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  saveError: string | null;
  error: string | null;

  // History Stack for Undo/Redo
  undoStack: HistoryState[];
  redoStack: HistoryState[];

  // Action declarations
  fetchProjects: () => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  uploadProject: (file: File, name?: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  
  // Editor Actions
  setCurrentPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  setToolMode: (mode: ToolMode) => void;
  toggleProtectedZones: () => void;
  setSelectedOverlayId: (id: string | null) => void;
  
  // Overlay Manipulation
  addOverlay: (overlay: Omit<OverlayField, 'id' | 'projectId'>) => string;
  updateOverlay: (id: string, updates: Partial<OverlayField>) => void;
  deleteOverlay: (id: string) => void;
  duplicateOverlay: (id: string) => void;
  
  // Undo/Redo Actions
  saveHistoryState: () => void;
  undo: () => void;
  redo: () => void;

  // Sync with Backend
  saveDraft: () => Promise<void>;
  exportPDF: () => Promise<ExportFile>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProject: null,
  overlays: [],
  selectedOverlayId: null,
  currentPage: 1,
  zoom: 1.0,
  toolMode: 'SELECT',
  showProtectedZones: true,
  analysis: null,
  isLoading: false,
  isSaving: false,
  hasUnsavedChanges: false,
  saveError: null,
  error: null,
  undoStack: [],
  redoStack: [],

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await ProjectService.list(1, 100);
      set({ projects: response.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch projects', isLoading: false });
    }
  },

  selectProject: async (id: string) => {
    set({ isLoading: true, error: null, selectedOverlayId: null, undoStack: [], redoStack: [] });
    try {
      const project = await ProjectService.get(id);
      const analysis = await ProjectService.analyze(id);
      
      set({
        activeProject: project,
        overlays: project.overlays,
        analysis,
        currentPage: 1,
        hasUnsavedChanges: false,
        saveError: null,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to select project', isLoading: false });
    }
  },

  uploadProject: async (file: File, name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const project = await ProjectService.upload(file, name);
      set((state) => ({
        projects: [project, ...state.projects],
        isLoading: false,
      }));
      return project;
    } catch (err: any) {
      set({ error: err.response?.data?.message || err.message || 'Upload failed', isLoading: false });
      throw err;
    }
  },

  deleteProject: async (id: string) => {
    try {
      await ProjectService.delete(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        activeProject: state.activeProject?.id === id ? null : state.activeProject,
        overlays: state.activeProject?.id === id ? [] : state.overlays,
        analysis: state.activeProject?.id === id ? null : state.analysis,
      }));
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete project' });
    }
  },

  setCurrentPage: (page) => set({ currentPage: page }),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(3.0, zoom)) }),
  setToolMode: (mode) => set({ toolMode: mode }),
  toggleProtectedZones: () => set((state) => ({ showProtectedZones: !state.showProtectedZones })),
  setSelectedOverlayId: (id) => set({ selectedOverlayId: id }),

  saveHistoryState: () => {
    const { overlays, undoStack } = get();
    // Keep max 30 actions
    const newUndo = [...undoStack, { overlays: JSON.parse(JSON.stringify(overlays)) }].slice(-30);
    set({ undoStack: newUndo, redoStack: [] });
  },

  undo: () => {
    const { undoStack, overlays, redoStack } = get();
    if (undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);
    const newRedo = [{ overlays: JSON.parse(JSON.stringify(overlays)) }, ...redoStack];

    set({
      overlays: previous.overlays,
      undoStack: newUndo,
      redoStack: newRedo,
      selectedOverlayId: null,
      hasUnsavedChanges: true,
      saveError: null,
    });
  },

  redo: () => {
    const { redoStack, overlays, undoStack } = get();
    if (redoStack.length === 0) return;

    const next = redoStack[0];
    const newRedo = redoStack.slice(1);
    const newUndo = [...undoStack, { overlays: JSON.parse(JSON.stringify(overlays)) }];

    set({
      overlays: next.overlays,
      undoStack: newUndo,
      redoStack: newRedo,
      selectedOverlayId: null,
      hasUnsavedChanges: true,
      saveError: null,
    });
  },

  addOverlay: (overlayData) => {
    get().saveHistoryState();
    
    const id = `overlay-${Math.random().toString(36).substr(2, 9)}`;
    const newOverlay: OverlayField = {
      ...overlayData,
      id,
      projectId: get().activeProject?.id || '',
    } as OverlayField;

    set((state) => ({
      overlays: [...state.overlays, newOverlay],
      selectedOverlayId: id,
      hasUnsavedChanges: true,
      saveError: null,
    }));
    return id;
  },

  updateOverlay: (id, updates) => {
    get().saveHistoryState();
    
    set((state) => ({
      overlays: state.overlays.map((o) => (o.id === id ? { ...o, ...updates } as OverlayField : o)),
      hasUnsavedChanges: true,
      saveError: null,
    }));
  },

  deleteOverlay: (id) => {
    get().saveHistoryState();
    
    set((state) => ({
      overlays: state.overlays.filter((o) => o.id !== id),
      selectedOverlayId: state.selectedOverlayId === id ? null : state.selectedOverlayId,
      hasUnsavedChanges: true,
      saveError: null,
    }));
  },

  duplicateOverlay: (id) => {
    const { overlays } = get();
    const source = overlays.find((o) => o.id === id);
    if (!source) return;

    get().saveHistoryState();

    const newId = `overlay-${Math.random().toString(36).substr(2, 9)}`;
    const duplicate: OverlayField = {
      ...source,
      id: newId,
      // Shift slightly so it's visible on copy paste
      x: Math.min(90, source.x + 2),
      y: Math.min(90, source.y + 2),
    };

    set((state) => ({
      overlays: [...state.overlays, duplicate],
      selectedOverlayId: newId,
      hasUnsavedChanges: true,
      saveError: null,
    }));
  },

  saveDraft: async () => {
    const { activeProject, overlays } = get();
    if (!activeProject) return;

    set({ isSaving: true, saveError: null });
    try {
      // Clean up metadata overlays (omit local IDs if desired, or let service handle it)
      const sanitized = overlays.map(({ id, ...rest }) => rest);
      await ProjectService.saveOverlays(activeProject.id, sanitized);
      set({ isSaving: false, hasUnsavedChanges: false, saveError: null });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Failed to save overlays';
      set({ saveError: message, isSaving: false });
      throw err;
    }
  },

  exportPDF: async () => {
    const { activeProject } = get();
    if (!activeProject) throw new Error('No active project');

    set({ isSaving: true, saveError: null });
    try {
      // Ensure current overlays are saved first
      await get().saveDraft();
      set({ isSaving: true });

      // Trigger compilation in backend
      const exportFile = await ProjectService.exportPDF(activeProject.id);
      set({ isSaving: false });
      return exportFile;
    } catch (err: any) {
      set({ saveError: err.response?.data?.message || err.message || 'Failed to export PDF', isSaving: false });
      throw err;
    }
  },
}));
