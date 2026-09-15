import { DAY, full, iso, previousWorkday } from "@/lib/gitscope/format";
import { filterCommits } from "@/lib/gitscope/filter-commits";
import { loadCommitsForRepos, loadRepoConfigs } from "@/lib/gitscope/git-source";
import type { DateRange, SortMode } from "@/lib/gitscope/types";

/**
 * Resolves the "preset"/"from"/"to" query params to a concrete date range, mirroring presetRange()
 * in use-git-scope.ts. Unlike the UI, an absent preset falls back to the raw from/to params (or
 * unbounded, if those are absent too) rather than a default day-count — an API caller who wants a
 * bounded range is expected to say so explicitly.
 */
function resolveDateRange(preset: string | null, from: string | null, to: string | null, now: number): DateRange {
  if (!preset || preset === "custom") return { from, to };
  if (preset === "all") return { from: null, to: null };
  if (preset === "prevworkday") {
    const day = previousWorkday(now);
    return { from: day, to: day };
  }
  const days = Number(preset);
  if (Number.isFinite(days) && days > 0) return { from: iso(now - days * DAY), to: iso(now) };
  return { from, to };
}

/**
 * Returns the currently filtered commit list as JSON. Query params mirror use-git-scope.ts's state
 * names: preset/from/to (date range), author (email), merges (include merge commits, default true),
 * q (free text over subject/author name/hash-prefix/paths), sort (new/old). `repos` and `branches`
 * (both comma-separated) select which repos/branches to include — repo ids are validated against
 * the server's configured repos (via loadRepoConfigs), never taken as raw filesystem paths.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { repoConfigs } = await loadRepoConfigs();

  const requestedRepoIds = params.get("repos")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
  const requestedBranches = params.get("branches")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
  const branchFilter = requestedBranches && requestedBranches.length > 0 ? new Set(requestedBranches) : null;

  const selectedRepos = requestedRepoIds
    ? repoConfigs.filter((r) => requestedRepoIds.includes(r.id))
    : repoConfigs;

  const selections = selectedRepos
    .map((r) => ({
      id: r.id,
      path: r.path,
      branches: branchFilter ? r.branches.filter((b) => branchFilter.has(b)) : r.branches,
    }))
    .filter((s) => s.branches.length > 0);

  const range = resolveDateRange(params.get("preset"), params.get("from"), params.get("to"), Date.now());
  const mergesParam = params.get("merges");
  const merges = mergesParam === null ? true : mergesParam !== "false";
  const author = params.get("author") ?? "";
  const q = params.get("q") ?? "";
  const sort: SortMode = params.get("sort") === "old" ? "old" : "new";

  const sinceDate = range.from ? new Date(`${range.from}T00:00:00`) : null;
  const { commits } = await loadCommitsForRepos(
    selections,
    sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : null,
  );

  const filtered = filterCommits(commits, { range, merges, author, query: q, sort });

  const repoById = Object.fromEntries(selectedRepos.map((r) => [r.id, r]));
  const body = filtered.map((c) => ({
    repo: repoById[c.repo]?.name ?? c.repo,
    repoId: c.repo,
    branch: c.branch,
    hash: c.hash,
    dateTime: full(c.ts),
    ts: c.ts,
    author: { name: c.a.name, email: c.a.email },
    message: c.subject,
    merge: c.merge,
    tag: c.tag,
  }));

  return Response.json({ count: body.length, commits: body });
}
