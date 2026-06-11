import { useEffect, useRef } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { useScrollFades } from '../../hooks/use-scroll-fades';
import { baseStop, longNameStop } from '../../stories/fixtures';
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
function StaticButtonPreview({ className }: { className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={boxRef}
      className="relative overflow-y-auto rounded-lg border bg-white dark:bg-gray-900"
      style={{ height: '6rem', width: '12rem' }}
    >
      <div style={{ height: '100%' }} />
      <ScrollToTopButton targetRef={boxRef} className={className} />
    </div>
  );
}

/**
 * Demo scroll container mirroring the real integration (StopGrid /
 * TransitDisplaysContainer): the button is gated on `useScrollFades().showTop`
 * and shares the container with both ScrollFadeEdge affordances.
 *
 * The container height is an inline style (not a Tailwind utility) so the
 * demo scrolls deterministically and `initialScrollTop` is applied against
 * an already-constrained container.
 */
function ScrollContainerDemo({
  className,
  itemCount,
  initialScrollTop,
}: {
  className?: string;
  itemCount: number;
  initialScrollTop: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollFade = useScrollFades(contentRef, String(itemCount));

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = initialScrollTop;
    }
  }, [initialScrollTop]);

  return (
    <div
      ref={contentRef}
      onScroll={scrollFade.handleScroll}
      className="relative max-w-md overflow-y-auto rounded-lg border bg-white dark:bg-gray-900"
      style={{ height: '20rem' }}
    >
      {scrollFade.showTop && <ScrollFadeEdge position="top" />}
      <ul className="m-0 flex list-none flex-col gap-2 p-4">
        {Array.from({ length: itemCount }, (_, i) => (
          <li key={i} className="rounded-lg bg-[#f5f7fa] p-4 text-sm dark:bg-gray-800">
            {i % 2 === 0 ? baseStop.stop_name : longNameStop.stop_name} {i + 1}
          </li>
        ))}
      </ul>
      {scrollFade.showBottom && <ScrollFadeEdge position="bottom" />}
      {scrollFade.showTop && <ScrollToTopButton targetRef={contentRef} className={className} />}
    </div>
  );
}

const meta = {
  title: 'Button/ScrollToTopButton',
  component: ScrollToTopButton,
  args: {
    targetRef: { current: null },
  },
  argTypes: {
    targetRef: { control: false },
    className: { control: 'text' },
  },
} satisfies Meta<typeof ScrollToTopButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Appearance ---

/** The button itself at its resting position, without list content. */
export const Appearance: Story = {
  render: (args) => <StaticButtonPreview className={args.className} />,
};

// --- Integrated demo ---

/** Scrolled away from the top: the button is visible and scrolls back on click. */
export const Demo: Story = {
  render: (args) => (
    <ScrollContainerDemo className={args.className} itemCount={12} initialScrollTop={300} />
  ),
};

/** At the top the gate (`showTop`) is false, so the button is not rendered. */
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
