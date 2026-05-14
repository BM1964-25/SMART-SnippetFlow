import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";
import type {
  AppSetting,
  ExportFormat,
  ExportPayload,
  FieldOption,
  FieldOptionKey,
  LibraryCategory,
  LibraryEntry,
  LibraryEntryInput,
  LicenseState,
  PromptVariant,
} from "../src/types/index.js";

let db: Database.Database | null = null;

const DATABASE_FILE_NAME = "snippetflow.db";
const LEGACY_DATABASE_FILE_NAME = "smart-snippetflow.sqlite";

type EntryRow = Omit<LibraryEntry, "isFavorite" | "tags"> & {
  language: string | null;
  fieldValue: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isFavorite: 0 | 1;
  previewKind: LibraryEntry["previewKind"] | null;
};

type TagRow = {
  entryId: string;
  name: string;
};

type PromptVariantRow = Omit<PromptVariant, "createdAt"> & {
  entryId: string;
  createdAt: string;
  sortOrder: number;
};

const starterEntries: LibraryEntry[] = [
  {
    id: "prompt-product-brief",
    type: "prompt",
    title: "Produkt-Briefing schärfen",
    description: "Strukturiert lose Produktideen in Zielgruppe, Nutzen und Umfang.",
    content:
      "Analysiere die folgende Produktidee und verdichte sie in Zielgruppe, Kernnutzen, Risiken und nächste Schritte.",
    tags: ["Product", "Research"],
    fieldValue: "Allgemein",
    categoryId: "ideen",
    categoryName: "Ideen",
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
    categoryId: "technik",
    categoryName: "Technik",
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
    categoryId: "dokumentation",
    categoryName: "Dokumentation",
    isFavorite: false,
    previewKind: "markdown",
  },
  {
    id: "note-architecture",
    type: "note",
    title: "Architektur-Notiz",
    description: "Kurze Markdown-Notiz für technische Entscheidungen.",
    content:
      "## Entscheidung\n\nSQLite bleibt lokal im Electron userData-Pfad.\n\n## Begründung\n\nUpdates sollen Nutzerdaten nicht überschreiben.",
    tags: ["Dokumentation", "Lokal"],
    fieldValue: "Dokumentation",
    categoryId: "dokumentation",
    categoryName: "Dokumentation",
    isFavorite: false,
    previewKind: "markdown",
  },
];

const systemFieldOptions: Array<Omit<FieldOption, "id">> = [
  ...["Allgemein", "OpenAI", "ChatGPT", "Codex", "Claude", "Gemini", "Perplexity", "Mistral", "Llama", "Lokales Modell"].map((label, index) => ({
    fieldKey: "prompt" as const,
    value: label,
    label,
    isSystem: true,
    sortOrder: index,
  })),
  ...["TypeScript", "JavaScript", "HTML", "CSS", "Python", "SQL", "JSON", "Bash", "Markdown"].map((label, index) => ({
    fieldKey: "code" as const,
    value: label,
    label,
    isSystem: true,
    sortOrder: index,
  })),
  ...["Ideen", "Technik", "API", "Architektur", "Fehler", "Meetings", "Dokumentation", "Allgemein"].map((label, index) => ({
    fieldKey: "text" as const,
    value: label,
    label,
    isSystem: true,
    sortOrder: index,
  })),
  ...["Content", "Software", "Marketing", "Analyse", "Meeting", "Vertrieb", "Projekt"].map((label, index) => ({
    fieldKey: "analysis" as const,
    value: label,
    label,
    isSystem: true,
    sortOrder: index,
  })),
];

