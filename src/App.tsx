import { useState, useRef, useCallback } from 'react';
import { PDFUploader } from './components/PDFUploader';
import { Toolbar } from './components/Toolbar';
import { Editor } from './components/Editor';
import { parsePDF } from './lib/pdfParser';
import { exportToPDF } from './lib/pdfExporter';
import type { Editor as TipTapEditor } from '@tiptap/react';

type AppState = 'idle' | 'loading' | 'editing';

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('document');
  const [editor, setEditor] = useState<TipTapEditor | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setFileName(file.name.replace(/\.pdf$/i, ''));
    setError(null);
    setAppState('loading');
    try {
      const html = await parsePDF(file);
      setContent(html);
      setAppState('editing');
    } catch (err) {
      console.error(err);
      setError('Failed to parse the PDF. Please try another file.');
      setAppState('idle');
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!docRef.current) return;
    setExporting(true);
    try {
      await exportToPDF(docRef.current, fileName);
    } finally {
      setExporting(false);
    }
  }, [fileName]);

  if (appState === 'idle') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <PDFUploader onFileSelect={handleFileSelect} />
        {error && (
          <p className="mt-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (appState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-600 font-medium">Parsing PDF…</p>
        <p className="text-gray-400 text-sm">Extracting text and structure</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
        <button
          onClick={() => { setAppState('idle'); setEditor(null); }}
          className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
          title="Back to upload"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#2563EB" />
            <path d="M12 8h12l8 8v16a2 2 0 01-2 2H12a2 2 0 01-2-2V10a2 2 0 012-2z" fill="white" fillOpacity="0.25" />
            <text x="14" y="28" fontSize="9" fontWeight="700" fill="white" fontFamily="system-ui">PDF</text>
          </svg>
          <span className="font-semibold text-gray-800 text-sm">{fileName}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Editing</span>
        </div>
      </div>

      {/* Toolbar */}
      {editor && <Toolbar editor={editor} onExport={handleExport} exporting={exporting} />}

      {/* Document */}
      <div className="flex-1 overflow-auto py-10 px-4">
        <div
          ref={docRef}
          className="max-w-4xl mx-auto bg-white shadow-xl rounded-sm"
          style={{ minHeight: '1056px', padding: '72px 80px' }}
        >
          <Editor content={content} onEditorReady={setEditor} />
        </div>
      </div>
    </div>
  );
}
