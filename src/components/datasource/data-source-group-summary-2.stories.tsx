import type { Meta, StoryObj } from '@storybook/react-vite';
import type { DataSourceGroupInfo } from '../../types/app/data-source-group-info';
import { DataSourceGroupSummary } from './data-source-group-summary';
import { DataSourceGroupSummary2 } from './data-source-group-summary-2';

const LANGUAGE_POOL: readonly string[] = [
  'ja',
  'en',
  'ja-Hrkt',
  'zh-Hans',
  'ko',
  'fr',
  'de',
  'es',
] as const;

interface WrapperArgs {
  groupInfoNull: boolean;
  sizeBytes: number | null;
  /**
   * Languages knob: `null` = catalog absent for languages (metric
   * hidden); a non-negative number = catalog present with that many
   * languages (0 still renders the lowest non-null level, not the
   * neutral hidden state).
   */
  languageCount: number | null;
  routeCount?: number | null;
  boardingStopsCount: number | null;
  maxTripsPerDay: number | null;
  routeShapesCount?: number | null;
}

function buildGroupInfo(args: WrapperArgs): DataSourceGroupInfo | null {
  if (args.groupInfoNull) {
    return null;
  }
  return {
    groupId: 'story',
    infos: [],
    size: args.sizeBytes !== null ? { totalBytes: args.sizeBytes } : null,
    translationLanguages:
      args.languageCount === null
        ? null
        : new Set(LANGUAGE_POOL.slice(0, Math.max(0, args.languageCount))),
    routeTypeCounts:
      args.routeCount === undefined || args.routeCount === null ? null : { 3: args.routeCount },
    boardingStopsCount: args.boardingStopsCount,
    maxTripsPerDay: args.maxTripsPerDay,
    routeShapesCount: args.routeShapesCount ?? null,
  };
}

function Wrapper(args: WrapperArgs) {
  return <DataSourceGroupSummary2 groupInfo={buildGroupInfo(args)} />;
}

