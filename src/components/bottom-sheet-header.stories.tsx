import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PERF_PROFILES } from '../config/perf-profiles';
import { APP_ROUTE_TYPES } from '../config/route-types';
import { DEFAULT_VIEW_ID, DEPARTURE_VIEWS } from '../domain/transit/stop-time-views';
import {
  agencyAt,
  agencyBlue,
  agencyDe,
  agencyGreen,
  agencyGx,
  agencyLong,
  agencyNoColor,
  agencyOretetsu,
  agencyRed,
  agencyTobus,
  agencyUk,
  agencyUs,
  agencyYellow,
  allAgencies,
} from '../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../stories/lang-comparison';
import { BottomSheetHeader } from './bottom-sheet-header';

// --- Shared defaults ---

const defaultDataConfig = PERF_PROFILES.normal.data;
const selectView = (id: string) => DEPARTURE_VIEWS.find((v) => v.id === id);
const defaultSelectedView = selectView(DEFAULT_VIEW_ID);

/** All route type values defined in APP_ROUTE_TYPES except the `-1` unknown placeholder. */
const ALL_PRESENT_ROUTE_TYPES: readonly number[] = APP_ROUTE_TYPES.map((rt) => rt.value).filter(
  (v) => v !== -1,
);

// --- Meta ---

const meta = {
  title: 'BottomSheet/BottomSheetHeader',
  component: BottomSheetHeader,
  args: {
    hasNearbyLoaded: true,
    counts: { total: 12, active: 7, filtered: 7 },
    dataConfig: defaultDataConfig,
    dataLang: ['ja'],
    showOperatingStopsOnly: false,
    viewId: DEFAULT_VIEW_ID,
    selectedView: defaultSelectedView,
    infoLevel: 'normal',
    presentRouteTypes: [3],
    hiddenRouteTypes: new Set<number>(),
    presentAgencies: [agencyTobus],
    hiddenAgencyIds: new Set<string>(),
    onToggleShowOperatingStopsOnly: fn(),
    onViewChange: fn(),
    onToggleRouteType: fn(),
    onToggleAgency: fn(),
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    showOperatingStopsOnly: { control: 'boolean' },
    hasNearbyLoaded: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-lg bg-white pt-2 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BottomSheetHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Loading: Story = {
  args: {
    hasNearbyLoaded: false,
    counts: { total: 0, active: 0, filtered: 0 },
  },
};

export const NoStops: Story = {
  args: {
    counts: { total: 0, active: 0, filtered: 0 },
    presentRouteTypes: [],
    presentAgencies: [],
  },
};

export const NoOperatingStops: Story = {
  args: {
    counts: { total: 8, active: 0, filtered: 0 },
    showOperatingStopsOnly: true,
    presentRouteTypes: [3],
    presentAgencies: [agencyTobus],
  },
};

export const OperatingOnlyActive: Story = {
  args: {
    counts: { total: 15, active: 9, filtered: 9 },
    showOperatingStopsOnly: true,
  },
};

// --- Route type filters ---

export const SingleRouteType: Story = {
  args: { presentRouteTypes: [3] },
};

export const MultiRouteTypes: Story = {
  args: {
    presentRouteTypes: [0, 1, 2, 3, 4, 5, 6, 7, 11, 12],
    presentAgencies: [agencyTobus, agencyOretetsu, agencyBlue, agencyRed, agencyGreen],
  },
};

export const AllRouteTypes: Story = {
  args: {
    presentRouteTypes: ALL_PRESENT_ROUTE_TYPES,
    presentAgencies: allAgencies,
  },
};

export const RouteTypeHidden: Story = {
  args: {
    presentRouteTypes: [0, 3],
    hiddenRouteTypes: new Set<number>([0]),
    presentAgencies: [agencyTobus, agencyBlue],
  },
};

export const MultipleRouteTypesHidden: Story = {
  args: {
    presentRouteTypes: [0, 1, 2, 3, 4, 11],
    hiddenRouteTypes: new Set<number>([0, 1, 4]),
    presentAgencies: [agencyTobus, agencyBlue, agencyRed],
  },
};

// --- Agency filters ---

export const SingleAgency: Story = {
  args: { presentAgencies: [agencyTobus] },
};

export const MultiAgencies: Story = {
  args: {
    presentAgencies: [agencyTobus, agencyRed, agencyBlue, agencyGreen, agencyYellow],
  },
};

export const AgencyHidden: Story = {
  args: {
    presentAgencies: [agencyTobus, agencyRed, agencyBlue],
    hiddenAgencyIds: new Set<string>([agencyRed.agency_id]),
  },
};

export const LongAgencyName: Story = {
  args: {
    presentAgencies: [agencyLong, agencyTobus],
    presentRouteTypes: [2, 3],
  },
};

export const AgencyNoColor: Story = {
  args: { presentAgencies: [agencyNoColor, agencyTobus] },
};

export const InternationalAgencies: Story = {
  args: {
    presentRouteTypes: [0, 1, 2, 3],
    presentAgencies: [agencyGx, agencyUs, agencyDe, agencyUk, agencyAt],
  },
};

// --- View selection ---

export const ViewRouteHeadsignSelected: Story = {
  args: {
    viewId: 'route-headsign',
    selectedView: selectView('route-headsign'),
    infoLevel: 'detailed',
  },
};

export const ViewVerboseDescription: Story = {
  args: {
    viewId: 'route-headsign',
    selectedView: selectView('route-headsign'),
    infoLevel: 'verbose',
  },
};

// --- Language comparison ---

export const LangComparison: Story = {
  args: {
    presentRouteTypes: [0, 3],
    presentAgencies: [agencyTobus, agencyRed, agencyBlue, agencyYellow],
    infoLevel: 'detailed',
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="space-y-1">
          <span className="block px-4 text-[10px] text-gray-400">{label}</span>
          <BottomSheetHeader {...args} dataLang={dataLang} />
        </div>
      ))}
    </div>
  ),
};

// --- Info levels ---

export const InfoLevelSimple: Story = {
  args: { infoLevel: 'simple' },
};

export const InfoLevelNormal: Story = {
  args: { infoLevel: 'normal' },
};

export const InfoLevelDetailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const InfoLevelVerbose: Story = {
  args: { infoLevel: 'verbose' },
};

// --- Kitchen sink ---

const kitchenSinkArgs = {
  hasNearbyLoaded: true,
  counts: { total: 42, active: 28, filtered: 21 },
  dataConfig: defaultDataConfig,
  dataLang: ['ja'],
  showOperatingStopsOnly: true,
  viewId: 'route-headsign',
  selectedView: selectView('route-headsign'),
  presentRouteTypes: ALL_PRESENT_ROUTE_TYPES,
  hiddenRouteTypes: new Set<number>([4, 6]),
  presentAgencies: allAgencies,
  hiddenAgencyIds: new Set<string>([agencyBlue.agency_id]),
};

export const KitchenSinkInfoLevelSimple: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'simple' as const },
};

export const KitchenSinkInfoLevelNormal: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'normal' as const },
};

export const KitchenSinkInfoLevelDetailed: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'detailed' as const },
};

export const KitchenSinkInfoLevelVerbose: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'verbose' as const },
};
