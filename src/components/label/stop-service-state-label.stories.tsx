import type { Meta, StoryObj } from '@storybook/react-vite';
import { StopServiceStateLabel } from './stop-service-state-label';

const meta = {
  title: 'Label/StopServiceStateLabel',
  component: StopServiceStateLabel,
  argTypes: {
    serviceState: {
      control: 'radio',
      options: ['boardable', 'drop-off-only', 'no-service'],
    },
    size: {
      control: 'radio',
      options: ['xs', 'sm', 'md'],
    },
  },
} satisfies Meta<typeof StopServiceStateLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Normal state — renders nothing. */
export const Boardable: Story = {
  args: { serviceState: 'boardable' },
};

/** Drop-off only — red label. */
export const DropOffOnly: Story = {
  args: { serviceState: 'drop-off-only' },
};

/** No service — gray label. */
export const NoService: Story = {
  args: {
    serviceState: 'no-service',
    size: 'md',
  },
};

/** All states side by side. */
export const KitchenSink: Story = {
  args: { serviceState: 'boardable', size: 'sm' },
  render: ({ size }) => {
    const states = ['boardable', 'drop-off-only', 'no-service'] as const;
    return (
      <div className="flex flex-col gap-2">
        {states.map((state) => (
          <div key={state} className="flex items-center gap-2">
            <span className="w-24 text-xs text-gray-500">{state}</span>
            <StopServiceStateLabel serviceState={state} size={size} />
            {state === 'boardable' && (
              <span className="text-xs text-gray-400">(renders nothing)</span>
            )}
          </div>
        ))}
      </div>
    );
  },
};
