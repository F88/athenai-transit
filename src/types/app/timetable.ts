import type { TimetableOmitted } from '@/types/app/repository';
import type { Agency, Route, Stop, StopServiceState } from '@/types/app/transit';
import type { TimetableEntry } from '@/types/app/transit-composed';

export interface TimetableData {
  type: 'route-headsign' | 'stop';
  stop: Stop;
  routes: Route[];
  headsign?: string;
  /**
   * The point in time that this timetable is "as of" -- i.e. the datetime
   * the timetable data is generated against. Carries the time-of-day axis
   * that `serviceDate` does not.
   */
  referenceDateTime: Date;
  serviceDate: Date;
  timetableEntries: TimetableEntry[];
  omitted: TimetableOmitted;
  stopServiceState: StopServiceState;
  agencies: Agency[];
}
