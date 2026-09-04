"use client";

import { useEffect } from "react";

type ShortcutsModalProps = {
  open: boolean;
  onClose: () => void;
};

const SHORTCUTS: [string, string][] = [
  ["/", "Focus search"],
  ["Esc", "Blur search"],
  ["j", "Select next commit"],
  ["k", "Select previous commit"],
  ["?", "Toggle this help"],
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="pane-hd">
          <span>Keyboard shortcuts</span>
          <div className="sp" />
          <button type="button" className="closebtn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {SHORTCUTS.map(([key, desc]) => (
            <div className="shortcut-row" key={key}>
              <kbd>{key}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
