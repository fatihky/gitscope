"use client";

import { useState } from "react";
import { fmt } from "@/lib/gitscope/format";
import { BRANCH_COMMIT_COUNTS, REPO_CONFIGS } from "@/lib/gitscope/mock-data";
import type { DateRange, RepoConfig, RepoRuntime } from "@/lib/gitscope/types";

type RepoSidebarProps = {
  repos: Record<string, RepoRuntime>;
  repoRange: (id: string) => DateRange;
  onToggleOpen: (id: string) => void;
  onToggleOn: (id: string) => void;
  onToggleBranch: (id: string, branch: string) => void;
  onApplyRange: (id: string, from: string | null, to: string | null) => void;
  onClearRange: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
};

export function RepoSidebar({
  repos,
  repoRange,
  onToggleOpen,
  onToggleOn,
  onToggleBranch,
  onApplyRange,
  onClearRange,
  onSelectAll,
  onSelectNone,
}: RepoSidebarProps) {
  const onCount = REPO_CONFIGS.filter((r) => repos[r.id].on).length;

  return (
    <aside className="side">
      <div className="side-hd">
        <span>Repositories</span>
        <span className="cnt">
          {onCount}/{REPO_CONFIGS.length}
        </span>
        <div className="sp" />
        <button type="button" className="lnk" onClick={onSelectAll}>
          all
        </button>
        <button type="button" className="lnk" onClick={onSelectNone}>
          none
        </button>
      </div>
      <div className="tree">
        {REPO_CONFIGS.map((r) => (
          <RepoNode
            key={r.id}
            repo={r}
            runtime={repos[r.id]}
            range={repoRange(r.id)}
            onToggleOpen={() => onToggleOpen(r.id)}
            onToggleOn={() => onToggleOn(r.id)}
            onToggleBranch={(b) => onToggleBranch(r.id, b)}
            onApplyRange={(from, to) => onApplyRange(r.id, from, to)}
            onClearRange={() => onClearRange(r.id)}
          />
        ))}
      </div>
      <div className="side-hd" style={{ borderTop: "1px solid var(--bd)", borderBottom: 0 }}>
        <span>Selection</span>
        <div className="sp" />
        <span className="cnt" />
      </div>
    </aside>
  );
}

type RepoNodeProps = {
  repo: RepoConfig;
  runtime: RepoRuntime;
  range: DateRange;
  onToggleOpen: () => void;
  onToggleOn: () => void;
  onToggleBranch: (branch: string) => void;
  onApplyRange: (from: string | null, to: string | null) => void;
  onClearRange: () => void;
};

function RepoNode({
  repo,
  runtime,
  range,
  onToggleOpen,
  onToggleOn,
  onToggleBranch,
  onApplyRange,
  onClearRange,
}: RepoNodeProps) {
  const [editing, setEditing] = useState(false);
  const [draftFrom, setDraftFrom] = useState(range.from || "");
  const [draftTo, setDraftTo] = useState(range.to || "");
  const total = repo.branches.reduce((s, b) => s + (BRANCH_COMMIT_COUNTS[`${repo.id}/${b}`] || 0), 0);
  const some = runtime.bon.size > 0 && runtime.bon.size < repo.branches.length;
  const custom = !!runtime.range;

  return (
    <div className={`repo ${runtime.open ? "open" : ""}`}>
      <div className="rrow" onClick={onToggleOpen}>
        <span className={`tw ${runtime.open ? "open" : ""}`}>▶</span>
        <input
          type="checkbox"
          checked={runtime.on}
          ref={(el) => {
            if (el) el.indeterminate = some;
          }}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleOn}
        />
        <span className="lang" style={{ background: repo.lang }} />
        <span className="rname" title={repo.path}>
          {repo.name}
        </span>
        <span className="cnt">{fmt(total)}</span>
      </div>
      <div className="branches">
        {repo.branches.map((b) => (
          <div key={b} className="brow" onClick={() => onToggleBranch(b)}>
            <input
              type="checkbox"
              checked={runtime.bon.has(b)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onToggleBranch(b)}
            />
            <span className="bname">{b}</span>
            {b === repo.branches[0] && <span className="tag">def</span>}
            <span className="cnt">{fmt(BRANCH_COMMIT_COUNTS[`${repo.id}/${b}`] || 0)}</span>
          </div>
        ))}
      </div>
      <div
        className={`ovr ${custom ? "active" : ""}`}
        onClick={() => {
          if (!editing) {
            setDraftFrom(range.from || "");
            setDraftTo(range.to || "");
          }
          setEditing((v) => !v);
        }}
      >
        <span className="k">⧗</span>
        <span>{custom ? `${range.from || "…"} → ${range.to || "now"}` : "inherits global range"}</span>
        <div className="sp" style={{ flex: 1 }} />
        <button type="button">{custom ? "edit" : "set"}</button>
      </div>
      <div className={`ovr-edit ${editing ? "show" : ""}`}>
        <input className="dtin" type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
        <input className="dtin" type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
        <button
          type="button"
          className="btn"
          onClick={() => {
            onApplyRange(draftFrom || null, draftTo || null);
            setEditing(false);
          }}
        >
          Apply
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            onClearRange();
            setDraftFrom("");
            setDraftTo("");
            setEditing(false);
          }}
        >
          Inherit
        </button>
      </div>
    </div>
  );
}
