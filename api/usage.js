import { getRemainingUses, DAILY_FREE_LIMIT } from '../lib/kv.js';

/**
 * Serverless function to get remaining free-tier usage count.
 * 
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Derive client identifier (IP Address)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous';
    // Use first IP if header is a list of proxies
    const identifier = ip.split(',')[0].trim();

    const remaining = await getRemainingUses(identifier, DAILY_FREE_LIMIT);

    return res.status(200).json({
      success: true,
      remaining,
      limit: DAILY_FREE_LIMIT
    });
  } catch (err) {
    console.error('[API Usage Error] Failed to fetch usage:', err);
    // Graceful error response: return 0 remaining to prevent abuse
    return res.status(200).json({
      success: true,
      remaining: 0,
      limit: DAILY_FREE_LIMIT
    });
  }
}
