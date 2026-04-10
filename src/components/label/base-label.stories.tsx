import type { Meta, StoryObj } from '@storybook/react-vite';
import { BaseLabel, type BaseLabelSize } from './base-label';

const meta = {
  title: 'Label/BaseLabel',
  component: BaseLabel,
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md'] },
    value: { control: 'text' },
    maxLength: { control: 'number' },
    ellipsis: { control: 'boolean' },
    className: { control: 'text' },
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

const sampleStyles = [
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

/** All size × style combinations. */
export const KitchenSink: Story = {
  args: { value: 'Label' },
  render: ({ value = 'Label', maxLength, ellipsis }) => {
    const sizes: BaseLabelSize[] = ['xs', 'sm', 'md'];
    return (
      <div className="flex flex-col gap-3">
        {sizes.map((size) => (
          <div key={size}>
            <div className="mb-1 text-xs font-semibold text-gray-500">{size}</div>
            <div className="flex flex-wrap items-center gap-1">
              {sampleStyles.map(({ label, className }) => (
                <BaseLabel
                  key={label}
                  value={value}
                  size={size}
                  className={className}
                  maxLength={maxLength}
                  ellipsis={ellipsis}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};
