import { useState, type ReactNode } from "react";
import { CircleHelp, Code2, Library, MessageSquareText, NotebookText, PanelLeftClose, PanelLeftOpen, Settings, Star, Workflow } from "lucide-react";
import appLogo from "@/assets/app-logo.png";
import type { ApiStatus, AppView, LicenseStatus } from "@/types";
import { cn } from "@/utils/cn";

const navItems = [
  { id: "all", label: "Bibliothek", icon: Library },
  { id: "prompts", label: "Prompts", icon: MessageSquareText },
  { id: "code", label: "Code", icon: Code2 },
  { id: "workflows", label: "Workflows", icon: Workflow },
  { id: "notes", label: "Notizen", icon: NotebookText },
  { id: "favorites", label: "Favoriten", icon: Star },
  { id: "settings", label: "Einstellungen", icon: Settings },
  { id: "help", label: "Hilfe", icon: CircleHelp },
] satisfies Array<{ id: AppView; label: string; icon: typeof Library }>;

const licenseLabel: Record<LicenseStatus, string> = {
  active: "Aktiv",
  expired: "Abgelaufen",
  invalid: "Nicht aktiviert",
};

const apiLabel: Record<ApiStatus, string> = {
  active: "API aktiv",
  missing: "API fehlt",
};

const legalLinks = [
  { label: "Impressum", href: "https://www.built-smart-hub.com/impressum" },
  { label: "Datenschutz", href: "https://www.built-smart-hub.com/datenschutz" },
  { label: "AGB", href: "https://www.built-smart-hub.com/agb" },
  { label: "Widerrufsbelehrung", href: "https://www.built-smart-hub.com/widerrufbelehrung" },
];

export function AppShell({
  activeView,
  apiStatus,
  licenseStatus,
  onViewChange,
  children,
}: {
  activeView: AppView;
  apiStatus: ApiStatus;
  licenseStatus: LicenseStatus;
  onViewChange: (view: AppView) => void;
  children: ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-border bg-card px-4 py-5 transition-[width] duration-200",
          isCollapsed ? "w-20" : "w-64",
        )}
      >
        <div className={cn("mb-8 flex items-center gap-3.5 px-1.5", isCollapsed && "justify-center px-0")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm">
            <img src={appLogo} alt="SMART SnippetFlow" className="h-full w-full object-contain" />
          </div>
          <div className={cn("min-w-0 leading-tight", isCollapsed && "hidden")}>
            <p className="truncate text-[15px] font-semibold tracking-[0.01em] text-foreground">SMART SnippetFlow</p>
            <p className="mt-1 truncate text-[12px] text-muted-foreground">Lokale Wissensbasis</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                activeView === item.id && "bg-muted text-foreground",
                isCollapsed && "justify-center px-0",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className={cn(isCollapsed && "hidden")}>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          onClick={() => setIsCollapsed((current) => !current)}
          aria-label={isCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
          className={cn(
            "mt-auto flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
            isCollapsed && "justify-center px-0",
          )}
          title={isCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          <span className={cn(isCollapsed && "hidden")}>{isCollapsed ? "Ausklappen" : "Einklappen"}</span>
        </button>

        <div className={cn("mt-3 rounded-md border border-border bg-background p-3", isCollapsed && "hidden")}>
          <p className="text-xs font-medium">Lizenz</p>
          <p className="mt-1 text-xs text-muted-foreground">{licenseLabel[licenseStatus]}</p>
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs font-medium">KI</p>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", apiStatus === "active" ? "bg-emerald-500" : "bg-slate-300")} />
              {apiLabel[apiStatus]}
            </p>
          </div>
        </div>

        <footer className={cn("mt-4 border-t border-border pt-3 text-center text-[11px] leading-5 text-muted-foreground", isCollapsed && "hidden")}>
          <p>© 2026 BuiltSmart Hub AI</p>
          <p>powered by BuiltSmart Hub</p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-1.5 gap-y-1">
            {legalLinks.map((link, index) => (
              <span key={link.href} className="inline-flex items-center gap-1.5">
                {index > 0 && <span aria-hidden="true" className="text-border">|</span>}
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  {link.label}
                </a>
              </span>
            ))}
          </div>
        </footer>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
