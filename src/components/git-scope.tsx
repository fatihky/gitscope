"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadCommits } from "@/lib/gitscope/load-commits";
import { useGitScope } from "@/lib/gitscope/use-git-scope";
import type { GitScopeState } from "@/lib/gitscope/use-git-scope";
import type { Author, Commit, RepoConfig, RepoLoadError } from "@/lib/gitscope/types";
import { ActivityPanel } from "./activity-panel";
import { CommitDetail } from "./commit-detail";
import { CommitsTable } from "./commits-table";
import { ContributionsPanel } from "./contributions-panel";
import "./git-scope.css";
import { RepoSidebar } from "./repo-sidebar";
import { StatusBar } from "./status-bar";
import { ToolBar } from "./tool-bar";
import { TopBar } from "./top-bar";
import { ViewTabs } from "./view-tabs";

export type GitScopeProps = {
  repoConfigs: RepoConfig[];
  errors: RepoLoadError[];
  rangePresets: number[];
};

/**
 * The earliest date the current filters need commits for, across whatever's actually enabled
 * ("all" / an unbounded custom range, or a repo-scoped override, means null: everything). Used to
 * decide whether the commits already fetched from the server cover what the UI is now asking for.
 */
function earliestNeededFrom(gs: Pick<GitScopeState, "scope" | "globalRange" | "repos" | "repoRange">): string | null {
  if (gs.scope !== "repo") return gs.globalRange.from;
  let earliest: string | null = null;
  for (const [repoId, runtime] of Object.entries(gs.repos)) {
    if (!runtime.on) continue;
    const from = gs.repoRange(repoId).from;
    if (from === null) return null;
    if (earliest === null || from < earliest) earliest = from;
  }
  return earliest;
}

/** Does `needed` reach further back than what's already loaded? `null` means "everything so far". */
function needsWiderLoad(loadedFrom: string | null | undefined, needed: string | null): boolean {
  if (loadedFrom === undefined) return true;
  if (loadedFrom === null) return false;
  return needed === null || needed < loadedFrom;
}

