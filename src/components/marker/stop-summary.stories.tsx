import type { Meta, StoryObj } from '@storybook/react-vite';
import type { AppRouteTypeValue } from '../../types/app/transit';
import {
  agencyOretetsu,
  agencyTobus,
  baseStop,
  busRoute,
  createEntry,
  headsignLong,
  longNameStop,
  storyNow,
  tramRoute,
} from '../../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../../stories/lang-comparison';
import { StopSummary } from './stop-summary';

const defaultEntries = [
  createEntry({ departureMinutes: 870, route: busRoute, headsign: '大塚駅前' }),
  createEntry({ departureMinutes: 884, route: busRoute, headsign: '錦糸町駅前' }),
];

const kitchenSinkEntries = [
  createEntry({
    departureMinutes: 870,
    route: tramRoute,
    tripHeadsign: headsignLong,
    isTerminal: true,
    stopIndex: 14,
    totalStops: 15,
  }),
  createEntry({
    departureMinutes: 879,
    route: busRoute,
    headsign: '東京駅丸の内北口',
    isOrigin: true,
    stopIndex: 0,
    totalStops: 18,
  }),
  createEntry({
    departureMinutes: 893,
    route: busRoute,
    headsign: '非常に長い目的地 経由地点を多数含む 行先',
    pickupType: 1,
    dropOffType: 1,
  }),
];

const meta = {
  title: 'Map/MarkerStopSummary',
  component: StopSummary,
  args: {
    stop: baseStop,
    routeTypes: [3] as AppRouteTypeValue[],
    agencies: [agencyTobus],
    entries: defaultEntries,
    now: storyNow,
    infoLevel: 'normal',
    dataLang: ['ja'],
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] px-3 pt-2.5 pb-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StopSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const WithoutDepartures: Story = {
  args: {
    now: undefined,
  },
};

// --- Variants ---

export const MultiRouteTypes: Story = {
  args: {
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencies: [agencyTobus, agencyOretetsu],
    entries: kitchenSinkEntries,
  },
};

export const Verbose: Story = {
  args: {
    infoLevel: 'verbose',
  },
};

// --- i18n ---

export const LangComparison: Story = {
  args: {
    stop: longNameStop,
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencies: [agencyTobus, agencyOretetsu],
    entries: kitchenSinkEntries,
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="space-y-1">
          <span className="block text-[10px] text-gray-400">{label}</span>
          <StopSummary {...args} dataLang={dataLang} />
        </div>
      ))}
    </div>
  ),
};

// --- Kitchen sink ---

const kitchenSinkArgs = {
  stop: longNameStop,
  routeTypes: [0, 3] as AppRouteTypeValue[],
  agencies: [agencyTobus, agencyOretetsu],
  entries: kitchenSinkEntries,
  now: storyNow,
  dataLang: ['ja'] as const,
};

export const KitchenSinkInfoLevelSimple: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'simple' },
};

export const KitchenSinkInfoLevelNormal: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'normal' },
};

export const KitchenSinkInfoLevelDetailed: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'detailed' },
};

export const KitchenSinkInfoLevelVerbose: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'verbose' },
};
