import { Router } from 'express';
import { upload } from '../middleware/uploadMiddleware';
import {
  uploadPDF,
  listProjects,
  getProjectDetails,
  getProjectFile,
  analyzeProjectFile,
  saveOverlays,
  exportProjectPDF,
  listExportHistory,
  downloadExportFile,
  previewExportFile,
  deleteProject,
} from '../controllers/projectController';

const router = Router();

// Project routes
router.post('/upload', upload.single('file'), uploadPDF);
router.get('/', listProjects);
router.get('/:id', getProjectDetails);
router.delete('/:id', deleteProject);

// File / Analytics routes
router.get('/:id/file', getProjectFile);
router.post('/:id/analyze', analyzeProjectFile);

// Overlays management
router.post('/:id/overlays', saveOverlays);

// Export paths
router.post('/:id/export', exportProjectPDF);
router.get('/:id/exports', listExportHistory);
router.get('/exports/:exportId/preview', previewExportFile);
router.get('/exports/:exportId/download', downloadExportFile);

export default router;
