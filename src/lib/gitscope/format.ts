import type { Commit } from "./types";

export const DAY = 86400e3;

export const iso = (t: number): string => new Date(t).toISOString().slice(0, 10);

export const fmt = (n: number): string => n.toLocaleString("en-US");

export const short = (t: number): string =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const full = (t: number): string =>
  new Date(t).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** ISO date (local calendar) of the last weekday before today: Mon -> Fri, Sun -> Fri, else yesterday. */
export const previousWorkday = (now: number): string => {
  const d = new Date(now);
  const back = d.getDay() === 0 ? 2 : d.getDay() === 1 ? 3 : 1;
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const DEFAULT_EXPORT_FORMAT = "[{repo}][{date}][{author}]: {subject}";

const EXPORT_TOKENS: Record<string, (c: Commit, repoName: string) => string> = {
  repo: (_c, repoName) => repoName,
  date: (c) => full(c.ts),
  author: (c) => c.a.name,
  subject: (c) => c.subject,
  hash: (c) => c.hash,
  shortHash: (c) => c.hash.slice(0, 7),
};

/** Renders a commit export line from a template with {repo} {date} {author} {subject} {hash} {shortHash} tokens. */
export const formatCommit = (template: string, commit: Commit, repoName: string): string =>
  template.replace(/\{(\w+)\}/g, (match, key) => EXPORT_TOKENS[key]?.(commit, repoName) ?? match);

export const ago = (t: number): string => {
  const s = (Date.now() - t) / 1e3;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  if (s < 2592e3) return `${Math.floor(s / 604800)}w`;
  if (s < 31536e3) return `${Math.floor(s / 2592e3)}mo`;
  return `${Math.floor(s / 31536e3)}y`;
};
