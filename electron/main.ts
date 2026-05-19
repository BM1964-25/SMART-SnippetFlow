import path from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
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
import type {
  AiConnectionTestResult,
  AiPromptAnalysisRequest,
  AiPromptAnalysisResult,
  EntryType,
  FieldOptionKey,
  LibraryEntryInput,
  LicenseState,
  LicenseStatus,
  RemoteLicenseStatus,
} from "../src/types/index.js";

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

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Renderer load failed:", errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details.reason, details.exitCode);
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log("Renderer console:", { level, message, line, sourceId });
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
ipcMain.handle("license:activate", (_event, key: string) => activateLicense(key));
ipcMain.handle("license:refresh", () => refreshLicense());
ipcMain.handle("license:deactivate", () => deactivateLicense());
ipcMain.handle("export:json", async () => {
  const payload = createExportPayload("json");
  const defaultPath = await getNextAvailableExportPath(app.getPath("downloads"), payload.fileName);
  const result = await dialog.showSaveDialog({
    title: "SMART SnippetFlow JSON exportieren",
    defaultPath,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true as const };
  }

  await fs.writeFile(result.filePath, payload.content, "utf-8");
  return { canceled: false as const, filePath: result.filePath };
});

async function getNextAvailableExportPath(directory: string, fileName: string) {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  let candidate = path.join(directory, fileName);
  let index = 2;

  while (await pathExists(candidate)) {
    candidate = path.join(directory, `${baseName}-${index}${extension}`);
    index += 1;
  }

  return candidate;
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

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

type LicenseRpcResponse = {
  ok: boolean;
  reason?: string;
  licenseId?: string;
  activationId?: string;
  status?: RemoteLicenseStatus;
  currentPeriodEnd?: string | null;
  deviceLimit?: number;
  activeDevices?: number;
};

async function activateLicense(key: string): Promise<LicenseState> {
  const normalizedKey = sanitizeLicenseKey(key);

  if (!normalizedKey) {
    return saveLicenseState({
      key: "",
      status: "invalid",
      expiresAt: null,
      activationId: null,
      remoteStatus: null,
      checkedAt: new Date().toISOString(),
      message: "Bitte einen Lizenzschlüssel eingeben.",
    });
  }

  const deviceFingerprintHash = getDeviceFingerprintHash();
  const result = await callLicenseRpc("activate_license", {
    p_license_key: normalizedKey,
    p_device_fingerprint_hash: deviceFingerprintHash,
    p_device_label: `${process.platform} desktop`,
    p_platform: process.platform,
    p_app_version: app.getVersion(),
    p_metadata: {
      app: "SMART SnippetFlow",
    },
  });

  const license = licenseStateFromRpc(normalizedKey, result, "Lizenz aktiviert.");
  return saveLicenseState(license);
}

async function refreshLicense(): Promise<LicenseState> {
  const current = getLicenseState();
  const normalizedKey = sanitizeLicenseKey(current.key);

  if (!normalizedKey || !current.activationId) {
    return saveLicenseState({
      ...current,
      key: normalizedKey,
      status: "invalid",
      checkedAt: new Date().toISOString(),
      message: "Keine aktivierte Lizenz vorhanden.",
    });
  }

  const result = await callLicenseRpc("refresh_license_activation", {
    p_license_key: normalizedKey,
    p_activation_id: current.activationId,
    p_device_fingerprint_hash: getDeviceFingerprintHash(),
    p_app_version: app.getVersion(),
  });

  const license = licenseStateFromRpc(normalizedKey, result, "Lizenzstatus aktualisiert.", current.activationId);
  return saveLicenseState(license);
}

async function deactivateLicense(): Promise<LicenseState> {
  const current = getLicenseState();
  const normalizedKey = sanitizeLicenseKey(current.key);

  if (normalizedKey && current.activationId) {
    try {
      await callLicenseRpc("deactivate_license_activation", {
        p_license_key: normalizedKey,
        p_activation_id: current.activationId,
        p_device_fingerprint_hash: getDeviceFingerprintHash(),
      });
    } catch (error) {
      return saveLicenseState({
        ...current,
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Deaktivierung fehlgeschlagen.",
      });
    }
  }

  return saveLicenseState({
    key: "",
    status: "invalid",
    expiresAt: null,
    activationId: null,
    remoteStatus: null,
    checkedAt: new Date().toISOString(),
    message: "Lizenz auf diesem Gerät deaktiviert.",
  });
}

async function callLicenseRpc(functionName: string, payload: Record<string, unknown>): Promise<LicenseRpcResponse> {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error("Supabase ist noch nicht konfiguriert. Setze SMART_SNIPPETFLOW_SUPABASE_URL und SMART_SNIPPETFLOW_SUPABASE_ANON_KEY.");
  }

  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${config.anonKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as LicenseRpcResponse) : ({ ok: false, reason: "empty_response" } as LicenseRpcResponse);

  if (!response.ok) {
    throw new Error(parsed.reason ?? `Supabase RPC fehlgeschlagen: ${response.status}`);
  }

  return parsed;
}

