import { describe, expect, it } from 'vitest';
import { resolveMultiPaneOrientation } from '../multi-pane';

describe('resolveMultiPaneOrientation', () => {
  it('returns horizontal for landscape viewports', () => {
    expect(resolveMultiPaneOrientation(1366, 1024)).toBe('horizontal');
  });

  it('returns horizontal for a square viewport', () => {
    expect(resolveMultiPaneOrientation(1024, 1024)).toBe('horizontal');
  });

  it('returns vertical for portrait viewports', () => {
    expect(resolveMultiPaneOrientation(900, 1400)).toBe('vertical');
  });

  it('treats the iPad Pro 12.9" portrait (1024x1366) as vertical', () => {
    expect(resolveMultiPaneOrientation(1024, 1366)).toBe('vertical');
  });

  it('treats the Nest Hub (1024x600) as horizontal', () => {
    expect(resolveMultiPaneOrientation(1024, 600)).toBe('horizontal');
  });
});
