import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { configureLogger, createLogger, getLoggerConfig, type LoggerConfig } from '../logger';

function withConfig(partial: Partial<LoggerConfig>, fn: () => void): void {
  const saved = { ...getLoggerConfig() };
  configureLogger(partial);
  try {
    fn();
  } finally {
    configureLogger(saved);
  }
}

describe('createLogger', () => {
  let debugSpy: MockInstance;
  let infoSpy: MockInstance;
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('level filtering', () => {
    it('outputs verbose when level=verbose', () => {
      withConfig({ level: 'verbose', enabledTags: ['*'], tagLevels: {} }, () => {
        const logger = createLogger('Test');
        logger.verbose('hello');
        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy.mock.calls[0][0]).toMatch(/\[Test\]/);
        expect(debugSpy.mock.calls[0][1]).toBe('hello');
      });
    });

    it('suppresses verbose when level=debug', () => {
      withConfig({ level: 'debug', enabledTags: ['*'], tagLevels: {} }, () => {
        const logger = createLogger('Test');
        logger.verbose('hidden');
        logger.debug('visible');
        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy.mock.calls[0][0]).toMatch(/DEBUG/);
      });
    });

    it('suppresses verbose and debug when level=info', () => {
      withConfig({ level: 'info', enabledTags: ['*'], tagLevels: {} }, () => {
        const logger = createLogger('Test');
        logger.verbose('hidden');
        logger.debug('hidden');
        logger.info('visible');
        expect(debugSpy).not.toHaveBeenCalled();
        expect(infoSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('suppresses verbose, debug, and info when level=warn', () => {
      withConfig({ level: 'warn', enabledTags: ['*'], tagLevels: {} }, () => {
        const logger = createLogger('Test');
        logger.verbose('hidden');
        logger.debug('hidden');
        logger.info('hidden');
        logger.warn('visible');
        logger.error('visible');
        expect(debugSpy).not.toHaveBeenCalled();
        expect(infoSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('only outputs error when level=error', () => {
      withConfig({ level: 'error', enabledTags: ['*'], tagLevels: {} }, () => {
        const logger = createLogger('Test');
        logger.verbose('hidden');
        logger.debug('hidden');
        logger.info('hidden');
        logger.warn('hidden');
        logger.error('visible');
        expect(debugSpy).not.toHaveBeenCalled();
        expect(infoSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('tag filtering', () => {
    it("wildcard '*' matches all tags", () => {
      withConfig({ level: 'debug', enabledTags: ['*'], tagLevels: {} }, () => {
        createLogger('Anything').debug('msg');
        expect(debugSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('exact match filters correctly', () => {
      withConfig({ level: 'debug', enabledTags: ['GTFS'], tagLevels: {} }, () => {
        createLogger('GTFS').debug('yes');
        createLogger('App').debug('no');
        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy.mock.calls[0][0]).toMatch(/\[GTFS\]/);
      });
    });

    it("prefix match with trailing '*'", () => {
      withConfig({ level: 'debug', enabledTags: ['Stop*'], tagLevels: {} }, () => {
        createLogger('StopMarkerDom').debug('yes');
        createLogger('StopMarkersCanvas').debug('yes');
        createLogger('App').debug('no');
        expect(debugSpy).toHaveBeenCalledTimes(2);
      });
    });

    it('negation pattern excludes matching tag', () => {
      withConfig({ level: 'debug', enabledTags: ['*', '-App'], tagLevels: {} }, () => {
        createLogger('GTFS').debug('yes');
        createLogger('App').debug('no');
        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy.mock.calls[0][0]).toMatch(/\[GTFS\]/);
      });
    });

    it('empty enabledTags suppresses debug/info', () => {
      withConfig({ level: 'debug', enabledTags: [], tagLevels: {} }, () => {
        createLogger('GTFS').debug('hidden');
        createLogger('GTFS').info('hidden');
        expect(debugSpy).not.toHaveBeenCalled();
        expect(infoSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('warn/error bypass tag filter', () => {
    it('warn outputs even when tag is not enabled', () => {
      withConfig({ level: 'debug', enabledTags: [], tagLevels: {} }, () => {
        createLogger('Unknown').warn('important');
        expect(warnSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('error outputs even when tag is excluded', () => {
      withConfig({ level: 'debug', enabledTags: ['*', '-App'], tagLevels: {} }, () => {
        createLogger('App').error('critical');
        expect(errorSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('per-tag level (tagLevels)', () => {
    it('overrides global level for specific tag', () => {
      withConfig({ level: 'debug', enabledTags: ['*'], tagLevels: { GTFS: 'warn' } }, () => {
        createLogger('GTFS').debug('hidden');
        createLogger('GTFS').warn('visible');
        createLogger('App').debug('visible');
        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy.mock.calls[0][0]).toMatch(/\[App\]/);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toMatch(/\[GTFS\]/);
      });
    });

    it('per-tag level does not affect other tags', () => {
      withConfig({ level: 'warn', enabledTags: ['*'], tagLevels: { App: 'debug' } }, () => {
        createLogger('App').debug('visible');
        createLogger('GTFS').debug('hidden');
        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy.mock.calls[0][0]).toMatch(/\[App\]/);
      });
    });
  });

  describe('output format', () => {
    it.each([
      ['verbose', () => debugSpy],
      ['debug', () => debugSpy],
      ['info', () => infoSpy],
      ['warn', () => warnSpy],
      ['error', () => errorSpy],
    ] as const)('prefix includes timestamp, level, and tag for %s', (level, getSpy) => {
      withConfig({ level: 'verbose', enabledTags: ['*'], tagLevels: {} }, () => {
        createLogger('MyTag')[level]('test message');
        const prefix = getSpy().mock.calls[0][0] as string;
        const pattern = new RegExp(
          `^\\[\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\] ${level.toUpperCase()} \\[MyTag\\]$`,
        );
        expect(prefix).toMatch(pattern);
      });
    });

    it('passes additional arguments through', () => {
      withConfig({ level: 'debug', enabledTags: ['*'], tagLevels: {} }, () => {
        const obj = { key: 'value' };
        createLogger('Test').debug('msg', 42, obj);
        expect(debugSpy.mock.calls[0][1]).toBe('msg');
        expect(debugSpy.mock.calls[0][2]).toBe(42);
        expect(debugSpy.mock.calls[0][3]).toBe(obj);
      });
    });

    it('uses correct console method for each level', () => {
      withConfig({ level: 'verbose', enabledTags: ['*'], tagLevels: {} }, () => {
        const logger = createLogger('Test');
        logger.verbose('v');
        logger.debug('d');
        logger.info('i');
        logger.warn('w');
        logger.error('e');
        expect(debugSpy).toHaveBeenCalledTimes(2);
        expect(infoSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});

describe('configureLogger / getLoggerConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('partial update merges with existing config', () => {
    const before = { ...getLoggerConfig() };
    configureLogger({ level: 'error' });
    const after = getLoggerConfig();
    expect(after.level).toBe('error');
    expect(after.enabledTags).toEqual(before.enabledTags);
    configureLogger(before);
  });

  it('getLoggerConfig returns current state', () => {
    const original = { ...getLoggerConfig() };
    configureLogger({ level: 'info', enabledTags: ['Test'], tagLevels: { X: 'warn' } });
    const config = getLoggerConfig();
    expect(config.level).toBe('info');
    expect(config.enabledTags).toEqual(['Test']);
    expect(config.tagLevels).toEqual({ X: 'warn' });
    configureLogger(original);
  });
});
