import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PERF_PROFILES } from '../config/perf-profiles';
import { APP_ROUTE_TYPES } from '../config/route-types';
import {
  DEFAULT_VIEW_ID,
  STOP_TIMES_VIEWS,
  type StopTimeViewId,
} from '../domain/transit/stop-time-views';
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
import { StopBrowserHeader } from './stop-browser-header';

// --- Shared defaults ---

const defaultStopsRadius = PERF_PROFILES.normal.data.stops.nearbyRadius;
const selectView = (id: StopTimeViewId) => STOP_TIMES_VIEWS.find((v) => v.id === id);
const defaultSelectedView = selectView(DEFAULT_VIEW_ID);
const defaultCounts = { total: 12, nonEmpty: 7, originCount: 3, boardableCount: 5 };
const defaultFilteredNearbyStopsCounts = {
  total: 7,
  nonEmpty: 7,
  originCount: 3,
  boardableCount: 5,
};

/** All route type values defined in APP_ROUTE_TYPES except the `-1` unknown placeholder. */
const ALL_PRESENT_ROUTE_TYPES: readonly number[] = APP_ROUTE_TYPES.map((rt) => rt.value).filter(
  (v) => v !== -1,
);

// --- Meta ---

const meta = {
  title: 'StopBrowser/StopBrowserHeader',
  component: StopBrowserHeader,
  args: {
    hasNearbyLoaded: true,
    counts: defaultCounts,
    nearbyStopsCounts: defaultCounts,
    filteredNearbyStopsCounts: defaultFilteredNearbyStopsCounts,
    stopsRadius: defaultStopsRadius,
    dataLangs: ['ja'],
    omitEmptyStops: false,
    isOmitEmptyStopsForced: false,
    showOriginOnly: false,
    showBoardableOnly: false,
    viewId: DEFAULT_VIEW_ID,
    selectedView: defaultSelectedView,
    infoLevel: 'normal',
    size: 'md',
    presentRouteTypes: [3],
    hiddenRouteTypes: new Set<number>(),
    presentAgencies: [agencyTobus],
    hiddenAgencyIds: new Set<string>(),
    onToggleOmitEmptyStops: fn(),
    onToggleShowOriginOnly: fn(),
    onToggleShowBoardableOnly: fn(),
    onViewChange: fn(),
    onToggleRouteType: fn(),
    onToggleAgency: fn(),
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    omitEmptyStops: { control: 'boolean' },
    isOmitEmptyStopsForced: { control: 'boolean' },
    showOriginOnly: { control: 'boolean' },
    showBoardableOnly: { control: 'boolean' },
    hasNearbyLoaded: { control: 'boolean' },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-lg bg-white pt-2 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StopBrowserHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Loading: Story = {
  args: {
    hasNearbyLoaded: false,
    counts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    nearbyStopsCounts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    filteredNearbyStopsCounts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
  },
};

export const NoStops: Story = {
  args: {
    counts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    nearbyStopsCounts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    filteredNearbyStopsCounts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    presentRouteTypes: [],
    presentAgencies: [],
  },
};

export const NoOperatingStops: Story = {
  args: {
    counts: { total: 8, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    nearbyStopsCounts: { total: 8, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    filteredNearbyStopsCounts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    omitEmptyStops: true,
    presentRouteTypes: [3],
    presentAgencies: [agencyTobus],
  },
};

export const OperatingOnlyActive: Story = {
  args: {
    counts: { total: 15, nonEmpty: 9, originCount: 4, boardableCount: 7 },
    nearbyStopsCounts: { total: 15, nonEmpty: 9, originCount: 4, boardableCount: 7 },
    filteredNearbyStopsCounts: { total: 9, nonEmpty: 9, originCount: 4, boardableCount: 7 },
    omitEmptyStops: true,
  },
};

export const OriginFilterHidden: Story = {
  args: {
    counts: { total: 12, nonEmpty: 7, originCount: 0, boardableCount: 5 },
    nearbyStopsCounts: { total: 12, nonEmpty: 7, originCount: 0, boardableCount: 5 },
    filteredNearbyStopsCounts: { total: 7, nonEmpty: 7, originCount: 0, boardableCount: 5 },
  },
};

export const OriginFilterActiveWithoutNearbyOrigins: Story = {
  args: {
    counts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    nearbyStopsCounts: { total: 12, nonEmpty: 7, originCount: 0, boardableCount: 5 },
    filteredNearbyStopsCounts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    showOriginOnly: true,
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

// --- Sizes ---

export const SizeComparison: Story = {
  args: {
    infoLevel: 'verbose',
    counts: { total: 42, nonEmpty: 28, originCount: 6, boardableCount: 15 },
    nearbyStopsCounts: { total: 42, nonEmpty: 28, originCount: 6, boardableCount: 15 },
    filteredNearbyStopsCounts: { total: 21, nonEmpty: 21, originCount: 6, boardableCount: 15 },
    omitEmptyStops: true,
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <span className="block px-4 text-[10px] text-gray-400">size=md</span>
        <StopBrowserHeader {...args} size="md" />
      </div>
      <div className="space-y-1">
        <span className="block px-4 text-[10px] text-gray-400">size=lg</span>
        <StopBrowserHeader {...args} size="lg" />
      </div>
      <div className="space-y-1">
        <span className="block px-4 text-[10px] text-gray-400">size=xl</span>
        <StopBrowserHeader {...args} size="xl" />
      </div>
    </div>
  ),
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
          <StopBrowserHeader {...args} dataLangs={dataLang} />
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

const kitchenSinkArgs: Story['args'] = {
  hasNearbyLoaded: true,
  counts: { total: 42, nonEmpty: 28, originCount: 6, boardableCount: 15 },
  nearbyStopsCounts: { total: 42, nonEmpty: 28, originCount: 6, boardableCount: 15 },
  filteredNearbyStopsCounts: { total: 21, nonEmpty: 21, originCount: 6, boardableCount: 15 },
  stopsRadius: defaultStopsRadius,
  dataLangs: ['ja'],
  omitEmptyStops: true,
  viewId: 'route-headsign' as const,
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
