import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { Copy, FilePlus2, Heart, RotateCcw, Save, Search, SlidersHorizontal, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLibraryEntries } from "@/hooks/useLibraryEntries";
import { createPreviewDescriptor, createSandboxPreviewHtml } from "@/services/preview";
import type { AppView, EntryType, LibraryEntry, PreviewKind } from "@/types";
import { cn } from "@/utils/cn";

const filters: Array<{ label: string; value: EntryType | "all" }> = [
  { label: "Alle", value: "all" },
  { label: "Prompts", value: "prompt" },
  { label: "Code", value: "code" },
  { label: "Workflows", value: "workflow" },
];

const typeLabel: Record<EntryType, string> = {
  prompt: "Prompt",
  code: "Code",
  workflow: "Workflow",
};

const viewTitle: Record<Exclude<AppView, "settings">, string> = {
  dashboard: "Dashboard",
  prompts: "Prompts",
  code: "Code",
  workflows: "Workflows",
  favorites: "Favoriten",
};

const viewDescription: Record<Exclude<AppView, "settings">, string> = {
  dashboard: "Deine lokale Bibliothek auf einen Blick.",
  prompts: "Wiederverwendbare KI-Anweisungen und Vorlagen.",
  code: "Code-Snippets mit Sprache, Tags und schneller Kopie.",
  workflows: "Schlanke Abläufe fuer wiederkehrende Arbeit.",
  favorites: "Die wichtigsten Eintraege ohne Umwege.",
};

