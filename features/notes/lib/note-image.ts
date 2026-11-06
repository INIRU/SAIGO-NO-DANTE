import Image from "@tiptap/extension-image";
import { isNoteImageUrl } from "@/lib/notes/images";
export default Image.extend({
  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (node) =>
          isNoteImageUrl((node as HTMLElement).getAttribute("src"))
            ? null
            : false,
      },
    ];
  },
}).configure({
  allowBase64: false,
  HTMLAttributes: { class: "note-document-image", loading: "lazy" },
});
