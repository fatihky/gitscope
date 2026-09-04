"use client";

import type { RefObject } from "react";

type TopBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onToggleTheme: () => void;
  onToggleDetail: () => void;
  onShowShortcuts: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
};

export function TopBar({
  query,
  onQueryChange,
  onToggleTheme,
  onToggleDetail,
  onShowShortcuts,
  searchInputRef,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="mark">G</span>gitscope <small>/ history &amp; contributions</small>
      </div>
      <div className="vr" />
      <div className="search">
        <span className="ic">⌕</span>
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter message, author, hash, path…"
        />
        <kbd>/</kbd>
      </div>
      <div className="sp" />
      <span className="badge ro">● read-only</span>
      <span className="badge">synced 2m ago</span>
      <button type="button" className="iconbtn" onClick={onToggleDetail} title="Toggle detail panel">
        ▤
      </button>
      <button type="button" className="iconbtn" onClick={onToggleTheme} title="Toggle theme">
        ◐
      </button>
      <button type="button" className="iconbtn" onClick={onShowShortcuts} title="Keyboard shortcuts (?)">
        ⌘
      </button>
    </header>
  );
}
