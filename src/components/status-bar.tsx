"use client";

import { fmt } from "@/lib/gitscope/format";
import type { ScopeMode } from "@/lib/gitscope/types";

type StatusBarProps = {
  totalCount: number;
  limit: number;
  scope: ScopeMode;
  selectedRepoCount: number;
  selectedBranchCount: number;
  author: string;
  commitsLoading: boolean;
};

export function StatusBar({
  totalCount,
  limit,
  scope,
  selectedRepoCount,
  selectedBranchCount,
  author,
  commitsLoading,
}: StatusBarProps) {
  return (
    <footer className="status">
      <span className="live">●</span>
      <span>
        <b>{fmt(totalCount)}</b> commits · showing <b>{fmt(Math.min(limit, totalCount))}</b>
      </span>
      {commitsLoading && (
        <>
          <span className="dotsep" />
          <span className="loading">loading commits…</span>
        </>
      )}
      <span className="dotsep" />
      <span>
        scope <b>{scope === "global" ? "global range" : "per repository"}</b>
      </span>
      <span className="dotsep" />
      <span>
        <b>{selectedRepoCount}</b> repos / <b>{selectedBranchCount}</b> branches
        {author && (
          <>
            {" "}
            · author <b>{author}</b>
          </>
        )}
      </span>
      <div className="sp" />
      <span>UTC+02:00</span>
      <span className="dotsep" />
      <span>read-only mode · no write operations</span>
      <span className="dotsep" />
      <span>v0.9.3</span>
    </footer>
  );
}
