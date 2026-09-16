"use client";

import { useState } from "react";
import { getCommitPatches } from "@/lib/gitscope/commit-diff";
import { formatCommit } from "@/lib/gitscope/format";
import type { Author, Commit, RepoConfig, ScopeMode, SortMode } from "@/lib/gitscope/types";
import { ExportFormatModal } from "./export-format-modal";

/** e.g. 7 -> "7D", 365 -> "1Y", 730 -> "2Y" */
function labelForDays(days: number): string {
  return days % 365 === 0 ? `${days / 365}Y` : `${days}D`;
}

type ToolBarProps = {
  scope: ScopeMode;
  onScopeChange: (scope: ScopeMode) => void;
  rangePresets: number[];
  preset: string;
  onPresetChange: (preset: string) => void;
  from: string | null;
  to: string | null;
  isCustomPreset: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  author: string;
  onAuthorChange: (value: string) => void;
  authors: Author[];
  merges: boolean;
  onMergesChange: (value: boolean) => void;
  sort: SortMode;
  onSortChange: (value: SortMode) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  list: Commit[];
  repoById: Record<string, RepoConfig>;
  exportFormat: string;
  onExportFormatChange: (value: string) => void;
};

export function ToolBar({
  scope,
  onScopeChange,
  rangePresets,
  preset,
  onPresetChange,
  from,
  to,
  isCustomPreset,
  onFromChange,
  onToChange,
  author,
  onAuthorChange,
  authors,
  merges,
  onMergesChange,
  sort,
  onSortChange,
  hasActiveFilters,
  onClearFilters,
  list,
  repoById,
  exportFormat,
  onExportFormatChange,
}: ToolBarProps) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [includeDiffs, setIncludeDiffs] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const copyList = async () => {
    setCopying(true);
    try {
      const headers = list.map((c) => formatCommit(exportFormat, c, repoById[c.repo]?.name ?? c.repo));
      let text: string;
      if (includeDiffs) {
        const patches = await getCommitPatches(
          list.map((c) => ({ repoPath: repoById[c.repo]?.path ?? "", hash: c.hash })),
        );
        text = headers.map((h, i) => `${h}\n${patches[i]}`).join("\n\n");
      } else {
        text = headers.join("\n");
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } finally {
      setCopying(false);
    }
  };
  return (
    <div className="toolbar">
      <span className="tlabel">Date scope</span>
      <div className="seg">
        <button type="button" aria-pressed={scope === "global"} onClick={() => onScopeChange("global")}>
          Global
        </button>
        <button type="button" aria-pressed={scope === "repo"} onClick={() => onScopeChange("repo")}>
          Per repository
        </button>
      </div>
      <div className="vr" />
      <span className="tlabel">Range</span>
      <div className="chips">
        {rangePresets.map((days) => (
          <button
            key={days}
            type="button"
            className="chip"
            aria-pressed={preset === String(days)}
            onClick={() => onPresetChange(String(days))}
          >
            {labelForDays(days)}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          aria-pressed={preset === "prevworkday"}
          onClick={() => onPresetChange("prevworkday")}
        >
          Prev WD
        </button>
        <button type="button" className="chip" aria-pressed={preset === "all"} onClick={() => onPresetChange("all")}>
          All
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={preset === "custom"}
          onClick={() => onPresetChange("custom")}
        >
          Custom…
        </button>
      </div>
      <input
        className="dtin"
        type="date"
        value={from || ""}
        disabled={!isCustomPreset}
        onChange={(e) => onFromChange(e.target.value)}
      />
      <span style={{ color: "var(--tx-3)" }}>→</span>
      <input
        className="dtin"
        type="date"
        value={to || ""}
        disabled={!isCustomPreset}
        onChange={(e) => onToChange(e.target.value)}
      />
      <div className="vr" />
      <span className="tlabel">Author</span>
      <select className="sel" value={author} onChange={(e) => onAuthorChange(e.target.value)}>
        <option value="">All authors</option>
        {authors.map((a) => (
          <option key={a.email} value={a.email}>
            {a.name}
          </option>
        ))}
      </select>
      <div className="vr" />
      <label className="toggle">
        <input type="checkbox" checked={merges} onChange={(e) => onMergesChange(e.target.checked)} /> Merges
      </label>
      <div className="vr" />
      <span className="tlabel">Sort</span>
      <select className="sel" value={sort} onChange={(e) => onSortChange(e.target.value as SortMode)}>
        <option value="new">Newest first</option>
        <option value="old">Oldest first</option>
      </select>
      <button type="button" className="linkbtn" disabled={!hasActiveFilters} onClick={onClearFilters}>
        Clear filters
      </button>
      <div className="vr" />
      <button
        type="button"
        className="btn fmt-btn"
        title="Edit export format"
        onClick={() => setShowFormatModal(true)}
      >
        ⚙ Fmt
      </button>
      <ExportFormatModal
        open={showFormatModal}
        onClose={() => setShowFormatModal(false)}
        format={exportFormat}
        onFormatChange={onExportFormatChange}
        sampleCommits={list}
        repoById={repoById}
      />
      <label className="toggle" title="Include each commit's full diff in the copied list">
        <input type="checkbox" checked={includeDiffs} onChange={(e) => setIncludeDiffs(e.target.checked)} /> +diffs
      </label>
      <button
        type="button"
        className="btn"
        title="Copy filtered commit list"
        disabled={copying}
        onClick={copyList}
      >
        {copying ? "⧉ Copying…" : copied ? "✓ Copied" : "⧉ Copy"}
      </button>
    </div>
  );
}
