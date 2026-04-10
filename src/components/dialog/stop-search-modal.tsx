import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_AGENCY_LANG } from '@/config/transit-defaults';
import type { AppRouteTypeValue, Stop } from '@/types/app/transit';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { InfoLevel } from '@/types/app/settings';
import { useInfoLevel } from '@/hooks/use-info-level';
import { katakanaToHiragana } from '@/utils/kana-normalize';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { resolveStopRouteTypes } from '@/domain/transit/resolve-stop-route-types';
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
  routeTypes: AppRouteTypeValue[];
  query: string;
  normalizedQuery: string;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Whether this item is currently highlighted via keyboard navigation. */
  isSelected: boolean;
  /** Ref forwarded to the underlying button so the parent can scroll it into view. */
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: (stop: Stop) => void;
}

function StopSearchResultItem({
  stop,
  routeTypes,
  query,
  normalizedQuery,
  infoLevel,
  dataLang,
  isSelected,
  buttonRef,
  onSelect,
}: StopSearchResultItemProps) {
  const info = useInfoLevel(infoLevel);
  // Always show subNames in search results for discoverability.
  const stopNames = getStopDisplayNames(stop, dataLang, DEFAULT_AGENCY_LANG);

  return (
    <button
      ref={buttonRef}
      className={`border-border active:bg-accent flex w-full cursor-pointer items-center gap-2.5 border-t-0 border-r-0 border-b border-l-0 px-4 py-3 text-left font-[inherit] last:border-b-0 ${
        isSelected ? 'bg-accent' : 'bg-transparent'
      }`}
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
  const [routeTypeMap, setRouteTypeMap] = useState<Map<string, AppRouteTypeValue[]>>(
    () => new Map(),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
            const routeTypes = rtResult.success ? rtResult.data : [-1 as const];
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
        setSelectedIndex(0);
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

  // Reset highlight to the first row whenever the result set changes so the
  // user can press Enter immediately after typing. We use the official
  // React 19 "store info from previous renders" pattern: comparing the
  // memoised filteredStops identity in render and updating state inline,
  // rather than running a setState inside useEffect (which is now lint-banned).
  // Stale entries in itemRefs.current are cleared automatically: callback
  // refs of unmounted rows are invoked with null on the next commit.
  const [lastFilteredStops, setLastFilteredStops] = useState(filteredStops);
  if (lastFilteredStops !== filteredStops) {
    setLastFilteredStops(filteredStops);
    setSelectedIndex(0);
  }

  // Scroll the highlighted row into view whenever the selection changes.
  // `block: 'nearest'` keeps the row visible without jumping the list around
  // when the row is already on screen.
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (stop: Stop) => {
      onSelectStop(stop);
    },
    [onSelectStop],
  );

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      // Skip while IME composition is in progress so the Enter that confirms
      // the conversion does not also pick a result.
      if (event.nativeEvent.isComposing) {
        return;
      }
      if (filteredStops.length === 0) {
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, filteredStops.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const target = filteredStops[selectedIndex] ?? filteredStops[0];
        if (target) {
          handleSelect(target);
        }
      }
    },
    [filteredStops, selectedIndex, handleSelect],
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
            onKeyDown={handleInputKeyDown}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredStops.length > 0
            ? filteredStops.map((stop, index) => (
                <StopSearchResultItem
                  key={stop.stop_id}
                  stop={stop}
                  routeTypes={resolveStopRouteTypes({
                    stopId: stop.stop_id,
                    routeTypeMap,
                    routes: null,
                    unknownPolicy: 'include-unknown',
                  })}
                  query={trimmedQuery}
                  normalizedQuery={normalizedQuery}
                  infoLevel={infoLevel}
                  dataLang={dataLang}
                  isSelected={index === selectedIndex}
                  buttonRef={(el) => {
                    itemRefs.current[index] = el;
                  }}
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
