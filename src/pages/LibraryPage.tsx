import { useEffect, useMemo, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import Editor from "@monaco-editor/react";
import { Bold, Check, ChevronDown, ChevronRight, ChevronUp, Copy, FilePlus2, List, ListOrdered, Loader2, Plus, RotateCcw, Save, Search, Sparkles, Star, Trash2, Type, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLibraryEntries } from "@/hooks/useLibraryEntries";
import { createPreviewDescriptor, createSandboxPreviewHtml } from "@/services/preview";
import type { AiPromptAnalysisResult, ApiStatus, AppView, EntryType, FieldOptionKey, LibraryEntry, PreviewKind, PromptVariant } from "@/types";
import { cn } from "@/utils/cn";

const filters: Array<{ label: string; value: EntryType | "all" }> = [
  { label: "Alle Typen", value: "all" },
  { label: "Prompts", value: "prompt" },
  { label: "Code", value: "code" },
  { label: "Workflows", value: "workflow" },
  { label: "Notizen", value: "note" },
];

const entryRenderBatchSize = 80;

const typeLabel: Record<EntryType, string> = {
  prompt: "Prompts",
  code: "Code",
  workflow: "Workflow",
  note: "Notiz",
};

const editorTitle: Record<EntryType, string> = {
  prompt: "Prompt",
  code: "Code",
  workflow: "Workflows",
  note: "Notizen",
};

const editorDescription: Record<EntryType, string> = {
  prompt: "KI-Anweisungen, Vorlagen und wiederverwendbare Arbeitsaufträge.",
  code: "Snippets, Funktionen, technische Muster und schnelle Kopiervorlagen.",
  workflow: "Schrittfolgen, Abläufe und wiederkehrende Arbeitsroutinen.",
  note: "Freier Text, Dokumentation, Gedanken und Markdown-Notizen.",
};

const viewTitle: Record<Exclude<AppView, "settings">, string> = {
  all: "Bibliothek",
  prompts: "Prompts",
  code: "Code",
  workflows: "Workflows",
  notes: "Notizen",
  favorites: "Favoriten",
  help: "Hilfe",
};

const viewDescription: Record<Exclude<AppView, "settings">, string> = {
  all: "Deine lokale Bibliothek auf einen Blick.",
  prompts: "Wiederverwendbare KI-Anweisungen und Vorlagen.",
  code: "Code-Snippets mit Sprache, Tags und schneller Kopie.",
  workflows: "Schlanke Abläufe für wiederkehrende Arbeit.",
  notes: "Leichte Markdown-Notizen ohne überflüssige Struktur.",
  favorites: "Die wichtigsten Einträge ohne Umwege.",
  help: "Kurze Orientierung zu Prozessen, Varianten und Editor-Hilfen.",
};

export function LibraryPage({
  activeView,
  apiStatus,
  onDirtyChange,
}: {
  activeView: Exclude<AppView, "settings">;
  apiStatus: ApiStatus;
  onDirtyChange: (isDirty: boolean) => void;
}) {
  const defaultType =
    activeView === "code"
      ? "code"
      : activeView === "workflows"
        ? "workflow"
        : activeView === "prompts"
          ? "prompt"
          : activeView === "notes"
            ? "note"
            : "all";
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<EntryType | "all">(defaultType);
  const [sortMode, setSortMode] = useState<"recent" | "title">("recent");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [didCopy, setDidCopy] = useState(false);
  const [didSave, setDidSave] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<LibraryEntry | null>(null);
  const [entryRenderLimit, setEntryRenderLimit] = useState(entryRenderBatchSize);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isTagCloudOpen, setIsTagCloudOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [activePromptVersionId, setActivePromptVersionId] = useState<"original" | string>("original");
  const [isAiBusy, setIsAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const { categories, fieldOptions, filteredEntries, entries, isLoading, saveEntry, duplicateEntry, toggleFavorite, deleteEntry, saveCategory, deleteCategory, createFieldOption } =
    useLibraryEntries(activeType, query);

  const availableTags = useMemo(() => {
    return [...new Set(entries.flatMap((entry) => entry.tags).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const categoryOptions = useMemo(() => {
    const options = new Map<string, { id: string; name: string }>();

    for (const category of categories) {
      options.set(category.id, { id: category.id, name: category.name });
    }

    for (const entry of entries) {
      if (entry.categoryId && entry.categoryName) {
        options.set(entry.categoryId, { id: entry.categoryId, name: entry.categoryName });
      }
    }

    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, entries]);

  const narrowedEntries = useMemo(() => {
    return filteredEntries.filter((entry) => {
      const matchesCategory = categoryFilter === "all" || entry.categoryId === categoryFilter;
      const matchesTag = tagFilter === "all" || entry.tags.includes(tagFilter);
      return matchesCategory && matchesTag;
    });
  }, [categoryFilter, filteredEntries, tagFilter]);

  const visibleEntries = useMemo(() => {
    if (activeView === "favorites") {
      return sortEntries(narrowedEntries.filter((entry) => entry.isFavorite), sortMode);
    }

    return sortEntries(narrowedEntries, sortMode);
  }, [activeView, narrowedEntries, sortMode]);
  const renderedEntries = visibleEntries.slice(0, entryRenderLimit);
  const hasMoreEntries = renderedEntries.length < visibleEntries.length;
  const hasActiveListFilters =
    query.trim().length > 0 || categoryFilter !== "all" || tagFilter !== "all" || activeType !== defaultType || sortMode !== "recent";

  const selectedEntry = useMemo(() => {
    return entries.find((entry) => entry.id === selectedId) ?? visibleEntries[0] ?? entries[0];
  }, [entries, selectedId, visibleEntries]);

  const [draft, setDraft] = useState<LibraryEntry | null>(selectedEntry ?? null);

  useEffect(() => {
    setActiveType(defaultType);
    if (defaultType !== "all") {
      setSelectedId(null);
    }
  }, [defaultType]);

  useEffect(() => {
    setCategoryFilter("all");
    setTagFilter("all");
  }, [activeView]);

  useEffect(() => {
    setEntryRenderLimit(entryRenderBatchSize);
  }, [activeType, categoryFilter, query, sortMode, tagFilter]);

  useEffect(() => {
    if (selectedEntry) {
      setSelectedId(selectedEntry.id);
      setDraft(selectedEntry);
      setActivePromptVersionId("original");
      setAiNotice(null);
    }
  }, [selectedEntry?.id]);

  const preview = draft ? createPreviewDescriptor(draft) : null;
  const previewHtml = createSandboxPreviewHtml(preview);
  const isDirty = Boolean(draft && selectedEntry && !areEntriesEqual(draft, selectedEntry));
  const showAiSystemField = draft?.type === "prompt";
  const activeFieldKey = showAiSystemField ? getFieldKeyForType(draft.type) : null;
  const activeFieldLabel = showAiSystemField ? getFieldLabelForType(draft.type) : "";
  const previewOptions = draft ? getPreviewOptionsForType(draft.type) : [];
  const shouldShowPreview = Boolean(draft && draft.type !== "prompt");
  const previewLabel = draft?.type === "code" ? "Live-Preview" : "Markdown-Vorschau";
  const activeFieldOptions = activeFieldKey
    ? fieldOptions
        .filter((option) => option.fieldKey === activeFieldKey)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    : [];
  const tagSuggestions = draft
    ? availableTags
        .filter((tag) => !draft.tags.includes(tag))
        .filter((tag) => tag.toLowerCase().includes(tagInput.trim().toLowerCase()))
        .slice(0, 6)
    : [];
  const tagCloudOptions = draft ? availableTags.filter((tag) => !draft.tags.includes(tag)).slice(0, 32) : [];
  const dashboardStats = useMemo(() => createDashboardStats(entries), [entries]);
  const recentEntries = entries.slice(0, 5);
  const favoriteEntries = entries.filter((entry) => entry.isFavorite).slice(0, 5);
  const promptVariants = draft?.type === "prompt" ? (draft.promptVariants ?? []) : [];
  const activePromptVariant =
    activePromptVersionId === "original" ? null : promptVariants.find((variant) => variant.id === activePromptVersionId) ?? null;
  const contentEditorEntry =
    draft && activePromptVariant
      ? {
          ...draft,
          content: activePromptVariant.content,
        }
      : draft;

  useEffect(() => {
    if (activePromptVersionId !== "original" && !promptVariants.some((variant) => variant.id === activePromptVersionId)) {
      setActivePromptVersionId("original");
    }
  }, [activePromptVersionId, promptVariants]);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (isDirty) {
      setDidSave(false);
    }
  }, [isDirty]);

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
      content: type === "code" ? "// Neues Snippet" : type === "note" ? "## Notiz\n\n" : "",
      language: type === "code" ? "typescript" : "markdown",
      fieldValue: getDefaultFieldValue(type),
      tags: [],
      isFavorite: false,
      previewKind: type === "workflow" || type === "note" ? "markdown" : undefined,
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
    setDidSave(true);
    window.setTimeout(() => setDidSave(false), 1600);
    showNotice("Gespeichert");
  }

  function handleDiscard() {
    if (selectedEntry) {
      setDraft(selectedEntry);
      showNotice("Änderungen verworfen");
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
      await handleCopyContent(activePromptVariant?.content ?? draft.content);
    }
  }

  async function handleCopyContent(content: string) {
    if (content) {
      await copyTextToClipboard(content);
      setDidCopy(true);
      window.setTimeout(() => setDidCopy(false), 1500);
      showNotice("Inhalt kopiert");
    }
  }

  useEffect(() => {
    setDidCopy(false);
  }, [draft?.id]);

  function showAiMessage(message: string) {
    setAiNotice(message);
    window.setTimeout(() => setAiNotice(null), 3600);
  }

  function getPromptVersionInfo(versionId: string) {
    if (versionId === "original") {
      return {
        label: "Original",
        meta: draft?.promptVariants?.length ? "Ursprungsfassung" : "Ausgangstext",
      };
    }

    const variants = draft?.promptVariants ?? [];
    const index = variants.findIndex((variant) => variant.id === versionId);
    const variant = index >= 0 ? variants[index] : undefined;

    return {
      label: `Variante ${index >= 0 ? index + 1 : ""}`.trim(),
      meta: variant?.source === "ai" ? "Optimiert" : "Manuell",
    };
  }

  function updatePromptVariant(id: string, patch: Partial<PromptVariant>) {
    if (!draft || draft.type !== "prompt") {
      return;
    }

    setDraft({
      ...draft,
      promptVariants: (draft.promptVariants ?? []).map((variant) => (variant.id === id ? { ...variant, ...patch } : variant)),
    });
  }

  function addManualPromptVariant() {
    if (!draft || draft.type !== "prompt") {
      return;
    }

    const variants = draft.promptVariants ?? [];
    if (variants.length >= 3) {
      showAiMessage("Maximal drei Varianten möglich");
      return;
    }

    const nextVariant = createPromptVariant({
      label: `Variante ${variants.length + 1}`,
      content: draft.content,
      note: "Manuelle Variante",
      source: "manual",
    });

    setDraft({ ...draft, promptVariants: [...variants, nextVariant] });
    setActivePromptVersionId(nextVariant.id);
    showNotice("Variante erstellt");
  }

  function deletePromptVariant(id: string) {
    if (!draft || draft.type !== "prompt") {
      return;
    }

    setDraft({
      ...draft,
      promptVariants: (draft.promptVariants ?? []).filter((variant) => variant.id !== id),
    });
    setActivePromptVersionId("original");
    showNotice("Variante gelöscht");
  }

  function promotePromptVariant(id: string) {
    if (!draft || draft.type !== "prompt") {
      return;
    }

    const variant = (draft.promptVariants ?? []).find((item) => item.id === id);
    if (!variant) {
      return;
    }

    setDraft({ ...draft, content: variant.content });
    setActivePromptVersionId("original");
    showNotice("Variante als Original übernommen");
  }

  async function handleAnalyzeMetadata() {
    if (!draft) {
      return;
    }

    await runAiMetadataRequest(draft.type);
  }

  async function handleCreateAiVariant() {
    await runPromptAiRequest("variant");
  }

  async function runAiMetadataRequest(entryType: EntryType) {
    if (!draft) {
      return;
    }

    if (!draft.content.trim()) {
      showAiMessage("Bitte zuerst Inhalt eingeben");
      return;
    }

    if (!window.snippetFlow?.ai?.analyzePrompt) {
      showAiMessage("KI-Abfrage ist in der Browser-Vorschau nicht aktiv. Bitte Desktop-App nutzen.");
      return;
    }

    setIsAiBusy(true);
    setAiNotice(null);

    try {
      const variants = draft.promptVariants ?? [];
      const result = await window.snippetFlow.ai.analyzePrompt({
        prompt: draft.content,
        existingTags: availableTags,
        existingCategories: categoryOptions.map((category) => category.name),
        variantCount: entryType === "prompt" && variants.length < 3 ? 1 : 0,
        entryType,
      });

      if (entryType === "prompt") {
        await applyAiPromptResult(result, "metadata");
        showAiMessage("KI-Vorschläge übernommen");
        return;
      }

      await applyAiGenericMetadataResult(result);
      showAiMessage("Metadaten ergänzt");
    } catch (error) {
      const message = error instanceof Error ? error.message : "KI-Abfrage fehlgeschlagen";
      showAiMessage(message);
    } finally {
      setIsAiBusy(false);
    }
  }

  async function runPromptAiRequest(mode: "metadata" | "variant") {
    if (!draft || draft.type !== "prompt") {
      return;
    }

    if (!draft.content.trim()) {
      showAiMessage("Bitte zuerst einen Prompt-Inhalt eingeben");
      return;
    }

    if (!window.snippetFlow?.ai?.analyzePrompt) {
      showAiMessage("KI-Abfrage ist in der Browser-Vorschau nicht aktiv. Bitte Desktop-App nutzen.");
      return;
    }

    const variants = draft.promptVariants ?? [];
    if (mode === "variant" && variants.length >= 3) {
      showAiMessage("Maximal drei Varianten möglich");
      return;
    }

    setIsAiBusy(true);
    setAiNotice(null);

    try {
      const result = await window.snippetFlow.ai.analyzePrompt({
        prompt: draft.content,
        existingTags: availableTags,
        existingCategories: categoryOptions.map((category) => category.name),
        variantCount: variants.length < 3 ? 1 : 0,
      });

      await applyAiPromptResult(result, mode);
      showAiMessage(mode === "metadata" ? "KI-Vorschläge übernommen" : "KI-Variante erstellt");
    } catch (error) {
      const message = error instanceof Error ? error.message : "KI-Abfrage fehlgeschlagen";
      showAiMessage(message);
    } finally {
      setIsAiBusy(false);
    }
  }

  async function applyAiPromptResult(result: AiPromptAnalysisResult, mode: "metadata" | "variant") {
    if (!draft || draft.type !== "prompt") {
      return;
    }

    const currentVariants = draft.promptVariants ?? [];
    const remainingSlots = Math.max(0, 3 - currentVariants.length);
    const nextVariants =
      remainingSlots > 0
        ? [
            ...currentVariants,
            ...result.variants.slice(0, remainingSlots).map((variant, index) =>
              createPromptVariant({
                label: variant.label || `Variante ${currentVariants.length + index + 1}`,
                content: variant.content,
                note: variant.note,
                source: "ai",
              }),
            ),
          ]
        : currentVariants;

    const categoryPatch = draft.categoryId ? {} : await resolveAiCategoryPatch(result.categoryName);

    if (mode === "metadata") {
      setDraft({
        ...draft,
        title: shouldAutofillTitle(draft.title) && result.title ? result.title : draft.title,
        description: !draft.description.trim() && result.description ? result.description : draft.description,
        tags: mergeTags(draft.tags, result.tags),
        ...categoryPatch,
        promptVariants: nextVariants,
      });
      return;
    }

    setDraft({ ...draft, promptVariants: nextVariants });
    const addedVariant = nextVariants.at(-1);
    if (addedVariant && addedVariant.id !== currentVariants.at(-1)?.id) {
      setActivePromptVersionId(addedVariant.id);
    }
  }

  async function applyAiGenericMetadataResult(result: AiPromptAnalysisResult) {
    if (!draft) {
      return;
    }

    const categoryPatch = draft.categoryId ? {} : await resolveAiCategoryPatch(result.categoryName);

    setDraft({
      ...draft,
      title: shouldAutofillTitle(draft.title) && result.title ? result.title : draft.title,
      description: !draft.description.trim() && result.description ? result.description : draft.description,
      tags: mergeTags(draft.tags, result.tags),
      ...categoryPatch,
    });
  }

  async function resolveAiCategoryPatch(categoryName: string | undefined) {
    const trimmed = categoryName?.trim();
    if (!trimmed) {
      return {};
    }

    const existing = categoryOptions.find((category) => category.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return { categoryId: existing.id, categoryName: existing.name };
    }

    const category = await saveCategory(trimmed);
    return { categoryId: category.id, categoryName: category.name };
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
    showNotice("Eintrag gelöscht");
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

  async function handleDeleteCategory() {
    if (!draft?.categoryId) {
      return;
    }

    const categoryName = draft.categoryName ?? "diese Kategorie";
    const confirmed = window.confirm(`"${categoryName}" löschen? Einträge mit dieser Kategorie bleiben erhalten und werden auf "Ohne Kategorie" gesetzt.`);
    if (!confirmed) {
      return;
    }

    const result = await deleteCategory(draft.categoryId);
    if (result.deleted) {
      setDraft({ ...draft, categoryId: undefined, categoryName: undefined });
      if (categoryFilter === result.id) {
        setCategoryFilter("all");
      }
      showNotice("Kategorie gelöscht");
    }
  }

  function handleAddTag() {
    if (!draft) {
      return;
    }

    const tag = tagInput.trim();
    if (!tag) {
      return;
    }

    setDraft({ ...draft, tags: [...new Set([...draft.tags, tag])] });
    setTagInput("");
  }

  function handleApplyTag(tag: string) {
    if (!draft) {
      return;
    }

    setDraft({ ...draft, tags: [...new Set([...draft.tags, tag])] });
    setTagInput("");
  }

  function handleRemoveTag(tag: string) {
    if (!draft) {
      return;
    }

    setDraft({ ...draft, tags: draft.tags.filter((item) => item !== tag) });
  }

  async function handleFieldValueChange(value: string) {
    if (!draft || !activeFieldKey) {
      return;
    }

    if (value === "__new__") {
      const label = window.prompt(`${activeFieldLabel}: neuen Wert hinzufügen`);
      if (!label?.trim()) {
        return;
      }

      const option = await createFieldOption(activeFieldKey, label.trim());
      setDraft({
        ...draft,
        fieldValue: option.label,
        language: draft.type === "code" ? option.value.toLowerCase() : draft.language,
      });
      showNotice("Auswahlwert hinzugefügt");
      return;
    }

    setDraft({
      ...draft,
      fieldValue: value || undefined,
      language: draft.type === "code" ? value.toLowerCase() : draft.language,
    });
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

  function handleTypeFilterChange(type: EntryType | "all") {
    setActiveType(type);
    if (!isDirty) {
      setSelectedId(null);
    }
  }

  function resetListFilters() {
    setQuery("");
    setCategoryFilter("all");
    setTagFilter("all");
    setSortMode("recent");
    setActiveType(defaultType);
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
    <div className="grid h-full min-h-0 grid-cols-[minmax(360px,0.82fr)_minmax(520px,1.18fr)] overflow-hidden">
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border bg-background">
        <header className="shrink-0 border-b border-border px-8 pb-5 pt-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">{viewTitle[activeView]}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{viewDescription[activeView]}</p>
            </div>
            <Button onClick={handleCreate} className="min-w-24 justify-center">
              <FilePlus2 className="h-4 w-4" />
              Neu
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_180px_160px_40px] gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Titel, Kategorie oder Tag suchen" className="pl-9" />
            </div>
            <SelectControl
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">Alle Kategorien</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectControl>
            <SelectControl
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
            >
              <option value="all">Alle Tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </SelectControl>
            <Button
              onClick={resetListFilters}
              variant="outline"
              size="icon"
              title="Filter zurücksetzen"
              disabled={!hasActiveListFilters}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => handleTypeFilterChange(filter.value)}
                  className={cn(
                    "h-8 rounded-md border border-transparent px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeType === filter.value && "border-border bg-muted text-foreground",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <SelectControl
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as "recent" | "title")}
              className="h-8 w-40"
            >
              <option value="recent">Zuletzt bearbeitet</option>
              <option value="title">Titel A-Z</option>
            </SelectControl>
          </div>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
          {activeView === "all" && (
            <div className="mb-4 grid gap-3">
              <div className="grid grid-cols-6 gap-2">
                {dashboardStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-border bg-card p-3 text-center shadow-sm"
                  >
                    <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-xl font-semibold">{stat.value}</p>
                  </div>
                ))}
                <div className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-border bg-card p-3 text-center shadow-sm">
                  <p className="text-[11px] text-muted-foreground">API</p>
                  <p className={cn("mt-1 text-sm font-semibold", apiStatus === "active" ? "text-emerald-600" : "text-muted-foreground")}>
                    {apiStatus === "active" ? "Aktiv" : "Fehlt"}
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <DashboardList
                  title="Zuletzt bearbeitet"
                  entries={recentEntries}
                  isOpen={isRecentOpen}
                  onToggle={() => setIsRecentOpen((current) => !current)}
                  onSelect={handleSelectEntry}
                />
                <DashboardList
                  title="Favoriten"
                  entries={favoriteEntries}
                  isOpen={isFavoritesOpen}
                  onToggle={() => setIsFavoritesOpen((current) => !current)}
                  onSelect={handleSelectEntry}
                />
              </div>
            </div>
          )}
          {isLoading && <p className="text-sm text-muted-foreground">Lade lokale Bibliothek...</p>}
          {!isLoading && visibleEntries.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              Keine Einträge gefunden.
            </div>
          )}
          <div className="grid min-w-0 gap-2">
            {renderedEntries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "group relative min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-card px-3 py-3 pr-11 text-left shadow-sm transition-colors hover:border-ring",
                  draft?.id === entry.id && "border-ring",
                )}
              >
                <button
                  type="button"
                  onClick={() => setDeleteCandidate(entry)}
                  title="Eintrag löschen"
                  aria-label="Eintrag löschen"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition-opacity hover:border-border hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => handleSelectEntry(entry.id)} className="block min-w-0 max-w-full text-left">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 max-w-full">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className="max-w-full truncate px-1.5 py-0 text-[11px]">{typeLabel[entry.type]}</Badge>
                      {entry.fieldValue && <Badge className="max-w-full truncate px-1.5 py-0 text-[11px]">{entry.fieldValue}</Badge>}
                      {entry.categoryName && <Badge className="max-w-full truncate px-1.5 py-0 text-[11px]">{entry.categoryName}</Badge>}
                      {entry.isFavorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                    </div>
                    <h2 className="mt-2 truncate text-[13px] font-semibold">{entry.title}</h2>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{entry.description || "Keine Beschreibung"}</p>
                  </div>
                  </div>
                  <div className="mt-2 flex min-w-0 max-w-full flex-wrap gap-1.5 overflow-hidden">
                    {entry.tags.map((tag) => (
                      <Badge key={tag} className="max-w-full truncate px-1.5 py-0 text-[11px]">{tag}</Badge>
                    ))}
                  </div>
                </button>
              </div>
            ))}
            {hasMoreEntries && (
              <Button
                onClick={() => setEntryRenderLimit((current) => current + entryRenderBatchSize)}
                variant="outline"
                className="justify-center"
              >
                Weitere Einträge anzeigen ({visibleEntries.length - renderedEntries.length})
              </Button>
            )}
          </div>
        </div>
      </section>

      {draft && (
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-card">
          <header className="shrink-0 px-8 pb-0 pt-8">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex min-h-5 items-center gap-2">
                  {isDirty ? <Badge className="border-amber-200 bg-amber-50 text-amber-700">Ungespeichert</Badge> : <Badge>Synchron</Badge>}
                  {notice && <span className="text-xs text-muted-foreground">{notice}</span>}
                </div>

                <div className="mt-3">
                  <h2 className="text-2xl font-semibold tracking-normal">{editorTitle[draft.type]}</h2>
                  <p className="mt-1 whitespace-nowrap text-sm text-muted-foreground">{editorDescription[draft.type]}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <HeaderIconButton
                  label={didSave && !isDirty ? "Gespeichert" : "Speichern"}
                  onClick={handleSave}
                  className={cn(
                    isDirty && "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800",
                    didSave && !isDirty && "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700",
                  )}
                >
                  {didSave && !isDirty ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                </HeaderIconButton>
                <HeaderIconButton label="Änderungen verwerfen" onClick={handleDiscard} disabled={!isDirty}>
                  <RotateCcw className="h-4 w-4" />
                </HeaderIconButton>
                <HeaderIconButton
                  label={didCopy ? "Kopiert" : "Kopieren"}
                  onClick={handleCopy}
                  className={cn(didCopy && "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700")}
                >
                  {didCopy ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </HeaderIconButton>
                <HeaderIconButton label="Duplizieren" onClick={handleDuplicate}>
                  <FilePlus2 className="h-4 w-4" />
                </HeaderIconButton>
                <HeaderIconButton label="Favorit" onClick={handleFavorite}>
                  <Star className={cn("h-4 w-4", draft.isFavorite && "fill-amber-400 text-amber-500")} />
                </HeaderIconButton>
                <HeaderIconButton label="Löschen" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </HeaderIconButton>
              </div>
            </div>

            <CollapsiblePanel
              title="Metadaten"
              description="Titel, Beschreibung, Kategorie, Tags und KI-Hilfen."
              isOpen={isMetadataOpen}
              onToggle={() => setIsMetadataOpen((current) => !current)}
              className="mt-6"
            >
              <div className="grid gap-4">
                <EntryWorkflowSteps
                  entryType={draft.type}
                  hasContent={draft.content.trim().length > 0}
                  hasMetadata={Boolean(draft.description.trim() || draft.tags.length > 0 || draft.categoryName || draft.fieldValue)}
                  isSaved={!isDirty}
                />

                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Titel
                  <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="h-11 text-xl font-semibold" />
                </label>

                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Beschreibung
                  <textarea
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    placeholder="Beschreibung"
                    className="min-h-14 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-xs leading-5 text-muted-foreground">
                    {draft.type === "prompt"
                      ? "Füllt leere Titel-, Beschreibungs- und Kategoriefelder per KI. Bestehende manuelle Inhalte bleiben erhalten."
                      : "Füllt Titel, Beschreibung, Kategorie und Tags per KI aus. Bestehende Inhalte bleiben erhalten."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={() => void handleAnalyzeMetadata()} variant="brand" disabled={isAiBusy}>
                      {isAiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Titel & Metadaten ausfüllen
                    </Button>
                    {aiNotice && <span className="text-xs text-muted-foreground">{aiNotice}</span>}
                  </div>
                </div>

                <div className={cn("grid gap-3", shouldShowPreview ? "grid-cols-3" : showAiSystemField ? "grid-cols-2" : "grid-cols-1")}>
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Kategorie
                    <SelectControl
                      value={draft.categoryId ?? ""}
                      onChange={(event) => {
                        const category = categoryOptions.find((item) => item.id === event.target.value);
                        setDraft({ ...draft, categoryId: category?.id, categoryName: category?.name });
                      }}
                      className="h-9"
                    >
                      <option value="">Ohne Kategorie</option>
                      {categoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </SelectControl>
                  </label>
                  {showAiSystemField && (
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      {activeFieldLabel}
                      <SelectControl
                        value={draft.fieldValue ?? ""}
                        onChange={(event) => void handleFieldValueChange(event.target.value)}
                        className="h-9"
                      >
                        <option value="">Nicht gesetzt</option>
                      {activeFieldOptions.map((option) => (
                        <option key={option.id} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectControl>
                  </label>
                  )}
                  {shouldShowPreview && (
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      {previewLabel}
                      <SelectControl
                        value={draft.previewKind ?? ""}
                        onChange={(event) =>
                          setDraft({ ...draft, previewKind: (event.target.value || undefined) as PreviewKind | undefined })
                        }
                        className="h-9"
                      >
                        <option value="">Keine Preview</option>
                        {previewOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectControl>
                    </label>
                  )}
                </div>

                <div className="grid gap-3 rounded-lg border border-border bg-background p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_168px_184px_40px_40px] gap-3">
                  <div className="relative">
                    <Input
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (tagSuggestions.length > 0) {
                            handleApplyTag(tagSuggestions[0]);
                            return;
                          }
                          handleAddTag();
                        }
                      }}
                      placeholder="Tag eingeben"
                    />
                    {tagInput.trim().length > 0 && tagSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-11 z-20 rounded-md border border-border bg-card p-2 shadow-soft">
                        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Bestehende Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {tagSuggestions.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                handleApplyTag(tag);
                              }}
                              className="rounded-sm border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
	                  </div>
                  <Button
                    type="button"
                    onClick={() => setIsTagCloudOpen((current) => !current)}
                    variant="outline"
                    className="justify-between px-3 whitespace-nowrap"
                    title="Tag-Cloud"
                    aria-label="Tag-Cloud"
                  >
                    <span>Tag-Cloud</span>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                      {tagCloudOptions.length}
                      {isTagCloudOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </Button>
	                  <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Neue Kategorie" />
                  <Button onClick={handleAddCategory} variant="outline" size="icon" title="Kategorie hinzufügen" aria-label="Kategorie hinzufügen">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleDeleteCategory}
                    variant="outline"
                    size="icon"
                    title="Kategorie löschen"
                    aria-label="Kategorie löschen"
                    disabled={!draft.categoryId}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex min-h-7 flex-wrap gap-2">
                  {draft.tags.filter(Boolean).map((tag) => (
                    <Badge key={tag} className="gap-1 bg-card text-foreground">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`${tag} entfernen`}
                        className="rounded-sm text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {draft.categoryName && <Badge>{draft.categoryName}</Badge>}
                </div>

                {isTagCloudOpen && (
                  <div className="rounded-md border border-border bg-card px-3 py-2">
                    {tagCloudOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Keine weiteren bestehenden Tags.</p>
                    ) : (
                      <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                        {tagCloudOptions.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleApplyTag(tag)}
                            className="rounded-sm border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
            </CollapsiblePanel>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pb-6 pt-5">
            <CollapsiblePanel
              title="Editor"
              description="Inhalt schreiben, Varianten bearbeiten und kopieren."
              isOpen={isEditorOpen}
              onToggle={() => setIsEditorOpen((current) => !current)}
              className="min-h-0"
              bodyClassName="min-h-0"
            >
            <div
              className={cn(
                "grid min-h-0 gap-1",
                draft.type === "prompt" && activePromptVariant
                  ? "grid-rows-[auto_auto_auto_minmax(0,1fr)]"
                  : draft.type === "prompt"
                    ? "grid-rows-[auto_auto_minmax(0,1fr)]"
                    : "grid-rows-[auto_minmax(0,1fr)]",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {getPromptVersionInfo(activePromptVersionId).label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{getPromptVersionInfo(activePromptVersionId).meta}</p>
                  {activePromptVariant?.note && <p className="mt-0.5 text-xs text-muted-foreground">{activePromptVariant.note}</p>}
                </div>
                {draft.type === "prompt" && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/80 p-2 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setActivePromptVersionId("original")}
                      className={cn(
                        "h-8 rounded-md border border-border bg-card px-3 text-xs font-medium shadow-sm hover:bg-muted",
                        activePromptVersionId === "original" && "border-ring bg-muted text-foreground",
                      )}
                    >
                      <span className="inline-flex items-center gap-1 leading-tight">
                        <span>Original</span>
                        <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] font-normal text-muted-foreground">
                          {getPromptVersionInfo("original").meta}
                        </span>
                      </span>
                    </button>
                    {promptVariants.map((variant, index) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setActivePromptVersionId(variant.id)}
                        className={cn(
                          "h-8 rounded-md border border-border bg-card px-3 text-xs font-medium shadow-sm hover:bg-muted",
                          activePromptVersionId === variant.id && "border-ring bg-muted text-foreground",
                        )}
                      >
                        <span className="inline-flex items-center gap-1 leading-tight">
                          <span>{`Variante ${index + 1}`}</span>
                          <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] font-normal text-muted-foreground">
                            {variant.source === "ai" ? "Optimiert" : "Manuell"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {draft.type === "prompt" && (
                <PromptVariantWorkflowSteps
                  variantCount={promptVariants.length}
                  isBusy={isAiBusy}
                  onCreateAiVariant={() => void handleCreateAiVariant()}
                  onAddManualVariant={addManualPromptVariant}
                />
              )}
              {activePromptVariant && (
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_140px_auto_auto] gap-2">
                  <Input
                    value={activePromptVariant.note ?? ""}
                    onChange={(event) => updatePromptVariant(activePromptVariant.id, { note: event.target.value })}
                    placeholder="Notiz zur Variante"
                    className="h-9"
                  />
                  <SelectControl
                    value={activePromptVariant.rating ?? ""}
                    onChange={(event) =>
                      updatePromptVariant(activePromptVariant.id, {
                        rating: (event.target.value || undefined) as PromptVariant["rating"],
                      })
                    }
                    className="h-9"
                  >
                    <option value="">Bewertung</option>
                    <option value="good">Gut</option>
                    <option value="medium">Mittel</option>
                    <option value="weak">Schwach</option>
                  </SelectControl>
                  <Button type="button" onClick={() => promotePromptVariant(activePromptVariant.id)} variant="success" className="h-9">
                    Original übernehmen
                  </Button>
                  <Button
                    type="button"
                    onClick={() => deletePromptVariant(activePromptVariant.id)}
                    variant="rose"
                    size="icon"
                    title="Variante löschen"
                    aria-label="Variante löschen"
                    className="h-9 w-9"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {contentEditorEntry && (
                <EntryContentEditor
                  entry={contentEditorEntry}
                  onChange={(content) =>
                    activePromptVariant ? updatePromptVariant(activePromptVariant.id, { content }) : setDraft({ ...draft, content })
                  }
                  onCopy={() => void handleCopy()}
                />
              )}
            </div>
            </CollapsiblePanel>

            {shouldShowPreview && (
              <CollapsiblePanel
                title={previewLabel}
                description={draft.type === "code" ? "Isolierte Vorschau für HTML, CSS, JavaScript oder Markdown." : "Markdown-Vorschau für strukturierte Inhalte."}
                isOpen={isPreviewOpen}
                onToggle={() => setIsPreviewOpen((current) => !current)}
                headerAside={preview ? <Badge>{preview.kind.toUpperCase()}</Badge> : <Badge>Inaktiv</Badge>}
                bodyClassName="p-0"
              >
              <div className="h-56 min-h-40 max-h-[65vh] resize-y overflow-hidden bg-background">
                <iframe
                  title={previewLabel}
                  sandbox=""
                  srcDoc={previewHtml}
                  className="h-full w-full bg-white"
                />
              </div>
              </CollapsiblePanel>
            )}
          </div>
        </section>
      )}
      {pendingSelectionId && (
        <ConfirmDialog
          title="Ungespeicherte Änderungen"
          description="Wenn du fortfährst, werden die aktuellen Änderungen im Editor verworfen."
          confirmLabel="Verwerfen"
          onCancel={() => setPendingSelectionId(null)}
          onConfirm={confirmPendingSelection}
        />
      )}
      {deleteCandidate && (
        <ConfirmDialog
          title="Eintrag löschen"
          description={`"${deleteCandidate.title}" wird dauerhaft aus der lokalen Bibliothek entfernt.`}
          confirmLabel="Löschen"
          danger
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function EntryContentEditor({ entry, onChange, onCopy }: { entry: LibraryEntry; onChange: (content: string) => void; onCopy: () => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const undoStackRef = useRef<string[]>([]);
  const [isTextLarge, setIsTextLarge] = useState(false);
  const [didCopy, setDidCopy] = useState(false);

  useEffect(() => {
    undoStackRef.current = [];
    setIsTextLarge(false);
    setDidCopy(false);
  }, [entry.id]);

  async function handleEditorCopy() {
    await onCopy();
    setDidCopy(true);
    window.setTimeout(() => setDidCopy(false), 1500);
  }

  if (entry.type === "code") {
    return (
      <div className="relative h-[360px] min-h-56 max-h-[70vh] resize-y overflow-hidden rounded-lg border border-border bg-background">
        <button
          type="button"
          onClick={() => void handleEditorCopy()}
          title={didCopy ? "Kopiert" : "Inhalt kopieren"}
          aria-label={didCopy ? "Kopiert" : "Inhalt kopieren"}
          className={cn(
            "absolute right-3 top-3 z-10 flex h-12 w-16 flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground",
            didCopy && "border-emerald-500 bg-emerald-50 text-emerald-700",
          )}
        >
          {didCopy ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="text-[9px] font-medium leading-none">{didCopy ? "Kopiert" : "Kopieren"}</span>
        </button>
        <Editor
          height="100%"
          value={entry.content}
          language={entry.language || "typescript"}
          theme="vs-light"
          onChange={(value) => onChange(value ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, monospace",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            padding: { top: 18, bottom: 18 },
            smoothScrolling: true,
          }}
        />
      </div>
    );
  }

  const editorCopy: Record<Exclude<EntryType, "code">, { placeholder: string; className: string }> = {
    prompt: {
      placeholder: "Prompts-Inhalt eingeben...",
      className: "text-[13px] leading-6",
    },
    workflow: {
      placeholder: "Beschreibe die Schritte dieses Workflows...",
      className: "text-[13px] leading-6",
    },
    note: {
      placeholder: "Schreibe deine Markdown-Notiz...",
      className: "text-[13px] leading-6",
    },
  };
  const copy = editorCopy[entry.type];
  const pushUndoState = () => {
    const last = undoStackRef.current.at(-1);
    if (last !== entry.content) {
      undoStackRef.current = [...undoStackRef.current.slice(-29), entry.content];
    }
  };
  const updateContent = (content: string) => {
    pushUndoState();
    onChange(content);
  };
  const undoLastContentChange = () => {
    const previous = undoStackRef.current.at(-1);
    if (previous === undefined) {
      return;
    }

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    onChange(previous);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };
  const applyMarkdown = (kind: "bold" | "bullet" | "numbered") => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const fallback = kind === "bold" ? "Text" : "Punkt";
    const text = selected || fallback;
    const replacement =
      kind === "bold"
        ? `**${text}**`
        : text
            .split("\n")
            .map((line, index) => `${kind === "bullet" ? "-" : `${index + 1}.`} ${line || fallback}`)
            .join("\n");
    const nextContent = `${value.slice(0, selectionStart)}${replacement}${value.slice(selectionEnd)}`;
    const nextCursor = selectionStart + replacement.length;

    updateContent(nextContent);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div className="relative h-[360px] min-h-56 max-h-[70vh] resize-y overflow-hidden rounded-lg border border-border bg-background">
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-start gap-1">
        <HeaderIconButton label="Rückgängig" onClick={undoLastContentChange} className="h-10 w-10">
          <Undo2 className="h-5 w-5" />
        </HeaderIconButton>
        <HeaderIconButton label="Fett als Markdown einfügen" onClick={() => applyMarkdown("bold")} className="h-10 w-10">
          <Bold className="h-5 w-5" />
        </HeaderIconButton>
        <HeaderIconButton label="Aufzählung einfügen" onClick={() => applyMarkdown("bullet")} className="h-10 w-10">
          <List className="h-5 w-5" />
        </HeaderIconButton>
        <HeaderIconButton label="Nummerierte Liste einfügen" onClick={() => applyMarkdown("numbered")} className="h-10 w-10">
          <ListOrdered className="h-5 w-5" />
        </HeaderIconButton>
        <HeaderIconButton
          label={isTextLarge ? "Schrift normal anzeigen" : "Schrift vergrößern"}
          onClick={() => setIsTextLarge((current) => !current)}
          className={cn(isTextLarge && "border-ring text-foreground", "h-10 w-10")}
        >
          <Type className="h-5 w-5" />
        </HeaderIconButton>
      </div>
      <HeaderIconButton
        label={didCopy ? "Kopiert" : "Inhalt kopieren"}
        onClick={() => void handleEditorCopy()}
        className={cn("absolute right-3 top-3 z-10 h-10 w-10", didCopy && "border-emerald-500 bg-emerald-50 text-emerald-700")}
      >
        {didCopy ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
      </HeaderIconButton>
      <textarea
        ref={textareaRef}
        value={entry.content}
        onChange={(event) => updateContent(event.target.value)}
        placeholder={copy.placeholder}
        spellCheck
        className={cn(
          "h-full w-full resize-none bg-transparent px-6 pb-5 pt-14 pr-14 text-foreground outline-none placeholder:text-muted-foreground",
          copy.className,
          isTextLarge && "text-[15px] leading-7",
        )}
      />
    </div>
  );
}

function SelectControl({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-border bg-background px-3 pr-9 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/15",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function HeaderIconButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative">
      <Button
        onClick={onClick}
        variant="outline"
        disabled={disabled}
        aria-label={label}
        className={cn("h-12 w-12", className)}
      >
        {children}
      </Button>
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover:block group-focus-within:block">
        {label}
      </span>
    </div>
  );
}

function CollapsiblePanel({
  title,
  description,
  isOpen,
  onToggle,
  headerAside,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  description?: string;
  isOpen: boolean;
  onToggle: () => void;
  headerAside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-border bg-background shadow-sm", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-sm font-semibold text-foreground">{title}</span>
          {description && <span className="truncate text-xs text-muted-foreground">{description}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {headerAside}
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>
      {isOpen && <div className={cn("border-t border-border p-4", bodyClassName)}>{children}</div>}
    </section>
  );
}

function DashboardList({
  title,
  entries,
  isOpen,
  onToggle,
  onSelect,
}: {
  title: string;
  entries: LibraryEntry[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-muted">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          {entries.length}
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {isOpen && (
        <div className="mt-2 grid gap-1">
          {entries.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Noch keine Einträge.</p>}
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry.id)}
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              <p className="truncate text-xs font-semibold">{entry.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{typeLabel[entry.type]}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryWorkflowSteps({
  entryType,
  hasContent,
  hasMetadata,
  isSaved,
}: {
  entryType: EntryType;
  hasContent: boolean;
  hasMetadata: boolean;
  isSaved: boolean;
}) {
  const contentLabels: Record<EntryType, string> = {
    prompt: "Prompt eingeben",
    code: "Code eingeben",
    workflow: "Workflow eingeben",
    note: "Notiz eingeben",
  };
  const metadataStep = { label: "Titel & Metadaten per KI ausfüllen", hint: "Leere Felder werden ergänzt" };
  const steps = [
    { label: contentLabels[entryType], hint: "Inhalt erfassen", done: hasContent },
    { ...metadataStep, done: hasMetadata },
    { label: "Speichern", hint: "Eintrag sichern", done: isSaved },
  ];

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="grid grid-cols-3 divide-x divide-border/70">
        {steps.map((step, index) => (
          <div key={step.label} className="flex min-w-0 items-center gap-2 px-3 first:pl-0 last:pr-0">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                step.done ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-400 bg-background text-slate-700",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block truncate text-xs font-medium leading-4", step.done ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">{step.hint}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptVariantWorkflowSteps({
  variantCount,
  isBusy,
  onCreateAiVariant,
  onAddManualVariant,
}: {
  variantCount: number;
  isBusy: boolean;
  onCreateAiVariant: () => void;
  onAddManualVariant: () => void;
}) {
  const steps = [
    { label: "Variante erstellen", hint: "Button: KI-Variante", done: variantCount > 0 },
    { label: "Variante vergleichen", hint: "Original oder Variante wählen", done: variantCount > 0 },
    { label: "Variante übernehmen", hint: "Original übernehmen", done: false },
  ];

  return (
    <div className="rounded-xl border border-border bg-gradient-to-r from-slate-50 via-white to-cyan-50 px-4 py-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Varianten-Workflow</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onCreateAiVariant} variant="brand" disabled={isBusy || variantCount >= 3} className="h-8">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            KI-Variante
          </Button>
          <Button type="button" onClick={onAddManualVariant} variant="amber" disabled={variantCount >= 3} className="h-8">
            <Plus className="h-4 w-4" />
            Variante hinzufügen
          </Button>
          <span className="text-[11px] text-muted-foreground">{variantCount}/3 Varianten</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {steps.map((step, index) => (
          <div key={step.label} className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border border-border/70 bg-card px-2 py-2 text-center shadow-sm">
            <span className="flex min-w-0 items-center justify-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  step.done ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-400 bg-slate-100 text-slate-700",
                )}
              >
                {index + 1}
              </span>
              <span className={cn("block text-xs font-medium leading-4", step.done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] text-muted-foreground">{step.hint}</span>
            </span>
          </div>
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

function createPromptVariant({
  label,
  content,
  note,
  source,
}: {
  label: string;
  content: string;
  note?: string;
  source: PromptVariant["source"];
}): PromptVariant {
  return {
    id: crypto.randomUUID(),
    label,
    content,
    note,
    source,
    createdAt: new Date().toISOString(),
  };
}

function mergeTags(existingTags: string[], suggestedTags: string[]) {
  const normalized = [...existingTags, ...suggestedTags]
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set(normalized)].slice(0, 12);
}

function shouldAutofillTitle(title: string) {
  const normalizedTitle = title.trim().toLowerCase();
  return !normalizedTitle || normalizedTitle === "neuer eintrag" || normalizedTitle === "unbenannter eintrag";
}

async function copyTextToClipboard(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = content;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  }
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
    promptVariants: (entry.promptVariants ?? []).map((variant) => ({
      ...variant,
      label: variant.label.trim(),
      content: variant.content,
      note: variant.note?.trim() || undefined,
      rating: variant.rating || undefined,
    })),
  };
}

function createDashboardStats(entries: LibraryEntry[]) {
  return [
    { label: "Prompts", value: entries.filter((entry) => entry.type === "prompt").length },
    { label: "Code", value: entries.filter((entry) => entry.type === "code").length },
    { label: "Workflows", value: entries.filter((entry) => entry.type === "workflow").length },
    { label: "Notizen", value: entries.filter((entry) => entry.type === "note").length },
    { label: "Favoriten", value: entries.filter((entry) => entry.isFavorite).length },
  ];
}

function getFieldKeyForType(type: EntryType): FieldOptionKey {
  const map: Record<EntryType, FieldOptionKey> = {
    prompt: "prompt",
    code: "code",
    workflow: "analysis",
    note: "text",
  };

  return map[type];
}

function getFieldLabelForType(type: EntryType) {
  const map: Record<EntryType, string> = {
    prompt: "KI-System",
    code: "Code",
    workflow: "Analyse",
    note: "Text",
  };

  return map[type];
}

function getPreviewOptionsForType(type: EntryType): Array<{ value: PreviewKind; label: string }> {
  if (type === "code") {
    return [
      { value: "html", label: "HTML" },
      { value: "css", label: "CSS" },
      { value: "javascript", label: "JavaScript" },
      { value: "markdown", label: "Markdown" },
    ];
  }

  if (type === "workflow" || type === "note") {
    return [{ value: "markdown", label: "Markdown" }];
  }

  return [];
}

function getDefaultFieldValue(type: EntryType) {
  const map: Record<EntryType, string> = {
    prompt: "Allgemein",
    code: "TypeScript",
    workflow: "Projekt",
    note: "Allgemein",
  };

  return map[type];
}
