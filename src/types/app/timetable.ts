import type { TimetableOmitted } from '@/types/app/repository';
import type { Agency, Route, Stop, StopServiceState } from '@/types/app/transit';
import type { TimetableEntry } from '@/types/app/transit-composed';

export interface TimetableData {
  type: 'route-headsign' | 'stop';
  stop: Stop;
  routes: Route[];
  headsign?: string;
  /**
   * Datetime requested when this timetable was opened or re-opened.
   * Used by the dialog to render the date picker value and to decide
   * whether the current-hour highlight should be active.
   */
  viewingDateTime: Date;
  serviceDate: Date;
  timetableEntries: TimetableEntry[];
  omitted: TimetableOmitted;
  stopServiceState: StopServiceState;
  agencies: Agency[];
}
