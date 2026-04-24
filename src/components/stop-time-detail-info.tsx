import {
  LOW_CONTRAST_BADGE_MIN_RATIO,
  LOW_CONTRAST_TEXT_MIN_RATIO,
} from '@/domain/transit/color-resolver/contrast-thresholds';
import {
  getContrastAdjustedRouteColors,
  resolveRouteColors,
} from '@/domain/transit/color-resolver/route-colors';
import { useThemeContrastAssessment } from '@/hooks/use-is-low-contrast-against-theme';
import { getContrastAwareAlphaSuffixes } from '@/utils/color/contrast-alpha-suffixes';
import { useInfoLevel } from '../hooks/use-info-level';
import type { InfoLevel } from '../types/app/settings';
import type { Agency, TimetableEntryAttributes } from '../types/app/transit';
import type { TimetableEntry } from '../types/app/transit-composed';
import { JourneyTimeBar } from './journey-time-bar';
import { TripPositionIndicator } from './label/trip-position-indicator';
import { TripInfo } from './trip-info';

type StopTimeDetailInfoEntry = Pick<
  TimetableEntry,
  'routeDirection' | 'patternPosition' | 'insights'
>;

interface StopTimeDetailInfoProps {
  entry: StopTimeDetailInfoEntry;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  showRouteTypeIcon: boolean;
  agency?: Agency;
  showAgency: boolean;
  attributes: TimetableEntryAttributes;
}

export function StopTimeDetailInfo({
  entry,
  infoLevel,
  dataLangs,
  showRouteTypeIcon,
  agency,
  showAgency,
  attributes,
}: StopTimeDetailInfoProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);
  const { route } = entry.routeDirection;
  const { routeColor } = resolveRouteColors(route, 'css-hex');
  const routeColorAssessment = useThemeContrastAssessment(routeColor, LOW_CONTRAST_BADGE_MIN_RATIO);
  const contrastAdjustedRouteColors = getContrastAdjustedRouteColors(
    route,
    routeColorAssessment.isLowContrast,
    'css-hex',
  );
  const adjustedColorAssessment = useThemeContrastAssessment(
    contrastAdjustedRouteColors.color,
    LOW_CONTRAST_TEXT_MIN_RATIO,
  );
  const { subtleAlphaSuffix, emphasisAlphaSuffix } = getContrastAwareAlphaSuffixes(
    adjustedColorAssessment.ratio,
  );
  const emphasisAccentColor = `${contrastAdjustedRouteColors.color}${emphasisAlphaSuffix}`;
  const subtleAccentColor = `${contrastAdjustedRouteColors.color}${subtleAlphaSuffix}`;

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
      {infoLevelFlag.isNormalEnabled && (
        <div className="mb-0.5 flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <TripPositionIndicator
              stopIndex={entry.patternPosition.stopIndex}
              totalStops={entry.patternPosition.totalStops}
              size={
                infoLevelFlag.isDetailedEnabled ? 'md' : 'xs'
              }
              showEmoji={infoLevelFlag.isVerboseEnabled}
              showTrack={infoLevelFlag.isNormalEnabled}
              trackColor={subtleAccentColor}
              dotColor={emphasisAccentColor}
              currentColor={contrastAdjustedRouteColors.color}
              trackBorderColor={contrastAdjustedRouteColors.color}
              showTrackBorder={false}
              showPositionLabel={infoLevelFlag.isVerboseEnabled}
              labelTextColor={contrastAdjustedRouteColors.textColor}
              labelBgColor={contrastAdjustedRouteColors.color}
            />
          </div>
        </div>
      )}

      {infoLevelFlag.isDetailedEnabled && (
        <JourneyTimeBar
          remainingMinutes={entry.insights?.remainingMinutes}
          totalMinutes={entry.insights?.totalMinutes}
          size={infoLevelFlag.isDetailedEnabled ? 'md' : 'sm'}
          showEmoji={infoLevelFlag.isVerboseEnabled}
          fillColor={contrastAdjustedRouteColors.color}
          unfilledColor={emphasisAccentColor}
          showRMins={infoLevelFlag.isVerboseEnabled}
          showTMins={infoLevelFlag.isVerboseEnabled}
          minsPosition="right"
          fillDirection="rtl"
          borderColor={contrastAdjustedRouteColors.color}
          minsTextColor={contrastAdjustedRouteColors.textColor}
          minsBgColor={contrastAdjustedRouteColors.color}
          showBorder={false}
        />
      )}

      <div className="min-w-0">
        <TripInfo
          size="md"
          routeDirection={entry.routeDirection}
          infoLevel={infoLevel}
          dataLangs={dataLangs}
          showRouteTypeIcon={showRouteTypeIcon}
          agency={agency}
          showAgency={showAgency}
          attributes={attributes}
        />
      </div>
    </div>
  );
}
