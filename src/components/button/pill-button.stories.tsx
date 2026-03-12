import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PillButton } from './pill-button';

const meta = {
  title: 'Button/PillButton',
  component: PillButton,
  args: {
    onClick: fn(),
    children: 'ラベル',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['default', 'sm'] },
    active: { control: 'boolean' },
    disabled: { control: 'boolean' },
    activeBg: { control: 'color' },
    activeFg: { control: 'color' },
    activeBorder: { control: 'color' },
    inactiveBorder: { control: 'color' },
  },
} satisfies Meta<typeof PillButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic states ---

export const ActiveDefault: Story = {
  args: { active: true, children: '運行中 (5)' },
};

export const InactiveDefault: Story = {
  args: { active: false, children: '運行中 (5)' },
};

export const Disabled: Story = {
  args: { active: false, disabled: true, children: '事業者' },
};

// --- Size variants ---

export const SizeDefault: Story = {
  args: { active: true, children: 'default' },
};

export const SizeSm: Story = {
  args: { active: true, size: 'sm', children: 'sm' },
};

// --- Custom colors (route color) ---

const ROUTE_COLOR = '#e60012';
const ROUTE_TEXT_COLOR = '#ffffff';

export const ActiveCustomColor: Story = {
  args: {
    active: true,
    activeBg: ROUTE_COLOR,
    activeFg: ROUTE_TEXT_COLOR,
    activeBorder: ROUTE_COLOR,
    children: '浅草方面',
  },
};

export const InactiveWithBorder: Story = {
  args: {
    active: false,
    inactiveBorder: ROUTE_COLOR,
    children: '浅草方面',
  },
};

// --- Timetable filter style (activeBg + inactiveBorder) ---

const TOEI_GREEN = '#00a850';

export const FilterActive: Story = {
  args: {
    active: true,
    activeBg: TOEI_GREEN,
    activeFg: '#ffffff',
    children: '新宿方面',
  },
};

export const FilterInactive: Story = {
  args: {
    active: false,
    inactiveBorder: TOEI_GREEN,
    children: '新宿方面',
  },
};

// --- Route type emoji style (bottom sheet) ---

export const RouteTypeActive: Story = {
  args: {
    active: true,
    activeBg: '#1565c020',
    activeBorder: '#1565c0',
    children: '🚌',
  },
};

export const RouteTypeInactive: Story = {
  args: {
    active: false,
    children: '🚌',
  },
};

// --- Comparison rows ---

/** All states side by side at default size. */
export const AllStates: Story = {
  args: { active: false },
  render: (args) => (
    <div className="flex items-center gap-2">
      <PillButton {...args} active>
        Active
      </PillButton>
      <PillButton {...args} active={false}>
        Inactive
      </PillButton>
      <PillButton {...args} active={false} disabled>
        Disabled
      </PillButton>
    </div>
  ),
};

/** Size comparison. */
export const SizeComparison: Story = {
  args: { active: false },
  render: (args) => (
    <div className="flex items-center gap-2">
      <PillButton {...args} active size="default">
        default
      </PillButton>
      <PillButton {...args} active size="sm">
        sm
      </PillButton>
      <PillButton {...args} active={false} size="default">
        default
      </PillButton>
      <PillButton {...args} active={false} size="sm">
        sm
      </PillButton>
    </div>
  ),
};

/** Border consistency: with and without border colors should be same size. */
export const BorderConsistency: Story = {
  args: { active: false },
  render: (args) => (
    <div className="flex items-center gap-2">
      <PillButton {...args} active={false}>
        No border
      </PillButton>
      <PillButton {...args} active={false} inactiveBorder="#e60012">
        With border
      </PillButton>
      <PillButton {...args} active activeBorder="#e60012">
        Active border
      </PillButton>
    </div>
  ),
};

/** Multiple route filters as used in timetable modal. */
export const TimetableFilters: Story = {
  args: { active: false },
  render: (args) => {
    const routes = [
      { label: '浅草方面', color: '#e60012' },
      { label: '押上方面', color: '#0078c8' },
      { label: '西馬込方面', color: '#e60012' },
    ];
    return (
      <div className="flex flex-wrap gap-1">
        {routes.map((r) => (
          <PillButton
            key={r.label}
            {...args}
            active
            activeBg={r.color}
            activeFg="#fff"
            inactiveBorder={r.color}
          >
            {r.label}
          </PillButton>
        ))}
        {routes.map((r) => (
          <PillButton key={`off-${r.label}`} {...args} active={false} inactiveBorder={r.color}>
            {r.label}
          </PillButton>
        ))}
      </div>
    );
  },
};
