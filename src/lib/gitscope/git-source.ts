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

export type GitScopeData = {
  repoConfigs: RepoConfig[];
  commits: Commit[];
  authors: Author[];
  errors: RepoLoadError[];
};

/** Repository paths configured via the GITSCOPE_REPOS env var (comma-separated). */
export function getConfiguredRepoPaths(): string[] {
  const raw = process.env.GITSCOPE_REPOS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export async function loadGitScopeData(): Promise<GitScopeData> {
  const repoConfigs: RepoConfig[] = [];
  const commits: Commit[] = [];
  const errors: RepoLoadError[] = [];
  const authorsByKey = new Map<string, Author>();
  const usedIds = new Set<string>();

  const repoPaths = getConfiguredRepoPaths();
  const start = Date.now();
  console.log(`[gitscope] loading ${repoPaths.length} repo(s)...`);

  for (const rawPath of repoPaths) {
    const repoPath = path.resolve(process.cwd(), rawPath);
    const repoStart = Date.now();
    console.log(`[gitscope] loading repo: ${repoPath}`);
    try {
      const { repo, repoCommits } = await loadRepo(repoPath, usedIds, authorsByKey);
      repoConfigs.push(repo);
      commits.push(...repoCommits);
      console.log(`[gitscope] loaded repo ${repo.id}: ${repoCommits.length} commits in ${Date.now() - repoStart}ms`);
    } catch (err) {
      console.log(`[gitscope] failed to load repo ${repoPath} after ${Date.now() - repoStart}ms`, err);
      errors.push({ path: repoPath, message: err instanceof Error ? err.message : String(err) });
    }
  }

  commits.sort((a, b) => b.ts - a.ts);
  commits.forEach((c, i) => {
    c.i = i;
  });

  console.log(`[gitscope] done in ${Date.now() - start}ms (${commits.length} commits total)`);

  return {
    repoConfigs,
    commits,
    authors: Array.from(authorsByKey.values()).sort((a, b) => a.name.localeCompare(b.name)),
    errors,
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

async function loadRepo(
  repoPath: string,
  usedIds: Set<string>,
  authorsByKey: Map<string, Author>,
): Promise<{ repo: RepoConfig; repoCommits: Commit[] }> {
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

  const tagByOid = await loadTags(gitArgs);
  console.log(`[gitscope]   ${tagByOid.size} tag(s)`);

  // Walk branches in order, assigning each commit to the first (i.e. default-most) branch that reaches it.
  const claimed = new Set<string>();
  const pending: { oid: string; branch: string }[] = [];
  for (const branch of branches) {
    const log = await git.log({ ...gitArgs, ref: branch });
    for (const entry of log) {
      if (claimed.has(entry.oid)) continue;
      claimed.add(entry.oid);
      pending.push({ oid: entry.oid, branch });
    }
  }
  console.log(`[gitscope]   ${pending.length} commit(s) to process...`);

  const id = uniqueId(path.basename(repoPath.replace(/[/\\]+$/, "")), usedIds);
  const repoCommits: Commit[] = [];
  for (const { oid, branch } of pending) {
    // depth: 1 from a commit oid re-walks just that commit, with `changes` diffed against its first parent.
    const [entry] = await git.log({ ...gitArgs, ref: oid, depth: 1, includeChanges: true });
    repoCommits.push(buildCommit(id, branch, entry, tagByOid, authorsByKey));
    if (repoCommits.length % 50 === 0) {
      console.log(`[gitscope]   ...${repoCommits.length}/${pending.length} commits processed`);
    }
  }

  return {
    repo: { id, name: id, lang: colorForRepo(id), path: repoPath, branches },
    repoCommits,
  };
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

// Building the commit list only needs metadata + the changed-file list (both cheap, from tree comparison).
// Line-level add/del counts require reading full blob content and diffing it, so that analysis is done
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
