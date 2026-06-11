import { useEffect, useRef } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { useScrollOverflow } from '../../hooks/use-scroll-overflow';
import { baseStop, longNameStop } from '../../stories/fixtures';
import type { ExtendedDisplaySize } from './display-size';
import { ScrollFadeEdge } from './scroll-fade-edge';
import { ScrollToTopButton } from './scroll-to-top-button';

/**
 * Close-up preview of the button itself, detached from any list content.
 *
 * The box height matches its content exactly (full-height spacer + the
 * button's zero-height sticky wrapper), so the box never scrolls and the
 * sticky positioning settles the button at its resting place: bottom-right,
 * 1rem above the container edge.
 *
 * Sizes are inline styles (not Tailwind utilities) so the preview does not
 * depend on which utility classes the current Tailwind build has generated.
 */
function StaticButtonPreview({
  size,
  className,
}: {
  size?: ExtendedDisplaySize;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={boxRef}
      className="relative overflow-y-auto rounded-lg border bg-white dark:bg-gray-900"
      style={{ height: '8rem', width: '12rem' }}
    >
      <div style={{ height: '100%' }} />
      <ScrollToTopButton visible targetRef={boxRef} size={size} className={className} />
    </div>
  );
}

/**
 * Demo scroll container mirroring the real integration (StopGrid /
 * TransitDisplaysContainer): the button's `visible` is driven by
 * `useScrollOverflow().hasContentAbove` (fade in/out) and it shares the
 * container with both ScrollFadeEdge affordances.
 *
 * The container height is an inline style (not a Tailwind utility) so the
 * demo scrolls deterministically and `initialScrollTop` is applied against
 * an already-constrained container.
 */
function ScrollContainerDemo({
  size,
  className,
  itemCount,
  initialScrollTop,
}: {
  size?: ExtendedDisplaySize;
  className?: string;
  itemCount: number;
  initialScrollTop: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollOverflow = useScrollOverflow(contentRef, String(itemCount));

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = initialScrollTop;
    }
  }, [initialScrollTop]);

  return (
    <div
      ref={contentRef}
      onScroll={scrollOverflow.update}
      className="relative max-w-md overflow-y-auto rounded-lg border bg-white dark:bg-gray-900"
      style={{ height: '20rem' }}
    >
      {scrollOverflow.hasContentAbove && <ScrollFadeEdge position="top" />}
      <ul className="m-0 flex list-none flex-col gap-2 p-4">
        {Array.from({ length: itemCount }, (_, i) => (
          <li key={i} className="rounded-lg bg-[#f5f7fa] p-4 text-sm dark:bg-gray-800">
            {i % 2 === 0 ? baseStop.stop_name : longNameStop.stop_name} {i + 1}
          </li>
        ))}
      </ul>
      {scrollOverflow.hasContentBelow && <ScrollFadeEdge position="bottom" />}
      <ScrollToTopButton
        visible={scrollOverflow.hasContentAbove}
        targetRef={contentRef}
        size={size}
        className={className}
      />
    </div>
  );
}

const meta = {
  title: 'Button/ScrollToTopButton',
  component: ScrollToTopButton,
  args: {
    targetRef: { current: null },
    visible: true,
  },
  argTypes: {
    targetRef: { control: false },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    className: { control: 'text' },
  },
} satisfies Meta<typeof ScrollToTopButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Appearance ---

/** The button itself at its resting position, without list content. */
export const Appearance: Story = {
  render: (args) => <StaticButtonPreview size={args.size} className={args.className} />,
};

/** All display sizes side by side (xs = 32px ... xl = 64px, in 8px steps). */
export const AppearanceSizeComparison: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      <StaticButtonPreview size="xs" className={args.className} />
      <StaticButtonPreview size="sm" className={args.className} />
      <StaticButtonPreview size="md" className={args.className} />
      <StaticButtonPreview size="lg" className={args.className} />
      <StaticButtonPreview size="xl" className={args.className} />
    </div>
  ),
};

// --- Integrated demo ---

/** Scrolled away from the top: the button is visible and scrolls back on click. */
export const Demo: Story = {
  render: (args) => (
    <ScrollContainerDemo
      size={args.size}
      className={args.className}
      itemCount={12}
      initialScrollTop={300}
    />
  ),
};

/** At the top `visible` (= `hasContentAbove`) is false: the button is faded out and inert. */
export const DemoHiddenAtTop: Story = {
  render: (args) => (
    <ScrollContainerDemo className={args.className} itemCount={12} initialScrollTop={0} />
  ),
};

// --- Kitchen sink ---

/** Long list scrolled mid-way: both fade edges and the button visible together. */
export const DemoKitchenSink: Story = {
  render: (args) => (
    <ScrollContainerDemo className={args.className} itemCount={50} initialScrollTop={600} />
  ),
};
