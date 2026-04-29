import type { InfoLevel } from '@/types/app/settings';
import type { Agency, Route } from '@/types/app/transit';
import { routeTypesEmoji } from '@/utils/route-type-emoji';
import { AgencyBadge } from '../badge/agency-badge';
import { LabelCountBadge } from '../badge/label-count-badge';
import { RouteBadge } from '../badge/route-badge';

interface TripBasicInfoProps {
  route: Route;
  routeAgency: Agency | undefined;
  routeAgencyLangs: readonly string[];
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  headsignTitle: string;
  titleWithNoHeadsign: string;
  currentIndex: number;
  totalCount: number;
}

export function TripBasicInfo({
  route,
  routeAgency,
  routeAgencyLangs,
  infoLevel,
  dataLangs,
  headsignTitle,
  titleWithNoHeadsign,
  currentIndex,
  totalCount,
}: TripBasicInfoProps) {
  return (
    <div className="flex items-center gap-2">
      <LabelCountBadge
        label={`${currentIndex}`}
        count={totalCount}
        size="sm"
        labelClassName="bg-info text-info-foreground"
        countClassName="bg-background text-info"
        frameClassName="border-info"
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2 text-center">
        {routeTypesEmoji([route.route_type])}

        {routeAgency && (
          <AgencyBadge
            size="sm"
            agency={routeAgency}
            dataLang={dataLangs}
            agencyLangs={routeAgencyLangs}
            infoLevel={infoLevel}
            showBorder={true}
          />
        )}
        <RouteBadge
          route={route}
          size="sm"
          dataLang={dataLangs}
          agencyLangs={routeAgencyLangs}
          infoLevel={infoLevel}
          showBorder={true}
        />
        {headsignTitle.length > 0 ? (
          <span className="truncate">{headsignTitle}</span>
        ) : (
          titleWithNoHeadsign
        )}
      </div>
    </div>
  );
}
