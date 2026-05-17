import type { Meta, StoryObj } from '@storybook/react-vite';
import type { DataSourceGroupInfo } from '../../hooks/use-data-source-group-info';
import { DataSourceGroupSummary } from './data-source-group-summary';

/**
 * Pool of realistic BCP 47 codes used to synthesize a `languages` Set
 * from a single integer knob. Sliced to `languageCount`.
 */
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

/**
 * Knob-friendly args shape for stories. The component itself takes a
 * single `groupInfo` object whose fields are not Storybook-control
 * friendly (Set, nested object). The wrapper below maps simple primitives
 * to a synthesized `DataSourceGroupInfo` so authors can tweak each metric
 * via the Storybook controls panel.
 */
interface WrapperArgs {
  /** When true, `groupInfo` is `null` (component renders nothing). */
  groupInfoNull: boolean;
  /** Total bundle size in bytes. `null` to omit the size metric. */
  sizeBytes: number | null;
  /** Translation language count (sliced from {@link LANGUAGE_POOL}). */
  languageCount: number;
  /** Physical boarding-stops count. `null` to omit. */
  boardingStopsCount: number | null;
  /** Peak single-day trip count. `null` to omit. */
  maxTripsPerDay: number | null;
}

function Wrapper(args: WrapperArgs) {
  const groupInfo: DataSourceGroupInfo | null = args.groupInfoNull
    ? null
    : {
        groupId: 'story',
        infos: [],
        size: args.sizeBytes !== null ? { totalBytes: args.sizeBytes } : null,
        languages: new Set(LANGUAGE_POOL.slice(0, Math.max(0, args.languageCount))),
        boardingStopsCount: args.boardingStopsCount,
        maxTripsPerDay: args.maxTripsPerDay,
      };
  return <DataSourceGroupSummary groupInfo={groupInfo} />;
}

const meta = {
  title: 'DataSource/DataSourceGroupSummary',
  component: Wrapper,
  args: {
    groupInfoNull: false,
    sizeBytes: 3_400_000,
    languageCount: 2,
    boardingStopsCount: 1500,
    maxTripsPerDay: 8000,
  },
  argTypes: {
    groupInfoNull: { control: 'boolean' },
    sizeBytes: { control: 'number' },
    languageCount: { control: { type: 'number', min: 0, max: LANGUAGE_POOL.length } },
    boardingStopsCount: { control: 'number' },
    maxTripsPerDay: { control: 'number' },
  },
  decorators: [
    (Story) => (
      // Frame the component the way it appears in DataSourceSettingsDialog:
      // as a subtitle line directly under a group name. The outer card hints
      // at the surrounding row container.
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

// --- Default / coverage ---

/** Realistic mid-range bus operator with all four metrics. */
export const Default: Story = {};

/**
 * Minimal one-language source (e.g. a Japanese-only feed with very few
 * stops and trips). Verifies that single-digit values still render
 * legibly without padding tricks.
 */
export const SmallValues: Story = {
  args: {
    sizeBytes: 12_000,
    languageCount: 1,
    boardingStopsCount: 8,
    maxTripsPerDay: 24,
  },
};

/**
 * Major metropolitan operator. Exercises locale-grouped digit
 * formatting (e.g. `12,345`) and a multi-MB size.
 */
export const LargeValues: Story = {
  args: {
    sizeBytes: 48_000_000,
    languageCount: 4,
    boardingStopsCount: 12_345,
    maxTripsPerDay: 87_500,
  },
};

/**
 * Source publishing translations in every supported language.
 * Highlights that the `languages` metric currently shows only the
 * count, not the language codes.
 */
export const ManyLanguages: Story = {
  args: {
    languageCount: LANGUAGE_POOL.length,
  },
};

// --- Partial / empty states ---

/** Only the bundle size is known (e.g. catalog has size but stops/trips/langs aggregation empty). */
export const SizeOnly: Story = {
  args: {
    sizeBytes: 200_000,
    languageCount: 0,
    boardingStopsCount: null,
    maxTripsPerDay: null,
  },
};

/** Source with no translations (`languages.size === 0` hides the language metric). */
export const NoLanguages: Story = {
  args: {
    languageCount: 0,
  },
};

/** Catalog has data but none of the four metrics — component renders nothing. */
export const AllMetricsAbsent: Story = {
  args: {
    sizeBytes: null,
    languageCount: 0,
    boardingStopsCount: null,
    maxTripsPerDay: null,
  },
};

/** `groupInfo` is itself `null` (no entry in the lookup) — component renders nothing. */
export const NoGroupInfo: Story = {
  args: {
    groupInfoNull: true,
  },
};

// --- Side-by-side comparison ---

/**
 * Compare several common states stacked vertically. Useful for spotting
 * vertical-rhythm or alignment regressions when tweaking the subtitle
 * line styling.
 */
export const Comparison: Story = {
  render: () => {
    const scenarios: ReadonlyArray<WrapperArgs & { label: string }> = [
      {
        label: 'Default',
        groupInfoNull: false,
        sizeBytes: 3_400_000,
        languageCount: 2,
        boardingStopsCount: 1500,
        maxTripsPerDay: 8000,
      },
      {
        label: 'Small',
        groupInfoNull: false,
        sizeBytes: 12_000,
        languageCount: 1,
        boardingStopsCount: 8,
        maxTripsPerDay: 24,
      },
      {
        label: 'Large',
        groupInfoNull: false,
        sizeBytes: 48_000_000,
        languageCount: 4,
        boardingStopsCount: 12_345,
        maxTripsPerDay: 87_500,
      },
      {
        label: 'Size only',
        groupInfoNull: false,
        sizeBytes: 200_000,
        languageCount: 0,
        boardingStopsCount: null,
        maxTripsPerDay: null,
      },
      {
        label: 'No languages',
        groupInfoNull: false,
        sizeBytes: 3_400_000,
        languageCount: 0,
        boardingStopsCount: 1500,
        maxTripsPerDay: 8000,
      },
    ];
    return (
      <div className="flex flex-col gap-3">
        {scenarios.map((scenario) => (
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
