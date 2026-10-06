/**
 * Structured JSON logging: one event per line, fields not sentences, so Vercel's log search
 * (or any drain) can filter on `request_id`, `route`, `status`.
 *
 * No dependencies on purpose; this runs in proxy.ts, instrumentation.ts and the app alike.
 * Swap the `write` function for pino or an OpenTelemetry logs exporter if you outgrow it.
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type Fields = Record<string, unknown>;

// Redacted by key name, at any depth. Extend per project (see pii-tiering-and-field-level-redaction).
const REDACT = /^(authorization|cookie|set-cookie|password|pass|secret|token|api[-_]?key|session|email)$/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return { "error.type": value.name, "error.message": value.message, "error.stack": value.stack };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Fields = {};
  for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? "[redacted]" : redact(v, depth + 1);
  return out;
}

function threshold(): number {
  const level = (process.env.LOG_LEVEL ?? "info") as Level;
  return ORDER[level] ?? ORDER.info;
}

function write(level: Level, msg: string, fields: Fields): void {
  if (ORDER[level] < threshold()) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(redact(fields) as Fields) });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(fields: Fields): Logger;
}

export function createLogger(base: Fields = {}): Logger {
  return {
    debug: (msg, f = {}) => write("debug", msg, { ...base, ...f }),
    info: (msg, f = {}) => write("info", msg, { ...base, ...f }),
    warn: (msg, f = {}) => write("warn", msg, { ...base, ...f }),
    error: (msg, f = {}) => write("error", msg, { ...base, ...f }),
    child: (f) => createLogger({ ...base, ...f }),
  };
}

export const log = createLogger({ service: process.env.OTEL_SERVICE_NAME ?? "nextjs-starter" });

/** Exported for the unit test. */
export const _redact = redact;
