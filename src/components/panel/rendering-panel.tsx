import type { InfoLevel, PerfMode, RenderMode, Theme } from '../../types/app/settings';
import { useTranslation } from 'react-i18next';
import { ControlPanel } from '../shared/control-panel';
import { MapToggleButton } from '../button/map-toggle-button';

/** Icon label for each render mode toggle button. */
function renderModeIcon(mode: RenderMode): string {
  switch (mode) {
    case 'auto':
      return '🥷';
    case 'standard':
      return '🐢';
    case 'lightweight':
      return '🐇';
  }
}

/** Icon label for each info level toggle button. */
function infoLevelIcon(level: InfoLevel): string {
  switch (level) {
    case 'simple':
      return '🍃';
    case 'normal':
      return '🌿';
    case 'detailed':
      return '🌳';
    case 'verbose':
      return '🐛';
  }
}

/** Icon label for each perf mode toggle button. */
function perfModeIcon(mode: PerfMode): string {
  switch (mode) {
    case 'lite':
      return '\u{1F340}';
    case 'normal':
      return '\u2696\uFE0F';
    case 'full':
      return '\u{1F525}';
  }
}

import { SUPPORTED_LANGS } from '../../config/supported-langs';

/** Short label for the language toggle button. */
function langShortLabel(lang: string): string {
  return SUPPORTED_LANGS.find((l) => l.code === lang)?.shortLabel ?? lang.toUpperCase();
}

interface RenderingPanelProps {
  renderMode: RenderMode;
  perfMode: PerfMode;
  infoLevel: InfoLevel;
  theme: Theme;
  lang: string;
  onToggleRenderMode: () => void;
  onTogglePerfMode: () => void;
  onCycleInfoLevel: () => void;
  onToggleDarkMode: () => void;
  onCycleLang: () => void;
}

/**
 * Rendering control panel placed at the top-right of the map.
 * Controls render mode, performance mode, info level, and theme.
 *
 * @param renderMode - Current render mode.
 * @param perfMode - Current performance mode.
 * @param infoLevel - Current info level.
 * @param theme - Current theme for dark mode icon display.
 * @param onToggleRenderMode - Callback to toggle render mode.
 * @param onTogglePerfMode - Callback to toggle performance mode.
 * @param onCycleInfoLevel - Callback to cycle info level.
 * @param onToggleDarkMode - Callback to toggle dark mode.
 */
export function RenderingPanel({
  renderMode,
  perfMode,
  infoLevel,
  theme,
  lang,
  onToggleRenderMode,
  onTogglePerfMode,
  onCycleInfoLevel,
  onToggleDarkMode,
  onCycleLang,
}: RenderingPanelProps) {
  const { t } = useTranslation();
  return (
    <ControlPanel side="right" edge="top" offset="0.75rem" infoLevel={infoLevel}>
      <MapToggleButton active onClick={onToggleRenderMode} label={t('panel.toggleRenderMode')}>
        {renderModeIcon(renderMode)}
      </MapToggleButton>
      <MapToggleButton active onClick={onTogglePerfMode} label={t('panel.togglePerfMode')}>
        {perfModeIcon(perfMode)}
      </MapToggleButton>
      <MapToggleButton active onClick={onCycleInfoLevel} label={t('panel.toggleInfoLevel')}>
        {infoLevelIcon(infoLevel)}
      </MapToggleButton>
      <MapToggleButton active onClick={onToggleDarkMode} label={t('panel.toggleDarkMode')}>
        {theme === 'dark' ? '🌙' : '☀️'}
      </MapToggleButton>
      <MapToggleButton active onClick={onCycleLang} label={t('panel.toggleLang')}>
        {langShortLabel(lang)}
      </MapToggleButton>
    </ControlPanel>
  );
}
