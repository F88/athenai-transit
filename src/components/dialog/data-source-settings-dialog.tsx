import { useTranslation } from 'react-i18next';
import { InfoIcon, WrenchIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import settings from '../../config/data-source-settings';
import {
  aggregateGroupLoadStatus,
  type GroupLoadStatus,
} from '../../domain/datasource/aggregate-group-status';
import { computeDialogDisplay } from '../../domain/datasource/dialog-display';
import { getSourceGroupDisplayName } from '../../domain/datasource/get-source-group-display-name';
import { sortSourceGroupsForDisplay } from '../../domain/datasource/sort-source-groups';
import { useIsForcedSourcesMode } from '../../hooks/use-is-forced-sources-mode';
import { useSourceLoadStatus } from '../../hooks/use-source-load-status';
import { useUserDataSourceSettings } from '../../hooks/use-user-data-source-settings';
import type { SourceGroup } from '../../types/app/source-group';
import { countriesFlagEmoji } from '../../utils/country-flag';
import { routeTypeEmoji, routeTypesEmoji } from '../../utils/route-type-emoji';
import {
  ROUTE_TYPE_OTHER,
  ROUTE_TYPE_PRIORITY,
  type RouteTypeSectionKey,
} from '../../domain/datasource/route-type-priority';

type NoticeVariant = 'forced' | 'development';

interface DataSourceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GroupRow {
  /** Stable key for React reconciliation within a section. */
  key: string;
  /** Group id, used to look up the Switch state in `enabledGroupIds`. */
  groupId: string;
  /** Display name for the group, resolved against the current UI language. */
  groupName: string;
  /** Concatenated route_type emoji for the *group's whole* coverage. */
  routeTypeEmoji: string;
  /** Concatenated country flag emoji (e.g. "🇯🇵"). */
  countryEmoji: string;
  /** Aggregated load status (4-state). */
  loadStatus: GroupLoadStatus;
}

interface Section {
  /** Section key: a route_type value or `'other'`. */
  key: RouteTypeSectionKey;
  /** Translated header label (e.g. "バス" / "Bus" / "その他"). */
  label: string;
  /** Section header emoji. */
  emoji: string;
  /** Group rows belonging to this section. */
  rows: GroupRow[];
}

function buildGroupRow(
  group: SourceGroup,
  loadStatusByPrefix: ReturnType<typeof useSourceLoadStatus>,
  lang: string,
): GroupRow {
  return {
    key: group.id,
    groupId: group.id,
    groupName: getSourceGroupDisplayName(group, lang),
    routeTypeEmoji: routeTypesEmoji(group.routeTypes),
    countryEmoji: countriesFlagEmoji(group.countries),
    loadStatus: aggregateGroupLoadStatus(group.prefixes, loadStatusByPrefix),
  };
}

function sectionLabelKey(key: RouteTypeSectionKey): string {
  return `dataSourceSettings.section.${String(key)}`;
}

function sectionEmoji(key: RouteTypeSectionKey): string {
  // 'other' has no GTFS route_type, so fall back to the unknown emoji 🛸
  // (the same emoji routeTypeEmoji uses for unknown route types).
  if (key === ROUTE_TYPE_OTHER) {
    return '🛸';
  }
  return routeTypeEmoji(key);
}

function statusIcon(status: GroupLoadStatus['status']): string {
  switch (status) {
    case 'loaded':
      return '✅';
    case 'failed':
      return '❌';
    case 'partial':
      return '⚠️';
    case 'notAttempted':
      return '—';
  }
}

/**
 * Build the rendered sections.
 *
 * Each route_type in {@link ROUTE_TYPE_PRIORITY} becomes one section. A
 * group is listed in *every* section whose key is contained in its
 * `routeTypes` — so a multi-routeType group like `toko` (`[0, 1, 2, 3]`)
 * appears in four sections. The aggregated load status is identical across
 * all of a group's sections because it is derived from `prefixes`, not
 * from the section's route_type.
 *
 * Groups with no route_type matched by {@link ROUTE_TYPE_PRIORITY} are
 * collected into the `'other'` section so they remain visible.
 *
 * Empty sections are dropped before render.
 */
function buildSections(
  groups: readonly SourceGroup[],
  loadStatusByPrefix: ReturnType<typeof useSourceLoadStatus>,
  lang: string,
  t: (key: string) => string,
): Section[] {
  const sorted = sortSourceGroupsForDisplay(groups, lang);
  const sections: Section[] = [];

  for (const rt of ROUTE_TYPE_PRIORITY) {
    const matched = sorted.filter((g) => g.routeTypes.includes(rt));
    if (matched.length === 0) {
      continue;
    }
    sections.push({
      key: rt,
      label: t(sectionLabelKey(rt)),
      emoji: sectionEmoji(rt),
      rows: matched.map((g) => buildGroupRow(g, loadStatusByPrefix, lang)),
    });
  }

  const otherGroups = sorted.filter(
    (g) => !g.routeTypes.some((rt) => ROUTE_TYPE_PRIORITY.includes(rt)),
  );
  if (otherGroups.length > 0) {
    sections.push({
      key: ROUTE_TYPE_OTHER,
      label: t(sectionLabelKey(ROUTE_TYPE_OTHER)),
      emoji: sectionEmoji(ROUTE_TYPE_OTHER),
      rows: otherGroups.map((g) => buildGroupRow(g, loadStatusByPrefix, lang)),
    });
  }

  return sections;
}

interface DistinctGroupCounts {
  loaded: number;
  partial: number;
  failed: number;
  notAttempted: number;
}

/**
 * Count each group's aggregated status exactly once, regardless of how many
 * sections that group appears in. The header summary should reflect the
 * number of distinct configured groups, not their multiplied appearances.
 */
function countDistinctGroupStatuses(
  groups: readonly SourceGroup[],
  loadStatusByPrefix: ReturnType<typeof useSourceLoadStatus>,
): DistinctGroupCounts {
  const counts: DistinctGroupCounts = {
    loaded: 0,
    partial: 0,
    failed: 0,
    notAttempted: 0,
  };
  for (const group of groups) {
    const status = aggregateGroupLoadStatus(group.prefixes, loadStatusByPrefix);
    counts[status.status]++;
  }
  return counts;
}

function PartialFraction({ row }: { row: GroupRow }) {
  const { t } = useTranslation();
  if (row.loadStatus.status !== 'partial') {
    return null;
  }
  const loaded = row.loadStatus.loadedPrefixes.length;
  const total =
    loaded + row.loadStatus.failedPrefixes.length + row.loadStatus.notAttemptedPrefixes.length;
  return (
    <div className="text-muted-foreground mt-1 text-xs">
      {t('dataSourceSettings.partial.fraction', { loaded, total })}
    </div>
  );
}

function FailureList({ row }: { row: GroupRow }) {
  // Shown for both pure `failed` (no loaded) and `partial` (some loaded +
  // some failed), since the error messages are equally useful in either
  // case.
  if (row.loadStatus.status !== 'failed' && row.loadStatus.status !== 'partial') {
    return null;
  }
  if (row.loadStatus.failedPrefixes.length === 0) {
    return null;
  }
  return (
    <ul className="text-destructive mt-1 space-y-0.5 text-xs">
      {row.loadStatus.failedPrefixes.map((f) => (
        <li key={f.prefix} className="wrap-break-word">
          <span className="font-mono">{f.prefix}</span>: {f.error.message}
        </li>
      ))}
    </ul>
  );
}

function DialogNotice({ variant }: { variant: NoticeVariant }) {
  const { t } = useTranslation();

  if (variant === 'forced') {
    return (
      <Alert
        role="status"
        className="mt-3 border-sky-300 bg-sky-50 px-3 py-2 text-left shadow-sm dark:border-sky-800 dark:bg-sky-950/40"
      >
        <InfoIcon
          aria-hidden="true"
          focusable="false"
          className="mt-0.5 text-sky-700 dark:text-sky-300"
        />
        <AlertTitle className="text-xs font-semibold text-sky-900 dark:text-sky-200">
          {t('dataSourceSettings.forcedMode.title')}
        </AlertTitle>
        <AlertDescription className="text-[11px] text-sky-800 dark:text-sky-300">
          {t('dataSourceSettings.forcedMode.description')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert
      role="status"
      className="mt-3 border-amber-300 bg-amber-50 px-3 py-2 text-left shadow-sm dark:border-amber-800 dark:bg-amber-950/40"
    >
      <WrenchIcon
        aria-hidden="true"
        focusable="false"
        className="mt-0.5 text-amber-700 dark:text-amber-300"
      />
      <AlertTitle className="text-xs font-semibold text-amber-900 dark:text-amber-200">
        {t('dataSourceSettings.developmentNotice.title')}
      </AlertTitle>
      <AlertDescription className="text-[11px] text-amber-800 dark:text-amber-300">
        {t('dataSourceSettings.developmentNotice.description')}
      </AlertDescription>
    </Alert>
  );
}

function GroupRowView({
  row,
  checked,
  disabled,
  onCheckedChange,
}: {
  row: GroupRow;
  /** Switch checked state (caller resolves forced-mode override). */
  checked: boolean;
  /** Whether the Switch is non-interactive. */
  disabled: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="border-border/40 flex items-start gap-2 border-b px-2 py-2 last:border-b-0">
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={t('dataSourceSettings.toggle.aria', {
          group: row.groupName,
        })}
        className="shrink-0"
      />
      <span
        aria-label={t(`dataSourceSettings.status.${row.loadStatus.status}`)}
        className="w-5 shrink-0 text-center"
      >
        {statusIcon(row.loadStatus.status)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-foreground flex flex-wrap items-baseline gap-2 font-medium">
          <span>{row.groupName}</span>
          {row.routeTypeEmoji !== '' && (
            <span aria-hidden className="text-sm">
              {row.routeTypeEmoji}
            </span>
          )}
          {row.countryEmoji !== '' && (
            <span aria-hidden className="text-sm">
              {row.countryEmoji}
            </span>
          )}
        </div>
        <PartialFraction row={row} />
        <FailureList row={row} />
      </div>
    </li>
  );
}

/**
 * Modal dialog listing every configured source group with its current load
 * status.
 *
 * Layout: one section per GTFS route_type (in {@link ROUTE_TYPE_PRIORITY}
 * order). A group is listed in every section whose route_type it covers,
 * so multi-routeType groups (e.g. a future `toko` bundling `minkuru` and
 * `toaran` across `[0, 1, 2, 3]`) appear in four sections at once. The
 * aggregated status is the same in every section because it is derived
 * from `prefixes`, not from the section's route_type.
 *
 * Groups where `SourceGroup.systemEnabledByDefault === false` are
 * app-level intentional disables and are hidden from the user — except
 * when their data has actually been loaded via the `?sources=all` debug
 * override. The effective visibility rule is therefore:
 *
 *     systemEnabledByDefault === true  ∪  any prefix is in the load-status map
 *
 * so `?sources=all` (which loads every group including the disabled
 * ones) reveals those groups in the dialog, while default and
 * normal-URL flows continue to hide them.
 *
 * Named with "Settings" in anticipation of Phase N, when users will be
 * able to toggle individual sources on/off here.
 *
 * @param open - Whether the dialog is open.
 * @param onOpenChange - Called when the open state changes.
 */
export function DataSourceSettingsDialog({ open, onOpenChange }: DataSourceSettingsDialogProps) {
  const { t, i18n } = useTranslation();
  const loadStatusByPrefix = useSourceLoadStatus();
  const isForcedSourcesMode = useIsForcedSourcesMode();
  const { enabledGroupIds, setGroupEnabled, setGroupsEnabled, resetToDefaults } =
    useUserDataSourceSettings();

  // Normalize the two operating modes (forced / normal) into one shape
  // so the body below never branches on `isForcedSourcesMode`. The
  // pure-function call returns the visible groups + the Set used for
  // both per-row Switch state and per-section enabled counts.
  const { visibleGroups, effectiveEnabledIds } = computeDialogDisplay(
    settings,
    loadStatusByPrefix,
    isForcedSourcesMode,
    enabledGroupIds,
  );

  const sections = buildSections(visibleGroups, loadStatusByPrefix, i18n.language, t);
  const counts = countDistinctGroupStatuses(visibleGroups, loadStatusByPrefix);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[80dvh] w-[90dvw] max-w-2xl flex-col gap-0 overflow-hidden border-4 p-2"
      >
        <DialogHeader className="border-border shrink-0 border-b pb-3 sm:text-center">
          <DialogTitle className="text-base">{t('dataSourceSettings.title')}</DialogTitle>
          <DialogDescription className="text-center text-xs">
            {t('dataSourceSettings.description')}
          </DialogDescription>

          <div className="text-center text-xs">
            {t('dataSourceSettings.summary', {
              loaded: counts.loaded,
              partial: counts.partial,
              failed: counts.failed,
              notAttempted: counts.notAttempted,
            })}
          </div>
          {/*
            Per-section enabled count, driven from the same
            `effectiveEnabledIds` Set as each row's Switch. A
            multi-routeType group is counted once per section it
            appears in, so the sum across sections can exceed the
            distinct-group total in the summary line above.
          */}
          <div className="text-muted-foreground text-center text-xs">
            {sections.map((section) => {
              const enabledCount = section.rows.filter((row) =>
                effectiveEnabledIds.has(row.groupId),
              ).length;
              return (
                <span key={String(section.key)}>
                  <span aria-hidden className="mx-1">
                    {section.emoji}: {enabledCount}
                  </span>
                </span>
              );
            })}
          </div>
        </DialogHeader>
        <DialogNotice variant={isForcedSourcesMode ? 'forced' : 'development'} />
        <div className="overflow-y-auto pt-3 text-sm">
          {sections.map((section) => {
            const sectionGroupIds = section.rows.map((row) => row.groupId);
            const sectionEnabledCount = section.rows.filter((row) =>
              effectiveEnabledIds.has(row.groupId),
            ).length;
            return (
              <section key={String(section.key)} className="mb-4 last:mb-0">
                <h3 className="text-muted-foreground bg-muted/40 sticky top-0 z-10 flex items-center gap-2 px-2 py-1 text-xs font-semibold">
                  <span aria-hidden>{section.emoji}</span>
                  <span>{section.label}</span>
                  <span className="opacity-60">
                    ({sectionEnabledCount}/{section.rows.length})
                  </span>
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setGroupsEnabled(sectionGroupIds, true);
                      }}
                      disabled={isForcedSourcesMode}
                      aria-label={t('dataSourceSettings.bulkAction.enableAll.aria', {
                        section: section.label,
                      })}
                      className="h-6 cursor-pointer px-2 text-[11px]"
                    >
                      {t('dataSourceSettings.bulkAction.enableAll.label')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setGroupsEnabled(sectionGroupIds, false);
                      }}
                      disabled={isForcedSourcesMode}
                      aria-label={t('dataSourceSettings.bulkAction.disableAll.aria', {
                        section: section.label,
                      })}
                      className="h-6 cursor-pointer px-2 text-[11px]"
                    >
                      {t('dataSourceSettings.bulkAction.disableAll.label')}
                    </Button>
                  </div>
                </h3>
                <ul>
                  {section.rows.map((row) => (
                    <GroupRowView
                      key={`${String(section.key)}::${row.key}`}
                      row={row}
                      checked={effectiveEnabledIds.has(row.groupId)}
                      disabled={isForcedSourcesMode}
                      onCheckedChange={(next) => {
                        setGroupEnabled(row.groupId, next);
                      }}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t pt-3 sm:justify-end">
          <Button
            variant="destructive"
            size="sm"
            onClick={resetToDefaults}
            disabled={isForcedSourcesMode}
            className="cursor-pointer"
          >
            {t('dataSourceSettings.resetToDefaults')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              window.location.reload();
            }}
            disabled={isForcedSourcesMode}
            aria-label={t('dataSourceSettings.restart.aria')}
            className="cursor-pointer"
          >
            {t('dataSourceSettings.restart.label')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