const starterCategories: LibraryCategory[] = [
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

function getDb() {
  if (!db) {
    const dbPath = getDatabasePath();
    migrateLegacyDatabase(dbPath);
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
  }

  return db;
}

export function initializeDatabase() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('prompt', 'code', 'workflow', 'note')),
      title TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      language TEXT,
      field_value TEXT,
      category_id TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      preview_kind TEXT CHECK (preview_kind IN ('html', 'css', 'javascript', 'markdown')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (entry_id, tag_id),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS license_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      key TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'invalid')),
      expires_at TEXT,
      checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS field_options (
      id TEXT PRIMARY KEY,
      field_key TEXT NOT NULL,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(field_key, value)
    );

    CREATE TABLE IF NOT EXISTS prompt_variants (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      note TEXT,
      rating TEXT CHECK (rating IN ('good', 'medium', 'weak')),
      source TEXT NOT NULL CHECK (source IN ('manual', 'ai')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );
  `);

  migrateEntryTypeConstraint();
  migrateEntryFieldValue();
  migrateFieldOptionKeys();
  seedSystemFieldOptions();
  seedStarterCategories();
  seedStarterEntries();
}

export function listEntries(): LibraryEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT
         entries.id,
         entries.type,
         entries.title,
         entries.description,
         entries.content,
         entries.language,
         entries.field_value as fieldValue,
         entries.category_id as categoryId,
         categories.name as categoryName,
         entries.is_favorite as isFavorite,
         entries.preview_kind as previewKind
       FROM entries
       LEFT JOIN categories ON categories.id = entries.category_id
       ORDER BY updated_at DESC
       LIMIT 200`,
    )
    .all() as EntryRow[];

  const tagRows = getDb()
    .prepare(
      `SELECT entry_tags.entry_id as entryId, tags.name
       FROM entry_tags
       JOIN tags ON tags.id = entry_tags.tag_id`,
    )
    .all() as TagRow[];

  const tagsByEntry = tagRows.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.entryId] = [...(acc[row.entryId] ?? []), row.name];
    return acc;
  }, {});

  const variantRows = getDb()
    .prepare(
      `SELECT
         id,
         entry_id as entryId,
         label,
         content,
         note,
         rating,
         source,
         sort_order as sortOrder,
         created_at as createdAt
       FROM prompt_variants
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all() as Array<PromptVariantRow & { note: string | null; rating: PromptVariant["rating"] | null }>;

  const variantsByEntry = variantRows.reduce<Record<string, PromptVariant[]>>((acc, row) => {
    const variant: PromptVariant = {
      id: row.id,
      label: row.label,
      content: row.content,
      note: row.note ?? undefined,
      rating: row.rating ?? undefined,
      source: row.source,
      createdAt: row.createdAt,
    };
    acc[row.entryId] = [...(acc[row.entryId] ?? []), variant];
    return acc;
  }, {});

  return rows.map((row) => ({
    ...row,
    language: row.language ?? undefined,
    fieldValue: row.fieldValue ?? undefined,
    categoryId: row.categoryId ?? undefined,
    categoryName: row.categoryName ?? undefined,
    previewKind: row.previewKind ?? undefined,
    isFavorite: Boolean(row.isFavorite),
    tags: tagsByEntry[row.id] ?? [],
    promptVariants: row.type === "prompt" ? variantsByEntry[row.id] ?? [] : undefined,
  }));
}

export function saveEntry(entry: LibraryEntryInput): LibraryEntry {
  const id = entry.id ?? crypto.randomUUID();
  const normalized: LibraryEntry = {
    id,
    type: entry.type,
    title: entry.title.trim() || "Unbenannter Eintrag",
    description: entry.description.trim(),
    content: entry.content,
    fieldValue: entry.fieldValue?.trim() || undefined,
    language: entry.type === "code" ? normalizeCodeLanguage(entry.fieldValue ?? entry.language) : entry.language?.trim() || undefined,
    categoryId: entry.categoryId || undefined,
    categoryName: entry.categoryName,
    tags: normalizeTags(entry.tags),
    isFavorite: entry.isFavorite,
    previewKind: entry.previewKind,
    promptVariants: entry.type === "prompt" ? normalizePromptVariants(entry.promptVariants) : undefined,
  };

  const database = getDb();
  const write = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO entries (id, type, title, description, content, language, field_value, category_id, is_favorite, preview_kind, updated_at)
         VALUES (@id, @type, @title, @description, @content, @language, @fieldValue, @categoryId, @isFavorite, @previewKind, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           title = excluded.title,
           description = excluded.description,
           content = excluded.content,
           language = excluded.language,
           field_value = excluded.field_value,
           category_id = excluded.category_id,
           is_favorite = excluded.is_favorite,
           preview_kind = excluded.preview_kind,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .run({
        ...normalized,
        isFavorite: normalized.isFavorite ? 1 : 0,
        language: normalized.language ?? null,
        fieldValue: normalized.fieldValue ?? null,
        categoryId: normalized.categoryId ?? null,
        previewKind: normalized.previewKind ?? null,
      });

    database.prepare("DELETE FROM entry_tags WHERE entry_id = ?").run(id);

    for (const tag of normalized.tags) {
      const tagId = slugify(tag);
      database.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)").run(tagId, tag);
      database.prepare("INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)").run(id, tagId);
    }

    database.prepare("DELETE FROM prompt_variants WHERE entry_id = ?").run(id);

    for (const [index, variant] of (normalized.promptVariants ?? []).slice(0, 3).entries()) {
      database
        .prepare(
          `INSERT INTO prompt_variants (id, entry_id, label, content, note, rating, source, sort_order, created_at, updated_at)
           VALUES (@id, @entryId, @label, @content, @note, @rating, @source, @sortOrder, @createdAt, CURRENT_TIMESTAMP)`,
        )
        .run({
          id: variant.id,
          entryId: id,
          label: variant.label,
          content: variant.content,
          note: variant.note ?? null,
          rating: variant.rating ?? null,
          source: variant.source,
          sortOrder: index,
          createdAt: variant.createdAt,
        });
    }
  });

  write();
  return normalized;
}

export function deleteEntry(id: string) {
  getDb().prepare("DELETE FROM entries WHERE id = ?").run(id);
  return { id };
}

export function listCategories(): LibraryCategory[] {
  return getDb().prepare("SELECT id, name, color FROM categories ORDER BY name ASC").all() as LibraryCategory[];
}

export function saveCategory(name: string): LibraryCategory {
  const normalizedName = name.trim();
  const category: LibraryCategory = {
    id: slugify(normalizedName || "Kategorie"),
    name: normalizedName || "Kategorie",
    color: "#64748b",
  };

  getDb()
    .prepare(
      `INSERT INTO categories (id, name, color)
       VALUES (@id, @name, @color)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
    )
    .run(category);

  return category;
}

