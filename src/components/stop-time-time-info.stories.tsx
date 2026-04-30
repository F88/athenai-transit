import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { storyNow, storyServiceDate } from '../stories/fixtures';
import { StopTimeTimeInfo } from './stop-time-time-info';

/**
 * Convert "minutes-from-now" into "minutes-from-midnight of the
 * service day", which is the unit the component consumes.
 *
 * `storyNow` is 14:25 → 14:25 = 14 * 60 + 25 = 865 minutes.
 */
const NOW_MINUTES = storyNow.getHours() * 60 + storyNow.getMinutes();

/** Departure / arrival N minutes from `storyNow`. */
function offset(minutes: number): number {
  return NOW_MINUTES + minutes;
}

const meta = {
  title: 'StopTime/StopTimeTimeInfo',
  component: StopTimeTimeInfo,
  args: {
    serviceDate: storyServiceDate,
    now: storyNow,
    arrivalMinutes: offset(5),
    departureMinutes: offset(5),
    size: 'md',
    align: 'right',
    showArrivalTime: false,
    showDepartureTime: true,
    collapseToleranceMinutes: 0,
    forceShowRelativeTime: false,
    showVerbose: false,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    align: { control: 'inline-radio', options: ['left', 'center', 'right'] },
    showArrivalTime: { control: 'boolean' },
    showDepartureTime: { control: 'boolean' },
    collapseToleranceMinutes: {
      control: 'inline-radio',
      options: [null, 0, 1, 2, 5],
    },
    forceShowRelativeTime: { control: 'boolean' },
    showVerbose: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StopTimeTimeInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Imminent: Story = {
  args: {
    arrivalMinutes: offset(0),
    departureMinutes: offset(0),
  },
};

export const Past: Story = {
  args: {
    arrivalMinutes: offset(-3),
    departureMinutes: offset(-3),
  },
};

/** Far future: relative time hides automatically (> 60 min). */
export const FarFutureAbsoluteOnly: Story = {
  args: {
    arrivalMinutes: offset(120),
    departureMinutes: offset(120),
  },
};

/** Same far future but `forceShowRelativeTime` keeps the relative line. */
export const FarFutureForceRelative: Story = {
  args: {
    arrivalMinutes: offset(120),
    departureMinutes: offset(120),
    forceShowRelativeTime: true,
  },
};

// --- Show arrival / departure ---

export const DepartureOnly: Story = {
  args: {
    showArrivalTime: false,
    showDepartureTime: true,
  },
};

export const ArrivalOnly: Story = {
  args: {
    showArrivalTime: true,
    showDepartureTime: false,
  },
};

/**
 * Arrival != departure: both rows render with arrival / departure markers
 * (`着` / `発`).
 */
export const ArrivalAndDepartureDistinct: Story = {
  args: {
    arrivalMinutes: offset(5),
    departureMinutes: offset(7),
    showArrivalTime: true,
    showDepartureTime: true,
  },
};

/**
 * Arrival == departure with collapse on: only the departure row renders
 * (no redundant duplicate of the same time).
 */
export const ArrivalEqualsDepartureCollapsed: Story = {
  args: {
    arrivalMinutes: offset(5),
    departureMinutes: offset(5),
    showArrivalTime: true,
    showDepartureTime: true,
    collapseToleranceMinutes: 0,
  },
};

/** Same data as above but collapse disabled → both rows shown. */
export const ArrivalEqualsDepartureNotCollapsed: Story = {
  args: {
    arrivalMinutes: offset(5),
    departureMinutes: offset(5),
    showArrivalTime: true,
    showDepartureTime: true,
    collapseToleranceMinutes: null,
  },
};

/**
 * 1-minute dwell collapses when tolerance is `>= 1`. Useful for
 * trips where pipeline emits 14:30 / 14:31 for the same physical
 * stop event and the UI wants to treat them as one row.
 */
export const ArrivalCloseToDepartureCollapsedWithTolerance: Story = {
  args: {
    arrivalMinutes: offset(5),
    departureMinutes: offset(6),
    showArrivalTime: true,
    showDepartureTime: true,
    collapseToleranceMinutes: 1,
  },
};

// --- Align variants ---
export const AlignComparison: Story = {
  args: { showVerbose: true, showArrivalTime: true },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(['left', 'center', 'right'] as const).map((align) => (
        <div key={align} className="flex items-center gap-3">
          <span className="w-16 text-right text-xs text-gray-500">{align}</span>
          <div className="w-40 border border-dashed border-gray-300">
            <StopTimeTimeInfo {...args} align={align} />
          </div>
        </div>
      ))}
    </div>
  ),
};

// --- Size variants ---
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <div key={size} className="flex items-center gap-3">
          <span className="w-12 text-right text-xs text-gray-500">{size}</span>
          <StopTimeTimeInfo {...args} size={size} />
        </div>
      ))}
    </div>
  ),
};

// --- Verbose ---

export const Verbose: Story = {
  args: {
    showArrivalTime: true,
    showDepartureTime: true,
    arrivalMinutes: offset(5),
    departureMinutes: offset(7),
    showVerbose: true,
  },
};

/** Verbose with collapsed arrival (same time) — only departure badge above. */
export const VerboseCollapsedArrival: Story = {
  args: {
    showArrivalTime: true,
    showDepartureTime: true,
    arrivalMinutes: offset(5),
    departureMinutes: offset(5),
    collapseToleranceMinutes: 0,
    showVerbose: true,
  },
};

// --- Text appearance ---

export const TextAppearanceColored: Story = {
  args: {
    textAppearance: { color: '#0d9488', weight: 'bold' },
  },
};

export const TextAppearanceNormalWeight: Story = {
  args: {
    textAppearance: { weight: 'normal' },
  },
};

// --- Trip inspect (clickable) ---

export const InspectTripClickable: Story = {
  args: {
    onInspectTrip: fn(),
    inspectTarget: {
      tripLocator: {
        patternId: 'story:pattern',
        serviceId: 'story:service',
        tripIndex: 0,
      },
      stopIndex: 3,
      serviceDate: storyServiceDate,
      departureMinutes: offset(5),
    },
  },
};

// --- Kitchen sink ---

const kitchenSinkArgs = {
  serviceDate: storyServiceDate,
  now: storyNow,
  arrivalMinutes: offset(5),
  departureMinutes: offset(7),
  size: 'md' as const,
  showArrivalTime: true,
  showDepartureTime: true,
  collapseToleranceMinutes: 0,
  forceShowRelativeTime: true,
  showVerbose: true,
  textAppearance: { color: '#0d9488', weight: 'bold' as const },
};

export const KitchenSinkAlignLeft: Story = {
  args: { ...kitchenSinkArgs, align: 'left' as const },
};
export const KitchenSinkAlignCenter: Story = {
  args: { ...kitchenSinkArgs, align: 'center' as const },
};
export const KitchenSinkAlignRight: Story = {
  args: { ...kitchenSinkArgs, align: 'right' as const },
};
