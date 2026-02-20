export type LogLevel = "info" | "warn" | "error";

export type StructuredLog = {
  level: LogLevel;
  message: string;
  requestId?: string;
  module?: string;
  details?: Record<string, unknown>;
};

function write(entry: StructuredLog): void {
  const payload = {
    ts: new Date().toISOString(),
    ...entry,
  };

  const line = JSON.stringify(payload);
  if (entry.level === "error") {
    console.error(line);
    return;
  }
  if (entry.level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export function logInfo(message: string, input: Omit<StructuredLog, "level" | "message"> = {}): void {
  write({ level: "info", message, ...input });
}

export function logWarn(message: string, input: Omit<StructuredLog, "level" | "message"> = {}): void {
  write({ level: "warn", message, ...input });
}

export function logError(message: string, input: Omit<StructuredLog, "level" | "message"> = {}): void {
  write({ level: "error", message, ...input });
}
