import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bus, Globe, HardDrive, MapPin, Train } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BaseLabelSize } from '../label/base-label';
import { IconCountBadge } from './icon-count-badge';

const ICON_MAP = {
  HardDrive: <HardDrive />,
  Globe: <Globe />,
  MapPin: <MapPin />,
  Bus: <Bus />,
  Train: <Train />,
} as const satisfies Record<string, ReactNode>;

type IconName = keyof typeof ICON_MAP;

interface WrapperArgs {
  iconName: IconName;
  count: number;
  size: BaseLabelSize;
  iconBg?: string;
  iconFg?: string;
  countBg?: string;
  countFg?: string;
  frameColor?: string;
  ariaLabel?: string;
}

function Wrapper(args: WrapperArgs) {
  return (
    <IconCountBadge
      icon={ICON_MAP[args.iconName]}
      count={args.count}
      size={args.size}
      iconBg={args.iconBg}
      iconFg={args.iconFg}
      countBg={args.countBg}
      countFg={args.countFg}
      frameColor={args.frameColor}
      aria-label={args.ariaLabel}
    />
  );
}

const SIZE_OPTIONS: ReadonlyArray<BaseLabelSize> = ['xs', 'sm', 'md', 'lg', 'xl'];
const ICON_OPTIONS: ReadonlyArray<IconName> = ['HardDrive', 'Globe', 'MapPin', 'Bus', 'Train'];

