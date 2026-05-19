import type { DataBundle, TimetableGroupV2Json } from '@contracts/data/transit-v2-json';

import { formatGtfsDateKey, walkCalendarDates } from './calendar-walk';

export interface ServiceDateCount {
  serviceDate: string;
  tripCount: number;
}

export interface OperatingDatesSummary {
  first: string | null;
  last: string | null;
  count: number;
}

function buildTripsPerService(
  timetable: Record<string, TimetableGroupV2Json[]>,
): Map<string, number> {
  const tripsPerService = new Map<string, number>();

  for (const groups of Object.values(timetable)) {
    for (const group of groups) {
      if (group.si !== 0) {
        continue;
      }
      for (const [serviceId, departures] of Object.entries(group.d)) {
        tripsPerService.set(serviceId, (tripsPerService.get(serviceId) ?? 0) + departures.length);
      }
    }
  }

  return tripsPerService;
}

export function computeServiceDateCoverage(bundle: DataBundle): {
  serviceDateCounts: ServiceDateCount[];
  operatingDates: OperatingDatesSummary;
} {
  const tripsPerService = buildTripsPerService(bundle.timetable.data);
  const serviceDateCounts: ServiceDateCount[] = [];

  walkCalendarDates(bundle.calendar.data, (date, activeServiceIds) => {
    let tripCount = 0;
    for (const serviceId of activeServiceIds) {
      tripCount += tripsPerService.get(serviceId) ?? 0;
    }
    if (tripCount > 0) {
      serviceDateCounts.push({
        serviceDate: formatGtfsDateKey(date),
        tripCount,
      });
    }
  });

  return {
    serviceDateCounts,
    operatingDates: {
      first: serviceDateCounts[0]?.serviceDate ?? null,
      last: serviceDateCounts.at(-1)?.serviceDate ?? null,
      count: serviceDateCounts.length,
    },
  };
}