export function GitScope({ repoConfigs, errors, rangePresets }: GitScopeProps) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(repoConfigs.length > 0);
  const [commitsError, setCommitsError] = useState<string | null>(null);
  // The `since` bound of the commits currently loaded; undefined until the first load, null once
  // full history has been fetched. A ref because updating it must never itself trigger a re-fetch.
  const loadedFromRef = useRef<string | null | undefined>(undefined);

  const gs = useGitScope({ repoConfigs, commits, defaultRangePreset: String(rangePresets[0] ?? 30) });
  const repoById = useMemo(() => Object.fromEntries(repoConfigs.map((r) => [r.id, r])), [repoConfigs]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Transmits the filters to the server: the initial load fetches only what the default view
  // needs, and re-fetches (once, widening to full history) if the user then asks for dates further
  // back than what's loaded — e.g. switching the range preset to "All". Never shrinks a fetch back
  // down; narrowing the visible range after that is filtered client-side over what's loaded, same
  // as before this split.
  const neededFrom = earliestNeededFrom(gs);
  useEffect(() => {
    if (repoConfigs.length === 0 || !needsWiderLoad(loadedFromRef.current, neededFrom)) return;
    let cancelled = false;
    setCommitsLoading(true);
    const selections = repoConfigs.map((r) => ({ id: r.id, path: r.path, branches: r.branches }));

    loadCommits(selections, neededFrom)
      .then((data) => {
        if (cancelled) return;
        loadedFromRef.current = neededFrom;
        setCommits(data.commits);
        setAuthors(data.authors);
        setCommitsError(null);
      })
      .catch((err) => {
        if (!cancelled) setCommitsError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setCommitsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repoConfigs, neededFrom]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const input = searchInputRef.current;
      if (e.key === "/" && document.activeElement !== input) {
        e.preventDefault();
        input?.focus();
        return;
      }
      if (e.key === "Escape") input?.blur();
      if ((e.key === "j" || e.key === "k") && (document.activeElement as HTMLElement | null)?.tagName !== "INPUT") {
        const idx = gs.list.findIndex((c) => c.i === gs.sel);
        const next = e.key === "j" ? Math.min(gs.list.length - 1, idx + 1) : Math.max(0, idx - 1);
        const target = gs.list[next];
        if (target) gs.selectCommit(target.i);
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [gs.list, gs.sel, gs.selectCommit]);

  useEffect(() => {
    if (gs.sel == null) return;
    document.querySelector(".trow.sel")?.scrollIntoView({ block: "nearest" });
  }, [gs.sel]);

  return (
    <div className={`gitscope${gs.showDetail ? "" : " nodetail"}`} data-theme={gs.theme} data-scope={gs.scope}>
      <div className="app">
        {repoConfigs.length === 0 && (
          <div className="setup-banner">
            {errors.length > 0
              ? `Failed to load repositories from GITSCOPE_REPOS: ${errors.map((e) => `${e.path} (${e.message})`).join("; ")}`
              : "Set the GITSCOPE_REPOS environment variable to a comma-separated list of local git repository paths to get started."}
          </div>
        )}
        {repoConfigs.length > 0 && errors.length > 0 && (
          <div className="setup-banner">
            Some repositories failed to load: {errors.map((e) => `${e.path} (${e.message})`).join("; ")}
          </div>
        )}
        {commitsError && <div className="setup-banner">Failed to load commits: {commitsError}</div>}
        <TopBar
          query={gs.q}
          onQueryChange={gs.setQ}
          onToggleTheme={() => gs.setTheme(gs.theme === "dark" ? "light" : "dark")}
          onToggleDetail={() => gs.setShowDetail(!gs.showDetail)}
          searchInputRef={searchInputRef}
        />
        <ToolBar
          scope={gs.scope}
          onScopeChange={gs.setScope}
          rangePresets={rangePresets}
          preset={gs.preset}
          onPresetChange={gs.setPreset}
          from={gs.globalRange.from}
          to={gs.globalRange.to}
          isCustomPreset={gs.isCustomPreset}
          onFromChange={gs.setCustomFrom}
          onToChange={gs.setCustomTo}
          author={gs.author}
          onAuthorChange={gs.setAuthor}
          authors={authors}
          merges={gs.merges}
          onMergesChange={gs.setMerges}
          sort={gs.sort}
          onSortChange={gs.setSort}
          list={gs.list}
          repoById={repoById}
          exportFormat={gs.exportFormat}
          onExportFormatChange={gs.setExportFormat}
        />
        <div className="body">
          <RepoSidebar
            repoConfigs={gs.repoConfigs}
            commits={gs.commits}
            repos={gs.repos}
            repoRange={gs.repoRange}
            onToggleOpen={gs.toggleRepoOpen}
            onToggleOn={gs.toggleRepoOn}
            onToggleBranch={gs.toggleBranch}
            onApplyRange={gs.applyRepoRange}
            onClearRange={gs.clearRepoRange}
            onSelectAll={gs.selectAllRepos}
            onSelectNone={gs.selectNoneRepos}
          />
          <main className="main">
            <ViewTabs
              tab={gs.tab}
              onTabChange={gs.setTab}
              commitCount={gs.list.length}
              globalRange={gs.globalRange}
              overrideCount={gs.overrideCount}
            />
            <section className={`view${gs.tab === "commits" ? " show" : ""}`}>
              <CommitsTable
                list={gs.list}
                limit={gs.limit}
                sel={gs.sel}
                loading={commitsLoading}
                repoById={repoById}
                onSelect={gs.selectCommit}
                onShowMore={gs.showMore}
              />
            </section>
            <section className={`view${gs.tab === "contrib" ? " show" : ""}`}>
              <ContributionsPanel list={gs.list} />
            </section>
            <section className={`view${gs.tab === "activity" ? " show" : ""}`}>
              <ActivityPanel list={gs.list} />
            </section>
          </main>
          <CommitDetail commit={gs.selectedCommit} repoById={repoById} onClose={() => gs.setShowDetail(false)} />
        </div>
        <StatusBar
          totalCount={gs.list.length}
          limit={gs.limit}
          scope={gs.scope}
          selectedRepoCount={gs.selectedRepoCount}
          selectedBranchCount={gs.selectedBranchCount}
          author={gs.author}
          commitsLoading={commitsLoading}
        />
      </div>
    </div>
  );
}

export default GitScope;
