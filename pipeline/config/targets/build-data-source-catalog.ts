/**
 * Target list for DataSourceCatalogBundle build.
 *
 * Each entry is a prefix included in the generated
 * `global/data-source-catalog.json` artifact.
 *
 * Kept separate from other target lists so the catalog build can evolve
 * independently if its required source set diverges.
 */
import { PREFIX_ALL_TARGETS } from './target-const';

const TARGETS = PREFIX_ALL_TARGETS;
export default TARGETS;
