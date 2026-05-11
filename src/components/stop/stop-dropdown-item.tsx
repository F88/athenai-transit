import { Trash2 } from 'lucide-react';
import { resolveAgencyLang } from '../../config/transit-defaults';
import { getStopDisplayNames } from '../../domain/transit/name-resolver/get-stop-display-names';
import { useInfoLevel } from '../../hooks/use-info-level';
import type { InfoLevel } from '../../types/app/settings';
import type { AppRouteTypeValue } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';
import { routeTypesEmoji } from '../../utils/route-type-emoji';
import { AgencyBadge } from '../badge/agency-badge';
import { Badge } from '../ui/badge';
import { SelectItem } from '../ui/select';
import { PlatformCodeLabel } from './platform-code-label';

interface StopDropdownItemProps {
  /** GTFS `stop_id` — used as the underlying `<SelectItem value>`. */
  stopId: string;
  /** Route types served by the stop, rendered as the lead emoji. */
  routeTypes: AppRouteTypeValue[];
  /**
   * Latest `StopWithMeta` resolved from the repository's full dataset.
   * `null` when the stop is no longer present in any active source — the
   * row falls back to {@link fallbackName} and skips platform / agency
   * chips.
   */
  meta: StopWithMeta | null;
  /**
   * Stop name to use when {@link meta} is null (e.g. the persisted name
   * stored on an anchor entry, or the snapshot name on a history entry).
   */
  fallbackName: string;
  /** Active information density level. */
  infoLevel: InfoLevel;
  /** Display language fallback chain for translated names. */
  dataLang: readonly string[];
  /**
   * Optional removal handler. When provided AND `meta` is null (the
   * underlying stop_id is no longer in the active GTFS dataset), an
   * inline trash button appears on the row. Tapping it invokes
   * `onRemove` without selecting the row.
   *
   * Mainly used by Portals to let users prune anchors whose stop_id is
   * not resolvable. Caller decides whether the orphan is from a
   * removed stop or a renamed stop_id; this component only surfaces
   * the affordance.
   */
  onRemove?: () => void;
}

/**
 * Shared `<SelectItem>` row for stop-pick navigation dropdowns
 * ({@link Portals}, {@link StopHistory}).
 *
 * Renders a single dropdown entry built from a {@link StopWithMeta}
 * snapshot:
 *
 * ```text
 * [route-type emoji] [display name (truncated)] [platform code?]
 * [agency badge × N] [stop_id badge (verbose only)]
 * ```
 *
 * Display name resolution prefers the latest GTFS-translated name from
 * `meta`; when `meta` is null (stop dropped from the loaded dataset),
 * it falls back to `fallbackName`.
 */
export function StopDropdownItem({
  stopId,
  routeTypes,
  meta,
  fallbackName,
  infoLevel,
  dataLang,
  onRemove,
}: StopDropdownItemProps) {
  const info = useInfoLevel(infoLevel);
  const displayName = meta
    ? getStopDisplayNames(
        meta.stop,
        dataLang,
        resolveAgencyLang(meta.agencies, meta.stop.agency_id),
      ).name || fallbackName
    : fallbackName;
  const platformCode = meta?.stop.platform_code;
  const agencies = meta?.agencies ?? [];
  const showRemove = meta === null && onRemove !== undefined;

  return (
    <SelectItem
      value={stopId}
      className="overflow-hidden focus:bg-black/10 focus:text-black dark:focus:bg-white/20 dark:focus:text-white"
    >
      <span className="shrink-0 text-base">{routeTypesEmoji(routeTypes)}</span>
      <span className="max-w-[60dvw] truncate">{displayName}</span>
      {platformCode && <PlatformCodeLabel code={platformCode} size="sm" />}
      {agencies.map((agency) => (
        <AgencyBadge
          key={agency.agency_id}
          agency={agency}
          size="sm"
          dataLang={dataLang}
          agencyLangs={resolveAgencyLang(agencies, agency.agency_id)}
          infoLevel={infoLevel}
          showBorder
        />
      ))}
      {info.isVerboseEnabled && (
        <Badge variant="secondary" className="ml-1 text-[10px]">
          {stopId}
        </Badge>
      )}
      {showRemove && (
        <button
          type="button"
          aria-label="Remove orphan entry"
          title="Remove orphan entry"
          className="ml-auto inline-flex shrink-0 items-center justify-center rounded bg-red-100 p-1 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
          // Radix SelectItem reacts on pointerdown/pointerup to commit the
          // selection. The button's `onClick` would fire too late — by then
          // the dropdown has already closed and treated the tap as a row
          // activation. Stopping propagation on pointerdown / pointerup
          // (and click as a fallback) prevents the row from being selected
          // so the trash tap acts purely as a delete.
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove?.();
          }}
        >
          <Trash2 size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
        </button>
      )}
    </SelectItem>
  );
}
