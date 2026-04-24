import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveAgencyLang } from '@/config/transit-defaults';
import { getEffectiveHeadsign } from '@/domain/transit/get-effective-headsign';
import { getTimetableHeadsignPrefixLengths } from '@/domain/transit/get-timetable-headsign-prefix-lengths';
import { getDisplayMinutes } from '@/domain/transit/timetable-utils';
import { useInfoLevel } from '@/hooks/use-info-level';
import type { TimetableOmitted } from '@/types/app/repository';
import type { InfoLevel } from '@/types/app/settings';
import type { Agency } from '@/types/app/transit';
import type { TimetableEntry, TripInspectionTarget } from '@/types/app/transit-composed';
import { TimetableGridEntry } from './timetable-grid-entry';

interface TimetableGridProps {
  timetableEntries: TimetableEntry[];
  serviceDate: Date;
  showHeadsign: boolean;
  currentHour: number;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  agencies: Agency[];
  omitted: TimetableOmitted;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

function useCurrentHourScroll() {
  return useCallback((el: HTMLDivElement | null) => {
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'start' });
      });
    }
  }, []);
}

/**
 * Render the hour-grouped timetable grid body.
 *
 * @param props - Grid rendering inputs.
 * @returns The rendered timetable grid body.
 */
export function TimetableGrid({
  timetableEntries,
  serviceDate,
  showHeadsign,
  currentHour,
  infoLevel,
  dataLangs,
  agencies,
  omitted,
  onInspectTrip,
}: TimetableGridProps) {
  const scrollRef = useCurrentHourScroll();
  const { t, i18n } = useTranslation();
  const info = useInfoLevel(infoLevel);

  const headsignLengths = useMemo(
    () =>
      showHeadsign
        ? getTimetableHeadsignPrefixLengths(timetableEntries, dataLangs, (agencyId) =>
            resolveAgencyLang(agencies, agencyId),
          )
        : new Map<string, number>(),
    [timetableEntries, showHeadsign, dataLangs, agencies],
  );

  const hourGroups = useMemo(() => {
    const groups = new Map<number, TimetableEntry[]>();
    for (const entry of timetableEntries) {
      const hour = Math.floor(getDisplayMinutes(entry) / 60);
      const list = groups.get(hour);
      if (list) {
        list.push(entry);
      } else {
        groups.set(hour, [entry]);
      }
    }
    return groups;
  }, [timetableEntries]);

  if (hourGroups.size === 0) {
    return (
      <p className="text-muted-foreground p-4 text-center">
        {omitted.terminal > 0
          ? t('timetable.grid.empty.dropOffOnly')
          : t('timetable.grid.empty.noService')}
      </p>
    );
  }

  const isDisplayTerminal = info.isSimpleEnabled;
  const isDisplayOrigin = info.isDetailedEnabled;
  const isDisplayPickupUnavailable = info.isVerboseEnabled;
  const isDisplayDropOffUnavailable = info.isVerboseEnabled;

  const hasCurrentHour = hourGroups.has(currentHour);
  const firstHour = hourGroups.keys().next().value as number;

  return (
    <>
      {Array.from(hourGroups.entries()).map(([hour, entries]) => (
        <div
          key={hour}
          ref={
            hour === currentHour
              ? scrollRef
              : !hasCurrentHour && hour === firstHour
                ? scrollRef
                : undefined
          }
          className={`border-border scroll-mt-6 border-b py-1.5 last:border-b-0 ${hour === currentHour ? 'bg-accent rounded' : ''}`}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-foreground w-10 shrink-0 text-right text-sm font-bold">
              {t('timetable.grid.row.hour', { hour })}
            </span>
            <span className="flex flex-wrap gap-1.5">
              {entries.map((entry, index) => (
                <TimetableGridEntry
                  key={`${entry.routeDirection.route.route_id}__${getEffectiveHeadsign(entry.routeDirection)}__${entry.schedule.departureMinutes}_${entry.schedule.arrivalMinutes}_${index}`}
                  entry={entry}
                  serviceDate={serviceDate}
                  showHeadsign={showHeadsign}
                  headsignMaxLength={headsignLengths.get(
                    getEffectiveHeadsign(entry.routeDirection),
                  )}
                  infoLevel={infoLevel}
                  dataLangs={dataLangs}
                  agencyLang={resolveAgencyLang(agencies, entry.routeDirection.route.agency_id)}
                  isDisplayTerminal={isDisplayTerminal}
                  isDisplayOrigin={isDisplayOrigin}
                  isDisplayPickupUnavailable={isDisplayPickupUnavailable}
                  isDisplayDropOffUnavailable={isDisplayDropOffUnavailable}
                  disableVerbose={true}
                  onInspectTrip={onInspectTrip}
                />
              ))}
            </span>
          </div>
          {info.isVerboseEnabled && (
            <details className="mt-0.5 text-[9px] font-normal text-[#999] dark:text-gray-500">
              <summary
                tabIndex={-1}
                className="cursor-pointer select-none"
                onClick={(event) => event.stopPropagation()}
              >
                [
                {t('timetable.grid.row.entries', {
                  hour,
                  count: entries.length.toLocaleString(i18n.language),
                })}
                ]
              </summary>
              <div className="mt-0.5 flex flex-col gap-0.5">
                {entries.map((entry, index) => (
                  <TimetableGridEntry
                    key={`${entry.routeDirection.route.route_id}__${getEffectiveHeadsign(entry.routeDirection)}__${entry.schedule.departureMinutes}_${entry.schedule.arrivalMinutes}_${index}`}
                    entry={entry}
                    serviceDate={serviceDate}
                    showHeadsign={showHeadsign}
                    headsignMaxLength={headsignLengths.get(
                      getEffectiveHeadsign(entry.routeDirection),
                    )}
                    infoLevel={infoLevel}
                    dataLangs={dataLangs}
                    agencyLang={resolveAgencyLang(agencies, entry.routeDirection.route.agency_id)}
                    isDisplayTerminal={isDisplayTerminal}
                    isDisplayOrigin={isDisplayOrigin}
                    isDisplayPickupUnavailable={isDisplayPickupUnavailable}
                    isDisplayDropOffUnavailable={isDisplayDropOffUnavailable}
                    onInspectTrip={onInspectTrip}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      ))}
    </>
  );
}
