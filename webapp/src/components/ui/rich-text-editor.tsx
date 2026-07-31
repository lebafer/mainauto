import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Bold, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  rows = 4,
}: RichTextEditorProps) {
  const minHeight = rows * 24;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        hardBreak: {
          keepMarks: true,
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "outline-none",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const isBoldActive = editor?.isActive("bold") ?? false;
  const isBulletListActive = editor?.isActive("bulletList") ?? false;

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background text-sm shadow-sm",
        "focus-within:outline-none focus-within:ring-1 focus-within:ring-ring"
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-input px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onMouseDown={(e) => {
            e.preventDefault();
            editor?.chain().focus().toggleBold().run();
          }}
          className={cn(
            "h-9 w-9 transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            isBoldActive && "bg-accent text-accent-foreground"
          )}
          title="Fett"
          aria-label="Fettschrift umschalten"
          aria-pressed={isBoldActive}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onMouseDown={(e) => {
            e.preventDefault();
            editor?.chain().focus().toggleBulletList().run();
          }}
          className={cn(
            "h-9 w-9 transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            isBulletListActive && "bg-accent text-accent-foreground"
          )}
          title="Aufzählung"
          aria-label="Aufzählung umschalten"
          aria-pressed={isBulletListActive}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor area */}
      <div className="relative">
        {!editor?.getText() && placeholder ? (
          <span
            className="pointer-events-none absolute left-3 top-2 text-muted-foreground select-none"
            aria-hidden="true"
          >
            {placeholder}
          </span>
        ) : null}
        <EditorContent
          editor={editor}
          className={cn(
            "px-3 py-2",
            "[&_.tiptap]:outline-none",
            "[&_.tiptap_p]:my-0",
            "[&_.tiptap_ul]:my-1 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-4",
            "[&_.tiptap_li]:my-0"
          )}
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
