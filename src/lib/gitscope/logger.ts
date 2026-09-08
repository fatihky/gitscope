/**
 * Minimal leveled logger for server-side gitscope code.
 *
 * The active level is set via the `GITSCOPE_LOG_LEVEL` env var (`debug` | `info` | `warn` |
 * `error`) and defaults to `info`. `debug` additionally traces every `git` invocation with its
 * duration (see `runGit`/`runGitBuffer` in `git-source.ts`), which is how slow repo loads get
 * investigated — it's off by default because it's very chatty.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const PREFIX = "[gitscope]";

function resolveLogLevel(): LogLevel {
  const raw = (process.env.GITSCOPE_LOG_LEVEL ?? "").trim().toLowerCase();
  return raw in LEVEL_RANK ? (raw as LogLevel) : "info";
}

const ACTIVE_LEVEL = resolveLogLevel();

function isActive(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[ACTIVE_LEVEL];
}

export const logger = {
  debug(...args: unknown[]): void {
    if (isActive("debug")) console.debug(PREFIX, ...args);
  },
  info(...args: unknown[]): void {
    if (isActive("info")) console.log(PREFIX, ...args);
  },
  warn(...args: unknown[]): void {
    if (isActive("warn")) console.warn(PREFIX, ...args);
  },
  error(...args: unknown[]): void {
    if (isActive("error")) console.error(PREFIX, ...args);
  },
};