function licenseStateFromRpc(key: string, result: LicenseRpcResponse, successMessage: string, fallbackActivationId?: string | null): LicenseState {
  const checkedAt = new Date().toISOString();
  const remoteStatus = result.status ?? null;
  const expiresAt = result.currentPeriodEnd ?? null;

  if (!result.ok) {
    return {
      key,
      status: mapFailedLicenseStatus(remoteStatus),
      expiresAt,
      activationId: fallbackActivationId ?? null,
      remoteStatus,
      checkedAt,
      message: licenseReasonLabel(result.reason, result),
    };
  }

  return {
    key,
    status: mapRemoteLicenseStatus(remoteStatus, expiresAt),
    expiresAt,
    activationId: result.activationId ?? fallbackActivationId ?? null,
    remoteStatus,
    checkedAt,
    message: successMessage,
  };
}

function mapRemoteLicenseStatus(remoteStatus: RemoteLicenseStatus | null, expiresAt: string | null): LicenseStatus {
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return "expired";
  }

  if (remoteStatus && ["trialing", "active", "past_due", "canceled"].includes(remoteStatus)) {
    return "active";
  }

  if (remoteStatus && ["expired", "refunded", "disabled"].includes(remoteStatus)) {
    return "expired";
  }

  return "invalid";
}

function mapFailedLicenseStatus(remoteStatus: RemoteLicenseStatus | null): LicenseStatus {
  if (remoteStatus && ["expired", "refunded", "disabled", "canceled"].includes(remoteStatus)) {
    return "expired";
  }

  return "invalid";
}

function licenseReasonLabel(reason: string | undefined, result: LicenseRpcResponse) {
  switch (reason) {
    case "license_not_found":
      return "Lizenzschlüssel wurde nicht gefunden.";
    case "license_not_usable":
      return "Diese Lizenz ist nicht nutzbar.";
    case "device_limit_reached":
      return `Gerätelimit erreicht (${result.activeDevices ?? "?"}/${result.deviceLimit ?? "?"}).`;
    case "activation_not_found":
      return "Diese Geräteaktivierung wurde nicht gefunden.";
    case "missing_license_key":
      return "Bitte einen Lizenzschlüssel eingeben.";
    case "missing_device_fingerprint":
      return "Dieses Gerät konnte nicht eindeutig vorbereitet werden.";
    default:
      return reason ? `Lizenzprüfung fehlgeschlagen: ${reason}` : "Lizenzprüfung fehlgeschlagen.";
  }
}

function getDeviceFingerprintHash() {
  const installId = getOrCreateInstallId();
  return createHash("sha256").update(`smart-snippetflow:${installId}`).digest("hex");
}

function getOrCreateInstallId() {
  const existing = getSetting("install_id");

  if (existing) {
    return existing;
  }

  const installId = crypto.randomUUID();
  saveSetting("install_id", installId);
  return installId;
}

function getSupabaseConfig() {
  const url =
    getSetting("supabase_url") ??
    process.env.SMART_SNIPPETFLOW_SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const anonKey =
    getSetting("supabase_anon_key") ??
    process.env.SMART_SNIPPETFLOW_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    anonKey,
  };
}

