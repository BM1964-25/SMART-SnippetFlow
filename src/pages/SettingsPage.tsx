import { useRef, useState } from "react";
import { Archive, Database, HardDrive, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserExportPayload, importBrowserPayload, writeBrowserLicense } from "@/services/browserStorage";
import type { LicenseState, LicenseStatus } from "@/types";

const statusLabel: Record<LicenseStatus, string> = {
  active: "Aktiv",
  expired: "Abgelaufen",
  invalid: "Ungültig",
};

const dataManagementItems = [
  {
    title: "Lokale Speicherung",
    description: "Deine Bibliothek liegt als SQLite-Datenbank auf diesem Rechner im App-Datenverzeichnis.",
    icon: HardDrive,
  },
  {
    title: "Gespeicherte Inhalte",
    description: "Prompts, Code, Workflows, Notizen, Kategorien, Tags, Favoriten, Lizenzstatus und Einstellungen.",
    icon: Database,
  },
  {
    title: "Exportumfang",
    description: "Der JSON-Export enthält die gesamte Bibliothek, unabhängig vom gerade geöffneten Bereich.",
    icon: Archive,
  },
  {
    title: "Datenschutz",
    description: "Es gibt keine automatische Cloud-Synchronisierung und keine automatische Datenübertragung.",
    icon: ShieldCheck,
  },
];

export function SettingsPage({
  license,
  onLicenseChange,
}: {
  license: LicenseState;
  onLicenseChange: (license: LicenseState) => void;
}) {
  const [draft, setDraft] = useState(license);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    const nextLicense: LicenseState = {
      ...draft,
      status: draft.key.trim().length >= 8 ? draft.status : "invalid",
      expiresAt: draft.expiresAt || null,
    };
    const saved = (await window.snippetFlow?.license.save(nextLicense)) ?? nextLicense;
    if (!window.snippetFlow) {
      writeBrowserLicense(saved);
    }
    onLicenseChange(saved);
    setDraft(saved);
  }

  async function handleExportJson() {
    if (!window.snippetFlow) {
      const payload = createBrowserExportPayload(draft);
      const content = JSON.stringify(payload, null, 2);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `smart-snippetflow-export-${payload.createdAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setDataNotice("JSON exportiert");
      return;
    }

    const result = await window.snippetFlow?.data.exportJson();

    if (!result || result.canceled) {
      setDataNotice("Export abgebrochen");
      return;
    }

    setDataNotice(`JSON exportiert: ${result.filePath}`);
  }

  async function handleImportJson() {
    if (!window.snippetFlow) {
      importInputRef.current?.click();
      return;
    }

    const result = await window.snippetFlow?.data.importJson();

    if (!result || result.canceled) {
      setDataNotice("Import abgebrochen");
      return;
    }

    setDataNotice(`${result.importedEntries} Einträge und ${result.importedCategories} Kategorien importiert`);
  }

  async function handleBrowserImport(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const result = importBrowserPayload(content);
      setDataNotice(`${result.importedEntries} Einträge und ${result.importedCategories} Kategorien importiert. Seite wird neu geladen.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setDataNotice("Import fehlgeschlagen: Die Datei konnte nicht gelesen werden.");
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="h-screen overflow-y-auto bg-background px-10 py-9">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-normal">Einstellungen</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Lokale App-Einstellungen und vorbereitete Lizenzaktivierung für Lemon Squeezy.
        </p>

        <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Lizenz</h2>
              <p className="mt-1 text-sm text-muted-foreground">Version 1 speichert den Status lokal. Die API-Prüfung folgt später.</p>
            </div>
            <Badge>{statusLabel[draft.status]}</Badge>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Lizenzschlüssel
              <Input value={draft.key} onChange={(event) => setDraft({ ...draft, key: event.target.value })} placeholder="SMART-XXXX-XXXX" />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Status
              <select
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as LicenseStatus })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
              >
                <option value="active">Aktiv</option>
                <option value="expired">Abgelaufen</option>
                <option value="invalid">Ungültig</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Ablaufdatum
              <Input type="date" value={draft.expiresAt ?? ""} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value || null })} />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave}>Lizenz speichern</Button>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">Datenmanagement</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Übersicht darüber, was SMART SnippetFlow speichert und wie du deine Daten sichern kannst.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {dataManagementItems.map((item) => (
              <div key={item.title} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-dashed border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">Manuelle Sicherung</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  JSON eignet sich für Backups und den späteren Umzug auf ein anderes System.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleExportJson}>JSON exportieren</Button>
                <Button onClick={handleImportJson} variant="outline">JSON importieren</Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => void handleBrowserImport(event.target.files?.[0])}
                />
              </div>
            </div>
          </div>

          {dataNotice && <p className="mt-4 text-sm text-muted-foreground">{dataNotice}</p>}
        </section>
      </div>
    </div>
  );
}
