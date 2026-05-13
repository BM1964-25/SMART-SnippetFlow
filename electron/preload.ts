import { contextBridge, ipcRenderer } from "electron";
import type {
  JsonExportResult,
  JsonImportResult,
  FieldOption,
  FieldOptionKey,
  LibraryCategory,
  LibraryEntry,
  LibraryEntryInput,
  LicenseState,
} from "../src/types/index.js";

const api = {
  library: {
    list: (): Promise<LibraryEntry[]> => ipcRenderer.invoke("library:list"),
    save: (entry: LibraryEntryInput): Promise<LibraryEntry> => ipcRenderer.invoke("library:save", entry),
    duplicate: (id: string): Promise<LibraryEntry | null> => ipcRenderer.invoke("library:duplicate", id),
    toggleFavorite: (id: string): Promise<LibraryEntry | null> => ipcRenderer.invoke("library:favorite", id),
    delete: (id: string): Promise<{ id: string }> => ipcRenderer.invoke("library:delete", id),
  },
  categories: {
    list: (): Promise<LibraryCategory[]> => ipcRenderer.invoke("categories:list"),
    save: (name: string): Promise<LibraryCategory> => ipcRenderer.invoke("categories:save", name),
    delete: (id: string): Promise<{ id: string; deleted: boolean }> => ipcRenderer.invoke("categories:delete", id),
  },
  fieldOptions: {
    list: (): Promise<FieldOption[]> => ipcRenderer.invoke("field-options:list"),
    create: (fieldKey: FieldOptionKey, label: string): Promise<FieldOption> =>
      ipcRenderer.invoke("field-options:create", fieldKey, label),
    rename: (id: string, label: string): Promise<FieldOption | null> => ipcRenderer.invoke("field-options:rename", id, label),
    delete: (id: string): Promise<{ id: string; deleted: boolean }> => ipcRenderer.invoke("field-options:delete", id),
  },
  license: {
    get: (): Promise<LicenseState> => ipcRenderer.invoke("license:get"),
    save: (license: LicenseState): Promise<LicenseState> => ipcRenderer.invoke("license:save", license),
  },
  settings: {
    get: (key: string): Promise<string | null> => ipcRenderer.invoke("settings:get", key),
    save: (key: string, value: string): Promise<{ key: string; value: string }> => ipcRenderer.invoke("settings:save", key, value),
  },
  data: {
    exportJson: (): Promise<JsonExportResult> => ipcRenderer.invoke("export:json"),
    importJson: (): Promise<JsonImportResult> => ipcRenderer.invoke("import:json"),
  },
};

contextBridge.exposeInMainWorld("snippetFlow", api);

export type SnippetFlowApi = typeof api;
