import { Download } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ProjectService } from '../services/api';

export default function ExportPreview() {
  const { exportId } = useParams<{ exportId: string }>();
  const [searchParams] = useSearchParams();
  const filename = searchParams.get('filename') || 'annotated-document.pdf';

  if (!exportId) {
    return <div className="p-6 text-sm text-red-600">Export preview is unavailable.</div>;
  }

  return (
    <div className="h-screen bg-slate-100 flex flex-col">
      <div className="h-16 px-5 bg-white border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-800">Export Preview</h1>
          <p className="text-xs text-slate-400">{filename}</p>
        </div>
        <a
          href={ProjectService.getDownloadUrl(exportId)}
          download={filename}
          className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </a>
      </div>
      <iframe
        src={ProjectService.getPreviewUrl(exportId)}
        title="Exported PDF preview"
        className="flex-1 w-full border-0"
      />
    </div>
  );
}
