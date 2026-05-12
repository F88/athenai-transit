import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import settings from '../../config/data-source-settings';
import { sortSourceGroupsForDisplay } from '../../domain/datasource/sort-source-groups';
import type { SourceLoadStatusEntry } from '../../domain/datasource/source-load-state';
import { useSourceLoadStatus } from '../../hooks/use-source-load-status';
import type { SourceGroup } from '../../types/app/source-group';
import { countriesFlagEmoji } from '../../utils/country-flag';
import { routeTypesEmoji } from '../../utils/route-type-emoji';

interface DataSourceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RowStatus = 'loaded' | 'failed' | 'notAttempted';

interface Row {
  /** Stable key for React reconciliation (`${groupId}::${prefix}`). */
  key: string;
  /** Display name for the group, resolved against the current UI language. */
  groupName: string;
  /** Concatenated route_type emoji (e.g. "🚌" or "🚊🚌"). */
  routeTypeEmoji: string;
  /** Concatenated country flag emoji (e.g. "🇯🇵"). */
  countryEmoji: string;
  status: RowStatus;
  /** Error message when {@link status} === `'failed'`. */
  errorMessage?: string;
}

function statusIcon(status: RowStatus): string {
  switch (status) {
    case 'loaded':
      return '✅';
    case 'failed':
      return '❌';
    case 'notAttempted':
      return '—';
  }
}

/**
 * Resolve the display name for a {@link SourceGroup} against the current UI
 * language.
 *
 * Single-step lookup: `names[lang]` first, then the canonical `name` (which
 * is typically the English label). **Lang chain fallback is intentionally
 * NOT implemented** for this dialog — a request for e.g. `'ja-Hrkt'` falls
 * straight through to `name` rather than walking the project's lang chain
 * (`resolveLangChain('ja-Hrkt', SUPPORTED_LANGS)` would yield
 * `['ja-Hrkt', 'ja', 'en']`).
 *
 * Rationale:
 * - Source group names are short labels (typically just `ja` + `en`), not
 *   user-facing prose where partial-language fallback matters.
 * - This dialog is a settings surface, not a hot path. Adding lang-chain
 *   handling here would couple it to `resolveLangChain` for marginal benefit.
 * - The fallback to `name` always yields a non-empty string, so there is no
 *   risk of empty UI.
 *
 * If `ja-Hrkt` or another non-base language ever becomes a primary UI
 * language for this dialog, revisit this and adopt {@code resolveLangChain}
 * — but do that as a deliberate decision, not implicitly.
 */
function resolveGroupName(group: SourceGroup, lang: string): string {
  return group.name.names?.[lang] ?? group.name.name;
}

function deriveRowStatus(entry: SourceLoadStatusEntry | undefined): RowStatus {
  if (!entry) {
    return 'notAttempted';
  }
  return entry.status === 'loaded' ? 'loaded' : 'failed';
}

function buildRows(
  groups: readonly SourceGroup[],
  loadStatusByPrefix: ReadonlyMap<string, SourceLoadStatusEntry>,
  lang: string,
): Row[] {
  return groups.flatMap((group) => {
    // Group-level metadata reused across each of the group's prefixes.
    const routeTypeEmoji = routeTypesEmoji(group.routeTypes);
    const countryEmoji = countriesFlagEmoji(group.countries);
    return group.prefixes.map((prefix): Row => {
      const entry = loadStatusByPrefix.get(prefix);
      const status = deriveRowStatus(entry);
      return {
        key: `${group.id}::${prefix}`,
        groupName: resolveGroupName(group, lang),
        routeTypeEmoji,
        countryEmoji,
        status,
        errorMessage: entry?.status === 'failed' ? entry.error.message : undefined,
      };
    });
  });
}

/**
 * Modal dialog listing every configured source group with its current
 * load status (loaded / failed / not attempted).
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

  // Sort by country, then by localized name. Status (loaded / failed /
  // not-attempted) is intentionally NOT part of the sort key so the order
  // stays stable when Phase N runtime toggling flips statuses.
  const sortedGroups = sortSourceGroupsForDisplay(settings, i18n.language);
  const rows = buildRows(sortedGroups, loadStatusByPrefix, i18n.language);

  const loaded = rows.filter((r) => r.status === 'loaded').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const notAttempted = rows.filter((r) => r.status === 'notAttempted').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[80dvh] w-[90dvw] max-w-2xl flex-col gap-0 overflow-hidden border-4 p-2"
      >
        <DialogHeader className="border-border shrink-0 border-b pb-3 sm:text-center">
          <DialogTitle className="text-base">{t('dataSourceSettings.title')}</DialogTitle>
          <DialogDescription className="text-center text-xs">
            {t('dataSourceSettings.summary', { loaded, failed, notAttempted })}
          </DialogDescription>
        </DialogHeader>
        <ul className="overflow-y-auto pt-3 text-sm">
          {rows.map((row) => (
            <li
              key={row.key}
              className="border-border/40 flex items-start gap-2 border-b px-2 py-2 last:border-b-0"
            >
              <span
                aria-label={t(`dataSourceSettings.status.${row.status}`)}
                className="w-5 shrink-0 text-center"
              >
                {statusIcon(row.status)}
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
                {row.errorMessage !== undefined && (
                  <div className="text-destructive mt-1 text-xs break-words">
                    {row.errorMessage}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
