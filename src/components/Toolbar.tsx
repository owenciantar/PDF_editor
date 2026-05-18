import type { Editor } from '@tiptap/react';

interface Props {
  editor: Editor;
  onExport: () => void;
  exporting: boolean;
}

const FONT_SIZES = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];
const FONTS = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
];

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`toolbar-btn ${active ? 'active' : ''}`}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="toolbar-separator" />;
}

export function Toolbar({ editor, onExport, exporting }: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center gap-0.5 flex-wrap sticky top-0 z-10 shadow-sm">
      {/* Undo / Redo */}
      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
        </svg>
      </Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/>
        </svg>
      </Btn>

      <Sep />

      {/* Heading level */}
      <select
        className="toolbar-btn text-xs pr-5 cursor-pointer"
        style={{ appearance: 'auto', paddingRight: '20px', width: 'auto' }}
        value={
          editor.isActive('heading', { level: 1 }) ? 'h1' :
          editor.isActive('heading', { level: 2 }) ? 'h2' :
          editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'
        }
        onChange={e => {
          const v = e.target.value;
          if (v === 'p') editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1|2|3 }).run();
        }}
      >
        <option value="p">Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>

      <Sep />

      {/* Font family */}
      <select
        className="toolbar-btn text-xs cursor-pointer"
        style={{ appearance: 'auto', width: 'auto' }}
        onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}
        defaultValue=""
      >
        <option value="" disabled>Font</option>
        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      {/* Font size */}
      <select
        className="toolbar-btn text-xs cursor-pointer"
        style={{ appearance: 'auto', width: 'auto' }}
        onChange={e => editor.chain().focus().setFontSize(e.target.value).run()}
        defaultValue=""
      >
        <option value="" disabled>Size</option>
        {FONT_SIZES.map(s => <option key={s} value={s}>{s.replace('px', '')}</option>)}
      </select>

      <Sep />

      {/* Bold / Italic / Underline / Strike */}
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
        <strong>B</strong>
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
        <em>I</em>
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
        <span style={{ textDecoration: 'underline' }}>U</span>
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <span style={{ textDecoration: 'line-through' }}>S</span>
      </Btn>

      <Sep />

      {/* Text color */}
      <label className="toolbar-btn cursor-pointer" title="Text Color">
        <span className="text-sm font-bold" style={{ color: editor.getAttributes('textStyle').color || '#000' }}>A</span>
        <input
          type="color"
          className="absolute opacity-0 w-0 h-0"
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>

      {/* Highlight */}
      <label className="toolbar-btn cursor-pointer" title="Highlight">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.7 4.3a1 1 0 00-1.4 0l-9 9a1 1 0 000 1.4l4 4a1 1 0 001.4 0l9-9a1 1 0 000-1.4l-4-4zM5 18l-2 2h3l1-1-2-1z" opacity=".3"/>
          <path d="M16.4 3.6a2 2 0 00-2.8 0l-9 9a2 2 0 000 2.8l4 4a2 2 0 002.8 0l9-9a2 2 0 000-2.8l-4-4zM4 20l-1 1h4l1-1-2-2-2 2z"/>
        </svg>
        <input
          type="color"
          className="absolute opacity-0 w-0 h-0"
          defaultValue="#fef08a"
          onChange={e => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
        />
      </label>

      <Sep />

      {/* Align */}
      <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 6h18v2H3zm0 4h12v2H3zm0 4h18v2H3zm0 4h12v2H3z"/>
        </svg>
      </Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 6h18v2H3zm3 4h12v2H6zm-3 4h18v2H3zm3 4h12v2H6z"/>
        </svg>
      </Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 6h18v2H3zm6 4h12v2H9zm-6 4h18v2H3zm6 4h12v2H9z"/>
        </svg>
      </Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 6h18v2H3zm0 4h18v2H3zm0 4h18v2H3zm0 4h12v2H3z"/>
        </svg>
      </Btn>

      <Sep />

      {/* Lists */}
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="4" cy="7" r="1.5"/><path d="M8 6h13v2H8zm-4 5h.01M8 11h13v2H8zm-4 5h.01M8 16h13v2H8z"/>
          <circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="17" r="1.5"/>
        </svg>
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 6h13v2H8zm0 5h13v2H8zm0 5h13v2H8zM4 5h1v4H4V6H3V5h1zm-1 9v-1h2v-.5H3v-1h3v2.5H4v.5h2v1H3v-1.5z"/>
        </svg>
      </Btn>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export */}
      <button
        onClick={onExport}
        disabled={exporting}
        className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {exporting ? (
          <>
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
            Exporting…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export PDF
          </>
        )}
      </button>
    </div>
  );
}
