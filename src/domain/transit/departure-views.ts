import type { DepartureViewMeta } from '../../types/app/transit-composed';

/**
 * All departure view pattern definitions (T1-T7).
 *
 * Each entry describes a grouping/sorting strategy for the BottomSheet.
 * Views with `enabled: false` are shown greyed out; `visible: false` are hidden.
 */
export const DEPARTURE_VIEWS: readonly DepartureViewMeta[] = [
  {
    id: 'stop',
    icon: '🕐',
    label: 'ALL',
    title: 'すべて',
    description: '全ての時間を表示します',
    enabled: true,
    visible: true,
  },
  {
    id: 'route-headsign',
    icon: '🚌',
    label: '路線+行先',
    title: '路線+行先別',
    description: '路線と行先の組み合わせでグループ化して表示します',
    enabled: true,
    visible: true,
  },
  {
    id: 'route',
    icon: '🚏',
    label: '路線',
    title: '路線別',
    description: '路線ごとにグループ化して表示します',
    enabled: false,
    visible: true,
  },
  {
    id: 'headsign',
    icon: '🧭',
    label: '行先',
    title: '行先別',
    description: '行先ごとにグループ化して表示します',
    enabled: false,
    visible: true,
  },

  {
    id: 'frequency',
    icon: '📊',
    label: '頻度',
    title: '運行頻度順',
    description: '運行頻度で重み付けして表示します',
    enabled: false,
    visible: true,
  },
  {
    id: 'duration',
    icon: '⏱',
    label: '乗車時間',
    title: '乗車時間',
    description: '終点までの乗車時間順で表示します',
    enabled: false,
    visible: true,
  },
  {
    id: 'terminal',
    icon: '🏙',
    label: '終点の賑わい',
    title: '終点の賑わい度順',
    description: '終点の賑わい度で表示します',
    enabled: false,
    visible: true,
  },
] as const;

/** Default view ID used on initial load. */
export const DEFAULT_VIEW_ID = 'stop';
