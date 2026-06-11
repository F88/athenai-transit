import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimetableEntryAttributesLabels } from './timetable-entry-attributes-labels';
import { getTimetableEntryAttributes } from '../../domain/transit/timetable-entry-attributes';
import { createEntry } from '../../stories/fixtures';

const allEnabled = {
  showDisplayLastStop: true,
  showDisplayFirstStop: true,
  showDisplayPickupUnavailable: true,
  showDisplayDropOffUnavailable: true,
};

const meta = {
  title: 'Label/TimetableEntryAttributesLabels',
  component: TimetableEntryAttributesLabels,
  argTypes: {
    showDisplayLastStop: { control: 'boolean' },
    showDisplayFirstStop: { control: 'boolean' },
    showDisplayPickupUnavailable: { control: 'boolean' },
    showDisplayDropOffUnavailable: { control: 'boolean' },
  },
} satisfies Meta<typeof TimetableEntryAttributesLabels>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No labels shown — all flags false or entry has no special state. */
export const Normal: Story = {
  args: {
    attributes: getTimetableEntryAttributes(createEntry()),
    ...allEnabled,
  },
};

/** Terminal stop — gray label. */
export const Terminal: Story = {
  args: {
    attributes: getTimetableEntryAttributes(createEntry({ isLastStop: true })),
    ...allEnabled,
  },
};

/** Origin stop — blue label. */
export const Origin: Story = {
  args: {
    attributes: getTimetableEntryAttributes(createEntry({ isFirstStop: true })),
    ...allEnabled,
  },
};

/** Pickup unavailable (pickupType=1) — red label. */
export const PickupUnavailable: Story = {
  args: {
    attributes: getTimetableEntryAttributes(createEntry({ pickupType: 1 })),
    ...allEnabled,
  },
};

/** Drop-off unavailable (dropOffType=1) — red label. */
export const DropOffUnavailable: Story = {
  args: {
    attributes: getTimetableEntryAttributes(createEntry({ dropOffType: 1 })),
    ...allEnabled,
  },
};

/** Terminal + origin + both boarding constraints. */
export const AllLabels: Story = {
  args: {
    attributes: getTimetableEntryAttributes(
      createEntry({ isLastStop: true, isFirstStop: true, pickupType: 1, dropOffType: 1 }),
    ),
    ...allEnabled,
  },
};

/** Display flags disabled — attributes has all states but nothing renders. */
export const AllDisabled: Story = {
  args: {
    attributes: getTimetableEntryAttributes(
      createEntry({ isLastStop: true, isFirstStop: true, pickupType: 1, dropOffType: 1 }),
    ),
    showDisplayLastStop: false,
    showDisplayFirstStop: false,
    showDisplayPickupUnavailable: false,
    showDisplayDropOffUnavailable: false,
  },
};

/** All combinations side by side. */
export const KitchenSink: Story = {
  args: {
    attributes: getTimetableEntryAttributes(createEntry()),
    ...allEnabled,
  },
  render: () => {
    const cases = [
      { label: 'Normal (no labels)', overrides: {} },
      { label: 'Terminal', overrides: { isLastStop: true } },
      { label: 'Origin', overrides: { isFirstStop: true } },
      { label: 'Pickup unavailable', overrides: { pickupType: 1 as const } },
      { label: 'Drop-off unavailable', overrides: { dropOffType: 1 as const } },
      {
        label: 'All labels',
        overrides: {
          isLastStop: true,
          isFirstStop: true,
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
            <TimetableEntryAttributesLabels
              attributes={getTimetableEntryAttributes(createEntry(overrides))}
              {...allEnabled}
            />
            {Object.keys(overrides).length === 0 && (
              <span className="text-xs text-gray-400">(renders nothing)</span>
            )}
          </div>
        ))}
      </div>
    );
  },
};
