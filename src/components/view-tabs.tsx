"use client";

import { fmt } from "@/lib/gitscope/format";
import type { DateRange, TabKey } from "@/lib/gitscope/types";

type ViewTabsProps = {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
  commitCount: number;
  globalRange: DateRange;
  overrideCount: number;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "commits", label: "Commits" },
  { key: "contrib", label: "Contributions" },
  { key: "activity", label: "Activity" },
];

export function ViewTabs({ tab, onTabChange, commitCount, globalRange, overrideCount }: ViewTabsProps) {
  return (
    <div className="tabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className="tab"
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => onTabChange(t.key)}
        >
          {t.label} {t.key === "commits" && <span className="n">{fmt(commitCount)}</span>}
        </button>
      ))}
      <div className="meta">
        <span className="mono">
          {globalRange.from || "∞"} → {globalRange.to || "now"}
        </span>
        {overrideCount > 0 && (
          <span className="badge" style={{ color: "var(--amb)" }}>
            {overrideCount} repo override{overrideCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
