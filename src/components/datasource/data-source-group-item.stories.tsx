import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { GroupLoadStatus } from '../../domain/datasource/aggregate-group-status';
import type { DataSourceGroupInfo } from '../../types/app/data-source-group-info';
import { DataSourceGroupItem } from './data-source-group-item';

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

type StatusKind = GroupLoadStatus['status'];

interface WrapperArgs {
  groupName: string;
  routeTypeEmoji: string;
  countryEmoji: string;
  status: StatusKind;
  loadedCount: number;
  failedCount: number;
  notAttemptedCount: number;
  checked: boolean;
  disabled: boolean;
  groupInfoNull: boolean;
  sizeBytes: number | null;
  languageCount: number | null;
  boardingStopsCount: number | null;
  maxTripsPerDay: number | null;
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
    boardingStopsCount: args.boardingStopsCount,
    maxTripsPerDay: args.maxTripsPerDay,
    routeTypeCounts: null,
    routeShapesCount: null,
  };
}

function createPrefixes(prefixBase: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefixBase}-${index + 1}`);
}

function buildLoadStatus(args: WrapperArgs): GroupLoadStatus {
  const loadedPrefixes = createPrefixes('loaded', args.loadedCount);
  const notAttemptedPrefixes = createPrefixes('pending', args.notAttemptedCount);
  const failedPrefixes = createPrefixes('failed', args.failedCount).map((prefix, index) => ({
    prefix,
    error: new Error(`Fixture error ${index + 1}`),
  }));

  switch (args.status) {
    case 'loaded':
      return { status: 'loaded', loadedPrefixes };
    case 'failed':
      return { status: 'failed', failedPrefixes, notAttemptedPrefixes };
    case 'partial':
      return {
        status: 'partial',
        loadedPrefixes,
        failedPrefixes,
        notAttemptedPrefixes,
      };
    case 'notAttempted':
      return { status: 'notAttempted', notAttemptedPrefixes };
  }
}

function Wrapper(args: WrapperArgs) {
  return (
    <DataSourceGroupItem
      groupName={args.groupName}
      routeTypeEmoji={args.routeTypeEmoji}
      countryEmoji={args.countryEmoji}
      loadStatus={buildLoadStatus(args)}
      groupInfo={buildGroupInfo(args)}
      checked={args.checked}
      disabled={args.disabled}
      onCheckedChange={fn()}
    />
  );
}

const meta = {
  title: 'DataSource/DataSourceGroupItem',
  component: Wrapper,
  args: {
    groupName: 'Keio Bus',
    routeTypeEmoji: '🚌',
    countryEmoji: '🇯🇵',
    status: 'loaded',
    loadedCount: 1,
    failedCount: 0,
    notAttemptedCount: 0,
    checked: true,
    disabled: false,
    groupInfoNull: false,
    sizeBytes: 3_400_000,
    languageCount: 2,
    boardingStopsCount: 1500,
    maxTripsPerDay: 8000,
  },
  argTypes: {
    groupName: { control: 'text' },
    routeTypeEmoji: { control: 'text' },
    countryEmoji: { control: 'text' },
    status: {
      control: 'inline-radio',
      options: ['loaded', 'partial', 'failed', 'notAttempted'] satisfies StatusKind[],
    },
    loadedCount: { control: { type: 'number', min: 0, max: 5 } },
    failedCount: { control: { type: 'number', min: 0, max: 5 } },
    notAttemptedCount: { control: { type: 'number', min: 0, max: 5 } },
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    groupInfoNull: { control: 'boolean' },
    sizeBytes: { control: 'number' },
    languageCount: { control: { type: 'number', min: 0, max: LANGUAGE_POOL.length } },
    boardingStopsCount: { control: 'number' },
    maxTripsPerDay: { control: 'number' },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        <div className="bg-background rounded border p-0">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Loaded: Story = {
  args: {
    status: 'loaded',
    loadedCount: 1,
    failedCount: 0,
    notAttemptedCount: 0,
  },
};

export const NotAttemptedDisabled: Story = {
  args: {
    status: 'notAttempted',
    loadedCount: 0,
    failedCount: 0,
    notAttemptedCount: 1,
    checked: false,
    disabled: true,
    sizeBytes: null,
    languageCount: null,
    boardingStopsCount: null,
    maxTripsPerDay: null,
  },
};

// --- Status variants ---

export const PartialWithFailures: Story = {
  args: {
    status: 'partial',
    loadedCount: 1,
    failedCount: 2,
    notAttemptedCount: 1,
  },
};

export const Failed: Story = {
  args: {
    status: 'failed',
    loadedCount: 0,
    failedCount: 2,
    notAttemptedCount: 1,
    checked: false,
  },
};

export const WithoutMetrics: Story = {
  args: {
    groupInfoNull: true,
  },
};

// --- Comparison ---

export const StatusComparison: Story = {
  render: () => {
    const scenarios: ReadonlyArray<WrapperArgs & { label: string }> = [
      {
        label: 'Loaded',
        groupName: 'Toei Bus',
        routeTypeEmoji: '🚌',
        countryEmoji: '🇯🇵',
        status: 'loaded',
        loadedCount: 1,
        failedCount: 0,
        notAttemptedCount: 0,
        checked: true,
        disabled: false,
        groupInfoNull: false,
        sizeBytes: 19_659_638,
        languageCount: 3,
        boardingStopsCount: 3691,
        maxTripsPerDay: 15075,
      },
      {
        label: 'Partial',
        groupName: 'Toei Transport',
        routeTypeEmoji: '🚋🚇🚆🚌',
        countryEmoji: '🇯🇵',
        status: 'partial',
        loadedCount: 1,
        failedCount: 1,
        notAttemptedCount: 0,
        checked: true,
        disabled: false,
        groupInfoNull: false,
        sizeBytes: 21_000_000,
        languageCount: 3,
        boardingStopsCount: 4200,
        maxTripsPerDay: 17000,
      },
      {
        label: 'Failed',
        groupName: 'Kyoto Bus',
        routeTypeEmoji: '🚌',
        countryEmoji: '🇯🇵',
        status: 'failed',
        loadedCount: 0,
        failedCount: 2,
        notAttemptedCount: 1,
        checked: false,
        disabled: false,
        groupInfoNull: false,
        sizeBytes: 9_877_327,
        languageCount: 2,
        boardingStopsCount: 2927,
        maxTripsPerDay: 11341,
      },
      {
        label: 'Not attempted',
        groupName: 'ACTV',
        routeTypeEmoji: '⛴️',
        countryEmoji: '🇮🇹',
        status: 'notAttempted',
        loadedCount: 0,
        failedCount: 0,
        notAttemptedCount: 1,
        checked: false,
        disabled: true,
        groupInfoNull: false,
        sizeBytes: 463_000,
        languageCount: 0,
        boardingStopsCount: 96,
        maxTripsPerDay: 463,
      },
    ];

    return (
      <div className="rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        <div className="bg-background rounded border p-0">
          {scenarios.map((scenario) => (
            <Wrapper key={scenario.label} {...scenario} />
          ))}
        </div>
      </div>
    );
  },
};

// --- Kitchen sink ---

export const KitchenSink: Story = {
  args: {
    groupName: 'Very Long Combined Regional + Urban + Ferry Demonstration Operator',
    routeTypeEmoji: '🚋🚇🚆🚌⛴️',
    countryEmoji: '🇯🇵🇮🇹',
    status: 'partial',
    loadedCount: 2,
    failedCount: 3,
    notAttemptedCount: 2,
    checked: true,
    disabled: false,
    groupInfoNull: false,
    sizeBytes: 48_000_000,
    languageCount: LANGUAGE_POOL.length,
    boardingStopsCount: 12345,
    maxTripsPerDay: 87500,
  },
};
