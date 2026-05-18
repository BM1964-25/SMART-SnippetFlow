import type { LibraryEntry, PreviewDescriptor } from "@/types";

export function createPreviewDescriptor(entry: LibraryEntry): PreviewDescriptor | null {
  if (!entry.previewKind) {
    return null;
  }

  return {
    kind: entry.previewKind,
    source: entry.content,
    sandboxed: true,
  };
}

export function createSandboxPreviewHtml(preview: PreviewDescriptor | null) {
  if (!preview) {
    return createPreviewDocument("");
  }

  if (preview.kind === "html") {
    return createScrollableHtmlPreview(preview.source);
  }

  if (preview.kind === "css") {
    return createPreviewDocument('<main class="preview-target">Preview</main>', `<style>${preview.source}</style>`);
  }

  if (preview.kind === "javascript") {
    const escaped = escapeHtml(preview.source);
    return createPreviewDocument(`<pre>${escaped}</pre>`);
  }

  return createPreviewDocument(markdownToHtml(preview.source));
}

const basePreviewStyle = `
  <style>
    :root { color-scheme: light; }
    html,
    body {
      min-height: 100%;
      margin: 0;
      overflow: auto;
      background: #ffffff;
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.65;
    }
    body { box-sizing: border-box; padding: 20px 22px 28px; }
    *,
    *::before,
    *::after { box-sizing: border-box; }
    h1,
    h2 {
      margin: 0 0 12px;
      line-height: 1.25;
    }
    h1 { font-size: 22px; }
    h2 { font-size: 18px; }
    p { margin: 0 0 12px; }
    ul,
    ol { margin: 0 0 12px 20px; padding: 0; }
    li { margin: 4px 0; }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.6;
    }
    .preview-target {
      min-height: 180px;
      border: 1px dashed #d1d5db;
      border-radius: 10px;
      padding: 20px;
      color: #4b5563;
    }
  </style>
`;

function createPreviewDocument(body: string, extraHead = "") {
  return `<!doctype html><html><head><meta charset="utf-8">${basePreviewStyle}${extraHead}</head><body>${body}</body></html>`;
}

function createScrollableHtmlPreview(source: string) {
  if (!/<html[\s>]/i.test(source)) {
    return createPreviewDocument(source);
  }

  if (/<head[\s>]/i.test(source)) {
    return source.replace(/<head([^>]*)>/i, `<head$1><meta charset="utf-8">${basePreviewStyle}`);
  }

  return source.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="utf-8">${basePreviewStyle}</head>`);
}

function markdownToHtml(source: string) {
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  source.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      return;
    }

    const bulletMatch = /^[-*]\s+(.+)$/.exec(line);
    const numberedMatch = /^\d+\.\s+(.+)$/.exec(line);

    if (bulletMatch || numberedMatch) {
      const nextListType = bulletMatch ? "ul" : "ol";
      if (listType !== nextListType) {
        closeList();
        html.push(`<${nextListType}>`);
        listType = nextListType;
      }
      html.push(`<li>${formatInlineMarkdown((bulletMatch ?? numberedMatch)?.[1] ?? "")}</li>`);
      return;
    }

    closeList();

    if (line.startsWith("## ")) {
      html.push(`<h2>${formatInlineMarkdown(line.slice(3))}</h2>`);
      return;
    }

    if (line.startsWith("# ")) {
      html.push(`<h1>${formatInlineMarkdown(line.slice(2))}</h1>`);
      return;
    }

    html.push(`<p>${formatInlineMarkdown(line)}</p>`);
  });

  closeList();
  return html.join("");
}

function formatInlineMarkdown(value: string) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
