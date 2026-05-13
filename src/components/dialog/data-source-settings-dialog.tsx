import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import settings from '../../config/data-source-settings';
import {
  aggregateGroupLoadStatus,
  type GroupLoadStatus,
} from '../../domain/datasource/aggregate-group-status';
import { getSourceGroupDisplayName } from '../../domain/datasource/get-source-group-display-name';
import { sortSourceGroupsForDisplay } from '../../domain/datasource/sort-source-groups';
import { useSourceLoadStatus } from '../../hooks/use-source-load-status';
import type { SourceGroup } from '../../types/app/source-group';
import { countriesFlagEmoji } from '../../utils/country-flag';
import { routeTypeEmoji, routeTypesEmoji } from '../../utils/route-type-emoji';
import {
  ROUTE_TYPE_OTHER,
  ROUTE_TYPE_PRIORITY,
  type RouteTypeSectionKey,
} from '../../domain/datasource/route-type-priority';

interface DataSourceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GroupRow {
  /** Stable key for React reconciliation within a section. */
  key: string;
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

function GroupRowView({ row, t }: { row: GroupRow; t: (key: string) => string }) {
  return (
    <li className="border-border/40 flex items-start gap-2 border-b px-2 py-2 last:border-b-0">
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

  // Visibility: app-enabled groups are always shown. App-disabled groups
  // (`systemEnabledByDefault: false`) are hidden by default, but reappear
  // here when their data has actually been loaded — currently only
  // reachable via `?sources=all`, the debug override that bypasses the
  // systemEnabledByDefault flag. This keeps the dialog honest: if the
  // data is in the repository, the user can see that fact; otherwise the
  // disabled group stays invisible.
  const visibleGroups = settings.filter(
    (g) => g.systemEnabledByDefault || g.prefixes.some((prefix) => loadStatusByPrefix.has(prefix)),
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
        </DialogHeader>
        <div className="overflow-y-auto pt-3 text-sm">
          {sections.map((section) => (
            <section key={String(section.key)} className="mb-4 last:mb-0">
              <h3 className="text-muted-foreground bg-muted/40 sticky top-0 z-10 flex items-baseline gap-2 px-2 py-1 text-xs font-semibold">
                <span aria-hidden>{section.emoji}</span>
                <span>{section.label}</span>
                <span className="opacity-60">({section.rows.length})</span>
              </h3>
              <ul>
                {section.rows.map((row) => (
                  <GroupRowView key={`${String(section.key)}::${row.key}`} row={row} t={t} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
