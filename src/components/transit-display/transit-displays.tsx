import { useMemo, useState } from 'react';

import { ArrowRight, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

import { DistanceBadge } from '@/components/badge/distance-badge';
import { TimetableEntryAttributesLabels } from '@/components/label/timetable-entry-attributes-labels';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { Button } from '@/components/ui/button';
import {
  type TransitDisplayCategory,
  type TransitDisplayDataWithMetaData,
  type TransitDisplayStatus,
} from '@/domain/transit/transit-info-display/build-transit-display-data';
import {
  buildTransitDisplayDatumForUi,
  type TransitDisplayDataWithMetaDataForUi,
  type TransitDisplayDatumForUi,
} from '@/domain/transit/transit-info-display/build-transit-display-data-for-ui';
import { getBearingDeg } from '@/domain/transit/distance';
import { routeTypesEmoji } from '@/utils/route-type-emoji';
import type { InfoLevel } from '@/types/app/settings';
import { useInfoLevel } from '@/hooks/use-info-level';
import { cn } from '@/lib/utils';

/**
 * Theme-aware color of the board frame: the thick outer bezel that encloses the
 * panel and the header / rows divider, which read as the same frame. A lighter
 * grey in light mode and a darker grey in dark mode so the frame sits well on
 * either background. Shared so the bezel and the inner divider always render the
 * same frame color.
 */
const BOARD_FRAME_COLOR = 'border-zinc-400 dark:border-zinc-700';

/**
 * Theme-aware background for the board panel (the header band and rows that make
 * up the split-flap panel face). Stays dark in both themes so the panel keeps
 * its amber text, but is lifted slightly in light mode where the darkest shade
 * felt too heavy. Shared so the header and rows always render the same panel
 * color.
 */
const BOARD_PANEL_BG = 'bg-neutral-800 dark:bg-neutral-900';

/**
 * Title text size per display size, one step larger than the rows so headings
 * (the board title and the filter toggles) read above the data rows.
 */
const TITLE_TEXT_CLASS_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-base',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

/**
 * Title icon size class per display size; tracks {@link TITLE_TEXT_CLASS_BY_SIZE}.
 * A `size-*` class (not the lucide `size` prop) is required so the icon overrides
 * the ui/button base rule `[&_svg:not([class*='size-'])]:size-4`, which otherwise
 * pins button icons to 16px regardless of the prop.
 */
const TITLE_ICON_CLASS_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'size-2.5', // 10px
  sm: 'size-3', // 12px
  md: 'size-4', // 16px
  lg: 'size-9', // 36px
  xl: 'size-15', // 60px
};

/** Row text size per display size; the larger the container, the larger the rows. */
const ROW_TEXT_CLASS_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-lg',
  xl: 'text-2xl',
};

const TIMETABLE_ENTRY_ATTRIBUTES_LABELS_SIZE_BY_SIZE: Record<
  ExtendedDisplaySize,
  ExtendedDisplaySize
> = {
  xs: 'xs',
  sm: 'xs',
  md: 'xs',
  lg: 'sm',
  xl: 'md',
};

const DISTANCE_BADGE_SIZE_BY_SIZE: Record<ExtendedDisplaySize, ExtendedDisplaySize> = {
  xs: 'xs',
  sm: 'xs',
  md: 'xs',
  lg: 'lg',
  xl: 'xl',
};

/** Headsign column width per display size (fixed: max == min so the column is stable). */
const HEADSIGN_WIDTH_CLASS_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'max-w-[10ch] min-w-[10ch]',
  sm: 'max-w-[12ch] min-w-[12ch]',
  md: 'max-w-[18ch] min-w-[18ch]',
  lg: 'max-w-[32ch] min-w-[32ch]',
  xl: 'max-w-[32ch] min-w-[32ch]',
};

