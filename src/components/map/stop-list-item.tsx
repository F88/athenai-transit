import { Trash2 } from 'lucide-react';

import type {
  StopListItemAgencyBadgePresentation,
  StopListItemPresentation,
} from '@/domain/transit/stop-list-item-presentation';
import { useInfoLevel } from '@/hooks/use-info-level';
import type { InfoLevel } from '@/types/app/settings';
import { routeTypesEmoji } from '@/utils/route-type-emoji';

import { AgencyBadgeView } from '@/components/badge/agency-badge-view';
import { PlatformCodeLabel } from '@/components/stop/platform-code-label';
import { Badge } from '@/components/ui/badge';
import { SelectItem } from '@/components/ui/select';

export type StopListItemAgencyBadge = StopListItemAgencyBadgePresentation;

export interface StopListItemProps extends StopListItemPresentation {
  readonly stopId: string;
  readonly infoLevel: InfoLevel;
  readonly showRemove?: boolean;
  readonly onRemove?: () => void;
}

export function StopListItem({
  stopId,
  displayName,
  routeTypes,
  platformCode,
  agencyBadges,
  infoLevel,
  showRemove = false,
  onRemove,
}: StopListItemProps) {
  const info = useInfoLevel(infoLevel);
  const shouldShowRemove = showRemove && onRemove !== undefined;

  return (
    <SelectItem
      value={stopId}
      className="overflow-hidden focus:bg-black/10 focus:text-black dark:focus:bg-white/20 dark:focus:text-white"
    >
      <span className="shrink-0 text-base">{routeTypesEmoji([...routeTypes])}</span>
      <span className="max-w-[60dvw] truncate">{displayName}</span>
      {platformCode && <PlatformCodeLabel code={platformCode} size="sm" />}
      {agencyBadges.map((badge) => (
        <AgencyBadgeView
          key={badge.key}
          label={badge.label}
          size="sm"
          infoLevel={infoLevel}
          bgColor={badge.bgColor}
          fgColor={badge.fgColor}
          borderColor={badge.borderColor}
          showBorder
        />
      ))}
      {info.isVerboseEnabled && (
        <Badge variant="secondary" className="ml-1 text-[10px]">
          {stopId}
        </Badge>
      )}
      {shouldShowRemove && (
        <button
          type="button"
          aria-label="Remove orphan entry"
          title="Remove orphan entry"
          className="ml-auto inline-flex shrink-0 items-center justify-center rounded bg-red-100 p-1 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove?.();
          }}
        >
          <Trash2 size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
        </button>
      )}
    </SelectItem>
  );
}
