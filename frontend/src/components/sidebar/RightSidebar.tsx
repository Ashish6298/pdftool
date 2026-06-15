import React, { useState, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { Trash2, Lock, Unlock, Copy, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline } from 'lucide-react';
import { estimateCharacterCapacity } from '../../utils/whitespace';

export default function RightSidebar() {
  const {
    overlays,
    selectedOverlayId,
    updateOverlay,
    deleteOverlay,
    duplicateOverlay,
    analysis,
  } = useProjectStore();

  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId);
  const selectedPage = analysis?.pages.find((page) => page.pageNumber === selectedOverlay?.pageNumber);
  const characterCapacity =
    selectedOverlay && selectedPage
      ? estimateCharacterCapacity(
          selectedOverlay,
          selectedPage.width,
          selectedPage.height,
          selectedOverlay.fontSize
        )
      : 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  if (!selectedOverlay) {
    return (
      <div className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col justify-center items-center text-center text-slate-400">
        <p className="text-sm">Select an annotation block in the canvas to configure properties.</p>
      </div>
    );
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    updateOverlay(selectedOverlay.id, { textContent: e.target.value });
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = selectedOverlay.fontColor || '#000000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveSignatureImage();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateOverlay(selectedOverlay.id, { textContent: '' });
  };

  const saveSignatureImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    updateOverlay(selectedOverlay.id, { textContent: dataUrl });
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col text-slate-700">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Properties</h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => duplicateOverlay(selectedOverlay.id)}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => deleteOverlay(selectedOverlay.id)}
            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-650 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Block Type */}
        <div>
          <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Block Type</label>
          <span className="text-xs bg-slate-50 px-2.5 py-1 rounded-md font-mono border border-slate-200 text-brand-600 font-semibold">
            {selectedOverlay.type}
          </span>
        </div>

        {/* Text Input */}
        {selectedOverlay.type !== 'CHECKBOX' && selectedOverlay.type !== 'SIGNATURE' && (
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1.5">Text Value</label>
            <textarea
              value={selectedOverlay.textContent || ''}
              onChange={handleTextChange}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-brand-500 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none resize-none transition-all"
              placeholder="Enter text..."
              disabled={selectedOverlay.locked}
            />
            <div
              className={`mt-1 text-[10px] text-right ${
                selectedOverlay.textContent.length > characterCapacity
                  ? 'text-red-600 font-semibold'
                  : 'text-slate-400'
              }`}
            >
              {selectedOverlay.textContent.length} / about {characterCapacity} characters
            </div>
          </div>
        )}

        {/* Checkbox State Toggle */}
        {selectedOverlay.type === 'CHECKBOX' && (
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1.5">Checkbox State</label>
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedOverlay.textContent === 'true'}
                onChange={(e) => updateOverlay(selectedOverlay.id, { textContent: e.target.checked ? 'true' : 'false' })}
                className="w-4 h-4 rounded text-brand-600 bg-slate-55 border-slate-200"
                disabled={selectedOverlay.locked}
              />
              <span className="text-xs text-slate-605 font-medium">Checked</span>
            </label>
          </div>
        )}

        {/* Signature drawing pad */}
        {selectedOverlay.type === 'SIGNATURE' && (
          <div className="space-y-2">
            <label className="text-[9px] uppercase font-bold text-slate-400 block">Draw Signature</label>
            
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden relative">
              <canvas
                ref={canvasRef}
                width={250}
                height={100}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="w-full h-24 bg-white cursor-crosshair"
                style={{ filter: selectedOverlay.fontColor === '#FFFFFF' ? 'invert(1)' : 'none' }}
              />
              <button
                onClick={clearSignature}
                className="absolute right-2 bottom-2 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-600 rounded border border-slate-200"
              >
                Clear
              </button>
            </div>
            
            <div className="text-[10px] text-slate-450 leading-relaxed">
              Draw directly in the canvas above. The vector path will be preserved for the exported PDF.
            </div>
          </div>
        )}

        {/* Typography */}
        {selectedOverlay.type !== 'CHECKBOX' && selectedOverlay.type !== 'SIGNATURE' && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Font Family</label>
                <select
                  value={selectedOverlay.fontFamily}
                  onChange={(e) => updateOverlay(selectedOverlay.id, { fontFamily: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-lg p-2 text-xs focus:outline-none"
                  disabled={selectedOverlay.locked}
                >
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times">Times Roman</option>
                  <option value="Courier">Courier</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Font Size (pt)</label>
                <input
                  type="number"
                  value={selectedOverlay.fontSize}
                  onChange={(e) => updateOverlay(selectedOverlay.id, { fontSize: parseInt(e.target.value) || 12 })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-lg p-2 text-xs focus:outline-none"
                  min={6}
                  max={72}
                  disabled={selectedOverlay.locked}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Text Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={selectedOverlay.fontColor}
                    onChange={(e) => updateOverlay(selectedOverlay.id, { fontColor: e.target.value })}
                    className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                    disabled={selectedOverlay.locked}
                  />
                  <span className="text-xs font-mono text-slate-500">{selectedOverlay.fontColor}</span>
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Alignment</label>
                <div className="flex items-center space-x-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                  <button
                    onClick={() => updateOverlay(selectedOverlay.id, { alignment: 'left' })}
                    className={`p-1.5 rounded flex-1 flex justify-center ${
                      selectedOverlay.alignment === 'left' ? 'bg-white text-brand-700 border border-slate-200/50 shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateOverlay(selectedOverlay.id, { alignment: 'center' })}
                    className={`p-1.5 rounded flex-1 flex justify-center ${
                      selectedOverlay.alignment === 'center' ? 'bg-white text-brand-700 border border-slate-200/50 shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateOverlay(selectedOverlay.id, { alignment: 'right' })}
                    className={`p-1.5 rounded flex-1 flex justify-center ${
                      selectedOverlay.alignment === 'right' ? 'bg-white text-brand-700 border border-slate-200/50 shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1.5">Style</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => updateOverlay(selectedOverlay.id, { bold: !selectedOverlay.bold })}
                  className={`p-2 rounded border flex-1 text-xs font-semibold flex justify-center items-center ${
                    selectedOverlay.bold ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={() => updateOverlay(selectedOverlay.id, { italic: !selectedOverlay.italic })}
                  className={`p-2 rounded border flex-1 text-xs font-semibold flex justify-center items-center ${
                    selectedOverlay.italic ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  onClick={() => updateOverlay(selectedOverlay.id, { underline: !selectedOverlay.underline })}
                  className={`p-2 rounded border flex-1 text-xs font-semibold flex justify-center items-center ${
                    selectedOverlay.underline ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <Underline className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Geometry details */}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <label className="text-[9px] uppercase font-bold text-slate-400 block">Position & Size (%)</label>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[9px] text-slate-450 block mb-0.5">Left (X)</span>
              <input
                type="number"
                value={Math.round(selectedOverlay.x)}
                onChange={(e) => updateOverlay(selectedOverlay.id, { x: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-lg p-2 text-xs focus:outline-none"
                disabled={selectedOverlay.locked}
              />
            </div>
            <div>
              <span className="text-[9px] text-slate-450 block mb-0.5">Top (Y)</span>
              <input
                type="number"
                value={Math.round(selectedOverlay.y)}
                onChange={(e) => updateOverlay(selectedOverlay.id, { y: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-lg p-2 text-xs focus:outline-none"
                disabled={selectedOverlay.locked}
              />
            </div>
            <div>
              <span className="text-[9px] text-slate-450 block mb-0.5">Width</span>
              <input
                type="number"
                value={Math.round(selectedOverlay.width)}
                onChange={(e) => updateOverlay(selectedOverlay.id, { width: Math.max(1, Math.min(100, parseFloat(e.target.value) || 0)) })}
                className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-lg p-2 text-xs focus:outline-none"
                disabled={selectedOverlay.locked}
              />
            </div>
            <div>
              <span className="text-[9px] text-slate-450 block mb-0.5">Height</span>
              <input
                type="number"
                value={Math.round(selectedOverlay.height)}
                onChange={(e) => updateOverlay(selectedOverlay.id, { height: Math.max(1, Math.min(100, parseFloat(e.target.value) || 0)) })}
                className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-lg p-2 text-xs focus:outline-none"
                disabled={selectedOverlay.locked}
              />
            </div>
          </div>
        </div>

        {/* Lock State */}
        <div className="border-t border-slate-100 pt-4 pb-2">
          <button
            onClick={() => updateOverlay(selectedOverlay.id, { locked: !selectedOverlay.locked })}
            className={`w-full py-2.5 rounded-lg border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
              selectedOverlay.locked
                ? 'border-yellow-300 bg-yellow-50 text-yellow-800'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            {selectedOverlay.locked ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Locked (Read Only)</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Unlocked (Editable)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