export function deleteCategory(id: string) {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM categories WHERE id = ?").get(id) as Pick<LibraryCategory, "id"> | undefined;

  if (!existing) {
    return { id, deleted: false };
  }

  const write = database.transaction(() => {
    database.prepare("UPDATE entries SET category_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE category_id = ?").run(id);
    database.prepare("DELETE FROM categories WHERE id = ?").run(id);
  });

  write();
  return { id, deleted: true };
}

export function listFieldOptions(): FieldOption[] {
  const rows = getDb()
    .prepare(
      `SELECT
         id,
         field_key as fieldKey,
         value,
         label,
         is_system as isSystem,
         sort_order as sortOrder
       FROM field_options
       ORDER BY field_key ASC, sort_order ASC, label ASC`,
    )
    .all() as Array<Omit<FieldOption, "isSystem"> & { isSystem: 0 | 1 }>;

  return rows.map((row) => ({ ...row, isSystem: Boolean(row.isSystem) }));
}

export function createFieldOption(fieldKey: FieldOptionKey, label: string): FieldOption {
  const normalizedLabel = label.trim();
  if (!normalizedLabel) {
    throw new Error("Der Wert darf nicht leer sein.");
  }

  const option: FieldOption = {
    id: crypto.randomUUID(),
    fieldKey,
    value: normalizedLabel,
    label: normalizedLabel,
    isSystem: false,
    sortOrder: nextFieldOptionSortOrder(fieldKey),
  };

  getDb()
    .prepare(
      `INSERT INTO field_options (id, field_key, value, label, is_system, sort_order)
       VALUES (@id, @fieldKey, @value, @label, @isSystem, @sortOrder)
       ON CONFLICT(field_key, value) DO UPDATE SET
         label = excluded.label,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run({ ...option, isSystem: option.isSystem ? 1 : 0 });

  return option;
}

export function renameFieldOption(id: string, label: string): FieldOption | null {
  const existing = getFieldOption(id);
  const normalizedLabel = label.trim();

  if (!existing || existing.isSystem || !normalizedLabel) {
    return null;
  }

  getDb()
    .prepare(
      `UPDATE field_options
       SET value = ?, label = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND is_system = 0`,
    )
    .run(normalizedLabel, normalizedLabel, id);

  return { ...existing, value: normalizedLabel, label: normalizedLabel };
}

export function deleteFieldOption(id: string) {
  const existing = getFieldOption(id);

  if (!existing || existing.isSystem) {
    return { id, deleted: false };
  }

  getDb().prepare("DELETE FROM field_options WHERE id = ? AND is_system = 0").run(id);
  return { id, deleted: true };
}

export function duplicateEntry(id: string): LibraryEntry | null {
  const source = listEntries().find((entry) => entry.id === id);

  if (!source) {
    return null;
  }

  return saveEntry({
    ...source,
    id: crypto.randomUUID(),
    title: `${source.title} Kopie`,
    isFavorite: false,
  });
}

export function toggleFavorite(id: string): LibraryEntry | null {
  const entry = listEntries().find((item) => item.id === id);

  if (!entry) {
    return null;
  }

  return saveEntry({ ...entry, isFavorite: !entry.isFavorite });
}

export function getLicenseState(): LicenseState {
  const row = getDb()
    .prepare("SELECT key, status, expires_at as expiresAt FROM license_state WHERE id = 1")
    .get() as LicenseState | undefined;

  return row ?? { key: "", status: "invalid", expiresAt: null };
}

export function saveLicenseState(license: LicenseState) {
  getDb()
    .prepare(
      `INSERT INTO license_state (id, key, status, expires_at, checked_at)
       VALUES (1, @key, @status, @expiresAt, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         key = excluded.key,
         status = excluded.status,
         expires_at = excluded.expires_at,
         checked_at = CURRENT_TIMESTAMP`,
    )
    .run(license);

  return license;
}

export function getSetting(key: string) {
  const row = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as Pick<AppSetting, "value"> | undefined;
  return row?.value ?? null;
}

export function saveSetting(key: string, value: string) {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(key, value);

  return { key, value };
}

export function createExportPayload(format: ExportFormat): ExportPayload {
  const createdAt = new Date().toISOString();
  const snapshot = createExportSnapshot(createdAt);
  const fileBaseName = `smart-snippetflow-export-${createdAt.slice(0, 10)}`;

  if (format === "markdown") {
    return {
      format,
      fileName: `${fileBaseName}.md`,
      content: createMarkdownExport(snapshot),
      createdAt,
    };
  }

  if (format === "txt") {
    return {
      format,
      fileName: `${fileBaseName}.txt`,
      content: createTextExport(snapshot),
      createdAt,
    };
  }

  return {
    format,
    fileName: `${fileBaseName}.json`,
    content: JSON.stringify(snapshot, null, 2),
    createdAt,
  };
}

export function importJsonPayload(content: string) {
  const parsed = JSON.parse(content) as Partial<{
    entries: LibraryEntryInput[];
    categories: LibraryCategory[];
    fieldOptions: FieldOption[];
    settings: AppSetting[];
    license: LicenseState;
  }>;

  if (!Array.isArray(parsed.entries)) {
    throw new Error("Die JSON-Datei enthält keine gültigen Einträge.");
  }

  const entries = parsed.entries;
  const database = getDb();
  if (Array.isArray(parsed.categories)) {
    for (const category of parsed.categories) {
      if (category?.id && category.name) {
        database
          .prepare(
            `INSERT INTO categories (id, name, color)
             VALUES (@id, @name, @color)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               color = excluded.color`,
          )
          .run({ ...category, color: category.color ?? null });
      }
    }
  }

  if (Array.isArray(parsed.fieldOptions)) {
    for (const option of parsed.fieldOptions) {
      const fieldKey = normalizeFieldOptionKey(option?.fieldKey);
      if (fieldKey && option.label && !option.isSystem) {
        createFieldOption(fieldKey, option.label);
      }
    }
  }

  for (const entry of entries) {
    if (isImportableEntry(entry)) {
      saveEntry({
        ...entry,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        isFavorite: Boolean(entry.isFavorite),
      });
    }
  }

  if (Array.isArray(parsed.settings)) {
    for (const setting of parsed.settings) {
      if (setting?.key && typeof setting.value === "string") {
        saveSetting(setting.key, setting.value);
      }
    }
  }

  if (parsed.license && ["active", "expired", "invalid"].includes(parsed.license.status)) {
    saveLicenseState({
      key: parsed.license.key ?? "",
      status: parsed.license.status,
      expiresAt: parsed.license.expiresAt ?? null,
    });
  }

  return {
    importedEntries: entries.filter(isImportableEntry).length,
    importedCategories: Array.isArray(parsed.categories) ? parsed.categories.length : 0,
  };
}

function seedStarterEntries() {
  const count = getDb().prepare("SELECT COUNT(*) as count FROM entries").get() as { count: number };

  if (count.count === 0) {
    for (const entry of starterEntries) {
      saveEntry(entry);
    }
  }
}

function getDatabasePath() {
  return path.join(app.getPath("userData"), DATABASE_FILE_NAME);
}

function migrateLegacyDatabase(targetPath: string) {
  const legacyPath = path.join(app.getPath("userData"), LEGACY_DATABASE_FILE_NAME);

  if (!fs.existsSync(targetPath) && fs.existsSync(legacyPath)) {
    fs.copyFileSync(legacyPath, targetPath);
  }
}

function seedStarterCategories() {
  for (const category of starterCategories) {
    getDb()
      .prepare(
        `INSERT INTO categories (id, name, color)
         VALUES (@id, @name, @color)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run(category);
  }
}

function seedSystemFieldOptions() {
  for (const option of systemFieldOptions) {
    const id = `${option.fieldKey}:${slugify(option.value)}`;
    getDb()
      .prepare(
        `INSERT INTO field_options (id, field_key, value, label, is_system, sort_order)
         VALUES (@id, @fieldKey, @value, @label, 1, @sortOrder)
         ON CONFLICT(field_key, value) DO UPDATE SET
           label = excluded.label,
           is_system = 1,
           sort_order = excluded.sort_order,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .run({ id, ...option });
  }
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

function normalizePromptVariants(variants: PromptVariant[] | undefined): PromptVariant[] {
  if (!Array.isArray(variants)) {
    return [];
  }

  return variants
    .filter((variant) => variant?.content?.trim())
    .slice(0, 3)
    .map((variant, index) => ({
      id: variant.id || crypto.randomUUID(),
      label: variant.label?.trim() || `Variante ${index + 1}`,
      content: variant.content,
      note: variant.note?.trim() || undefined,
      rating: variant.rating,
      source: variant.source === "manual" ? "manual" : "ai",
      createdAt: variant.createdAt || new Date().toISOString(),
    }));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getFieldOption(id: string): FieldOption | null {
  const row = getDb()
    .prepare(
      `SELECT
         id,
         field_key as fieldKey,
         value,
         label,
         is_system as isSystem,
         sort_order as sortOrder
       FROM field_options
       WHERE id = ?`,
    )
    .get(id) as (Omit<FieldOption, "isSystem"> & { isSystem: 0 | 1 }) | undefined;

  return row ? { ...row, isSystem: Boolean(row.isSystem) } : null;
}

function nextFieldOptionSortOrder(fieldKey: FieldOptionKey) {
  const row = getDb()
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 as nextSortOrder FROM field_options WHERE field_key = ?")
    .get(fieldKey) as { nextSortOrder: number };

  return row.nextSortOrder;
}

function normalizeCodeLanguage(value?: string) {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  const map: Record<string, string> = {
    typescript: "typescript",
    javascript: "javascript",
    html: "html",
    css: "css",
    python: "python",
    sql: "sql",
    json: "json",
    bash: "shell",
    markdown: "markdown",
  };

  return map[normalized.toLowerCase()] ?? normalized.toLowerCase();
}

function createExportSnapshot(createdAt: string) {
  const settings = getDb()
    .prepare("SELECT key, value FROM app_settings ORDER BY key ASC")
    .all() as AppSetting[];

  return {
    app: "SMART SnippetFlow",
    createdAt,
    database: {
      storage: "electron-userData",
      fileName: DATABASE_FILE_NAME,
    },
    entries: listEntries(),
    categories: listCategories(),
    fieldOptions: listFieldOptions(),
    settings,
    license: getLicenseState(),
  };
}

function createMarkdownExport(snapshot: ReturnType<typeof createExportSnapshot>) {
  const sections = snapshot.entries.map((entry) => {
    const tags = entry.tags.length > 0 ? entry.tags.join(", ") : "Keine Tags";
    return [
      `## ${entry.title}`,
      "",
      `Typ: ${entry.type}`,
      `Kategorie: ${entry.categoryName ?? "Ohne Kategorie"}`,
      `Tags: ${tags}`,
      "",
      entry.description,
      "",
      "```",
      entry.content,
      "```",
    ].join("\n");
  });

  return [`# SMART SnippetFlow Export`, "", `Erstellt: ${snapshot.createdAt}`, "", ...sections].join("\n");
}

