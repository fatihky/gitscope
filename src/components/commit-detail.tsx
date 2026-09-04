"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { getCommitDiff } from "@/lib/gitscope/commit-diff";
import type { CommitDiff } from "@/lib/gitscope/commit-diff";
import { full } from "@/lib/gitscope/format";
import type { Commit, RepoConfig } from "@/lib/gitscope/types";

type CommitDetailProps = {
  commit: Commit | undefined;
  repoById: Record<string, RepoConfig>;
  onClose: () => void;
};

export function CommitDetail({ commit, repoById, onClose }: CommitDetailProps) {
  return (
    <aside className="detail">
      <div className="pane-hd">
        <span>Commit detail</span>
        <div className="sp" />
        <span className="cnt">j / k</span>
        <button type="button" className="closebtn" onClick={onClose} title="Close commit detail panel">
          ✕
        </button>
      </div>
      <div className="dbody">
        {commit ? (
          <CommitDetailBody commit={commit} repo={repoById[commit.repo]} />
        ) : (
          <div className="hint">Select a commit to inspect metadata, message and changed files.</div>
        )}
      </div>
    </aside>
  );
}

const SECTIONS = ["commit", "authorship", "message", "files"] as const;
type SectionKey = (typeof SECTIONS)[number];

function CommitDetailBody({ commit: c, repo }: { commit: Commit; repo: RepoConfig }) {
  const signOff = `Signed-off-by: ${c.a.name} <${c.a.email}>`;
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    commit: true,
    authorship: true,
    message: true,
    files: true,
  });
  const toggle = (key: SectionKey) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const [copied, setCopied] = useState<string | null>(null);
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  };

  const [diff, setDiff] = useState<CommitDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDiff(null);
    setDiffError(null);
    getCommitDiff(repo.path, c.hash)
      .then((d) => {
        if (!cancelled) setDiff(d);
      })
      .catch((err) => {
        if (!cancelled) setDiffError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [repo.path, c.hash]);

  return (
    <>
      <div className="acts">
        <button type="button" className="btn" title="Copy full SHA" onClick={() => copyToClipboard(c.hash, "sha")}>
          {copied === "sha" ? "✓ Copied" : "⧉ SHA"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!repo.remoteUrl}
          title={repo.remoteUrl ? undefined : "No remote configured"}
          onClick={() => window.open(`${repo.remoteUrl}/commit/${c.hash}`, "_blank", "noopener,noreferrer")}
        >
          ↗ Open in remote
        </button>
      </div>
      <DetailSection title="Commit" open={open.commit} onToggle={() => toggle("commit")}>
        <div className="kv">
          <span className="k">SHA</span>
          <span className="v mono hash">
            {c.hash}
            <button
              type="button"
              className="copy-inline"
              title="Copy full SHA"
              onClick={() => copyToClipboard(c.hash, "full-hash")}
            >
              {copied === "full-hash" ? "✓" : "⧉"}
            </button>
          </span>
          <span className="k">Parents</span>
          <span className="v mono">
            {c.hash.slice(7, 14)}
            <button
              type="button"
              className="copy-inline"
              title="Copy short SHA"
              onClick={() => copyToClipboard(c.hash.slice(7, 14), "short-hash")}
            >
              {copied === "short-hash" ? "✓" : "⧉"}
            </button>
            {c.merge && (
              <>
                {" "}· {c.hash.slice(14, 21)}
                <button
                  type="button"
                  className="copy-inline"
                  title="Copy second parent SHA"
                  onClick={() => copyToClipboard(c.hash.slice(14, 21), "parent2-hash")}
                >
                  {copied === "parent2-hash" ? "✓" : "⧉"}
                </button>
              </>
            )}
          </span>
          <span className="k">Repository</span>
          <span className="v">
            {repo.name} <span className="cnt">{repo.path}</span>
          </span>
          <span className="k">Refs</span>
          <span className="v">
            <span className="bchip">⑂ {c.branch}</span> {c.tag && <span className="vchip">⌾ {c.tag}</span>}
          </span>
          <span className="k">Type</span>
          <span className="v">{c.merge ? "merge commit (2 parents)" : "regular commit"}</span>
        </div>
      </DetailSection>
      <DetailSection title="Authorship" open={open.authorship} onToggle={() => toggle("authorship")}>
        <div className="kv">
          <span className="k">Author</span>
          <span className="v">
            <span className="av" style={{ background: c.a.color, display: "inline-grid", verticalAlign: -3 }}>
              {c.a.ini}
            </span>{" "}
            {c.a.name} &lt;{c.a.email}&gt;
          </span>
          <span className="k">Authored</span>
          <span className="v mono">{full(c.ts)}</span>
          <span className="k">Committed</span>
          <span className="v mono">{full(c.ts + 60000)}</span>
        </div>
      </DetailSection>
      <DetailSection title="Message" open={open.message} onToggle={() => toggle("message")}>
        <div className="cmsg">
          <span className="h1">
            {c.subject}
            <button
              type="button"
              className="copy-inline"
              title="Copy commit message"
              onClick={() => copyToClipboard(c.subject, "message")}
            >
              {copied === "message" ? "✓" : "⧉"}
            </button>
          </span>
          {!c.merge && `Refs #${3000 + (c.i % 900)}\n\n`}
          {signOff}
        </div>
      </DetailSection>
      <DetailSection
        title="Changed files"
        open={open.files}
        onToggle={() => toggle("files")}
        style={{ padding: "8px 0" }}
        headerStyle={{ padding: "0 10px" }}
        headerExtra={
          <>
            {" "}
            <span className="cnt">{c.files}</span>
            {diff && (
              <span style={{ float: "right" }}>
                <span className="add">+{diff.add}</span> <span className="del">−{diff.del}</span>
              </span>
            )}
          </>
        }
      >
        <div className="files">
          {diff ? (
            diff.changes.map((f) => (
              <div className="f" key={f.path}>
                <span className={`st ${f.status}`}>{f.status}</span>
                <span className="p" title={f.path}>
                  {f.path}
                </span>
                <span className="mono">
                  <span className="add">+{f.add}</span> <span className="del">−{f.del}</span>
                </span>
              </div>
            ))
          ) : diffError ? (
            <div className="hint">Failed to load diff: {diffError}</div>
          ) : (
            <div className="hint">Loading diff…</div>
          )}
        </div>
      </DetailSection>
    </>
  );
}

type DetailSectionProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  headerExtra?: ReactNode;
  style?: CSSProperties;
  headerStyle?: CSSProperties;
  children: ReactNode;
};

function DetailSection({ title, open, onToggle, headerExtra, style, headerStyle, children }: DetailSectionProps) {
  return (
    <div className={`dsec ${open ? "open" : ""}`} style={style}>
      <div className="dsub" style={headerStyle} onClick={onToggle}>
        <span className={`tw ${open ? "open" : ""}`}>▶</span> {title}
        {headerExtra}
      </div>
      <div className="sec-body">{children}</div>
    </div>
  );
}
