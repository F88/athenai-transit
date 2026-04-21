import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InfoLevel } from '../types/app/settings';
import type { Stop } from '../types/app/transit';
import type { StopHistoryEntry } from '../domain/transit/stop-history';
import { resolveAgencyLang } from '../config/transit-defaults';
import { getStopDisplayNames } from '../domain/transit/get-stop-display-names';
import { useInfoLevel } from '../hooks/use-info-level';
import { routeTypesEmoji } from '../utils/route-type-emoji';
import { History } from 'lucide-react';
import { createLogger } from '../lib/logger';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select';

const logger = createLogger('StopHistory');

interface StopHistoryProps {
  history: StopHistoryEntry[];
  selectedStopId: string | null;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  onSelect: (stop: Stop, routeTypes: StopHistoryEntry['routeTypes']) => void;
}

/**
 * Dropdown selector for recently selected stops.
 *
 * Shows the most recent selection in a compact trigger. When opened,
 * displays the full history list.
 * When no stop is selected the trigger shows a dimmed placeholder.
 *
 * Visibility is controlled by infoLevel:
 * - simple: show stop name + emoji
 * - normal: show stop name + emoji
 * - verbose: also show stop_id in the dropdown items
 *
 * @param history - History entries, most recent first.
 * @param selectedStopId - Currently selected stop ID for highlighting.
 * @param infoLevel - Controls display detail.
 * @param onSelect - Called when a history entry is chosen.
 */
export function StopHistory({
  history,
  selectedStopId,
  infoLevel,
  dataLang,
  onSelect,
}: StopHistoryProps) {
  const { t } = useTranslation();
  const il = useInfoLevel(infoLevel);
  const [open, setOpen] = useState(false);

  if (history.length === 0) {
    return null;
  }

  const stopMap = new Map(history.map((e) => [e.stopWithMeta.stop.stop_id, e]));
  const selectedEntry = selectedStopId ? (stopMap.get(selectedStopId) ?? null) : null;

  const handleValueChange = (stopId: string) => {
    const entry = stopMap.get(stopId);
    if (entry) {
      const isCurrent = stopId === selectedStopId;
      logger.debug(
        `select: stopId=${stopId}, name=${entry.stopWithMeta.stop.stop_name}, isCurrent=${isCurrent}`,
      );
      onSelect(entry.stopWithMeta.stop, entry.routeTypes);
    }
  };

  return (
    <div>
      {/* INTENTIONAL: value is always "" — do NOT bind to selectedStopId.
          Radix Select suppresses onValueChange when the clicked item matches
          the current value, which prevents re-selecting the same stop from
          triggering a map pan. Keeping value="" ensures every click fires.
          Trade-off: Radix's built-in checkmark and selected-item ARIA are
          lost, but this dropdown is a navigation shortcut, not a form control,
          so that is acceptable. */}
      <Select value="" onValueChange={handleValueChange} open={open} onOpenChange={setOpen}>
        <SelectTrigger
          className="h-8 max-w-[50dvw] gap-1.5 rounded-2xl border-none bg-white/70 px-2 text-sm text-black dark:bg-black/60 dark:text-white"
          aria-label={t('history.label')}
        >
          {/* Wrap in data-slot="select-value" to inherit SelectTrigger's flex/gap/line-clamp styles.
             Explicit text color overrides the data-placeholder:text-muted-foreground
             that Radix applies because value is always "". */}
          <span
            data-slot="select-value"
            className={
              selectedEntry ? 'text-black dark:text-white' : 'text-black/80 dark:text-white/80'
            }
          >
            {selectedEntry ? (
              <>
                <span className="text-base">{routeTypesEmoji(selectedEntry.routeTypes)}</span>
                <span className="truncate">
                  {getStopDisplayNames(
                    selectedEntry.stopWithMeta.stop,
                    dataLang,
                    resolveAgencyLang(
                      selectedEntry.stopWithMeta.agencies,
                      selectedEntry.stopWithMeta.stop.agency_id,
                    ),
                  ).name || selectedEntry.stopWithMeta.stop.stop_name}
                </span>
              </>
            ) : (
              <History size={14} strokeWidth={3} className="inline text-sky-400" />
            )}
          </span>
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="z-1002 max-h-[40dvh] min-w-48 border-none bg-white/80 text-black backdrop-blur-sm dark:bg-black/80 dark:text-white"
        >
          {history.map((entry) => {
            const { stop, agencies } = entry.stopWithMeta;
            const displayName =
              getStopDisplayNames(stop, dataLang, resolveAgencyLang(agencies, stop.agency_id))
                .name || stop.stop_name;
            return (
              <SelectItem
                key={stop.stop_id}
                value={stop.stop_id}
                className="overflow-hidden focus:bg-black/10 focus:text-black dark:focus:bg-white/20 dark:focus:text-white"
              >
                <span className="shrink-0 text-base">{routeTypesEmoji(entry.routeTypes)}</span>
                <span className="max-w-[60dvw] truncate">{displayName}</span>
                {il.isVerboseEnabled && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {stop.stop_id}
                  </Badge>
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
