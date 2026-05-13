import { useCallback, useEffect, useMemo, useState } from "react";
import type { EntryType, FieldOption, LibraryCategory, LibraryEntry, LibraryEntryInput } from "@/types";
import { demoCategories, demoEntries, demoFieldOptions } from "@/db/demoData";

const localStorageKeys = {
  entries: "smart-snippetflow:entries",
  categories: "smart-snippetflow:categories",
  fieldOptions: "smart-snippetflow:field-options",
};

export function useLibraryEntries(activeType: EntryType | "all", query: string) {
  const [entries, setEntries] = useState<LibraryEntry[]>(() => readLocalList(localStorageKeys.entries, demoEntries));
  const [categories, setCategories] = useState<LibraryCategory[]>(() => readLocalList(localStorageKeys.categories, demoCategories));
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>(() => readLocalList(localStorageKeys.fieldOptions, demoFieldOptions));
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    setIsLoading(true);

    if (!window.snippetFlow) {
      setEntries(readLocalList(localStorageKeys.entries, demoEntries));
      setCategories(readLocalList(localStorageKeys.categories, demoCategories));
      setFieldOptions(readLocalList(localStorageKeys.fieldOptions, demoFieldOptions));
      setIsLoading(false);
      return Promise.resolve();
    }

    return Promise.all([
      window.snippetFlow.library.list(),
      window.snippetFlow.categories.list(),
      window.snippetFlow.fieldOptions.list(),
    ])
      .then(([storedEntries, storedCategories, storedFieldOptions]) => {
        if (storedEntries.length > 0) {
          setEntries(storedEntries);
        }
        setCategories(storedCategories.length > 0 ? storedCategories : demoCategories);
        setFieldOptions(storedFieldOptions.length > 0 ? storedFieldOptions : demoFieldOptions);
      })
      .catch(() => {
        setEntries(demoEntries);
        setCategories(demoCategories);
        setFieldOptions(demoFieldOptions);
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
      setEntries((current) => {
        const next = [localEntry, ...current.filter((item) => item.id !== localEntry.id)];
        writeLocalList(localStorageKeys.entries, next);
        return next;
      });
      return localEntry;
    }

    const saved = await window.snippetFlow.library.save(entry);
    setEntries((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    return saved;
  }, []);

  const duplicateEntry = useCallback(async (id: string) => {
    if (!window.snippetFlow) {
      const source = entries.find((entry) => entry.id === id);
      if (!source) {
        return null;
      }

      const duplicated: LibraryEntry = {
        ...source,
        id: crypto.randomUUID(),
        title: `${source.title} Kopie`,
        isFavorite: false,
      };
      setEntries((current) => {
        const next = [duplicated, ...current];
        writeLocalList(localStorageKeys.entries, next);
        return next;
      });
      return duplicated;
    }

    const duplicated = await window.snippetFlow?.library.duplicate(id);

    if (duplicated) {
      setEntries((current) => [duplicated, ...current]);
    }

    return duplicated ?? null;
  }, [entries]);

  const toggleFavorite = useCallback(async (id: string) => {
    if (!window.snippetFlow) {
      const target = entries.find((entry) => entry.id === id);
      if (!target) {
        return null;
      }

      const updated = { ...target, isFavorite: !target.isFavorite };
      setEntries((current) => {
        const next = current.map((entry) => (entry.id === id ? updated : entry));
        writeLocalList(localStorageKeys.entries, next);
        return next;
      });
      return updated;
    }

    const updated = await window.snippetFlow?.library.toggleFavorite(id);

    if (updated) {
      setEntries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    }

    return updated ?? null;
  }, [entries]);

  const deleteEntry = useCallback(async (id: string) => {
    await window.snippetFlow?.library.delete(id);
    setEntries((current) => {
      const next = current.filter((entry) => entry.id !== id);
      if (!window.snippetFlow) {
        writeLocalList(localStorageKeys.entries, next);
      }
      return next;
    });
  }, []);

  const saveCategory = useCallback(async (name: string) => {
    const saved = await window.snippetFlow?.categories.save(name);

    if (saved) {
      setCategories((current) => [saved, ...current.filter((category) => category.id !== saved.id)]);
      return saved;
    }

    const localCategory = { id: slugify(name), name };
    setCategories((current) => {
      const next = [localCategory, ...current.filter((category) => category.id !== localCategory.id)];
      writeLocalList(localStorageKeys.categories, next);
      return next;
    });
    return localCategory;
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    const result = await window.snippetFlow?.categories.delete(id);

    if (!window.snippetFlow || result?.deleted) {
      setCategories((current) => {
        const next = current.filter((category) => category.id !== id);
        if (!window.snippetFlow) {
          writeLocalList(localStorageKeys.categories, next);
        }
        return next;
      });
      setEntries((current) => {
        const next = current.map((entry) =>
          entry.categoryId === id ? { ...entry, categoryId: undefined, categoryName: undefined } : entry,
        );
        if (!window.snippetFlow) {
          writeLocalList(localStorageKeys.entries, next);
        }
        return next;
      });
    }

    return result ?? { id, deleted: true };
  }, []);

  const createFieldOption = useCallback(async (fieldKey: FieldOption["fieldKey"], label: string) => {
    const saved = await window.snippetFlow?.fieldOptions.create(fieldKey, label);

    if (saved) {
      setFieldOptions((current) => [...current.filter((option) => option.id !== saved.id), saved]);
      return saved;
    }

    const localOption: FieldOption = {
      id: crypto.randomUUID(),
      fieldKey,
      value: label,
      label,
      isSystem: false,
      sortOrder: fieldOptions.length + 1,
    };
    setFieldOptions((current) => {
      const next = [...current, localOption];
      writeLocalList(localStorageKeys.fieldOptions, next);
      return next;
    });
    return localOption;
  }, [fieldOptions.length]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesType = activeType === "all" || entry.type === activeType;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [entry.title, entry.description, entry.content, entry.language, entry.fieldValue, entry.categoryName, ...entry.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesType && matchesQuery;
    });
  }, [activeType, entries, query]);

  return {
    categories,
    fieldOptions,
    entries,
    filteredEntries,
    isLoading,
    saveEntry,
    duplicateEntry,
    toggleFavorite,
    deleteEntry,
    saveCategory,
    deleteCategory,
    createFieldOption,
    refresh,
  };
}

function readLocalList<T>(key: string, fallback: T[]) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalList<T>(key: string, value: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local preview persistence is best-effort; Electron persists through SQLite.
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, "-")
    .replace(/^-|-$/g, "");
}
