export type Author = {
  name: string;
  email: string;
  color: string;
  ini: string;
};

export type RepoConfig = {
  id: string;
  name: string;
  lang: string;
  path: string;
  branches: string[];
};

export type RepoLoadError = {
  path: string;
  message: string;
};

export type DateRange = {
  from: string | null;
  to: string | null;
};

export type RepoRuntime = {
  open: boolean;
  on: boolean;
  bon: Set<string>;
  range: DateRange | null;
};

export type Commit = {
  i: number;
  hash: string;
  repo: string;
  branch: string;
  a: Author;
  ts: number;
  merge: boolean;
  subject: string;
  files: number;
  tag: string | null;
  paths: string[];
};

export type ScopeMode = "global" | "repo";
export type SortMode = "new" | "old";
export type TabKey = "commits" | "contrib" | "activity";
export type Theme = "dark" | "light";
