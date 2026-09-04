# Agent notes

Notes for future coding-agent sessions on this repo — things that aren't obvious from the code
alone. Not user-facing docs; keep entries short and dated.

## Commit filtering stays client-side (2026-09-04)

`src/lib/gitscope/use-git-scope.ts` filters the in-memory commit list (date `to`, `merges`,
`author`, free-text `query`) entirely client-side. This is deliberate, not an oversight:

- isomorphic-git's `git.log()` only supports `since` (date lower bound), `ref`, `depth`, and
  `filepath` — there's no `until`, author, merge-exclusion, or text-search API. Those filters can
  only ever be JS-side.
- `since` *is* pushed server-side: `loadCommits()` (`src/lib/gitscope/load-commits.ts`) is a
  server action re-invoked from `git-scope.tsx` whenever the requested range widens past what's
  loaded (`needsWiderLoad()` / `earliestNeededFrom()`), and `loadCommitsForRepos()`
  (`git-source.ts:94`) passes it straight to `git.log({ since })`. It only ever widens, never
  narrows — narrowing is a pure client-side filter.
- `depth`-based chunked/paginated loading (e.g. fetching 10 commits at a time) doesn't fit well:
  isomorphic-git's `log()` has no cursor/skip param, so each call re-walks from `ref`/an oid rather
  than resuming. It would only pay off for a plain unfiltered "load next N" UX — with
  author/merges/text filters active, a batch of N raw commits can yield zero matches with no way
  to know how far to walk next.
- The "load more" control (`limit` state in `use-git-scope.ts`, `commits-table.tsx`'s
  `IntersectionObserver`) grows the *rendered* slice of the already-fetched-and-filtered list by
  250 at a time. It's a render-window optimization, not incremental `git.log()` calls.
