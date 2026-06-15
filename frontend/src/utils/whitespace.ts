import { TextBox, OverlayField } from '../types';

/**
 * Checks if a proposed overlay box overlaps with any protected text block on a specific page.
 * Coordinates are represented as percentages (0 to 100).
 * 
 * @param rect Proposed overlay geometry (x, y, width, height)
 * @param textBlocks Bounding boxes of existing text
 * @param paddingMargin Optional padding percentage around protected boxes (default 0.5%)
 */
export function checkCollision(
  rect: { x: number; y: number; width: number; height: number },
  textBlocks: TextBox[],
  paddingMargin = 0.5
): boolean {
  for (const block of textBlocks) {
    const paddedBlock = {
      x: Math.max(0, block.x - paddingMargin),
      y: Math.max(0, block.y - paddingMargin),
      width: block.width + paddingMargin * 2,
      height: block.height + paddingMargin * 2,
    };

    const hasOverlap =
      rect.x < paddedBlock.x + paddedBlock.width &&
      rect.x + rect.width > paddedBlock.x &&
      rect.y < paddedBlock.y + paddedBlock.height &&
      rect.y + rect.height > paddedBlock.y;

    if (hasOverlap) {
      return true;
    }
  }
  return false;
}

export function estimateCharacterCapacity(
  rect: { width: number; height: number },
  pageWidth: number,
  pageHeight: number,
  fontSize = 10
): number {
  const widthPoints = (rect.width / 100) * pageWidth;
  const heightPoints = (rect.height / 100) * pageHeight;
  const charactersPerLine = Math.floor(Math.max(0, widthPoints - 8) / (fontSize * 0.52));
  const lineCount = Math.floor(Math.max(0, heightPoints - 6) / (fontSize * 1.35));
  return Math.max(0, charactersPerLine * lineCount);
}
