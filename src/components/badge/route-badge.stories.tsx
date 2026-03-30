import type { Meta, StoryObj } from '@storybook/react-vite';
import { busRoute, busRoute2, tramRoute, noColorRoute } from '../../stories/fixtures';
import { RouteBadge } from './route-badge';

const meta = {
  title: 'Badge/RouteBadge',
  component: RouteBadge,
  args: {
    route: busRoute,
    infoLevel: 'normal',
    size: 'default',
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    size: { control: 'inline-radio', options: ['default', 'sm', 'xs'] },
  },
} satisfies Meta<typeof RouteBadge>;

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

// --- Route variants ---

/** Bus route with color. */
export const Bus: Story = {
  args: { route: busRoute },
};

/** Another bus route with different color. */
export const Bus2: Story = {
  args: { route: busRoute2 },
};

/** Tram route. */
export const Tram: Story = {
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

// --- Comparisons ---

/** All sizes side by side. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <RouteBadge route={args.route} infoLevel={args.infoLevel} size="xs" />
      <RouteBadge route={args.route} infoLevel={args.infoLevel} size="sm" />
      <RouteBadge route={args.route} infoLevel={args.infoLevel} size="default" />
    </div>
  ),
};

// --- Kitchen sink: single route, all info levels ---

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
