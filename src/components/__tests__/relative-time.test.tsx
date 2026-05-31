import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RelativeTime } from '../relative-time';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'stopTimeView.soon': 'まもなく',
        'stopTimeView.in': 'あと',
        'stopTimeView.minutes': '分',
      };
      return labels[key] ?? key;
    },
  }),
}));

function renderRelativeTime(props: Partial<React.ComponentProps<typeof RelativeTime>> = {}) {
  const now = new Date(2026, 4, 31, 8, 0, 0);

  return render(<RelativeTime time={new Date(now.getTime() + 5 * 60_000)} now={now} {...props} />);
}

describe('RelativeTime', () => {
  it('renders imminent text for sub-minute future', () => {
    const { container } = renderRelativeTime({ time: new Date(2026, 4, 31, 8, 0, 30) });

    expect(container.textContent).toBe('まもなく');
  });

  it('renders imminent text at the exact current time', () => {
    const { container } = renderRelativeTime({ time: new Date(2026, 4, 31, 8, 0, 0) });

    expect(container.textContent).toBe('まもなく');
  });

  it('renders nothing for sub-minute past by default', () => {
    const { container } = renderRelativeTime({
      time: new Date(2026, 4, 31, 7, 59, 30),
    });

    expect(container.firstChild).toBeNull();
  });

  it('still renders nothing for sub-minute past when past time is shown', () => {
    const { container } = renderRelativeTime({
      time: new Date(2026, 4, 31, 7, 59, 30),
      showPastTime: true,
    });

    expect(container.firstChild).toBeNull();
  });

  it('renders prefix plus minutes for future departures by default', () => {
    const { container } = renderRelativeTime({ time: new Date(2026, 4, 31, 8, 5, 0) });

    expect(container.textContent).toBe('あと5分');
  });

  it('omits the prefix when hidePrefix is enabled', () => {
    const { container } = renderRelativeTime({
      time: new Date(2026, 4, 31, 8, 5, 0),
      hidePrefix: true,
    });

    expect(container.textContent).toBe('5分');
  });

  it('renders nothing for past departures by default', () => {
    const { container } = renderRelativeTime({ time: new Date(2026, 4, 31, 7, 57, 0) });

    expect(container.firstChild).toBeNull();
  });

  it('renders negative minutes for past departures when showPastTime is enabled', () => {
    const { container } = renderRelativeTime({
      time: new Date(2026, 4, 31, 7, 57, 0),
      showPastTime: true,
    });

    expect(container.textContent).toBe('-3分');
  });

  it('renders one minute at the exact future boundary', () => {
    const { container } = renderRelativeTime({ time: new Date(2026, 4, 31, 8, 1, 0) });

    expect(container.textContent).toBe('あと1分');
  });

  it('renders one minute just after the future boundary', () => {
    const { container } = renderRelativeTime({ time: new Date(2026, 4, 31, 8, 1, 1) });

    expect(container.textContent).toBe('あと1分');
  });
});
