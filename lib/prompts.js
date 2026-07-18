/**
 * Prompts helper for AutoDoc AI.
 */

/**
 * Builds the documentation generation and bug analysis prompt.
 * 
 * @param {Object} params
 * @param {string} params.code - The original code snippet.
 * @param {string} params.language - Selected programming language.
 * @param {string} params.outputFormat - Target output documentation format.
 * @returns {string}
 */
export function buildDocPrompt({ code, language, outputFormat }) {
  return `You are an elite software engineer. Your task is to document the following code and perform a brief bug/code smell analysis.

Language: ${language || 'Auto-detect'}
Format: ${outputFormat || 'Docstring/JSDoc'}

Follow these strict rules:
1. Write clean, idiomatic inline comments or documentation blocks (such as JSDoc block tags for JS/TS, or triple-quoted docstrings for Python) matching the target format.
2. Preserve all original code structure, variable naming, and programming logic EXACTLY as provided. Do not refactor or change the functionality.
3. Perform a quick quality review. If you identify any obvious bugs, potential errors, or distinct code smells, write a short, clear summary of these findings inside a comment block at the very top of the file (using the appropriate comment prefix for the target language).
4. Return ONLY the documented code. Do NOT wrap your output in markdown code fences (like \`\`\`js or \`\`\`) and do not include any introductory or concluding conversational explanations. The returned text must be valid source code that can be saved directly to a file.

Original Code Content:
${code}`;
}
