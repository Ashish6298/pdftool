import axios from 'axios';
import { Project, AnalysisResult, OverlayField, ExportFile } from '../types';

const api = axios.create({
  baseURL: '/api',
});

export const ProjectService = {
  list: async (page = 1, limit = 10): Promise<{ data: Project[]; pagination: any }> => {
    const res = await api.get(`/projects?page=${page}&limit=${limit}`);
    return res.data;
  },

  get: async (id: string): Promise<Project> => {
    const res = await api.get(`/projects/${id}`);
    return res.data.data;
  },

  upload: async (file: File, name?: string, onProgress?: (progress: number) => void): Promise<Project> => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) {
      formData.append('name', name);
    }
    const res = await api.post('/projects/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data.data;
  },

  analyze: async (id: string): Promise<AnalysisResult> => {
    const res = await api.post(`/projects/${id}/analyze`);
    return res.data.data;
  },

  saveOverlays: async (id: string, overlays: Omit<OverlayField, 'id'>[]): Promise<Project> => {
    const res = await api.post(`/projects/${id}/overlays`, { overlays });
    return res.data.data;
  },

  exportPDF: async (id: string): Promise<ExportFile> => {
    const res = await api.post(`/projects/${id}/export`);
    return res.data.data;
  },

  listExports: async (id: string): Promise<ExportFile[]> => {
    const res = await api.get(`/projects/${id}/exports`);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },

  getDownloadUrl: (exportId: string): string => {
    return `/api/projects/exports/${exportId}/download`;
  },

  getPreviewUrl: (exportId: string): string => {
    return `/api/projects/exports/${exportId}/preview`;
  },

  getPdfFileUrl: (id: string): string => {
    return `/api/projects/${id}/file`;
  },
};
