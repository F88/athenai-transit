import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MapContainer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { APP_ROUTE_TYPES } from '../../config/route-types';
import type { InfoLevel } from '../../types/app/settings';
import type { ContextualTimetableEntry } from '../../types/app/transit-composed';
import type { Agency, AppRouteTypeValue, Stop } from '../../types/app/transit';
import {
  agencyOretetsu,
  agencyTobus,
  baseStop,
  busRoute,
  createEntry,
  longNameStop,
  storyMapCenter,
  storyNow,
  tramRoute,
} from '../../stories/fixtures';
import { StopMarkersDom } from './stop-markers-dom';

const stopA: Stop = {
  ...baseStop,
  stop_id: 'story-stop-a',
  stop_name: '錦糸町駅前',
  stop_lat: storyMapCenter.lat + 0.0012,
  stop_lon: storyMapCenter.lng - 0.0016,
};

const stopB: Stop = {
  ...longNameStop,
  stop_id: 'story-stop-b',
  stop_lat: storyMapCenter.lat + 0.0002,
  stop_lon: storyMapCenter.lng + 0.0003,
};

const stopC: Stop = {
  ...baseStop,
  stop_id: 'story-stop-c',
  stop_name: '門前仲町駅前',
  stop_lat: storyMapCenter.lat - 0.0011,
  stop_lon: storyMapCenter.lng + 0.0017,
  stop_names: {
    ja: '門前仲町駅前',
    'ja-Hrkt': 'もんぜんなかちょうえきまえ',
    en: 'Monzen-nakacho Sta.',
  },
};

const storyStops: Stop[] = [stopA, stopB, stopC];

const routeTypeMap = new Map<string, AppRouteTypeValue[]>([
  [stopA.stop_id, [3]],
  [stopB.stop_id, [0, 3]],
  [stopC.stop_id, [12]],
]);

const agenciesMap = new Map<string, Agency[]>([
  [stopA.stop_id, [agencyTobus]],
  [stopB.stop_id, [agencyTobus, agencyOretetsu]],
  [stopC.stop_id, [agencyOretetsu]],
]);

const nearbyDepartures = new Map<string, ContextualTimetableEntry[]>([
  [
    stopA.stop_id,
    [
      createEntry({ departureMinutes: 870, route: busRoute, headsign: '大塚駅前' }),
      createEntry({ departureMinutes: 885, route: busRoute, headsign: '大塚駅前' }),
    ],
  ],
  [
    stopB.stop_id,
    [
      createEntry({ departureMinutes: 873, route: tramRoute, headsign: '早稲田' }),
      createEntry({ departureMinutes: 892, route: busRoute, headsign: '錦糸町駅前' }),
      createEntry({ departureMinutes: 911, route: busRoute, headsign: '日暮里駅前' }),
    ],
  ],
  [
    stopC.stop_id,
    [
      createEntry({ departureMinutes: 878, route: busRoute, headsign: '東京駅前' }),
      createEntry({ departureMinutes: 897, route: busRoute, headsign: '豊洲駅前' }),
    ],
  ],
]);

const routeTypeStoryItems = [
  ...APP_ROUTE_TYPES.map(({ value, label }) => ({ value, label })),
  { value: 8, label: 'Unknown' },
  { value: 99, label: 'Unknown' },
  { value: -1, label: 'Unknown' },
] as const;

const allRouteTypeStops: Stop[] = routeTypeStoryItems.map(({ value, label }, index) => ({
  ...baseStop,
  stop_id: `story-route-type-${value}`,
  stop_name: `${label} ${value}`,
  stop_lat: storyMapCenter.lat + (index < 7 ? 0.0012 : -0.0012),
  stop_lon: storyMapCenter.lng + ((index % 7) - 3) * 0.0012,
  stop_names: {
    ja: `${label} ${value}`,
    en: `${label} ${value}`,
  },
}));

const allRouteTypeMap = new Map<string, AppRouteTypeValue[]>(
  routeTypeStoryItems.map(({ value }) => [
    `story-route-type-${value}`,
    [value] as AppRouteTypeValue[],
  ]),
);

