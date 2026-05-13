import type { FieldOption, LibraryCategory, LibraryEntry } from "@/types";

export const demoEntries: LibraryEntry[] = [
  {
    id: "prompt-product-brief",
    type: "prompt",
    title: "Produkt-Briefing schärfen",
    description: "Strukturiert lose Produktideen in Zielgruppe, Nutzen und Umfang.",
    content: "Analysiere die folgende Produktidee und verdichte sie in Zielgruppe, Kernnutzen, Risiken und nächste Schritte.",
    tags: ["Product", "Research"],
    fieldValue: "Allgemein",
    isFavorite: true,
  },
  {
    id: "code-copy-helper",
    type: "code",
    title: "Clipboard Helper",
    description: "Kleine TypeScript-Hilfe zum Kopieren von Text in die Zwischenablage.",
    content: "export async function copyText(value: string) {\n  await navigator.clipboard.writeText(value);\n}",
    language: "typescript",
    fieldValue: "TypeScript",
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
    fieldValue: "Projekt",
    isFavorite: false,
    previewKind: "markdown",
  },
  {
    id: "note-architecture",
    type: "note",
    title: "Architektur-Notiz",
    description: "Kurze Markdown-Notiz für technische Entscheidungen.",
    content: "## Entscheidung\n\nSQLite bleibt lokal im Electron userData-Pfad.\n\n## Begründung\n\nUpdates sollen Nutzerdaten nicht überschreiben.",
    tags: ["Dokumentation", "Lokal"],
    categoryId: "dokumentation",
    categoryName: "Dokumentation",
    fieldValue: "Dokumentation",
    isFavorite: false,
    previewKind: "markdown",
  },
];

export const demoCategories: LibraryCategory[] = [
  { id: "marketing", name: "Marketing", color: "#2563eb" },
  { id: "vertrieb", name: "Vertrieb", color: "#059669" },
  { id: "kundenservice", name: "Kundenservice", color: "#0891b2" },
  { id: "produkt", name: "Produkt", color: "#7c3aed" },
  { id: "entwicklung", name: "Entwicklung", color: "#0f766e" },
  { id: "recherche", name: "Recherche", color: "#ca8a04" },
  { id: "strategie", name: "Strategie", color: "#9333ea" },
  { id: "dokumentation", name: "Dokumentation", color: "#475569" },
  { id: "meeting", name: "Meeting", color: "#dc2626" },
  { id: "privat", name: "Privat", color: "#db2777" },
  { id: "allgemein", name: "Allgemein", color: "#64748b" },
];

export const demoFieldOptions: FieldOption[] = [
  ..."Allgemein,OpenAI,ChatGPT,Codex,Claude,Gemini,Perplexity,Mistral,Llama,Lokales Modell"
    .split(",")
    .map((label, index) => ({
      id: `prompt:${label.toLowerCase().replace(/\s+/g, "-")}`,
      fieldKey: "prompt" as const,
      value: label,
      label,
      isSystem: true,
      sortOrder: index,
    })),
];
