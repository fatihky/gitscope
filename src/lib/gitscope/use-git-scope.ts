import { useCallback, useEffect, useMemo, useState } from "react";
import { DAY, DEFAULT_EXPORT_FORMAT, iso, previousWorkday } from "./format";
import type { Commit, DateRange, RepoConfig, RepoRuntime, ScopeMode, SortMode, TabKey, Theme } from "./types";

const THEME_STORAGE_KEY = "gitscope:theme";
const REPO_OPEN_STORAGE_KEY = "gitscope:repoOpen";
const EXPORT_FORMAT_STORAGE_KEY = "gitscope:exportFormat";
const FILTERS_STORAGE_KEY = "gitscope:filters";

type StoredFilters = {
  preset: string;
  from: string | null;
  to: string | null;
  q: string;
  author: string;
  merges: boolean;
  sort: SortMode;
};

function defaultFilters(defaultRangePreset: string): StoredFilters {
  return { preset: defaultRangePreset, from: null, to: null, q: "", author: "", merges: true, sort: "new" };
}

function initialFilters(defaultRangePreset: string): StoredFilters {
  const defaults = defaultFilters(defaultRangePreset);
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {
    // ignore (private browsing, disabled storage, etc.)
  }
  return defaults;
}

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // ignore (private browsing, disabled storage, etc.)
  }
  return "dark";
}

function initialOpenState(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(REPO_OPEN_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore (private browsing, disabled storage, etc.)
  }
  return {};
}

