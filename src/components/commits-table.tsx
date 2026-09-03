"use client";

import { ago, fmt, full } from "@/lib/gitscope/format";
import type { Commit, RepoConfig } from "@/lib/gitscope/types";

type CommitsTableProps = {
  list: Commit[];
  limit: number;
  sel: number | null;
  repoById: Record<string, RepoConfig>;
  onSelect: (i: number) => void;
  onShowMore: () => void;
};

export function CommitsTable({ list, limit, sel, repoById, onSelect, onShowMore }: CommitsTableProps) {
  if (!list.length) {
    return (
      <div className="tbl">
        <TableHead />
        <div className="empty">
          No commits match the current filters.
          <br />
          <span style={{ fontSize: 11 }}>Widen the date range or enable more branches.</span>
        </div>
      </div>
    );
  }

  const visible = list.slice(0, limit);
  const remaining = list.length - limit;

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
        <div className="more">
          <button type="button" onClick={onShowMore}>
            Show {Math.min(250, remaining)} more of {fmt(remaining)} remaining
          </button>
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
