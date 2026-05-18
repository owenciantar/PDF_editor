import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import type { Editor as TipTapEditor } from '@tiptap/react';

interface Props {
  content: string;
  onEditorReady: (editor: TipTapEditor) => void;
}

export function Editor({ content, onEditorReady }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
    ],
    content,
    editorProps: {
      attributes: { class: 'focus:outline-none' },
    },
  });

  useEffect(() => {
    if (editor) onEditorReady(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return <EditorContent editor={editor} className="h-full" />;
}
