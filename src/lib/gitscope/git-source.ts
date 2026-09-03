import fs from "node:fs";
import path from "node:path";
import { diffLines } from "diff";
import git from "isomorphic-git";
import { colorForAuthor, colorForRepo, initialsFor } from "./palette";
import type { Author, Commit, RepoConfig, RepoLoadError } from "./types";

/** Skip line-diffing blobs larger than this (still counted as a changed file). */
const MAX_DIFF_BYTES = 2 * 1024 * 1024;

export type GitArgs = { fs: typeof fs; dir?: string; gitdir?: string };
type LogEntry = Awaited<ReturnType<typeof git.log>>[number];

export type RepoConfigsData = {
  repoConfigs: RepoConfig[];
  errors: RepoLoadError[];
};

/** A repo + the branches to walk, as chosen by the UI (order matters — see loadCommitsForRepos). */
export type RepoCommitSelection = { id: string; path: string; branches: string[] };

/** Repository paths configured via the GITSCOPE_REPOS env var (comma-separated). */
export function getConfiguredRepoPaths(): string[] {
  const raw = process.env.GITSCOPE_REPOS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

const DEFAULT_RANGE_PRESETS = [7, 30, 90, 365];

/** Date-range preset chips (in days), configured via the GITSCOPE_RANGE_PRESETS env var (comma-separated). */
export function getConfiguredRangePresets(): number[] {
  const raw = process.env.GITSCOPE_RANGE_PRESETS;
  if (!raw) return DEFAULT_RANGE_PRESETS;
  const days = raw
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d > 0);
  return days.length > 0 ? days : DEFAULT_RANGE_PRESETS;
}

