import { useCallback, useEffect, useMemo, useState } from "react";
import type { EntryType, LibraryCategory, LibraryEntry, LibraryEntryInput } from "@/types";
import { demoEntries } from "@/db/demoData";

export function useLibraryEntries(activeType: EntryType | "all", query: string) {
  const [entries, setEntries] = useState<LibraryEntry[]>(demoEntries);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    setIsLoading(true);
    return Promise.all([
      window.snippetFlow?.library.list() ?? Promise.resolve(demoEntries),
      window.snippetFlow?.categories.list() ?? Promise.resolve([]),
    ])
      .then(([storedEntries, storedCategories]) => {
        if (storedEntries.length > 0) {
          setEntries(storedEntries);
        }
        setCategories(storedCategories);
      })
      .catch(() => {
        setEntries(demoEntries);
        setCategories([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveEntry = useCallback(async (entry: LibraryEntryInput) => {
    if (!window.snippetFlow) {
      const localEntry: LibraryEntry = { ...entry, id: entry.id ?? crypto.randomUUID() };
      setEntries((current) => [localEntry, ...current.filter((item) => item.id !== localEntry.id)]);
      return localEntry;
    }

    const saved = await window.snippetFlow.library.save(entry);
    setEntries((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    return saved;
  }, []);

  const duplicateEntry = useCallback(async (id: string) => {
    const duplicated = await window.snippetFlow?.library.duplicate(id);

    if (duplicated) {
      setEntries((current) => [duplicated, ...current]);
    }

    return duplicated ?? null;
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    const updated = await window.snippetFlow?.library.toggleFavorite(id);

    if (updated) {
      setEntries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    }

    return updated ?? null;
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    await window.snippetFlow?.library.delete(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const saveCategory = useCallback(async (name: string) => {
    const saved = await window.snippetFlow?.categories.save(name);

    if (saved) {
      setCategories((current) => [saved, ...current.filter((category) => category.id !== saved.id)]);
      return saved;
    }

    const localCategory = { id: name.toLowerCase(), name };
    setCategories((current) => [localCategory, ...current]);
    return localCategory;
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesType = activeType === "all" || entry.type === activeType;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [entry.title, entry.description, entry.content, entry.language, ...entry.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesType && matchesQuery;
    });
  }, [activeType, entries, query]);

  return {
    categories,
    entries,
    filteredEntries,
    isLoading,
    saveEntry,
    duplicateEntry,
    toggleFavorite,
    deleteEntry,
    saveCategory,
    refresh,
  };
}
