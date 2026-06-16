import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { Stage, Layer, Rect, Text, Transformer, Group } from 'react-konva';
import { useProjectStore, ToolMode } from '../../store/projectStore';
import { checkCollision } from '../../utils/whitespace';
import { EmptyRegion, OverlayField, OverlayType } from '../../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface EditorCanvasProps {
  projectId: string;
}

export default function EditorCanvas({ projectId }: EditorCanvasProps) {
  const {
    overlays,
    currentPage,
    zoom,
    toolMode,
    setToolMode,
    showProtectedZones,
    analysis,
    addOverlay,
    updateOverlay,
    selectedOverlayId,
    setSelectedOverlayId,
  } = useProjectStore();

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const [pdfPage, setPdfPage] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 595, height: 842 }); // Default A4
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [tempRect, setTempRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [draggedOverlayInitial, setDraggedOverlayInitial] = useState<any>(null);
  const [inlineEditor, setInlineEditor] = useState<{
    overlayId: string;
    region: EmptyRegion;
    value: string;
  } | null>(null);
  const inlineEditorRef = useRef<HTMLTextAreaElement>(null);

  // Load PDF Page
  useEffect(() => {
    let disposed = false;
    let loadingTask: any;

    const loadPdf = async () => {
      try {
        const url = `/api/projects/${projectId}/file`;
        loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(currentPage);
        if (!disposed) {
          setPdfPage(page);
        }
      } catch (err) {
        if (!disposed && (err as Error).name !== 'RenderingCancelledException') {
          console.error('Error loading PDF page:', err);
        }
      }
    };

    loadPdf();

    return () => {
      disposed = true;
      setPdfPage(null);
      loadingTask?.destroy();
    };
  }, [projectId, currentPage]);

  // Render PDF to Canvas
  useEffect(() => {
    if (!pdfPage || !pdfCanvasRef.current) return;

    const canvas = pdfCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    renderTaskRef.current?.cancel();

    const viewport = pdfPage.getViewport({
      scale: zoom,
      rotation: pdfPage.rotate,
      dontFlip: false,
    });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    setDimensions({ width: viewport.width, height: viewport.height });

    const renderTask = pdfPage.render({
      canvasContext: context,
      viewport,
      intent: 'display',
    });
    renderTaskRef.current = renderTask;

    renderTask.promise.catch((err: Error) => {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Error rendering PDF page:', err);
      }
    });

    return () => {
      renderTask.cancel();
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
      }
    };
  }, [pdfPage, zoom]);

  // Sync Konva selection with Transformer
  useEffect(() => {
    if (transformerRef.current) {
      const selectedNode = stageRef.current.findOne(`#${selectedOverlayId}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      } else {
        transformerRef.current.nodes([]);
      }
    }
  }, [selectedOverlayId]);

  // Active page's overlays
  const pageOverlays = overlays.filter((o) => o.pageNumber === currentPage);

  // Active page's protected zones
  const activePageAnalysis = analysis?.pages.find((p) => p.pageNumber === currentPage);
  const protectedZones = activePageAnalysis?.textBlocks || [];
  const emptyRegions = activePageAnalysis?.emptyRegions || [];
  const isBlankLineRegion = (region: EmptyRegion) =>
    region.kind === 'BLANK_LINE' || (region.height <= 3.4 && region.width >= 6);
  const regionContainsOverlay = (region: EmptyRegion) =>
    pageOverlays.some((overlay) => {
      const overlapWidth = Math.max(
        0,
        Math.min(overlay.x + overlay.width, region.x + region.width) -
          Math.max(overlay.x, region.x)
      );
      const overlapHeight = Math.max(
        0,
        Math.min(overlay.y + overlay.height, region.y + region.height) -
          Math.max(overlay.y, region.y)
      );
      const overlapArea = overlapWidth * overlapHeight;
      const regionArea = region.width * region.height;

      return regionArea > 0 && overlapArea / regionArea > 0.65;
    });

  const startInlineEditing = (region: EmptyRegion) => {
    const overlayId = addOverlay({
      pageNumber: currentPage,
      type: 'TEXT',
      textContent: '',
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      rotation: 0,
      fontSize: 10,
      fontFamily: 'Helvetica',
      fontColor: '#000000',
      bold: false,
      italic: false,
      underline: false,
      alignment: 'left',
      opacity: 1.0,
      locked: false,
      zIndex: overlays.length + 1,
    });
    setInlineEditor({ overlayId, region, value: '' });
  };

  useEffect(() => {
    inlineEditorRef.current?.focus();
  }, [inlineEditor?.overlayId]);

  useEffect(() => {
    const handleEmptyRegionEdit = (event: Event) => {
      const { pageNumber, region } = (event as CustomEvent<{
        pageNumber: number;
        region: EmptyRegion;
      }>).detail;
      if (pageNumber === currentPage) {
        startInlineEditing(region);
      }
    };

    window.addEventListener('edit-empty-region', handleEmptyRegionEdit);
    return () => window.removeEventListener('edit-empty-region', handleEmptyRegionEdit);
  }, [currentPage, overlays.length]);

  const finishInlineEditing = () => {
    if (!inlineEditor) return;
    if (inlineEditor.value.trim()) {
      updateOverlay(inlineEditor.overlayId, { textContent: inlineEditor.value });
    } else {
      useProjectStore.getState().deleteOverlay(inlineEditor.overlayId);
    }
    setSelectedOverlayId(null);
    setInlineEditor(null);
  };

  // Mouse interaction handlers for overlay creation
  const handleStageMouseDown = (e: any) => {
    const clickedOnEmpty = e.target === stageRef.current || e.target.name() === 'pdf-background';
    if (clickedOnEmpty) {
      setSelectedOverlayId(null);
    }

    if (toolMode === 'SELECT') return;

    // Creation Mode
    const pos = stageRef.current.getPointerPosition();
    if (!pos) return;

    setIsDrawing(true);
    setDrawStart({ x: pos.x, y: pos.y });
    setTempRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleStageMouseMove = (e: any) => {
    if (!isDrawing || !tempRect) return;
    const pos = stageRef.current.getPointerPosition();
    if (!pos) return;

    setTempRect({
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      width: Math.abs(pos.x - drawStart.x),
      height: Math.abs(pos.y - drawStart.y),
    });
  };

  const handleStageMouseUp = (e: any) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (!tempRect) return;

    // Determine final bounds in percentages
    const pctX = (tempRect.x / dimensions.width) * 100;
    const pctY = (tempRect.y / dimensions.height) * 100;
    
    // If the drag box is very small, we treat it as a click and use a default width/height
    const isTinyClick = tempRect.width < 10 && tempRect.height < 10;
    const pctWidth = isTinyClick ? 20 : (tempRect.width / dimensions.width) * 100;
    const pctHeight = isTinyClick ? 5 : (tempRect.height / dimensions.height) * 100;

    const overlayRect = {
      x: isTinyClick ? pctX - 10 : pctX,
      y: isTinyClick ? pctY - 2.5 : pctY,
      width: pctWidth,
      height: pctHeight,
    };

    // Ensure bounds inside page
    overlayRect.x = Math.max(0, Math.min(100 - overlayRect.width, overlayRect.x));
    overlayRect.y = Math.max(0, Math.min(100 - overlayRect.height, overlayRect.y));

    // Collision Check
    const hasCollision = checkCollision(overlayRect, protectedZones, 0.4);
    if (hasCollision) {
      alert('Original document content cannot be modified. Please place text only in empty spaces.');
      setTempRect(null);
      setToolMode('SELECT');
      return;
    }

    // Set default content based on mode
    let textContent = '';
    let type: OverlayType = 'TEXT';

    if (toolMode === 'ADD_TEXT') {
      textContent = 'New text field';
      type = 'TEXT';
    } else if (toolMode === 'ADD_CHECKBOX') {
      textContent = 'false';
      type = 'CHECKBOX';
      overlayRect.width = 3.5; // Fixed relative square
      overlayRect.height = 3.5;
    } else if (toolMode === 'ADD_SIGNATURE') {
      textContent = '';
      type = 'SIGNATURE';
      overlayRect.width = 25;
      overlayRect.height = 8;
    } else if (toolMode === 'ADD_DATE') {
      textContent = new Date().toLocaleDateString();
      type = 'DATE';
      overlayRect.width = 15;
      overlayRect.height = 4.5;
    }

    addOverlay({
      pageNumber: currentPage,
      type,
      textContent,
      x: overlayRect.x,
      y: overlayRect.y,
      width: overlayRect.width,
      height: overlayRect.height,
      rotation: 0,
      fontSize: type === 'CHECKBOX' ? 12 : 10,
      fontFamily: 'Helvetica',
      fontColor: '#000000',
      bold: false,
      italic: false,
      underline: false,
      alignment: 'left',
      opacity: 1.0,
      locked: false,
      zIndex: overlays.length + 1,
    });

    setTempRect(null);
    setToolMode('SELECT'); // Reset to selection pointer
  };

  // Keyboard Delete / Duplicate handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedOverlayId) return;
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'SELECT';
      if (isInput) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { deleteOverlay } = useProjectStore.getState();
        deleteOverlay(selectedOverlayId);
      }
      
      // Ctrl+D to duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const { duplicateOverlay } = useProjectStore.getState();
        duplicateOverlay(selectedOverlayId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOverlayId]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto p-8 flex items-start justify-center bg-slate-100/75 relative"
    >
      <div
        className="relative bg-white shadow-2xl select-none"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        {/* PDF Canvas layer */}
        <canvas ref={pdfCanvasRef} className="absolute top-0 left-0 z-0" />

        {/* Konva Stage overlay layer */}
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute top-0 left-0 z-10"
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
        >
          <Layer>
            {/* Visual Protected Zones indicator */}
            {showProtectedZones &&
              protectedZones.map((zone, i) => (
                <Rect
                  key={`zone-${i}`}
                  x={(zone.x / 100) * dimensions.width}
                  y={(zone.y / 100) * dimensions.height}
                  width={(zone.width / 100) * dimensions.width}
                  height={(zone.height / 100) * dimensions.height}
                  fill="rgba(239, 68, 68, 0.08)"
                  stroke="rgba(239, 68, 68, 0.2)"
                  strokeWidth={0.8}
                  listening={false}
                />
              ))}

            {showProtectedZones &&
              emptyRegions.map((region, i) => {
                if (regionContainsOverlay(region)) return null;

                const isBlankLine = isBlankLineRegion(region);
                const x = (region.x / 100) * dimensions.width;
                const y = (region.y / 100) * dimensions.height;
                const width = (region.width / 100) * dimensions.width;
                const height = (region.height / 100) * dimensions.height;

                return (
                  <Group
                    key={`empty-region-${i}`}
                    onClick={() => startInlineEditing(region)}
                    onTap={() => startInlineEditing(region)}
                    listening
                  >
                    <Rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={isBlankLine ? 'rgba(14, 165, 233, 0.16)' : 'rgba(0, 0, 0, 0.001)'}
                      stroke={isBlankLine ? 'rgba(2, 132, 199, 0.75)' : 'transparent'}
                      strokeWidth={isBlankLine ? 1.2 : 0}
                      cornerRadius={isBlankLine ? 1 : 0}
                    />
                    {isBlankLine && (
                      <Rect
                        x={x}
                        y={y + height - 1.5}
                        width={width}
                        height={1.5}
                        fill="rgba(2, 132, 199, 0.85)"
                        listening={false}
                      />
                    )}
                  </Group>
                );
              })}

            {/* Temporary drag box creation rectangle */}
            {tempRect && (
              <Rect
                x={tempRect.x}
                y={tempRect.y}
                width={tempRect.width}
                height={tempRect.height}
                stroke="#3b82f6"
                strokeWidth={1.5}
                dash={[4, 4]}
                fill="rgba(59, 130, 246, 0.1)"
              />
            )}

            {/* Rendered Annotations Overlays */}
            {pageOverlays.map((overlay) => {
              const absX = (overlay.x / 100) * dimensions.width;
              const absY = (overlay.y / 100) * dimensions.height;
              const absWidth = (overlay.width / 100) * dimensions.width;
              const absHeight = (overlay.height / 100) * dimensions.height;

              const isSelected = selectedOverlayId === overlay.id;

              if (inlineEditor?.overlayId === overlay.id) return null;

              return (
                <Group
                  key={overlay.id}
                  id={overlay.id}
                  x={absX}
                  y={absY}
                  width={absWidth}
                  height={absHeight}
                  draggable={!overlay.locked && toolMode === 'SELECT'}
                  onClick={() => setSelectedOverlayId(overlay.id)}
                  onDragStart={(e) => {
                    setDraggedOverlayInitial({ x: overlay.x, y: overlay.y });
                  }}
                  onDragEnd={(e) => {
                    const node = e.target;
                    const newPctX = (node.x() / dimensions.width) * 100;
                    const newPctY = (node.y() / dimensions.height) * 100;

                    const newRect = {
                      x: newPctX,
                      y: newPctY,
                      width: overlay.width,
                      height: overlay.height,
                    };

                    // Check collisions on drag stop
                    const hasCollision = checkCollision(newRect, protectedZones, 0.4);
                    if (hasCollision) {
                      alert('Original document content cannot be modified. Resetting placement.');
                      // Reset to initial coordinates
                      node.x((draggedOverlayInitial.x / 100) * dimensions.width);
                      node.y((draggedOverlayInitial.y / 100) * dimensions.height);
                      node.getLayer()?.batchDraw();
                    } else {
                      updateOverlay(overlay.id, { x: newPctX, y: newPctY });
                    }
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    // Reset scale and adjust width/height instead
                    node.scaleX(1);
                    node.scaleY(1);

                    const newPctWidth = ((node.width() * scaleX) / dimensions.width) * 100;
                    const newPctHeight = ((node.height() * scaleY) / dimensions.height) * 100;
                    const newPctX = (node.x() / dimensions.width) * 100;
                    const newPctY = (node.y() / dimensions.height) * 100;

                    const newRect = {
                      x: newPctX,
                      y: newPctY,
                      width: newPctWidth,
                      height: newPctHeight,
                    };

                    const hasCollision = checkCollision(newRect, protectedZones, 0.4);
                    if (hasCollision) {
                      alert('Original document content cannot be modified. Resetting transformations.');
                      // Force redraw
                      node.getLayer()?.batchDraw();
                    } else {
                      updateOverlay(overlay.id, {
                        x: newPctX,
                        y: newPctY,
                        width: newPctWidth,
                        height: newPctHeight,
                      });
                    }
                  }}
                >
                  {overlay.type === 'CHECKBOX' ? (
                    <>
                      <Rect
                        width={absWidth}
                        height={absHeight}
                        stroke={overlay.fontColor}
                        strokeWidth={1.5}
                        fill="white"
                        cornerRadius={2}
                      />
                      {overlay.textContent === 'true' && (
                        <Text
                          width={absWidth}
                          height={absHeight}
                          text="✕"
                          fontSize={Math.min(absWidth, absHeight) * 0.7}
                          fill={overlay.fontColor}
                          align="center"
                          verticalAlign="middle"
                        />
                      )}
                    </>
                  ) : overlay.type === 'SIGNATURE' && overlay.textContent.startsWith('data:image') ? (
                    // Signature Image drawing
                    <Rect
                      width={absWidth}
                      height={absHeight}
                      stroke={isSelected ? '#3b82f6' : 'rgba(0,0,0,0.1)'}
                      strokeWidth={1}
                      fillPatternImage={
                        (() => {
                          const img = new window.Image();
                          img.src = overlay.textContent;
                          return img;
                        })()
                      }
                      fillPatternScaleX={absWidth / 250}
                      fillPatternScaleY={absHeight / 100}
                    />
                  ) : (
                    // Standard Text, Note, or Stamp overlay
                    <>
                      {overlay.type !== 'TEXT' || isSelected ? (
                        <Rect
                          width={absWidth}
                          height={absHeight}
                          fill="rgba(59, 130, 246, 0.03)"
                          stroke={isSelected ? '#3b82f6' : 'rgba(59, 130, 246, 0.1)'}
                          strokeWidth={isSelected ? 1.5 : 1}
                          dash={isSelected ? [] : [3, 3]}
                        />
                      ) : null}
                      <Text
                        width={absWidth - 6}
                        height={absHeight - 6}
                        x={3}
                        y={3}
                        text={overlay.textContent || (overlay.type === 'SIGNATURE' ? 'Click to Sign' : '')}
                        fontSize={overlay.fontSize * zoom}
                        fontFamily={overlay.fontFamily}
                        fill={overlay.fontColor}
                        fontStyle={`${overlay.bold ? 'bold' : ''} ${overlay.italic ? 'italic' : ''}`.trim()}
                        align={overlay.alignment}
                        wrap="word"
                      />
                    </>
                  )}
                </Group>
              );
            })}

            {/* Transform outline handles for selected items */}
            {toolMode === 'SELECT' && <Transformer ref={transformerRef} rotateEnabled={false} />}
          </Layer>
        </Stage>

        {inlineEditor && (
          <textarea
            ref={inlineEditorRef}
            value={inlineEditor.value}
            maxLength={inlineEditor.region.maxCharacters}
            onChange={(event) => setInlineEditor({
              ...inlineEditor,
              value: event.target.value,
            })}
            onBlur={finishInlineEditing}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.currentTarget.blur();
              }
            }}
            placeholder="Type here..."
            className="absolute z-20 bg-transparent border-0 outline-none resize-none overflow-hidden select-text text-black placeholder:text-emerald-600/60"
            style={{
              left: `${(inlineEditor.region.x / 100) * dimensions.width}px`,
              top: `${(inlineEditor.region.y / 100) * dimensions.height}px`,
              width: `${(inlineEditor.region.width / 100) * dimensions.width}px`,
              height: `${(inlineEditor.region.height / 100) * dimensions.height}px`,
              padding: '4px',
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: `${10 * zoom}px`,
              lineHeight: 1.35,
            }}
          />
        )}
      </div>
    </div>
  );
}
