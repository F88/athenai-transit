import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapViewContainer } from '../map-view-container';
import { MapSlotProvider } from '../../../contexts/map-slot-provider';
import { useSetMapSlotElement } from '../../../hooks/use-map-slot';

// jsdom lacks ResizeObserver; provide a minimal mock so the slot
// tracking hook can install / tear down without errors.
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed = new Set<Element>();

  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    MockResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
}

const originalResizeObserver = globalThis.ResizeObserver;

beforeEach(() => {
  MockResizeObserver.instances = [];
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

/**
 * Test helper: a layout-like component that registers a slot div with
 * a stubbed `getBoundingClientRect` so the container can observe it.
 */
function FakeLayoutWithSlot({
  rect,
  className = 'absolute inset-x-0 top-0 h-[60dvh]',
}: {
  rect: { top: number; left: number; width: number; height: number };
  className?: string;
}) {
  const setSlot = useSetMapSlotElement();
  return (
    <div
      data-testid="slot"
      className={className}
      ref={(el) => {
        if (el) {
          vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
            x: rect.left,
            y: rect.top,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            right: rect.left + rect.width,
            bottom: rect.top + rect.height,
            toJSON() {
              return { ...this };
            },
          });
        }
        setSlot(el);
      }}
    />
  );
}

describe('MapViewContainer', () => {
  it('renders its children inside the layer wrapper', () => {
    render(
      <MapSlotProvider>
        <MapViewContainer>
          <div data-testid="map-content">map</div>
        </MapViewContainer>
      </MapSlotProvider>,
    );

    expect(screen.getByTestId('map-content')).toBeInTheDocument();
  });

  it('falls back to inset-0 when no slot has been registered', () => {
    const { container } = render(
      <MapSlotProvider>
        <MapViewContainer>
          <div data-testid="map-content">map</div>
        </MapViewContainer>
      </MapSlotProvider>,
    );

    // No slot registered → wrapper uses inset-0 fallback (still mounts MapView).
    const wrapper = container.querySelector('[data-testid="map-content"]')?.parentElement;
    expect(wrapper?.className).toContain('absolute');
    expect(wrapper?.className).toContain('inset-0');
  });

  it('positions the wrapper to match the registered slot rect', () => {
    const { container } = render(
      <MapSlotProvider>
        <FakeLayoutWithSlot rect={{ top: 12, left: 34, width: 600, height: 400 }} />
        <MapViewContainer>
          <div data-testid="map-content">map</div>
        </MapViewContainer>
      </MapSlotProvider>,
    );

    const wrapper = container.querySelector('[data-testid="map-content"]')?.parentElement;
    expect(wrapper?.style.top).toBe('12px');
    expect(wrapper?.style.left).toBe('34px');
    expect(wrapper?.style.width).toBe('600px');
    expect(wrapper?.style.height).toBe('400px');
  });

  it('does not set a `z-index` on the wrapper (must not create a stacking context)', () => {
    // Guards DEVELOPMENT.md "App shell wrapper" rule: a z-index here
    // would trap descendant z-1000+ chrome (TimeControls,
    // MapOverlayPanels) inside a local stacking context.
    const { container } = render(
      <MapSlotProvider>
        <MapViewContainer>
          <div data-testid="map-content">map</div>
        </MapViewContainer>
      </MapSlotProvider>,
    );

    const wrapper = container.querySelector('[data-testid="map-content"]')?.parentElement;
    const className = wrapper?.getAttribute('class') ?? '';
    expect(className.split(/\s+/)).not.toContain(expect.stringMatching(/^z-/));
    expect(wrapper?.style.zIndex).toBe('');
  });
});
