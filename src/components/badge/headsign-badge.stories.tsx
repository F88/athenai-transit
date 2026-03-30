import type { Meta, StoryObj } from '@storybook/react-vite';
import { busRoute, busRoute2, tramRoute, noColorRoute } from '../../stories/fixtures';
import { HeadsignBadge } from './headsign-badge';

const meta = {
  title: 'Badge/HeadsignBadge',
  component: HeadsignBadge,
  args: {
    headsign: '大塚駅前',
    route: busRoute,
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
  args: { headsign: '新宿' },
};

/** Long headsign. */
export const Long: Story = {
  args: { headsign: '東京都立産業技術研究センター前' },
};

/** Empty headsign — caller should handle fallback. */
export const Empty: Story = {
  args: { headsign: '' },
};

// --- Truncation ---

/** Truncated to 5 characters. */
export const Truncated: Story = {
  args: { headsign: '東京都立産業技術研究センター前', maxLength: 5 },
};

/** maxLength larger than headsign — no truncation. */
export const NoTruncation: Story = {
  args: { headsign: '大塚駅前', maxLength: 10 },
};

// --- Route color variants ---

/** Bus route with blue color. */
export const BusRoute: Story = {
  args: { route: busRoute },
};

/** Bus route with green color. */
export const BusRoute2: Story = {
  args: { route: busRoute2 },
};

/** Tram route with red color. */
export const TramRoute: Story = {
  args: { route: tramRoute },
};

/** Route without color — uses fallback styling. */
export const NoColor: Story = {
  args: { route: noColorRoute },
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
    headsign: '東京都立産業技術研究センター前',
    maxLength: 5,
    infoLevel: 'verbose',
  },
};

// --- Comparisons ---

/** All sizes side by side. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <HeadsignBadge
        headsign={args.headsign}
        route={args.route}
        infoLevel={args.infoLevel}
        size="xs"
      />
      <HeadsignBadge
        headsign={args.headsign}
        route={args.route}
        infoLevel={args.infoLevel}
        size="sm"
      />
      <HeadsignBadge
        headsign={args.headsign}
        route={args.route}
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
