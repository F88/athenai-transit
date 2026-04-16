import type { Meta, StoryObj } from '@storybook/react-vite';
import type { InfoLevel } from '../types/app/settings';
import type {
  ContextualTimetableEntry,
  RouteDirection,
  StopServiceType,
} from '../types/app/transit-composed';
import type { Agency, Route } from '../types/app/transit';
import {
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
  routeDirectionHeadsignBoth,
  routeDirectionHeadsignBothMatching,
  routeDirectionHeadsignNeither,
  routeDirectionHeadsignStopOnly,
  routeDirectionHeadsignTripOnly,
  routeLong,
  stopHeadsignDemachiyanagi,
  stopHeadsignLong,
  stopHeadsignMusashiKoganeiSouth,
  tramRoute,
  tripHeadsignLong,
} from '../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../stories/lang-comparison';
import { StopTimeItem } from './stop-time-item';

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
  // Default remaining mirrors the default stopIndex (3) against
  // totalStops (15): roughly 80% of the trip still left to ride.
  const remainingMinutes = overrides.remainingMinutes ?? Math.round(totalMinutes * 0.8);
  return {
    schedule: {
      departureMinutes: depMin,
      arrivalMinutes: overrides.arrivalMinutes ?? depMin,
    },
    routeDirection: {
      route: overrides.route ?? baseRoute,
      // Default to the logical `tripHeadsignLong` fixture so detailed /
      // verbose info levels see full i18n data without pinning the
      // story to any specific real-world place. A string override
      // still works for quick variants (produces an empty `names`
      // map, single-language only).
      tripHeadsign:
        overrides.headsign != null ? { name: overrides.headsign, names: {} } : tripHeadsignLong,
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

/** now = 14:25 → 5 minutes before the default 14:30 departure. */
const now = new Date('2026-03-30T14:25:00');

const meta = {
  title: 'StopTime/StopTimeItem',
  component: StopTimeItem,
  args: {
    entry: createEntry(),
    now,
    isFirst: true,
    showRouteTypeIcon: false,
    infoLevel: 'normal',
    dataLang: ['ja'],
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    isFirst: { control: 'boolean' },
    showRouteTypeIcon: { control: 'boolean' },
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

export const NotFirst: Story = {
  args: { isFirst: false },
};

export const WithRouteTypeIcon: Story = {
  args: { showRouteTypeIcon: true },
};

// --- Route variants ---

export const GreenRoute: Story = {
  args: { entry: createEntry({ route: greenRoute, headsign: '新橋駅' }) },
};

export const TramRoute: Story = {
  args: {
    entry: createEntry({ route: tramRoute, headsign: '早稲田' }),
    showRouteTypeIcon: true,
  },
};

export const NoRouteColor: Story = {
  args: { entry: createEntry({ route: noColorRoute, headsign: '駅前' }) },
};

// --- Special states ---

export const Terminal: Story = {
  args: {
    entry: createEntry({
      isTerminal: true,
      arrivalMinutes: 870,
      departureMinutes: 870,
    }),
  },
};

export const PickupUnavailable: Story = {
  args: { entry: createEntry({ pickupType: 1 }) },
};

export const EmptyHeadsign: Story = {
  args: { entry: createEntry({ headsign: '' }) },
};

// --- Headsign state axis ---

/**
 * All five logical headsign states stacked, each rendered with the
 * same base entry. Uses the place-name-independent logical fixtures
 * (`routeDirectionHeadsignTripOnly` etc.) so each row reads as a
 * structural test case, not a specific trip.
 */
export const HeadsignPatterns: Story = {
  args: {
    agency,
    entry: createEntry(),
    infoLevel: 'detailed',
  },
  render: (args) => {
    const patterns: { label: string; routeDirection: RouteDirection }[] = [
      { label: 'trip only (classic)', routeDirection: routeDirectionHeadsignTripOnly },
      { label: 'stop only (keio-bus pattern)', routeDirection: routeDirectionHeadsignStopOnly },
      { label: 'both (different)', routeDirection: routeDirectionHeadsignBoth },
      { label: 'both (matching, redundant)', routeDirection: routeDirectionHeadsignBothMatching },
      { label: 'neither (fallback to route name)', routeDirection: routeDirectionHeadsignNeither },
    ];
    return (
      <div className="flex max-w-sm flex-col gap-4">
        {patterns.map((p) => (
          <div key={p.label}>
            <div className="mb-1 text-xs font-semibold text-gray-500">{p.label}</div>
            <div className="rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
              <StopTimeItem
                entry={{ ...args.entry, routeDirection: p.routeDirection }}
                now={args.now}
                isFirst={args.isFirst}
                showRouteTypeIcon={args.showRouteTypeIcon}
                infoLevel={args.infoLevel}
                dataLang={args.dataLang}
                agency={args.agency}
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// --- Info levels ---

/**
 * All four info levels stacked so the progressive disclosure is
 * easy to compare at a glance. Each level renders the same entry —
 * only `infoLevel` differs — so the additive features (trip position
 * indicator, journey time bar, verbose dump, etc.) become visible
 * row by row.
 *
 * Uses the `routeDirectionHeadsignBoth` logical fixture so both the
 * trip headsign and stop headsign are populated, exercising the
 * full headsign-rendering path at every info level.
 */
export const InfoLevelComparison: Story = {
  args: {
    agency,
    entry: {
      ...createEntry({ direction: 0 }),
      routeDirection: routeDirectionHeadsignBoth,
    },
  },
  render: (args) => {
    const levels: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
    return (
      <div className="flex max-w-sm flex-col gap-4">
        {levels.map((level) => (
          <div key={level}>
            <div className="mb-1 text-xs font-semibold text-gray-500">infoLevel={level}</div>
            <div className="rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
              <StopTimeItem
                entry={args.entry}
                now={args.now}
                isFirst={args.isFirst}
                showRouteTypeIcon={args.showRouteTypeIcon}
                infoLevel={level}
                dataLang={args.dataLang}
                agency={args.agency}
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// --- Multiple items ---

/**
 * Multiple flat items as they appear in the stop view.
 *
 * Mixes several row variants to exercise the full flat-list layout:
 * a plain departure, a different-route row, a pickup-unavailable
 * row, a tram row, and two terminal rows — one at the first
 * position (so the terminal marker and `RelativeTime` interact) and
 * one further down (so the terminal marker sits next to an
 * absolute-only time). Terminal rows exercise the
 * `departure.arrivingAbsolute` i18n key and are the easiest way to
 * eyeball the "着" / "Arr" opt-out behaviour from Storybook.
 */
export const MultipleItems: Story = {
  args: { entry: createEntry() },
  render: (args) => {
    const entries = [
      createEntry({ departureMinutes: 870, headsign: '中野駅' }),
      createEntry({ departureMinutes: 885, route: greenRoute, headsign: '新橋駅' }),
      createEntry({
        departureMinutes: 900,
        headsign: '中野駅',
        isTerminal: true,
        arrivalMinutes: 900,
      }),
      createEntry({ departureMinutes: 920, pickupType: 1, headsign: '車庫前' }),
      createEntry({ departureMinutes: 935, route: tramRoute, headsign: '早稲田' }),
      createEntry({
        departureMinutes: 950,
        route: tramRoute,
        headsign: '早稲田',
        isTerminal: true,
        arrivalMinutes: 950,
      }),
    ];
    return (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        {entries.map((entry, i) => (
          <StopTimeItem
            key={i}
            entry={entry}
            now={args.now}
            isFirst={args.isFirst && i === 0}
            showRouteTypeIcon={args.showRouteTypeIcon}
            infoLevel={args.infoLevel}
            dataLang={args.dataLang}
          />
        ))}
      </div>
    );
  },
};

/**
 * Multi-item list stacked across every supported language so the
 * `departure.arrivingAbsolute` marker can be verified per locale:
 * ja shows "着" next to terminal absolute times, en shows "Arr",
 * and other locales follow their own key value or fall through the
 * locale chain. Locale owners can still opt out for any language by
 * setting the key to an empty string (the component always renders
 * the span — visibility is driven entirely by i18n). Uses the same
 * entry mix as {@link MultipleItems} so the comparison is
 * row-for-row identical across languages.
 */
export const MultipleItemsLangComparison: Story = {
  args: { entry: createEntry(), infoLevel: 'normal' },
  render: (args) => {
    const entries = [
      createEntry({ departureMinutes: 870, headsign: '中野駅' }),
      createEntry({ departureMinutes: 885, route: greenRoute, headsign: '新橋駅' }),
      createEntry({
        departureMinutes: 900,
        headsign: '中野駅',
        isTerminal: true,
        arrivalMinutes: 900,
      }),
      createEntry({ departureMinutes: 920, pickupType: 1, headsign: '車庫前' }),
      createEntry({
        departureMinutes: 935,
        route: tramRoute,
        headsign: '早稲田',
        isTerminal: true,
        arrivalMinutes: 935,
      }),
    ];
    return (
      <div className="flex flex-col gap-3">
        {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
          <div key={label} className="space-y-1">
            <span className="block text-[10px] text-gray-400">{label}</span>
            <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
              {entries.map((entry, i) => (
                <StopTimeItem
                  key={i}
                  entry={entry}
                  now={args.now}
                  isFirst={args.isFirst && i === 0}
                  showRouteTypeIcon={args.showRouteTypeIcon}
                  infoLevel={args.infoLevel}
                  dataLang={dataLang}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};

/** Long route name (no short name) — tests layout wrapping. */
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
    entry: {
      ...createEntry(),
      routeDirection: createRouteDirection({
        ...createEntry().routeDirection,
        tripHeadsign: emptyHeadsign,
        stopHeadsign: stopHeadsignMusashiKoganeiSouth,
      }),
    },
  },
};

/** stop overrides trip — stop_headsign differs from trip_headsign. */
export const StopOverridesTrip: Story = {
  args: {
    entry: {
      ...createEntry(),
      routeDirection: createRouteDirection({
        ...createEntry().routeDirection,
        tripHeadsign: headsignKyotoLong,
        stopHeadsign: stopHeadsignDemachiyanagi,
      }),
    },
  },
};

// --- infoLevel comparison ---

/**
 * Side-by-side comparison of all `infoLevel` values against the
 * logical long-form fixtures (`routeLong`, `tripHeadsignLong`,
 * `stopHeadsignLong`). Place-name-independent — exercises the full
 * info-level rendering range without being tied to specific
 * real-world data.
 */
export const LogicalLongInfoLevelComparison: Story = {
  args: {
    agency,
    entry: {
      ...createEntry({ departureMinutes: 870 }),
      routeDirection: {
        route: routeLong,
        tripHeadsign: tripHeadsignLong,
        stopHeadsign: stopHeadsignLong,
        direction: 0,
      },
    },
    // showRouteTypeIcon: true,
  },
  render: (args) => {
    const levels: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
    return (
      <div className="flex flex-col gap-3">
        {levels.map((level) => (
          <div key={level} className="space-y-1">
            <span className="block text-[10px] text-gray-400">infoLevel: {level}</span>
            <StopTimeItem
              entry={args.entry}
              now={args.now}
              isFirst={args.isFirst}
              showRouteTypeIcon={level === 'verbose'}
              infoLevel={level}
              dataLang={args.dataLang}
              agency={args.agency}
              showAgency={false}
            />
          </div>
        ))}
      </div>
    );
  },
};

// --- i18n: lang resolution ---

/**
 * All supported languages stacked so i18n behaviour is easy to verify
 * at a glance. Uses the logical long-form fixtures
 * (`tripHeadsignLong`, `stopHeadsignLong`, `routeLong`) so every
 * language row gets a populated translation and the stop/trip
 * headsign overflow paths are exercised per language.
 */
export const LangComparison: Story = {
  args: {
    agency,
    entry: {
      ...createEntry({ departureMinutes: 870 }),
      routeDirection: {
        route: routeLong,
        tripHeadsign: tripHeadsignLong,
        stopHeadsign: stopHeadsignLong,
        direction: 0,
      },
    },
    infoLevel: 'normal',
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="space-y-1">
          <span className="block text-[10px] text-gray-400">{label}</span>
          <StopTimeItem
            entry={args.entry}
            now={args.now}
            isFirst={args.isFirst}
            showRouteTypeIcon={args.showRouteTypeIcon}
            infoLevel={args.infoLevel}
            dataLang={dataLang}
            agency={args.agency}
          />
        </div>
      ))}
    </div>
  ),
};

/** Kitchen sink items: various data patterns to verify layout. */
const kitchenSinkItems: {
  entry: ContextualTimetableEntry;
  agency?: Agency;
  icon?: boolean;
}[] = [
  // 0分後 — まもなく, short route
  { entry: createEntry({ departureMinutes: 865, headsign: '中野駅' }) },
  // 1分後 — short route + headsign with translations
  {
    entry: {
      ...createEntry({ departureMinutes: 866 }),
      routeDirection: createRouteDirection({
        route: greenRoute,
        tripHeadsign: headsignShimbashiEkimae,
      }),
    },
    agency,
  },
  // 1分後 — long route + short headsign
  {
    entry: createEntry({ route: longRoute, departureMinutes: 866, headsign: '三ノ輪橋' }),
    icon: true,
  },
  // 2分後 — long route + headsign with translations
  {
    entry: {
      ...createEntry({ route: longRoute, departureMinutes: 867 }),
      routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignMinowabashi }),
    },
    icon: true,
    agency,
  },
  // 3分後 — long route + headsign with translations (Waseda)
  {
    entry: {
      ...createEntry({ route: longRoute, departureMinutes: 868 }),
      routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignWaseda }),
    },
    icon: true,
  },
  // 3分後 — long route + long headsign (Kyoto-style)
  {
    entry: {
      ...createEntry({ route: longRoute, departureMinutes: 868 }),
      routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignKyotoLong }),
    },
    icon: true,
    agency,
  },
  // 5分後 — all long + terminal
  {
    entry: {
      ...createEntry({
        route: longRoute,
        departureMinutes: 870,
        isTerminal: true,
        arrivalMinutes: 870,
      }),
      routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignKyotoLong }),
    },
    icon: true,
    agency,
  },
  // 9分後 — all long + pickup unavailable
  {
    entry: {
      ...createEntry({
        route: longRoute,
        departureMinutes: 874,
        pickupType: 1,
      }),
      routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignKyotoLong }),
    },
    icon: true,
    agency,
  },
  // 10分後 — all short + terminal
  {
    entry: {
      ...createEntry({
        departureMinutes: 875,
        isTerminal: true,
        arrivalMinutes: 875,
      }),
      routeDirection: createRouteDirection({ route: baseRoute, tripHeadsign: headsignShinjuku }),
    },
    icon: true,
    agency,
  },
  // 11分後 — long route + terminal (no relative time)
  {
    entry: createEntry({
      route: longRoute,
      departureMinutes: 876,
      headsign: '三ノ輪橋',
      isTerminal: true,
      arrivalMinutes: 876,
    }),
    icon: true,
  },
  // 14分後 — pickup unavailable (no relative time)
  { entry: createEntry({ departureMinutes: 879, headsign: '車庫前', pickupType: 1 }) },
  // 15分後 — empty headsign
  { entry: createEntry({ departureMinutes: 880, headsign: '' }) },
  // 30分後
  { entry: createEntry({ departureMinutes: 895, headsign: '中野駅' }) },
  // 60分後
  { entry: createEntry({ departureMinutes: 925, headsign: '中野駅' }) },
  // 120分後
  { entry: createEntry({ departureMinutes: 985, headsign: '中野駅' }) },
];

export const KitchenSink: Story = {
  args: { entry: createEntry(), infoLevel: 'normal' },
  render: (args) => (
    <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
      {kitchenSinkItems.map(({ entry, agency: a, icon }, i) => (
        <StopTimeItem
          key={i}
          entry={entry}
          now={args.now}
          isFirst={args.isFirst && i === 0}
          showRouteTypeIcon={args.showRouteTypeIcon || (icon ?? false)}
          infoLevel={args.infoLevel}
          dataLang={args.dataLang}
          agency={a}
        />
      ))}
    </div>
  ),
};