function initialExportFormat(): string {
  try {
    const stored = localStorage.getItem(EXPORT_FORMAT_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // ignore (private browsing, disabled storage, etc.)
  }
  return DEFAULT_EXPORT_FORMAT;
}

function initialRepoRuntime(repoConfigs: RepoConfig[], openState: Record<string, boolean>): Record<string, RepoRuntime> {
  const out: Record<string, RepoRuntime> = {};
  repoConfigs.forEach((r) => {
    out[r.id] = {
      open: openState[r.id] ?? false,
      on: true,
      bon: new Set(r.branches),
      range: null,
    };
  });
  return out;
}

function presetRange(preset: string, custom: DateRange, now: number): DateRange {
  if (preset === "all") return { from: null, to: null };
  if (preset === "custom") return custom;
  if (preset === "prevworkday") {
    const day = previousWorkday(now);
    return { from: day, to: day };
  }
  const to = now;
  const from = now - Number(preset) * DAY;
  return { from: iso(from), to: iso(to) };
}

const toMs = (d: string | null, end?: boolean): number | null =>
  d ? new Date(d + (end ? "T23:59:59" : "T00:00:00")).getTime() : null;

export type GitScopeInput = {
  repoConfigs: RepoConfig[];
  commits: Commit[];
  defaultRangePreset?: string;
};

export function useGitScope({ repoConfigs, commits, defaultRangePreset = "30" }: GitScopeInput) {
  const [now] = useState(() => Date.now());
  const [repos, setRepos] = useState<Record<string, RepoRuntime>>(() =>
    initialRepoRuntime(repoConfigs, initialOpenState()),
  );
  const [scope, setScope] = useState<ScopeMode>("global");
  const [filters, setFilters] = useState<StoredFilters>(() => initialFilters(defaultRangePreset));
  const { preset, from: customFrom, to: customTo, q, author, merges, sort } = filters;
  const [sel, setSel] = useState<number | null>(null);
  const [limit, setLimit] = useState(250);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [exportFormat, setExportFormat] = useState<string>(initialExportFormat);
  const [showDetail, setShowDetail] = useState(true);
  const [tab, setTab] = useState<TabKey>("commits");

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore (private browsing, disabled storage, etc.)
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(EXPORT_FORMAT_STORAGE_KEY, exportFormat);
    } catch {
      // ignore (private browsing, disabled storage, etc.)
    }
  }, [exportFormat]);

  useEffect(() => {
    try {
      const openState: Record<string, boolean> = {};
      for (const id in repos) openState[id] = repos[id].open;
      localStorage.setItem(REPO_OPEN_STORAGE_KEY, JSON.stringify(openState));
    } catch {
      // ignore (private browsing, disabled storage, etc.)
    }
  }, [repos]);

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore (private browsing, disabled storage, etc.)
    }
  }, [filters]);

  const globalRange = useMemo<DateRange>(
    () => presetRange(preset, { from: customFrom, to: customTo }, now),
    [preset, customFrom, customTo, now],
  );

  const setQ = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, q: value }));
    setLimit(250);
  }, []);

  const setCustomFrom = useCallback(
    (value: string | null) => setFilters((prev) => ({ ...prev, from: value })),
    [],
  );

  const setCustomTo = useCallback((value: string | null) => setFilters((prev) => ({ ...prev, to: value })), []);

  const setAuthor = useCallback((value: string) => setFilters((prev) => ({ ...prev, author: value })), []);

  const setMerges = useCallback((value: boolean) => setFilters((prev) => ({ ...prev, merges: value })), []);

  const setSort = useCallback((value: SortMode) => setFilters((prev) => ({ ...prev, sort: value })), []);

  const setPresetChoice = useCallback(
    (p: string) => {
      setFilters((prev) => {
        if (p === "custom") {
          if (prev.from) return { ...prev, preset: p };
          const seedDays = Number(defaultRangePreset) || 30;
          return { ...prev, preset: p, from: iso(now - seedDays * DAY), to: iso(now) };
        }
        return { ...prev, preset: p, from: null, to: null };
      });
    },
    [now, defaultRangePreset],
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters(defaultRangePreset));
    setLimit(250);
  }, [defaultRangePreset]);

  const repoRange = useCallback(
    (repoId: string): DateRange => {
      const runtime = repos[repoId];
      if (scope === "repo" && runtime?.range) return runtime.range;
      return globalRange;
    },
    [repos, scope, globalRange],
  );

  const updateRepo = useCallback((id: string, patch: (r: RepoRuntime) => RepoRuntime) => {
    setRepos((prev) => ({ ...prev, [id]: patch(prev[id]) }));
  }, []);

  const toggleRepoOpen = useCallback(
    (id: string) => updateRepo(id, (r) => ({ ...r, open: !r.open })),
    [updateRepo],
  );

  const toggleRepoOn = useCallback(
    (id: string) =>
      updateRepo(id, (r) => {
        const on = !r.on;
        const bon = on
          ? r.bon.size === 0
            ? new Set(repoConfigs.find((c) => c.id === id)?.branches)
            : r.bon
          : new Set<string>();
        return { ...r, on, bon };
      }),
    [updateRepo, repoConfigs],
  );

  const toggleBranch = useCallback(
    (id: string, branch: string) =>
      updateRepo(id, (r) => {
        const bon = new Set(r.bon);
        bon.has(branch) ? bon.delete(branch) : bon.add(branch);
        return { ...r, bon, on: bon.size > 0 };
      }),
    [updateRepo],
  );

  const applyRepoRange = useCallback(
    (id: string, from: string | null, to: string | null) =>
      updateRepo(id, (r) => ({ ...r, range: { from: from || null, to: to || null } })),
    [updateRepo],
  );

  const clearRepoRange = useCallback((id: string) => updateRepo(id, (r) => ({ ...r, range: null })), [updateRepo]);

  const selectAllRepos = useCallback(() => {
    setRepos((prev) => {
      const next: Record<string, RepoRuntime> = {};
      for (const r of repoConfigs) next[r.id] = { ...prev[r.id], on: true, bon: new Set(r.branches) };
      return next;
    });
  }, [repoConfigs]);

  const selectNoneRepos = useCallback(() => {
    setRepos((prev) => {
      const next: Record<string, RepoRuntime> = {};
      for (const r of repoConfigs) next[r.id] = { ...prev[r.id], on: false };
      return next;
    });
  }, [repoConfigs]);

  const list = useMemo<Commit[]>(() => {
    const query = q.trim().toLowerCase();
    const out: Commit[] = [];
    for (const r of repoConfigs) {
      const runtime = repos[r.id];
      if (!runtime.on || !runtime.bon.size) continue;
      const rr = repoRange(r.id);
      const lo = toMs(rr.from);
      const hi = toMs(rr.to, true);
      for (const c of commits) {
        if (c.repo !== r.id || !runtime.bon.has(c.branch)) continue;
        if (lo && c.ts < lo) continue;
        if (hi && c.ts > hi) continue;
        if (!merges && c.merge) continue;
        if (author && c.a.email !== author) continue;
        if (
          query &&
          !(
            c.subject.toLowerCase().includes(query) ||
            c.a.name.toLowerCase().includes(query) ||
            c.hash.startsWith(query) ||
            c.paths.some((p) => p.toLowerCase().includes(query))
          )
        )
          continue;
        out.push(c);
      }
    }
    out.sort(sort === "old" ? (a, b) => a.ts - b.ts : (a, b) => b.ts - a.ts);
    return out;
  }, [repoConfigs, commits, repos, repoRange, merges, author, q, sort]);

  const showMore = useCallback(() => setLimit((l) => l + 250), []);
  const selectCommit = useCallback((i: number) => {
    setSel(i);
    setShowDetail(true);
  }, []);

  const selectedCommit = useMemo(() => (sel == null ? undefined : commits.find((c) => c.i === sel)), [sel, commits]);

  const overrideCount = useMemo(
    () => (scope === "repo" ? Object.values(repos).filter((r) => r.range).length : 0),
    [repos, scope],
  );

  const selectedRepoCount = useMemo(() => Object.values(repos).filter((r) => r.on).length, [repos]);
  const selectedBranchCount = useMemo(
    () => Object.values(repos).reduce((s, r) => (r.on ? s + r.bon.size : s), 0),
    [repos],
  );

  const hasActiveFilters = useMemo(() => {
    const defaults = defaultFilters(defaultRangePreset);
    return (Object.keys(defaults) as (keyof StoredFilters)[]).some((key) => filters[key] !== defaults[key]);
  }, [filters, defaultRangePreset]);

  return {
    scope,
    setScope,
    preset,
    setPreset: setPresetChoice,
    globalRange,
    isCustomPreset: preset === "custom",
    setCustomFrom,
    setCustomTo,
    q,
    setQ,
    author,
    setAuthor,
    merges,
    setMerges,
    sort,
    setSort,
    clearFilters,
    hasActiveFilters,
    theme,
    setTheme,
    exportFormat,
    setExportFormat,
    showDetail,
    setShowDetail,
    tab,
    setTab,

    repoConfigs,
    commits,
    repos,
    repoRange,
    toggleRepoOpen,
    toggleRepoOn,
    toggleBranch,
    applyRepoRange,
    clearRepoRange,
    selectAllRepos,
    selectNoneRepos,

    list,
    limit,
    showMore,
    sel,
    selectCommit,
    selectedCommit,

    overrideCount,
    selectedRepoCount,
    selectedBranchCount,
  };
}

export type GitScopeState = ReturnType<typeof useGitScope>;
