"use client";

import { useEffect, useRef } from "react";
import { useGitScope } from "@/lib/gitscope/use-git-scope";
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

export function GitScope() {
  const gs = useGitScope();
  const searchInputRef = useRef<HTMLInputElement>(null);

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
          preset={gs.preset}
          onPresetChange={gs.setPreset}
          from={gs.globalRange.from}
          to={gs.globalRange.to}
          isCustomPreset={gs.isCustomPreset}
          onFromChange={gs.setCustomFrom}
          onToChange={gs.setCustomTo}
          author={gs.author}
          onAuthorChange={gs.setAuthor}
          merges={gs.merges}
          onMergesChange={gs.setMerges}
          sort={gs.sort}
          onSortChange={gs.setSort}
        />
        <div className="body">
          <RepoSidebar
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
              <CommitsTable list={gs.list} limit={gs.limit} sel={gs.sel} onSelect={gs.selectCommit} onShowMore={gs.showMore} />
            </section>
            <section className={`view${gs.tab === "contrib" ? " show" : ""}`}>
              <ContributionsPanel list={gs.list} />
            </section>
            <section className={`view${gs.tab === "activity" ? " show" : ""}`}>
              <ActivityPanel list={gs.list} />
            </section>
          </main>
          <CommitDetail commit={gs.selectedCommit} />
        </div>
        <StatusBar
          totalCount={gs.list.length}
          limit={gs.limit}
          scope={gs.scope}
          selectedRepoCount={gs.selectedRepoCount}
          selectedBranchCount={gs.selectedBranchCount}
          author={gs.author}
        />
      </div>
    </div>
  );
}

export default GitScope;
