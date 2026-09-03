/* deterministic color/initials helpers so the same author or repo always renders the same way */

const AUTHOR_COLORS = [
  "#4c8dff",
  "#3fb950",
  "#d29922",
  "#a371f7",
  "#39c5cf",
  "#f0564b",
  "#f778ba",
  "#7ee787",
];

const REPO_COLORS = ["#00ADD8", "#3178c6", "#dea584", "#ffd43b", "#844fba", "#e34c26", "#89e051", "#f34b7d"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const colorForAuthor = (seed: string): string => AUTHOR_COLORS[hashString(seed) % AUTHOR_COLORS.length];

export const colorForRepo = (seed: string): string => REPO_COLORS[hashString(seed) % REPO_COLORS.length];

export const initialsFor = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
