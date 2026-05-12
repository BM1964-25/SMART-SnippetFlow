import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LicenseState, LicenseStatus } from "@/types";

const statusLabel: Record<LicenseStatus, string> = {
  active: "Aktiv",
  expired: "Abgelaufen",
  invalid: "Ungueltig",
};

export function SettingsPage({
  license,
  onLicenseChange,
}: {
  license: LicenseState;
  onLicenseChange: (license: LicenseState) => void;
}) {
  const [draft, setDraft] = useState(license);

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
      </div>
    </div>
  );
}
