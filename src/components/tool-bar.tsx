"use client";

import type { Author, ScopeMode, SortMode } from "@/lib/gitscope/types";

const PRESETS: { p: string; label: string }[] = [
  { p: "7", label: "7D" },
  { p: "30", label: "30D" },
  { p: "90", label: "90D" },
  { p: "365", label: "1Y" },
  { p: "all", label: "All" },
  { p: "custom", label: "Custom…" },
];

type ToolBarProps = {
  scope: ScopeMode;
  onScopeChange: (scope: ScopeMode) => void;
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
};

export function ToolBar({
  scope,
  onScopeChange,
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
}: ToolBarProps) {
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
        {PRESETS.map((item) => (
          <button
            key={item.p}
            type="button"
            className="chip"
            aria-pressed={preset === item.p}
            onClick={() => onPresetChange(item.p)}
          >
            {item.label}
          </button>
        ))}
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
    </div>
  );
}
