import type { Meta, StoryObj } from '@storybook/react-vite';
import type { InfoLevel } from '../types/app/settings';
import { APP_ROUTE_TYPES } from '../config/route-types';
import { createStopIcon } from './leaflet-helpers';
import { MapContainer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type RouteTypePreviewItem = {
  value: number;
  label: string;
};

const BASE_ROUTE_TYPE_ITEMS: readonly RouteTypePreviewItem[] = APP_ROUTE_TYPES.map(
  ({ value, label }) => ({ value, label }),
);

const ROUTE_TYPE_ITEMS_WITH_UNKNOWN: readonly RouteTypePreviewItem[] = [
  ...BASE_ROUTE_TYPE_ITEMS,
  { value: 8, label: 'Unknown' },
  { value: 99, label: 'Unknown' },
];

type PreviewProps = {
  infoLevel: InfoLevel;
  selected: boolean;
  routeTypeItems?: readonly RouteTypePreviewItem[];
};

function LeafletStopIconPreview({
  infoLevel,
  selected,
  routeTypeItems = ROUTE_TYPE_ITEMS_WITH_UNKNOWN,
}: PreviewProps) {
  const center: [number, number] = [35.681236, 139.767125];

  return (
    <div className="w-full">
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: '360px', width: '100%', background: '#f3f6fb' }}
        zoomControl={false}
        attributionControl={false}
      >
        {routeTypeItems.map(({ value, label }, index) => {
          const lngOffset = (index - (routeTypeItems.length - 1) / 2) * 0.004;
          const position: [number, number] = [center[0], center[1] + lngOffset];
          return (
            <Marker
              key={value}
              position={position}
              icon={createStopIcon(value, selected, `${label} ${value}`, infoLevel)}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}

const meta = {
  title: 'Map/LeafletStopIcon',
  component: LeafletStopIconPreview,
  args: {
    infoLevel: 'simple',
    selected: false,
    routeTypeItems: ROUTE_TYPE_ITEMS_WITH_UNKNOWN,
  },
  argTypes: {
    infoLevel: {
      control: 'inline-radio',
      options: ['simple', 'normal', 'detailed', 'verbose'],
    },
    selected: { control: 'boolean' },
  },
} satisfies Meta<typeof LeafletStopIconPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StopIconSimple: Story = {
  args: {
    infoLevel: 'simple',
    selected: false,
  },
};

export const StopIconDetailed: Story = {
  args: {
    infoLevel: 'detailed',
    selected: false,
  },
};
