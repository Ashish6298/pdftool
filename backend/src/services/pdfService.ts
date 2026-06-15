import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { logger } from '../utils/logger';
import { OverlayType } from '@prisma/client';

const pdfjs = require('pdfjs-dist/legacy/build/pdf');

export interface TextBox {
  text: string;
  x: number;      // percentage (0-100) relative to page width
  y: number;      // percentage (0-100) relative to page height (top-left origin)
  width: number;  // percentage (0-100)
  height: number; // percentage (0-100)
}

export interface SuggestedRegion {
  type: string;
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

function estimateCharacterCapacity(
  region: Pick<EmptyRegion, 'width' | 'height'>,
  pageWidth: number,
  pageHeight: number,
  fontSize = 10
): number {
  const widthPoints = (region.width / 100) * pageWidth;
  const heightPoints = (region.height / 100) * pageHeight;
  const charactersPerLine = Math.floor(Math.max(0, widthPoints - 8) / (fontSize * 0.52));
  const lineCount = Math.floor(Math.max(0, heightPoints - 6) / (fontSize * 1.35));
  return Math.max(0, charactersPerLine * lineCount);
}

function findEmptyRegions(
  textBlocks: TextBox[],
  pageWidth: number,
  pageHeight: number
): EmptyRegion[] {
  const columns = 50;
  const rows = 70;
  const occupied = Array.from({ length: rows }, () => Array(columns).fill(false));

  // Keep suggestions inside a small printable-page margin.
  const marginX = 2;
  const marginY = 2;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = (column / columns) * 100;
      const y = (row / rows) * 100;
      if (x < marginX || x >= 100 - marginX || y < marginY || y >= 100 - marginY) {
        occupied[row][column] = true;
      }
    }
  }

  for (const block of textBlocks) {
    const padding = 0.7;
    const left = Math.max(0, block.x - padding);
    const top = Math.max(0, block.y - padding);
    const right = Math.min(100, block.x + block.width + padding);
    const bottom = Math.min(100, block.y + block.height + padding);
    const startColumn = Math.max(0, Math.floor((left / 100) * columns));
    const endColumn = Math.min(columns - 1, Math.ceil((right / 100) * columns) - 1);
    const startRow = Math.max(0, Math.floor((top / 100) * rows));
    const endRow = Math.min(rows - 1, Math.ceil((bottom / 100) * rows) - 1);

    for (let row = startRow; row <= endRow; row++) {
      for (let column = startColumn; column <= endColumn; column++) {
        occupied[row][column] = true;
      }
    }
  }

  const heights = Array(columns).fill(0);
  const candidates: EmptyRegion[] = [];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      heights[column] = occupied[row][column] ? 0 : heights[column] + 1;
    }

    const stack: number[] = [];
    for (let column = 0; column <= columns; column++) {
      const currentHeight = column === columns ? 0 : heights[column];
      while (stack.length > 0 && heights[stack[stack.length - 1]] > currentHeight) {
        const heightCells = heights[stack.pop()!];
        const leftCell = stack.length === 0 ? 0 : stack[stack.length - 1] + 1;
        const widthCells = column - leftCell;
        const width = (widthCells / columns) * 100;
        const height = (heightCells / rows) * 100;

        if (width < 14 || height < 3.5) continue;

        const region: EmptyRegion = {
          x: (leftCell / columns) * 100,
          y: ((row - heightCells + 1) / rows) * 100,
          width,
          height,
          maxCharacters: 0,
        };
        const touchesProtectedText = textBlocks.some((block) => {
          const padding = 0.7;
          const blockX = Math.max(0, block.x - padding);
          const blockY = Math.max(0, block.y - padding);
          const blockWidth = block.width + padding * 2;
          const blockHeight = block.height + padding * 2;
          return (
            region.x < blockX + blockWidth &&
            region.x + region.width > blockX &&
            region.y < blockY + blockHeight &&
            region.y + region.height > blockY
          );
        });
        if (touchesProtectedText) continue;

        region.maxCharacters = estimateCharacterCapacity(region, pageWidth, pageHeight);
        if (region.maxCharacters >= 20) {
          candidates.push(region);
        }
      }
      stack.push(column);
    }
  }

  candidates.sort((a, b) => {
    const aScore = a.width * a.height + Math.min(a.maxCharacters, 500) * 0.02;
    const bScore = b.width * b.height + Math.min(b.maxCharacters, 500) * 0.02;
    return bScore - aScore;
  });

  const selected: EmptyRegion[] = [];
  for (const candidate of candidates) {
    const overlapsExisting = selected.some((region) => {
      const intersectionWidth = Math.max(
        0,
        Math.min(candidate.x + candidate.width, region.x + region.width) -
          Math.max(candidate.x, region.x)
      );
      const intersectionHeight = Math.max(
        0,
        Math.min(candidate.y + candidate.height, region.y + region.height) -
          Math.max(candidate.y, region.y)
      );
      const intersectionArea = intersectionWidth * intersectionHeight;
      const smallerArea = Math.min(
        candidate.width * candidate.height,
        region.width * region.height
      );
      return smallerArea > 0 && intersectionArea / smallerArea > 0.35;
    });

    if (!overlapsExisting) {
      selected.push(candidate);
    }
    if (selected.length === 10) break;
  }

  return selected.map((region) => ({
    ...region,
    x: Number(region.x.toFixed(2)),
    y: Number(region.y.toFixed(2)),
    width: Number(region.width.toFixed(2)),
    height: Number(region.height.toFixed(2)),
  }));
}

