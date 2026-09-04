import type { Commit, DateRange, SortMode } from "./types";

const toMs = (d: string | null, end?: boolean): number | null =>
  d ? new Date(d + (end ? "T23:59:59" : "T00:00:00")).getTime() : null;

export type FilterCommitsOptions = {
  range?: DateRange;
  merges?: boolean;
  author?: string;
  query?: string;
  sort?: SortMode;
};

/**
 * The commit filter predicate + sort shared between the UI (see the `list` useMemo in
 * use-git-scope.ts) and the /api/commits route: date range, merge inclusion, author email,
 * free-text query (subject/author name/hash-prefix/paths), then sort by timestamp.
 */
export function filterCommits(commits: Commit[], options: FilterCommitsOptions = {}): Commit[] {
  const { range, merges = true, author = "", query = "", sort = "new" } = options;
  const lo = toMs(range?.from ?? null);
  const hi = toMs(range?.to ?? null, true);
  const q = query.trim().toLowerCase();

  const out: Commit[] = [];
  for (const c of commits) {
    if (lo && c.ts < lo) continue;
    if (hi && c.ts > hi) continue;
    if (!merges && c.merge) continue;
    if (author && c.a.email !== author) continue;
    if (
      q &&
      !(
        c.subject.toLowerCase().includes(q) ||
        c.a.name.toLowerCase().includes(q) ||
        c.hash.startsWith(q) ||
        c.paths.some((p) => p.toLowerCase().includes(q))
      )
    )
      continue;
    out.push(c);
  }
  out.sort(sort === "old" ? (a, b) => a.ts - b.ts : (a, b) => b.ts - a.ts);
  return out;
}
