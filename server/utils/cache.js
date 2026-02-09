// utils/cache.js
/**
 * In-memory TTL cache for admin dashboard responses.
 * Performance rule: Cache admin dashboard response for 30–60 seconds.
 * TTL set to 45s. Key by timeRange to avoid stale data per range.
 */

const CACHE_TTL_MS = 45 * 1000; // 45 seconds (between 30–60)

const store = new Map();

/**
 * @param {string} key
 * @returns {{ value: any } | null}
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return { value: entry.value };
}

/**
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlMs]
 */
function set(key, value, ttlMs = CACHE_TTL_MS) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * @param {string} key
 */
function del(key) {
  store.delete(key);
}

/**
 * Build cache key for admin dashboard.
 * @param {string} timeRange
 * @returns {string}
 */
export function adminDashboardCacheKey(timeRange) {
  return `admin-dashboard:${timeRange || '30d'}`;
}

export const cache = { get, set, del };
