import type { Meta, StoryObj } from '@storybook/react-vite';

import { PlatformCodeLabel } from './platform-code-label';

const meta = {
  title: 'Stop/PlatformCodeLabel',
  component: PlatformCodeLabel,
  args: {
    code: '2',
    size: 'md',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlatformCodeLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Numeric: Story = {
  args: { code: '5' },
};

/** Letter platforms — common for terminus / underground stations. */
export const Letter: Story = {
  args: { code: 'G' },
};

/** Mixed alphanumeric — exercises wider-than-default content. */
export const Mixed: Story = {
  args: { code: '2A' },
};

// --- Edge cases ---

/** Long platform code — verifies the chip does not collapse with `shrink-0`. */
export const Long: Story = {
  args: { code: 'East Tower 12B' },
};

/** Many badges side by side — verifies spacing/wrap behavior in a row. */
export const Multiple: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-1">
      {['1', '2', '3', 'A', 'B', 'G', '2A'].map((code) => (
        <PlatformCodeLabel key={code} code={code} size="md" />
      ))}
    </div>
  ),
};

// --- Size variants ---

const SIZE_SPECS = [
  { size: 'xs', padding: 'px-0.5', font: '8px' },
  { size: 'sm', padding: 'px-1 py-0.5', font: '9px' },
  { size: 'md', padding: 'px-1.5 py-0.5', font: '10px' },
  { size: 'lg', padding: 'px-2 py-0.5', font: '12px' },
  { size: 'xl', padding: 'px-3 py-1', font: '14px' },
] as const;

/**
 * All five {@link ExtendedDisplaySize} steps in one table — chip alongside
 * the resolved padding / font so close-by sizes (e.g. `md` vs `lg`, which
 * share padding and differ only by 2px of font) can be told apart at a
 * glance.
 */
export const SizeComparison: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {SIZE_SPECS.map(({ size, padding, font }) => (
        <div key={size} className="flex items-center gap-3">
          <span className="w-6 text-xs font-semibold text-gray-700 dark:text-gray-300">{size}</span>
          <span className="w-32 font-mono text-[10px] text-gray-500">{padding}</span>
          <span className="w-12 font-mono text-[10px] text-gray-500">{font}</span>
          <PlatformCodeLabel code="2A" size={size} />
        </div>
      ))}
    </div>
  ),
};

/**
 * `md` vs `lg` head-to-head — `lg` bumps padding (`px-1.5` → `px-2`) and
 * font (10px → 12px). This story makes the gap explicit.
 */
export const MdVsLg: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['md', 'lg'] as const).map((size) => {
        const spec = SIZE_SPECS.find((s) => s.size === size);
        return (
          <div key={size} className="flex items-center gap-3">
            <span className="w-6 text-xs font-semibold text-gray-700 dark:text-gray-300">
              {size}
            </span>
            <span className="w-32 font-mono text-[10px] text-gray-500">{spec?.padding}</span>
            <span className="w-12 font-mono text-[10px] text-gray-500">{spec?.font}</span>
            <PlatformCodeLabel code="2A" size={size} />
          </div>
        );
      })}
    </div>
  ),
};

export const SizeXs: Story = {
  args: { size: 'xs' },
};

export const SizeMd: Story = {
  args: { size: 'md' },
};

export const SizeXl: Story = {
  args: { size: 'xl' },
};

// --- Truncation ---

/** Truncates the code at 3 characters with ellipsis. */
export const Truncated: Story = {
  args: { code: 'East Tower 12B', maxLength: 3 },
};

// --- Kitchen sink ---

export const KitchenSink: Story = {
  args: { code: 'East Tower 12B', size: 'xl' },
};
