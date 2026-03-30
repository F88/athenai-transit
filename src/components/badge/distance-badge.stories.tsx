import type { Meta, StoryObj } from '@storybook/react-vite';
import { DistanceBadge } from './distance-badge';

const meta = {
  title: 'Badge/DistanceBadge',
  component: DistanceBadge,
  argTypes: {
    meters: { control: { type: 'number', min: 0, max: 5000, step: 10 } },
    bearingDeg: { control: { type: 'number', min: 0, max: 359, step: 1 } },
    showDirection: { control: 'boolean' },
  },
} satisfies Meta<typeof DistanceBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic distance ---

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

/** All cardinal directions side by side. */
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

/** Distance color gradient comparison. */
export const DistanceColors: Story = {
  args: { meters: 100, bearingDeg: 45, showDirection: true },
  render: () => {
    const distances = [50, 100, 200, 300, 500, 700, 1000, 1500, 2000];
    return (
      <div className="flex flex-col gap-2">
        {distances.map((m) => (
          <DistanceBadge key={m} meters={m} bearingDeg={45} showDirection />
        ))}
      </div>
    );
  },
};
