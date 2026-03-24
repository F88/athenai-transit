import type { Route, RouteType, Stop } from './transit';

/** Map viewport bounds defined by north/south/east/west edges. */
export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** User's geographic position obtained via the Geolocation API. */
export interface UserLocation {
  lat: number;
  lng: number;
  /** Accuracy in meters. */
  accuracy: number;
}

/** Geographic coordinate (latitude / longitude). */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * A marker displayed at the screen edge pointing toward an off-screen stop.
 *
 * Position (x, y) is in screen pixels, clamped to the viewport boundary.
 * The angle indicates the direction from screen center to the stop.
 */
export interface EdgeMarker {
  stop: Stop;
  routeTypes: RouteType[]; // GTFS route_type values (0=tram, 1=subway, 2=rail, 3=bus)
  x: number; // screen-edge pixel x
  y: number; // screen-edge pixel y
  angle: number; // radians, for arrow rotation
  hAlign: 'left' | 'center' | 'right'; // horizontal alignment based on which edge
  distance: number; // meters from map center to the stop
}

/** A route polyline for map rendering, with its display color. */
export interface RouteShape {
  routeId: string;
  routeType: RouteType; // GTFS route_type (0=tram, 1=subway, 2=rail, 3=bus) — always single for a route
  color: string; // hex with #, e.g. "#F1B34E"
  route: Route | null; // full Route object for display; null if routeMap lookup fails
  /**
   * Shape points as [lat, lon] or [lat, lon, dist].
   * The optional third element is GTFS shape_dist_traveled —
   * cumulative distance along the shape from the first point.
   * Currently no sources provide dist; Leaflet ignores the third element.
   */
  points: [number, number, number?][];
  /**
   * Departures per day for the primary trip pattern using this shape.
   * Derived from InsightsBundle tripPatternStats.
   * Can be used for line thickness visualization.
   */
  freq?: number;
  /**
   * Total path distance (km) along the stop sequence.
   * Derived from InsightsBundle tripPatternGeo.
   */
  pathDist?: number;
  /**
   * Whether this route is circular (first and last stop are the same).
   * Derived from InsightsBundle tripPatternGeo.
   */
  isCircular?: boolean;
}
