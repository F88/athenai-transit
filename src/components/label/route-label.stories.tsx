import type { Meta, StoryObj } from '@storybook/react-vite';
import { busRoute, busRoute2, noColorRoute, subwayRoute, tramRoute } from '../../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../../stories/lang-comparison';
import { RouteLabel } from './route-label';

/**
 * A route with a very long English translation, used to verify layout
 * when the route_long_name fallback produces wide labels (such as the
 * Toei Arakawa Line case where route_short_name is empty and the
 * translated long_name like "Tokyo Sakura Tram (Arakawa Line)" takes
 * over).
 */
const longNameRoute = {
  ...tramRoute,
  route_id: 'route-long',
  route_short_name: '',
  route_short_names: {},
  route_long_name: '東京さくらトラム（都電荒川線）',
  route_long_names: {
    ja: '東京さくらトラム（都電荒川線）',
    en: 'Tokyo Sakura Tram (Arakawa Line)',
    ko: '도쿄 사쿠라 트램 (아라카와선)',
    'zh-Hans': '东京樱花电车 (荒川线)',
    'zh-Hant': '東京櫻花電車 (荒川線)',
  },
  route_color: 'EC6FA8',
  route_text_color: 'FFFFFF',
} as const;

const meta = {
  title: 'Label/RouteLabel',
  component: RouteLabel,
  args: {
    route: busRoute,
    count: 42,
    dataLang: ['ja'],
    agencies: [],
    size: 'sm',
  },
  argTypes: {
    count: { control: 'number' },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md'] },
  },
} satisfies Meta<typeof RouteLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Size variants ---

export const SizeXs: Story = {
  args: { size: 'xs' },
};

export const SizeSm: Story = {
  args: { size: 'sm' },
};

export const SizeMd: Story = {
  args: { size: 'md' },
};

// --- Route variants ---

/** Bus route (short name + small count). */
export const Bus: Story = {
  args: { route: busRoute, count: 42 },
};

/** Another bus route with different color. */
export const Bus2: Story = {
  args: { route: busRoute2, count: 18 },
};

/** Tram route. */
export const Tram: Story = {
  args: { route: tramRoute, count: 124 },
};

/** Subway route (short code + English name). */
export const Subway: Story = {
  args: { route: subwayRoute, count: 200 },
};

/**
 * Route without route_color / route_text_color — falls back to
 * BaseLabel's default (no background), only the outer frame is
 * invisible (no borderColor).
 */
export const NoColor: Story = {
  args: { route: noColorRoute, count: 7 },
};

/**
 * Long-name route simulating the Toei Arakawa Line case:
 * route_short_name is empty, so the translated route_long_name
 * dominates and the label becomes wide.
 */
export const LongName: Story = {
  args: { route: longNameRoute, count: 348, dataLang: ['en'] },
};

// --- Count variants ---

/** Single-digit count. */
export const CountSmall: Story = {
  args: { count: 3 },
};

/** Three-digit count. */
export const CountLarge: Story = {
  args: { count: 348 },
};

/** Four-digit count (with thousands separator per locale). */
export const CountThousands: Story = {
  args: { count: 1234 },
};

// --- Comparisons ---

/** All sizes side by side. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <RouteLabel
        route={args.route}
        count={args.count}
        dataLang={args.dataLang}
        agencies={args.agencies}
        size="xs"
      />
      <RouteLabel
        route={args.route}
        count={args.count}
        dataLang={args.dataLang}
        agencies={args.agencies}
        size="sm"
      />
      <RouteLabel
        route={args.route}
        count={args.count}
        dataLang={args.dataLang}
        agencies={args.agencies}
        size="md"
      />
    </div>
  ),
};

/** All supported languages, one unsupported, and default fallback. */
export const LangComparison: Story = {
  args: { route: longNameRoute, count: 348 },
  render: (args) => (
    <div className="flex flex-col gap-2">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-20 text-[10px] text-gray-400">{label}</span>
          <RouteLabel
            route={args.route}
            count={args.count}
            dataLang={dataLang}
            agencies={args.agencies}
            size={args.size}
          />
        </div>
      ))}
    </div>
  ),
};

/** All route variants stacked, size md for easier inspection. */
export const KitchenSink: Story = {
  args: { size: 'md' },
  render: (args) => {
    const samples: Array<{ label: string; route: typeof busRoute; count: number }> = [
      { label: 'bus (色あり)', route: busRoute, count: 42 },
      { label: 'bus2 (色あり)', route: busRoute2, count: 18 },
      { label: 'tram (色あり)', route: tramRoute, count: 124 },
      { label: 'subway (色あり)', route: subwayRoute, count: 200 },
      { label: 'no color', route: noColorRoute, count: 7 },
      { label: 'long name', route: longNameRoute as typeof busRoute, count: 348 },
    ];
    return (
      <div className="flex flex-col gap-2">
        {samples.map(({ label, route, count }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-28 text-xs text-gray-500">{label}</span>
            <RouteLabel
              route={route}
              count={count}
              dataLang={args.dataLang}
              agencies={args.agencies}
              size={args.size}
            />
          </div>
        ))}
      </div>
    );
  },
};
