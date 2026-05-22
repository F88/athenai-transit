import { DEFAULT_AGENCY_LANG, resolveAgencyLang } from '@/config/transit-defaults';

import type { StopReferenceSnapshot } from '@/types/app/stop-reference-snapshot';
import type { AppRouteTypeValue, Stop } from '@/types/app/transit';
import type { StopWithMeta } from '@/types/app/transit-composed';

import { resolveDisplayNamesWithTranslatableText } from '@/domain/transit/i18n/resolve-display-names-with-translatable-text';
import { getAgencyDisplayNames } from '@/domain/transit/name-resolver/get-agency-display-name';
import { getStopDisplayNames } from '@/domain/transit/name-resolver/get-stop-display-names';

export function createStopReferenceSnapshot(
  stopOrMeta: Stop | StopWithMeta,
  routeTypes: readonly AppRouteTypeValue[],
  preferredDisplayLangs: readonly string[] = DEFAULT_AGENCY_LANG,
): StopReferenceSnapshot {
  const stop = 'stop' in stopOrMeta ? stopOrMeta.stop : stopOrMeta;
  const name =
    'agencies' in stopOrMeta
      ? getStopDisplayNames(
          stop,
          preferredDisplayLangs,
          resolveAgencyLang(stopOrMeta.agencies, stop.agency_id),
        ).name || stop.stop_name
      : resolveDisplayNamesWithTranslatableText(
          { name: stop.stop_name, names: stop.stop_names },
          preferredDisplayLangs,
          [],
        ).name || stop.stop_name;
  const agencyNames =
    'agencies' in stopOrMeta
      ? [
          ...new Set(
            stopOrMeta.agencies
              .map((agency) => {
                const agencyLangs = resolveAgencyLang(stopOrMeta.agencies, agency.agency_id);
                return (
                  getAgencyDisplayNames(agency, preferredDisplayLangs, agencyLangs, 'short')
                    .resolved.name || agency.agency_id
                );
              })
              .filter(Boolean),
          ),
        ]
      : [];

  return {
    stopId: stop.stop_id,
    name,
    lat: stop.stop_lat,
    lon: stop.stop_lon,
    routeTypes: [...routeTypes],
    agencyNames,
    platformCode: stop.platform_code,
  };
}
