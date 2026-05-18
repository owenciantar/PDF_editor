import { useRef, useState, DragEvent } from 'react';

interface Props {
  onFileSelect: (file: File) => void;
}

export function PDFUploader({ onFileSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const MAX_MB = 50;

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;

    // Size check — catches huge files before reading magic bytes
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`File is too large (max ${MAX_MB} MB).`);
      return;
    }

    // Magic byte check — MIME type is browser-reported and spoofable
    const header = await file.slice(0, 5).arrayBuffer();
    const magic = new Uint8Array(header);
    const isPDF = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 &&
                  magic[3] === 0x46 && magic[4] === 0x2D; // %PDF-
    if (!isPDF) {
      alert('This file does not appear to be a valid PDF.');
      return;
    }

    onFileSelect(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="flex flex-col items-center gap-8 p-8 w-full max-w-2xl">
      {/* Logo / Title */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#2563EB" />
            <path d="M12 8h12l8 8v16a2 2 0 01-2 2H12a2 2 0 01-2-2V10a2 2 0 012-2z" fill="white" fillOpacity="0.2" />
            <path d="M24 8l8 8h-6a2 2 0 01-2-2V8z" fill="white" fillOpacity="0.4" />
            <text x="14" y="28" fontSize="9" fontWeight="700" fill="white" fontFamily="system-ui">PDF</text>
          </svg>
          <h1 className="text-3xl font-bold text-gray-900">PDF Editor</h1>
        </div>
        <p className="text-gray-500 text-sm">Edit PDF files as easily as a Word document</p>
      </div>

      {/* Drop Zone */}
      <div
        className={`w-full border-2 border-dashed rounded-2xl p-16 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-gray-300">
          <rect width="56" height="56" rx="12" fill="#F3F4F6" />
          <path d="M16 12h16l12 12v20a2 2 0 01-2 2H16a2 2 0 01-2-2V14a2 2 0 012-2z" fill="#D1D5DB" />
          <path d="M32 12l12 12h-10a2 2 0 01-2-2V12z" fill="#9CA3AF" />
          <path d="M22 32h12M22 36h8" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <div className="text-center">
          <p className="text-gray-700 font-semibold text-lg">
            {dragging ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
          </p>
          <p className="text-gray-400 text-sm mt-1">or click to browse files</p>
        </div>

        <span className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Choose File
        </span>

        <p className="text-gray-400 text-xs">PDF files only</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />

      {/* Features */}
      <div className="grid grid-cols-3 gap-4 w-full">
        {[
          { icon: '✏️', label: 'Rich Text Editing', desc: 'Bold, italic, headings & more' },
          { icon: '📐', label: 'Layout Preserved', desc: 'Structure from your PDF' },
          { icon: '💾', label: 'Export to PDF', desc: 'Save your edited document' },
        ].map(f => (
          <div key={f.label} className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <div className="text-2xl mb-2">{f.icon}</div>
            <p className="font-medium text-gray-800 text-sm">{f.label}</p>
            <p className="text-gray-400 text-xs mt-1">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