const meta = {
  title: 'Badge/IconCountBadge',
  component: Wrapper,
  args: {
    iconName: 'HardDrive',
    count: 348,
    size: 'sm',
    iconBg: '#1976D2',
    iconFg: '#FFFFFF',
    ariaLabel: 'Bundle size: 348',
  },
  argTypes: {
    iconName: { control: 'select', options: ICON_OPTIONS },
    count: { control: 'number' },
    size: { control: 'inline-radio', options: SIZE_OPTIONS },
    iconBg: { control: 'color' },
    iconFg: { control: 'color' },
    countBg: { control: 'color' },
    countFg: { control: 'color' },
    frameColor: { control: 'color' },
    ariaLabel: { control: 'text' },
  },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Default ---

/** Default rendering: count half uses inverted colors, frame matches iconBg. */
export const Default: Story = {};

// --- Size variants ---

export const SizeXs: Story = { args: { size: 'xs' } };
export const SizeSm: Story = { args: { size: 'sm' } };
export const SizeMd: Story = { args: { size: 'md' } };
export const SizeLg: Story = { args: { size: 'lg' } };
export const SizeXl: Story = { args: { size: 'xl' } };

// --- Frame variants ---

/** Neutral gray frame while inner halves keep the icon color. */
export const NeutralFrame: Story = {
  args: { frameColor: '#888888' },
};

/** Strong black frame for emphasis. */
export const BlackFrame: Story = {
  args: { frameColor: '#000000' },
};

// --- Color variants ---

/** Explicit count colors (not inverted from the icon side). */
export const ExplicitCountColors: Story = {
  args: {
    countBg: '#E3F2FD',
    countFg: '#1976D2',
  },
};

/**
 * No colors — falls through to BaseLabel defaults (transparent background,
 * inherited text color). The outer frame has no border color either, so
 * only the inner content is visible with a subtle browser-default outline.
 */
export const NoColors: Story = {
  args: {
    iconBg: undefined,
    iconFg: undefined,
    countBg: undefined,
    countFg: undefined,
    frameColor: undefined,
  },
};

// --- Icon variants ---

export const GlobeIcon: Story = {
  args: { iconName: 'Globe', iconBg: '#7C3AED', count: 5, ariaLabel: 'Languages: 5' },
};

export const MapPinIcon: Story = {
  args: {
    iconName: 'MapPin',
    iconBg: '#16A34A',
    count: 142,
    ariaLabel: 'Boarding stops: 142',
  },
};

export const BusIcon: Story = {
  args: {
    iconName: 'Bus',
    iconBg: '#F59E0B',
    count: 87,
    ariaLabel: 'Peak daily trips: 87',
  },
};

export const TrainIcon: Story = {
  args: {
    iconName: 'Train',
    iconBg: '#0EA5E9',
    count: 24,
    ariaLabel: 'Train lines: 24',
  },
};

// --- Count variants ---

export const CountSmall: Story = { args: { count: 3 } };
export const CountLarge: Story = { args: { count: 348 } };
export const CountThousands: Story = { args: { count: 1234 } };

// --- Comparisons ---

/** All sizes side by side for the same icon/count/colors. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      {SIZE_OPTIONS.map((size) => (
        <Wrapper
          key={size}
          iconName={args.iconName}
          count={args.count}
          size={size}
          iconBg={args.iconBg}
          iconFg={args.iconFg}
          countBg={args.countBg}
          countFg={args.countFg}
          frameColor={args.frameColor}
          ariaLabel={args.ariaLabel}
        />
      ))}
    </div>
  ),
};

/** Frame color variants side by side. */
export const FrameColorComparison: Story = {
  render: (args) => {
    const variants: ReadonlyArray<{ label: string; frameColor: string }> = [
      { label: 'frame = iconBg (default)', frameColor: args.iconBg ?? '#1976D2' },
      { label: 'frame = gray #888', frameColor: '#888888' },
      { label: 'frame = black', frameColor: '#000000' },
      { label: 'frame = red', frameColor: '#DC2626' },
    ];
    return (
      <div className="flex flex-col gap-2">
        {variants.map(({ label, frameColor }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-52 text-xs text-gray-500">{label}</span>
            <Wrapper
              iconName={args.iconName}
              count={args.count}
              size={args.size}
              iconBg={args.iconBg}
              iconFg={args.iconFg}
              countBg={args.countBg}
              countFg={args.countFg}
              frameColor={frameColor}
              ariaLabel={args.ariaLabel}
            />
          </div>
        ))}
      </div>
    );
  },
};

interface SampleBadge {
  name: string;
  iconName: IconName;
  count: number;
  iconBg: string;
  iconFg: string;
  ariaLabel: string;
}

const sampleBadges: ReadonlyArray<SampleBadge> = [
  {
    name: 'Bundle size',
    iconName: 'HardDrive',
    count: 12,
    iconBg: '#1976D2',
    iconFg: '#FFFFFF',
    ariaLabel: 'Bundle size: 12 MB',
  },
  {
    name: 'Languages',
    iconName: 'Globe',
    count: 5,
    iconBg: '#7C3AED',
    iconFg: '#FFFFFF',
    ariaLabel: 'Languages: 5',
  },
  {
    name: 'Boarding stops',
    iconName: 'MapPin',
    count: 1500,
    iconBg: '#16A34A',
    iconFg: '#FFFFFF',
    ariaLabel: 'Boarding stops: 1,500',
  },
  {
    name: 'Peak daily trips',
    iconName: 'Bus',
    count: 8000,
    iconBg: '#F59E0B',
    iconFg: '#FFFFFF',
    ariaLabel: 'Peak daily trips: 8,000',
  },
  {
    name: 'Train lines',
    iconName: 'Train',
    count: 24,
    iconBg: '#0EA5E9',
    iconFg: '#FFFFFF',
    ariaLabel: 'Train lines: 24',
  },
];

/**
 * Matrix of icon/count combinations at every supported size. Useful for
 * spotting alignment regressions when tweaking the per-size padding or
 * the `[&>svg]:h-*` icon sizing.
 */
export const KitchenSink: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {SIZE_OPTIONS.map((size) => (
        <div key={size}>
          <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
            size: {size}
          </div>
          <div className="flex flex-col gap-1">
            {sampleBadges.map((badge) => (
              <div key={badge.name} className="flex items-center gap-2">
                <span className="w-36 text-xs text-gray-500">{badge.name}</span>
                <Wrapper
                  iconName={badge.iconName}
                  count={badge.count}
                  size={size}
                  iconBg={badge.iconBg}
                  iconFg={badge.iconFg}
                  ariaLabel={badge.ariaLabel}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};
