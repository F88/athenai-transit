import type { Meta, StoryObj } from '@storybook/react-vite';

import { DISTANCE_BANDS } from '../../utils/distance-style';
import { DistanceBadge } from './distance-badge';

const meta = {
  title: 'Badge/DistanceBadge',
  component: DistanceBadge,
  args: {
    meters: 250,
    bearingDeg: 45,
    showDirection: false,
  },
  argTypes: {
    meters: { control: { type: 'number', min: 0, max: 5_000_000, step: 10 } },
    bearingDeg: { control: { type: 'number', min: 0, max: 359, step: 1 } },
    showDirection: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DistanceBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Format a band's `max` value as a human-readable label. Switches to km/Mm
 * past the colored range so the gray-fade thresholds (100km, 1000km) read
 * cleanly instead of as `100000m` / `1000000m`.
 */
function formatBandMax(meters: number): string {
  if (meters < 1_000) {
    return `${meters}m`;
  }
  if (meters < 1_000_000) {
    return `${meters / 1_000}km`;
  }
  return `${meters / 1_000_000}Mm`;
}

// --- Basic ---

export const Default: Story = {};

export const Near: Story = {
  args: { meters: 120 },
};

export const Medium: Story = {
  args: { meters: 450 },
};

export const Far: Story = {
  args: { meters: 950 },
};

export const OverOneKm: Story = {
  args: { meters: 1500 },
};

/** Inside the 10km pink band — rainbow extension, beyond walkable range. */
export const FewKm: Story = {
  args: { meters: 5_000 },
};

/** Inside the 50km wine band — last colored step before the gray fade. */
export const TensOfKm: Story = {
  args: { meters: 30_000 },
};

/** Inside the 100km gray band — neighboring region, beyond the rainbow. */
export const Around100Km: Story = {
  args: { meters: 75_000 },
};

/** Inside the 500km gray band — inter-prefecture / inter-region distance. */
export const HundredsOfKm: Story = {
  args: { meters: 200_000 },
};

/** Inside the 1000km gray band — country-spanning distance. */
export const ThousandsOfKm: Story = {
  args: { meters: 750_000 },
};

/** Beyond the 1000km band — falls back to the most-washed-out gray. */
export const OutOfBand: Story = {
  args: { meters: 5_000_000 },
};

// --- With direction arrow ---

export const DirectionNorth: Story = {
  args: { meters: 300, bearingDeg: 0, showDirection: true },
};

export const DirectionEast: Story = {
  args: { meters: 500, bearingDeg: 90, showDirection: true },
};

export const DirectionSouth: Story = {
  args: { meters: 700, bearingDeg: 180, showDirection: true },
};

export const DirectionWest: Story = {
  args: { meters: 400, bearingDeg: 270, showDirection: true },
};

export const DirectionNorthEast: Story = {
  args: { meters: 250, bearingDeg: 45, showDirection: true },
};

// --- showDirection=false (default) with bearingDeg provided ---

export const DirectionHidden: Story = {
  args: { meters: 300, bearingDeg: 45, showDirection: false },
};

// --- Comparison ---

/** All cardinal and intercardinal directions side by side. */
export const AllDirections: Story = {
  args: { meters: 100, showDirection: true },
  render: (args) => {
    const directions = [
      { label: 'N', deg: 0 },
      { label: 'NE', deg: 45 },
      { label: 'E', deg: 90 },
      { label: 'SE', deg: 135 },
      { label: 'S', deg: 180 },
      { label: 'SW', deg: 225 },
      { label: 'W', deg: 270 },
      { label: 'NW', deg: 315 },
    ];
    return (
      <div className="flex flex-col gap-2">
        {directions.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-6 text-xs text-gray-500">{d.label}</span>
            <DistanceBadge
              meters={args.meters}
              bearingDeg={d.deg}
              showDirection={args.showDirection}
            />
          </div>
        ))}
      </div>
    );
  },
};

/**
 * One badge per band threshold, plus the out-of-band fallback.
 *
 * The visible-range bands (≤100m–≤3km) map to distinct hues. The rainbow
 * extension (≤10km, ≤50km) continues into magenta / wine before the palette
 * drops into the theme-aware gray fade (≤100km, ≤500km, ≤1000km, fallback)
 * via the `--distance-band-*` CSS variables.
 */
export const BandColors: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {DISTANCE_BANDS.map((band) => (
        <div key={band.max} className="flex items-center gap-2">
          <span className="w-20 text-xs text-gray-500">≤ {formatBandMax(band.max)}</span>
          <DistanceBadge meters={band.max} bearingDeg={45} showDirection />
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="w-20 text-xs text-gray-500">fallback</span>
        <DistanceBadge meters={5_000_000} bearingDeg={45} showDirection />
      </div>
    </div>
  ),
};

/**
 * Granular distance gradient covering every band threshold and a few mid-band
 * values, including the new long-range gray bands. Useful for eyeballing the
 * color transitions and the gray fade-out.
 */
export const DistanceColors: Story = {
  render: () => {
    const distances = [
      50, 100, 200, 300, 500, 700, 1_000,
      //
      1_500, 2_000, 2_500, 3_000, 4_000, 5_000, 9_000, 10_000,
      //
      11_000, 20_000, 30_000, 40_000, 50_000,
      //
      51_000, 75_000, 100_000,
      //
      200_000, 750_000, 5_000_000,
    ];
    return (
      <div className="flex flex-col gap-2">
        {distances.map((m) => (
          <DistanceBadge key={m} meters={m} bearingDeg={45} showDirection />
        ))}
      </div>
    );
  },
};

// --- Kitchen sink ---

/** Maximum-content variant: large distance with km formatting and direction arrow. */
export const KitchenSink: Story = {
  args: {
    meters: 2750,
    bearingDeg: 135,
    showDirection: true,
  },
};
