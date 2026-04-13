import type { Meta, StoryObj } from '@storybook/react-vite';
import type { BaseLabelSize } from '../label/base-label';
import { LabelCountBadge } from './label-count-badge';

const meta = {
  title: 'Badge/LabelCountBadge',
  component: LabelCountBadge,
  args: {
    label: 'Tokyo Sakura Tram (Arakawa Line)',
    count: 348,
    size: 'sm',
    labelBg: '#EC6FA8',
    labelFg: '#FFFFFF',
  },
  argTypes: {
    label: { control: 'text' },
    count: { control: 'number' },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md'] },
    labelBg: { control: 'color' },
    labelFg: { control: 'color' },
    countBg: { control: 'color' },
    countFg: { control: 'color' },
    frameColor: { control: 'color' },
  },
} satisfies Meta<typeof LabelCountBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Size variants ---

export const SizeXs: Story = {
  args: { size: 'xs' },
};

export const SizeSm: Story = {
  args: { size: 'sm' },
};

export const SizeMd: Story = {
  args: { size: 'md' },
};

// --- Color behavior ---

/** Default: count half uses inverted colors, frame matches labelBg. */
export const Default: Story = {};

/**
 * Frame in a neutral gray while the inner halves keep the label color.
 * Useful when the label color is very light and needs a distinct outline.
 */
export const NeutralFrame: Story = {
  args: { frameColor: '#888888' },
};

/** Strong contrast frame (black) for emphasis. */
export const BlackFrame: Story = {
  args: { frameColor: '#000000' },
};

/**
 * Explicit count colors (not inverted). Useful for themes that want
 * a specific count palette independent of the label color.
 */
export const ExplicitCountColors: Story = {
  args: {
    countBg: '#FFD4E6',
    countFg: '#EC6FA8',
  },
};

/**
 * No colors at all — falls through to BaseLabel defaults (transparent
 * background, inherited text color). The outer frame has no border
 * color either, so only the inner text is visible with a subtle rounded
 * outline from the browser default.
 */
export const NoColors: Story = {
  args: {
    labelBg: undefined,
    labelFg: undefined,
    countBg: undefined,
    countFg: undefined,
    frameColor: undefined,
  },
};

// --- Label / count variants ---

/** Short label (route short_name style). */
export const ShortLabel: Story = {
  args: { label: '都02', count: 42, labelBg: '#1976D2' },
};

/** Tram short name. */
export const TramLabel: Story = {
  args: { label: '荒川線', count: 124, labelBg: '#E60012' },
};

/** Single-digit count. */
export const CountSmall: Story = {
  args: { count: 3 },
};

/** Three-digit count. */
export const CountLarge: Story = {
  args: { count: 348 },
};

/** Four-digit count (locale separator check). */
export const CountThousands: Story = {
  args: { count: 1234 },
};

// --- Comparisons ---

/** All sizes side by side. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <LabelCountBadge {...args} size="xs" />
      <LabelCountBadge {...args} size="sm" />
      <LabelCountBadge {...args} size="md" />
    </div>
  ),
};

/** Frame color variants side by side (same label/count). */
export const FrameColorComparison: Story = {
  args: { label: '都02', count: 42, labelBg: '#1976D2' },
  render: (args) => (
    <div className="flex flex-col gap-2">
      {[
        { label: 'frame = labelBg (default)', frameColor: args.labelBg },
        { label: 'frame = gray #888', frameColor: '#888888' },
        { label: 'frame = black', frameColor: '#000000' },
        { label: 'frame = red', frameColor: '#DC2626' },
      ].map(({ label, frameColor }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-52 text-xs text-gray-500">{label}</span>
          <LabelCountBadge {...args} frameColor={frameColor} />
        </div>
      ))}
    </div>
  ),
};

interface SampleBadge {
  name: string;
  label: string;
  count: number;
  labelBg: string;
  labelFg: string;
}

const sampleBadges: SampleBadge[] = [
  { name: 'Asakusa Line', label: '浅草線', count: 312, labelBg: '#FF535F', labelFg: '#FFFFFF' },
  { name: 'Mita Line', label: '三田線', count: 278, labelBg: '#0067B0', labelFg: '#FFFFFF' },
  { name: 'Shinjuku Line', label: '新宿線', count: 295, labelBg: '#9FB01C', labelFg: '#FFFFFF' },
  { name: 'Oedo Line', label: '大江戸線', count: 341, labelBg: '#CF3366', labelFg: '#FFFFFF' },
  {
    name: 'Arakawa Line',
    label: 'Tokyo Sakura Tram (Arakawa Line)',
    count: 348,
    labelBg: '#EC6FA8',
    labelFg: '#FFFFFF',
  },
];

/** Multiple label/count combinations, default colors, md size. */
export const KitchenSink: Story = {
  args: { size: 'md' },
  render: (args) => {
    const sizes: BaseLabelSize[] = ['xs', 'sm', 'md'];
    return (
      <div className="flex flex-col gap-6">
        {sizes.map((size) => (
          <div key={size}>
            <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
              size: {size}
            </div>
            <div className="flex flex-col gap-1">
              {sampleBadges.map(({ name, label, count, labelBg, labelFg }) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-36 text-xs text-gray-500">{name}</span>
                  <LabelCountBadge
                    label={label}
                    count={count}
                    size={size}
                    labelBg={labelBg}
                    labelFg={labelFg}
                    frameColor={args.frameColor}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};
