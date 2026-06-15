import React from 'react';
import { useProjectStore } from '../../store/projectStore';
import { Sparkles, CheckSquare, FileSignature, Type, HelpCircle } from 'lucide-react';
import { OverlayType } from '../../types';

export default function LeftSidebar() {
  const {
    analysis,
    currentPage,
    setCurrentPage,
    addOverlay,
  } = useProjectStore();

  const handleApplySuggestion = (suggestion: any) => {
    let width = 20;
    let height = 5;
    let textContent = '';
    
    if (suggestion.type === 'SIGNATURE') {
      width = 25;
      height = 8;
      textContent = 'Authorized Signature';
    } else if (suggestion.type === 'NOTE') {
      width = 40;
      height = 12;
      textContent = 'Additional notes or remarks...';
    } else if (suggestion.type === 'DATE') {
      width = 15;
      height = 4;
      textContent = new Date().toLocaleDateString();
    } else {
      width = 20;
      height = 4;
      textContent = 'Extra text content...';
    }

    addOverlay({
      pageNumber: currentPage,
      type: suggestion.type as OverlayType,
      textContent,
      x: suggestion.x,
      y: suggestion.y,
      width,
      height,
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
      zIndex: 10,
    });
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'SIGNATURE': return <FileSignature className="w-4 h-4 text-purple-605" />;
      case 'NOTE': return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'CHECKBOX': return <CheckSquare className="w-4 h-4 text-blue-600" />;
      default: return <Type className="w-4 h-4 text-emerald-600" />;
    }
  };

  const pagesArray = analysis ? Array.from({ length: analysis.pages.length }, (_, i) => i + 1) : [1];
  const activePageAnalysis = analysis?.pages.find(p => p.pageNumber === currentPage);
  const suggestions = activePageAnalysis?.suggestedRegions || [];
  const emptyRegions = activePageAnalysis?.emptyRegions || [];

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col text-slate-705">
      {/* Thumbnails Section */}
      <div className="flex-1 overflow-y-auto p-4 border-b border-slate-200">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center space-x-1">
          <span>Pages Navigation</span>
        </h3>
        <div className="space-y-4">
          {pagesArray.map((pageNum) => (
            <div
              key={pageNum}
              onClick={() => setCurrentPage(pageNum)}
              className={`cursor-pointer rounded-xl border p-2 text-center transition-all ${
                currentPage === pageNum
                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="aspect-[3/4] rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 text-sm font-semibold">
                Page {pageNum}
              </div>
              <span className="text-xs block mt-1.5 font-medium text-slate-500">Page {pageNum}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Spaces Section */}
      <div className="h-[280px] p-4 flex flex-col border-t border-slate-100">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-500" />
          <span>Suggested Spaces</span>
        </h3>
        
        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
          Detected usable empty areas. Click one to add text:
        </p>

        {emptyRegions.length === 0 && suggestions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-2 rounded-xl bg-slate-50 border border-slate-150">
            <HelpCircle className="w-8 h-8 text-slate-350 mb-2" />
            <span className="text-xs text-slate-400">No usable empty areas detected.</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {emptyRegions.map((region, i) => (
              <button
                key={`empty-${i}`}
                onClick={() => window.dispatchEvent(new CustomEvent('edit-empty-region', {
                  detail: { pageNumber: currentPage, region },
                }))}
                className="w-full text-left p-2.5 rounded-lg bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200 flex items-center space-x-3 transition-all group shadow-sm"
              >
                <div className="p-1.5 bg-white rounded-md border border-emerald-150">
                  <Type className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">
                    Empty text space
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium">
                    About {region.maxCharacters} characters
                  </div>
                </div>
              </button>
            ))}
            {suggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleApplySuggestion(sug)}
                className="w-full text-left p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex items-center space-x-3 transition-all group shadow-sm"
              >
                <div className="p-1.5 bg-white rounded-md border border-slate-150">
                  {getSuggestionIcon(sug.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 truncate">
                    {sug.label}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    x: {Math.round(sug.x)}% y: {Math.round(sug.y)}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
