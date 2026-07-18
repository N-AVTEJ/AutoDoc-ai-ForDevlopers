import { generateCompletion } from '../lib/providers.js';

// In-memory counter mapping IP/Session to remaining free requests
const freeUsageLimits = new Map();
const MAX_FREE_USES = 3;

/**
 * Serverless function to generate documentation using AI.
 * Accepts POST requests with `{ code, language, outputFormat, model, customApiKey }`.
 * 
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { code, language, outputFormat, model, customApiKey } = req.body || {};

  if (!code) {
    return res.status(400).json({ error: 'Code content is required' });
  }

  // 1. Resolve client IP or identifier to track limits
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous';
  
  // 2. Fetch or initialize free limit tracking
  if (!freeUsageLimits.has(ip)) {
    freeUsageLimits.set(ip, MAX_FREE_USES);
  }
  let remainingFree = freeUsageLimits.get(ip);

  // 3. Select API Key & Provider
  let apiKey = customApiKey || process.env.GEMINI_API_KEY;
  let provider = 'gemini';

  const lowerModel = (model || '').toLowerCase();
  if (lowerModel.includes('gpt') || lowerModel.includes('openai')) {
    provider = 'openai';
  } else if (lowerModel.includes('claude') || lowerModel.includes('anthropic')) {
    provider = 'anthropic';
  }

  // If calling the free tier (no custom key provided)
  if (!customApiKey) {
    if (remainingFree <= 0) {
      return res.status(403).json({
        error: 'You have reached the free tier limit of 3 documents. Please set your own API key to continue.',
        remainingFree: 0
      });
    }

    // Decrement count
    remainingFree--;
    freeUsageLimits.set(ip, remainingFree);

    // Ensure we have a server-side key for the default provider
    if (!apiKey) {
      return res.status(500).json({
        error: 'Free tier API key is missing on the server. Please click the "API Key" button at the top right and set your own key.',
        remainingFree: remainingFree + 1 // Refund
      });
    }
  }

  // 4. Construct Prompt
  const prompt = `You are an expert developer. Please document the following code in the specified language and format, and perform a bug analysis.
Language: ${language || 'Auto-detect'}
Format: ${outputFormat || 'Docstring/JSDoc'}

Rules:
1. Generate clean, descriptive inline documentation (e.g. JSDoc comments or docstrings).
2. Perform a code quality check and bug analysis. If you find bugs, security issues, or performance bottlenecks, write a summary of these bugs in a comment block at the very top of the file.
3. Return ONLY the final documented code. Do NOT wrap the code in markdown code fences (such as \`\`\`) and do not include extra chat explanation text. The response must be a direct drop-in replacement of the original code file.

Original Code:
${code}`;

  try {
    // 5. Invoke selected provider
    const documentedCode = await generateCompletion(prompt, provider, model || 'gemini-2.5-flash', apiKey);

    return res.status(200).json({
      documentedCode,
      remainingFree: customApiKey ? null : remainingFree
    });
  } catch (error) {
    console.error('LLM Generation failed:', error);
    
    // Refund free limit count if it failed
    if (!customApiKey) {
      freeUsageLimits.set(ip, remainingFree + 1);
    }

    return res.status(500).json({
      error: `AI Generation failed: ${error.message}`
    });
  }
}