export async function analyzePDF(filePath: string): Promise<AnalysisResult> {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  
  const pages: PageAnalysis[] = [];
  let totalTextItems = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    
    const textBlocks: TextBox[] = [];
    
    for (const item of textContent.items as any[]) {
      if (!item.str || item.str.trim() === '') continue;
      
      totalTextItems++;
      
      const transform = item.transform;
      const left = transform[4];
      const bottom = transform[5];
      const width = item.width;
      const height = item.height || Math.abs(transform[3]) || 12;
      
      // Convert raw PDF bottom-left origin coordinates to rotated/viewport space (top-left origin)
      const [viewX1, viewY1] = viewport.convertToViewportPoint(left, bottom);
      const [viewX2, viewY2] = viewport.convertToViewportPoint(left + width, bottom + height);

      const xCoord = Math.min(viewX1, viewX2);
      const yCoord = Math.min(viewY1, viewY2);
      const wCoord = Math.abs(viewX2 - viewX1);
      const hCoord = Math.abs(viewY2 - viewY1);

      // Normalize to percentages
      const x = (xCoord / viewport.width) * 100;
      const y = (yCoord / viewport.height) * 100;
      const w = (wCoord / viewport.width) * 100;
      const h = (hCoord / viewport.height) * 100;

      textBlocks.push({
        text: item.str,
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
        width: Math.max(0, Math.min(100, w)),
        height: Math.max(0, Math.min(100, h)),
      });
    }

    const suggestedRegions: SuggestedRegion[] = [];
    
    const keywordRules = [
      { regex: /signature|sign here|authorized sign/i, type: 'SIGNATURE', label: 'Signature Area', width: 25, height: 8 },
      { regex: /notes|remarks|terms|conditions/i, type: 'NOTE', label: 'Notes Area', width: 40, height: 12 },
      { regex: /date|document date|due date/i, type: 'DATE', label: 'Date Placement', width: 15, height: 4 },
      { regex: /total|amount due|subtotal/i, type: 'TEXT', label: 'Total/Amount Field', width: 20, height: 4 },
    ];

    for (const block of textBlocks) {
      for (const rule of keywordRules) {
        if (rule.regex.test(block.text)) {
          const sugX = block.x;
          const sugY = block.y + block.height + 1.5;
          
          if (sugX + rule.width <= 100 && sugY + rule.height <= 100) {
            let overlaps = false;
            for (const other of textBlocks) {
              if (
                sugX < other.x + other.width &&
                sugX + rule.width > other.x &&
                sugY < other.y + other.height &&
                sugY + rule.height > other.y
              ) {
                overlaps = true;
                break;
              }
            }
            if (!overlaps) {
              suggestedRegions.push({
                type: rule.type,
                x: sugX,
                y: sugY,
                width: rule.width,
                height: rule.height,
                label: `Suggested ${rule.label}`
              });
            }
          }
        }
      }
    }

    const emptyRegions = findEmptyRegions(textBlocks, viewport.width, viewport.height);

    pages.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      textBlocks,
      suggestedRegions,
      emptyRegions,
    });
  }

  const isScanned = totalTextItems < 3;

  return {
    pages,
    isScanned,
  };
}

