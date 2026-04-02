import type { InfoLevel } from '../../types/app/settings';
import type { SelectionInfo } from '../../domain/map/selection';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { useInfoLevel } from '../../hooks/use-info-level';
import { routeTypeEmoji } from '../../domain/transit/route-type-emoji';
import { RouteBadge } from '../badge/route-badge';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SelectionIndicator');

interface SelectionIndicatorProps {
  info: SelectionInfo | null;
  infoLevel: InfoLevel;
  onStopClick?: () => void;
}

/**
 * Displays the currently selected route at the bottom-center of the map.
 *
 * Returns `null` when nothing is selected or when a stop is selected
 * (stop display is handled by StopHistory).
 *
 * @param info - Current selection info, or null if nothing is selected.
 * @param infoLevel - Controls which metadata fields are shown.
 * @param onStopClick - Currently unused (StopHistory handles stop selection).
 */
export function SelectionIndicator({
  info,
  infoLevel,
  // onStopClick: _onStopClick,
}: SelectionIndicatorProps) {
  const il = useInfoLevel(infoLevel);
  if (!info) {
    return null;
  }

  // Stop indicator is disabled — StopHistory handles stop display.
  // if (info.type === 'stop') {
  //   return (
  //     <button
  //       type="button"
  //       className="pointer-events-auto absolute top-[calc(4rem+env(safe-area-inset-top))] left-2 z-[1001] flex max-w-[50%] cursor-pointer flex-col items-center gap-0.5 overflow-hidden rounded-2xl border-none bg-black/75 px-3.5 py-1.5 text-sm font-semibold text-ellipsis whitespace-nowrap text-white"
  //       onClick={_onStopClick}
  //     >
  //       {il.isVerboseEnabled && (
  //         <span className="rounded-[3px] bg-white/10 px-1.5 text-[10px] leading-[1.4] font-normal text-[#aaa]">
  //           {info.stop.stop_id}
  //         </span>
  //       )}
  //       <span className="flex items-center gap-1.5 overflow-hidden">
  //         <span>{routeTypeEmoji(info.routeType)}</span>
  //         <span className="overflow-hidden text-ellipsis">{info.stop.stop_name}</span>
  //       </span>
  //     </button>
  //   );
  // }
  if (info.type === 'stop') {
    return null;
  }

  logger.debug('Rendering route selection indicator for route', info.route);

  const routeNames = getRouteDisplayNames(info.route, infoLevel);

  return (
    <div className="pointer-events-auto absolute bottom-8 left-1/2 z-1001 flex max-w-[70%] -translate-x-1/2 cursor-default flex-col items-center gap-0.5 overflow-hidden rounded-2xl border-none bg-black/75 px-3.5 py-1.5 text-sm font-semibold text-ellipsis whitespace-nowrap text-white">
      {il.isVerboseEnabled && (
        <span className="rounded-[3px] bg-white/10 px-1.5 text-[10px] leading-[1.4] font-normal text-[#aaa]">
          {info.route.route_id}
        </span>
      )}
      <span className="flex items-center gap-1.5 overflow-hidden">
        <span>{routeTypeEmoji(info.routeType)}</span>
        <RouteBadge route={info.route} infoLevel={infoLevel} />
        {il.isNormalEnabled && routeNames.longName && routeNames.longName !== routeNames.name && (
          <span className="overflow-hidden text-ellipsis">{routeNames.longName}</span>
        )}
      </span>
    </div>
  );
}