const allRouteTypeAgenciesMap = new Map<string, Agency[]>(
  routeTypeStoryItems.map(({ value }) => [`story-route-type-${value}`, [agencyTobus]]),
);

type StopMarkersDomPreviewProps = {
  selectedStopId: string | null;
  infoLevel: InfoLevel;
  showTooltip: boolean;
  disableDimming: boolean;
  includeNearbyDepartures: boolean;
  dataLang: readonly string[];
};

function StopMarkersDomPreview({
  selectedStopId,
  infoLevel,
  showTooltip,
  disableDimming,
  includeNearbyDepartures,
  dataLang,
}: StopMarkersDomPreviewProps) {
  return (
    <div className="w-full rounded-lg bg-[#f3f6fb] p-2">
      <MapContainer
        center={storyMapCenter}
        zoom={15}
        style={{ height: '420px', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <StopMarkersDom
          stops={storyStops}
          selectedStopId={selectedStopId}
          routeTypeMap={routeTypeMap}
          nearbyDepartures={includeNearbyDepartures ? nearbyDepartures : undefined}
          time={storyNow}
          infoLevel={infoLevel}
          dataLang={dataLang}
          onStopSelected={fn()}
          showTooltip={showTooltip}
          agenciesMap={agenciesMap}
          disableDimming={disableDimming}
        />
      </MapContainer>
    </div>
  );
}

const meta = {
  title: 'Map/StopMarkersDom',
  component: StopMarkersDomPreview,
  args: {
    selectedStopId: null,
    infoLevel: 'normal',
    showTooltip: true,
    disableDimming: false,
    includeNearbyDepartures: false,
    dataLang: ['ja', 'en'],
  },
  argTypes: {
    selectedStopId: {
      control: 'inline-radio',
      options: ['none', stopA.stop_id, stopB.stop_id, stopC.stop_id],
      mapping: {
        none: null,
        [stopA.stop_id]: stopA.stop_id,
        [stopB.stop_id]: stopB.stop_id,
        [stopC.stop_id]: stopC.stop_id,
      },
    },
    infoLevel: {
      control: 'inline-radio',
      options: ['simple', 'normal', 'detailed', 'verbose'],
    },
    showTooltip: { control: 'boolean' },
    disableDimming: { control: 'boolean' },
    includeNearbyDepartures: { control: 'boolean' },
  },
} satisfies Meta<typeof StopMarkersDomPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const SelectedStop: Story = {
  args: {
    selectedStopId: stopB.stop_id,
  },
};

export const TooltipsOff: Story = {
  args: {
    selectedStopId: stopB.stop_id,
    showTooltip: false,
  },
};

export const DimmingDisabled: Story = {
  args: {
    selectedStopId: stopB.stop_id,
    disableDimming: true,
  },
};

export const AllRouteTypesDetailed: Story = {
  args: {
    selectedStopId: null,
    infoLevel: 'detailed',
    showTooltip: true,
    disableDimming: true,
    includeNearbyDepartures: false,
    dataLang: ['en'],
  },
  render: (args) => (
    <div className="w-full rounded-lg bg-[#f3f6fb] p-2">
      <MapContainer
        center={storyMapCenter}
        zoom={15}
        style={{ height: '420px', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <StopMarkersDom
          stops={allRouteTypeStops}
          selectedStopId={args.selectedStopId}
          routeTypeMap={allRouteTypeMap}
          time={storyNow}
          infoLevel={args.infoLevel}
          dataLang={args.dataLang}
          onStopSelected={fn()}
          showTooltip={args.showTooltip}
          agenciesMap={allRouteTypeAgenciesMap}
          disableDimming={args.disableDimming}
        />
      </MapContainer>
    </div>
  ),
};

const kitchenSinkArgs = {
  selectedStopId: stopB.stop_id,
  showTooltip: true,
  disableDimming: false,
  includeNearbyDepartures: true,
  dataLang: ['ja', 'en', 'de'],
};

// --- Kitchen sink ---

export const KitchenSink: Story = {
  args: {
    ...kitchenSinkArgs,
    infoLevel: 'detailed' as const,
  },
};
