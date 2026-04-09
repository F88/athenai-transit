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
  /** Maximum zoom level for the map when this tile source is active. Falls back to DEFAULT_MAX_ZOOM if not set. */
  maxZoom?: number;
  /** URL template for the tile source. */
  url: string;
  /** HTML attribution string displayed on the map. */
  attribution: string;
}

/** Attribution HTML for GSI tiles. */
const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">国土地理院</a>';

/** Attribution HTML for Stadia Maps tiles. */
const STADIA_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

/** Attribution HTML for Stadia Maps Stamen Terrain tiles. */
const STADIA_STAMEN_TERRAIN_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank" rel="noopener noreferrer">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

/** Attribution HTML for Stadia Maps Alidade Satellite tiles. */
const STADIA_ALIDADE_SATELLITE_ATTRIBUTION =
  '&copy; CNES, Distribution Airbus DS, &copy; Airbus DS, &copy; PlanetObserver (Contains Copernicus Data) | &copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

/** Attribution HTML for Stadia Maps Stamen Watercolor tiles. */
const STADIA_STAMEN_WATERCOLOR_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank" rel="noopener noreferrer">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

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
    id: 'gsi-relief',
    label: '標高図',
    minZoom: 5,
    maxNativeZoom: 15,
    url: 'https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png',
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
    id: 'stadia-osm-bright',
    label: 'OSM Bright',
    minZoom: 0,
    maxNativeZoom: 20,
    url: 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png',
    attribution: STADIA_ATTRIBUTION,
  },
  {
    id: 'stadia-stamen-terrain',
    label: 'Stamen Terrain',
    minZoom: 0,
    maxNativeZoom: 20,
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
    attribution: STADIA_STAMEN_TERRAIN_ATTRIBUTION,
  },

  {
    id: 'stadia-stamen-watercolor',
    label: 'Stamen Watercolor',
    minZoom: 0,
    maxNativeZoom: 16,
    // maxZoom: 16, // DEFAULT_MAX_ZOOM will apply beyond maxNativeZoom
    url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    attribution: STADIA_STAMEN_WATERCOLOR_ATTRIBUTION,
  },
  {
    id: 'stadia-alidade-satellite',
    label: 'Alidade Satellite',
    minZoom: 0,
    maxNativeZoom: 20,
    url: 'https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg',
    attribution: STADIA_ALIDADE_SATELLITE_ATTRIBUTION,
  },
];
