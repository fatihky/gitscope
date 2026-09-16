## gitscope

A local, read-only dashboard for your git history. No GitHub API, no cloning, no database. It just
reads your repos with your local `git`.

```bash
GITSCOPE_REPOS=/path/to/repo-a,/path/to/repo-b npx @fatihky/gitscope
```

Then open http://localhost:3000.

## Features

- **Multiple repos and branches**: turn each one on or off from the sidebar
- **Commits**: search, filter by author or date, and see the changed files in each commit
- **Contributions**: KPIs, top contributors, and a breakdown per repo
- **Activity**: a GitHub-style heatmap, a punchcard, and commit volume over time
- **Copy**: copy filtered commits to the clipboard, with or without diffs, using a custom template
- **JSON API**: `GET /api/commits` returns the same filtered data
- **Keyboard shortcuts**: `/` search, `j`/`k` move between commits, `?` shows all shortcuts

## Install

```bash
npm install -g @fatihky/gitscope
GITSCOPE_REPOS=/path/to/repo gitscope --port 3000
```

Requires `git` on your `PATH`. Run `gitscope --help` to see all options.

## Configuration

| Env var                  | Default          | What it does                          |
| ------------------------ | ---------------- | ------------------------------------- |
| `GITSCOPE_REPOS`         | (required)       | Comma-separated local repo paths      |
| `GITSCOPE_RANGE_PRESETS` | `7,30,90,365`    | Day counts for the date-range chips   |
| `GITSCOPE_LOG_LEVEL`     | `info`           | Set to `debug` to time each git call  |
| `PORT` / `HOSTNAME`      | `3000`/`0.0.0.0` | Where the server listens              |

## Development

```bash
cp .env-example .env
pnpm install
pnpm dev
```

Built with [Waku](https://waku.gg), React 19, and Tailwind. Read
[agents-memory.md](./agents-memory.md) to learn about the design decisions.
