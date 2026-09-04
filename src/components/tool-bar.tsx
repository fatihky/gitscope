"use client";

import { useState } from "react";
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
  list,
  repoById,
  exportFormat,
  onExportFormatChange,
}: ToolBarProps) {
  const [copied, setCopied] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const copyList = () => {
    const text = list
      .map((c) => formatCommit(exportFormat, c, repoById[c.repo]?.name ?? c.repo))
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
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
      <button type="button" className="btn" title="Copy filtered commit list" onClick={copyList}>
        {copied ? "✓ Copied" : "⧉ Copy"}
      </button>
    </div>
  );
}
