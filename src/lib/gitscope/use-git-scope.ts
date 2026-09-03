import { useCallback, useMemo, useState } from "react";
import { DAY, iso } from "./format";
import type { Commit, DateRange, RepoConfig, RepoRuntime, ScopeMode, SortMode, TabKey, Theme } from "./types";

function initialRepoRuntime(repoConfigs: RepoConfig[]): Record<string, RepoRuntime> {
  const out: Record<string, RepoRuntime> = {};
  repoConfigs.forEach((r, index) => {
    out[r.id] = {
      open: index === 0,
      on: true,
      bon: new Set(r.branches.slice(0, 2)),
      range: null,
    };
  });
  return out;
}

function presetRange(preset: string, custom: DateRange, now: number): DateRange {
  if (preset === "all") return { from: null, to: null };
  if (preset === "custom") return custom;
  const to = now;
  const from = now - Number(preset) * DAY;
  return { from: iso(from), to: iso(to) };
}

const toMs = (d: string | null, end?: boolean): number | null =>
  d ? new Date(d + (end ? "T23:59:59" : "T00:00:00")).getTime() : null;

export type GitScopeInput = {
  repoConfigs: RepoConfig[];
  commits: Commit[];
};

export function useGitScope({ repoConfigs, commits }: GitScopeInput) {
  const [now] = useState(() => Date.now());
  const [repos, setRepos] = useState<Record<string, RepoRuntime>>(() => initialRepoRuntime(repoConfigs));
  const [scope, setScope] = useState<ScopeMode>("global");
  const [preset, setPreset] = useState("30");
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const [q, setQInternal] = useState("");
  const [author, setAuthor] = useState("");
  const [merges, setMerges] = useState(true);
  const [sort, setSort] = useState<SortMode>("new");
  const [sel, setSel] = useState<number | null>(null);
  const [limit, setLimit] = useState(250);
  const [theme, setTheme] = useState<Theme>("dark");
  const [showDetail, setShowDetail] = useState(true);
  const [tab, setTab] = useState<TabKey>("commits");

  const globalRange = useMemo<DateRange>(
    () => presetRange(preset, { from: customFrom, to: customTo }, now),
    [preset, customFrom, customTo, now],
  );

  const setQ = useCallback((value: string) => {
    setQInternal(value);
    setLimit(250);
  }, []);

  const setPresetChoice = useCallback(
    (p: string) => {
      setPreset(p);
      if (p === "custom" && !customFrom) {
        setCustomFrom(iso(now - 30 * DAY));
        setCustomTo(iso(now));
      }
    },
    [customFrom, now],
  );

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
        const bon = on && r.bon.size === 0 ? new Set(repoConfigs.find((c) => c.id === id)?.branches) : r.bon;
        return { ...r, on, bon };
      }),
    [updateRepo, repoConfigs],
  );

  const toggleBranch = useCallback(
    (id: string, branch: string) =>
      updateRepo(id, (r) => {
        const bon = new Set(r.bon);
        bon.has(branch) ? bon.delete(branch) : bon.add(branch);
        return { ...r, bon, on: bon.size ? true : r.on };
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
    out.sort(
      sort === "old"
        ? (a, b) => a.ts - b.ts
        : sort === "size"
          ? (a, b) => b.files - a.files
          : (a, b) => b.ts - a.ts,
    );
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
    theme,
    setTheme,
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
