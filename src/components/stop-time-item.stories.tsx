import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ContextualTimetableEntry, StopServiceType } from '../types/app/transit-composed.ts';
import type { Agency, Route } from '../types/app/transit.ts';
import {
  agencyLong as longAgency,
  agencyTobus as agency,
  busRoute as baseRoute,
  busRoute2 as greenRoute,
  createRouteDirection,
  emptyHeadsign,
  headsignKyotoLong,
  headsignMinowabashi,
  headsignShimbashiEkimae,
  headsignShinjuku,
  headsignWaseda,
  noColorRoute,
  routeLong,
  stopHeadsignDemachiyanagi,
  stopHeadsignLong,
  stopHeadsignMusashiKoganeiSouth,
  tramRoute,
  tripHeadsignLong,
  tripHeadsignShort,
} from '../stories/fixtures.ts';
import { LANG_COMPARISON_CASES } from '../stories/lang-comparison.ts';
import { fn } from 'storybook/test';
import { StopTimeItem } from './stop-time-item.tsx';

/** Create a ContextualTimetableEntry for stories. */
function createEntry(
  overrides: Partial<{
    departureMinutes: number;
    arrivalMinutes: number;
    route: Route;
    headsign: string;
    stopHeadsign: string;
    pickupType: StopServiceType;
    dropOffType: StopServiceType;
    isTerminal: boolean;
    isOrigin: boolean;
    stopIndex: number;
    totalStops: number;
    direction: 0 | 1;
    remainingMinutes: number;
    totalMinutes: number;
    freq: number;
  }> = {},
): ContextualTimetableEntry {
  const depMin = overrides.departureMinutes ?? 870; // 14:30
  const totalMinutes = overrides.totalMinutes ?? 45;
  const remainingMinutes = overrides.remainingMinutes ?? Math.round(totalMinutes * 0.8);
  return {
    schedule: {
      departureMinutes: depMin,
      arrivalMinutes: overrides.arrivalMinutes ?? depMin,
    },
    routeDirection: {
      route: overrides.route ?? baseRoute,
      tripHeadsign: { name: overrides.headsign ?? '中野駅', names: {} },
      ...(overrides.stopHeadsign != null
        ? { stopHeadsign: { name: overrides.stopHeadsign, names: {} } }
        : {}),
      direction: overrides.direction,
    },
    boarding: {
      pickupType: overrides.pickupType ?? 0,
      dropOffType: overrides.dropOffType ?? 0,
    },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 3,
      totalStops: overrides.totalStops ?? 15,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
    insights: {
      remainingMinutes,
      totalMinutes,
      freq: overrides.freq ?? 30,
    },
    serviceDate: new Date('2026-03-30T00:00:00'),
  };
}

/**
 * Create a ContextualTimetableEntry using the logical long-form
 * fixtures (`routeLong`, `tripHeadsignLong`, `stopHeadsignLong`).
 * Intended for place-name-independent stories that exercise
 * structural/length characteristics.
 */
function createLogicalLongEntry(
  overrides: Partial<{
    arrivalMinutes: number;
    departureMinutes: number;
    freq: number;
    totalMinutes: number;
    remainingMinutes: number;
    isTerminal: boolean;
    isOrigin: boolean;
    pickupType: StopServiceType;
    dropOffType: StopServiceType;
  }> = {},
): ContextualTimetableEntry {
  return {
    ...createEntry({
      arrivalMinutes: overrides.arrivalMinutes,
      departureMinutes: overrides.departureMinutes,
      totalMinutes: overrides.totalMinutes,
      remainingMinutes: overrides.remainingMinutes,
      freq: overrides.freq,
      isTerminal: overrides.isTerminal,
      isOrigin: overrides.isOrigin,
      pickupType: overrides.pickupType,
      dropOffType: overrides.dropOffType,
    }),
    routeDirection: createRouteDirection({
      route: routeLong,
      tripHeadsign: tripHeadsignLong,
      stopHeadsign: stopHeadsignLong,
    }),
  };
}

