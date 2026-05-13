import path from "node:path";
import fs from "node:fs/promises";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import {
  createExportPayload,
  createFieldOption,
  deleteCategory,
  deleteFieldOption,
  duplicateEntry,
  getLicenseState,
  getSetting,
  importJsonPayload,
  initializeDatabase,
  deleteEntry,
  listCategories,
  listEntries,
  listFieldOptions,
  renameFieldOption,
  saveCategory,
  saveEntry,
  saveLicenseState,
  saveSetting,
  toggleFavorite,
} from "./storage.js";
import type { FieldOptionKey, LibraryEntryInput, LicenseState } from "../src/types/index.js";

const isDev = !app.isPackaged;

app.setName("SMART SnippetFlow");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "SMART SnippetFlow",
    backgroundColor: "#f8fafc",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("library:list", () => listEntries());
ipcMain.handle("library:save", (_event, entry: LibraryEntryInput) => saveEntry(entry));
ipcMain.handle("library:duplicate", (_event, id: string) => duplicateEntry(id));
ipcMain.handle("library:favorite", (_event, id: string) => toggleFavorite(id));
ipcMain.handle("library:delete", (_event, id: string) => deleteEntry(id));
ipcMain.handle("categories:list", () => listCategories());
ipcMain.handle("categories:save", (_event, name: string) => saveCategory(name));
ipcMain.handle("categories:delete", (_event, id: string) => deleteCategory(id));
ipcMain.handle("field-options:list", () => listFieldOptions());
ipcMain.handle("field-options:create", (_event, fieldKey: FieldOptionKey, label: string) => createFieldOption(fieldKey, label));
ipcMain.handle("field-options:rename", (_event, id: string, label: string) => renameFieldOption(id, label));
ipcMain.handle("field-options:delete", (_event, id: string) => deleteFieldOption(id));
ipcMain.handle("settings:get", (_event, key: string) => getSetting(key));
ipcMain.handle("settings:save", (_event, key: string, value: string) => saveSetting(key, value));
ipcMain.handle("license:get", () => getLicenseState());
ipcMain.handle("license:save", (_event, license: LicenseState) => saveLicenseState(license));
ipcMain.handle("export:json", async () => {
  const payload = createExportPayload("json");
  const result = await dialog.showSaveDialog({
    title: "SMART SnippetFlow JSON exportieren",
    defaultPath: path.join(app.getPath("downloads"), payload.fileName),
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true as const };
  }

  await fs.writeFile(result.filePath, payload.content, "utf-8");
  return { canceled: false as const, filePath: result.filePath };
});
ipcMain.handle("import:json", async () => {
  const result = await dialog.showOpenDialog({
    title: "SMART SnippetFlow JSON importieren",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true as const };
  }

  const content = await fs.readFile(result.filePaths[0], "utf-8");
  const summary = importJsonPayload(content);
  return { canceled: false as const, filePath: result.filePaths[0], ...summary };
});
