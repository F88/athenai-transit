import type { Meta, StoryObj } from '@storybook/react-vite';
import { bearingDeg } from '../domain/transit/distance';
import {
  agencyGx,
  agencyOretetsu,
  agencyTobus,
  allAgencies,
  allRoutes,
  baseStop,
  busRoute,
  longNameStop,
  storyMapCenter,
  tramRoute,
} from '../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../stories/lang-comparison';
import type { AppRouteTypeValue } from '../types/app/transit';
import { DistanceBadge } from './badge/distance-badge';
import { StopSummary } from './stop-summary';

const meta = {
  title: 'Stop/StopSummary',
  component: StopSummary,
  args: {
    stop: baseStop,
    showAgencies: true,
    showRouteTypes: true,
    routeTypes: [3] as AppRouteTypeValue[],
    agencies: [agencyTobus],
    infoLevel: 'normal',
    dataLangs: ['ja'],
    stopServiceState: 'boardable',
    routes: [busRoute],
    showRoutes: true,
    agencyBadgeSize: 'sm',
    routeBadgeSize: 'sm',
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    stopServiceState: { control: 'radio', options: ['boardable', 'drop-off-only', 'no-service'] },
    agencyBadgeSize: { control: 'inline-radio', options: ['xs', 'sm', 'md'] },
    routeBadgeSize: { control: 'inline-radio', options: ['xs', 'sm', 'md'] },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] px-3 pt-2.5 pb-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StopSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const DropOffOnly: Story = {
  args: { stopServiceState: 'drop-off-only' },
};

// --- Route types ---

export const Bus: Story = {
  args: { routeTypes: [3] as AppRouteTypeValue[] },
};

export const Tram: Story = {
  args: { routeTypes: [0] as AppRouteTypeValue[] },
};

export const MultiType: Story = {
  args: { routeTypes: [0, 3] as AppRouteTypeValue[], agencies: [agencyGx, agencyOretetsu] },
};

// --- Badge sizes ---

export const CompactBadges: Story = {
  args: {
    infoLevel: 'detailed',
    agencies: [agencyGx, agencyOretetsu],
    routes: [busRoute, tramRoute],
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencyBadgeSize: 'xs',
    routeBadgeSize: 'xs',
  },
};

export const LargeBadges: Story = {
  args: {
    infoLevel: 'detailed',
    agencies: [agencyGx, agencyOretetsu],
    routes: [busRoute, tramRoute],
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencyBadgeSize: 'md',
    routeBadgeSize: 'md',
  },
};

export const BadgeSizeComparison: Story = {
  args: {
    infoLevel: 'detailed',
    agencies: [agencyGx, agencyOretetsu],
    routes: [busRoute, tramRoute],
    routeTypes: [0, 3] as AppRouteTypeValue[],
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <StopSummary {...args} agencyBadgeSize="xs" routeBadgeSize="xs" />
      <StopSummary {...args} agencyBadgeSize="sm" routeBadgeSize="sm" />
      <StopSummary {...args} agencyBadgeSize="md" routeBadgeSize="md" />
    </div>
  ),
};

// --- Info levels ---

export const Simple: Story = {
  args: { infoLevel: 'simple' },
};

export const Detailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const Verbose: Story = {
  args: { infoLevel: 'verbose' },
};

// --- Platform code ---

export const PlatformCode: Story = {
  args: { stop: { ...baseStop, platform_code: '2' } },
};

export const PlatformCodeAlpha: Story = {
  args: { stop: { ...baseStop, platform_code: 'G' } },
};

// --- Wheelchair boarding ---

export const WheelchairAccessible: Story = {
  args: { stop: { ...baseStop, wheelchair_boarding: 1 } },
};

export const WheelchairNotAccessible: Story = {
  args: { stop: { ...baseStop, wheelchair_boarding: 2 } },
};

export const WheelchairUnknown: Story = {
  args: { stop: { ...baseStop, wheelchair_boarding: 0 } },
};

// --- Long name ---

export const LongName: Story = {
  args: { stop: longNameStop },
};

export const LongNameDropOff: Story = {
  args: { stop: longNameStop, stopServiceState: 'drop-off-only' },
};

export const LongNameMultiType: Story = {
  args: {
    stop: longNameStop,
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencies: [agencyGx, agencyOretetsu],
  },
};

// --- Inline extension ---

export const WithDistanceBadge: Story = {
  args: {
    stop: longNameStop,
    infoLevel: 'detailed',
    routes: [busRoute, tramRoute],
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencies: [agencyGx, agencyOretetsu],
  },
  render: (args) => (
    <StopSummary
      {...args}
      distanceBadge={
        <DistanceBadge
          meters={235}
          bearingDeg={bearingDeg(storyMapCenter, args.stop)}
          showDirection
        />
      }
    />
  ),
};

// --- infoLevel comparison ---

/**
 * Side-by-side comparison of all `infoLevel` values against the
 * long-form fixtures (`longNameStop` + multi-route + multi-agency).
 * Place-name-independent — exercises the full info-level rendering
 * range against the densest realistic prop combination.
 */
export const LogicalLongInfoLevelComparison: Story = {
  args: {
    stop: longNameStop,
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencies: allAgencies,
    routes: allRoutes,
    stopServiceState: 'boardable',
    dataLangs: ['ja'],
  },
  render: (args) => {
    const levels = ['simple', 'normal', 'detailed', 'verbose'] as const;
    return (
      <div className="flex flex-col gap-3">
        {levels.map((level) => (
          <div key={level} className="space-y-1">
            <span className="block text-[10px] text-gray-400">infoLevel: {level}</span>
            <StopSummary
              stop={args.stop}
              showAgencies={args.showAgencies}
              showRouteTypes={args.showRouteTypes}
              routeTypes={args.routeTypes}
              agencies={args.agencies}
              showRoutes={args.showRoutes}
              routes={args.routes}
              infoLevel={level}
              dataLangs={args.dataLangs}
              stopServiceState={args.stopServiceState}
              agencyBadgeSize={args.agencyBadgeSize ?? 'sm'}
              routeBadgeSize={args.routeBadgeSize ?? 'sm'}
            />
          </div>
        ))}
      </div>
    );
  },
};

// --- i18n: lang resolution ---

export const LangComparison: Story = {
  args: {
    stop: longNameStop,
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencies: [agencyTobus, agencyOretetsu],
    routes: [busRoute, tramRoute],
    infoLevel: 'detailed',
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="space-y-1">
          <span className="block text-[10px] text-gray-400">{label}</span>
          <StopSummary {...args} dataLangs={dataLang} />
        </div>
      ))}
    </div>
  ),
};

/** Kitchen sink: long name, multi-type, all agencies, all route badges, drop-off-only. */
const kitchenSinkArgs = {
  stop: longNameStop,
  routeTypes: [0, 3] as AppRouteTypeValue[],
  agencies: allAgencies,
  stopServiceState: 'drop-off-only' as const,
  routes: allRoutes,
};

export const KitchenSink: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'simple' as const },
};