function createTextExport(snapshot: ReturnType<typeof createExportSnapshot>) {
  return snapshot.entries
    .map((entry) => `${entry.title}\n${entry.type}\n${entry.description}\n\n${entry.content}`)
    .join("\n\n---\n\n");
}

function isImportableEntry(entry: unknown): entry is LibraryEntryInput {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  const candidate = entry as LibraryEntryInput;
  return (
    ["prompt", "code", "workflow", "note"].includes(candidate.type) &&
    typeof candidate.title === "string" &&
    typeof candidate.content === "string"
  );
}

function migrateEntryTypeConstraint() {
  const table = getDb()
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'entries'")
    .get() as { sql: string } | undefined;

  if (!table || table.sql.includes("'note'")) {
    return;
  }

  const database = getDb();
  const migrate = database.transaction(() => {
    database.exec(`
      ALTER TABLE entry_tags RENAME TO entry_tags_legacy;
      ALTER TABLE entries RENAME TO entries_legacy;

      CREATE TABLE entries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('prompt', 'code', 'workflow', 'note')),
        title TEXT NOT NULL,
        description TEXT,
        content TEXT NOT NULL,
        language TEXT,
        field_value TEXT,
        category_id TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        preview_kind TEXT CHECK (preview_kind IN ('html', 'css', 'javascript', 'markdown')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      INSERT INTO entries (
        id, type, title, description, content, language, field_value, category_id, is_favorite, preview_kind, created_at, updated_at
      )
      SELECT
        id, type, title, description, content, language, NULL, category_id, is_favorite, preview_kind, created_at, updated_at
      FROM entries_legacy;

      CREATE TABLE entry_tags (
        entry_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (entry_id, tag_id),
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      INSERT INTO entry_tags (entry_id, tag_id)
      SELECT entry_id, tag_id
      FROM entry_tags_legacy;

      DROP TABLE entries_legacy;
      DROP TABLE entry_tags_legacy;
    `);
  });

  migrate();
}

