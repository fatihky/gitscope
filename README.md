## gitscope

A local, read-only dashboard for browsing git history, contributions, and activity across one or
more repositories on your filesystem. Point it at your repos via an env var, and it walks their
commit history directly with [isomorphic-git](https://isomorphic-git.org/) — no GitHub/GitLab API,
no cloning, no server-side database.

## Features

- **Multi-repo, multi-branch browsing** — configure any number of local repos; toggle repos and
  individual branches on/off from the sidebar. Commits are deduped across branches (each commit is
  attributed to the first/default-most branch that reaches it).
- **Commit list** with a detail panel showing full metadata, authorship, commit message, and
  changed files with per-file add/delete line counts (computed on demand from the blob diff). Jump
  to the commit on the remote host (GitHub/GitLab/etc.) when a repo has an `origin` remote.
- **Filtering** — free-text search over subject, author name, hash prefix, and file paths; filter
  by author, include/exclude merge commits, sort newest/oldest first.
- **Date scoping** — global date range with quick presets (configurable day-count chips, "Prev
  workday", "All", or a custom range), or switch to per-repository scope to override the range for
  individual repos.
- **Contributions view** — KPI summary (commits, authors, files touched, active days), a top
  contributors leaderboard, and a per-repo/branch breakdown.
- **Activity view** — a GitHub-style commit heatmap (last ~53 weeks), a weekday × hour punchcard,
  and commit volume over time.
- **Copy filtered results** — copy the currently filtered commit list, or a single commit's SHA, to
  the clipboard, optionally including each commit's full diff (`git show` output).
- **Shareable links** — filter state (date preset/range, author, sort) is kept in the URL query
  string, so a filtered view can be bookmarked or shared.
- **JSON API** — `GET /api/commits` returns the same filtered commit data as JSON, for scripting or
  external tooling (see query params documented in `src/app/api/commits/route.ts`).
- **Keyboard shortcuts** — `/` focuses search, `j`/`k` move the commit selection up/down, `Esc`
  blurs search.
- **Light/dark theme**, persisted in `localStorage`.
- **Read-only** — gitscope only reads repository data; it never writes to the repos it points at.

## Getting started

Configure which local repositories to load via env vars (see `.env-example`):

```bash
# Comma-separated paths to local git repositories (bare or non-bare).
GITSCOPE_REPOS=/path/to/repo-a,/path/to/repo-b

# Optional: date-range preset chips, in days, comma-separated. Defaults to 7,30,90,365.
GITSCOPE_RANGE_PRESETS=7,30,90,365
```

Then run the dev server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## Tech stack

Next.js (App Router) + React, with [isomorphic-git](https://isomorphic-git.org/) for reading
repository data straight off disk, [nuqs](https://nuqs.dev/) for URL-synced filter state, and
Tailwind CSS for styling.

Commit filtering (date `to`, author, merges, free-text search) runs entirely client-side over the
already-fetched commit list — isomorphic-git's `log()` only supports a `since` lower bound, so
that's the only filter pushed server-side, and only when the UI asks for a range wider than what's
already loaded. See `agents-memory.md` for details.