/**
 * Create a ContextualTimetableEntry using the short-form logical
 * fixtures — short route name, short trip headsign, no stop
 * headsign. Counterpart to {@link createLogicalLongEntry}.
 */
function createLogicalShortEntry(
  overrides: Partial<{
    departureMinutes: number;
    freq: number;
    totalMinutes: number;
    remainingMinutes: number;
  }> = {},
): ContextualTimetableEntry {
  return {
    ...createEntry({
      departureMinutes: overrides.departureMinutes,
      totalMinutes: overrides.totalMinutes,
      remainingMinutes: overrides.remainingMinutes,
      freq: overrides.freq,
    }),
    routeDirection: createRouteDirection({
      route: baseRoute,
      tripHeadsign: tripHeadsignShort,
    }),
  };
}

/** now = 14:25 → 5 minutes before the default 14:30 departure. */
const now = new Date('2026-03-30T14:25:00');

/** Three entries at 14:30, 14:45, 15:00 for a typical group. */
const threeEntries = [
  createEntry({ departureMinutes: 870 }),
  createEntry({ departureMinutes: 885 }),
  createEntry({ departureMinutes: 900 }),
];

const meta = {
  title: 'StopTime/StopTimeItem',
  component: StopTimeItem,
  args: {
    entries: threeEntries,
    now,
    infoLevel: 'normal',
    dataLang: ['ja'],
    showRouteTypeIcon: false,
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    showRouteTypeIcon: { control: 'boolean' },
    maxDisplay: { control: { type: 'number', min: 1, max: 5, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StopTimeItem>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const SingleEntry: Story = {
  args: { entries: [createEntry()] },
};

export const WithRouteTypeIcon: Story = {
  args: { showRouteTypeIcon: true },
};

// --- Route variants ---

export const GreenRoute: Story = {
  args: {
    entries: [
      createEntry({ route: greenRoute, headsign: '新橋駅', departureMinutes: 870 }),
      createEntry({ route: greenRoute, headsign: '新橋駅', departureMinutes: 890 }),
      createEntry({ route: greenRoute, headsign: '新橋駅', departureMinutes: 910 }),
    ],
  },
};

export const TramRoute: Story = {
  args: {
    entries: [
      createEntry({ route: tramRoute, headsign: '早稲田', departureMinutes: 870 }),
      createEntry({ route: tramRoute, headsign: '早稲田', departureMinutes: 880 }),
    ],
    showRouteTypeIcon: true,
  },
};

export const NoRouteColor: Story = {
  args: {
    entries: [
      createEntry({ route: noColorRoute, headsign: '駅前', departureMinutes: 870 }),
      createEntry({ route: noColorRoute, headsign: '駅前', departureMinutes: 895 }),
    ],
  },
};

// --- Special states ---

export const TerminalEntries: Story = {
  args: {
    entries: [
      createEntry({ isTerminal: true, arrivalMinutes: 870 }),
      createEntry({ isTerminal: true, arrivalMinutes: 890 }),
    ],
  },
};

export const DropOffOnly: Story = {
  args: {
    entries: [
      createEntry({ pickupType: 1, departureMinutes: 870 }),
      createEntry({ pickupType: 1, departureMinutes: 890 }),
    ],
  },
};

export const EmptyHeadsign: Story = {
  args: {
    entries: [createEntry({ headsign: '' })],
  },
};

// --- Timetable button ---

export const WithTimetableButton: Story = {
  args: { onShowTimetable: fn() },
};

// --- maxDisplay ---

export const MaxDisplay1: Story = {
  args: { maxDisplay: 1 },
};

export const MaxDisplay5: Story = {
  args: {
    maxDisplay: 5,
    entries: [
      createEntry({ departureMinutes: 870 }),
      createEntry({ departureMinutes: 885 }),
      createEntry({ departureMinutes: 900 }),
      createEntry({ departureMinutes: 920 }),
      createEntry({ departureMinutes: 940 }),
    ],
  },
};

// --- Info levels ---

export const Detailed: Story = {
  args: { infoLevel: 'detailed', agency },
};

export const Verbose: Story = {
  args: {
    infoLevel: 'verbose',
    agency,
    entries: [
      createEntry({ departureMinutes: 870, direction: 0 }),
      createEntry({ departureMinutes: 885, direction: 0 }),
      createEntry({ departureMinutes: 900, direction: 0 }),
    ],
  },
};

// --- Multiple groups ---

/** Multiple route groups as they appear in the bottom sheet. */
export const MultipleGroups: Story = {
  args: { entries: threeEntries },
  render: () => {
    const groups = [
      {
        entries: [
          createEntry({ departureMinutes: 870, headsign: '中野駅' }),
          createEntry({ departureMinutes: 885, headsign: '中野駅' }),
          createEntry({ departureMinutes: 900, headsign: '中野駅' }),
        ],
      },
      {
        entries: [
          createEntry({
            route: greenRoute,
            headsign: '新橋駅',
            departureMinutes: 872,
          }),
          createEntry({
            route: greenRoute,
            headsign: '新橋駅',
            departureMinutes: 892,
          }),
        ],
      },
      {
        entries: [
          createEntry({
            route: tramRoute,
            headsign: '早稲田',
            departureMinutes: 875,
          }),
        ],
      },
    ];
    return (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        {groups.map((group, i) => (
          <StopTimeItem
            key={i}
            entries={group.entries}
            now={now}
            infoLevel="normal"
            dataLang={['ja']}
            showRouteTypeIcon
            onShowTimetable={fn()}
          />
        ))}
      </div>
    );
  },
};

/** Long route name (no short name) — tests layout. */
const longRoute: Route = {
  ...baseRoute,
  route_id: 'toaran:SA',
  route_short_name: '',
  route_short_names: {},
  route_long_name: '東京さくらトラム（都電荒川線）',
  route_type: 0 as const,
  route_color: 'E60012',
};

// --- stop_headsign patterns ---

/** trip empty + stop present (keio-bus pattern). */
export const TripEmptyStopPresent: Story = {
  args: {
    entries: [
      createEntry({ headsign: '', stopHeadsign: '武蔵小金井駅南口' }),
      {
        ...createEntry({ departureMinutes: 885 }),
        routeDirection: createRouteDirection({
          ...createEntry({ departureMinutes: 885 }).routeDirection,
          tripHeadsign: emptyHeadsign,
          stopHeadsign: stopHeadsignMusashiKoganeiSouth,
        }),
      },
    ],
  },
};

/** stop overrides trip — stop_headsign differs from trip_headsign. */
export const StopOverridesTrip: Story = {
  args: {
    entries: [
      createEntry({
        route: longRoute,
        headsign: '北大路BT・下鴨神社・出町柳駅',
        stopHeadsign: '出町柳駅',
      }),
      {
        ...createEntry({ route: longRoute, departureMinutes: 885 }),
        routeDirection: createRouteDirection({
          ...createEntry({ route: longRoute, departureMinutes: 885 }).routeDirection,
          tripHeadsign: headsignKyotoLong,
          stopHeadsign: stopHeadsignDemachiyanagi,
        }),
      },
    ],
    agency: longAgency,
  },
};

/**
 * All languages side by side using the logical long-form fixtures
 * (`routeLong`, `tripHeadsignLong`, `stopHeadsignLong`). Every
 * language row gets populated trip + stop headsigns and a verbose
 * route_long_name so wrap / truncation behaviour is exercised
 * consistently per language. A second entry uses `tripHeadsignShort`
 * to show the short-form side by side.
 */
export const LangComparison: Story = {
  args: {
    agency,
    entries: [
      {
        ...createEntry({ departureMinutes: 870 }),
        routeDirection: createRouteDirection({
          route: routeLong,
          tripHeadsign: tripHeadsignLong,
          stopHeadsign: stopHeadsignLong,
        }),
      },
      {
        ...createEntry({ departureMinutes: 885 }),
        routeDirection: createRouteDirection({
          route: routeLong,
          tripHeadsign: tripHeadsignShort,
        }),
      },
    ],
    infoLevel: 'normal',
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="space-y-1">
          <span className="block text-[10px] text-gray-400">{label}</span>
          <StopTimeItem
            entries={args.entries}
            now={args.now}
            infoLevel={args.infoLevel}
            dataLang={dataLang}
            showRouteTypeIcon={args.showRouteTypeIcon}
            agency={args.agency}
            maxDisplay={args.maxDisplay}
            onShowTimetable={args.onShowTimetable}
          />
        </div>
      ))}
    </div>
  ),
};

/** Kitchen sink groups: various data patterns to verify layout. */
const kitchenSinkGroups: { entries: ContextualTimetableEntry[]; agency?: Agency }[] = [
  // Short route + short headsign
  {
    entries: [
      createEntry({ departureMinutes: 870, headsign: '中野駅' }),
      createEntry({ departureMinutes: 885, headsign: '中野駅' }),
      createEntry({ departureMinutes: 900, headsign: '中野駅' }),
    ],
    agency,
  },
  // Short route + headsign with translations
  {
    entries: [
      {
        ...createEntry({ departureMinutes: 872 }),
        routeDirection: createRouteDirection({
          route: greenRoute,
          tripHeadsign: headsignShimbashiEkimae,
        }),
      },
      {
        ...createEntry({ departureMinutes: 892 }),
        routeDirection: createRouteDirection({
          route: greenRoute,
          tripHeadsign: headsignShimbashiEkimae,
        }),
      },
    ],
    agency,
  },
  // Long route name + headsign with translations
  {
    entries: [
      {
        ...createEntry({ route: longRoute, departureMinutes: 875 }),
        routeDirection: createRouteDirection({
          route: longRoute,
          tripHeadsign: headsignMinowabashi,
        }),
      },
      {
        ...createEntry({ route: longRoute, departureMinutes: 890 }),
        routeDirection: createRouteDirection({
          route: longRoute,
          tripHeadsign: headsignMinowabashi,
        }),
      },
    ],
    agency: longAgency,
  },
  // Long route name + different headsign with translations
  {
    entries: [
      {
        ...createEntry({ route: longRoute, departureMinutes: 880 }),
        routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignWaseda }),
      },
    ],
    agency: longAgency,
  },
  // Long route + long headsign with long translations (Kyoto-style)
  {
    entries: [
      {
        ...createEntry({ route: longRoute, departureMinutes: 882 }),
        routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignKyotoLong }),
      },
    ],
    agency: longAgency,
  },
  // Long route + terminal
  {
    entries: [
      {
        ...createEntry({
          route: longRoute,
          departureMinutes: 884,
          isTerminal: true,
          arrivalMinutes: 884,
        }),
        routeDirection: createRouteDirection({
          route: longRoute,
          tripHeadsign: headsignMinowabashi,
        }),
      },
    ],
    agency: longAgency,
  },
  // All elements: icon + long route + long subNames + long headsign + drop-off only + agency
  {
    entries: [
      {
        ...createEntry({
          route: longRoute,
          departureMinutes: 886,
          pickupType: 1,
        }),
        routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignKyotoLong }),
      },
    ],
    agency: longAgency,
  },
  // All elements short: icon + short route + short subNames + short headsign + drop-off only + agency
  {
    entries: [
      {
        ...createEntry({
          departureMinutes: 888,
          pickupType: 1,
        }),
        routeDirection: createRouteDirection({ route: baseRoute, tripHeadsign: headsignShinjuku }),
      },
    ],
    agency,
  },
  // Empty headsign
  {
    entries: [createEntry({ departureMinutes: 905, headsign: '' })],
    agency,
  },
];

