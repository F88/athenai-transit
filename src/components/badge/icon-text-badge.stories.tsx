import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bus, Globe, HardDrive, MapPin, Train } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BaseLabelSize } from '../label/base-label';
import { IconTextBadge } from './icon-text-badge';

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
  text: string;
  size: BaseLabelSize;
  iconBg?: string;
  iconFg?: string;
  textBg?: string;
  textFg?: string;
  frameColor?: string;
  ariaLabel?: string;
}

function Wrapper(args: WrapperArgs) {
  return (
    <IconTextBadge
      icon={ICON_MAP[args.iconName]}
      text={args.text}
      size={args.size}
      iconBg={args.iconBg}
      iconFg={args.iconFg}
      textBg={args.textBg}
      textFg={args.textFg}
      frameColor={args.frameColor}
      aria-label={args.ariaLabel}
    />
  );
}

const SIZE_OPTIONS: ReadonlyArray<BaseLabelSize> = ['xs', 'sm', 'md', 'lg', 'xl'];
const ICON_OPTIONS: ReadonlyArray<IconName> = ['HardDrive', 'Globe', 'MapPin', 'Bus', 'Train'];

const meta = {
  title: 'Badge/IconTextBadge',
  component: Wrapper,
  args: {
    iconName: 'HardDrive',
    text: '3.4 MB',
    size: 'sm',
    iconBg: '#1976D2',
    iconFg: '#FFFFFF',
    ariaLabel: 'Bundle size: 3.4 MB',
  },
  argTypes: {
    iconName: { control: 'select', options: ICON_OPTIONS },
    text: { control: 'text' },
    size: { control: 'inline-radio', options: SIZE_OPTIONS },
    iconBg: { control: 'color' },
    iconFg: { control: 'color' },
    textBg: { control: 'color' },
    textFg: { control: 'color' },
    frameColor: { control: 'color' },
    ariaLabel: { control: 'text' },
  },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Default ---

/** Default rendering: text half uses inverted colors, frame matches iconBg. */
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

/** Explicit text colors (not inverted from the icon side). */
export const ExplicitTextColors: Story = {
  args: {
    textBg: '#E3F2FD',
    textFg: '#1976D2',
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
    textBg: undefined,
    textFg: undefined,
    frameColor: undefined,
  },
};

// --- Icon variants ---

export const GlobeIcon: Story = {
  args: {
    iconName: 'Globe',
    iconBg: '#7C3AED',
    text: '5 langs',
    ariaLabel: 'Languages: 5',
  },
};

export const MapPinIcon: Story = {
  args: {
    iconName: 'MapPin',
    iconBg: '#16A34A',
    text: '142 stops',
    ariaLabel: 'Boarding stops: 142',
  },
};

export const BusIcon: Story = {
  args: {
    iconName: 'Bus',
    iconBg: '#F59E0B',
    text: '87/d',
    ariaLabel: 'Peak daily trips: 87',
  },
};

export const TrainIcon: Story = {
  args: {
    iconName: 'Train',
    iconBg: '#0EA5E9',
    text: '24 lines',
    ariaLabel: 'Train lines: 24',
  },
};

// --- Text content variants ---

/** Short numeric text (caller-formatted). */
export const TextShortNumber: Story = { args: { text: '3' } };

/** Locale-formatted thousands (caller-supplied). */
export const TextLocaleNumber: Story = { args: { text: '1,234' } };

/** Caller-formatted size with unit. */
export const TextWithUnit: Story = {
  args: { text: '3.4 MB', ariaLabel: 'Bundle size: 3.4 MB' },
};

/** Star-rating string as text (one of the use cases that justified this badge). */
export const TextStarRating: Story = {
  args: { text: '★★★☆☆', ariaLabel: 'Rating: 3 of 5' },
};

/** Status string. */
export const TextStatus: Story = {
  args: { text: 'ON', iconBg: '#16A34A', ariaLabel: 'Status: on' },
};

// --- Comparisons ---

/** All sizes stacked vertically for the same icon/text/colors. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-2">
      {SIZE_OPTIONS.map((size) => (
        <Wrapper
          key={size}
          iconName={args.iconName}
          text={args.text}
          size={size}
          iconBg={args.iconBg}
          iconFg={args.iconFg}
          textBg={args.textBg}
          textFg={args.textFg}
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
              text={args.text}
              size={args.size}
              iconBg={args.iconBg}
              iconFg={args.iconFg}
              textBg={args.textBg}
              textFg={args.textFg}
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
  text: string;
  iconBg: string;
  iconFg: string;
  ariaLabel: string;
}

const sampleBadges: ReadonlyArray<SampleBadge> = [
  {
    name: 'Bundle size',
    iconName: 'HardDrive',
    text: '12 MB',
    iconBg: '#1976D2',
    iconFg: '#FFFFFF',
    ariaLabel: 'Bundle size: 12 MB',
  },
  {
    name: 'Languages',
    iconName: 'Globe',
    text: '5',
    iconBg: '#7C3AED',
    iconFg: '#FFFFFF',
    ariaLabel: 'Languages: 5',
  },
  {
    name: 'Boarding stops',
    iconName: 'MapPin',
    text: '1,500',
    iconBg: '#16A34A',
    iconFg: '#FFFFFF',
    ariaLabel: 'Boarding stops: 1,500',
  },
  {
    name: 'Peak daily trips',
    iconName: 'Bus',
    text: '8,000/d',
    iconBg: '#F59E0B',
    iconFg: '#FFFFFF',
    ariaLabel: 'Peak daily trips: 8,000',
  },
  {
    name: 'Rating',
    iconName: 'Train',
    text: '★★★☆☆',
    iconBg: '#0EA5E9',
    iconFg: '#FFFFFF',
    ariaLabel: 'Rating: 3 of 5',
  },
];

/**
 * Matrix of icon/text combinations at every supported size. Useful for
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
                  text={badge.text}
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
