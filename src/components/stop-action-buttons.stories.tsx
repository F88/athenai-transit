import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { baseStop } from '../stories/fixtures';
import { StopActionButtons } from './stop-action-buttons';

const meta = {
  title: 'Stop/StopActionButtons',
  component: StopActionButtons,
  args: {
    stopId: baseStop.stop_id,
    isAnchor: false,
    layout: 'vertical',
    showAnchorButton: true,
    showStopTimetableButton: true,
    showTripInspectionButton: true,
    onToggleAnchor: fn(),
    onShowStopTimetable: fn(),
    onOpenTripInspectionByStopId: fn(),
  },
  argTypes: {
    layout: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    isAnchor: { control: 'boolean' },
    showAnchorButton: { control: 'boolean' },
    showStopTimetableButton: { control: 'boolean' },
    showTripInspectionButton: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <div className="flex min-h-24 w-32 rounded border border-dashed border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-900">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof StopActionButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Anchored: Story = {
  args: {
    isAnchor: true,
  },
};

// --- Layout ---

export const Horizontal: Story = {
  args: {
    layout: 'horizontal',
  },
};

export const LayoutComparison: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <span className="block text-[10px] text-gray-400">Vertical</span>
        <div className="flex min-h-24 w-32 rounded border border-dashed border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-900">
          <StopActionButtons {...args} layout="vertical" />
        </div>
      </div>
      <div className="space-y-1">
        <span className="block text-[10px] text-gray-400">Horizontal</span>
        <div className="flex min-h-16 w-40 rounded border border-dashed border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-900">
          <StopActionButtons {...args} layout="horizontal" />
        </div>
      </div>
    </div>
  ),
};

// --- Visibility ---

export const TimetableOnly: Story = {
  args: {
    showAnchorButton: false,
    showTripInspectionButton: false,
  },
};

export const TripInspectionOnly: Story = {
  args: {
    showAnchorButton: false,
    showStopTimetableButton: false,
  },
};

export const VisibilityComparison: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <span className="block text-[10px] text-gray-400">All actions</span>
        <div className="flex min-h-24 w-32 rounded border border-dashed border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-900">
          <StopActionButtons {...args} />
        </div>
      </div>
      <div className="space-y-1">
        <span className="block text-[10px] text-gray-400">Timetable only</span>
        <div className="flex min-h-24 w-32 rounded border border-dashed border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-900">
          <StopActionButtons {...args} showAnchorButton={false} showTripInspectionButton={false} />
        </div>
      </div>
      <div className="space-y-1">
        <span className="block text-[10px] text-gray-400">Trip inspection only</span>
        <div className="flex min-h-24 w-32 rounded border border-dashed border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-900">
          <StopActionButtons {...args} showAnchorButton={false} showStopTimetableButton={false} />
        </div>
      </div>
    </div>
  ),
};

// --- Kitchen sink ---

export const KitchenSink: Story = {
  args: {
    isAnchor: true,
    layout: 'vertical',
    showAnchorButton: true,
    showStopTimetableButton: true,
    showTripInspectionButton: true,
  },
};
