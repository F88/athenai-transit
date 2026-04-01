import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RouteDirection } from '../../types/app/transit-composed';
import { busRoute, busRoute2, tramRoute, noColorRoute } from '../../stories/fixtures';
import { HeadsignBadge } from './headsign-badge';

/** Default routeDirection fixture for stories. */
const defaultRouteDirection: RouteDirection = {
  route: busRoute,
  headsign: '大塚駅前',
  headsign_names: {},
};

const meta = {
  title: 'Badge/HeadsignBadge',
  component: HeadsignBadge,
  args: {
    routeDirection: defaultRouteDirection,
    infoLevel: 'normal',
    size: 'default',
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    size: { control: 'inline-radio', options: ['default', 'sm', 'xs'] },
  },
} satisfies Meta<typeof HeadsignBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Size variants ---

export const SizeDefault: Story = {
  args: { size: 'default' },
};

export const SizeSm: Story = {
  args: { size: 'sm' },
};

export const SizeXs: Story = {
  args: { size: 'xs' },
};

// --- Headsign variants ---

/** Short headsign. */
export const Short: Story = {
  args: { routeDirection: { ...defaultRouteDirection, headsign: '新宿' } },
};

/** Long headsign. */
export const Long: Story = {
  args: {
    routeDirection: { ...defaultRouteDirection, headsign: '東京都立産業技術研究センター前' },
  },
};

/** Empty headsign — caller should handle fallback. */
export const Empty: Story = {
  args: { routeDirection: { ...defaultRouteDirection, headsign: '' } },
};

// --- Truncation ---

/** Truncated to 5 characters. */
export const Truncated: Story = {
  args: {
    routeDirection: { ...defaultRouteDirection, headsign: '東京都立産業技術研究センター前' },
    maxLength: 5,
  },
};

/** maxLength larger than headsign — no truncation. */
export const NoTruncation: Story = {
  args: { maxLength: 10 },
};

// --- Route color variants ---

/** Bus route with blue color. */
export const BusRoute: Story = {
  args: { routeDirection: { ...defaultRouteDirection, route: busRoute } },
};

/** Bus route with green color. */
export const BusRoute2: Story = {
  args: { routeDirection: { ...defaultRouteDirection, route: busRoute2 } },
};

/** Tram route with red color. */
export const TramRoute: Story = {
  args: { routeDirection: { ...defaultRouteDirection, route: tramRoute } },
};

/** Route without color — uses fallback styling. */
export const NoColor: Story = {
  args: { routeDirection: { ...defaultRouteDirection, route: noColorRoute } },
};

// --- Info levels ---

export const Simple: Story = {
  args: { infoLevel: 'simple' },
};

export const Normal: Story = {
  args: { infoLevel: 'normal' },
};

export const Detailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const Verbose: Story = {
  args: { infoLevel: 'verbose' },
};

/** Verbose with truncation — shows truncation info in dump. */
export const VerboseTruncated: Story = {
  args: {
    routeDirection: { ...defaultRouteDirection, headsign: '東京都立産業技術研究センター前' },
    maxLength: 5,
    infoLevel: 'verbose',
  },
};

/** With headsign translations — shows sub-names in verbose. */
export const WithTranslations: Story = {
  args: {
    routeDirection: {
      ...defaultRouteDirection,
      headsign: '新橋駅前',
      headsign_names: {
        ja: '新橋駅前',
        'ja-Hrkt': 'しんばしえきまえ',
        en: 'Shimbashi Sta.',
      },
    },
    infoLevel: 'verbose',
  },
};

// --- Comparisons ---

/** All sizes side by side. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <HeadsignBadge routeDirection={args.routeDirection} infoLevel={args.infoLevel} size="xs" />
      <HeadsignBadge routeDirection={args.routeDirection} infoLevel={args.infoLevel} size="sm" />
      <HeadsignBadge
        routeDirection={args.routeDirection}
        infoLevel={args.infoLevel}
        size="default"
      />
    </div>
  ),
};

// --- Kitchen sink: single headsign, all info levels ---

export const KitchenSinkInfoLevelSimple: Story = {
  args: { infoLevel: 'simple' },
};

export const KitchenSinkInfoLevelNormal: Story = {
  args: { infoLevel: 'normal' },
};

export const KitchenSinkInfoLevelDetailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const KitchenSinkInfoLevelVerbose: Story = {
  args: { infoLevel: 'verbose' },
};
