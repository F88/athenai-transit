import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { baseStop, longNameStop, storyMapCenter } from '../../stories/fixtures';
import type { AppRouteTypeValue } from '../../types/app/transit';
import { StopSearchResultItem } from './stop-search-result-item';

const meta = {
  title: 'Search/StopSearchResultItem',
  component: StopSearchResultItem,
  args: {
    stop: baseStop,
    routeTypes: [3] as AppRouteTypeValue[],
    isAnchor: false,
    query: '',
    normalizedQuery: '',
    infoLevel: 'normal',
    dataLang: ['ja'],
    mapCenter: null,
    isSelected: false,
    buttonRef: () => {},
    onSelect: fn(),
    onToggleAnchor: fn(),
    onShowStopTimetable: fn(),
    onOpenTripInspectionByStopId: fn(),
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    isAnchor: { control: 'boolean' },
    isSelected: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="bg-background w-[360px] overflow-hidden rounded-lg border-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StopSearchResultItem>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Selected: Story = {
  args: { isSelected: true },
};

export const Anchored: Story = {
  args: { isAnchor: true },
};

export const SelectedAndAnchored: Story = {
  args: { isSelected: true, isAnchor: true },
};

// --- Route types ---

export const Bus: Story = {
  args: { routeTypes: [3] as AppRouteTypeValue[] },
};

export const Tram: Story = {
  args: { routeTypes: [0] as AppRouteTypeValue[] },
};

export const Subway: Story = {
  args: { routeTypes: [1] as AppRouteTypeValue[] },
};

export const Rail: Story = {
  args: { routeTypes: [2] as AppRouteTypeValue[] },
};

export const MultiType: Story = {
  args: { routeTypes: [0, 1, 2, 3] as AppRouteTypeValue[] },
};

export const UnknownRouteType: Story = {
  args: { routeTypes: [-1] as AppRouteTypeValue[] },
};

// --- Highlight ---

/** Direct substring match — `錦糸` is highlighted in `錦糸町駅前`. */
export const HighlightDirect: Story = {
  args: { query: '錦糸', normalizedQuery: '錦糸' },
};

/** Case-insensitive match — `kinshi` highlights `Kinshi` in the en sub-name. */
export const HighlightCaseInsensitive: Story = {
  args: {
    stop: { ...baseStop, stop_name: 'Kinshicho Sta.', stop_names: { en: 'Kinshicho Sta.' } },
    query: 'kinshi',
    normalizedQuery: 'kinshi',
    dataLang: ['en'],
  },
};

/** Kana-normalized match — katakana query highlights hiragana sub-name. */
export const HighlightKanaNormalized: Story = {
  args: {
    query: 'キンシ',
    normalizedQuery: 'きんし',
    infoLevel: 'detailed',
  },
};

export const NoMatchNoHighlight: Story = {
  args: { query: 'no-such-substring', normalizedQuery: 'no-such-substring' },
};

// --- SubNames ---

/** Multi-language stop with subNames visible below the primary name. */
export const WithSubNames: Story = {
  args: { stop: longNameStop, infoLevel: 'detailed' },
};

export const LongName: Story = {
  args: { stop: longNameStop },
};

// --- Distance ---

/** Distance + direction badge appears when `mapCenter` is provided and the stop is >= 10m away. */
export const WithDistance: Story = {
  args: { mapCenter: storyMapCenter },
};

/** A stop within ~5m of the map center suppresses the distance badge to avoid jitter. */
export const NearMapCenter: Story = {
  args: {
    mapCenter: { lat: baseStop.stop_lat, lng: baseStop.stop_lon },
  },
};

/** Far stop — exercises the km-rounded variant and direction arrow. */
export const FarFromMapCenter: Story = {
  args: {
    mapCenter: { lat: 35.5, lng: 139.5 },
  },
};

// --- Info levels ---

export const Simple: Story = {
  args: { infoLevel: 'simple' },
};

export const Detailed: Story = {
  args: { infoLevel: 'detailed' },
};

/** `verbose` reveals the IdBadge above the stop name. */
export const Verbose: Story = {
  args: { infoLevel: 'verbose' },
};

// --- Kitchen sink ---

const kitchenSinkArgs = {
  stop: longNameStop,
  routeTypes: [0, 1, 2, 3] as AppRouteTypeValue[],
  isAnchor: true,
  isSelected: true,
  query: '東京',
  normalizedQuery: '東京',
  dataLang: ['ja'] as readonly string[],
  mapCenter: storyMapCenter,
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