const meta = {
  title: 'DataSource/DataSourceGroupSummary2',
  component: Wrapper,
  args: {
    groupInfoNull: false,
    sizeBytes: 3_400_000,
    languageCount: 2,
    routeCount: 24,
    boardingStopsCount: 1500,
    maxTripsPerDay: 8000,
    routeShapesCount: 48,
  },
  argTypes: {
    groupInfoNull: { control: 'boolean' },
    sizeBytes: { control: 'number' },
    languageCount: { control: { type: 'number', min: 0, max: LANGUAGE_POOL.length } },
    routeCount: { control: 'number' },
    boardingStopsCount: { control: 'number' },
    maxTripsPerDay: { control: 'number' },
    routeShapesCount: { control: 'number' },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        <div className="bg-background rounded border p-3">
          <div className="text-sm font-medium">京王バス 🚍 🇯🇵</div>
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

/** Realistic mid-range source: should render mid-range tones across the board. */
export const Default: Story = {};

/** All metrics at their minimum non-null bucket — should render the lowest tone. */
export const AllOneStar: Story = {
  args: {
    sizeBytes: 1024,
    languageCount: 1,
    routeCount: 1,
    boardingStopsCount: 1,
    maxTripsPerDay: 1,
    routeShapesCount: 1,
  },
};

/** All metrics at maximum — should render the strongest tone. */
export const AllFiveStars: Story = {
  args: {
    sizeBytes: 20 * 1024 * 1024,
    languageCount: LANGUAGE_POOL.length,
    routeCount: 500,
    boardingStopsCount: 5000,
    maxTripsPerDay: 10000,
    routeShapesCount: 500,
  },
};

// --- Threshold sweep ---

/**
 * One row per level at every metric. Useful for verifying that the
 * threshold buckets produce visibly distinct tones.
 */
export const ThresholdSweep: Story = {
  render: () => {
    const levels: ReadonlyArray<WrapperArgs & { label: string }> = [
      {
        label: 'Level 1 (lowest bucket)',
        groupInfoNull: false,
        sizeBytes: 50 * 1024,
        languageCount: 1,
        routeCount: 1,
        boardingStopsCount: 10,
        maxTripsPerDay: 50,
        routeShapesCount: 1,
      },
      {
        label: 'Level 2',
        groupInfoNull: false,
        sizeBytes: 500 * 1024,
        languageCount: 2,
        routeCount: 8,
        boardingStopsCount: 60,
        maxTripsPerDay: 250,
        routeShapesCount: 12,
      },
      {
        label: 'Level 3',
        groupInfoNull: false,
        sizeBytes: 3 * 1024 * 1024,
        languageCount: 3,
        routeCount: 40,
        boardingStopsCount: 250,
        maxTripsPerDay: 1000,
        routeShapesCount: 60,
      },
      {
        label: 'Level 4',
        groupInfoNull: false,
        sizeBytes: 10 * 1024 * 1024,
        languageCount: 5,
        routeCount: 150,
        boardingStopsCount: 1200,
        maxTripsPerDay: 5000,
        routeShapesCount: 150,
      },
      {
        label: 'Level 5',
        groupInfoNull: false,
        sizeBytes: 20 * 1024 * 1024,
        languageCount: 6,
        routeCount: 500,
        boardingStopsCount: 3000,
        maxTripsPerDay: 10000,
        routeShapesCount: 500,
      },
    ];
    return (
      <div className="flex flex-col gap-2">
        {levels.map((scenario) => (
          <div key={scenario.label} className="bg-background rounded border p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">京王バス 🚍 🇯🇵</span>
              <span className="text-[10px] text-gray-400">{scenario.label}</span>
            </div>
            <Wrapper
              groupInfoNull={scenario.groupInfoNull}
              sizeBytes={scenario.sizeBytes}
              languageCount={scenario.languageCount}
              routeCount={scenario.routeCount}
              boardingStopsCount={scenario.boardingStopsCount}
              maxTripsPerDay={scenario.maxTripsPerDay}
            />
          </div>
        ))}
      </div>
    );
  },
};

// --- Side-by-side comparison with v1 ---

/**
 * v1 (raw numbers) vs v2 (leveled color badges) for the same data —
 * useful for deciding whether the colored summary is clearer than the
 * raw figures.
 */
export const SideBySideWithV1: Story = {
  render: () => {
    const scenarios: ReadonlyArray<WrapperArgs & { label: string }> = [
      {
        label: 'Tiny source',
        groupInfoNull: false,
        sizeBytes: 12_000,
        languageCount: 1,
        routeCount: 2,
        boardingStopsCount: 8,
        maxTripsPerDay: 24,
      },
      {
        label: 'Small',
        groupInfoNull: false,
        sizeBytes: 200_000,
        languageCount: 2,
        routeCount: 12,
        boardingStopsCount: 100,
        maxTripsPerDay: 500,
      },
      {
        label: 'Medium (Keio Bus)',
        groupInfoNull: false,
        sizeBytes: 9_877_327,
        languageCount: 3,
        routeCount: 255,
        boardingStopsCount: 2927,
        maxTripsPerDay: 11_341,
      },
      {
        label: 'Large (minkuru)',
        groupInfoNull: false,
        sizeBytes: 19_659_638,
        languageCount: 3,
        routeCount: 483,
        boardingStopsCount: 3691,
        maxTripsPerDay: 15_075,
      },
    ];
    return (
      <div className="flex flex-col gap-3">
        {scenarios.map((scenario) => {
          const groupInfo = buildGroupInfo(scenario);
          return (
            <div key={scenario.label} className="bg-background rounded border p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">京王バス 🚍 🇯🇵</span>
                <span className="text-[10px] text-gray-400">{scenario.label}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[10px] text-gray-400">v1</span>
                <DataSourceGroupSummary groupInfo={groupInfo} />
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-[10px] text-gray-400">v2</span>
                <DataSourceGroupSummary2 groupInfo={groupInfo} />
              </div>
            </div>
          );
        })}
      </div>
    );
  },
};

// --- Realistic catalog samples ---

/**
 * Sample of real sources drawn from the 2026-05-17 catalog snapshot,
 * spanning from a tiny ferry (snws) to a metropolitan operator (minkuru).
 */
export const RealCatalogSamples: Story = {
  render: () => {
    const samples: ReadonlyArray<WrapperArgs & { label: string }> = [
      // ferry / micro
      {
        label: 'snws (micro ferry)',
        groupInfoNull: false,
        sizeBytes: 4149,
        languageCount: 1,
        boardingStopsCount: 2,
        maxTripsPerDay: 18,
      },
      // single-line / community
      {
        label: 'kbus',
        groupInfoNull: false,
        sizeBytes: 103_165,
        languageCount: 1,
        boardingStopsCount: 61,
        maxTripsPerDay: 96,
      },
      // small regional
      {
        label: 'mir',
        groupInfoNull: false,
        sizeBytes: 212_725,
        languageCount: 2,
        boardingStopsCount: 20,
        maxTripsPerDay: 463,
      },
      // mid (Keio Bus)
      {
        label: 'kobus (Keio Bus)',
        groupInfoNull: false,
        sizeBytes: 9_877_327,
        languageCount: 3,
        boardingStopsCount: 2927,
        maxTripsPerDay: 11_341,
      },
      // large international
      {
        label: 'vagfr (VAG Freiburg)',
        groupInfoNull: false,
        sizeBytes: 12_024_830,
        languageCount: 0,
        boardingStopsCount: 677,
        maxTripsPerDay: 3800,
      },
      // very large (minkuru)
      {
        label: 'minkuru',
        groupInfoNull: false,
        sizeBytes: 19_659_638,
        languageCount: 3,
        boardingStopsCount: 3691,
        maxTripsPerDay: 15_075,
      },
      // multilingual (kcbus)
      {
        label: 'kcbus (6 languages)',
        groupInfoNull: false,
        sizeBytes: 14_242_115,
        languageCount: 6,
        boardingStopsCount: 1677,
        maxTripsPerDay: 6343,
      },
    ];
    return (
      <div className="flex flex-col gap-2">
        {samples.map((scenario) => (
          <div key={scenario.label} className="bg-background rounded border p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">京王バス 🚍 🇯🇵</span>
              <span className="text-[10px] text-gray-400">{scenario.label}</span>
            </div>
            <Wrapper
              groupInfoNull={scenario.groupInfoNull}
              sizeBytes={scenario.sizeBytes}
              languageCount={scenario.languageCount}
              boardingStopsCount={scenario.boardingStopsCount}
              maxTripsPerDay={scenario.maxTripsPerDay}
            />
          </div>
        ))}
      </div>
    );
  },
};
