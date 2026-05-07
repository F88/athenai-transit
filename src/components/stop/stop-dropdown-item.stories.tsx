import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  agencyGx,
  agencyOretetsu,
  agencyTobus,
  baseStop,
  longNameStop,
} from '../../stories/fixtures';
import type { AppRouteTypeValue } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';
import { Select, SelectContent } from '../ui/select';
import { StopDropdownItem } from './stop-dropdown-item';

function makeMeta(stop = baseStop, agencies = [agencyTobus]): StopWithMeta {
  return { stop, agencies, routes: [] };
}

const meta = {
  title: 'Stop/StopDropdownItem',
  component: StopDropdownItem,
  args: {
    stopId: baseStop.stop_id,
    routeTypes: [3] as AppRouteTypeValue[],
    meta: makeMeta(),
    fallbackName: baseStop.stop_name,
    infoLevel: 'normal',
    dataLang: ['ja'],
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
  },
  decorators: [
    (Story) => (
      <div className="bg-background w-[360px] rounded-lg border-4 p-2">
        <Select value="" onValueChange={() => {}} open>
          <SelectContent
            position="item-aligned"
            className="z-1002 min-w-48 border-none bg-white/80 text-black backdrop-blur-sm dark:bg-black/80 dark:text-white"
          >
            <Story />
          </SelectContent>
        </Select>
      </div>
    ),
  ],
} satisfies Meta<typeof StopDropdownItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoMeta: Story = {
  args: { meta: null, fallbackName: 'Snapshot Name (no meta)' },
};

export const WithPlatformCode: Story = {
  args: {
    meta: makeMeta({ ...baseStop, platform_code: '2A' }),
  },
};

export const MultipleAgencies: Story = {
  args: {
    routeTypes: [0, 1, 2, 3] as AppRouteTypeValue[],
    meta: makeMeta(baseStop, [agencyGx, agencyOretetsu, agencyTobus]),
  },
};

export const Verbose: Story = {
  args: { infoLevel: 'verbose' },
};

export const LongName: Story = {
  args: {
    meta: makeMeta(longNameStop, [agencyGx]),
    fallbackName: longNameStop.stop_name,
  },
};

export const KitchenSink: Story = {
  args: {
    routeTypes: [0, 1, 2, 3] as AppRouteTypeValue[],
    meta: makeMeta({ ...longNameStop, platform_code: '12B' }, [
      agencyGx,
      agencyOretetsu,
      agencyTobus,
    ]),
    fallbackName: longNameStop.stop_name,
    infoLevel: 'verbose',
  },
};
