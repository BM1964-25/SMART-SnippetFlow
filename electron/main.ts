import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from "electron";
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
import type { AiConnectionTestResult, AiPromptAnalysisRequest, AiPromptAnalysisResult, EntryType, FieldOptionKey, LibraryEntryInput, LicenseState } from "../src/types/index.js";

const isDev = !app.isPackaged;
const currentDir = path.dirname(fileURLToPath(import.meta.url));

app.setName("SMART SnippetFlow");

function getRuntimeIconPath(extension: "png" | "ico" | "icns") {
  if (isDev) {
    return path.join(currentDir, `../../build/icon.${extension}`);
  }

  return path.join(process.resourcesPath, `assets/icon.${extension}`);
}

function getWindowIconPath() {
  return process.platform === "win32" ? getRuntimeIconPath("ico") : getRuntimeIconPath("png");
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "SMART SnippetFlow",
    backgroundColor: "#f8fafc",
    titleBarStyle: "hiddenInset",
    icon: getWindowIconPath(),
    webPreferences: {
      preload: path.join(currentDir, "preload.js"),
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
    void mainWindow.loadFile(path.join(currentDir, "../../dist/index.html"));
  }
}

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    const dockIcon = nativeImage.createFromPath(getRuntimeIconPath("png"));
    if (!dockIcon.isEmpty()) {
      app.dock?.setIcon(dockIcon);
    }
  }

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

ipcMain.handle("ai:analyze-prompt", async (_event, request: AiPromptAnalysisRequest) => analyzePromptWithAnthropic(request));
ipcMain.handle("ai:test-connection", async () => testAnthropicConnection());

async function testAnthropicConnection(): Promise<AiConnectionTestResult> {
  const apiKey = sanitizeApiKey(getSetting("anthropic_api_key") ?? "");
  const model = getSetting("anthropic_model")?.trim() || "claude-sonnet-4-5-20250929";

  if (!apiKey) {
    return { ok: false, message: "Kein Anthropic API-Key gespeichert.", model };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 12,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: "Antworte nur mit OK.",
          },
        ],
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      return { ok: false, message: `Verbindung fehlgeschlagen: ${response.status} ${message}`, model };
    }

    return { ok: true, message: "Verbindung aktiv", model };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `Verbindung fehlgeschlagen: ${error.message}` : "Verbindung fehlgeschlagen.",
      model,
    };
  }
}

async function analyzePromptWithAnthropic(request: AiPromptAnalysisRequest): Promise<AiPromptAnalysisResult> {
  const apiKey = sanitizeApiKey(getSetting("anthropic_api_key") ?? "");
  const model = getSetting("anthropic_model")?.trim() || "claude-sonnet-4-5-20250929";

  if (!apiKey) {
    throw new Error("Kein Anthropic API-Key gespeichert.");
  }

  const entryType = request.entryType ?? "prompt";
  const variantCount = entryType === "prompt" ? Math.max(0, Math.min(request.variantCount ?? 1, 3)) : 0;
  const entryTypeLabel: Record<EntryType, string> = {
    prompt: "Prompt",
    code: "Code",
    workflow: "Workflow",
    note: "Notiz",
  };
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        temperature: 0.4,
        system:
        "Du bist ein präziser deutschsprachiger Assistent für Metadaten, Struktur und Varianten. Antworte ausschließlich als valides JSON ohne Markdown-Codeblock.",
        messages: [
          {
            role: "user",
            content: [
            `Analysiere diesen ${entryTypeLabel[entryType]} für eine lokale Bibliothek.`,
            "Erstelle kurze, professionelle Metadaten.",
            entryType === "prompt"
              ? "Zusätzlich sollst du exakt die gewünschte Anzahl verbesserter Varianten erzeugen."
              : "Es werden keine Varianten benötigt, nur Metadaten und eine saubere Struktur.",
            `Gewünschte Varianten: ${variantCount}`,
            `Bestehende Tags: ${request.existingTags.join(", ") || "keine"}`,
            `Bestehende Kategorien: ${request.existingCategories.join(", ") || "keine"}`,
            "JSON-Schema:",
            '{"title":"...","description":"...","tags":["..."],"categoryName":"...","variants":[{"label":"Variante 1","content":"...","note":"..."}]}',
            `${entryTypeLabel[entryType]}:`,
            request.prompt,
          ].join("\n\n"),
          },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Anthropic API-Fehler: ${response.status} ${message}`);
  }

  const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.find((block) => block.type === "text")?.text ?? "";
  const parsed = parseJsonObject(text) as Partial<AiPromptAnalysisResult>;

  return {
    title: String(parsed.title ?? "").trim(),
    description: String(parsed.description ?? "").trim(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 6) : [],
    categoryName: parsed.categoryName ? String(parsed.categoryName).trim() : undefined,
    variants: entryType === "prompt" && Array.isArray(parsed.variants)
      ? parsed.variants
          .map((variant, index) => ({
            label: String(variant?.label ?? `Variante ${index + 1}`).trim(),
            content: String(variant?.content ?? "").trim(),
            note: variant?.note ? String(variant.note).trim() : undefined,
          }))
          .filter((variant) => variant.content)
          .slice(0, variantCount)
      : [],
  };
}

function parseJsonObject(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("KI-Antwort enthielt kein gültiges JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function sanitizeApiKey(value: string) {
  return value.trim().replace(/\s/g, "").replace(/[^\x21-\x7E]/g, "");
}
