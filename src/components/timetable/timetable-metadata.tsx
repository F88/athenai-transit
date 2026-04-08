import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getDisplayMinutes } from '@/domain/transit/timetable-utils';
import type { Route } from '@/types/app/transit';
import type { TimetableEntry } from '@/types/app/transit-composed';
import { PillButton } from '../button/pill-button';

interface TimetableMetadataProps {
  timetableEntries: TimetableEntry[];
}

function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function computeAverageInterval(minutes: number[]): number | null {
  if (minutes.length < 2) {
    return null;
  }

  const totalSpan = minutes[minutes.length - 1] - minutes[0];
  return Math.round(totalSpan / (minutes.length - 1));
}

/**
 * Render timetable statistics and per-route counts above the timetable grid.
 *
 * @param props - Metadata rendering inputs.
 * @returns The rendered timetable metadata block.
 */
export function TimetableMetadata({ timetableEntries }: TimetableMetadataProps) {
  const { t, i18n } = useTranslation();
  const allMinutes = timetableEntries.map((entry) => getDisplayMinutes(entry));
  const count = allMinutes.length;
  const firstTime = count > 0 ? formatMinutes(allMinutes[0]) : null;
  const lastTime = count > 0 ? formatMinutes(allMinutes[count - 1]) : null;
  const avgInterval = computeAverageInterval(allMinutes);

  const routeBreakdown = useMemo(() => {
    const counts = new Map<string, { route: Route; count: number }>();

    for (const entry of timetableEntries) {
      const routeId = entry.routeDirection.route.route_id;
      const current = counts.get(routeId);
      if (current) {
        current.count++;
      } else {
        counts.set(routeId, { route: entry.routeDirection.route, count: 1 });
      }
    }

    return Array.from(counts.values());
  }, [timetableEntries]);

  return (
    <div className="border-border text-muted-foreground mb-3 space-y-0.5 rounded border p-2 text-[11px]">
      <p>
        {firstTime && lastTime && (
          <span>
            {firstTime} - {lastTime}
          </span>
        )}
        <span>
          {' '}
          / {t('timetable.metadata.count', { count: count.toLocaleString(i18n.language) })}
        </span>
        {avgInterval !== null && (
          <span>
            {' '}
            /{' '}
            {t('timetable.metadata.avgInterval', {
              interval: avgInterval.toLocaleString(i18n.language),
            })}
          </span>
        )}
      </p>
      {routeBreakdown.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {routeBreakdown.map((item) => {
            const bg = item.route.route_color ? `#${item.route.route_color}` : undefined;
            const fg = item.route.route_text_color ? `#${item.route.route_text_color}` : undefined;
            const label =
              item.route.route_short_name || item.route.route_long_name || item.route.route_id;

            return (
              <PillButton
                key={item.route.route_id}
                size="sm"
                active={true}
                activeBg={bg}
                activeFg={fg}
                count={item.count}
              >
                {label}
              </PillButton>
            );
          })}
        </div>
      )}
    </div>
  );
}