// --- Logical data (place-name-independent) ---

/**
 * Side-by-side comparison of all `infoLevel` values against the
 * logical long-form fixtures. Place-name-independent alternative to
 * {@link Detailed} / {@link Verbose} stories.
 */
export const LogicalLongInfoLevelComparison: Story = {
  args: {
    // Vary per-entry attributes so the inline `TimetableEntryAttributesLabels`
    // exercises every supported flag (terminal / origin / pickup× / dropoff×)
    // across the displayed rows:
    //   1st: plain                      → no labels
    //   2nd: origin only                → 始発
    //   3rd: kitchen sink               → 始発 + 終点 + 乗× + 降×
    //
    // The 3rd row deliberately combines all four flags to verify they
    // can coexist visually within a single row without overflowing or
    // overlapping the time text. Use `Detailed` / `Verbose` for the
    // single-flag-per-row variant if needed.
    entries: [
      createLogicalLongEntry({
        departureMinutes: 870,
        isOrigin: false,
        isTerminal: false,
        pickupType: 0,
        dropOffType: 0,
      }),
      createLogicalLongEntry({
        arrivalMinutes: 855,
        departureMinutes: 855,
        isOrigin: true,
        isTerminal: false,
        pickupType: 0,
        dropOffType: 0,
      }),
      createLogicalLongEntry({
        arrivalMinutes: 900,
        departureMinutes: 900,
        isOrigin: true,
        isTerminal: true,
        pickupType: 1,
        dropOffType: 1,
      }),
    ],
    agency: longAgency,
    onShowTimetable: fn(),
  },
  render: (args) => {
    const levels = ['simple', 'normal', 'detailed', 'verbose'] as const;
    return (
      <div className="flex flex-col gap-3">
        {levels.map((level) => (
          <div key={level} className="space-y-1">
            <span className="block text-[10px] text-gray-400">infoLevel: {level}</span>
            <StopTimeItem
              entries={args.entries}
              now={now}
              infoLevel={level}
              dataLang={['ja']}
              showRouteTypeIcon
              agency={args.agency}
              showAgency={false}
              onShowTimetable={args.onShowTimetable}
            />
          </div>
        ))}
      </div>
    );
  },
};

