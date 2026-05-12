import type { ReactNode } from "react";
import { Blocks, Code2, Heart, Library, NotebookText, Settings, Workflow } from "lucide-react";
import type { AppView, LicenseStatus } from "@/types";
import { cn } from "@/utils/cn";

const navItems = [
  { id: "all", label: "Alle", icon: Library },
  { id: "prompts", label: "Prompts", icon: Library },
  { id: "code", label: "Code", icon: Code2 },
  { id: "workflows", label: "Workflows", icon: Workflow },
  { id: "notes", label: "Notizen", icon: NotebookText },
  { id: "favorites", label: "Favoriten", icon: Heart },
  { id: "settings", label: "Einstellungen", icon: Settings },
] satisfies Array<{ id: AppView; label: string; icon: typeof Library }>;

const licenseLabel: Record<LicenseStatus, string> = {
  active: "Aktiv",
  expired: "Abgelaufen",
  invalid: "Nicht aktiviert",
};

export function AppShell({
  activeView,
  licenseStatus,
  onViewChange,
  children,
}: {
  activeView: AppView;
  licenseStatus: LicenseStatus;
  onViewChange: (view: AppView) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card px-4 py-5">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Blocks className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">SMART SnippetFlow</p>
            <p className="text-xs text-muted-foreground">Lokale Bibliothek</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                activeView === item.id && "bg-muted text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium">Lizenz</p>
          <p className="mt-1 text-xs text-muted-foreground">{licenseLabel[licenseStatus]}</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