function migrateEntryFieldValue() {
  const columns = getDb().prepare("PRAGMA table_info(entries)").all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === "field_value")) {
    getDb().prepare("ALTER TABLE entries ADD COLUMN field_value TEXT").run();
  }

  getDb()
    .prepare(
      `UPDATE entries
       SET field_value = CASE
         WHEN type = 'code' AND language IS NOT NULL THEN
           CASE lower(language)
             WHEN 'typescript' THEN 'TypeScript'
             WHEN 'javascript' THEN 'JavaScript'
             WHEN 'html' THEN 'HTML'
             WHEN 'css' THEN 'CSS'
             WHEN 'python' THEN 'Python'
             WHEN 'sql' THEN 'SQL'
             WHEN 'json' THEN 'JSON'
             WHEN 'shell' THEN 'Bash'
             WHEN 'bash' THEN 'Bash'
             WHEN 'markdown' THEN 'Markdown'
             ELSE language
           END
         WHEN type = 'prompt' THEN 'Allgemein'
         WHEN type = 'workflow' THEN 'Projekt'
         WHEN type = 'note' THEN COALESCE(
           (SELECT categories.name FROM categories WHERE categories.id = entries.category_id),
           'Allgemein'
         )
         ELSE field_value
       END
       WHERE field_value IS NULL`,
    )
    .run();
}

