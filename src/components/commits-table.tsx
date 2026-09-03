"use client";

import { useEffect, useRef } from "react";
import { ago, fmt, full } from "@/lib/gitscope/format";
import type { Commit, RepoConfig } from "@/lib/gitscope/types";

type CommitsTableProps = {
  list: Commit[];
  limit: number;
  sel: number | null;
  loading?: boolean;
  repoById: Record<string, RepoConfig>;
  onSelect: (i: number) => void;
  onShowMore: () => void;
};

export function CommitsTable({ list, limit, sel, loading, repoById, onSelect, onShowMore }: CommitsTableProps) {
  const remaining = list.length - limit;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Grow the rendered window as the sentinel below the last row scrolls into view, instead of
  // requiring a click — `onShowMore` only widens the client-side render window (all matching
  // commits are already in `list`), so this is free.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || remaining <= 0) return;
    const root = el.closest(".view");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onShowMore();
      },
      { root: root instanceof Element ? root : null, rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [remaining, onShowMore]);

  if (!list.length) {
    return (
      <div className="tbl">
        <TableHead />
        <div className="empty">
          {loading ? (
            "Loading commits…"
          ) : (
            <>
              No commits match the current filters.
              <br />
              <span style={{ fontSize: 11 }}>Widen the date range or enable more branches.</span>
            </>
          )}
        </div>
      </div>
    );
  }

  const visible = list.slice(0, limit);

  return (
    <div className="tbl">
      <TableHead />
      <div>
        {visible.map((c) => {
          const repo = repoById[c.repo];
          return (
            <div key={c.i} className={`gr trow ${sel === c.i ? "sel" : ""}`} onClick={() => onSelect(c.i)}>
              <div className="graph">
                <span className={`dot ${c.merge ? "merge" : ""}`} style={{ background: c.a.color }} />
              </div>
              <div className="mono hash">{c.hash.slice(0, 7)}</div>
              <div className="subj">
                <span className="rchip">
                  <i className="lang" style={{ background: repo.lang, width: 6, height: 6, borderRadius: "50%" }} />
                  {c.repo}
                </span>
                <span className="bchip">⑂ {c.branch}</span>
                {c.tag && <span className="vchip">⌾ {c.tag}</span>}
                <span className="t">{c.subject}</span>
              </div>
              <div className="who">
                <span className="av" style={{ background: c.a.color }}>
                  {c.a.ini}
                </span>
                <span className="t" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.a.name}
                </span>
              </div>
              <div className="mono ago" title={full(c.ts)}>
                {ago(c.ts)}
              </div>
            </div>
          );
        })}
      </div>
      {remaining > 0 && (
        <div className="more" ref={sentinelRef}>
          {fmt(remaining)} more commit{remaining === 1 ? "" : "s"} — scroll to load
        </div>
      )}
    </div>
  );
}

function TableHead() {
  return (
    <div className="gr thead">
      <div />
      <div>Commit</div>
      <div>Message</div>
      <div>Author</div>
      <div className="ago">Date</div>
    </div>
  );
}
