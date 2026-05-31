import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toast } from 'sonner';

import { showOpenOutcomeToast } from '../open-outcome-toast';

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

// Minimal stand-in for the i18next `t` function: echoes the key with a
// prefix so assertions can verify the key was translated before display.
const t = ((key: string) => `t:${key}`) as unknown as Parameters<typeof showOpenOutcomeToast>[1];

describe('showOpenOutcomeToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing for a null message (silent outcome)', () => {
    showOpenOutcomeToast(null, t);

    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows a warning toast with the translated message key', () => {
    showOpenOutcomeToast({ severity: 'warning', messageKey: 'timetable.messages.stopNotFound' }, t);

    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith('t:timetable.messages.stopNotFound');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows an error toast with the translated message key', () => {
    showOpenOutcomeToast(
      { severity: 'error', messageKey: 'tripInspection.messages.openFailed' },
      t,
    );

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('t:tripInspection.messages.openFailed');
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
