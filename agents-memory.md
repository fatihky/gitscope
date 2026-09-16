# Agent notes

Notes for future coding-agent sessions on this repo — things that aren't obvious from the code
alone. Not user-facing docs; keep entries short and dated.

## Commit filtering stays client-side (2026-09-04)

`src/lib/gitscope/use-git-scope.ts` filters the in-memory commit list (date `to`, `merges`,
`author`, free-text `query`) entirely client-side. This is deliberate, not an oversight:

- The `since`-bounded commit list is fetched once, and every other filter only narrows it, so
  changing author/merges/search/`to` is an in-memory filter rather than a new `git log` spawn per
  change. (Native `git log` *could* do `--until`/`--author`/`--no-merges`/`--grep`, but free-text
  search also matches file paths and hash prefixes, which `git log` can't express in one call.)
- `since` *is* pushed server-side: `loadCommits()` (`src/lib/gitscope/load-commits.ts`) is a
  server action re-invoked from `git-scope.tsx` whenever the requested range widens past what's
  loaded (`needsWiderLoad()` / `earliestNeededFrom()`), and `loadCommitsForRepos()`
  (`git-source.ts`) passes it straight to `git log --since`. It only ever widens, never
  narrows — narrowing is a pure client-side filter.
- Chunked/paginated loading (e.g. `git log -n 10 --skip N`) doesn't fit well: each call re-walks
  history from the ref rather than resuming, and it would only pay off for a plain unfiltered "load
  next N" UX — with author/merges/text filters active, a batch of N raw commits can yield zero
  matches with no way to know how far to walk next.
- The "load more" control (`limit` state in `use-git-scope.ts`, `commits-table.tsx`'s
  `IntersectionObserver`) grows the *rendered* slice of the already-fetched-and-filtered list by
  250 at a time. It's a render-window optimization, not incremental `git.log()` calls.
