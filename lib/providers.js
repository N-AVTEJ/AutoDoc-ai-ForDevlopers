/**
 * AI Provider API Callers.
 * Communicates with Gemini, OpenAI, and Anthropic REST endpoints directly using fetch.
 */

/**
 * Call Gemini API generateContent endpoint.
 * 
 * @param {string} prompt 
 * @param {string} model - e.g., 'gemini-1.5-flash' or 'gemini-2.5-flash'
 * @param {string} apiKey 
 * @returns {Promise<string>}
 */
export async function callGemini(prompt, model, apiKey) {
  // Normalize model name (use gemini-3.5-flash as the active quota model)
  const normalizedModel = 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1/models/${normalizedModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned an empty response structure');
  }

  return text;
}

/**
 * Call OpenAI API chat/completions endpoint.
 * 
 * @param {string} prompt 
 * @param {string} model - e.g., 'gpt-4o-mini' or 'gpt-4o'
 * @param {string} apiKey 
 * @returns {Promise<string>}
 */
export async function callOpenAI(prompt, model, apiKey) {
  const normalizedModel = model.includes('mini') ? 'gpt-4o-mini' : 'gpt-4o';
  const url = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: normalizedModel,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenAI API returned an empty response structure');
  }

  return text;
}

/**
 * Call Anthropic API messages endpoint.
 * 
 * @param {string} prompt 
 * @param {string} model - e.g., 'claude-3-5-sonnet'
 * @param {string} apiKey 
 * @returns {Promise<string>}
 */
export async function callAnthropic(prompt, model, apiKey) {
  const normalizedModel = 'claude-3-5-sonnet-20241022';
  const url = 'https://api.anthropic.com/v1/messages';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-html-human': 'true' // Vercel environment custom permission bypass if needed
    },
    body: JSON.stringify({
      model: normalizedModel,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error('Anthropic API returned an empty response structure');
  }

  return text;
}

/**
 * Standard router to dispatch generation prompt to the selected LLM provider.
 * 
 * @param {string} prompt 
 * @param {string} provider - 'gemini' | 'openai' | 'anthropic'
 * @param {string} model 
 * @param {string} apiKey 
 * @returns {Promise<string>}
 */
export async function generateCompletion(prompt, provider, model, apiKey) {
  if (!apiKey) {
    throw new Error(`API Key is required to call provider: ${provider}`);
  }

  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case 'gemini':
      return callGemini(prompt, model, apiKey);
    case 'openai':
      return callOpenAI(prompt, model, apiKey);
    case 'anthropic':
      return callAnthropic(prompt, model, apiKey);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
