export type EntryType = "prompt" | "code" | "workflow" | "note";
export type PreviewKind = "html" | "css" | "javascript" | "markdown";
export type LicenseStatus = "active" | "expired" | "invalid";
export type ApiStatus = "active" | "missing";
export type AppView = "all" | "prompts" | "code" | "workflows" | "notes" | "favorites" | "settings" | "help";
export type ExportFormat = "json" | "markdown" | "txt";
export type FieldOptionKey = "prompt" | "code" | "text" | "analysis";

export interface PromptVariant {
  id: string;
  label: string;
  content: string;
  note?: string;
  rating?: "good" | "medium" | "weak";
  createdAt: string;
  source: "manual" | "ai";
}

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
  promptVariants?: PromptVariant[];
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

export interface AiPromptAnalysisRequest {
  prompt: string;
  existingTags: string[];
  existingCategories: string[];
  variantCount?: number;
  entryType?: EntryType;
}

export interface AiPromptAnalysisResult {
  title: string;
  description: string;
  tags: string[];
  categoryName?: string;
  variants: Array<{
    label: string;
    content: string;
    note?: string;
  }>;
}

export interface AiConnectionTestResult {
  ok: boolean;
  message: string;
  model?: string;
}

export interface AiSettings {
  anthropicApiKey: string;
  anthropicModel: string;
}
