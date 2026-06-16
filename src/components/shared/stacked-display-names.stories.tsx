import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ResolvedDisplayNames } from '@/domain/transit/name-resolver/get-display-names';

import type { ExtendedDisplaySize } from './display-size';
import { StackedDisplayNames } from './stacked-display-names';

const kyotoArashiyamaNames: ResolvedDisplayNames = {
  name: '京都駅前〜阪急嵐山駅前',
  subNames: [
    'Kyoto Sta.〜Hankyu Arashiyama Sta.',
    '京都站前〜阪急岚山站前',
    '京都站前〜阪急嵐山站前',
    '교토에키마에〜한큐아라시야마에키마에',
  ],
};

const nakanoNames: ResolvedDisplayNames = {
  name: '中野駅',
  subNames: ['Nakano Sta.'],
};

const nameOnlyNames: ResolvedDisplayNames = {
  name: '中野駅',
  subNames: [],
};

const meta = {
  title: 'DisplayNames/StackedDisplayNames',
  component: StackedDisplayNames,
  args: {
    names: kyotoArashiyamaNames,
    size: 'md',
    ellipsis: false,
    showSubNames: true,
    subNamesPosition: 'top',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    subNamesPosition: { control: 'inline-radio', options: ['top', 'bottom'] },
    showSubNames: { control: 'boolean' },
    ellipsis: { control: 'boolean' },
    nameClassName: { control: 'text' },
    subNamesClassName: { control: 'text' },
  },
} satisfies Meta<typeof StackedDisplayNames>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: Kyoto-Arashiyama with sub-names on top, md size. */
export const Default: Story = {};

/** Sub-names placed below the primary name. */
export const SubNamesBottom: Story = {
  args: { subNamesPosition: 'bottom' },
};

/** Sub-names hidden via `showSubNames=false`. */
export const WithoutSubNames: Story = {
  args: { showSubNames: false },
};

/** Single sub-name (English only). */
export const SingleSubName: Story = {
  args: { names: nakanoNames },
};

/** No sub-names at all (primary name only). */
export const NameOnly: Story = {
  args: { names: nameOnlyNames },
};

const ALL_SIZES: readonly ExtendedDisplaySize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

/** All five sizes side-by-side for comparison (sub-names = 1 step smaller). */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6 p-4">
      {ALL_SIZES.map((size) => (
        <div key={size} className="flex items-baseline gap-3">
          <span className="w-8 text-xs text-gray-500">{size}</span>
          <StackedDisplayNames
            names={args.names}
            size={size}
            ellipsis={args.ellipsis}
            showSubNames={args.showSubNames}
            subNamesPosition={args.subNamesPosition}
            nameClassName={args.nameClassName}
            subNamesClassName={args.subNamesClassName}
          />
        </div>
      ))}
    </div>
  ),
};

/** Long content with `ellipsis` enabled in a narrow container. */
export const Truncated: Story = {
  args: { ellipsis: true },
  render: (args) => (
    <div className="w-48 border border-dashed p-2">
      <StackedDisplayNames
        names={args.names}
        size={args.size}
        ellipsis={args.ellipsis}
        showSubNames={args.showSubNames}
        subNamesPosition={args.subNamesPosition}
        nameClassName={args.nameClassName}
        subNamesClassName={args.subNamesClassName}
      />
    </div>
  ),
};
