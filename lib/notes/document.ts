import type { JSONContent } from "@tiptap/react";
import { NOTE_PREFIX, parseBlockDocument, normalizeDocument, hasBlocks } from './blocks';
import { parseNoteImage, isNoteImageUrl } from "./images";

function inlineMarkdownSegmentToContent(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  const inlineRe =
    /(\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|_[^_\n]+?_|`[^`\n]+?`)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > last)
      nodes.push({ type: "text", text: text.slice(last, match.index) });
    const value = match[0];
    if (match[2] && match[3]) {
      nodes.push({
        type: "text",
        text: match[2],
        marks: [{ type: "link", attrs: { href: match[3] } }],
      });
    } else if (value.startsWith("**")) {
      nodes.push({
        type: "text",
        text: value.slice(2, -2),
        marks: [{ type: "bold" }],
      });
    } else if (value.startsWith("*") || value.startsWith("_")) {
      nodes.push({
        type: "text",
        text: value.slice(1, -1),
        marks: [{ type: "italic" }],
      });
    } else {
      nodes.push({
        type: "text",
        text: value.slice(1, -1),
        marks: [{ type: "code" }],
      });
    }
    last = match.index + value.length;
  }

  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes.length > 0 ? nodes : text ? [{ type: "text", text }] : [];
}

function inlineMarkdownToContent(text: string): JSONContent[] {
  return inlineMarkdownSegmentToContent(text);
}

export function markdownToTiptapContent(markdown: string): JSONContent {
  const structured = parseBlockDocument(markdown);
  if (structured) return structured;
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const content: JSONContent[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      content.push({ type: "paragraph" });
      i += 1;
      continue;
    }

    const image = parseNoteImage(line);
    if (image) {
      content.push({ type: "image", attrs: image });
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,2})\s+(.+)$/);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: inlineMarkdownToContent(heading[2]),
      });
      i += 1;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      const quoteContent: JSONContent[] = [];
      let j = i;
      while (j < lines.length) {
        const next = lines[j].match(/^>\s?(.*)$/);
        if (!next) break;
        quoteContent.push({
          type: "paragraph",
          content: inlineMarkdownToContent(next[1]),
        });
        j += 1;
      }
      content.push({ type: "blockquote", content: quoteContent });
      i = j;
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items: JSONContent[] = [];
      let j = i;
      while (j < lines.length) {
        const item = orderedList
          ? lines[j].match(/^\s*\d+\.\s+(.+)$/)
          : lines[j].match(/^\s*[-*]\s+(.+)$/);
        if (!item) break;
        items.push({
          type: "listItem",
          content: [
            { type: "paragraph", content: inlineMarkdownToContent(item[1]) },
          ],
        });
        j += 1;
      }
      content.push({
        type: orderedList ? "orderedList" : "bulletList",
        content: items,
      });
      i = j;
      continue;
    }

    const paragraphLines = [line.trim()];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (!next.trim() || parseNoteImage(next)) break;
      if (
        next.match(/^(#{1,2})\s+(.+)$/) ||
        next.match(/^>\s?(.*)$/) ||
        next.match(/^\s*[-*]\s+(.+)$/) ||
        next.match(/^\s*\d+\.\s+(.+)$/)
      ) {
        break;
      }
      paragraphLines.push(next.trim());
      j += 1;
    }
    content.push({
      type: "paragraph",
      content: inlineMarkdownToContent(paragraphLines.join(" ")),
    });
    i = j;
  }

  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

const MARKDOWN_BLOCK_LINE = /^(#{1,2}\s+\S|>\s?\S|\s*[-*]\s+\S|\s*\d+\.\s+\S)/;
/** Clipboard HTML from a web page or document has structure tags; a code editor's copy is only styled `div`/`span` lines. */
export function isRichClipboardHtml(html: string): boolean {
  return /<(h[1-6]|ul|ol|li|blockquote|table|p|a|strong|em|b|i)[\s>]/i.test(html);
}
/**
 * Pasted plain text that has markdown block markers (a heading, quote or list line) as note blocks; null for prose, so a
 * normal paste stays as it is. A copied note document (`!limbus-note:v1`) is left to the plain paste too.
 */
export function pastedMarkdownContent(text: string): JSONContent[] | null {
  const markdown = text.replace(/\r\n/g, "\n").trim();
  if (markdown.startsWith(NOTE_PREFIX) || !markdown.split("\n").some((line) => MARKDOWN_BLOCK_LINE.test(line))) return null;
  return markdownToTiptapContent(markdown).content ?? null;
}

function markText(text: string, marks?: JSONContent["marks"]): string {
  if (!marks?.length) return text;
  return marks.reduce((value, mark) => {
    if (mark.type === "bold") return `**${value}**`;
    if (mark.type === "italic") return `*${value}*`;
    if (mark.type === "code") return `\`${value}\``;
    if (mark.type === "link") {
      const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
      return href ? `[${value}](${href})` : value;
    }
    return value;
  }, text);
}

function inlineContentToMarkdown(node?: JSONContent): string {
  return (node?.content ?? [])
    .map((child) => {
      if (child.type === "text") return markText(child.text ?? "", child.marks);
      if (child.content) return inlineContentToMarkdown(child);
      return "";
    })
    .join("");
}

export function tiptapContentToMarkdown(doc: JSONContent): string {
  if (hasBlocks(doc)) return NOTE_PREFIX + JSON.stringify(normalizeDocument(doc));
  return (doc.content ?? [])
    .map((node) => {
      if (node.type === "image")
        return isNoteImageUrl(node.attrs?.src)
          ? `![${String(node.attrs?.alt ?? "").replace(/[\[\]\n]/g, "")}](${node.attrs!.src})`
          : "";
      if (node.type === "heading") {
        const level = node.attrs?.level === 1 ? "#" : "##";
        return `${level} ${inlineContentToMarkdown(node)}`;
      }
      if (node.type === "paragraph") return inlineContentToMarkdown(node);
      if (node.type === "blockquote") {
        return (node.content ?? [])
          .map((child) => `> ${inlineContentToMarkdown(child)}`)
          .join("\n");
      }
      if (node.type === "bulletList" || node.type === "orderedList") {
        return (node.content ?? [])
          .map((item, index) => {
            const body = (item.content ?? [])
              .map((child) => inlineContentToMarkdown(child))
              .join(" ");
            return node.type === "orderedList"
              ? `${index + 1}. ${body}`
              : `- ${body}`;
          })
          .join("\n");
      }
      if (node.type === "codeBlock")
        return `\`\`\`\n${inlineContentToMarkdown(node)}\n\`\`\``;
      return inlineContentToMarkdown(node);
    })
    .join("\n");
}
