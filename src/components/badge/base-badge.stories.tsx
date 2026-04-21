import type { Meta, StoryObj } from '@storybook/react-vite';
import { BaseBadge } from './base-badge';

const meta = {
  title: 'Badge/BaseBadge',
  component: BaseBadge,
  args: {
    label: 'Route',
    size: 'md',
    infoLevel: 'normal',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md'] },
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    showBorder: { control: 'boolean' },
    bgColor: { control: 'color' },
    fgColor: { control: 'color' },
    borderColor: { control: 'color' },
  },
} satisfies Meta<typeof BaseBadge>;

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

/** Size variants stacked side by side for eyeballing padding / text sizing. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <BaseBadge {...args} size="xs" />
      <BaseBadge {...args} size="sm" />
      <BaseBadge {...args} size="md" />
    </div>
  ),
};

// --- Color variants ---

/** No `bgColor` — falls back to the muted foreground / white text defaults. */
export const NoColor: Story = {
  args: { label: 'no color', bgColor: undefined, fgColor: undefined },
};

export const WithBgColor: Story = {
  args: { label: 'Red line', bgColor: '#d32f2f', fgColor: '#ffffff' },
};

/** Pale fill that blends into the light theme — highlights why a
 *  border is useful. */
export const LowContrastFill: Story = {
  args: { label: 'Pale', bgColor: '#fafafa', fgColor: '#111111' },
};

// --- Border variants ---

/** `showBorder` alone (no `borderColor`, no `border-*` class) gives the
 *  default transparent border color from Tailwind, which is effectively
 *  invisible — this case exists to confirm the class is applied. */
export const ShowBorderNoColor: Story = {
  args: { label: 'bordered', showBorder: true },
};

/** `showBorder` + caller-resolved `borderColor` inline. */
export const BorderInlineColor: Story = {
  args: {
    label: 'Red line',
    bgColor: '#d32f2f',
    fgColor: '#ffffff',
    showBorder: true,
    borderColor: '#ffffff',
  },
};

/** Class-driven neutral outline. HeadsignBadge uses this pattern. */
export const BorderNeutralClass: Story = {
  args: {
    label: 'neutral',
    bgColor: '#d32f2f',
    fgColor: '#ffffff',
    showBorder: true,
    className: 'border-app-neutral',
  },
};

/**
 * Three border modes side by side on a range of fills so the visual
 * difference is easy to eyeball:
 *
 * - **none**: `showBorder={false}` — fill only.
 * - **inline**: caller-resolved inline `borderColor` (the
 *   `resolveContextBorderColor` cascade used by `RouteBadge` /
 *   `AgencyBadge`).
 * - **neutral**: class-driven `border-app-neutral` outline
 *   (the `HeadsignBadge` pattern).
 *
 * Toggle the theme in the Storybook toolbar to verify the neutral
 * outline stays legible against both light and dark backgrounds.
 */
