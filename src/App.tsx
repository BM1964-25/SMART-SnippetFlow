import { useEffect, useState } from "react";
import { AppShell } from "@/layout/AppShell";
import { LibraryPage } from "@/pages/LibraryPage";
import { SettingsPage } from "@/pages/SettingsPage";
import type { AppView, LicenseState } from "@/types";

export default function App() {
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [license, setLicense] = useState<LicenseState>({ key: "", status: "invalid", expiresAt: null });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingView, setPendingView] = useState<AppView | null>(null);

  useEffect(() => {
    void window.snippetFlow?.license.get().then(setLicense);
  }, []);

  function requestViewChange(view: AppView) {
    if (view === activeView) {
      return;
    }

    if (hasUnsavedChanges) {
      setPendingView(view);
      return;
    }

    setActiveView(view);
  }

  function confirmViewChange() {
    if (pendingView) {
      setActiveView(pendingView);
      setPendingView(null);
      setHasUnsavedChanges(false);
    }
  }

  return (
    <AppShell activeView={activeView} licenseStatus={license.status} onViewChange={requestViewChange}>
      {activeView === "settings" ? (
        <SettingsPage license={license} onLicenseChange={setLicense} />
      ) : (
        <LibraryPage activeView={activeView} onDirtyChange={setHasUnsavedChanges} />
      )}
      {pendingView && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/20 px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-soft">
            <h2 className="text-base font-semibold">Ungespeicherte Aenderungen</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Beim Wechsel der Ansicht gehen aktuelle Aenderungen im Editor verloren.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingView(null)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmViewChange}
                className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Wechseln
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
