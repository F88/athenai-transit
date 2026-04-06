import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RouteType, Stop } from '@/types/app/transit';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { InfoLevel } from '@/types/app/settings';
import { useInfoLevel } from '@/hooks/use-info-level';
import { katakanaToHiragana } from '@/utils/kana-normalize';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { routeTypesEmoji } from '@/utils/route-type-emoji';
import { createLogger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const logger = createLogger('StopSearch');

const MAX_RESULTS = 20;

interface StopSearchResultItemProps {
  stop: Stop;
  routeTypes: RouteType[];
  query: string;
  normalizedQuery: string;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  onSelect: (stop: Stop) => void;
}

function StopSearchResultItem({
  stop,
  routeTypes,
  query,
  normalizedQuery,
  infoLevel,
  dataLang,
  onSelect,
}: StopSearchResultItemProps) {
  const info = useInfoLevel(infoLevel);
  // Always show subNames in search results for discoverability.
  const stopNames = getStopDisplayNames(stop, 'normal', dataLang);

  return (
    <button
      className="border-border active:bg-accent flex w-full cursor-pointer items-center gap-2.5 border-t-0 border-r-0 border-b border-l-0 bg-transparent px-4 py-3 text-left font-[inherit] last:border-b-0"
      onClick={() => onSelect(stop)}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        {info.isVerboseEnabled && (
          <span className="text-muted-foreground bg-muted inline-block self-start rounded px-1.5 py-px text-[10px] leading-[1.4]">
            {stop.stop_id}
          </span>
        )}
        <span className="text-foreground text-[15px]">
          {routeTypesEmoji(routeTypes)}{' '}
          <HighlightedName name={stopNames.name} query={query} normalizedQuery={normalizedQuery} />
        </span>
        {stopNames.subNames.length > 0 && (
          <span className="text-muted-foreground text-xs leading-snug">
            {stopNames.subNames.map((name, i) => (
              <span key={`${i}-${name}`}>
                {i > 0 && ' / '}
                <HighlightedName name={name} query={query} normalizedQuery={normalizedQuery} />
              </span>
            ))}
          </span>
        )}
      </div>
    </button>
  );
}

function HighlightedName({
  name,
  query,
  normalizedQuery,
}: {
  name: string;
  query: string;
  normalizedQuery: string;
}) {
  if (!query) {
    return <>{name}</>;
  }

  // Try direct match first
  let idx = name.indexOf(query);
  let matchLen = query.length;

  // Fall back to case-insensitive match
  if (idx === -1) {
    idx = name.toLowerCase().indexOf(query.toLowerCase());
    matchLen = query.length;
  }

  // Fall back to normalized (kana) match — 1:1 char mapping preserves indices
  if (idx === -1 && normalizedQuery) {
    idx = katakanaToHiragana(name.toLowerCase()).indexOf(normalizedQuery);
    matchLen = normalizedQuery.length;
  }

  if (idx === -1) {
    return <>{name}</>;
  }

  return (
    <>
      {name.slice(0, idx)}
      <mark className="rounded-sm bg-[#fff9c4] px-px text-inherit dark:bg-yellow-800">
        {name.slice(idx, idx + matchLen)}
      </mark>
      {name.slice(idx + matchLen)}
    </>
  );
}

interface StopSearchModalProps {
  repo: TransitRepository;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  onSelectStop: (stop: Stop) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StopSearchModal({
  repo,
  infoLevel,
  dataLang,
  onSelectStop,
  open,
  onOpenChange,
}: StopSearchModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [routeTypeMap, setRouteTypeMap] = useState<Map<string, RouteType[]>>(() => new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;

    repo
      .getAllStops()
      .then((result) => {
        if (cancelled || !result.success) {
          return;
        }
        setAllStops(result.data);

        // Batch-fetch route types for all stops
        return Promise.all(
          result.data.map(async (stop) => {
            const rtResult = await repo.getRouteTypesForStop(stop.stop_id);
            const routeTypes = rtResult.success ? rtResult.data : [3 as const];
            return [stop.stop_id, routeTypes] as const;
          }),
        ).then((entries) => {
          if (!cancelled) {
            setRouteTypeMap(new Map(entries));
          }
        });
      })
      .catch((error) => {
        logger.error('Failed to load stops for search:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [repo, open]);

  // Auto-focus input on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setQuery('');
      }
    },
    [onOpenChange],
  );

  const filteredStops = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed === '') {
      return [];
    }
    const lowerTrimmed = trimmed.toLowerCase();
    const normalizedQuery = katakanaToHiragana(lowerTrimmed);
    const matches = allStops.filter((s) => {
      if (s.stop_name.includes(trimmed)) {
        return true;
      }
      return Object.values(s.stop_names).some((name) => {
        if (name.includes(trimmed)) {
          return true;
        }
        return katakanaToHiragana(name.toLowerCase()).includes(normalizedQuery);
      });
    });
    // Sort: prefix matches first, then by name length (shorter = more relevant),
    // then by ja-Hrkt reading for correct gojuon order
    matches.sort((a, b) => {
      const aPrefix = a.stop_name.startsWith(trimmed) ? 0 : 1;
      const bPrefix = b.stop_name.startsWith(trimmed) ? 0 : 1;
      if (aPrefix !== bPrefix) {
        return aPrefix - bPrefix;
      }
      if (a.stop_name.length !== b.stop_name.length) {
        return a.stop_name.length - b.stop_name.length;
      }
      return (a.stop_names['ja-Hrkt'] ?? '').localeCompare(b.stop_names['ja-Hrkt'] ?? '', 'ja');
    });
    return matches.slice(0, MAX_RESULTS);
  }, [query, allStops]);

  const trimmedQuery = query.trim();
  const normalizedQuery = katakanaToHiragana(trimmedQuery.toLowerCase());

  const handleSelect = useCallback(
    (stop: Stop) => {
      onSelectStop(stop);
    },
    [onSelectStop],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-12 flex max-h-[80dvh] max-w-120 translate-y-0 flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-border shrink-0 border-b p-4">
          <DialogTitle className="text-[15px]">{t('search.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('search.description')}</DialogDescription>
        </DialogHeader>
        <div className="border-border shrink-0 border-b px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            className="border-input bg-background focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2.5 text-base outline-none focus:ring-2"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredStops.length > 0
            ? filteredStops.map((stop) => (
                <StopSearchResultItem
                  key={stop.stop_id}
                  stop={stop}
                  routeTypes={routeTypeMap.get(stop.stop_id) ?? [3]}
                  query={trimmedQuery}
                  normalizedQuery={normalizedQuery}
                  infoLevel={infoLevel}
                  dataLang={dataLang}
                  onSelect={handleSelect}
                />
              ))
            : query.trim() !== '' && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                  {t('search.noResults')}
                </p>
              )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