export const BorderComparison: Story = {
  args: { size: 'md' },
  render: (args) => {
    const fills: Array<{ label: string; bg: string; fg: string; inline: string }> = [
      { label: 'Red', bg: '#d32f2f', fg: '#ffffff', inline: '#ffffff' },
      { label: 'Yellow', bg: '#fbc02d', fg: '#111111', inline: '#111111' },
      { label: 'Pale', bg: '#fafafa', fg: '#111111', inline: '#111111' },
      { label: 'Dark', bg: '#111111', fg: '#ffffff', inline: '#ffffff' },
      // Colored text pair (e.g. Toei Oedo Line style).
      { label: 'Gold text', bg: '#000000', fg: '#d4af37', inline: '#d4af37' },
      // Same-family pair — text color is low-contrast against theme,
      // so inline border can look faded despite a saturated fill.
      { label: 'Sky on blue', bg: '#1976d2', fg: '#bbdefb', inline: '#bbdefb' },
      // Same-family deep-pink pair.
      { label: 'Pink/peach', bg: '#ff80ab', fg: '#880e4f', inline: '#880e4f' },
      // Pathological: both colors blend into a light theme bg.
      { label: 'Both pale', bg: '#f5f5f5', fg: '#fafafa', inline: '#fafafa' },
    ];
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4 text-[10px] text-gray-400">
          <span className="w-16">fill</span>
          <span className="w-16 text-center">none</span>
          <span className="w-16 text-center">inline</span>
          <span className="w-16 text-center">neutral</span>
        </div>
        {fills.map(({ label, bg, fg, inline }) => (
          <div key={label} className="flex items-center gap-4">
            <span className="w-16 text-xs text-gray-500">{label}</span>
            <div className="flex w-16 justify-center">
              <BaseBadge {...args} label={label} bgColor={bg} fgColor={fg} showBorder={false} />
            </div>
            <div className="flex w-16 justify-center">
              <BaseBadge
                {...args}
                label={label}
                bgColor={bg}
                fgColor={fg}
                showBorder={true}
                borderColor={inline}
              />
            </div>
            <div className="flex w-16 justify-center">
              <BaseBadge
                {...args}
                label={label}
                bgColor={bg}
                fgColor={fg}
                showBorder={true}
                className="border-app-neutral"
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// --- Verbose extras ---

/** `verboseExtras.enabled = false` keeps the chip compact even when
 *  `infoLevel === 'verbose'`. */
export const VerboseDisabled: Story = {
  args: {
    infoLevel: 'verbose',
    verboseExtras: {
      enabled: false,
      idLabel: 'route-42',
      slot: <span className="text-[10px] text-gray-400">(would-be detail panel)</span>,
    },
  },
};

/** `enabled: true` + `idLabel` only — IdBadge appears next to the chip. */
export const VerboseWithIdOnly: Story = {
  args: {
    infoLevel: 'verbose',
    verboseExtras: {
      enabled: true,
      idLabel: 'route-42',
    },
  },
};

/** `enabled: true` + `slot` only — detail panel below the chip, no IdBadge. */
export const VerboseWithSlotOnly: Story = {
  args: {
    infoLevel: 'verbose',
    verboseExtras: {
      enabled: true,
      slot: <span className="text-[10px] text-gray-400">detail panel content</span>,
    },
  },
};

/** Both extras together — full verbose rendering. */
export const VerboseFull: Story = {
  args: {
    infoLevel: 'verbose',
    verboseExtras: {
      enabled: true,
      idLabel: 'route-42',
      slot: <span className="text-[10px] text-gray-400">detail panel content</span>,
    },
  },
};

/** Extras enabled but `infoLevel !== 'verbose'` — nothing extra is rendered. */
export const VerboseGatedByInfoLevel: Story = {
  args: {
    infoLevel: 'detailed',
    verboseExtras: {
      enabled: true,
      idLabel: 'route-42',
      slot: <span className="text-[10px] text-gray-400">detail panel content</span>,
    },
  },
};

// --- Truncation ---

export const Truncated: Story = {
  args: { label: 'Very long badge label', maxLength: 6, ellipsis: true },
};

export const TruncatedNoEllipsis: Story = {
  args: { label: 'Very long badge label', maxLength: 6, ellipsis: false },
};

// --- Kitchen sink ---

export const KitchenSink: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <BaseBadge {...args} label="xs" size="xs" />
        <BaseBadge {...args} label="sm" size="sm" />
        <BaseBadge {...args} label="md" size="md" />
      </div>
      <div className="flex items-center gap-2">
        <BaseBadge {...args} label="fill" bgColor="#d32f2f" fgColor="#ffffff" showBorder={false} />
        <BaseBadge
          {...args}
          label="inline"
          bgColor="#d32f2f"
          fgColor="#ffffff"
          borderColor="#ffffff"
          showBorder={true}
        />
        <BaseBadge
          {...args}
          label="neutral"
          bgColor="#d32f2f"
          fgColor="#ffffff"
          showBorder={true}
          className="border-app-neutral"
        />
      </div>
      <div className="flex items-center gap-2">
        <BaseBadge
          {...args}
          label="verbose"
          infoLevel="verbose"
          verboseExtras={{
            enabled: true,
            idLabel: 'id-42',
            slot: <span className="text-[10px] text-gray-400">detail panel</span>,
          }}
        />
      </div>
    </div>
  ),
};
