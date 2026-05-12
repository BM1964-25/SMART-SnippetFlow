export type EntryType = "prompt" | "code" | "workflow" | "note";
export type PreviewKind = "html" | "css" | "javascript" | "markdown";
export type LicenseStatus = "active" | "expired" | "invalid";
export type AppView = "all" | "prompts" | "code" | "workflows" | "notes" | "favorites" | "settings";
export type ExportFormat = "json" | "markdown" | "txt";

export interface LibraryEntry {
  id: string;
  type: EntryType;
  title: string;
  description: string;
  content: string;
  language?: string;
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

export interface PreviewDescriptor {
  kind: PreviewKind;
  source: string;
  sandboxed: true;
}
