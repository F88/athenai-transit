import { useState } from 'react';
import type { InfoLevel } from '../types/app/settings';
import type { AnchorEntry } from '../domain/portal/anchor';
import type { StopWithMeta } from '../types/app/transit-composed';
import { resolveAgencyLang } from '../config/transit-defaults';
import { getStopDisplayNames } from '../domain/transit/get-stop-display-names';
import { useInfoLevel } from '../hooks/use-info-level';
import { routeTypesEmoji } from '../utils/route-type-emoji';
import { DoorOpen } from 'lucide-react';
import { createLogger } from '../lib/logger';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select';

const logger = createLogger('Portals');

interface PortalsProps {
  anchors: AnchorEntry[];
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /**
   * Looks up an anchored stop's current `StopWithMeta` from the
   * repository's full dataset (not just the visible viewport).
   * Used to resolve the anchor's display name in the user's current
   * language from the latest GTFS data at render time, so newly
   * added translations flow through without needing to rewrite the
   * stored anchor entry.
   */
  lookupAnchorStopMeta: (stopId: string) => StopWithMeta | null;
  onSelect: (entry: AnchorEntry) => void;
}

/**
 * Portal dropdown for navigating to anchor (bookmarked) stops.
 *
 * Shows a compact button at the top of the map. When clicked,
 * opens a list of anchors. Selecting one navigates the map there.
 * When no anchors exist, returns null.
 *
 * @param anchors - Anchor entries, most recently added first.
 * @param infoLevel - Controls display detail.
 * @param onSelect - Called when an anchor entry is chosen.
 */
export function Portals({
  anchors,
  infoLevel,
  dataLang,
  lookupAnchorStopMeta,
  onSelect,
}: PortalsProps) {
  const il = useInfoLevel(infoLevel);
  const [open, setOpen] = useState(false);

  if (anchors.length === 0) {
    return null;
  }

  const anchorMap = new Map(anchors.map((a) => [a.stopId, a]));

  const handleValueChange = (stopId: string) => {
    const entry = anchorMap.get(stopId);
    if (entry) {
      logger.debug(`select: stopId=${stopId}, name=${entry.stopName}`);
      onSelect(entry);
    }
  };

  return (
    <div>
      {/* INTENTIONAL: value is always "" — same technique as StopHistory.
          Keeps every click firing onValueChange, even for re-selection. */}
      <Select value="" onValueChange={handleValueChange} open={open} onOpenChange={setOpen}>
        <SelectTrigger
          className="h-8 gap-1.5 rounded-2xl border-none bg-white/70 px-2 text-sm text-black/80 dark:bg-black/60 dark:text-white/80"
          aria-label="Portal"
        >
          <span data-slot="select-value" className="flex items-center gap-1!">
            <DoorOpen size={14} strokeWidth={3} className="text-pink-400" />
            <span className="text-xs">{anchors.length}</span>
          </span>
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="z-1002 max-h-[40dvh] min-w-48 border-none bg-white/80 text-black backdrop-blur-sm dark:bg-black/80 dark:text-white"
        >
          {anchors.map((entry) => {
            const meta = lookupAnchorStopMeta(entry.stopId);
            const displayName = meta
              ? getStopDisplayNames(
                  meta.stop,
                  dataLang,
                  resolveAgencyLang(meta.agencies, meta.stop.agency_id),
                ).name || entry.stopName
              : entry.stopName;
            return (
              <SelectItem
                key={entry.stopId}
                value={entry.stopId}
                className="overflow-hidden focus:bg-black/10 focus:text-black dark:focus:bg-white/20 dark:focus:text-white"
              >
                <span className="shrink-0 text-base">{routeTypesEmoji(entry.routeTypes)}</span>
                <span className="max-w-[60dvw] truncate">{displayName}</span>
                {il.isVerboseEnabled && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {entry.stopId}
                  </Badge>
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