/**
 * Logical kitchen sink — multiple groups built from logical
 * fixtures. Mirrors the structure of {@link KitchenSink} but uses
 * place-name-independent data so it tests layout characteristics
 * rather than specific names.
 */
export const LogicalKitchenSink: Story = {
  args: { entries: [createLogicalShortEntry()] },
  render: () => {
    const groups: { entries: ContextualTimetableEntry[]; agency?: Agency }[] = [
      // Short form — 3 entries
      {
        entries: [
          createLogicalShortEntry({ departureMinutes: 870 }),
          createLogicalShortEntry({ departureMinutes: 885 }),
          createLogicalShortEntry({ departureMinutes: 900 }),
        ],
        agency,
      },
      // Long form — 3 entries (trip + stop headsign)
      {
        entries: [
          createLogicalLongEntry({ departureMinutes: 872 }),
          createLogicalLongEntry({ departureMinutes: 892 }),
          createLogicalLongEntry({ departureMinutes: 912 }),
        ],
        agency: longAgency,
      },
      // Long form — single terminal entry
      {
        entries: [createLogicalLongEntry({ departureMinutes: 880, isTerminal: true })],
        agency: longAgency,
      },
      // Long form — drop-off only
      {
        entries: [createLogicalLongEntry({ departureMinutes: 884, pickupType: 1 })],
        agency: longAgency,
      },
    ];
    return (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        {groups.map((group, i) => (
          <StopTimeItem
            key={i}
            entries={group.entries}
            now={now}
            infoLevel="detailed"
            dataLang={['ja']}
            showRouteTypeIcon
            agency={group.agency}
            onShowTimetable={fn()}
          />
        ))}
      </div>
    );
  },
};

export const KitchenSink: Story = {
  args: { entries: threeEntries },
  render: () => (
    <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
      {kitchenSinkGroups.map((group, i) => (
        <StopTimeItem
          key={i}
          entries={group.entries}
          now={now}
          infoLevel="detailed"
          dataLang={['ja']}
          showRouteTypeIcon
          agency={group.agency}
          onShowTimetable={fn()}
        />
      ))}
    </div>
  ),
};
