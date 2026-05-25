import { describe, expect, it } from 'vitest';

import type { TripInspectionNoDataReason } from '../../../types/app/repository';
import { getTripInspectionNoDataMessageKey } from '../trip-inspection-message';

describe('getTripInspectionNoDataMessageKey', () => {
  it('returns the stop-data key for the no-stop-data reason', () => {
    expect(getTripInspectionNoDataMessageKey('no-stop-data')).toBe(
      'tripInspection.messages.noStopData',
    );
  });

  it('returns the no-service key for the no-service-on-this-day reason', () => {
    expect(getTripInspectionNoDataMessageKey('no-service-on-this-day')).toBe(
      'tripInspection.messages.noServiceOnThisDay',
    );
  });

  it('collapses snapshot-unavailable to the generic noData key', () => {
    expect(getTripInspectionNoDataMessageKey('snapshot-unavailable')).toBe(
      'tripInspection.messages.noData',
    );
  });

  it('collapses target-missing to the generic noData key', () => {
    expect(getTripInspectionNoDataMessageKey('target-missing')).toBe(
      'tripInspection.messages.noData',
    );
  });

  it('covers every TripInspectionNoDataReason via exhaustive switch (compile-time guard)', () => {
    // Runtime sanity: iterating over the literal union ensures every
    // member produces a non-empty key. If a new reason is added to
    // the union without a matching case, the switch in the helper
    // is non-exhaustive and TypeScript fails to compile this file,
    // because the helper's return type is `string` but the missing
    // branch makes it `string | undefined`.
    const reasons: TripInspectionNoDataReason[] = [
      'no-stop-data',
      'no-service-on-this-day',
      'snapshot-unavailable',
      'target-missing',
    ];
    for (const reason of reasons) {
      const key = getTripInspectionNoDataMessageKey(reason);
      expect(key).toMatch(/^tripInspection\.messages\./);
    }
  });
});
