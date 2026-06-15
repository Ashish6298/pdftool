import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name is too long'),
});

export const OverlayItemSchema = z.object({
  id: z.string().optional(),
  pageNumber: z.number().int().min(1),
  type: z.enum(['TEXT', 'NOTE', 'SIGNATURE', 'STAMP', 'CHECKBOX', 'DATE']),
  textContent: z.string().nullable().optional(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
  rotation: z.number().optional().default(0),
  fontSize: z.number().int().min(6).max(72).optional().default(12),
  fontFamily: z.string().optional().default('Helvetica'),
  fontColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().default('#000000'),
  bold: z.boolean().optional().default(false),
  italic: z.boolean().optional().default(false),
  underline: z.boolean().optional().default(false),
  alignment: z.enum(['left', 'center', 'right']).optional().default('left'),
  opacity: z.number().min(0).max(1).optional().default(1),
  locked: z.boolean().optional().default(false),
  zIndex: z.number().int().optional().default(1),
});

export const SaveOverlaysSchema = z.object({
  overlays: z.array(OverlayItemSchema),
});
