import type { TimetableOmitted } from '@/types/app/repository';
import type { Agency, Route, Stop, StopServiceState } from '@/types/app/transit';
import type { TimetableEntry } from '@/types/app/transit-composed';

export interface TimetableData {
  type: 'route-headsign' | 'stop';
  stop: Stop;
  routes: Route[];
  headsign?: string;
  serviceDate: Date;
  timetableEntries: TimetableEntry[];
  omitted: TimetableOmitted;
  stopServiceState: StopServiceState;
  agencies: Agency[];
}
