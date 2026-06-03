import { useMemo, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildTransitDisplayRows,
  type TransitDisplayRow,
} from '../../domain/transit/build-transit-display-rows';
import { useScrollFades } from '../../hooks/use-scroll-fades';
import type { StopWithContext } from '../../types/app/transit-composed';
import { ScrollFadeEdge } from '../shared/scroll-fade-edge';

export interface TransitDisplaysContainerProps {
  stopTimes: StopWithContext[];
  dataLangs: readonly string[];
  contentRef: RefObject<HTMLDivElement | null>;
}

export function TransitDisplaysContainer({
  stopTimes,
  dataLangs,
  contentRef,
}: TransitDisplaysContainerProps) {
  const { t } = useTranslation();
  const stopIdsKey = useMemo(() => stopTimes.map((swc) => swc.stop.stop_id).join(','), [stopTimes]);
  const scrollFade = useScrollFades(contentRef, stopIdsKey);
  const rows = useMemo(() => buildTransitDisplayRows(stopTimes, dataLangs), [stopTimes, dataLangs]);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto"
      ref={contentRef}
      onScroll={scrollFade.handleScroll}
    >
      {scrollFade.showTop && <ScrollFadeEdge position="top" />}
      <TransitDisplays
        rows={rows}
        emptyMessage={t('stop.timetable.allFilteredOut')}
        arrivalLabel={t('stopTimeView.arrivingAbsolute')}
        departureLabel={t('stopTimeView.departingAbsolute')}
      />
      {scrollFade.showBottom && <ScrollFadeEdge position="bottom" />}
    </div>
  );
}

export interface TransitDisplaysProps {
  rows: readonly TransitDisplayRow[];
  emptyMessage: string;
  arrivalLabel: string;
  departureLabel: string;
}

export function TransitDisplays({
  rows,
  emptyMessage,
  arrivalLabel,
  departureLabel,
}: TransitDisplaysProps) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-3">
        <p className="m-0 text-xs text-[#9e9e9e] dark:text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-0">
      <ul className="m-0 list-none space-y-1 p-0">
        {rows.map((row) => (
          <TransitDisplay
            key={row.key}
            row={row}
            arrivalLabel={arrivalLabel}
            departureLabel={departureLabel}
          />
        ))}
      </ul>
    </div>
  );
}

export interface TransitDisplayProps {
  row: TransitDisplayRow;
  arrivalLabel: string;
  departureLabel: string;
}

export function TransitDisplay({ row, arrivalLabel, departureLabel }: TransitDisplayProps) {
  return (
    <li className="rounded-md bg-[#f5f7fa] px-3 py-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-100">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-semibold tabular-nums">{row.timeText}</span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          {row.isArrival ? arrivalLabel : departureLabel}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{row.stopName}</span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-gray-600 dark:text-gray-300">
        {row.routeName} / {row.headsign || '-'}
      </div>
    </li>
  );
}
