import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorMiddleware';
import { analyzePDF, exportAnnotatedPDF } from '../services/pdfService';
import { CreateProjectSchema, SaveOverlaysSchema } from '../validators/projectValidator';
import { logger } from '../utils/logger';

const storageDir = process.env.STORAGE_DIR || path.join(__dirname, '../../../storage');
const exportDir = path.join(storageDir, 'exports');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

// Helper: Calculate checksum
function calculateMD5(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('md5');
  hash.update(fileBuffer);
  return hash.digest('hex');
}

export const uploadPDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded or file format not supported.', 400));
    }

    const { name } = req.body;
    const validatedData = CreateProjectSchema.safeParse({ name: name || req.file.originalname });
    
    if (!validatedData.success) {
      // Clean up file if validation failed
      fs.unlinkSync(req.file.path);
      return next(new AppError(validatedData.error.errors[0].message, 400));
    }

    const checksum = calculateMD5(req.file.path);

    // Create project and linked file records
    const project = await prisma.project.create({
      data: {
        name: validatedData.data.name,
        uploadedFile: {
          create: {
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            storagePath: req.file.filename,
            checksum,
          },
        },
      },
      include: {
        uploadedFile: true,
      },
    });

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

export const listProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [projects, total] = await prisma.$transaction([
      prisma.project.findMany({
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          uploadedFile: {
            select: {
              filename: true,
              fileSize: true,
              createdAt: true,
            },
          },
          _count: {
            select: { overlays: true, exports: true },
          },
        },
      }),
      prisma.project.count(),
    ]);

    res.json({
      success: true,
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        uploadedFile: true,
        overlays: {
          orderBy: { zIndex: 'asc' },
        },
      },
    });

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { uploadedFile: true },
    });

    if (!project || !project.uploadedFile) {
      return next(new AppError('Project file not found', 404));
    }

    const filePath = path.join(storageDir, 'uploads', project.uploadedFile.storagePath);
    if (!fs.existsSync(filePath)) {
      return next(new AppError('File missing from disk storage', 404));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(project.uploadedFile.filename)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

export const analyzeProjectFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { uploadedFile: true },
    });

    if (!project || !project.uploadedFile) {
      return next(new AppError('Project file not found', 404));
    }

    const filePath = path.join(storageDir, 'uploads', project.uploadedFile.storagePath);
    if (!fs.existsSync(filePath)) {
      return next(new AppError('File missing from storage disk', 404));
    }

    const analysis = await analyzePDF(filePath);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    next(error);
  }
};

export const saveOverlays = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsedData = SaveOverlaysSchema.safeParse(req.body);

    if (!parsedData.success) {
      return next(new AppError(parsedData.error.errors[0].message, 400));
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    // Save overlays in transaction: delete existing and insert new
    await prisma.$transaction([
      prisma.overlayField.deleteMany({
        where: { projectId: id },
      }),
      prisma.overlayField.createMany({
        data: parsedData.data.overlays.map((overlay) => ({
          projectId: id,
          pageNumber: overlay.pageNumber,
          type: overlay.type,
          textContent: overlay.textContent || '',
          x: overlay.x,
          y: overlay.y,
          width: overlay.width,
          height: overlay.height,
          rotation: overlay.rotation,
          fontSize: overlay.fontSize,
          fontFamily: overlay.fontFamily,
          fontColor: overlay.fontColor,
          bold: overlay.bold,
          italic: overlay.italic,
          underline: overlay.underline,
          alignment: overlay.alignment,
          opacity: overlay.opacity,
          locked: overlay.locked,
          zIndex: overlay.zIndex,
        })),
      }),
    ]);

    // Track Version History
    const currentVersionCount = await prisma.projectVersion.count({ where: { projectId: id } });
    await prisma.projectVersion.create({
      data: {
        projectId: id,
        version: currentVersionCount + 1,
        overlays: parsedData.data.overlays as any,
      },
    });

    const updatedProject = await prisma.project.findUnique({
      where: { id },
      include: { overlays: true },
    });

    res.json({
      success: true,
      message: 'Overlays saved successfully.',
      data: updatedProject,
    });
  } catch (error) {
    next(error);
  }
};

export const exportProjectPDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        uploadedFile: true,
        overlays: true,
      },
    });

    if (!project || !project.uploadedFile) {
      return next(new AppError('Project or template file not found', 404));
    }

    const originalFilePath = path.join(storageDir, 'uploads', project.uploadedFile.storagePath);
    if (!fs.existsSync(originalFilePath)) {
      return next(new AppError('Template file missing from disk', 404));
    }

    const exportVersion = (await prisma.exportFile.count({ where: { projectId: id } })) + 1;
    const exportFileId = crypto.randomUUID();
    const exportFilename = `${path.basename(project.uploadedFile.filename, '.pdf')}_annotated_v${exportVersion}.pdf`;
    const exportStoragePath = `${exportFileId}.pdf`;
    const previewStoragePath = `${exportFileId}-preview.pdf`;
    const outputFilePath = path.join(exportDir, exportStoragePath);
    const previewFilePath = path.join(exportDir, previewStoragePath);

    // Run overlay generation using pdf-lib
    await exportAnnotatedPDF(originalFilePath, outputFilePath, project.overlays);
    await exportAnnotatedPDF(originalFilePath, previewFilePath, project.overlays, true);

    // Save Export metadata
    const exportRecord = await prisma.exportFile.create({
      data: {
        projectId: id,
        version: exportVersion,
        filename: exportFilename,
        storagePath: exportStoragePath,
        metadata: {
          overlayCount: project.overlays.length,
          exportedAt: new Date().toISOString(),
          previewStoragePath,
        },
      },
    });

    res.json({
      success: true,
      data: exportRecord,
    });
  } catch (error) {
    next(error);
  }
};

export const listExportHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const exports = await prisma.exportFile.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: exports,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadExportFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { exportId } = req.params;
    const exportRecord = await prisma.exportFile.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      return next(new AppError('Export record not found', 404));
    }

    const filePath = path.join(exportDir, exportRecord.storagePath);
    if (!fs.existsSync(filePath)) {
      return next(new AppError('Exported PDF file missing from disk storage', 404));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(exportRecord.filename)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

export const previewExportFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { exportId } = req.params;
    const exportRecord = await prisma.exportFile.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      return next(new AppError('Export record not found', 404));
    }

    const metadata = exportRecord.metadata as { previewStoragePath?: string } | null;
    const filePath = path.join(
      exportDir,
      metadata?.previewStoragePath || exportRecord.storagePath
    );
    if (!fs.existsSync(filePath)) {
      return next(new AppError('Exported PDF file missing from disk storage', 404));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(exportRecord.filename)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        uploadedFile: true,
        exports: true,
      },
    });

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    // Clean up original uploaded file on disk
    if (project.uploadedFile) {
      const originalPath = path.join(storageDir, 'uploads', project.uploadedFile.storagePath);
      if (fs.existsSync(originalPath)) {
        fs.unlinkSync(originalPath);
      }
    }

    // Clean up exported files on disk
    for (const exp of project.exports) {
      const exportPath = path.join(exportDir, exp.storagePath);
      if (fs.existsSync(exportPath)) {
        fs.unlinkSync(exportPath);
      }
      const metadata = exp.metadata as { previewStoragePath?: string } | null;
      if (metadata?.previewStoragePath) {
        const previewPath = path.join(exportDir, metadata.previewStoragePath);
        if (fs.existsSync(previewPath)) {
          fs.unlinkSync(previewPath);
        }
      }
    }

    // Cascade delete in Prisma will delete files, versions, and overlays automatically
    await prisma.project.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Project and all associated files deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
