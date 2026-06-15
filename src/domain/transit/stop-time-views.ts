import type { StopTimeViewMeta } from '../../types/app/transit-composed';

/**
 * All stop-time view pattern definitions (T1-T7).
 *
 * Each entry describes a grouping/sorting strategy for the BottomSheet.
 * Service events may be rendered as departures or arrivals depending on
 * stop position, such as showing arrival time at a terminal stop.
 * Views with `enabled: false` are shown greyed out; `visible: false` are hidden.
 *
 * Text fields (labelKey, titleKey, descriptionKey) are i18n keys resolved
 * via `t()` at render time.
 */
export const STOP_TIMES_VIEWS = [
  /**
   * Stop-first view.
   *
   * Display unit: stop.
   *
   * Shows upcoming service events in the context of each stop.
   */
  {
    id: 'stop',
    icon: '🕐',
    labelKey: 'view.stop.label',
    titleKey: 'view.stop.title',
    descriptionKey: 'view.stop.description',
    enabled: true,
    visible: true,
  },
  /**
   * Route+headsign grouped view.
   *
   * Display unit: stop.
   *
   * Groups upcoming service events within a stop by route and destination.
   */
  {
    id: 'route-headsign',
    icon: '🚌',
    labelKey: 'view.routeHeadsign.label',
    titleKey: 'view.routeHeadsign.title',
    descriptionKey: 'view.routeHeadsign.description',
    enabled: true,
    visible: true,
  },

  /**
   * Transit display view -- modern design.
   *
   * Display unit: multiple stops.
   *
   * A modern take on the transit display, built on Athenai Transit's own base
   * design language rather than the classic split-flap board (`transit-display`).
   * Same nearby-cluster, timeline-ordered concept; different presentation.
   */
  {
    id: 'transit-display-2',
    icon: '🖥️',
    labelKey: 'view.transitDisplay2.label',
    titleKey: 'view.transitDisplay2.title',
    descriptionKey: 'view.transitDisplay2.description',
    enabled: true,
    visible: true,
  },

  /**
   * Transit display view -- classic design.
   *
   * Display unit: multiple stops.
   *
   * The classic split-flap signage board: shows service events in timeline order
   * across a nearby stop cluster, similar to a public transit information display.
   * Approximates a shared display by grouping stops within a nearby radius.
   */
  {
    id: 'transit-display',
    icon: '📟',
    labelKey: 'view.transitDisplay.label',
    titleKey: 'view.transitDisplay.title',
    descriptionKey: 'view.transitDisplay.description',
    enabled: true,
    visible: true,
  },

  /**
   * Route grouped view.
   *
   * Display unit: stop.
   *
   * Groups upcoming service events within a stop by route.
   */
  {
    id: 'route',
    icon: '🚏',
    labelKey: 'view.route.label',
    titleKey: 'view.route.title',
    descriptionKey: 'view.route.description',
    enabled: true,
    visible: true,
  },
  /**
   * Headsign grouped view.
   *
   * Display unit: stop.
   *
   * Groups upcoming service events within a stop by destination.
   */
  {
    id: 'headsign',
    icon: '🧭',
    labelKey: 'view.headsign.label',
    titleKey: 'view.headsign.title',
    descriptionKey: 'view.headsign.description',
    enabled: false,
    visible: true,
  },
  /**
   * Frequency weighted view.
   *
   * Display unit: stop.
   *
   * Weights upcoming service events by service frequency.
   */
  {
    id: 'frequency',
    icon: '📊',
    labelKey: 'view.frequency.label',
    titleKey: 'view.frequency.title',
    descriptionKey: 'view.frequency.description',
    enabled: false,
    visible: true,
  },
  /**
   * Travel-time sorted view.
   *
   * Display unit: stop.
   *
   * Sorts upcoming service events by travel time to their terminal stop.
   */
  {
    id: 'duration',
    icon: '⏱',
    labelKey: 'view.duration.label',
    titleKey: 'view.duration.title',
    descriptionKey: 'view.duration.description',
    enabled: false,
    visible: true,
  },
  /**
   * Terminal-activity sorted view.
   *
   * Display unit: stop.
   *
   * Sorts stops or service events by terminal stop activity.
   */
  {
    id: 'terminal',
    icon: '🏬',
    labelKey: 'view.terminal.label',
    titleKey: 'view.terminal.title',
    descriptionKey: 'view.terminal.description',
    enabled: false,
    visible: true,
  },
] as const satisfies readonly StopTimeViewMeta[];

export type StopTimeViewId = (typeof STOP_TIMES_VIEWS)[number]['id'];

/** Default view ID used on initial load. */
export const DEFAULT_VIEW_ID: StopTimeViewId = 'stop';
