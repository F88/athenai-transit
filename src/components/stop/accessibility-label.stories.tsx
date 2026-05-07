import type { Meta, StoryObj } from '@storybook/react-vite';

import { AccessibilityLabel } from './accessibility-label';

const meta = {
  title: 'Stop/AccessibilityLabel',
  component: AccessibilityLabel,
  args: {
    wheelchairBoarding: 1,
    size: 'md',
  },
  argTypes: {
    wheelchairBoarding: {
      control: 'inline-radio',
      options: [0, 1, 2, undefined],
    },
    size: {
      control: 'inline-radio',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccessibilityLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Variants ---

/** `wheelchair_boarding = 1` — accessible (blue chip). */
export const Accessible: Story = {
  args: { wheelchairBoarding: 1 },
};

/** `wheelchair_boarding = 2` — not accessible (dimmed gray chip with `opacity-30`). */
export const NotAccessible: Story = {
  args: { wheelchairBoarding: 2 },
};

/** `wheelchair_boarding = 0` — unknown; the component renders nothing. */
export const Unknown: Story = {
  args: { wheelchairBoarding: 0 },
};

/** `wheelchair_boarding = undefined` — same as unknown; renders nothing. */
export const Undefined: Story = {
  args: { wheelchairBoarding: undefined },
};

/** Both visible states stacked side by side for quick visual diffing. */
export const Comparison: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-gray-500">1 (accessible)</span>
        <AccessibilityLabel wheelchairBoarding={1} size="md" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-gray-500">2 (not accessible)</span>
        <AccessibilityLabel wheelchairBoarding={2} size="md" />
      </div>
    </div>
  ),
};

// --- Size variants ---

/**
 * All five sizes — chip alongside the resolved padding / icon px so
 * adjacent steps can be told apart at a glance. Mirrors PlatformCodeLabel's
 * SizeComparison.
 */
export const SizeComparison: Story = {
  render: () => {
    const SIZE_SPECS = [
      { size: 'xs', padding: 'px-0.5', iconPx: 10 },
      { size: 'sm', padding: 'px-1 py-0.5', iconPx: 12 },
      { size: 'md', padding: 'px-1.5 py-0.5', iconPx: 14 },
      { size: 'lg', padding: 'px-2 py-0.5', iconPx: 16 },
      { size: 'xl', padding: 'px-3 py-1', iconPx: 20 },
    ] as const;
    return (
      <div className="flex flex-col gap-2">
        {SIZE_SPECS.map(({ size, padding, iconPx }) => (
          <div key={size} className="flex items-center gap-3">
            <span className="w-6 text-xs font-semibold text-gray-700 dark:text-gray-300">
              {size}
            </span>
            <span className="w-32 font-mono text-[10px] text-gray-500">{padding}</span>
            <span className="w-12 font-mono text-[10px] text-gray-500">icon {iconPx}px</span>
            <AccessibilityLabel wheelchairBoarding={1} size={size} />
            <AccessibilityLabel wheelchairBoarding={2} size={size} />
          </div>
        ))}
      </div>
    );
  },
};

// --- Kitchen sink ---

export const KitchenSink: Story = {
  args: { wheelchairBoarding: 1, size: 'xl' },
};
