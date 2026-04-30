import { describe, expect, it } from 'vitest';

import type { InfoLevel } from '../../../types/app/settings';
import {
  deriveStopTimeRoleDisplayProps,
  type ShouldCollapseArrivalInput,
  shouldCollapseArrival,
} from '../stop-time-display';

/** Build a fully-specified input with sensible defaults. */
function makeInput(
  overrides: Partial<ShouldCollapseArrivalInput> = {},
): ShouldCollapseArrivalInput {
  return {
    arrivalMinutes: 870,
    departureMinutes: 870,
    collapseToleranceMinutes: 0,
    showArrivalTime: true,
    showDepartureTime: true,
    ...overrides,
  };
}

describe('shouldCollapseArrival', () => {
  describe('strict mode (tolerance = 0)', () => {
    it('collapses when both rows shown and minutes match', () => {
      expect(shouldCollapseArrival(makeInput())).toBe(true);
    });

    it('does not collapse when arrival and departure minutes differ by 1', () => {
      expect(shouldCollapseArrival(makeInput({ arrivalMinutes: 870, departureMinutes: 871 }))).toBe(
        false,
      );
    });

    it('treats midnight (0 minutes) the same as any other matching pair', () => {
      expect(shouldCollapseArrival(makeInput({ arrivalMinutes: 0, departureMinutes: 0 }))).toBe(
        true,
      );
    });

    it('treats overnight minute values (>= 1440) the same as any other matching pair', () => {
      // 25:30 service-day overflow — pipeline emits minutes >= 1440 for
      // overnight trips; the rule must not special-case them.
      expect(
        shouldCollapseArrival(makeInput({ arrivalMinutes: 1530, departureMinutes: 1530 })),
      ).toBe(true);
    });
  });

  describe('disabled (tolerance = null)', () => {
    it('does not collapse even when minutes match', () => {
      expect(shouldCollapseArrival(makeInput({ collapseToleranceMinutes: null }))).toBe(false);
    });

    it('does not collapse when minutes differ', () => {
      expect(
        shouldCollapseArrival(
          makeInput({
            collapseToleranceMinutes: null,
            arrivalMinutes: 870,
            departureMinutes: 871,
          }),
        ),
      ).toBe(false);
    });
  });

  describe('tolerance > 0', () => {
    it('collapses when difference is within tolerance', () => {
      expect(
        shouldCollapseArrival(
          makeInput({
            collapseToleranceMinutes: 2,
            arrivalMinutes: 870,
            departureMinutes: 872,
          }),
        ),
      ).toBe(true);
    });

    it('collapses when difference is within tolerance regardless of direction', () => {
      // Departure earlier than arrival is unusual but the rule must
      // still treat |dep - arr| symmetrically.
      expect(
        shouldCollapseArrival(
          makeInput({
            collapseToleranceMinutes: 2,
            arrivalMinutes: 872,
            departureMinutes: 870,
          }),
        ),
      ).toBe(true);
    });

    it('does not collapse when difference exceeds tolerance', () => {
      expect(
        shouldCollapseArrival(
          makeInput({
            collapseToleranceMinutes: 2,
            arrivalMinutes: 870,
            departureMinutes: 873,
          }),
        ),
      ).toBe(false);
    });
  });

  describe('row-visibility gates', () => {
    it('does not collapse when arrival is not shown', () => {
      expect(shouldCollapseArrival(makeInput({ showArrivalTime: false }))).toBe(false);
    });

    it('does not collapse when departure is not shown', () => {
      expect(shouldCollapseArrival(makeInput({ showDepartureTime: false }))).toBe(false);
    });

    it('does not collapse when neither row is shown', () => {
      expect(
        shouldCollapseArrival(makeInput({ showArrivalTime: false, showDepartureTime: false })),
      ).toBe(false);
    });
  });
});

describe('deriveStopTimeRoleDisplayProps', () => {
  describe('non-verbose (simple / normal / detailed share the same rules)', () => {
    const nonVerboseLevels: InfoLevel[] = ['simple', 'normal', 'detailed'];

    it.each(nonVerboseLevels)('origin shows departure only at %s', (infoLevel) => {
      expect(
        deriveStopTimeRoleDisplayProps({ isOrigin: true, isTerminal: false, infoLevel }),
      ).toEqual({
        showArrivalTime: false,
        showDepartureTime: true,
        collapseToleranceMinutes: 2,
      });
    });

    it.each(nonVerboseLevels)('terminal shows arrival only at %s', (infoLevel) => {
      expect(
        deriveStopTimeRoleDisplayProps({ isOrigin: false, isTerminal: true, infoLevel }),
      ).toEqual({
        showArrivalTime: true,
        showDepartureTime: false,
        collapseToleranceMinutes: 2,
      });
    });

    it.each(nonVerboseLevels)('middle stop shows both rows at %s', (infoLevel) => {
      expect(
        deriveStopTimeRoleDisplayProps({ isOrigin: false, isTerminal: false, infoLevel }),
      ).toEqual({
        showArrivalTime: true,
        showDepartureTime: true,
        collapseToleranceMinutes: 2,
      });
    });
  });

  describe('verbose', () => {
    it('origin shows arrival in verbose (data-viewer symmetry with terminal)', () => {
      // Origin's arr === dep is a GTFS-universal invariant, so the
      // arrival row repeats the departure time, but verbose mode
      // exposes both for fidelity.
      expect(
        deriveStopTimeRoleDisplayProps({
          isOrigin: true,
          isTerminal: false,
          infoLevel: 'verbose',
        }),
      ).toEqual({
        showArrivalTime: true,
        showDepartureTime: true,
        collapseToleranceMinutes: null,
      });
    });

    it('terminal exposes operator-recorded departure_time (turnaround dwell)', () => {
      expect(
        deriveStopTimeRoleDisplayProps({
          isOrigin: false,
          isTerminal: true,
          infoLevel: 'verbose',
        }),
      ).toEqual({
        showArrivalTime: true,
        showDepartureTime: true,
        collapseToleranceMinutes: null,
      });
    });

    it('middle stop shows both rows with collapse disabled', () => {
      expect(
        deriveStopTimeRoleDisplayProps({
          isOrigin: false,
          isTerminal: false,
          infoLevel: 'verbose',
        }),
      ).toEqual({
        showArrivalTime: true,
        showDepartureTime: true,
        collapseToleranceMinutes: null,
      });
    });
  });

  describe('single-stop trip (origin === terminal)', () => {
    it('shows both rows at non-verbose (origin gives departure, terminal gives arrival)', () => {
      // showArr  = isTerminal || !isOrigin || isVerbose = true.
      // showDep  = !isTerminal || isVerbose || isOrigin = true.
      // The two rows render at the same minute in practice; the
      // collapse-tolerance rule (=2 for non-verbose) then folds
      // them into a single visual row downstream.
      expect(
        deriveStopTimeRoleDisplayProps({
          isOrigin: true,
          isTerminal: true,
          infoLevel: 'normal',
        }),
      ).toEqual({
        showArrivalTime: true,
        showDepartureTime: true,
        collapseToleranceMinutes: 2,
      });
    });

    it('shows both rows when verbose with collapse disabled', () => {
      expect(
        deriveStopTimeRoleDisplayProps({
          isOrigin: true,
          isTerminal: true,
          infoLevel: 'verbose',
        }),
      ).toEqual({
        showArrivalTime: true,
        showDepartureTime: true,
        collapseToleranceMinutes: null,
      });
    });
  });
});
