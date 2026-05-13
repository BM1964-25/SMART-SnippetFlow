export type EntryType = "prompt" | "code" | "workflow" | "note";
export type PreviewKind = "html" | "css" | "javascript" | "markdown";
export type LicenseStatus = "active" | "expired" | "invalid";
export type AppView = "all" | "prompts" | "code" | "workflows" | "notes" | "favorites" | "settings";
export type ExportFormat = "json" | "markdown" | "txt";
export type FieldOptionKey = "prompt" | "code" | "text" | "analysis";

export interface LibraryEntry {
  id: string;
  type: EntryType;
  title: string;
  description: string;
  content: string;
  language?: string;
  fieldValue?: string;
  categoryId?: string;
  categoryName?: string;
  tags: string[];
  isFavorite: boolean;
  previewKind?: PreviewKind;
}

export type LibraryEntryInput = Omit<LibraryEntry, "id"> & {
  id?: string;
};

export interface LicenseState {
  key: string;
  status: LicenseStatus;
  expiresAt: string | null;
}

export interface LibraryCategory {
  id: string;
  name: string;
  color?: string;
}

export interface FieldOption {
  id: string;
  fieldKey: FieldOptionKey;
  value: string;
  label: string;
  isSystem: boolean;
  sortOrder: number;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface ExportPayload {
  format: ExportFormat;
  fileName: string;
  content: string;
  createdAt: string;
}

export type JsonExportResult =
  | { canceled: true }
  | {
      canceled: false;
      filePath: string;
    };

export type JsonImportResult =
  | { canceled: true }
  | {
      canceled: false;
      filePath: string;
      importedEntries: number;
      importedCategories: number;
    };

export interface DeleteCategoryResult {
  id: string;
  deleted: boolean;
}

export interface PreviewDescriptor {
  kind: PreviewKind;
  source: string;
  sandboxed: true;
}
