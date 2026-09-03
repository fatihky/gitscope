import { DAY } from "./format";
import type { Author, Commit, RepoConfig } from "./types";

/* deterministic PRNG so the generated dataset is stable across renders */
function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = createRng(7);
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];

export const NOW = Date.now();

export const AUTHORS: Author[] = (
  [
    ["Ada Lovelace", "ada@ex.dev", "#4c8dff"],
    ["Rui Tanaka", "rui@ex.dev", "#3fb950"],
    ["Mira Osei", "mira@ex.dev", "#d29922"],
    ["Jonas Vik", "jonas@ex.dev", "#a371f7"],
    ["Sana Qureshi", "sana@ex.dev", "#39c5cf"],
    ["Leo Marchetti", "leo@ex.dev", "#f0564b"],
    ["Priya Nair", "priya@ex.dev", "#f778ba"],
    ["Tom Becker", "tom@ex.dev", "#7ee787"],
  ] as const
).map(([name, email, color]) => ({
  name,
  email,
  color,
  ini: name
    .split(" ")
    .map((w) => w[0])
    .join(""),
}));

export const REPO_CONFIGS: RepoConfig[] = [
  {
    id: "core-api",
    name: "core-api",
    lang: "#00ADD8",
    path: "git@ex.dev:platform/core-api.git",
    branches: ["main", "develop", "release/2.4", "feat/auth-rework"],
    dirs: ["internal/api", "internal/store", "cmd/server", "pkg/auth"],
    ext: "go",
    w: 1,
  },
  {
    id: "web-console",
    name: "web-console",
    lang: "#3178c6",
    path: "git@ex.dev:platform/web-console.git",
    branches: ["main", "develop", "feat/table-virtualization"],
    dirs: ["src/views", "src/components", "src/lib", "e2e"],
    ext: "ts",
    w: 0.95,
  },
  {
    id: "edge-proxy",
    name: "edge-proxy",
    lang: "#dea584",
    path: "git@ex.dev:infra/edge-proxy.git",
    branches: ["main", "release/1.9", "fix/keepalive"],
    dirs: ["src/net", "src/tls", "benches"],
    ext: "rs",
    w: 0.6,
  },
  {
    id: "data-pipeline",
    name: "data-pipeline",
    lang: "#ffd43b",
    path: "git@ex.dev:data/data-pipeline.git",
    branches: ["main", "develop", "feat/dbt-models"],
    dirs: ["dags", "transforms", "tests"],
    ext: "py",
    w: 0.7,
  },
  {
    id: "infra-terraform",
    name: "infra-terraform",
    lang: "#844fba",
    path: "git@ex.dev:infra/terraform.git",
    branches: ["main", "staging"],
    dirs: ["modules/network", "modules/eks", "envs/prod"],
    ext: "tf",
    w: 0.4,
  },
  {
    id: "docs-site",
    name: "docs-site",
    lang: "#e34c26",
    path: "git@ex.dev:platform/docs-site.git",
    branches: ["main", "draft/guides"],
    dirs: ["content/guides", "content/api", "theme"],
    ext: "mdx",
    w: 0.3,
  },
];

export const REPO_BY_ID: Record<string, RepoConfig> = Object.fromEntries(
  REPO_CONFIGS.map((r) => [r.id, r]),
);

const SUBJ = [
  "fix: handle nil pointer in %s resolver",
  "feat: add pagination to %s endpoint",
  "refactor: extract %s into module",
  "perf: cut allocations in %s hot path",
  "test: cover %s edge cases",
  "chore: bump deps for %s",
  "fix: correct retry backoff for %s",
  "feat: expose %s metrics",
  "docs: document %s configuration",
  "fix: race condition in %s cache",
  "feat: %s support behind feature flag",
  "style: format %s package",
  "build: cache %s layer in CI",
  'revert: "feat: %s streaming writes"',
];
const NOUN = [
  "token",
  "session",
  "webhook",
  "ingest",
  "scheduler",
  "tenant",
  "audit-log",
  "rate-limit",
  "snapshot",
  "graph",
  "queue",
  "index",
];
const FILE = ["handler", "service", "client", "model", "config", "router", "worker", "schema", "utils", "types"];

let id = 0;
export const COMMITS: Commit[] = [];
for (const r of REPO_CONFIGS) {
  const n = Math.round(340 * r.w);
  for (let i = 0; i < n; i++) {
    const daysBack = Math.floor(rnd() ** 0.75 * 430);
    const d = new Date(NOW - daysBack * DAY);
    const dow = d.getDay();
    if ((dow === 0 || dow === 6) && rnd() > 0.22) continue;
    d.setHours(8 + Math.floor(rnd() ** 0.8 * 12), Math.floor(rnd() * 60), 0, 0);
    const a = AUTHORS[Math.floor(rnd() ** 1.5 * AUTHORS.length)];
    const br = rnd() < 0.5 ? r.branches[0] : pick(r.branches);
    const merge = rnd() < 0.09;
    const noun = pick(NOUN);
    const files = merge ? Math.ceil(rnd() * 40) + 3 : Math.ceil(rnd() ** 2 * 22) + 1;
    COMMITS.push({
      i: id++,
      hash: Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(rnd() * 16)]).join(""),
      repo: r.id,
      branch: br,
      a,
      ts: d.getTime(),
      merge,
      subject: merge
        ? `Merge pull request #${1200 + Math.floor(rnd() * 800)} from ${r.id}/${pick(["feat", "fix"])}-${noun}`
        : pick(SUBJ).replace("%s", noun),
      files,
      add: Math.ceil(rnd() ** 2 * 620) + 1,
      del: Math.ceil(rnd() ** 2.4 * 280),
      tag: rnd() < 0.012 ? `v${1 + Math.floor(rnd() * 3)}.${Math.floor(rnd() * 9)}.${Math.floor(rnd() * 9)}` : null,
      paths: [],
    });
  }
}
COMMITS.forEach((c) => {
  const r = REPO_BY_ID[c.repo];
  c.paths = Array.from(
    { length: Math.min(c.files, 14) },
    () => `${pick(r.dirs)}/${pick(FILE)}${rnd() < 0.3 ? `_${pick(NOUN)}` : ""}.${r.ext}`,
  );
});

export const BRANCH_COMMIT_COUNTS: Record<string, number> = {};
COMMITS.forEach((c) => {
  const key = `${c.repo}/${c.branch}`;
  BRANCH_COMMIT_COUNTS[key] = (BRANCH_COMMIT_COUNTS[key] || 0) + 1;
});
