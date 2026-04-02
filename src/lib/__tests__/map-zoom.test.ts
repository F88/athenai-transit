import { describe, expect, it, vi } from 'vitest';
import type L from 'leaflet';
import { setZoomLevel, changeZoom } from '../map-zoom';

function createMockMap(zoom: number, minZoom: number, maxZoom: number) {
  return {
    getZoom: () => zoom,
    getMinZoom: () => minZoom,
    getMaxZoom: () => maxZoom,
    setZoom: vi.fn(),
  } as unknown as L.Map & { setZoom: ReturnType<typeof vi.fn> };
}

describe('setZoomLevel', () => {
  it('should set zoom when target differs from current', () => {
    const map = createMockMap(14, 1, 18);
    setZoomLevel(map, 16);

    expect(map.setZoom).toHaveBeenCalledWith(16, { animate: true });
  });

  it('should not call setZoom when target equals current', () => {
    const map = createMockMap(14, 1, 18);
    setZoomLevel(map, 14);

    expect(map.setZoom).not.toHaveBeenCalled();
  });

  it('should clamp zoom to max', () => {
    const map = createMockMap(14, 1, 18);
    setZoomLevel(map, 20);

    expect(map.setZoom).toHaveBeenCalledWith(18, { animate: true });
  });

  it('should clamp zoom to min', () => {
    const map = createMockMap(14, 5, 18);
    setZoomLevel(map, 2);

    expect(map.setZoom).toHaveBeenCalledWith(5, { animate: true });
  });

  it('should not call setZoom when clamped value equals current', () => {
    const map = createMockMap(18, 1, 18);
    setZoomLevel(map, 20);

    expect(map.setZoom).not.toHaveBeenCalled();
  });
});

describe('changeZoom', () => {
  it('should zoom in by 1', () => {
    const map = createMockMap(14, 1, 18);
    changeZoom(map, 1);

    expect(map.setZoom).toHaveBeenCalledWith(15, { animate: true });
  });

  it('should zoom out by 1', () => {
    const map = createMockMap(14, 1, 18);
    changeZoom(map, -1);

    expect(map.setZoom).toHaveBeenCalledWith(13, { animate: true });
  });

  it('should not zoom in beyond max', () => {
    const map = createMockMap(18, 1, 18);
    changeZoom(map, 1);

    expect(map.setZoom).not.toHaveBeenCalled();
  });

  it('should not zoom out beyond min', () => {
    const map = createMockMap(1, 1, 18);
    changeZoom(map, -1);

    expect(map.setZoom).not.toHaveBeenCalled();
  });
});
