import type { InfoLevel } from '@/types/app/settings';
import type { StopReferenceSnapshot } from '@/types/app/stop-reference-snapshot';
import type { AppRouteTypeValue } from '@/types/app/transit';
import type { StopWithMeta } from '@/types/app/transit-composed';

import {
  buildStopListItemPresentationFromHistorySnapshot,
  buildStopListItemPresentationFromMeta,
} from '@/domain/transit/stop-list-item-presentation';
import { useThemeContrastBackgroundColor } from '@/hooks/use-is-low-contrast-against-theme';

import { StopListItem } from '@/components/map/stop-list-item';

export interface StopListItemContainerProps {
  stopId: string;
  routeTypes: AppRouteTypeValue[];
  meta: StopWithMeta | null;
  fallbackName: string;
  infoLevel: InfoLevel;
  stopReferenceSnapshot?: StopReferenceSnapshot;
  dataLang: readonly string[];
  onRemove?: () => void;
}

export function StopListItemContainer({
  stopId,
  routeTypes,
  meta,
  fallbackName,
  infoLevel,
  stopReferenceSnapshot,
  dataLang,
  onRemove,
}: StopListItemContainerProps) {
  const themeBackground = useThemeContrastBackgroundColor();
  const fallbackProps = stopReferenceSnapshot
    ? buildStopListItemPresentationFromHistorySnapshot(stopReferenceSnapshot)
    : {
        displayName: fallbackName,
        routeTypes: [...routeTypes],
        platformCode: undefined,
        agencyBadges: [],
      };
  const resolvedProps = meta
    ? buildStopListItemPresentationFromMeta({
        meta,
        routeTypes: fallbackProps.routeTypes,
        fallbackDisplayName: fallbackProps.displayName,
        dataLang,
        themeBackground,
      })
    : fallbackProps;

  return (
    <StopListItem
      stopId={stopId}
      displayName={resolvedProps.displayName}
      routeTypes={resolvedProps.routeTypes}
      platformCode={resolvedProps.platformCode}
      agencyBadges={resolvedProps.agencyBadges}
      infoLevel={infoLevel}
      showRemove={meta === null && onRemove !== undefined}
      onRemove={onRemove}
    />
  );
}
