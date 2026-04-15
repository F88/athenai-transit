import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  busRoute,
  busRoute2,
  noColorRoute,
  routeLong,
  subwayRoute,
  tramRoute,
} from '../../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../../stories/lang-comparison';
import { RouteBadge } from './route-badge';

const translatedShortRoute = {
  ...busRoute,
  route_id: 'route-short-source',
  route_short_names: {
    en: 'To 02',
    ko: '도 02',
  },
} as const;

const longFallbackRoute = {
  ...subwayRoute,
  route_id: 'route-long-source',
  route_short_name: '',
  route_short_names: {},
  route_long_names: {
    'ja-Hrkt': 'おおえどせん',
    en: 'Oedo Line',
    ko: '오에도선',
    'zh-Hans': '大江户线',
    'zh-Hant': '大江戶線',
  },
} as const;

const meta = {
  title: 'Badge/RouteBadge',
  component: RouteBadge,
  args: {
    route: busRoute,
    dataLang: ['ja'],
    infoLevel: 'normal',
    size: 'default',
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    size: { control: 'inline-radio', options: ['default', 'sm', 'xs'] },
  },
} satisfies Meta<typeof RouteBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Size variants ---

export const SizeDefault: Story = {
  args: { size: 'default' },
};

export const SizeSm: Story = {
  args: { size: 'sm' },
};

export const SizeXs: Story = {
  args: { size: 'xs' },
};

// --- Route variants ---

/** Bus route with color. */
export const Bus: Story = {
  args: { route: busRoute },
};

/** Another bus route with different color. */
export const Bus2: Story = {
  args: { route: busRoute2 },
};

/** Tram route. */
export const Tram: Story = {
  args: { route: tramRoute },
};

/** Route without color — uses fallback styling. */
export const NoColor: Story = {
  args: { route: noColorRoute },
};

// --- Info levels ---

export const Simple: Story = {
  args: { infoLevel: 'simple' },
};

export const Normal: Story = {
  args: { infoLevel: 'normal' },
};

export const Detailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const Verbose: Story = {
  args: { infoLevel: 'verbose' },
};

// --- Comparisons ---

/** All sizes side by side. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <RouteBadge
        route={args.route}
        dataLang={args.dataLang}
        infoLevel={args.infoLevel}
        size="xs"
      />
      <RouteBadge
        route={args.route}
        dataLang={args.dataLang}
        infoLevel={args.infoLevel}
        size="sm"
      />
      <RouteBadge
        route={args.route}
        dataLang={args.dataLang}
        infoLevel={args.infoLevel}
        size="default"
      />
    </div>
  ),
};

// --- infoLevel comparison ---

/**
 * Side-by-side comparison of all `infoLevel` values against the
 * logical long-form `routeLong` fixture. Place-name-independent —
 * exercises the full info-level rendering range without being tied
 * to specific real-world data.
 */
export const LogicalLongInfoLevelComparison: Story = {
  args: { route: routeLong },
  render: (args) => {
    const levels = ['simple', 'normal', 'detailed', 'verbose'] as const;
    return (
      <div className="flex flex-col gap-3">
        {levels.map((level) => (
          <div key={level} className="space-y-1">
            <span className="block text-[10px] text-gray-400">infoLevel: {level}</span>
            <RouteBadge
              route={args.route}
              dataLang={args.dataLang}
              infoLevel={level}
              size={args.size}
            />
          </div>
        ))}
      </div>
    );
  },
};

// --- i18n: lang resolution ---

/** All supported languages, one unsupported language, and no language. */
export const LangComparison: Story = {
  args: {
    route: longFallbackRoute,
    infoLevel: 'normal',
  },
  render: (args) => (
    <div className="flex flex-col gap-2">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-20 text-[10px] text-gray-400">{label}</span>
          <RouteBadge
            route={args.route}
            dataLang={dataLang}
            infoLevel={args.infoLevel}
            size={args.size}
          />
        </div>
      ))}
    </div>
  ),
};

export const KitchenSink: Story = {
  args: { infoLevel: 'detailed' },
};

/** Compare verbose output when the resolved source is short vs long. */
export const VerboseResolvedSourceComparison: Story = {
  args: {
    infoLevel: 'verbose',
    dataLang: ['en'],
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          resolvedSource: short
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            route_short_name translation exists, so short side wins
          </span>
        </p>
        <RouteBadge route={translatedShortRoute} dataLang={args.dataLang} infoLevel="verbose" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          resolvedSource: long
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            route_short_name is empty, so long side becomes the fallback winner
          </span>
        </p>
        <RouteBadge route={longFallbackRoute} dataLang={args.dataLang} infoLevel="verbose" />
      </div>
    </div>
  ),
};
