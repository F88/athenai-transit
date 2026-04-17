import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  busRoute,
  busRoute2,
  createRouteDirection,
  tramRoute,
  noColorRoute,
  emptyHeadsign,
  headsignKyotoLongShortJa,
  headsignOtsukaEkimae,
  headsignShinjuku,
  routeLong,
  stopHeadsignDemachiyanagi,
  stopHeadsignLong,
  stopHeadsignMusashiKoganeiSouth,
  tripHeadsignLong,
} from '../../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../../stories/lang-comparison';
import { HeadsignLabel } from './headsign-label';

/** Default routeDirection fixture for stories. */
const defaultRouteDirection = createRouteDirection({
  route: busRoute,
  tripHeadsign: headsignOtsukaEkimae,
});

const meta = {
  title: 'Label/HeadsignLabel',
  component: HeadsignLabel,
  args: {
    routeDirection: defaultRouteDirection,
    infoLevel: 'normal',
    dataLang: ['ja'],
    size: 'default',
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    size: { control: 'inline-radio', options: ['default', 'sm', 'xs'] },
  },
} satisfies Meta<typeof HeadsignLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Short: Story = {
  args: {
    routeDirection: createRouteDirection({
      ...defaultRouteDirection,
      tripHeadsign: headsignShinjuku,
    }),
  },
};

export const Long: Story = {
  args: {
    routeDirection: createRouteDirection({
      ...defaultRouteDirection,
      tripHeadsign: { name: '東京都立産業技術研究センター前', names: {} },
    }),
  },
};

export const Empty: Story = {
  args: {
    routeDirection: createRouteDirection({ ...defaultRouteDirection, tripHeadsign: emptyHeadsign }),
  },
};

export const Truncated: Story = {
  args: {
    routeDirection: createRouteDirection({
      ...defaultRouteDirection,
      tripHeadsign: { name: '東京都立産業技術研究センター前', names: {} },
    }),
    maxLength: 5,
  },
};

export const BusRoute: Story = {
  args: { routeDirection: createRouteDirection({ ...defaultRouteDirection, route: busRoute }) },
};

export const BusRoute2: Story = {
  args: { routeDirection: createRouteDirection({ ...defaultRouteDirection, route: busRoute2 }) },
};

export const TramRoute: Story = {
  args: { routeDirection: createRouteDirection({ ...defaultRouteDirection, route: tramRoute }) },
};

export const NoColor: Story = {
  args: { routeDirection: createRouteDirection({ ...defaultRouteDirection, route: noColorRoute }) },
};

export const VerboseTruncated: Story = {
  args: {
    routeDirection: createRouteDirection({
      ...defaultRouteDirection,
      tripHeadsign: { name: '東京都立産業技術研究センター前', names: {} },
    }),
    maxLength: 5,
    infoLevel: 'verbose',
  },
};

export const WithTranslations: Story = {
  args: { infoLevel: 'verbose' },
};

export const TripEmptyStopPresent: Story = {
  args: {
    routeDirection: createRouteDirection({
      route: busRoute,
      tripHeadsign: emptyHeadsign,
      stopHeadsign: stopHeadsignMusashiKoganeiSouth,
    }),
  },
};

export const StopOverridesTrip: Story = {
  args: {
    routeDirection: createRouteDirection({
      route: busRoute2,
      tripHeadsign: headsignKyotoLongShortJa,
      stopHeadsign: stopHeadsignDemachiyanagi,
    }),
    infoLevel: 'normal',
  },
};

export const WithDirection: Story = {
  args: {
    routeDirection: createRouteDirection({ ...defaultRouteDirection, direction: 0 }),
    infoLevel: 'verbose',
  },
};

const logicalLongRd = createRouteDirection({
  route: routeLong,
  tripHeadsign: tripHeadsignLong,
  stopHeadsign: stopHeadsignLong,
});

export const LogicalLongInfoLevelComparison: Story = {
  args: { routeDirection: logicalLongRd },
  render: (args) => {
    const levels = ['simple', 'normal', 'detailed', 'verbose'] as const;
    return (
      <div className="flex flex-col gap-3">
        {levels.map((level) => (
          <div key={level} className="space-y-1">
            <span className="block text-[10px] text-gray-400">infoLevel: {level}</span>
            <HeadsignLabel
              routeDirection={args.routeDirection}
              infoLevel={level}
              dataLang={args.dataLang}
              size={args.size}
            />
          </div>
        ))}
      </div>
    );
  },
};

export const LangComparison: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-20 text-[10px] text-gray-400">{label}</span>
          <HeadsignLabel
            routeDirection={args.routeDirection}
            infoLevel={args.infoLevel}
            dataLang={dataLang}
            size={args.size}
          />
        </div>
      ))}
    </div>
  ),
};

export const LangEnStopOverride: Story = {
  args: {
    routeDirection: createRouteDirection({
      route: busRoute2,
      tripHeadsign: headsignKyotoLongShortJa,
      stopHeadsign: stopHeadsignDemachiyanagi,
    }),
    dataLang: ['en'],
    infoLevel: 'normal',
  },
};

export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <HeadsignLabel
        routeDirection={args.routeDirection}
        infoLevel={args.infoLevel}
        dataLang={args.dataLang}
        size="xs"
      />
      <HeadsignLabel
        routeDirection={args.routeDirection}
        infoLevel={args.infoLevel}
        dataLang={args.dataLang}
        size="sm"
      />
      <HeadsignLabel
        routeDirection={args.routeDirection}
        infoLevel={args.infoLevel}
        dataLang={args.dataLang}
        size="default"
      />
    </div>
  ),
};

export const KitchenSink: Story = {
  args: { infoLevel: 'detailed' },
};

export const KitchenSinkTripEmptyStopVerbose: Story = {
  args: {
    routeDirection: createRouteDirection({
      route: busRoute,
      tripHeadsign: emptyHeadsign,
      stopHeadsign: stopHeadsignMusashiKoganeiSouth,
    }),
    infoLevel: 'verbose',
  },
};

export const KitchenSinkStopOverridesVerbose: Story = {
  args: {
    routeDirection: createRouteDirection({
      route: busRoute2,
      tripHeadsign: headsignKyotoLongShortJa,
      stopHeadsign: stopHeadsignDemachiyanagi,
    }),
    infoLevel: 'verbose',
  },
};