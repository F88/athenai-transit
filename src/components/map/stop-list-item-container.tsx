import type { InfoLevel } from '@/types/app/settings';
import type { StopReferenceSnapshot } from '@/types/app/stop-reference-snapshot';
import type { StopWithMeta } from '@/types/app/transit-composed';

import {
  buildStopListItemPresentationFromHistorySnapshot,
  buildStopListItemPresentationFromMeta,
  type StopListItemPresentation,
} from '@/domain/transit/stop-list-item-presentation';
import { useThemeContrastBackgroundColor } from '@/hooks/use-is-low-contrast-against-theme';

import { StopListItem } from '@/components/map/stop-list-item';

export interface StopListItemContainerProps {
  stopId: string;
  meta: StopWithMeta | null;
  stopReferenceSnapshot: StopReferenceSnapshot;
  infoLevel: InfoLevel;
  dataLang: readonly string[];
  onRemove?: () => void;
}

export function StopListItemContainer({
  stopId,
  meta,
  stopReferenceSnapshot,
  infoLevel,
  dataLang,
  onRemove,
}: StopListItemContainerProps) {
  const themeBackground = useThemeContrastBackgroundColor();
  const resolvedProps: StopListItemPresentation = meta
    ? buildStopListItemPresentationFromMeta({
        meta,
        dataLang,
        themeBackground,
      })
    : buildStopListItemPresentationFromHistorySnapshot(stopReferenceSnapshot);

  return (
    <StopListItem
      stopId={stopId}
      routeTypes={resolvedProps.routeTypes}
      agencies={resolvedProps.agencies}
      name={resolvedProps.name}
      platformCode={resolvedProps.platformCode}
      infoLevel={infoLevel}
      showRemove={meta === null && onRemove !== undefined}
      onRemove={onRemove}
    />
  );
}