export interface TransitDisplaysProps {
  /** Raw displays (meta + unresolved board); rows are resolved here for rendering. */
  dataWithMeta: readonly TransitDisplayDataWithMetaData[];
  /** Build state + radius, for the empty-state message (no stops / no service). */
  status: TransitDisplayStatus;
  /** Display language chain passed to {@link buildTransitDisplayDatumForUi} for row resolution. */
  dataLangs: readonly string[];
  emptyMessage: string;
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  size: ExtendedDisplaySize;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * Filter axis: which categories (departures / arrivals) the boards can be
 * narrowed to, in board order. The only filter axis for now -- route type and
 * direction are not user-selectable here.
 */
const FILTERABLE_CATEGORIES: readonly TransitDisplayCategory[] = ['departures', 'arrivals'];

/** Default category visibility: departures shown, arrivals hidden until toggled on. */
const DEFAULT_CATEGORIES: Record<TransitDisplayCategory, boolean> = {
  departures: true,
  arrivals: false,
};

/**
 * Resolves each {@link TransitDisplayDataWithMetaData} into UI rows (via
 * {@link buildTransitDisplayDatumForUi} -- this is the only consumer that needs
 * them) and renders it as its own stacked board, with a filter bar on top for
 * choosing which categories (departures / arrivals) to show. The filter is
 * presentation-only local state: it narrows the rendered displays, it does not
 * change how they are built or fetched.
 */
export function TransitDisplays({
  dataWithMeta,
  status,
  dataLangs,
  emptyMessage,
  now,
  mapCenter,
  infoLevel,
  size,
  onStopSelected,
  onInspectTrip,
}: TransitDisplaysProps) {
  const { t } = useTranslation();

  const [shownCategories, setShownCategories] =
    useState<Record<TransitDisplayCategory, boolean>>(DEFAULT_CATEGORIES);

  // Resolve every raw display's rows into UI data here -- TransitDisplays is the
  // only consumer that needs the resolved rows. Resolve all up front, then let
  // the category filter below narrow the already-resolved list.
  const resolvedDataWithMeta = useMemo<readonly TransitDisplayDataWithMetaDataForUi[]>(
    () =>
      dataWithMeta.map((datum) => ({
        meta: datum.meta,
        data: buildTransitDisplayDatumForUi(datum.data.data, dataLangs, datum.data.category),
      })),
    [dataWithMeta, dataLangs],
  );

  // No boards to show because the dataset itself is empty: either no stops within
  // the radius (`no-stops`) or stops exist but none have service today
  // (`no-service`). Show the reason instead of a blank view.
  if (status.state === 'no-stops' || status.state === 'no-service') {
    return (
      <div className="text-muted-foreground px-4 py-6 text-center text-sm">
        {t(status.state === 'no-service' ? 'transitDisplay2.noService' : 'transitDisplay2.empty', {
          radius: status.radius,
        })}
      </div>
    );
  }

  // Only offer toggles for categories that actually have a board, so the bar
  // mirrors what is on screen rather than always showing both.
  const presentCategories = FILTERABLE_CATEGORIES.filter((category) =>
    resolvedDataWithMeta.some((display) => display.meta.category === category),
  );
  const visibleData = resolvedDataWithMeta.filter(
    (display) => shownCategories[display.meta.category],
  );

  const toggleCategory = (category: TransitDisplayCategory) => {
    setShownCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <div className="font-dotgothic16 px-4 pb-0">
      {presentCategories.length > 0 && (
        <TransitDisplayCategoryFilter
          categories={presentCategories}
          shownCategories={shownCategories}
          size={size}
          onToggleCategory={toggleCategory}
        />
      )}
      {visibleData.map((dataWithMeta, index) => (
        // Key from the board's identity (category + its route types), with the
        // map index as a disambiguator: a `custom` route grouping can collapse
        // two groups to the same present route types, so identity alone is not
        // guaranteed unique.
        <TransitDisplay
          key={`${dataWithMeta.meta.category}__${dataWithMeta.meta.routeTypes.join('-')}__${index}`}
          dataWithMeta={dataWithMeta}
          emptyMessage={emptyMessage}
          now={now}
          mapCenter={mapCenter}
          infoLevel={infoLevel}
          size={size}
          onStopSelected={onStopSelected}
          onInspectTrip={onInspectTrip}
        />
      ))}
    </div>
  );
}

/**
 * Filter toggle button box metrics (border width + padding) per display size, so
 * the frame and inset scale with the size-scaled label. The buttons always
 * contain an arrow svg, so horizontal padding uses `has-[>svg]:px-*` to override
 * the ui/button size variant's own `has-[>svg]:px-3`; `py-*` sets the height feel.
 * Border color is applied separately (the shown / hidden state classes).
 */
const FILTER_BUTTON_BOX_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'border has-[>svg]:px-1 py-0',
  sm: 'border-2 has-[>svg]:px-1.5 py-0',
  md: 'border-4 has-[>svg]:px-2 py-0',
  lg: 'border-6 has-[>svg]:px-4 py-0',
  xl: 'border-8 has-[>svg]:px-8 py-0',
};

const FILTER_BOX_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'py-2 px-3 gap-2',
  sm: 'py-2 px-3 gap-2.5',
  md: 'py-2 px-3 gap-3',
  lg: 'py-3 px-8 gap-8',
  xl: 'py-4 px-12 gap-12',
};

