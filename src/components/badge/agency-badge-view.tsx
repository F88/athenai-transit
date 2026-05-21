import type { ReactNode } from 'react';

import type { InfoLevel } from '../../types/app/settings';

import { BaseBadge, type BaseBadgeSize } from './base-badge';

export type AgencyBadgeViewSize = BaseBadgeSize;

export interface AgencyBadgeViewProps {
  label: string;
  size: AgencyBadgeViewSize;
  infoLevel: InfoLevel;
  bgColor?: string;
  fgColor?: string;
  borderColor?: string;
  showBorder?: boolean;
  enableVerboseExtras?: boolean;
  idLabel?: string;
  verboseSlot?: ReactNode;
  className?: string;
}

export function AgencyBadgeView({
  label,
  size,
  infoLevel,
  bgColor,
  fgColor,
  borderColor,
  showBorder = false,
  enableVerboseExtras = false,
  idLabel,
  verboseSlot,
  className,
}: AgencyBadgeViewProps) {
  return (
    <BaseBadge
      label={label}
      size={size}
      bgColor={bgColor}
      fgColor={fgColor}
      borderColor={borderColor}
      showBorder={showBorder}
      className={className}
      infoLevel={infoLevel}
      verboseExtras={{
        enabled: enableVerboseExtras,
        idLabel,
        slot: verboseSlot,
      }}
    />
  );
}
