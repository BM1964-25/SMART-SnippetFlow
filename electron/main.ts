import path from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import {
  createExportPayload,
  duplicateEntry,
  getLicenseState,
  getSetting,
  initializeDatabase,
  deleteEntry,
  listCategories,
  listEntries,
  saveCategory,
  saveEntry,
  saveLicenseState,
  saveSetting,
  toggleFavorite,
} from "./storage.js";
import type { ExportFormat, LibraryEntryInput, LicenseState } from "../src/types/index.js";

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
ipcMain.handle("settings:get", (_event, key: string) => getSetting(key));
ipcMain.handle("settings:save", (_event, key: string, value: string) => saveSetting(key, value));
ipcMain.handle("license:get", () => getLicenseState());
ipcMain.handle("license:save", (_event, license: LicenseState) => saveLicenseState(license));
ipcMain.handle("export:create", (_event, format: ExportFormat) => createExportPayload(format));
