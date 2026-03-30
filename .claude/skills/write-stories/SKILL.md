---
name: write-stories
description: >
    Write Storybook stories for React components (.stories.tsx).
    Use when the user asks to "add stories", "write stories", "create stories",
    "add storybook", or wants visual testing coverage for any component.
    Also use when reviewing UI layout, adding KitchenSink variants,
    or expanding existing stories with new data scenarios.
---

# Write Stories

Create `.stories.tsx` files for React components following project conventions.

## Steps

1. Read the target component to understand its props and behavior
2. Read `src/stories/fixtures.ts` for shared test data (agencies, routes, stops, entries)
3. Read 1-2 existing `.stories.tsx` files nearby to match project style
4. Write the stories file as a sibling to the component (e.g. `stop-info.stories.tsx` next to `stop-info.tsx`)
5. Run `npx tsc --noEmit` and `npx eslint <file>` to verify

## File Structure

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test'; // only if needed for callbacks
import type { RouteType } from '../types/app/transit'; // type imports as needed
import { agencyTobus, baseStop, ... } from '../stories/fixtures';
import { MyComponent } from './my-component';

const meta = {
  title: 'Category/MyComponent',   // e.g. 'Badge/AgencyBadge', 'BottomSheet/NearbyStop'
  component: MyComponent,
  args: { /* sensible defaults */ },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    // booleans: { control: 'boolean' }
    // enums: { control: 'inline-radio', options: [...] }
  },
  // Add decorators when the component needs a wrapper for proper rendering
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;
```

## Shared Fixtures

Always use `src/stories/fixtures.ts` for test data instead of defining local fixtures.
Available exports include agencies (10 variants), routes, stops, `createEntry()`, and constants like `storyNow`, `storyMapCenter`, `storyServiceDate`.

When new fixture data is needed that could benefit other stories, add it to `fixtures.ts` rather than defining it locally.

## Story Categories

Organize stories with section comments:

```tsx
// --- Basic ---
export const Default: Story = {};

// --- Variants ---
// Group by the dimension being varied (size, type, state, etc.)

// --- Info levels ---
// Individual info level stories if the component renders differently per level

// --- Kitchen sink ---
// Maximum-content scenarios with all InfoLevel variants
```

## KitchenSink Pattern (Required)

Every component must include a KitchenSink story. The KitchenSink represents the maximum-content scenario: longest text, most badges, all optional elements visible.

When the component accepts `infoLevel` as a prop, add `KitchenSinkInfoLevelXXX` for all four levels. Define shared args once to avoid repetition:

```tsx
const kitchenSinkArgs = {
    stop: longNameStop,
    routeTypes: [0, 3] as RouteType[],
    agencies: allAgencies,
    isDropOffOnly: true,
};

export const KitchenSinkInfoLevelSimple: Story = {
    args: { ...kitchenSinkArgs, infoLevel: 'simple' as const },
};
export const KitchenSinkInfoLevelNormal: Story = {
    args: { ...kitchenSinkArgs, infoLevel: 'normal' as const },
};
export const KitchenSinkInfoLevelDetailed: Story = {
    args: { ...kitchenSinkArgs, infoLevel: 'detailed' as const },
};
export const KitchenSinkInfoLevelVerbose: Story = {
    args: { ...kitchenSinkArgs, infoLevel: 'verbose' as const },
};
```

When the component does not accept `infoLevel`, a single `KitchenSink` story is sufficient:

```tsx
export const KitchenSink: Story = {
    args: {
        /* maximum-content scenario */
    },
};
```

## Comparison/Render Stories

For side-by-side comparisons, use custom `render` functions:

```tsx
export const SizeComparison: Story = {
    args: { agency: agencyIyotetsu },
    render: (args) => (
        <div className="flex items-center gap-2">
            <MyComponent {...args} size="xs" />
            <MyComponent {...args} size="sm" />
            <MyComponent {...args} size="default" />
        </div>
    ),
};
```

## Data Quality

Fixtures should reflect realistic data scenarios:

- Use text lengths matching actual GTFS data (short: 2-char like "TX", long: 8+ char)
- Include multi-language `stop_names` (ja, ja-Hrkt, en, ko, zh-Hans, zh-Hant) for i18n testing
- Agency colors should cover diverse hues including light backgrounds with dark text
- Include an "edge case" fixture (no color, empty string, etc.)

## Type Safety

- Annotate route/agency fixtures with explicit types (`Route`, `Agency`) to prevent literal type narrowing issues with spread
- Use `as RouteType[]` for route type arrays
- Use `StopServiceType` instead of plain `number` for pickupType/dropOffType
- Use `as const` for InfoLevel string values in args

## Callback Props

Use `fn()` from `storybook/test` for callback props:

```tsx
import { fn } from 'storybook/test';
// in args:
onStopSelected: fn(),
onToggleAnchor: fn(),
```
