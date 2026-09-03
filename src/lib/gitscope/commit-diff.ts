"use server";

import git from "isomorphic-git";
import { diffStats, resolveGitArgs } from "./git-source";

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
export async function getCommitDiff(repoPath: string, hash: string): Promise<CommitDiff> {
  const gitArgs = resolveGitArgs(repoPath);
  const [entry] = await git.log({ ...gitArgs, ref: hash, depth: 1, includeChanges: true });
  const rawChanges = (entry.commit.changes ?? []) as [string | null, string | null, string][];

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
