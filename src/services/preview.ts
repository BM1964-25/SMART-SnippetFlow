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
    return "<!doctype html><html><body></body></html>";
  }

  if (preview.kind === "html") {
    return preview.source;
  }

  if (preview.kind === "css") {
    return `<!doctype html><html><head><style>${preview.source}</style></head><body><main class="preview-target">Preview</main></body></html>`;
  }

  if (preview.kind === "javascript") {
    const escaped = escapeHtml(preview.source);
    return `<!doctype html><html><body><pre>${escaped}</pre></body></html>`;
  }

  return `<!doctype html><html><body>${markdownToHtml(preview.source)}</body></html>`;
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
