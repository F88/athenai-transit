import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  agencyGx,
  agencyOretetsu,
  agencyTobus,
  agencyLong,
  agencyNoColor,
} from '../../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../../stories/lang-comparison';
import { AgencyBadge } from './agency-badge';

const meta = {
  title: 'Badge/AgencyBadge',
  component: AgencyBadge,
  args: {
    agency: agencyTobus,
    dataLang: ['ja'],
    infoLevel: 'normal',
    size: 'xs',
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'default'] },
  },
} satisfies Meta<typeof AgencyBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Size variants ---

export const SizeXs: Story = {
  args: { size: 'xs' },
};

export const SizeSm: Story = {
  args: { size: 'sm' },
};

export const SizeDefault: Story = {
  args: { size: 'default' },
};

// --- Agency variants ---

/** 2-char: TX (Tsukuba Express). */
export const ShortName: Story = {
  args: { agency: agencyGx },
};

/** 3-char: 都バス (Toei Bus). */
export const MediumName: Story = {
  args: { agency: agencyTobus },
};

/** 5-char: 伊予鉄バス (Iyotetsu Bus). */
export const LongName: Story = {
  args: { agency: agencyOretetsu },
};

/** 8-char: 架空都市圏高速鉄道 (fictional stress test). */
export const VeryLongName: Story = {
  args: { agency: agencyLong },
};

/** Agency without brand colors — uses fallback styling. */
export const NoColor: Story = {
  args: { agency: agencyNoColor },
};

// --- Info levels ---

export const Verbose: Story = {
  args: { agency: agencyTobus, infoLevel: 'verbose' },
};

// --- Comparisons ---

/** All sizes side by side. */
export const SizeComparison: Story = {
  args: { agency: agencyOretetsu },
  render: (args) => (
    <div className="flex items-center gap-2">
      <AgencyBadge
        agency={args.agency}
        dataLang={args.dataLang}
        infoLevel={args.infoLevel}
        size="xs"
      />
      <AgencyBadge
        agency={args.agency}
        dataLang={args.dataLang}
        infoLevel={args.infoLevel}
        size="sm"
      />
      <AgencyBadge
        agency={args.agency}
        dataLang={args.dataLang}
        infoLevel={args.infoLevel}
        size="default"
      />
    </div>
  ),
};

// --- i18n: lang resolution ---

/** All supported languages, one unsupported language, and no language. */
export const LangComparison: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-20 text-[10px] text-gray-400">{label}</span>
          <AgencyBadge
            agency={args.agency}
            dataLang={dataLang}
            infoLevel={args.infoLevel}
            size={args.size}
          />
        </div>
      ))}
    </div>
  ),
};

// --- Kitchen sink: single agency, all info levels ---

export const KitchenSink: Story = {
  args: { infoLevel: 'detailed' },
};
