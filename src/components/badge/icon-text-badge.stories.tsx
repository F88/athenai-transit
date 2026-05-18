import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Accessibility,
  Anchor,
  CalendarDays,
  Clock,
  DoorOpen,
  Globe,
  HardDrive,
  History,
  MapPin,
  Milestone,
  Route,
  Signpost,
  Spline,
  Trash2,
  Waypoints,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { BaseLabelSize } from '../label/base-label';
import { IconTextBadge } from './icon-text-badge';

const ICON_MAP = {
  Accessibility: <Accessibility />,
  Anchor: <Anchor />,
  Clock: <Clock />,
  DoorOpen: <DoorOpen />,
  HardDrive: <HardDrive />,
  History: <History />,
  Globe: <Globe />,
  MapPin: <MapPin />,
  Milestone: <Milestone />,
  Route: <Route />,
  Signpost: <Signpost />,
  Spline: <Spline />,
  Trash2: <Trash2 />,
  CalendarDays: <CalendarDays />,
  Waypoints: <Waypoints />,
  Wrench: <Wrench />,
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
const ICON_OPTIONS: ReadonlyArray<IconName> = [
  'Accessibility',
  'Anchor',
  'Clock',
  'DoorOpen',
  'HardDrive',
  'History',
  'Globe',
  'MapPin',
  'Milestone',
  'Route',
  'Signpost',
  'Spline',
  'Trash2',
  'CalendarDays',
  'Waypoints',
  'Wrench',
];

interface MetricSample {
  name: string;
  iconName: IconName;
  text: string;
  ariaLabel: string;
  iconBg: string;
}

interface MetricCategory {
  title: string;
  items: ReadonlyArray<MetricSample>;
}

const CORE_METRIC_REPRESENTATIVE_ICONS = {
  Stops: 'Signpost',
  Routes: 'Route',
  Trips: 'CalendarDays',
  Connectivity: 'Waypoints',
  Distance: 'Milestone',
  History: 'History',
  Globe: 'Globe',
  Portal: 'DoorOpen',
  Timetable: 'Clock',
  Accessibility: 'Accessibility',
  RouteShapes: 'Spline',
  Data: 'HardDrive',
} as const satisfies Record<string, IconName>;

const CORE_METRIC_CATEGORIES: ReadonlyArray<MetricCategory> = [
  {
    title: 'Transit metrics',
    items: [
      {
        name: 'Stops',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.Stops,
        text: '142',
        ariaLabel: 'Stops: 142',
        iconBg: '#16A34A',
      },
      {
        name: 'Routes',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.Routes,
        text: '24',
        ariaLabel: 'Routes: 24',
        iconBg: '#2563EB',
      },
      {
        name: 'Trips',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.Trips,
        text: '687',
        ariaLabel: 'Trips: 687',
        iconBg: '#F59E0B',
      },
      {
        name: 'Connectivity',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.Connectivity,
        text: '31',
        ariaLabel: 'Connectivity: 31',
        iconBg: '#0F766E',
      },
      {
        name: 'Distance',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.Distance,
        text: '420 m',
        ariaLabel: 'Distance: 420 meters',
        iconBg: '#0D9488',
      },
    ],
  },
  {
    title: 'Transit attributes',
    items: [
      {
        name: 'Accessibility',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.Accessibility,
        text: '6',
        ariaLabel: 'Accessibility: 6',
        iconBg: '#2563EB',
      },
      {
        name: 'Route shapes',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.RouteShapes,
        text: 'ON',
        ariaLabel: 'Route shapes: available',
        iconBg: '#0284C7',
      },
    ],
  },
  {
    title: 'App features',
    items: [
      {
        name: 'Timetable',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.Timetable,
        text: '12',
        ariaLabel: 'Timetable: 12',
        iconBg: '#475569',
      },
      {
        name: 'Translation data / i18n',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.Globe,
        text: '12',
        ariaLabel: 'Translation data / i18n: 12',
        iconBg: '#0891B2',
      },
      {
        name: 'History',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.History,
        text: '42',
        ariaLabel: 'History: 42',
        iconBg: '#7C3AED',
      },
      {
        name: 'Portal',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.Portal,
        text: '8',
        ariaLabel: 'Portal: 8',
        iconBg: '#0EA5E9',
      },
    ],
  },
  {
    title: 'Data',
    items: [
      {
        name: 'Data',
        iconName: CORE_METRIC_REPRESENTATIVE_ICONS.Data,
        text: '3.4 MB',
        ariaLabel: 'Data: 3.4 MB',
        iconBg: '#4F46E5',
      },
    ],
  },
];

const CORE_METRICS_MONOCHROME_ICON_BG = '#334155';

function renderCoreMetricCategories(
  args: Pick<WrapperArgs, 'size' | 'iconFg' | 'textBg' | 'textFg' | 'frameColor'>,
  options: { monochrome: boolean },
) {
  return (
    <div className="flex flex-col gap-4">
      {CORE_METRIC_CATEGORIES.map((category) => (
        <section key={category.title} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            {category.title}
          </h3>
          <div className="flex flex-col gap-2">
            {category.items.map((metric) => (
              <div key={metric.name} className="flex items-center gap-3">
                <span className="w-28 text-xs text-gray-500">{metric.name}</span>
                <Wrapper
                  iconName={metric.iconName}
                  text={metric.text}
                  size={args.size}
                  iconBg={options.monochrome ? CORE_METRICS_MONOCHROME_ICON_BG : metric.iconBg}
                  iconFg={args.iconFg}
                  textBg={args.textBg}
                  textFg={args.textFg}
                  frameColor={args.frameColor}
                  ariaLabel={metric.ariaLabel}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

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

export const AccessibilityIcon: Story = {
  args: {
    iconName: 'Accessibility',
    iconBg: '#2563EB',
    text: '6',
    ariaLabel: 'Accessibility: 6',
  },
};

export const AnchorIcon: Story = {
  args: {
    iconName: 'Anchor',
    iconBg: '#475569',
    text: '42',
    ariaLabel: 'Anchor: 42',
  },
};

export const DoorOpenIcon: Story = {
  args: {
    iconName: 'DoorOpen',
    iconBg: '#0EA5E9',
    text: '8',
    ariaLabel: 'Portal: 8',
  },
};

export const HistoryIcon: Story = {
  args: {
    iconName: 'History',
    iconBg: '#7C3AED',
    text: '42',
    ariaLabel: 'History: 42',
  },
};

export const Trash2Icon: Story = {
  args: {
    iconName: 'Trash2',
    iconBg: '#DC2626',
    text: '12',
    ariaLabel: 'Delete: 12',
  },
};

export const WrenchIcon: Story = {
  args: {
    iconName: 'Wrench',
    iconBg: '#475569',
    text: '4',
    ariaLabel: 'Settings: 4',
  },
};

export const ClockIcon: Story = {
  args: {
    iconName: 'Clock',
    iconBg: '#475569',
    text: '12',
    ariaLabel: 'Timetable: 12',
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

export const RouteIcon: Story = {
  args: {
    iconName: 'Route',
    iconBg: '#2563EB',
    text: '24 routes',
    ariaLabel: 'Routes: 24',
  },
};

export const SplineIcon: Story = {
  args: {
    iconName: 'Spline',
    iconBg: '#0284C7',
    text: 'ON',
    ariaLabel: 'Route shapes: available',
  },
};

export const CalendarDaysIcon: Story = {
  args: {
    iconName: 'CalendarDays',
    iconBg: '#F59E0B',
    text: '687 trips',
    ariaLabel: 'Trips: 687',
  },
};

export const WaypointsIcon: Story = {
  args: {
    iconName: 'Waypoints',
    iconBg: '#0F766E',
    text: '31 links',
    ariaLabel: 'Connectivity: 31',
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

/** Core metric candidates with the same color for comparing icon semantics only. */
export const CoreMetrics: Story = {
  args: { size: 'md' },
  render: (args) => renderCoreMetricCategories(args, { monochrome: true }),
};

/** Core metric candidates with per-metric colors for icon and palette comparison. */
export const CoreMetrics_Colored: Story = {
  args: { size: 'md' },
  render: (args) => renderCoreMetricCategories(args, { monochrome: false }),
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
    name: 'Route shapes',
    iconName: 'Spline',
    text: 'ON',
    iconBg: '#0284C7',
    iconFg: '#FFFFFF',
    ariaLabel: 'Route shapes: available',
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
