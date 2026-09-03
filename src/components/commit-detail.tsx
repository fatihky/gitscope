"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { full } from "@/lib/gitscope/format";
import { REPO_BY_ID } from "@/lib/gitscope/mock-data";
import type { Commit } from "@/lib/gitscope/types";

type CommitDetailProps = {
  commit: Commit | undefined;
  onClose: () => void;
};

export function CommitDetail({ commit, onClose }: CommitDetailProps) {
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
          <CommitDetailBody commit={commit} />
        ) : (
          <div className="hint">Select a commit to inspect metadata, message and changed files.</div>
        )}
      </div>
    </aside>
  );
}

const SECTIONS = ["commit", "authorship", "message", "files"] as const;
type SectionKey = (typeof SECTIONS)[number];

function CommitDetailBody({ commit: c }: { commit: Commit }) {
  const repo = REPO_BY_ID[c.repo];
  const signOff = `Signed-off-by: ${c.a.name} <${c.a.email}>`;
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    commit: true,
    authorship: true,
    message: true,
    files: true,
  });
  const toggle = (key: SectionKey) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  return (
    <>
      <div className="acts">
        <button type="button" className="btn" title="Copy full SHA">
          ⧉ SHA
        </button>
        <button type="button" className="btn">
          ↗ Open in remote
        </button>
        <button type="button" className="btn" disabled title="Disabled in read-only mode">
          ⤓ Checkout
        </button>
      </div>
      <DetailSection title="Commit" open={open.commit} onToggle={() => toggle("commit")}>
        <div className="kv">
          <span className="k">SHA</span>
          <span className="v mono hash">{c.hash}</span>
          <span className="k">Parents</span>
          <span className="v mono">
            {c.hash.slice(7, 14)}
            {c.merge ? ` · ${c.hash.slice(14, 21)}` : ""}
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
          <span className="h1">{c.subject}</span>
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
            <span style={{ float: "right" }}>
              <span className="add">+{c.add}</span> <span className="del">−{c.del}</span>
            </span>
          </>
        }
      >
        <div className="files">
          {c.paths.map((p, k) => {
            const st = k % 9 === 0 ? "A" : k % 13 === 0 ? "D" : "M";
            const a = st === "D" ? 0 : Math.ceil((c.add / c.paths.length) * (1 + (k % 3) / 2));
            const d = st === "A" ? 0 : Math.ceil((c.del / c.paths.length) * (1 + (k % 2) / 2));
            return (
              <div className="f" key={`${p}-${k}`}>
                <span className={`st ${st}`}>{st}</span>
                <span className="p" title={p}>
                  {p}
                </span>
                <span className="mono">
                  <span className="add">+{a}</span> <span className="del">−{d}</span>
                </span>
              </div>
            );
          })}
          {c.files > c.paths.length && <div className="hint">+ {c.files - c.paths.length} more files…</div>}
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
