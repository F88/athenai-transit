import type { RefObject } from 'react';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { StopWithContext } from '../types/app/transit-composed';
import { NearbyStop } from './nearby-stop';

interface BottomSheetStopsProps {
  filteredDepartures: StopWithContext[];
  selectedStopId: string | null;
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  viewId: string;
  contentRef: RefObject<HTMLDivElement | null>;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
}

export function BottomSheetStops({
  filteredDepartures,
  selectedStopId,
  now,
  mapCenter,
  infoLevel,
  viewId,
  contentRef,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
}: BottomSheetStopsProps) {
  return (
    <div
      className="grid flex-1 grid-cols-1 content-start gap-0 overflow-y-auto px-4 pb-0 sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-3"
      ref={contentRef}
    >
      {filteredDepartures.map((swc) => (
        <NearbyStop
          key={swc.stop.stop_id}
          data={swc}
          isSelected={selectedStopId === swc.stop.stop_id}
          now={now}
          mapCenter={mapCenter}
          infoLevel={infoLevel}
          viewId={viewId}
          onStopSelected={onStopSelected}
          onShowTimetable={onShowTimetable}
          onShowStopTimetable={onShowStopTimetable}
        />
      ))}
    </div>
  );
}
