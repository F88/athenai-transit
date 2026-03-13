/**
 * Target list for batch GTFS JSON builds.
 *
 * Each entry is a source-name (filename without .ts extension)
 * from pipeline/resources/gtfs/.
 *
 * Comment out entries to temporarily skip them.
 */
export default ['toei-bus', 'toei-train', 'kanto-bus', 'suginami-gsm'];
