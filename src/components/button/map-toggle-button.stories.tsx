import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MapToggleButton } from './map-toggle-button';

const meta = {
  title: 'Button/MapToggleButton',
  component: MapToggleButton,
  args: {
    active: true,
    disabled: false,
    label: 'Toggle',
    onClick: fn(),
    children: '🎯',
  },
  argTypes: {
    active: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MapToggleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic states ---

export const Active: Story = {
  args: { active: true },
};

export const Inactive: Story = {
  args: { active: false },
};

export const Disabled: Story = {
  args: { active: true, disabled: true },
};

// --- Content variants (emoji used in panels) ---

export const EmojiSearch: Story = {
  args: { children: '🔍', label: 'Search stops' },
};

export const EmojiInfo: Story = {
  args: { children: 'i', label: 'App info' },
};

export const EmojiRandom: Story = {
  args: { children: '🎲', label: 'Random place' },
};

export const TextLabel: Story = {
  args: { children: 'JP', label: 'Toggle language' },
};

// --- Comparison ---

export const AllStates: Story = {
  args: { children: '🎯', label: 'Locate' },
  render: (args) => (
    <div className="flex items-center gap-2">
      <MapToggleButton {...args} active>
        {args.children}
      </MapToggleButton>
      <MapToggleButton {...args} active={false}>
        {args.children}
      </MapToggleButton>
      <MapToggleButton {...args} active disabled>
        {args.children}
      </MapToggleButton>
    </div>
  ),
};

// --- Kitchen sink ---

/** All emoji/text variants and states the button is used with across panels. */
export const KitchenSink: Story = {
  args: { active: true, label: 'demo' },
  render: (args) => {
    const items: { label: string; node: React.ReactNode }[] = [
      { label: 'Locate', node: '🎯' },
      { label: 'Random', node: '🎲' },
      { label: 'Search', node: '🔍' },
      { label: 'Info', node: 'i' },
      { label: 'Bus', node: '🚌' },
      { label: 'Train', node: '🚆' },
      { label: 'Subway', node: '🚇' },
      { label: 'Layer', node: '🗺️' },
      { label: 'Lang', node: 'JP' },
      { label: 'Theme', node: '🌙' },
    ];
    return (
      <div className="space-y-3">
        <div>
          <p className="text-muted-foreground mb-1 text-xs">active</p>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <MapToggleButton {...args} key={item.label} active label={item.label}>
                {item.node}
              </MapToggleButton>
            ))}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">inactive (dimmed)</p>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <MapToggleButton {...args} key={item.label} active={false} label={item.label}>
                {item.node}
              </MapToggleButton>
            ))}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">disabled</p>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <MapToggleButton {...args} key={item.label} active disabled label={item.label}>
                {item.node}
              </MapToggleButton>
            ))}
          </div>
        </div>
      </div>
    );
  },
};
