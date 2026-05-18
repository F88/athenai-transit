import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';
import { type GroupLoadStatus } from '../../domain/datasource/aggregate-group-status';
import type { DataSourceGroupInfo } from '../../types/app/data-source-group-info';
import { DataSourceGroupSummary } from './data-source-group-summary';
import { DataSourceGroupSummary2 } from './data-source-group-summary-2';

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

function PartialFraction({ loadStatus }: { loadStatus: GroupLoadStatus }) {
  const { t } = useTranslation();
  if (loadStatus.status !== 'partial') {
    return null;
  }
  const loaded = loadStatus.loadedPrefixes.length;
  const total = loaded + loadStatus.failedPrefixes.length + loadStatus.notAttemptedPrefixes.length;
  return (
    <div className="text-muted-foreground mt-1 text-xs">
      {t('dataSourceSettings.partial.fraction', { loaded, total })}
    </div>
  );
}

function FailureList({ loadStatus }: { loadStatus: GroupLoadStatus }) {
  if (loadStatus.status !== 'failed' && loadStatus.status !== 'partial') {
    return null;
  }
  if (loadStatus.failedPrefixes.length === 0) {
    return null;
  }
  return (
    <ul className="text-destructive mt-1 space-y-0.5 text-xs">
      {loadStatus.failedPrefixes.map((f) => (
        <li key={f.prefix} className="wrap-break-word">
          <span className="font-mono">{f.prefix}</span>: {f.error.message}
        </li>
      ))}
    </ul>
  );
}

interface DataSourceGroupItemProps {
  groupName: string;
  routeTypeEmoji: string;
  countryEmoji: string;
  loadStatus: GroupLoadStatus;
  groupInfo: DataSourceGroupInfo | null;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (next: boolean) => void;
}

export function DataSourceGroupItem({
  groupName,
  routeTypeEmoji,
  countryEmoji,
  loadStatus,
  groupInfo,
  checked,
  disabled,
  onCheckedChange,
}: DataSourceGroupItemProps) {
  const { t } = useTranslation();

  return (
    <div className="border-border/40 flex items-center gap-2 border-b px-2 py-2 last:border-b-0">
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={t('dataSourceSettings.toggle.aria', {
          group: groupName,
        })}
        className="shrink-0"
      />
      <span
        aria-label={t(`dataSourceSettings.status.${loadStatus.status}`)}
        className="w-5 shrink-0 text-center"
      >
        {statusIcon(loadStatus.status)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-foreground flex flex-wrap items-baseline gap-2 font-medium">
          <span>{groupName}</span>
          {routeTypeEmoji !== '' && (
            <span aria-hidden className="text-sm">
              {routeTypeEmoji}
            </span>
          )}
          {countryEmoji !== '' && (
            <span aria-hidden className="text-sm">
              {countryEmoji}
            </span>
          )}
        </div>
        <DataSourceGroupSummary groupInfo={groupInfo} />
        <DataSourceGroupSummary2 groupInfo={groupInfo} />
        <PartialFraction loadStatus={loadStatus} />
        <FailureList loadStatus={loadStatus} />
      </div>
    </div>
  );
}
