import type { LibraryEntry } from "@/types";

export const demoEntries: LibraryEntry[] = [
  {
    id: "prompt-product-brief",
    type: "prompt",
    title: "Produkt-Briefing schärfen",
    description: "Strukturiert lose Produktideen in Zielgruppe, Nutzen und Umfang.",
    content: "Analysiere die folgende Produktidee und verdichte sie in Zielgruppe, Kernnutzen, Risiken und nächste Schritte.",
    tags: ["Product", "Research"],
    isFavorite: true,
  },
  {
    id: "code-copy-helper",
    type: "code",
    title: "Clipboard Helper",
    description: "Kleine TypeScript-Hilfe zum Kopieren von Text in die Zwischenablage.",
    content: "export async function copyText(value: string) {\n  await navigator.clipboard.writeText(value);\n}",
    language: "typescript",
    tags: ["TypeScript", "Utility"],
    isFavorite: false,
    previewKind: "javascript",
  },
  {
    id: "workflow-review",
    type: "workflow",
    title: "Snippet Review Workflow",
    description: "Kurzer Ablauf zum Prüfen, Kürzen und Wiederverwenden eines Snippets.",
    content: "1. Kontext prüfen\n2. Duplikate entfernen\n3. Tags ergänzen\n4. Nutzbarkeit testen",
    tags: ["Workflow"],
    isFavorite: false,
    previewKind: "markdown",
  },
];
