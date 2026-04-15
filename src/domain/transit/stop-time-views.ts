import type { StopTimeViewMeta } from '../../types/app/transit-composed';

/**
 * All departure view pattern definitions (T1-T7).
 *
 * Each entry describes a grouping/sorting strategy for the BottomSheet.
 * Views with `enabled: false` are shown greyed out; `visible: false` are hidden.
 *
 * Text fields (labelKey, titleKey, descriptionKey) are i18n keys resolved
 * via `t()` at render time.
 */
export const DEPARTURE_VIEWS: readonly StopTimeViewMeta[] = [
  {
    id: 'stop',
    icon: '🕐',
    labelKey: 'view.stop.label',
    titleKey: 'view.stop.title',
    descriptionKey: 'view.stop.description',
    enabled: true,
    visible: true,
  },
  {
    id: 'route-headsign',
    icon: '🚌',
    labelKey: 'view.routeHeadsign.label',
    titleKey: 'view.routeHeadsign.title',
    descriptionKey: 'view.routeHeadsign.description',
    enabled: true,
    visible: true,
  },
  {
    id: 'route',
    icon: '🚏',
    labelKey: 'view.route.label',
    titleKey: 'view.route.title',
    descriptionKey: 'view.route.description',
    enabled: false,
    visible: true,
  },
  {
    id: 'headsign',
    icon: '🧭',
    labelKey: 'view.headsign.label',
    titleKey: 'view.headsign.title',
    descriptionKey: 'view.headsign.description',
    enabled: false,
    visible: true,
  },
  {
    id: 'frequency',
    icon: '📊',
    labelKey: 'view.frequency.label',
    titleKey: 'view.frequency.title',
    descriptionKey: 'view.frequency.description',
    enabled: false,
    visible: true,
  },
  {
    id: 'duration',
    icon: '⏱',
    labelKey: 'view.duration.label',
    titleKey: 'view.duration.title',
    descriptionKey: 'view.duration.description',
    enabled: false,
    visible: true,
  },
  {
    id: 'terminal',
    icon: '🏙',
    labelKey: 'view.terminal.label',
    titleKey: 'view.terminal.title',
    descriptionKey: 'view.terminal.description',
    enabled: false,
    visible: true,
  },
] as const;

/** Default view ID used on initial load. */
export const DEFAULT_VIEW_ID = 'stop';
