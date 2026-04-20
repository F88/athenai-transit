/** Canonical GTFS Color value: uppercase `RRGGBB` without a leading `#`. */
export type GtfsColor = string & { readonly __brand: 'GtfsColor' };

/** CSS-ready color value such as `#RRGGBB`. */
export type CssColor = string & { readonly __brand: 'CssColor' };

/** Return format for GTFS color values. */
export type GtfsColorFormat = 'raw' | 'css-hex';