/** Fast initial load: repo names + branch lists only, no commit walking. */
export async function loadRepoConfigs(): Promise<RepoConfigsData> {
  const repoConfigs: RepoConfig[] = [];
  const errors: RepoLoadError[] = [];
  const usedIds = new Set<string>();

  const repoPaths = getConfiguredRepoPaths();
  const start = Date.now();
  console.log(`[gitscope] loading ${repoPaths.length} repo(s)...`);

  for (const rawPath of repoPaths) {
    const repoPath = path.resolve(process.cwd(), rawPath);
    try {
      const repo = await loadRepoConfig(repoPath, usedIds);
      repoConfigs.push(repo);
      console.log(`[gitscope] loaded repo config ${repo.id}: ${repo.branches.length} branch(es)`);
    } catch (err) {
      console.log(`[gitscope] failed to load repo ${repoPath}`, err);
      errors.push({ path: repoPath, message: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log(`[gitscope] repo configs done in ${Date.now() - start}ms`);

  return { repoConfigs, errors };
}

/**
 * Commit load, run after the initial page load once the UI knows which repos/branches/date range
 * it wants. `since` limits how far back each branch is walked (isomorphic-git's log() has no
 * matching `until`, so an upper bound on the range still has to be applied client-side).
 */
export async function loadCommitsForRepos(
  selections: RepoCommitSelection[],
  since: Date | null,
): Promise<{ commits: Commit[]; authors: Author[] }> {
  const commits: Commit[] = [];
  const authorsByKey = new Map<string, Author>();
  const start = Date.now();

  for (const { id, path: repoPath, branches } of selections) {
    const repoStart = Date.now();
    const gitArgs = resolveGitArgs(repoPath);
    const tagByOid = await loadTags(gitArgs);

    // Walk branches in order, assigning each commit to the first (i.e. default-most) branch that reaches it.
    const claimed = new Set<string>();
    let count = 0;
    for (const branch of branches) {
      const log = await git.log({ ...gitArgs, ref: branch, includeChanges: false, since: since ?? undefined });
      for (const entry of log) {
        if (claimed.has(entry.oid)) continue;
        claimed.add(entry.oid);
        commits.push(buildCommit(id, branch, entry, tagByOid, authorsByKey));
        count++;
      }
    }
    console.log(`[gitscope] loaded ${count} commit(s) for ${id} in ${Date.now() - repoStart}ms`);
  }

  commits.sort((a, b) => b.ts - a.ts);
  commits.forEach((c, i) => {
    c.i = i;
  });

  console.log(`[gitscope] commit load done in ${Date.now() - start}ms (${commits.length} commits total)`);

  return {
    commits,
    authors: Array.from(authorsByKey.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Node's `fs` module works as isomorphic-git's fs client directly; only the dir-vs-gitdir shape differs for bare repos. */
export function resolveGitArgs(repoPath: string): GitArgs {
  if (fs.existsSync(path.join(repoPath, ".git"))) return { fs, dir: repoPath };
  if (fs.existsSync(path.join(repoPath, "HEAD")) && fs.existsSync(path.join(repoPath, "objects"))) {
    return { fs, gitdir: repoPath };
  }
  return { fs, dir: repoPath };
}

function uniqueId(base: string, usedIds: Set<string>): string {
  let id = base || "repo";
  let n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return id;
}

async function loadRepoConfig(repoPath: string, usedIds: Set<string>): Promise<RepoConfig> {
  const gitArgs = resolveGitArgs(repoPath);

  const branchNames = await git.listBranches(gitArgs);
  if (branchNames.length === 0) throw new Error("repository has no branches");

  const current = await git.currentBranch({ ...gitArgs, fullname: false }).catch(() => undefined);
  const defaultBranch =
    current && branchNames.includes(current)
      ? current
      : (["main", "master"].find((b) => branchNames.includes(b)) ?? branchNames[0]);
  const branches = [defaultBranch, ...branchNames.filter((b) => b !== defaultBranch).sort()];
  console.log(`[gitscope]   ${branches.length} branch(es): ${branches.join(", ")}`);

  const id = uniqueId(path.basename(repoPath.replace(/[/\\]+$/, "")), usedIds);
  return { id, name: id, lang: colorForRepo(id), path: repoPath, branches };
}

async function loadTags(gitArgs: GitArgs): Promise<Map<string, string>> {
  const tagByOid = new Map<string, string>();
  const tagNames = await git.listTags(gitArgs).catch(() => []);
  for (const tag of tagNames) {
    try {
      let oid = await git.resolveRef({ ...gitArgs, ref: `refs/tags/${tag}` });
      // peel annotated tags down to the commit they point at
      for (let i = 0; i < 5; i++) {
        try {
          await git.readCommit({ ...gitArgs, oid });
          break;
        } catch {
          oid = (await git.readTag({ ...gitArgs, oid })).tag.object;
        }
      }
      if (!tagByOid.has(oid)) tagByOid.set(oid, tag);
    } catch {
      // tag doesn't resolve to a commit (e.g. tags a blob/tree) — skip it
    }
  }
  return tagByOid;
}

function getOrCreateAuthor(map: Map<string, Author>, name: string, email: string): Author {
  const key = email || name;
  let a = map.get(key);
  if (!a) {
    a = { name, email, color: colorForAuthor(key), ini: initialsFor(name) };
    map.set(key, a);
  }
  return a;
}

// Building the commit list only needs metadata; entry.commit.changes is absent (includeChanges: false above),
// so files/paths default to empty here. Both the changed-file list and line-level add/del counts are computed
// on demand for a single commit at a time — see getCommitDiff in commit-diff.ts.
function buildCommit(
  repoId: string,
  branch: string,
  entry: LogEntry,
  tagByOid: Map<string, string>,
  authorsByKey: Map<string, Author>,
): Commit {
  const { commit, oid } = entry;
  const changes = (commit.changes ?? []) as [string | null, string | null, string][];

  return {
    i: 0, // reassigned once the full, sorted commit list is known
    hash: oid,
    repo: repoId,
    branch,
    a: getOrCreateAuthor(authorsByKey, commit.author.name, commit.author.email),
    ts: commit.author.timestamp * 1000,
    merge: commit.parent.length > 1,
    subject: commit.message.split("\n")[0],
    files: changes.length,
    tag: tagByOid.get(oid) ?? null,
    paths: changes.map(([, , filepath]) => filepath),
  };
}

export async function diffStats(gitArgs: GitArgs, newOid: string | null, oldOid: string | null) {
  const [oldText, newText] = await Promise.all([blobText(gitArgs, oldOid), blobText(gitArgs, newOid)]);
  if (oldText === null || newText === null) return { add: 0, del: 0 };
  let add = 0;
  let del = 0;
  for (const part of diffLines(oldText, newText)) {
    const lines = part.value.endsWith("\n") ? part.value.split("\n").length - 1 : part.value.split("\n").length;
    if (part.added) add += lines;
    else if (part.removed) del += lines;
  }
  return { add, del };
}

/** Returns null for binary or oversized blobs, "" for a missing side (added/deleted file), else utf-8 text. */
async function blobText(gitArgs: GitArgs, oid: string | null): Promise<string | null> {
  if (!oid) return "";
  const { blob } = await git.readBlob({ ...gitArgs, oid });
  if (blob.length > MAX_DIFF_BYTES || isBinary(blob)) return null;
  return Buffer.from(blob).toString("utf-8");
}

function isBinary(buf: Uint8Array): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) if (buf[i] === 0) return true;
  return false;
}
