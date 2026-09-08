import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { diffLines } from "diff";
import { colorForAuthor, colorForRepo, initialsFor } from "./palette";
import type { Author, Commit, RepoConfig, RepoLoadError } from "./types";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

/** Skip line-diffing blobs larger than this (still counted as a changed file). */
const MAX_DIFF_BYTES = 2 * 1024 * 1024;

/** Generous ceiling for `git` stdout — history/blob dumps on large repos can get big. */
const MAX_BUFFER = 256 * 1024 * 1024;

/** Git's built-in empty-tree object, used to diff a root commit (no parent) as an all-additions change. */
export const EMPTY_TREE_OID = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export type GitArgs = { dir: string };

/** Metadata for one commit, as parsed out of native `git log` output — see gitLog(). */
type LogEntry = {
  oid: string;
  parentCount: number;
  authorName: string;
  authorEmail: string;
  authorTimestamp: number; // seconds since epoch
  subject: string;
};

export type RepoConfigsData = {
  repoConfigs: RepoConfig[];
  errors: RepoLoadError[];
};

/** A repo + the branches to walk, as chosen by the UI (order matters — see loadCommitsForRepos). */
export type RepoCommitSelection = {
  id: string;
  path: string;
  branches: string[];
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
  logger.info(`loading ${repoPaths.length} repo(s)...`);

  for (const rawPath of repoPaths) {
    const repoPath = path.resolve(process.cwd(), rawPath);
    try {
      const repo = await loadRepoConfig(repoPath, usedIds);
      repoConfigs.push(repo);
      logger.info(
        `loaded repo config ${repo.id}: ${repo.branches.length} branch(es)`,
      );
    } catch (err) {
      logger.error(`failed to load repo ${repoPath}`, err);
      errors.push({
        path: repoPath,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info(`repo configs done in ${Date.now() - start}ms`);

  return { repoConfigs, errors };
}

/**
 * Commit load, run after the initial page load once the UI knows which repos/branches/date range
 * it wants. `since` limits how far back each branch is walked (there's no matching `until`, so an
 * upper bound on the range still has to be applied client-side).
 *
 * Everything here shells out to the native `git` binary rather than a JS git implementation:
 * history/blob/tag walking in pure JS is an order of magnitude slower than the real thing for repos
 * with thousands of commits.
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

    // Walk branches in order, assigning each commit to the first (i.e. default-most) branch that
    // reaches it. `--not <already-walked branches>` pushes that exclusion into git itself, so each
    // branch after the first only walks its own divergent commits instead of re-walking history it
    // shares with earlier branches — the dominant cost once there are many branches.
    let count = 0;
    const walkedBranches: string[] = [];
    for (const branch of branches) {
      const log = await gitLog(gitArgs, branch, since, walkedBranches);
      for (const entry of log) {
        commits.push(buildCommit(id, branch, entry, tagByOid, authorsByKey));
        count++;
      }
      walkedBranches.push(branch);
    }
    logger.info(
      `loaded ${count} commit(s) for ${id} in ${Date.now() - repoStart}ms`,
    );
  }

  commits.sort((a, b) => b.ts - a.ts);
  commits.forEach((c, i) => {
    c.i = i;
  });

  logger.info(
    `commit load done in ${Date.now() - start}ms (${commits.length} commits total)`,
  );

  return {
    commits,
    authors: Array.from(authorsByKey.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}

/**
 * `git -C <path>` auto-detects whether `<path>` is a normal working copy or a bare repo, so this is
 * just a light normalization step (kept as its own function/type for a stable call-site shape).
 */
export function resolveGitArgs(repoPath: string): GitArgs {
  return { dir: repoPath };
}

/** Runs `git <args>` against a repo, returning trimmed-nothing stdout as text. */
export async function runGit(
  gitArgs: GitArgs,
  args: string[],
): Promise<string> {
  const start = Date.now();
  const { stdout } = await execFileAsync("git", ["-C", gitArgs.dir, ...args], {
    maxBuffer: MAX_BUFFER,
  });
  logger.debug(
    `${describeGitCommand(gitArgs.dir, args)} → ${Date.now() - start}ms, ${stdout.length} chars`,
  );
  return stdout;
}

/** Same as runGit, but returns raw stdout bytes (for blob contents, which may not be UTF-8/text at all). */
async function runGitBuffer(gitArgs: GitArgs, args: string[]): Promise<Buffer> {
  const start = Date.now();
  const { stdout } = await execFileAsync("git", ["-C", gitArgs.dir, ...args], {
    maxBuffer: MAX_BUFFER,
    encoding: "buffer",
  });
  const buf = stdout as unknown as Buffer;
  logger.debug(
    `${describeGitCommand(gitArgs.dir, args)} → ${Date.now() - start}ms, ${buf.length} bytes`,
  );
  return buf;
}

/**
 * Renders a `git` invocation as one readable line for debug logs. Git's field/record separators
 * (see LOG_FORMAT) are raw control chars that would garble the terminal, so they're escaped here.
 */
function describeGitCommand(dir: string, args: string[]): string {
  const rendered = args.map((arg) =>
    arg.replace(/\x1f/g, "\\x1f").replace(/\x1e/g, "\\x1e"),
  );
  return `git -C ${dir} ${rendered.join(" ")}`;
}

// Field/record separators for git's --pretty=format: control chars that can't appear in the fields
// themselves (author name/email/subject), so a naive split is safe.
const FIELD_SEP = "\x1f";
const RECORD_SEP = "\x1e";
const LOG_FORMAT =
  ["%H", "%P", "%an", "%ae", "%at", "%s"].join(FIELD_SEP) + RECORD_SEP;

/**
 * Walks `ref`'s history (all metadata, no diffs) via the native `git log` binary, excluding
 * anything already reachable from `excludeRefs` (see the `--not` docs in `git log --help`).
 */
async function gitLog(
  gitArgs: GitArgs,
  ref: string,
  since: Date | null,
  excludeRefs: string[] = [],
): Promise<LogEntry[]> {
  const args = ["log", ref];
  if (excludeRefs.length > 0) args.push("--not", ...excludeRefs);
  args.push(`--pretty=format:${LOG_FORMAT}`);
  if (since) args.push(`--since=${since.toISOString()}`);

  const stdout = await runGit(gitArgs, args);
  return stdout
    .split(RECORD_SEP)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((record) => {
      const [oid, parents, authorName, authorEmail, authorTimestamp, subject] =
        record.split(FIELD_SEP);
      return {
        oid,
        parentCount: parents ? parents.split(" ").filter(Boolean).length : 0,
        authorName,
        authorEmail,
        authorTimestamp: Number(authorTimestamp),
        subject,
      };
    });
}

function uniqueId(base: string, usedIds: Set<string>): string {
  let id = base || "repo";
  let n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return id;
}

async function loadRepoConfig(
  repoPath: string,
  usedIds: Set<string>,
): Promise<RepoConfig> {
  const gitArgs = resolveGitArgs(repoPath);

  const branchNames = await listBranches(gitArgs);
  if (branchNames.length === 0) throw new Error("repository has no branches");

  const current = await currentBranch(gitArgs).catch(() => undefined);
  const defaultBranch =
    current && branchNames.includes(current)
      ? current
      : (["main", "master"].find((b) => branchNames.includes(b)) ??
        branchNames[0]);
  const branches = [
    defaultBranch,
    ...branchNames.filter((b) => b !== defaultBranch).sort(),
  ];
  logger.info(
    `  ${branches.length} branch(es): ${branches.join(", ")}`,
  );

  const id = uniqueId(path.basename(repoPath.replace(/[/\\]+$/, "")), usedIds);
  const remoteUrl = await loadRemoteUrl(gitArgs);
  return {
    id,
    name: id,
    lang: colorForRepo(id),
    path: repoPath,
    branches,
    remoteUrl,
  };
}

async function listBranches(gitArgs: GitArgs): Promise<string[]> {
  const stdout = await runGit(gitArgs, [
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads",
  ]);
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Short name of the branch HEAD points to, or undefined for a detached HEAD. */
async function currentBranch(gitArgs: GitArgs): Promise<string | undefined> {
  const stdout = await runGit(gitArgs, [
    "symbolic-ref",
    "--short",
    "-q",
    "HEAD",
  ]);
  return stdout.trim() || undefined;
}

/** Reads the origin remote and normalizes it to a browsable https URL, or null if there isn't one. */
async function loadRemoteUrl(gitArgs: GitArgs): Promise<string | null> {
  const url = await runGit(gitArgs, [
    "config",
    "--get",
    "remote.origin.url",
  ]).catch(() => undefined);
  if (!url) return null;
  return normalizeRemoteUrl(url.trim());
}

/**
 * Normalizes common origin URL forms to an https browse URL, e.g.:
 * `git@host:org/repo.git`, `https://host/org/repo.git`, `ssh://git@host/org/repo.git` -> `https://host/org/repo`
 */
function normalizeRemoteUrl(url: string): string | null {
  const scpMatch = url.match(/^[\w-]+@([^:]+):(.+?)(?:\.git)?$/);
  if (scpMatch) return `https://${scpMatch[1]}/${scpMatch[2]}`;

  const sshMatch = url.match(/^ssh:\/\/[\w-]+@([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) return `https://${sshMatch[1]}/${sshMatch[2]}`;

  const httpsMatch = url.match(/^https:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/);
  if (httpsMatch) return `https://${httpsMatch[1]}/${httpsMatch[2]}`;

  return null;
}

async function listTagNames(gitArgs: GitArgs): Promise<string[]> {
  const stdout = await runGit(gitArgs, [
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/tags",
  ]);
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadTags(gitArgs: GitArgs): Promise<Map<string, string>> {
  const tagByOid = new Map<string, string>();
  const tagNames = await listTagNames(gitArgs).catch(() => []);
  for (const tag of tagNames) {
    try {
      // `^{commit}` peels annotated tags (recursively) down to the commit they point at; it fails
      // for tags that ultimately point at something else (e.g. a blob/tree), which we skip below.
      const oid = (
        await runGit(gitArgs, ["rev-parse", `refs/tags/${tag}^{commit}`])
      ).trim();
      if (!tagByOid.has(oid)) tagByOid.set(oid, tag);
    } catch {
      // tag doesn't resolve to a commit (e.g. tags a blob/tree) — skip it
    }
  }
  return tagByOid;
}

function getOrCreateAuthor(
  map: Map<string, Author>,
  name: string,
  email: string,
): Author {
  const key = email || name;
  let a = map.get(key);
  if (!a) {
    a = { name, email, color: colorForAuthor(key), ini: initialsFor(name) };
    map.set(key, a);
  }
  return a;
}

// Building the commit list only needs metadata, not diffs — files/paths default to empty here.
// Both the changed-file list and line-level add/del counts are computed on demand for a single
// commit at a time — see getCommitDiff in commit-diff.ts.
function buildCommit(
  repoId: string,
  branch: string,
  entry: LogEntry,
  tagByOid: Map<string, string>,
  authorsByKey: Map<string, Author>,
): Commit {
  return {
    i: 0, // reassigned once the full, sorted commit list is known
    hash: entry.oid,
    repo: repoId,
    branch,
    a: getOrCreateAuthor(authorsByKey, entry.authorName, entry.authorEmail),
    ts: entry.authorTimestamp * 1000,
    merge: entry.parentCount > 1,
    subject: entry.subject,
    files: 0,
    tag: tagByOid.get(entry.oid) ?? null,
    paths: [],
  };
}

export async function diffStats(
  gitArgs: GitArgs,
  newOid: string | null,
  oldOid: string | null,
) {
  const [oldText, newText] = await Promise.all([
    blobText(gitArgs, oldOid),
    blobText(gitArgs, newOid),
  ]);
  if (oldText === null || newText === null) return { add: 0, del: 0 };
  let add = 0;
  let del = 0;
  for (const part of diffLines(oldText, newText)) {
    const lines = part.value.endsWith("\n")
      ? part.value.split("\n").length - 1
      : part.value.split("\n").length;
    if (part.added) add += lines;
    else if (part.removed) del += lines;
  }
  return { add, del };
}

/** Returns null for binary or oversized blobs, "" for a missing side (added/deleted file), else utf-8 text. */
async function blobText(
  gitArgs: GitArgs,
  oid: string | null,
): Promise<string | null> {
  if (!oid) return "";
  const blob = await runGitBuffer(gitArgs, ["cat-file", "-p", oid]);
  if (blob.length > MAX_DIFF_BYTES || isBinary(blob)) return null;
  return blob.toString("utf-8");
}

function isBinary(buf: Uint8Array): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) if (buf[i] === 0) return true;
  return false;
}
