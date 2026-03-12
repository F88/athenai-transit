/**
 * GSI (Geospatial Information Authority of Japan) tile source definitions.
 */
export interface TileSource {
  /** Unique identifier for the tile source. */
  id: string;
  /** Display label for the tile source. */
  label: string;
  /** Minimum zoom level supported by the tile server. */
  minZoom: number;
  /** Maximum zoom level natively available from the tile server. Beyond this, tiles are upscaled. */
  maxNativeZoom: number;
  /** URL template for the tile source. */
  url: string;
  /** HTML attribution string displayed on the map. */
  attribution: string;
}

/** Attribution HTML for GSI tiles. */
const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">国土地理院</a>';

/** Available GSI tile sources for map display. */
export const TILE_SOURCES: TileSource[] = [
  {
    id: 'gsi-pale',
    label: '淡色',
    minZoom: 2,
    maxNativeZoom: 18,
    url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
    attribution: GSI_ATTRIBUTION,
  },
  {
    id: 'gsi-std',
    label: '標準',
    minZoom: 2,
    maxNativeZoom: 18,
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    attribution: GSI_ATTRIBUTION,
  },
  {
    id: 'gsi-photo',
    label: '航空写真',
    minZoom: 2,
    maxNativeZoom: 18,
    url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    attribution: GSI_ATTRIBUTION,
  },
  {
    id: 'gsi-relief',
    label: '標高図',
    minZoom: 5,
    maxNativeZoom: 15,
    url: 'https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png',
    attribution: GSI_ATTRIBUTION,
  },
];