interface TransitDisplayCategoryFilterProps {
  /** Categories that have a board, in board order; one toggle is rendered per entry. */
  categories: readonly TransitDisplayCategory[];
  /** Current shown / hidden state per category. */
  shownCategories: Record<TransitDisplayCategory, boolean>;
  /** Display size; scales the toggle label text like the board rows. */
  size: ExtendedDisplaySize;
  onToggleCategory: (category: TransitDisplayCategory) => void;
}

/**
 * Split-flap-styled filter bar: one flap toggle per category. Styled to match
 * the boards (same frame and panel face, amber text) rather than the generic
 * chip filter. A lit flap means the category is shown; a dimmed one means it is
 * hidden.
 */
function TransitDisplayCategoryFilter({
  categories,
  shownCategories,
  size,
  onToggleCategory,
}: TransitDisplayCategoryFilterProps) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('transitDisplay.filter.label')}
      className={cn(
        'mb-2 flex items-center rounded-sm border-0',
        FILTER_BOX_SIZE[size],
        // BOARD_FRAME_COLOR,
        // BOARD_PANEL_BG,
      )}
    >
      {categories.map((category) => {
        const isShown = shownCategories[category];
        const isArrival = category === 'arrivals';
        return (
          // Shared ui/button (ghost) reused for structure and focus handling,
          // restyled to the split-flap palette: a lit flap means the category is
          // shown, a dimmed one means it is hidden.
          <Button
            key={category}
            variant="ghost"
            size="default"
            onClick={() => onToggleCategory(category)}
            className={cn(
              // grow + basis-0 makes both buttons equal width so they fill the
              // bar evenly (basis-0 avoids fighting the Button base `shrink-0`).
              // min-w-0 lets the label truncate instead of overflowing on narrow screens.
              // h-auto lets the button grow with the size-scaled label text.
              'h-auto min-w-0 grow basis-0 rounded-sm font-bold tracking-[0.18em] uppercase',
              FILTER_BUTTON_BOX_BY_SIZE[size],
              TITLE_TEXT_CLASS_BY_SIZE[size],
              isShown
                ? 'border-amber-300/70 bg-neutral-800 text-amber-100 hover:bg-neutral-700 hover:text-amber-100 dark:hover:bg-neutral-700'
                : 'border-neutral-700 bg-neutral-900 text-neutral-600 hover:bg-neutral-800 hover:text-neutral-400 dark:hover:bg-neutral-800',
            )}
          >
            {isArrival ? (
              <ArrowRight
                strokeWidth={4}
                aria-hidden
                className={cn('shrink-0', TITLE_ICON_CLASS_BY_SIZE[size])}
              />
            ) : (
              <ArrowUp
                strokeWidth={4}
                aria-hidden
                className={cn('shrink-0', TITLE_ICON_CLASS_BY_SIZE[size])}
              />
            )}
            <span className="truncate">
              {t(isArrival ? 'transitDisplay.filter.arrivals' : 'transitDisplay.filter.departures')}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export interface TransitDisplayProps {
  dataWithMeta: TransitDisplayDataWithMetaDataForUi;
  emptyMessage: string;
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  size: ExtendedDisplaySize;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * One transit board: a single departure or arrival display.
 *
 * Design basis: a slightly classical split-flap signage panel (the "Solari" /
 * flip-board mechanical flap displays once used in stations and airports). The
 * current styling evokes that look statically -- a thick, square-cornered frame
 * and a header band that shares the frame color -- rather than animating real
 * flaps. Typography (fonts, monospacing) and finer split-flap details are
 * intended to be refined later.
 *
 * Layout: a header band (title on the left, recent-count / radius on the right)
 * above the rows, or an empty fallback when the board has no entries.
 */
export function TransitDisplay({
  dataWithMeta,
  emptyMessage,
  mapCenter,
  infoLevel,
  size,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayProps) {
  const { t } = useTranslation();
  // Airport-board-style title: mode emoji + departures/arrivals phrase. The
  // route type and basis are structured meta; the UI composes the localized text.
  // The board's title carries the departure/arrival distinction, so rows do not
  // repeat it: each row shows a single time (the board's basis) without a label.
  const isArrivalBoard = dataWithMeta.meta.category === 'arrivals';
  const routeTypeIcon = routeTypesEmoji(dataWithMeta.meta.routeTypes);
  const title = t(isArrivalBoard ? 'transitDisplay.arrivals' : 'transitDisplay.departures');
  // A board that mixes route types: rows then show their own trip route-type emoji.
  const hasMultiRoutes = dataWithMeta.meta.routeTypes.length >= 2;

  // for debug
  // if (dataWithMeta.meta.category === 'arrivals') {
  //   return null;
  // }

  return (
    // Each board is framed like a classic airport signage panel: a thick,
    // square (no rounded corners) border makes the boundary between stacked
    // boards explicit.
    <section
      className={cn(
        'mb-4 overflow-hidden rounded-sm border-12 bg-neutral-950 last:mb-0',
        BOARD_FRAME_COLOR,
      )}
    >
      {/* Header band: title left, description right, on a single line. A dark band
          with letter-spaced amber text, like a split-flap header. */}
      <div
        className={cn(
          'flex flex-col gap-1 border-b-8 px-3 py-2.5',
          BOARD_PANEL_BG,
          BOARD_FRAME_COLOR,
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          {/* Title — board basis arrow (up = departures, right = arrivals) + mode + phrase.
              The arrow is decorative; the phrase already states departures/arrivals. */}
          <h3
            className={cn(
              'flex min-w-0 items-center gap-4 font-bold tracking-[0.18em] text-amber-100 uppercase',
              TITLE_TEXT_CLASS_BY_SIZE[size],
            )}
          >
            {isArrivalBoard ? (
              <ArrowRight
                strokeWidth={4}
                aria-hidden
                className={cn('shrink-0', TITLE_ICON_CLASS_BY_SIZE[size])}
              />
            ) : (
              <ArrowUp
                strokeWidth={4}
                aria-hidden
                className={cn('shrink-0', TITLE_ICON_CLASS_BY_SIZE[size])}
              />
            )}
            {routeTypeIcon}
            <span className="truncate">{title}</span>
          </h3>
          {/* Radius the board's stops were selected within (count is intentionally omitted). */}
          <p
            className={cn(
              'm-0 shrink-0 text-[11px] tracking-[0.12em] whitespace-nowrap text-amber-200/80',
              ROW_TEXT_CLASS_BY_SIZE[size],
            )}
          >
            {dataWithMeta.meta.radius}m
          </p>
        </div>
      </div>
      {/* Body: the rows (or the empty fallback). */}
      <div className="bg-neutral-950 p-0">
        {dataWithMeta.data.length === 0 ? (
          <p className="m-0 px-1 py-2 text-xs tracking-[0.08em] text-amber-100/55">
            {emptyMessage}
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {dataWithMeta.data.map((row) => (
              <TransitDisplayEntry
                key={row.key}
                dataWithMeta={row}
                mapCenter={mapCenter}
                infoLevel={infoLevel}
                size={size}
                hasMultiRoutes={hasMultiRoutes}
                onStopSelected={onStopSelected}
                onInspectTrip={onInspectTrip}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface TimeInfoProps {
  /** Pre-formatted absolute time text to display. */
  timeText: string;
  /** Stop selected together with trip inspection on tap. */
  stopId: string;
  /** Target opened in trip inspection on tap. */
  inspectTarget: TripInspectionTarget;
  /** Extra classes appended last; lets the caller override the default text size. */
  className?: string;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * Displays `timeText` as a tappable control. Tapping runs both handlers
 * (select the stop, then open trip inspection) like `StopTimeTimeInfo`, and
 * stops propagation so the row's own onClick does not double-fire.
 */
function TimeInfo({
  timeText,
  stopId,
  inspectTarget,
  className,
  onStopSelected,
  onInspectTrip,
}: TimeInfoProps) {
  // Fixed-width, right-aligned time column so single- and double-digit-hour
  // times ("9:30" / "14:30") align their colons and minutes across rows
  // (DotGothic16 is monospaced; tabular-nums keeps the digits uniform).
  // `text-base` is the default size; `className` (appended last) can override it.
  return (
    <button
      type="button"
      className={cn(
        'mr-2 w-[5ch] shrink-0 cursor-pointer rounded-none text-right font-bold tracking-[0.12em] text-amber-100 tabular-nums focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus-visible:outline-none',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onStopSelected(stopId);
        onInspectTrip?.(inspectTarget);
      }}
    >
      {timeText}
    </button>
  );
}

export interface TransitDisplayEntryProps {
  dataWithMeta: TransitDisplayDatumForUi;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Display size; drives the row text size. */
  size: ExtendedDisplaySize;
  /**
   * Whether the board mixes route types (its `meta.routeTypes.length >= 2`). When
   * true, each row shows its trip's route-type emoji so mixed types can be told
   * apart; a single-type board does not need it.
   */
  hasMultiRoutes: boolean;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/** A single departure-board row (one stop event). */
export function TransitDisplayEntry({
  dataWithMeta,
  mapCenter,
  infoLevel,
  size,
  hasMultiRoutes,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayEntryProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);

  // Distance is baked on the row (query-time); bearing is computed live from the
  // current map center so the direction arrow tracks panning, like StopInfo.
  const distanceRounded =
    dataWithMeta.stop.distance != null ? Math.round(dataWithMeta.stop.distance) : null;
  const bearing = mapCenter ? getBearingDeg(mapCenter, dataWithMeta.stop.context.stop) : null;

  const showRouteTypeOfEntry = infoLevelFlag.isVerboseEnabled || hasMultiRoutes;
  // const showRouteTypeOfStop = infoLevelFlag.isVerboseEnabled || data.stop.context.routeTypes.length >= 2;
  const showRouteTypeOfStop = infoLevelFlag.isVerboseEnabled;

  return (
    // No `data-stop-id` here: the same stop id can appear in several rows across
    // boards, so it cannot identify a single row -- and the stop browser skips its
    // scroll-to-selected effect for this view anyway.
    <li
      className={cn(
        'cursor-pointer border-b border-neutral-800 px-3 py-2 text-neutral-100 last:border-b-0 hover:bg-neutral-800/95',
        ROW_TEXT_CLASS_BY_SIZE[size],
        BOARD_PANEL_BG,
      )}
      onClick={() => onStopSelected(dataWithMeta.stop.id)}
    >
      {/* Single-line departure-board row: time, mode, route, agency, destination, stop, platform. */}
      <div className="flex items-center gap-2 whitespace-nowrap">
        {/* Local TimeInfo: shows timeText; tap selects the stop + opens inspection. */}
        <TimeInfo
          timeText={dataWithMeta.timeText}
          stopId={dataWithMeta.stop.id}
          inspectTarget={dataWithMeta.inspectionTarget}
          className={ROW_TEXT_CLASS_BY_SIZE[size]}
          onStopSelected={onStopSelected}
          onInspectTrip={onInspectTrip}
        />

        {showRouteTypeOfEntry && (
          // Route type emoji for the trip
          <span aria-hidden>{dataWithMeta.routeTypeEmoji}</span>
        )}

        {/* Headsign (destination) + attribute labels: headsign fills the column and
            truncates, pushing the labels to the right edge. */}
        <span className={cn('flex items-center gap-1', HEADSIGN_WIDTH_CLASS_BY_SIZE[size])}>
          <span className="min-w-0 flex-1 truncate">{dataWithMeta.headsign || '-'}</span>
          {/* Attribute labels (terminal / origin / no-pickup / no-drop-off). Shows the
            no-boarding marker so a service that cannot be boarded here is not silent. */}
          <TimetableEntryAttributesLabels
            size={TIMETABLE_ENTRY_ATTRIBUTES_LABELS_SIZE_BY_SIZE[size]}
            attributes={dataWithMeta.attributes}
            showDisplayTerminal={true}
            showDisplayOrigin={true}
            showDisplayPickupUnavailable={infoLevelFlag.isVerboseEnabled}
            showDisplayDropOffUnavailable={infoLevelFlag.isVerboseEnabled}
          />
        </span>

        {/* Route name */}
        <span className="min-w-[6ch] flex-1 truncate text-left text-amber-100">
          {dataWithMeta.routeName}
        </span>

        {/* Operating agency */}
        <span className="min-w-[6ch] flex-1 truncate text-left text-neutral-400">
          {dataWithMeta.agencyName}
        </span>

        {/* Stop: stop-level mode emojis + stop name + platform code. */}
        {showRouteTypeOfStop && (
          // Stop-level mode emojis
          <span aria-hidden>{dataWithMeta.stop.routeTypesEmoji}</span>
        )}

        {/* Stop info kept together as one group (stop name, platform code, and
            distance / direction) so the stop's details are not split across the row. */}
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <span className="min-w-0 truncate">{dataWithMeta.stop.name}</span>
          {dataWithMeta.stop.platformCode !== undefined && (
            <span className="shrink-0 bg-neutral-800 px-1 text-amber-100">
              {dataWithMeta.stop.platformCode}
            </span>
          )}
          {/* Distance + direction to the stop (same DistanceBadge as StopInfo). */}
          {infoLevelFlag.isVerboseEnabled && distanceRounded != null && distanceRounded >= 10 && (
            <DistanceBadge
              meters={distanceRounded}
              bearingDeg={bearing}
              showDirection
              size={DISTANCE_BADGE_SIZE_BY_SIZE[size]}
            />
          )}
        </span>
      </div>
    </li>
  );
}
