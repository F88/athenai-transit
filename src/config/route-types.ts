import type { AppRouteType } from '@/types/app/transit';

/**
 * Supported route types in display order for webapp UI.
 */
export const APP_ROUTE_TYPES: readonly AppRouteType[] = [
  { value: -1, emoji: '🛸', color: '#455A64', label: 'Unknown' },
  { value: 0, emoji: '🚊', color: '#f57f17', label: 'Tram' },
  { value: 1, emoji: '🚇', color: '#7b1fa2', label: 'Subway' },
  { value: 2, emoji: '🚆', color: '#1565c0', label: 'Rail' },
  { value: 3, emoji: '🚌', color: '#2e7d32', label: 'Bus' },
  { value: 4, emoji: '⛴️', color: '#0288d1', label: 'Ferry' },
  { value: 5, emoji: '🚋', color: '#c62828', label: 'Cable tram' },
  { value: 6, emoji: '🚡', color: '#283593', label: 'Gondola' },
  { value: 7, emoji: '🚞', color: '#ff8f00', label: 'Funicular' },
  { value: 11, emoji: '🚎', color: '#4e342e', label: 'Trolleybus' },
  { value: 12, emoji: '🚝', color: '#37474f', label: 'Monorail' },
] as const;
