/**
 * Structured logger with level control and tag filtering.
 *
 * Usage:
 *   const logger = createLogger("GTFS");
 *   logger.debug("Loading sources:", prefixes);
 *
 * Output:
 *   [14:05:23.456] DEBUG [GTFS] Loading sources: ["tobus", "toaran"]
 */

export type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  verbose: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface LoggerConfig {
  level: LogLevel;
  enabledTags: string[];
  tagLevels: Record<string, LogLevel>;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  verbose: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

const CONSOLE_METHODS: Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'> = {
  verbose: 'debug',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

function isValidLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && value in LOG_LEVEL_ORDER;
}

function resolveInitialConfig(): LoggerConfig {
  const envLevel = import.meta.env.VITE_LOG_LEVEL;
  const envTags = import.meta.env.VITE_LOG_TAGS;

  const level: LogLevel = isValidLogLevel(envLevel) ? envLevel : 'warn';
  const enabledTags: string[] =
    typeof envTags === 'string' && envTags.length > 0
      ? envTags.split(',').map((tag) => tag.trim())
      : [];
  const tagLevels: Record<string, LogLevel> = {};

  return { level, enabledTags, tagLevels };
}

let config: LoggerConfig = resolveInitialConfig();

export function configureLogger(partial: Partial<LoggerConfig>): void {
  config = { ...config, ...partial };
}

export function getLoggerConfig(): Readonly<LoggerConfig> {
  return config;
}

function formatTimestamp(): string {
  const now = new Date();
  return (
    String(now.getHours()).padStart(2, '0') +
    ':' +
    String(now.getMinutes()).padStart(2, '0') +
    ':' +
    String(now.getSeconds()).padStart(2, '0') +
    '.' +
    String(now.getMilliseconds()).padStart(3, '0')
  );
}

function isTagEnabled(tag: string, patterns: string[]): boolean {
  if (patterns.length === 0) {
    return false;
  }

  for (const pattern of patterns) {
    if (pattern.startsWith('-') && pattern.slice(1) === tag) {
      return false;
    }
  }

  for (const pattern of patterns) {
    if (pattern.startsWith('-')) {
      continue;
    }
    if (pattern === '*') {
      return true;
    }
    if (pattern.endsWith('*')) {
      if (tag.startsWith(pattern.slice(0, -1))) {
        return true;
      }
    } else if (pattern === tag) {
      return true;
    }
  }

  return false;
}

function shouldLog(level: LogLevel, tag: string): boolean {
  const effectiveLevel = config.tagLevels[tag] ?? config.level;
  if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[effectiveLevel]) {
    return false;
  }

  if (LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER.warn) {
    return true;
  }

  return isTagEnabled(tag, config.enabledTags);
}

export function createLogger(tag: string): Logger {
  function emit(level: LogLevel, args: unknown[]): void {
    if (!shouldLog(level, tag)) {
      return;
    }
    const prefix = `[${formatTimestamp()}] ${level.toUpperCase()} [${tag}]`;
    console[CONSOLE_METHODS[level]](prefix, ...args);
  }

  return {
    verbose: (...args: unknown[]) => emit('verbose', args),
    debug: (...args: unknown[]) => emit('debug', args),
    info: (...args: unknown[]) => emit('info', args),
    warn: (...args: unknown[]) => emit('warn', args),
    error: (...args: unknown[]) => emit('error', args),
  };
}

if (import.meta.env.DEV) {
  const devHelper = {
    setLevel(level: LogLevel) {
      if (!isValidLogLevel(level)) {
        console.warn(
          `Invalid log level: "${level as string}". Use: verbose, debug, info, warn, error`,
        );
        return;
      }
      config.level = level;
      console.info(`Log level set to "${level}"`);
    },
    setTags(...tags: string[]) {
      config.enabledTags = tags;
      console.info(`Log tags set to [${tags.join(', ')}]`);
    },
    getConfig() {
      console.info('Logger config:', { ...config });
      return { ...config };
    },
  };
  (window as unknown as Record<string, unknown>).__log = devHelper;
}
