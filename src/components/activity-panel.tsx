"use client";

import { useMemo } from "react";
import { DAY, fmt, iso, short } from "@/lib/gitscope/format";
import type { Commit } from "@/lib/gitscope/types";

type ActivityPanelProps = {
  list: Commit[];
};

type HeatCell = { key: string; level: number; title: string };
type HeatWeek = { key: number; cells: HeatCell[] };
type MonthLabel = { key: number; label: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ActivityPanel({ list }: ActivityPanelProps) {
  const { weeks, months, total, best, grid, timeline } = useMemo(() => {
    const byDay = new Map<string, number>();
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const byWeek = new Map<string, number>();
    for (const c of list) {
      const k = iso(c.ts);
      byDay.set(k, (byDay.get(k) || 0) + 1);
      const d = new Date(c.ts);
      grid[d.getDay()][d.getHours()]++;
      const wk = iso(c.ts - ((d.getDay() + 6) % 7) * DAY);
      byWeek.set(wk, (byWeek.get(wk) || 0) + 1);
    }

    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - ((end.getDay() + 6) % 7));
    const weeks: HeatWeek[] = [];
    const months: MonthLabel[] = [];
    let prevM = -1;
    let total = 0;
    let best = 0;
    for (let w = 52; w >= 0; w--) {
      const ws = new Date(end.getTime() - w * 7 * DAY);
      const cells: HeatCell[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(ws.getTime() + d * DAY);
        const dayIso = iso(day.getTime());
        const n = byDay.get(dayIso) || 0;
        total += n;
        best = Math.max(best, n);
        const level = n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4;
        cells.push({ key: dayIso, level, title: `${dayIso} — ${n} commit${n === 1 ? "" : "s"}` });
      }
      weeks.push({ key: w, cells });
      const m = ws.getMonth();
      const showLabel = m !== prevM && ws.getDate() <= 7;
      months.push({ key: w, label: showLabel ? ws.toLocaleDateString("en", { month: "short" }) : "" });
      if (showLabel) prevM = m;
    }

    const timeline = [...byWeek.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14);
    return { weeks, months, total, best, grid, timeline };
  }, [list]);

  const gmax = Math.max(1, ...grid.flat());
  const wmax = Math.max(1, ...timeline.map((x) => x[1]));

  return (
    <div className="pad">
      <div className="card" style={{ marginTop: 0 }}>
        <div className="pane-hd">
          <span>Commit heatmap</span>
          <div className="sp" />
          <span className="cnt">last 53 weeks</span>
        </div>
        <div className="card-bd">
          <div className="hmwrap">
            <div className="months">
              {months.map((m) => (
                <span key={m.key} style={{ width: 12, flex: "0 0 12px" }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div className="hm">
              {weeks.map((wk) => (
                <div className="wk" key={wk.key}>
                  {wk.cells.map((cell) => (
                    <div key={cell.key} className={`cl ${cell.level ? `l${cell.level}` : ""}`} title={cell.title} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="hmleg">
            <span>Less</span>
            <i className="cl" style={{ background: "var(--hm0)" }} />
            <i className="cl" style={{ background: "var(--hm1)" }} />
            <i className="cl" style={{ background: "var(--hm2)" }} />
            <i className="cl" style={{ background: "var(--hm3)" }} />
            <i className="cl" style={{ background: "var(--hm4)" }} />
            <span>More</span>
            <div className="sp" style={{ flex: 1 }} />
            <span>
              {fmt(total)} commits in window · peak {best}/day
            </span>
          </div>
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 8 }}>
        <div className="card">
          <div className="pane-hd">
            <span>Punchcard — weekday × hour</span>
          </div>
          <div className="card-bd">
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {WEEKDAYS.map((label, k) => {
                const row = grid[(k + 1) % 7];
                return (
                  <div className="punch" key={label}>
                    <span className="d">{label}</span>
                    <span className="hrs">
                      {row.map((n, h) => {
                        const s = n ? Math.max(3, Math.round((n / gmax) * 13)) : 0;
                        return (
                          <span
                            key={`${label}-${h}`}
                            className="p"
                            style={{ width: s, height: s, opacity: n ? 0.35 + (n / gmax) * 0.65 : 0 }}
                            title={`${label} ${h}:00 — ${n}`}
                          />
                        );
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="hrlbl">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h}>{h % 3 === 0 ? h : ""}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="pane-hd">
            <span>Volume over time</span>
          </div>
          <div className="card-bd">
            <div className="bars">
              {timeline.length === 0 && <div className="hint">No data in range.</div>}
              {timeline.map(([w, n]) => (
                <div className="barrow" key={w}>
                  <span className="nm mono" style={{ fontWeight: 400, color: "var(--tx-2)" }}>
                    {short(new Date(w).getTime())}
                  </span>
                  <span className="track" style={{ height: 7 }}>
                    <i className="g" style={{ width: `${(n / wmax) * 100}%` }} />
                  </span>
                  <span className="r mono" style={{ textAlign: "right" }}>
                    {fmt(n)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
