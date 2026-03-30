import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  agencyGx,
  agencyOretetsu,
  agencyTobus,
  agencyLong,
  agencyNoColor,
} from '../../stories/fixtures';
import { AgencyBadge } from './agency-badge';

const meta = {
  title: 'Badge/AgencyBadge',
  component: AgencyBadge,
  args: {
    agency: agencyTobus,
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
      <AgencyBadge agency={args.agency} infoLevel={args.infoLevel} size="xs" />
      <AgencyBadge agency={args.agency} infoLevel={args.infoLevel} size="sm" />
      <AgencyBadge agency={args.agency} infoLevel={args.infoLevel} size="default" />
    </div>
  ),
};

// --- Kitchen sink: single agency, all info levels ---

export const KitchenSinkInfoLevelSimple: Story = {
  args: { infoLevel: 'simple' },
};

export const KitchenSinkInfoLevelNormal: Story = {
  args: { infoLevel: 'normal' },
};

export const KitchenSinkInfoLevelDetailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const KitchenSinkInfoLevelVerbose: Story = {
  args: { infoLevel: 'verbose' },
};
