"use server";

import type { GitArgs } from "./git-source";
import {
  diffStats,
  EMPTY_TREE_OID,
  resolveGitArgs,
  runGit,
} from "./git-source";

export type FileChange = {
  path: string;
  status: "A" | "M" | "D";
  add: number;
  del: number;
};

export type CommitDiff = {
  files: number;
  add: number;
  del: number;
  changes: FileChange[];
};

/** Full line-level diff analysis for a single commit, computed on demand (see git-source.ts for why). */
export async function getCommitDiff(
  repoPath: string,
  hash: string,
): Promise<CommitDiff> {
  const gitArgs = resolveGitArgs(repoPath);
  const rawChanges = await diffTreeRaw(gitArgs, hash);

  const changes = await Promise.all(
    rawChanges.map(async ([newOid, oldOid, filepath]) => {
      const status: FileChange["status"] = !oldOid ? "A" : !newOid ? "D" : "M";
      const { add, del } = await diffStats(gitArgs, newOid, oldOid);
      return { path: filepath, status, add, del };
    }),
  );

  return {
    files: changes.length,
    add: changes.reduce((s, f) => s + f.add, 0),
    del: changes.reduce((s, f) => s + f.del, 0),
    changes,
  };
}

const ZERO_OID_RE = /^0+$/;

/**
 * Changed files for one commit, diffed against its first parent only — a merge commit's diff
 * against its other parents is ignored, matching the previous isomorphic-git-based behavior. Root
 * commits (no parent) are diffed against git's empty-tree object instead.
 */
async function diffTreeRaw(
  gitArgs: GitArgs,
  hash: string,
): Promise<[string | null, string | null, string][]> {
  const args = ["diff-tree", "-r", "--raw", "-z", "--no-commit-id"];
  let stdout: string;
  try {
    stdout = await runGit(gitArgs, [...args, `${hash}^`, hash]);
  } catch {
    // no `^` parent — root commit
    stdout = await runGit(gitArgs, [...args, EMPTY_TREE_OID, hash]);
  }

  // Raw format, NUL-separated: ":<old mode> <new mode> <old oid> <new oid> <status>\0<path>\0" per file.
  const tokens = stdout.split("\0").filter(Boolean);
  const changes: [string | null, string | null, string][] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const [, , oldOid, newOid] = tokens[i].split(" ");
    changes.push([
      ZERO_OID_RE.test(newOid) ? null : newOid,
      ZERO_OID_RE.test(oldOid) ? null : oldOid,
      tokens[i + 1],
    ]);
  }
  return changes;
}
