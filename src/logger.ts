import pino from "pino";
import type { Settings } from "./config.js";

const levelMap: Record<string, string> = {
  CRITICAL: "fatal",
  WARNING: "warn",
};

export function createLogger(settings: Settings) {
  const level = levelMap[settings.logLevel] ?? settings.logLevel.toLowerCase();
  return pino({
    level,
    base: { environment: settings.environment },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
