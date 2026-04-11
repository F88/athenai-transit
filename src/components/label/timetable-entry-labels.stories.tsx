import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimetableEntryLabels } from './timetable-entry-labels';
import { createEntry } from '../../stories/fixtures';

const allEnabled = {
  isDisplayTerminal: true,
  isDisplayOrigin: true,
  isDisplayPickupUnavailable: true,
  isDisplayDropOffUnavailable: true,
};

const meta = {
  title: 'Label/TimetableEntryLabels',
  component: TimetableEntryLabels,
  argTypes: {
    isDisplayTerminal: { control: 'boolean' },
    isDisplayOrigin: { control: 'boolean' },
    isDisplayPickupUnavailable: { control: 'boolean' },
    isDisplayDropOffUnavailable: { control: 'boolean' },
  },
} satisfies Meta<typeof TimetableEntryLabels>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No labels shown — all flags false or entry has no special state. */
export const Normal: Story = {
  args: {
    entry: createEntry(),
    ...allEnabled,
  },
};

/** Terminal stop — gray label. */
export const Terminal: Story = {
  args: {
    entry: createEntry({ isTerminal: true }),
    ...allEnabled,
  },
};

/** Origin stop — blue label. */
export const Origin: Story = {
  args: {
    entry: createEntry({ isOrigin: true }),
    ...allEnabled,
  },
};

/** Pickup unavailable (pickupType=1) — red label. */
export const PickupUnavailable: Story = {
  args: {
    entry: createEntry({ pickupType: 1 }),
    ...allEnabled,
  },
};

/** Drop-off unavailable (dropOffType=1) — red label. */
export const DropOffUnavailable: Story = {
  args: {
    entry: createEntry({ dropOffType: 1 }),
    ...allEnabled,
  },
};

/** Terminal + origin + both boarding constraints. */
export const AllLabels: Story = {
  args: {
    entry: createEntry({ isTerminal: true, isOrigin: true, pickupType: 1, dropOffType: 1 }),
    ...allEnabled,
  },
};

/** Display flags disabled — entry has all states but nothing renders. */
export const AllDisabled: Story = {
  args: {
    entry: createEntry({ isTerminal: true, isOrigin: true, pickupType: 1, dropOffType: 1 }),
    isDisplayTerminal: false,
    isDisplayOrigin: false,
    isDisplayPickupUnavailable: false,
    isDisplayDropOffUnavailable: false,
  },
};

/** All combinations side by side. */
export const KitchenSink: Story = {
  args: {
    entry: createEntry(),
    ...allEnabled,
  },
  render: () => {
    const cases = [
      { label: 'Normal (no labels)', overrides: {} },
      { label: 'Terminal', overrides: { isTerminal: true } },
      { label: 'Origin', overrides: { isOrigin: true } },
      { label: 'Pickup unavailable', overrides: { pickupType: 1 as const } },
      { label: 'Drop-off unavailable', overrides: { dropOffType: 1 as const } },
      {
        label: 'All labels',
        overrides: {
          isTerminal: true,
          isOrigin: true,
          pickupType: 1 as const,
          dropOffType: 1 as const,
        },
      },
    ];
    return (
      <div className="flex flex-col gap-2">
        {cases.map(({ label, overrides }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-40 text-xs text-gray-500">{label}</span>
            <TimetableEntryLabels entry={createEntry(overrides)} {...allEnabled} />
            {Object.keys(overrides).length === 0 && (
              <span className="text-xs text-gray-400">(renders nothing)</span>
            )}
          </div>
        ))}
      </div>
    );
  },
};
