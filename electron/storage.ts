import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";
import type { LibraryCategory, LibraryEntry, LibraryEntryInput, LicenseState } from "../src/types/index.js";

let db: Database.Database | null = null;

type EntryRow = Omit<LibraryEntry, "isFavorite" | "tags"> & {
  language: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isFavorite: 0 | 1;
  previewKind: LibraryEntry["previewKind"] | null;
};

type TagRow = {
  entryId: string;
  name: string;
};

const starterEntries: LibraryEntry[] = [
  {
    id: "prompt-product-brief",
    type: "prompt",
    title: "Produkt-Briefing schaerfen",
    description: "Strukturiert lose Produktideen in Zielgruppe, Nutzen und Umfang.",
    content:
      "Analysiere die folgende Produktidee und verdichte sie in Zielgruppe, Kernnutzen, Risiken und naechste Schritte.",
    tags: ["Product", "Research"],
    categoryId: "strategy",
    categoryName: "Strategie",
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
    categoryId: "development",
    categoryName: "Entwicklung",
    isFavorite: false,
    previewKind: "javascript",
  },
  {
    id: "workflow-review",
    type: "workflow",
    title: "Snippet Review Workflow",
    description: "Kurzer Ablauf zum Pruefen, Kuerzen und Wiederverwenden eines Snippets.",
    content: "1. Kontext pruefen\n2. Duplikate entfernen\n3. Tags ergaenzen\n4. Nutzbarkeit testen",
    tags: ["Workflow"],
    categoryId: "operations",
    categoryName: "Operations",
    isFavorite: false,
    previewKind: "markdown",
  },
];

const starterCategories: LibraryCategory[] = [
  { id: "strategy", name: "Strategie", color: "#2563eb" },
  { id: "development", name: "Entwicklung", color: "#059669" },
  { id: "operations", name: "Operations", color: "#7c3aed" },
];

function getDb() {
  if (!db) {
    const dbPath = path.join(app.getPath("userData"), "smart-snippetflow.sqlite");
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
      type TEXT NOT NULL CHECK (type IN ('prompt', 'code', 'workflow')),
      title TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      language TEXT,
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
  `);

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

  return rows.map((row) => ({
    ...row,
    language: row.language ?? undefined,
    categoryId: row.categoryId ?? undefined,
    categoryName: row.categoryName ?? undefined,
    previewKind: row.previewKind ?? undefined,
    isFavorite: Boolean(row.isFavorite),
    tags: tagsByEntry[row.id] ?? [],
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
    language: entry.language?.trim() || undefined,
    categoryId: entry.categoryId || undefined,
    categoryName: entry.categoryName,
    tags: normalizeTags(entry.tags),
    isFavorite: entry.isFavorite,
    previewKind: entry.previewKind,
  };

  const database = getDb();
  const write = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO entries (id, type, title, description, content, language, category_id, is_favorite, preview_kind, updated_at)
         VALUES (@id, @type, @title, @description, @content, @language, @categoryId, @isFavorite, @previewKind, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           title = excluded.title,
           description = excluded.description,
           content = excluded.content,
           language = excluded.language,
           category_id = excluded.category_id,
           is_favorite = excluded.is_favorite,
           preview_kind = excluded.preview_kind,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .run({
        ...normalized,
        isFavorite: normalized.isFavorite ? 1 : 0,
        language: normalized.language ?? null,
        categoryId: normalized.categoryId ?? null,
        previewKind: normalized.previewKind ?? null,
      });

    database.prepare("DELETE FROM entry_tags WHERE entry_id = ?").run(id);

    for (const tag of normalized.tags) {
      const tagId = slugify(tag);
      database.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)").run(tagId, tag);
      database.prepare("INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)").run(id, tagId);
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

function seedStarterEntries() {
  const count = getDb().prepare("SELECT COUNT(*) as count FROM entries").get() as { count: number };

  if (count.count === 0) {
    for (const entry of starterEntries) {
      saveEntry(entry);
    }
  }
}

function seedStarterCategories() {
  const count = getDb().prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };

  if (count.count === 0) {
    for (const category of starterCategories) {
      getDb().prepare("INSERT INTO categories (id, name, color) VALUES (@id, @name, @color)").run(category);
    }
  }
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