function migrateFieldOptionKeys() {
  const mappings: Array<[string, FieldOptionKey]> = [
    ["aiSystem", "prompt"],
    ["language", "code"],
    ["noteCategory", "text"],
    ["workflowArea", "analysis"],
  ];
  const database = getDb();
  const migrate = database.transaction(() => {
    for (const [legacyKey, fieldKey] of mappings) {
      database
        .prepare(
          `DELETE FROM field_options
           WHERE field_key = ?
             AND EXISTS (
               SELECT 1
               FROM field_options target
               WHERE target.field_key = ?
                 AND target.value = field_options.value
             )`,
        )
        .run(legacyKey, fieldKey);

      database.prepare("UPDATE field_options SET field_key = ?, updated_at = CURRENT_TIMESTAMP WHERE field_key = ?").run(fieldKey, legacyKey);
    }
  });

  migrate();
}

function normalizeFieldOptionKey(fieldKey: unknown): FieldOptionKey | null {
  const legacyMap: Record<string, FieldOptionKey> = {
    aiSystem: "prompt",
    language: "code",
    noteCategory: "text",
    workflowArea: "analysis",
  };

  if (typeof fieldKey !== "string") {
    return null;
  }

  if (["prompt", "code", "text", "analysis"].includes(fieldKey)) {
    return fieldKey as FieldOptionKey;
  }

  return legacyMap[fieldKey] ?? null;
}
