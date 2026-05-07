import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { BaseLabel, type BaseLabelSize } from './base-label';

const meta = {
  title: 'Label/BaseLabel',
  component: BaseLabel,
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    value: { control: 'text' },
    maxLength: { control: 'number' },
    ellipsis: { control: 'boolean' },
    className: { control: 'text' },
    style: { control: 'object' },
  },
} satisfies Meta<typeof BaseLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: unstyled sm. */
export const Default: Story = {
  args: { value: 'Label' },
};

/** Solid style via className. */
export const Solid: Story = {
  args: { value: 'Solid', className: 'bg-blue-500 text-white' },
};

/** Subtle style via className. */
export const Subtle: Story = {
  args: { value: 'Subtle', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

// --- Size variants ---

/** Size `lg` — wider padding (`px-2`) and 12px font (`text-xs`). */
export const SizeLg: Story = {
  args: { value: 'Lg', size: 'lg', className: 'bg-blue-500 text-white' },
};

/** Size `xl` — taller padding (`px-3 py-1`) and 14px font (`text-sm`). */
export const SizeXl: Story = {
  args: { value: 'Xl', size: 'xl', className: 'bg-blue-500 text-white' },
};

const SIZE_SPECS = [
  { size: 'xs', padding: 'px-0.5', font: 'text-[8px]' },
  { size: 'sm', padding: 'px-1 py-0.5', font: 'text-[9px]' },
  { size: 'md', padding: 'px-1.5 py-0.5', font: 'text-[10px]' },
  { size: 'lg', padding: 'px-2 py-0.5', font: 'text-xs (12px)' },
  { size: 'xl', padding: 'px-3 py-1', font: 'text-sm (14px)' },
] as const;

/**
 * All five sizes in a single table — chip alongside the resolved padding /
 * font so adjacent steps can be told apart at a glance.
 */
export const SizeComparison: Story = {
  args: { value: 'Label' },
  render: ({ value = 'Label' }) => (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {SIZE_SPECS.map(({ size, padding, font }) => (
          <div key={size} className="flex items-center gap-3">
            <div className="flex w-24 justify-end">
              <BaseLabel value={value} size={size} className="bg-blue-500 text-white" />
            </div>
            <span className="w-6 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">
              {size}
            </span>
            <span className="w-32 text-right font-mono text-[10px] text-gray-500">{padding}</span>
            <span className="w-24 text-right font-mono text-[10px] text-gray-500">{font}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {SIZE_SPECS.map(({ size }) => (
          <div key={`${size}-horizontal`} className="flex flex-col items-center gap-1">
            <BaseLabel value={value} size={size} className="bg-blue-500 text-white" />
          </div>
        ))}
      </div>
    </div>
  ),
};

/** Truncated — long text cut at maxLength with ellipsis. */
export const Truncated: Story = {
  args: {
    value: 'Shinjuku Station West Exit',
    className: 'bg-blue-500 text-white',
    maxLength: 8,
  },
};

/** Truncated without ellipsis. */
export const TruncatedNoEllipsis: Story = {
  args: {
    value: 'Shinjuku Station West Exit',
    className: 'bg-blue-500 text-white',
    maxLength: 8,
    ellipsis: false,
  },
};

/**
 * Inline style for runtime-computed colors.
 *
 * Use the `style` prop to pass hex values that are only known at
 * runtime (e.g. GTFS `route_color`). This is the same pattern used
 * by `PillButton` and `RouteBadge` for dynamic GTFS colors, and is
 * the path `RouteCountBadge` uses internally.
 */
export const InlineStyle: Story = {
  args: {
    value: 'Tokyo Sakura Tram (Arakawa Line)',
    style: { background: '#ec6fa8', color: '#ffffff' },
  },
};

/**
 * Combined className and style.
 *
 * Static layout / typography via `className`, runtime colors via
 * `style`. Useful when the caller wants consistent padding or
 * font treatment across instances but still needs per-item colors.
 */
export const ClassNameAndStyle: Story = {
  args: {
    value: 'Combined',
    className: 'font-bold',
    style: { background: '#0067b0', color: '#ffffff' },
  },
};

interface SampleStyle {
  label: string;
  className?: string;
  style?: CSSProperties;
}

const classNameSamples: SampleStyle[] = [
  { label: 'gray solid', className: 'bg-gray-500 text-white' },
  { label: 'blue solid', className: 'bg-blue-500 text-white' },
  { label: 'red solid', className: 'bg-red-500 text-white' },
  {
    label: 'gray subtle',
    className: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
  { label: 'red subtle', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  { label: 'muted', className: 'text-muted-foreground bg-muted' },
];

const styleSamples: SampleStyle[] = [
  { label: 'Asakusa', style: { background: '#ff535f', color: '#ffffff' } },
  { label: 'Mita', style: { background: '#0067b0', color: '#ffffff' } },
  { label: 'Shinjuku', style: { background: '#9fb01c', color: '#ffffff' } },
  { label: 'Oedo', style: { background: '#cf3366', color: '#ffffff' } },
];

/**
 * All size x color combinations, grouped by coloring mechanism.
 *
 * The top group uses static Tailwind classes via `className`.
 * The bottom group uses runtime hex values via `style` (simulating GTFS route_color).
 * Each label is prefixed with its sample name so it is clear which is which.
 */
export const KitchenSink: Story = {
  args: { value: 'Label' },
  render: ({ value = 'Label', maxLength, ellipsis }) => {
    const sizes: BaseLabelSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
    const renderGroup = (title: string, samples: SampleStyle[]) => (
      <div>
        <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">{title}</div>
        <div className="flex flex-col gap-3">
          {sizes.map((size) => (
            <div key={size}>
              <div className="mb-1 text-xs font-semibold text-gray-500">{size}</div>
              <div className="flex flex-col gap-1">
                {samples.map(({ label, className, style }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-28 text-xs text-gray-500">{label}</span>
                    <BaseLabel
                      value={value}
                      size={size}
                      className={className}
                      style={style}
                      maxLength={maxLength}
                      ellipsis={ellipsis}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <div className="flex flex-col gap-6">
        {renderGroup('className-based (static Tailwind)', classNameSamples)}
        {renderGroup('style-based (runtime hex, e.g. GTFS route_color)', styleSamples)}
      </div>
    );
  },
};
