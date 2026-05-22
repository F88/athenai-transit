import { Fragment, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { History } from 'lucide-react';

import { resolveAgencyLang } from '../config/transit-defaults';
import { createLogger } from '../lib/logger';
import type { InfoLevel } from '../types/app/settings';
import type { StopWithMeta } from '../types/app/transit-composed';
import { routeTypesEmoji } from '../utils/route-type-emoji';

import { getStopDisplayNames } from '../domain/transit/name-resolver/get-stop-display-names';
import type { StopHistoryEntry } from '../domain/transit/stop-history';
// import { StopDropdownItem } from './stop/stop-dropdown-item';
import { Select, SelectContent, SelectTrigger } from './ui/select';
import { StopListItemContainer } from './map/stop-list-item-container';

const logger = createLogger('StopHistory');

interface SelectedHistoryPresentation {
  displayName: string | null;
  routeTypeEmoji: string | null;
}

/**
 * Compose display values for the selected history entry from current stop
 * metadata when available, otherwise fall back to the persisted snapshot.
 */
function composeSelectedHistoryPresentation(
  selectedEntry: StopHistoryEntry | null,
  stopMeta: StopWithMeta | null,
  dataLang: readonly string[],
): SelectedHistoryPresentation {
  if (!selectedEntry) {
    return {
      displayName: null,
      routeTypeEmoji: null,
    };
  }

  if (!stopMeta) {
    return {
      displayName: selectedEntry.snapshot.name,
      routeTypeEmoji: routeTypesEmoji(selectedEntry.snapshot.routeTypes),
    };
  }

  const displayName =
    getStopDisplayNames(
      stopMeta.stop,
      dataLang,
      resolveAgencyLang(stopMeta.agencies, stopMeta.stop.agency_id),
    ).name ||
    selectedEntry.snapshot.name ||
    stopMeta.stop.stop_name;

  const routeTypeEmoji =
    stopMeta.routes.length > 0
      ? routeTypesEmoji([...new Set(stopMeta.routes.map((route) => route.route_type))])
      : routeTypesEmoji(selectedEntry.snapshot.routeTypes);

  return {
    displayName,
    routeTypeEmoji,
  };
}

/**
 * Input contract for rendering the selected stop-history summary and recent
 * history dropdown while delegating selection side effects to the parent.
 */
interface StopHistoryProps {
  history: StopHistoryEntry[];
  selectedStopId: string | null;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Resolve current stop metadata from the repository by stop_id. */
  lookupStopMeta: (stopId: string) => StopWithMeta | null;
  /** Called when a history entry is chosen. */
  onSelect: (entry: StopHistoryEntry) => void;
}

/**
 * Dropdown selector for recently selected stops.
 *
 * Renders the selected history item in the trigger and the full recent-history
 * list in the dropdown. Display values prefer current repository metadata when
 * the stop is still resolvable and fall back to the persisted history snapshot
 * when it is not. Selection handling is intentionally lightweight: the
 * component emits the chosen history entry and leaves stop resolution and
 * app-state updates to the parent.
 */
export function StopHistory({
  history,
  selectedStopId,
  infoLevel,
  dataLang,
  lookupStopMeta,
  onSelect,
}: StopHistoryProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (history.length === 0) {
    return null;
  }

  const historyMap = new Map(history.map((entry) => [entry.snapshot.stopId, entry]));
  const selectedEntry = selectedStopId ? (historyMap.get(selectedStopId) ?? null) : null;

  const stopMeta = selectedEntry ? lookupStopMeta(selectedEntry.snapshot.stopId) : null;
  const selectedPresentation = composeSelectedHistoryPresentation(
    selectedEntry,
    stopMeta,
    dataLang,
  );

  const handleValueChange = (stopId: string) => {
    const entry = historyMap.get(stopId);
    if (entry) {
      const isCurrent = stopId === selectedStopId;
      if (logger.isEnabled('debug')) {
        logger.debug(
          `select: stopId=${stopId}, name=${entry.snapshot.name}, isCurrent=${isCurrent}`,
        );
      }
      onSelect(entry);
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
                <span className="text-base">{selectedPresentation.routeTypeEmoji}</span>
                <span className="truncate">{selectedPresentation.displayName}</span>
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
            const meta = lookupStopMeta(entry.snapshot.stopId);

            return (
              <Fragment key={entry.snapshot.stopId}>
                {/* <StopDropdownItem
                  stopId={entry.snapshot.stopId}
                  routeTypes={entry.snapshot.routeTypes}
                  meta={meta}
                  fallbackName={entry.snapshot.name}
                  infoLevel={infoLevel}
                  dataLang={dataLang}
                /> */}
                <StopListItemContainer
                  stopId={entry.snapshot.stopId}
                  meta={meta}
                  stopReferenceSnapshot={entry.snapshot}
                  infoLevel={infoLevel}
                  dataLang={dataLang}
                />
              </Fragment>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
