import { kv } from '@vercel/kv';

/**
 * Daily free tier limits for non-authenticated requests.
 */
export const DAILY_FREE_LIMIT = 3;

/**
 * Builds a KV key for tracking daily usage.
 * Resets daily automatically by including the current date.
 * 
 * @param {string} identifier - Unique client identifier (e.g., hashed IP or session ID).
 * @returns {string}
 */
export function getUsageKey(identifier) {
  const dateStr = new Date().toISOString().split('T')[0];
  return `usage:${identifier}:${dateStr}`;
}

/**
 * Reads usage from KV and returns the remaining free uses.
 * Returns dailyLimit if KV fails or is unconfigured, or if key does not exist.
 * 
 * @param {string} identifier - Unique client identifier.
 * @param {number} dailyLimit - Daily usage limit.
 * @returns {Promise<number>}
 */
export async function getRemainingUses(identifier, dailyLimit = DAILY_FREE_LIMIT) {
  try {
    const key = getUsageKey(identifier);
    const count = await kv.get(key);
    if (count === null || count === undefined) {
      return dailyLimit;
    }
    const parsedCount = parseInt(count, 10);
    if (isNaN(parsedCount)) {
      return dailyLimit;
    }
    return Math.max(0, dailyLimit - parsedCount);
  } catch (err) {
    console.error('[KV Error] getRemainingUses failed:', err);
    // Fail closed/safe: return 0 if KV is configured but broken, or throw to be caught by the caller.
    // The requirement says: "fail gracefully — log the error server-side, but don't crash the generate endpoint;
    // reasonable fallback is to deny the free request with a clear message rather than silently allowing unlimited free use."
    // So we return 0 remaining to deny the request.
    return 0;
  }
}

/**
 * Increments the daily KV usage count.
 * Sets 24-hour expiration (86400 seconds) on the first write.
 * 
 * @param {string} identifier - Unique client identifier.
 * @returns {Promise<boolean>}
 */
export async function incrementUsage(identifier) {
  try {
    const key = getUsageKey(identifier);
    const count = await kv.incr(key);
    if (count === 1) {
      // Set key to expire in 24 hours (86400 seconds) on first increment
      await kv.expire(key, 86400);
    }
    return true;
  } catch (err) {
    console.error('[KV Error] incrementUsage failed:', err);
    return false;
  }
}
