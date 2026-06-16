export type OverlayType = 'TEXT' | 'NOTE' | 'SIGNATURE' | 'STAMP' | 'CHECKBOX' | 'DATE';

export interface OverlayField {
  id: string;
  projectId: string;
  pageNumber: number;
  type: OverlayType;
  textContent: string;
  
  // Normalized percentage coordinate bounds (0-100)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  
  // Style config
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  alignment: 'left' | 'center' | 'right';
  opacity: number;
  locked: boolean;
  zIndex: number;
}

export interface UploadedFile {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  checksum: string;
  createdAt: string;
}

export interface ExportFile {
  id: string;
  projectId: string;
  version: number;
  filename: string;
  storagePath: string;
  metadata?: {
    overlayCount: number;
    exportedAt: string;
    previewStoragePath?: string;
  };
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  uploadedFile?: UploadedFile;
  overlays: OverlayField[];
  exports?: ExportFile[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    overlays: number;
    exports: number;
  };
}

export interface TextBox {
  text: string;
  x: number;      // %
  y: number;      // %
  width: number;  // %
  height: number; // %
}

export interface SuggestedRegion {
  type: OverlayType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface EmptyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  maxCharacters: number;
  kind?: 'WHITESPACE' | 'BLANK_LINE';
}

export interface PageAnalysis {
  pageNumber: number;
  width: number;
  height: number;
  textBlocks: TextBox[];
  suggestedRegions: SuggestedRegion[];
  emptyRegions: EmptyRegion[];
}

export interface AnalysisResult {
  pages: PageAnalysis[];
  isScanned: boolean;
}
