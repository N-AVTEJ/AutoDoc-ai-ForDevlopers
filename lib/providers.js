/**
 * AI Provider API Callers.
 * Communicates with Gemini, OpenAI, and Anthropic REST endpoints.
 * All functions return a standardized response: { text: string, success: boolean, error?: string }
 */

// Model Mappings from UI identifier to exact provider API identifier
export const MODEL_MAPPINGS = {
  gemini: 'gemini-3.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022'
};

/**
 * Shared HTTP request dispatcher.
 * Handles fetch calls and basic network failures.
 * 
 * @param {string} url - Target endpoint URL.
 * @param {Object} options - Request options (headers, body, method).
 * @param {string} providerName - Name of the provider for cleaner error formatting.
 * @returns {Promise<Response>}
 */
async function performRequest(url, options, providerName) {
  // CRITICAL TRUST & SECURITY REQUIREMENT:
  // Never log the apiKey value, request headers, or raw bodies containing keys.
  // Ensure console.log operations do not print or leak credentials.
  try {
    const response = await fetch(url, options);
    return response;
  } catch (err) {
    throw new Error(`Failed to establish connection to ${providerName}: ${err.message}`);
  }
}

/**
 * Standardizes provider-specific error responses into a human-readable format.
 * 
 * @param {number} status - HTTP status code.
 * @param {string} rawBody - Raw error body string from the endpoint.
 * @param {string} provider - Provider name.
 * @returns {string}
 */
function mapProviderError(status, rawBody, provider) {
  let details = '';
  try {
    const json = JSON.parse(rawBody);
    details = json.error?.message || json.error || rawBody;
  } catch (e) {
    details = rawBody || 'Unknown API error';
  }

  switch (status) {
    case 400:
      return `${provider} bad request (400): ${details}`;
    case 401:
      return `${provider} authentication failed (401): Please verify that your API key is correct and valid.`;
    case 403:
      return `${provider} permission denied (403): ${details}`;
    case 404:
      return `${provider} endpoint/model not found (404): ${details}`;
    case 429:
      return `${provider} rate limit exceeded (429): You have hit the API limits or quota restrictions. Please check your billing.`;
    default:
      return `${provider} responded with status ${status}: ${details}`;
  }
}

/**
 * Calls the Google Gemini API to generate content.
 * 
 * @param {Object} params
 * @param {string} params.apiKey - Google Gemini API Key.
 * @param {string} params.prompt - Formatted instruction prompt.
 * @param {string} params.model - Target model name.
 * @returns {Promise<{ text: string, success: boolean, error?: string }>}
 */
export async function callGemini({ apiKey, prompt, model }) {
  const activeModel = MODEL_MAPPINGS[model] || MODEL_MAPPINGS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1/models/${activeModel}:generateContent?key=${apiKey}`;

  try {
    const response = await performRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    }, 'Gemini');

    const responseText = await response.text();

    if (!response.ok) {
      return {
        text: '',
        success: false,
        error: mapProviderError(response.status, responseText, 'Gemini')
      };
    }

    const data = JSON.parse(responseText);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return {
        text: '',
        success: false,
        error: 'Gemini returned an empty response candidate structure.'
      };
    }

    return { text, success: true };
  } catch (err) {
    return { text: '', success: false, error: err.message };
  }
}

/**
 * Calls the OpenAI API chat completion endpoint.
 * 
 * @param {Object} params
 * @param {string} params.apiKey - OpenAI API Key.
 * @param {string} params.prompt - Formatted instruction prompt.
 * @param {string} params.model - Target model name.
 * @returns {Promise<{ text: string, success: boolean, error?: string }>}
 */
export async function callOpenAI({ apiKey, prompt, model }) {
  const activeModel = MODEL_MAPPINGS[model] || MODEL_MAPPINGS.openai;
  const url = 'https://api.openai.com/v1/chat/completions';

  try {
    const response = await performRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [{ role: 'user', content: prompt }]
      })
    }, 'OpenAI');

    const responseText = await response.text();

    if (!response.ok) {
      return {
        text: '',
        success: false,
        error: mapProviderError(response.status, responseText, 'OpenAI')
      };
    }

    const data = JSON.parse(responseText);
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      return {
        text: '',
        success: false,
        error: 'OpenAI returned an empty choices list.'
      };
    }

    return { text, success: true };
  } catch (err) {
    return { text: '', success: false, error: err.message };
  }
}

/**
 * Calls the Anthropic Claude API messages endpoint.
 * 
 * @param {Object} params
 * @param {string} params.apiKey - Anthropic API Key.
 * @param {string} params.prompt - Formatted instruction prompt.
 * @param {string} params.model - Target model name.
 * @returns {Promise<{ text: string, success: boolean, error?: string }>}
 */
export async function callAnthropic({ apiKey, prompt, model }) {
  const activeModel = MODEL_MAPPINGS[model] || MODEL_MAPPINGS.anthropic;
  const url = 'https://api.anthropic.com/v1/messages';

  try {
    const response = await performRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: activeModel,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    }, 'Anthropic');

    const responseText = await response.text();

    if (!response.ok) {
      return {
        text: '',
        success: false,
        error: mapProviderError(response.status, responseText, 'Anthropic')
      };
    }

    const data = JSON.parse(responseText);
    const text = data.content?.[0]?.text;

    if (!text) {
      return {
        text: '',
        success: false,
        error: 'Anthropic returned an empty message content block.'
      };
    }

    return { text, success: true };
  } catch (err) {
    return { text: '', success: false, error: err.message };
  }
}
