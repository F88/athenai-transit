import type { HeadsignSource } from '../domain/transit/get-headsign-display-names';

/**
 * Return an emoji/symbol representing the given {@link HeadsignSource}.
 *
 * @param source - Headsign source type.
 * @returns Symbol for the given source.
 */
export function headsignSourceEmoji(source: HeadsignSource): string {
  switch (source) {
    case 'trip':
      return '🪧';
    case 'stop':
      return '📍';
  }
}