export function LibraryPage({
  activeView,
  onDirtyChange,
}: {
  activeView: Exclude<AppView, "settings">;
  onDirtyChange: (isDirty: boolean) => void;
}) {
  const defaultType = activeView === "code" ? "code" : activeView === "workflows" ? "workflow" : activeView === "prompts" ? "prompt" : "all";
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<EntryType | "all">(defaultType);
  const [sortMode, setSortMode] = useState<"recent" | "title">("recent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<LibraryEntry | null>(null);
  const { categories, filteredEntries, entries, isLoading, saveEntry, duplicateEntry, toggleFavorite, deleteEntry, saveCategory } =
    useLibraryEntries(activeType, query);

  const visibleEntries = useMemo(() => {
    if (activeView === "favorites") {
      return sortEntries(filteredEntries.filter((entry) => entry.isFavorite), sortMode);
    }

    return sortEntries(filteredEntries, sortMode);
  }, [activeView, filteredEntries, sortMode]);

  const selectedEntry = useMemo(() => {
    return entries.find((entry) => entry.id === selectedId) ?? visibleEntries[0] ?? entries[0];
  }, [entries, selectedId, visibleEntries]);

  const [draft, setDraft] = useState<LibraryEntry | null>(selectedEntry ?? null);

  useEffect(() => {
    setActiveType(defaultType);
  }, [defaultType]);

  useEffect(() => {
    if (selectedEntry) {
      setSelectedId(selectedEntry.id);
      setDraft(selectedEntry);
    }
  }, [selectedEntry?.id]);

  const preview = draft ? createPreviewDescriptor(draft) : null;
  const previewHtml = createSandboxPreviewHtml(preview);
  const isDirty = Boolean(draft && selectedEntry && !areEntriesEqual(draft, selectedEntry));
  const dashboardStats = useMemo(() => createDashboardStats(entries), [entries]);
  const recentEntries = entries.slice(0, 5);
  const favoriteEntries = entries.filter((entry) => entry.isFavorite).slice(0, 5);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2200);
  }

  async function handleCreate() {
    if (isDirty) {
      setPendingSelectionId("__create__");
      return;
    }

    await createEntry();
  }

  async function createEntry() {
    const type = activeType === "all" ? "prompt" : activeType;
    const created = await saveEntry({
      type,
      title: "Neuer Eintrag",
      description: "",
      content: type === "code" ? "// Neues Snippet" : "",
      language: type === "code" ? "typescript" : "markdown",
      tags: [],
      isFavorite: false,
      previewKind: type === "workflow" ? "markdown" : undefined,
    });
    setSelectedId(created.id);
    setDraft(created);
    showNotice("Eintrag erstellt");
  }

  async function handleSave() {
    if (!draft) {
      return;
    }

    const saved = await saveEntry(draft);
    setSelectedId(saved.id);
    setDraft(saved);
    showNotice("Gespeichert");
  }

  function handleDiscard() {
    if (selectedEntry) {
      setDraft(selectedEntry);
      showNotice("Aenderungen verworfen");
    }
  }

  async function handleDuplicate() {
    if (!draft) {
      return;
    }

    const duplicated = await duplicateEntry(draft.id);
    if (duplicated) {
      setSelectedId(duplicated.id);
      setDraft(duplicated);
      showNotice("Dupliziert");
    }
  }

  async function handleFavorite() {
    if (!draft) {
      return;
    }

    const updated = await toggleFavorite(draft.id);
    if (updated) {
      setDraft(updated);
      showNotice(updated.isFavorite ? "Als Favorit markiert" : "Favorit entfernt");
    }
  }

  async function handleCopy() {
    if (draft) {
      await navigator.clipboard.writeText(draft.content);
      showNotice("Inhalt kopiert");
    }
  }

  async function handleDelete() {
    if (!draft) {
      return;
    }

    setDeleteCandidate(draft);
  }

  async function confirmDelete() {
    if (!deleteCandidate) {
      return;
    }

    await deleteEntry(deleteCandidate.id);
    const nextEntry = entries.find((entry) => entry.id !== deleteCandidate.id) ?? null;
    setSelectedId(nextEntry?.id ?? null);
    setDraft(nextEntry);
    setDeleteCandidate(null);
    showNotice("Eintrag geloescht");
  }

  async function handleAddCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed || !draft) {
      return;
    }

    const category = await saveCategory(trimmed);
    setDraft({ ...draft, categoryId: category.id, categoryName: category.name });
    setNewCategoryName("");
    showNotice("Kategorie erstellt");
  }

  function handleSelectEntry(id: string) {
    if (id === selectedId) {
      return;
    }

    if (isDirty) {
      setPendingSelectionId(id);
      return;
    }

    setSelectedId(id);
  }

  async function confirmPendingSelection() {
    if (!pendingSelectionId) {
      return;
    }

    const target = pendingSelectionId;
    setPendingSelectionId(null);

    if (target === "__create__") {
      await createEntry();
      return;
    }

    setSelectedId(target);
  }

  return (
    <div className="grid h-screen grid-cols-[minmax(360px,0.82fr)_minmax(520px,1.18fr)] overflow-hidden">
      <section className="flex min-w-0 flex-col border-r border-border bg-background">
        <header className="border-b border-border px-8 pb-5 pt-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">{viewTitle[activeView]}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{viewDescription[activeView]}</p>
            </div>
            <Button onClick={handleCreate}>
              <FilePlus2 className="h-4 w-4" />
              Neu
            </Button>
          </div>

          <div className="mt-6 flex gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suchen" className="pl-9" />
            </div>
            <Button variant="outline" size="icon" title="Filter">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setActiveType(filter.value)}
                  className={cn(
                    "h-8 rounded-md border border-transparent px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeType === filter.value && "border-border bg-muted text-foreground",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as "recent" | "title")}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none"
            >
              <option value="recent">Zuletzt bearbeitet</option>
              <option value="title">Titel A-Z</option>
            </select>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-5">
          {activeView === "dashboard" && (
            <div className="mb-5 grid gap-4">
              <div className="grid grid-cols-4 gap-3">
                {dashboardStats.map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DashboardList title="Zuletzt bearbeitet" entries={recentEntries} onSelect={handleSelectEntry} />
                <DashboardList title="Favoriten" entries={favoriteEntries} onSelect={handleSelectEntry} />
              </div>
            </div>
          )}
          {isLoading && <p className="text-sm text-muted-foreground">Lade lokale Bibliothek...</p>}
          {!isLoading && visibleEntries.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              Keine Eintraege gefunden.
            </div>
          )}
          <div className="grid gap-3">
            {visibleEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleSelectEntry(entry.id)}
                className={cn(
                  "rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-ring",
                  draft?.id === entry.id && "border-ring",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge>{typeLabel[entry.type]}</Badge>
                      {entry.categoryName && <Badge>{entry.categoryName}</Badge>}
                      {entry.isFavorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                    </div>
                    <h2 className="mt-3 truncate text-sm font-semibold">{entry.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{entry.description || "Keine Beschreibung"}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {entry.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {draft && (
        <section className="flex min-w-0 flex-col bg-card">
          <header className="border-b border-border px-8 pb-5 pt-8">
            <div className="flex items-start justify-between gap-4">
              <div className="grid min-w-0 flex-1 gap-3">
                <div className="flex h-5 items-center gap-2">
                  {isDirty ? <Badge className="border-amber-200 bg-amber-50 text-amber-700">Ungespeichert</Badge> : <Badge>Synchron</Badge>}
                  {notice && <span className="text-xs text-muted-foreground">{notice}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={draft.type}
                    onChange={(event) => setDraft({ ...draft, type: event.target.value as EntryType })}
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none"
                  >
                    <option value="prompt">Prompt</option>
                    <option value="code">Code</option>
                    <option value="workflow">Workflow</option>
                  </select>
                  <Input
                    value={draft.language ?? ""}
                    onChange={(event) => setDraft({ ...draft, language: event.target.value })}
                    placeholder="Sprache"
                    className="h-8 w-32"
                  />
                  <select
                    value={draft.categoryId ?? ""}
                    onChange={(event) => {
                      const category = categories.find((item) => item.id === event.target.value);
                      setDraft({ ...draft, categoryId: category?.id, categoryName: category?.name });
                    }}
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none"
                  >
                    <option value="">Ohne Kategorie</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.previewKind ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, previewKind: (event.target.value || undefined) as PreviewKind | undefined })
                    }
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none"
                  >
                    <option value="">Keine Preview</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="javascript">JavaScript</option>
                    <option value="markdown">Markdown</option>
                  </select>
                </div>
                <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="h-11 text-xl font-semibold" />
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="Beschreibung"
                  className="min-h-16 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} variant="outline" size="icon" title="Speichern">
                  <Save className="h-4 w-4" />
                </Button>
                <Button onClick={handleDiscard} variant="outline" size="icon" title="Aenderungen verwerfen" disabled={!isDirty}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button onClick={handleCopy} variant="outline" size="icon" title="Kopieren">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button onClick={handleDuplicate} variant="outline" size="icon" title="Duplizieren">
                  <FilePlus2 className="h-4 w-4" />
                </Button>
                <Button onClick={handleFavorite} variant="outline" size="icon" title="Favorit">
                  <Heart className={cn("h-4 w-4", draft.isFavorite && "fill-rose-500 text-rose-500")} />
                </Button>
                <Button onClick={handleDelete} variant="outline" size="icon" title="Loeschen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)_180px] gap-5 overflow-hidden px-8 py-6">
            <div className="grid grid-cols-[minmax(0,1fr)_220px_auto] gap-3">
              <Input
                value={draft.tags.join(", ")}
                onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((tag) => tag.trim()) })}
                placeholder="Tags mit Komma trennen"
              />
              <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Neue Kategorie" />
              <Button onClick={handleAddCategory} variant="outline">Hinzufuegen</Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {draft.tags.filter(Boolean).map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
              {draft.categoryName && <Badge>{draft.categoryName}</Badge>}
            </div>

            <div className="min-h-0 overflow-hidden rounded-lg border border-border bg-background">
              <Editor
                height="100%"
                value={draft.content}
                language={draft.language || (draft.previewKind === "markdown" ? "markdown" : "typescript")}
                theme="vs-light"
                onChange={(value) => setDraft({ ...draft, content: value ?? "" })}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, monospace",
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  padding: { top: 18, bottom: 18 },
                  smoothScrolling: true,
                }}
              />
            </div>

            <div className="grid grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-background">
              <div className="border-r border-border p-4">
                <p className="text-sm font-medium">Live-Preview</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Sandboxed iframe ist vorbereitet und isoliert eingebettet.</p>
                <div className="mt-3">{preview ? <Badge>{preview.kind.toUpperCase()}</Badge> : <Badge>Inaktiv</Badge>}</div>
              </div>
              <iframe
                title="Preview"
                sandbox=""
                srcDoc={previewHtml}
                className="h-full w-full bg-white"
              />
            </div>
          </div>
        </section>
      )}
      {pendingSelectionId && (
        <ConfirmDialog
          title="Ungespeicherte Aenderungen"
          description="Wenn du fortfaehrst, werden die aktuellen Aenderungen im Editor verworfen."
          confirmLabel="Verwerfen"
          onCancel={() => setPendingSelectionId(null)}
          onConfirm={confirmPendingSelection}
        />
      )}
      {deleteCandidate && (
        <ConfirmDialog
          title="Eintrag loeschen"
          description={`"${deleteCandidate.title}" wird dauerhaft aus der lokalen Bibliothek entfernt.`}
          confirmLabel="Loeschen"
          danger
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function DashboardList({
  title,
  entries,
  onSelect,
}: {
  title: string;
  entries: LibraryEntry[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-3 grid gap-2">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Eintraege.</p>}
        {entries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onSelect(entry.id)}
            className="rounded-md px-2 py-2 text-left hover:bg-muted"
          >
            <p className="truncate text-sm font-medium">{entry.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{typeLabel[entry.type]}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/20 px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-soft">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button onClick={onConfirm} className={danger ? "bg-rose-600 text-white hover:bg-rose-700" : undefined}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function sortEntries(entries: LibraryEntry[], sortMode: "recent" | "title") {
  if (sortMode === "title") {
    return [...entries].sort((a, b) => a.title.localeCompare(b.title));
  }

  return entries;
}

function areEntriesEqual(a: LibraryEntry, b: LibraryEntry) {
  return JSON.stringify(normalizeEntry(a)) === JSON.stringify(normalizeEntry(b));
}

function normalizeEntry(entry: LibraryEntry) {
  return {
    ...entry,
    language: entry.language || undefined,
    categoryId: entry.categoryId || undefined,
    categoryName: entry.categoryName || undefined,
    previewKind: entry.previewKind || undefined,
    tags: entry.tags.map((tag) => tag.trim()).filter(Boolean),
  };
}

function createDashboardStats(entries: LibraryEntry[]) {
  return [
    { label: "Prompts", value: entries.filter((entry) => entry.type === "prompt").length },
    { label: "Code", value: entries.filter((entry) => entry.type === "code").length },
    { label: "Workflows", value: entries.filter((entry) => entry.type === "workflow").length },
    { label: "Favoriten", value: entries.filter((entry) => entry.isFavorite).length },
  ];
}
