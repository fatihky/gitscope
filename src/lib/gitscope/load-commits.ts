"use server";

import path from "node:path";
import type { RepoCommitSelection } from "./git-source";
import { getConfiguredRepoPaths, loadCommitsForRepos } from "./git-source";
import type { Author, Commit } from "./types";

/**
 * Server Action the UI calls to fetch commits for the repos/branches/date range it wants —
 * initially right after the page loads, and again if the user later asks for dates further back
 * than what's loaded (see git-scope.tsx). `selections` comes from the client, so it's checked
 * against the configured repo paths before touching the filesystem.
 *
 * `since` is a plain "YYYY-MM-DD" date (the same shape as DateRange.from), parsed as local
 * midnight to match how the client treats a range's `from` — see toMs() in use-git-scope.ts.
 */
export async function loadCommits(
  selections: RepoCommitSelection[],
  since: string | null,
): Promise<{ commits: Commit[]; authors: Author[] }> {
  const allowedPaths = new Set(getConfiguredRepoPaths().map((p) => path.resolve(process.cwd(), p)));
  const validSelections = selections.filter((s) => allowedPaths.has(s.path));

  const sinceDate = since ? new Date(`${since}T00:00:00`) : null;
  return loadCommitsForRepos(validSelections, sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : null);
}
