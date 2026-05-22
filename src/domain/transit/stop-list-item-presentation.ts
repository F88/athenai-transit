import { resolveAgencyLang } from '../../config/transit-defaults';
import type { StopReferenceSnapshot } from '../../types/app/stop-reference-snapshot';
import type { AppRouteTypeValue } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';
import { resolveAgencyColors } from './color-resolver/agency-colors';
import { resolveContextBorderColor } from './color-resolver/context-border-color';
import { getAgencyDisplayNames } from './name-resolver/get-agency-display-name';
import { getStopDisplayNames } from './name-resolver/get-stop-display-names';

export interface StopListItemAgencyBadgePresentation {
  readonly key: string;
  readonly name: string;
  readonly bgColor?: string;
  readonly fgColor?: string;
  readonly borderColor?: string;
}

export interface StopListItemPresentation {
  readonly routeTypes: readonly AppRouteTypeValue[];
  readonly agencies: readonly StopListItemAgencyBadgePresentation[];
  readonly name: string;
  readonly platformCode?: string;
}

export interface BuildStopListItemPresentationFromMetaParams {
  readonly meta: StopWithMeta;
  readonly dataLang: readonly string[];
  readonly themeBackground: string;
}

function buildAgencyBadgeProps(
  agency: StopWithMeta['agencies'][number],
  agencyLangs: readonly string[],
  dataLang: readonly string[],
  themeBackground: string,
): StopListItemAgencyBadgePresentation {
  const agencyNames = getAgencyDisplayNames(agency, dataLang, agencyLangs, 'short');
  const resolvedName = agencyNames.resolved.name || agency.agency_id;

  const { agencyColor, agencyTextColor } = resolveAgencyColors(agency, 'css-hex');
  const borderColor = resolveContextBorderColor(
    agencyColor ?? '',
    agencyTextColor ?? '',
    themeBackground,
  );

  return {
    key: agency.agency_id,
    name: resolvedName || '?',
    bgColor: agencyColor,
    fgColor: agencyTextColor,
    borderColor: borderColor,
  };
}

export function buildStopListItemPresentationFromMeta({
  meta,
  dataLang,
  themeBackground,
}: BuildStopListItemPresentationFromMetaParams): StopListItemPresentation {
  const routeTypes = [...new Set(meta.routes.map((route) => route.route_type))].sort(
    (a, b) => a - b,
  );
  return {
    name:
      getStopDisplayNames(
        meta.stop,
        dataLang,
        resolveAgencyLang(meta.agencies, meta.stop.agency_id),
      ).name || '?',
    routeTypes: [...routeTypes],
    platformCode: meta.stop.platform_code,
    agencies: meta.agencies.map((agency) => {
      const agencyLangs = resolveAgencyLang(meta.agencies, agency.agency_id);
      return buildAgencyBadgeProps(agency, agencyLangs, dataLang, themeBackground);
    }),
  };
}

export function buildStopListItemPresentationFromHistorySnapshot(
  snapshot: StopReferenceSnapshot,
): StopListItemPresentation {
  return {
    name: snapshot.name,
    routeTypes: [...snapshot.routeTypes],
    platformCode: snapshot.platformCode,
    agencies: snapshot.agencyNames.map((agencyName, index) => {
      return {
        key: `${index}:${agencyName}`,
        name: agencyName,
        bgColor: 'var(--color-muted)',
        fgColor: 'var(--color-muted-foreground)',
        borderColor: 'var(--color-border)',
      };
    }),
  };
}
