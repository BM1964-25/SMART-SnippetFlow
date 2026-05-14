import { demoCategories, demoEntries, demoFieldOptions } from "@/db/demoData";
import type { AppSetting, EntryType, FieldOption, LibraryCategory, LibraryEntry, LicenseState } from "@/types";

export const browserStorageKeys = {
  entries: "smart-snippetflow:entries",
  categories: "smart-snippetflow:categories",
  fieldOptions: "smart-snippetflow:field-options",
  license: "smart-snippetflow:license",
  backup: "smart-snippetflow:auto-backup",
  aiSettings: "smart-snippetflow:ai-settings",
};

const estimatedLocalStorageLimitBytes = 5 * 1024 * 1024;

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
    writeBrowserAutoBackup();
    return true;
  } catch {
    // Browser preview persistence is best-effort; Electron persists through SQLite.
    return false;
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
    writeBrowserAutoBackup();
    return true;
  } catch {
    // Browser preview persistence is best-effort; Electron persists through SQLite.
    return false;
  }
}

export function readBrowserSetting(key: string) {
  try {
    return window.localStorage.getItem(`smart-snippetflow:setting:${key}`);
  } catch {
    return null;
  }
}

export function writeBrowserSetting(key: string, value: string) {
  try {
    window.localStorage.setItem(`smart-snippetflow:setting:${key}`, value);
    writeBrowserAutoBackup();
    return true;
  } catch {
    return false;
  }
}

export function createBrowserExportPayload(license: LicenseState, entryType: EntryType | "all" = "all") {
  const createdAt = new Date().toISOString();
  const entries = readBrowserList<LibraryEntry>(browserStorageKeys.entries, demoEntries);

  return {
    app: "SMART SnippetFlow",
    createdAt,
    database: {
      storage: "browser-localStorage",
      fileName: null,
    },
    exportScope: entryType,
    entries: entryType === "all" ? entries : entries.filter((entry) => entry.type === entryType),
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

export function getBrowserStorageReport() {
  if (typeof window === "undefined") {
    return {
      usedBytes: 0,
      estimatedLimitBytes: estimatedLocalStorageLimitBytes,
      usageRatio: 0,
      isNearLimit: false,
      backupCreatedAt: null as string | null,
    };
  }

  let usedBytes = 0;
  Object.values(browserStorageKeys).forEach((key) => {
    const value = window.localStorage.getItem(key);
    if (value) {
      usedBytes += new Blob([key, value]).size;
    }
  });

  const backup = readBrowserAutoBackup();
  const usageRatio = usedBytes / estimatedLocalStorageLimitBytes;

  return {
    usedBytes,
    estimatedLimitBytes: estimatedLocalStorageLimitBytes,
    usageRatio,
    isNearLimit: usageRatio >= 0.8,
    backupCreatedAt: backup?.createdAt ?? null,
  };
}

function writeBrowserAutoBackup() {
  try {
    const backup = {
      createdAt: new Date().toISOString(),
      entries: readBrowserList<LibraryEntry>(browserStorageKeys.entries, demoEntries),
      categories: readBrowserList<LibraryCategory>(browserStorageKeys.categories, demoCategories),
      fieldOptions: readBrowserList<FieldOption>(browserStorageKeys.fieldOptions, demoFieldOptions),
      license: readBrowserLicense({ key: "", status: "invalid", expiresAt: null }),
    };
    window.localStorage.setItem(browserStorageKeys.backup, JSON.stringify(backup));
  } catch {
    // The explicit JSON export remains the reliable backup if browser storage is full.
  }
}

function readBrowserAutoBackup() {
  try {
    const stored = window.localStorage.getItem(browserStorageKeys.backup);
    return stored ? (JSON.parse(stored) as { createdAt?: string }) : null;
  } catch {
    return null;
  }
}
