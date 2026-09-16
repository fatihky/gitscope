## gitscope

A local, read-only dashboard for browsing git history, contributions, and activity across one or
more repositories on your filesystem. Point it at your repos via an env var, and it walks their
commit history directly with your local `git` binary — no GitHub/GitLab API, no cloning, no
server-side database.

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
  the clipboard, optionally including each commit's full diff (`git show` output). The per-commit
  line format is a customizable template with `{repo}`, `{date}`, `{author}`, `{subject}`, `{hash}`
  and `{shortHash}` tokens.
- **Persistent filters** — filter state (date preset/range, author, merges, sort, search) is saved
  to `localStorage` and survives reloads; a "Clear filters" link resets everything to defaults.
- **JSON API** — `GET /api/commits` returns the same filtered commit data as JSON, for scripting or
  external tooling. Query params: `preset`/`from`/`to`, `author`, `merges`, `q`, `sort`, `repos`,
  `branches` (see `src/pages/_api/api/commits.ts`).
- **Keyboard shortcuts** — `/` focuses search, `j`/`k` move the commit selection up/down, `Esc`
  blurs search, `?` shows the shortcut list.
- **Light/dark theme**, persisted in `localStorage`.
- **Read-only** — gitscope only reads repository data; it never writes to the repos it points at.

## Install

gitscope is published to npm as `@fatihky/gitscope`:

```bash
npm install -g @fatihky/gitscope
GITSCOPE_REPOS=/path/to/repo-a,/path/to/repo-b gitscope
```

or run it without installing:

```bash
GITSCOPE_REPOS=/path/to/repo-a npx @fatihky/gitscope
```

CLI options:

```
-p, --port <port>      Port to listen on (default: 3000, env: PORT)
    --hostname <host>  Hostname to bind to (default: 0.0.0.0, env: HOSTNAME)
-h, --help             Show help
```

## Configuration

Requires `git` on your `PATH`.

Configure which local repositories to load via env vars (see `.env-example`):

```bash
# Comma-separated paths to local git repositories (bare or non-bare).
GITSCOPE_REPOS=/path/to/repo-a,/path/to/repo-b

# Optional: date-range preset chips, in days, comma-separated. Defaults to 7,30,90,365.
GITSCOPE_RANGE_PRESETS=7,30,90,365

# Optional: log verbosity (debug | info | warn | error). Defaults to info.
# `debug` traces each git command with its duration — useful for investigating slow loads.
GITSCOPE_LOG_LEVEL=info
```

## Development

```bash
pnpm install
pnpm dev        # Waku dev server on http://localhost:3000
pnpm build      # production build into dist/
pnpm start      # serve the production build
pnpm lint       # Biome
```

For local development, put the env vars above in a `.env` file (copy `.env-example`).

## Tech stack

[Waku](https://waku.gg) + React 19 (with the React Compiler), with the native `git` CLI for
reading repository data straight off disk, filter state memorized in `localStorage`, and Tailwind
CSS for styling.

Commit filtering (date `to`, author, merges, free-text search) runs entirely client-side over the
already-fetched commit list. Only the `since` lower bound is pushed server-side (`git log --since`),
and only when the UI asks for a range wider than what's already loaded. See `agents-memory.md` for
details.
