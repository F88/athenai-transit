import type L from 'leaflet';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserLocation } from '../../types/app/map';
import type { InfoLevel } from '../../types/app/settings';
import { useMapNavigationActions } from '../../hooks/use-map-navigation-actions';
import { MapMultiStateButton } from '../button/map-multi-state-button';
import { MapToggleButton } from '../button/map-toggle-button';
import { ControlPanel } from '../shared/control-panel';

interface MapNavigationPanelProps {
  map: L.Map;
  infoLevel: InfoLevel;
  /** Whether continuous current-location tracking is currently enabled. */
  autoLocateEnabled: boolean;
  /** Setter for the auto-locate flag. */
  onAutoLocateChange: (enabled: boolean) => void;
  /** Counter that bumps on every successful geolocation fix; replays
   *  a ripple animation on the locate button to acknowledge the event. */
  locatePulseKey: number;
  onLocated: (location: UserLocation) => void;
  onDeselectStop: () => void;
}

/**
 * Navigation panel placed at the bottom-right of the map.
 * Provides buttons to locate the user's current position and jump to a random place.
 *
 * The locate button has three visual/behavioral states:
 * - Idle (auto-tracking off, not loading): tap to fetch the current
 *   position. If the map center is far from the resolved location the
 *   map pans to it; if the center is already near, auto-tracking turns on.
 * - Loading: the geolocation request is in flight (button dimmed).
 * - Auto-tracking on: the button background is highlighted; tapping
 *   turns auto-tracking off without firing a fetch.
 *
 * @param map - Leaflet map instance.
 * @param infoLevel - Current info level for ControlPanel border display.
 * @param autoLocateEnabled - Whether continuous tracking is on.
 * @param onAutoLocateChange - Setter for the auto-locate flag.
 * @param onLocated - Callback fired with the user's geolocation result.
 * @param onDeselectStop - Callback fired before jumping to a random place.
 */
export function MapNavigationPanel({
  map,
  infoLevel,
  autoLocateEnabled,
  onAutoLocateChange,
  locatePulseKey,
  onLocated,
  onDeselectStop,
}: MapNavigationPanelProps) {
  const { t } = useTranslation();
  // When the user fires a manual locate and they happen to already be
  // near the map center, treat it as a request to enable auto tracking
  // (replaces the previous "zoom in" behavior).
  const handleNearMapCenter = useCallback(() => {
    onAutoLocateChange(true);
  }, [onAutoLocateChange]);
  const { locating, handleLocate, handleRandomJump } = useMapNavigationActions(
    map,
    onLocated,
    onDeselectStop,
    { onNearMapCenter: handleNearMapCenter },
  );

  const handleLocateClick = useCallback(() => {
    if (autoLocateEnabled) {
      // Tracking is on: tap toggles it off without re-fetching.
      onAutoLocateChange(false);
      return;
    }
    handleLocate();
  }, [autoLocateEnabled, handleLocate, onAutoLocateChange]);

  // Random jump intentionally moves the map far from the user's
  // current location, so we turn off auto-tracking first. Otherwise
  // `handleBoundsChanged` would skip the post-jump fetch and stops
  // would not appear at the new location.
  const handleRandomJumpClick = useCallback(() => {
    onAutoLocateChange(false);
    handleRandomJump();
  }, [handleRandomJump, onAutoLocateChange]);

  return (
    <ControlPanel side="right" edge="bottom" offset="2rem" infoLevel={infoLevel}>
      {/* Current location button */}
      <MapMultiStateButton
        active={!locating}
        highlighted={autoLocateEnabled}
        disabled={locating}
        pulseKey={locatePulseKey}
        onClick={handleLocateClick}
        label={autoLocateEnabled ? t('panel.stopAutoLocate') : t('panel.currentLocation')}
      >
        {locating ? '.' : '🎯'}
      </MapMultiStateButton>
      {/* Random location button */}
      <MapToggleButton active onClick={handleRandomJumpClick} label={t('panel.randomLocation')}>
        🎲
      </MapToggleButton>
    </ControlPanel>
  );
}
