"use client";

import { useMemo } from "react";
import { fmt, iso } from "@/lib/gitscope/format";
import type { Author, Commit } from "@/lib/gitscope/types";

type ContributionsPanelProps = {
  list: Commit[];
};

type AuthorStat = { a: Author; n: number; repos: Set<string> };
type RepoStat = { n: number; br: Map<string, number> };
type Kpi = { key: string; label: string; value: string; detail: string };

const PAL = ["var(--acc)", "var(--grn)", "var(--amb)", "var(--pur)", "var(--cyn)", "var(--red)"];

export function ContributionsPanel({ list }: ContributionsPanelProps) {
  const { kpis, authors, repoBars } = useMemo(() => {
    const days = new Set<string>();
    const byA = new Map<string, AuthorStat>();
    const byR = new Map<string, RepoStat>();
    let files = 0;
    for (const c of list) {
      days.add(iso(c.ts));
      files += c.files;
      let a = byA.get(c.a.email);
      if (!a) {
        a = { a: c.a, n: 0, repos: new Set() };
        byA.set(c.a.email, a);
      }
      a.n++;
      a.repos.add(c.repo);
      let r = byR.get(c.repo);
      if (!r) {
        r = { n: 0, br: new Map() };
        byR.set(c.repo, r);
      }
      r.n++;
      r.br.set(c.branch, (r.br.get(c.branch) || 0) + 1);
    }
    const span = days.size || 1;
    const kpis: Kpi[] = [
      { key: "commits", label: "Commits", value: fmt(list.length), detail: `${(list.length / span).toFixed(1)} / active day` },
      { key: "authors", label: "Authors", value: String(byA.size), detail: `${(list.length / (byA.size || 1)).toFixed(0)} commits avg` },
      { key: "files", label: "Files touched", value: fmt(files), detail: "change events" },
      { key: "days", label: "Active days", value: String(span), detail: "with ≥1 commit" },
    ];
    const authors = [...byA.values()].sort((x, y) => y.n - x.n);
    const repoBars = [...byR.entries()].sort((a, b) => b[1].n - a[1].n);
    return { kpis, authors, repoBars };
  }, [list]);

  const top = authors[0]?.n ?? 1;
  const maxRepo = repoBars[0]?.[1].n ?? 1;

  return (
    <div className="pad">
      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.key}>
            <div className="k">{k.label}</div>
            <div className="v">{k.value}</div>
            <div className="d">{k.detail}</div>
          </div>
        ))}
      </div>
      <div className="grid2" style={{ marginTop: 8 }}>
        <div className="card">
          <div className="pane-hd">
            <span>Top contributors</span>
            <div className="sp" />
            <span className="cnt">{authors.length}</span>
          </div>
          <div style={{ maxHeight: 298, overflow: "auto" }}>
            <table className="lb">
              <thead>
                <tr>
                  <th>Author</th>
                  <th className="r">Commits</th>
                  <th style={{ width: 96 }}>Share</th>
                  <th className="r">Repos</th>
                </tr>
              </thead>
              <tbody>
                {authors.length === 0 && (
                  <tr>
                    <td colSpan={4} className="hint">
                      No data in range.
                    </td>
                  </tr>
                )}
                {authors.map((x) => (
                  <tr key={x.a.email}>
                    <td>
                      <div className="who">
                        <span className="av" style={{ background: x.a.color }}>
                          {x.a.ini}
                        </span>
                        <span>
                          <b style={{ fontWeight: 600 }}>{x.a.name}</b> <span className="cnt">{x.a.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="r">{fmt(x.n)}</td>
                    <td>
                      <div className="track">
                        <i style={{ width: `${(x.n / top) * 100}%`, background: x.a.color }} />
                      </div>
                    </td>
                    <td className="r">{x.repos.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="pane-hd">
            <span>By repository &amp; branch</span>
          </div>
          <div className="card-bd bars">
            {repoBars.length === 0 && <div className="hint">No data in range.</div>}
            {repoBars.map(([id, r]) => {
              const br = [...r.br.entries()].sort((a, b) => b[1] - a[1]);
              return (
                <div className="barrow" key={id} title={br.map(([b, n]) => `${b}: ${n}`).join(" · ")}>
                  <span className="nm">{id}</span>
                  <span className="stack" style={{ width: `${Math.max(8, (r.n / maxRepo) * 100)}%` }}>
                    {br.map(([, n], k) => (
                      <i key={`${id}-${k}`} style={{ width: `${(n / r.n) * 100}%`, background: PAL[k % PAL.length] }} />
                    ))}
                  </span>
                  <span className="r mono" style={{ textAlign: "right" }}>
                    {fmt(r.n)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
