"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_EXPORT_FORMAT, formatCommit } from "@/lib/gitscope/format";
import type { Commit } from "@/lib/gitscope/types";

type ExportFormatModalProps = {
  open: boolean;
  onClose: () => void;
  format: string;
  onFormatChange: (value: string) => void;
  sampleCommits: Commit[];
  repoById: Record<string, { name: string }>;
};

const TOKENS: [string, string][] = [
  ["{repo}", "Repository name"],
  ["{date}", "Full date and time"],
  ["{author}", "Author name"],
  ["{subject}", "Commit subject line"],
  ["{hash}", "Full commit hash"],
  ["{shortHash}", "Short (7-char) commit hash"],
];

export function ExportFormatModal({
  open,
  onClose,
  format,
  onFormatChange,
  sampleCommits,
  repoById,
}: ExportFormatModalProps) {
  const [draft, setDraft] = useState(format);
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorPos = useRef<number | null>(null);

  useEffect(() => {
    if (open) setDraft(format);
  }, [open, format]);

  useEffect(() => {
    if (!open) return;
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  if (!open) return null;

  const isDefault = draft === DEFAULT_EXPORT_FORMAT;
  const preview = sampleCommits.slice(0, 3).map((c) => ({
    text: formatCommit(draft, c, repoById[c.repo]?.name ?? c.repo),
    key: c.hash,
  }));

  const apply = () => {
    onFormatChange(draft);
    onClose();
  };

  const resetToDefault = () => {
    setDraft(DEFAULT_EXPORT_FORMAT);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal export-fmt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pane-hd">
          <span>Export format</span>
          <div className="sp" />
          <button type="button" className="closebtn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <label className="ef-label">Template</label>
          <input
            ref={inputRef}
            className="dtin ef-input"
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              cursorPos.current = e.target.selectionStart;
            }}
            onSelect={(e) => {
              cursorPos.current = (e.target as HTMLInputElement).selectionStart;
            }}
            autoFocus
          />
          <div className="ef-tokens">
            <span className="ef-tokens-title">Available tokens</span>
            <div className="ef-token-grid">
              {TOKENS.map(([token, desc]) => (
                <button
                  key={token}
                  type="button"
                  className="ef-token-chip"
                  title={`Insert ${token}`}
                  onClick={() => {
                    const pos = cursorPos.current ?? draft.length;
                    const next = draft.slice(0, pos) + token + draft.slice(pos);
                    setDraft(next);
                    cursorPos.current = pos + token.length;
                    requestAnimationFrame(() => {
                      inputRef.current?.setSelectionRange(cursorPos.current!, cursorPos.current!);
                      inputRef.current?.focus();
                    });
                  }}
                >
                  <code>{token}</code>
                  <span>{desc}</span>
                </button>
              ))}
            </div>
          </div>
          {preview.length > 0 && (
            <div className="ef-preview">
              <span className="ef-preview-title">Preview</span>
              {preview.map((p) => (
                <div key={p.key} className="ef-preview-line">
                  {p.text}
                </div>
              ))}
            </div>
          )}
          <div className="ef-actions">
            <button type="button" className="btn" disabled={isDefault} onClick={resetToDefault}>
              Reset to default
            </button>
            <div className="sp" />
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn ef-apply" onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
