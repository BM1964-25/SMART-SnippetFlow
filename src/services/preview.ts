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
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("# ")) {
        return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      }

      if (/^\\d+\\.\\s/.test(line)) {
        return `<p>${escapeHtml(line)}</p>`;
      }

      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
