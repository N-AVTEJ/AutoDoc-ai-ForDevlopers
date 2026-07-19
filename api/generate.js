import { buildDocPrompt } from '../lib/prompts.js';
import { callGemini, callOpenAI, callAnthropic } from '../lib/providers.js';
import { getRemainingUses, incrementUsage, DAILY_FREE_LIMIT } from '../lib/kv.js';

const MAX_CHAR_LIMIT = 50000;
const SUPPORTED_PROVIDERS = new Set(['gemini', 'openai', 'anthropic']);

/**
 * Serverless function to generate documentation using AI.
 * Accepts POST requests with `{ code, language, outputFormat, model, provider, userApiKey, customApiKey }`.
 * 
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  // CRITICAL TRUST & SECURITY REQUIREMENT:
  // Do NOT console.log the req.body or any variables containing custom keys.
  const { code, language, outputFormat } = req.body || {};
  
  // Extract and normalize keys
  const reqModel = req.body.model;
  const reqProvider = req.body.provider;
  const userApiKey = req.body.userApiKey || req.body.customApiKey;

  // 1. Input Validation
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'Code content must be a non-empty string.' });
  }

  if (code.length > MAX_CHAR_LIMIT) {
    return res.status(400).json({ 
      success: false, 
      error: `Code length exceeds the limit of ${MAX_CHAR_LIMIT.toLocaleString()} characters.` 
    });
  }

  const isFreeTier = !userApiKey;
  let provider = reqProvider;
  let model = reqModel;
  let identifier = '';
  let remainingFree = DAILY_FREE_LIMIT;

  // Derive provider from model if provider is omitted (robust mapping for SPA client)
  if (!provider && model) {
    if (model.includes('openai') || model.includes('gpt')) {
      provider = 'openai';
    } else if (model.includes('anthropic') || model.includes('claude')) {
      provider = 'anthropic';
    } else {
      provider = 'gemini';
    }
  }

  // 2. Free Tier Limit Checks & Cost Safety Override
  if (isFreeTier) {
    // Derive unique client identifier (IP address)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous';
    identifier = ip.split(',')[0].trim();

    try {
      remainingFree = await getRemainingUses(identifier, DAILY_FREE_LIMIT);
    } catch (err) {
      console.error('[KV Error] Fetching free-tier remaining uses failed:', err);
      // Fallback: deny request to prevent unlimited free use when KV is misconfigured/unreachable
      return res.status(429).json({
        success: false,
        error: 'Usage limit check failed. Please configure your custom API Key to continue.'
      });
    }

    if (remainingFree <= 0) {
      return res.status(429).json({
        success: false,
        error: 'Free tier limit reached for today. Add your own API key to continue.'
      });
    }

    // Cost safety override: Free tier requests are forced to the cheapest Gemini model
    provider = 'gemini';
    model = 'gemini';
  }

  // Ensure resolved provider is supported
  if (!provider || !SUPPORTED_PROVIDERS.has(provider.toLowerCase())) {
    return res.status(400).json({ 
      success: false, 
      error: `Unsupported provider "${provider}". Supported: gemini, openai, anthropic.` 
    });
  }

  const resolvedProvider = provider.toLowerCase();
  let apiKey = userApiKey;

  // 3. Resolve Server-Side Free-Tier API Key
  if (!apiKey) {
    if (resolvedProvider === 'gemini') {
      apiKey = process.env.GEMINI_FREE_KEY || process.env.GEMINI_API_KEY;
    } else if (resolvedProvider === 'openai') {
      apiKey = process.env.OPENAI_FREE_KEY || process.env.OPENAI_API_KEY;
    } else if (resolvedProvider === 'anthropic') {
      apiKey = process.env.ANTHROPIC_FREE_KEY || process.env.ANTHROPIC_API_KEY;
    }
  }

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: `API key for provider "${provider}" is not configured on the server. Please add your own API Key.`
    });
  }

  // 4. Construct Prompt
  const prompt = buildDocPrompt({ code, language, outputFormat });

  // 5. Dispatch API Call
  let responseData;
  const callParams = { apiKey, prompt, model };

  switch (resolvedProvider) {
    case 'gemini':
      responseData = await callGemini(callParams);
      break;
    case 'openai':
      responseData = await callOpenAI(callParams);
      break;
    case 'anthropic':
      responseData = await callAnthropic(callParams);
      break;
  }

  if (!responseData.success) {
    let statusCode = 500;
    const lowerError = (responseData.error || '').toLowerCase();
    if (lowerError.includes('authentication') || lowerError.includes('401')) {
      statusCode = 401;
    } else if (lowerError.includes('rate limit') || lowerError.includes('429') || lowerError.includes('quota')) {
      statusCode = 429;
    } else if (lowerError.includes('bad request') || lowerError.includes('400')) {
      statusCode = 400;
    }

    return res.status(statusCode).json({
      success: false,
      error: responseData.error || 'AI generation failed'
    });
  }

  // 6. Increment Usage for Free Tier on Success
  if (isFreeTier) {
    try {
      await incrementUsage(identifier);
      remainingFree = Math.max(0, remainingFree - 1);
    } catch (err) {
      console.error('[KV Error] Failed to increment usage:', err);
    }
  }

  // 7. Defensive Code Fence Cleaning
  let documentedCode = responseData.text || '';
  const codeBlockRegex = /^```[a-zA-Z0-9-]*\n([\s\S]*?)\n```$/;
  const match = documentedCode.trim().match(codeBlockRegex);
  if (match) {
    documentedCode = match[1];
  } else {
    documentedCode = documentedCode
      .replace(/^```[a-zA-Z0-9-]*\n/, '')
      .replace(/\n```$/, '')
      .trim();
  }

  // 8. Success Response
  const result = {
    success: true,
    documentedCode
  };

  if (isFreeTier) {
    result.remainingFree = remainingFree;
  }

  return res.status(200).json(result);
}
