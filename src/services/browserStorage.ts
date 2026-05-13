import { demoCategories, demoEntries, demoFieldOptions } from "@/db/demoData";
import type { AppSetting, FieldOption, LibraryCategory, LibraryEntry, LicenseState } from "@/types";

export const browserStorageKeys = {
  entries: "smart-snippetflow:entries",
  categories: "smart-snippetflow:categories",
  fieldOptions: "smart-snippetflow:field-options",
  license: "smart-snippetflow:license",
};

export function readBrowserList<T>(key: string, fallback: T[]) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function writeBrowserList<T>(key: string, value: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browser preview persistence is best-effort; Electron persists through SQLite.
  }
}

export function readBrowserLicense(fallback: LicenseState): LicenseState {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(browserStorageKeys.license);
    return stored ? (JSON.parse(stored) as LicenseState) : fallback;
  } catch {
    return fallback;
  }
}

export function writeBrowserLicense(value: LicenseState) {
  try {
    window.localStorage.setItem(browserStorageKeys.license, JSON.stringify(value));
  } catch {
    // Browser preview persistence is best-effort; Electron persists through SQLite.
  }
}

export function createBrowserExportPayload(license: LicenseState) {
  const createdAt = new Date().toISOString();

  return {
    app: "SMART SnippetFlow",
    createdAt,
    database: {
      storage: "browser-localStorage",
      fileName: null,
    },
    entries: readBrowserList<LibraryEntry>(browserStorageKeys.entries, demoEntries),
    categories: readBrowserList<LibraryCategory>(browserStorageKeys.categories, demoCategories),
    fieldOptions: readBrowserList<FieldOption>(browserStorageKeys.fieldOptions, demoFieldOptions),
    settings: [] as AppSetting[],
    license,
  };
}

export function importBrowserPayload(content: string) {
  const parsed = JSON.parse(content) as Partial<{
    entries: LibraryEntry[];
    categories: LibraryCategory[];
    fieldOptions: FieldOption[];
    license: LicenseState;
  }>;

  if (!Array.isArray(parsed.entries)) {
    throw new Error("Die JSON-Datei enthält keine gültigen Einträge.");
  }

  const entries = parsed.entries.filter((entry) => entry?.id && entry.title && entry.content);
  const categories = Array.isArray(parsed.categories) ? parsed.categories.filter((category) => category?.id && category.name) : demoCategories;
  const fieldOptions = Array.isArray(parsed.fieldOptions)
    ? parsed.fieldOptions.filter((option) => option?.id && option.fieldKey && option.label)
    : demoFieldOptions;

  writeBrowserList(browserStorageKeys.entries, entries);
  writeBrowserList(browserStorageKeys.categories, categories);
  writeBrowserList(browserStorageKeys.fieldOptions, fieldOptions);

  if (parsed.license && ["active", "expired", "invalid"].includes(parsed.license.status)) {
    writeBrowserLicense({
      key: parsed.license.key ?? "",
      status: parsed.license.status,
      expiresAt: parsed.license.expiresAt ?? null,
    });
  }

  return {
    importedEntries: entries.length,
    importedCategories: categories.length,
  };
}
