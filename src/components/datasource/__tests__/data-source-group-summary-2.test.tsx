/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ENABLEMENT_BADGE_TONE_SCALE,
  ENABLEMENT_TONE_INDEX,
} from '../../badge/metric-badge-tone-scale';
import type { DataSourceGroupInfo } from '../../../types/app/data-source-group-info';
import { DataSourceGroupSummary2 } from '../data-source-group-summary-2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) {
        const firstStringOpt = Object.values(opts).find((value): value is string => {
          return typeof value === 'string';
        });
        if (firstStringOpt !== undefined) {
          return `${key} [${firstStringOpt}]`;
        }
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

function makeGroupInfo(
  operatingDates: { first: string | null; last: string | null } | null,
): DataSourceGroupInfo {
  return {
    groupId: 'test-group',
    infos: [],
    size: null,
    translationLanguages: null,
    boardingStopsCount: null,
    maxTripsPerDay: null,
    operatingDates,
    routeTypeCounts: null,
    routeShapesCount: null,
  };
}

function getOperatingDatesBadge(): HTMLElement {
  return screen.getByLabelText('dataSourceSettings.operatingDates.aria [20260101-20260131]');
}

function expectBadgeFrameColor(expectedFrameColor: string): void {
  expect(getOperatingDatesBadge().getAttribute('style')).toContain(
    `border-color: ${expectedFrameColor};`,
  );
}

describe('DataSourceGroupSummary2 operating-period badge', () => {
  it('uses the unknown tone when the reference date is omitted', () => {
    render(
      <DataSourceGroupSummary2
        groupInfo={makeGroupInfo({ first: '20260101', last: '20260131' })}
      />,
    );

    expectBadgeFrameColor(ENABLEMENT_BADGE_TONE_SCALE[ENABLEMENT_TONE_INDEX.unknown].frameColor);
  });

  it('uses the enabled tone when the reference date is within the operating period', () => {
    render(
      <DataSourceGroupSummary2
        groupInfo={makeGroupInfo({ first: '20260101', last: '20260131' })}
        referenceDateKey="20260115"
      />,
    );

    expectBadgeFrameColor(ENABLEMENT_BADGE_TONE_SCALE[ENABLEMENT_TONE_INDEX.enabled].frameColor);
  });

  it('uses the disabled tone when the reference date is after the operating period', () => {
    render(
      <DataSourceGroupSummary2
        groupInfo={makeGroupInfo({ first: '20260101', last: '20260131' })}
        referenceDateKey="20260201"
      />,
    );

    expectBadgeFrameColor(ENABLEMENT_BADGE_TONE_SCALE[ENABLEMENT_TONE_INDEX.disabled].frameColor);
  });

  it('uses the disabled tone when the reference date is before the operating period', () => {
    render(
      <DataSourceGroupSummary2
        groupInfo={makeGroupInfo({ first: '20260101', last: '20260131' })}
        referenceDateKey="20251201"
      />,
    );

    expectBadgeFrameColor(ENABLEMENT_BADGE_TONE_SCALE[ENABLEMENT_TONE_INDEX.disabled].frameColor);
  });

  it('omits the operating-period badge when operating dates are absent', () => {
    render(<DataSourceGroupSummary2 groupInfo={makeGroupInfo(null)} referenceDateKey="20260115" />);

    expect(
      screen.queryByLabelText(/dataSourceSettings\.operatingDates\.aria/),
    ).not.toBeInTheDocument();
  });

  it('omits the operating-period badge when only one bound is present', () => {
    render(
      <DataSourceGroupSummary2
        groupInfo={makeGroupInfo({ first: null, last: '20260131' })}
        referenceDateKey="20260115"
      />,
    );

    expect(
      screen.queryByLabelText(/dataSourceSettings\.operatingDates\.aria/),
    ).not.toBeInTheDocument();
  });
});