export async function exportAnnotatedPDF(
  originalPath: string,
  outputPath: string,
  overlays: any[],
  highlightAnnotations = false
): Promise<void> {
  const fileBuffer = fs.readFileSync(originalPath);
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const pages = pdfDoc.getPages();

  const hexToRgb = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255 || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255 || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255 || 0;
    return rgb(r, g, b);
  };

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const getFont = (family: string, isBold: boolean) => {
    if (family.toLowerCase().includes('courier')) return fontCourier;
    if (family.toLowerCase().includes('times')) return fontTimes;
    return isBold ? fontHelveticaBold : fontHelvetica;
  };

  for (const overlay of overlays) {
    const pageNum = overlay.pageNumber;
    if (pageNum < 1 || pageNum > pages.length) continue;

    const page = pages[pageNum - 1];
    const { width, height } = page.getSize();
    const rotationAngle = page.getRotation().angle;

    // Normalizing layout dimensions relative to size
    const absX = (overlay.x / 100) * width;
    const absY = (overlay.y / 100) * height;
    const absWidth = (overlay.width / 100) * width;
    const absHeight = (overlay.height / 100) * height;

    // Default: no rotation
    let drawX = absX;
    let drawY = height - absY - absHeight;
    let drawRotation = 0;

    // Map drawing coordinates and rotate text based on page orientation angle
    if (rotationAngle === 90) {
      drawX = absY;
      drawY = absX;
      drawRotation = -90;
    } else if (rotationAngle === 180) {
      drawX = width - absX - absWidth;
      drawY = absY;
      drawRotation = 180;
    } else if (rotationAngle === 270) {
      drawX = width - absY - absHeight;
      drawY = height - absX;
      drawRotation = 90;
    }

    const color = hexToRgb(overlay.fontColor || '#000000');
    const fontSize = overlay.fontSize || 12;
    const font = getFont(overlay.fontFamily || 'Helvetica', overlay.bold);

    if (highlightAnnotations) {
      page.drawRectangle({
        x: drawX,
        y: drawY,
        width: absWidth,
        height: absHeight,
        color: rgb(1, 0.92, 0.35),
        opacity: 0.35,
        rotate: degrees(drawRotation),
      });
    }

    switch (overlay.type) {
      case 'CHECKBOX': {
        page.drawRectangle({
          x: drawX,
          y: drawY,
          width: absWidth,
          height: absHeight,
          borderColor: color,
          borderWidth: 1.5,
          opacity: overlay.opacity || 1.0,
          rotate: degrees(drawRotation),
        });

        if (overlay.textContent === 'true' || overlay.textContent === 'checked') {
          // Draw check cross
          page.drawLine({
            start: { x: drawX + 3, y: drawY + 3 },
            end: { x: drawX + absWidth - 3, y: drawY + absHeight - 3 },
            color,
            thickness: 1.5,
          });
          page.drawLine({
            start: { x: drawX + 3, y: drawY + absHeight - 3 },
            end: { x: drawX + absWidth - 3, y: drawY + 3 },
            color,
            thickness: 1.5,
          });
        }
        break;
      }

      case 'SIGNATURE': {
        if (overlay.textContent && overlay.textContent.startsWith('data:image/png;base64,')) {
          try {
            const base64Data = overlay.textContent.replace(/^data:image\/png;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            const embeddedImage = await pdfDoc.embedPng(imgBuffer);
            page.drawImage(embeddedImage, {
              x: drawX,
              y: drawY,
              width: absWidth,
              height: absHeight,
              opacity: overlay.opacity || 1.0,
              rotate: degrees(drawRotation),
            });
          } catch (err) {
            logger.error('Failed to embed signature image:', err);
          }
        } else {
          page.drawText(overlay.textContent || 'Signature', {
            x: drawX + 4,
            y: drawY + 4,
            size: fontSize,
            font,
            color,
            opacity: overlay.opacity || 1.0,
            rotate: degrees(drawRotation),
          });
        }
        break;
      }

      case 'STAMP': {
        page.drawRectangle({
          x: drawX,
          y: drawY,
          width: absWidth,
          height: absHeight,
          borderColor: color,
          borderWidth: 2,
          opacity: overlay.opacity || 0.8,
          rotate: degrees(drawRotation),
        });

        const stampText = overlay.textContent || 'STAMP';
        const textWidth = font.widthOfTextAtSize(stampText, fontSize);
        const textHeight = fontSize;
        const textX = drawX + (absWidth - textWidth) / 2;
        const textY = drawY + (absHeight - textHeight) / 2;

        page.drawText(stampText, {
          x: textX,
          y: textY,
          size: fontSize,
          font,
          color,
          opacity: overlay.opacity || 0.8,
          rotate: degrees(drawRotation),
        });
        break;
      }

      case 'TEXT':
      case 'NOTE':
      case 'DATE':
      default: {
        const text = overlay.textContent || '';
        const lines = text.split('\n');
        let currentY = drawY + absHeight - fontSize - 2;

        for (const line of lines) {
          if (currentY < drawY) break;

          let drawLineX = drawX;
          if (overlay.alignment === 'center' || overlay.alignment === 'right') {
            const lineWidth = font.widthOfTextAtSize(line, fontSize);
            if (overlay.alignment === 'center') {
              drawLineX = drawX + (absWidth - lineWidth) / 2;
            } else {
              drawLineX = drawX + absWidth - lineWidth;
            }
          }

          page.drawText(line, {
            x: drawLineX,
            y: currentY,
            size: fontSize,
            font,
            color,
            opacity: overlay.opacity || 1.0,
            rotate: degrees(drawRotation),
          });

          currentY -= (fontSize + 4);
        }
        break;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}
