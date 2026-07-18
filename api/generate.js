import { buildDocPrompt } from '../lib/prompts.js';
import { callGemini, callOpenAI, callAnthropic } from '../lib/providers.js';

const MAX_CHAR_LIMIT = 50000;
const SUPPORTED_PROVIDERS = new Set(['gemini', 'openai', 'anthropic']);

/**
 * Serverless function to generate documentation using AI.
 * Accepts POST requests with `{ code, language, outputFormat, model, provider, userApiKey }`.
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
  const { code, language, outputFormat, model, provider, userApiKey } = req.body || {};

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

  if (!provider || !SUPPORTED_PROVIDERS.has(provider.toLowerCase())) {
    return res.status(400).json({ 
      success: false, 
      error: `Unsupported provider "${provider}". Supported: gemini, openai, anthropic.` 
    });
  }

  // 2. Free Tier Limit Checks (Stubbed for Phase 6 KV logic)
  const hasFreeUsesRemaining = true; // TODO: Integrate real KV usage limits here
  if (!userApiKey && !hasFreeUsesRemaining) {
    return res.status(429).json({
      success: false,
      error: 'Free tier limits reached. Please configure your custom API Key to continue.'
    });
  }

  // 3. Resolve API Key matching target provider
  const resolvedProvider = provider.toLowerCase();
  let apiKey = userApiKey;

  if (!apiKey) {
    // Resolve server-side key
    if (resolvedProvider === 'gemini') {
      apiKey = process.env.GEMINI_API_KEY;
    } else if (resolvedProvider === 'openai') {
      apiKey = process.env.OPENAI_API_KEY;
    } else if (resolvedProvider === 'anthropic') {
      apiKey = process.env.ANTHROPIC_API_KEY;
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
    // Determine status code based on error keywords
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

  // 6. Defensive Code Fence Cleaning
  let documentedCode = responseData.text || '';
  // Match any markdown codeblock wraps (e.g. ```javascript ... ```) and extract only inner code
  const codeBlockRegex = /^```[a-zA-Z0-9-]*\n([\s\S]*?)\n```$/;
  const match = documentedCode.trim().match(codeBlockRegex);
  if (match) {
    documentedCode = match[1];
  } else {
    // Basic fallback to strip starting and trailing fences if mismatched
    documentedCode = documentedCode
      .replace(/^```[a-zA-Z0-9-]*\n/, '')
      .replace(/\n```$/, '')
      .trim();
  }

  // 7. Success Response
  return res.status(200).json({
    success: true,
    documentedCode
  });
}