function sanitizeLicenseKey(value: string) {
  const compact = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!compact) {
    return "";
  }

  if (compact.startsWith("SSF") && compact.length === 19) {
    return `SSF-${compact.slice(3, 7)}-${compact.slice(7, 11)}-${compact.slice(11, 15)}-${compact.slice(15, 19)}`;
  }

  if (compact.length === 16) {
    return `SSF-${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}`;
  }

  return compact.startsWith("SSF") ? compact.replace(/^SSF/, "SSF-") : compact;
}

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
  const isVariantRequest = request.purpose === "variant" && entryType === "prompt";
  const variantCount = isVariantRequest ? Math.max(1, Math.min(request.variantCount ?? 1, 3)) : 0;
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
        "Du bist ein präziser deutschsprachiger Assistent für Metadaten, Struktur und Varianten. Nutze ausschließlich das vorgegebene Tool, um dein Ergebnis strukturiert zurückzugeben.",
        tools: [
          {
            name: "format_snippetflow_metadata",
            description: "Gibt strukturierte Metadaten und optionale Prompt-Varianten für SMART SnippetFlow zurück.",
            input_schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string", description: "Kurzer professioneller Titel." },
                description: { type: "string", description: "Kurze Beschreibung des Inhalts." },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Bis zu sechs kurze Tags.",
                },
                categoryName: {
                  type: "string",
                  description: "Passender Kategoriename.",
                },
                variants: {
                  type: "array",
                  description: isVariantRequest
                    ? `Exakt ${variantCount} verbesserte Prompt-Variante(n).`
                    : "Für Metadaten-Anfragen und andere Typen leer.",
                  minItems: isVariantRequest ? variantCount : 0,
                  maxItems: variantCount,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      label: { type: "string" },
                      content: { type: "string" },
                      note: { type: "string" },
                    },
                    required: ["label", "content"],
                  },
                },
              },
              required: ["title", "description", "tags", "categoryName", "variants"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "format_snippetflow_metadata" },
        messages: [
          {
            role: "user",
            content: [
            isVariantRequest
              ? "Erstelle eine konkrete, verbesserte Prompt-Variante. Der Varianten-Text muss vollständig im Feld variants[0].content stehen."
              : `Analysiere diesen ${entryTypeLabel[entryType]} für eine lokale Bibliothek.`,
            isVariantRequest
              ? "Metadaten dürfen knapp sein, aber die Variante ist zwingend erforderlich."
              : "Erstelle kurze, professionelle Metadaten.",
            isVariantRequest
              ? `Erzeuge exakt ${variantCount} Variante(n). Das Feld variants darf nicht leer sein.`
              : "Es werden keine Varianten benötigt. Gib variants als leeres Array zurück.",
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

  const payload = (await response.json()) as {
    content?: Array<
      | { type: "text"; text?: string }
      | { type: "tool_use"; name?: string; input?: unknown }
    >;
  };
  const toolResult = payload.content?.find(
    (block) => block.type === "tool_use" && block.name === "format_snippetflow_metadata",
  );
  const parsed = toolResult && "input" in toolResult && toolResult.input
    ? toolResult.input as Partial<AiPromptAnalysisResult>
    : parseJsonObject(payload.content?.find((block) => block.type === "text")?.text ?? "") as Partial<AiPromptAnalysisResult>;

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
  const candidates = [
    value.trim(),
    ...Array.from(value.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi), (match) => match[1].trim()),
    ...extractJsonObjectCandidates(value),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate below.
    }
  }

  throw new Error("KI-Antwort konnte nicht als JSON verarbeitet werden. Bitte erneut versuchen.");
}

function extractJsonObjectCandidates(value: string) {
  const candidates: string[] = [];

  for (let start = value.indexOf("{"); start !== -1; start = value.indexOf("{", start + 1)) {
    let depth = 0;
    let isInString = false;
    let isEscaped = false;

    for (let index = start; index < value.length; index += 1) {
      const char = value[index];

      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === "\\") {
        isEscaped = true;
        continue;
      }

      if (char === "\"") {
        isInString = !isInString;
        continue;
      }

      if (isInString) {
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
      }

      if (depth === 0) {
        candidates.push(value.slice(start, index + 1));
        break;
      }
    }
  }

  return candidates;
}

function sanitizeApiKey(value: string) {
  return value.trim().replace(/\s/g, "").replace(/[^\x21-\x7E]/g, "");
}
