import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FieldOption, FieldOptionKey, LicenseState, LicenseStatus } from "@/types";

const statusLabel: Record<LicenseStatus, string> = {
  active: "Aktiv",
  expired: "Abgelaufen",
  invalid: "Ungueltig",
};

const optionSections: Array<{ fieldKey: FieldOptionKey; title: string; description: string }> = [
  { fieldKey: "aiSystem", title: "KI-Systeme", description: "Auswahlwerte fuer Prompt-Eintraege." },
  { fieldKey: "language", title: "Sprachen", description: "Auswahlwerte fuer Code-Snippets." },
  { fieldKey: "workflowArea", title: "Workflow-Bereiche", description: "Auswahlwerte fuer Workflows." },
  { fieldKey: "noteCategory", title: "Notiz-Kategorien", description: "Auswahlwerte fuer Notizen." },
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
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([]);
  const groupedOptions = useMemo(() => {
    return optionSections.map((section) => ({
      ...section,
      options: fieldOptions
        .filter((option) => option.fieldKey === section.fieldKey)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    }));
  }, [fieldOptions]);

  useEffect(() => {
    void window.snippetFlow?.fieldOptions.list().then(setFieldOptions);
  }, []);

  async function handleSave() {
    const nextLicense: LicenseState = {
      ...draft,
      status: draft.key.trim().length >= 8 ? draft.status : "invalid",
      expiresAt: draft.expiresAt || null,
    };
    const saved = (await window.snippetFlow?.license.save(nextLicense)) ?? nextLicense;
    onLicenseChange(saved);
    setDraft(saved);
  }

  async function handleExportJson() {
    const result = await window.snippetFlow?.data.exportJson();

    if (!result || result.canceled) {
      setDataNotice("Export abgebrochen");
      return;
    }

    setDataNotice(`JSON exportiert: ${result.filePath}`);
  }

  async function handleImportJson() {
    const result = await window.snippetFlow?.data.importJson();

    if (!result || result.canceled) {
      setDataNotice("Import abgebrochen");
      return;
    }

    setDataNotice(`${result.importedEntries} Eintraege und ${result.importedCategories} Kategorien importiert`);
  }

  async function handleAddOption(fieldKey: FieldOptionKey) {
    const label = window.prompt("Neuen Auswahlwert hinzufuegen");
    if (!label?.trim()) {
      return;
    }

    const created = await window.snippetFlow?.fieldOptions.create(fieldKey, label.trim());
    if (created) {
      setFieldOptions((current) => [...current.filter((option) => option.id !== created.id), created]);
    }
  }

  async function handleRenameOption(option: FieldOption) {
    if (option.isSystem) {
      return;
    }

    const label = window.prompt("Auswahlwert umbenennen", option.label);
    if (!label?.trim()) {
      return;
    }

    const renamed = await window.snippetFlow?.fieldOptions.rename(option.id, label.trim());
    if (renamed) {
      setFieldOptions((current) => current.map((item) => (item.id === renamed.id ? renamed : item)));
    }
  }

  async function handleDeleteOption(option: FieldOption) {
    if (option.isSystem) {
      return;
    }

    const confirmed = window.confirm(`"${option.label}" aus der Auswahl entfernen? Bestehende Eintraege bleiben unveraendert.`);
    if (!confirmed) {
      return;
    }

    const result = await window.snippetFlow?.fieldOptions.delete(option.id);
    if (result?.deleted) {
      setFieldOptions((current) => current.filter((item) => item.id !== option.id));
    }
  }

  return (
    <div className="h-screen overflow-y-auto bg-background px-10 py-9">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-normal">Einstellungen</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Lokale App-Einstellungen und vorbereitete Lizenzaktivierung fuer Lemon Squeezy.
        </p>

        <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Lizenz</h2>
              <p className="mt-1 text-sm text-muted-foreground">Version 1 speichert den Status lokal. Die API-Pruefung folgt spaeter.</p>
            </div>
            <Badge>{statusLabel[draft.status]}</Badge>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Lizenzschluessel
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
                <option value="invalid">Ungueltig</option>
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
            <h2 className="text-base font-semibold">Daten sichern</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              SQLite bleibt die interne Datenbank. JSON dient nur als manuelles Backup oder fuer einen spaeteren Umzug.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={handleExportJson}>JSON exportieren</Button>
            <Button onClick={handleImportJson} variant="outline">JSON importieren</Button>
          </div>

          {dataNotice && <p className="mt-4 text-sm text-muted-foreground">{dataNotice}</p>}
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">Auswahlwerte</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Systemwerte sind geschuetzt. Eigene Werte kannst du ergaenzen, umbenennen oder aus der Auswahl entfernen.
            </p>
          </div>

          <div className="mt-6 grid gap-5">
            {groupedOptions.map((section) => (
              <div key={section.fieldKey} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                  </div>
                  <Button variant="outline" onClick={() => void handleAddOption(section.fieldKey)}>
                    Wert hinzufuegen
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {section.options.map((option) => (
                    <div key={option.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
                      <span className="text-sm">{option.label}</span>
                      {option.isSystem && <Badge>Standard</Badge>}
                      {!option.isSystem && (
                        <>
                          <button onClick={() => void handleRenameOption(option)} className="text-xs text-muted-foreground hover:text-foreground">
                            Umbenennen
                          </button>
                          <button onClick={() => void handleDeleteOption(option)} className="text-xs text-rose-600 hover:text-rose-700">
                            Loeschen
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-dashed border-border bg-background p-4">
              <h3 className="text-sm font-semibold">Tags</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Tags bleiben bewusst frei eingebbar und werden nicht streng verwaltet.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
