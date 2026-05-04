import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { fn } from 'storybook/test';
import { MapMultiStateButton } from './map-multi-state-button';

const meta = {
  title: 'Button/MapMultiStateButton',
  component: MapMultiStateButton,
  args: {
    active: true,
    highlighted: false,
    disabled: false,
    label: 'Locate',
    onClick: fn(),
    children: '🎯',
  },
  argTypes: {
    active: { control: 'boolean' },
    highlighted: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
    pulseKey: { control: 'number' },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MapMultiStateButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic states ---

/** Idle: tracking off, ready to fetch (default state of the locate button). */
export const Idle: Story = {
  args: { active: true, highlighted: false },
};

/** Highlighted: auto-tracking is on. Background uses the accent color. */
export const Highlighted: Story = {
  args: { active: true, highlighted: true },
};

/** Loading (one-shot): geolocation request in flight, tracking still off. */
export const Loading: Story = {
  args: { active: false, highlighted: false, disabled: true, children: '.' },
};

/** Loading while tracking on: e.g. immediately after enabling auto-tracking. */
export const LoadingHighlighted: Story = {
  args: { active: false, highlighted: true, disabled: true, children: '.' },
};

/** Disabled but not highlighted (greyed out without an explicit "loading" mark). */
export const Disabled: Story = {
  args: { active: true, highlighted: false, disabled: true },
};

// --- Comparison ---

/** All four corners of the active × highlighted matrix. */
export const StateMatrix: Story = {
  args: { label: 'demo' },
  render: (args) => (
    <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-2 text-xs">
      <span />
      <span className="text-muted-foreground text-center">highlighted=false</span>
      <span className="text-muted-foreground text-center">highlighted=true</span>

      <span className="text-muted-foreground">active=true</span>
      <MapMultiStateButton {...args} active highlighted={false}>
        🎯
      </MapMultiStateButton>
      <MapMultiStateButton {...args} active highlighted>
        🎯
      </MapMultiStateButton>

      <span className="text-muted-foreground">active=false</span>
      <MapMultiStateButton {...args} active={false} highlighted={false}>
        🎯
      </MapMultiStateButton>
      <MapMultiStateButton {...args} active={false} highlighted>
        🎯
      </MapMultiStateButton>
    </div>
  ),
};

/** The visible sequence the locate button cycles through. */
export const LocateLifecycle: Story = {
  args: { label: 'locate' },
  render: (args) => (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-1">
        <MapMultiStateButton {...args} active highlighted={false}>
          🎯
        </MapMultiStateButton>
        <span className="text-muted-foreground text-xs">idle</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <MapMultiStateButton {...args} active={false} highlighted={false} disabled>
          .
        </MapMultiStateButton>
        <span className="text-muted-foreground text-xs">loading</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <MapMultiStateButton {...args} active highlighted>
          🎯
        </MapMultiStateButton>
        <span className="text-muted-foreground text-xs">tracking</span>
      </div>
    </div>
  ),
};

// --- Pulse (ripple animation) ---

/**
 * Manual trigger of the pulse ripple. Click the "Trigger pulse" button
 * to bump `pulseKey`; the locate button on the right replays its
 * one-shot ripple each time the key changes.
 *
 * In production this signal arrives from MapView whenever a fresh
 * geolocation fix is applied (manual locate or auto-tracking watch).
 */
export const PulseManual: Story = {
  args: { label: 'locate' },
  render: (args) => {
    const [count, setCount] = useState(0);
    return (
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="rounded-md border border-black/40 bg-white px-3 py-1 text-sm dark:border-white/40 dark:bg-gray-700 dark:text-white"
        >
          Trigger pulse (count={count})
        </button>
        <MapMultiStateButton {...args} active highlighted={false} pulseKey={count}>
          🎯
        </MapMultiStateButton>
        <MapMultiStateButton {...args} active highlighted pulseKey={count}>
          🎯
        </MapMultiStateButton>
      </div>
    );
  },
};

/**
 * Auto-pulse on a fixed interval (every 2 s) to approximate the cadence
 * of `watchPosition` updates during active tracking. Useful for
 * eyeballing the ripple shape without setting up real geolocation.
 */
export const PulseAuto: Story = {
  args: { label: 'locate' },
  render: (args) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
      const id = setInterval(() => {
        setCount((c) => c + 1);
      }, 2000);
      return () => {
        clearInterval(id);
      };
    }, []);
    return (
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground text-xs">pulse #{count}</span>
        <MapMultiStateButton {...args} active highlighted pulseKey={count}>
          🎯
        </MapMultiStateButton>
      </div>
    );
  },
};

/**
 * Pulse triggered across every (active × highlighted) variant so the
 * ripple's appearance can be compared on white vs accent backgrounds.
 */
export const PulseStateMatrix: Story = {
  args: { label: 'demo' },
  render: (args) => {
    const [count, setCount] = useState(0);
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="rounded-md border border-black/40 bg-white px-3 py-1 text-sm dark:border-white/40 dark:bg-gray-700 dark:text-white"
        >
          Trigger pulse (count={count})
        </button>
        <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-2 text-xs">
          <span />
          <span className="text-muted-foreground text-center">highlighted=false</span>
          <span className="text-muted-foreground text-center">highlighted=true</span>

          <span className="text-muted-foreground">active=true</span>
          <MapMultiStateButton {...args} active highlighted={false} pulseKey={count}>
            🎯
          </MapMultiStateButton>
          <MapMultiStateButton {...args} active highlighted pulseKey={count}>
            🎯
          </MapMultiStateButton>

          <span className="text-muted-foreground">active=false</span>
          <MapMultiStateButton {...args} active={false} highlighted={false} pulseKey={count}>
            🎯
          </MapMultiStateButton>
          <MapMultiStateButton {...args} active={false} highlighted pulseKey={count}>
            🎯
          </MapMultiStateButton>
        </div>
      </div>
    );
  },
};

// --- Kitchen sink ---

/**
 * Maximum-content scenario: every (active × highlighted × disabled) variant
 * with realistic emoji content used by panels.
 */
export const KitchenSink: Story = {
  args: { label: 'demo' },
  render: (args) => {
    const variants: { active: boolean; highlighted: boolean; disabled: boolean; note: string }[] = [
      { active: true, highlighted: false, disabled: false, note: 'idle' },
      { active: true, highlighted: true, disabled: false, note: 'tracking' },
      { active: false, highlighted: false, disabled: true, note: 'loading' },
      { active: false, highlighted: true, disabled: true, note: 'tracking + loading' },
      { active: true, highlighted: false, disabled: true, note: 'disabled' },
      { active: true, highlighted: true, disabled: true, note: 'tracking + disabled' },
    ];
    return (
      <div className="space-y-3">
        {variants.map((v) => (
          <div key={v.note} className="flex items-center gap-3">
            <span className="text-muted-foreground w-44 text-xs">{v.note}</span>
            <MapMultiStateButton
              {...args}
              active={v.active}
              highlighted={v.highlighted}
              disabled={v.disabled}
            >
              {v.disabled && !v.highlighted ? '.' : '🎯'}
            </MapMultiStateButton>
          </div>
        ))}
      </div>
    );
  },
};
