/**
 * Generic result type for success/failure flows across layers.
 *
 * Keep this type infrastructure-neutral so low-level helpers such as
 * Web Storage or file adapters do not need to depend on app-specific
 * repository type modules.
 */
export type Result<T, E = string> = { success: true; data: T } | { success: false; error: E };

/**
 * Result alias for Web Storage helpers.
 *
 * This keeps the success/failure shape consistent while making the
 * Web Storage-specific meaning explicit at call sites and in signatures.
 */
export type WebStorageResult<T, E = string> = Result<T, E>;
